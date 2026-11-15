import json
import logging
import httpx
from typing import List, Optional
from uuid import uuid4
from app.config import settings
from app.models.ai import AIConversation, AIMessage
from app.models.feature_data import StudyMindMap
from app.models.library import LibraryItem
from app.models.reading import DocumentChunk
from app.schemas.ai import AIChatResponse, SourceReference, AISummarizeResponse, AIFlashcardsResponse, FlashcardItem
from app.schemas.feature_data import MindMapNode

logger = logging.getLogger(__name__)


class AIProviderError(RuntimeError):
    pass


class AIOutputError(RuntimeError):
    pass


class AIService:
    def __init__(self):
        self.provider = settings.ai_provider
        self.gemini_model_name = settings.gemini_model or "gemini-3.1-flash-lite"
        self.api_key = settings.gemini_api_key

    async def _call_llm(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        """Call Gemini REST API with async httpx, multi-model fallback, and robust error handling."""
        full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt

        if self.provider == "gemini" and self.api_key:
            candidate_models = [self.gemini_model_name, "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash-lite"]
            # Deduplicate while preserving order
            seen = set()
            models_to_try = [m for m in candidate_models if not (m in seen or seen.add(m))]

            async with httpx.AsyncClient(timeout=12.0) as client:
                for model in models_to_try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
                    payload = {
                        "contents": [{
                            "parts": [{"text": full_prompt}]
                        }]
                    }
                    try:
                        resp = await client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            candidates = data.get("candidates", [])
                            if candidates:
                                text_parts = candidates[0].get("content", {}).get("parts", [])
                                if text_parts:
                                    return text_parts[0].get("text", "").strip()
                        else:
                            logger.warning(f"Gemini {model} returned {resp.status_code}: {resp.text[:120]}")
                    except (httpx.RequestError, ValueError) as e:
                        logger.warning(f"Gemini {model} request failed: {e}")

        raise AIProviderError(
            "The configured AI provider is unavailable or returned no usable response."
        )

    async def generate_mind_map(
        self,
        user_id: str,
        library_item_id: str,
    ) -> StudyMindMap:
        item = await LibraryItem.get(library_item_id)
        if not item or item.user_id != user_id:
            raise ValueError("Library item not found.")

        chunks = await DocumentChunk.find(
            {"user_id": user_id, "library_item_id": library_item_id}
        ).sort("chunk_index").limit(12).to_list()
        document_text = "\n\n".join(chunk.text for chunk in chunks)
        if not document_text.strip():
            document_text = item.description or ""
        if not document_text.strip():
            raise ValueError(
                "This library item has no extracted text to build a mind map from."
            )

        prompt = (
            f"Create a study mind map grounded only in this document: {item.title!r}.\n"
            f"Author: {item.author or 'Unknown'}\n\n"
            f"Document excerpts:\n{document_text[:12000]}\n\n"
            "Return one JSON object with fields: label, category, priority, summary, "
            "keyTakeaway, formulaOrRule (string or null), and children. The root "
            "category must be 'central'. Each child uses category 'theme', 'concept', "
            "or 'action' and the same fields. Include 3-5 themes and at most 3 levels "
            "of nesting, with no more than 30 nodes total. Keep every claim supported "
            "by the supplied excerpts. Output JSON only."
        )
        raw = await self._call_llm(prompt)
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3].strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start < 0 or end < start:
            raise AIOutputError("The AI provider returned an invalid mind map.")

        try:
            root = MindMapNode.model_validate(json.loads(cleaned[start : end + 1]))
        except (json.JSONDecodeError, ValueError) as exc:
            raise AIOutputError("The AI provider returned an invalid mind map.") from exc

        root.category = "central"
        if not root.children:
            raise AIOutputError("The AI provider returned an empty mind map.")
        count = 0

        def normalize_node(node: MindMapNode, depth: int) -> None:
            nonlocal count
            count += 1
            if count > 30 or depth > 3:
                raise AIOutputError("The generated mind map exceeds supported size limits.")
            node.id = str(uuid4())
            node.mastery_status = "to_learn"
            for child in node.children:
                normalize_node(child, depth + 1)

        normalize_node(root, 1)
        mind_map = StudyMindMap(
            user_id=user_id,
            library_item_id=library_item_id,
            title=item.title,
            tree=root.model_dump(by_alias=True),
        )
        await mind_map.insert()
        return mind_map

    async def chat(
        self,
        user_id: str,
        message: str,
        conversation_id: Optional[str] = None,
        library_item_ids: Optional[List[str]] = None,
        context_limit: int = 5,
    ) -> AIChatResponse:
        """RAG-grounded conversation across the user's library."""
        # 1. Resolve or create conversation
        if conversation_id:
            convo = await AIConversation.get(conversation_id)
            if not convo or convo.user_id != user_id:
                convo = AIConversation(user_id=user_id, title=message[:40])
                await convo.insert()
        else:
            convo = AIConversation(user_id=user_id, title=message[:40])
            await convo.insert()

        # 2. Retrieve relevant context from user library items
        context_snippets = []
        source_refs: List[SourceReference] = []

        # Find items
        item_query = {"user_id": user_id, "is_archived": False}
        if library_item_ids:
            item_query["_id"] = {"$in": library_item_ids}
        
        items = await LibraryItem.find(item_query).limit(context_limit).to_list()
        
        for item in items:
            # Look for chunks
            chunks = await DocumentChunk.find({
                "user_id": user_id,
                "library_item_id": str(item.id)
            }).limit(3).to_list()

            if chunks:
                for c in chunks:
                    context_snippets.append(f"Source [{item.title} - {c.source_location}]: {c.text[:400]}")
                    source_refs.append(SourceReference(
                        item_id=str(item.id),
                        title=item.title,
                        location=c.source_location,
                        snippet=c.text[:150] + "..."
                    ))
            elif item.description:
                context_snippets.append(f"Source [{item.title}]: {item.description}")
                source_refs.append(SourceReference(
                    item_id=str(item.id),
                    title=item.title,
                    location="Overview",
                    snippet=item.description[:150]
                ))

        # 3. Construct grounded prompt
        sources_text = "\n\n".join(context_snippets) if context_snippets else "No specific documents found."
        
        system_instruction = (
            "You are CLIO's intelligent library assistant. Answer the user's question clearly, "
            "synthesizing information from their documents when available. Always cite which book "
            "or document provided the information. Be insightful, concise, and academic."
        )

        user_prompt = (
            f"User Question: {message}\n\n"
            f"Relevant Library Sources:\n{sources_text}\n\n"
            "Provide a helpful answer directly addressing the user's question based on these sources."
        )

        answer = await self._call_llm(user_prompt, system_instruction=system_instruction)

        # 4. Save messages
        user_msg = AIMessage(
            conversation_id=str(convo.id),
            user_id=user_id,
            role="user",
            content=message
        )
        await user_msg.insert()

        bot_msg = AIMessage(
            conversation_id=str(convo.id),
            user_id=user_id,
            role="assistant",
            content=answer,
            source_references=[s.model_dump() for s in source_refs]
        )
        await bot_msg.insert()

        return AIChatResponse(
            conversation_id=str(convo.id),
            message=answer,
            sources=source_refs,
            model=self.gemini_model_name if self.provider == "gemini" else "ollama"
        )

    async def summarize(
        self,
        user_id: str,
        library_item_id: str,
        length: str = "medium"
    ) -> AISummarizeResponse:
        """Generate an AI summary of a library item."""
        item = await LibraryItem.get(library_item_id)
        if not item or item.user_id != user_id:
            raise ValueError("Library item not found.")

        # Gather chunks or description
        chunks = await DocumentChunk.find({
            "user_id": user_id,
            "library_item_id": library_item_id
        }).limit(6).to_list()

        text_content = "\n\n".join([c.text for c in chunks]) if chunks else item.description or ""
        if not text_content.strip():
            raise ValueError("This library item has no extracted text to summarize.")

        prompt = (
            f"Generate a {length} summary of this document titled '{item.title}' by {item.author or 'Unknown'}.\n\n"
            f"Content excerpt:\n{text_content[:3000]}\n\n"
            "Format your response as valid JSON with three keys:\n"
            "- 'summary': string paragraph of the summary\n"
            "- 'key_points': list of 3-5 strings representing key takeaways\n"
            "- 'suggested_questions': list of 3 study questions to test comprehension\n"
            "Output ONLY the JSON object, without backticks or markdown fences."
        )

        raw = await self._call_llm(prompt)
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:-3].strip()
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:-3].strip()
            data = json.loads(cleaned)
            if not isinstance(data, dict):
                raise TypeError("Summary response must be a JSON object.")
            return AISummarizeResponse(
                summary=data["summary"],
                key_points=data["key_points"],
                suggested_questions=data["suggested_questions"],
                model=self.gemini_model_name
            )
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            raise AIOutputError("The AI provider returned an invalid summary.") from exc

    async def generate_flashcards(
        self,
        user_id: str,
        library_item_id: str,
        count: int = 5
    ) -> AIFlashcardsResponse:
        """Generate study flashcards from a library item."""
        item = await LibraryItem.get(library_item_id)
        if not item or item.user_id != user_id:
            raise ValueError("Library item not found.")

        chunks = await DocumentChunk.find({
            "user_id": user_id,
            "library_item_id": library_item_id
        }).limit(5).to_list()

        text_content = "\n\n".join([c.text for c in chunks]) if chunks else item.description or ""
        if not text_content.strip():
            raise ValueError("This library item has no extracted text to generate flashcards from.")

        prompt = (
            f"Generate {count} active-recall study flashcards based on '{item.title}'.\n\n"
            f"Content:\n{text_content[:2500]}\n\n"
            "Format your response as a valid JSON array of objects with keys: 'question', 'answer', 'hint'. "
            "Output ONLY the JSON array, without markdown backticks."
        )

        raw = await self._call_llm(prompt)
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:-3].strip()
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:-3].strip()
            cards_data = json.loads(cleaned)
            if not isinstance(cards_data, list) or not cards_data:
                raise TypeError("Flashcards response must be a non-empty JSON array.")
            cards = [FlashcardItem(**c) for c in cards_data]
            return AIFlashcardsResponse(flashcards=cards, model=self.gemini_model_name)
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            raise AIOutputError("The AI provider returned invalid flashcards.") from exc


ai_service = AIService()

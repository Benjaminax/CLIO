from datetime import datetime, timezone
from typing import Any, Type

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user
from app.models.annotations import Highlight
from app.models.graph import KnowledgeEdge, KnowledgeNode
from app.models.library import Collection, LibraryItem
from app.models.reading import ReadingProgress, ReadingSession
from app.models.study import Flashcard, Quiz
from app.models.user import User
from app.schemas.workspace import (
    FlashcardCreate,
    FlashcardUpdate,
    HighlightCreate,
    HighlightUpdate,
    KnowledgeEdgeCreate,
    KnowledgeEdgeUpdate,
    KnowledgeNodeCreate,
    KnowledgeNodeUpdate,
    QuizCreate,
    QuizUpdate,
    ReadingSessionCreate,
    ReadingSessionUpdate,
)

router = APIRouter()


async def _owned_document(model: Type[Any], document_id: str, user_id: str):
    try:
        document = await model.get(ObjectId(document_id))
    except (TypeError, ValueError):
        document = None
    if not document or document.user_id != user_id:
        return None
    return document


async def _owned_library_item(item_id: str, user_id: str) -> LibraryItem | None:
    try:
        item = await LibraryItem.get(ObjectId(item_id))
    except (TypeError, ValueError):
        item = None
    if not item or item.user_id != user_id:
        return None
    return item


async def _owned_collection(collection_id: str, user_id: str):
    try:
        collection = await Collection.get(ObjectId(collection_id))
    except (TypeError, ValueError):
        collection = None
    if not collection or collection.user_id != user_id:
        return None
    return collection


def _document_data(document: Any) -> dict[str, Any]:
    data = document.model_dump()
    data["id"] = str(document.id)
    data.pop("_id", None)
    data.pop("revision_id", None)
    return data


@router.get("/highlights")
async def list_highlights(current_user: User = Depends(get_current_user)):
    documents = await Highlight.find({"user_id": str(current_user.id)}).sort("-created_at").to_list()
    return [_document_data(document) for document in documents]


@router.post("/highlights", status_code=status.HTTP_201_CREATED)
async def create_highlight(data: HighlightCreate, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    if not await _owned_library_item(data.library_item_id, user_id):
        raise HTTPException(status_code=404, detail="Library item not found")
    highlight = Highlight(user_id=user_id, **data.model_dump())
    await highlight.insert()
    return _document_data(highlight)


@router.patch("/highlights/{highlight_id}")
async def update_highlight(
    highlight_id: str,
    data: HighlightUpdate,
    current_user: User = Depends(get_current_user),
):
    highlight = await _owned_document(Highlight, highlight_id, str(current_user.id))
    if not highlight:
        raise HTTPException(status_code=404, detail="Highlight not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(highlight, key, value)
    highlight.updated_at = datetime.now(timezone.utc)
    await highlight.save()
    return _document_data(highlight)


@router.delete("/highlights/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_highlight(highlight_id: str, current_user: User = Depends(get_current_user)):
    highlight = await _owned_document(Highlight, highlight_id, str(current_user.id))
    if not highlight:
        raise HTTPException(status_code=404, detail="Highlight not found")
    await highlight.delete()


@router.get("/study/flashcards")
async def list_flashcards(
    current_user: User = Depends(get_current_user),
    library_item_id: str | None = Query(default=None),
):
    query: dict[str, Any] = {"user_id": str(current_user.id)}
    if library_item_id:
        query["library_item_id"] = library_item_id
    documents = await Flashcard.find(query).sort("-updated_at").to_list()
    return [_document_data(document) for document in documents]


@router.post("/study/flashcards", status_code=status.HTTP_201_CREATED)
async def create_flashcard(data: FlashcardCreate, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    if data.library_item_id and not await _owned_library_item(data.library_item_id, user_id):
        raise HTTPException(status_code=404, detail="Library item not found")
    if data.collection_id and not await _owned_collection(data.collection_id, user_id):
        raise HTTPException(status_code=404, detail="Collection not found")
    flashcard = Flashcard(user_id=user_id, **data.model_dump())
    await flashcard.insert()
    return _document_data(flashcard)


@router.patch("/study/flashcards/{flashcard_id}")
async def update_flashcard(
    flashcard_id: str,
    data: FlashcardUpdate,
    current_user: User = Depends(get_current_user),
):
    flashcard = await _owned_document(Flashcard, flashcard_id, str(current_user.id))
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("library_item_id") and not await _owned_library_item(changes["library_item_id"], str(current_user.id)):
        raise HTTPException(status_code=404, detail="Library item not found")
    if changes.get("collection_id") and not await _owned_collection(changes["collection_id"], str(current_user.id)):
        raise HTTPException(status_code=404, detail="Collection not found")
    for key, value in changes.items():
        setattr(flashcard, key, value)
    flashcard.updated_at = datetime.now(timezone.utc)
    await flashcard.save()
    return _document_data(flashcard)


@router.delete("/study/flashcards/{flashcard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flashcard(flashcard_id: str, current_user: User = Depends(get_current_user)):
    flashcard = await _owned_document(Flashcard, flashcard_id, str(current_user.id))
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    await flashcard.delete()


@router.get("/study/quizzes")
async def list_quizzes(current_user: User = Depends(get_current_user)):
    documents = await Quiz.find({"user_id": str(current_user.id)}).sort("-updated_at").to_list()
    return [_document_data(document) for document in documents]


@router.post("/study/quizzes", status_code=status.HTTP_201_CREATED)
async def create_quiz(data: QuizCreate, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    if data.library_item_id and not await _owned_library_item(data.library_item_id, user_id):
        raise HTTPException(status_code=404, detail="Library item not found")
    quiz = Quiz(user_id=user_id, **data.model_dump())
    await quiz.insert()
    return _document_data(quiz)


@router.patch("/study/quizzes/{quiz_id}")
async def update_quiz(quiz_id: str, data: QuizUpdate, current_user: User = Depends(get_current_user)):
    quiz = await _owned_document(Quiz, quiz_id, str(current_user.id))
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("library_item_id") and not await _owned_library_item(changes["library_item_id"], str(current_user.id)):
        raise HTTPException(status_code=404, detail="Library item not found")
    for key, value in changes.items():
        setattr(quiz, key, value)
    quiz.updated_at = datetime.now(timezone.utc)
    await quiz.save()
    return _document_data(quiz)


@router.delete("/study/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(quiz_id: str, current_user: User = Depends(get_current_user)):
    quiz = await _owned_document(Quiz, quiz_id, str(current_user.id))
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    await quiz.delete()


@router.get("/knowledge")
async def get_knowledge_graph(current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    nodes = await KnowledgeNode.find({"user_id": user_id}).sort("created_at").to_list()
    edges = await KnowledgeEdge.find({"user_id": user_id}).sort("created_at").to_list()
    return {
        "nodes": [_document_data(node) for node in nodes],
        "edges": [_document_data(edge) for edge in edges],
    }


@router.post("/knowledge/nodes", status_code=status.HTTP_201_CREATED)
async def create_knowledge_node(data: KnowledgeNodeCreate, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    if data.source_item_id and not await _owned_library_item(data.source_item_id, user_id):
        raise HTTPException(status_code=404, detail="Library item not found")
    node = KnowledgeNode(user_id=user_id, **data.model_dump())
    await node.insert()
    return _document_data(node)


@router.patch("/knowledge/nodes/{node_id}")
async def update_knowledge_node(
    node_id: str,
    data: KnowledgeNodeUpdate,
    current_user: User = Depends(get_current_user),
):
    user_id = str(current_user.id)
    node = await _owned_document(KnowledgeNode, node_id, user_id)
    if not node:
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("source_item_id") and not await _owned_library_item(changes["source_item_id"], user_id):
        raise HTTPException(status_code=404, detail="Library item not found")
    for key, value in changes.items():
        setattr(node, key, value)
    await node.save()
    return _document_data(node)


@router.delete("/knowledge/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_node(node_id: str, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    node = await _owned_document(KnowledgeNode, node_id, user_id)
    if not node:
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    node_id = str(node.id)
    await KnowledgeEdge.find({
        "user_id": user_id,
        "$or": [{"source_node_id": node_id}, {"target_node_id": node_id}],
    }).delete()
    await node.delete()


@router.post("/knowledge/edges", status_code=status.HTTP_201_CREATED)
async def create_knowledge_edge(data: KnowledgeEdgeCreate, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    source = await _owned_document(KnowledgeNode, data.source_node_id, user_id)
    target = await _owned_document(KnowledgeNode, data.target_node_id, user_id)
    if not source or not target:
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    edge = KnowledgeEdge(user_id=user_id, **data.model_dump())
    await edge.insert()
    return _document_data(edge)


@router.patch("/knowledge/edges/{edge_id}")
async def update_knowledge_edge(
    edge_id: str,
    data: KnowledgeEdgeUpdate,
    current_user: User = Depends(get_current_user),
):
    edge = await _owned_document(KnowledgeEdge, edge_id, str(current_user.id))
    if not edge:
        raise HTTPException(status_code=404, detail="Knowledge edge not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(edge, key, value)
    await edge.save()
    return _document_data(edge)


@router.delete("/knowledge/edges/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_edge(edge_id: str, current_user: User = Depends(get_current_user)):
    edge = await _owned_document(KnowledgeEdge, edge_id, str(current_user.id))
    if not edge:
        raise HTTPException(status_code=404, detail="Knowledge edge not found")
    await edge.delete()


@router.get("/reading/progress")
async def list_reading_progress(current_user: User = Depends(get_current_user)):
    progress = await ReadingProgress.find({"user_id": str(current_user.id)}).sort("-last_read_at").to_list()
    return [_document_data(entry) for entry in progress]


@router.get("/reading/sessions")
async def list_reading_sessions(
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=100, ge=1, le=500),
):
    sessions = await ReadingSession.find({"user_id": str(current_user.id)}).sort("-started_at").limit(limit).to_list()
    return [_document_data(session) for session in sessions]


@router.post("/reading/sessions", status_code=status.HTTP_201_CREATED)
async def create_reading_session(data: ReadingSessionCreate, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    if not await _owned_library_item(data.library_item_id, user_id):
        raise HTTPException(status_code=404, detail="Library item not found")
    session = ReadingSession(
        user_id=user_id,
        library_item_id=data.library_item_id,
        started_at=data.started_at or datetime.now(timezone.utc),
    )
    await session.insert()
    return _document_data(session)


@router.patch("/reading/sessions/{session_id}")
async def update_reading_session(
    session_id: str,
    data: ReadingSessionUpdate,
    current_user: User = Depends(get_current_user),
):
    session = await _owned_document(ReadingSession, session_id, str(current_user.id))
    if not session:
        raise HTTPException(status_code=404, detail="Reading session not found")
    changes = data.model_dump(exclude_unset=True)
    if "ended_at" in changes and changes["ended_at"] is None:
        changes["ended_at"] = datetime.now(timezone.utc)
    for key, value in changes.items():
        setattr(session, key, value)
    if session.ended_at and session.session_status == "active":
        session.session_status = "completed"
    await session.save()
    return _document_data(session)


@router.delete("/reading/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reading_session(session_id: str, current_user: User = Depends(get_current_user)):
    session = await _owned_document(ReadingSession, session_id, str(current_user.id))
    if not session:
        raise HTTPException(status_code=404, detail="Reading session not found")
    await session.delete()


@router.delete("/reading/progress/{library_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reading_progress(library_item_id: str, current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    if not await _owned_library_item(library_item_id, user_id):
        raise HTTPException(status_code=404, detail="Library item not found")
    progress = await ReadingProgress.find_one({"user_id": user_id, "library_item_id": library_item_id})
    if not progress:
        raise HTTPException(status_code=404, detail="Reading progress not found")
    await progress.delete()

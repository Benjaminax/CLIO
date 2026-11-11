from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.ai import (
    AIChatRequest, AIChatResponse,
    AISummarizeRequest, AISummarizeResponse,
    AIFlashcardsRequest, AIFlashcardsResponse
)
from app.services.ai_service import ai_service

router = APIRouter()


@router.post("/chat", response_model=AIChatResponse)
async def chat_with_library(
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Ask AI questions about books and documents in your CLIO library (RAG grounded)."""
    try:
        return await ai_service.chat(
            user_id=str(current_user.id),
            message=payload.message,
            conversation_id=payload.conversation_id,
            library_item_ids=payload.library_item_ids,
            context_limit=payload.context_limit,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI chat error: {str(e)}"
        )


@router.post("/summarize", response_model=AISummarizeResponse)
async def summarize_document(
    payload: AISummarizeRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate intelligent document summary and key points."""
    try:
        return await ai_service.summarize(
            user_id=str(current_user.id),
            library_item_id=payload.library_item_id,
            length=payload.length,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/flashcards", response_model=AIFlashcardsResponse)
async def generate_flashcards(
    payload: AIFlashcardsRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate study flashcards from a library document."""
    try:
        return await ai_service.generate_flashcards(
            user_id=str(current_user.id),
            library_item_id=payload.library_item_id,
            count=payload.count,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

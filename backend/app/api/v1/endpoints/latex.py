import asyncio

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.latex import LatexCompileRequest
from app.services.latex_service import (
    LatexCompileCapacityError,
    LatexCompileError,
    LatexEngineUnavailable,
    compile_latex,
)


router = APIRouter()


@router.post("/compile", response_class=Response)
async def compile_manuscript(
    payload: LatexCompileRequest,
    _current_user: User = Depends(get_current_user),
):
    try:
        pdf_bytes = await asyncio.to_thread(compile_latex, payload.source)
    except LatexCompileCapacityError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        ) from exc
    except LatexEngineUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except LatexCompileError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Cache-Control": "no-store"},
    )

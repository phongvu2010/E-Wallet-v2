import os
import shutil
import tempfile
from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.ai import (
    AIChatRequest,
    AIChatResponse,
    AIPdfExtractionResponse,
)
from app.services.ai_assistant_service import AIAssistantService
from app.services.ai_statement_parser import AIStatementParserService

router = APIRouter()


@router.post(
    "/chat",
    response_model=AIChatResponse,
    summary="Ask AI Financial Advisor Copilot with live ledger context",
)
async def chat_with_advisor(
    payload: AIChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Interact with AI Copilot for personalized financial advisory, payment schedules, and spending analysis."""
    return await AIAssistantService.chat(db, payload)


@router.post(
    "/extract-pdf",
    response_model=AIPdfExtractionResponse,
    summary="Directly extract structured transactions and statement metrics from PDF",
)
async def extract_statement_pdf(
    file: UploadFile = File(...),
):
    """Parse any bank statement PDF using PyMuPDF and Gemini Multimodal extraction."""
    # Save temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        res = await AIStatementParserService.parse_pdf_file(
            tmp_path, file.filename
        )
        return res
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

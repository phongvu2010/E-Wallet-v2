from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.institution import InstitutionCreate, InstitutionRead
from app.services.institution_service import InstitutionService

router = APIRouter()


@router.get(
    "", response_model=List[InstitutionRead], summary="List all financial institutions"
)
async def list_institutions(db: AsyncSession = Depends(get_db)):
    """Retrieve all card issuing institutions and banks."""
    return await InstitutionService.get_all(db)


@router.get(
    "/{institution_id}", response_model=InstitutionRead, summary="Get institution by ID"
)
async def get_institution(institution_id: UUID, db: AsyncSession = Depends(get_db)):
    """Fetch financial institution details by UUID."""
    return await InstitutionService.get_by_id(db, institution_id=institution_id)


@router.post(
    "",
    response_model=InstitutionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create institution",
)
async def create_institution(
    payload: InstitutionCreate, db: AsyncSession = Depends(get_db)
):
    """Register a new financial institution / issuing bank."""
    return await InstitutionService.create(db, payload=payload)

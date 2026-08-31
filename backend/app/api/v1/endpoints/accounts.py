from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.account import AccountStatusEnum
from app.schemas.account import (
    AccountRead,
    AccountCreate,
    AccountUpdate,
    AccountStatusUpdate,
    AccountLiveBalanceRead,
    AccountOverviewRead,
)
from app.schemas.common import APIResponse
from app.services.account_service import AccountService

router = APIRouter()


@router.get("", response_model=List[AccountRead], summary="List all credit cards / accounts")
async def list_accounts(
    status: Optional[AccountStatusEnum] = None,
    db: AsyncSession = Depends(get_db),
):
    return await AccountService.get_all(db, status_filter=status)


@router.get("/live-balance", response_model=List[AccountLiveBalanceRead], summary="Get real-time live balance and available limit for all cards")
async def get_all_live_balances(db: AsyncSession = Depends(get_db)):
    return await AccountService.get_live_balances(db)


@router.get("/overview", response_model=List[AccountOverviewRead], summary="Get account overview with latest statement balance")
async def get_overview(db: AsyncSession = Depends(get_db)):
    return await AccountService.get_overview(db)


@router.get("/{account_id}", response_model=AccountRead, summary="Get account by ID")
async def get_account(account_id: UUID, db: AsyncSession = Depends(get_db)):
    return await AccountService.get_by_id(db, account_id)


@router.get("/{account_id}/live-balance", response_model=AccountLiveBalanceRead, summary="Get live balance for a specific card")
async def get_account_live_balance(account_id: UUID, db: AsyncSession = Depends(get_db)):
    balances = await AccountService.get_live_balances(db, account_id=account_id)
    if not balances:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID {account_id} not found",
        )
    return balances[0]


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED, summary="Create a new card / account")
async def create_account(payload: AccountCreate, db: AsyncSession = Depends(get_db)):
    return await AccountService.create(db, payload)


@router.put("/{account_id}", response_model=AccountRead, summary="Update card details")
async def update_account(
    account_id: UUID,
    payload: AccountUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await AccountService.update(db, account_id, payload)


@router.patch("/{account_id}/status", response_model=AccountRead, summary="Update account / card status")
async def update_account_status(
    account_id: UUID,
    payload: AccountStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await AccountService.update_status(db, account_id, payload.status)


@router.patch("/{account_id}/disable", response_model=AccountRead, summary="Disable / Lock a credit card")
async def disable_account(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await AccountService.update_status(db, account_id, AccountStatusEnum.LOCKED)


@router.patch("/{account_id}/enable", response_model=AccountRead, summary="Enable / Unlock a credit card")
async def enable_account(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await AccountService.update_status(db, account_id, AccountStatusEnum.ACTIVE)


@router.patch("/{account_id}/toggle-status", response_model=AccountRead, summary="Toggle account status between ACTIVE and LOCKED")
async def toggle_account_status(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    return await AccountService.toggle_status(db, account_id)

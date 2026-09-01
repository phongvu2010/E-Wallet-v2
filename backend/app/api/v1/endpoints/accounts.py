from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.account import AccountStatusEnum
from app.schemas.account import (
    AccountCreate,
    AccountLiveBalanceRead,
    AccountOverviewRead,
    AccountRead,
    AccountStatusUpdate,
    AccountUpdate,
)
from app.services.account_service import AccountService

router = APIRouter()


@router.get(
    "", response_model=List[AccountRead], summary="List all credit cards / accounts"
)
async def list_accounts(
    status: Optional[AccountStatusEnum] = None,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all credit card accounts, with optional filtering by status (ACTIVE/LOCKED/CLOSED/REPLACED)."""
    return await AccountService.get_all(db, status_filter=status)


@router.get(
    "/live-balance",
    response_model=List[AccountLiveBalanceRead],
    summary="Get real-time live balance and available limit for all cards",
)
async def get_all_live_balances(db: AsyncSession = Depends(get_db)):
    """Fetch live real-time balances, unbilled transactions, and remaining credit limits from view `v_account_live_balance`."""
    return await AccountService.get_live_balances(db)


@router.get(
    "/overview",
    response_model=List[AccountOverviewRead],
    summary="Get account overview with latest statement balance",
)
async def get_overview(db: AsyncSession = Depends(get_db)):
    """Fetch high-level overview for each card, including latest billed statement balances and payment due dates."""
    return await AccountService.get_overview(db)


@router.get("/{account_id}", response_model=AccountRead, summary="Get account by ID")
async def get_account(account_id: UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve details for a single credit card account by its UUID."""
    return await AccountService.get_by_id(db, account_id)


@router.get(
    "/{account_id}/live-balance",
    response_model=AccountLiveBalanceRead,
    summary="Get live balance for a specific card",
)
async def get_account_live_balance(
    account_id: UUID, db: AsyncSession = Depends(get_db)
):
    """Query live unbilled balance and remaining limit for a specific card."""
    balances = await AccountService.get_live_balances(db, account_id=account_id)
    if not balances:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ID {account_id} not found",
        )
    return balances[0]


@router.post(
    "",
    response_model=AccountRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new card / account",
)
async def create_account(payload: AccountCreate, db: AsyncSession = Depends(get_db)):
    """Register a new credit card account with credit limit and billing cycle settings."""
    return await AccountService.create(db, payload)


@router.put("/{account_id}", response_model=AccountRead, summary="Update card details")
async def update_account(
    account_id: UUID,
    payload: AccountUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update editable parameters of a card (e.g. credit limit, name, note)."""
    return await AccountService.update(db, account_id, payload)


@router.patch(
    "/{account_id}/status",
    response_model=AccountRead,
    summary="Update account / card status",
)
async def update_account_status(
    account_id: UUID,
    payload: AccountStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Explicitly change card status (ACTIVE, LOCKED, CLOSED, or REPLACED)."""
    return await AccountService.update_status(db, account_id, payload.status)


@router.patch(
    "/{account_id}/disable",
    response_model=AccountRead,
    summary="Disable / Lock a credit card",
)
async def disable_account(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Freeze / Lock a credit card to temporarily prevent new spending."""
    return await AccountService.update_status(db, account_id, AccountStatusEnum.LOCKED)


@router.patch(
    "/{account_id}/enable",
    response_model=AccountRead,
    summary="Enable / Unlock a credit card",
)
async def enable_account(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Reactivate / Unlock a previously frozen card."""
    return await AccountService.update_status(db, account_id, AccountStatusEnum.ACTIVE)


@router.patch(
    "/{account_id}/toggle-status",
    response_model=AccountRead,
    summary="Toggle account status between ACTIVE and LOCKED",
)
async def toggle_account_status(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Toggle status between ACTIVE and LOCKED."""
    return await AccountService.toggle_status(db, account_id)

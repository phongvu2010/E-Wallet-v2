from fastapi import APIRouter

from app.api.v1.endpoints import (
    accounts,
    analytics,
    categories,
    etl,
    installments,
    institutions,
    merchants,
    rewards,
    statements,
    transactions,
)

api_router = APIRouter()

api_router.include_router(
    institutions.router, prefix="/institutions", tags=["Institutions"]
)
api_router.include_router(
    accounts.router, prefix="/accounts", tags=["Accounts & Cards"]
)
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(
    merchants.router, prefix="/merchants", tags=["Merchants & Aliases"]
)
api_router.include_router(
    statements.router, prefix="/statements", tags=["Statements & Reconciliation"]
)
api_router.include_router(
    transactions.router, prefix="/transactions", tags=["Transactions & Ledger"]
)
api_router.include_router(
    installments.router, prefix="/installments", tags=["Installment Plans & Forecast"]
)
api_router.include_router(rewards.router, prefix="/rewards", tags=["Reward Ledgers"])
api_router.include_router(
    analytics.router, prefix="/analytics", tags=["Analytics & Dashboard"]
)
api_router.include_router(etl.router, prefix="/etl", tags=["ETL & Sync"])

from typing import List, Optional
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from backend.app.schemas.analytics import (
    MonthlyCategorySpendingRead,
    CreditUtilizationRead,
    UpcomingObligationRead,
    DashboardOverviewRead,
)


class AnalyticsService:
    @staticmethod
    async def get_monthly_spending(
        db: AsyncSession,
        limit: int = 50,
    ) -> List[MonthlyCategorySpendingRead]:
        sql = """
        SELECT * FROM v_monthly_category_spending
        ORDER BY month DESC, total_spending DESC
        LIMIT :limit;
        """
        result = await db.execute(text(sql), {"limit": limit})
        rows = result.mappings().all()
        return [MonthlyCategorySpendingRead(**dict(row)) for row in rows]

    @staticmethod
    async def get_credit_utilization(db: AsyncSession) -> List[CreditUtilizationRead]:
        sql = "SELECT * FROM v_credit_utilization ORDER BY utilization_percentage DESC;"
        result = await db.execute(text(sql))
        rows = result.mappings().all()
        return [CreditUtilizationRead(**dict(row)) for row in rows]

    @staticmethod
    async def get_upcoming_obligations(
        db: AsyncSession,
        days_ahead: int = 30,
    ) -> List[UpcomingObligationRead]:
        sql = """
        SELECT * FROM v_upcoming_payment_obligations
        WHERE days_remaining <= :days_ahead
        ORDER BY due_date ASC;
        """
        result = await db.execute(text(sql), {"days_ahead": days_ahead})
        rows = result.mappings().all()
        return [UpcomingObligationRead(**dict(row)) for row in rows]

    @staticmethod
    async def get_dashboard_overview(db: AsyncSession) -> DashboardOverviewRead:
        # 1. Total credit limit and live balance across all active cards
        sql_live = """
        SELECT
            COALESCE(SUM(credit_limit), 0) AS total_credit_limit,
            COALESCE(SUM(live_current_balance), 0) AS total_live_balance,
            COALESCE(SUM(live_available_limit), 0) AS total_available_limit,
            COUNT(account_id) AS active_cards_count
        FROM v_account_live_balance
        WHERE status = 'ACTIVE';
        """
        res_live = await db.execute(text(sql_live))
        row_live = res_live.mappings().one()

        total_limit = Decimal(str(row_live["total_credit_limit"]))
        total_balance = Decimal(str(row_live["total_live_balance"]))
        total_available = Decimal(str(row_live["total_available_limit"]))
        cards_count = int(row_live["active_cards_count"])

        overall_utilization = Decimal("0.00")
        if total_limit > 0:
            overall_utilization = round((total_balance / total_limit) * Decimal("100.0"), 2)

        if total_limit == 0:
            risk_lvl = "NO_LIMIT"
        elif overall_utilization > 70:
            risk_lvl = "CRITICAL (>70%)"
        elif overall_utilization > 50:
            risk_lvl = "HIGH (>50%)"
        elif overall_utilization > 30:
            risk_lvl = "MODERATE (>30%)"
        else:
            risk_lvl = "OPTIMAL (<30%)"

        # 2. Upcoming obligations (30 days)
        sql_upcoming = """
        SELECT
            COUNT(*) AS total_count,
            COALESCE(SUM(total_amount_due), 0) AS total_due
        FROM v_upcoming_payment_obligations
        WHERE days_remaining <= 30;
        """
        res_upcoming = await db.execute(text(sql_upcoming))
        row_upcoming = res_upcoming.mappings().one()

        # 3. Monthly spending current month
        sql_spending = """
        SELECT COALESCE(SUM(total_spending), 0) AS current_month_spending
        FROM v_monthly_category_spending
        WHERE month = DATE_TRUNC('month', CURRENT_DATE)::DATE;
        """
        res_spending = await db.execute(text(sql_spending))
        row_spending = res_spending.mappings().one()

        return DashboardOverviewRead(
            total_credit_limit=total_limit,
            total_live_balance=total_balance,
            total_available_limit=total_available,
            overall_utilization_percentage=overall_utilization,
            overall_risk_level=risk_lvl,
            active_cards_count=cards_count,
            upcoming_obligations_count=int(row_upcoming["total_count"]),
            total_upcoming_due_30d=Decimal(str(row_upcoming["total_due"])),
            monthly_spending_current_month=Decimal(str(row_spending["current_month_spending"])),
        )

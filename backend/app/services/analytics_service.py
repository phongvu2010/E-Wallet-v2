from decimal import Decimal
from typing import List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.analytics import (
    CreditUtilizationRead,
    DashboardOverviewRead,
    MonthlyCategorySpendingRead,
    UpcomingObligationRead,
)


class AnalyticsService:
    """Financial Analytics & Risk Management Service layer.

    Aggregates data from dedicated PostgreSQL analytical views:
    - `v_monthly_category_spending`: Net monthly category spending trend.
    - `v_credit_utilization`: Credit limit utilization percentage and risk tier.
    - `v_upcoming_payment_obligations`: Consolidated statement and installment due dates.
    - Dashboard high-level KPIs and risk health scores.
    """

    @staticmethod
    async def get_monthly_spending(
        db: AsyncSession,
        limit: int = 50,
    ) -> List[MonthlyCategorySpendingRead]:
        """Query historical monthly spending aggregated by transaction category.

        Automatically accounts for refunds, cashback credits, and cancellations.

        Args:
            db (AsyncSession): Active asynchronous database session.
            limit (int, optional): Maximum records to retrieve. Defaults to 50.

        Returns:
            List[MonthlyCategorySpendingRead]: Category spending by month in descending order.
        """
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
        """Fetch credit utilization matrix across all cards with risk level assessment.

        Risk tiers based on credit bureau best practices:
        - OPTIMAL: < 30% utilization
        - MODERATE: 30% - 50% utilization
        - HIGH: 50% - 70% utilization
        - CRITICAL: > 70% utilization

        Args:
            db (AsyncSession): Active asynchronous database session.

        Returns:
            List[CreditUtilizationRead]: Utilization percentages and risk indicators per card.
        """
        sql = "SELECT * FROM v_credit_utilization ORDER BY utilization_percentage DESC;"
        result = await db.execute(text(sql))
        rows = result.mappings().all()
        return [CreditUtilizationRead(**dict(row)) for row in rows]

    @staticmethod
    async def get_upcoming_obligations(
        db: AsyncSession,
        days_ahead: int = 30,
    ) -> List[UpcomingObligationRead]:
        """Retrieve payment deadlines due within the specified horizon.

        Combines billed statement due dates and monthly installment schedule dates.

        Args:
            db (AsyncSession): Active asynchronous database session.
            days_ahead (int, optional): Horizon window in days. Defaults to 30.

        Returns:
            List[UpcomingObligationRead]: List of upcoming obligations ordered by due date.
        """
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
        """Compute consolidated financial KPIs for dashboard hero cards.

        Computes:
        - Total credit limit, live outstanding balance, and available limit.
        - Overall credit utilization percentage & portfolio risk grade.
        - Total payment obligations due in next 30 days.
        - Total net spending in the current calendar month.

        Args:
            db (AsyncSession): Active asynchronous database session.

        Returns:
            DashboardOverviewRead: High-level executive financial metrics.
        """
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
            overall_utilization = round(
                (total_balance / total_limit) * Decimal("100.0"), 2
            )

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
            monthly_spending_current_month=Decimal(
                str(row_spending["current_month_spending"])
            ),
        )

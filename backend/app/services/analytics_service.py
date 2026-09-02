from decimal import Decimal
from typing import List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.analytics import (
    CreditUtilizationRead,
    DashboardOverviewRead,
    MonthlyCashFlowRead,
    MonthlyCategorySpendingRead,
    NetWorthOverviewRead,
    UpcomingObligationRead,
)


class AnalyticsService:
    """Financial Analytics & Wealth Management Service layer.

    Aggregates data from dedicated PostgreSQL analytical views:
    - `v_net_worth_overview`: Total liquid assets, credit debt, and net worth.
    - `v_monthly_cash_flow`: Monthly income, expense, and savings rate.
    - `v_monthly_category_spending`: Net monthly category spending trend.
    - `v_credit_utilization`: Credit limit utilization percentage and risk tier.
    - `v_upcoming_payment_obligations`: Consolidated statement and installment due dates.
    - Dashboard high-level KPIs and risk health scores.
    """

    @staticmethod
    async def get_net_worth_overview(db: AsyncSession) -> NetWorthOverviewRead:
        """Fetch consolidated Net Worth and wealth allocation metrics from `v_net_worth_overview`."""
        sql = "SELECT * FROM v_net_worth_overview;"
        result = await db.execute(text(sql))
        row = result.mappings().one_or_none()
        if not row:
            return NetWorthOverviewRead(
                total_liquid_assets=Decimal("0.00"),
                total_bank_assets=Decimal("0.00"),
                total_cash_assets=Decimal("0.00"),
                total_ewallet_assets=Decimal("0.00"),
                total_savings_assets=Decimal("0.00"),
                total_credit_debt=Decimal("0.00"),
                total_credit_limit=Decimal("0.00"),
                total_available_credit=Decimal("0.00"),
                net_worth=Decimal("0.00"),
                active_asset_accounts_count=0,
                active_credit_cards_count=0,
            )
        return NetWorthOverviewRead(**dict(row))

    @staticmethod
    async def get_monthly_cash_flow(
        db: AsyncSession,
        limit: int = 12,
    ) -> List[MonthlyCashFlowRead]:
        """Fetch monthly cash flow (Income vs Expense vs Savings) from `v_monthly_cash_flow`."""
        sql = "SELECT * FROM v_monthly_cash_flow LIMIT :limit;"
        result = await db.execute(text(sql), {"limit": limit})
        rows = result.mappings().all()
        return [MonthlyCashFlowRead(**dict(row)) for row in rows]

    @staticmethod
    async def get_monthly_spending(
        db: AsyncSession,
        limit: int = 50,
    ) -> List[MonthlyCategorySpendingRead]:
        """Query historical monthly spending aggregated by transaction category."""
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
        """Fetch credit utilization matrix across all cards with risk level assessment."""
        sql = "SELECT * FROM v_credit_utilization ORDER BY utilization_percentage DESC;"
        result = await db.execute(text(sql))
        rows = result.mappings().all()
        return [CreditUtilizationRead(**dict(row)) for row in rows]

    @staticmethod
    async def get_upcoming_obligations(
        db: AsyncSession,
        days_ahead: int = 30,
    ) -> List[UpcomingObligationRead]:
        """Retrieve payment deadlines due within the specified horizon."""
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
        """Compute consolidated financial KPIs for dashboard hero cards."""
        # 1. Net worth and liquid assets
        nw = await AnalyticsService.get_net_worth_overview(db)

        # 2. Credit limit and utilization
        total_limit = nw.total_credit_limit
        total_balance = nw.total_credit_debt
        total_available = nw.total_available_credit
        cards_count = nw.active_credit_cards_count

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

        # 3. Upcoming obligations (30 days)
        sql_upcoming = """
        SELECT
            COUNT(*) AS total_count,
            COALESCE(SUM(total_amount_due), 0) AS total_due
        FROM v_upcoming_payment_obligations
        WHERE days_remaining <= 30;
        """
        res_upcoming = await db.execute(text(sql_upcoming))
        row_upcoming = res_upcoming.mappings().one()

        # 4. Monthly spending & income in current month
        sql_spending = """
        SELECT
            COALESCE(SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END), 0) AS current_month_income,
            COALESCE(SUM(CASE WHEN transaction_type IN ('PURCHASE', 'INSTALLMENT_MONTHLY', 'FEE', 'INTEREST', 'CASH_ADVANCE') THEN total_amount ELSE 0 END), 0) AS current_month_spending
        FROM transactions
        WHERE transaction_date >= DATE_TRUNC('month', CURRENT_DATE)::DATE;
        """
        res_spending = await db.execute(text(sql_spending))
        row_spending = res_spending.mappings().one()

        return DashboardOverviewRead(
            total_liquid_assets=nw.total_liquid_assets,
            total_bank_assets=nw.total_bank_assets,
            total_cash_assets=nw.total_cash_assets,
            total_ewallet_assets=nw.total_ewallet_assets,
            total_credit_limit=total_limit,
            total_live_balance=total_balance,
            total_available_limit=total_available,
            net_worth=nw.net_worth,
            overall_utilization_percentage=overall_utilization,
            overall_risk_level=risk_lvl,
            active_cards_count=cards_count,
            active_asset_accounts_count=nw.active_asset_accounts_count,
            upcoming_obligations_count=int(row_upcoming["total_count"]),
            total_upcoming_due_30d=Decimal(str(row_upcoming["total_due"])),
            monthly_spending_current_month=Decimal(
                str(row_spending["current_month_spending"])
            ),
            monthly_income_current_month=Decimal(
                str(row_spending["current_month_income"])
            ),
        )

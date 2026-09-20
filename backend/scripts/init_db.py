"""Database Initialization and Schema Compatibility Utility.

Usage:
    python backend/scripts/init_db.py [--full-schema]

Ensures that all coordination tables, debt columns, and optimized live views
exist in PostgreSQL. This script is designed to run ONCE prior to starting the
FastAPI / Gunicorn application, completely avoiding DDL locks during multi-worker startup.
"""

import argparse
import os
from pathlib import Path
import re
import sys
import urllib.parse
import psycopg2

# Parse CLI arguments
parser = argparse.ArgumentParser(description="Database Schema Initialization Script")
parser.add_argument(
    "--full-schema",
    action="store_true",
    help="Execute full init-scripts/01-schema.sql if starting on an empty database",
)
args, _ = parser.parse_known_args()

# Load environment variables from .env if present
env_file = Path(__file__).resolve().parent.parent / ".env"
if not env_file.exists():
    env_file = Path(__file__).resolve().parent.parent.parent / ".env"

if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

db_url = os.getenv("DATABASE_URL")
if not db_url:
    pg_user = urllib.parse.quote_plus(os.getenv("POSTGRES_USER", "postgres"))
    pg_pwd = os.getenv("POSTGRES_PASSWORD", "")
    pwd_part = f":{urllib.parse.quote_plus(pg_pwd)}" if pg_pwd else ""
    pg_host = os.getenv("POSTGRES_HOST", "db")
    pg_port = os.getenv("POSTGRES_PORT", "5432")
    pg_db = os.getenv("POSTGRES_DB", "credit_wallet")
    pg_ssl = os.getenv("POSTGRES_SSLMODE", "")
    ssl_part = f"?sslmode={pg_ssl}" if pg_ssl else ""
    db_url = f"postgresql://{pg_user}{pwd_part}@{pg_host}:{pg_port}/{pg_db}{ssl_part}"

print(f"[init_db] Connecting to database...")

try:
    conn = psycopg2.connect(db_url)
except Exception:
    # Fallback to localhost if 'db' hostname cannot be resolved (when running outside Docker container)
    local_db_url = re.sub(r"@db(:|\/|\?)", r"@localhost\1", db_url)
    conn = psycopg2.connect(local_db_url)

cur = conn.cursor()

def run_full_schema(cursor, connection):
    root_dir = Path(__file__).resolve().parent.parent.parent
    schema_sql_path = root_dir / "init-scripts" / "01-schema.sql"
    if not schema_sql_path.exists():
        schema_sql_path = Path(__file__).resolve().parent.parent / "init-scripts" / "01-schema.sql"

    if schema_sql_path.exists():
        print(f"[init_db] Executing master schema: {schema_sql_path}...")
        with open(schema_sql_path, "r", encoding="utf-8") as f:
            cursor.execute(f.read())
        connection.commit()
        print("[init_db] Master schema executed successfully.")
    else:
        print(f"[init_db] Warning: 01-schema.sql not found at {schema_sql_path}.")

def ensure_compatibility_schema(cursor, connection):
    print("[init_db] Ensuring coordination tables and optimized views...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS telegram_draft_sessions (
            id VARCHAR(32) PRIMARY KEY,
            chat_id VARCHAR(100) NOT NULL,
            draft_data JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_telegram_draft_expires ON telegram_draft_sessions (expires_at);

        CREATE TABLE IF NOT EXISTS rate_limit_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            client_key VARCHAR(150) NOT NULL,
            endpoint_tag VARCHAR(50) NOT NULL,
            request_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup ON rate_limit_records (client_key, endpoint_tag, request_timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts (account_type);
        CREATE INDEX IF NOT EXISTS idx_tx_transfer_flows ON transactions (transfer_to_account_id, amount) WHERE transfer_to_account_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_tx_asset_flows ON transactions (account_id, transaction_type, total_amount, amount);

        -- Ensure debts has origin_transaction_id column
        ALTER TABLE debts ADD COLUMN IF NOT EXISTS origin_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

        -- Ensure optimized v_account_live_balance view (Partitioned CTEs)
        CREATE OR REPLACE VIEW v_account_live_balance WITH (security_invoker = true) AS
        WITH latest_statement_per_account AS (
            SELECT DISTINCT ON (s.account_id)
                s.account_id,
                s.id AS latest_statement_id,
                s.statement_date AS latest_statement_date,
                s.statement_balance AS latest_statement_balance,
                s.payment_due_date AS next_payment_due_date
            FROM statements s
            ORDER BY s.account_id, s.statement_date DESC
        ),
        unbilled_transactions_summary AS (
            SELECT
                a.id AS account_id,
                COALESCE(SUM(CASE
                    WHEN t.total_amount > 0 AND t.transaction_type != 'INCOME' THEN t.total_amount
                    ELSE 0
                END), 0.00) AS unbilled_charges,
                COALESCE(SUM(CASE
                    WHEN t.total_amount < 0 THEN ABS(t.total_amount)
                    ELSE 0
                END), 0.00) AS unbilled_credits,
                COALESCE(SUM(t.total_amount), 0.00) AS unbilled_net_amount,
                COUNT(t.id) AS unbilled_transaction_count
            FROM accounts a
            LEFT JOIN latest_statement_per_account ls ON a.id = ls.account_id
            LEFT JOIN transactions t ON t.account_id = a.id
                AND t.statement_id IS NULL
                AND (
                    ls.latest_statement_date IS NULL
                    OR COALESCE(t.post_date, t.transaction_date) > ls.latest_statement_date
                )
            WHERE a.account_type = 'CREDIT_CARD'
            GROUP BY a.id
        ),
        asset_direct_flows AS (
            SELECT
                t.account_id,
                COALESCE(SUM(CASE
                    WHEN t.transaction_type IN ('INCOME', 'DEBT_BORROW') THEN t.amount
                    WHEN t.transaction_type = 'DEBT_COLLECT' THEN ABS(t.amount)
                    WHEN t.transaction_type IN ('REFUND', 'CASHBACK_CREDIT') THEN ABS(t.amount)
                    ELSE 0.00
                END), 0.00) AS direct_inflows,
                COALESCE(SUM(CASE
                    WHEN t.transaction_type IN ('PURCHASE', 'FEE', 'INTEREST', 'CASH_ADVANCE', 'DEBT_REPAY', 'DEBT_LEND') THEN t.total_amount
                    WHEN t.transaction_type IN ('TRANSFER', 'REPAYMENT') OR t.transfer_to_account_id IS NOT NULL THEN ABS(t.total_amount)
                    ELSE 0.00
                END), 0.00) AS direct_outflows
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.account_type != 'CREDIT_CARD'
            GROUP BY t.account_id
        ),
        asset_transfer_in_flows AS (
            SELECT
                t.transfer_to_account_id AS account_id,
                COALESCE(SUM(ABS(t.amount)), 0.00) AS transfer_inflows
            FROM transactions t
            JOIN accounts a ON t.transfer_to_account_id = a.id
            WHERE t.transfer_to_account_id IS NOT NULL
              AND a.account_type != 'CREDIT_CARD'
            GROUP BY t.transfer_to_account_id
        ),
        asset_account_flows AS (
            SELECT
                a.id AS account_id,
                COALESCE(adf.direct_inflows, 0.00) + COALESCE(atif.transfer_inflows, 0.00) AS total_inflows,
                COALESCE(adf.direct_outflows, 0.00) AS total_outflows
            FROM accounts a
            LEFT JOIN asset_direct_flows adf ON a.id = adf.account_id
            LEFT JOIN asset_transfer_in_flows atif ON a.id = atif.account_id
            WHERE a.account_type != 'CREDIT_CARD'
        )
        SELECT
            a.id AS account_id,
            a.account_name,
            a.account_type,
            (a.account_type != 'CREDIT_CARD') AS is_asset,
            COALESCE(i.short_name, i.name, CASE
                WHEN a.account_type = 'CASH' THEN 'Ví Tiền Mặt'
                WHEN a.account_type = 'E_WALLET' THEN 'Ví Điện Tử'
                WHEN a.account_type = 'SAVINGS' THEN 'Tiết Kiệm'
                ELSE 'Ngân hàng'
            END) AS bank_name,
            a.card_number_masked,
            a.color_hex,
            a.initial_balance,
            a.credit_limit,
            COALESCE(ls.latest_statement_date, a.opened_date) AS latest_statement_date,
            COALESCE(ls.latest_statement_balance, 0.00) AS latest_statement_balance,
            COALESCE(uts.unbilled_charges, 0.00) AS unbilled_charges,
            COALESCE(uts.unbilled_credits, 0.00) AS unbilled_credits,
            COALESCE(uts.unbilled_net_amount, 0.00) AS unbilled_net_amount,
            COALESCE(uts.unbilled_transaction_count, 0) AS unbilled_transaction_count,
            CASE
                WHEN a.account_type = 'CREDIT_CARD' THEN
                    GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + COALESCE(uts.unbilled_net_amount, 0.00))
                ELSE
                    GREATEST(0.00, COALESCE(a.initial_balance, 0.00) + COALESCE(aaf.total_inflows, 0.00) - COALESCE(aaf.total_outflows, 0.00))
            END AS live_current_balance,
            CASE
                WHEN a.account_type = 'CREDIT_CARD' THEN
                    GREATEST(0.00, a.credit_limit - GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + COALESCE(uts.unbilled_net_amount, 0.00)))
                ELSE
                    GREATEST(0.00, COALESCE(a.initial_balance, 0.00) + COALESCE(aaf.total_inflows, 0.00) - COALESCE(aaf.total_outflows, 0.00))
            END AS live_available_limit,
            CASE
                WHEN a.account_type = 'CREDIT_CARD' AND a.credit_limit > 0 THEN
                    ROUND((GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + COALESCE(uts.unbilled_net_amount, 0.00)) / a.credit_limit) * 100.0, 2)
                ELSE 0.00
            END AS live_utilization_percentage,
            CASE
                WHEN a.account_type != 'CREDIT_CARD' THEN 'OPTIMAL (<30%)'
                WHEN a.credit_limit = 0 THEN 'NO_LIMIT'
                WHEN (GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + COALESCE(uts.unbilled_net_amount, 0.00)) / a.credit_limit) > 0.70 THEN 'CRITICAL (>70%)'
                WHEN (GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + COALESCE(uts.unbilled_net_amount, 0.00)) / a.credit_limit) > 0.50 THEN 'HIGH (>50%)'
                WHEN (GREATEST(0.00, COALESCE(ls.latest_statement_balance, 0.00) + COALESCE(uts.unbilled_net_amount, 0.00)) / a.credit_limit) > 0.30 THEN 'MODERATE (>30%)'
                ELSE 'OPTIMAL (<30%)'
            END AS live_risk_level,
            ls.next_payment_due_date,
            a.status
        FROM accounts a
        LEFT JOIN institutions i ON a.institution_id = i.id
        LEFT JOIN latest_statement_per_account ls ON a.id = ls.account_id
        LEFT JOIN unbilled_transactions_summary uts ON a.id = uts.account_id
        LEFT JOIN asset_account_flows aaf ON a.id = aaf.account_id
        ORDER BY (a.account_type = 'CREDIT_CARD') DESC, live_current_balance DESC;
    """)
    connection.commit()
    print("[init_db] Database schema compatibility verified successfully.")

try:
    if args.full_schema:
        run_full_schema(cur, conn)
    ensure_compatibility_schema(cur, conn)
    print("[init_db] All database initialization operations completed successfully.")
except Exception as e:
    print(f"[init_db] Error executing database initialization: {e}", file=sys.stderr)
    conn.rollback()
    sys.exit(1)
finally:
    cur.close()
    conn.close()

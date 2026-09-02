"""ETL Data Ingestion and Database Migration Script.

Extracts credit card ledger data, historical statements, 0% installments,
category taxonomy, merchant aliases, and reward points from Excel (`data/My Credit Wallet 2.0.xlsx`)
and populates the PostgreSQL database.

Execution Pipeline:
    1. Financial Institutions mapping (Shinhan, HSBC, Sacombank).
    2. Accounts ingestion, dynamic credit limit resolution & card replacement linking.
    3. 2-tier Category hierarchy synchronization.
    4. Merchant normalization & alias pattern extraction.
    5. Installment Plans & Amortization Schedules calculation (odd cents balancing).
    6. Statements & Transactions ingestion with SHA-256 idempotency fingerprinting.
    7. Shinhan Reward Points / Cashback ledger recording.
"""

import argparse
import calendar
import datetime
import hashlib
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import warnings
from pathlib import Path
from typing import Any, Optional

import openpyxl
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

# Parse CLI Arguments
parser = argparse.ArgumentParser(
    description="ETL Data Ingestion Script (Google Sheets / Excel)"
)
parser.add_argument(
    "--sheet-id",
    "-s",
    type=str,
    default=None,
    help="Google Sheet ID or Google Sheet full URL",
)
parser.add_argument(
    "--file",
    "-f",
    type=str,
    default=None,
    help="Local Excel file path fallback",
)
args, _ = parser.parse_known_args()


def extract_google_sheet_id(raw_input: Optional[str]) -> Optional[str]:
    """Extract standard Google Sheet ID from raw ID or full Google Sheets URL.

    Args:
        raw_input (Optional[str]): Full URL or ID string.

    Returns:
        Optional[str]: Extracted 44-character sheet ID.
    """
    if not raw_input:
        return None
    raw_input = raw_input.strip()
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", raw_input)
    if match:
        return match.group(1)
    if re.match(r"^[a-zA-Z0-9-_]{20,}$", raw_input):
        return raw_input
    return raw_input


def add_months_to_date(
    base_date: Optional[datetime.date],
    months_to_add: int,
    target_day: Optional[int] = None,
) -> Optional[datetime.date]:
    """Calculate the target date after adding `months_to_add` months to `base_date`.

    Safely handles month-end bounds (e.g. Feb 28/29 or April 30) and aligns with the card's
    billing cycle closing day if provided.

    Args:
        base_date (Optional[datetime.date]): The starting transaction date.
        months_to_add (int): Number of months to advance.
        target_day (Optional[int]): Desired day of month. Defaults to base_date.day.

    Returns:
        Optional[datetime.date]: The computed target date bounded by valid calendar days.
    """
    if not base_date:
        return None
    year = base_date.year + (base_date.month + months_to_add - 1) // 12
    month = (base_date.month + months_to_add - 1) % 12 + 1
    max_days = calendar.monthrange(year, month)[1]
    day = target_day if target_day is not None else base_date.day
    day = min(max(1, day), max_days)
    return datetime.date(year, month, day)


# Automatically load .env if available
env_file = Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    pg_user = urllib.parse.quote_plus(os.getenv("POSTGRES_USER", "postgres"))
    pg_pwd = os.getenv("POSTGRES_PASSWORD", "")
    pwd_part = f":{urllib.parse.quote_plus(pg_pwd)}" if pg_pwd else ""
    pg_host = os.getenv("POSTGRES_HOST", "db")
    pg_port = os.getenv("POSTGRES_PORT", "5432")
    pg_db = os.getenv("POSTGRES_DB", "credit_wallet")
    pg_ssl = os.getenv("POSTGRES_SSLMODE", "")
    ssl_part = f"?sslmode={pg_ssl}" if pg_ssl else ""
    DB_URL = f"postgresql://{pg_user}{pwd_part}@{pg_host}:{pg_port}/{pg_db}{ssl_part}"

# Resolve target Sheet ID or File
target_sheet_id = extract_google_sheet_id(args.sheet_id or os.getenv("GOOGLE_SHEET_ID"))
excel_file_path = args.file or "data/My Credit Wallet 2.0.xlsx"
cache_sheet_path = "data/google_sheet_cache.xlsx"

wb = None
sheet_source_desc = ""

if target_sheet_id:
    print(f"[ETL Ingestion] Đang kết nối và tải dữ liệu từ Google Sheet (ID: {target_sheet_id})...")
    export_url = f"https://docs.google.com/spreadsheets/d/{target_sheet_id}/export?format=xlsx"
    req = urllib.request.Request(
        export_url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            Path(cache_sheet_path).parent.mkdir(parents=True, exist_ok=True)
            with open(cache_sheet_path, "wb") as f:
                f.write(content)
            wb = openpyxl.load_workbook(cache_sheet_path, data_only=True)
            sheet_source_desc = f"Google Sheet (ID: {target_sheet_id})"
            print(f"[ETL Ingestion] ✅ Đã tải thành công {len(content):,} bytes từ Google Sheet!")
            print(f"[ETL Ingestion] Danh sách trang tính nhận diện: {wb.sheetnames}")
    except urllib.error.HTTPError as e:
        print(f"\n[CẢNH BÁO / LỖI] ❌ Không thể tải Google Sheet (HTTP Error {e.code}: {e.reason})!")
        if e.code in (401, 403):
            print("=" * 70)
            print("👉 HƯỚNG DẪN CẤP QUYỀN TRUY CẬP GOOGLE SHEET:")
            print(f"   1. Mở trang tính trên trình duyệt: https://docs.google.com/spreadsheets/d/{target_sheet_id}")
            print("   2. Bấm nút 'Chia sẻ' (Share) ở góc trên bên phải.")
            print("   3. Tại mục 'Quyền truy cập chung' (General access), chọn:")
            print("      'Bất kỳ ai có đường liên kết' (Anyone with the link) -> Quyền 'Người xem' (Viewer).")
            print("   4. Bấm 'Xong' (Done) và chạy lại Đồng Bộ ETL!")
            print("=" * 70)
        # Fallback to cache or local excel file
        if Path(cache_sheet_path).exists():
            print(f"[ETL Ingestion] ⚠️ Sử dụng tệp Google Sheet đã lưu cache trước đó: {cache_sheet_path}")
            wb = openpyxl.load_workbook(cache_sheet_path, data_only=True)
            sheet_source_desc = f"Google Sheet Cache ({cache_sheet_path})"
        elif Path(excel_file_path).exists():
            print(f"[ETL Ingestion] ⚠️ Chuyển sang nạp từ tệp Excel dự phòng cục bộ: {excel_file_path}")
            wb = openpyxl.load_workbook(excel_file_path, data_only=True)
            sheet_source_desc = f"Tệp Excel cục bộ ({excel_file_path})"
        else:
            raise RuntimeError(
                f"Không thể truy cập Google Sheet ({target_sheet_id}) và không tìm thấy tệp dữ liệu dự phòng."
            )
    except Exception as e:
        print(f"[ETL Ingestion] ❌ Lỗi kết nối Google Sheet: {str(e)}")
        if Path(cache_sheet_path).exists():
            print(f"[ETL Ingestion] ⚠️ Sử dụng tệp Google Sheet đã lưu cache trước đó: {cache_sheet_path}")
            wb = openpyxl.load_workbook(cache_sheet_path, data_only=True)
            sheet_source_desc = f"Google Sheet Cache ({cache_sheet_path})"
        elif Path(excel_file_path).exists():
            print(f"[ETL Ingestion] ⚠️ Chuyển sang nạp từ tệp Excel cục bộ: {excel_file_path}")
            wb = openpyxl.load_workbook(excel_file_path, data_only=True)
            sheet_source_desc = f"Tệp Excel cục bộ ({excel_file_path})"
        else:
            raise RuntimeError(f"Không thể tải Google Sheet và không có tệp dự phòng: {str(e)}")

if wb is None:
    if Path(excel_file_path).exists():
        print(f"[ETL Ingestion] Nạp dữ liệu từ tệp Excel cục bộ: {excel_file_path}")
        wb = openpyxl.load_workbook(excel_file_path, data_only=True)
        sheet_source_desc = f"Tệp Excel cục bộ ({excel_file_path})"
    else:
        raise FileNotFoundError(f"Không tìm thấy nguồn dữ liệu ({excel_file_path})")


def load_sheet(name: str) -> pd.DataFrame:
    """Read a specific worksheet into a cleaned pandas DataFrame with case-insensitive matching."""
    matched_sheet = None
    for s_name in wb.sheetnames:
        if s_name.strip().lower() == name.strip().lower():
            matched_sheet = s_name
            break

    if not matched_sheet:
        return pd.DataFrame()

    ws = wb[matched_sheet]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return pd.DataFrame()

    header = [str(c).strip() if c is not None else None for c in rows[0]]
    last_col = len(header)
    while last_col > 0 and header[last_col - 1] is None:
        last_col -= 1

    header = header[:last_col]
    data = [r[:last_col] for r in rows[1:] if any(c is not None for c in r[:last_col])]

    return pd.DataFrame(data, columns=header)


df_accounts = load_sheet("Accounts")
df_statements = load_sheet("Statements")
df_categories = load_sheet("Categories")
df_instalments = load_sheet("Instalments")
df_transactions = load_sheet("Transactions")
df_rewards = load_sheet("Rewards")


def clean_num(val: Any, default: float = 0.0) -> float:
    """Sanitize and parse currency strings / numeric values into clean float amounts.

    Handles commas, currency units (VND, VNĐ), and trailing credit indicators (CR, -).

    Args:
        val (Any): Raw cell value or numeric value.
        default (float, optional): Fallback if parsing fails. Defaults to 0.0.

    Returns:
        float: Clean numeric amount.
    """
    if val is None or pd.isna(val):
        return default

    if isinstance(val, (int, float)):
        return float(val)

    s = (
        str(val)
        .replace(",", "")
        .replace(" ", "")
        .replace("VND", "")
        .replace("VNĐ", "")
        .strip()
    )
    if s.endswith("CR") or s.endswith("-"):
        s = "-" + s.replace("CR", "").replace("-", "")

    try:
        return float(s)
    except (ValueError, TypeError):
        return default


def parse_date(s: Any) -> Optional[datetime.date]:
    """Parse date strings or datetime instances across multiple common formats.

    Supports DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, and DD/MM/YY.

    Args:
        s (Any): Raw date string, date, or datetime object.

    Returns:
        Optional[datetime.date]: Parsed standard date object or None if invalid.
    """
    if not s or pd.isna(s):
        return None

    if isinstance(s, (datetime.datetime, datetime.date)):
        return s.date() if isinstance(s, datetime.datetime) else s

    s = str(s).strip()
    for fmt in ["%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y"]:
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except (ValueError, TypeError):
            pass

    return None


def calculate_tx_fingerprint(
    acc_id: Any,
    t_date: Any,
    p_date: Any,
    raw_desc: str,
    total_amt: float,
    orig_amt: float,
    orig_curr: str,
    occurrence_index: int = 1,
) -> str:
    """Generate deterministic SHA-256 hash fingerprint for transaction deduplication.

    Fingerprint Payload:
        `acc_id|t_date|p_date|raw_desc|total_amt|orig_amt|orig_curr|occurrence_index`

    Args:
        acc_id (Any): Account UUID.
        t_date (Any): Transaction date.
        p_date (Any): Posting date.
        raw_desc (str): Raw descriptor from statement / POS.
        total_amt (float): Final billing amount.
        orig_amt (float): Original transaction currency amount.
        orig_curr (str): Original transaction currency (e.g. VND, USD).
        occurrence_index (int, optional): Occurrence counter on identical same-day transactions. Defaults to 1.

    Returns:
        str: 64-character hex SHA-256 fingerprint hash.
    """
    payload = f"{acc_id}|{t_date}|{p_date or ''}|{raw_desc}|{total_amt:.2f}|{orig_amt:.2f}|{orig_curr}|{occurrence_index}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


try:
    conn = psycopg2.connect(DB_URL)
except Exception:
    # Fallback to localhost if 'db' hostname cannot be resolved (when running outside Docker container)
    local_db_url = re.sub(r"@db(:|\/|\?)", r"@localhost\1", DB_URL)
    conn = psycopg2.connect(local_db_url)

cur = conn.cursor()

try:
    print("Connected to Database. Starting migration...")

    # 1. Map Institutions
    cur.execute("SELECT code, id FROM institutions;")
    inst_map = {row[0]: row[1] for row in cur.fetchall()}

    # 2. Migrate Accounts (Dynamic Credit Limit & Dynamic Card Replacement)
    account_id_map = {}
    for _, row in df_accounts.iterrows():
        acc_num = str(row["Account Number"]).strip()
        bank_name = str(row["Bank Name"]).strip()
        acc_type_str = str(row["Account Type"]).strip()

        inst_code = "SHINHAN"
        if "HSBC" in bank_name.upper():
            inst_code = "HSBC"
        elif "SACOM" in bank_name.upper():
            inst_code = "SACOMBANK"

        inst_id = inst_map.get(inst_code)
        last4 = acc_num.replace(" ", "")[-4:]

        # Dynamic Credit Limit: Read from Accounts sheet if present, else lookup max limit in Statements sheet
        limit_val = 0.0
        if "Credit Limit" in row and not pd.isna(row["Credit Limit"]):
            limit_val = clean_num(row["Credit Limit"])
        else:
            acc_stmts = df_statements[
                df_statements["Account Number"].astype(str).str.strip() == acc_num
            ]
            if not acc_stmts.empty and "Credit Limit" in acc_stmts.columns:
                limits = acc_stmts["Credit Limit"].apply(clean_num)
                limit_val = float(limits.max()) if not limits.empty else 0.0

        # Dynamic Card Replacement Linkage
        replaces_id = None
        if "Replaces Account Number" in row and not pd.isna(
            row["Replaces Account Number"]
        ):
            rep_num = str(row["Replaces Account Number"]).strip()
            replaces_id = account_id_map.get(rep_num)
        elif "0642" in acc_num:
            replaces_id = account_id_map.get("4696 72xx xxxx 2958")

        if replaces_id:
            cur.execute(
                "UPDATE accounts SET status = 'REPLACED', closed_date = '2024-12-01' WHERE id = %s;",
                (replaces_id,),
            )

        cur.execute(
            "SELECT id FROM accounts WHERE card_number_masked = %s;", (acc_num,)
        )
        res = cur.fetchone()
        if res:
            acc_id = res[0]
            cur.execute(
                "UPDATE accounts SET credit_limit = %s WHERE id = %s;",
                (limit_val, acc_id),
            )
        else:
            cur.execute(
                """
                INSERT INTO accounts (institution_id, account_name, account_type, card_number_masked, card_number_last4, credit_limit, replaces_account_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            """,
                (
                    inst_id,
                    acc_type_str,
                    "CREDIT_CARD",
                    acc_num,
                    last4,
                    limit_val,
                    replaces_id,
                ),
            )
            acc_id = cur.fetchone()[0]

        account_id_map[acc_num] = acc_id

    print(f"Migrated {len(account_id_map)} Accounts.")

    # 3. Map & Sync Categories
    for _, cat_row in df_categories.iterrows():
        c_p = str(cat_row.get("Category (Cấp 1)", "")).strip()
        c_sub = str(cat_row.get("Category Detail (Cấp 2)", "")).strip()
        if c_p and c_sub and c_sub != "None":
            cur.execute(
                "SELECT id FROM categories WHERE name = %s AND parent_id IS NULL;",
                (c_p,),
            )
            p_res = cur.fetchone()
            if p_res:
                p_id = p_res[0]
                cur.execute(
                    "SELECT id FROM categories WHERE parent_id = %s AND name = %s;",
                    (p_id, c_sub),
                )
                if not cur.fetchone():
                    cur.execute(
                        """
                        INSERT INTO categories (parent_id, name, category_type, is_system)
                        SELECT %s, %s, category_type, TRUE
                        FROM categories WHERE id = %s;
                    """,
                        (p_id, c_sub, p_id),
                    )

    cur.execute("SELECT name, id FROM categories;")
    cat_map = {row[0]: row[1] for row in cur.fetchall()}

    # 4. Migrate Merchants & Aliases
    unique_merchants = df_transactions["Merchant"].dropna().unique()
    merchant_id_map = {}
    for m_name in unique_merchants:
        m_clean = str(m_name).strip()
        if not m_clean or m_clean == "None":
            continue

        cur.execute("SELECT id FROM merchants WHERE cleaned_name = %s;", (m_clean,))
        res = cur.fetchone()
        if res:
            m_id = res[0]
        else:
            cur.execute(
                """
                INSERT INTO merchants (cleaned_name)
                VALUES (%s)
                RETURNING id;
            """,
                (m_clean,),
            )
            m_id = cur.fetchone()[0]

        merchant_id_map[m_clean] = m_id

    print(f"Migrated {len(merchant_id_map)} Merchants.")

    # Seed common merchant aliases from raw descriptions (Bulk Insert)
    alias_records = []
    seen_alias_patterns = set()
    for _, row in df_transactions.iterrows():
        raw_desc = (
            str(row["Transaction Detail"]).strip()
            if not pd.isna(row["Transaction Detail"])
            else None
        )
        m_name = str(row["Merchant"]).strip() if not pd.isna(row["Merchant"]) else None
        m_id = merchant_id_map.get(m_name)
        if raw_desc and m_id and raw_desc != m_name:
            if raw_desc not in seen_alias_patterns:
                seen_alias_patterns.add(raw_desc)
                alias_records.append((m_id, raw_desc))

    if alias_records:
        execute_values(
            cur,
            """
            INSERT INTO merchant_aliases (merchant_id, pattern)
            VALUES %s
            ON CONFLICT (pattern) DO NOTHING;
            """,
            alias_records,
            page_size=500,
        )
    print(f"Migrated {len(alias_records)} Merchant Aliases (Bulk Insert).")

    # 5. Migrate Statements (Bulk Insert)
    statement_records = []
    seen_stmt_keys = set()
    for _, row in df_statements.iterrows():
        acc_num = str(row["Account Number"]).strip()
        acc_id = account_id_map.get(acc_num)
        stmt_date = parse_date(row["Statement Date"])
        due_date = parse_date(row["Payment Due Date"])
        if not stmt_date or not acc_id:
            continue

        stmt_key = (acc_id, stmt_date)
        if stmt_key in seen_stmt_keys:
            continue

        seen_stmt_keys.add(stmt_key)

        limit_val = clean_num(row["Credit Limit"], 40000000.0)
        purch_val = clean_num(row["Purchase & Cash Advance"])
        inst_val = clean_num(row["Installment"])
        fees_val = clean_num(row["Accumulated Fees & Charges"])
        pay_val = clean_num(row["Payments"])
        bal_val = clean_num(row["Statement Balance"])
        min_val = clean_num(row["Minimum Payment"])
        surplus_val = clean_num(row["Surplus"])
        fn = str(row["File"]) if not pd.isna(row["File"]) else None

        start_date = stmt_date - datetime.timedelta(days=30)

        statement_records.append(
            (
                acc_id,
                stmt_date,
                start_date,
                stmt_date,
                due_date or stmt_date,
                limit_val,
                0.0,
                purch_val,
                inst_val,
                fees_val,
                pay_val,
                bal_val,
                min_val,
                surplus_val,
                fn,
            )
        )

    if statement_records:
        execute_values(
            cur,
            """
            INSERT INTO statements (
                account_id, statement_date, start_date, end_date, payment_due_date, credit_limit,
                previous_balance, purchases_amount, installments_amount, fees_and_charges,
                payments_received, statement_balance, minimum_payment, surplus_amount, source_file_path
            ) VALUES %s
            ON CONFLICT (account_id, statement_date) DO UPDATE SET
                credit_limit = EXCLUDED.credit_limit,
                statement_balance = EXCLUDED.statement_balance,
                minimum_payment = EXCLUDED.minimum_payment,
                source_file_path = EXCLUDED.source_file_path;
            """,
            statement_records,
            page_size=500,
        )

    # Build statement_id_map from database
    cur.execute("""
        SELECT s.id, a.card_number_masked, s.statement_date 
        FROM statements s 
        JOIN accounts a ON s.account_id = a.id;
        """)
    statement_id_map = {(row[1], row[2]): row[0] for row in cur.fetchall()}

    # Auto-update start_date and previous_balance based on chronological statement history
    cur.execute("""
        UPDATE statements s
        SET 
            start_date = COALESCE((
                SELECT (prev.statement_date + INTERVAL '1 day')::DATE
                FROM statements prev 
                WHERE prev.account_id = s.account_id 
                  AND prev.statement_date < s.statement_date
                ORDER BY prev.statement_date DESC 
                LIMIT 1
            ), (s.statement_date - INTERVAL '1 month' + INTERVAL '1 day')::DATE),
            previous_balance = COALESCE((
                SELECT prev.statement_balance 
                FROM statements prev 
                WHERE prev.account_id = s.account_id 
                  AND prev.statement_date < s.statement_date
                ORDER BY prev.statement_date DESC 
                LIMIT 1
            ), 0.00);
        """)

    print(
        f"Migrated {len(statement_id_map)} Statements and updated start_date & previous_balance history."
    )

    # 6. Migrate Transactions (Smart 2-Tier Matching: SHA-256 Fingerprint + Fuzzy Heuristic for Manual Transactions)
    print("Loading existing transactions from database for smart reconciliation...")
    cur.execute("""
        SELECT id, account_id, transaction_date, post_date, raw_description, 
               total_amount, amount, original_amount, original_currency, 
               statement_id, settles_statement_id, merchant_id, category_id, tx_fingerprint, note
        FROM transactions;
    """)
    existing_tx_rows = cur.fetchall()

    # Fast lookups for existing transactions
    db_tx_by_fp = {}
    db_tx_candidates = []
    for r in existing_tx_rows:
        row_dict = {
            "id": r[0],
            "account_id": r[1],
            "transaction_date": r[2],
            "post_date": r[3],
            "raw_description": r[4],
            "total_amount": float(r[5]) if r[5] is not None else 0.0,
            "amount": float(r[6]) if r[6] is not None else 0.0,
            "original_amount": float(r[7]) if r[7] is not None else 0.0,
            "original_currency": r[8] or "VND",
            "statement_id": r[9],
            "settles_statement_id": r[10],
            "merchant_id": r[11],
            "category_id": r[12],
            "tx_fingerprint": r[13],
            "note": r[14],
        }
        if r[13]:
            db_tx_by_fp[r[13]] = row_dict
        db_tx_candidates.append(row_dict)

    def is_desc_similar(d1: Optional[str], d2: Optional[str]) -> bool:
        if not d1 or not d2:
            return True
        c1 = re.sub(r"[^a-zA-Z0-9]", "", d1.lower())
        c2 = re.sub(r"[^a-zA-Z0-9]", "", d2.lower())
        if not c1 or not c2:
            return True
        if c1 in c2 or c2 in c1:
            return True
        w1 = set(d1.upper().split())
        w2 = set(d2.upper().split())
        return len(w1.intersection(w2)) > 0

    tx_records_to_insert = []
    tx_records_to_update = []
    matched_db_tx_ids = set()
    seen_tx_counts = {}
    matched_manual_count = 0
    updated_existing_count = 0

    for _, row in df_transactions.iterrows():
        acc_num = str(row["Account Number"]).strip()
        acc_id = account_id_map.get(acc_num)
        sp = parse_date(row["Statement Period"])
        stmt_id = statement_id_map.get((acc_num, sp))

        t_date = parse_date(row["Transaction Date"]) or sp
        p_date = parse_date(row["Post Date"]) or t_date

        raw_desc = (
            str(row["Transaction Detail"]).strip()
            if not pd.isna(row["Transaction Detail"])
            else None
        )
        merch_name = (
            str(row["Merchant"]).strip() if not pd.isna(row["Merchant"]) else None
        )
        merch_id = merchant_id_map.get(merch_name)

        cat_det = (
            str(row["Category Detail"]).strip()
            if not pd.isna(row["Category Detail"])
            else None
        )
        cat_id = cat_map.get(cat_det)
        if not cat_id:
            if cat_det in ["Dịch vụ Cloud", "Dịch vụ công nghệ / App"]:
                cat_id = cat_map.get("Dịch vụ số & Ứng dụng")
            else:
                cat_id = cat_map.get("Chi tiêu khác")

        # Fallback raw_description if missing (e.g. Repayment / Income transactions)
        if not raw_desc:
            raw_desc = cat_det or merch_name or "Giao dịch thẻ"

        cat_str = str(row["Category"]).strip()
        tx_type = "PURCHASE"
        if cat_det in ["Trả góp", "Tất toán trả góp"]:
            tx_type = "INSTALLMENT_MONTHLY"
        elif cat_det == "Chuyển đổi sang trả góp":
            tx_type = "INSTALLMENT_PRINCIPAL"
        elif cat_det in ["Thanh toán dư nợ", "Nạp tiền"]:
            tx_type = "REPAYMENT"
        elif cat_det == "Hủy giao dịch":
            tx_type = "REFUND"
        elif cat_det == "Hoàn tiền Cashback":
            tx_type = "CASHBACK_CREDIT"
        elif cat_str == "Phí & Lãi":
            if "Lãi" in cat_det:
                tx_type = "INTEREST"
            else:
                tx_type = "FEE"

        amt = clean_num(row["Amount"])
        fee = clean_num(row["Fee"])
        total_amt = clean_num(row["Total Amount"], amt + fee)

        # Sign Convention Enforcement:
        # (-) Credit/Payment/Refund types -> negative
        # (+) Debit/Purchase/Fee types -> positive
        credit_types = {
            "REPAYMENT",
            "REFUND",
            "CASHBACK_CREDIT",
            "INSTALLMENT_PRINCIPAL",
        }
        if tx_type in credit_types:
            total_amt = -abs(total_amt)
            amt = -abs(amt)
        else:
            total_amt = abs(total_amt)
            amt = abs(amt)

        # Foreign Currency Handling (Hỗ trợ Đa tiền tệ & Ngoại tệ)
        orig_amt = (
            clean_num(row["Original Amount"], amt)
            if "Original Amount" in row and not pd.isna(row["Original Amount"])
            else amt
        )
        orig_curr = (
            str(row["Original Currency"]).strip().upper()
            if "Original Currency" in row and not pd.isna(row["Original Currency"])
            else ("USD" if raw_desc and "USD" in raw_desc.upper() else "VND")
        )
        ex_rate = (
            clean_num(row["Exchange Rate"], 1.0)
            if "Exchange Rate" in row and not pd.isna(row["Exchange Rate"])
            else (
                round(abs(amt) / abs(orig_amt), 4)
                if orig_amt != 0 and orig_curr != "VND"
                else 1.0
            )
        )
        for_fee = (
            clean_num(row["Foreign Fee"], fee if orig_curr != "VND" else 0.0)
            if "Foreign Fee" in row and not pd.isna(row["Foreign Fee"])
            else (fee if orig_curr != "VND" else 0.0)
        )

        excel_note = (
            str(row["Note"]).strip()
            if "Note" in row and not pd.isna(row["Note"])
            else None
        )

        # Occurrence Index & Fingerprint Deduplication
        tx_key = (acc_id, t_date, p_date, raw_desc, total_amt, orig_amt, orig_curr)
        seen_tx_counts[tx_key] = seen_tx_counts.get(tx_key, 0) + 1
        occ_idx = seen_tx_counts[tx_key]

        tx_fp = calculate_tx_fingerprint(
            acc_id, t_date, p_date, raw_desc, total_amt, orig_amt, orig_curr, occ_idx
        )

        # Mapping settles_statement_id for REPAYMENT transactions
        settles_stmt_id = None
        if tx_type == "REPAYMENT":
            preceding_stmts = [
                (s_dt, s_id)
                for (a_n, s_dt), s_id in statement_id_map.items()
                if a_n == acc_num and s_dt < t_date
            ]
            if preceding_stmts:
                preceding_stmts.sort(key=lambda x: x[0], reverse=True)
                settles_stmt_id = preceding_stmts[0][1]

        # ---------------------------------------------------------
        # SMART 2-TIER MATCHING LOGIC
        # ---------------------------------------------------------
        matched_db_id = None
        is_manual_match = False

        # Tier 1: Exact Hash Fingerprint Match
        if tx_fp in db_tx_by_fp and str(db_tx_by_fp[tx_fp]["id"]) not in matched_db_tx_ids:
            matched_db_id = db_tx_by_fp[tx_fp]["id"]
            updated_existing_count += 1
        else:
            # Tier 2: Fuzzy Heuristic Match for Manually-Entered Transactions
            # Find all candidates on the same account with matching amount and within 1 day
            candidates_for_acc = [
                cand
                for cand in db_tx_candidates
                if str(cand["id"]) not in matched_db_tx_ids
                and str(cand["account_id"]).lower() == str(acc_id).lower()
                and (
                    abs(cand["total_amount"] - total_amt) < 1.0
                    or abs(abs(cand["amount"]) - abs(amt)) < 1.0
                    or (orig_curr != "VND" and abs(cand["original_amount"] - orig_amt) < 0.1)
                )
                and cand["transaction_date"]
                and abs((cand["transaction_date"] - t_date).days) <= 1
            ]

            if len(candidates_for_acc) == 1:
                # Exactly 1 candidate exists with identical amount and date on this card -> 100% Unambiguous Match!
                matched_db_id = candidates_for_acc[0]["id"]
                is_manual_match = True
                matched_manual_count += 1
            elif len(candidates_for_acc) > 1:
                # Multiple candidates -> filter by description or merchant or payment type
                for cand in candidates_for_acc:
                    merchant_match = (
                        cand["merchant_id"] and cand["merchant_id"] == merch_id
                    )
                    desc_match = is_desc_similar(cand["raw_description"], raw_desc)
                    repay_match = (
                        tx_type == "REPAYMENT"
                        and (
                            cand["total_amount"] < 0
                            or "thanh toán" in (cand["raw_description"] or "").lower()
                            or "sacombank" in (cand["raw_description"] or "").lower()
                        )
                    )
                    inst_match = (
                        tx_type in ["INSTALLMENT_MONTHLY", "INSTALLMENT_PRINCIPAL"]
                        and (
                            "install" in (cand["raw_description"] or "").lower()
                            or "trả góp" in (cand["raw_description"] or "").lower()
                            or "shopee" in (cand["raw_description"] or "").lower()
                        )
                    )
                    if merchant_match or desc_match or repay_match or inst_match:
                        matched_db_id = cand["id"]
                        is_manual_match = True
                        matched_manual_count += 1
                        break
                # Fallback to first candidate if no specific match
                if not matched_db_id:
                    matched_db_id = candidates_for_acc[0]["id"]
                    is_manual_match = True
                    matched_manual_count += 1

        if matched_db_id:
            matched_db_tx_ids.add(str(matched_db_id))
            # Find candidate note if any to preserve custom manual notes if Excel note is empty
            merged_note = excel_note
            for cand in db_tx_candidates:
                if str(cand["id"]) == str(matched_db_id):
                    if not merged_note and cand.get("note"):
                        merged_note = cand["note"]
                    break

            tx_records_to_update.append(
                (
                    stmt_id,
                    settles_stmt_id,
                    t_date,
                    p_date,
                    raw_desc,
                    merch_id,
                    cat_id,
                    tx_type,
                    orig_amt,
                    orig_curr,
                    ex_rate,
                    for_fee,
                    amt,
                    fee,
                    total_amt,
                    merged_note,
                    (tx_type == "INSTALLMENT_MONTHLY"),
                    tx_fp,
                    str(matched_db_id),
                )
            )
        else:
            tx_records_to_insert.append(
                (
                    acc_id,
                    stmt_id,
                    settles_stmt_id,
                    t_date,
                    p_date,
                    raw_desc,
                    merch_id,
                    cat_id,
                    tx_type,
                    orig_amt,
                    orig_curr,
                    ex_rate,
                    for_fee,
                    amt,
                    fee,
                    total_amt,
                    excel_note,
                    (tx_type == "INSTALLMENT_MONTHLY"),
                    tx_fp,
                )
            )

    # Execute Bulk Updates for Matched / Reconciled Transactions
    if tx_records_to_update:
        execute_values(
            cur,
            """
            UPDATE transactions AS t
            SET 
                statement_id = v.statement_id::uuid,
                settles_statement_id = v.settles_statement_id::uuid,
                transaction_date = v.transaction_date::date,
                post_date = v.post_date::date,
                raw_description = v.raw_description,
                merchant_id = v.merchant_id::uuid,
                category_id = v.category_id::uuid,
                transaction_type = v.transaction_type::transaction_type_enum,
                original_amount = v.original_amount::numeric,
                original_currency = v.original_currency,
                exchange_rate = v.exchange_rate::numeric,
                foreign_fee = v.foreign_fee::numeric,
                amount = v.amount::numeric,
                fee = v.fee::numeric,
                total_amount = v.total_amount::numeric,
                note = v.note,
                is_installment = v.is_installment::boolean,
                tx_fingerprint = v.tx_fingerprint
            FROM (VALUES %s) AS v(
                statement_id, settles_statement_id, transaction_date, post_date, raw_description,
                merchant_id, category_id, transaction_type, original_amount, original_currency,
                exchange_rate, foreign_fee, amount, fee, total_amount, note, is_installment,
                tx_fingerprint, id
            )
            WHERE t.id = v.id::uuid;
            """,
            tx_records_to_update,
            page_size=1000,
        )

    # Execute Bulk Insert for New Transactions
    if tx_records_to_insert:
        execute_values(
            cur,
            """
            INSERT INTO transactions (
                account_id, statement_id, settles_statement_id, transaction_date, post_date, raw_description,
                merchant_id, category_id, transaction_type,
                original_amount, original_currency, exchange_rate, foreign_fee,
                amount, fee, total_amount, note, is_installment, tx_fingerprint
            ) VALUES %s
            ON CONFLICT (tx_fingerprint) DO UPDATE SET
                statement_id = EXCLUDED.statement_id,
                settles_statement_id = EXCLUDED.settles_statement_id,
                post_date = EXCLUDED.post_date,
                category_id = EXCLUDED.category_id,
                merchant_id = EXCLUDED.merchant_id,
                amount = EXCLUDED.amount,
                fee = EXCLUDED.fee,
                total_amount = EXCLUDED.total_amount,
                note = EXCLUDED.note,
                is_installment = EXCLUDED.is_installment;
            """,
            tx_records_to_insert,
            page_size=1000,
        )

    # Fallback Auto-Link: Link any unbilled manual transactions to closed statement cycles
    cur.execute("""
        UPDATE transactions t
        SET 
            statement_id = s.id,
            post_date = COALESCE(t.post_date, t.transaction_date)
        FROM statements s
        WHERE t.account_id = s.account_id
          AND t.statement_id IS NULL
          AND t.transaction_date >= s.start_date
          AND t.transaction_date <= s.end_date;
    """)

    # ---------------------------------------------------------
    # 7. AUTOMATIC DEDUPLICATION & ORPHAN DUPLICATE PURGE
    # ---------------------------------------------------------
    print("Running automatic deduplication and orphan duplicate purge...")
    cur.execute("""
        WITH duplicate_pairs AS (
            SELECT 
                t_excel.id AS excel_id,
                t_manual.id AS manual_id,
                t_manual.note AS manual_note,
                t_manual.installment_plan_id AS manual_plan_id,
                ROW_NUMBER() OVER (
                    PARTITION BY t_manual.id 
                    ORDER BY 
                        (t_excel.transaction_date = t_manual.transaction_date) DESC,
                        (t_excel.raw_description = t_manual.raw_description) DESC,
                        t_excel.created_at ASC
                ) as rn
            FROM transactions t_excel
            JOIN transactions t_manual ON t_excel.account_id = t_manual.account_id
                                      AND abs(t_excel.transaction_date - t_manual.transaction_date) <= 1
                                      AND abs(t_excel.total_amount - t_manual.total_amount) < 1.0
                                      AND t_excel.id != t_manual.id
            WHERE t_excel.statement_id IS NOT NULL
              AND (
                  t_manual.statement_id IS NULL
                  OR t_manual.created_at > t_excel.created_at
                  OR t_manual.id > t_excel.id
              )
        )
        SELECT excel_id, manual_id, manual_note, manual_plan_id
        FROM duplicate_pairs
        WHERE rn = 1;
    """)
    dup_rows = cur.fetchall()

    purged_count = 0
    for ex_id, man_id, man_note, man_plan_id in dup_rows:
        # Transfer custom manual note if excel row note is empty
        if man_note:
            cur.execute("""
                UPDATE transactions 
                SET note = COALESCE(NULLIF(note, ''), %s)
                WHERE id = %s;
            """, (man_note, ex_id))

        # Transfer installment plan linkage if any
        if man_plan_id:
            cur.execute("""
                UPDATE transactions 
                SET installment_plan_id = COALESCE(installment_plan_id, %s)
                WHERE id = %s;
            """, (man_plan_id, ex_id))
            cur.execute("""
                UPDATE installment_plans 
                SET origin_transaction_id = %s 
                WHERE origin_transaction_id = %s;
            """, (ex_id, man_id))

        # Safely delete duplicate record
        cur.execute("DELETE FROM transactions WHERE id = %s;", (man_id,))
        purged_count += 1

    print(
        f"Transactions Migration Summary:\n"
        f"  • Matched & Reconciled Manual Transactions: {matched_manual_count}\n"
        f"  • Updated Existing Hash Transactions: {updated_existing_count}\n"
        f"  • Newly Inserted Transactions: {len(tx_records_to_insert)}\n"
        f"  • Purged & Consolidated Duplicates: {purged_count}\n"
        f"  • Total Processed from Excel: {len(df_transactions)}"
    )

    # 7. Migrate Installment Plans & Schedules (Dynamic Term Resolution & Rounding Offsets)
    for _, row in df_instalments.iterrows():
        p_name = str(row["Production"]).strip()
        acc_num = str(row["Account Number"]).strip()
        acc_id = account_id_map.get(acc_num)
        t_date = parse_date(row["Transaction Date"])
        tot_amt = clean_num(row["Total Amount"])
        conv_fee = clean_num(row["Conversion Fee"])
        status_str = str(row["Status"]).strip()

        if any(k in status_str for k in ["Tất toán", "Early", "Settle"]):
            status = "EARLY_SETTLED"
        elif "Hoàn thành" in status_str or "COMPLETED" in status_str.upper():
            status = "COMPLETED"
        elif "Hủy" in status_str or "CANCEL" in status_str.upper():
            status = "CANCELLED"
        else:
            status = "ACTIVE"

        # Dynamic Term Resolution (4-tier priority):
        # Tier 1: Read from Excel column if present
        term = None
        for term_col in ["Term", "Term Months", "Kỳ hạn", "Term (Months)"]:
            if term_col in row and not pd.isna(row[term_col]):
                try:
                    term = int(row[term_col])
                    break
                except (ValueError, TypeError):
                    pass

        # Tier 2: Regex extraction from product name / note (e.g. "3 tháng", "6T", "9M")
        if not term:
            match = re.search(
                r"(\d+)\s*(?:tháng|thg|kỳ|m|months?)", p_name, re.IGNORECASE
            )
            if match:
                term = int(match.group(1))

        # Tier 3: Calculate dynamically from matching INSTALLMENT_MONTHLY transactions
        if not term:
            matching_txs = df_transactions[
                (df_transactions["Account Number"].astype(str).str.strip() == acc_num)
                & (
                    df_transactions["Transaction Detail"]
                    .astype(str)
                    .str.contains(p_name, case=False, na=False)
                    | df_transactions["Note"]
                    .astype(str)
                    .str.contains(p_name, case=False, na=False)
                )
            ]
            if not matching_txs.empty:
                monthly_txs = matching_txs[matching_txs["Category Detail"] == "Trả góp"]
                if not monthly_txs.empty:
                    m_amt = clean_num(monthly_txs.iloc[0]["Total Amount"])
                    if m_amt > 0:
                        term = int(round(tot_amt / m_amt))

        # Tier 4: Default fallback
        if not term or term <= 0:
            term = 12

        # Rounding Offset Calculation:
        base_monthly = round(tot_amt / term, 2)
        accumulated_principal = 0.0

        # Check if plan already exists to ensure idempotency
        cur.execute(
            """
            SELECT id FROM installment_plans 
            WHERE account_id = %s AND product_name = %s AND start_date = %s;
        """,
            (acc_id, p_name, t_date),
        )
        plan_res = cur.fetchone()
        if plan_res:
            plan_id = plan_res[0]
            cur.execute(
                "DELETE FROM installment_schedules WHERE installment_plan_id = %s;",
                (plan_id,),
            )
            cur.execute(
                """
                UPDATE installment_plans SET
                    total_amount = %s, conversion_fee = %s, term_months = %s,
                    monthly_principal = %s, monthly_payment = %s,
                    status = %s, remaining_balance = %s
                WHERE id = %s;
            """,
                (
                    tot_amt,
                    conv_fee,
                    term,
                    base_monthly,
                    base_monthly,
                    status,
                    0.0 if status in ["COMPLETED", "EARLY_SETTLED"] else tot_amt,
                    plan_id,
                ),
            )
        else:
            cur.execute(
                """
                INSERT INTO installment_plans (
                    account_id, product_name, start_date, total_amount, conversion_fee,
                    interest_rate_percent, term_months, monthly_principal, monthly_payment,
                    remaining_balance, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            """,
                (
                    acc_id,
                    p_name,
                    t_date,
                    tot_amt,
                    conv_fee,
                    0.0,
                    term,
                    base_monthly,
                    base_monthly,
                    0.0 if status in ["COMPLETED", "EARLY_SETTLED"] else tot_amt,
                    status,
                ),
            )
            plan_id = cur.fetchone()[0]

        # Fetch billing_day_of_month from accounts if available
        cur.execute(
            "SELECT billing_day_of_month FROM accounts WHERE id = %s;", (acc_id,)
        )
        b_res = cur.fetchone()
        billing_day = b_res[0] if b_res and b_res[0] else None

        plan_schedules = []
        for i in range(1, term + 1):
            if i == term:
                # Kỳ cuối cùng gánh phần lẻ làm tròn còn dư
                period_principal = round(tot_amt - accumulated_principal, 2)
            else:
                period_principal = base_monthly
                accumulated_principal += period_principal

            due_date = add_months_to_date(t_date, i, billing_day)

            plan_schedules.append(
                (
                    plan_id,
                    i,
                    term,
                    due_date,
                    period_principal,
                    period_principal,
                    False,
                )
            )

        if plan_schedules:
            execute_values(
                cur,
                """
                INSERT INTO installment_schedules (
                    installment_plan_id, installment_index, total_installments,
                    due_date, principal_amount, total_installment_amount, is_billed
                ) VALUES %s;
                """,
                plan_schedules,
                page_size=50,
            )

        # Link related monthly transactions to this installment plan
        cur.execute(
            """
            UPDATE transactions
            SET installment_plan_id = %s
            WHERE account_id = %s 
              AND (
                note ILIKE %s 
                OR raw_description ILIKE %s
              );
        """,
            (plan_id, acc_id, f"%{p_name}%", f"%{p_name}%"),
        )

        # Check if there is an early settlement transaction linked to this plan
        cur.execute(
            """
            SELECT id, statement_id, total_amount, transaction_date
            FROM transactions
            WHERE installment_plan_id = %s 
              AND transaction_type = 'INSTALLMENT_MONTHLY'
              AND (
                category_id = (SELECT id FROM categories WHERE name = 'Tất toán trả góp' LIMIT 1)
                OR note ILIKE '%%tất toán%%' 
                OR raw_description ILIKE '%%tất toán%%'
              )
            ORDER BY transaction_date DESC
            LIMIT 1;
        """,
            (plan_id,),
        )
        settle_res = cur.fetchone()

        if settle_res or status == "EARLY_SETTLED":
            if settle_res:
                settle_tx_id, settle_stmt_id, settle_amt, settle_date = settle_res
                # 1. Map normal monthly installments prior to settlement date
                cur.execute(
                    """
                    WITH tx_seq AS (
                        SELECT id, statement_id, total_amount, transaction_date,
                               ROW_NUMBER() OVER (ORDER BY transaction_date ASC) as seq
                        FROM transactions
                        WHERE installment_plan_id = %s 
                          AND transaction_type = 'INSTALLMENT_MONTHLY'
                          AND id != %s
                          AND transaction_date <= %s
                    ),
                    sch_seq AS (
                        SELECT id, installment_index,
                               ROW_NUMBER() OVER (ORDER BY installment_index ASC) as seq
                        FROM installment_schedules
                        WHERE installment_plan_id = %s
                    )
                    UPDATE installment_schedules s
                    SET statement_id = t.statement_id,
                        total_installment_amount = t.total_amount,
                        is_billed = TRUE
                    FROM tx_seq t
                    JOIN sch_seq sch ON t.seq = sch.seq
                    WHERE s.id = sch.id;
                """,
                    (plan_id, settle_tx_id, settle_date, plan_id),
                )

                cur.execute(
                    """
                    SELECT COUNT(*) FROM transactions
                    WHERE installment_plan_id = %s 
                      AND transaction_type = 'INSTALLMENT_MONTHLY'
                      AND id != %s
                      AND transaction_date <= %s;
                """,
                    (plan_id, settle_tx_id, settle_date),
                )
                normal_count = cur.fetchone()[0]

                # 2. All remaining schedules from (normal_count + 1) to term were settled by this early settlement transaction
                cur.execute(
                    """
                    UPDATE installment_schedules
                    SET statement_id = %s,
                        is_billed = TRUE
                    WHERE installment_plan_id = %s 
                      AND installment_index > %s;
                """,
                    (settle_stmt_id, plan_id, normal_count),
                )
            else:
                cur.execute(
                    """
                    UPDATE installment_schedules
                    SET is_billed = TRUE
                    WHERE installment_plan_id = %s;
                """,
                    (plan_id,),
                )

            # Ensure remaining balance is 0 and status is EARLY_SETTLED
            cur.execute(
                """
                UPDATE installment_plans
                SET remaining_balance = 0.00,
                    status = 'EARLY_SETTLED'
                WHERE id = %s;
            """,
                (plan_id,),
            )
        elif status == "COMPLETED":
            cur.execute(
                """
                WITH tx_seq AS (
                    SELECT id, statement_id, total_amount, transaction_date,
                           ROW_NUMBER() OVER (ORDER BY transaction_date ASC) as seq
                    FROM transactions
                    WHERE installment_plan_id = %s AND transaction_type = 'INSTALLMENT_MONTHLY'
                ),
                sch_seq AS (
                    SELECT id, installment_index,
                           ROW_NUMBER() OVER (ORDER BY installment_index ASC) as seq
                    FROM installment_schedules
                    WHERE installment_plan_id = %s
                )
                UPDATE installment_schedules s
                SET statement_id = t.statement_id,
                    total_installment_amount = t.total_amount,
                    is_billed = TRUE
                FROM tx_seq t
                JOIN sch_seq sch ON t.seq = sch.seq
                WHERE s.id = sch.id;
            """,
                (plan_id, plan_id),
            )
            cur.execute(
                """
                UPDATE installment_schedules
                SET is_billed = TRUE
                WHERE installment_plan_id = %s;
            """,
                (plan_id,),
            )
            cur.execute(
                """
                UPDATE installment_plans
                SET remaining_balance = 0.00,
                    status = 'COMPLETED'
                WHERE id = %s;
            """,
                (plan_id,),
            )
        else:
            # Active plan: sequentially map billed transactions
            cur.execute(
                """
                WITH tx_seq AS (
                    SELECT id, statement_id, total_amount, transaction_date,
                           ROW_NUMBER() OVER (ORDER BY transaction_date ASC) as seq
                    FROM transactions
                    WHERE installment_plan_id = %s AND transaction_type = 'INSTALLMENT_MONTHLY'
                ),
                sch_seq AS (
                    SELECT id, installment_index,
                           ROW_NUMBER() OVER (ORDER BY installment_index ASC) as seq
                    FROM installment_schedules
                    WHERE installment_plan_id = %s
                )
                UPDATE installment_schedules s
                SET statement_id = t.statement_id,
                    total_installment_amount = t.total_amount,
                    is_billed = TRUE
                FROM tx_seq t
                JOIN sch_seq sch ON t.seq = sch.seq
                WHERE s.id = sch.id;
            """,
                (plan_id, plan_id),
            )

    print(
        f"Migrated {len(df_instalments)} Installment Plans with dynamic term resolution & statement override."
    )

    # 8. Migrate Rewards (Bulk Insert)
    reward_records = []
    seen_reward_keys = set()
    for _, row in df_rewards.iterrows():
        acc_num = str(row["Account Number"]).strip()
        acc_id = account_id_map.get(acc_num)
        s_date = parse_date(row["Statement Date"])
        stmt_id = statement_id_map.get((acc_num, s_date))
        if not acc_id or not stmt_id:
            continue

        r_type_str = str(row["Reward Type"]).strip()
        r_type = (
            "CASHBACK"
            if "CASH" in r_type_str.upper()
            else ("MILE" if "MILE" in r_type_str.upper() else "POINT")
        )

        reward_key = (acc_id, stmt_id, r_type)
        if reward_key in seen_reward_keys:
            continue
        seen_reward_keys.add(reward_key)

        tm_reward = clean_num(row.get("This month reward"), 0.0)
        used_amt = clean_num(row.get("This month used"), 0.0)
        avail_bal = clean_num(row.get("Available reward"), 0.0)
        prev_rem = round(avail_bal - tm_reward + used_amt, 2)
        exp_amt = clean_num(row.get("Reward will be expired"), 0.0)
        exp_date = parse_date(row.get("Expired date"))

        reward_records.append(
            (
                acc_id,
                stmt_id,
                r_type,
                prev_rem,
                tm_reward,
                used_amt,
                avail_bal,
                exp_amt,
                exp_date,
            )
        )

    if reward_records:
        execute_values(
            cur,
            """
            INSERT INTO reward_ledgers (
                account_id, statement_id, reward_type,
                previous_remaining, earned_this_month, used_this_month, available_balance,
                expiring_amount, expiration_date
            ) VALUES %s
            ON CONFLICT (account_id, statement_id, reward_type) DO UPDATE SET
                previous_remaining = EXCLUDED.previous_remaining,
                earned_this_month = EXCLUDED.earned_this_month,
                used_this_month = EXCLUDED.used_this_month,
                available_balance = EXCLUDED.available_balance,
                expiring_amount = EXCLUDED.expiring_amount,
                expiration_date = EXCLUDED.expiration_date;
            """,
            reward_records,
            page_size=1000,
        )

    print(f"Migrated {len(reward_records)} Reward Ledger records (Bulk Insert).")

    # 9. Apply Partial & Composite Performance Indexes
    print("Applying performance database indexes...")
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_tx_unbilled_live 
        ON transactions (account_id, transaction_date, post_date, total_amount) 
        WHERE statement_id IS NULL;

        CREATE INDEX IF NOT EXISTS idx_tx_repayments 
        ON transactions (account_id, transaction_date, total_amount) 
        WHERE transaction_type = 'REPAYMENT';

        CREATE INDEX IF NOT EXISTS idx_statements_latest_lookup 
        ON statements (account_id, statement_date DESC, statement_balance);

        CREATE INDEX IF NOT EXISTS idx_tx_date_desc 
        ON transactions (transaction_date DESC, created_at DESC);
    """)

    conn.commit()
    print("\nALL DATA MIGRATED & INDEXED SUCCESSFULLY TO POSTGRESQL ON DOCKER!")
finally:
    cur.close()
    conn.close()

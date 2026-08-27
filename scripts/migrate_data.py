import openpyxl, os, datetime, re, warnings, hashlib
from pathlib import Path
import pandas as pd
import psycopg2

warnings.filterwarnings("ignore", category=UserWarning, module="openpyxl")

# Automatically load .env if available
env_file = Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

DB_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/credit_wallet"
)

excel_path = "data/My Credit Wallet 2.0.xlsx"
wb = openpyxl.load_workbook(excel_path, data_only=True)


def load_sheet(name):
    if name not in wb.sheetnames:
        return pd.DataFrame()

    ws = wb[name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return pd.DataFrame()

    header = rows[0]
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


def clean_num(val, default=0.0):
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
    except:
        return default


def parse_date(s):
    if not s or pd.isna(s):
        return None

    if isinstance(s, (datetime.datetime, datetime.date)):
        return s.date() if isinstance(s, datetime.datetime) else s

    s = str(s).strip()
    for fmt in ["%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y"]:
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except:
            pass

    return None


def calculate_tx_fingerprint(
    acc_id, t_date, p_date, raw_desc, total_amt, orig_amt, orig_curr, occurrence_index=1
):
    payload = f"{acc_id}|{t_date}|{p_date or ''}|{raw_desc}|{total_amt:.2f}|{orig_amt:.2f}|{orig_curr}|{occurrence_index}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


conn = psycopg2.connect(DB_URL)
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
        if "Replaces Account Number" in row and not pd.isna(row["Replaces Account Number"]):
            rep_num = str(row["Replaces Account Number"]).strip()
            replaces_id = account_id_map.get(rep_num)
        elif "0642" in acc_num:
            replaces_id = account_id_map.get("4696 72xx xxxx 2958")

        if replaces_id:
            cur.execute(
                "UPDATE accounts SET status = 'REPLACED', closed_date = '2024-12-01' WHERE id = %s;",
                (replaces_id,),
            )

        cur.execute("SELECT id FROM accounts WHERE card_number_masked = %s;", (acc_num,))
        res = cur.fetchone()
        if res:
            acc_id = res[0]
            cur.execute(
                "UPDATE accounts SET credit_limit = %s WHERE id = %s;", (limit_val, acc_id)
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
            cur.execute("SELECT id FROM categories WHERE name = %s AND parent_id IS NULL;", (c_p,))
            p_res = cur.fetchone()
            if p_res:
                p_id = p_res[0]
                cur.execute("SELECT id FROM categories WHERE parent_id = %s AND name = %s;", (p_id, c_sub))
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

    # Seed common merchant aliases from raw descriptions
    for _, row in df_transactions.iterrows():
        raw_desc = (
            str(row["Transaction Detail"]).strip()
            if not pd.isna(row["Transaction Detail"])
            else None
        )
        m_name = str(row["Merchant"]).strip() if not pd.isna(row["Merchant"]) else None
        m_id = merchant_id_map.get(m_name)
        if raw_desc and m_id and raw_desc != m_name:
            cur.execute(
                """
                INSERT INTO merchant_aliases (merchant_id, pattern)
                VALUES (%s, %s)
                ON CONFLICT (pattern) DO NOTHING;
            """,
                (m_id, raw_desc),
            )

    # 5. Migrate Statements
    statement_id_map = {}
    for _, row in df_statements.iterrows():
        acc_num = str(row["Account Number"]).strip()
        acc_id = account_id_map.get(acc_num)
        stmt_date = parse_date(row["Statement Date"])
        due_date = parse_date(row["Payment Due Date"])
        if not stmt_date or not acc_id:
            continue

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

        cur.execute(
            """
            INSERT INTO statements (
                account_id, statement_date, start_date, end_date, payment_due_date, credit_limit,
                previous_balance, purchases_amount, installments_amount, fees_and_charges,
                payments_received, statement_balance, minimum_payment, surplus_amount, source_file_path
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (account_id, statement_date) DO UPDATE SET
                credit_limit = EXCLUDED.credit_limit,
                statement_balance = EXCLUDED.statement_balance,
                minimum_payment = EXCLUDED.minimum_payment,
                source_file_path = EXCLUDED.source_file_path
            RETURNING id;
        """,
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
            ),
        )
        stmt_id = cur.fetchone()[0]
        statement_id_map[(acc_num, stmt_date)] = stmt_id

    # Auto-update start_date and previous_balance based on chronological statement history
    cur.execute(
        """
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
    """
    )

    print(
        f"Migrated {len(statement_id_map)} Statements and updated start_date & previous_balance history."
    )

    # 6. Migrate Transactions (With Fingerprint Deduplication & Enforced Sign Conventions)
    tx_count = 0
    seen_tx_counts = {}

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
            else (round(abs(amt) / abs(orig_amt), 4) if orig_amt != 0 and orig_curr != "VND" else 1.0)
        )
        for_fee = (
            clean_num(row["Foreign Fee"], fee if orig_curr != "VND" else 0.0)
            if "Foreign Fee" in row and not pd.isna(row["Foreign Fee"])
            else (fee if orig_curr != "VND" else 0.0)
        )

        note = (
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

        cur.execute(
            """
            INSERT INTO transactions (
                account_id, statement_id, settles_statement_id, transaction_date, post_date, raw_description,
                merchant_id, category_id, transaction_type,
                original_amount, original_currency, exchange_rate, foreign_fee,
                amount, fee, total_amount, note, is_installment, tx_fingerprint
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (tx_fingerprint) DO UPDATE SET
                statement_id = EXCLUDED.statement_id,
                settles_statement_id = EXCLUDED.settles_statement_id,
                category_id = EXCLUDED.category_id,
                merchant_id = EXCLUDED.merchant_id,
                note = EXCLUDED.note,
                is_installment = EXCLUDED.is_installment;
        """,
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
                note,
                (tx_type == "INSTALLMENT_MONTHLY"),
                tx_fp,
            ),
        )
        tx_count += 1

    print(f"Migrated {tx_count} Transactions (with fingerprint deduplication & settlement mapping).")

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
            match = re.search(r"(\d+)\s*(?:tháng|thg|kỳ|m|months?)", p_name, re.IGNORECASE)
            if match:
                term = int(match.group(1))

        # Tier 3: Calculate dynamically from matching INSTALLMENT_MONTHLY transactions
        if not term:
            matching_txs = df_transactions[
                (df_transactions["Account Number"].astype(str).str.strip() == acc_num) &
                (
                    df_transactions["Transaction Detail"].astype(str).str.contains(p_name, case=False, na=False) |
                    df_transactions["Note"].astype(str).str.contains(p_name, case=False, na=False)
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
            cur.execute("DELETE FROM installment_schedules WHERE installment_plan_id = %s;", (plan_id,))
            cur.execute(
                """
                UPDATE installment_plans SET
                    total_amount = %s, conversion_fee = %s, term_months = %s,
                    monthly_principal = %s, monthly_payment = %s,
                    status = %s, remaining_balance = %s
                WHERE id = %s;
            """,
                (tot_amt, conv_fee, term, base_monthly, base_monthly, status, 0.0 if status in ["COMPLETED", "EARLY_SETTLED"] else tot_amt, plan_id),
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

        for i in range(1, term + 1):
            if i == term:
                # Kỳ cuối cùng gánh phần lẻ làm tròn còn dư
                period_principal = round(tot_amt - accumulated_principal, 2)
            else:
                period_principal = base_monthly
                accumulated_principal += period_principal

            due_date = t_date + datetime.timedelta(days=30 * i)

            cur.execute(
                """
                INSERT INTO installment_schedules (
                    installment_plan_id, installment_index, total_installments,
                    due_date, principal_amount, total_installment_amount, is_billed
                ) VALUES (%s, %s, %s, %s, %s, %s, %s);
            """,
                (
                    plan_id,
                    i,
                    term,
                    due_date,
                    period_principal,
                    period_principal,
                    False,
                ),
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

    # 8. Migrate Rewards
    reward_count = 0
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

        tm_reward = clean_num(row["This month reward"], 0.0)
        exp_amt = clean_num(row["Reward will be expired"], 0.0)
        exp_date = parse_date(row["Expired date"])

        cur.execute(
            """
            INSERT INTO reward_ledgers (
                account_id, statement_id, reward_type, earned_this_month,
                expiring_amount, expiration_date
            ) VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (account_id, statement_id, reward_type) DO UPDATE SET
                earned_this_month = EXCLUDED.earned_this_month,
                expiring_amount = EXCLUDED.expiring_amount,
                expiration_date = EXCLUDED.expiration_date;
        """,
            (acc_id, stmt_id, r_type, tm_reward, exp_amt, exp_date),
        )
        reward_count += 1

    print(f"Migrated {reward_count} Reward Ledger records.")

    conn.commit()
    print("\nALL DATA MIGRATED SUCCESSFULLY TO POSTGRESQL ON DOCKER!")
finally:
    cur.close()
    conn.close()

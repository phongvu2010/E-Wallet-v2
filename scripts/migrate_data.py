import openpyxl, os, datetime, warnings
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


conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

print("Connected to Database. Starting migration...")

# 1. Map Institutions
cur.execute("SELECT code, id FROM institutions;")
inst_map = {row[0]: row[1] for row in cur.fetchall()}

# 2. Migrate Accounts
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

    replaces_id = None
    if "0642" in acc_num:
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
    else:
        limit_val = (
            40000000.0
            if inst_code == "SHINHAN"
            else (89600000.0 if inst_code == "HSBC" else 0.0)
        )
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

# 3. Map Categories
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

print(f"Migrated {len(statement_id_map)} Statements.")

# 6. Migrate Transactions
tx_count = 0
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
    merch_name = str(row["Merchant"]).strip() if not pd.isna(row["Merchant"]) else None
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

    cat_str = str(row["Category"]).strip()
    tx_type = "PURCHASE"
    if cat_det == "Trả góp":
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
    note = str(row["Note"]).strip() if not pd.isna(row["Note"]) else None

    if not raw_desc:
        if tx_type == "REPAYMENT":
            raw_desc = "Thanh toán thẻ / Payment"
        else:
            raw_desc = merch_name or "Giao dịch thẻ"

    cur.execute(
        """
        INSERT INTO transactions (
            account_id, statement_id, transaction_date, post_date, raw_description,
            merchant_id, category_id, transaction_type, original_currency, original_amount,
            foreign_fee, amount, fee, total_amount, note, is_installment
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """,
        (
            acc_id,
            stmt_id,
            t_date,
            p_date,
            raw_desc,
            merch_id,
            cat_id,
            tx_type,
            "VND",
            amt,
            fee,
            amt,
            fee,
            total_amt,
            note,
            (tx_type == "INSTALLMENT_MONTHLY"),
        ),
    )
    tx_count += 1

print(f"Migrated {tx_count} Transactions.")

# 7. Migrate Installment Plans
for _, row in df_instalments.iterrows():
    p_name = str(row["Production"]).strip()
    acc_num = str(row["Account Number"]).strip()
    acc_id = account_id_map.get(acc_num)
    t_date = parse_date(row["Transaction Date"])
    tot_amt = clean_num(row["Total Amount"])
    conv_fee = clean_num(row["Conversion Fee"])
    status_str = str(row["Status"]).strip()

    status = "COMPLETED" if "Hoàn thành" in status_str else "ACTIVE"

    term = 12
    if "3D Qidi" in p_name:
        term = 3
    elif "iPhone 14" in p_name:
        term = 9
    elif "Máy giặt LG" in p_name:
        term = 6

    m_payment = round(tot_amt / term, 2)

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
            m_payment,
            m_payment,
            0.0 if status == "COMPLETED" else tot_amt,
            status,
        ),
    )
    plan_id = cur.fetchone()[0]

    for i in range(1, term + 1):
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
                t_date + datetime.timedelta(days=30 * i),
                m_payment,
                m_payment,
                True,
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

print(f"Migrated {len(df_instalments)} Installment Plans.")

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
cur.close()
conn.close()
print("\nALL DATA MIGRATED SUCCESSFULLY TO POSTGRESQL ON DOCKER!")

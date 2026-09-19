"""Atomic Transaction Manager for SQLAlchemy AsyncSession.

Provides an enterprise-grade asynchronous context manager `atomic_transaction` that guarantees
ACID transactional boundaries (Atomicity, Consistency, Isolation, Durability).

Features:
1. Automatic Savepoint Management: Transparently uses `session.begin_nested()` if a transaction
   is already active, or `session.begin()` if starting a new top-level transaction.
2. Exception Mapping: Translates low-level SQLAlchemy exceptions (IntegrityError, DataError,
   ForeignKeyViolation, CheckViolation, UniqueViolation) into clean, user-friendly FastAPI HTTPExceptions.
3. Guaranteed Rollback: Rolls back the transaction / savepoint on any unhandled error before bubbling up.
"""

from contextlib import asynccontextmanager
import logging
import re
from typing import AsyncGenerator, Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import (
    DataError,
    IntegrityError,
    NoResultFound,
    OperationalError,
    SQLAlchemyError,
)
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def _format_db_error_detail(exc: Exception) -> str:
    """Extract a user-friendly Vietnamese error message from database exception details."""
    err_str = str(getattr(exc, "orig", exc))
    
    # 1. Unique constraint violation (Mã băm, tên trùng lặp)
    if "unique constraint" in err_str.lower() or "duplicate key" in err_str.lower():
        if "tx_fingerprint" in err_str:
            return "Giao dịch này đã tồn tại trong hệ thống (trùng lặp giao dịch)."
        if "uq_account_statement" in err_str:
            return "Kỳ sao kê cho tài khoản này vào ngày đã chọn đã tồn tại."
        if "cleaned_name" in err_str or "merchants_cleaned_name_key" in err_str:
            return "Đơn vị chấp nhận thẻ (Merchant) này đã tồn tại trong hệ thống."
        if "uq_plan_index" in err_str:
            return "Kỳ trả góp với chỉ số này đã tồn tại trong gói trả góp."
        if "code" in err_str and "institutions" in err_str:
            return "Mã định danh tổ chức tài chính/ngân hàng đã tồn tại."
        return "Dữ liệu bị trùng lặp với bản ghi đã tồn tại trong hệ thống."

    # 2. Foreign key violation (Không tìm thấy tài khoản/danh mục/ngân hàng cha)
    if "foreign key constraint" in err_str.lower() or "violates foreign key" in err_str.lower():
        if "account_id" in err_str:
            return "Tài khoản hoặc thẻ được chỉ định không tồn tại hoặc đã bị xóa."
        if "category_id" in err_str:
            return "Danh mục chi tiêu được chỉ định không tồn tại."
        if "merchant_id" in err_str:
            return "Đơn vị chấp nhận thẻ (Merchant) không tồn tại."
        if "institution_id" in err_str:
            return "Tổ chức tài chính/ngân hàng không tồn tại."
        if "statement_id" in err_str:
            return "Kỳ sao kê liên kết không tồn tại."
        return "Ràng buộc dữ liệu không hợp lệ: Bản ghi tham chiếu liên kết không tồn tại."

    # 3. Check constraint violation (Quy ước dấu, hạn mức âm, kỳ trả góp <= 0)
    if "check constraint" in err_str.lower() or "violates check constraint" in err_str.lower():
        if "chk_transactions_sign_convention" in err_str:
            return "Quy ước dấu số tiền không hợp lệ cho loại giao dịch này."
        if "chk_accounts_credit_limit" in err_str:
            return "Hạn mức tín dụng không được mang giá trị âm."
        if "chk_installment_total_amount" in err_str or "chk_installment_term_months" in err_str:
            return "Số tiền hoặc kỳ hạn gói trả góp không hợp lệ."
        if "chk_installment_remaining_balance" in err_str:
            return "Dư nợ gốc còn lại của gói trả góp không được âm."
        return "Dữ liệu không thỏa mãn quy tắc ràng buộc nghiệp vụ của hệ thống."

    # 4. Data error / Type cast error (Lỗi kiểu dữ liệu, tràn số)
    if "numeric value out of range" in err_str.lower():
        return "Giá trị số tiền vượt quá giới hạn cho phép của hệ thống."

    # Generic clean fallback
    clean_msg = re.sub(r"\[SQL:.*?\]", "", str(exc)).strip()
    return f"Lỗi thao tác cơ sở dữ liệu: {clean_msg}" if clean_msg else "Lỗi cơ sở dữ liệu không xác định."


@asynccontextmanager
async def atomic_transaction(
    session: AsyncSession,
    error_prefix: Optional[str] = None,
) -> AsyncGenerator[AsyncSession, None]:
    """Asynchronous context manager enforcing ACID transaction boundaries.

    Usage:
    ```python
    async with atomic_transaction(db, error_prefix="Không thể tạo giao dịch"):
        db.add(tx)
        # multi-step child additions or queries
        # auto-commits on outermost exit, auto-rolls back on any error
        # creates SAVEPOINT for nested service calls
    ```

    Args:
        session (AsyncSession): Active SQLAlchemy AsyncSession.
        error_prefix (Optional[str]): Optional descriptive prefix for error messages.

    Yields:
        AsyncSession: The active database session within the transaction boundary.

    Raises:
        HTTPException: Normalized HTTP error with 400/404/409 status code.
    """
    depth = session.info.get("_atomic_depth", 0) + 1
    session.info["_atomic_depth"] = depth

    try:
        if depth > 1:
            # Nested call: use SAVEPOINT for isolated sub-operation
            async with session.begin_nested():
                yield session
        else:
            # Top-level call: manage outermost transaction boundary and commit
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
    except HTTPException:
        # Re-raise FastAPI HTTPExceptions directly without mutating status code
        raise
    except NoResultFound as exc:
        msg = f"{error_prefix}: Bản ghi không tồn tại." if error_prefix else "Không tìm thấy dữ liệu yêu cầu."
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=msg,
        ) from exc
    except IntegrityError as exc:
        detail = _format_db_error_detail(exc)
        prefix_str = f"{error_prefix}: " if error_prefix else ""
        status_code = (
            status.HTTP_409_CONFLICT
            if "trùng lặp" in detail.lower() or "đã tồn tại" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(
            status_code=status_code,
            detail=f"{prefix_str}{detail}",
        ) from exc
    except (DataError, OperationalError, SQLAlchemyError) as exc:
        detail = _format_db_error_detail(exc)
        prefix_str = f"{error_prefix}: " if error_prefix else ""
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{prefix_str}{detail}",
        ) from exc
    except Exception as exc:
        # Unexpected non-database exceptions (e.g. ValueError, TypeError, AttributeError, bug code)
        # Log traceback and re-raise so FastAPI global_exception_handler cleanly returns HTTP 500
        prefix_str = f"{error_prefix}: " if error_prefix else ""
        logger.exception(
            f"[atomic_transaction] Unexpected error occurred ({prefix_str}): {exc}"
        )
        raise
    finally:
        session.info["_atomic_depth"] = depth - 1

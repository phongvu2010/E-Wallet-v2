import enum
import uuid

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class LoanTypeEnum(str, enum.Enum):
    MORTGAGE = "MORTGAGE"        # Vay mua nhà / Thế chấp bất động sản
    CONSUMER = "CONSUMER"        # Vay tiêu dùng cá nhân
    AUTO = "AUTO"                # Vay mua ô tô / phương tiện
    BUSINESS = "BUSINESS"        # Vay kinh doanh / sản xuất
    OVERDRAFT = "OVERDRAFT"      # Vay thấu chi tài khoản
    OTHER = "OTHER"              # Khoản vay khác


class InterestMethodEnum(str, enum.Enum):
    REDUCING_BALANCE = "REDUCING_BALANCE"    # Lãi theo dư nợ giảm dần (tiêu chuẩn ngân hàng)
    EQUAL_INSTALLMENT = "EQUAL_INSTALLMENT"  # Niên kim cố định (Gốc + Lãi trả đều mỗi kỳ)
    FLAT = "FLAT"                            # Lãi suất cố định trên dư nợ gốc ban đầu


class LoanStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"            # Đang hoạt động / Đang trả nợ
    PAID_OFF = "PAID_OFF"        # Đã tất toán hoàn tất
    OVERDUE = "OVERDUE"          # Có kỳ quá hạn thanh toán
    CANCELLED = "CANCELLED"      # Đã hủy hợp đồng vay


class LoanScheduleStatusEnum(str, enum.Enum):
    UNPAID = "UNPAID"            # Chưa thanh toán
    PAID = "PAID"                # Đã thanh toán
    OVERDUE = "OVERDUE"          # Quá hạn


class Loan(Base):
    __tablename__ = "loans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    institution_id = Column(
        UUID(as_uuid=True),
        ForeignKey("institutions.id", ondelete="SET NULL"),
        nullable=True,
    )
    loan_name = Column(String(150), nullable=False)
    loan_code = Column(String(50), nullable=True)
    loan_type = Column(
        Enum(LoanTypeEnum, name="loan_type_enum", create_type=False),
        nullable=False,
        default=LoanTypeEnum.MORTGAGE,
    )
    interest_method = Column(
        Enum(InterestMethodEnum, name="interest_method_enum", create_type=False),
        nullable=False,
        default=InterestMethodEnum.REDUCING_BALANCE,
    )
    principal_amount = Column(Numeric(15, 2), nullable=False)
    term_months = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    billing_day_of_month = Column(Integer, default=15, nullable=False)

    current_interest_rate = Column(Numeric(5, 2), nullable=False)  # %/năm (vd: 8.50%)
    base_rate = Column(Numeric(5, 2), default=0.00)                 # Lãi suất cơ sở tham chiếu (%/năm)
    floating_margin = Column(Numeric(5, 2), default=0.00)           # Biên độ thả nổi (%/năm)
    monthly_fee = Column(Numeric(15, 2), default=0.00)              # Phí dịch vụ / quản lý hàng tháng (VNĐ)

    remaining_principal = Column(Numeric(15, 2), nullable=False)
    total_paid_principal = Column(Numeric(15, 2), default=0.00)
    total_paid_interest = Column(Numeric(15, 2), default=0.00)
    total_projected_interest = Column(Numeric(15, 2), default=0.00)

    status = Column(
        Enum(LoanStatusEnum, name="loan_status_enum", create_type=False),
        default=LoanStatusEnum.ACTIVE,
        nullable=False,
    )
    note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    account = relationship("Account", backref="loans")
    institution = relationship("Institution", backref="loans")
    schedules = relationship(
        "LoanSchedule",
        back_populates="loan",
        cascade="all, delete-orphan",
        order_by="LoanSchedule.period_index",
    )
    rate_histories = relationship(
        "LoanRateHistory",
        back_populates="loan",
        cascade="all, delete-orphan",
        order_by="LoanRateHistory.created_at.desc()",
    )


class LoanSchedule(Base):
    __tablename__ = "loan_schedules"
    __table_args__ = (
        UniqueConstraint("loan_id", "period_index", name="uq_loan_period"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    period_index = Column(Integer, nullable=False)
    total_periods = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False)

    applied_interest_rate = Column(Numeric(5, 2), nullable=False)
    beginning_balance = Column(Numeric(15, 2), nullable=False)
    principal_amount = Column(Numeric(15, 2), nullable=False)
    interest_amount = Column(Numeric(15, 2), default=0.00, nullable=False)
    monthly_fee = Column(Numeric(15, 2), default=0.00, nullable=False)
    total_payment = Column(Numeric(15, 2), nullable=False)
    ending_balance = Column(Numeric(15, 2), nullable=False)

    status = Column(
        Enum(LoanScheduleStatusEnum, name="loan_schedule_status_enum", create_type=False),
        default=LoanScheduleStatusEnum.UNPAID,
        nullable=False,
    )
    paid_date = Column(Date, nullable=True)
    paid_amount = Column(Numeric(15, 2), nullable=True)
    transaction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    loan = relationship("Loan", back_populates="schedules")
    transaction = relationship("Transaction", backref="loan_schedule")


class LoanRateHistory(Base):
    __tablename__ = "loan_rate_histories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("loans.id", ondelete="CASCADE"),
        nullable=False,
    )
    old_rate = Column(Numeric(5, 2), nullable=False)
    new_rate = Column(Numeric(5, 2), nullable=False)
    old_monthly_fee = Column(Numeric(15, 2), default=0.00, nullable=False)
    new_monthly_fee = Column(Numeric(15, 2), default=0.00, nullable=False)
    effective_from_period = Column(Integer, nullable=False)
    effective_date = Column(Date, nullable=False)
    reason = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationships
    loan = relationship("Loan", back_populates="rate_histories")

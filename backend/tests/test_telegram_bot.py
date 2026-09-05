"""Unit tests for Telegram Bot Service, Webhook, and Natural Language Transaction Drafting."""

from decimal import Decimal
from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.account import Account
from app.models.notification import NotificationSettings
from app.models.transaction import Transaction, TransactionTypeEnum
from app.services.notification_service import NotificationService
from app.services.telegram_bot_service import TelegramBotService


@pytest.mark.asyncio
async def test_telegram_status_endpoint(client: AsyncClient):
    """Test GET /api/v1/telegram/status endpoint."""
    response = await client.get("/api/v1/telegram/status")
    assert response.status_code == 200
    data = response.json()
    assert "is_running" in data
    assert "polling_active" in data
    assert "active_drafts_count" in data


@pytest.mark.asyncio
async def test_telegram_reload_endpoint(client: AsyncClient):
    """Test POST /api/v1/telegram/reload endpoint."""
    response = await client.post("/api/v1/telegram/reload")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "status" in data


@pytest.mark.asyncio
async def test_telegram_webhook_endpoint(client: AsyncClient):
    """Test POST /api/v1/telegram/webhook receiver endpoint."""
    fake_update = {
        "update_id": 10001,
        "message": {
            "message_id": 1,
            "chat": {"id": 123456789},
            "from": {"id": 123456789, "first_name": "Tester"},
            "text": "/start",
        },
    }
    response = await client.post("/api/v1/telegram/webhook", json=fake_update)
    assert response.status_code == 200
    assert response.json() == {"ok": True}


@pytest.mark.asyncio
async def test_telegram_message_start_and_lookups(db_session: AsyncSession):
    """Test /start, /du_no, /tai_san, /sap_den_han, /chi_tieu handlers."""
    inst = TelegramBotService.get_instance()

    # Configure settings
    settings = await NotificationService.get_settings(db_session)
    settings.telegram_bot_token = "123456:FAKE_TOKEN"
    settings.telegram_chat_id = "999888777"
    settings.is_telegram_enabled = True
    await db_session.commit()

    with patch.object(NotificationService, "send_telegram_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"success": True}

        # 1. /start command
        msg_start = {
            "message_id": 101,
            "chat": {"id": 999888777},
            "from": {"id": 999888777},
            "text": "/start",
        }
        await inst._handle_message(db_session, "FAKE_TOKEN", settings, msg_start)
        assert mock_send.called
        call_text = mock_send.call_args[0][2]
        assert "Trợ Lý AI Tài Chính" in call_text
        mock_send.reset_mock()

        # 2. /du_no command
        msg_duno = {
            "message_id": 102,
            "chat": {"id": 999888777},
            "from": {"id": 999888777},
            "text": "/du_no",
        }
        await inst._handle_message(db_session, "FAKE_TOKEN", settings, msg_duno)
        assert mock_send.called
        call_text = mock_send.call_args[0][2]
        assert "DƯ NỢ & HẠN MỨC" in call_text
        mock_send.reset_mock()

        # 3. /tai_san command
        msg_taisan = {
            "message_id": 103,
            "chat": {"id": 999888777},
            "from": {"id": 999888777},
            "text": "/tai_san",
        }
        await inst._handle_message(db_session, "FAKE_TOKEN", settings, msg_taisan)
        assert mock_send.called
        call_text = mock_send.call_args[0][2]
        assert "NET WORTH" in call_text
        mock_send.reset_mock()

        # 4. /sap_den_han command
        msg_han = {
            "message_id": 104,
            "chat": {"id": 999888777},
            "from": {"id": 999888777},
            "text": "/sap_den_han",
        }
        await inst._handle_message(db_session, "FAKE_TOKEN", settings, msg_han)
        assert mock_send.called
        call_text = mock_send.call_args[0][2]
        assert "THANH TOÁN" in call_text or "Tuyệt vời" in call_text
        mock_send.reset_mock()

        # 5. /chi_tieu command
        msg_tieu = {
            "message_id": 105,
            "chat": {"id": 999888777},
            "from": {"id": 999888777},
            "text": "/chi_tieu",
        }
        await inst._handle_message(db_session, "FAKE_TOKEN", settings, msg_tieu)
        assert mock_send.called
        call_text = mock_send.call_args[0][2]
        assert "CHI TIÊU" in call_text


@pytest.mark.asyncio
async def test_telegram_unauthorized_user_blocked(db_session: AsyncSession):
    """Test that messages from unauthorized chat ID receive security notice and are blocked."""
    inst = TelegramBotService.get_instance()

    settings = await NotificationService.get_settings(db_session)
    settings.telegram_bot_token = "123456:FAKE_TOKEN"
    settings.telegram_chat_id = "111222333"  # Owner
    settings.is_telegram_enabled = True
    await db_session.commit()

    with patch.object(NotificationService, "send_telegram_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"success": True}

        # Intruder / stranger with different chat ID
        msg_stranger = {
            "message_id": 201,
            "chat": {"id": 999999999},
            "from": {"id": 999999999},
            "text": "Ăn trưa 50k tiền mặt",
        }
        await inst._handle_message(db_session, "FAKE_TOKEN", settings, msg_stranger)
        assert mock_send.called
        call_chat_id = mock_send.call_args[0][1]
        call_text = mock_send.call_args[0][2]
        assert call_chat_id == "999999999"
        assert "chưa được phân quyền" in call_text
        assert "999999999" in call_text


@pytest.mark.asyncio
async def test_telegram_transaction_draft_and_confirm_flow(db_session: AsyncSession):
    """Test end-to-end: Natural command -> Draft -> Inline Keyboard -> Callback confirm -> Transaction created in DB."""
    inst = TelegramBotService.get_instance()

    # Find an active account in DB
    acc_res = await db_session.execute(select(Account).where(Account.status == "ACTIVE").limit(1))
    account = acc_res.scalar_one_or_none()
    assert account is not None

    settings = await NotificationService.get_settings(db_session)
    settings.telegram_bot_token = "123456:FAKE_TOKEN"
    settings.telegram_chat_id = "555666777"
    settings.is_telegram_enabled = True
    await db_session.commit()

    with patch.object(NotificationService, "send_telegram_message", new_callable=AsyncMock) as mock_send, \
         patch.object(NotificationService, "answer_telegram_callback_query", new_callable=AsyncMock) as mock_answer, \
         patch.object(NotificationService, "edit_telegram_message", new_callable=AsyncMock) as mock_edit:

        mock_send.return_value = {"success": True}
        mock_answer.return_value = {"success": True}
        mock_edit.return_value = {"success": True}

        # 1. User sends natural command: "Ăn trưa 65k tiền mặt"
        msg_tx = {
            "message_id": 301,
            "chat": {"id": 555666777},
            "from": {"id": 555666777},
            "text": "Ăn trưa 65k tiền mặt",
        }
        await inst._handle_message(db_session, "FAKE_TOKEN", settings, msg_tx)

        # Verify bot sent confirmation card with inline keyboard
        assert mock_send.called
        sent_text = mock_send.call_args[0][2]
        reply_markup = mock_send.call_args[1].get("reply_markup") or mock_send.call_args[0][3] if len(mock_send.call_args[0]) > 3 else mock_send.call_args[1].get("reply_markup")
        assert "XÁC NHẬN GIAO DỊCH MỚI" in sent_text
        assert "65,000 VNĐ" in sent_text
        assert reply_markup is not None
        assert "inline_keyboard" in reply_markup

        confirm_btn = reply_markup["inline_keyboard"][0][0]
        assert "confirm_tx:" in confirm_btn["callback_data"]
        draft_id = confirm_btn["callback_data"].split(":", 1)[1]

        # Verify draft is in cache
        cached = inst._get_draft(draft_id)
        assert cached is not None
        assert cached["draft"].amount == Decimal("65000")

        # 2. User taps [✅ Xác nhận Ghi Sổ]
        callback_query = {
            "id": "cb_query_123",
            "data": f"confirm_tx:{draft_id}",
            "from": {"id": 555666777},
            "message": {
                "message_id": 302,
                "chat": {"id": 555666777},
            },
        }
        await inst._handle_callback_query(db_session, "FAKE_TOKEN", settings, callback_query)

        # Verify answer callback and message edit
        assert mock_answer.called
        assert mock_edit.called
        edited_text = mock_edit.call_args[0][3]
        assert "ĐÃ GHI SỔ CÁI THÀNH CÔNG" in edited_text
        assert "65,000 VNĐ" in edited_text

        # Verify draft removed from cache
        assert inst._get_draft(draft_id) is None

        # Verify transaction actually exists in database
        find_tx = await db_session.execute(
            select(Transaction).where(
                Transaction.amount == Decimal("65000"),
                Transaction.raw_description.ilike("%Ăn trưa%"),
            )
        )
        saved_tx = find_tx.scalar_one_or_none()
        assert saved_tx is not None
        assert saved_tx.total_amount == Decimal("65000")


@pytest.mark.asyncio
async def test_telegram_transaction_cancel_flow(db_session: AsyncSession):
    """Test canceling a transaction draft via [❌ Hủy bỏ] button."""
    inst = TelegramBotService.get_instance()

    settings = await NotificationService.get_settings(db_session)
    settings.telegram_bot_token = "123456:FAKE_TOKEN"
    settings.telegram_chat_id = "555666777"
    settings.is_telegram_enabled = True
    await db_session.commit()

    with patch.object(NotificationService, "send_telegram_message", new_callable=AsyncMock) as mock_send, \
         patch.object(NotificationService, "answer_telegram_callback_query", new_callable=AsyncMock) as mock_answer, \
         patch.object(NotificationService, "edit_telegram_message", new_callable=AsyncMock) as mock_edit:

        mock_send.return_value = {"success": True}
        mock_answer.return_value = {"success": True}
        mock_edit.return_value = {"success": True}

        # User sends natural command
        msg_tx = {
            "message_id": 401,
            "chat": {"id": 555666777},
            "from": {"id": 555666777},
            "text": "Mua cafe 45k",
        }
        await inst._handle_message(db_session, "FAKE_TOKEN", settings, msg_tx)

        # Find draft id
        reply_markup = mock_send.call_args[1].get("reply_markup") or mock_send.call_args[0][3] if len(mock_send.call_args[0]) > 3 else mock_send.call_args[1].get("reply_markup")
        cancel_btn = reply_markup["inline_keyboard"][0][1]
        draft_id = cancel_btn["callback_data"].split(":", 1)[1]

        # Tap cancel button
        callback_query = {
            "id": "cb_query_456",
            "data": f"cancel_tx:{draft_id}",
            "from": {"id": 555666777},
            "message": {
                "message_id": 402,
                "chat": {"id": 555666777},
            },
        }
        await inst._handle_callback_query(db_session, "FAKE_TOKEN", settings, callback_query)

        assert mock_answer.called
        assert mock_edit.called
        edited_text = mock_edit.call_args[0][3]
        assert "ĐÃ HỦY GIAO DỊCH NHÁP" in edited_text
        assert inst._get_draft(draft_id) is None

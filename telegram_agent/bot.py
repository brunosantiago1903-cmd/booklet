"""Telegram bot — bridges Telegram messages to the Claude agent."""
import asyncio
import logging
import threading
from collections import defaultdict
from typing import Any

from telegram import Update, BotCommand
from telegram.constants import ChatAction, ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from .agent import run_agent
from .config import config

logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# Per-user conversation history and locks
_histories: dict[int, list[dict]] = defaultdict(list)
_locks: dict[int, threading.Lock] = defaultdict(threading.Lock)


# ---------------------------------------------------------------------------
# Access control
# ---------------------------------------------------------------------------

def _is_allowed(user_id: int) -> bool:
    if not config.allowed_user_ids:
        return True  # Open to all if no whitelist configured
    return user_id in config.allowed_user_ids


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _send_long_message(update: Update, text: str) -> None:
    """Split messages that exceed Telegram's 4096-char limit."""
    max_len = 4000
    if len(text) <= max_len:
        await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)
        return

    chunks = [text[i : i + max_len] for i in range(0, len(text), max_len)]
    for chunk in chunks:
        await update.message.reply_text(chunk, parse_mode=ParseMode.MARKDOWN)


def _format_tool_notification(tool_name: str, tool_input: dict) -> str:
    """Human-readable notification when Claude uses a tool."""
    labels = {
        "bash": f"⚙️ Executando: `{tool_input.get('command', '')[:80]}`",
        "read_file": f"📖 Lendo arquivo: `{tool_input.get('path', '')}`",
        "write_file": f"✏️ Escrevendo arquivo: `{tool_input.get('path', '')}`",
        "list_directory": f"📁 Listando: `{tool_input.get('path', '') or '.'}`",
        "web_search": f"🔍 Buscando: `{tool_input.get('query', '')}`",
    }
    return labels.get(tool_name, f"🔧 Usando ferramenta: `{tool_name}`")


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not _is_allowed(user.id):
        await update.message.reply_text("⛔ Acesso não autorizado.")
        return

    await update.message.reply_text(
        f"Olá, *{user.first_name}*! 👋\n\n"
        "Sou um agente inteligente powered by Claude. Posso:\n"
        "• Executar comandos shell\n"
        "• Ler e escrever arquivos\n"
        "• Buscar informações na web\n"
        "• Responder perguntas e analisar dados\n\n"
        "Basta me enviar o que precisa fazer!\n\n"
        "Comandos disponíveis:\n"
        "/start — apresentação\n"
        "/clear — limpar histórico da conversa\n"
        "/history — ver resumo do histórico\n"
        "/status — status do agente",
        parse_mode=ParseMode.MARKDOWN,
    )


async def clear(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not _is_allowed(user.id):
        await update.message.reply_text("⛔ Acesso não autorizado.")
        return

    _histories[user.id].clear()
    await update.message.reply_text("🗑️ Histórico da conversa limpo!")


async def history(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not _is_allowed(user.id):
        await update.message.reply_text("⛔ Acesso não autorizado.")
        return

    msgs = _histories[user.id]
    if not msgs:
        await update.message.reply_text("Nenhum histórico ainda.")
        return

    count = len(msgs)
    user_turns = sum(1 for m in msgs if m["role"] == "user")
    await update.message.reply_text(
        f"📊 *Histórico atual*\n"
        f"• Total de mensagens: {count}\n"
        f"• Turnos do usuário: {user_turns}\n"
        f"• Turnos do assistente: {count - user_turns}\n\n"
        "Use /clear para resetar.",
        parse_mode=ParseMode.MARKDOWN,
    )


async def status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not _is_allowed(user.id):
        await update.message.reply_text("⛔ Acesso não autorizado.")
        return

    await update.message.reply_text(
        f"🤖 *Status do Agente*\n"
        f"• Modelo: `{config.model}`\n"
        f"• Diretório de trabalho: `{config.working_dir}`\n"
        f"• Máximo de turnos: {config.max_turns}\n"
        f"• Lista de usuários: {'configurada' if config.allowed_user_ids else 'aberta'}",
        parse_mode=ParseMode.MARKDOWN,
    )


# ---------------------------------------------------------------------------
# Message handler
# ---------------------------------------------------------------------------

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not _is_allowed(user.id):
        await update.message.reply_text("⛔ Acesso não autorizado.")
        return

    user_text = update.message.text or update.message.caption or ""
    if not user_text.strip():
        return

    lock = _locks[user.id]
    if not lock.acquire(blocking=False):
        await update.message.reply_text("⏳ Ainda processando sua mensagem anterior, aguarde...")
        return

    # Status messages sent during tool use
    status_messages: list[Any] = []

    async def notify_tool(tool_name: str, tool_input: dict) -> None:
        notification = _format_tool_notification(tool_name, tool_input)
        msg = await update.message.reply_text(notification, parse_mode=ParseMode.MARKDOWN)
        status_messages.append(msg)

    try:
        await context.bot.send_chat_action(update.effective_chat.id, ChatAction.TYPING)

        history_for_user = _histories[user.id]

        # We need to bridge async Telegram callbacks with the sync agent.
        # Run the agent in a thread executor so we don't block the event loop.
        loop = asyncio.get_running_loop()

        # Collect tool notifications to fire asynchronously
        pending_notifications: list[tuple[str, dict]] = []

        def on_tool_use(name: str, inp: dict) -> None:
            pending_notifications.append((name, inp))

        def run_sync() -> tuple[str, list]:
            return run_agent(user_text, history_for_user, on_tool_use=on_tool_use)

        # Run agent in thread, poll for tool notifications in main loop
        future = loop.run_in_executor(None, run_sync)

        last_notified = 0
        while not future.done():
            if len(pending_notifications) > last_notified:
                for tool_name, tool_input in pending_notifications[last_notified:]:
                    await notify_tool(tool_name, tool_input)
                last_notified = len(pending_notifications)
            await asyncio.sleep(0.3)
            await context.bot.send_chat_action(update.effective_chat.id, ChatAction.TYPING)

        # Drain any remaining notifications
        for tool_name, tool_input in pending_notifications[last_notified:]:
            await notify_tool(tool_name, tool_input)

        reply_text, updated_history = await future
        _histories[user.id] = updated_history

        # Delete tool-use status messages to keep chat clean
        for msg in status_messages:
            try:
                await msg.delete()
            except Exception:
                pass

        await _send_long_message(update, reply_text)

    except Exception as e:
        logger.exception("Error handling message from user %s", user.id)
        await update.message.reply_text(
            f"❌ Ocorreu um erro: {e}\n\nTente novamente ou use /clear para resetar."
        )
    finally:
        lock.release()


# ---------------------------------------------------------------------------
# Bot startup
# ---------------------------------------------------------------------------

def run_bot() -> None:
    """Start the Telegram bot (blocking)."""
    app = (
        Application.builder()
        .token(config.telegram_token)
        .build()
    )

    # Register commands
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("clear", clear))
    app.add_handler(CommandHandler("history", history))
    app.add_handler(CommandHandler("status", status))
    app.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )

    # Set bot command menu
    async def post_init(app: Application) -> None:
        await app.bot.set_my_commands(
            [
                BotCommand("start", "Apresentação e ajuda"),
                BotCommand("clear", "Limpar histórico da conversa"),
                BotCommand("history", "Ver resumo do histórico"),
                BotCommand("status", "Status do agente"),
            ]
        )

    app.post_init = post_init

    logger.info("Bot iniciado. Pressione Ctrl+C para parar.")
    app.run_polling(drop_pending_updates=True)

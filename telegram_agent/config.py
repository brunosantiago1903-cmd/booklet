"""Configuration for the Telegram Agent bot."""
import os
from dataclasses import dataclass, field


@dataclass
class Config:
    telegram_token: str = field(default_factory=lambda: os.environ["TELEGRAM_BOT_TOKEN"])
    anthropic_api_key: str = field(default_factory=lambda: os.environ["ANTHROPIC_API_KEY"])
    allowed_user_ids: list[int] = field(default_factory=list)
    model: str = "claude-opus-4-6"
    max_tokens: int = 4096
    max_turns: int = 20
    working_dir: str = field(default_factory=lambda: os.getcwd())

    def __post_init__(self):
        raw = os.environ.get("ALLOWED_USER_IDS", "")
        if raw:
            self.allowed_user_ids = [int(uid.strip()) for uid in raw.split(",") if uid.strip()]


config = Config()

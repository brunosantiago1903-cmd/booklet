"""Claude agent core — executes tasks using the Anthropic API with tool use."""
import json
import subprocess
import os
import anthropic
from typing import Any

from .config import config

# ---------------------------------------------------------------------------
# Tool definitions (tools Claude can call)
# ---------------------------------------------------------------------------

TOOLS: list[dict] = [
    {
        "name": "bash",
        "description": (
            "Run a shell command and return its output. "
            "Use for file system operations, running scripts, checking system status, etc. "
            "Commands run in the configured working directory."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to execute.",
                },
                "timeout": {
                    "type": "integer",
                    "description": "Timeout in seconds (default 30, max 120).",
                },
            },
            "required": ["command"],
        },
    },
    {
        "name": "read_file",
        "description": "Read the contents of a file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path to the file to read."},
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "Write content to a file, creating it if it doesn't exist.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Path to the file."},
                "content": {"type": "string", "description": "Content to write."},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "list_directory",
        "description": "List files and directories at a given path.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Directory path (defaults to working directory).",
                },
            },
            "required": [],
        },
    },
    {
        "name": "web_search",
        "description": "Search the web for up-to-date information.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query."},
            },
            "required": ["query"],
        },
    },
]

SYSTEM_PROMPT = """Você é um assistente inteligente acessível via Telegram, capaz de executar tarefas reais.

Suas capacidades:
- Executar comandos shell (bash)
- Ler e escrever arquivos
- Listar diretórios
- Buscar informações na web
- Responder perguntas e realizar análises

Diretrizes:
- Seja direto e objetivo nas respostas
- Para tarefas de execução, mostre o resultado claramente
- Em caso de erro, explique o que aconteceu e sugira alternativas
- Use markdown quando útil (Telegram suporta markdown básico)
- Responda sempre em português do Brasil, a menos que o usuário escreva em outro idioma
"""


# ---------------------------------------------------------------------------
# Tool execution
# ---------------------------------------------------------------------------

def _run_bash(command: str, timeout: int = 30) -> str:
    timeout = min(int(timeout), 120)
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=config.working_dir,
        )
        output = result.stdout
        if result.stderr:
            output += f"\n[stderr]\n{result.stderr}"
        return output.strip() or "(sem saída)"
    except subprocess.TimeoutExpired:
        return f"Erro: comando excedeu o tempo limite de {timeout}s."
    except Exception as e:
        return f"Erro ao executar comando: {e}"


def _read_file(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return f"Erro: arquivo não encontrado: {path}"
    except Exception as e:
        return f"Erro ao ler arquivo: {e}"


def _write_file(path: str, content: str) -> str:
    try:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Arquivo salvo: {path}"
    except Exception as e:
        return f"Erro ao escrever arquivo: {e}"


def _list_directory(path: str = "") -> str:
    target = path if path else config.working_dir
    try:
        entries = os.listdir(target)
        entries.sort()
        lines = []
        for entry in entries:
            full = os.path.join(target, entry)
            marker = "/" if os.path.isdir(full) else ""
            lines.append(f"{entry}{marker}")
        return "\n".join(lines) if lines else "(diretório vazio)"
    except FileNotFoundError:
        return f"Erro: diretório não encontrado: {target}"
    except Exception as e:
        return f"Erro ao listar diretório: {e}"


def _web_search(query: str) -> str:
    # Basic DuckDuckGo instant answer via API (no key required)
    import urllib.request
    import urllib.parse

    url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}&format=json&no_redirect=1"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        abstract = data.get("AbstractText", "")
        answer = data.get("Answer", "")
        related = [r.get("Text", "") for r in data.get("RelatedTopics", [])[:3] if r.get("Text")]
        parts = []
        if answer:
            parts.append(f"Resposta direta: {answer}")
        if abstract:
            parts.append(abstract)
        if related:
            parts.append("Tópicos relacionados:\n" + "\n".join(f"- {r}" for r in related))
        return "\n\n".join(parts) if parts else "Nenhum resultado encontrado."
    except Exception as e:
        return f"Erro na busca: {e}"


def execute_tool(name: str, tool_input: dict[str, Any]) -> str:
    """Dispatch tool calls to their implementations."""
    if name == "bash":
        return _run_bash(tool_input["command"], tool_input.get("timeout", 30))
    if name == "read_file":
        return _read_file(tool_input["path"])
    if name == "write_file":
        return _write_file(tool_input["path"], tool_input["content"])
    if name == "list_directory":
        return _list_directory(tool_input.get("path", ""))
    if name == "web_search":
        return _web_search(tool_input["query"])
    return f"Ferramenta desconhecida: {name}"


# ---------------------------------------------------------------------------
# Agent runner
# ---------------------------------------------------------------------------

def run_agent(
    user_message: str,
    conversation_history: list[dict],
    on_tool_use: "callable[[str, dict], None] | None" = None,
) -> tuple[str, list[dict]]:
    """
    Run the Claude agent for one user turn.

    Args:
        user_message: The user's latest message.
        conversation_history: Prior messages in this conversation (mutated in place).
        on_tool_use: Optional callback called when Claude invokes a tool —
                     receives (tool_name, tool_input).

    Returns:
        (final_text, updated_conversation_history)
    """
    client = anthropic.Anthropic(api_key=config.anthropic_api_key)

    # Append the new user message
    conversation_history.append({"role": "user", "content": user_message})

    turns = 0
    while turns < config.max_turns:
        turns += 1

        with client.messages.stream(
            model=config.model,
            max_tokens=config.max_tokens,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=conversation_history,
            thinking={"type": "adaptive"},
        ) as stream:
            response = stream.get_final_message()

        # Add assistant response to history
        conversation_history.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            # Extract final text response
            text_blocks = [b.text for b in response.content if b.type == "text"]
            return "\n".join(text_blocks), conversation_history

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue

                if on_tool_use:
                    on_tool_use(block.name, block.input)

                result = execute_tool(block.name, block.input)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    }
                )

            conversation_history.append({"role": "user", "content": tool_results})
            continue

        # Unexpected stop reason
        break

    return "Desculpe, atingi o limite de ações para esta tarefa.", conversation_history

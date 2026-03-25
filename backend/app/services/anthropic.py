import anthropic
from app.config import get_settings

settings = get_settings()


def get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


async def generate(
    system_prompt: str,
    user_prompt: str,
    model: str = "claude-sonnet-4-20250514",
    max_tokens: int = 16000,
) -> str:
    """Generate content with Claude (for meeting minutes etc.)"""
    client = get_client()
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return response.content[0].text


async def chat(
    system_prompt: str,
    messages: list[dict],
    model: str = "claude-sonnet-4-20250514",
    max_tokens: int = 4000,
) -> str:
    """Multi-turn chat with Claude (Ask the Transcript)."""
    client = get_client()
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=messages,
    )
    return response.content[0].text


async def refine(text: str, instruction: str) -> str:
    """Refine a passage of text using Claude Haiku (fast, inline edits)."""
    client = get_client()
    response = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=4000,
        system="You are a helpful editor. Refine the text according to the user's instruction. Output only the refined text, no quotes or preamble.",
        messages=[
            {
                "role": "user",
                "content": f'Text: "{text}"\n\nInstruction: {instruction}',
            }
        ],
    )
    return response.content[0].text

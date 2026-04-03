import asyncio
import httpx

from app.config import GROQ_API_KEY
from app.utils.chunking_utils import chunk_text_by_tokens

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"


def _chunk_transcript(transcript: str, max_tokens: int = 700, overlap_tokens: int = 100) -> list[str]:
    return chunk_text_by_tokens(transcript, max_tokens=max_tokens, overlap_tokens=overlap_tokens)


semaphore = asyncio.Semaphore(3)


async def safe_groq_call(system_prompt: str, user_prompt: str, max_tokens: int = 2048, retries: int = 3) -> str:
    delay = 1
    for attempt in range(retries):
        try:
            return await _call_groq(system_prompt, user_prompt, max_tokens)
        except Exception as e:
            if attempt == retries - 1:
                raise e
            await asyncio.sleep(delay)
            delay *= 2


async def _call_groq(system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> str:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
                "max_tokens": max_tokens,
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Groq API error: {response.status_code} - {response.text}")

        return response.json()["choices"][0]["message"]["content"]


async def summarize_chunk(chunk: str, prompt: str) -> str:
    async with semaphore:
        return await safe_groq_call(
            "You are a concise academic summarizer.",
            f"{prompt}\n\nTEXT:\n{chunk}",
            max_tokens=1024,
        )


async def summarize_chunks(chunks: list[str], prompt: str) -> list[str]:
    tasks = [summarize_chunk(chunk, prompt) for chunk in chunks]
    return await asyncio.gather(*tasks)


async def merge_summaries(partials: list[str], prompt: str) -> str:
    combined = "\n\n".join([part for part in partials if part])
    result = await safe_groq_call(
        "You are an expert academic summarizer.",
        f"{prompt}\n\nCONTENT:\n{combined}",
        max_tokens=2048,
    )
    return result or ""


async def generate_summary(transcript: str, format_type: str = "detailed") -> str:
    prompts = {
        "short": "Summarize briefly in 3-5 sentences.",
        "bullet": "Summarize in bullet points.",
        "detailed": "Create a structured academic summary with headings.",
        "exam": "Create exam-focused notes.",
        "concept": "Create a concept-based summary.",
    }

    prompt = prompts.get(format_type, prompts["detailed"])
    chunks = _chunk_transcript(transcript, max_tokens=700, overlap_tokens=100)

    if not chunks:
        return ""

    if len(chunks) == 1:
        return await summarize_chunk(chunks[0], prompt) or ""

    partials = await summarize_chunks(chunks, prompt)
    final = await merge_summaries([partial for partial in partials if partial], prompt)
    return final or ""

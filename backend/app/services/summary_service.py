import httpx
from app.config import GROQ_API_KEY


async def generate_summary(transcript: str) -> str:
    """
    Send transcript to Groq API and return a structured summary
    with bullet notes and key topics.
    """
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set")

    prompt = f"""You are an expert academic assistant. Analyze the following lecture transcript and generate a comprehensive, structured summary.

Your response MUST follow this exact format:

## 📋 Overview
A 2-3 sentence overview of what the lecture covers.

## 🎯 Key Topics
- Topic 1
- Topic 2
- Topic 3
(list all major topics discussed)

## 📝 Detailed Summary

### [Topic 1 Name]
- Key point 1
- Key point 2
- Key point 3

### [Topic 2 Name]
- Key point 1
- Key point 2
- Key point 3

(Continue for each major topic)

## 💡 Key Takeaways
1. Most important takeaway
2. Second most important
3. Third most important

## 📚 Important Terms & Definitions
- **Term 1**: Definition
- **Term 2**: Definition

---

TRANSCRIPT:
{transcript}
"""

    messages = [
        {
            "role": "system",
            "content": "You are an expert academic assistant that creates structured lecture summaries.",
        },
        {
            "role": "user",
            "content": prompt,
        },
    ]

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.1-8b-instant",
                "messages": messages,
                "temperature": 0.3,
                "max_tokens": 4096,
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Groq API error: {response.status_code} - {response.text}")

        data = response.json()
        return data["choices"][0]["message"]["content"]

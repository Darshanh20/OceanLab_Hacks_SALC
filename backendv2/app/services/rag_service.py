import asyncio
import httpx
from app.config import COHERE_API_KEY, GROQ_API_KEY
from app.services.supabase_client import get_supabase
from app.utils.chunking_utils import chunk_text_by_tokens

COHERE_EMBED_URL = "https://api.cohere.com/v2/embed"
COHERE_MODEL = "embed-english-v3.0"  # 1024 dimensions


def chunk_transcript(transcript: str, max_tokens: int = 700, overlap_tokens: int = 100) -> list[str]:
    """Split transcript into overlapping chunks using the shared utility."""
    return chunk_text_by_tokens(transcript, max_tokens=max_tokens, overlap_tokens=overlap_tokens)


async def _cohere_embed(texts: list[str], input_type: str = "search_document") -> list[list[float]]:
    """
    Generate embeddings using Cohere Embed API.
    embed-english-v3.0 produces 1024-dimensional vectors.
    Free tier: 100 calls/min, 1000 calls/month.
    """
    if not COHERE_API_KEY:
        raise RuntimeError("COHERE_API_KEY is not set")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            COHERE_EMBED_URL,
            headers={
                "Authorization": f"Bearer {COHERE_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": COHERE_MODEL,
                "texts": texts,
                "input_type": input_type,
                "embedding_types": ["float"],
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Cohere Embed API error: {response.status_code} - {response.text}")

        data = response.json()
        return data["embeddings"]["float"]


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings using Cohere in batches.
    Cohere supports up to 96 texts per request.
    """
    embeddings = []
    batch_size = 96

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        batch_embeddings = await _cohere_embed(batch, "search_document")
        embeddings.extend(batch_embeddings)
        # Small delay between batches
        if i + batch_size < len(texts):
            await asyncio.sleep(1)

    return embeddings


async def generate_query_embedding(query: str) -> list[float]:
    """Generate embedding for a user query using Cohere."""
    result = await _cohere_embed([query], "search_query")
    return result[0]


async def process_lecture_for_rag(lecture_id: str, transcript: str):
    """
    Full RAG processing pipeline:
    1. Chunk transcript
    2. Generate embeddings (Cohere)
    3. Store in lecture_chunks table
    """
    supabase = get_supabase()

    # Step 1: Chunk
    chunks = chunk_transcript(transcript)

    if not chunks:
        return

    # Step 2: Generate embeddings
    embeddings = await generate_embeddings(chunks)

    # Step 3: Store chunks + embeddings
    rows = []
    for chunk_text, embedding in zip(chunks, embeddings):
        rows.append({
            "lecture_id": lecture_id,
            "chunk_text": chunk_text,
            "embedding": embedding,
        })

    # Insert in batches
    batch_size = 20
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        supabase.table("lecture_chunks").insert(batch).execute()


async def retrieve_relevant_chunks(lecture_id: str, question: str, top_k: int = 5) -> list[str]:
    """
    Perform similarity search to find the most relevant chunks.
    """
    supabase = get_supabase()
    query_embedding = await generate_query_embedding(question)

    result = supabase.rpc(
        "match_lecture_chunks",
        {
            "query_embedding": query_embedding,
            "match_lecture_id": lecture_id,
            "match_count": top_k,
        },
    ).execute()

    if not result.data:
        return []

    return [row["chunk_text"] for row in result.data]


async def generate_answer(question: str, context_chunks: list[str]) -> str:
    """Generate answer using Groq API with relevant context."""
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set")

    labeled_chunks = [f"[Source {index + 1}]\n{chunk}" for index, chunk in enumerate(context_chunks)]
    context = "\n\n---\n\n".join(labeled_chunks)

    messages = [
        {
            "role": "system",
            "content": """You are an expert academic assistant helping students understand lecture content.
Answer questions based ONLY on the provided lecture context.
If the answer cannot be found in the context, say so clearly.
Provide a clear answer, then add a short evidence section citing the source labels you used.

STRICT RULES:
- Use proper markdown headings (#, ##, ###)
- DO NOT use ** for headings
- Use bullet points (-) when useful
- Keep clean spacing
- Reference source labels exactly as written, e.g. [Source 1]
""",
        },
        {
            "role": "user",
            "content": f"""Based on the following lecture excerpts, answer the question.

LECTURE CONTEXT:
{context}

QUESTION: {question}

Provide a comprehensive answer based on the lecture content above.
At the end, include a short 'Evidence' section with the most relevant source labels and what they support.""",
        },
    ]

    async with httpx.AsyncClient(timeout=60.0) as client:
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
                "max_tokens": 2048,
            },
        )

        if response.status_code != 200:
            raise RuntimeError(f"Groq API error: {response.status_code} - {response.text}")

        data = response.json()
        return data["choices"][0]["message"]["content"]


async def answer_question(lecture_id: str, question: str) -> tuple[str, list[str]]:
    """
    Full RAG pipeline:
    1. Retrieve relevant chunks (Cohere embeddings + pgvector)
    2. Generate answer (Groq)
    """
    chunks = await retrieve_relevant_chunks(lecture_id, question)

    if not chunks:
        # Fallback: use the full transcript if no chunks found
        supabase = get_supabase()
        result = supabase.table("lectures").select("transcript_text").eq("id", lecture_id).execute()
        if result.data and result.data[0].get("transcript_text"):
            transcript = result.data[0]["transcript_text"]
            try:
                answer = await generate_answer(question, [transcript])
                return answer, ["[Transcript] Full transcript fallback used"]
            except Exception as e:
                return f"Sorry, I encountered an error: {str(e)}", []
        return "I couldn't find relevant information in this lecture.", []

    try:
        answer = await generate_answer(question, chunks)
    except Exception as e:
        return f"Sorry, I encountered an error: {str(e)}", chunks

    sources = [f"[Source {index + 1}] {chunk[:240].strip()}" for index, chunk in enumerate(chunks)]
    return answer, sources

"""
RAG chat service.

Resolves a question against lecture chunks and generates an answer.
"""

from typing import List, Tuple

from app.services.rag_service import answer_question


async def answer_lecture_question(lecture_id: str, question: str) -> Tuple[str, List[str]]:
    """Answer a question using lecture-specific RAG retrieval."""
    cleaned_question = (question or "").strip()
    if not cleaned_question:
        raise ValueError("Question cannot be empty")

    return await answer_question(lecture_id, cleaned_question)

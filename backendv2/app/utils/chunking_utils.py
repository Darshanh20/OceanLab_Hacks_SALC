"""
Shared token chunking utilities.

Used by AI pipelines so transcript chunking stays consistent across
summary, action plan, insights, and RAG flows.
"""

from __future__ import annotations

from typing import List

import tiktoken


DEFAULT_MAX_TOKENS = 700
DEFAULT_OVERLAP_TOKENS = 100


def _get_encoder() -> tiktoken.Encoding:
    return tiktoken.get_encoding("cl100k_base")


def _trim_to_sentence_boundary(text: str) -> str:
    if not text:
        return ""

    boundary = max(text.rfind(". "), text.rfind("? "), text.rfind("! "), text.rfind("\n"))
    if boundary >= max(0, len(text) - 220):
        return text[: boundary + 1].strip()
    return text.strip()


def chunk_text_by_tokens(
    text: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    overlap_tokens: int = DEFAULT_OVERLAP_TOKENS,
    preserve_sentence_boundaries: bool = True,
) -> List[str]:
    """
    Split text into overlapping token chunks.

    The default window matches the AI-layer execution plan:
    500-800 tokens with 100 token overlap.
    """
    if not text or not text.strip():
        return []

    encoder = _get_encoder()
    tokens = encoder.encode(text)
    if not tokens:
        return []

    chunks: List[str] = []
    start = 0
    step = max(1, max_tokens - overlap_tokens)

    while start < len(tokens):
        end = min(start + max_tokens, len(tokens))
        decoded = encoder.decode(tokens[start:end]).strip()

        if preserve_sentence_boundaries and end < len(tokens):
            trimmed = _trim_to_sentence_boundary(decoded)
            if trimmed and trimmed != decoded:
                trimmed_tokens = encoder.encode(trimmed)
                if 0 < len(trimmed_tokens) <= (end - start):
                    end = start + len(trimmed_tokens)
                    decoded = trimmed

        if decoded:
            chunks.append(decoded)

        if end >= len(tokens):
            break

        start = max(start + step, end - overlap_tokens)

    return [chunk for chunk in chunks if chunk.strip()]

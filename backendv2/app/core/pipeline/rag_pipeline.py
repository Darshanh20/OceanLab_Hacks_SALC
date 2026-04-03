"""
RAG (Retrieval-Augmented Generation) pipeline.

Chunks transcript and generates embeddings for semantic search.
"""

from app.services.db.lecture_repo import get_lecture, update_lecture_status
from app.services.rag_service import (
    chunk_transcript,
    generate_embeddings,
)
from app.services.db.chunk_repo import insert_chunks


async def run_rag_pipeline(lecture_id: str) -> dict:
    """
    Generate embeddings for semantic search.
    
    Steps:
    1. Get lecture from DB
    2. Chunk transcript
    3. Generate embeddings via Cohere
    4. Store chunks + embeddings
    5. Update status
    """
    try:
        # 1. Get lecture
        lecture = get_lecture(lecture_id)
        
        if not lecture or not lecture.get("transcript_text"):
            raise ValueError("Lecture not found or missing transcript_text")
        
        update_lecture_status(lecture_id, "processing_rag")
        
        # 2. Chunk transcript
        chunks = chunk_transcript(lecture["transcript_text"])
        
        if not chunks:
            raise ValueError("No chunks generated from transcript")
        
        # 3. Generate embeddings
        embeddings = await generate_embeddings(chunks)
        
        # 4. Prepare and insert chunks
        chunk_rows = []
        for chunk, embedding in zip(chunks, embeddings):
            chunk_rows.append({
                "lecture_id": lecture_id,
                "chunk_text": chunk,
                "embedding": embedding,
            })
        
        insert_chunks(chunk_rows)
        
        # 5. Update status
        update_lecture_status(lecture_id, "processing_rag")
        
        return {
            "lecture_id": lecture_id,
            "status": "rag_processed",
            "chunks_count": len(chunks),
            "embeddings_generated": len(embeddings)
        }
    
    except Exception as e:
        update_lecture_status(lecture_id, "failed")
        raise Exception(f"RAG pipeline failed: {str(e)}")

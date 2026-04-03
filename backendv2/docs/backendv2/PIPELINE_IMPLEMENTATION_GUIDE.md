# Backend v2 Pipeline Implementation Guide

## Overview

Production-ready backend v2 implements a **pipeline-driven architecture** for content ingestion and AI processing. This replaces the previous layer-first approach (routers → services) with a feature-first, pipeline-orchestrated design.

## Architecture Diagram

```
INPUT FILE (audio/video/document/transcript)
    ↓
[Ingestion Pipeline] (detect_input_type + route to ingestor)
    ↓
[Audio Ingestor] OR [Document Ingestor] OR [Transcript Ingestor]
    ↓
[Normalization Service] (unified {text, transcript_json} format)
    ↓
[Lecture Repository] (create SQL record)
    ↓
[Trigger Downstream - Async Tasks]
    ├→ [Transcription Pipeline] (if audio/video)
    │   └→ [Deepgram API] → store transcript_text + transcript_json
    ├→ [RAG Pipeline] (always)
    │   └→ [Chunking + Cohere Embeddings] → store lecture_chunks
    └→ [Analysis Pipeline] (always)
        └→ [Groq LLM] (summary, keywords, questions, topics) → lecture_analysis cache
```

## File Structure

### Core Pipeline Layer
- `backendv2/app/core/pipeline/` ← Main orchestration
  - `ingestion_pipeline.py` - Route files by type, orchestrate workflow
  - `transcription_pipeline.py` - Deepgram transcription
  - `rag_pipeline.py` - Chunking + embeddings (Cohere)
  - `analysis_pipeline.py` - Summaries, keywords, questions (Groq)

### Ingestion Services Layer
- `backendv2/app/services/ingestion/` ← Format-specific handlers
  - `audio_ingestor.py` - Upload audio/video to Storage
  - `document_ingestor.py` - Extract text from PDF/DOCX/PPTX
  - `transcript_ingestor.py` - Parse JSON/TXT transcripts
  - `live_meeting_ingestor.py` - FUTURE: Real-time Zoom/Meet

### Processing Services Layer
- `backendv2/app/services/processing/` ← Data transformation
  - `normalization_service.py` - Convert all inputs to unified format

### Database Repositories Layer
- `backendv2/app/services/db/` ← Data access patterns
  - `lecture_repo.py` - CRUD for lectures table
  - `chunk_repo.py` - Chunk + embedding storage
  - `analysis_repo.py` - Analysis caching

### API Layer
- `backendv2/app/routers/ingestion.py` - Endpoints:
  - `POST /api/ingestion/upload` - File upload & ingestion
  - `GET /api/ingestion/status/{lecture_id}` - Processing status

### Data Models
- `backendv2/app/models/ingestion_models.py` - Pydantic schemas

## API Usage

### Upload & Ingest
```bash
curl -X POST http://localhost:8000/api/ingestion/upload \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@lecture.mp4" \
  -F "title=Machine Learning 101" \
  -F "org_id=org_123" \
  -F "group_id=group_456"
```

**Response:**
```json
{
  "lecture_id": "lec_abc123",
  "status": "created",
  "input_type": "video",
  "message": "File uploaded successfully. Video will be processed."
}
```

### Check Processing Status
```bash
curl -X GET http://localhost:8000/api/ingestion/status/lec_abc123 \
  -H "Authorization: Bearer <jwt_token>"
```

**Response:**
```json
{
  "lecture_id": "lec_abc123",
  "status": "summarizing",
  "stage": "analysis",
  "progress_percent": 90,
  "title": "Machine Learning 101"
}
```

## Data Flow Details

### Step 1: File Upload via POST /api/ingestion/upload
- Client sends multipart/form-data (file + metadata)
- Server validates JWT token
- File content extracted from request

### Step 2: Input Type Detection
- Examines filename extension + MIME type
- Routes to appropriate ingestor:
  - `.mp3/.mp4` → audio_ingestor
  - `.pdf/.docx` → document_ingestor
  - `.json/.txt` → transcript_ingestor

### Step 3: Format-Specific Ingestion
- **Audio**: Upload to Supabase Storage (`audio/` prefix), get public URL
- **Document**: Extract text using document_extraction_service
- **Transcript**: Parse JSON/TXT, validate non-empty

### Step 4: Normalization
All formats converted to:
```json
{
  "text": "Full transcript or extracted text",
  "transcript_json": {
    "segments": [...],
    "duration_seconds": 3600,
    "word_count": 5000,
    "language": "en",
    "source_type": "audio|document|transcript|meeting"
  }
}
```

### Step 5: Create Lecture Record
- Insert into `lectures` table via lecture_repo
- Set initial status: "uploading" (audio/video) or "transcribing" (document/transcript)
- Store normalized data in transcript_text + transcript_json columns

### Step 6: Return Immediately (No Blocking)
- API returns {lecture_id, status, input_type} to client
- Downstream pipelines trigger asynchronously
- Uses `asyncio.create_task()` for Background processing

### Step 7: Downstream Processing (Async)
Triggered in background:

**If Audio/Video:**
1. Transcription Pipeline
   - Call transcription_service.transcribe_audio() via Deepgram
   - Update transcript_text + transcript_json
   - Change status to "summarizing"

**Always:**
2. RAG Pipeline
   - Call rag_service.chunk_transcript() (split into ~300-token chunks)
   - Call rag_service.generate_embeddings() (Cohere embed-english-v3.0)
   - Insert chunks + embeddings into lecture_chunks table
   - Uses pgvector(1024) for semantic search

3. Analysis Pipeline
   - Call analysis_service.generate_summary()
   - Call analysis_service.extract_keywords()
   - Call analysis_service.generate_questions()
   - Call analysis_service.extract_topics()
   - Cache results in lecture_analysis table
   - Update lecture status to "completed"

## Database Schema Integration

### lectures table
- `id` (pk)
- `user_id` (fk → users)
- `org_id` (fk → organizations)
- `group_id` (fk → groups)
- `title` (string)
- `audio_url` (string, nullable - for audio files)
- `transcript_text` (text)
- `transcript_json` (jsonb - segments, duration, word_count, etc.)
- `status` (enum: uploading|transcribing|summarizing|completed|failed)
- `created_at`, `updated_at` (timestamps)

### lecture_chunks table
- `id` (pk)
- `lecture_id` (fk → lectures)
- `chunk_index` (int)
- `text` (string - ~300 token chunk)
- `embedding` (pgvector(1024) - Cohere embeddings)
- `start_time` (int, nullable - for audio segments)
- `end_time` (int, nullable)

### lecture_analysis table
- `id` (pk)
- `lecture_id` (fk → lectures, composite key with analysis_type)
- `analysis_type` (enum: summary|keywords|questions|topics)
- `content` (json or text)
- `created_at`, `updated_at`

## Error Handling

### Pipeline Exceptions
- Each pipeline function has try/except, logs errors
- On failure: update_lecture_status(lecture_id, "failed")
- Client can check status endpoint to see failure state

### Missing Services
- If transcription_service is None → skip transcription
- If rag_service is None → skip RAG
- If analysis_service is None → skip analysis
- Pipeline continues with available services (graceful degradation)

## Testing Checklist

- [ ] POST /api/ingestion/upload with MP4 file
- [ ] Check status endpoint - should progress through stages
- [ ] Verify lectures table entry created
- [ ] Verify transcript_json stored correctly
- [ ] Check lecture_chunks table populated (after RAG pipeline)
- [ ] Check lecture_analysis table populated (after analysis pipeline)
- [ ] Test with document upload (.pdf)
- [ ] Test with transcript upload (.json)
- [ ] Test JWT authentication failure (expect 401)
- [ ] Test invalid file types (expect 400)
- [ ] Monitor processing - should complete in ~2-5 minutes for 1-hour audio

## Configuration

Environment variables in `.env`:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase API key
- `UPLOAD_BUCKET` - Storage bucket name (default: "lectures")
- `DEEPGRAM_API_KEY` - Deepgram transcription
- `COHERE_API_KEY` - Embeddings generation
- `GROQ_API_KEY` - LLM for analysis

## Scaling Considerations

### Current Design (Single Process)
- Suitable for development & testing
- All pipelines run in same process
- File uploads blocked until ingestion complete

### Production Scaling (Future)
1. **Queue-Based Processing** - Use Redis/Bull for async task scheduling
2. **Separate Workers** - Transcription, RAG, analysis run on separate machines
3. **Horizontal Scaling** - Multiple ingestion workers behind load balancer
4. **Caching** - Redis cache for frequently accessed chunks/analyses
5. **Monitoring** - Prometheus metrics + Grafana dashboards

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Pipeline orchestration in ingestion_pipeline.py | Clear separation of concerns, easy to understand data flow |
| Async downstream processing | Fast API response, better user experience, parallel processing |
| Normalization service | Single source of truth for format conversion |
| Repository pattern | Isolates DB access, makes testing easier |
| Unified JSON format | Supports multiple input types without duplication |
| pgvector for search | Native PostgreSQL semantic search, no external dependency |

## Next Steps

1. ✅ Core infrastructure complete
2. **TODO**: Test end-to-end with real files
3. **TODO**: Refactor existing services (transcription_service, rag_service, analysis_service) to import from services/integrations/
4. **TODO**: Add comprehensive logging & error tracking
5. **TODO**: Implement live meeting ingestor (Phase 5)
6. **TODO**: Add queue-based processing for production scale

## Support Matrix

| Input Type | Status | Notes |
|-----------|--------|-------|
| Audio (.mp3, .wav, .flac, .aac, .m4a, .ogg) | ✅ Complete | Via Deepgram |
| Video (.mp4, .mov, .avi, .mkv, .webm) | ✅ Complete | Transcribed then analyzed |
| Documents (.pdf, .docx, .pptx, .xlsx, .txt) | ✅ Complete | Text extracted then analyzed |
| Transcripts (.json, .txt) | ✅ Complete | Pre-transcribed, just analyzed |
| Live Meetings (Zoom/Meet) | 🚧 Future | Phase 5 - Real-time streaming |

---

**Last Updated**: Implementation Phase 1 Complete
**Status**: Ready for Testing

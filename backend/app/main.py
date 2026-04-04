from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, lectures, chat, analysis, export, organizations, groups, extract
import os

app = FastAPI(
    title="KnowledgeFlow - Smart Knowledge Management API",
    description="GenAI API for enterprise document indexing, meeting intelligence, and RAG-based knowledge retrieval",
    version="1.0.0",
)

# CORS - allow frontend origins (local + production)
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://salc-app.vercel.app",  # The user's specific domain
]

# Add production frontend URL if set
if FRONTEND_URL:
    clean_url = FRONTEND_URL.rstrip("/")
    if clean_url not in allowed_origins:
        allowed_origins.append(clean_url)

# Accept local dev origins across arbitrary ports and all Vercel preview deployments.
allowed_origin_regex = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$|https://.*\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(lectures.router)
app.include_router(chat.router)
app.include_router(analysis.router)
app.include_router(export.router)
app.include_router(organizations.router)
app.include_router(groups.router)
app.include_router(extract.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "name": "KnowledgeFlow API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

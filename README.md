# SyncMind AI — Smart Knowledge Management Platform

A comprehensive platform for enterprise teams to upload, process, and analyze documents, meetings, and videos using RAG (Retrieval-Augmented Generation) and AI-powered intelligence.

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/Python-3.10+-green)
![Next.js](https://img.shields.io/badge/Next.js-16+-black)

---

## 🎯 Features

### Core Capabilities
- **Document Intelligence** — Upload and index PDFs, DOCX, PPTX, and TXT files for searchable knowledge bases
- **Meeting Intelligence** — Transcribe audio/video with speaker-aware text extraction
- **Auto Summaries** — Generate concise summaries and key points from long documents and meetings
- **Action Items** — Extract tasks, owners, and follow-ups from transcripts
- **RAG Smart Querying** — Ask natural-language questions and get grounded answers from indexed content
- **Source-Cited Answers** — All responses include source references for verification
- **Keyword & Topic Mining** — Surface important entities and recurring topics across files
- **Structured Export** — Export results as PDF, Markdown, TXT, or JSON

### User Features
- **Voice Recording** — Record meetings directly in the app with live timer
- **Video Link Support** — Process YouTube and Vimeo links
- **Private Workspaces** — Each user sees only their own uploaded assets and outputs
- **Team Collaboration** — Share summaries with team members in shared workspaces
- **Usage Analytics** — Track processing status, completion trends, and content volume
- **Fast Retrieval** — Vector search with chunking for low-latency responses

---

## 🏗️ Project Structure

```
OCEAN_LAB_HACKS/
├── frontend/                      # Next.js 16 + TypeScript
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Landing page with 3 input options
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── processing/       # Auto-redirect to login
│   │   │   ├── (protected)/
│   │   │   │   ├── dashboard/    # Main dashboard
│   │   │   │   ├── lecture/      # Lecture detail view
│   │   │   │   ├── analytics/
│   │   │   │   ├── groups/
│   │   │   │   ├── organizations/
│   │   │   │   ├── record/       # Voice recording page
│   │   │   │   └── upload/       # Document upload page
│   │   │   └── api/
│   │   ├── components/           # Reusable React components
│   │   ├── lib/                  # API client, auth context
│   │   └── types/                # TypeScript interfaces
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                       # FastAPI + Python
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Configuration
│   │   ├── middleware/
│   │   │   └── auth_middleware.py
│   │   ├── models/
│   │   │   └── schemas.py       # Pydantic models
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── lectures.py      # Core lecture endpoints
│   │   │   ├── organizations.py
│   │   │   ├── groups.py
│   │   │   └── ...
│   │   ├── services/            # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── rag_service.py
│   │   │   ├── analysis_service.py
│   │   │   ├── transcription_service.py
│   │   │   └── ...
│   │   └── utils/
│   │       ├── drive.py         # Google Drive integration
│   │       └── youtube.py       # YouTube URL processing
│   ├── requirements.txt
│   └── .env
│
├── supabase/                     # Database migrations
│   ├── migration.sql
│   ├── sample_data.sql
│   └── ...
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.10+
- **Supabase** account with PostgreSQL database
- **Google Cloud** credentials (optional, for Drive/YouTube integration)
- **Groq/Cohere API** keys for LLM inference

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/syncrn-ai.git
cd OCEAN_LAB_HACKS
```

### 2. Backend Setup

#### Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Configure environment
Create `.env` file in `backend/`:
```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE=your_service_role_key

# Auth
SECRET_KEY=your-secret-key-for-jwt
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# LLM APIs
GROQ_API_KEY=your_groq_key
COHERE_API_KEY=your_cohere_key

# Optional: Google Integration
GOOGLE_API_KEY=your_google_api_key
```

#### Run database migrations
```bash
# Apply migrations using your database tool
# Migrations are in supabase/ directory
```

#### Start backend server
```bash
uvicorn app.main:app --reload
# Server runs on http://localhost:8000
```

### 3. Frontend Setup

#### Install dependencies
```bash
cd ../frontend
npm install
```

#### Configure environment
Create `.env.local` file:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_id
```

#### Start development server
```bash
npm run dev
# Frontend runs on http://localhost:3000
```

---

## 📖 Usage Guide

### Landing Page
1. Navigate to `http://localhost:3000`
2. Click **"Create Summary"** to reveal input options
3. Choose one of three methods:

#### Option 1: Record Voice
- Click **"Start Recording"**
- Live timer shows duration
- Click **"Stop"** when finished
- Status shows "Recording ready"

#### Option 2: Upload Document
- Drag & drop PDF, DOCX, or TXT
- Or click to select file
- Filename appears once selected

#### Option 3: Video Link
- Paste YouTube or Vimeo URL
- URL validates on blur
- Checkmark appears when valid

#### Submit
- **"Summarize Now"** button enables when any input has content
- Saves media to localStorage
- Redirects to processing page

### Processing Flow
1. **Processing Page** → Shows spinner, auto-redirects to login in 3 seconds
2. **Login** → Enter credentials
3. **Dashboard** → Media upload starts automatically
4. **Dashboard Display** → Lecture appears with "uploading" status, progresses through pipeline

### Dashboard
- **Quick Actions** — Upload Knowledge, Record Meeting, **New Summary** (returns to landing)
- **Lectures Grid** — Shows all processed items with status badges
- **Scope Filters** — Filter by workspace and team
- **Activity Strip** — Shows processing count, completed count, and last AI action

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` — Create new account
- `POST /api/auth/login` — Login with email/password
- `GET /api/auth/me` — Get current user

### Lectures
- `POST /api/lectures/upload` — Upload and process file/audio
  - Form fields: `title`, `audio` (file), `org_id?`, `group_id?`
- `GET /api/lectures` — List user's lectures
- `GET /api/lectures/{id}` — Get lecture details
- `DELETE /api/lectures/{id}` — Delete lecture
- `GET /api/lectures/{id}/suggest-teams` — Get team suggestions for sharing
- `PUT /api/lectures/{id}/share-teams` — Share with teams

### Organizations
- `GET /api/organizations` — List user's organizations
- `POST /api/organizations` — Create organization
- `DELETE /api/organizations/{id}` — Delete organization
- `GET /api/organizations/{id}/members` — Get members
- `POST /api/organizations/{id}/invite` — Invite member

### Groups
- `GET /api/groups/org/{org_id}` — List teams in organization
- `POST /api/groups` — Create team
- `GET /api/groups/{id}` — Get team details

---

## 🛠️ Tech Stack

### Frontend
- **Framework** — Next.js 16 with App Router
- **Language** — TypeScript
- **Styling** — CSS-in-JS with custom design system
- **Icons** — Lucide React
- **Auth** — NextAuth.js with JWT
- **HTTP Client** — Axios
- **State Management** — React Context API

### Backend
- **Framework** — FastAPI 0.115
- **Server** — Uvicorn
- **Database** — PostgreSQL (via Supabase)
- **ODM** — Supabase Python SDK
- **Auth** — JWT with python-jose
- **LLM** — Groq / Cohere APIs
- **Processing** — yt-dlp (video), python-docx, python-pptx, pypdf
- **Async** — FastAPI built-in async support

### Infrastructure
- **Storage** — Supabase Storage
- **Database** — Supabase PostgreSQL
- **Vector DB** — Pgvector (via Supabase)
- **Auth** — JWT tokens

---

## 🔄 Processing Pipeline

### File Upload Flow
```
1. User uploads file/audio/video
   ↓
2. Backend creates lecture record with status="uploading"
   ↓
3. File stored in Supabase Storage
   ↓
4. Background task triggered:
   - Transcription (audio) or text extraction (docs)
   - Status: "transcribing"
   ↓
5. Summary generation via Groq/Cohere
   - Status: "summarizing"
   ↓
6. Vector embeddings + RAG indexing
   - Status: "processing_rag"
   ↓
7. Complete with full metadata
   - Status: "completed"
```

### Supported File Types
- **Audio** — WAV, MP3, WebM, OGG, FLAC
- **Video** — MP4, WebM (processed via YouTube/Vimeo URLs)
- **Documents** — PDF, DOCX, TXT, PPTX
- **External** — YouTube and Vimeo links

---

## 🔐 Authentication

### Login Flow
1. User registers with email/password
2. Backend hashes password with bcrypt
3. JWT token issued on login
4. Token stored in localStorage (frontend)
5. Auth header added to all API requests
6. Protected routes check token validity

### Protected Routes
- `/dashboard` and all `/` protected routes require authentication
- Unauthenticated users redirected to `/login`
- Token checked in middleware

---

## 🧪 Development Notes

### Frontend State Management
- Auth state in React Context (`useAuth()`)
- Form state with `useState`
- Pending summaries passed via localStorage during unauthenticated flow
- Query params used for org/group context

### Backend Processing
- Background tasks via FastAPI `BackgroundTasks`
- Supabase Python SDK for database operations
- File readers for different document types
- Streaming responses for real-time updates

### Error Handling
- Frontend: Axios interceptors for API errors
- Backend: HTTPException with appropriate status codes
- User-friendly error messages displayed in UI

---

## 📊 Database Schema

### Key Tables
- **users** — User accounts with email, hashed passwords
- **lectures** — Processing jobs with title, status, metadata
- **organizations** — Workspace containers
- **groups** — Team containers within organizations
- **lecture_vectors** — Vector embeddings for RAG
- **transcripts** — Full text transcripts/summaries
- **lecture_shares** — Team sharing permissions

---

## 🐛 Troubleshooting

### Upload Stuck in Processing
- Check backend logs: `uvicorn app.main:app --reload`
- Verify Supabase credentials in `.env`
- Check storage bucket permissions
- Ensure LLM API keys are valid

### Login Red irect Loop
- Clear browser localStorage: `localStorage.clear()`
- Verify `salc_token` is stored after login
- Check auth middleware logs

### API Connection Failed
- Verify backend running: `http://localhost:8000/docs`
- Check frontend API base URL in `.env.local`
- Ensure CORS headers configured correctly

---

## 📝 Environment Variables Reference

### Backend `.env`
| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Database URL | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Anon key | `eyJxxx...` |
| `SECRET_KEY` | JWT secret | `your-secret` |
| `GROQ_API_KEY` | LLM API key | `gsk_xxx...` |
| `COHERE_API_KEY` | Alternative LLM | `xxx...` |

### Frontend `.env.local`
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend URL | `http://localhost:8000` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | OAuth ID | `xxx.apps.googleusercontent.com` |

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 📞 Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Check existing documentation in `/docs`
- Review API docs at `http://localhost:8000/docs` (after backend start)

---

**Built with ❤️ for enterprise knowledge management**
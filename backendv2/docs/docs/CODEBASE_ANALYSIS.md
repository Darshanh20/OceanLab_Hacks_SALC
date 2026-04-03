# OCEAN LAB HACKS - Complete Codebase Analysis
**Project: KnowledgeFlow - Smart Knowledge Management Platform**

---

## 📋 Table of Contents
1. [What This Project Does](#what-this-project-does)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Explained](#database-explained)
5. [Backend Services Explained](#backend-services-explained)
6. [Frontend Pages Explained](#frontend-pages-explained)
7. [How Data Flows Through the System](#how-data-flows-through-the-system)
8. [File-by-File Breakdown](#file-by-file-breakdown)

---

## 🎯 What This Project Does

**In Simple Terms:** This is like a **Slack for company documents and meetings**.

Think of it this way:
- 📤 **Upload** documents (PDFs, Word files, PowerPoints) and audio/video files
- 🔄 **Convert** them into text (transcribe meetings, extract text from docs)
- 📝 **Summarize** them automatically
- 🤖 **Ask questions** about them using AI (like ChatGPT but for your company data)
- 👥 **Share** with teammates in different groups/teams
- 💼 **Organize** everything by workspace and teams

---

## 🛠️ Technology Stack

### Frontend (User Interface)
- **Next.js 16** - React framework for building web pages
- **React 19** - JavaScript library for interactive UI
- **TypeScript** - JavaScript with better error checking
- **Axios** - Tool to talk to the backend API
- **Lucide React** - Pretty icons for buttons and menus
- **React Markdown** - Display formatted text

### Backend (Server/Logic)
- **FastAPI** - Python framework for building APIs (the server)
- **Python 3.x** - Programming language
- **Supabase** - Database and file storage service
- **Groq** - AI service for generating summaries
- **Cohere** - AI service for creating embeddings (converting text to numbers for searching)
- **Deepgram** - Service for transcribing audio to text

### Database
- **PostgreSQL** - Main database (managed by Supabase)
- **pgvector** - Special database extension for AI vector search

---

## 📁 Project Structure

```
OCEAN_LAB_HACKS/
├── backend/                      # Server code (Python)
│   ├── app/
│   │   ├── main.py              # Starts the server
│   │   ├── config.py            # Settings and API keys
│   │   ├── middleware/          # Security checks
│   │   ├── models/              # Data formats
│   │   ├── routers/             # API endpoints (URLs)
│   │   └── services/            # Business logic
│   ├── requirements.txt         # Python packages needed
│   └── test_gemini.py           # Testing file
│
├── frontend/                     # Website code (React)
│   ├── src/
│   │   ├── app/                 # Pages users see
│   │   ├── components/          # Reusable UI parts
│   │   ├── lib/                 # Helper functions
│   │   └── types/               # Data type definitions
│   ├── package.json             # JavaScript packages needed
│   └── next.config.ts           # Frontend settings
│
└── supabase/                     # Database setup files
    ├── migration.sql            # Initial database schema
    ├── b2b_migration.sql        # Team/organization tables
    ├── sample_data.sql          # Test data
    └── other SQL files          # Additional features
```

### Recommended Backend Module Mapping

The current backend is organized by layer (`routers/`, `services/`, `models/`, `middleware/`). The target structure should be feature-based:

- `modules/auth/` → `routers/auth.py`, `services/auth_service.py`, auth schemas and utilities
- `modules/lectures/` → `routers/lectures.py`, lecture schemas, repository access, lecture-specific orchestration
- `modules/ingestion/` → document extraction, transcription, upload formatting, and ingestion handlers
- `modules/rag/` → embedding generation, chunk retrieval, and answer synthesis
- `modules/analysis/` → summaries, notes, keywords, highlights, questions, translation
- `modules/organizations/` → workspace creation, membership, role checks
- `modules/groups/` → team creation, membership, access rules
- `modules/integrations/` → team suggestion logic and future calendar/extension integrations
- `core/` → global config, database client, security helpers
- `shared/` → reusable AI clients and utility helpers
- `workers/` → background jobs for ingestion, summarization, embeddings, and action plan generation

This is the cleanest way to align the codebase with the intended backendv1-style modular architecture without mixing unrelated logic.

---

## 💾 Database Explained

### Main Tables

#### 1. **users** - People who sign up
```
Stores: User ID, Email, Password (encrypted), When they joined
Purpose: Track who's using the system
```

#### 2. **lectures** - Documents and meeting recordings
```
Stores:
- ID and who uploaded it
- Title
- Audio/video file location
- Full text (from transcription or document)
- Structured data (utterances, speaker info, timestamps)
- Auto-generated summary
- Analysis results
- Status (uploading → transcribing → summarizing → rag processing → completed)
- Which workspace (org_id) and team (group_id) it belongs to
- When it was created

Purpose: Keep track of all uploaded content and their processing stages
```

#### 3. **lecture_chunks** - Small pieces of content with AI vectors
```
Stores:
- ID and which lecture it came from
- A 500-800 word chunk of text
- Vector (a list of 1,024 numbers that represents the chunk's meaning)

Purpose: Enable fast AI-powered search across content
```

#### 4. **organizations** - Workspaces
```
Stores: Workspace ID, Name, Owner, Subscription level, Status
Purpose: Group users and documents into separate workspaces
```

#### 5. **org_members** - Who's in each workspace
```
Stores: User ID, Organization ID, Their role (owner/admin/member)
Purpose: Track workspace membership and permissions
```

#### 6. **groups** - Teams within a workspace
```
Stores: Team ID, Workspace ID, Name, Description, Who created it
Purpose: Organize people and documents into smaller teams
```

#### 7. **group_members** - Who's in each team
```
Stores: User ID, Team ID, Their role (admin/member)
Purpose: Track team membership
```

#### 8. **lecture_analysis** - Cached AI analyses
```
Stores: Lecture ID, Type of analysis, The result
Purpose: Save AI results so we don't have to generate them twice
```

#### 9. **lecture_team_shares** - Which teams can access which lectures
```
Stores: Lecture ID, Team ID
Purpose: Allow sharing lectures with specific teams
```

#### 10. **lecture_action_plans** - Cached action plans for a lecture
```
Stores:
- Lecture ID
- Markdown action plan
- JSON payloads for tasks, timeline, dependencies, team breakdown, and share targets
- Whether the plan is shared

Purpose: Cache lecture-level action plans so they can be reused without regeneration
```

#### 11. **workspace_action_plans** - Cached action plans for an organization or team
```
Stores:
- Organization ID
- Optional Team ID
- Markdown action plan
- JSON payloads for tasks, timeline, dependencies, team breakdown, and risks

Purpose: Cache workspace-scoped plans across uploads and team workflows
```

### How Permissions Work

```
Personal (Private):
- User uploads a document with no organization
- Only that user can see it
- (Like: "My Computer > My Files")

Workspace (Everyone in company):
- User uploads to an organization but no specific team
- All members of that workspace can see it
- Like: "Google Drive > Company folder" (everyone sees it)

Team (Specific group):
- User uploads to both organization + team
- Only members of that team and workspace owner can see it
- Like: "Google Drive > Marketing Team folder" (only team members)

Shared to multiple teams:
- A lecture can also be linked to additional teams through `lecture_team_shares`
- This keeps the primary lecture scope intact while allowing controlled reuse across groups
```

---

## 🔌 Backend Services Explained

### Flow: What Happens When You Upload Something

1. **Upload Begins** → status = "uploading"
2. **Choose transcriber** (audio/video vs document)
3. **Transcribe/Extract Text** → status = "transcribing"
4. **Summarize** → status = "summarizing"
5. **Split into chunks** → status = "processing_rag"
6. **Create AI vectors** (embeddings)
7. **Save everything** → status = "completed"

### Backend Folders Explained

#### `/backend/app/main.py`
**What it does:** Starts the server
- Sets up FastAPI (the server framework)
- Allows requests from the frontend (CORS settings)
- Connects all the API routes together
- Provides `/health` endpoint to check if server is running

#### `/backend/app/config.py`
**What it does:** Keeps all settings in one place
- API keys for external services (Groq, Cohere, Deepgram)
- Database credentials
- File size limits
- Allowed file types
- JWT secret for login tokens

#### `/backend/app/middleware/auth_middleware.py`
**What it does:** Security guard for API endpoints
- Checks if the request has a valid login token
- Extracts user ID from token
- Rejects requests from non-logged-in users

#### `/backend/app/models/schemas.py`
**What it does:** Defines data formats
- `UserCreate` - Data needed to sign up (email, password)
- `TokenResponse` - What the login endpoint returns
- `LectureResponse` - What a document/meeting looks like when returned to frontend
- Etc. (validators for all API data)

#### `/backend/app/routers/` - API Endpoints (URLs You Can Call)

**auth.py** - Login and signup
```
POST /api/auth/register - Sign up
POST /api/auth/login - Log in
GET /api/auth/me - Get current user info
```
What it does:
- Takes email and password
- Hashes password (converts to unreadable form)
- Stores in database
- Returns login token (JWT - a special string for authentication)

**lectures.py** - Upload, list, and manage documents/meetings
```
POST /api/lectures/upload - Upload file
GET /api/lectures - List all your documents
GET /api/lectures/{id} - Get one document details
DELETE /api/lectures/{id} - Delete a document
POST /api/lectures/{id}/share - Share with teams
GET /api/lectures/{id}/download - Download results
```
What it does:
- Handles file upload to Supabase storage
- Decides if it's audio/video or document
- Calls transcription or text extraction service
- Manages permissions (who can see what)
- Stores all the results in database

**chat.py** - Ask questions about documents
```
POST /api/chat/query - Ask a question about a lecture/document
```
What it does:
- Takes your question
- Converts it to AI vector (embedding) using Cohere
- Searches database for similar chunks using vector similarity
- Sends found chunks to Groq AI
- AI reads the chunks and answers your question
- Returns answer + source references

**analysis.py** - Get summaries and insights
```
GET /api/lectures/{id}/analysis - Get analysis results
GET /api/lectures/{id}/action-items - Extract tasks
```
What it does:
- Calls Groq AI to analyze content
- Extracts key points, action items, topics
- Caches results so they're fast next time

**export.py** - Download results
```
GET /api/lectures/{id}/export - Get PDF/JSON/Markdown
```
What it does:
- Combines transcript, summary, and analysis
- Formats into PDF, Markdown, or JSON
- Sends to user for download

**organizations.py** - Manage workspaces
```
POST /api/organizations - Create a workspace
GET /api/organizations - List your workspaces
POST /api/organizations/{id}/members - Add people to workspace
```
What it does:
- Create and manage workspaces
- Add/remove members
- Set roles (owner, admin, member)

**groups.py** - Manage teams
```
POST /api/groups - Create a team
GET /api/groups - List teams
POST /api/groups/{id}/members - Add people to team
```
What it does:
- Create and manage teams within workspaces
- Add/remove team members
- Set team roles

### Backend Services (Helper Functions)

#### `auth_service.py` - Password and Login Logic
```python
hash_password(password)           # Turn password into unreadable code
verify_password(password, hash)   # Check if password is correct
create_access_token(user_id)      # Create JWT token for logged-in user
decode_access_token(token)        # Read and verify JWT token
```

#### `transcription_service.py` - Convert Audio to Text
```python
transcribe_audio(audio_file)      # Send to Deepgram API
                                  # Returns: text, speaker labels, timestamps
```
How it works:
1. Takes audio file from upload
2. Sends to Deepgram API
3. Deepgram returns:
   - Full transcript text
   - Speaker identification (who said what)
   - Exact timestamps (when something was said)
   - Word-by-word breakdown
4. Converts to structured format and saves

#### `document_extraction_service.py` - Extract Text from PDF/Word/PowerPoint
```python
extract_document_text(file_path)  # Read document
                                  # Returns: full text
```
How it works:
1. Takes PDF, Word, or PowerPoint file
2. Extracts plain text (no OCR for images)
3. Returns as if it was a transcription

#### `rag_service.py` - Split Text and Create AI Vectors
```python
process_lecture_for_rag(text)     # Split text into chunks
                                  # Create embeddings with Cohere
```
How it works:
1. Takes full transcript (could be 50,000+ words)
2. Splits into small chunks (500-800 words each)
3. Overlaps chunks (so nothing gets missed)
4. For each chunk:
   - Sends to Cohere API
   - Gets back a vector (list of 1,024 numbers)
   - Represents the chunk's meaning mathematically
5. Stores all vectors in database

This is KEY for search - when you ask a question, we convert your question to a vector too, then find the most similar chunks by comparing vectors.

#### `summary_service.py` - Auto-Generate Summaries
```python
generate_summary(transcript_text) # Send to Groq AI
                                  # Returns: short summary
```
How it works:
1. Takes full text
2. Sends to Groq API (GenAI LLM)
3. AI reads the full text
4. Generates a concise summary (key points)
5. Returns summary

#### `analysis_service.py` - Extract Insights
Functions extract:
- Key points / highlights
- Action items / tasks
- Important topics / keywords
- Attendees / participants (from meetings)
- Workspace and lecture action plans (cached in `lecture_action_plans` and `workspace_action_plans`)

#### `supabase_client.py` - Database Connection
```python
get_supabase()                    # Returns connection to database
```
This is like the "database driver" - it lets all the other services talk to the database.

#### `organization_service.py` - Workspace Logic
```
get_role(org_id, user_id)         # What role does user have in workspace?
create_organization(name, owner)  # Create new workspace
add_member(org_id, user_id)       # Add person to workspace
```

#### `group_service.py` - Team Logic
```
get_group_role(group_id, user_id) # What role does user have in team?
create_group(org_id, name)        # Create new team
add_member(group_id, user_id)     # Add person to team
```

#### `team_suggestion_service.py` - AI Team Recommendations
Suggests which teams might be interested in a newly uploaded lecture.

#### `lecture_action_plans` and `workspace_action_plans`
These cached tables store structured planning output so the app can reuse generated plans for lectures, teams, and workspaces without recomputing them on every request.

---

## 🎨 Frontend Pages Explained

### `/frontend/src/app/page.tsx` - Landing Page
**What you see:** The first page when you visit the website
- Big heading: "Turn Scattered Company Data Into Instant Team Knowledge"
- Features list with icons
  - Document Intelligence (for PDFs, DOCX, PPTX)
  - Meeting Intelligence (for audio/video)
  - RAG Smart Querying (ask questions)
  - Source-Cited Answers (where info came from)
  - Auto Summaries (quick summaries)
  - Action Items (extract tasks)
  - Keyword Mining (important words)
  - Export (download as PDF)
  - Analytics (track usage)
  - Fast Retrieval (quick search)
  - Private Workspace (only you see yours)
  - Slack Integration (for teams)
- Login and Sign Up buttons

### `/frontend/src/app/login/page.tsx` - Login Page
**Where you enter:** Your email and password to log in

### `/frontend/src/app/register/page.tsx` - Sign Up Page
**Where you create:** A new account with email and password

### Protected Routes (Need Login)
Located in `/frontend/src/app/(protected)/`

#### `/dashboard/page.tsx` - Main Dashboard
**Shows:**
- List of your uploaded documents
- Quick stats
- Recent activity

#### `/upload/page.tsx` - Upload Page
**What you do:**
- Click to upload file (audio, video, PDF, Word, PowerPoint)
- Waits for processing to complete
- Shows progress (uploading → transcribing → summarizing → rag → done)
- Shows success message when done

#### `/lecture/[id]/page.tsx` - View Single Document
**Shows:**
- Title of document
- Full transcript/text
- Summary
- Analysis results
- Ask-a-question box

#### `/analytics/page.tsx` - View Statistics
**Shows:**
- How many documents processed
- Total processing time
- Usage trends
- File type breakdown

#### `/groups/page.tsx` - Manage Teams
**What you do:**
- Create new team
- See team members
- Add/remove people from team

#### `/groups/[id]/page.tsx` - Team Details
**Shows:**
- Team name and description
- List of team members
- Documents shared with this team

#### `/organizations/page.tsx` - Manage Workspaces
**What you do:**
- Create new workspace
- See workspace members
- Manage workspace settings

#### `/organizations/[id]/page.tsx` - Workspace Details
**Shows:**
- Workspace name
- All members and their roles
- Invite new members
- Remove members
- Change member roles

#### `/record/page.tsx` - Record Meeting
**What you do:**
- Record audio/video in browser
- Upload directly
- Process like other files

#### `/workspace-view/[id]/page.tsx` - View Team Workspace
**Shows:**
- All documents in this team
- Team members
- Shared content

### `/frontend/src/components/` - Reusable UI Parts

#### `Sidebar.tsx` - Left Navigation Menu
**What you see:**
- Logo at top
- Links to: Dashboard, Upload, Lectures, Teams, Organizations, Analytics
- User info and logout button
- Stays visible on every page

#### `TeamSuggestionModal.tsx` - Popup for Sharing
**What appears:**
- After uploading, suggests which teams might want this content
- Click to share with those teams

### `/frontend/src/lib/` - Helper Code

#### `api.ts` - Talk to Backend
**Contains functions to:**
```
uploadFile()          # Send file to backend
getLectures()         # Get list of documents
queryLecture()        # Ask question about document
createOrganization()  # Create workspace
addTeamMember()       # Add person to team
```

#### `auth.tsx` - Login Logic
**Contains functions to:**
```
login()               # Log in user
register()            # Sign up user
getToken()            # Get stored login token
logout()              # Log out user
```

### `/frontend/src/types/index.ts` - Data Types
Defines:
```typescript
User                  # User info structure
Lecture               # Document info structure
Organization          # Workspace info structure
Group                 # Team info structure
```

---

## 🔄 How Data Flows Through the System

### Scenario 1: User Uploads a Meeting Recording

```
1. User clicks "Upload" on frontend
   ↓
2. Browser sends file to backend: POST /api/lectures/upload
   ↓
3. Backend stores file in Supabase Storage (like Amazon S3)
   Gets public URL
   Creates database entry with status = "uploading"
   ↓
4. Backend recognizes it's audio/MP4
   ↓
5. Sends to Deepgram API for transcription
   Status = "transcribing"
   ↓
6. Deepgram returns:
   - Full Text
   - Speaker labels (Speaker 1, Speaker 2, etc)
   - Word-level timestamps
   - Duration, word count
   ↓
7. Backend saves structured data to `lecture.transcript_json`
   ↓
8. Backend calls Groq AI to summarize
   Status = "summarizing"
   ↓
9. Groq returns summary
   Backend caches in `lecture_analysis` table
   ↓
10. Backend splits text into 500-800 word chunks
    Status = "processing_rag"
    ↓
11. For each chunk:
    - Sends to Cohere API
    - Gets vector (1,024 numbers)
    - Stores in `lecture_chunks` table
    ↓
12. Status = "completed"
    Frontend refreshes and shows success
```

### Scenario 2: User Asks a Question

```
1. User types question on frontend
   ↓
2. Frontend sends: POST /api/chat/query
   With: question, lecture_id
   ↓
3. Backend converts question to vector using Cohere
   ↓
4. Backend queries database:
   Find 5 chunks with vectors closest to question vector
   (Using pgvector similarity search)
   ↓
5. Backend sends found chunks + your question to Groq AI
   ↓
6. Groq AI reads chunks and your question
   Generates answer based on the chunks
   ↓
7. Backend returns to frontend:
   - Answer text
   - Which chunks it came from (sources)
   - Confidence score
   ↓
8. Frontend displays answer with source highlights
```

### Scenario 3: User Shares Document with Team

```
1. User selects document and clicks "Share"
   Chooses teams to share with
   ↓
2. Frontend sends: POST /api/lectures/{id}/share
   With: list of team IDs
   ↓
3. Backend stores in `lecture_team_shares` table
   ↓
4. Next time team members view lecture list,
   this document appears for them
```

---

## 📄 File-by-File Breakdown

### BACKEND FILES

| File | Purpose | Does What |
|------|---------|-----------|
| `main.py` | Server startup | Starts the API, connects routes |
| `config.py` | Settings | Stores all API keys and config values |
| `auth_middleware.py` | Security | Checks login tokens on protected endpoints |
| `schemas.py` | Data validation | Defines format of all API data |
| `auth_service.py` | Login logic | Hash/verify passwords, create/read tokens |
| `transcription_service.py` | Audio to text | Sends audio to Deepgram API |
| `document_extraction_service.py` | Extract text | Reads PDF/Word/PowerPoint files |
| `rag_service.py` | AI vectors | Chunks text and creates embeddings |
| `summary_service.py` | Auto summarize | Sends text to Groq for summary |
| `analysis_service.py` | Extract insights | Gets key points, action items, topics |
| `supabase_client.py` | Database | Connects to PostgreSQL database |
| `organization_service.py` | Workspace logic | Manages organizations and members |
| `group_service.py` | Team logic | Manages teams and team members |
| `team_suggestion_service.py` | Suggest teams | Recommends teams for sharing |
| `auth.py` (router) | Login endpoints | `/register`, `/login`, `/me` |
| `lectures.py` (router) | Content endpoints | `/upload`, `/list`, `/delete`, `/details` |
| `chat.py` (router) | Q&A endpoint | `/query` - ask questions |
| `analysis.py` (router) | Analysis endpoint | Get summaries and insights |
| `export.py` (router) | Export endpoint | Download as PDF/JSON/Markdown |
| `organizations.py` (router) | Workspace endpoints | Create/manage workspaces |
| `groups.py` (router) | Team endpoints | Create/manage teams |

### FRONTEND FILES

| File | Purpose | Does What |
|------|---------|-----------|
| `page.tsx` (root) | Landing page | Shows features, login/signup buttons |
| `login/page.tsx` | Login form | User enters email/password |
| `register/page.tsx` | Sign up form | User creates new account |
| `(protected)/dashboard/page.tsx` | Main page | Shows all user's documents |
| `(protected)/upload/page.tsx` | Upload form | User uploads files |
| `(protected)/lecture/[id]/page.tsx` | View document | Shows transcript + summary + Q&A |
| `(protected)/analytics/page.tsx` | Stats page | Shows usage analytics |
| `(protected)/groups/page.tsx` | Teams list | Manage teams |
| `(protected)/organizations/page.tsx` | Workspaces list | Manage workspaces |
| `(protected)/record/page.tsx` | Record page | Record audio in browser |
| `(protected)/workspace-view/[id]/page.tsx` | Team view | See team documents |
| `Sidebar.tsx` | Navigation | Left menu on every page |
| `TeamSuggestionModal.tsx` | Share popup | Suggests teams to share with |
| `api.ts` | API helper | Functions to call backend |
| `auth.tsx` | Auth helper | Login/signup/logout functions |
| `types/index.ts` | Data types | TypeScript interfaces for data |

### DATABASE FILES (SQL)

| File | Purpose | Does What |
|------|---------|-----------|
| `migration.sql` | Initial setup | Creates users, lectures, chunks tables |
| `b2b_migration.sql` | Teams/org setup | Creates organizations, groups, members tables |
| `sample_data.sql` | Test data | Adds example data for testing |
| `add_analysis_cache.sql` | Analysis table | Creates table for cached AI results |
| `add_lecture_team_shares.sql` | Sharing table | Lets documents be shared with teams |
| `add_transcript_json.sql` | Structured data | Adds column for detailed transcript data |
| `update_vector_dimension.sql` | Fix vectors | Updates embedding dimension to 1024 |
| `DATABASE_SCHEMA.md` | Schema reference | Full table-by-table schema for the current database |

---

## 🔐 Security & Permissions Summary

### Who Can See What

**Personal Documents** (no workspace):
- ✅ Only the uploader can see

**Workspace Documents** (workspace, no team):
- ✅ Everyone in the workspace can see

**Team Documents** (workspace + team):
- ✅ Team members can see
- ✅ Workspace owner can see
- ✅ Anyone the document was explicitly shared with

### Roles

**Organization (Workspace):**
- **Owner** - Can do anything (manage everyone, create teams, edit settings)
- **Admin** - Can create teams, invite people, manage team settings
- **Member** - Can only access their assigned teams and documents

**Team:**
- **Admin** - Can add/remove team members, manage team settings
- **Member** - Can access team documents and participate

### Password Security
- Passwords are encrypted with bcrypt (military-grade encryption)
- Never stored as plain text
- Cannot be recovered if forgotten
- Login creates JWT token (temporary access pass)
- Token expires after 24 hours

---

## 📊 Key Integrations (External Services)

### Deepgram - Transcription
- Converts audio/video to text
- Identifies multiple speakers
- Provides word-level timestamps

### Cohere - AI Embeddings
- Converts text chunks to vectors
- Enables similarity search
- 1,024-dimensional vectors

### Groq - AI Summaries & Analysis
- Generates summaries
- Extracts action items
- Answers questions
- Creates insights

### Supabase - Database & Storage
- PostgreSQL database (stores all data)
- File storage (stores audio/video files)
- Authentication (manages login)

---

## 🚀 How to Use This System

### For Users:
1. Sign up with email/password
2. Upload a document or meeting recording
3. Wait for processing (usually 1-5 minutes)
4. View transcript, summary, and key points
5. Ask questions using natural language
6. Share with teams/colleagues
7. Export results as PDF

### For Developers:
1. Backend starts on Python FastAPI (runs on port 5000)
2. Frontend starts on Next.js (runs on port 3000)
3. Database is Supabase PostgreSQL (cloud)
4. File storage is Supabase (cloud)
5. All API keys in `.env` file

---

## 📈 Common Data Flows

### Uploading Process
User → Web Form → Server → Deepgram/PDF Reader → Groq Summary → Cohere Embeddings → Database

### Searching Process
User Question → Cohere Embeddings → Vector Search → Similar Chunks → Groq AI Answer → User

### Sharing Process
User → Share Button → Backend → Database → Other Users See It

### Export Process
User → Download Button → Backend → Compile Data → PDF/JSON/Markdown → User Downloads

---

## ✅ Summary

This is a **complete enterprise knowledge management system** that:
1. **Ingests** any document, meeting, or recording
2. **Processes** it with AI (transcription, summarization)
3. **Indexes** it for fast searching
4. **Allows teams** to collaborate and share
5. **Enables AI-powered Q&A** against all indexed content
6. **Exports results** in multiple formats

The backend handles all the heavy lifting (AI, database, storage), while the frontend provides a clean interface for users to interact with everything.


# CodeSense AI - Local Development Setup Guide

This guide will help you run CodeSense AI locally on your machine.

## Prerequisites

Before starting, ensure you have:
- **Python 3.12+** (for backend)
- **Node.js 20+** (for frontend)
- **PostgreSQL 14+** (local or cloud)
- **Pinecone account** (for vector search)
- **Ollama** (for local LLM) or **OpenAI/Gemini API keys**

---

## 1. Clone & Setup

```bash
# Repository is already cloned at:
C:\Users\manth\Desktop\ai-devops-project
```

---

## 2. Backend Setup

### 2.1 Create Virtual Environment
```bash
cd C:\Users\manth\Desktop\ai-devops-project\backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

### 2.2 Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 2.3 Configure Environment
```bash
# Copy example and edit with your values
copy .env.example .env
# Edit .env with your actual credentials
notepad .env
```

**Required .env variables:**
| Variable | Description | Get From |
|----------|-------------|----------|
| `SESSION_SECRET_KEY` | Random secret for sessions | Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | PostgreSQL connection string | Local: `postgresql://user:pass@localhost:5432/codesense-ai` |
| `PINECONE_API_KEY` | Pinecone API key | https://www.pinecone.io/ |
| `PINECONE_INDEX` | Index name (default: codesense-ai-code) | Create in Pinecone console |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth credentials | https://console.cloud.google.com/ |
| `GITHUB_CLIENT_ID/SECRET` | GitHub OAuth credentials | https://github.com/settings/developers |
| `OLLAMA_BASE_URL` | Local Ollama URL | http://localhost:11434 (if using Ollama) |

### 2.4 Setup Database
```bash
# Create database in PostgreSQL first:
# CREATE DATABASE codesense_ai;

# Run migrations (if using Alembic)
alembic upgrade head
# Or let FastAPI auto-create tables (already in main.py)
```

### 2.5 Start Ollama (if using local LLM)
```bash
# Install Ollama from https://ollama.ai/
ollama serve
# In another terminal:
ollama pull nomic-embed-text
ollama pull llama3.2
```

### 2.6 Run Backend
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Backend will be at: **http://localhost:8000**
API docs at: **http://localhost:8000/docs**

---

## 3. Frontend Setup

### 3.1 Install Dependencies
```bash
cd C:\Users\manth\Desktop\ai-devops-project\frontend
npm install
```

### 3.2 Configure Environment
```bash
copy .env.example .env
# Edit if needed (default should work)
notepad .env
```

### 3.3 Run Frontend
```bash
npm run dev
```
Frontend will be at: **http://localhost:5173**

---

## 4. Verify Installation

1. Open **http://localhost:5173** in browser
2. You should see the CodeSense AI landing page
3. Try logging in with Google/GitHub OAuth
4. Add a GitHub repo URL to test ingestion

---

## 5. Docker Alternative (Single Command)

If you prefer Docker:

```bash
cd C:\Users\manth\Desktop\ai-devops-project
docker build -t codesense-ai .
docker run -p 8000:8000 --env-file backend/.env codesense-ai
```
Access at: **http://localhost:8000**

---

## 6. Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError` | Ensure venv is activated and `pip install -r requirements.txt` ran |
| Database connection failed | Check PostgreSQL is running and `DATABASE_URL` is correct |
| Pinecone errors | Verify `PINECONE_API_KEY` and index exists |
| OAuth redirect mismatch | Add `http://localhost:8000/api/auth/callback/google` and `.../github` to OAuth console |
| Frontend build fails | Run `npm install` again, check Node version (20+) |
| CORS errors | Ensure `FRONT_END_URL=http://localhost:5173` in backend .env |

---

## 7. Project Structure

```
ai-devops-project/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entry point
│   │   ├── core/            # Config, OAuth
│   │   ├── routers/         # API routes (auth, ai, repo, discuss)
│   │   ├── services/        # Business logic (ingestion, RAG, etc.)
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   └── utils/           # Database, helpers
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── context/         # React context
│   │   └── App.jsx
│   ├── package.json
│   └── .env.example
├── Dockerfile
└── README.md
```

---

## 8. Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google` | Google OAuth login |
| GET | `/api/auth/github` | GitHub OAuth login |
| POST | `/api/repo/ingest` | Ingest GitHub repository |
| POST | `/api/ai/chat` | Chat with repo |
| GET | `/api/repo/tree` | Get repo file tree |
| GET | `/api/repo/analytics` | Repo analytics |

---

## 9. Production Deployment Notes

- Use strong `SESSION_SECRET_KEY`
- Set `https_only=True` in SessionMiddleware (already set)
- Configure proper CORS origins
- Use managed PostgreSQL (Aiven, Supabase, Neon)
- Use Pinecone serverless or dedicated
- Set up proper OAuth redirect URIs for production domains

---

## Support

- Check logs in terminal for errors
- Backend logs show SQL queries and API calls
- Frontend console shows network errors
- Pinecone console shows vector operations
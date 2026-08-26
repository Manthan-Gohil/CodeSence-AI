# PROJECT_EVALUATION.md

## CodeSense AI - AI-Powered Semantic Code Intelligence & Repository Assistant

---

### 1. Application Description

CodeSense AI is a RAG-based platform that enables developers to chat with any public GitHub repository using a local LLM (Code Llama via Ollama). Users authenticate via Google/GitHub OAuth, paste a repository URL, and can immediately ask questions about the codebase. The system ingests the repository, chunks the source files, generates embeddings using a local Ollama model (nomic-embed-text), stores vectors in a local FAISS index, and retrieves relevant context for each query to provide accurate, code-aware answers.

---

### 2. Problem Addressed

Onboarding to unfamiliar codebases is slow and overwhelming. Developers joining new projects, contributing to open source, or reviewing PRs spend hours searching through files to understand architecture, find implementations, or debug issues. Traditional keyword search fails to capture semantic meaning. CodeSense AI solves this by providing natural language Q&A over the entire codebase with semantic retrieval, reducing onboarding time from hours to minutes.

---

### 3. Knowledge/Data Source

The primary knowledge source is the **ingested GitHub repository's source files**. During ingestion:
- All source files are fetched via GitHub API (respecting size limits and excluding build/vendor directories)
- Files are split into token-aware chunks (~800 tokens with 120 overlap)
- Each chunk preserves metadata: file path, size, chunk index, token count
- Chunks are embedded using `nomic-embed-text` (768-dim) via Ollama
- Vectors stored in FAISS index (persisted to disk at `./faiss_index/{namespace}`)
- Repository metadata (file tree, analytics, dependency graph) stored in PostgreSQL

---

### 4. How RAG is Used

**Chunking**: Source files → token-aware chunks (configurable 800 tokens, 120 overlap) using tiktoken cl100k_base encoding

**Embedding**: Each chunk → 768-dim vector via `nomic-embed-text` (local Ollama, no external API)

**Retrieval**: User query → embedded → FAISS similarity search (cosine, top-k=5) → relevant chunks returned with metadata

**Context Assembly**: Retrieved chunks → formatted as context → prepended to user query

**Generation**: Context + Query → Code Llama (via Ollama) → Answer

This ensures answers are grounded in actual repository code, not hallucinated.

---

### 5. LLM Role

**Code Llama (via Ollama)** serves two roles:
1. **Embedding-adjacent understanding**: `nomic-embed-text` model converts code/text to semantic vectors for retrieval
2. **Final response generation**: `codellama` model generates answers using retrieved context + user query

Both run locally via Ollama (`http://localhost:11434`), eliminating external API dependencies, costs, and latency from cloud providers. GPU acceleration recommended for reasonable speed.

---

### 6. Architecture Diagram

```mermaid
graph TD
    User[User Browser] -->|HTTPS| AppSvc[Application Service :8000]
    AppSvc -->|OAuth2| Google[Google OAuth]
    AppSvc -->|OAuth2| GitHub[GitHub OAuth]
    
    subgraph "Backend Services"
        AppSvc -->|HTTP: /ingest| DataSvc[Data Service :8003]
        AppSvc -->|HTTP: /chat, /compare| RAGSvc[RAG Service :8002]
        AppSvc -->|HTTP: /generate| LLMSvc[LLM Service :8001]
        
        DataSvc -->|HTTP: /chunks/upsert| RAGSvc
        DataSvc -->|GitHub API| GitHubAPI[(GitHub API)]
        DataSvc -->|SQL| Postgres[(PostgreSQL :5432)]
        
        RAGSvc -->|HTTP: /embed, /embed_query| LLMSvc
        RAGSvc -->|FAISS Index| FAISS[(FAISS Vector Store : file-based)]
        
        LLMSvc -->|HTTP: /api/generate, /api/embeddings| Ollama[(Ollama :11434)]
    end
    
    Ollama -->|GPU| CodeLlama[Code Llama Model]
    Ollama -->|GPU| NomicEmbed[nomic-embed-text Model]
    
    Frontend[React Frontend :5173] -->|HTTPS| AppSvc
```

**Service Communication (REST over HTTP):**

| From | To | Endpoint | Purpose |
|------|-----|----------|---------|
| Application | Data | `POST /ingest` | Trigger repo ingestion |
| Application | Data | `POST /metadata` | Get repo analytics/tree |
| Application | Data | `POST /active/set` | Set user's active repo |
| Application | RAG | `POST /chat` | RAG-based Q&A |
| Application | RAG | `POST /compare` | RAG vs non-RAG comparison |
| Data | RAG | `POST /chunks/upsert` | Store chunk embeddings |
| RAG | LLM | `POST /generate` | Generate LLM response |
| RAG | LLM | `POST /embed` | Get embeddings |
| LLM | Ollama | `POST /api/generate` | Call Code Llama |
| LLM | Ollama | `POST /api/embeddings` | Get nomic-embed-text vectors |

---

### 7. Exercise Mapping

| Exercise | Files/Folders/Endpoints | Status |
|----------|------------------------|--------|
| **1. Replace OpenAI with Ollama + Code Llama** | `backend/services/llm_service/main.py` - `/generate`, `/embed`, `/health`<br>`backend/services/rag_service/main.py` - uses `ChatOllama`, `OllamaEmbeddings`<br>`backend/services/application_service/main.py` - orchestrates<br>`backend/requirements.txt` - `faiss-cpu`, removed `openai`, `langchain-openai`, `pinecone`<br>`backend/app/core/config.py` - `LLM_MODEL=codellama`, `EMBED_MODEL=nomic-embed-text`, `FAISS_INDEX_DIR` | ✅ Complete |
| **2. Knowledge base / chunking / embeddings (local)** | `backend/services/data_service/main.py` - `chunk_files_mem()`, `list_and_get_files()`<br>`backend/services/rag_service/main.py` - `upsert_chunks()`, FAISS persistence<br>`backend/services/llm_service/main.py` - `OllamaEmbeddings(nomic-embed-text)`<br>No Pinecone, no OpenAI embeddings | ✅ Complete |
| **3. Retrieval + RAG + Comparison** | `backend/services/rag_service/main.py` - `/chat`, `/compare`, `/search`<br>`backend/services/application_service/main.py` - `POST /chat`, `POST /compare_rag`<br>`chat_with_rag_comparison()` returns `{query, with_rag, without_rag, provider}` | ✅ Complete |
| **4. Decompose into 4 services** | **Application Service**: `backend/services/application_service/main.py` (port 8000)<br>**RAG Service**: `backend/services/rag_service/main.py` (port 8002)<br>**LLM Service**: `backend/services/llm_service/main.py` (port 8001)<br>**Data Service**: `backend/services/data_service/main.py` (port 8003)<br>Shared models: `backend/services/data_service/models.py`<br>REST communication between all services | ✅ Complete |
| **5. Dockerize everything** | `docker-compose.yml` - 7 services (postgres, ollama, data, rag, llm, app, frontend)<br>`backend/Dockerfile.service` - shared service image<br>`frontend/Dockerfile.dev` - Vite dev server<br>Ollama auto-pulls `nomic-embed-text` and `codellama` on startup<br>FAISS persisted via `faiss_data` volume<br>PostgreSQL via `postgres_data` volume | ✅ Complete |

---

### 8. Setup & Run Instructions

#### Local Development (without Docker)

**Prerequisites:**
- Python 3.12+
- Node.js 20+
- PostgreSQL 15+
- Ollama installed (`curl -fsSL https://ollama.ai/install.sh | sh`)

**1. Start Ollama & pull models:**
```bash
ollama serve &
ollama pull nomic-embed-text
ollama pull codellama
```

**2. Start PostgreSQL:**
```bash
createdb codesense_ai
```

**3. Backend services (4 terminals):**
```bash
cd backend

# Terminal 1: LLM Service (port 8001)
OLLAMA_BASE_URL=http://localhost:11434 uvicorn services.llm_service.main:app --port 8001 --reload

# Terminal 2: RAG Service (port 8002)
OLLAMA_BASE_URL=http://localhost:11434 FAISS_INDEX_DIR=./faiss_index uvicorn services.rag_service.main:app --port 8002 --reload

# Terminal 3: Data Service (port 8003)
DATABASE_URL=postgresql://user:password@localhost:5432/codesense_ai GITHUB_TOKEN=<your_token> uvicorn services.data_service.main:app --port 8003 --reload

# Terminal 4: Application Service (port 8000)
DATABASE_URL=postgresql://user:password@localhost:5432/codesense_ai \
SESSION_SECRET_KEY=<secret> \
ENCRYPTION_KEY=<fernet_key> \
RAG_SERVICE_URL=http://localhost:8002 \
LLM_SERVICE_URL=http://localhost:8001 \
DATA_SERVICE_URL=http://localhost:8003 \
GOOGLE_CLIENT_ID=<id> GOOGLE_CLIENT_SECRET=<secret> \
GITHUB_CLIENT_ID=<id> GITHUB_CLIENT_SECRET=<secret> \
uvicorn services.application_service.main:app --port 8000 --reload
```

**4. Frontend (terminal 5):**
```bash
cd frontend
npm install
npm run dev
```

**5. Access:**
- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

---

#### Docker Compose (Recommended)

**1. Create `.env` file:**
```bash
# Backend .env
SESSION_SECRET_KEY=your-32-char-secret
ENCRYPTION_KEY=your-fernet-key
GITHUB_TOKEN=ghp_xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

**2. Run:**
```bash
docker-compose up --build
```

**3. Access:**
- Frontend: http://localhost:5173
- Application API: http://localhost:8000
- Health check: http://localhost:8000/health (shows all service status)

**4. Stop:**
```bash
docker-compose down -v  # -v removes volumes (data)
```

---

### 9. Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| **Local Code Llama quality vs OpenAI GPT-4** | Lower reasoning accuracy, more hallucinations | Use larger models (codellama:34b), fine-tune, or hybrid approach |
| **Latency** | 5-30s per query on CPU; 1-5s on GPU | Use GPU (NVIDIA), smaller models, batch queries |
| **Hardware requirements** | 8GB+ RAM for 7B model; 24GB+ for 34B; GPU strongly recommended | Document minimum specs; provide cloud deployment option |
| **No streaming responses** | UX feels slower | Add Server-Sent Events / WebSocket streaming |
| **Single-user FAISS index** | Namespace isolation only; no multi-tenancy at vector level | Use separate FAISS indices per user/repo (current design) |
| **GitHub API rate limits** | 5000 req/hr authenticated | Cache repo data; use GitHub App for higher limits |
| **No incremental updates** | Full re-ingestion needed for repo changes | Implement git diff-based incremental ingestion |
| **Context window limits** | Code Llama 4k-16k tokens; large repos exceed | Implement hierarchical retrieval, summarization |
| **No evaluation metrics** | Hard to measure RAG quality | Add retrieval precision/recall, answer correctness eval |

---

### 10. Git History

Each exercise committed separately for evaluation:

```bash
# Exercise 1: Replace OpenAI with Ollama + Code Llama
git log --oneline | grep "exercise1"

# Exercise 2: Local embeddings + FAISS
git log --oneline | grep "exercise2"

# Exercise 3: RAG Comparison
git log --oneline | grep "exercise3"

# Exercise 4: 4-Service Decomposition
git log --oneline | grep "exercise4"

# Exercise 5: Docker Compose
git log --oneline | grep "exercise5"
```

---
*Generated for university lab assignment evaluation*
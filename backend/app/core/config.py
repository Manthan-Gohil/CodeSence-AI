import os
from starlette.config import Config

# Look for .env in current directory or backend directory
env_file = '.env'
if not os.path.exists(env_file):
    if os.path.exists('backend/.env'):
        env_file = 'backend/.env'
    elif os.path.exists('../backend/.env'):
        env_file = '../backend/.env'

config = Config(env_file)

SESSION_SECRET_KEY = config('SESSION_SECRET_KEY', cast=str, default="00266e1f1ffd4e95b114e072225d3923ef6327bad4a277f60474a1ca62f63f35")
BASE_URL = config('BASE_URL', cast=str, default="http://localhost:8000")
FRONT_END_URL = config('FRONT_END_URL', cast=str, default="http://localhost:5173")
GOOGLE_CLIENT_ID = config('GOOGLE_CLIENT_ID', cast=str, default="")
GOOGLE_CLIENT_SECRET = config('GOOGLE_CLIENT_SECRET', cast=str, default="")
GITHUB_CLIENT_ID = config('GITHUB_CLIENT_ID', cast=str, default="")
GITHUB_CLIENT_SECRET = config('GITHUB_CLIENT_SECRET', cast=str, default="")
DATABASE_URL = config('DATABASE_URL', cast=str, default="postgresql://user:password@localhost:5432/codesense_ai")

# Ollama & Embedding models
OLLAMA_BASE_URL = config('OLLAMA_BASE_URL', cast=str, default="http://localhost:11434")
EMBED_MODEL = config('EMBED_MODEL', cast=str, default="nomic-embed-text")
LLM_MODEL = config('LLM_MODEL', cast=str, default="codellama")
GEMINI_EMBED_MODEL = config('GEMINI_EMBED_MODEL', cast=str, default="gemini-1.5-flash")
GEMINI_LLM_MODEL = config('GEMINI_LLM_MODEL', cast=str, default="models/text-embedding-004")

# Ingestion bounds
GITHUB_DENY_DIRS = "node_modules,dist,build,.git,__pycache__,.venv,venv,target,.next,.vercel,out"
GITHUB_STREAMING_THRESHOLD_BYTES = 256_000
GITHUB_MAX_BYTES_PER_FILE = 2_000_000
GITHUB_REPO_INGEST_BYTE_BUDGET = 250_000_000
GITHUB_MAX_FILES_PER_REPO = 10_000
GITHUB_MAX_INGEST_SECONDS = 600

# Token-aware chunking
CHUNK_TOKENS = 800
CHUNK_OVERLAP_TOKENS = 120
MAX_CHUNKS_PER_FILE = 2000
REPO_WIDE_CHUNK_BUDGET = 50000

# FAISS Vector Store
FAISS_INDEX_DIR = config('FAISS_INDEX_DIR', cast=str, default="./faiss_index")
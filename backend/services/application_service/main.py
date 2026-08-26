# services/application_service/main.py
"""
Application Service - Handles user requests, auth (OAuth2), orchestrates calls to other services
Serves the React frontend's API needs
"""
import os
import json
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Body, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Text
from sqlalchemy.orm import sessionmaker, declarative_base
from authlib.integrations.starlette_client import OAuth

app = FastAPI(title="Application Service", version="1.0.0")

# Config
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/codesense_ai")
SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "dev-secret")
FRONT_END_URL = os.getenv("FRONT_END_URL", "http://localhost:5173")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

# Service URLs
RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://localhost:8002")
LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://localhost:8001")
DATA_SERVICE_URL = os.getenv("DATA_SERVICE_URL", "http://localhost:8003")

# Database
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class APIKey(Base):
    __tablename__ = "api_keys"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=False)
    encrypted_key = Column(Text, nullable=False)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True)
    namespace = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# OAuth
oauth = OAuth()
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)
oauth.register(
    name='github',
    client_id=GITHUB_CLIENT_ID,
    client_secret=GITHUB_CLIENT_SECRET,
    access_token_url='https://github.com/login/oauth/access_token',
    authorize_url='https://github.com/login/oauth/authorize',
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'user:email'},
)

# Encryption
from cryptography.fernet import Fernet
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if ENCRYPTION_KEY:
    cipher_suite = Fernet(ENCRYPTION_KEY.encode())
else:
    cipher_suite = None

def encrypt_key(key: str) -> str:
    if cipher_suite:
        return cipher_suite.encrypt(key.encode()).decode()
    return key

def decrypt_key(encrypted: str) -> str:
    if cipher_suite:
        return cipher_suite.decrypt(encrypted.encode()).decode()
    return encrypted

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONT_END_URL, "http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET_KEY,
    https_only=False,
    same_site="lax"
)

# Models
class ChatRequest(BaseModel):
    user_id: str
    message: str
    provider: Optional[str] = None

class ChatResponse(BaseModel):
    result: str

class CompareRAGRequest(BaseModel):
    query: str
    user_id: str
    provider: str = "ollama"

class APIKeyRequest(BaseModel):
    user_id: str
    provider: str
    api_key: Optional[str] = None

class IngestRepoRequest(BaseModel):
    repo_url: str
    user_id: str
    provider: str = "ollama"

# OAuth Routes
@app.get("/auth/login/google")
async def login_google(request: Request):
    redirect_uri = f"{request.base_url}auth/callback/google"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/auth/callback/google")
async def auth_callback_google(request: Request):
    token = await oauth.google.authorize_access_token(request)
    user = token.get('userinfo')
    if user:
        request.session['user'] = dict(user)
    return {"user": user, "redirect": FRONT_END_URL}

@app.get("/auth/login/github")
async def login_github(request: Request):
    redirect_uri = f"{request.base_url}auth/callback/github"
    return await oauth.github.authorize_redirect(request, redirect_uri)

@app.get("/auth/callback/github")
async def auth_callback_github(request: Request):
    token = await oauth.github.authorize_access_token(request)
    resp = await oauth.github.get('user', token=token)
    user = resp.json()
    if user:
        request.session['user'] = dict(user)
    return {"user": user, "redirect": FRONT_END_URL}

@app.get("/auth/me")
async def get_current_user(request: Request):
    user = request.session.get('user')
    return {"user": user}

@app.post("/auth/logout")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True}

# API Key Management
@app.post("/api-key/set")
async def set_api_key(req: APIKeyRequest, db: Session = Depends(get_db)):
    if req.provider == "ollama":
        # Ollama doesn't need API key
        return {"ok": True, "provider": "ollama"}
    
    if not req.api_key:
        raise HTTPException(400, "API key required for non-Ollama providers")
    
    encrypted = encrypt_key(req.api_key)
    api_key = APIKey(
        id=f"{req.user_id}_{req.provider}",
        user_id=req.user_id,
        provider=req.provider,
        encrypted_key=encrypted
    )
    db.merge(api_key)
    db.commit()
    return {"ok": True}

@app.post("/api-key/get")
async def get_api_key(user_id: str = Body(...), provider: str = Body(...), db: Session = Depends(get_db)):
    key = db.query(APIKey).filter(APIKey.user_id == user_id, APIKey.provider == provider).first()
    if key:
        return {"exists": True, "masked": "****" + decrypt_key(key.encrypted_key)[-4:]}
    return {"exists": False}

@app.post("/api-key/delete")
async def delete_api_key(user_id: str = Body(...), provider: str = Body(...), db: Session = Depends(get_db)):
    deleted = db.query(APIKey).filter(APIKey.user_id == user_id, APIKey.provider == provider).delete()
    db.commit()
    return {"deleted": deleted > 0}

# Chat Endpoint - Orchestrates RAG Service
@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    # Get active repo
    from services.data_service.main import ActiveRepo
    active = db.query(ActiveRepo).filter(ActiveRepo.user_id == req.user_id).first()
    if not active:
        raise HTTPException(400, "No active repo. Ingest a repo first.")
    
    namespace = f"{req.user_id}_{active.repo_url.rstrip('/').split('/')[-1]}"
    provider = req.provider or active.provider or "ollama"
    
    # Get API key if needed
    api_key = None
    if provider != "ollama":
        key_obj = db.query(APIKey).filter(APIKey.user_id == req.user_id, APIKey.provider == provider).first()
        if key_obj:
            api_key = decrypt_key(key_obj.encrypted_key)
        else:
            raise HTTPException(401, f"No {provider} API key set")
    
    # Call RAG Service
    import requests
    try:
        rag_resp = requests.post(
            f"{RAG_SERVICE_URL}/chat",
            json={"query": req.message, "namespace": namespace, "provider": provider, "k": 5},
            timeout=60
        )
        rag_resp.raise_for_status()
        result = rag_resp.json()
        
        # Log chat
        # TODO: Save to chat_messages table
        
        return ChatResponse(result=result.get("result", "No response"))
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"RAG service error: {str(e)}")

# RAG Comparison - Orchestrates RAG Service
@app.post("/compare_rag")
async def compare_rag(req: CompareRAGRequest, db: Session = Depends(get_db)):
    active = db.query(ActiveRepo).filter(ActiveRepo.user_id == req.user_id).first()
    if not active:
        raise HTTPException(400, "No active repo")
    
    namespace = f"{req.user_id}_{active.repo_url.rstrip('/').split('/')[-1]}"
    provider = req.provider
    
    api_key = None
    if provider != "ollama":
        key_obj = db.query(APIKey).filter(APIKey.user_id == req.user_id, APIKey.provider == provider).first()
        if key_obj:
            api_key = decrypt_key(key_obj.encrypted_key)
    
    import requests
    try:
        resp = requests.post(
            f"{RAG_SERVICE_URL}/compare",
            json={"query": req.query, "namespace": namespace, "provider": provider, "k": 5},
            timeout=60
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"RAG service error: {str(e)}")

# Repo Ingestion - Orchestrates Data Service
@app.post("/repo/ingest")
async def ingest_repo(req: IngestRepoRequest, db: Session = Depends(get_db)):
    import requests
    try:
        resp = requests.post(
            f"{DATA_SERVICE_URL}/ingest",
            json=req.dict(),
            timeout=300
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"Data service error: {str(e)}")

@app.post("/repo/metadata")
async def get_repo_metadata(repo_url: str = Body(..., embed=True), db: Session = Depends(get_db)):
    import requests
    try:
        resp = requests.post(
            f"{DATA_SERVICE_URL}/metadata",
            json={"repo_url": repo_url},
            timeout=30
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"Data service error: {str(e)}")

@app.post("/repo/active/set")
async def set_active_repo(req: IngestRepoRequest, db: Session = Depends(get_db)):
    import requests
    try:
        resp = requests.post(
            f"{DATA_SERVICE_URL}/active/set",
            json=req.dict(),
            timeout=30
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"Data service error: {str(e)}")

@app.post("/repo/active/get")
async def get_active_repo(user_id: str = Body(..., embed=True), db: Session = Depends(get_db)):
    import requests
    try:
        resp = requests.post(
            f"{DATA_SERVICE_URL}/active/get",
            json={"user_id": user_id},
            timeout=30
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"Data service error: {str(e)}")

@app.post("/repo/active/delete")
async def delete_active_repo(user_id: str = Body(..., embed=True), db: Session = Depends(get_db)):
    import requests
    try:
        resp = requests.post(
            f"{DATA_SERVICE_URL}/active/delete",
            json={"user_id": user_id},
            timeout=30
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"Data service error: {str(e)}")

# File content - Orchestrates Data Service
@app.post("/repo/file/content")
async def get_file_content(owner: str = Body(...), repo: str = Body(...), file_path: str = Body(...)):
    import requests
    try:
        resp = requests.post(
            f"{DATA_SERVICE_URL}/file/content",
            json={"owner": owner, "repo": repo, "file_path": file_path},
            timeout=30
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"Data service error: {str(e)}")

# File tree - Orchestrates Data Service
@app.get("/repo/files")
async def list_repo_files(owner: str = Query(...), repo: str = Query(...)):
    import requests
    try:
        resp = requests.get(
            f"{DATA_SERVICE_URL}/files",
            params={"owner": owner, "repo": repo},
            timeout=30
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"Data service error: {str(e)}")

# Health check - checks all services
@app.get("/health")
async def health_check():
    import requests
    services = {
        "application": "healthy",
        "rag": "unknown",
        "llm": "unknown",
        "data": "unknown"
    }
    
    for name, url in [("rag", RAG_SERVICE_URL), ("llm", LLM_SERVICE_URL), ("data", DATA_SERVICE_URL)]:
        try:
            resp = requests.get(f"{url}/health", timeout=5)
            services[name] = "healthy" if resp.status_code == 200 else "unhealthy"
        except:
            services[name] = "unreachable"
    
    return services

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
# services/application_service/main.py
"""
Application Service - Handles user requests, auth (OAuth2), orchestrates calls to other services.
Serves the React frontend's API needs (under /api) as well as direct microservice endpoints.
"""
import os
import json
import base64
import uuid
from dotenv import load_dotenv

load_dotenv()
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Body, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Text, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from authlib.integrations.starlette_client import OAuth, OAuthError
from cryptography.fernet import Fernet
import requests
from datetime import datetime

app = FastAPI(title="Application Service", version="1.0.0")

# Config
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/codesense_ai")
SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "00266e1f1ffd4e95b114e072225d3923ef6327bad4a277f60474a1ca62f63f35")
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
FRONT_END_URL = os.getenv("FRONT_END_URL", "http://localhost:5173")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
HTTPS_ONLY = os.getenv("HTTPS_ONLY", "false").lower() == "true"

# Service URLs
RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://localhost:8002")
LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://localhost:8001")
DATA_SERVICE_URL = os.getenv("DATA_SERVICE_URL", "http://localhost:8003")

# Database setup
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
    created_at = Column(DateTime, default=datetime.utcnow)

class ActiveRepo(Base):
    __tablename__ = "active_repos"
    user_id = Column(String, primary_key=True)
    repo_url = Column(String, nullable=False)
    provider = Column(String, nullable=False, default="ollama")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# OAuth Configuration
oauth = OAuth()
if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    oauth.register(
        name='google',
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'},
    )
if GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET:
    oauth.register(
        name='github',
        client_id=GITHUB_CLIENT_ID,
        client_secret=GITHUB_CLIENT_SECRET,
        access_token_url='https://github.com/login/oauth/access_token',
        authorize_url='https://github.com/login/oauth/authorize',
        api_base_url='https://api.github.com/',
        client_kwargs={'scope': 'user:email'},
    )

# Encryption Handling
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
cipher_suite = None
if ENCRYPTION_KEY:
    try:
        cipher_suite = Fernet(ENCRYPTION_KEY.encode())
    except Exception:
        try:
            safe_key = base64.urlsafe_b64encode(ENCRYPTION_KEY.encode().ljust(32)[:32])
            cipher_suite = Fernet(safe_key)
        except Exception:
            cipher_suite = None

def encrypt_key(key: str) -> str:
    if not key:
        return ""
    if cipher_suite:
        try:
            return cipher_suite.encrypt(key.encode()).decode()
        except Exception:
            return key
    return key

def decrypt_key(encrypted: str) -> str:
    if not encrypted:
        return ""
    if cipher_suite:
        try:
            return cipher_suite.decrypt(encrypted.encode()).decode()
        except Exception:
            return encrypted
    return encrypted

# CORS & Sessions
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
    https_only=HTTPS_ONLY,
    same_site="none" if HTTPS_ONLY else "lax"
)

# Request Models
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

class GenericUserRequest(BaseModel):
    user_id: str

class FeedbackIn(BaseModel):
    name: str
    from_email: Optional[str] = None
    category: str
    title: str
    description: str
    steps: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    browser_info: Optional[str] = None
    additional_info: Optional[str] = None
    time: Optional[str] = None

# ==========================================
# Auth Routes (supports /auth and /api/auth)
# ==========================================
@app.get("/auth/login/{provider}")
@app.get("/api/login/{provider}")
async def login_oauth(provider: str, request: Request):
    if provider not in ("google", "github"):
        raise HTTPException(400, "Unsupported provider")
    client = getattr(oauth, provider, None)
    if not client:
        raise HTTPException(500, f"{provider} OAuth client is not configured")
    redirect_uri = f"{BASE_URL}/api/auth/{provider}/callback"
    return await client.authorize_redirect(request, redirect_uri)

@app.get("/auth/callback/{provider}")
@app.get("/api/auth/{provider}/callback")
async def auth_callback(provider: str, request: Request):
    client = getattr(oauth, provider, None)
    if not client:
        return RedirectResponse(f"{FRONT_END_URL}/?error=no_client")
    try:
        token = await client.authorize_access_token(request)
    except OAuthError as e:
        return RedirectResponse(f"{FRONT_END_URL}/?error=auth_failed")

    user = None
    if provider == "google":
        user_info = token.get("userinfo")
        if user_info:
            user = {
                "id": str(user_info.get("sub")),
                "name": user_info.get("name"),
                "email": user_info.get("email"),
                "picture": user_info.get("picture"),
                "provider": "google"
            }
    elif provider == "github":
        github_token = os.getenv("GITHUB_TOKEN")
        headers = {"Authorization": f"token {github_token}"} if github_token else {}
        resp = await client.get("user", token=token, headers=headers)
        info = resp.json()
        email = info.get("email") or ""
        user = {
            "id": str(info.get("id")),
            "name": info.get("name") or info.get("login"),
            "email": email,
            "picture": info.get("avatar_url"),
            "provider": "github"
        }

    if user:
        request.session["user"] = user
        return RedirectResponse(f"{FRONT_END_URL}/home")
    return RedirectResponse(f"{FRONT_END_URL}/?error=user_info_failed")

@app.get("/auth/me")
@app.get("/api/user")
async def get_current_user(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@app.get("/api/logout")
@app.post("/auth/logout")
@app.post("/api/logout")
async def logout(request: Request):
    request.session.clear()
    return {"detail": "Logged out", "ok": True}

# ==========================================
# API Key Management
# ==========================================
@app.post("/api-key/set")
@app.post("/api/ai/validate_api_key")
async def set_api_key(req: APIKeyRequest, db: Session = Depends(get_db)):
    if req.provider == "ollama":
        return {"valid": True, "ok": True, "provider": "ollama"}
    
    if not req.api_key:
        return {"valid": False, "error": f"API key required for {req.provider}"}
    
    encrypted = encrypt_key(req.api_key)
    api_key_obj = APIKey(
        id=f"{req.user_id}_{req.provider}",
        user_id=req.user_id,
        provider=req.provider,
        encrypted_key=encrypted
    )
    db.merge(api_key_obj)
    db.commit()
    return {"valid": True, "ok": True}

@app.post("/api-key/get")
@app.post("/api/ai/get_api_key")
async def get_api_key(body: Dict = Body(...), db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    provider = body.get("provider", "gemini")
    # If Gemini is requested and env has GEMINI_API_KEY, report active immediately
    if provider == "gemini" and os.getenv("GEMINI_API_KEY"):
        env_key = os.getenv("GEMINI_API_KEY")
        return {"exists": True, "masked": "****" + env_key[-4:], "masked_key": "****" + env_key[-4:]}
    if provider == "ollama":
        return {"exists": True, "masked_key": "local"}
    key = db.query(APIKey).filter(APIKey.user_id == user_id, APIKey.provider == provider).first()
    if key and key.encrypted_key:
        decrypted = decrypt_key(key.encrypted_key)
        return {"exists": True, "masked": "****" + decrypted[-4:], "masked_key": "****" + decrypted[-4:]}
    return {"exists": False, "masked_key": ""}

@app.post("/api-key/delete")
@app.delete("/api/ai/delete_api_key")
async def delete_api_key(body: Dict = Body(...), db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    provider = body.get("provider", "gemini")
    deleted = db.query(APIKey).filter(APIKey.user_id == user_id, APIKey.provider == provider).delete()
    db.commit()
    return {"deleted": deleted > 0, "ok": True}

# ==========================================
# Chat & RAG Endpoints
# ==========================================
@app.post("/chat", response_model=ChatResponse)
@app.post("/api/ai/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    active = db.query(ActiveRepo).filter(ActiveRepo.user_id == req.user_id).first()
    if not active:
        raise HTTPException(400, "No active repo set. Ingest a repo first.")
    
    repo_name = active.repo_url.rstrip("/").split("/")[-1]
    namespace = f"{req.user_id}_{repo_name}"
    
    # Default to Gemini (fast 1-2s response, no CPU hang)
    default_provider = os.getenv("DEFAULT_LLM_PROVIDER", "gemini")
    provider = req.provider or active.provider or default_provider
    if provider.lower() in ("openai", "ollama"):
        # Always prefer Gemini if available
        if os.getenv("GEMINI_API_KEY"):
            provider = "gemini"
    
    # Retrieve user API key or fallback to environment GEMINI_API_KEY
    api_key = None
    if provider == "gemini":
        key_record = db.query(APIKey).filter(APIKey.user_id == req.user_id, APIKey.provider == "gemini").first()
        if key_record and key_record.encrypted_key:
            try:
                api_key = decrypt_key(key_record.encrypted_key)
            except Exception:
                pass
        if not api_key:
            api_key = os.getenv("GEMINI_API_KEY")
    
    try:
        top_k = int(os.getenv("RAG_TOP_K", "4"))
        rag_resp = requests.post(
            f"{RAG_SERVICE_URL}/chat",
            json={"query": req.message, "namespace": namespace, "provider": provider, "api_key": api_key, "k": top_k},
            timeout=300
        )

        rag_resp.raise_for_status()
        result_data = rag_resp.json()
        result_text = result_data.get("result", "No response from AI")
        
        # Save messages to database
        user_msg = ChatMessage(
            id=str(uuid.uuid4()),
            namespace=namespace,
            user_id=req.user_id,
            role="user",
            content=req.message
        )
        asst_msg = ChatMessage(
            id=str(uuid.uuid4()),
            namespace=namespace,
            user_id=req.user_id,
            role="assistant",
            content=result_text
        )
        db.add(user_msg)
        db.add(asst_msg)
        db.commit()
        
        return ChatResponse(result=result_text)
    except requests.exceptions.RequestException as e:
        err_msg = str(e)
        if hasattr(e, 'response') and e.response is not None:
            try:
                err_data = e.response.json()
                err_msg = err_data.get("detail", e.response.text)
            except Exception:
                err_msg = e.response.text or str(e)
        raise HTTPException(502, f"RAG error: {err_msg}")


@app.post("/api/ai/get_chat_history")
async def get_chat_history(body: GenericUserRequest, db: Session = Depends(get_db)):
    active = db.query(ActiveRepo).filter(ActiveRepo.user_id == body.user_id).first()
    if not active:
        return {"messages": []}
    repo_name = active.repo_url.rstrip("/").split("/")[-1]
    namespace = f"{body.user_id}_{repo_name}"
    messages = db.query(ChatMessage).filter(ChatMessage.namespace == namespace).order_by(ChatMessage.created_at.asc()).all()
    return {
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in messages
        ]
    }

@app.delete("/api/ai/delete_message")
async def delete_chat_msg(msg_id: str = Query(...), user_id: str = Query(...), db: Session = Depends(get_db)):
    db.query(ChatMessage).filter(ChatMessage.id == msg_id, ChatMessage.user_id == user_id).delete()
    db.commit()
    return {"deleted": True}

@app.post("/compare_rag")
@app.post("/api/compare_rag")
async def compare_rag(req: CompareRAGRequest, db: Session = Depends(get_db)):
    active = db.query(ActiveRepo).filter(ActiveRepo.user_id == req.user_id).first()
    if not active:
        raise HTTPException(400, "No active repo found")
    
    repo_name = active.repo_url.rstrip("/").split("/")[-1]
    namespace = f"{req.user_id}_{repo_name}"
    
    try:
        resp = requests.post(
            f"{RAG_SERVICE_URL}/compare",
            json={"query": req.query, "namespace": namespace, "provider": req.provider, "k": 5},
            timeout=120
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(502, f"RAG service error: {str(e)}")

# ==========================================
# Repository & Ingestion Endpoints
# ==========================================
@app.post("/repo/ingest")
@app.post("/api/repo/ingest_repo")
async def ingest_repo(req: IngestRepoRequest, db: Session = Depends(get_db)):
    default_provider = os.getenv("DEFAULT_LLM_PROVIDER", "gemini")
    provider = req.provider or default_provider
    if provider.lower() in ("openai", "ollama") and os.getenv("GEMINI_API_KEY"):
        provider = "gemini"
        
    api_key = None
    if provider == "gemini":
        key_record = db.query(APIKey).filter(APIKey.user_id == req.user_id, APIKey.provider == "gemini").first()
        if key_record and key_record.encrypted_key:
            try:
                api_key = decrypt_key(key_record.encrypted_key)
            except Exception:
                pass
        if not api_key:
            api_key = os.getenv("GEMINI_API_KEY")
            
    payload = req.dict()
    payload["provider"] = provider
    payload["api_key"] = api_key

    try:
        resp = requests.post(
            f"{DATA_SERVICE_URL}/ingest",
            json=payload,
            timeout=600
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "status": "success",
            "ok": True,
            "repo_url": req.repo_url,
            "provider": req.provider,
            "chunks_added": data.get("chunks_added", 0),
            "namespace": data.get("namespace", f"{req.user_id}_{req.repo_url.rstrip('/').split('/')[-1]}")
        }
    except requests.exceptions.RequestException as e:
        err_msg = str(e)
        if hasattr(e, 'response') and e.response is not None:
            try:
                err_data = e.response.json()
                err_msg = err_data.get("detail", e.response.text)
            except Exception:
                err_msg = e.response.text or str(e)
        raise HTTPException(502, f"Data service error: {err_msg}")

@app.post("/repo/metadata")
@app.post("/api/repo/metadata")
async def get_repo_metadata(body: Dict = Body(...), db: Session = Depends(get_db)):
    repo_url = body.get("repo_url")
    user_id = body.get("user_id")
    if not repo_url and user_id:
        active = db.query(ActiveRepo).filter(ActiveRepo.user_id == user_id).first()
        if active:
            repo_url = active.repo_url
    
    if not repo_url:
        raise HTTPException(400, "No active repo found for user.")
        
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
@app.post("/api/repo/set_active_repo")
async def set_active_repo(req: IngestRepoRequest, db: Session = Depends(get_db)):
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
@app.post("/api/repo/get_active_repo")
async def get_active_repo(body: Dict = Body(...), db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(400, "user_id is required")
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
@app.post("/api/repo/switch_repo")
async def delete_active_repo(body: Dict = Body(...), db: Session = Depends(get_db)):
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(400, "user_id is required")
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

@app.post("/repo/file/content")
@app.post("/api/repo/get_file_content")
async def get_file_content(body: Dict = Body(...), db: Session = Depends(get_db)):
    owner = body.get("owner")
    repo = body.get("repo")
    file_path = body.get("file_path")
    user_id = body.get("user_id")
    
    if not file_path:
        raise HTTPException(400, "file_path is required")
        
    if not (owner and repo) and user_id:
        active = db.query(ActiveRepo).filter(ActiveRepo.user_id == user_id).first()
        if active:
            parts = active.repo_url.rstrip("/").split("/")
            owner, repo = parts[-2], parts[-1]
            
    if not (owner and repo):
        raise HTTPException(400, "Could not determine repository owner/name")
        
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

@app.get("/repo/files")
@app.get("/api/repo/files")
async def list_repo_files(owner: str = Query(...), repo: str = Query(...)):
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

@app.post("/api/discuss/feedback")
async def submit_feedback(payload: FeedbackIn):
    return {"ok": True, "message": "Feedback submitted successfully"}

# Health check
@app.get("/health")
async def health_check():
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

# Static frontend serving
dist_dir = None
for candidate in ["frontend/dist", "../frontend/dist", "dist"]:
    if os.path.isdir(candidate):
        dist_dir = candidate
        break

if dist_dir:
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")

@app.exception_handler(404)
async def custom_404_handler(request: Request, exc):
    if request.url.path.startswith("/api"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    if dist_dir:
        index_path = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
    return JSONResponse({"detail": "Not Found"}, status_code=404)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
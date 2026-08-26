# services/data_service/main.py
"""
Data Service - Owns GitHub repo ingestion, PostgreSQL metadata storage, file tree/hierarchy data
"""
import os
import json
import requests
from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException, Body, Depends
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Text, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime

app = FastAPI(title="Data Service", version="1.0.0")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/codesense_ai")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class RepoMetadata(Base):
    __tablename__ = "repo_metadata"
    repo_url = Column(String, primary_key=True)
    file_tree_json = Column(Text, nullable=False)
    analytics_json = Column(Text)
    dependency_graph_json = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ActiveRepo(Base):
    __tablename__ = "active_repos"
    user_id = Column(String, primary_key=True)
    repo_url = Column(String, nullable=False)
    provider = Column(String, nullable=False, default="ollama")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True)  # Using string for simplicity
    namespace = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class IngestRequest(BaseModel):
    repo_url: str
    user_id: str
    provider: str = "ollama"

class IngestResponse(BaseModel):
    ok: bool
    namespace: str
    chunks_added: int
    repo_name: str
    owner: str

class FileContentRequest(BaseModel):
    owner: str
    repo: str
    file_path: str

class RepoMetadataResponse(BaseModel):
    file_tree: Dict
    analytics: Dict
    dependency_graph: Dict

class SetActiveRepoRequest(BaseModel):
    user_id: str
    repo_url: str
    provider: str = "ollama"

class GetActiveRepoResponse(BaseModel):
    repo_url: Optional[str]
    provider: Optional[str]

GITHUB_API = "https://api.github.com"

def get_auth_headers():
    headers = {}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers

def list_and_get_files(owner: str, repo: str) -> List[Dict]:
    """Fetch all files from a GitHub repo"""
    headers = get_auth_headers()
    files = []
    
    def fetch_tree(sha: str, path: str = ""):
        url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{sha}?recursive=1"
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            return
        tree = resp.json().get('tree', [])
        for item in tree:
            if item['type'] == 'blob':
                file_url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{item['path']}"
                file_resp = requests.get(file_url, headers=headers)
                if file_resp.status_code == 200:
                    content = file_resp.json()
                    if content.get('encoding') == 'base64':
                        import base64
                        file_content = base64.b64decode(content['content']).decode('utf-8', errors='ignore')
                    else:
                        file_content = content.get('content', '')
                    files.append({
                        'path': item['path'],
                        'content': file_content,
                        'size': item.get('size', 0)
                    })
    
    # Get default branch
    repo_resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers)
    if repo_resp.status_code == 200:
        default_branch = repo_resp.json().get('default_branch', 'main')
        branch_resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}/branches/{default_branch}", headers=headers)
        if branch_resp.status_code == 200:
            commit_sha = branch_resp.json().get('commit', {}).get('sha')
            if commit_sha:
                fetch_tree(commit_sha)
    
    return files

def chunk_files_mem(files: List[Dict], max_chunk_size: int = 800, overlap: int = 120) -> List[Dict]:
    """Simple token-aware chunking"""
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    chunks = []
    
    for file in files:
        content = file['content']
        if not content:
            continue
            
        tokens = enc.encode(content)
        
        for i in range(0, len(tokens), max_chunk_size - overlap):
            chunk_tokens = tokens[i:i + max_chunk_size]
            chunk_text = enc.decode(chunk_tokens)
            chunks.append({
                'text': chunk_text,
                'metadata': {
                    'file_path': file['path'],
                    'file_size': file['size'],
                    'chunk_index': len(chunks),
                    'token_count': len(chunk_tokens)
                }
            })
    
    return chunks

def build_file_tree(files: List[Dict]) -> Dict:
    """Build hierarchical file tree"""
    tree = {}
    for file in files:
        parts = file['path'].split('/')
        current = tree
        for i, part in enumerate(parts):
            if i == len(parts) - 1:
                current[part] = None
            else:
                if part not in current:
                    current[part] = {}
                current = current[part]
    return tree

def analyze_repo(files: List[Dict]) -> Dict:
    """Analyze repo for dependency graph"""
    deps = {}
    for file in files:
        if file['path'].endswith(('.py', '.js', '.ts', '.java', '.go', '.rs')):
            # Simple import extraction
            imports = []
            for line in file['content'].split('\n'):
                line = line.strip()
                if line.startswith(('import ', 'from ', 'require(', 'import(')):
                    imports.append(line[:200])
            if imports:
                deps[file['path']] = imports[:20]
    return deps

@app.get("/health")
async def health_check():
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}

@app.post("/ingest", response_model=IngestResponse)
async def ingest_repo(req: IngestRequest, db: Session = Depends(get_db)):
    try:
        parts = req.repo_url.rstrip("/").split("/")
        owner, repo = parts[-2], parts[-1]
        namespace = f"{req.user_id}_{repo}"
        
        # Fetch files from GitHub
        files = list_and_get_files(owner, repo)
        if not files:
            raise HTTPException(404, "No files found in repo")
        
        # Chunk files
        chunks = chunk_files_mem(files)
        
        # Call RAG Service to store chunks
        try:
            rag_resp = requests.post(
                "http://localhost:8002/chunks/upsert",
                json={"chunks": chunks, "namespace": namespace, "provider": req.provider},
                timeout=60
            )
            rag_resp.raise_for_status()
            chunks_added = rag_resp.json().get("chunks_added", len(chunks))
        except Exception as e:
            print(f"RAG service call failed: {e}")
            chunks_added = len(chunks)
        
        # Get repo metadata from GitHub
        headers = get_auth_headers()
        repo_info = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers).json()
        languages = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}/languages", headers=headers).json()
        contributors = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}/contributors", headers=headers).json()
        
        analytics = {
            "repo_name": repo_info.get("name"),
            "owner": repo_info.get("owner", {}).get("login"),
            "description": repo_info.get("description"),
            "stars": repo_info.get("stargazers_count"),
            "forks": repo_info.get("forks_count"),
            "languages": languages,
            "contributors": [
                {"login": c.get("login"), "contributions": c.get("contributions"), "avatar_url": c.get("avatar_url")}
                for c in contributors[:10]
            ] if isinstance(contributors, list) else [],
        }
        
        file_tree = build_file_tree(files)
        dependency_graph = analyze_repo(files)
        
        # Store metadata in PostgreSQL
        meta = RepoMetadata(
            repo_url=req.repo_url,
            file_tree_json=json.dumps(file_tree),
            analytics_json=json.dumps(analytics),
            dependency_graph_json=json.dumps(dependency_graph)
        )
        db.merge(meta)
        
        # Set active repo
        active = ActiveRepo(user_id=req.user_id, repo_url=req.repo_url, provider=req.provider)
        db.merge(active)
        db.commit()
        
        return IngestResponse(
            ok=True,
            namespace=namespace,
            chunks_added=chunks_added,
            repo_name=repo,
            owner=owner
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/metadata", response_model=RepoMetadataResponse)
async def get_metadata(repo_url: str = Body(..., embed=True), db: Session = Depends(get_db)):
    meta = db.query(RepoMetadata).filter(RepoMetadata.repo_url == repo_url).first()
    if not meta:
        raise HTTPException(404, "Metadata not found")
    return RepoMetadataResponse(
        file_tree=json.loads(meta.file_tree_json),
        analytics=json.loads(meta.analytics_json) if meta.analytics_json else {},
        dependency_graph=json.loads(meta.dependency_graph_json) if meta.dependency_graph_json else {}
    )

@app.post("/active/set", response_model=GetActiveRepoResponse)
async def set_active_repo(req: SetActiveRepoRequest, db: Session = Depends(get_db)):
    active = ActiveRepo(user_id=req.user_id, repo_url=req.repo_url, provider=req.provider)
    db.merge(active)
    db.commit()
    return GetActiveRepoResponse(repo_url=req.repo_url, provider=req.provider)

@app.post("/active/get", response_model=GetActiveRepoResponse)
async def get_active_repo(user_id: str = Body(..., embed=True), db: Session = Depends(get_db)):
    active = db.query(ActiveRepo).filter(ActiveRepo.user_id == user_id).first()
    if not active:
        return GetActiveRepoResponse(repo_url=None, provider=None)
    return GetActiveRepoResponse(repo_url=active.repo_url, provider=active.provider)

@app.post("/active/delete")
async def delete_active_repo(user_id: str = Body(..., embed=True), db: Session = Depends(get_db)):
    db.query(ActiveRepo).filter(ActiveRepo.user_id == user_id).delete()
    db.commit()
    return {"ok": True}

@app.post("/file/content")
async def get_file_content(req: FileContentRequest):
    headers = get_auth_headers()
    url = f"{GITHUB_API}/repos/{req.owner}/{req.repo}/contents/{req.file_path}"
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        raise HTTPException(404, "File not found")
    content = resp.json()
    if content.get('encoding') == 'base64':
        import base64
        return {"content": base64.b64decode(content['content']).decode('utf-8', errors='ignore')}
    return {"content": content.get('content', '')}

@app.get("/files")
async def list_files(owner: str, repo: str):
    headers = get_auth_headers()
    url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/main?recursive=1"
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/master?recursive=1"
        resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        raise HTTPException(404, "Repo not found")
    tree = resp.json().get('tree', [])
    paths = [item['path'] for item in tree if item['type'] == 'blob']
    return {"owner": owner, "repo": repo, "count": len(paths), "files": paths}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
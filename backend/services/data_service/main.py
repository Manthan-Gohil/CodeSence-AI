# services/data_service/main.py
"""
Data Service - Owns GitHub repo ingestion, PostgreSQL metadata storage, file tree/hierarchy data
"""
import os
import re
import json
import io
import zipfile
import requests
from dotenv import load_dotenv

load_dotenv()

from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException, Body, Depends
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Text, DateTime, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from datetime import datetime

app = FastAPI(title="Data Service", version="1.0.0")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/codesense_ai")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://localhost:8002")

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
    provider = Column(String, nullable=False, default="gemini")
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
    provider: str = "gemini"
    api_key: Optional[str] = None


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

def parse_github_url(url: str) -> tuple:
    """Parse owner and repo from any GitHub URL format"""
    clean = url.strip()
    clean = re.sub(r'^(https?://)?(www\.)?github\.com/', '', clean)
    clean = re.sub(r'^git@github\.com:', '', clean)
    clean = clean.rstrip('/')
    if clean.endswith('.git'):
        clean = clean[:-4]
    # Remove any trailing branch/tree paths like /tree/main
    parts = clean.split('/')
    if len(parts) >= 2:
        return parts[0], parts[1]
    raise HTTPException(400, f"Invalid GitHub repository URL: '{url}'. Expected format: https://github.com/owner/repo")

def list_and_get_files(owner: str, repo: str) -> List[Dict]:
    """Fetch files from a GitHub repo efficiently via zipball or recursive tree fallback"""
    headers = get_auth_headers()
    files = []
    
    # 1. Try fast in-memory zipball download first
    try:
        repo_resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers, timeout=15)
        default_branch = "main"
        if repo_resp.status_code == 200:
            default_branch = repo_resp.json().get('default_branch', 'main')
        
        zip_url = f"{GITHUB_API}/repos/{owner}/{repo}/zipball/{default_branch}"
        zresp = requests.get(zip_url, headers=headers, timeout=45)
        if zresp.status_code == 200 and len(zresp.content) > 0:
            z = zipfile.ZipFile(io.BytesIO(zresp.content))
            valid_exts = (
                '.md', '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css',
                '.yaml', '.yml', '.txt', '.sh', '.sql', '.rs', '.go', '.java', '.c',
                '.cpp', '.h', '.hpp', '.toml', 'Dockerfile', 'Makefile'
            )
            ignore_dirs = ('node_modules/', '.git/', 'dist/', 'build/', '.next/', 'venv/', '__pycache__/', '.vscode/', '.idea/')
            ignore_files = ('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', 'poetry.lock')
            
            for file_info in z.infolist():
                if file_info.is_dir():
                    continue
                rel_path = file_info.filename.split('/', 1)[-1] if '/' in file_info.filename else file_info.filename
                
                if any(rel_path.startswith(d) or f"/{d}" in rel_path for d in ignore_dirs):
                    continue
                if any(rel_path.endswith(f) for f in ignore_files):
                    continue
                if not any(rel_path.endswith(ext) or rel_path == ext for ext in valid_exts):
                    continue
                if file_info.file_size > 150000:
                    continue
                
                try:
                    content_bytes = z.read(file_info)
                    text_content = content_bytes.decode('utf-8', errors='ignore')
                    if text_content.strip():
                        files.append({
                            'path': rel_path,
                            'content': text_content,
                            'size': file_info.file_size
                        })
                except Exception:
                    continue
            
            if files:
                # Prioritize README and documentation first
                files.sort(key=lambda x: (0 if 'readme' in x['path'].lower() else (1 if x['path'].endswith('.md') else 2)))
                return files
    except Exception as e:
        print(f"Zipball fetch failed: {e}, falling back to tree API")

    # 2. Fallback to recursive tree if zipball failed
    def fetch_tree(sha: str):
        url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{sha}?recursive=1"
        resp = requests.get(url, headers=headers, timeout=20)
        if resp.status_code != 200:
            return
        tree = resp.json().get('tree', [])
        valid_items = [
            it for it in tree 
            if it.get('type') == 'blob' 
            and not any(x in it.get('path', '') for x in ['node_modules/', '.git/', 'package-lock.json', 'yarn.lock'])
            and any(it.get('path', '').endswith(ext) for ext in ['.md', '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.yaml', '.yml', '.txt'])
        ]
        valid_items.sort(key=lambda x: (0 if 'readme' in x['path'].lower() else (1 if x['path'].endswith('.md') else 2)))
        for item in valid_items[:80]:
            file_url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{item['path']}"
            file_resp = requests.get(file_url, headers=headers, timeout=10)
            if file_resp.status_code == 200:
                content = file_resp.json()
                if content.get('encoding') == 'base64':
                    import base64
                    file_content = base64.b64decode(content['content']).decode('utf-8', errors='ignore')
                else:
                    file_content = content.get('content', '')
                if file_content.strip():
                    files.append({
                        'path': item['path'],
                        'content': file_content,
                        'size': item.get('size', 0)
                    })

    try:
        repo_resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers, timeout=15)
        default_branch = "main"
        if repo_resp.status_code == 200:
            default_branch = repo_resp.json().get('default_branch', 'main')
        branch_resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}/branches/{default_branch}", headers=headers, timeout=15)
        if branch_resp.status_code == 200:
            commit_sha = branch_resp.json().get('commit', {}).get('sha')
            if commit_sha:
                fetch_tree(commit_sha)
    except Exception as e:
        print(f"Fallback fetch_tree error: {e}")

    return files

def chunk_files_mem(files: List[Dict], max_chunk_size: int = 800, overlap: int = 120, max_chunks: int = 150) -> List[Dict]:
    """Token-aware chunking with chunk cap to maintain fast embedding performance"""
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    chunks = []
    
    for file in files:
        if len(chunks) >= max_chunks:
            break
        content = file.get('content', '')
        if not content:
            continue
            
        tokens = enc.encode(content)
        
        for i in range(0, len(tokens), max_chunk_size - overlap):
            if len(chunks) >= max_chunks:
                break
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
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}

@app.post("/ingest", response_model=IngestResponse)
async def ingest_repo(req: IngestRequest, db: Session = Depends(get_db)):
    try:
        owner, repo = parse_github_url(req.repo_url)
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
                f"{RAG_SERVICE_URL}/chunks/upsert",
                json={"chunks": chunks, "namespace": namespace, "provider": req.provider, "api_key": req.api_key},
                timeout=300
            )
            rag_resp.raise_for_status()
            chunks_added = rag_resp.json().get("chunks_added", len(chunks))
        except Exception as e:
            err_detail = str(e)
            if hasattr(e, 'response') and e.response is not None:
                try:
                    err_detail = e.response.json().get("detail", e.response.text)
                except Exception:
                    err_detail = e.response.text or str(e)
            print(f"RAG service call failed: {err_detail}")
            raise HTTPException(502, f"RAG service indexing failed: {err_detail}")
        
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
async def get_metadata(body: Dict = Body(...), db: Session = Depends(get_db)):
    repo_url = body.get("repo_url")
    if not repo_url and "user_id" in body:
        active = db.query(ActiveRepo).filter(ActiveRepo.user_id == body["user_id"]).first()
        if active:
            repo_url = active.repo_url
    if not repo_url:
        raise HTTPException(400, "repo_url or user_id required")
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
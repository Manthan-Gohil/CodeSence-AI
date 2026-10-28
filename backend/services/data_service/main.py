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
    branch: Optional[str] = "main"
    provider: str = "gemini"
    api_key: Optional[str] = None

class IngestResponse(BaseModel):
    ok: bool
    namespace: str
    chunks_added: int
    repo_name: str
    owner: str
    branch: Optional[str] = "main"

class FileContentRequest(BaseModel):
    owner: str
    repo: str
    file_path: str
    branch: Optional[str] = None

class RepoMetadataResponse(BaseModel):
    file_tree: Dict
    analytics: Dict
    dependency_graph: Dict
    branch: Optional[str] = "main"

class SetActiveRepoRequest(BaseModel):
    user_id: str
    repo_url: str
    branch: Optional[str] = "main"
    provider: str = "ollama"

class GetActiveRepoResponse(BaseModel):
    repo_url: Optional[str]
    branch: Optional[str] = "main"
    provider: Optional[str]

class BranchListRequest(BaseModel):
    repo_url: str

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

def get_file_priority(path: str) -> int:
    """Prioritize files for intelligent indexing: README -> Configs -> Core Entrypoints -> Source Code -> Docs"""
    p = path.lower()
    if 'readme' in p:
        return 0
    if any(p.endswith(f) for f in ('package.json', 'requirements.txt', 'pyproject.toml', 'go.mod', 'cargo.toml', 'docker-compose.yml', 'dockerfile')):
        return 1
    if any(p.endswith(f) for f in ('main.py', 'app.py', 'index.js', 'index.ts', 'server.js', 'app.jsx', 'app.tsx')):
        return 2
    if p.endswith(('.py', '.js', '.jsx', '.ts', '.tsx', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.hpp')):
        return 3
    if p.endswith('.md'):
        return 4
    return 5

def build_file_tree_from_paths(paths: List[str]) -> Dict:
    """Build hierarchical file tree from a full list of relative file paths"""
    tree = {}
    for path in sorted(paths):
        parts = path.split('/')
        current = tree
        for i, part in enumerate(parts):
            if i == len(parts) - 1:
                current[part] = None
            else:
                if part not in current or current[part] is None:
                    current[part] = {}
                current = current[part]
    return tree

def list_and_get_files(owner: str, repo: str, branch: Optional[str] = None) -> tuple:
    """Fetch files from a GitHub repo efficiently via zipball or recursive tree fallback.
    Returns (files_to_embed, full_file_tree)
    """
    headers = get_auth_headers()
    files_to_embed = []
    all_tree_paths = []
    
    target_branch = branch
    if not target_branch:
        try:
            repo_resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers, timeout=15)
            if repo_resp.status_code == 200:
                target_branch = repo_resp.json().get('default_branch', 'main')
            else:
                target_branch = "main"
        except Exception:
            target_branch = "main"

    valid_exts = (
        '.md', '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css',
        '.yaml', '.yml', '.txt', '.sh', '.sql', '.rs', '.go', '.java', '.c',
        '.cpp', '.h', '.hpp', '.toml', 'Dockerfile', 'Makefile',
        '.vue', '.svelte', '.swift', '.kt', '.rb', '.php', '.cs',
        '.graphql', '.proto', '.scss', '.less', '.env.example', '.prisma'
    )
    ignore_dirs = ('node_modules/', '.git/', 'dist/', 'build/', '.next/', 'venv/', '__pycache__/', '.vscode/', '.idea/')
    ignore_files = ('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', 'poetry.lock')

    # 1. Try fast in-memory zipball download first
    try:
        zip_url = f"{GITHUB_API}/repos/{owner}/{repo}/zipball/{target_branch}"
        zresp = requests.get(zip_url, headers=headers, timeout=45)
        if zresp.status_code == 200 and len(zresp.content) > 0:
            z = zipfile.ZipFile(io.BytesIO(zresp.content))
            
            valid_file_infos = []
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

                # Add to all paths for full tree display (up to 1500 files)
                if len(all_tree_paths) < 1500:
                    all_tree_paths.append(rel_path)

                # Filter out oversized files for embedding
                if file_info.file_size > 100000 or (rel_path.endswith('.json') and file_info.file_size > 35000):
                    continue
                valid_file_infos.append((file_info, rel_path))

            # Prioritize README and core code first, then cap at 50 essential files for embedding
            valid_file_infos.sort(key=lambda x: (get_file_priority(x[1]), x[0].file_size))
            for file_info, rel_path in valid_file_infos[:50]:
                try:
                    content_bytes = z.read(file_info)
                    text_content = content_bytes.decode('utf-8', errors='ignore')
                    if text_content.strip():
                        files_to_embed.append({
                            'path': rel_path,
                            'content': text_content,
                            'size': file_info.file_size
                        })
                except Exception:
                    continue
            
            if files_to_embed:
                full_tree = build_file_tree_from_paths(all_tree_paths)
                return files_to_embed, full_tree
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
            and not any(x in it.get('path', '') for x in ignore_dirs)
            and not any(it.get('path', '').endswith(f) for f in ignore_files)
            and any(it.get('path', '').endswith(ext) for ext in valid_exts)
        ]
        for it in valid_items[:1500]:
            all_tree_paths.append(it['path'])

        valid_items.sort(key=lambda x: get_file_priority(x['path']))
        for item in valid_items[:50]:
            file_url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{item['path']}?ref={target_branch}"
            file_resp = requests.get(file_url, headers=headers, timeout=10)
            if file_resp.status_code == 200:
                content = file_resp.json()
                if content.get('encoding') == 'base64':
                    import base64
                    file_content = base64.b64decode(content['content']).decode('utf-8', errors='ignore')
                else:
                    file_content = content.get('content', '')
                if file_content.strip():
                    files_to_embed.append({
                        'path': item['path'],
                        'content': file_content,
                        'size': item.get('size', 0)
                    })

    try:
        branch_resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}/branches/{target_branch}", headers=headers, timeout=15)
        if branch_resp.status_code == 200:
            commit_sha = branch_resp.json().get('commit', {}).get('sha')
            if commit_sha:
                fetch_tree(commit_sha)
    except Exception as e:
        print(f"Fallback fetch_tree error: {e}")

    full_tree = build_file_tree_from_paths(all_tree_paths if all_tree_paths else [f['path'] for f in files_to_embed])
    return files_to_embed, full_tree

def chunk_files_mem(files: List[Dict], max_chunk_size: int = 700, overlap: int = 80, max_chunks: int = 50) -> List[Dict]:
    """Token-aware chunking with adaptive chunk cap to ensure fast embedding and zero VM freezes"""
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
    """Analyze repo for dependency graph, nodes, links, and architectural tiers"""
    raw_deps = {}
    nodes = []
    links = []
    
    def classify_tier(path: str) -> str:
        p = path.lower()
        if any(x in p for x in ('route', 'controller', 'api/', 'endpoint', 'server', 'app.', 'index.')):
            return 'route'
        if any(x in p for x in ('service', 'manager', 'handler', 'worker', 'job', 'logic')):
            return 'service'
        if any(x in p for x in ('model', 'schema', 'entity', 'dto', 'type', 'interface', 'db', 'repo')):
            return 'model'
        if any(x in p for x in ('util', 'helper', 'lib', 'tool', 'common', 'shared')):
            return 'util'
        if any(x in p for x in ('component', 'view', 'page', 'ui', 'screen', 'layout')):
            return 'ui'
        if any(x in p for x in ('config', 'env', 'setting', 'constant', 'manifest')):
            return 'config'
        return 'module'

    for file in files:
        path = file['path']
        name = path.split('/')[-1]
        ext = os.path.splitext(name)[1].lstrip('.')
        content = file.get('content', '')
        lines = content.count('\n') + 1 if content else 0
        tier = classify_tier(path)
        
        imports = []
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith(('import ', 'from ', 'require(', 'import(')):
                imports.append(line[:160])
                
        if imports:
            raw_deps[path] = imports[:20]
            
        nodes.append({
            "id": path,
            "label": name,
            "path": path,
            "tier": tier,
            "size": file.get('size', len(content)),
            "lines": lines,
            "importsCount": len(imports),
            "ext": ext
        })

    for src_file in files:
        src_path = src_file['path']
        content = src_file.get('content', '')
        
        for tgt_file in files:
            tgt_path = tgt_file['path']
            if src_path == tgt_path:
                continue
            tgt_base = os.path.splitext(os.path.basename(tgt_path))[0]
            if len(tgt_base) < 3:
                continue
            
            if f"/{tgt_base}" in content or f"'{tgt_base}'" in content or f'"{tgt_base}"' in content or f"from .{tgt_base}" in content or f"from {tgt_base}" in content:
                links.append({
                    "source": src_path,
                    "target": tgt_path
                })

    in_degree = {}
    out_degree = {}
    for link in links:
        out_degree[link['source']] = out_degree.get(link['source'], 0) + 1
        in_degree[link['target']] = in_degree.get(link['target'], 0) + 1
        
    for node in nodes:
        node['incoming'] = in_degree.get(node['id'], 0)
        node['outgoing'] = out_degree.get(node['id'], 0)

    hub_nodes = sorted(nodes, key=lambda n: n['incoming'] + n['outgoing'], reverse=True)[:5]

    return {
        "raw_deps": raw_deps,
        "nodes": nodes,
        "links": links,
        "metrics": {
            "totalModules": len(nodes),
            "totalLinks": len(links),
            "hubModules": [h['label'] for h in hub_nodes],
            "tiers": {
                "route": len([n for n in nodes if n['tier'] == 'route']),
                "service": len([n for n in nodes if n['tier'] == 'service']),
                "model": len([n for n in nodes if n['tier'] == 'model']),
                "util": len([n for n in nodes if n['tier'] == 'util']),
                "ui": len([n for n in nodes if n['tier'] == 'ui']),
                "config": len([n for n in nodes if n['tier'] == 'config']),
                "module": len([n for n in nodes if n['tier'] == 'module'])
            }
        }
    }

@app.get("/health")
async def health_check():
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}

@app.post("/branches")
@app.get("/branches")
async def get_repo_branches(body: BranchListRequest):
    try:
        clean_url = body.repo_url.split("#")[0]
        owner, repo = parse_github_url(clean_url)
        headers = get_auth_headers()
        url = f"{GITHUB_API}/repos/{owner}/{repo}/branches?per_page=100"
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            branches = [b.get("name") for b in resp.json() if "name" in b]
            r_resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers, timeout=10)
            default_b = "main"
            if r_resp.status_code == 200:
                default_b = r_resp.json().get("default_branch", "main")
            return {"branches": branches if branches else ["main"], "default_branch": default_b}
        return {"branches": ["main", "master"], "default_branch": "main"}
    except Exception as e:
        return {"branches": ["main", "master"], "default_branch": "main", "warning": str(e)}

@app.post("/ingest", response_model=IngestResponse)
async def ingest_repo(req: IngestRequest, db: Session = Depends(get_db)):
    try:
        owner, repo = parse_github_url(req.repo_url)
        branch = req.branch or "main"
        clean_branch = re.sub(r'[^a-zA-Z0-9_-]', '_', branch)
        namespace = f"{req.user_id}_{repo}_{clean_branch}"
        
        # Fetch files from GitHub for the selected branch (both embedding files & full file tree)
        files, full_file_tree = list_and_get_files(owner, repo, branch=branch)
        if not files:
            raise HTTPException(404, f"No files found in repo for branch '{branch}'")
        
        # Chunk files
        chunks = chunk_files_mem(files)
        
        # Call RAG Service to store chunks
        try:
            rag_resp = requests.post(
                f"{RAG_SERVICE_URL}/chunks/upsert",
                json={"chunks": chunks, "namespace": namespace, "provider": req.provider, "api_key": req.api_key},
                timeout=600
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
        
        # Get repo metadata from GitHub with graceful fallback against rate limits
        headers = get_auth_headers()
        try:
            r_resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers, timeout=15)
            repo_info = r_resp.json() if r_resp.status_code == 200 else {}
        except Exception:
            repo_info = {}

        try:
            l_resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}/languages", headers=headers, timeout=15)
            languages = l_resp.json() if l_resp.status_code == 200 else {}
        except Exception:
            languages = {}

        try:
            c_resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}/contributors", headers=headers, timeout=15)
            contributors = c_resp.json() if c_resp.status_code == 200 else []
        except Exception:
            contributors = []
        
        analytics = {
            "repo_name": repo_info.get("name") or repo,
            "owner": (repo_info.get("owner") or {}).get("login") if isinstance(repo_info.get("owner"), dict) else owner,
            "description": repo_info.get("description") or "",
            "stars": repo_info.get("stargazers_count") or 0,
            "forks": repo_info.get("forks_count") or 0,
            "languages": languages if isinstance(languages, dict) else {},
            "branch": branch,
            "contributors": [
                {"login": c.get("login"), "contributions": c.get("contributions"), "avatar_url": c.get("avatar_url")}
                for c in contributors[:10]
            ] if isinstance(contributors, list) else [],
        }
        
        dependency_graph = analyze_repo(files)
        
        # Store metadata in PostgreSQL under branch-specific key and base key
        meta_id = f"{req.repo_url}#{branch}"
        meta = RepoMetadata(
            repo_url=meta_id,
            file_tree_json=json.dumps(full_file_tree),
            analytics_json=json.dumps(analytics),
            dependency_graph_json=json.dumps(dependency_graph)
        )
        db.merge(meta)
        
        # Also maintain base repo_url for backwards compatibility
        meta_base = RepoMetadata(
            repo_url=req.repo_url,
            file_tree_json=json.dumps(full_file_tree),
            analytics_json=json.dumps(analytics),
            dependency_graph_json=json.dumps(dependency_graph)
        )
        db.merge(meta_base)
        
        # Set active repo
        active = ActiveRepo(user_id=req.user_id, repo_url=meta_id, provider=req.provider)
        db.merge(active)
        db.commit()
        
        return IngestResponse(
            ok=True,
            namespace=namespace,
            chunks_added=chunks_added,
            repo_name=repo,
            owner=owner,
            branch=branch
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/metadata", response_model=RepoMetadataResponse)
async def get_metadata(body: Dict = Body(...), db: Session = Depends(get_db)):
    repo_url = body.get("repo_url")
    branch = body.get("branch")
    
    if not repo_url and "user_id" in body:
        active = db.query(ActiveRepo).filter(ActiveRepo.user_id == body["user_id"]).first()
        if active:
            repo_url = active.repo_url
            if "#" in repo_url and not branch:
                repo_url, branch = repo_url.split("#", 1)

    if not repo_url:
        raise HTTPException(400, "repo_url or user_id required")
    
    clean_url = repo_url.split("#")[0]
    meta = None
    if branch:
        meta = db.query(RepoMetadata).filter(RepoMetadata.repo_url == f"{clean_url}#{branch}").first()
    if not meta:
        meta = db.query(RepoMetadata).filter(RepoMetadata.repo_url == repo_url).first()
    if not meta and "#" in repo_url:
        meta = db.query(RepoMetadata).filter(RepoMetadata.repo_url == clean_url).first()

    if not meta:
        raise HTTPException(404, "Metadata not found")
        
    resolved_analytics = json.loads(meta.analytics_json) if meta.analytics_json else {}
    return RepoMetadataResponse(
        file_tree=json.loads(meta.file_tree_json),
        analytics=resolved_analytics,
        dependency_graph=json.loads(meta.dependency_graph_json) if meta.dependency_graph_json else {},
        branch=branch or resolved_analytics.get("branch", "main")
    )

@app.post("/active/set", response_model=GetActiveRepoResponse)
async def set_active_repo(req: SetActiveRepoRequest, db: Session = Depends(get_db)):
    branch = req.branch or "main"
    meta_id = f"{req.repo_url}#{branch}"
    active = ActiveRepo(user_id=req.user_id, repo_url=meta_id, provider=req.provider)
    db.merge(active)
    db.commit()
    return GetActiveRepoResponse(repo_url=req.repo_url, branch=branch, provider=req.provider)

@app.post("/active/get", response_model=GetActiveRepoResponse)
async def get_active_repo(user_id: str = Body(..., embed=True), db: Session = Depends(get_db)):
    active = db.query(ActiveRepo).filter(ActiveRepo.user_id == user_id).first()
    if not active:
        return GetActiveRepoResponse(repo_url=None, branch="main", provider=None)
    raw_url = active.repo_url
    branch = "main"
    if "#" in raw_url:
        raw_url, branch = raw_url.split("#", 1)
    return GetActiveRepoResponse(repo_url=raw_url, branch=branch, provider=active.provider)

@app.post("/active/delete")
async def delete_active_repo(user_id: str = Body(..., embed=True), db: Session = Depends(get_db)):
    db.query(ActiveRepo).filter(ActiveRepo.user_id == user_id).delete()
    db.commit()
    return {"ok": True}

@app.post("/file/content")
async def get_file_content(req: FileContentRequest):
    headers = get_auth_headers()
    params = {}
    if req.branch:
        params["ref"] = req.branch
    url = f"{GITHUB_API}/repos/{req.owner}/{req.repo}/contents/{req.file_path}"
    resp = requests.get(url, headers=headers, params=params)
    if resp.status_code != 200:
        raise HTTPException(404, "File not found")
    content = resp.json()
    if content.get('encoding') == 'base64':
        import base64
        return {"content": base64.b64decode(content['content']).decode('utf-8', errors='ignore')}
    return {"content": content.get('content', '')}

@app.get("/files")
async def list_files(owner: str, repo: str, branch: Optional[str] = "main"):
    headers = get_auth_headers()
    url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200 and branch == "main":
        url = f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/master?recursive=1"
        resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        raise HTTPException(404, "Repo not found")
    tree = resp.json().get('tree', [])
    paths = [item['path'] for item in tree if item['type'] == 'blob']
    return {"owner": owner, "repo": repo, "branch": branch, "count": len(paths), "files": paths}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
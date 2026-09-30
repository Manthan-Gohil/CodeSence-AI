from fastapi import FastAPI, Request
from app.core.oauth import init_oauth
from app.routers.auth import router as auth_router
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from app.routers import ai, repo, discuss
from app.utils.db import engine, Base
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import os

app = FastAPI()

init_oauth(app)
Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://codesense-ai.vercel.app",
        "https://www.codesense-ai.com",
        "https://codesense-ai.onrender.com",
        "http://localhost:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_SECRET = os.environ.get('SESSION_SECRET_KEY') or "00266e1f1ffd4e95b114e072225d3923ef6327bad4a277f60474a1ca62f63f35"
HTTPS_ONLY = os.environ.get('HTTPS_ONLY', 'false').lower() == 'true'

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    https_only=HTTPS_ONLY,
    same_site="none" if HTTPS_ONLY else "lax"
)


app.include_router(auth_router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(repo.router, prefix="/api")
app.include_router(discuss.router, prefix="/api")

# Mount frontend/dist if available
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

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('app.main:app', host='0.0.0.0', port=8000, reload=True)

# services/llm_service/main.py
"""
LLM Service - Owns all Ollama/Code Llama calls
Exposes /generate endpoint that takes prompt+context and returns response
"""
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from langchain_community.chat_models import ChatOllama
from langchain_community.embeddings import OllamaEmbeddings

app = FastAPI(title="LLM Service", version="1.0.0")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_LLM_MODEL = os.getenv("LLM_MODEL", "codellama")
DEFAULT_EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")

class GenerateRequest(BaseModel):
    prompt: str
    model: str = DEFAULT_LLM_MODEL
    temperature: float = 0.0
    max_tokens: Optional[int] = None
    system_prompt: Optional[str] = None

class GenerateResponse(BaseModel):
    response: str
    model: str
    usage: Optional[Dict[str, Any]] = None

class EmbedRequest(BaseModel):
    texts: List[str]
    model: str = DEFAULT_EMBED_MODEL

class EmbedResponse(BaseModel):
    embeddings: List[List[float]]
    model: str

class HealthResponse(BaseModel):
    status: str
    ollama_connected: bool
    available_models: List[str]

@app.get("/health", response_model=HealthResponse)
async def health_check():
    try:
        import requests
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        connected = resp.status_code == 200
        models = []
        if connected:
            data = resp.json()
            models = [m['name'] for m in data.get('models', [])]
        return HealthResponse(
            status="healthy" if connected else "degraded",
            ollama_connected=connected,
            available_models=models
        )
    except Exception:
        return HealthResponse(status="unhealthy", ollama_connected=False, available_models=[])

@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    try:
        llm = ChatOllama(
            model=req.model,
            base_url=OLLAMA_BASE_URL,
            temperature=req.temperature
        )
        
        messages = []
        if req.system_prompt:
            messages.append(("system", req.system_prompt))
        messages.append(("human", req.prompt))
        
        response = llm.invoke(messages)
        content = response.content if hasattr(response, 'content') else str(response)
        
        return GenerateResponse(
            response=content,
            model=req.model,
            usage={"prompt_tokens": len(req.prompt.split()), "completion_tokens": len(content.split())}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    try:
        embedder = OllamaEmbeddings(
            model=req.model,
            base_url=OLLAMA_BASE_URL
        )
        embeddings = embedder.embed_documents(req.texts)
        return EmbedResponse(embeddings=embeddings, model=req.model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

@app.post("/embed_query")
async def embed_query(text: str, model: str = DEFAULT_EMBED_MODEL):
    try:
        embedder = OllamaEmbeddings(model=model, base_url=OLLAMA_BASE_URL)
        embedding = embedder.embed_query(text)
        return {"embedding": embedding, "model": model}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query embedding failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
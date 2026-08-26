# services/rag_service/main.py
"""
RAG Service - Owns chunking, embedding generation, vector similarity search, context assembly
Wraps FAISS vector store
"""
import os
import json
import shutil
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.schema import Document
from langchain.chains import RetrievalQA
from langchain_community.chat_models import ChatOllama

app = FastAPI(title="RAG Service", version="1.0.0")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
LLM_MODEL = os.getenv("LLM_MODEL", "codellama")
FAISS_INDEX_DIR = os.getenv("FAISS_INDEX_DIR", "./faiss_index")

os.makedirs(FAISS_INDEX_DIR, exist_ok=True)

class ChunkRequest(BaseModel):
    chunks: List[Dict]
    namespace: str
    provider: str = "ollama"

class ChunkResponse(BaseModel):
    chunks_added: int
    namespace: str

class SearchRequest(BaseModel):
    query: str
    namespace: str
    k: int = 5
    provider: str = "ollama"

class SearchResult(BaseModel):
    content: str
    metadata: Dict
    score: Optional[float] = None

class SearchResponse(BaseModel):
    results: List[SearchResult]
    namespace: str

class ChatRequest(BaseModel):
    query: str
    namespace: str
    provider: str = "ollama"
    k: int = 5

class ChatResponse(BaseModel):
    result: str
    source_documents: List[SearchResult]

class ComparisonRequest(BaseModel):
    query: str
    namespace: str
    provider: str = "ollama"
    k: int = 5

class ComparisonResponse(BaseModel):
    query: str
    with_rag: str
    without_rag: str
    provider: str

class DeleteNamespaceRequest(BaseModel):
    namespace: str

def get_embedder(provider: str = "ollama"):
    if provider == "ollama":
        return OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
    else:
        raise ValueError(f"Unknown provider: {provider}")

def get_llm(provider: str = "ollama"):
    if provider == "ollama":
        return ChatOllama(model=LLM_MODEL, base_url=OLLAMA_BASE_URL, temperature=0)
    else:
        raise ValueError(f"Unknown provider: {provider}")

def get_faiss_index_path(namespace: str) -> str:
    return os.path.join(FAISS_INDEX_DIR, namespace)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "faiss_index_dir": FAISS_INDEX_DIR}

@app.post("/chunks/upsert", response_model=ChunkResponse)
async def upsert_chunks(req: ChunkRequest):
    try:
        embedder = get_embedder(req.provider)
        
        texts = [c['text'] for c in req.chunks]
        metadatas = [c['metadata'] for c in req.chunks]
        
        docs = [Document(page_content=text, metadata=meta) for text, meta in zip(texts, metadatas)]
        
        index_path = get_faiss_index_path(req.namespace)
        
        if os.path.exists(index_path):
            vectorstore = FAISS.load_local(index_path, embedder, allow_dangerous_deserialization=True)
            vectorstore.add_documents(docs)
        else:
            vectorstore = FAISS.from_documents(docs, embedder)
        
        os.makedirs(os.path.dirname(index_path), exist_ok=True)
        vectorstore.save_local(index_path)
        
        return ChunkResponse(chunks_added=len(req.chunks), namespace=req.namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upsert failed: {str(e)}")

@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    try:
        embedder = get_embedder(req.provider)
        index_path = get_faiss_index_path(req.namespace)
        
        if not os.path.exists(index_path):
            return SearchResponse(results=[], namespace=req.namespace)
        
        vectorstore = FAISS.load_local(index_path, embedder, allow_dangerous_deserialization=True)
        results = vectorstore.similarity_search_with_score(req.query, k=req.k)
        
        search_results = []
        for doc, score in results:
            search_results.append(SearchResult(
                content=doc.page_content,
                metadata=doc.metadata,
                score=float(score)
            ))
        
        return SearchResponse(results=search_results, namespace=req.namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.post("/chat", response_model=ChatResponse)
async def chat_with_rag(req: ChatRequest):
    try:
        embedder = get_embedder(req.provider)
        index_path = get_faiss_index_path(req.namespace)
        
        if not os.path.exists(index_path):
            raise HTTPException(404, f"Namespace {req.namespace} not found")
        
        vectorstore = FAISS.load_local(index_path, embedder, allow_dangerous_deserialization=True)
        retriever = vectorstore.as_retriever(search_kwargs={"k": req.k})
        llm = get_llm(req.provider)
        
        qa = RetrievalQA.from_chain_type(
            llm=llm,
            retriever=retriever,
            return_source_documents=True,
            chain_type="stuff"
        )
        result = qa(req.query)
        
        source_docs = []
        for doc in result.get('source_documents', []):
            source_docs.append(SearchResult(
                content=doc.page_content,
                metadata=doc.metadata
            ))
        
        return ChatResponse(
            result=result['result'],
            source_documents=source_docs
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

@app.post("/compare", response_model=ComparisonResponse)
async def compare_rag(req: ComparisonRequest):
    try:
        # With RAG
        embedder = get_embedder(req.provider)
        index_path = get_faiss_index_path(req.namespace)
        
        with_rag = ""
        if os.path.exists(index_path):
            vectorstore = FAISS.load_local(index_path, embedder, allow_dangerous_deserialization=True)
            retriever = vectorstore.as_retriever(search_kwargs={"k": req.k})
            llm = get_llm(req.provider)
            qa = RetrievalQA.from_chain_type(llm=llm, retriever=retriever, return_source_documents=True, chain_type="stuff")
            with_rag = qa(req.query)['result']
        else:
            with_rag = "No data in namespace"
        
        # Without RAG
        llm = get_llm(req.provider)
        without_rag_response = llm.invoke(req.query)
        without_rag = without_rag_response.content if hasattr(without_rag_response, 'content') else str(without_rag_response)
        
        return ComparisonResponse(
            query=req.query,
            with_rag=with_rag,
            without_rag=without_rag,
            provider=req.provider
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")

@app.delete("/namespace")
async def delete_namespace(req: DeleteNamespaceRequest):
    try:
        index_path = get_faiss_index_path(req.namespace)
        if os.path.exists(index_path):
            shutil.rmtree(index_path)
        return {"deleted": True, "namespace": req.namespace}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
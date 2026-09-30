# services/rag_service/main.py
"""
RAG Service - Owns chunking, embedding generation, vector similarity search, context assembly
Wraps FAISS vector store
"""
import os
import json
import shutil
from dotenv import load_dotenv

load_dotenv()
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.schema import Document
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_community.chat_models import ChatOllama

app = FastAPI(title="RAG Service", version="1.0.0")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5-coder:1.5b")
FAISS_INDEX_DIR = os.getenv("FAISS_INDEX_DIR", "./faiss_index")

os.makedirs(FAISS_INDEX_DIR, exist_ok=True)

QA_PROMPT = PromptTemplate(
    template="""You are CodeSense AI, an intelligent DevOps and Codebase Assistant. Use the following repository context to answer the user's question accurately, concisely, and helpfully.
If the user asks what the project is, what it does, or its features, use the README and code details from the context to describe it directly.
Keep your response concise, clear, and focused (under 300 words). Avoid excessive filler or repeating the entire code verbatim.

Repository Context:
{context}

Question: {question}

Helpful Answer:""",
    input_variables=["context", "question"]
)


class ChunkRequest(BaseModel):
    chunks: List[Dict]
    namespace: str
    provider: str = "ollama"
    api_key: Optional[str] = None

class ChunkResponse(BaseModel):
    chunks_added: int
    namespace: str

class SearchRequest(BaseModel):
    query: str
    namespace: str
    k: int = 5
    provider: str = "ollama"
    api_key: Optional[str] = None

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
    api_key: Optional[str] = None
    k: int = 5

class ChatResponse(BaseModel):
    result: str
    source_documents: List[SearchResult]

class ComparisonRequest(BaseModel):
    query: str
    namespace: str
    provider: str = "ollama"
    api_key: Optional[str] = None
    k: int = 5

class ComparisonResponse(BaseModel):
    query: str
    with_rag: str
    without_rag: str
    provider: str

class DeleteNamespaceRequest(BaseModel):
    namespace: str

def get_embedder(provider: Optional[str] = None, api_key: Optional[str] = None, namespace: Optional[str] = None):
    # Auto-detect existing FAISS index vector dimension to ensure perfect compatibility
    if namespace:
        idx_file = os.path.join(get_faiss_index_path(namespace), "index.faiss")
        if os.path.exists(idx_file):
            try:
                import faiss
                idx = faiss.read_index(idx_file)
                if idx.d == 768:
                    return OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
                elif idx.d == 3072:
                    key = api_key or os.getenv("GEMINI_API_KEY")
                    if key:
                        from langchain_google_genai import GoogleGenerativeAIEmbeddings
                        return GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=key)
            except Exception as e:
                print(f"Index dimension check warning: {e}")
                
    # Default local provider: Ollama nomic-embed-text (unlimited quota, 1-2s execution)
    return OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)

def get_llm(provider: Optional[str] = None, api_key: Optional[str] = None):
    # Max output tokens limit to prevent excessively long responses and token exhaustion
    max_output = int(os.getenv("MAX_OUTPUT_TOKENS", "768"))
    chosen_provider = (provider or os.getenv("DEFAULT_LLM_PROVIDER", "gemini")).lower()
    
    # If explicitly requesting local Ollama, bypass cloud API completely
    if chosen_provider == "ollama":
        return ChatOllama(
            model=LLM_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=0.1,
            num_predict=max_output,
            num_ctx=2048
        )

    # Priority: Gemini LLM (fast, 1-2s response, no CPU hang)
    key = api_key or os.getenv("GEMINI_API_KEY")
    if key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            model_name = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash-lite")
            return ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=key,
                temperature=0.1,
                max_output_tokens=max_output
            )
        except Exception as e:
            print(f"Warning: Failed to init Gemini LLM: {e}, attempting fallback model")
            try:
                fallback_model = "models/gemini-3.8-flash"
                return ChatGoogleGenerativeAI(
                    model=fallback_model,
                    google_api_key=key,
                    temperature=0.1,
                    max_output_tokens=max_output
                )
            except Exception as e2:
                print(f"Warning: Gemini fallback failed: {e2}")

    # Fallback to local Ollama (qwen2.5-coder:1.5b: fast, lightweight, low-latency code model on CPU)
    return ChatOllama(
        model=LLM_MODEL,
        base_url=OLLAMA_BASE_URL,
        temperature=0.1,
        num_predict=max_output,
        num_ctx=2048
    )




def get_faiss_index_path(namespace: str) -> str:
    return os.path.join(FAISS_INDEX_DIR, namespace)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "faiss_index_dir": FAISS_INDEX_DIR}

@app.post("/chunks/upsert", response_model=ChunkResponse)
async def upsert_chunks(req: ChunkRequest):
    try:
        embedder = get_embedder(req.provider, req.api_key, namespace=req.namespace)
        
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upsert failed: {str(e)}")

@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    try:
        embedder = get_embedder(req.provider, req.api_key, namespace=req.namespace)
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.post("/chat", response_model=ChatResponse)
async def chat_with_rag(req: ChatRequest):
    try:
        embedder = get_embedder(req.provider, req.api_key, namespace=req.namespace)
        index_path = get_faiss_index_path(req.namespace)
        
        if not os.path.exists(index_path):
            raise HTTPException(404, f"Namespace {req.namespace} not found. Please ingest the repository first.")
        
        vectorstore = FAISS.load_local(index_path, embedder, allow_dangerous_deserialization=True)
        top_k = int(os.getenv("RAG_TOP_K", "4"))
        retriever = vectorstore.as_retriever(search_kwargs={"k": min(req.k or top_k, top_k)})
        llm = get_llm(req.provider, req.api_key)

        
        try:
            qa = RetrievalQA.from_chain_type(
                llm=llm,
                retriever=retriever,
                return_source_documents=True,
                chain_type="stuff",
                chain_type_kwargs={"prompt": QA_PROMPT}
            )
            result = qa.invoke({"query": req.query})
        except Exception as llm_err:
            print(f"Warning: Primary LLM call failed ({llm_err}). Seamlessly falling back to local Ollama {LLM_MODEL}...")
            fallback_llm = ChatOllama(
                model=LLM_MODEL,
                base_url=OLLAMA_BASE_URL,
                temperature=0.1,
                num_predict=int(os.getenv("MAX_OUTPUT_TOKENS", "768")),
                num_ctx=2048
            )
            qa_fallback = RetrievalQA.from_chain_type(
                llm=fallback_llm,
                retriever=retriever,
                return_source_documents=True,
                chain_type="stuff",
                chain_type_kwargs={"prompt": QA_PROMPT}
            )
            result = qa_fallback.invoke({"query": req.query})

        
        source_docs = []
        for doc in result.get('source_documents', []):
            source_docs.append(SearchResult(
                content=doc.page_content,
                metadata=doc.metadata
            ))
        
        return ChatResponse(
            result=result.get('result', str(result)),
            source_documents=source_docs
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

@app.post("/compare", response_model=ComparisonResponse)
async def compare_rag(req: ComparisonRequest):
    try:
        # With RAG
        embedder = get_embedder(req.provider, req.api_key, namespace=req.namespace)
        index_path = get_faiss_index_path(req.namespace)

        
        with_rag = ""
        if os.path.exists(index_path):
            vectorstore = FAISS.load_local(index_path, embedder, allow_dangerous_deserialization=True)
            retriever = vectorstore.as_retriever(search_kwargs={"k": req.k})
            llm = get_llm(req.provider, req.api_key)
            qa = RetrievalQA.from_chain_type(
                llm=llm,
                retriever=retriever,
                return_source_documents=True,
                chain_type="stuff",
                chain_type_kwargs={"prompt": QA_PROMPT}
            )
            res = qa.invoke({"query": req.query})
            with_rag = res.get('result', str(res))
        else:
            with_rag = "No data in namespace"
        
        # Without RAG
        llm = get_llm(req.provider, req.api_key)
        without_rag_response = llm.invoke(req.query)
        without_rag = without_rag_response.content if hasattr(without_rag_response, 'content') else str(without_rag_response)
        
        return ComparisonResponse(
            query=req.query,
            with_rag=with_rag,
            without_rag=without_rag,
            provider=req.provider
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
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
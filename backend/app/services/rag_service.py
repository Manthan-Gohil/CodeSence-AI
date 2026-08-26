# app/services/rag_service.py

import os
import json
from typing import List, Dict, Optional
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.chat_models import ChatOllama
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.schema import Document
from app.core.config import EMBED_MODEL, LLM_MODEL, OLLAMA_BASE_URL, FAISS_INDEX_DIR
from app.services.chunking_service import chunk_files_mem

FAISS_STORE = None

def get_faiss_index_path(namespace: str) -> str:
    return os.path.join(FAISS_INDEX_DIR, namespace)

def get_embedder(provider: str = "ollama", api_key: str = None):
    if provider == "ollama":
        return OllamaEmbeddings(
            model=EMBED_MODEL,
            base_url=OLLAMA_BASE_URL
        )
    elif provider == "openai":
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(openai_api_key=api_key, model=EMBED_MODEL)
    else:
        raise ValueError(f"Unknown provider: {provider}")

def get_llm(provider: str = "ollama", api_key: str = None):
    if provider == "ollama":
        return ChatOllama(
            model=LLM_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=0
        )
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(openai_api_key=api_key, model=LLM_MODEL, temperature=0)
    else:
        raise ValueError(f"Unknown provider: {provider}")

def embed_dim_for_provider(provider: str) -> int:
    return 768

def upsert_chunks_to_faiss(chunks: List[Dict], namespace: str, provider: str = "ollama", api_key: str = None):
    embedder = get_embedder(provider, api_key)
    
    texts = [c['text'] for c in chunks]
    metadatas = [c['metadata'] for c in chunks]
    
    # Create documents
    docs = [Document(page_content=text, metadata=meta) for text, meta in zip(texts, metadatas)]
    
    # Create or load FAISS index
    index_path = get_faiss_index_path(namespace)
    
    if os.path.exists(index_path):
        vectorstore = FAISS.load_local(index_path, embedder, allow_dangerous_deserialization=True)
        vectorstore.add_documents(docs)
    else:
        vectorstore = FAISS.from_documents(docs, embedder)
    
    # Save to disk
    os.makedirs(os.path.dirname(index_path), exist_ok=True)
    vectorstore.save_local(index_path)

def get_retriever(namespace: str, provider: str = "ollama", api_key: str = None, k: int = 5):
    embedder = get_embedder(provider, api_key)
    index_path = get_faiss_index_path(namespace)
    
    if not os.path.exists(index_path):
        # Return empty retriever
        class EmptyRetriever:
            def get_relevant_documents(self, query: str) -> List[Document]:
                return []
            async def aget_relevant_documents(self, query: str) -> List[Document]:
                return []
        return EmptyRetriever()
    
    vectorstore = FAISS.load_local(index_path, embedder, allow_dangerous_deserialization=True)
    return vectorstore.as_retriever(search_kwargs={"k": k})

def chat_with_rag(query: str, namespace: str, provider: str = "ollama", api_key: str = None):
    retriever = get_retriever(namespace, provider, api_key)
    llm = get_llm(provider, api_key)
    
    qa = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=retriever,
        return_source_documents=True,
        chain_type="stuff"
    )
    return qa(query)['result']

def validate_key(provider: str, api_key: str) -> bool:
    try:
        if provider == "ollama":
            import requests
            resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
            return resp.status_code == 200
        elif provider == "openai":
            import openai
            client = openai.OpenAI(api_key=api_key)
            _ = client.models.list()
            return True
        else:
            return False
    except Exception:
        return False

def validate_ollama_connection() -> bool:
    try:
        import requests
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        return resp.status_code == 200
    except Exception:
        return False

def list_ollama_models() -> List[str]:
    try:
        import requests
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return [model['name'] for model in data.get('models', [])]
        return []
    except Exception:
        return []

def pull_ollama_model(model_name: str) -> bool:
    try:
        import requests
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/pull",
            json={"name": model_name},
            timeout=300
        )
        return resp.status_code == 200
    except Exception:
        return False

def delete_faiss_namespace(namespace: str):
    try:
        index_path = get_faiss_index_path(namespace)
        if os.path.exists(index_path):
            import shutil
            shutil.rmtree(index_path)
    except Exception as e:
        print(f"Error deleting namespace {namespace} from FAISS: {e}")

def chat_without_rag(query: str, provider: str = "ollama", api_key: str = None):
    """Chat with LLM without RAG context - for comparison"""
    llm = get_llm(provider, api_key)
    response = llm.invoke(query)
    return response.content if hasattr(response, 'content') else str(response)

def chat_with_rag_comparison(query: str, namespace: str, provider: str = "ollama", api_key: str = None) -> Dict:
    """Compare RAG vs non-RAG responses"""
    rag_response = chat_with_rag(query, namespace, provider, api_key)
    no_rag_response = chat_without_rag(query, provider, api_key)
    
    return {
        "query": query,
        "with_rag": rag_response,
        "without_rag": no_rag_response,
        "provider": provider
    }

def ingest_repo_files(files: List[Dict], namespace: str, provider: str = "ollama", api_key: str = None):
    """Full ingestion pipeline: chunk files -> embed -> store in FAISS"""
    chunks = chunk_files_mem(files)
    upsert_chunks_to_faiss(chunks, namespace, provider, api_key)
    return {"chunks_added": len(chunks), "namespace": namespace}
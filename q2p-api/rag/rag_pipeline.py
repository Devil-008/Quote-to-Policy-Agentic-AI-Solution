"""
RAG Pipeline — uses local ChromaDB (persist directory), no server needed.
"""
import os
import uuid
import logging
from typing import List, Dict
from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer

from configs.base import settings

logger = logging.getLogger(__name__)

# ─── Local ChromaDB client (no Docker needed) ────────────────────────
_chroma_client = None
_collection    = None
_embedder      = None


def _get_chroma():
    global _chroma_client, _collection
    if _chroma_client is None:
        persist_dir = settings.CHROMA_PERSIST_DIR
        os.makedirs(persist_dir, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _collection = _chroma_client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _chroma_client, _collection


def _get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


def _embed(texts: List[str]) -> List[List[float]]:
    model = _get_embedder()
    return model.encode(texts, convert_to_numpy=True).tolist()


# ─── Document loading ────────────────────────────────────────────────

def _load_text(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    elif ext in (".docx", ".doc"):
        import docx2txt
        return docx2txt.process(file_path)
    else:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()


# ─── Public API ──────────────────────────────────────────────────────

async def ingest_document(file_path: str, doc_id: str, title: str) -> int:
    """Parse, chunk, embed and store a document. Returns chunk count."""
    text = _load_text(file_path)
    if not text.strip():
        raise ValueError("Document is empty or unreadable")

    splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=64)
    chunks   = splitter.split_text(text)

    _, col = _get_chroma()
    embeddings = _embed(chunks)

    ids       = [f"{doc_id}-{i}" for i in range(len(chunks))]
    metadatas = [{"doc_id": doc_id, "title": title, "chunk_index": i} for i in range(len(chunks))]

    col.upsert(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metadatas)
    logger.info(f"Ingested {len(chunks)} chunks for doc {doc_id}")
    return len(chunks)


async def semantic_search(query: str, top_k: int = 5) -> List[Dict]:
    """Return top-k semantically similar chunks."""
    _, col = _get_chroma()
    q_emb  = _embed([query])

    results = col.query(
        query_embeddings=q_emb,
        n_results=min(top_k, col.count() or 1),
        include=["documents", "metadatas", "distances"],
    )
    chunks = []
    for text, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "text":     text,
            "doc_id":   meta.get("doc_id"),
            "title":    meta.get("title"),
            "score":    round(1 - dist, 4),
        })
    return chunks


async def list_documents() -> List[Dict]:
    """Return distinct documents stored in the collection."""
    _, col = _get_chroma()
    if col.count() == 0:
        return []
    all_items = col.get(include=["metadatas"])
    seen, docs = set(), []
    for meta in all_items["metadatas"]:
        doc_id = meta.get("doc_id")
        if doc_id and doc_id not in seen:
            seen.add(doc_id)
            docs.append({"doc_id": doc_id, "title": meta.get("title", "Unknown")})
    return docs


async def delete_document(doc_id: str):
    """Delete all chunks for a document."""
    _, col = _get_chroma()
    col.delete(where={"doc_id": doc_id})
    logger.info(f"Deleted document {doc_id} from ChromaDB")

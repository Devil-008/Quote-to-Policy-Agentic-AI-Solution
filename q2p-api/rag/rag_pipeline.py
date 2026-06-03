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
_embedder      = None


def _get_chroma():
    global _chroma_client
    if _chroma_client is None:
        persist_dir = settings.CHROMA_PERSIST_DIR
        os.makedirs(persist_dir, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    collection = _chroma_client.get_or_create_collection(
        name=settings.CHROMA_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    return _chroma_client, collection


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

    # ─── Graph DB Ingestion First ──────────────────────────────────────────
    try:
        from rag.graph_retriever import store_relationship
        import re

        stopwords = {
            "about", "above", "after", "again", "against", "all", "and", "any", "are", "because",
            "been", "before", "being", "below", "between", "both", "but", "by", "could", "did",
            "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had",
            "has", "have", "having", "here", "there", "when", "where", "why", "how", "more",
            "most", "other", "some", "such", "only", "own", "same", "than", "very", "will",
            "just", "should", "would", "their", "them", "they", "this", "that", "these", "those",
            "then", "once", "with", "your", "yours", "yourself", "yourselves", "himself", "herself",
            "itself", "themselves", "ourselves", "myself", "into", "through", "during", "before",
            "after", "above", "below", "from", "down", "over", "under", "again", "further", "then",
            "once", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each",
            "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
            "same", "so", "than", "too", "very", "can", "will", "just", "should", "now", "insurance",
            "policy", "document"
        }

        # Extract words between 4 and 20 chars
        words = re.findall(r'\b[a-zA-Z]{4,20}\b', text.lower())
        filtered = [w for w in words if w not in stopwords]

        freq = {}
        for w in filtered:
            freq[w] = freq.get(w, 0) + 1

        sorted_terms = sorted(freq.items(), key=lambda x: x[1], reverse=True)
        top_terms = [t[0] for t in sorted_terms[:8]]

        def make_arango_key(val: str) -> str:
            return re.sub(r'[^a-zA-Z0-9_\-]', '_', val)

        # Store document-to-keyword relationships
        for term in top_terms:
            store_relationship(
                source_id=doc_id,
                target_id=make_arango_key(term),
                relation_type="mentions",
                meta={"document_title": title, "type": "keyword"}
            )

        # Link sequential keywords together
        for i in range(len(top_terms) - 1):
            store_relationship(
                source_id=make_arango_key(top_terms[i]),
                target_id=make_arango_key(top_terms[i+1]),
                relation_type="related_to",
                meta={"document_title": title, "type": "association"}
            )
        logger.info(f"Graph DB ingestion completed first for doc {doc_id}")
    except Exception as ge:
        logger.warning(f"Failed to ingest to Graph DB: {ge}", exc_info=True)

    # ─── Vector DB Ingestion Second ────────────────────────────────────────
    splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=64)
    chunks   = splitter.split_text(text)

    _, col = _get_chroma()
    embeddings = _embed(chunks)

    ids       = [f"{doc_id}-{i}" for i in range(len(chunks))]
    metadatas = [{"doc_id": doc_id, "title": title, "chunk_index": i} for i in range(len(chunks))]

    # Batch upsert to prevent exceeding ChromaDB's maximum batch size (e.g. limit of 166)
    batch_size = 100
    for start_idx in range(0, len(chunks), batch_size):
        end_idx = start_idx + batch_size
        col.upsert(
            ids=ids[start_idx:end_idx],
            documents=chunks[start_idx:end_idx],
            embeddings=embeddings[start_idx:end_idx],
            metadatas=metadatas[start_idx:end_idx]
        )
    logger.info(f"Ingested {len(chunks)} chunks for doc {doc_id} in batches into ChromaDB")
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
    """Delete all chunks for a document from ChromaDB and clean up Graph DB."""
    # ChromaDB cleanup
    _, col = _get_chroma()
    try:
        # Fetch all matching IDs first to delete in batches (avoids the 166 batch size limit during delete)
        res = col.get(where={"doc_id": doc_id}, include=[])
        ids_to_delete = res.get("ids", [])
        if ids_to_delete:
            batch_size = 100
            for i in range(0, len(ids_to_delete), batch_size):
                batch_ids = ids_to_delete[i:i + batch_size]
                col.delete(ids=batch_ids)
            logger.info(f"Deleted {len(ids_to_delete)} chunks for document {doc_id} from ChromaDB")
        else:
            logger.info(f"No chunks found in ChromaDB for document {doc_id}")
    except Exception as e:
        logger.warning(f"Error during ChromaDB document deletion: {e}", exc_info=True)
        # Fallback to direct delete if get failed
        try:
            col.delete(where={"doc_id": doc_id})
        except Exception as fe:
            logger.error(f"ChromaDB fallback delete failed: {fe}", exc_info=True)
            raise fe

    # ArangoDB cleanup
    try:
        from rag.graph_retriever import _get_db
        db = _get_db()
        if db is not None:
            db.aql.execute(
                """
                FOR e IN knowledge_edges
                    FILTER e._from == @doc_node OR e._to == @doc_node
                    REMOVE e IN knowledge_edges
                """,
                bind_vars={"doc_node": f"knowledge_nodes/{doc_id}"}
            )
            if db.collection("knowledge_nodes").has(doc_id):
                db.collection("knowledge_nodes").delete(doc_id)
            logger.info(f"Deleted document {doc_id} from Graph DB")
        else:
            logger.warning(f"Skipping Graph DB cleanup for doc_id {doc_id} as Graph DB is offline.")
    except Exception as ge:
        logger.warning(f"Failed to delete document from Graph DB: {ge}")

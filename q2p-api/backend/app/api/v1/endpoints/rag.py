import uuid, json, os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_roles
from backend.app.models.all_models import (
    KnowledgeDocument, ConversationSession, ConversationMessage, User
)
from rag.rag_pipeline  import ingest_document, semantic_search, list_documents, delete_document
from rag.graph_retriever import retrieve_related
from llm.llm_service    import LLMService
from llm.prompt_manager  import PromptManager
from configs.base import settings

router = APIRouter(prefix="/rag", tags=["rag"])
llm = LLMService()
pm  = PromptManager()


# ─── Document Upload & Ingestion ─────────────────────────────────────

@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("SUPER_ADMIN")),
):
    os.makedirs(settings.FILE_UPLOAD_PATH, exist_ok=True)
    doc_id    = str(uuid.uuid4())
    save_path = os.path.join(settings.FILE_UPLOAD_PATH, f"{doc_id}_{file.filename}")

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    doc = KnowledgeDocument(
        id=doc_id, title=title,
        file_name=file.filename, file_path=save_path,
        file_type=os.path.splitext(file.filename)[1].lower(),
        file_size=len(content), status="PROCESSING",
        uploaded_by=str(current_user.id),
    )
    db.add(doc)
    await db.commit()

    try:
        chunk_count = await ingest_document(save_path, doc_id, title)
        await db.execute(update(KnowledgeDocument).where(KnowledgeDocument.id == doc_id).values(
            status="INDEXED", chunk_count=chunk_count
        ))
        await db.commit()
        return {"message": "Document indexed", "doc_id": doc_id, "chunks": chunk_count}
    except Exception as e:
        await db.execute(update(KnowledgeDocument).where(KnowledgeDocument.id == doc_id).values(
            status="FAILED", error_msg=str(e)
        ))
        await db.commit()
        raise HTTPException(500, f"Indexing failed: {e}")


@router.get("/documents")
async def list_kb_documents(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = await db.execute(select(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc()))
    docs = r.scalars().all()
    return {"documents": [{"id": d.id, "title": d.title, "file_name": d.file_name,
                           "status": d.status, "chunk_count": d.chunk_count,
                           "created_at": d.created_at.isoformat() if d.created_at else None} for d in docs]}


@router.delete("/documents/{doc_id}")
async def remove_document(doc_id: str, db: AsyncSession = Depends(get_db),
                           current_user: User = Depends(require_roles("SUPER_ADMIN"))):
    await delete_document(doc_id)
    from sqlalchemy import delete as sql_delete
    await db.execute(sql_delete(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
    await db.commit()
    return {"message": "Document removed"}


# ─── RAG Chat ────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message:    str
    session_id: Optional[str] = None


@router.post("/chat")
async def rag_chat(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get or create session
    session = None
    if body.session_id:
        r = await db.execute(select(ConversationSession).where(ConversationSession.id == body.session_id))
        session = r.scalar_one_or_none()

    if not session:
        session = ConversationSession(
            id=str(uuid.uuid4()),
            user_id=str(current_user.id),
            title=body.message[:80],
            context_store="[]",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

    # Load LLM context
    llm_context = json.loads(session.context_store or "[]")

    # Semantic + graph retrieval
    chunks      = await semantic_search(body.message, top_k=5)
    query_terms = body.message.split()[:5]
    graph_data  = retrieve_related(query_terms)

    # Build history string (last 4 messages)
    hist_r   = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.session_id == session.id)
        .order_by(ConversationMessage.created_at.desc()).limit(4)
    )
    history_msgs = list(reversed(hist_r.scalars().all()))
    history_str  = "\n".join([f"{m.role.upper()}: {m.content}" for m in history_msgs])

    prompt  = pm.rag_chat(body.message, chunks, graph_data, history_str)
    llm_res = await llm.complete(prompt, llm_context)

    # Persist messages
    user_msg = ConversationMessage(
        id=str(uuid.uuid4()), session_id=session.id, role="user", content=body.message
    )
    ai_msg = ConversationMessage(
        id=str(uuid.uuid4()), session_id=session.id, role="assistant",
        content=llm_res["response"],
        retrieved_chunks=[{"text": c["text"][:200], "score": c["score"]} for c in chunks],
        graph_relations=graph_data,
    )
    db.add(user_msg)
    db.add(ai_msg)

    await db.execute(update(ConversationSession).where(ConversationSession.id == session.id).values(
        context_store=json.dumps(llm_res["context"])
    ))
    await db.commit()

    return {
        "session_id": session.id,
        "response":   llm_res["response"],
        "sources":    [{"title": c.get("title"), "score": c.get("score")} for c in chunks],
    }


@router.get("/sessions")
async def list_sessions(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = await db.execute(
        select(ConversationSession).where(ConversationSession.user_id == str(current_user.id))
        .order_by(ConversationSession.updated_at.desc())
    )
    sessions = r.scalars().all()
    return {"sessions": [{"id": s.id, "title": s.title, "updated_at": s.updated_at.isoformat() if s.updated_at else None} for s in sessions]}


@router.get("/sessions/{session_id}/messages")
async def session_messages(session_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = await db.execute(
        select(ConversationMessage).where(ConversationMessage.session_id == session_id)
        .order_by(ConversationMessage.created_at.asc())
    )
    msgs = r.scalars().all()
    return {"messages": [{"id": m.id, "role": m.role, "content": m.content,
                          "created_at": m.created_at.isoformat() if m.created_at else None} for m in msgs]}

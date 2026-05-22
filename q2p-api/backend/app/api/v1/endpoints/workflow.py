"""workflow.py — workflow status and trigger"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_roles
from backend.app.models.all_models import Case, CaseStage

router = APIRouter(prefix="/workflow", tags=["workflow"])

ALL_STAGES = [s.value for s in CaseStage]


@router.get("/case/{case_id}/status")
async def workflow_status(case_id: str, db: AsyncSession = Depends(get_db),
                           current_user=Depends(get_current_user)):
    r = await db.execute(select(Case).where(Case.id == case_id))
    c = r.scalar_one_or_none()
    if not c: raise HTTPException(404, "Case not found")
    stage_val = c.current_stage.value if hasattr(c.current_stage, 'value') else str(c.current_stage)
    idx = ALL_STAGES.index(stage_val) if stage_val in ALL_STAGES else 0
    return {
        "case_id": case_id, "case_number": c.case_number,
        "current_stage": stage_val, "status": str(c.status),
        "progress_percent": round(idx / (len(ALL_STAGES) - 1) * 100),
        "all_stages": ALL_STAGES, "stage_index": idx,
        "last_activity_at": c.last_activity_at.isoformat() if c.last_activity_at else None,
    }


async def _run_workflow_bg(case_id: str):
    from backend.app.core.database import AsyncSessionLocal
    from agents.orchestrator_agent import build_graph
    from sqlalchemy import select as sel
    async with AsyncSessionLocal() as db:
        r  = await db.execute(sel(Case).where(Case.id == case_id))
        c  = r.scalar_one_or_none()
        if not c: return
        g  = build_graph()
        await g.ainvoke({
            "case_id": case_id, "customer_profile": c.customer_profile or {},
            "needs_analysis": {}, "suitability_result": {}, "quotes": [],
            "comparison": {}, "recommendation": {}, "banker_approved": False,
            "proposal": {}, "exceptions": [], "stage": str(c.current_stage),
            "llm_context": [], "error": None,
        })


@router.post("/case/{case_id}/run")
async def trigger_workflow(case_id: str, background_tasks: BackgroundTasks,
                            db: AsyncSession = Depends(get_db),
                            current_user=Depends(require_roles("BANKER", "SUPER_ADMIN"))):
    r = await db.execute(select(Case).where(Case.id == case_id))
    if not r.scalar_one_or_none(): raise HTTPException(404, "Case not found")
    background_tasks.add_task(_run_workflow_bg, case_id)
    return {"message": "Workflow triggered", "case_id": case_id}

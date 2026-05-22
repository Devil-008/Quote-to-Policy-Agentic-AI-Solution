import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from configs.base import settings

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def _job():
    from backend.app.core.database import AsyncSessionLocal
    from escalations.escalation_engine import run_escalation_check
    async with AsyncSessionLocal() as db:
        await run_escalation_check(db)


def start_scheduler():
    scheduler.add_job(
        _job,
        trigger=IntervalTrigger(minutes=settings.ESCALATION_INTERVAL_MINUTES),
        id="escalation_check",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Escalation scheduler started (every {settings.ESCALATION_INTERVAL_MINUTES} min)")


def stop_scheduler():
    scheduler.shutdown(wait=False)

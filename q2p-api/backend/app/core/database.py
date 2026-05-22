from sqlalchemy import text
from sqlalchemy.engine import URL
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from configs.base import settings


engine = create_async_engine(
    URL.create(
        drivername="mysql+asyncmy",
        username=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        database=settings.MYSQL_DB,
    ),
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_recycle=3600,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        pass  # Alembic handles migrations


async def ensure_compatibility():
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = :schema
                  AND TABLE_NAME = 'users'
                  AND COLUMN_NAME = 'name'
                """
            ),
            {"schema": settings.MYSQL_DB},
        )
        has_name_column = result.scalar_one()
        if not has_name_column:
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN name VARCHAR(200) NOT NULL AFTER id")
            )

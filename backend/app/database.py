
from sqlalchemy import create_engine, TypeDecorator, DateTime, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

# UTCタイムゾーンを扱うためのカスタム型
class UTCDateTime(TypeDecorator):
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime, dialect):
        if value is not None:
            if value.tzinfo is None:
                # Naive datetimeはUTCとみなす
                value = value.replace(tzinfo=timezone.utc)
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return None

    def process_result_value(self, value: datetime, dialect):
        if value is not None:
            return value.replace(tzinfo=timezone.utc)
        return None

# 開発用SQLiteデータベースのURL
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////tmp/test.db?journal_mode=WAL")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        # クエリのパフォーマンスを最適化するために統計情報を更新
        db.execute(text("ANALYZE"))
        yield db
    finally:
        db.close()

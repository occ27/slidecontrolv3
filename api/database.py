import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
import sys
from api.paths import BASE_DIR, DB_PATH, get_base_dir, USER_DATA_DIR

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 15}
)

from sqlalchemy import event
import unicodedata
import re

def sqlite_normalize_string(s: str) -> str:
    if not s:
        return ""
    s_norm = unicodedata.normalize("NFD", s.lower())
    s_clean = "".join(c for c in s_norm if unicodedata.category(c) != "Mn")
    cleaned = re.sub(r"[^\w\s]", " ", s_clean)
    return " ".join(cleaned.split())

@event.listens_for(engine, "connect")
def sqlite_engine_connect(dbapi_conn, connection_record):
    dbapi_conn.create_function("normalize", 1, sqlite_normalize_string)
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA busy_timeout=30000;")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, Response, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import signal
import sys
import time

from api.paths import get_frontend_path, AUTH_FILE, UPLOADS_DIR, PRESETS_DIR, BASE_DIR, USER_DATA_DIR
from api.routers import media, system
from api.database import engine, Base
import api.models

# Cria as tabelas do banco de dados caso não existam
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SlideControl V3 API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Monta pastas de uploads e presets estáticos
app.mount("/frontend/uploads", StaticFiles(directory=UPLOADS_DIR), name="user_uploads")
app.mount("/frontend/presets", StaticFiles(directory=PRESETS_DIR), name="user_presets")
app.mount("/frontend", StaticFiles(directory=get_frontend_path()), name="frontend")

# Registra os roteadores
app.include_router(system.router)
app.include_router(media.router, prefix="/api", tags=["Media"])

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": "SlideControl V3", "port": 8767}

@app.get("/")
async def get_root():
    index_file = os.path.join(get_frontend_path(), "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(f.read())
    return {"message": "SlideControl V3 API running"}

@app.get("/api/system/shutdown")
async def shutdown():
    print("[Shutdown] Recebido pedido de encerramento do Electron.")
    def _force_exit():
        time.sleep(0.3)
        try:
            os._exit(0)
        except Exception:
            pass
    import threading
    threading.Thread(target=_force_exit, daemon=True).start()

    parent_pid = os.getppid()
    if parent_pid and parent_pid != 1:
        try:
            os.kill(parent_pid, signal.SIGTERM)
        except Exception:
            pass
    try:
        os.kill(os.getpid(), signal.SIGTERM)
    except Exception:
        pass
    return {"status": "ok"}

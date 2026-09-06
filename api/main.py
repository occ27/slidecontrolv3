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
from api.routers import media, system, bible
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
# Monta atalhos de primeiro nível para acesso direto via HTTP (http://localhost:8767/)
_fe_path = get_frontend_path()
if os.path.exists(os.path.join(_fe_path, "css")):
    app.mount("/css", StaticFiles(directory=os.path.join(_fe_path, "css")), name="css")
if os.path.exists(os.path.join(_fe_path, "js")):
    app.mount("/js", StaticFiles(directory=os.path.join(_fe_path, "js")), name="js")
if os.path.exists(os.path.join(_fe_path, "public")):
    app.mount("/public", StaticFiles(directory=os.path.join(_fe_path, "public")), name="public")

# Registra os roteadores
app.include_router(system.router)
app.include_router(media.router, prefix="/api", tags=["Media"])
app.include_router(bible.router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": "SlideControl V3", "port": 8767}

@app.get("/")
@app.get("/index.html")
async def get_root():
    index_file = os.path.join(get_frontend_path(), "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(f.read())
    return {"message": "SlideControl V3 API running"}

@app.get("/display")
@app.get("/display.html")
async def get_display():
    display_file = os.path.join(get_frontend_path(), "display.html")
    if os.path.exists(display_file):
        with open(display_file, "r", encoding="utf-8") as f:
            return HTMLResponse(f.read())
    return HTMLResponse("Display not found", status_code=404)

@app.get("/retorno")
@app.get("/retorno.html")
async def get_retorno():
    retorno_file = os.path.join(get_frontend_path(), "retorno.html")
    if os.path.exists(retorno_file):
        with open(retorno_file, "r", encoding="utf-8") as f:
            return HTMLResponse(f.read())
    return HTMLResponse("Retorno not found", status_code=404)

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

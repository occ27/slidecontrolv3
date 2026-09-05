import os
import sys
import socket
import httpx
import signal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from api.preferences import load_prefs, save_prefs

router = APIRouter()

CLOUD_SERVER_URL = os.getenv("CLOUD_SERVER_URL", "https://slidecontrol.com.br")

def get_local_ip():
    try:
        connection = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        connection.connect(("8.8.8.8", 80))
        ip = connection.getsockname()[0]
        connection.close()
        return ip
    except OSError:
        return "127.0.0.1"

@router.get("/api/desktop/local-ip")
async def get_desktop_local_ip():
    hostname = socket.gethostname()
    if "." not in hostname:
        hostname += ".local"
    return {"ip": get_local_ip(), "hostname": hostname}

class DesktopRegPayload(BaseModel):
    email: str
    church_name: str
    city: str
    whatsapp: str

class DesktopVerifyPayload(BaseModel):
    email: str
    code: str

@router.get("/api/desktop/preferences")
async def get_preferences():
    prefs = load_prefs()
    return prefs

@router.get("/api/desktop/registration-status")
async def get_registration_status():
    """Retorna o status do registro local e valida a conexão do token com a nuvem."""
    prefs = load_prefs()
    is_registered = prefs.get("is_registered", False)
    token = prefs.get("cloud_sync_token", "")
    email = prefs.get("registered_email", "") or prefs.get("temp_registration_email", "")
    church = prefs.get("registered_church", "") or prefs.get("temp_church_name", "")
    city = prefs.get("registered_city", "") or prefs.get("temp_city", "")
    whatsapp = prefs.get("registered_whatsapp", "") or prefs.get("temp_whatsapp", "")

    if not is_registered or not token:
        return {
            "is_registered": False,
            "token_valid": False,
            "token_status": "unregistered",
            "status_label": "Não Registrado",
            "email": email,
            "church_name": church,
            "city": city,
            "whatsapp": whatsapp,
            "has_token": False
        }

    token_valid = False
    token_status = "invalid"

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                f"{CLOUD_SERVER_URL}/api/public/desktop/check-token",
                headers={"Authorization": f"Bearer {token}"},
                params={"token": token}
            )
            if resp.status_code == 200:
                token_valid = True
                token_status = "active"
                try:
                    data = resp.json()
                    if isinstance(data, dict):
                        if data.get("email"): email = data["email"]
                        if data.get("church_name"): church = data["church_name"]
                        if data.get("city"): city = data["city"]
                        if data.get("whatsapp"): whatsapp = data["whatsapp"]
                        prefs["registered_email"] = email
                        prefs["registered_church"] = church
                        prefs["registered_city"] = city
                        prefs["registered_whatsapp"] = whatsapp
                        save_prefs(prefs)
                except Exception:
                    pass
            elif resp.status_code >= 500:
                token_valid = True
                token_status = "active"
            else:
                token_valid = False
                token_status = "invalid"
    except Exception:
        token_valid = True
        token_status = "active"

    return {
        "is_registered": True,
        "token_valid": token_valid,
        "token_status": token_status,
        "status_label": "Conectado" if token_valid else "Token Inválido / Expirado",
        "email": email,
        "church_name": church,
        "city": city,
        "whatsapp": whatsapp,
        "has_token": bool(token)
    }

@router.post("/api/desktop/register")
async def register_desktop(payload: DesktopRegPayload):
    try:
        prefs = load_prefs()
        prefs["temp_registration_email"] = payload.email
        prefs["temp_church_name"] = payload.church_name
        prefs["temp_city"] = payload.city
        prefs["temp_whatsapp"] = payload.whatsapp
        save_prefs(prefs)

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{CLOUD_SERVER_URL}/api/public/desktop/register", 
                json=payload.model_dump()
            )
            if resp.status_code == 200:
                return {"status": "ok", "message": "Verifique seu e-mail (Token enviado)"}
            else:
                return {"status": "error", "message": resp.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/desktop/verify")
async def verify_desktop(payload: DesktopVerifyPayload):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{CLOUD_SERVER_URL}/api/public/desktop/verify", 
                json=payload.model_dump()
            )
            if resp.status_code == 200:
                data = resp.json()
                prefs = load_prefs()
                prefs["cloud_sync_token"] = data["token"]
                prefs["is_registered"] = True
                if payload.email:
                    prefs["registered_email"] = payload.email
                if prefs.get("temp_church_name"):
                    prefs["registered_church"] = prefs["temp_church_name"]
                if prefs.get("temp_city"):
                    prefs["registered_city"] = prefs["temp_city"]
                if prefs.get("temp_whatsapp"):
                    prefs["registered_whatsapp"] = prefs["temp_whatsapp"]
                save_prefs(prefs)
                return {"status": "ok", "token": data["token"]}
            else:
                return {"status": "error", "message": resp.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/desktop/request-token-renewal")
async def request_token_renewal():
    prefs = load_prefs()
    email = prefs.get("registered_email", "") or prefs.get("temp_registration_email", "")
    church_name = prefs.get("registered_church", "") or prefs.get("temp_church_name", "")
    city = prefs.get("registered_city", "") or prefs.get("temp_city", "")
    whatsapp = prefs.get("registered_whatsapp", "") or prefs.get("temp_whatsapp", "")

    if not email:
        return {"status": "error", "message": "Nenhum e-mail registrado para reenviar código"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{CLOUD_SERVER_URL}/api/public/desktop/register", 
                json={
                    "email": email,
                    "church_name": church_name,
                    "city": city,
                    "whatsapp": whatsapp
                }
            )
            if resp.status_code == 200:
                return {"status": "ok", "message": "Código reenviado com sucesso!"}
            return {"status": "error", "message": resp.text}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/api/desktop/reset-registration")
async def reset_registration():
    prefs = load_prefs()
    prefs["is_registered"] = False
    prefs["cloud_sync_token"] = ""
    save_prefs(prefs)
    return {"status": "ok", "message": "Registro resetado com sucesso."}

@router.get("/api/system/shutdown")
async def system_shutdown():
    """Encerramento gracioso acionado pelo Electron ao fechar a aplicação."""
    print("[Shutdown] Recebido pedido de encerramento do Electron.")
    def _kill():
        import time
        time.sleep(0.15)
        try:
            parent_pid = os.getppid()
            if parent_pid and parent_pid > 1:
                os.kill(parent_pid, signal.SIGTERM)
        except Exception:
            pass
        try:
            os.kill(os.getpid(), signal.SIGTERM)
        except Exception:
            pass
        try:
            os._exit(0)
        except Exception:
            pass
    import threading
    threading.Thread(target=_kill, daemon=True).start()
    return {"status": "shutting_down"}

import logging
logger = logging.getLogger(__name__)
qr_media_token = ""
qr_media_state = {
    "received_count": 0,
    "total_count": 0,
    "last_filename": "",
    "status": "idle"
}
from fastapi import APIRouter
from fastapi import Form, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
import shutil
import re
from typing import List

def secure_filename(filename: str) -> str:
    import re
    if not filename:
        return ""
    filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
    filename = filename.strip('._')
    return filename



from typing import Optional
from pydantic import BaseModel
import os
import requests
import urllib.parse

router = APIRouter()

from api.paths import PRESETS_DIR, THUMBNAILS_DIR, BASE_DIR, CUSTOM_UPLOADS_DIR
CLOUD_SERVER_URL = os.getenv("CLOUD_SERVER_URL", "https://slidecontrol.com.br")

def _generate_thumbnail_sync(video_path: str, thumb_path: str):
    """Gera thumbnail do primeiro frame do vídeo usando ffmpeg ou fallback Pillow."""
    import subprocess
    import shutil as _shutil
    try:
        from PIL import Image, ImageDraw
        _has_pillow = True
    except ImportError:
        _has_pillow = False

    ffmpeg_path = _shutil.which("ffmpeg")
    if ffmpeg_path:
        try:
            cmd = [ffmpeg_path, "-ss", "2", "-i", video_path, "-vframes", "1",
                   "-vf", "scale=320:-1", "-q:v", "3", "-y", thumb_path]
            result = subprocess.run(cmd, capture_output=True, timeout=15)
            if result.returncode == 0 and os.path.exists(thumb_path):
                return
        except Exception as e:
            print(f"[Thumbnail] ffmpeg falhou: {e}")

    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        if cap.isOpened():
            fps = cap.get(cv2.CAP_PROP_FPS)
            total = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            target = int(min(fps * 2, total - 1)) if fps and total else 0
            cap.set(cv2.CAP_PROP_POS_FRAMES, target)
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
            if ret:
                h, w = frame.shape[:2]
                frame = cv2.resize(frame, (320, int(h * 320 / w)))
                cv2.imwrite(thumb_path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            cap.release()
            if os.path.exists(thumb_path):
                return
    except Exception as e:
        print(f"[Thumbnail] cv2 falhou: {e}")

    if _has_pillow:
        try:
            img = Image.new("RGB", (320, 180), color=(30, 30, 30))
            draw = ImageDraw.Draw(img)
            draw.polygon([(120, 65), (120, 115), (200, 90)], fill=(200, 200, 200))
            img.save(thumb_path, "JPEG", quality=75)
        except Exception as e:
            print(f"[Thumbnail] Pillow fallback falhou: {e}")

def _download_cloud_thumbnail(url: str, dest_path: str) -> bool:
    """Baixa a miniatura da nuvem."""
    headers = {"User-Agent": "SlideControl/2.0"}
    try:
        r = requests.get(url, headers=headers, timeout=5.0)
        if r.status_code == 200:
            with open(dest_path, "wb") as f:
                f.write(r.content)
            return True
    except Exception as e:
        print(f"[Thumbnail Cloud] Erro: {e}")
    return False

class DownloadPresetRequest(BaseModel):
    name: str
    url: str
    category: str = "Outros"

def _get_preset_category_and_path(filename: str, explicit_category: str = None):
    """Retorna a categoria e os caminhos (pasta e arquivo) de um preset baseado no nome ou na categoria explícita."""
    safe_name = os.path.basename(filename)
    
    if explicit_category and explicit_category != "Outros":
        category = explicit_category
    else:
        title = os.path.splitext(safe_name)[0].replace('_', ' ').replace('-', ' ').title()
        category = "Outros"
        if '_' in safe_name:
            # Fallback to taking everything before the first underscore
            category = safe_name.split('_', 1)[0]
            
    category_dir = os.path.join(PRESETS_DIR, category)
    file_path = os.path.join(category_dir, safe_name)
    return category, category_dir, file_path

@router.get("/backgrounds/presets/categories")
def get_local_preset_categories(media_type: str = "image"):
    """Retorna a lista de categorias locais existentes no disco."""
    categories = set()
    valid_exts = ('.mp4', '.webm', '.mov', '.mkv', '.avi', '.ogg') if media_type == 'video' else ('.png', '.jpg', '.jpeg', '.webp')
    
    if os.path.exists(PRESETS_DIR):
        for entry in os.listdir(PRESETS_DIR):
            cat_dir = os.path.join(PRESETS_DIR, entry)
            if os.path.isdir(cat_dir) and not entry.startswith('.'):
                has_media = False
                for f in os.listdir(cat_dir):
                    if not f.startswith('.') and not f.endswith('.tmp'):
                        ext = os.path.splitext(f)[1].lower()
                        if ext in valid_exts:
                            has_media = True
                            break
                if has_media:
                    categories.add(entry)
    
    cats = list(categories)
    cats.sort()
    if cats:
        cats.insert(0, "Todas")
    else:
        cats = ["Todas"]
        
    return cats

@router.get("/backgrounds/presets")
def get_presets(media_type: str = "image", category: Optional[str] = "Todas", page: int = 1, limit: int = 20):
    """Retorna a lista de presets locais baixados no computador."""
    items = []
    
    scan_dirs = []
    if os.path.exists(PRESETS_DIR):
        if category and category != "Todas":
            cat_dir = os.path.join(PRESETS_DIR, category)
            if os.path.exists(cat_dir):
                scan_dirs.append(cat_dir)
        else:
            for entry in os.listdir(PRESETS_DIR):
                d = os.path.join(PRESETS_DIR, entry)
                if os.path.isdir(d) and not entry.startswith('.'):
                    scan_dirs.append(d)
                    
    valid_exts = ('.mp4', '.webm', '.mov', '.mkv', '.avi', '.ogg') if media_type == 'video' else ('.png', '.jpg', '.jpeg', '.webp')
    
    all_files = []
    for d in scan_dirs:
        for f in os.listdir(d):
            if f.startswith('.') or f.endswith('.tmp'):
                continue
            ext = os.path.splitext(f)[1].lower()
            if ext in valid_exts:
                all_files.append((d, f))
                
    all_files.sort(key=lambda x: x[1])
    
    start_idx = (page - 1) * limit
    end_idx = start_idx + limit
    paginated_files = all_files[start_idx:end_idx]
    
    for d, f in paginated_files:
        title = os.path.splitext(f)[0].replace('_', ' ').replace('-', ' ').title()
        file_category = os.path.basename(d)
        
        if '_' in f:
            parts = title.split(' ', 1)
            if len(parts) > 1:
                title = parts[1]
                
        items.append({
            "name": f,
            "title": title,
            "category": file_category,
            "url": f"/frontend/presets/{urllib.parse.quote(file_category)}/{urllib.parse.quote(f)}",
            "downloaded": True
        })
        
    has_more = len(all_files) > end_idx
    return {"items": items, "has_more": has_more}

@router.get("/backgrounds/cloud/categories")
def get_cloud_categories(media_type: str = "image"):
    """Proxy para buscar as categorias do servidor na nuvem."""
    try:
        r = requests.get(f"{CLOUD_SERVER_URL}/api/presets/categories", timeout=5.0)
        if r.status_code != 200:
            return []
        categories = r.json()
    except Exception as e:
        print(f"[Media Router] Erro ao buscar categorias da nuvem: {e}")
        return []

    physical_files = set()
    if os.path.exists(PRESETS_DIR):
        for root, dirs, files in os.walk(PRESETS_DIR):
            for f in files:
                if not f.startswith('.') and not f.endswith('.tmp'):
                    physical_files.add(f)

    def has_media(category_name):
        try:
            url = f"{CLOUD_SERVER_URL}/api/presets/category/{urllib.parse.quote(category_name)}"
            res = requests.get(url, timeout=3.0)
            if res.status_code == 200:
                cloud_data = res.json()
                if media_type == "image":
                    for item in cloud_data.get("images", []):
                        name = item["name"]
                        suffix = name.split('_', 1)[-1] if '_' in name else name
                        if name not in physical_files and suffix not in physical_files:
                            return True
                else:
                    for item in cloud_data.get("videos", []):
                        name = item["name"]
                        suffix = name.split('_', 1)[-1] if '_' in name else name
                        if name not in physical_files and suffix not in physical_files:
                            return True
        except Exception as e:
            pass
        return False

    valid_categories = []
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(lambda c: (c, has_media(c)), categories))
        for cat, has_items in results:
            if has_items:
                valid_categories.append(cat)

    valid_categories.sort()
    return valid_categories

@router.get("/backgrounds/cloud/category/{category_name}")
def get_cloud_category_media(category_name: str, media_type: str = "image"):
    """Proxy para buscar mídias de uma categoria específica da nuvem."""
    try:
        url = f"{CLOUD_SERVER_URL}/api/presets/category/{urllib.parse.quote(category_name)}"
        res = requests.get(url, timeout=5.0)
        if res.status_code != 200:
            return []
        cloud_data = res.json()
    except Exception as e:
        return []
        
    physical_files = set()
    if os.path.exists(PRESETS_DIR):
        for root, dirs, files in os.walk(PRESETS_DIR):
            for f in files:
                if not f.startswith('.') and not f.endswith('.tmp'):
                    physical_files.add(f)
                    
    items = []
    source_list = cloud_data.get("images", []) if media_type == "image" else cloud_data.get("videos", [])
    
    for item in source_list:
        name = item["name"]
        suffix = name.split('_', 1)[-1] if '_' in name else name
        is_downloaded = name in physical_files or suffix in physical_files
        
        # Só lista itens que ainda NÃO foram baixados
        if is_downloaded:
            continue
        
        thumb_url = None
        if item.get('thumbnail'):
            thumb_url = f"{CLOUD_SERVER_URL}{item['thumbnail']}"
        elif media_type == "video":
            thumb_url = f"{CLOUD_SERVER_URL}/api/presets/thumbnail/{urllib.parse.quote(name)}"

        items.append({
            "name": name,
            "title": item.get("title", name),
            "category": item.get("category", category_name),
            "url": f"{CLOUD_SERVER_URL}{item['url']}",
            "thumbnail": thumb_url,
            "downloaded": False
        })
        
    items.sort(key=lambda x: x["name"])
    return items

@router.post("/backgrounds/presets/download")
def download_preset(req: DownloadPresetRequest):
    """Baixa um preset da nuvem para a pasta local backgrounds/presets."""
    _, category_dir, dest_path = _get_preset_category_and_path(req.name, req.category)
    os.makedirs(category_dir, exist_ok=True)
    if os.path.exists(dest_path):
        return {"status": "success", "url": f"/frontend/presets/{os.path.basename(category_dir)}/{req.name}"}

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        url = req.url
        if not url.startswith("http"):
            url = f"{CLOUD_SERVER_URL}{url}"
            
        r = requests.get(url, headers=headers, stream=True, timeout=60)
        if r.status_code != 200:
            return {"status": "error", "message": f"Erro do servidor de nuvem: status {r.status_code}"}
        
        temp_path = dest_path + ".tmp"
        with open(temp_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    
        os.rename(temp_path, dest_path)
        return {"status": "success", "url": f"/frontend/presets/{os.path.basename(category_dir)}/{req.name}"}
        
    except Exception as e:
        if os.path.exists(dest_path + ".tmp"):
            os.remove(dest_path + ".tmp")
        return {"status": "error", "message": str(e)}

@router.delete("/backgrounds/presets/{filename}")
def delete_preset(filename: str):
    """Exclui um preset baixado localmente e sua thumbnail."""
    safe_name = os.path.basename(filename)
    
    # 1. Procurar o arquivo em qualquer subpasta de PRESETS_DIR
    target_file = None
    for root, dirs, files in os.walk(PRESETS_DIR):
        if safe_name in files:
            target_file = os.path.join(root, safe_name)
            break
            
    if target_file and os.path.exists(target_file):
        try:
            os.remove(target_file)
            # Tentar remover a pasta pai se ficou vazia (exceto as pastas ocultas como .thumbnails)
            parent_dir = os.path.dirname(target_file)
            if not os.path.basename(parent_dir).startswith('.'):
                if not os.listdir(parent_dir):
                    os.rmdir(parent_dir)
        except PermissionError:
            return {"status": "error", "message": "O arquivo está em uso. Mude o fundo antes de excluir."}
        except OSError:
            pass # Pode não conseguir deletar a pasta pai, ok

    # 2. Deletar a miniatura se existir
    thumb_name = os.path.splitext(safe_name)[0] + ".jpg"
    thumb_path = os.path.join(THUMBNAILS_DIR, thumb_name)
    if os.path.exists(thumb_path):
        try:
            os.remove(thumb_path)
        except OSError:
            pass

    return {"status": "success"}

@router.get("/backgrounds/presets/thumbnail/{filename}")
async def serve_preset_thumbnail(filename: str):
    """Retorna (ou gera) uma thumbnail JPEG do primeiro frame do vídeo preset."""
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    import asyncio

    safe_name = os.path.basename(filename)
    _, _, video_path = _get_preset_category_and_path(safe_name)

    thumb_name = os.path.splitext(safe_name)[0] + ".jpg"
    thumb_path = os.path.join(THUMBNAILS_DIR, thumb_name)

    # 1. Tenta baixar da nuvem (mais rápido, garantido para presets oficiais)
    if not os.path.exists(thumb_path):
        cloud_url = f"{CLOUD_SERVER_URL}/api/presets/thumbnail/{safe_name}"
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _download_cloud_thumbnail, cloud_url, thumb_path)

    # 2. Se falhou ou está offline, gera localmente com ffmpeg/cv2
    if not os.path.exists(thumb_path) and os.path.exists(video_path):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _generate_thumbnail_sync, video_path, thumb_path)

    if os.path.exists(thumb_path):
        return FileResponse(thumb_path, media_type="image/jpeg",
                            headers={"Cache-Control": "public, max-age=86400"})

    raise HTTPException(status_code=404, detail="Não foi possível gerar ou baixar a thumbnail")



CUSTOM_DIR = CUSTOM_UPLOADS_DIR


def natural_sort_key(s: str):
    import re
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r"(\d+)", s)]

def _get_video_has_audio(file_path: str) -> bool:
    try:
        from tinytag import TinyTag
        tag = TinyTag.get(file_path)
        return tag.channels is not None or tag.samplerate is not None
    except Exception:
        return False


@router.get("/media/custom")
async def get_custom_backgrounds(path: Optional[str] = "", query: Optional[str] = ""):
    """Retorna os planos de fundo personalizados (uploads) salvos localmente, suportando subpastas e busca recursiva."""
    files = []
    
    if query:
        query_lower = query.lower()
        for root, dirs, filenames in os.walk(CUSTOM_DIR):
            for d in dirs:
                if d.startswith('.'): continue
                if query_lower in d.lower():
                    rel_path = os.path.relpath(os.path.join(root, d), CUSTOM_DIR)
                    url_path = f"/frontend/uploads/custom/{rel_path}".replace('//', '/')
                    files.append({
                        "name": d,
                        "url": url_path,
                        "is_dir": True,
                        "kind": "folder",
                        "path": rel_path.replace('\\\\', '/')
                    })
            for f in filenames:
                if f.startswith('.'): continue
                if query_lower in f.lower() and f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm', '.mov', '.mkv', '.avi', '.ogg')):
                    rel_path = os.path.relpath(os.path.join(root, f), CUSTOM_DIR)
                    url_path = f"/frontend/uploads/custom/{rel_path}".replace('//', '/')
                    kind = "video" if f.lower().endswith(('.mp4', '.webm', '.mov', '.mkv', '.avi', '.ogg')) else "image"
                    
                    item = {
                        "name": f,
                        "url": url_path,
                        "is_dir": False,
                        "kind": kind,
                        "path": rel_path.replace('\\\\', '/')
                    }
                    if kind == "video":
                        item["has_audio"] = _get_video_has_audio(os.path.join(root, f))
                    files.append(item)
        files.sort(key=lambda x: (not x["is_dir"], natural_sort_key(x["name"])))
        return files

    safe_path = os.path.normpath(path).strip('/')
    # normpath('') retorna '.', normalizar para vazio
    if safe_path in ('.', '') or safe_path.startswith('..') or safe_path.startswith('/'):
        safe_path = ''
        
    target_dir = CUSTOM_DIR if not safe_path else os.path.join(CUSTOM_DIR, safe_path)
    
    if os.path.exists(target_dir) and os.path.isdir(target_dir):
        for f in sorted(os.listdir(target_dir)):
            if f.startswith('.'): continue
            
            full_path = os.path.join(target_dir, f)
            # Normaliza o path para evitar "./" no início
            if safe_path:
                item_rel = f"{safe_path}/{f}"
                url_path = f"/frontend/uploads/custom/{safe_path}/{f}"
            else:
                item_rel = f
                url_path = f"/frontend/uploads/custom/{f}"
            
            if os.path.isdir(full_path):
                files.append({
                    "name": f,
                    "url": url_path,
                    "is_dir": True,
                    "kind": "folder",
                    "path": item_rel
                })
            elif f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm', '.mov', '.mkv', '.avi', '.ogg')):
                kind = "video" if f.lower().endswith(('.mp4', '.webm', '.mov', '.mkv', '.avi', '.ogg')) else "image"
                
                item = {
                    "name": f,
                    "url": url_path,
                    "is_dir": False,
                    "kind": kind,
                    "path": item_rel
                }
                if kind == "video":
                    item["has_audio"] = _get_video_has_audio(full_path)
                files.append(item)
    
    files.sort(key=lambda x: (not x["is_dir"], natural_sort_key(x["name"])))
    return files




@router.post("/media/custom/open-folder")
async def open_custom_folder_os(path: str = Form("")):
    """Abre a pasta no gerenciador de arquivos nativo do SO (Finder no macOS, Explorer no Windows)."""
    import sys, subprocess
    safe_path = os.path.normpath(path).strip("/")
    if safe_path.startswith("..") or safe_path.startswith("/"):
        safe_path = ""
    target_dir = os.path.join(CUSTOM_DIR, safe_path)
    os.makedirs(target_dir, exist_ok=True)

    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", target_dir])
        elif sys.platform == "win32":
            subprocess.Popen(["explorer", os.path.normpath(target_dir)])
        else:
            subprocess.Popen(["xdg-open", target_dir])
        return {"status": "success", "target_dir": target_dir}
    except Exception as e:
        logger.error(f"Erro ao abrir pasta no SO: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/media/custom/reveal-item")
async def reveal_custom_item_os(path: str = Form(...)):
    """Revela um arquivo ou pasta selecionado no Finder/Explorer do SO."""
    import sys, subprocess
    safe_path = os.path.normpath(path).strip("/")
    if safe_path.startswith("..") or safe_path.startswith("/"):
        raise HTTPException(status_code=400, detail="Caminho inválido")
    target_item = os.path.join(CUSTOM_DIR, safe_path)
    if not os.path.exists(target_item):
        raise HTTPException(status_code=404, detail="Item não encontrado")

    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", "-R", target_item])
        elif sys.platform == "win32":
            subprocess.Popen(["explorer", f"/select,{os.path.normpath(target_item)}"])
        else:
            subprocess.Popen(["xdg-open", os.path.dirname(target_item)])
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Erro ao revelar item no SO: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/media/custom/system-info")
async def get_custom_system_info():
    """Retorna informações do sistema para a interface nativa (SO, caminho base)."""
    import sys
    os_name = "mac" if sys.platform == "darwin" else ("win" if sys.platform == "win32" else "linux")
    file_manager_name = "Finder" if os_name == "mac" else ("Explorador de Arquivos" if os_name == "win" else "Gerenciador de Arquivos")
    return {
        "os": os_name,
        "file_manager": file_manager_name,
        "base_dir": CUSTOM_DIR
    }

@router.post("/media/custom/folder")

async def create_custom_folder(path: str = Form(""), folder_name: str = Form(...)):
    safe_path = os.path.normpath(path).strip('/')
    if safe_path.startswith('..') or safe_path.startswith('/'):
        safe_path = ''
        
    safe_folder = secure_filename(folder_name)
    if not safe_folder:
        safe_folder = "Nova_Pasta"
        
    target_dir = os.path.join(CUSTOM_DIR, safe_path, safe_folder)
    os.makedirs(target_dir, exist_ok=True)
    return {"status": "success"}

@router.put("/media/custom/rename")
async def rename_custom_background(path: str = Form(...), new_name: str = Form(...)):
    """Renomeia um arquivo ou pasta dentro do diretório CUSTOM_DIR"""
    safe_path = os.path.normpath(path).strip('/')
    if safe_path.startswith('..') or safe_path.startswith('/'):
        return {"error": "Caminho inválido"}, 400
        
    target_path = os.path.join(CUSTOM_DIR, safe_path)
    if not os.path.exists(target_path):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Arquivo ou pasta não encontrado")
        
    safe_new_name = "".join([c for c in new_name if c.isalnum() or c in " ._-()[]{}!@#$%^&="]).strip()
    if not safe_new_name:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Nome inválido")
        
    parent_dir = os.path.dirname(target_path)
    
    if os.path.isfile(target_path):
        ext = os.path.splitext(target_path)[1]
        if not safe_new_name.lower().endswith(ext.lower()):
             safe_new_name += ext

    new_target_path = os.path.join(parent_dir, safe_new_name)
    
    if os.path.exists(new_target_path):
         from fastapi import HTTPException
         raise HTTPException(status_code=400, detail="Já existe um arquivo ou pasta com este nome")
         
    try:
        os.rename(target_path, new_target_path)
        
        old_rel = safe_path.replace('\\', '/')
        new_rel = os.path.relpath(new_target_path, CUSTOM_DIR).replace('\\', '/')
        
        
        return {"message": "Renomeado com sucesso"}
    except Exception as e:
        logger.error(f"Erro ao renomear {path}: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Erro ao renomear")

@router.put("/media/custom/move")
async def move_custom_background(path: str = Form(...), dest_folder: str = Form(...)):
    """Move um arquivo ou pasta para dentro de outra pasta (ou raiz) em CUSTOM_DIR"""
    safe_path = os.path.normpath(path).strip('/')
    safe_dest = os.path.normpath(dest_folder).strip('/')
    
    if safe_path.startswith('..') or safe_path.startswith('/'):
        return {"error": "Caminho de origem inválido"}, 400
    if safe_dest.startswith('..') or safe_dest.startswith('/'):
        # safe_dest pode ser '' (raiz), o que é válido
        if dest_folder != "":
            return {"error": "Caminho de destino inválido"}, 400
        safe_dest = ''
        
    source_path = os.path.join(CUSTOM_DIR, safe_path)
    if not os.path.exists(source_path):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Arquivo de origem não encontrado")
        
    dest_path = os.path.join(CUSTOM_DIR, safe_dest)
    if not os.path.exists(dest_path) or not os.path.isdir(dest_path):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Pasta de destino não encontrada")
        
    # Não pode mover uma pasta para dentro de si mesma
    if safe_dest.startswith(safe_path) and safe_path != "":
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Não é possível mover uma pasta para dentro dela mesma")
        
    filename = os.path.basename(source_path)
    new_target_path = os.path.join(dest_path, filename)
    
    if os.path.exists(new_target_path):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Já existe um item com esse nome no destino")
        
    try:
        shutil.move(source_path, new_target_path)
        
        old_rel = safe_path.replace('\\', '/')
        new_rel = os.path.relpath(new_target_path, CUSTOM_DIR).replace('\\', '/')
        
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Erro ao mover {path} para {dest_folder}: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Erro ao mover")

class AssignFolderRequest(BaseModel):
    folder_path: str

@router.post("/desktop/songs/{song_id}/assign-folder-backgrounds")
async def assign_folder_backgrounds(song_id: int, payload: AssignFolderRequest):
    try:
        safe_path = os.path.normpath(payload.folder_path).strip('/')
        if safe_path.startswith('..') or safe_path.startswith('/'):
            return {"cancelled": True, "detail": "Caminho inválido."}
            
        selected_dir = os.path.join(CUSTOM_DIR, safe_path)
        if not os.path.isdir(selected_dir):
            return {"cancelled": True, "detail": "Pasta não encontrada."}
            
        supported_exts = {'.mp4', '.mov', '.webm', '.jpg', '.jpeg', '.png'}
        media_files = []
        for f in os.listdir(selected_dir):
            ext = os.path.splitext(f)[1].lower()
            if ext in supported_exts:
                media_files.append(f)
                
        if not media_files:
            return {"cancelled": True, "detail": "Nenhuma mídia suportada encontrada na pasta."}
            
        assignments = {}
        
        for f in media_files:
            # Extract number from filename
            match = re.search(r'\d+', f)
            if not match:
                continue
                
            slide_number = int(match.group())
            slide_index = slide_number - 1 # 0-indexed
            
            if slide_index < 0:
                continue
                
            ext = os.path.splitext(f)[1].lower()
            kind = "video" if ext in {'.mp4', '.mov', '.webm'} else "image"
            
            # Não fazemos cópia, apenas criamos a URL apontando para a pasta original do Meus Uploads
            url_path = f"/frontend/uploads/custom/{urllib.parse.quote(safe_path)}/{urllib.parse.quote(f)}"
            
            assignments[str(slide_index)] = {"kind": kind, "value": url_path}
            
        return {"cancelled": False, "assignments": assignments}
        
    except Exception as e:
        logger.error(f"[Folder Assign] Erro: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/media/custom/copy")
async def copy_custom_background(path: str = Form(...), dest_folder: str = Form(...)):
    """Copia um arquivo ou pasta para dentro de outra pasta (ou raiz) em CUSTOM_DIR"""
    safe_path = os.path.normpath(path).strip('/')
    safe_dest = os.path.normpath(dest_folder).strip('/')
    
    if safe_path.startswith('..') or safe_path.startswith('/'):
        return {"error": "Caminho de origem inválido"}, 400
    if safe_dest.startswith('..') or safe_dest.startswith('/'):
        if dest_folder != "":
            return {"error": "Caminho de destino inválido"}, 400
        safe_dest = ''
        
    source_path = os.path.join(CUSTOM_DIR, safe_path)
    if not os.path.exists(source_path):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Arquivo de origem não encontrado")
        
    dest_path = os.path.join(CUSTOM_DIR, safe_dest)
    if not os.path.exists(dest_path) or not os.path.isdir(dest_path):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Pasta de destino não encontrada")
        
    if safe_dest.startswith(safe_path) and safe_path != "":
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Não é possível copiar uma pasta para dentro dela mesma")
        
    filename = os.path.basename(source_path)
    base_name, ext = os.path.splitext(filename)
    new_target_path = os.path.join(dest_path, filename)
    
    # Handle conflicts
    counter = 1
    while os.path.exists(new_target_path):
        new_target_path = os.path.join(dest_path, f"{base_name} ({counter}){ext}")
        counter += 1
        
    try:
        if os.path.isdir(source_path):
            shutil.copytree(source_path, new_target_path)
        else:
            shutil.copy2(source_path, new_target_path)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Erro ao copiar {path} para {dest_folder}: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Erro ao copiar")

@router.delete("/media/custom/delete")
@router.delete("/media/custom/item")
async def delete_custom_item(path: str):
    """Exclui um arquivo ou pasta de fundos customizados."""
    safe_path = os.path.normpath(path).strip('/')
    if safe_path.startswith('..') or safe_path.startswith('/'):
        return {"status": "error", "message": "Caminho inválido"}
        
    target_path = os.path.join(CUSTOM_DIR, safe_path)
    if os.path.exists(target_path) and target_path != CUSTOM_DIR:
        try:
            if os.path.isdir(target_path):
                shutil.rmtree(target_path)
            else:
                os.remove(target_path)
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    return {"status": "error", "message": "Item não encontrado"}

@router.get("/media/mobile-upload")
def mobile_media_upload_page(path: str = "", token: str = ""):
    from fastapi.responses import HTMLResponse
    global qr_media_token
    
    if not qr_media_token or token != qr_media_token:
        html_content = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QR Code Expirado</title>
    <style>
        body { font-family: sans-serif; background-color: #121212; color: #fff; text-align: center; padding: 50px 20px; }
        h1 { color: #e74c3c; }
    </style>
</head>
<body>
    <h1>QR Code Expirado</h1>
    <p>Por favor, abra a tela de QR Code no computador novamente.</p>
</body>
</html>"""
        return HTMLResponse(content=html_content)

    html_content = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enviar Mídia - SlideControl</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #121212;
            color: #ffffff;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .container {
            background: #1e1e1e;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
            width: 100%;
            box-sizing: border-box;
        }
        h1 { font-size: 20px; margin-bottom: 5px; color: #f39c12; }
        h2 { font-size: 14px; margin-bottom: 25px; color: #aaa; font-weight: normal; }
        .file-upload-btn {
            background-color: #f39c12; color: #000; border: none; padding: 15px 30px;
            font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer;
            display: inline-block; width: 100%; box-sizing: border-box; margin-bottom: 15px;
        }
        .file-upload-btn:active { background-color: #e67e22; }
        input[type="file"] { display: none; }
        #status { margin-top: 20px; font-size: 14px; color: #aaa; }
        .success { color: #2ecc71 !important; font-weight: bold; }
        .error { color: #e74c3c !important; }
        .spinner {
            display: inline-block; width: 20px; height: 20px;
            border: 3px solid rgba(255,255,255,.3); border-radius: 50%; border-top-color: #fff;
            animation: spin 1s ease-in-out infinite; margin-bottom: -5px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <img src="/frontend/public/slidecontrol.svg" alt="SlideControl" style="height: 40px; margin-bottom: 20px;">
    <div class="container" id="upload-container">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#f39c12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 15px;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <h1>Enviar Mídia</h1>
        <h2>Imagens (JPG, PNG) ou Vídeos (MP4)</h2>
        <label for="media-upload" class="file-upload-btn">Selecionar Arquivos</label>
        <input type="file" id="media-upload" accept="image/*,video/*" multiple>
        <div id="status">Selecione um ou mais arquivos do seu celular.</div>
    </div>
    <script>
        const fileInput = document.getElementById('media-upload');
        const statusDiv = document.getElementById('status');
        
        fileInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files.length === 0) return;
            
            document.querySelector('.file-upload-btn').style.display = 'none';
            statusDiv.className = '';
            let successCount = 0;
            let errorCount = 0;
            let lastError = '';

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                statusDiv.innerHTML = `<div class="spinner"></div> Enviando arquivo ${i + 1} de ${files.length}...`;
                
                const formData = new FormData();
                formData.append('file', file);
                formData.append('source', 'mobile');
                formData.append('path', '{path}');
                formData.append('token', '{token}');
                
                try {
                    const response = await fetch('/api/media/upload', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.ok) {
                        successCount++;
                    } else {
                        const result = await response.json().catch(() => ({}));
                        throw new Error(result.error || result.detail || 'Erro ao enviar. O QR Code pode ter expirado.');
                    }
                } catch (err) {
                    errorCount++;
                    lastError = err.message;
                }
            }
            
            if (errorCount === 0) {
                statusDiv.innerHTML = `Envio concluído: ${successCount} arquivo(s). Selecione mais arquivos para continuar.`;
                statusDiv.className = 'success';
                document.querySelector('.file-upload-btn').style.display = 'inline-block';
                fileInput.value = '';
                fetch('/api/media/qr-media-batch-done', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ success_count: successCount, total_count: files.length }) }).catch(() => {});
            } else if (successCount > 0) {
                statusDiv.innerHTML = `Envio concluído com erros. Sucesso: ${successCount}. Erro: ${errorCount}. (Último erro: ${lastError})`;
                statusDiv.className = 'error';
                document.querySelector('.file-upload-btn').style.display = 'inline-block';
                fileInput.value = '';
                fetch('/api/media/qr-media-batch-done', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ success_count: successCount }) }).catch(() => {});
            } else {
                statusDiv.innerHTML = 'Erro ao enviar: ' + lastError;
                statusDiv.className = 'error';
                document.querySelector('.file-upload-btn').style.display = 'inline-block';
                fileInput.value = '';
            }
        });
    </script>
</body>
</html>"""
    
    html_content = html_content.replace("{path}", path).replace("{token}", token)
    return HTMLResponse(content=html_content)

@router.get("/media/custom/thumbnail/{path:path}")
async def serve_custom_thumbnail(path: str):
    """Retorna (ou gera) uma thumbnail para os planos de fundo personalizados."""
    safe_path = os.path.normpath(path).strip('/')
    if safe_path.startswith('..') or safe_path.startswith('/'):
        raise HTTPException(status_code=400, detail="Invalid path")

    original_file = os.path.join(CUSTOM_DIR, safe_path)
    if not os.path.exists(original_file):
        raise HTTPException(status_code=404, detail="File not found")

    # Nome seguro para o cache
    cache_name = safe_path.replace('/', '_').replace('\\', '_') + ".jpg"
    thumb_path = os.path.join(THUMBNAILS_DIR, "custom_" + cache_name)

    if os.path.exists(thumb_path):
        return FileResponse(thumb_path, media_type="image/jpeg")

    os.makedirs(THUMBNAILS_DIR, exist_ok=True)

    import asyncio
    loop = asyncio.get_event_loop()
    
    is_video = original_file.lower().endswith(('.mp4', '.webm', '.mov', '.mkv', '.avi', '.ogg'))
    try:
        if is_video:
            await loop.run_in_executor(None, _generate_thumbnail_sync, original_file, thumb_path)
        else:
            # Para imagem, podemos usar a mesma função de resize se adaptada, ou só retornar a original.
            # Como a imagem original já é exibida ok, vamos apenas copiá-la ou usar o Pillow se disponível.
            # Para simplificar, copia a imagem original como thumbnail (ou apenas retorna ela)
            return FileResponse(original_file)
            
        if os.path.exists(thumb_path):
            return FileResponse(thumb_path, media_type="image/jpeg")
    except Exception as e:
        logger.error(f"[Thumbnail] Erro ao gerar thumbnail para custom: {e}")
        
    return FileResponse(original_file)

@router.post("/media/upload")
async def upload_background(file: UploadFile = File(...), path: str = Form(""), source: str = Form(""), token: str = Form("")):
    """Recebe upload de arquivos para usar como plano de fundo, salvando em custom."""
    global qr_media_token
    if source == 'mobile':
        if not qr_media_token or token != qr_media_token:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=400, content={"error": "O modal do QR Code foi fechado no computador ou expirou. Abra novamente."})

    # Normaliza o subpath de destino
    safe_path = os.path.normpath(path).strip('/') if path else ''
    if safe_path in ('.', '') or safe_path.startswith('..'):
        safe_path = ''

    dest_dir = CUSTOM_DIR if not safe_path else os.path.join(CUSTOM_DIR, safe_path)
    os.makedirs(dest_dir, exist_ok=True)

    safe_name = secure_filename(file.filename or 'upload')
    if not safe_name:
        safe_name = 'upload'

    dest_path = os.path.join(dest_dir, safe_name)
    # Evita sobrescrever arquivos com mesmo nome
    if os.path.exists(dest_path):
        base, ext = os.path.splitext(safe_name)
        import time
        safe_name = f"{base}_{int(time.time())}{ext}"
        dest_path = os.path.join(dest_dir, safe_name)

    content = await file.read()
    with open(dest_path, 'wb') as f:
        f.write(content)

    if source == 'mobile':
        qr_media_state["received_count"] += 1
        qr_media_state["last_filename"] = safe_name
        qr_media_state["status"] = "receiving"

    rel_path = safe_name if not safe_path else f"{safe_path}/{safe_name}"
    url_path = f"/frontend/uploads/custom/{rel_path}"
    return {"status": "success", "url": url_path, "name": safe_name}

@router.post("/media/qr-media-status")
async def set_qr_media_status(status: dict):
    global qr_media_token, qr_media_state
    if status.get("active", False):
        import uuid
        qr_media_token = str(uuid.uuid4())
        qr_media_state = {"received_count": 0, "total_count": 0, "last_filename": "", "status": "waiting"}
        return {"status": "ok", "active": True, "token": qr_media_token}
    else:
        qr_media_token = None
        qr_media_state = {"received_count": 0, "total_count": 0, "last_filename": "", "status": "idle"}
        return {"status": "ok", "active": False}


@router.get("/media/qr-media-status")
async def get_qr_media_status(token: str = ""):
    if not qr_media_token or token != qr_media_token:
        raise HTTPException(status_code=403, detail="Sessão QR expirada")
    return {"status": "ok", "active": True, **qr_media_state}


@router.post("/media/qr-media-batch-done")
async def qr_media_batch_done(payload: dict):
    qr_media_state["total_count"] = payload.get("total_count", payload.get("success_count", 0))
    qr_media_state["status"] = "waiting"
    return {"status": "ok"}


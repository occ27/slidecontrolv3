import os
import sys
import shutil

def get_base_dir() -> str:
    if getattr(sys, "frozen", False):
        backend_dir = os.path.dirname(sys.executable)
        resources_dir = os.path.dirname(backend_dir)
        return os.path.join(resources_dir, "app")
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_frontend_path() -> str:
    return os.path.join(get_base_dir(), "frontend")

def get_user_data_dir() -> str:
    env_path = os.environ.get("SLIDECONTROL_USER_DATA")
    if env_path:
        os.makedirs(env_path, exist_ok=True)
        return env_path

    if getattr(sys, "frozen", False):
        if sys.platform == "win32":
            appdata = os.environ.get("APPDATA") or os.path.expanduser("~\\AppData\\Roaming")
            target = os.path.join(appdata, "SlideControl")
        elif sys.platform == "darwin":
            target = os.path.expanduser("~/Library/Application Support/SlideControl")
        else:
            target = os.path.expanduser("~/.config/SlideControl")
        os.makedirs(target, exist_ok=True)
        return target

    return get_base_dir()

BASE_DIR = get_base_dir()
USER_DATA_DIR = get_user_data_dir()

os.makedirs(USER_DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(USER_DATA_DIR, "slidecontrol_local.db")

DATA_DIR = os.path.join(USER_DATA_DIR, ".data")
os.makedirs(DATA_DIR, exist_ok=True)
PREFS_FILE = os.path.join(DATA_DIR, "preferences.json")
AVISOS_FILE = os.path.join(DATA_DIR, "avisos.json")

AUTH_FILE = os.path.join(USER_DATA_DIR, "auth.json")
QUEUE_FILE = os.path.join(USER_DATA_DIR, "queue.json")
ESCALIX_TEMP_FILE = os.path.join(USER_DATA_DIR, "escalix_temp.json")

TRANSCRIPTION_CONFIG_FILE = os.path.join(USER_DATA_DIR, "transcription_config.json")
BIBLE_AI_CACHE_FILE = os.path.join(USER_DATA_DIR, "bible_ai_cache.json")

UPLOADS_DIR = os.path.join(USER_DATA_DIR, "frontend", "uploads")
CUSTOM_UPLOADS_DIR = os.path.join(UPLOADS_DIR, "custom")
AUDIO_UPLOADS_DIR = os.path.join(UPLOADS_DIR, "audio")
os.makedirs(CUSTOM_UPLOADS_DIR, exist_ok=True)
os.makedirs(AUDIO_UPLOADS_DIR, exist_ok=True)

PRESETS_DIR = os.path.join(USER_DATA_DIR, "frontend", "presets")
THUMBNAILS_DIR = os.path.join(PRESETS_DIR, ".thumbnails")
os.makedirs(THUMBNAILS_DIR, exist_ok=True)

def _copy_tree_if_missing(src_dir: str, dst_dir: str):
    if not os.path.exists(src_dir):
        return
    for root, dirs, files in os.walk(src_dir):
        rel = os.path.relpath(root, src_dir)
        dest_sub = os.path.join(dst_dir, rel) if rel != "." else dst_dir
        os.makedirs(dest_sub, exist_ok=True)
        for f in files:
            src_file = os.path.join(root, f)
            dst_file = os.path.join(dest_sub, f)
            if not os.path.exists(dst_file):
                try:
                    shutil.copy2(src_file, dst_file)
                except Exception as e:
                    pass

def migrate_legacy_data():
    v2_dir = os.path.abspath(os.path.join(BASE_DIR, "..", "slidecontrolv2"))
    appdata_dir = os.path.expanduser("~/Library/Application Support/SlideControl") if sys.platform == "darwin" else os.path.join(os.environ.get("APPDATA", ""), "SlideControl")
    legacy_candidates = [BASE_DIR, v2_dir, appdata_dir]

    if not os.path.exists(DB_PATH):
        for candidate in legacy_candidates:
            cand_db = os.path.join(candidate, "slidecontrol_local.db")
            if os.path.exists(cand_db):
                try:
                    print(f"[Migration] Importando banco de dados de {cand_db}...")
                    shutil.copy2(cand_db, DB_PATH)
                    for suffix in ("-wal", "-shm"):
                        if os.path.exists(cand_db + suffix):
                            shutil.copy2(cand_db + suffix, DB_PATH + suffix)
                    break
                except Exception as e:
                    pass

    if not os.path.exists(PREFS_FILE):
        for candidate in legacy_candidates:
            cand_prefs = os.path.join(candidate, ".data", "preferences.json")
            if os.path.exists(cand_prefs):
                try:
                    shutil.copy2(cand_prefs, PREFS_FILE)
                    print(f"[Migration] Importado preferences.json de {cand_prefs}.")
                    break
                except Exception as e:
                    pass

    if not os.path.exists(AUTH_FILE):
        for candidate in legacy_candidates:
            cand_auth = os.path.join(candidate, "auth.json")
            if os.path.exists(cand_auth):
                try:
                    shutil.copy2(cand_auth, AUTH_FILE)
                    print(f"[Migration] Importado auth.json de {cand_auth}.")
                    break
                except Exception as e:
                    pass

    for candidate in [appdata_dir, v2_dir, BASE_DIR]:
        cand_presets = os.path.join(candidate, "frontend", "presets")
        if not os.path.exists(cand_presets):
            cand_presets = os.path.join(candidate, "presets")
        if os.path.exists(cand_presets) and os.path.abspath(cand_presets) != os.path.abspath(PRESETS_DIR):
            _copy_tree_if_missing(cand_presets, PRESETS_DIR)
            break

    for candidate in [appdata_dir, v2_dir, BASE_DIR]:
        cand_uploads = os.path.join(candidate, "frontend", "uploads")
        if not os.path.exists(cand_uploads):
            cand_uploads = os.path.join(candidate, "uploads")
        if os.path.exists(cand_uploads) and os.path.abspath(cand_uploads) != os.path.abspath(UPLOADS_DIR):
            _copy_tree_if_missing(cand_uploads, UPLOADS_DIR)
            break

try:
    migrate_legacy_data()
except Exception as e:
    print(f"[Migration Warning]: {e}")

import os
import json
from api.paths import DATA_DIR, PREFS_FILE

def load_prefs():
    if not os.path.exists(PREFS_FILE):
        return {}
    try:
        with open(PREFS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_prefs(prefs):
    try:
        with open(PREFS_FILE, "w", encoding="utf-8") as f:
            json.dump(prefs, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Error saving prefs: {e}")

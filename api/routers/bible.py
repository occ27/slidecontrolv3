from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from api.database import get_db
from api.models import BibleVersion, BibleBook, BibleChapter, BibleVerse, BibleHistory
import httpx
import os
import json
import tempfile
from api.bible_importer import import_bible_version, _import_dict_format_bible
import re
import asyncio
import unicodedata
import logging
import difflib

logger = logging.getLogger(__name__)

CLOUD_SERVER_URL = os.getenv("CLOUD_SERVER_URL", "https://slidecontrol.com.br")

router = APIRouter(prefix="/api/bible", tags=["Bible"])

class HistoryCreate(BaseModel):
    reference: str
    version: str
    text: str
    book: str
    chapter: int
    verse: int

@router.get("/versions")
def get_bible_versions(db: Session = Depends(get_db)):
    versions = db.query(BibleVersion).all()
    results = [{"id": v.id, "abbreviation": v.abbreviation, "name": v.name, "language": v.language} for v in versions]
    results.sort(key=lambda x: x["name"])
    return results

@router.get("/books")
def get_bible_books(version: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(BibleBook)
    if version:
        v = db.query(BibleVersion).filter(BibleVersion.abbreviation == version.lower()).first()
        if v:
            query = query.filter(BibleBook.version_id == v.id)
    books = query.order_by(BibleBook.book_order).all()
    return [{"abbrev": b.abbrev, "name": b.name, "author": b.author, "group": b.group, "chapters": b.chapters_count, "book_order": b.book_order} for b in books]

@router.get("/verses/{version}/{book}/{chapter}")
def get_chapter(version: str, book: str, chapter: int, order: Optional[int] = None, db: Session = Depends(get_db)):
    v = db.query(BibleVersion).filter(BibleVersion.abbreviation == version.lower()).first()
    if not v: raise HTTPException(404, "Version not found")
    
    b = db.query(BibleBook).filter(BibleBook.version_id == v.id, BibleBook.abbrev == book.lower()).first()
    if not b and order is not None:
        b = db.query(BibleBook).filter(BibleBook.version_id == v.id, BibleBook.book_order == order).first()
    if not b: raise HTTPException(404, "Book not found")
    
    c = db.query(BibleChapter).filter(BibleChapter.book_id == b.id, BibleChapter.chapter_number == chapter).first()
    if not c: raise HTTPException(404, "Chapter not found")
    
    verses = db.query(BibleVerse).filter(BibleVerse.chapter_id == c.id).order_by(BibleVerse.verse_number).all()
    
    return {
        "book": b.name,
        "chapter": chapter,
        "verses": [{"verse": verse.verse_number, "text": verse.text} for verse in verses]
    }

from sqlalchemy import func
import sqlalchemy as sa
from api.database import sqlite_normalize_string

PORTUGUESE_STOPWORDS = {
    "a", "o", "as", "os", "um", "uma", "uns", "umas",
    "e", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
    "por", "para", "pra", "pro", "que", "se", "com", "ao", "à", "aos", "às", "ou",
    "d", "l", "mas"
}

@router.get("/search")
def search_bible_text(query: str, version: Optional[str] = None, book: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    if not query or len(query.strip()) < 2:
        raise HTTPException(400, "Search query too short")

    primary_version = version.lower() if version else None
    # Normaliza a query e escapa caracteres especiais do FTS5
    norm_query = sqlite_normalize_string(query)
    # Escapa aspas duplas para uso no FTS5 como frase exata
    fts_phrase = '"' + norm_query.replace('"', '""') + '"'

    def get_verse_ids_from_fts(fts_phrase: str) -> list[int]:
        """Busca versículos via FTS5 — retorna lista de verse IDs (rowid = bible_verses.id)."""
        try:
            result = db.execute(
                sa.text("SELECT rowid FROM bible_verses_fts WHERE text_norm MATCH :q LIMIT :lim"),
                {"q": fts_phrase, "lim": limit * 5}
            )
            return [r[0] for r in result.fetchall()]
        except Exception:
            # FTS5 não disponível: fallback para LIKE com normalize() (mais lento)
            return []

    def build_base_query(verse_ids=None):
        bq = db.query(BibleVerse, BibleChapter, BibleBook, BibleVersion)\
            .join(BibleChapter, BibleVerse.chapter_id == BibleChapter.id)\
            .join(BibleBook, BibleChapter.book_id == BibleBook.id)\
            .join(BibleVersion, BibleBook.version_id == BibleVersion.id)
        if book:
            bq = bq.filter(BibleBook.abbrev == book.lower())
        if verse_ids is not None:
            bq = bq.filter(BibleVerse.id.in_(verse_ids))
        return bq

    raw_results = []
    fts_available = True  # rastreia se o FTS5 está disponível ou falhou com exceção

    # 1. FTS5: busca ultra-rápida na versão selecionada
    try:
        verse_ids = get_verse_ids_from_fts(fts_phrase)
    except Exception:
        verse_ids = []
        fts_available = False

    if verse_ids and primary_version:
        raw_results = build_base_query(verse_ids)\
            .filter(BibleVersion.abbreviation == primary_version)\
            .limit(limit).all()

    # 2. Se não encontrou na versão selecionada, busca nas outras versões
    if not raw_results and verse_ids:
        q_other = build_base_query(verse_ids)
        if primary_version:
            q_other = q_other.filter(BibleVersion.abbreviation != primary_version)
        raw_results = q_other.limit(limit * 5).all()
        if raw_results and primary_version:
            raw_results.sort(key=lambda row: (row[3].abbreviation, row[2].book_order, row[1].chapter_number, row[0].verse_number))
            raw_results = raw_results[:limit]

    # 3. Fallback lento (func.normalize): APENAS se o FTS5 falhou com exceção (tabela não existe no banco)
    #    Se FTS5 retornou [] significa que a frase não existe — não chamamos normalize() desnecessariamente.
    if not raw_results and not fts_available and norm_query:
        try:
            if primary_version:
                raw_results = build_base_query()\
                    .filter(BibleVersion.abbreviation == primary_version)\
                    .filter(func.normalize(BibleVerse.text).like(f"%{norm_query}%"))\
                    .limit(limit).all()
            if not raw_results:
                q_other = build_base_query()
                if primary_version:
                    q_other = q_other.filter(BibleVersion.abbreviation != primary_version)
                raw_results = q_other.filter(func.normalize(BibleVerse.text).like(f"%{norm_query}%"))\
                    .limit(limit * 5).all()
                if raw_results and primary_version:
                    raw_results.sort(key=lambda row: (row[3].abbreviation, row[2].book_order, row[1].chapter_number, row[0].verse_number))
                    raw_results = raw_results[:limit]
        except Exception as e:
            logger.error(f"[BibleSearch] Fallback LIKE também falhou: {e}")

    search_results = []
    for verse, chap, bk, ver in raw_results:
        search_results.append({
            "version": ver.abbreviation,
            "version_name": ver.name,
            "is_primary": ver.abbreviation.lower() == (primary_version or ""),
            "book": {"name": bk.name, "abbrev": bk.abbrev},
            "chapter": {"number": chap.chapter_number},
            "verse": {"number": verse.verse_number, "text": verse.text, "reference": f"{bk.name} {chap.chapter_number}:{verse.verse_number}"}
        })

    return {"query": query, "total_results": len(search_results), "results": search_results}


def _load_groq_keys_for_bible() -> list[str]:
    """Reuse the Groq keys already configured for transcription."""
    try:
        from api.transcription_service import transcription_service
        config_path = transcription_service._get_config_path()
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                data = json.load(f)
                raw = data.get("groq_api_key", [])
                if isinstance(raw, list):
                    return [k.strip() for k in raw if k.strip()]
                elif isinstance(raw, str) and raw.strip():
                    return [raw.strip()]
    except Exception:
        pass
    return []


def _get_ai_cache_path() -> str:
    """Returns the path to the AI search cache file."""
    try:
        from api.paths import BIBLE_AI_CACHE_FILE
        return BIBLE_AI_CACHE_FILE
    except Exception:
        return os.path.join(os.path.dirname(__file__), "..", "bible_ai_cache.json")


def _load_ai_cache() -> dict:
    path = _get_ai_cache_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_ai_cache(cache: dict) -> None:
    path = _get_ai_cache_path()
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[BibleAI] Error saving cache: {e}")


def _cache_key(query: str) -> str:
    """Normalise a query string to use as cache key."""
    return sqlite_normalize_string(query)


def _find_in_ai_cache(query: str, cache: dict) -> tuple[Optional[str], Optional[list[str]], str]:
    """
    Busca no histórico/cache de IA para verificar se a mesma pesquisa já foi feita:
    1. Correspondência exata normalizada (sem acento, pontuação ou maiúsculas).
    2. Correspondência de conjunto de palavras-chave (ignora preposições/artigos e ordem).
    3. Correspondência de alta similaridade (>= 82% para capturar variações e erros de digitação).
    """
    if not cache:
        return None, None, "miss"

    q_norm = sqlite_normalize_string(query)
    q_tokens = [w for w in q_norm.split() if w not in PORTUGUESE_STOPWORDS and len(w) >= 2]
    if not q_tokens:
        q_tokens = [w for w in q_norm.split() if len(w) >= 2]
    q_token_set = set(q_tokens)
    q_token_str = " ".join(sorted(q_token_set))

    def get_refs(entry):
        if isinstance(entry, dict):
            return entry.get("refs", [])
        elif isinstance(entry, list):
            return entry
        return []

    # 1. Correspondência exata normalizada
    for key, data in cache.items():
        k_norm = sqlite_normalize_string(key)
        if q_norm == k_norm:
            return key, get_refs(data), "exact"

    # 2. Correspondência por palavras-chave idênticas
    if q_token_set:
        for key, data in cache.items():
            k_norm = sqlite_normalize_string(key)
            k_tokens = [w for w in k_norm.split() if w not in PORTUGUESE_STOPWORDS and len(w) >= 2]
            if not k_tokens:
                k_tokens = [w for w in k_norm.split() if len(w) >= 2]
            if q_token_set == set(k_tokens):
                return key, get_refs(data), "token_match"

    # 3. Similaridade difusa (para erros de digitação ou pequenas variações)
    best_key = None
    best_sim = 0.0
    for key, data in cache.items():
        k_norm = sqlite_normalize_string(key)
        k_tokens = [w for w in k_norm.split() if w not in PORTUGUESE_STOPWORDS and len(w) >= 2]
        if not k_tokens:
            k_tokens = [w for w in k_norm.split() if len(w) >= 2]
        k_token_str = " ".join(sorted(set(k_tokens)))

        sim_raw = difflib.SequenceMatcher(None, q_norm, k_norm).ratio()
        sim_tok = difflib.SequenceMatcher(None, q_token_str, k_token_str).ratio() if q_token_str and k_token_str else 0
        score = max(sim_raw, sim_tok)
        if score > best_sim:
            best_sim = score
            best_key = key

    if best_sim >= 0.82 and best_key:
        return best_key, get_refs(cache[best_key]), f"fuzzy_{best_sim:.2f}"

    return None, None, "miss"


async def _ask_groq_for_bible_refs(query: str, api_keys: list[str]) -> list[str]:
    """Use Groq (groq/compound-mini) to find Bible references for a thematic query.
    Rotates through keys automatically on rate-limit (429) or overload (503) errors.
    """
    system_prompt = (
        "Você é um assistente especialista em Bíblia Sagrada. "
        "Dado o tema ou contexto informado, liste até 3 referências bíblicas mais precisas e relevantes, "
        "uma por linha, no formato exato: Livro Capítulo:Versículo. "
        "Use nomes de livros em português. Priorize precisão. Não explique. Apenas as referências."
    )
    payload = {
        "model": "groq/compound-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ],
        "max_tokens": 80,
        "temperature": 0.2,
    }

    last_exc = None
    for key_idx, api_key in enumerate(api_keys):
        key_label = f"{api_key[:8]}..."
        print(f"[BibleAI] Trying Groq key {key_idx+1}/{len(api_keys)} ({key_label})")
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json=payload
                )
                if not r.is_success:
                    print(f"[BibleAI] Groq key {key_label} HTTP {r.status_code}: {r.text[:200]}")
                    if r.status_code in [429, 503]:
                        last_exc = httpx.HTTPStatusError(str(r.status_code), request=r.request, response=r)
                        continue  # try next key
                    r.raise_for_status()
                data = r.json()
                content = data["choices"][0]["message"]["content"].strip()
        except (httpx.RequestError, httpx.ReadTimeout) as e:
            print(f"[BibleAI] Network error on Groq key {key_label}: {e}")
            last_exc = e
            continue
        except httpx.HTTPStatusError as e:
            last_exc = e
            continue
        except (KeyError, IndexError) as e:
            print(f"[BibleAI] Failed to parse Groq response: {e}")
            last_exc = e
            continue

        # Success!
        print(f"[BibleAI] Groq success with key {key_idx+1}. Raw:\n{content}")
        refs = []
        ref_line_re = re.compile(r'([\w\s]+?\d+:\d+)')
        for line in content.splitlines():
            line = line.strip()
            m = ref_line_re.search(line)
            if m:
                candidate = m.group(1).strip()
                if re.search(r'\d+:\d+', candidate):
                    refs.append(candidate)
        print(f"[BibleAI] Parsed refs: {refs}")
        return refs

    raise last_exc or Exception("All Groq keys failed")

def _resolve_refs_in_db(refs: list[str], primary_version: str | None, db: Session) -> list[dict]:
    """
    Given a list of reference strings like 'João 3:16', look them up in the
    local database across all installed versions and return result dicts.
    """
    results = []
    seen = set()  # avoid duplicates: (book_order, chapter, verse, version)

    # Build a lookup: normalised book name/abbrev → BibleBook (per version)
    def normalise(s: str) -> str:
        # Strip accents (NFD decompose → remove combining chars) then lowercase, remove spaces/hyphens
        nfd = unicodedata.normalize("NFD", s)
        stripped = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
        return stripped.strip().lower().replace(" ", "").replace("-", "")

    books_all = db.query(BibleBook, BibleVersion)\
        .join(BibleVersion, BibleBook.version_id == BibleVersion.id)\
        .all()

    # Map normalised name → list of (BibleBook, BibleVersion)
    name_map: dict[str, list] = {}
    for bk, ver in books_all:
        for key in [normalise(bk.name), normalise(bk.abbrev)]:
            name_map.setdefault(key, []).append((bk, ver))

    ref_re = re.compile(r'^(.+?)\s+(\d+):(\d+)$')

    for ref in refs:
        m = ref_re.match(ref.strip())
        if not m:
            continue
        book_str, chap_str, verse_str = m.group(1), m.group(2), m.group(3)
        chap_num, verse_num = int(chap_str), int(verse_str)
        norm_book = normalise(book_str)

        candidates = name_map.get(norm_book, [])
        # Also try startswith
        if not candidates:
            candidates = [(bk, ver) for key, lst in name_map.items() if key.startswith(norm_book) for bk, ver in lst]

        if not candidates:
            print(f"[BibleAI] Book NOT found: '{book_str}' (norm: '{norm_book}'). DB keys sample: {list(name_map.keys())[:20]}")
        else:
            print(f"[BibleAI] Resolved '{book_str}' -> {[(bk.name, ver.abbreviation) for bk, ver in candidates[:3]]}")

        # Sort: primary version first
        candidates.sort(key=lambda x: (0 if x[1].abbreviation.lower() == (primary_version or "") else 1, x[1].abbreviation))

        for bk, ver in candidates:
            # Dedup key SEM a versão. Assim que achar o versículo na versão prioritária, 
            # as outras versões serão ignoradas.
            dedup_key = (bk.book_order, chap_num, verse_num)
            if dedup_key in seen:
                continue

            c = db.query(BibleChapter).filter(
                BibleChapter.book_id == bk.id,
                BibleChapter.chapter_number == chap_num
            ).first()
            if not c:
                continue

            v = db.query(BibleVerse).filter(
                BibleVerse.chapter_id == c.id,
                BibleVerse.verse_number == verse_num
            ).first()
            if not v:
                continue

            seen.add(dedup_key)
            results.append({
                "version": ver.abbreviation,
                "version_name": ver.name,
                "is_primary": ver.abbreviation.lower() == (primary_version or ""),
                "ai_suggested": True,
                "book": {"name": bk.name, "abbrev": bk.abbrev},
                "chapter": {"number": chap_num},
                "verse": {
                    "number": verse_num,
                    "text": v.text,
                    "reference": f"{bk.name} {chap_num}:{verse_num}"
                }
            })

    return results


@router.get("/search/ai")
async def search_bible_ai(query: str, version: Optional[str] = None, only_cache: bool = False, db: Session = Depends(get_db)):
    """
    Uses Groq (groq/compound-mini) to interpret a thematic/contextual query
    and find relevant Bible verses from the local database.
    Results are cached in bible_ai_cache.json — subsequent calls with the
    same query skip the AI and go straight to the DB lookup.
    If only_cache is True, never calls Groq; only returns if already cached.
    """
    print(f"[BibleAI] Endpoint called, query='{query}', version='{version}', only_cache={only_cache}")

    if not query or len(query.strip()) < 3:
        return {"query": query, "results": [], "ai_available": False, "reason": "query_too_short"}

    primary_version = version.lower() if version else None
    cache = _load_ai_cache()

    # 1. Busca primeiro no histórico de buscas da IA para ver se a mesma pesquisa já foi feita
    matched_key, cached_refs, match_type = _find_in_ai_cache(query, cache)

    if cached_refs:
        refs = cached_refs
        from_cache = True
        print(f"[BibleAI] Histórico/Cache HIT ({match_type}) para '{query}' (encontrado em '{matched_key}') -> {refs}")
    elif only_cache:
        # Modo estrito de verificação de cache: não consulta a API externa do Groq
        print(f"[BibleAI] Histórico/Cache MISS para '{query}' (only_cache=True). Não chamando IA externa.")
        return {"query": query, "results": [], "ai_available": False, "from_cache": False, "reason": "not_in_cache"}
    else:
        from_cache = False
        groq_keys = _load_groq_keys_for_bible()
        print(f"[BibleAI] Histórico/Cache MISS para '{query}'. Consultando IA (Groq)...")
        if not groq_keys:
            return {"query": query, "results": [], "ai_available": False, "reason": "no_groq_key"}
        try:
            refs = await _ask_groq_for_bible_refs(query, groq_keys)
        except Exception as e:
            print(f"[BibleAI] Exception calling Groq: {repr(e)}")
            return {"query": query, "results": [], "ai_available": False, "reason": repr(e)}
        if refs:
            clean_key = sqlite_normalize_string(query)
            cache[clean_key] = {
                "refs": refs,
                "timestamp": datetime.now().isoformat()
            }
            _save_ai_cache(cache)
            print(f"[BibleAI] Nova busca salva no histórico da IA: '{clean_key}'")

    if not refs:
        print("[BibleAI] No refs found.")
        return {"query": query, "results": [], "ai_available": True, "reason": "no_refs_returned"}

    results = _resolve_refs_in_db(refs, primary_version, db)
    print(f"[BibleAI] Resolved {len(results)} verse(s) from DB (from_cache={from_cache}).")
    return {
        "query": query,
        "results": results,
        "ai_available": True,
        "total_results": len(results),
        "refs": refs,
        "from_cache": from_cache,
        "matched_history_query": matched_key if from_cache else None
    }


@router.get("/search/ai/resolve")
def resolve_bible_refs(refs: str, version: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Resolves a comma-separated list of cached Bible refs against the DB
    for a specific version. Used by the frontend when the user switches
    Bible version while search results are displayed — avoids re-calling AI.
    Example: refs='Jo%C3%A3o+3%3A16%2CHebreus+11%3A1'
    """
    ref_list = [r.strip() for r in refs.split("|") if r.strip()]
    if not ref_list:
        return {"results": []}
    primary_version = version.lower() if version else None
    results = _resolve_refs_in_db(ref_list, primary_version, db)
    return {"results": results, "total_results": len(results)}



@router.get("/search/ai/history")
def get_ai_search_history():
    """
    Returns all previously cached AI searches as a list of {query, refs, timestamp} objects.
    Used by the frontend to display a 'Recent AI Searches' panel.
    """
    cache = _load_ai_cache()
    items = []
    for q, val in reversed(list(cache.items())):
        if isinstance(val, dict):
            items.append({
                "query": q,
                "refs": val.get("refs", []),
                "timestamp": val.get("timestamp")
            })
        elif isinstance(val, list):
            items.append({
                "query": q,
                "refs": val,
                "timestamp": None
            })
    return {"items": items, "total": len(items)}


@router.delete("/search/ai/history")
def clear_ai_search_history():
    """Clears the entire AI search cache file."""
    path = _get_ai_cache_path()
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        print(f"[BibleAI] Error clearing cache: {e}")
    return {"ok": True}


@router.delete("/search/ai/history/query")
def delete_ai_query(query: str):
    """Removes a single query entry from the AI search cache."""
    cache = _load_ai_cache()
    matched_key, _, _ = _find_in_ai_cache(query, cache)
    if matched_key and matched_key in cache:
        del cache[matched_key]
        _save_ai_cache(cache)
    elif query in cache:
        del cache[query]
        _save_ai_cache(cache)
    return {"ok": True}


@router.post("/history")
def add_history(history: HistoryCreate, db: Session = Depends(get_db)):
    h = BibleHistory(**history.dict())
    db.add(h)
    db.commit()
    db.refresh(h)
    return h

@router.get("/history")
def get_history(limit: int = 100, db: Session = Depends(get_db)):
    history = db.query(BibleHistory).order_by(BibleHistory.timestamp.desc()).limit(limit).all()
    return history

@router.delete("/history")
def clear_all_history(db: Session = Depends(get_db)):
    """Deletes all verse projection history records."""
    db.query(BibleHistory).delete()
    db.commit()
    return {"success": True}

@router.delete("/history/{history_id}")
def delete_history_item(history_id: int, db: Session = Depends(get_db)):
    h = db.query(BibleHistory).filter(BibleHistory.id == history_id).first()
    if h:
        db.delete(h)
        db.commit()
    return {"success": True}

@router.get("/cloud/versions")
async def get_cloud_bible_versions(db: Session = Depends(get_db)):
    """Busca as versões da Bíblia na nuvem e compara com as instaladas localmente."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{CLOUD_SERVER_URL}/api/bible/versions")
            if r.status_code == 200:
                cloud_versions = r.json()
                local_versions = db.query(BibleVersion).all()
                local_abbrevs = {v.abbreviation.lower(): v.id for v in local_versions}
                
                for v in cloud_versions:
                    v_abbrev = v["id"].lower()
                    if v_abbrev in local_abbrevs:
                        v["installed"] = True
                        v["local_id"] = local_abbrevs[v_abbrev]
                    else:
                        v["installed"] = False
                        
                return cloud_versions
    except Exception as e:
        print(f"Erro ao buscar versões da Bíblia na nuvem: {e}")
    return []

@router.delete("/version/{abbrev}")
def delete_local_bible(abbrev: str, db: Session = Depends(get_db)):
    """Remove uma versão da Bíblia do banco de dados local."""
    try:
        version = db.query(BibleVersion).filter(BibleVersion.abbreviation == abbrev.lower()).first()
        if not version:
            return {"status": "error", "message": "Versão não encontrada localmente."}
            
        db.delete(version)
        db.commit()
        return {"status": "success", "message": "Versão removida com sucesso."}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": f"Erro ao deletar versão: {str(e)}"}

class DownloadBibleRequest(BaseModel):
    version: str

@router.post("/download")
async def download_cloud_bible(req: DownloadBibleRequest, db: Session = Depends(get_db)):
    """Baixa um JSON da versão da Bíblia na nuvem e insere no banco local SQLite."""
    url = f"{CLOUD_SERVER_URL}/api/bible/export/{req.version.lower()}"
    tmp_path = None
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.get(url)
            if r.status_code != 200:
                return {"status": "error", "message": "Versão não encontrada no servidor."}
                
            with tempfile.NamedTemporaryFile(delete=False, suffix=".json", mode="wb") as tmp:
                tmp.write(r.content)
                tmp_path = tmp.name
                
            # Obter os metadados da versão para a importação
            r_info = await client.get(f"{CLOUD_SERVER_URL}/api/bible/versions", timeout=10.0)
            version_info = None
            if r_info.status_code == 200:
                for v in r_info.json():
                    if v["id"].lower() == req.version.lower():
                        version_info = {"abbrev": v["id"], "name": v["name"], "language": v.get("language", "pt")}
                        break
                        
            if not version_info:
                version_info = {"abbrev": req.version.lower(), "name": req.version.upper(), "language": "pt"}

        # Ler JSON e detectar o formato
        with open(tmp_path, "r", encoding="utf-8-sig") as f:
            bible_data = json.load(f)

        # Formato padrão: lista de dicts com chaves "abbrev", "name", "chapters"
        if isinstance(bible_data, list):
            import_bible_version(db, tmp_path, version_info)

        # Formato alternativo (KJV-PT): dict com nome do livro -> dict de capítulos -> dict de versículos
        elif isinstance(bible_data, dict):
            _import_dict_format_bible(db, bible_data, version_info)

        else:
            return {"status": "error", "message": "Formato do arquivo JSON não reconhecido."}

        # Atualiza o índice FTS5 com os novos versículos (sem recriar tudo — só insere os que faltam)
        try:
            total_verses = db.execute(sa.text("SELECT COUNT(*) FROM bible_verses")).scalar()
            fts_count = db.execute(sa.text("SELECT COUNT(*) FROM bible_verses_fts")).scalar()
            if fts_count < total_verses:
                # Insere apenas os versículos que ainda não estão no índice
                db.execute(sa.text("""
                    INSERT INTO bible_verses_fts(rowid, text_norm)
                    SELECT id, text FROM bible_verses
                    WHERE id > :max_fts_id
                    ORDER BY id
                """), {"max_fts_id": fts_count})
                db.commit()
                new_count = db.execute(sa.text("SELECT COUNT(*) FROM bible_verses_fts")).scalar()
                print(f"[FTS5] Índice atualizado: {new_count} versículos indexados.")
        except Exception as fts_err:
            print(f"[FTS5] Aviso: erro ao atualizar índice FTS5 após importação: {fts_err}")

        return {"status": "success"}
    except Exception as e:
        print(f"Erro ao baixar/importar Bíblia: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

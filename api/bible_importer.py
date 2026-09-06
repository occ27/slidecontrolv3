import json
import os
import unicodedata
from sqlalchemy.orm import Session
from api.models import BibleVersion, BibleBook, BibleChapter, BibleVerse

# Ordem canônica dos livros da Bíblia
BOOK_ORDER = {
    # Antigo Testamento
    "gn": 1, "ex": 2, "êx": 2, "lv": 3, "nm": 4, "dt": 5,
    "js": 6, "jz": 7, "rt": 8, "1sm": 9, "2sm": 10,
    "1rs": 11, "2rs": 12, "1cr": 13, "2cr": 14,
    "ed": 15, "ne": 16, "et": 17, "job": 18, "jó": 18, "sl": 19,
    "pv": 20, "ec": 21, "ct": 22, "is": 23, "jr": 24,
    "lm": 25, "ez": 26, "dn": 27, "os": 28, "jl": 29,
    "am": 30, "ob": 31, "jn": 32, "mq": 33, "na": 34,
    "hc": 35, "sf": 36, "ag": 37, "zc": 38, "ml": 39,
    # Apócrifos
    "tb": 40, "jdt": 41, "1mc": 42, "2mc": 43, "sb": 44, "si": 45, "br": 46,
    # Novo Testamento
    "mt": 47, "mc": 48, "lc": 49, "jo": 50, "at": 51, "atos": 51,
    "rm": 52, "1co": 53, "2co": 54, "gl": 55, "ef": 56,
    "fp": 57, "cl": 58, "1ts": 59, "2ts": 60, "1tm": 61, "1tn": 61,
    "2tm": 62, "tt": 63, "fm": 64, "hb": 65, "tg": 66,
    "1pe": 67, "2pe": 68, "1jo": 69, "2jo": 70, "3jo": 71,
    "jd": 72, "ap": 73
}

# Metadados dos livros
BOOK_METADATA = {
    "gn": {"author": "Moisés", "group": "Pentateuco"},
    "ex": {"author": "Moisés", "group": "Pentateuco"},
    "êx": {"author": "Moisés", "group": "Pentateuco"},
    "lv": {"author": "Moisés", "group": "Pentateuco"},
    "nm": {"author": "Moisés", "group": "Pentateuco"},
    "dt": {"author": "Moisés", "group": "Pentateuco"},
    "js": {"author": "Josué", "group": "Históricos"},
    "jz": {"author": "Samuel", "group": "Históricos"},
    "rt": {"author": "Samuel", "group": "Históricos"},
    "1sm": {"author": "Samuel", "group": "Históricos"},
    "2sm": {"author": "Desconhecido", "group": "Históricos"},
    "1rs": {"author": "Jeremias", "group": "Históricos"},
    "2rs": {"author": "Jeremias", "group": "Históricos"},
    "1cr": {"author": "Esdras", "group": "Históricos"},
    "2cr": {"author": "Esdras", "group": "Históricos"},
    "ed": {"author": "Esdras", "group": "Históricos"},
    "ne": {"author": "Neemias", "group": "Históricos"},
    "et": {"author": "Desconhecido", "group": "Históricos"},
    "job": {"author": "Desconhecido", "group": "Poéticos"},
    "jó": {"author": "Desconhecido", "group": "Poéticos"},
    "sl": {"author": "David, Moisés, Salomão", "group": "Poéticos"},
    "pv": {"author": "Salomão", "group": "Poéticos"},
    "ec": {"author": "Salomão", "group": "Poéticos"},
    "ct": {"author": "Salomão", "group": "Poéticos"},
    "is": {"author": "Isaías", "group": "Profetas Maiores"},
    "jr": {"author": "Jeremias", "group": "Profetas Maiores"},
    "lm": {"author": "Jeremias", "group": "Profetas Maiores"},
    "ez": {"author": "Ezequiel", "group": "Profetas Maiores"},
    "dn": {"author": "Daniel", "group": "Profetas Maiores"},
    "os": {"author": "Oséias", "group": "Profetas Menores"},
    "jl": {"author": "Joel", "group": "Profetas Menores"},
    "am": {"author": "Amós", "group": "Profetas Menores"},
    "ob": {"author": "Obadias", "group": "Profetas Menores"},
    "jn": {"author": "Jonas", "group": "Profetas Menores"},
    "mq": {"author": "Miquéias", "group": "Profetas Menores"},
    "na": {"author": "Naum", "group": "Profetas Menores"},
    "hc": {"author": "Habacuque", "group": "Profetas Menores"},
    "sf": {"author": "Sofonias", "group": "Profetas Menores"},
    "ag": {"author": "Ageu", "group": "Profetas Menores"},
    "zc": {"author": "Zacarias", "group": "Profetas Menores"},
    "ml": {"author": "Malaquias", "group": "Profetas Menores"},
    "tb": {"author": "Desconhecido", "group": "Apócrifos"},
    "jdt": {"author": "Desconhecido", "group": "Apócrifos"},
    "1mc": {"author": "Desconhecido", "group": "Apócrifos"},
    "2mc": {"author": "Desconhecido", "group": "Apócrifos"},
    "sb": {"author": "Desconhecido", "group": "Apócrifos"},
    "si": {"author": "Desconhecido", "group": "Apócrifos"},
    "br": {"author": "Desconhecido", "group": "Apócrifos"},
    "mt": {"author": "Mateus", "group": "Evangelhos"},
    "mc": {"author": "Marcos", "group": "Evangelhos"},
    "lc": {"author": "Lucas", "group": "Evangelhos"},
    "jo": {"author": "João", "group": "Evangelhos"},
    "at": {"author": "Lucas", "group": "Histórico"},
    "rm": {"author": "Paulo", "group": "Epístolas"},
    "1co": {"author": "Paulo", "group": "Epístolas"},
    "2co": {"author": "Paulo", "group": "Epístolas"},
    "gl": {"author": "Paulo", "group": "Epístolas"},
    "ef": {"author": "Paulo", "group": "Epístolas"},
    "fp": {"author": "Paulo", "group": "Epístolas"},
    "cl": {"author": "Paulo", "group": "Epístolas"},
    "1ts": {"author": "Paulo", "group": "Epístolas"},
    "2ts": {"author": "Paulo", "group": "Epístolas"},
    "1tm": {"author": "Paulo", "group": "Epístolas"},
    "2tm": {"author": "Paulo", "group": "Epístolas"},
    "tt": {"author": "Paulo", "group": "Epístolas"},
    "fm": {"author": "Paulo", "group": "Epístolas"},
    "hb": {"author": "Desconhecido", "group": "Epístolas"},
    "tg": {"author": "Tiago", "group": "Epístolas"},
    "1pe": {"author": "Pedro", "group": "Epístolas"},
    "2pe": {"author": "Pedro", "group": "Epístolas"},
    "1jo": {"author": "João", "group": "Epístolas"},
    "2jo": {"author": "João", "group": "Epístolas"},
    "3jo": {"author": "João", "group": "Epístolas"},
    "jd": {"author": "Judas", "group": "Epístolas"},
    "ap": {"author": "João", "group": "Profecia"}
}

def import_bible_version(db: Session, json_file: str, version_info: dict):
    print(f"Importando versão {version_info['name']} ({version_info['abbrev']})...")

    existing_version = db.query(BibleVersion).filter(
        BibleVersion.abbreviation == version_info['abbrev']
    ).first()

    if existing_version:
        print(f"Versão {version_info['abbrev']} já existe. Pulando...")
        return existing_version

    version = BibleVersion(
        abbreviation=version_info['abbrev'],
        name=version_info['name'],
        language=version_info['language']
    )
    db.add(version)
    db.flush()

    try:
        with open(json_file, 'r', encoding='utf-8-sig') as f:
            bible_data = json.load(f)
    except Exception as e:
        print(f"Erro ao ler arquivo {json_file}: {e}")
        return None

    for book_data in bible_data:
        import_bible_book(db, version.id, book_data)

    db.commit()
    print(f"Versão {version_info['name']} importada com sucesso!")
    return version

def import_bible_book(db: Session, version_id: int, book_data: dict):
    abbrev = book_data['abbrev']
    name = book_data['name']
    chapters = book_data['chapters']

    abbrev_lower = abbrev.lower()
    metadata = BOOK_METADATA.get(abbrev_lower, {"author": "Desconhecido", "group": "Desconhecido"})
    book_order = BOOK_ORDER.get(abbrev_lower, 999)

    book = BibleBook(
        version_id=version_id,
        abbrev=abbrev_lower,
        name=name,
        author=metadata["author"],
        group=metadata["group"],
        book_order=book_order,
        chapters_count=len(chapters)
    )
    db.add(book)
    db.flush()

    for chapter_num, verses in enumerate(chapters, 1):
        import_bible_chapter(db, book.id, chapter_num, verses)

def import_bible_chapter(db: Session, book_id: int, chapter_num: int, verses: list):
    chapter = BibleChapter(
        book_id=book_id,
        chapter_number=chapter_num,
        verses_count=len(verses)
    )
    db.add(chapter)
    db.flush()

    for verse_num, text in enumerate(verses, 1):
        verse = BibleVerse(
            chapter_id=chapter.id,
            verse_number=verse_num,
            text=text.strip()
        )
        db.add(verse)

def _import_dict_format_bible(db: Session, bible_data: dict, version_info: dict):
    print(f"Importando versão (formato dict) {version_info['name']} ({version_info['abbrev']})...")

    existing_version = db.query(BibleVersion).filter(
        BibleVersion.abbreviation == version_info['abbrev']
    ).first()

    if existing_version:
        return existing_version

    version = BibleVersion(
        abbreviation=version_info['abbrev'],
        name=version_info['name'],
        language=version_info['language']
    )
    db.add(version)
    db.flush()

    def normalize(text):
        if not text:
            return ""
        n = unicodedata.normalize("NFD", text)
        return "".join(c for c in n if unicodedata.category(c) != "Mn").lower().strip()

    BOOK_ORDER_BY_NAME = {
        "genesis": 1, "exodo": 2, "levitico": 3, "numeros": 4, "deuteronomio": 5,
        "josue": 6, "juizes": 7, "rute": 8, "1 samuel": 9, "2 samuel": 10,
        "1 reis": 11, "2 reis": 12, "1 cronicas": 13, "2 cronicas": 14,
        "esdras": 15, "neemias": 16, "ester": 17, "jo": 18, "salmos": 19,
        "proverbios": 20, "eclesiastes": 21, "canticos": 22, "isaias": 23, "jeremias": 24,
        "lamentacoes": 25, "ezequiel": 26, "daniel": 27, "oseias": 28, "joel": 29,
        "amos": 30, "obadias": 31, "jonas": 32, "miqueias": 33, "naum": 34,
        "habacuque": 35, "sofonias": 36, "ageu": 37, "zacarias": 38, "malaquias": 39,
        "tobias": 40, "judite": 41, "1 macabeus": 42, "2 macabeus": 43, "sabedoria": 44,
        "eclesiastico": 45, "baruc": 46,
        "mateus": 47, "marcos": 48, "lucas": 49, "joao": 50, "atos": 51,
        "romanos": 52, "1 corintios": 53, "2 corintios": 54, "galatas": 55, "efesios": 56,
        "filipenses": 57, "colossenses": 58, "1 tessalonicenses": 59, "2 tessalonicenses": 60,
        "1 timoteo": 61, "2 timoteo": 62, "tito": 63, "filemom": 64, "hebreus": 65,
        "tiago": 66, "1 pedro": 67, "2 pedro": 68, "1 joao": 69, "2 joao": 70,
        "3 joao": 71, "judas": 72, "apocalipse": 73,
        "cantares": 22, "cantares de salomao": 22, "cantares de salomão": 22,
        "lamentacoes de jeremias": 25, "lamentações de jeremias": 25,
        "exodus": 2, "filemon": 64,
    }

    BOOK_ABBREV_BY_ORDER = {
        1: "gn", 2: "ex", 3: "lv", 4: "nm", 5: "dt",
        6: "js", 7: "jz", 8: "rt", 9: "1sm", 10: "2sm",
        11: "1rs", 12: "2rs", 13: "1cr", 14: "2cr",
        15: "ed", 16: "ne", 17: "et", 18: "job", 19: "sl",
        20: "pv", 21: "ec", 22: "ct", 23: "is", 24: "jr",
        25: "lm", 26: "ez", 27: "dn", 28: "os", 29: "jl",
        30: "am", 31: "ob", 32: "jn", 33: "mq", 34: "na",
        35: "hc", 36: "sf", 37: "ag", 38: "zc", 39: "ml",
        40: "tb", 41: "jdt", 42: "1mc", 43: "2mc", 44: "sb",
        45: "si", 46: "br",
        47: "mt", 48: "mc", 49: "lc", 50: "jo", 51: "at",
        52: "rm", 53: "1co", 54: "2co", 55: "gl", 56: "ef",
        57: "fp", 58: "cl", 59: "1ts", 60: "2ts", 61: "1tm",
        62: "2tm", 63: "tt", 64: "fm", 65: "hb", 66: "tg",
        67: "1pe", 68: "2pe", 69: "1jo", 70: "2jo", 71: "3jo",
        72: "jd", 73: "ap"
    }

    for book_name, chapters_dict in bible_data.items():
        n_name = normalize(book_name)
        book_order = BOOK_ORDER_BY_NAME.get(n_name, 999)
        abbrev = BOOK_ABBREV_BY_ORDER.get(book_order, n_name[:4])

        metadata = BOOK_METADATA.get(abbrev, {"author": "Desconhecido", "group": "Desconhecido"})
        
        book = BibleBook(
            version_id=version.id,
            abbrev=abbrev,
            name=book_name,
            author=metadata["author"],
            group=metadata["group"],
            book_order=book_order,
            chapters_count=len(chapters_dict)
        )
        db.add(book)
        db.flush()

        for chapter_str, verses_dict in chapters_dict.items():
            ch_num = int(chapter_str)
            chapter = BibleChapter(
                book_id=book.id,
                chapter_number=ch_num,
                verses_count=len(verses_dict)
            )
            db.add(chapter)
            db.flush()

            for verse_str, verse_text in verses_dict.items():
                v_num = int(verse_str)
                verse = BibleVerse(
                    chapter_id=chapter.id,
                    verse_number=v_num,
                    text=verse_text.strip()
                )
                db.add(verse)

    db.commit()
    print(f"Versão {version_info['name']} importada com sucesso!")
    return version

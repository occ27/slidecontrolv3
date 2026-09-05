from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class BibleVersion(Base):
    __tablename__ = "bible_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    abbreviation = Column(String(10), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    language = Column(String(5), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    books = relationship("BibleBook", back_populates="version", cascade="all, delete-orphan")

class BibleBook(Base):
    __tablename__ = "bible_books"
    
    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("bible_versions.id"), index=True)
    abbrev = Column(String(10), nullable=False)
    name = Column(String(255), nullable=False)
    author = Column(String(255))
    group = Column(String(50))
    book_order = Column(Integer, nullable=False)
    chapters_count = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    version = relationship("BibleVersion", back_populates="books")
    chapters = relationship("BibleChapter", back_populates="book", cascade="all, delete-orphan")

class BibleChapter(Base):
    __tablename__ = "bible_chapters"
    
    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("bible_books.id"), index=True)
    chapter_number = Column(Integer, nullable=False)
    verses_count = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    book = relationship("BibleBook", back_populates="chapters")
    verses = relationship("BibleVerse", back_populates="chapter", cascade="all, delete-orphan")

class BibleVerse(Base):
    __tablename__ = "bible_verses"
    
    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("bible_chapters.id"), index=True)
    verse_number = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    chapter = relationship("BibleChapter", back_populates="verses")

class BibleHistory(Base):
    __tablename__ = "bible_history"
    
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), nullable=False)
    version = Column(String(10), nullable=False)
    text = Column(Text, nullable=False)
    book = Column(String(50), nullable=False)
    chapter = Column(Integer, nullable=False)
    verse = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

# ----------------- LOUVOR (SONGS) -----------------

class Song(Base):
    __tablename__ = "songs"
    
    id = Column(Integer, primary_key=True, index=True)
    cloud_id = Column(String(50), nullable=True, index=True)
    hymnal_num = Column(Integer, nullable=True)
    title = Column(String(255), nullable=False, index=True)
    artist = Column(String(255), nullable=True, index=True)
    source = Column(String(100), nullable=True)
    tags = Column(String(255), nullable=True)
    full_lyrics = Column(Text, nullable=True)
    full_chordpro = Column(Text, nullable=True)
    tone = Column(String(10), nullable=True)
    intro = Column(String(100), nullable=True)
    lines_limit = Column(Integer, nullable=True)
    display_settings = Column(Text, nullable=True)
    youtube_url = Column(String(500), nullable=True)
    audio_url = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    sections = relationship("SongSection", back_populates="song", cascade="all, delete-orphan", order_by="SongSection.section_order")
    search_history = relationship("SongSearchHistory", back_populates="song", cascade="all, delete-orphan")

class SongSection(Base):
    __tablename__ = "song_sections"
    
    id = Column(Integer, primary_key=True, index=True)
    song_id = Column(Integer, ForeignKey("songs.id"), index=True)
    section_order = Column(Integer, nullable=False, default=0)
    section_label = Column(String(50), nullable=True)
    lyrics = Column(Text, nullable=True)
    chordpro = Column(Text, nullable=True)
    background_media = Column(String(500), nullable=True)
    
    song = relationship("Song", back_populates="sections")
    chords = relationship("SongChord", back_populates="section", cascade="all, delete-orphan")

class SongChord(Base):
    __tablename__ = "song_chords"
    
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("song_sections.id"), index=True)
    annotations = Column(Text, nullable=True)  # JSON or simple string
    
    section = relationship("SongSection", back_populates="chords")

class SongSearchHistory(Base):
    __tablename__ = "song_search_history"
    
    song_id = Column(Integer, ForeignKey("songs.id"), primary_key=True, index=True)
    last_accessed_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    song = relationship("Song", back_populates="search_history")

# ----------------- FTS5 TRIGGERS -----------------

from sqlalchemy import event, DDL

# Criação da tabela virtual FTS5 para busca rápida de músicas
fts_table_ddl = DDL('''
CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
    title, artist, tags, full_lyrics,
    content='songs', content_rowid='id',
    tokenize='unicode61 remove_diacritics 1'
);
''')

# Triggers para sincronizar o FTS5 com a tabela songs automaticamente
fts_trigger_insert = DDL('''
CREATE TRIGGER IF NOT EXISTS songs_ai AFTER INSERT ON songs BEGIN
  INSERT INTO songs_fts(rowid, title, artist, tags, full_lyrics) 
  VALUES (new.id, new.title, new.artist, new.tags, new.full_lyrics);
END;
''')

fts_trigger_delete = DDL('''
CREATE TRIGGER IF NOT EXISTS songs_ad AFTER DELETE ON songs BEGIN
  INSERT INTO songs_fts(songs_fts, rowid, title, artist, tags, full_lyrics) 
  VALUES('delete', old.id, old.title, old.artist, old.tags, old.full_lyrics);
END;
''')

fts_trigger_update = DDL('''
CREATE TRIGGER IF NOT EXISTS songs_au AFTER UPDATE ON songs BEGIN
  INSERT INTO songs_fts(songs_fts, rowid, title, artist, tags, full_lyrics) 
  VALUES('delete', old.id, old.title, old.artist, old.tags, old.full_lyrics);
  
  INSERT INTO songs_fts(rowid, title, artist, tags, full_lyrics) 
  VALUES (new.id, new.title, new.artist, new.tags, new.full_lyrics);
END;
''')

# Associa os eventos à criação da tabela `songs`
event.listen(Song.__table__, 'after_create', fts_table_ddl)
event.listen(Song.__table__, 'after_create', fts_trigger_insert)
event.listen(Song.__table__, 'after_create', fts_trigger_delete)
event.listen(Song.__table__, 'after_create', fts_trigger_update)

from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

# ----------------- CHORDS -----------------
class SongChordBase(BaseModel):
    annotations: Optional[str] = None

class SongChordCreate(SongChordBase):
    pass

class SongChordResponse(SongChordBase):
    id: int
    section_id: int

    class Config:
        from_attributes = True

# ----------------- SECTIONS -----------------
class SongSectionBase(BaseModel):
    section_order: int
    section_label: Optional[str] = None
    lyrics: Optional[str] = None
    chordpro: Optional[str] = None
    background_media: Optional[str] = None

class SongSectionCreate(SongSectionBase):
    chords: List[SongChordCreate] = []

class SongSectionResponse(SongSectionBase):
    id: int
    song_id: int
    chords: List[SongChordResponse] = []

    class Config:
        from_attributes = True

# ----------------- SONGS -----------------
class SongBase(BaseModel):
    cloud_id: Optional[Any] = None
    hymnal_num: Optional[str] = None
    title: str
    artist: Optional[str] = None
    source: Optional[str] = None
    tags: Optional[str] = None
    full_lyrics: Optional[str] = None
    full_chordpro: Optional[str] = None
    tone: Optional[str] = None
    intro: Optional[str] = None
    lines_limit: Optional[Any] = None
    display_settings: Optional[str] = None
    youtube_url: Optional[str] = None
    audio_url: Optional[str] = None

class SongCreate(SongBase):
    sections: List[SongSectionCreate] = []

class SongUpdate(SongBase):
    title: Optional[str] = None  # Make fields optional for updates
    sections: Optional[List[SongSectionCreate]] = None

class SongResponse(SongBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    sections: List[SongSectionResponse] = []

    class Config:
        from_attributes = True

class SongSearchResult(BaseModel):
    id: int
    title: str
    hymnal_num: Optional[str] = None
    artist: Optional[str] = None
    tags: Optional[str] = None
    source: Optional[str] = None
    snippet: Optional[str] = None # Para retornar trechos da busca FTS
    is_match_snippet: bool = False

    class Config:
        from_attributes = True

# ----------------- SEARCH HISTORY -----------------
class SongSearchHistoryResponse(BaseModel):
    id: int
    song_id: int
    last_accessed_at: datetime
    song: SongResponse

    class Config:
        from_attributes = True

from typing import Optional, List
import datetime
from pydantic import BaseModel
from app.schemas.user import UserOut

class MatchGameCreate(BaseModel):
    slot_a_bey: Optional[str] = None
    slot_b_bey: Optional[str] = None
    finish_type: str  # spin_finish_1p, over_finish_2p, burst_finish_2p, xtreme_finish_3p, penalty_1p, draw_0p
    awarded_to: str  # player_a, player_b, draw
    points: int = 1
    notes: Optional[str] = None

class MatchGameOut(BaseModel):
    id: int
    match_id: int
    game_order: int
    slot_a_bey: Optional[str] = None
    slot_b_bey: Optional[str] = None
    finish_type: str
    awarded_to: str
    points: int
    notes: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class MatchScoreUpdate(BaseModel):
    score_a: int
    score_b: int
    status: Optional[str] = None
    winner_id: Optional[int] = None
    game: Optional[MatchGameCreate] = None

class MatchCallUpdate(BaseModel):
    station_number: int
    status: str = "calling"  # calling, in_progress

class MatchOut(BaseModel):
    id: int
    tournament_id: int
    round_number: int
    stage: str
    bracket_position: int
    station_number: int
    player_a_id: Optional[int] = None
    player_b_id: Optional[int] = None
    player_a: Optional[UserOut] = None
    player_b: Optional[UserOut] = None
    score_a: int
    score_b: int
    winner_id: Optional[int] = None
    referee_id: Optional[int] = None
    status: str
    is_bye: bool
    games: List[MatchGameOut] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True

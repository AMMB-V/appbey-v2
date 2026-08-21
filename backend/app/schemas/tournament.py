from typing import Optional, List
import datetime
from pydantic import BaseModel
from app.schemas.user import UserOut

class TournamentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    format: str = "swiss"  # swiss, single_elim, double_elim, round_robin
    battle_type: str = "3on3_deck"
    match_target_points: int = 4
    stadium_type: str = "Xtreme Stadium (BX-10)"
    max_participants: int = 32
    entry_fee_ap: int = 50
    prize_pool_ap: int = 1000
    venue_name: str = "Club Beyblade Arena"
    venue_address: str = "Ciudad de Panama"
    country: str = "PA"
    start_date: Optional[datetime.datetime] = None
    total_rounds: int = 4
    is_official: bool = True

class TournamentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    venue_name: Optional[str] = None
    venue_address: Optional[str] = None
    entry_fee_ap: Optional[int] = None
    prize_pool_ap: Optional[int] = None
    current_round: Optional[int] = None

class ParticipantOut(BaseModel):
    id: int
    tournament_id: int
    user_id: int
    user: UserOut
    seed: int
    checked_in: bool
    swiss_points: int
    matches_played: int
    matches_won: int
    matches_lost: int
    matches_drawn: int
    points_scored: int
    points_conceded: int
    buchholz: float
    sonneborn_berger: float
    final_rank: Optional[int] = None
    prize_ap_awarded: int = 0

    class Config:
        from_attributes = True

class TournamentDetailOut(BaseModel):
    id: int
    slug: str
    title: str
    description: Optional[str] = None
    organizer_id: int
    organizer: Optional[UserOut] = None
    format: str
    battle_type: str
    match_target_points: int
    stadium_type: str
    max_participants: int
    entry_fee_ap: int
    prize_pool_ap: int
    status: str
    venue_name: str
    venue_address: str
    country: str
    start_date: datetime.datetime
    current_round: int
    total_rounds: int
    is_official: bool
    winner_user_id: Optional[int] = None
    winner: Optional[UserOut] = None
    participants_count: Optional[int] = 0
    created_at: datetime.datetime

    class Config:
        from_attributes = True

import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(120), unique=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    organizer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    format = Column(String(30), default="swiss")  # swiss, single_elim, double_elim, round_robin
    battle_type = Column(String(30), default="3on3_deck")  # 3on3_deck, 1on1
    match_target_points = Column(Integer, default=4)  # 4 for 3on3, 3 for 1on1
    stadium_type = Column(String(50), default="Xtreme Stadium (BX-10)")
    max_participants = Column(Integer, default=32)
    entry_fee_ap = Column(Integer, default=50)
    prize_pool_ap = Column(Integer, default=1000)
    status = Column(String(30), default="registration_open")  # draft, registration_open, check_in, in_progress, completed, cancelled
    venue_name = Column(String(150), default="Club Beyblade Panama - Arena Central")
    venue_address = Column(String(255), default="Via Israel, Ciudad de Panama")
    country = Column(String(10), default="PA")
    start_date = Column(DateTime, default=datetime.datetime.utcnow)
    current_round = Column(Integer, default=0)
    total_rounds = Column(Integer, default=4)
    is_official = Column(Boolean, default=True)
    winner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    runner_up_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    third_place_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    organizer = relationship("User", foreign_keys=[organizer_id], back_populates="organized_tournaments")
    winner = relationship("User", foreign_keys=[winner_user_id])
    runner_up = relationship("User", foreign_keys=[runner_up_user_id])
    third_place = relationship("User", foreign_keys=[third_place_user_id])
    participants = relationship("TournamentParticipant", back_populates="tournament", cascade="all, delete-orphan")
    matches = relationship("TournamentMatch", back_populates="tournament", cascade="all, delete-orphan")

class TournamentParticipant(Base):
    __tablename__ = "tournament_participants"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    deck_id = Column(Integer, ForeignKey("blader_decks.id", ondelete="SET NULL"), nullable=True)
    seed = Column(Integer, default=1)
    checked_in = Column(Boolean, default=False)
    checked_in_at = Column(DateTime, nullable=True)
    
    swiss_points = Column(Integer, default=0)
    matches_played = Column(Integer, default=0)
    matches_won = Column(Integer, default=0)
    matches_lost = Column(Integer, default=0)
    matches_drawn = Column(Integer, default=0)
    points_scored = Column(Integer, default=0)
    points_conceded = Column(Integer, default=0)
    buchholz = Column(Float, default=0.0)
    sonneborn_berger = Column(Float, default=0.0)
    final_rank = Column(Integer, nullable=True)
    prize_ap_awarded = Column(Integer, default=0)

    tournament = relationship("Tournament", back_populates="participants")
    user = relationship("User", back_populates="tournament_participations")
    deck = relationship("BladerDeck")

class TournamentMatch(Base):
    __tablename__ = "tournament_matches"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    round_number = Column(Integer, default=1)
    stage = Column(String(30), default="swiss")  # swiss, round_of_16, quarterfinals, semifinals, finals, bronze
    bracket_position = Column(Integer, default=1)
    station_number = Column(Integer, default=1)
    
    player_a_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    player_b_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    score_a = Column(Integer, default=0)
    score_b = Column(Integer, default=0)
    winner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    referee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(30), default="pending")  # pending, calling, in_progress, finished, disputed
    is_bye = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    tournament = relationship("Tournament", back_populates="matches")
    player_a = relationship("User", foreign_keys=[player_a_id])
    player_b = relationship("User", foreign_keys=[player_b_id])
    winner = relationship("User", foreign_keys=[winner_id])
    referee = relationship("User", foreign_keys=[referee_id])
    games = relationship("MatchGame", back_populates="match", cascade="all, delete-orphan")

class MatchGame(Base):
    __tablename__ = "match_games"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("tournament_matches.id", ondelete="CASCADE"), nullable=False)
    game_order = Column(Integer, default=1)
    slot_a_bey = Column(String(100), nullable=True)
    slot_b_bey = Column(String(100), nullable=True)
    finish_type = Column(String(40), nullable=False)  # spin_finish_1p, over_finish_2p, burst_finish_2p, xtreme_finish_3p, penalty_1p, draw_0p
    awarded_to = Column(String(10), nullable=False)  # player_a, player_b, draw
    points = Column(Integer, default=1)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    match = relationship("TournamentMatch", back_populates="games")

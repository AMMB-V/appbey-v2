import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class Season(Base):
    __tablename__ = "seasons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    start_date = Column(DateTime, default=datetime.datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    description = Column(String(255), default="Circuito competitivo oficial AppBey")

class SeasonRanking(Base):
    __tablename__ = "season_rankings"

    id = Column(Integer, primary_key=True, index=True)
    season_id = Column(Integer, ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    points = Column(Integer, default=0)
    elo = Column(Integer, default=1200)
    tournaments_played = Column(Integer, default=0)
    tournaments_won = Column(Integer, default=0)
    podium_finishes = Column(Integer, default=0)
    matches_won = Column(Integer, default=0)
    matches_lost = Column(Integer, default=0)

    season = relationship("Season")
    user = relationship("User")

class HallOfFame(Base):
    __tablename__ = "hall_of_fame"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, default=2026)
    title = Column(String(150), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tournament_name = Column(String(150), nullable=False)
    signature_deck = Column(String(255), default="Phoenix Wing 9-60 GF / Wizard Rod 5-70 DB / Shark Edge 3-60 LF")
    trophy_icon = Column(String(50), default="trophy-gold")
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")

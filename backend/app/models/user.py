import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=False)
    role = Column(String(30), default="blader")  # admin, organizer, referee, blader, spectator
    country = Column(String(10), default="PA")
    avatar_url = Column(String(255), default="https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80")
    bio = Column(String(500), default="Blader competitivo de Beyblade X")
    favorite_combo = Column(String(100), default="Phoenix Wing 9-60 GF")
    elo_rating = Column(Integer, default=1200)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    wallet = relationship("Wallet", back_populates="user", uselist=False, cascade="all, delete-orphan")
    decks = relationship("BladerDeck", back_populates="user", cascade="all, delete-orphan")
    tournament_participations = relationship("TournamentParticipant", back_populates="user")
    organized_tournaments = relationship("Tournament", back_populates="organizer", foreign_keys="Tournament.organizer_id")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    posts = relationship("CommunityPost", back_populates="user", cascade="all, delete-orphan")

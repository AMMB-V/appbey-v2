from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.ranking import Season, SeasonRanking, HallOfFame
from app.models.user import User

router = APIRouter(prefix="/rankings", tags=["Rankings & Hall of Fame"])

@router.get("/leaderboard")
def get_leaderboard(country: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(User).filter(User.is_active == True)
    if country:
        q = q.filter(User.country == country)
    users = q.order_by(User.elo_rating.desc()).limit(limit).all()
    
    results = []
    for idx, u in enumerate(users):
        results.append({
            "rank": idx + 1,
            "user_id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "country": u.country,
            "avatar_url": u.avatar_url,
            "elo_rating": u.elo_rating,
            "favorite_combo": u.favorite_combo,
            "role": u.role
        })
    return results

@router.get("/hall-of-fame")
def get_hall_of_fame(db: Session = Depends(get_db)):
    entries = db.query(HallOfFame).order_by(HallOfFame.year.desc(), HallOfFame.created_at.desc()).all()
    results = []
    for e in entries:
        results.append({
            "id": e.id,
            "year": e.year,
            "title": e.title,
            "blader_name": e.user.display_name if e.user else "Blader Leyenda",
            "blader_username": e.user.username if e.user else "blader",
            "blader_avatar": e.user.avatar_url if e.user else None,
            "country": e.user.country if e.user else "PA",
            "tournament_name": e.tournament_name,
            "signature_deck": e.signature_deck,
            "trophy_icon": e.trophy_icon,
            "notes": e.notes
        })
    return results

@router.get("/seasons")
def get_seasons(db: Session = Depends(get_db)):
    return db.query(Season).order_by(Season.start_date.desc()).all()

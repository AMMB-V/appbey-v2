import re
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.tournament import Tournament, TournamentParticipant, TournamentMatch
from app.models.user import User
from app.schemas.tournament import TournamentCreate, TournamentUpdate, ParticipantOut, TournamentDetailOut
from app.schemas.match import MatchOut
from app.services.auth_service import require_auth, require_roles
from app.services.tournament_engine import TournamentEngine
from app.services.wallet_service import WalletService
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/tournaments", tags=["Torneos"])

def slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"[-\s]+", "-", s)

@router.get("", response_model=List[TournamentDetailOut])
def list_tournaments(status: Optional[str] = None, country: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Tournament)
    if status:
        q = q.filter(Tournament.status == status)
    if country:
        q = q.filter(Tournament.country == country)
    tournaments = q.order_by(Tournament.created_at.desc()).all()
    results = []
    for t in tournaments:
        results.append({
            "id": t.id,
            "slug": t.slug,
            "title": t.title,
            "description": t.description,
            "organizer_id": t.organizer_id,
            "organizer": t.organizer,
            "format": t.format,
            "battle_type": t.battle_type,
            "match_target_points": t.match_target_points,
            "stadium_type": t.stadium_type,
            "max_participants": t.max_participants,
            "entry_fee_ap": t.entry_fee_ap,
            "prize_pool_ap": t.prize_pool_ap,
            "status": t.status,
            "venue_name": t.venue_name,
            "venue_address": t.venue_address,
            "country": t.country,
            "start_date": t.start_date,
            "current_round": t.current_round,
            "total_rounds": t.total_rounds,
            "is_official": t.is_official,
            "winner_user_id": t.winner_user_id,
            "winner": t.winner,
            "participants_count": len(t.participants),
            "created_at": t.created_at
        })
    return results

@router.post("", response_model=TournamentDetailOut)
def create_tournament(data: TournamentCreate, current_user: User = Depends(require_roles(["organizer", "admin"])), db: Session = Depends(get_db)):
    base_slug = slugify(data.title)
    slug = f"{base_slug}-{int(datetime.datetime.utcnow().timestamp())}"
    
    t = Tournament(
        slug=slug,
        title=data.title,
        description=data.description,
        organizer_id=current_user.id,
        format=data.format,
        battle_type=data.battle_type,
        match_target_points=data.match_target_points,
        stadium_type=data.stadium_type,
        max_participants=data.max_participants,
        entry_fee_ap=data.entry_fee_ap,
        prize_pool_ap=data.prize_pool_ap,
        status="registration_open",
        venue_name=data.venue_name,
        venue_address=data.venue_address,
        country=data.country,
        start_date=data.start_date or datetime.datetime.utcnow(),
        total_rounds=data.total_rounds,
        is_official=data.is_official
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

@router.get("/{tournament_id}", response_model=TournamentDetailOut)
def get_tournament(tournament_id: int, db: Session = Depends(get_db)):
    t = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    return {
        "id": t.id,
        "slug": t.slug,
        "title": t.title,
        "description": t.description,
        "organizer_id": t.organizer_id,
        "organizer": t.organizer,
        "format": t.format,
        "battle_type": t.battle_type,
        "match_target_points": t.match_target_points,
        "stadium_type": t.stadium_type,
        "max_participants": t.max_participants,
        "entry_fee_ap": t.entry_fee_ap,
        "prize_pool_ap": t.prize_pool_ap,
        "status": t.status,
        "venue_name": t.venue_name,
        "venue_address": t.venue_address,
        "country": t.country,
        "start_date": t.start_date,
        "current_round": t.current_round,
        "total_rounds": t.total_rounds,
        "is_official": t.is_official,
        "winner_user_id": t.winner_user_id,
        "winner": t.winner,
        "participants_count": len(t.participants),
        "created_at": t.created_at
    }

@router.post("/{tournament_id}/register")
def register_to_tournament(tournament_id: int, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    t = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    if t.status not in ["registration_open", "check_in"]:
        raise HTTPException(status_code=400, detail="Las inscripciones para este torneo estan cerradas")
    
    existing = db.query(TournamentParticipant).filter(
        TournamentParticipant.tournament_id == tournament_id,
        TournamentParticipant.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya estas inscrito en este torneo")

    if len(t.participants) >= t.max_participants:
        raise HTTPException(status_code=400, detail="El cupo maximo de participantes se ha completado")

    # Entry fee deduction
    if t.entry_fee_ap > 0:
        WalletService.debit(db, current_user.id, t.entry_fee_ap, "tournament_entry", f"Inscripcion a: {t.title}", str(t.id))

    part = TournamentParticipant(
        tournament_id=t.id,
        user_id=current_user.id,
        seed=len(t.participants) + 1,
        checked_in=False
    )
    db.add(part)
    db.commit()
    return {"message": "Inscripcion exitosa", "participant_id": part.id}

@router.post("/{tournament_id}/checkin")
def checkin_participant(tournament_id: int, user_id: int, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    t = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    
    # User can checkin self, or organizer/referee/admin can checkin any user
    if current_user.id != user_id and current_user.role not in ["organizer", "referee", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para realizar check-in de otro Blader")

    part = db.query(TournamentParticipant).filter(
        TournamentParticipant.tournament_id == tournament_id,
        TournamentParticipant.user_id == user_id
    ).first()
    if not part:
        raise HTTPException(status_code=404, detail="El usuario no esta inscrito en este torneo")

    part.checked_in = True
    part.checked_in_at = datetime.datetime.utcnow()
    db.commit()
    return {"message": "Check-in confirmado", "user_id": user_id}

@router.get("/{tournament_id}/participants", response_model=List[ParticipantOut])
def get_participants(tournament_id: int, db: Session = Depends(get_db)):
    return db.query(TournamentParticipant).filter(
        TournamentParticipant.tournament_id == tournament_id
    ).order_by(TournamentParticipant.swiss_points.desc(), TournamentParticipant.buchholz.desc()).all()

@router.get("/{tournament_id}/matches", response_model=List[MatchOut])
def get_matches(tournament_id: int, round_number: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(TournamentMatch).filter(TournamentMatch.tournament_id == tournament_id)
    if round_number:
        q = q.filter(TournamentMatch.round_number == round_number)
    return q.order_by(TournamentMatch.round_number, TournamentMatch.bracket_position).all()

@router.post("/{tournament_id}/start")
def start_tournament(tournament_id: int, current_user: User = Depends(require_roles(["organizer", "admin"])), db: Session = Depends(get_db)):
    t = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    
    if t.format == "swiss":
        TournamentEngine.generate_next_swiss_round(db, t)
    elif t.format == "single_elim":
        TournamentEngine.generate_single_elimination_bracket(db, t)
    else:
        TournamentEngine.generate_single_elimination_bracket(db, t)

    return {"message": "Torneo iniciado exitosamente", "current_round": t.current_round}

@router.post("/{tournament_id}/next-round")
def trigger_next_round(tournament_id: int, current_user: User = Depends(require_roles(["organizer", "admin"])), db: Session = Depends(get_db)):
    t = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    
    if t.format == "swiss":
        r = TournamentEngine.generate_next_swiss_round(db, t)
        return {"message": f"Ronda {r} generada exitosamente", "current_round": r}
    else:
        return {"message": "Las rondas de eliminacion avanzan automaticamente al finalizar cada match"}

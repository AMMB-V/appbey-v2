from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.tournament import TournamentMatch, Tournament
from app.models.user import User
from app.schemas.match import MatchOut, MatchGameCreate, MatchCallUpdate
from app.services.auth_service import require_auth
from app.services.tournament_engine import TournamentEngine
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/matches", tags=["Partidas y Arbitraje"])

@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: int, db: Session = Depends(get_db)):
    match = db.query(TournamentMatch).filter(TournamentMatch.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match no encontrado")
    return match

@router.post("/{match_id}/call")
async def call_match_to_station(match_id: int, data: MatchCallUpdate, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    match = db.query(TournamentMatch).filter(TournamentMatch.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match no encontrado")
    
    match.station_number = data.station_number
    match.status = data.status
    db.commit()
    db.refresh(match)

    # Broadcast event for Stadium Display & mobile bladers
    player_a_name = match.player_a.display_name if match.player_a else "TBD"
    player_b_name = match.player_b.display_name if match.player_b else "TBD"
    await ws_manager.broadcast_tournament(
        tournament_id=match.tournament_id,
        event_type="match_call",
        data={
            "match_id": match.id,
            "station_number": match.station_number,
            "status": match.status,
            "player_a": player_a_name,
            "player_b": player_b_name
        }
    )

    return {"message": f"Match llamado a Stadium {match.station_number}", "match_id": match.id}

@router.post("/{match_id}/record-finish", response_model=MatchOut)
async def record_finish(match_id: int, game_data: MatchGameCreate, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    match = db.query(TournamentMatch).filter(TournamentMatch.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match no encontrado")

    if not match.referee_id:
        match.referee_id = current_user.id
        db.commit()

    updated_match = TournamentEngine.record_match_game(
        db=db,
        match_id=match_id,
        finish_type=game_data.finish_type,
        awarded_to=game_data.awarded_to,
        notes=game_data.notes
    )

    # Broadcast score update via WebSocket to all spectators & TV projector
    await ws_manager.broadcast_tournament(
        tournament_id=updated_match.tournament_id,
        event_type="score_update",
        data={
            "match_id": updated_match.id,
            "station_number": updated_match.station_number,
            "score_a": updated_match.score_a,
            "score_b": updated_match.score_b,
            "status": updated_match.status,
            "winner_id": updated_match.winner_id,
            "last_finish": game_data.finish_type,
            "awarded_to": game_data.awarded_to
        }
    )

    return updated_match

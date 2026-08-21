from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.beyblade import BeybladePart, BladerDeck
from app.models.user import User
from app.schemas.beyblade import BeybladePartOut, BladerDeckCreate, BladerDeckOut
from app.services.auth_service import require_auth

router = APIRouter(prefix="/beyblades", tags=["Beyblade Database & Decks"])

@router.get("/parts", response_model=List[BeybladePartOut])
def list_parts(category: Optional[str] = None, system: Optional[str] = None, tier: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(BeybladePart)
    if category:
        q = q.filter(BeybladePart.category == category)
    if system:
        q = q.filter(BeybladePart.system == system)
    if tier:
        q = q.filter(BeybladePart.tier == tier)
    return q.order_by(BeybladePart.category, BeybladePart.name).all()

@router.get("/parts/{part_id}", response_model=BeybladePartOut)
def get_part(part_id: int, db: Session = Depends(get_db)):
    part = db.query(BeybladePart).filter(BeybladePart.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    return part

@router.get("/decks", response_model=List[BladerDeckOut])
def list_decks(user_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(BladerDeck)
    if user_id:
        q = q.filter(BladerDeck.user_id == user_id)
    else:
        q = q.filter(BladerDeck.is_public == True)
    return q.order_by(BladerDeck.created_at.desc()).all()

@router.post("/decks", response_model=BladerDeckOut)
def create_deck(data: BladerDeckCreate, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    # Calculate weight
    parts_ids = [
        data.slot1_blade_id, data.slot1_ratchet_id, data.slot1_bit_id,
        data.slot2_blade_id, data.slot2_ratchet_id, data.slot2_bit_id,
        data.slot3_blade_id, data.slot3_ratchet_id, data.slot3_bit_id
    ]
    parts = db.query(BeybladePart).filter(BeybladePart.id.in_([p for p in parts_ids if p])).all()
    total_w = sum(p.weight_grams for p in parts)

    deck = BladerDeck(
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        is_public=data.is_public,
        slot1_name=data.slot1_name,
        slot1_blade_id=data.slot1_blade_id,
        slot1_ratchet_id=data.slot1_ratchet_id,
        slot1_bit_id=data.slot1_bit_id,
        slot2_name=data.slot2_name,
        slot2_blade_id=data.slot2_blade_id,
        slot2_ratchet_id=data.slot2_ratchet_id,
        slot2_bit_id=data.slot2_bit_id,
        slot3_name=data.slot3_name,
        slot3_blade_id=data.slot3_blade_id,
        slot3_ratchet_id=data.slot3_ratchet_id,
        slot3_bit_id=data.slot3_bit_id,
        total_weight=round(total_w, 1)
    )
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return deck

@router.delete("/decks/{deck_id}")
def delete_deck(deck_id: int, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    deck = db.query(BladerDeck).filter(BladerDeck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck no encontrado")
    if deck.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar este deck")
    db.delete(deck)
    db.commit()
    return {"message": "Deck eliminado exitosamente"}

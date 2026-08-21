from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate
from app.services.auth_service import require_auth

router = APIRouter(prefix="/users", tags=["Usuarios"])

@router.get("", response_model=List[UserOut])
def list_users(limit: int = 50, role: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(User).filter(User.is_active == True)
    if role:
        q = q.filter(User.role == role)
    users = q.order_by(User.elo_rating.desc()).limit(limit).all()
    results = []
    for u in users:
        results.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "display_name": u.display_name,
            "role": u.role,
            "country": u.country,
            "avatar_url": u.avatar_url,
            "bio": u.bio,
            "favorite_combo": u.favorite_combo,
            "elo_rating": u.elo_rating,
            "is_active": u.is_active,
            "is_verified": u.is_verified,
            "created_at": u.created_at,
            "balance_ap": u.wallet.balance if u.wallet else 0
        })
    return results

@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "country": user.country,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "favorite_combo": user.favorite_combo,
        "elo_rating": user.elo_rating,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "created_at": user.created_at,
        "balance_ap": user.wallet.balance if user.wallet else 0
    }

@router.put("/me", response_model=UserOut)
def update_profile(data: UserUpdate, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    if data.display_name is not None:
        current_user.display_name = data.display_name
    if data.country is not None:
        current_user.country = data.country
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
    if data.bio is not None:
        current_user.bio = data.bio
    if data.favorite_combo is not None:
        current_user.favorite_combo = data.favorite_combo
    if data.role is not None and current_user.role == "admin":
        current_user.role = data.role

    db.commit()
    db.refresh(current_user)
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "display_name": current_user.display_name,
        "role": current_user.role,
        "country": current_user.country,
        "avatar_url": current_user.avatar_url,
        "bio": current_user.bio,
        "favorite_combo": current_user.favorite_combo,
        "elo_rating": current_user.elo_rating,
        "is_active": current_user.is_active,
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at,
        "balance_ap": current_user.wallet.balance if current_user.wallet else 0
    }

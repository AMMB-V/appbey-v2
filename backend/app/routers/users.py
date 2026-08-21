from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.wallet import Wallet, Transaction
from app.schemas.user import UserOut, UserUpdate
from app.schemas.auth import AdminCreateUserRequest, RoleUpdateRequest
from app.services.auth_service import require_auth, require_roles, hash_password

router = APIRouter(prefix="/users", tags=["Usuarios"])

VALID_ROLES = ["admin", "organizer", "referee", "blader", "spectator"]

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
    # Nota: un admin puede cambiar su propio rol aqui, pero para reasignar el
    # rol de OTRO usuario debe usar PUT /users/{user_id}/role (abajo).
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


@router.post("/admin-create", response_model=UserOut)
def admin_create_user(
    data: AdminCreateUserRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    """Un admin da de alta directamente a alguien como participante, arbitro,
    organizador o incluso otro admin. Quien se registra por si mismo NUNCA
    puede llegar aqui: este endpoint requiere sesion de admin."""
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Rol invalido. Usa uno de: {', '.join(VALID_ROLES)}")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya esta en uso")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="El correo electronico ya esta registrado")

    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        display_name=data.display_name,
        role=data.role,
        country=data.country or "PA",
        elo_rating=1200
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    wallet = Wallet(user_id=user.id, balance=500)
    db.add(wallet)
    db.commit()
    db.add(Transaction(wallet_id=wallet.id, amount=wallet.balance, tx_type="signup_bonus", reason="Saldo inicial y bienvenida AppBey"))
    db.commit()

    return {
        "id": user.id, "username": user.username, "email": user.email,
        "display_name": user.display_name, "role": user.role, "country": user.country,
        "avatar_url": user.avatar_url, "bio": user.bio, "favorite_combo": user.favorite_combo,
        "elo_rating": user.elo_rating, "is_active": user.is_active, "is_verified": user.is_verified,
        "created_at": user.created_at, "balance_ap": wallet.balance
    }


@router.put("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    data: RoleUpdateRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    """Solo un admin puede asignar el cargo de cualquier usuario ya registrado,
    incluyendo ascender/degradar a otro admin."""
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Rol invalido. Usa uno de: {', '.join(VALID_ROLES)}")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    target.role = data.role
    db.commit()
    db.refresh(target)
    return {
        "id": target.id, "username": target.username, "email": target.email,
        "display_name": target.display_name, "role": target.role, "country": target.country,
        "avatar_url": target.avatar_url, "bio": target.bio, "favorite_combo": target.favorite_combo,
        "elo_rating": target.elo_rating, "is_active": target.is_active, "is_verified": target.is_verified,
        "created_at": target.created_at, "balance_ap": target.wallet.balance if target.wallet else 0
    }

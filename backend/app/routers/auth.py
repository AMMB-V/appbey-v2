from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.auth import Token, LoginRequest, RegisterRequest
from app.schemas.user import UserOut
from app.services.auth_service import hash_password, verify_password, create_access_token, require_auth
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/auth", tags=["Autenticacion"])

@router.post("/register", response_model=Token)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya esta en uso")
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="El correo electronico ya esta registrado")

    # Seguridad: quien se registra por su cuenta SIEMPRE entra como "blader".
    # Los demas roles (organizer, referee, admin) solo los puede asignar un admin
    # despues, vía PUT /users/{user_id}/role o POST /users/admin-create.
    user = User(
        username=req.username,
        email=req.email,
        password_hash=hash_password(req.password),
        display_name=req.display_name,
        role="blader",
        country=req.country or "PA",
        elo_rating=1200
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Initialize wallet with bonus
    WalletService.get_or_create_wallet(db, user.id)

    access_token = create_access_token(data={"sub": str(user.id), "username": user.username, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
            "country": user.country,
            "avatar_url": user.avatar_url,
            "elo_rating": user.elo_rating
        }
    }

@router.post("/login", response_model=Token)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter((User.email == req.email) | (User.username == req.email)).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Credenciales incorrectas")

    access_token = create_access_token(data={"sub": str(user.id), "username": user.username, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
            "country": user.country,
            "avatar_url": user.avatar_url,
            "elo_rating": user.elo_rating
        }
    }

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(require_auth)):
    balance = current_user.wallet.balance if current_user.wallet else 0
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
        "balance_ap": balance
    }

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.wallet import WalletOut, TransferRequest, TransactionOut
from app.services.auth_service import require_auth
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/wallets", tags=["Billetera AP Coins"])

@router.get("/me", response_model=WalletOut)
def get_my_wallet(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    wallet = WalletService.get_or_create_wallet(db, current_user.id)
    return wallet

@router.post("/transfer", response_model=TransactionOut)
def transfer_coins(req: TransferRequest, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    tx = WalletService.transfer(
        db=db,
        sender_id=current_user.id,
        recipient_username=req.recipient_username,
        amount=req.amount,
        reason=req.reason
    )
    return tx

@router.post("/daily-reward", response_model=TransactionOut)
def claim_daily_reward(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    tx = WalletService.credit(
        db=db,
        user_id=current_user.id,
        amount=50,
        tx_type="daily_bonus",
        reason="Recompensa diaria de entrenamiento Blader"
    )
    return tx

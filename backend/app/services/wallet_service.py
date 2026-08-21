from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.wallet import Wallet, Transaction
from app.models.user import User

class WalletService:
    @staticmethod
    def get_or_create_wallet(db: Session, user_id: int) -> Wallet:
        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
        if not wallet:
            wallet = Wallet(user_id=user_id, balance=250)
            db.add(wallet)
            db.commit()
            db.refresh(wallet)
            tx = Transaction(
                wallet_id=wallet.id,
                amount=250,
                tx_type="signup_bonus",
                reason="Bono de bienvenida AppBey"
            )
            db.add(tx)
            db.commit()
            db.refresh(wallet)
        return wallet

    @staticmethod
    def credit(db: Session, user_id: int, amount: int, tx_type: str, reason: str, ref_id: str = None) -> Transaction:
        wallet = WalletService.get_or_create_wallet(db, user_id)
        wallet.balance += amount
        tx = Transaction(
            wallet_id=wallet.id,
            amount=amount,
            tx_type=tx_type,
            reason=reason,
            reference_id=ref_id
        )
        db.add(tx)
        db.commit()
        db.refresh(wallet)
        return tx

    @staticmethod
    def debit(db: Session, user_id: int, amount: int, tx_type: str, reason: str, ref_id: str = None) -> Transaction:
        wallet = WalletService.get_or_create_wallet(db, user_id)
        if wallet.balance < amount:
            raise HTTPException(status_code=400, detail=f"Saldo insuficiente de AP Coins ({wallet.balance} disponibles, se requieren {amount})")
        wallet.balance -= amount
        tx = Transaction(
            wallet_id=wallet.id,
            amount=-amount,
            tx_type=tx_type,
            reason=reason,
            reference_id=ref_id
        )
        db.add(tx)
        db.commit()
        db.refresh(wallet)
        return tx

    @staticmethod
    def transfer(db: Session, sender_id: int, recipient_username: str, amount: int, reason: str) -> Transaction:
        if amount <= 0:
            raise HTTPException(status_code=400, detail="El monto de transferencia debe ser mayor a 0 AP")
        recipient = db.query(User).filter(User.username == recipient_username).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Usuario destinatario no encontrado")
        if recipient.id == sender_id:
            raise HTTPException(status_code=400, detail="No puedes transferirte a ti mismo")

        WalletService.debit(db, sender_id, amount, "transfer_out", f"Transferencia enviada a @{recipient.username}: {reason}")
        tx_in = WalletService.credit(db, recipient.id, amount, "transfer_in", f"Transferencia recibida: {reason}")
        return tx_in

import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    balance = Column(Integer, default=250)  # Starting bonus AP Coins
    frozen_balance = Column(Integer, default=0)
    currency_name = Column(String(20), default="AP Coins")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="wallet")
    transactions = relationship("Transaction", back_populates="wallet", cascade="all, delete-orphan", order_by="desc(Transaction.created_at)")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Integer, nullable=False)
    tx_type = Column(String(40), nullable=False)  # signup_bonus, tournament_entry, tournament_prize, wager_win, cosmetic_purchase, admin_adjustment
    reason = Column(String(255), nullable=False)
    reference_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    wallet = relationship("Wallet", back_populates="transactions")

from typing import Optional, List
import datetime
from pydantic import BaseModel

class TransactionOut(BaseModel):
    id: int
    amount: int
    tx_type: str
    reason: str
    reference_id: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class WalletOut(BaseModel):
    id: int
    user_id: int
    balance: int
    frozen_balance: int
    currency_name: str
    updated_at: datetime.datetime
    transactions: List[TransactionOut] = []

    class Config:
        from_attributes = True

class TransferRequest(BaseModel):
    recipient_username: str
    amount: int
    reason: Optional[str] = "Transferencia entre Bladers"

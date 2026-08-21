from typing import Optional
import datetime
from pydantic import BaseModel, EmailStr

class UserBase(BaseModel):
    username: str
    email: EmailStr
    display_name: str
    role: str = "blader"
    country: str = "PA"
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    favorite_combo: Optional[str] = None
    elo_rating: int = 1200

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    country: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    favorite_combo: Optional[str] = None
    role: Optional[str] = None

class UserOut(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime.datetime
    balance_ap: Optional[int] = 0

    class Config:
        from_attributes = True

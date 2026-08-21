from typing import Optional
from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class TokenData(BaseModel):
    user_id: Optional[int] = None
    username: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: str
    country: Optional[str] = "PA"

class AdminCreateUserRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: str
    role: str  # admin, organizer, referee, blader, spectator
    country: Optional[str] = "PA"

class RoleUpdateRequest(BaseModel):
    role: str  # admin, organizer, referee, blader, spectator

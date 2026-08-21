from typing import Optional, List
import datetime
from pydantic import BaseModel
from app.schemas.user import UserOut

class NotificationOut(BaseModel):
    id: int
    notif_type: str
    title: str
    message: str
    link: str
    is_read: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class PostCreate(BaseModel):
    content: str
    deck_id: Optional[int] = None
    image_url: Optional[str] = None

class CommentCreate(BaseModel):
    content: str

class CommentOut(BaseModel):
    id: int
    post_id: int
    user_id: int
    user: UserOut
    content: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class PostOut(BaseModel):
    id: int
    user_id: int
    user: UserOut
    content: str
    deck_id: Optional[int] = None
    image_url: Optional[str] = None
    likes_count: int
    comments_count: int
    created_at: datetime.datetime
    comments: List[CommentOut] = []

    class Config:
        from_attributes = True

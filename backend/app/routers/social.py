from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.social import Notification, CommunityPost, PostComment
from app.models.user import User
from app.schemas.social import NotificationOut, PostCreate, PostOut, CommentCreate, CommentOut
from app.services.auth_service import require_auth

router = APIRouter(prefix="/social", tags=["Comunidad & Notificaciones"])

@router.get("/posts", response_model=List[PostOut])
def get_posts(limit: int = 30, db: Session = Depends(get_db)):
    return db.query(CommunityPost).order_by(CommunityPost.created_at.desc()).limit(limit).all()

@router.post("/posts", response_model=PostOut)
def create_post(data: PostCreate, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    post = CommunityPost(
        user_id=current_user.id,
        content=data.content,
        deck_id=data.deck_id,
        image_url=data.image_url
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post

@router.post("/posts/{post_id}/like")
def like_post(post_id: int, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Publicacion no encontrada")
    post.likes_count += 1
    db.commit()
    return {"likes_count": post.likes_count}

@router.post("/posts/{post_id}/comments", response_model=CommentOut)
def add_comment(post_id: int, data: CommentCreate, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Publicacion no encontrada")
    
    comment = PostComment(
        post_id=post.id,
        user_id=current_user.id,
        content=data.content
    )
    post.comments_count += 1
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment

@router.get("/notifications", response_model=List[NotificationOut])
def get_my_notifications(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    return db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).limit(30).all()

@router.post("/notifications/mark-read")
def mark_notifications_read(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == current_user.id).update({"is_read": True})
    db.commit()
    return {"message": "Notificaciones marcadas como leidas"}

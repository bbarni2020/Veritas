from sqlalchemy.orm import Session
from . import models
from .auth import get_password_hash

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, username: str, password: str, country: str = None):
    user = models.User(username=username, password_hash=get_password_hash(password), country=country)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def create_post(db: Session, owner_id: int, video_url: str, caption: str = None):
    post = models.Post(owner_id=owner_id, video_url=video_url, caption=caption)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post

def get_posts(db: Session, skip: int = 0, limit: int = 20):
    return db.query(models.Post).order_by(models.Post.created_at.desc()).offset(skip).limit(limit).all()

def toggle_like(db: Session, user_id: int, post_id: int):
    existing = db.query(models.Like).filter(models.Like.user_id==user_id, models.Like.post_id==post_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return False
    like = models.Like(user_id=user_id, post_id=post_id)
    db.add(like)
    db.commit()
    return True

def add_comment(db: Session, user_id: int, post_id: int, text: str):
    comment = models.Comment(user_id=user_id, post_id=post_id, text=text)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment

def add_repost(db: Session, user_id: int, post_id: int):
    repost = models.Repost(user_id=user_id, post_id=post_id)
    db.add(repost)
    db.commit()
    db.refresh(repost)
    return repost

from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    password: str
    country: Optional[str]

class UserOut(BaseModel):
    id: int
    username: str
    country: Optional[str]
    class Config:
        orm_mode = True

class PostCreate(BaseModel):
    video_url: str
    caption: Optional[str]

class PostOut(BaseModel):
    id: int
    owner_id: int
    video_url: str
    caption: Optional[str]
    created_at: datetime
    class Config:
        orm_mode = True

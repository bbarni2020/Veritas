from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    password: str
    country: Optional[str]

class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str]
    country: Optional[str]
    profile_picture: Optional[str]
    class Config:
        orm_mode = True

class UserUpdate(BaseModel):
    username: Optional[str]
    country: Optional[str]

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class PostCreate(BaseModel):
    video_url: str
    caption: Optional[str]

class PostOut(BaseModel):
    id: int
    owner_id: int
    video_url: str
    mp4_url: Optional[str]
    webm_url: Optional[str]
    hls_url: Optional[str]
    processing_status: Optional[str]
    caption: Optional[str]
    description: Optional[str]
    keywords: Optional[str]
    created_at: datetime
    owner: Optional[UserOut]
    class Config:
        orm_mode = True

class PostUpdate(BaseModel):
    caption: Optional[str]

class PostFormats(BaseModel):
    mp4: Optional[str]
    webm: Optional[str]
    hls: Optional[str]

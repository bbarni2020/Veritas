from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Header, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .database import SessionLocal, engine, Base
from .auth import create_access_token, verify_password, decode_token
from .storage import presigned_upload, public_url
import os

Base.metadata.create_all(bind=engine)
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/auth/login')
templates = Jinja2Templates(directory="templates")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload or 'sub' not in payload:
        raise HTTPException(status_code=401, detail='Invalid token')
    user = db.query(models.User).filter(models.User.id == int(payload['sub'])).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return user

def admin_required(request: Request, db: Session = Depends(get_db)):
    auth = request.headers.get('authorization')
    if not auth or not auth.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Unauthorized')
    token = auth.split(' ')[1]
    payload = decode_token(token)
    if not payload or payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Forbidden')
    return True

@app.get('/admin')
def admin_login(request: Request):
    return templates.TemplateResponse('login.html', {'request': request})

@app.post('/admin/login')
def admin_auth(password: str = Form(...)):
    admin_pass = os.getenv('ADMIN_PASSWORD', 'adminpass')
    if password == admin_pass:
        token = create_access_token({'role': 'admin'})
        return {'token': token}
    raise HTTPException(status_code=401, detail='Invalid password')

@app.get('/admin/dashboard')
def admin_dashboard(request: Request, db: Session = Depends(get_db), admin=Depends(admin_required)):
    users = db.query(models.User).all()
    posts = db.query(models.Post).all()
    stats = {'users': len(users), 'posts': len(posts)}
    return templates.TemplateResponse('dashboard.html', {'request': request, 'users': users, 'posts': posts, 'stats': stats})

@app.get('/admin/users')
def admin_users(request: Request, db: Session = Depends(get_db), admin=Depends(admin_required)):
    users = db.query(models.User).all()
    return templates.TemplateResponse('users.html', {'request': request, 'users': users})

@app.get('/admin/posts')
def admin_posts(request: Request, db: Session = Depends(get_db), admin=Depends(admin_required)):
    posts = db.query(models.Post).all()
    return templates.TemplateResponse('posts.html', {'request': request, 'posts': posts})

@app.post('/auth/register', response_model=schemas.UserOut)
def register(u: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = crud.get_user_by_username(db, u.username)
    if existing:
        raise HTTPException(status_code=400, detail='username_exists')
    user = crud.create_user(db, u.username, u.password, u.country)
    return user

@app.post('/auth/login')
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, username)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail='invalid_credentials')
    token = create_access_token({'sub': str(user.id)})
    return {'access_token': token, 'token_type': 'bearer'}

@app.get('/posts', response_model=list[schemas.PostOut])
def feed(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return crud.get_posts(db, skip, limit)

@app.post('/posts', response_model=schemas.PostOut)
def create_post(p: schemas.PostCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = crud.create_post(db, current_user.id, p.video_url, p.caption)
    return post

@app.get('/upload/presign')
def get_presign(filename: str):
    key = filename
    return presigned_upload(key)

@app.post('/posts/{post_id}/like')
def like_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {'liked': crud.toggle_like(db, current_user.id, post_id)}

@app.post('/posts/{post_id}/comment')
def comment_post(post_id: int, text: str = Form(...), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    comment = crud.add_comment(db, current_user.id, post_id, text)
    return {'id': comment.id}

@app.post('/posts/{post_id}/repost')
def repost_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    repost = crud.add_repost(db, current_user.id, post_id)
    return {'id': repost.id}

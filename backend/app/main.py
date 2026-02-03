from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Header, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .database import SessionLocal, engine, Base
from .auth import create_access_token, verify_password, decode_token
from .storage import presigned_upload, public_url
from . import storage
import os
import io
import mimetypes
from fastapi.responses import StreamingResponse, FileResponse
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
from sqlalchemy import text

@app.on_event('startup')
def startup_checks():
    # Create default admin user if not exists
    db = SessionLocal()
    try:
        admin_pass = os.getenv('ADMIN_PASSWORD', 'adminpass')
        admin_email = os.getenv('ADMIN_EMAIL', 'admin@local')
        from .auth import get_password_hash
        user1 = db.query(models.User).filter(models.User.id == 1).first()
        if user1:
            user1.username = 'admin'
            user1.password_hash = get_password_hash(admin_pass)
            if not user1.email:
                user1.email = admin_email
            db.commit()
        else:
            u = models.User(id=1, username='admin', email=admin_email, password_hash=get_password_hash(admin_pass), country=None)
            db.add(u)
            db.commit()
    except Exception as e:
        db.rollback()
        pass
    finally:
        db.close()

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
async def admin_auth(request: Request):
    admin_pass = os.getenv('ADMIN_PASSWORD', 'adminpass')
    content_type = request.headers.get('content-type', '')
    if 'application/json' in content_type:
        body = await request.json()
        password = body.get('password')
    else:
        form = await request.form()
        password = form.get('password')
    if password == admin_pass:
        token = create_access_token({'role': 'admin'})
        return {'token': token}
    raise HTTPException(status_code=401, detail='Invalid password')

@app.get('/admin/dashboard')
def admin_dashboard(request: Request):
    return templates.TemplateResponse('dashboard.html', {'request': request})

@app.get('/api/admin/stats')
def api_admin_stats(db: Session = Depends(get_db), admin=Depends(admin_required)):
    users = db.query(models.User).count()
    posts = db.query(models.Post).count()
    likes = db.query(models.Like).count()
    comments = db.query(models.Comment).count()
    reposts = db.query(models.Repost).count()
    follows = db.query(models.Follow).count()
    return {
        'users': users, 
        'posts': posts,
        'likes': likes,
        'comments': comments,
        'reposts': reposts,
        'follows': follows
    }

@app.get('/api/admin/users')
def api_admin_users(db: Session = Depends(get_db), admin=Depends(admin_required)):
    users = db.query(models.User).all()
    return [{
        'id': u.id, 
        'username': u.username, 
        'email': u.email,
        'country': u.country,
        'profile_picture': u.profile_picture,
        'user_keywords': u.user_keywords,
        'created_at': u.created_at.isoformat() if u.created_at else None
    } for u in users]

@app.get('/api/admin/posts')
def api_admin_posts(db: Session = Depends(get_db), admin=Depends(admin_required)):
    posts = db.query(models.Post).all()
    return [{
        'id': p.id, 
        'owner_id': p.owner_id,
        'owner': p.owner.username if p.owner else None, 
        'video_url': p.video_url, 
        'caption': p.caption,
        'description': p.description,
        'keywords': p.keywords,
        'processing_status': p.processing_status,
        'created_at': p.created_at.isoformat() if p.created_at else None
    } for p in posts]

@app.post('/api/admin/upload-post')
def api_admin_upload_post(file: UploadFile = File(...), caption: str = Form(None), db: Session = Depends(get_db), admin=Depends(admin_required)):
    import uuid
    key = f"uploads/{uuid.uuid4().hex}-{file.filename}"
    storage.upload_fileobj(key, file.file, content_type=file.content_type)
    url = storage.public_url(key)
    post = crud.create_post(db, 1, url, caption)
    post.processing_status = 'processing'
    db.add(post)
    db.commit()
    from .processing import process_and_upload
    import threading
    db_url = os.getenv('DATABASE_URL')
    t = threading.Thread(target=process_and_upload, args=(post.id, key, db_url, os.getenv('MINIO_ENDPOINT')))
    t.daemon = True
    t.start()
    return {'id': post.id, 'video_url': post.video_url, 'processing': True}

@app.get('/api/admin/comments')
def api_admin_comments(db: Session = Depends(get_db), admin=Depends(admin_required)):
    items = db.query(models.Comment).all()
    return [{
        'id': c.id, 
        'user_id': c.user_id, 
        'post_id': c.post_id, 
        'content': c.content,
        'created_at': c.created_at.isoformat() if c.created_at else None
    } for c in items]

@app.get('/api/admin/likes')
def api_admin_likes(db: Session = Depends(get_db), admin=Depends(admin_required)):
    items = db.query(models.Like).all()
    return [{
        'id': l.id, 
        'user_id': l.user_id, 
        'post_id': l.post_id,
        'created_at': l.created_at.isoformat() if l.created_at else None
    } for l in items]

@app.get('/api/admin/reposts')
def api_admin_reposts(db: Session = Depends(get_db), admin=Depends(admin_required)):
    items = db.query(models.Repost).all()
    return [{
        'id': r.id, 
        'user_id': r.user_id, 
        'post_id': r.post_id,
        'created_at': r.created_at.isoformat() if r.created_at else None
    } for r in items]

from .crypto import decrypt

@app.get('/api/admin/follows')
def api_admin_follows(db: Session = Depends(get_db), admin=Depends(admin_required)):
    items = db.query(models.Follow).all()
    return [{
        'id': f.id, 
        'follower_id': f.follower_id, 
        'following_id': f.following_id,
        'created_at': f.created_at.isoformat() if f.created_at else None
    } for f in items]

@app.get('/api/admin/messages')
def api_admin_messages(db: Session = Depends(get_db), admin=Depends(admin_required)):
    items = crud.get_messages(db)
    return [{'id': m.id, 'sender_id': m.sender_id, 'recipient_id': m.recipient_id, 'text': decrypt(m.text), 'created_at': m.created_at} for m in items]

@app.delete('/api/admin/messages/{mid}')
def api_admin_delete_message(mid: int, db: Session = Depends(get_db), admin=Depends(admin_required)):
    m = db.query(models.Message).filter(models.Message.id == mid).first()
    if not m:
        raise HTTPException(status_code=404, detail='not_found')
    db.delete(m)
    db.commit()
    return {'ok': True}

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
    email = u.email or f"{u.username}@local"
    user = crud.create_user(db, u.username, u.password, u.country, email)
    return user

@app.post('/auth/login')
def login(credentials: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, credentials.username)
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail='invalid_credentials')
    token = create_access_token({'sub': str(user.id)})
    return {'access_token': token, 'token_type': 'bearer'}

@app.get('/me', response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.patch('/me', response_model=schemas.UserOut)
def update_me(payload: schemas.UserUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.username and payload.username != current_user.username:
        existing = crud.get_user_by_username(db, payload.username)
        if existing:
            raise HTTPException(status_code=400, detail='username_exists')
    return crud.update_user(db, current_user, payload.username, payload.country)

@app.post('/me/password')
def update_password(payload: schemas.PasswordChange, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail='invalid_password')
    crud.set_password(db, current_user, payload.new_password)
    return {'ok': True}

@app.get('/me/posts', response_model=list[schemas.PostOut])
def my_posts(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return crud.get_posts_by_owner(db, current_user.id)

@app.post('/me/profile-picture', response_model=schemas.UserOut)
def upload_profile_picture(file: UploadFile = File(...), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    import uuid
    key = f"profile-pictures/{uuid.uuid4().hex}-{file.filename}"
    storage.upload_fileobj(key, file.file, content_type=file.content_type)
    url = storage.public_url(key)
    current_user.profile_picture = url
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post('/users/{user_id}/follow')
def follow_user(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail='cannot_follow_yourself')
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail='user_not_found')
    existing = db.query(models.Follow).filter(models.Follow.follower_id == current_user.id, models.Follow.following_id == user_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {'following': False}
    follow = models.Follow(follower_id=current_user.id, following_id=user_id)
    db.add(follow)
    db.commit()
    return {'following': True}

@app.get('/users/{user_id}/is-following')
def is_following(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(models.Follow).filter(models.Follow.follower_id == current_user.id, models.Follow.following_id == user_id).first()
    return {'following': bool(existing)}

@app.get('/posts', response_model=list[schemas.PostOut])
def feed(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return crud.get_posts(db, skip, limit)

@app.get('/posts/{post_id}/formats', response_model=schemas.PostFormats)
def post_formats(post_id: int, db: Session = Depends(get_db)):
    p = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not p:
        raise HTTPException(status_code=404, detail='not_found')
    return {'mp4': p.mp4_url, 'webm': p.webm_url, 'hls': p.hls_url}

@app.get('/media/{key:path}')
def stream_media(key: str, range: str | None = Header(None)):
    cache_dir = os.getenv('MEDIA_CACHE_DIR', '/tmp/video_cache')
    os.makedirs(cache_dir, exist_ok=True)
    safe_name = key.replace('/', '_')
    cache_path = os.path.join(cache_dir, safe_name)
    if os.path.exists(cache_path):
        file_size = os.path.getsize(cache_path)
        content_type = mimetypes.guess_type(key)[0] or 'application/octet-stream'
        if range:
            m = range.split('=')[-1]
            start_s, end_s = m.split('-')
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else file_size - 1
            length = end - start + 1
            def file_stream():
                with open(cache_path, 'rb') as f:
                    f.seek(start)
                    remaining = length
                    while remaining > 0:
                        chunk = f.read(min(8192, remaining))
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk
            headers = {
                'Content-Range': f'bytes {start}-{end}/{file_size}',
                'Accept-Ranges': 'bytes',
                'Content-Length': str(length),
                'Content-Type': content_type,
            }
            return StreamingResponse(file_stream(), status_code=206, headers=headers)
        return FileResponse(cache_path, media_type=content_type)
    s3 = storage.s3
    bucket = storage.bucket
    if range:
        s3_range = range
        obj = s3.get_object(Bucket=bucket, Key=key, Range=s3_range)
        content_length = int(obj['ContentLength'])
        content_type = obj.get('ContentType') or mimetypes.guess_type(key)[0] or 'application/octet-stream'
        headers = {
            'Content-Range': obj.get('ContentRange', ''),
            'Accept-Ranges': 'bytes',
            'Content-Length': str(content_length),
            'Content-Type': content_type,
        }
        def stream_body():
            stream = obj['Body']
            while True:
                chunk = stream.read(8192)
                if not chunk:
                    break
                yield chunk
        return StreamingResponse(stream_body(), status_code=206, headers=headers)
    with open(cache_path, 'wb') as f:
        s3.download_fileobj(Bucket=bucket, Key=key, Fileobj=f)
    content_type = mimetypes.guess_type(key)[0] or 'application/octet-stream'
    return FileResponse(cache_path, media_type=content_type)

@app.post('/posts', response_model=schemas.PostOut)
def create_post(p: schemas.PostCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = crud.create_post(db, current_user.id, p.video_url, p.caption)
    return post

@app.post('/me/posts/upload', response_model=schemas.PostOut)
def upload_post(file: UploadFile = File(...), caption: str = Form(None), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    import uuid
    key = f"uploads/{uuid.uuid4().hex}-{file.filename}"
    storage.upload_fileobj(key, file.file, content_type=file.content_type)
    url = storage.public_url(key)
    post = crud.create_post(db, current_user.id, url, caption)
    post.processing_status = 'processing'
    db.add(post)
    db.commit()
    from .processing import process_and_upload
    import threading
    db_url = os.getenv('DATABASE_URL')
    t = threading.Thread(target=process_and_upload, args=(post.id, key, db_url, os.getenv('MINIO_ENDPOINT')))
    t.daemon = True
    t.start()
    db.refresh(post)
    return post

@app.patch('/posts/{post_id}', response_model=schemas.PostOut)
def update_post(post_id: int, payload: schemas.PostUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail='not_found')
    if post.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail='forbidden')
    if payload.caption is not None:
        post.caption = payload.caption
    db.commit()
    db.refresh(post)
    return post

@app.delete('/posts/{post_id}')
def delete_post(post_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail='not_found')
    if post.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail='forbidden')
    db.delete(post)
    db.commit()
    return {'ok': True}

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

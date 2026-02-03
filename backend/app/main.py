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
    with engine.connect() as conn:
        def column_exists(table, column):
            r = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name=:table AND column_name=:column"), {"table": table, "column": column})
            return r.first() is not None
        if not column_exists('posts', 'mp4_url'):
            conn.execute(text("ALTER TABLE posts ADD COLUMN mp4_url VARCHAR(1024)"))
        if not column_exists('posts', 'webm_url'):
            conn.execute(text("ALTER TABLE posts ADD COLUMN webm_url VARCHAR(1024)"))
        if not column_exists('posts', 'hls_url'):
            conn.execute(text("ALTER TABLE posts ADD COLUMN hls_url VARCHAR(1024)"))
        if not column_exists('posts', 'processing_status'):
            conn.execute(text("ALTER TABLE posts ADD COLUMN processing_status VARCHAR(50)"))
        if not column_exists('users', 'created_at'):
            conn.execute(text("ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ DEFAULT now()"))
        if not column_exists('likes', 'created_at'):
            conn.execute(text("ALTER TABLE likes ADD COLUMN created_at TIMESTAMPTZ DEFAULT now()"))
        if not column_exists('comments', 'created_at'):
            conn.execute(text("ALTER TABLE comments ADD COLUMN created_at TIMESTAMPTZ DEFAULT now()"))
        if not column_exists('reposts', 'created_at'):
            conn.execute(text("ALTER TABLE reposts ADD COLUMN created_at TIMESTAMPTZ DEFAULT now()"))
        if not column_exists('messages', 'created_at'):
            conn.execute(text("ALTER TABLE messages ADD COLUMN created_at TIMESTAMPTZ DEFAULT now()"))
    db = SessionLocal()
    try:
        admin_pass = os.getenv('ADMIN_PASSWORD', 'adminpass')
        from .auth import get_password_hash
        user1 = db.query(models.User).filter(models.User.id == 1).first()
        if user1:
            user1.username = 'admin'
            user1.password_hash = get_password_hash(admin_pass)
            db.commit()
        else:
            u = models.User(id=1, username='admin', password_hash=get_password_hash(admin_pass), country=None)
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
    return {'users': users, 'posts': posts}

@app.get('/api/admin/users')
def api_admin_users(db: Session = Depends(get_db), admin=Depends(admin_required)):
    users = db.query(models.User).all()
    return [{'id': u.id, 'username': u.username, 'country': u.country} for u in users]

@app.get('/api/admin/posts')
def api_admin_posts(db: Session = Depends(get_db), admin=Depends(admin_required)):
    posts = db.query(models.Post).all()
    return [{'id': p.id, 'owner': p.owner.username if p.owner else None, 'video_url': p.video_url, 'caption': p.caption} for p in posts]

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
    items = crud.get_comments(db)
    return [{'id': c.id, 'user_id': c.user_id, 'post_id': c.post_id, 'text': c.text} for c in items]

@app.get('/api/admin/likes')
def api_admin_likes(db: Session = Depends(get_db), admin=Depends(admin_required)):
    items = crud.get_likes(db)
    return [{'id': l.id, 'user_id': l.user_id, 'post_id': l.post_id} for l in items]

@app.get('/api/admin/reposts')
def api_admin_reposts(db: Session = Depends(get_db), admin=Depends(admin_required)):
    items = crud.get_reposts(db)
    return [{'id': r.id, 'user_id': r.user_id, 'post_id': r.post_id} for r in items]

from .crypto import decrypt

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
    user = crud.create_user(db, u.username, u.password, u.country)
    return user

@app.post('/auth/login')
def login(credentials: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, credentials.username)
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail='invalid_credentials')
    token = create_access_token({'sub': str(user.id)})
    return {'access_token': token, 'token_type': 'bearer'}

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

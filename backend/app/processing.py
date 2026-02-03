import subprocess
import os
import tempfile
from . import storage
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .database import Base
from .models import Post
from sqlalchemy.orm import Session

def process_and_upload(post_id: int, original_key: str, db_url: str, minio_endpoint: str):
    engine = create_engine(db_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db: Session = SessionLocal()
    tmpdir = tempfile.mkdtemp()
    try:
        infile = os.path.join(tmpdir, 'input')
        with open(infile, 'wb') as f:
            obj = storage.s3.get_object(Bucket=storage.bucket, Key=original_key)
            f.write(obj['Body'].read())
        mp4_out = os.path.join(tmpdir, 'out.mp4')
        webm_out = os.path.join(tmpdir, 'out.webm')
        hls_dir = os.path.join(tmpdir, 'hls')
        os.makedirs(hls_dir, exist_ok=True)
        subprocess.run(['ffmpeg', '-y', '-i', infile, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', mp4_out], check=True)
        subprocess.run(['ffmpeg', '-y', '-i', infile, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-c:a', 'libopus', webm_out], check=True)
        hls_playlist = os.path.join(tmpdir, 'out.m3u8')
        subprocess.run(['ffmpeg', '-y', '-i', infile, '-c:v', 'libx264', '-c:a', 'aac', '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod', hls_playlist], check=True)
        storage.upload_fileobj(f'processed/{post_id}/out.mp4', open(mp4_out, 'rb'), content_type='video/mp4')
        storage.upload_fileobj(f'processed/{post_id}/out.webm', open(webm_out, 'rb'), content_type='video/webm')
        for fname in os.listdir(tmpdir):
            if fname.endswith('.ts') or fname.endswith('.m3u8'):
                storage.upload_fileobj(f'processed/{post_id}/{fname}', open(os.path.join(tmpdir, fname), 'rb'), content_type='application/vnd.apple.mpegurl' if fname.endswith('.m3u8') else 'video/MP2T')
        mp4_url = storage.public_url(f'processed/{post_id}/out.mp4')
        webm_url = storage.public_url(f'processed/{post_id}/out.webm')
        hls_url = storage.public_url(f'processed/{post_id}/out.m3u8')
        post = db.query(Post).filter(Post.id == post_id).first()
        if post:
            post.mp4_url = mp4_url
            post.webm_url = webm_url
            post.hls_url = hls_url
            post.processing_status = 'done'
            db.commit()
    except Exception:
        post = db.query(Post).filter(Post.id == post_id).first()
        if post:
            post.processing_status = 'failed'
            db.commit()
    finally:
        db.close()
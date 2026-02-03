from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from passlib.hash import pbkdf2_sha256
import os

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
SECRET = os.getenv('JWT_SECRET', 'secret')
ALGORITHM = 'HS256'

def verify_password(plain, hashed):
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False

def get_password_hash(password):
    try:
        return pwd_context.hash(password)
    except Exception as e:
        raise Exception(f'Error hashing password: {str(e)}')

def create_access_token(data: dict, expires_delta: int = 60*24*7):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_delta)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET, algorithm=ALGORITHM)

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

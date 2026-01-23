from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
import os
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET = os.getenv('JWT_SECRET', 'secret')
ALGORITHM = 'HS256'

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def get_password_hash(password):
    return pwd_context.hash(password)

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

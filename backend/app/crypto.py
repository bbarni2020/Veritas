from cryptography.fernet import Fernet
import os
key = os.getenv('MESSAGE_KEY')
if not key:
    key = Fernet.generate_key().decode()
fernet = Fernet(key.encode())

def encrypt(text: str) -> str:
    return fernet.encrypt(text.encode()).decode()

def decrypt(token: str) -> str:
    return fernet.decrypt(token.encode()).decode()

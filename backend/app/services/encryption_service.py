import os
import base64
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

cipher_suite = None
if ENCRYPTION_KEY:
    try:
        cipher_suite = Fernet(ENCRYPTION_KEY.encode())
    except Exception:
        try:
            # Fallback: derive 32 url-safe base64 bytes if key is not properly formatted
            safe_key = base64.urlsafe_b64encode(ENCRYPTION_KEY.encode().ljust(32)[:32])
            cipher_suite = Fernet(safe_key)
        except Exception:
            cipher_suite = None

def encrypt_key(plaintext_key: str) -> str:
    if not plaintext_key:
        return ""
    if cipher_suite:
        try:
            return cipher_suite.encrypt(plaintext_key.encode()).decode()
        except Exception:
            return plaintext_key
    return plaintext_key

def decrypt_key(encrypted_key: str) -> str:
    if not encrypted_key:
        return ""
    if cipher_suite:
        try:
            return cipher_suite.decrypt(encrypted_key.encode()).decode()
        except Exception:
            return encrypted_key
    return encrypted_key
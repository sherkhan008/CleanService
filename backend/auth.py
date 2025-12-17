from datetime import datetime, timedelta, timezone
import os
from typing import Any, Dict, Optional, Callable

import pyotp
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models, schemas
from .database import get_db

# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY", "change_this_in_production_to_a_secure_random_value")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24h

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


#def get_password_hash(password: str) -> str:
 #   return pwd_context.hash(password)


#def verify_password(plain_password: str, hashed_password: str) -> bool:
  #  return pwd_context.verify(plain_password, hashed_password)

def _normalize_password(password: str) -> bytes:
    """
    Normalize password for bcrypt:
    - encode to UTF-8
    - truncate to 72 bytes (bcrypt limit)
    """
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    return password_bytes


def get_password_hash(password: str) -> str:
    password_bytes = _normalize_password(password)
    return pwd_context.hash(password_bytes)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = _normalize_password(plain_password)
    return pwd_context.verify(password_bytes, hashed_password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        if user_id is None:
            raise credentials_exception
        token_data = schemas.TokenData(user_id=int(user_id), role=role)
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    # Extend here if you add "is_active" or similar flags
    return current_user


def require_role(required_role: str) -> Callable:
    """
    Dependency factory to require a specific user role.
    """

    async def role_checker(user: models.User = Depends(get_current_user)) -> models.User:
        if user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return user

    return role_checker


def create_totp_secret() -> str:
    """
    Generate a new TOTP secret for a user.
    """
    return pyotp.random_base32()


def get_totp_uri(email: str, secret: str, issuer: str = "TazaBolsyn") -> str:
    """
    Generate an otpauth URI compatible with authenticator apps.
    """
    totp = new_totp(secret)
    return totp.provisioning_uri(name=email, issuer_name=issuer)


def new_totp(secret: str) -> pyotp.TOTP:
    """
    Create a TOTP instance from a secret.
    """
    return pyotp.TOTP(secret)


def verify_totp_code(secret: str, code: str) -> bool:
    """
    Verify a TOTP code for a given secret.
    Allows a small time window for clock drift.
    """
    totp = new_totp(secret)
    return totp.verify(code, valid_window=1)



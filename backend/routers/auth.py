from datetime import datetime, timedelta, timezone
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import (
    create_access_token,
    create_totp_secret,
    get_current_active_user,
    get_password_hash,
    verify_password,
    get_totp_uri,
    verify_totp_code,
)
from ..database import get_db
from ..email_service import send_password_reset_email

router = APIRouter()


def _user_to_schema(user: models.User) -> schemas.User:
    return schemas.User(
        id=user.id,
        name=user.name,
        surname=user.surname,
        email=user.email,
        role=user.role,
        city=user.city,
        reward_points=user.reward_points,
        totp_enabled=bool(user.totp_secret),
        addresses=[
            schemas.Address(
                id=addr.id,
                address=addr.address,
                apartment=addr.apartment,
            )
            for addr in user.addresses
        ],
    )


@router.post("/signup", response_model=schemas.Token)
def signup(payload: schemas.UserCreate, db: Session = Depends(get_db)) -> schemas.Token:
    """
    Register a new user.
    """
    if payload.password != payload.password_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        )

    user = models.User(
        name=payload.name,
        surname=payload.surname,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role="user",
        city=payload.city,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return schemas.Token(access_token=token, token_type="bearer", user=_user_to_schema(user))


@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)) -> schemas.Token:
    """
    Login with email, password, and optional TOTP code.
    If TOTP is enabled for the user, a valid TOTP code is required.
    """
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.totp_secret:
        # 2FA is enabled; require a valid TOTP code
        if not payload.totp_code:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="TOTP_REQUIRED",
            )
        if not verify_totp_code(user.totp_secret, payload.totp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="INVALID_TOTP",
            )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return schemas.Token(access_token=token, token_type="bearer", user=_user_to_schema(user))


@router.post("/request-reset")
def request_password_reset(
    payload: schemas.PasswordResetRequest, db: Session = Depends(get_db)
) -> dict:
    """
    Request a password reset code to be sent to the user's email.

    For production, integrate with an email/SMS provider.
    In this demo implementation, the code is stored in the database and
    NOT returned to the client (only logged on server side).
    """
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user:
        code = f"{random.randint(0, 999999):06d}"
        user.reset_code = code
        user.reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        db.add(user)
        db.commit()
        # Send password reset code via email
        send_password_reset_email(user.email, code)

    # Always respond with generic message to avoid leaking whether email exists
    return {"message": "If an account with that email exists, a reset code has been sent."}


@router.post("/reset")
def reset_password(
    payload: schemas.PasswordResetConfirm, db: Session = Depends(get_db)
) -> dict:
    """
    Reset password using a 6-digit code.
    """
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not user.reset_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset request",
        )

    if user.reset_code != payload.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset code",
        )

    if not user.reset_expires_at or user.reset_expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset code has expired",
        )

    user.password_hash = get_password_hash(payload.new_password)
    user.reset_code = None
    user.reset_expires_at = None
    db.add(user)
    db.commit()

    return {"message": "Password updated successfully."}


@router.post("/totp/setup")
def setup_totp(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Enable TOTP for the current user and return a secret + otpauth URI.

    The frontend can generate a QR code using the otpauth URI
    (e.g., with a QR code API) so that users can scan it with
    Google Authenticator, Authy, etc.
    """
    secret = create_totp_secret()
    current_user.totp_secret = secret
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    otpauth_url = get_totp_uri(current_user.email, secret)
    return {
        "secret": secret,
        "otpauth_url": otpauth_url,
        "message": "TOTP enabled. Scan the QR code in your authenticator app.",
    }



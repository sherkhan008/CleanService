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
from ..utils.qr import qr_png_base64
from ..utils.rate_limit import rate_limit

router = APIRouter()


def _user_to_schema(user: models.User) -> schemas.User:
    return schemas.User(
        id=user.id,
        name=user.name,
        surname=user.surname,
        email=user.email,
        phone=user.phone,
        role=user.role,
        city=user.city,
        reward_points=user.reward_points,
        totp_enabled=bool(user.is_totp_enabled and user.totp_secret),
        totp_setup_pending=bool(user.totp_secret and not user.is_totp_enabled),
        addresses=[
            schemas.Address(
                id=addr.id,
                address=addr.address,
                apartment=addr.apartment,
                latitude=addr.latitude,
                longitude=addr.longitude,
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


@router.post(
    "/login",
    response_model=schemas.Token,
    dependencies=[Depends(rate_limit("auth:login", limit=8, window_seconds=60))],
)
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

    if user.is_totp_enabled and user.totp_secret:
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


@router.post(
    "/request-reset",
    dependencies=[Depends(rate_limit("auth:request-reset", limit=5, window_seconds=300))],
)
def request_password_reset(
    payload: schemas.PasswordResetRequest, db: Session = Depends(get_db)
) -> dict:
    """
    Request a password reset code to be sent to the user's email.

    For production, integrate with an email/SMS provider.
    In this demo implementation, the code is stored in the database and
    NOT returned to the client.
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


@router.post(
    "/reset",
    dependencies=[Depends(rate_limit("auth:reset", limit=8, window_seconds=300))],
)
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
    now = datetime.now(timezone.utc)
    reset_expires_at = user.reset_expires_at
    if reset_expires_at is not None and reset_expires_at.tzinfo is None:
        reset_expires_at = reset_expires_at.replace(tzinfo=timezone.utc)
    #if not user.reset_expires_at or user.reset_expires_at < datetime.now(timezone.utc):
    if not reset_expires_at or reset_expires_at < now:
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


@router.post(
    "/totp/setup",
    dependencies=[Depends(rate_limit("auth:totp-setup", limit=3, window_seconds=300))],
)
def setup_totp(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Start TOTP setup for the current user and return a QR code (base64 PNG).
    2FA is only marked enabled after successful verification.
    The QR code is returned only once during activation.
    """
    if current_user.is_totp_enabled and current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP_ALREADY_ENABLED",
        )
    if current_user.totp_secret and not current_user.is_totp_enabled:
        # Setup already initiated; do not return QR again.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="TOTP_SETUP_PENDING",
        )

    secret = create_totp_secret()
    current_user.totp_secret = secret
    current_user.is_totp_enabled = False
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    otpauth_url = get_totp_uri(current_user.email, secret)
    qr_b64 = qr_png_base64(otpauth_url)
    return schemas.TotpSetupResponse(
        qr_code_base64=qr_b64,
        message="Scan the QR code in your authenticator app, then enter the 6-digit code to finish setup.",
    ).dict()


@router.post(
    "/totp/verify",
    response_model=schemas.TotpVerifyResponse,
    dependencies=[Depends(rate_limit("auth:totp-verify", limit=12, window_seconds=300))],
)
def verify_totp_setup(
    payload: schemas.TotpVerifyRequest,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> schemas.TotpVerifyResponse:
    """
    Verify a TOTP code and enable 2FA for the current user.
    """
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP_NOT_SETUP",
        )
    if current_user.is_totp_enabled:
        return schemas.TotpVerifyResponse(
            totp_enabled=True,
            message="Two-factor authentication is already enabled.",
        )
    if not verify_totp_code(current_user.totp_secret, payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_TOTP",
        )

    current_user.is_totp_enabled = True
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return schemas.TotpVerifyResponse(
        totp_enabled=True,
        message="Two-factor authentication has been enabled successfully.",
    )



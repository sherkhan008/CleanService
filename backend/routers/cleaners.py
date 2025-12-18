from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_active_user, require_role
from ..database import get_db
from ..auth import create_access_token, get_password_hash, verify_password, verify_totp_code

router = APIRouter()

ALLOWED_STATUSES = ["pending", "accepted", "going", "started", "finished", "paid"]
ACTIVE_STATUSES = {"accepted", "going", "started"}


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


def _order_to_schema(order: models.Order) -> schemas.Order:
    return schemas.Order(
        id=order.id,
        user_id=order.user_id,
        cleaner_id=order.cleaner_id,
        status=order.status,
        total_price=order.total_price,
        created_at=order.created_at,
        property_type=order.property_type,
        rooms=order.rooms,
        bathrooms=order.bathrooms,
        cleaning_type=order.cleaning_type,
        address=order.address,
        apartment=order.apartment,
        city=order.city,
        phone=order.phone,
        latitude=order.latitude,
        longitude=order.longitude,
        items=[
            schemas.OrderItem(
                id=i.id,
                service_name=i.service_name,
                quantity=i.quantity,
                price=i.price,
            )
            for i in order.items
        ],
    )


@router.post("/signup", response_model=schemas.Token)
def cleaner_signup(payload: schemas.CleanerSignupRequest, db: Session = Depends(get_db)) -> schemas.Token:
    """
    Self-registration for cleaners (phone is mandatory).
    Creates a user with role=cleaner and a Cleaner profile.
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
        phone=payload.phone,
        password_hash=get_password_hash(payload.password),
        role="cleaner",
        city=payload.city,
    )
    db.add(user)
    db.flush()  # get user.id
    cleaner = models.Cleaner(user_id=user.id, availability=True)
    db.add(cleaner)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return schemas.Token(access_token=token, token_type="bearer", user=_user_to_schema(user))


@router.post("/login", response_model=schemas.Token)
def cleaner_login(payload: schemas.CleanerLoginRequest, db: Session = Depends(get_db)) -> schemas.Token:
    """
    Cleaner login with email+password and optional TOTP.
    Ensures the account role is 'cleaner'.
    """
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if user.role != "cleaner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="NOT_A_CLEANER")

    if user.is_totp_enabled and user.totp_secret:
        if not payload.totp_code:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="TOTP_REQUIRED")
        if not verify_totp_code(user.totp_secret, payload.totp_code):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_TOTP")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return schemas.Token(access_token=token, token_type="bearer", user=_user_to_schema(user))


@router.get("/orders/available", response_model=List[schemas.Order])
def list_available_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("cleaner")),
) -> List[schemas.Order]:
    """
    List customer orders that are not assigned to any cleaner yet.
    """
    orders = (
        db.query(models.Order)
        .filter(models.Order.cleaner_id.is_(None), models.Order.status == "pending")
        .order_by(models.Order.created_at.desc())
        .all()
    )
    return [_order_to_schema(o) for o in orders]


@router.post("/orders/{order_id}/take", response_model=schemas.Order)
def take_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("cleaner")),
) -> schemas.Order:
    """
    Take an available order.
    Business rule: a cleaner can have only one active order at a time.
    """
    active = (
        db.query(models.Order)
        .filter(models.Order.cleaner_id == current_user.id, models.Order.status.in_(list(ACTIVE_STATUSES)))
        .first()
    )
    if active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CLEANER_HAS_ACTIVE_ORDER",
        )

    order = (
        db.query(models.Order)
        .filter(models.Order.id == order_id, models.Order.cleaner_id.is_(None), models.Order.status == "pending")
        .first()
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not available")

    order.cleaner_id = current_user.id
    order.status = "accepted"

    # mark cleaner unavailable
    cleaner_profile = db.query(models.Cleaner).filter(models.Cleaner.user_id == current_user.id).first()
    if cleaner_profile:
        cleaner_profile.availability = False
        db.add(cleaner_profile)

    db.add(order)
    db.commit()
    db.refresh(order)
    return _order_to_schema(order)


@router.get("/orders", response_model=List[schemas.Order])
def list_assigned_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("cleaner")),
) -> List[schemas.Order]:
    """
    List orders assigned to the current cleaner.
    """
    orders = (
        db.query(models.Order)
        .filter(models.Order.cleaner_id == current_user.id)
        .order_by(models.Order.created_at.desc())
        .all()
    )
    return [_order_to_schema(o) for o in orders]


@router.patch("/orders/{order_id}/status", response_model=schemas.Order)
def update_order_status(
    order_id: int,
    payload: schemas.StatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("cleaner")),
) -> schemas.Order:
    """
    Update the status of an assigned order.
    Allowed statuses: pending, accepted, going, started, finished, paid.
    """
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Allowed: {', '.join(ALLOWED_STATUSES)}",
        )

    order = (
        db.query(models.Order)
        .filter(models.Order.id == order_id, models.Order.cleaner_id == current_user.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Enforce a simple forward-only flow for real tracking.
    allowed_next = {
        "accepted": {"going"},
        "going": {"started"},
        "started": {"finished"},
        "finished": set(),
        "paid": set(),
        "pending": {"accepted"},  # shouldn't happen for assigned cleaner, but keep safe
    }
    current = order.status
    if payload.status != current:
        if payload.status not in allowed_next.get(current, set()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"INVALID_STATUS_TRANSITION:{current}->{payload.status}",
            )

    order.status = payload.status
    db.add(order)

    # If finished, mark cleaner available (as long as no other active orders exist).
    if payload.status == "finished":
        other_active = (
            db.query(models.Order)
            .filter(models.Order.cleaner_id == current_user.id, models.Order.status.in_(list(ACTIVE_STATUSES)))
            .first()
        )
        if not other_active:
            cleaner_profile = db.query(models.Cleaner).filter(models.Cleaner.user_id == current_user.id).first()
            if cleaner_profile:
                cleaner_profile.availability = True
                db.add(cleaner_profile)

    db.commit()
    db.refresh(order)
    return _order_to_schema(order)




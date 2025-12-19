from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_role, get_password_hash
from ..database import get_db

router = APIRouter()


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


@router.get("/users", response_model=List[schemas.User])
def list_users(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role("admin")),
) -> List[schemas.User]:
    """
    List all users (admin only).
    """
    users = db.query(models.User).all()
    return [
        schemas.User(
            id=u.id,
            name=u.name,
            surname=u.surname,
            email=u.email,
            phone=u.phone,
            role=u.role,
            city=u.city,
            reward_points=u.reward_points,
            totp_enabled=bool(u.is_totp_enabled and u.totp_secret),
            totp_setup_pending=bool(u.totp_secret and not u.is_totp_enabled),
            addresses=[
                schemas.Address(
                    id=a.id,
                    address=a.address,
                    apartment=a.apartment,
                    latitude=a.latitude,
                    longitude=a.longitude,
                )
                for a in u.addresses
            ],
        )
        for u in users
    ]


@router.post("/cleaners", response_model=schemas.Cleaner, status_code=status.HTTP_201_CREATED)
def create_cleaner(
    payload: schemas.CleanerCreate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role("admin")),
) -> schemas.Cleaner:
    """
    Promote an existing user to a cleaner and create a Cleaner profile.
    """
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.cleaner_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cleaner profile already exists for this user",
        )

    user.role = "cleaner"
    cleaner = models.Cleaner(user_id=user.id, availability=payload.availability)
    db.add(user)
    db.add(cleaner)
    db.commit()
    db.refresh(cleaner)

    return schemas.Cleaner(
        id=cleaner.id,
        user_id=cleaner.user_id,
        availability=cleaner.availability,
        user=schemas.User(
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
                    id=a.id,
                    address=a.address,
                    apartment=a.apartment,
                    latitude=a.latitude,
                    longitude=a.longitude,
                )
                for a in user.addresses
            ],
        ),
    )


@router.post(
    "/cleaners/create-account",
    response_model=schemas.Cleaner,
    status_code=status.HTTP_201_CREATED,
)
def create_cleaner_account(
    payload: schemas.CleanerAccountCreate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role("admin")),
) -> schemas.Cleaner:
    """
    Create a new cleaner account (admin only).
    """
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
    db.refresh(cleaner)

    return schemas.Cleaner(
        id=cleaner.id,
        user_id=cleaner.user_id,
        availability=cleaner.availability,
        user=schemas.User(
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
                    id=a.id,
                    address=a.address,
                    apartment=a.apartment,
                    latitude=a.latitude,
                    longitude=a.longitude,
                )
                for a in user.addresses
            ],
        ),
    )


@router.get("/cleaners", response_model=List[schemas.Cleaner])
def list_cleaners(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role("admin")),
) -> List[schemas.Cleaner]:
    """
    List all cleaners with their user info.
    """
    cleaners = db.query(models.Cleaner).all()
    return [
        schemas.Cleaner(
            id=c.id,
            user_id=c.user_id,
            availability=c.availability,
            user=schemas.User(
                id=c.user.id,
                name=c.user.name,
                surname=c.user.surname,
                email=c.user.email,
                phone=c.user.phone,
                role=c.user.role,
                city=c.user.city,
                reward_points=c.user.reward_points,
                totp_enabled=bool(c.user.is_totp_enabled and c.user.totp_secret),
                totp_setup_pending=bool(c.user.totp_secret and not c.user.is_totp_enabled),
                addresses=[
                    schemas.Address(
                        id=a.id,
                        address=a.address,
                        apartment=a.apartment,
                        latitude=a.latitude,
                        longitude=a.longitude,
                    )
                    for a in c.user.addresses
                ],
            ),
        )
        for c in cleaners
    ]


@router.get("/orders", response_model=List[schemas.Order])
def list_orders(
    status_filter: Optional[str] = Query(default=None, description="Filter by order status"),
    city: Optional[str] = Query(default=None, description="Filter by city"),
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role("admin")),
) -> List[schemas.Order]:
    """
    List all orders with optional filtering (admin only).
    """
    query = db.query(models.Order)
    if status_filter:
        query = query.filter(models.Order.status == status_filter)
    if city:
        query = query.filter(models.Order.city == city)

    orders = query.order_by(models.Order.created_at.desc()).all()
    return [_order_to_schema(o) for o in orders]


@router.patch("/orders/{order_id}", response_model=schemas.Order)
def update_order_admin(
    order_id: int,
    payload: schemas.AdminUpdateOrder,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role("admin")),
) -> schemas.Order:
    """
    Update order status and/or assign a cleaner (admin only).
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if payload.status is not None:
        order.status = payload.status

    if payload.cleaner_id is not None:
        cleaner_user = db.query(models.User).filter(models.User.id == payload.cleaner_id).first()
        if not cleaner_user or cleaner_user.role != "cleaner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cleaner user not found or not a cleaner",
            )
        order.cleaner_id = cleaner_user.id

    db.add(order)
    db.commit()
    db.refresh(order)
    return _order_to_schema(order)


@router.get("/feedbacks", response_model=List[schemas.Feedback])
def list_feedbacks(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_role("admin")),
) -> List[schemas.Feedback]:
    """
    List all feedbacks (admin only).
    """
    feedbacks = db.query(models.Feedback).order_by(models.Feedback.created_at.desc()).all()
    return [
        schemas.Feedback(
            id=f.id,
            order_id=f.order_id,
            user_id=f.user_id,
            comment=f.comment,
            rating=f.rating,
            created_at=f.created_at,
            user=schemas.UserBase(
                name=f.user.name,
                surname=f.user.surname,
                email=f.user.email,
                phone=f.user.phone,
                city=f.user.city,
            ) if f.user else None,
        )
        for f in feedbacks
    ]




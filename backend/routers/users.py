from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_active_user
from ..database import get_db

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


@router.get("/me", response_model=schemas.User)
def read_me(
    current_user: models.User = Depends(get_current_active_user),
) -> schemas.User:
    """
    Get current authenticated user profile, including addresses and reward points.
    """
    return _user_to_schema(current_user)


@router.put("/me", response_model=schemas.User)
def update_me(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
) -> schemas.User:
    """
    Update the current user's profile (name, surname, city).
    """
    if payload.name is not None:
        current_user.name = payload.name
    if payload.surname is not None:
        current_user.surname = payload.surname
    if payload.phone is not None:
        current_user.phone = payload.phone
    if payload.city is not None:
        current_user.city = payload.city

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return _user_to_schema(current_user)


@router.get("/me/addresses", response_model=List[schemas.Address])
def list_my_addresses(
    current_user: models.User = Depends(get_current_active_user),
) -> List[schemas.Address]:
    """
    List saved addresses for the current user.
    """
    return [
        schemas.Address(
            id=a.id,
            address=a.address,
            apartment=a.apartment,
            latitude=a.latitude,
            longitude=a.longitude,
        )
        for a in current_user.addresses
    ]


@router.post("/me/addresses", response_model=schemas.Address, status_code=status.HTTP_201_CREATED)
def add_address(
    payload: schemas.AddressCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
) -> schemas.Address:
    """
    Add a new saved address for the current user.
    """
    addr = models.Address(
        user_id=current_user.id,
        address=payload.address,
        apartment=payload.apartment,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(addr)
    db.commit()
    db.refresh(addr)
    return schemas.Address(
        id=addr.id,
        address=addr.address,
        apartment=addr.apartment,
        latitude=addr.latitude,
        longitude=addr.longitude,
    )


@router.delete("/me/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
) -> None:
    """
    Delete one of the current user's saved addresses.
    """
    addr = (
        db.query(models.Address)
        .filter(models.Address.id == address_id, models.Address.user_id == current_user.id)
        .first()
    )
    if not addr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    db.delete(addr)
    db.commit()


@router.get("/me/orders", response_model=List[schemas.Order])
def list_my_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
) -> List[schemas.Order]:
    """
    Get order history for the current user.
    """
    orders = (
        db.query(models.Order)
            .filter(models.Order.user_id == current_user.id)
            .order_by(models.Order.created_at.desc())
            .all()
    )
    return [
        schemas.Order(
            id=o.id,
            user_id=o.user_id,
            cleaner_id=o.cleaner_id,
            status=o.status,
            total_price=o.total_price,
            created_at=o.created_at,
            property_type=o.property_type,
            rooms=o.rooms,
            bathrooms=o.bathrooms,
            cleaning_type=o.cleaning_type,
            address=o.address,
            apartment=o.apartment,
            city=o.city,
            phone=o.phone,
            items=[
                schemas.OrderItem(
                    id=i.id,
                    service_name=i.service_name,
                    quantity=i.quantity,
                    price=i.price,
                )
                for i in o.items
            ],
        )
        for o in orders
    ]


@router.post("/me/feedback", response_model=schemas.Feedback, status_code=status.HTTP_201_CREATED)
def create_feedback(
    payload: schemas.FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
) -> schemas.Feedback:
    """
    Create feedback for a completed order.
    """
    # Verify order belongs to user and is completed
    order = db.query(models.Order).filter(
        models.Order.id == payload.order_id,
        models.Order.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found or does not belong to you"
        )
    
    if order.status not in ["finished", "paid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback can only be submitted for completed orders (finished or paid)"
        )
    
    # Check if feedback already exists
    existing = db.query(models.Feedback).filter(
        models.Feedback.order_id == payload.order_id,
        models.Feedback.user_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback already submitted for this order"
        )
    
    feedback = models.Feedback(
        order_id=payload.order_id,
        user_id=current_user.id,
        comment=payload.comment,
        rating=payload.rating,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    
    return schemas.Feedback(
        id=feedback.id,
        order_id=feedback.order_id,
        user_id=feedback.user_id,
        comment=feedback.comment,
        rating=feedback.rating,
        created_at=feedback.created_at,
        user=schemas.UserBase(
            name=current_user.name,
            surname=current_user.surname,
            email=current_user.email,
            phone=current_user.phone,
            city=current_user.city,
        ),
    )




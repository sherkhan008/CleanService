from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_active_user
from ..database import get_db

router = APIRouter()


@router.post("/", response_model=schemas.Order, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
) -> schemas.Order:
    """
    Create a new cleaning order for the current user.
    Total price is calculated from the provided items.
    City-based pricing is already applied in frontend, so we use the prices as-is.
    """
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one service must be selected.",
        )

    # Prices are already adjusted by city in frontend, so we use them directly
    total_price = sum(i.price * i.quantity for i in payload.items)
    order = models.Order(
        user_id=current_user.id,
        cleaner_id=None,
        status="pending",
        total_price=total_price,
        property_type=payload.property_type,
        rooms=payload.rooms,
        bathrooms=payload.bathrooms,
        cleaning_type=payload.cleaning_type,
        address=payload.address,
        apartment=payload.apartment,
        city=payload.city or current_user.city,
        phone=payload.phone,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(order)
    db.flush()  # get order.id

    for item in payload.items:
        db_item = models.OrderItem(
            order_id=order.id,
            service_name=item.service_name,
            quantity=item.quantity,
            price=item.price,
        )
        db.add(db_item)

    # Simple reward points: 1 point per 1000₸
    points_earned = int(total_price // 1000)
    current_user.reward_points = (current_user.reward_points or 0) + points_earned

    db.add(current_user)
    db.commit()
    db.refresh(order)

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


@router.get("/me", response_model=List[schemas.Order])
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
            latitude=o.latitude,
            longitude=o.longitude,
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




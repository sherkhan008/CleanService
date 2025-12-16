from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_active_user, require_role
from ..database import get_db

router = APIRouter()

ALLOWED_STATUSES = ["pending", "accepted", "going", "started", "finished", "paid"]


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

    order.status = payload.status
    db.add(order)
    db.commit()
    db.refresh(order)
    return _order_to_schema(order)



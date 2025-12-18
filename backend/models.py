from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=True)
    surname = Column(String(100), nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False)  # user | cleaner | admin
    totp_secret = Column(String(64), nullable=True)
    is_totp_enabled = Column(Boolean, default=False, nullable=False)
    city = Column(String(120), nullable=True)
    reward_points = Column(Integer, default=0, nullable=False)
    reset_code = Column(String(6), nullable=True)
    reset_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    addresses = relationship(
        "Address", back_populates="user", cascade="all, delete-orphan"
    )
    # Use primaryjoin to explicitly specify which foreign key to use (resolves ambiguity with cleaner_id)
    # Since Order has both user_id and cleaner_id pointing to User.id, we need to be explicit
    orders = relationship(
        "Order",
        primaryjoin="User.id == Order.user_id",
        back_populates="user"
    )
    cleaner_profile = relationship("Cleaner", uselist=False, back_populates="user")


class Address(Base):
    __tablename__ = "addresses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    address = Column(String(255), nullable=False)
    apartment = Column(String(50), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    user = relationship("User", back_populates="addresses")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cleaner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    status = Column(
        String(50), nullable=False, default="pending"
    )  # pending, accepted, going, started, finished, paid
    total_price = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Order details
    property_type = Column(String(50), nullable=True)  # Apartment / Private House
    rooms = Column(Integer, nullable=True)
    bathrooms = Column(Integer, nullable=True)
    cleaning_type = Column(String(50), nullable=True)  # Standard, etc.
    address = Column(String(255), nullable=False)
    apartment = Column(String(50), nullable=True)
    city = Column(String(120), nullable=True)
    phone = Column(String(50), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="orders")
    cleaner = relationship("User", foreign_keys=[cleaner_id])
    items = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    service_name = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Float, nullable=False)  # price per unit

    order = relationship("Order", back_populates="items")


class Cleaner(Base):
    __tablename__ = "cleaners"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    availability = Column(Boolean, default=True, nullable=False)

    user = relationship("User", back_populates="cleaner_profile")



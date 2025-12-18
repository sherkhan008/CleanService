from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


# Shared / nested schemas



class AddressBase(BaseModel):
    address: str = Field(..., max_length=255)
    apartment: Optional[str] = Field(default=None, max_length=50)
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AddressCreate(AddressBase):
    pass


class Address(AddressBase):
    id: int

    class Config:
        # pydantic v1 style
        orm_mode = True


class OrderItemBase(BaseModel):
    service_name: str
    quantity: int = Field(..., ge=1)
    price: float = Field(..., ge=0)


class OrderItemCreate(OrderItemBase):
    pass


class OrderItem(OrderItemBase):
    id: int

    class Config:
        orm_mode = True


class OrderBase(BaseModel):
    property_type: Optional[str] = None
    rooms: Optional[int] = Field(default=None, ge=0)
    bathrooms: Optional[int] = Field(default=None, ge=0)
    cleaning_type: Optional[str] = None
    address: str
    apartment: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class OrderCreate(OrderBase):
    items: List[OrderItemCreate]


class Order(OrderBase):
    id: int
    user_id: int
    cleaner_id: Optional[int] = None
    status: str
    total_price: float
    created_at: datetime
    items: List[OrderItem] = []

    class Config:
        orm_mode = True


class UserBase(BaseModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    email: EmailStr
    city: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    password_confirm: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    city: Optional[str] = None


class User(UserBase):
    id: int
    role: str
    reward_points: int = 0
    totp_enabled: bool = False
    totp_setup_pending: bool = False
    addresses: List[Address] = []

    class Config:
        orm_mode = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: User


class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, regex=r"^\d{6}$")
    new_password: str = Field(..., min_length=8)


class CleanerBase(BaseModel):
    availability: Optional[bool] = True


class CleanerCreate(CleanerBase):
    user_id: int


class CleanerAccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    surname: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    city: Optional[str] = None


class TotpSetupResponse(BaseModel):
    qr_code_base64: str
    message: str


class TotpVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class TotpVerifyResponse(BaseModel):
    totp_enabled: bool
    message: str


class Cleaner(CleanerBase):
    id: int
    user_id: int
    user: Optional[User] = None

    class Config:
        orm_mode = True


class AdminUpdateOrder(BaseModel):
    status: Optional[str] = None
    cleaner_id: Optional[int] = None


class StatusUpdate(BaseModel):
    status: str



from pathlib import Path
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

# Load environment variables from .env file (if present)
load_dotenv()

# IMPORTANT: use package-relative import so `backend` works as a package
from .database import Base, engine, SessionLocal
from .utils.db_migrations import apply_sqlite_migrations
from .routers import auth as auth_router
from .routers import users as users_router
from .routers import orders as orders_router
from .routers import cleaners as cleaners_router
from .routers import admin as admin_router
from . import models
from .auth import get_password_hash

# Create database tables (for development / simple deployments).
# In production, prefer using Alembic migrations.
Base.metadata.create_all(bind=engine)
apply_sqlite_migrations(engine)

# Seed admin account if it doesn't exist
def seed_admin_account():
    """Create default admin account if it doesn't exist."""
    db: Session = SessionLocal()
    try:
        admin_email = os.getenv("ADMIN_EMAIL", "admin@tazabolsyn.com")
        admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
        
        existing_admin = db.query(models.User).filter(
            models.User.email == admin_email
        ).first()
        
        if not existing_admin:
            admin_user = models.User(
                name="Admin",
                surname="User",
                email=admin_email,
                password_hash=get_password_hash(admin_password),
                role="admin",
            )
            db.add(admin_user)
            db.commit()
            print(f"✓ Admin account created: {admin_email} / {admin_password}")
        else:
            print(f"✓ Admin account already exists: {admin_email}")
    except Exception as e:
        print(f"✗ Error seeding admin account: {e}")
        db.rollback()
    finally:
        db.close()

seed_admin_account()

app = FastAPI(title="TazaBolsyn API", version="1.0.0")

# CORS configuration - adjust origins for your frontend URLs
origins = [
    "http://localhost",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static frontend (optional; you can also serve via a separate static server)
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")


@app.get("/", tags=["health"])
def read_root():
    return {"message": "TazaBolsyn API is running"}


# Routers
app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(users_router.router, prefix="/users", tags=["users"])
app.include_router(orders_router.router, prefix="/orders", tags=["orders"])
app.include_router(cleaners_router.router, prefix="/cleaner", tags=["cleaner"])
app.include_router(admin_router.router, prefix="/admin", tags=["admin"])



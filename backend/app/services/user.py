"""Thin UserService for creating and fetching users."""
from sqlalchemy.orm import Session

from app.core.auth import hash_password
from app.models.user import User


class UserService:
    @staticmethod
    def get_by_email(db: Session, email: str) -> User | None:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def create(db: Session, email: str, password: str) -> User:
        user = User(email=email, password_hash=hash_password(password))
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

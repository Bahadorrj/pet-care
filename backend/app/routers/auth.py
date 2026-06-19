from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import _DUMMY_PASSWORD_HASH, create_access_token, current_user, verify_password
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import ChangeUsernameRequest, LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.services.user import EmailAlreadyRegisteredError, UsernameAlreadyRegisteredError, UsernameTakenError, UserService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201, response_model=TokenResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await UserService.create(db, email=body.email, password=body.password, username=body.username)
    except EmailAlreadyRegisteredError:
        raise HTTPException(status_code=400, detail="email_already_registered")
    except UsernameAlreadyRegisteredError:
        raise HTTPException(status_code=400, detail="username_already_registered")
    return TokenResponse(access_token=create_access_token(user.id), username=user.username, email=user.email)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await UserService.get_by_email(db, body.email)
    candidate_hash = user.password_hash if user is not None else _DUMMY_PASSWORD_HASH
    password_ok = verify_password(body.password, candidate_hash)
    if user is None or not password_ok:
        raise HTTPException(status_code=401, detail="invalid_credentials")
    return TokenResponse(access_token=create_access_token(user.id), username=user.username, email=user.email)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(current_user)):
    return UserResponse(id=user.id, email=user.email, username=user.username)


@router.patch("/me", response_model=UserResponse)
async def change_username(
    body: ChangeUsernameRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    try:
        user = await UserService.change_username(db, user, body.username)
    except UsernameTakenError:
        raise HTTPException(status_code=409, detail="username_taken")
    return UserResponse(id=user.id, email=user.email, username=user.username)

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=8, max_length=72)
    username: str = Field(pattern=r"^[a-zA-Z0-9_]{3,30}$")

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("username", mode="after")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        return v.lower()


class LoginRequest(BaseModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(max_length=72)

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    email: EmailStr


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    username: str

    model_config = ConfigDict(from_attributes=True)

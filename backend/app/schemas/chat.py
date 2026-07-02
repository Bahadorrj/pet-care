import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

BUNDLE_MAX_BYTES = 8192


class PetTaskSummary(BaseModel):
    type: str = Field(max_length=20)
    title: str | None = Field(default=None, max_length=100)
    scheduleText: str = Field(max_length=100)
    adherence7d: str | None = Field(default=None, max_length=10)


class PetContext(BaseModel):
    name: str = Field(max_length=50)
    species: str = Field(max_length=20)
    speciesOther: str | None = Field(default=None, max_length=50)
    gender: str | None = Field(default=None, max_length=10)
    breed: str | None = Field(default=None, max_length=50)
    weight: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=500)
    tasks: list[PetTaskSummary] = Field(default_factory=list, max_length=30)


class PetContextBundle(BaseModel):
    pets: list[PetContext] = Field(max_length=20)
    scope: Literal["selected", "all"]
    todayJalali: str = Field(max_length=20)

    @model_validator(mode="after")
    def size_cap(self) -> "PetContextBundle":
        if len(self.model_dump_json().encode()) > BUNDLE_MAX_BYTES:
            raise ValueError("context bundle exceeds 8 KB")
        return self


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    context: PetContextBundle


class RetryRequest(BaseModel):
    context: PetContextBundle


class ConversationResponse(BaseModel):
    id: str
    title: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    interrupted: bool
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

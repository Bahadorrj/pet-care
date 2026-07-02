import pytest
from pydantic import ValidationError

from app.models.chat import Message
from app.schemas.chat import PetContext, PetContextBundle, SendMessageRequest
from app.services.prompt import build_messages

BUNDLE = PetContextBundle(
    pets=[PetContext(name="پیشی", species="cat")],
    scope="all",
    todayJalali="۱۴۰۵/۰۴/۱۱",
)


def test_build_messages_shape():
    history = [
        Message(role="user", content="سلام"),
        Message(role="assistant", content="سلام! چطور می‌تونم کمک کنم؟"),
    ]
    msgs = build_messages(BUNDLE, history)
    assert msgs[0]["role"] == "system"
    assert "<pet_data>" in msgs[0]["content"] and "</pet_data>" in msgs[0]["content"]
    assert "پیشی" in msgs[0]["content"]
    assert "۱۴۰۵/۰۴/۱۱" in msgs[0]["content"]
    assert msgs[1] == {"role": "user", "content": "سلام"}
    assert msgs[2]["role"] == "assistant"
    assert len(msgs) == 3


def test_content_length_capped():
    with pytest.raises(ValidationError):
        SendMessageRequest(content="x" * 4001, context=BUNDLE)
    with pytest.raises(ValidationError):
        SendMessageRequest(content="", context=BUNDLE)


def test_bundle_size_capped():
    with pytest.raises(ValidationError):
        PetContextBundle(
            pets=[PetContext(name="a", species="cat", notes="ن" * 500)] * 20,
            scope="all",
            todayJalali="۱۴۰۵/۰۴/۱۱",
        )

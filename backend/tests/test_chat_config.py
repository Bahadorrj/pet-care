from app.core.config import settings


def test_llm_settings_defaults():
    assert settings.OPENROUTER_API_KEY == ""
    assert settings.LLM_MODEL == "google/gemini-2.5-flash"
    assert settings.LLM_MAX_OUTPUT_TOKENS == 1024

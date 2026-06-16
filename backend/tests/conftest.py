import os

# Must be set before any app module is imported so pydantic-settings can read it.
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")

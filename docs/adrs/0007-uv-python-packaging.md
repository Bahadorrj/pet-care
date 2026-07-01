# ADR-0007: `uv` for Python packaging and environments

## Status
Accepted

## Date
2026-06-17

> **Diverges from the spec.** `docs/specs/00-initial-prd.md` and
> `docs/specs/01-foundation-layer.md` originally specified
> `pip install -r requirements.txt`. This ADR records the move to `uv` with
> `pyproject.toml` + `uv.lock` and supersedes that workflow. The specs have been
> reconciled to point here.

## Context
The backend originally documented a `requirements.txt` + `pip` workflow with no
lockfile, so installs were not reproducible and dependency resolution was slow.
A single developer wants fast, reproducible environments without managing venvs
by hand.

## Decision
Use **`uv`** for dependency management and environments:
- Dependencies declared in `pyproject.toml` (`[project].dependencies`), dev tools
  in `[dependency-groups].dev`.
- `uv.lock` is committed for reproducible installs.
- `package = false` (`[tool.uv]`) — the backend is an application, not a
  distributable package.
- `run.py` is the entry script for running the dev server.

## Alternatives Considered

### pip + requirements.txt (original spec workflow)
- Pros: Universally understood.
- Cons: No lockfile by default; slow resolution; manual venv management.
- Rejected: Reproducibility and speed wins from `uv` are worth the switch.

### Poetry / PDM
- Pros: Mature `pyproject.toml` workflows with lockfiles.
- Cons: Slower than `uv`; `uv` covers the same ground faster with one tool.
- Rejected: `uv` is the faster, simpler choice for a solo dev.

## Consequences
- `uv sync` produces an identical environment from the committed lock.
- Commands change: use `uv run ...` / `uv sync` instead of `pip install` +
  `uvicorn ...` directly.
- There is no `requirements.txt`; `pyproject.toml` is the source of truth.

## Guardrails

**Always**
- Manage dependencies through `uv` and `pyproject.toml`; commit `uv.lock`.
- Add deps with `uv add` (runtime) / `uv add --dev` (tooling), not by hand-editing
  unless intentional.

**Ask first**
- Before switching package managers again, or before publishing the backend as a
  package (would flip `package = false`).

**Never**
- Never reintroduce `requirements.txt` or a `pip install` workflow as the source
  of truth.
- Never commit changes to `pyproject.toml` without the updated `uv.lock`.

# Spec: PetCare – Farsi-First Mobile Pet Care Application

## Objective

Build a Farsi-first Android mobile application that prevents the "I didn't know" moment for
Persian-speaking pet owners — the regret of losing a pet to a hazard or symptom that wasn't
recognized in time.

**Target users:** Persian-speaking cat and dog owners in Iran, especially new pet owners.
**Core problem:** Knowledge gap, not feature gap. Users don't know what can kill their pet or
when a symptom is an emergency.
**Success at month 3:** App is live on Cafe Bazaar and Myket with first real users engaged and
giving positive feedback.

### User Personas

**Persona 1 — The New Owner (Sara, 24)**
Just adopted a kitten. Anxious, doesn't know what's safe to feed it. Googles everything.
Would immediately download an app that tells her what household items are dangerous.

**Persona 2 — The Scared Owner (Reza, 31)**
Has had a dog for 2 years. Had a scare last month. Wants something he can open at midnight when
his dog acts strange and get a clear answer: "go to vet now" or "monitor and wait."

---

## MVP Scope

### In Scope (Month 1–3)

**Free tier — no login required for knowledge features:**
- Symptom urgency guide — public, offline, accessible without account
- Hazard awareness content — public, offline, accessible without account
- Pet profiles (cats and dogs only)
- Reminders: feeding, medication, vaccination, grooming, vet appointments (local notifications)
- Knowledge base: care guides, breed basics, hazard lists
- Jalali (Shamsi) calendar throughout

### Explicitly Out of MVP
- AI features (post-MVP paid tier — blocked on Iran API access)
- Vet directory
- Community features
- Birds and other species
- iOS

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Mobile | React Native (Android first) | Developer familiarity, RTL support, future iOS reuse |
| Local storage | SQLite via WatermelonDB or expo-sqlite | Offline-first pet profiles and reminders |
| Notifications | Notifee (local only) | No FCM dependency — avoids Iran FCM unreliability |
| Calendar | date-fns-jalali | Shamsi dates required from day one |
| Backend | FastAPI (SQLite now, PostgreSQL deferred) | Developer expertise, async, scales to AI later. SQLite for now with DB-agnostic models — see ADR-0004 |
| Hosting | Arvan Cloud or Iran-accessible VPS | Accessible from Iran without restrictions |
| Auth | JWT via PyJWT | Stateless, no third-party dependency — see ADR-0005 |
| Packaging (backend) | `uv` + `pyproject.toml` + `uv.lock` | Reproducible, fast — see ADR-0007 |
| Content | Bundled JSON in app + optional background sync | Offline-first knowledge base |

> **Note:** Some original choices below have since been refined. Architecture
> Decision Records in `docs/ard/` are authoritative where they differ:
> ADR-0004 (SQLite now, PostgreSQL deferred), ADR-0005 (PyJWT, not python-jose),
> ADR-0006 (bcrypt directly, not passlib), ADR-0007 (`uv`, not pip).

---

## Commands

```bash
# Mobile (React Native)
cd mobile
npm install
npm run android            # Run on Android emulator or device
npm run build:android      # Build release APK for Cafe Bazaar / Myket
npm test                   # Run Jest tests

# Backend (FastAPI) — uv-managed, see ADR-0007
cd backend
uv sync                              # Install deps from uv.lock
uv run python run.py                 # Development server
uv run pytest                        # Run test suite
uv run alembic upgrade head          # Apply database migrations
```

---

## Project Structure

```
pet-care/
├── mobile/                        # React Native application
│   ├── src/
│   │   ├── screens/               # Screen-level components
│   │   ├── components/            # Reusable UI components
│   │   ├── navigation/            # React Navigation configuration
│   │   ├── store/                 # Zustand state management
│   │   ├── db/                    # SQLite schema and query helpers
│   │   ├── notifications/         # Local notification scheduling
│   │   ├── content/               # Bundled JSON knowledge base
│   │   │   ├── hazards/           # Hazard entries by species
│   │   │   ├── symptoms/          # Symptom urgency cards
│   │   │   └── guides/            # Care guides by species and breed
│   │   ├── i18n/                  # Farsi strings and RTL config
│   │   └── api/                   # Backend API client (axios)
│   └── android/                   # Android-specific configuration
├── backend/                       # FastAPI backend
│   ├── app/
│   │   ├── routers/               # Route handlers (auth, pets, reminders)
│   │   ├── models/                # SQLAlchemy ORM models
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   └── core/                  # Auth, config, database session
│   ├── alembic/                   # Database migrations
│   └── tests/                     # Pytest test suite
└── content/                       # Source content (Farsi, before bundling)
    ├── hazards/                   # Hazard JSON source files
    ├── symptoms/                  # Symptom urgency card source files
    └── guides/                    # Care guide source files
```

---

## Code Style

### React Native (TypeScript)

```tsx
// Screens are named exports with inline prop types
export function SymptomGuideScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t('symptom.guide.title')}</Text>
    </SafeAreaView>
  );
}

// RTL-safe: use start/end, never left/right
const styles = StyleSheet.create({
  container: { flex: 1, paddingStart: 16, paddingEnd: 16 },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'auto' },
});
```

### FastAPI (Python)

```python
@router.post("/pets", response_model=PetResponse, status_code=201)
async def create_pet(
    pet: PetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return pet_service.create(db, user.id, pet)
```

**Key conventions:**
- TypeScript strict mode — no `any`
- All user-facing strings in `i18n/fa.json`, never hardcoded in components
- RTL: `start`/`end` in all StyleSheet padding and margin, never `left`/`right`
- Jalali dates in all user-facing UI; UTC timestamps in the database
- Snake_case for Python, camelCase for TypeScript

---

## User Journeys

### Journey 1 — Panic at midnight (no account)
1. User opens app or is referred to it while worried about their pet
2. Taps "راهنمای علائم" (Symptom Guide) — no login prompt
3. Selects species (cat or dog) → selects symptom → sees urgency level + recommended action
4. Urgency levels: **همین الان برو** (Go now) / **امروز برو** (Go today) / **نظارت کن** (Monitor) / **طبیعیه** (Normal)
5. Optionally prompted to register to track the incident or set reminders

### Journey 2 — New owner setup
1. Downloads app, explores knowledge base and hazard lists without signing in
2. Decides to add a pet → prompted to register at that moment
3. Adds pet profile: name, species, breed, birthdate in Jalali, optional photo
4. App surfaces suggested reminders based on species
5. First local notification fires at next scheduled time

### Journey 3 — Daily use (registered, free)
1. Morning: feeding reminder fires from local notification
2. User opens app to confirm, sees today's care summary for their pet
3. Browses a hazard article or breed tip
4. Schedules next vaccination reminder with Jalali date picker

---

## Content Strategy

**Minimum launch content:**
- 30 hazard entries (foods, household items, plants toxic to cats and dogs)
- 20 symptom urgency cards organized by urgency level
- Basic care guides: cats (general, Persian cat, British Shorthair), dogs (general, German Shepherd, Golden Retriever)

**Production process:**
1. AI-generate content in Farsi
2. Founder reviews for veterinary accuracy
3. Store as structured JSON in `content/`
4. Bundle into app at build time
5. Update via background sync endpoint or app release

**Content JSON structure (symptom card example):**
```json
{
  "id": "cat-shaking",
  "species": "cat",
  "symptom": "لرزش",
  "urgency": "go_now",
  "description": "لرزش ناگهانی در گربه می‌تواند نشانه مسمومیت، تشنج، یا هیپوترمی باشد.",
  "action": "فوری به دامپزشک مراجعه کنید. این علامت اورژانسی است."
}
```

---

## Testing Strategy

**Mobile (Jest + React Native Testing Library):**
- Test symptom guide logic and urgency routing
- Test Jalali date conversion at boundary cases (month and year transitions)
- Test reminder scheduling logic
- No snapshot tests — they break too often on RTL layout changes

**Backend (Pytest):**
- Test all API endpoints against a real database (SQLite now — see ADR-0004) — no database mocks
- Cover: auth flows, pet CRUD, reminder scheduling
- Coverage target: 80% on core routes

---

## Boundaries

**Always:**
- Use Jalali dates in all user-facing UI
- Use `start`/`end` (never `left`/`right`) in React Native StyleSheet
- Keep symptom guide and hazard content accessible without login
- Store all timestamps as UTC in the database; convert to Jalali at the display layer
- Test against a real database (SQLite now — ADR-0004), not mocks

**Ask first:**
- Adding a new pet species (multiplies content effort significantly)
- Adding a third-party SDK (distribution and Iran-access risk)
- Any backend schema change after first real user data exists
- Any feature that requires internet for core free functionality

**Never:**
- Gate the symptom urgency guide behind a paywall or login
- Use Google FCM for reminders (use local notifications only)
- Hardcode Farsi strings in components — use i18n files
- Store AI API keys in the mobile app bundle

---

## 3-Month Delivery Roadmap

```
Month 1 — Foundation
  Week 1–2: Project setup, RTL config, Jalali calendar integration,
            navigation skeleton, i18n wiring
  Week 3–4: Pet profiles (local SQLite), guest mode, onboarding flow,
            registration and JWT auth

Month 2 — Core Value
  Week 5–6: Knowledge base UI (hazards, care guides), symptom urgency
            guide with offline bundled content
  Week 7–8: Reminder system — Jalali-aware scheduling, local
            notifications, reminder management UI

Month 3 — Content & Ship
  Week 9–10: Content creation — 30 hazards, 20 symptom cards, breed
             guides (AI-generated, founder-reviewed)
  Week 11:   Beta with real users, feedback loop, critical fixes
  Week 12:   Cafe Bazaar and Myket submission and review
```

---

## Success Criteria — Month 3

- [ ] App published on Cafe Bazaar and Myket
- [ ] Symptom guide fully functional offline with no account required
- [ ] Minimum 30 hazard entries and 20 symptom urgency cards in Farsi
- [ ] Reminders fire reliably via local notifications (no internet required)
- [ ] Jalali calendar used throughout — no Gregorian dates visible to users
- [ ] First real users engaged and providing positive feedback
- [ ] Zero critical crashes in first week of real-user testing

---

## Open Questions

1. **AI API access (post-MVP):** Mechanism for Iranian users to reach AI features — proxy
   server, non-US provider, or other approach. Must be resolved before paid tier launches.

2. **Content sync between releases:** Will knowledge base updates reach users via a background
   sync endpoint, or only through app store updates? Decision affects backend scope.

3. **iOS timeline:** No date committed. Depends on Android user traction.

4. **Breed database source:** Where does structured breed data come from — manual entry, open
   dataset, or AI-generated? Needed before Month 1 Week 4.

5. **Account deletion flow:** Required for Cafe Bazaar / Myket compliance. Needs implementation
   before store submission.

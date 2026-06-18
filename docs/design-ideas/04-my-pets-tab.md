# My Pets Tab (حیوانات من)

A Pet Management feature for the mobile app: a simple, intuitive interface for
users to manage information about their pets.

> Status: intent confirmed via interview, ready for spec writing.

## Confirmed Intent

- **Outcome:** A new offline "حیوانات من" tab with full local CRUD for pets —
  add, list, view detail, edit, delete.
- **User:** Any app user, including guests (no login required); pets are
  personal to the device.
- **Why now:** Pet management is core to the app and must work with zero
  connectivity, like the rest of the offline-first product.
- **Success:** A user can add a pet, see it in the list, open/edit/delete it,
  and all records survive app restarts and reboots — entirely offline.
- **Constraint:** Purely local for v1 — no `/pets` backend, no sync, not tied
  to an account even after a guest signs in.

## 1. Core Requirements

Users must be able to:

- Add a new pet
- View a list of their pets
- View detailed information for a specific pet
- Edit an existing pet's information
- Delete a pet (permanent hard delete after confirmation — removes the row and
  the associated photo file; no undo/archive in v1)

### Data Storage

This is an offline-first feature.

- All pet records are stored locally on-device in SQLite.
- Works with no internet connection.
- Data persists between app launches and device restarts.
- No backend table and no sync in v1 (see Out of Scope).

### Pet Information

| Field       | Required | Notes                                                        |
|-------------|----------|--------------------------------------------------------------|
| `id`        | yes      | Unique ID                                                    |
| Name        | yes      | Non-blank (reject whitespace-only)                           |
| Species     | yes      | Fixed list: Dog, Cat, Bird, Rabbit + "Other"; stored as a stable enum key, rendered in Farsi via i18n |
| Gender      | no       | Male / Female toggle                                         |
| Photo       | no       | Picked from gallery via `expo-image-picker`, copied into the app document directory; DB stores the local file path |
| Notes       | no       | Free text                                                    |
| `createdAt` | yes      | Stored UTC, displayed Jalali (ADR-0010)                      |
| `updatedAt` | yes      | Stored UTC, displayed Jalali (ADR-0010)                      |

## 2. User Experience

- Display all pets in a dedicated bottom tab: **حیوانات من**, positioned right
  after the Home tab (Home → حیوانات من → … → Profile). Own stack: List →
  Detail → Add/Edit.
- Tap a pet to view its profile (detail screen shows the fields with Edit +
  Delete actions).
- Forms for creating and editing pet information.
- Validate required fields (Name + Species) before saving.
- Show a confirmation dialog before deleting a pet.
- Empty state when no pets have been added.
- List sorted newest-first.

## Out of Scope (v1)

- Backend sync / cross-device storage / `/pets` API
- Soft-delete, archive, or undo
- Camera capture and in-app photo cropping
- Birthdate / age, or any field beyond those listed above
- Multi-photo galleries

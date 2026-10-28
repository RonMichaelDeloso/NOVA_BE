# Nova — Step 1 backend foundation

This package adds a Django REST API to the existing Vue 3 + TypeScript Nova frontend. It uses SQLite for easy local setup, JWT authentication, role-aware permissions, vehicle CRUD, date-range availability checks, booking conflict prevention, and basic messages.

## Setup on Windows

1. Open a second VS Code terminal. Keep the Vue terminal running separately.
2. In this folder, create and activate a virtual environment:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py makemigrations accounts cars bookings chat
python manage.py migrate
python manage.py seed_nova
python manage.py runserver 8000
```

If PowerShell blocks activation, use Command Prompt instead, or run `.venv\Scripts\python.exe -m pip install -r requirements.txt` and `.venv\Scripts\python.exe manage.py ...` without activating.

API root: http://127.0.0.1:8000/api/  
Health check: http://127.0.0.1:8000/api/cars/  
Django admin: http://127.0.0.1:8000/admin/

Local demo accounts (development only):
- Admin: `admin@nova.local` / `ChangeMe123!`
- Customer: `demo@nova.local` / `ChangeMe123!`

Change these passwords and set a secure `DJANGO_SECRET_KEY` before any non-local deployment. The seed command only sets the password when creating the account.

## Main endpoints

- `POST /api/auth/register/` — `{ "fullName": "Example Person", "email": "person@example.com", "password": "A-strong-password-123" }`
- `POST /api/auth/login/` — `{ "email": "demo@nova.local", "password": "ChangeMe123!" }`; returns `access`, `refresh`, and `user`.
- `POST /api/auth/refresh/` — refresh access token.
- `GET /api/auth/me/` — current user (Bearer token required).
- `GET /api/cars/`, `GET /api/cars/?search=toyota`, `GET /api/cars/?brand=Mazda` — browse/search.
- `GET /api/cars/availability/?start=2027-01-02T09:00:00%2B08:00&end=2027-01-03T09:00:00%2B08:00` — available cars for the requested time range.
- `POST /api/bookings/` — authenticated customer creates a booking with `car_id`, `pickup_at`, `return_at`, and optional locations/note. The server computes price and prevents overlapping reservations.
- `GET /api/bookings/` — customer's bookings; admins see all bookings.
- `PATCH /api/bookings/{id}/` — customers can cancel eligible bookings; admins can update booking status.
- `GET/POST /api/messages/` — basic authenticated messages.

## Important next integration step

The existing Vue app currently uses localStorage for demo authentication and static `rentalData.ts` arrays for vehicle and booking content. This backend does not automatically connect those screens. The next step is to replace those mock calls with HTTP requests, add pickup/return date inputs to the availability flow, and connect the admin fleet/bookings and user bookings screens to these endpoints.

This is a development foundation, not a deployed production service. Payment gateway integration, email/password reset, document verification, audit logging, automated tests, production deployment, and any required business/legal policies still need project-specific work.

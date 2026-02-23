# Financial Scenario Modeling System (MVP)

Three-tier MVP application for deterministic monthly financial scenario modeling.

## Stack

- Frontend: React SPA (Vite)
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL
- Data processing: pandas + numpy
- Runtime: Docker Compose

## Architecture

- `frontend/` SPA UI
- `backend/app/api` routes only
- `backend/app/services` business/application services
- `backend/app/calculations` deterministic financial model and scenario engine
- `backend/app/models` ORM and Pydantic models
- `backend/app/core` infra and security

No background workers, queues, brokers, or async job systems are used.
All calculations are synchronous.

## Financial Model (strict order)

Revenue -> VC -> GP -> EBITDA -> PBT -> Tax -> NP -> OCF

Formulas:

- Revenue = Q * P
- VC = Revenue * VC%
- GP = Revenue - VC
- EBITDA = GP - FC
- PBT = EBITDA - Interest
- Tax = max(PBT,0) * TaxRate
- NP = PBT - Tax
- OCF = NP

## Scenario Types

- `fx_growth`
- `demand_drop`
- `raw_material_growth`
- `custom`

## Validation Rules

Rejects with JSON:

```json
{
  "error": "ValidationError",
  "field": "...",
  "message": "..."
}
```

for:

- Revenue < 0
- VC% > 100
- TaxRate > 100
- VCImport not in [0,1]

## Run

```bash
docker compose up --build
```

Services:

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs
- PostgreSQL: localhost:5432

## API Endpoints

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Upload

- `POST /upload`

### Scenario

- `POST /scenario/run`
- `GET /scenario/result/{id}`
- `GET /scenario/list`

## Upload Format

CSV/JSON first row with fields:

- `q`
- `price`
- `vc_percent`
- `fc`
- `interest`
- `tax_rate`
- optional: `fx`, `vc_import`

## Determinism

- identical inputs => identical outputs
- formulas are immutable
- scenario engine modifies inputs only
- base input is never mutated

## Performance Targets

- File parsing <= 5 sec
- Scenario calculation <= 10 sec
- Up to 10 concurrent users

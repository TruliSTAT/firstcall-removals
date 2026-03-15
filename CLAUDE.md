# Funeral Transport App

## Purpose
Operations platform for a funeral transport company. Manages transport calls from creation through completion. Serves three user roles: Admin (dispatcher), Driver (field), Funeral Home (client).

## Stack
- **Backend:** Node.js + Express + SQLite (node:sqlite native) — port 3001
- **Frontend:** React 18 + Vite + Tailwind CSS — port 5173 (dev) or served from backend in prod
- **Auth:** JWT tokens, role-based (admin / employee / funeralhome)

## Repo Map
```
funeral-transport/
  backend/
    server.js          ← Express entry point, all middleware
    database.js        ← SQLite init, migrations, seed data — TOUCH WITH CARE
    middleware/
      auth.js          ← JWT verify + requireRole()
    routes/
      auth.js          ← login/register
      transports.js    ← main resource: CRUD + lifecycle + parse-intake
      drivers.js       ← driver management
      vehicles.js      ← vehicle management
    funeral_transport.db  ← SQLite DB file — never delete
  frontend/
    src/
      App.jsx          ← monolithic component (all views + state)
      index.css        ← global styles + Tailwind
    vite.config.js     ← proxies /api → localhost:3001
```

## Transport Lifecycle
`Pending → Accepted → En Route → Arrived → Loaded → Completed`
- Status timestamps: accepted_at, en_route_at, arrived_at, loaded_at, completed_at
- Drivers advance status via action buttons
- Each transition fires a notification to the originating funeral home user

## Key Rules
- **Never drop or truncate the DB** — always use `ALTER TABLE ADD COLUMN IF NOT EXISTS` pattern
- **Migrations live in `migrateDb()` in database.js** — add new columns there, always guard with existence check
- **Auth is required on all routes** — use `authenticateToken` middleware; use `requireRole('admin')` for admin-only
- **Fees:** pickup_fee, mileage_fee, ob_fee, admin_fee ($10 flat) — NO destination fee (removed)
- **Smart Paste endpoint:** POST /api/transports/parse-intake — uses Anthropic claude-haiku, reads key from ~/.openclaw/agents/main/agent/auth-profiles.json

## Funeral Home System
- `funeral_homes` table — master list of client funeral homes
- `funeral_home_callers` table — individual callers linked to a funeral home
- Multiple users/callers → one funeral_home record
- Funeral home users only see their own transports (filtered by funeral_home_id)
- Known clients: Houston Service Center, Callaway Jones Funeral Home (Bryan TX)

## Commands
```bash
# Start backend
cd backend && node server.js

# Start frontend (dev)
cd frontend && npm run dev

# Build frontend (prod)
cd frontend && npm run build

# Install deps
cd backend && npm install
cd frontend && npm install
```

## Danger Zones
- `database.js` → migrateDb() and initDb() — always test migrations don't break existing data
- JWT secret is hardcoded in server.js — do not rotate without updating all active tokens
- Smart Paste reads a local file path for the API key — don't change that path

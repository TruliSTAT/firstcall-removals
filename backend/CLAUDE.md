# Backend — Funeral Transport

## Entry Point
`server.js` — mounts all routes, CORS, JSON middleware, serves frontend static in prod.

## Database (database.js)
- Uses `better-sqlite3` npm package (`require('better-sqlite3')`) — NOT node:sqlite or sqlite3
- Single DB file: `funeral_transport.db`
- `initDb()` → creates tables + calls migrateDb() + seedData()
- `migrateDb()` → safe column additions. ALWAYS add new columns here with existence checks:
  ```js
  const cols = db.prepare("PRAGMA table_info(transports)").all().map(c => c.name);
  if (!cols.includes('new_column')) db.exec("ALTER TABLE transports ADD COLUMN new_column TEXT");
  ```
- `seedData()` → creates default users and sample data if table is empty

## Auth
- `middleware/auth.js` exports: `authenticateToken`, `requireRole(role)`
- Roles: `admin`, `employee`, `funeralhome`
- JWT payload: `{ userId, username, role, funeral_home_id }`

## Routes
| File | Prefix | Notes |
|------|--------|-------|
| auth.js | /api/auth | login, register |
| transports.js | /api/transports | main resource — most logic lives here |
| drivers.js | /api/drivers | CRUD for drivers |
| vehicles.js | /api/vehicles | CRUD for vehicles |

## Transport Route Patterns
- `GET /api/transports` — filtered by role (admin sees all, funeralhome sees own)
- `POST /api/transports` — create new transport
- `PUT /api/transports/:id/advance` — advance lifecycle status
- `PUT /api/transports/:id/assign` — admin assigns driver + vehicle
- `POST /api/transports/parse-intake` — AI text extraction (auth required)

## Notifications
Stored in `notifications` table. `for_user_id` targets the funeral home user. Frontend polls GET /api/notifications.

## Fee Calculation
```
pickupFee: Residential=$225, Funeral Home/Care Center=$175, Other=$195
mileageFee: (miles - 30) * $3.50 (only if miles > 30)
obFee: $50 base if weight > 250lbs, +$50 per additional 100lbs
adminFee: $10 flat
total: sum of all above
```

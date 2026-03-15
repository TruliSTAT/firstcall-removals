# Funeral Transport Management App

Full-stack funeral transport management system with React frontend and Node.js/Express backend backed by SQLite.

## Project Structure

```
funeral-transport/
  backend/          # Express API + SQLite database
  frontend/         # React + Vite + Tailwind CSS
  App.jsx           # Original UI prototype (reference)
  README.md
```

## Setup & Running

### Prerequisites
- Node.js 18+
- npm

### Backend

```bash
cd backend
npm install
npm run dev        # dev mode (nodemon, auto-reload)
# or
npm start          # production
```

API runs at **http://localhost:3001**

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173**
Vite proxies `/api` requests to the backend automatically.

---

## Default Login Credentials

| Role         | Username      | Password      |
|--------------|---------------|---------------|
| Admin        | `admin`       | `admin123`    |
| Employee     | `employee`    | `employee123` |
| Funeral Home | `funeralhome` | `funeral123`  |

---

## API Endpoints

### Auth
| Method | Path               | Description        |
|--------|--------------------|--------------------|
| POST   | /api/auth/login    | Login, returns JWT |
| POST   | /api/auth/logout   | Logout             |
| GET    | /api/auth/me       | Get current user   |

### Transports
| Method | Path                   | Description                        |
|--------|------------------------|------------------------------------|
| GET    | /api/transports        | List transports (filtered by role) |
| POST   | /api/transports        | Create new transport request       |
| PUT    | /api/transports/:id    | Update transport (status, assign)  |
| DELETE | /api/transports/:id    | Delete transport (admin only)      |

### Drivers
| Method | Path              | Description        |
|--------|-------------------|--------------------|
| GET    | /api/drivers      | List all drivers   |
| POST   | /api/drivers      | Add driver (admin) |
| PUT    | /api/drivers/:id  | Update driver      |

### Vehicles
| Method | Path               | Description         |
|--------|--------------------|---------------------|
| GET    | /api/vehicles      | List all vehicles   |
| POST   | /api/vehicles      | Add vehicle (admin) |
| PUT    | /api/vehicles/:id  | Update vehicle      |

---

## Cost Calculation

| Fee              | Rate                                         |
|------------------|----------------------------------------------|
| Pickup (Residential)         | $225                            |
| Pickup (Funeral Home)        | $175                            |
| Pickup (Other)               | $195                            |
| Destination (same structure) |                                 |
| Mileage (over 30 miles)      | (miles − 30) × $3.50            |
| OB fee (over 250 lbs)        | $50 base + $50/100 lbs over 250 |
| Admin fee                    | $10                             |

---

## User Roles

- **funeral_home** — Submit transport requests, view own requests
- **employee** — View dashboard, assignments, accept requests, update transport status
- **admin** — Full access: assign drivers/vehicles, manage all transports, delete records

---

## Database

SQLite database stored at `backend/funeral_transport.db` (auto-created on first run).

Tables: `users`, `transports`, `drivers`, `vehicles`

To reset the database, delete `backend/funeral_transport.db` and restart the server.

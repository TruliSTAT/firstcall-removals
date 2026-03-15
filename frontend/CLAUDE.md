# Frontend — Funeral Transport

## Stack
React 18 + Vite + Tailwind CSS

## Structure
Currently a single large `src/App.jsx` — all views, state, and components live here.
This is intentional for now. Do not split into separate route files without checking first.

## API
- All API calls go to `/api/...` — Vite proxies to `http://localhost:3001` in dev
- Auth token stored in localStorage as `token`
- Include in all requests: `Authorization: Bearer ${token}`

## Views (controlled by `currentView` state)
- `login` — login form
- `admin-dashboard` — dispatch board, transport management
- `driver-dashboard` — driver's active/available transports
- `funeralhome-dashboard` — funeral home's transport history + status tracking

## Key State
- `user` — current logged-in user object (role, username, funeral_home_id)
- `transports` — list of transports for current user's role
- `notifications` — alert banners for funeral home users

## Polling
Frontend polls every 10-15 seconds for: transports, notifications, driver assignments.

## Smart Paste
- "Smart Paste" button on new transport form
- Opens modal → textarea → calls POST /api/transports/parse-intake
- Auto-fills form fields from response
- AI-filled fields get light blue highlight + confidence badge

## Styling Notes
- Tailwind utility classes throughout
- No external component library — all custom
- Status colors: Pending=yellow, Accepted=blue, En Route=purple, Arrived=orange, Loaded=teal, Completed=green

## Build
```bash
npm run dev    # dev server port 5173
npm run build  # outputs to dist/
```

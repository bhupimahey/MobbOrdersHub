# SAN Orders Admin

Centralized order processing & courier management software.

- **Frontend:** React + Vite + TypeScript (built into Laravel `public/`)
- **Backend:** Laravel 13 (PHP 8.3) + Sanctum
- **Database:** MySQL (users, phases, activity logs, settings only)
- **Orders:** Third-party ERP APIs (mock data enabled by default)

## Super Admin

- Email: `sanmehmi@gmail.com`
- Password: `sanmehmi`

## Run locally (one command — no separate frontend/backend)

1. Set MySQL credentials in `backend/.env` and seed the DB (once):

```powershell
cd backend
php artisan migrate --seed
```

(Or import `database/schema.sql`, then `php artisan db:seed`)

2. From the **project root**, start everything:

```powershell
cd F:\Personal\san_orders_admin
npm start
```

Or double-click **`start.bat`**.

3. Open only this URL:

**http://127.0.0.1:8000**

That single server serves the React UI and the `/api` backend together.

| Command | What it does |
|---------|----------------|
| `npm start` / `start.bat` | Build React → start Laravel on port 8000 |
| `npm run serve` | Start Laravel only (if you already built) |
| `npm run build` | Rebuild React into `backend/public` |

You do **not** need `npm run dev` on port 5173 for normal use.

## Database schema

- SQL: [`database/schema.sql`](database/schema.sql)
- Docs: [`database/SCHEMA.md`](database/SCHEMA.md)

Orders are **not** stored permanently in MySQL.

## cPanel / shared hosting

Same setup as local (one app):

1. On your PC: `npm run build` (fills `backend/public` with the UI)
2. Upload the `backend` folder to hosting
3. Set document root to `backend/public` (or `public_html` = contents of `public`)
4. Create MySQL DB in cPanel, update `.env`, run `php artisan migrate --seed` (SSH) or import SQL + seed
5. Open `https://yourdomain.com`

## Menus

**Super Admin:** Dashboard, Activity Report, Settings, Users, Profile, Logout  
**Staff:** Dashboard, Profile, Logout

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

## cPanel / shared hosting (orderhub.mobbmedical.com)

Deploy uploads **only** `backend/` (React is already built into `backend/public/`).

**GitHub secret `PRD_APP_DIR`** (Laravel app root — full website path):

```text
/home/univer62/public_html/orderhub.mobbmedical.com
```

That folder receives `app/`, `public/`, `vendor/`, etc. React lives in `public/index.html` + `public/assets/`.

One-time on the server (cPanel File Manager or SSH):

1. Create MySQL database + user in cPanel
2. Copy `.env.production.example` → `.env` in the app root
3. Fill `DB_*`, set `APP_URL=https://orderhub.mobbmedical.com`
4. Generate key (SSH): `php artisan key:generate`
5. Prefer document root → `.../orderhub.mobbmedical.com/public`  
   If cPanel keeps document root on the domain folder, root `.htaccess` already forwards into `public/`
6. Run **Actions → Deploy Production → Run workflow**

## Menus

**Super Admin:** Dashboard, Activity Report, Settings, Users, Profile, Logout  
**Staff:** Dashboard, Profile, Logout

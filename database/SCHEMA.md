# Database Schema – SAN Orders Admin

Orders are **not** stored in this database. They come from third-party ERP APIs.

## Entity relationship (local DB)

```
users ──┬──< user_phases >── order_phases
        │
        └──< activity_logs >── order_phases

settings (key/value app + API config)
personal_access_tokens (Sanctum)
```

## Tables

### `users`
| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| name | VARCHAR(255) | |
| email | VARCHAR(255) UNIQUE | Login email |
| password | VARCHAR(255) | bcrypt |
| role | ENUM(`super_admin`,`staff`) | |
| job_title | VARCHAR(255) NULL | |
| phone | VARCHAR(50) NULL | |
| avatar_initials | VARCHAR(10) NULL | |
| is_active | BOOLEAN | Soft disable without delete |
| timestamps | | |

### `order_phases`
| Column | Type | Notes |
|--------|------|--------|
| id | BIGINT PK | |
| code | VARCHAR(50) UNIQUE | e.g. `shipping_preparation` |
| name | VARCHAR(100) | Display name |
| description | VARCHAR(500) | |
| sort_order | TINYINT | 1–7 |
| color / icon | VARCHAR | UI helpers |
| is_active | BOOLEAN | |

**Seeded phases:** received → ready_to_pick → picked_packed → shipping_preparation → invoiced → shipped → completed

### `user_phases`
| Column | Type | Notes |
|--------|------|--------|
| user_id | FK → users | |
| phase_id | FK → order_phases | |
| UNIQUE(user_id, phase_id) | | Staff can have multiple phases |

### `activity_logs`
| Column | Type | Notes |
|--------|------|--------|
| user_id | FK NULL | Who acted |
| order_reference | VARCHAR(100) | ERP order id/number |
| phase_id / phase_code | | Which phase |
| action | VARCHAR(100) | e.g. update_order |
| previous_status | VARCHAR NULL | |
| updated_status | VARCHAR NULL | |
| details | JSON NULL | Extra payload |
| ip_address | VARCHAR(45) | |
| created_at | | When |

### `settings`
| Column | Type | Notes |
|--------|------|--------|
| key | VARCHAR UNIQUE | e.g. `erp_api_base_url` |
| value | TEXT | Encrypted if `is_encrypted` |
| type | string/boolean/json | |
| group | api / general | |
| label | | Admin UI label |

## Super Admin seed

| Field | Value |
|-------|--------|
| Email | `sanmehmi@gmail.com` |
| Password | `sanmehmi` |
| Role | `super_admin` |

Created by: `php artisan migrate --seed`

## SQL file

Importable dump: [`schema.sql`](schema.sql)

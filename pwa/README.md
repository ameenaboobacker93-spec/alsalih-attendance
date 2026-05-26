# Al Salih Pharmacy Attendance PWA

Multi-branch attendance management system with Supabase backend.

## Setup

### 1. Supabase

1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor and run `supabase/schema.sql`
3. Go to Settings → API and copy your URL and anon key

### 2. Environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Install & Run

```bash
npm install
npm run dev
```

### 4. Deploy to Cloudflare Pages

```bash
npm run build
```

Then connect the `pwa/` directory to Cloudflare Pages via GitHub.

## Branches

- **Ajman (AJM)** — Al Salih Pharmacy Ajman
- **UAQ (UAQ)** — Al Salih Pharmacy UAQ

Add more branches by inserting into the `branches` table.

## Features

- Multi-branch support with branch selector
- Staff attendance (check-in/check-out)
- Monthly dashboard with OT calculation
- Duty roster with split-shift scheduling
- Admin panel (staff mgmt, settlements, audit logs)
- CSV export reports
- PWA installable on mobile devices

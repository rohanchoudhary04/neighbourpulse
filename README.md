# NeighbourPulse 🏘️⚡
> **Your neighbourhood. Connected and informed.**

NeighbourPulse is a mobile-first web application designed for residents and administrators of residential societies and neighbourhoods. It enables residents to report local issues, discover and corroborate existing incidents within proximity to prevent duplicate reports, track operational status in real-time, and monitor a transparent Community Health Score.

---

## 🚀 Key Differentiator: Duplicate Suggestions & Proximity Corroboration

Unlike generic ticketing apps where 20 neighbours report the same water burst or fallen tree creating ticket chaos:
1. When a resident begins to report an issue, NeighbourPulse runs a **spatial proximity query** (using PostGIS / Haversine distance within ~150 meters, same category, active within 48h).
2. The user is presented with a **"Similar issue nearby"** card offering **"I see this too"** or **"This is a different issue"**.
3. Corroborating with **"I see this too"**:
   - Increments the corroboration count without creating duplicate tickets.
   - Automatically subscribes the resident to operational status updates.
   - When **3 distinct non-reporter confirmations** are accumulated, the incident transitions to **"Community Confirmed"**, escalating it in the administrator queue.
   - The database prevents self-confirmation and ensures confirmation idempotency.

---

## 📊 Transparent Community Health Score

NeighbourPulse features a transparent, explainable Health Score formula:
$$\text{Score} = \max(0, 100 - (10 \times \text{unresolved verified incidents}))$$

- **Verified incidents counted**: Only incidents with **3+ community corroborations** or **direct admin verification** with operational status `Open` or `In Progress`.
- **Exclusions**: Raw unverified reports, duplicate submissions, and resolved incidents do NOT penalize the score.
- **Classification**:
  - `80 – 100`: **Good**
  - `50 – 79`: **Needs attention**
  - `0 – 49`: **Critical**
- **Special States**:
  - If no verified records exist yet: Displays **"Not enough data"** rather than implying an artificial 100.
  - If verified records exist and all are resolved: Displays **100** with *"No unresolved verified issues."*
  - Shows separate counter for unverified open reports so they remain visible for community review.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Routing**: React Router v6
- **Server State**: TanStack Query (React Query)
- **Database & Auth**: Supabase (PostGIS geography/geometry, Row Level Security, RPCs, Storage)
- **Maps**: Mapbox GL JS (with interactive fallback canvas if token is omitted)
- **Icons**: Lucide React
- **Validation & Forms**: React Hook Form + Zod
- **Testing**: Vitest + Testing Library + jsdom

---

## 📱 Responsive & Mobile-First Design

- **Mobile View**:
  - Full-width viewport layouts with safe-area padding (`env(safe-area-inset-bottom)`).
  - Map fills available screen height.
  - Interactive bottom sheets for incident previews.
  - Sticky bottom navigation: **Map**, **Report** (elevated action), **My Reports**.
- **Desktop View**:
  - Top navigation with neighbourhood switcher and unread notifications badge.
  - Home screen layout with incident sidebar alongside the interactive map.
  - Responsive centered forms with image upload and draggable coordinate preview.
  - Administrative dashboard with comprehensive KPI cards, priority badges, and management table.

---

## 🗄️ Database Architecture & Migrations

All SQL migrations and schema definitions are located in `supabase/migrations/`:
- `20261030000000_init_neighbourpulse.sql`:
  - **Extensions**: `postgis`
  - **Tables**:
    - `profiles`: Linked to `auth.users`, user display names.
    - `communities`: Name, locality, PostGIS `geography(Point, 4326)` center, `geometry(MultiPolygon, 4326)` boundaries.
    - `community_members`: Role (`resident` vs `admin`), user foreign key, unique constraint.
    - `incidents`: Categories (`water`, `power`, `road`, `safety`, `garbage`, `animals`), location geography, operational status (`open`, `in_progress`, `resolved`), admin verification, privacy flag (`hide_reporter_name`).
    - `incident_photos`: Private storage path, upload type (`report` or `resolution`).
    - `confirmations`: Unique constraint per `(incident_id, user_id)`, non-reporter verification.
    - `incident_updates`: Full audit timeline of status changes, notes, and community validations.
    - `incident_followers`: Notification subscriptions.
    - `resolution_feedback`: "Still an issue" resident feedback sent for admin review.
    - `notifications`: User-specific in-app notifications.
  - **Secure Resident-Facing View**: `incidents_view` masks `reporter_id` and name as `"Resident"` when `hide_reporter_name = true` for non-admins.
  - **RPCs**:
    - `find_duplicate_candidates(p_community_id, p_category, p_lat, p_lng, p_radius_meters)`: Spatial PostGIS distance query.
    - `calculate_health_score(p_community_id)`: Transparent formula execution.
    - `confirm_incident(p_incident_id, p_user_id)`: Idempotent confirmation, triggers community-confirmed notification at 3 confirms.
  - **Row Level Security (RLS)**: Enforces community boundary reading, non-reporter verification, and administrative status mutation.

---

## ⚡ Quick Start & Development

### 1. Prerequisites
- Node.js (v18+)
- npm or pnpm

### 2. Installation
```bash
# Clone the repository and navigate to folder
cd sphinx26_project

# Install dependencies
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Contents:
```env
# Optional: Supabase credentials (leave blank for instant offline Demo Mode)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Optional: Public Mapbox token (pk.xxx)
VITE_MAPBOX_ACCESS_TOKEN=

# Enable Demo Mode (runs offline with mock database and persona switcher)
VITE_DEMO_MODE=true
```

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 5. Run Test Suite
```bash
npm test
```
Runs the 12 focused Vitest acceptance checks covering the full 13-step product scenario.

### 6. Production Build
```bash
npm run build
```

---

## 🎭 Demo Mode Personas

When running in **Demo Mode** (`VITE_DEMO_MODE=true` or when Supabase credentials are not set), a persona switcher allows 1-click evaluation:

| Persona | Role | Primary Use Case |
|---|---|---|
| **Alex Chen** | Resident | Reports water/road issues, receives resolution notifications |
| **Priya Sharma** | Resident | Corroborates nearby issues with "I see this too" |
| **Marcus Vance** | Resident | Third corroborating resident to trigger Community Confirmed |
| **Sarah Jenkins** | Admin | Oakridge Heights administrator: verifies incidents, moves tickets to In Progress, resolves tickets with mandatory notes, reviews "Still an issue" feedback |

---

## 🔒 Production Admin Bootstrap Instructions

To assign an existing Supabase authenticated user as an administrator:
```sql
INSERT INTO public.community_members (community_id, user_id, role)
VALUES ('a1b2c3d4-0000-0000-0000-000000000001', '<SUPABASE_USER_UUID>', 'admin')
ON CONFLICT (community_id, user_id) DO UPDATE SET role = 'admin';
```

---

## 📋 Implemented vs. Optional Features Matrix

| Feature | Status | Implementation Details |
|---|---|---|
| Email/Password Auth & Password Reset | ✅ Implemented | Supabase Auth + Demo fallback with validation |
| Seeded Community Onboarding | ✅ Implemented | Oakridge Heights, Maple Park Estate, Silverlake Gardens |
| Geolocation Permission on Action | ✅ Implemented | Explicit user trigger, no background tracking |
| Mapbox GL JS Live Map | ✅ Implemented | Light theme, custom category pins, boundaries |
| Map / List Toggle | ✅ Implemented | Dynamic toggle for mobile & desktop |
| Interactive Fallback Canvas | ✅ Implemented | Interactive vector neighbourhood view if token omitted |
| Community Health Score | ✅ Implemented | Transparent `max(0, 100 - 10*N)` formula, explanations |
| Proximity Duplicate Detection | ✅ Implemented | 150m spatial matching, same category, 48h active |
| Corroboration ("I see this too") | ✅ Implemented | Idempotent, non-reporter rule, 3 confirms = verified |
| Privacy: "Hide my name" | ✅ Implemented | Masked as "Resident", admin view retained |
| Image Compression & Upload | ✅ Implemented | Client-side Canvas downscaling (<5MB) |
| Mandatory Resolution Notes | ✅ Implemented | Admin closure requires documented work note |
| "Still an issue" Resident Feedback | ✅ Implemented | Sends review ticket to admin instead of auto-reopening |
| Admin Dashboard & Priority Badges | ✅ Implemented | Urgent, >48h pending, community confirmed filters |
| In-App Notification Center | ✅ Implemented | Unread badges, read/all-read actions |
| Unit & Acceptance Test Suite | ✅ Implemented | 12 Vitest tests verifying the full 13-step journey |


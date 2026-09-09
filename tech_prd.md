# Ventro — Technical PRD & Development Plan

> **Start date:** September 10, 2026
> **MVP Deadline:** October 11, 2026
> **Stack:** Next.js 14 (App Router) · Prisma · PostgreSQL · Tailwind CSS · shadcn/ui · NextAuth.js
> **Repo context:** This document is the source of truth for scope, architecture, and task breakdown. Keep it updated as decisions evolve. Schedule is calendar-day equivalent of the original Jul 1 → Aug 1, 2025 plan, shifted to start 10 Sep 2026.

---

## 1. Product Overview

Ventro is an internal operations platform for a dump truck (volquete) rental company operating across Buenos Aires (CABA). The company currently manages everything via Excel spreadsheets and has no visibility into where their assets are, what's owed, or how to optimize collection routes.

### Problem Statement
- No visibility into where dump trucks are located at any given time
- No tracking of how long a dump truck has been at a job site
- Billing managed manually via Excel (dates, amounts, client info)
- No route optimization for weekly collections
- No historical record per client or per asset
- No real-time stock count of available vs. deployed vs. maintenance assets

### Goals
- Replace Excel with a centralized web platform
- Give operations a live map view of all active dump truck locations
- Enable creation, tracking, and history of orders
- Enable tracking and collection of payments
- Provide real-time stock visibility (available / on order / maintenance)

### Out of Scope (MVP)
- Driver-facing mobile app or PWA
- Real-time GPS tracking
- Multi-role auth (single admin role for MVP)
- Customer-facing portal
- WhatsApp / push notification integrations
- Invoice generation (PDF)

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router) | Full-stack in one project, Server Actions, file-based routing |
| Language | TypeScript | Type safety, better DX with Prisma |
| ORM | Prisma | Best-in-class DX for Node, auto-generated types, clean migrations |
| Database | PostgreSQL 16 (Docker) | Production-grade, future PostGIS support |
| Auth | NextAuth.js v5 | Simple credential auth, session management |
| UI Components | shadcn/ui + Tailwind CSS | Pre-built dashboard components, no design from scratch |
| Maps | Leaflet.js | Open source, no billing, easy React integration via react-leaflet |
| Geocoding | Nominatim (free) or Google Maps API | Convert address to lat/lng on order save |
| State | React Query (TanStack) | Server state, caching, background refetch |
| Deploy | Vercel (app) + Railway (Postgres) | Seamless Next.js deploy, managed DB |

---

## 3. Data Model

### Enums

```prisma
enum DumpTruckStatus {
  AVAILABLE
  ON_ORDER
  MAINTENANCE
}

enum TruckStatus {
  AVAILABLE
  ON_ROUTE
}

enum OrderStatus {
  PENDING
  ACTIVE
  COMPLETED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  COLLECTED
  OVERDUE
}
```

### Models

```prisma
model Client {
  id        Int      @id @default(autoincrement())
  name      String
  phone     String?
  address   String?
  notes     String?
  orders    Order[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Truck {
  id        Int         @id @default(autoincrement())
  plate     String      @unique
  status    TruckStatus @default(AVAILABLE)
  notes     String?
  orders    Order[]
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
}

model DumpTruck {
  id        Int             @id @default(autoincrement())
  status    DumpTruckStatus @default(AVAILABLE)
  order     Order?          @relation(fields: [orderId], references: [id])
  orderId   Int?
  notes     String?
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}

model Order {
  id                   Int         @id @default(autoincrement())
  client               Client      @relation(fields: [clientId], references: [id])
  clientId             Int
  truck                Truck       @relation(fields: [truckId], references: [id])
  truckId              Int
  dumpTrucks           DumpTruck[]
  deliveryAddress      String
  latitude             Float?
  longitude            Float?
  dumpTruckCount       Int
  status               OrderStatus @default(PENDING)
  deliveryDate         DateTime?
  estimatedPickupDate  DateTime?
  actualPickupDate     DateTime?
  notes                String?
  payment              Payment?
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
}

model Payment {
  id          Int           @id @default(autoincrement())
  order       Order         @relation(fields: [orderId], references: [id])
  orderId     Int           @unique
  amount      Float
  dueDate     DateTime
  paymentDate DateTime?
  status      PaymentStatus @default(PENDING)
  notes       String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  name      String?
  createdAt DateTime @default(now())
}
```

---

## 4. Project Structure

```
Ventro/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar + navbar
│   │   ├── page.tsx                # Dashboard home
│   │   ├── clients/
│   │   │   ├── page.tsx            # List
│   │   │   ├── [id]/page.tsx       # Detail
│   │   │   └── new/page.tsx        # Create
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── new/page.tsx
│   │   ├── payments/
│   │   │   ├── page.tsx
│   │   │   └── route/page.tsx      # Collection route builder
│   │   └── map/page.tsx            # Full map view
│   └── api/
│       └── auth/[...nextauth]/route.ts
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── map/                        # Leaflet components
│   ├── orders/                     # Order-specific components
│   ├── payments/                   # Payment components
│   └── dashboard/                  # Dashboard widgets
├── lib/
│   ├── prisma.ts                   # Prisma client singleton
│   ├── auth.ts                     # NextAuth config
│   └── geocoding.ts                # Address → lat/lng
├── actions/                        # Server Actions
│   ├── clients.ts
│   ├── orders.ts
│   ├── payments.ts
│   └── dump-trucks.ts
└── prisma/
    ├── schema.prisma
    └── seed.ts
```

---

## 5. Key Business Logic

### Order creation flow
1. Operator selects client, truck, delivery address, dump truck count, dates
2. System checks available dump trucks: `DumpTruck.count(where: { status: AVAILABLE }) >= dumpTruckCount`
3. If enough available: create Order, assign N dump trucks (set status → ON_ORDER, orderId → order.id)
4. Auto-create Payment record linked to the order
5. Geocode delivery address → save lat/lng

### Order completion flow
1. Operator marks order as COMPLETED
2. All linked dump trucks → status: AVAILABLE, orderId: null
3. Truck → status: AVAILABLE
4. Payment status checked (if not COLLECTED → stays PENDING)

### Stock calculation (real-time, no stored field)
```ts
const available   = await prisma.dumpTruck.count({ where: { status: 'AVAILABLE' } })
const onOrder     = await prisma.dumpTruck.count({ where: { status: 'ON_ORDER' } })
const maintenance = await prisma.dumpTruck.count({ where: { status: 'MAINTENANCE' } })
```

### Overdue payment detection
On every payment list load, check:
```ts
if (payment.status === 'PENDING' && payment.dueDate < new Date()) {
  // mark as OVERDUE
}
```

---

## 6. Milestones & Issues

---

### Milestone 1 — Project Setup
**Deadline: September 15, 2026**

| # | Issue | Description |
|---|---|---|
| 1.1 | Init Next.js project | `npx create-next-app@latest Ventro --typescript --tailwind --app` |
| 1.2 | Install dependencies | Prisma, NextAuth, shadcn/ui, react-leaflet, TanStack Query |
| 1.3 | Docker Compose | PostgreSQL 16 container |
| 1.4 | Prisma setup | `prisma init`, write schema, `prisma migrate dev` |
| 1.5 | NextAuth setup | Credentials provider, User model, session config |
| 1.6 | Base layout | Sidebar, navbar, auth guard on dashboard routes |
| 1.7 | Login page | Email/password form, redirect to dashboard |
| 1.8 | Seed script | Admin user + initial dump truck records (e.g. 70 trucks) |

---

### Milestone 2 — Dashboard & Stock
**Deadline: September 19, 2026**

| # | Issue | Description |
|---|---|---|
| 2.1 | Dashboard page | Root route for authenticated users |
| 2.2 | Stock cards | Available / On order / Maintenance counts from DB |
| 2.3 | Active orders widget | Count + list of today's active orders |
| 2.4 | Available trucks widget | Trucks with status AVAILABLE |
| 2.5 | Overdue payments widget | Count + total amount overdue |
| 2.6 | Recent orders table | Last 5 orders with status badge |

---

### Milestone 3 — Client CRUD
**Deadline: September 22, 2026**

| # | Issue | Description |
|---|---|---|
| 3.1 | Clients list | Paginated table, search by name |
| 3.2 | Client detail | Info + order history + payment history |
| 3.3 | Create client | Form with Server Action validation |
| 3.4 | Edit client | Pre-filled form |
| 3.5 | Delete client | Guard: block if has active orders |

---

### Milestone 4 — Order Management
**Deadline: September 28, 2026**

| # | Issue | Description |
|---|---|---|
| 4.1 | Orders list | Filters: status, client, date range |
| 4.2 | Order detail | Full view: client, truck, dump trucks, dates, payment |
| 4.3 | Create order | Form: client, truck, count, address, dates |
| 4.4 | Auto-assign dump trucks | Assign N available trucks on creation |
| 4.5 | Status transitions | PENDING → ACTIVE → COMPLETED with guards |
| 4.6 | Release dump trucks | On COMPLETED, return trucks to AVAILABLE |
| 4.7 | Edit order | Only if PENDING or ACTIVE |
| 4.8 | Cancel order | Return trucks to AVAILABLE, mark CANCELLED |
| 4.9 | Days on site | Computed: `today - deliveryDate` shown on active orders |

---

### Milestone 5 — Map View
**Deadline: October 2, 2026**

| # | Issue | Description |
|---|---|---|
| 5.1 | Geocoding service | On order save, convert address to lat/lng via Nominatim |
| 5.2 | Map page | Leaflet map, all active orders as pins |
| 5.3 | Pin popup | Client name, address, truck count, days on site, payment status |
| 5.4 | Color-coded pins | Green = collected, Yellow = pending, Red = overdue |
| 5.5 | Mini map on order detail | Embedded map showing job site location |
| 5.6 | Manual lat/lng override | In case geocoding fails |

---

### Milestone 6 — Payments
**Deadline: October 5, 2026**

| # | Issue | Description |
|---|---|---|
| 6.1 | Auto-create payment | On order creation, generate Payment record |
| 6.2 | Payments list | Filters: status, date range, client |
| 6.3 | Mark as collected | Button + record paymentDate |
| 6.4 | Overdue detection | On load: if dueDate < today and PENDING → show as OVERDUE |
| 6.5 | Payment history per client | On client detail page |
| 6.6 | Weekly summary | Filter by week, show total amount due |

---

### Milestone 7 — Collection Route
**Deadline: October 8, 2026**

| # | Issue | Description |
|---|---|---|
| 7.1 | Route builder | Select pending payments for the week via checkboxes |
| 7.2 | Route map | Ordered pins on Leaflet map |
| 7.3 | Sort by proximity | Auto-sort selected stops geographically |
| 7.4 | Mobile responsive | Optimized layout for phone use by collector |
| 7.5 | Shareable URL | Query params encode selected payment IDs |

---

### Milestone 8 — Polish & Deploy
**Deadline: October 11, 2026**

| # | Issue | Description |
|---|---|---|
| 8.1 | Error handling | Error boundaries, toast notifications, empty states |
| 8.2 | Loading states | Skeleton loaders on all data-fetching pages |
| 8.3 | Realistic seed data | Clients, orders, payments for demo |
| 8.4 | Environment config | .env.local → .env.production, secrets in Vercel |
| 8.5 | Deploy frontend | Vercel, connected to main branch |
| 8.6 | Deploy database | Railway PostgreSQL, run migrations |
| 8.7 | Smoke test | End-to-end walkthrough: create order → map → payment → route |

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Geocoding accuracy for CABA addresses | Allow manual lat/lng override on every order |
| Dump truck count going negative | Validate available count before order creation in Server Action |
| react-leaflet SSR issues | Dynamic import with `ssr: false` for all map components |
| Scope creep | Freeze scope at Milestone 4. Everything else goes to backlog |

---

## 8. Backlog (Post-MVP)

- PWA for collector (offline support, installable)
- Multi-role auth (admin, operator, collector)
- WhatsApp notifications to clients via Twilio
- Automated overdue payment alerts (cron job)
- Analytics: revenue by client, dump truck utilization rate
- Export to PDF/Excel
- PostGIS for advanced geospatial queries and proximity search
- React Native app for drivers

---

*Last updated: September 9, 2026*

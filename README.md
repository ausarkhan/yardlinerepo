# YardLine — Web

The web home field for campus events and student-run services. Phase 1 foundation:
authentication, discovery, and profiles — built against the existing YardLine Supabase
backend (no schema changes, fully compatible with the existing mobile app and users).

## Tech stack

- **Vite + React 18 + TypeScript** (the Vibecode platform serves a Vite app on port 8000;
  Next.js is not used because the live preview is wired to Vite)
- **Tailwind CSS + shadcn/ui** for styling and components
- **Supabase** (`@supabase/supabase-js`) for auth, data, and storage
- **TanStack Query** for server state, **Zustand** for auth/session state
- **React Router v6** for routing
- Mobile-first responsive design, light + dark mode

## Branding

- Gold `#F5B800` · Maroon `#8B1538` · Green `#1D7A3E`
- Backgrounds `#FAF9F7` (light) / `#1A1815` (dark)
- Headings **Outfit**, body **DM Sans**
- All tokens live in `src/index.css` + `tailwind.config.ts` (semantic Tailwind classes only)

## Environment variables (`webapp/.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe for the browser; RLS enforces access) |

The service-role key is intentionally **not** used in the frontend. All reads/writes go
through the anon key + the signed-in user's session, scoped by Supabase Row Level Security.

## Authentication

Supabase passwordless email OTP:

1. `/login` — enter email → `signInWithOtp`
2. `/verify` — enter 6-digit code → `verifyOtp`
3. On sign-in, a `profiles` row is created if one doesn't exist (`ensureProfile`)
4. Authenticated users are bounced away from `/login`; unauthenticated users are sent there

## Routes

| Route | Page |
| --- | --- |
| `/login`, `/verify` | Passwordless auth (public only) |
| `/` | Home — hero search, featured events & providers, CTAs |
| `/events` | Events directory — search, category filter, date sort |
| `/event/:id` | Event detail — RSVP (free) or ticket selection display (paid, no checkout) |
| `/services` | Services directory — search, category filter |
| `/provider/:id` | Provider profile — services, reviews, availability (display only) |
| `/profile` | Profile — edit name/handle/campus, avatar upload (persisted to Supabase) |

## Existing Supabase schema (reused as-is)

`profiles`, `events`, `event_attendees`, `service_providers`, `services`, `reviews`,
`bookings`, `stripe_connect_accounts`. Storage buckets: `avatars`, `event-photos`,
`provider-photos`. Photos stored as local `file://` paths by the mobile app are detected
and replaced with curated fallbacks (`src/lib/helpers.ts`).

## Project structure

```
src/
  lib/         supabase client, types (schema mirror), auth helpers, display helpers
  store/       Zustand auth store
  hooks/       useAuthInit, useEvents, useProviders, useReviews
  components/
    auth/      AuthLayout, ProtectedRoute, PublicOnlyRoute
    layout/    Navbar, MobileMenu, Footer, UserMenu, AppLayout
    theme/     ThemeProvider, ThemeToggle
    home/      Hero, SectionHeader, CtaCards
    events/    EventCard, RsvpCard, TicketCard
    providers/ ProviderCard, ServiceList, ReviewList
    common/    SmartImage, SearchBar, CategoryChips, EmptyState, StarRating, CardSkeleton
    brand/     Logo
  pages/       Login, Verify, Home, Events, EventDetail, Services, ProviderDetail, Profile
```

## Not in Phase 1

No Stripe / checkout / booking payments. Ticket selection and booking actions are
display-only placeholders ("coming soon").

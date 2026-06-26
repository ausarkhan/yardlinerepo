# Launch Readiness Summary

## Bugs Fixed

- Added missing profile launch fields:
  - `profiles.bio`
  - `profiles.banner`
  - `profiles.social_links`
- Added banner upload support to the existing profile editor using the existing `avatars` storage bucket.
- Added profile form synchronization for asynchronously loaded profiles so edit fields do not stay blank after session restore.
- Removed normal 404 route logging from `console.error`.
- Fixed the actionable React hook dependency warning in the creator events dashboard.
- Tightened budget attachment upload permissions so authorized budget roles can upload documents after submission/review begins, while ordinary members still cannot.
- Made Phase 7 budget storage policies deterministic on migration reruns.
- Removed a no-op hidden icon artifact from the admin budget requests UI.

## Verification Run

- `npm run build` in `webapp`: passed
- `npm run lint` in `webapp`: passed with existing Fast Refresh warnings in shadcn/ui-style modules
- `npm run typecheck` in `backend`: passed

## Remaining Known Issues

- Web bundle remains large and Vite reports a chunk-size warning. This is not a launch blocker, but route-level code splitting should be planned.
- Lint still reports Fast Refresh warnings for shared exports in UI/component modules. These are warnings, not runtime failures.
- Stripe end-to-end payment verification remains intentionally out of scope for this phase.
- Advisor review is role-based through organization membership roles; external email-only advisor approval is not implemented.
- Budget finance export is CSV only; there is no direct university accounting-system integration.

## Manual Testing Checklist

- Authentication:
  - Sign up with email OTP
  - Verify OTP
  - Refresh and confirm session persistence
  - Logout and confirm protected routes redirect to `/login`
- Profile:
  - Edit name, handle, campus, bio, and social links
  - Upload avatar
  - Upload banner
- Events and YardTix:
  - Create/edit organization and personal events
  - RSVP to a free event
  - Start paid checkout flow where Stripe is configured
  - Confirm ticket history and check-in screens load
- Services:
  - Create provider profile
  - Create/edit service
  - Submit, accept, decline, and cancel bookings
- Organizations:
  - Create organization
  - Request to join
  - Approve/deny join request
  - Change member roles
  - Post announcements
  - Create organization event
- Budget requests:
  - Create draft with line items
  - Submit for advisor review
  - Send to admin review
  - Request changes with reason
  - Approve full amount
  - Approve partial amount
  - Deny with reason
  - Upload attachments after submission
  - Add comments
  - Export CSV in admin
- Messaging and notifications:
  - Start conversation
  - Send/receive messages
  - Mark messages read
  - Verify notifications for messages, reviews, reports, org activity, bookings, and budget workflow
- Admin:
  - Open admin dashboard
  - Review users, organizations, providers, reports, and budget requests
  - Perform moderation action and verify audit log

## Security Observations

- Phase 7 budget RLS continues to rely on `public.is_admin()` and text-safe auth comparisons for production `profiles.id`.
- Budget upload permissions are limited to admins, request creators, and authorized organization budget roles.
- Budget read access is limited to admins, request creators, and organization members.
- Paid/closed budget statuses remain admin-only.
- Profile launch fields are additive and do not weaken existing profile RLS policies.
- Supabase Storage access for budget attachments remains request-scoped and private.

## Recommended Launch Blockers

- Apply all pending Supabase migrations in order through production.
- Confirm required storage buckets exist and policies are active:
  - `avatars`
  - `budget-request-attachments`
- Run manual smoke tests against production Supabase for auth, profile updates, budget attachments, notifications, and admin review.
- Confirm production backend environment variables for Supabase and Stripe are present before enabling paid workflows.
- Confirm campus finance staff have admin accounts or appropriate organization roles before budget launch.

## Nice-To-Have Future Improvements

- Route-level code splitting to reduce the main web bundle.
- Dedicated profile banner bucket or image transformation pipeline.
- External advisor approval links for advisors who do not sign into YardLine.
- Saved admin budget export presets.
- End-to-end Playwright smoke tests for the launch checklist.

# Phase 7 Summary: Budget Requests and Campus Funding Workflow

## Routes Added

- `/budget-requests`
- `/budget-requests/new`
- `/budget-requests/:id`
- `/org-dashboard/budget`
- `/admin/budget-requests`

Budget access is also integrated into `/org-dashboard` as a Budget tab and `/admin` as a Budget Requests tab.

## Tables Added

Migration: `supabase/migrations/0006_phase7_budget_requests.sql`

- `budget_requests`
- `budget_request_line_items`
- `budget_request_attachments`
- `budget_request_comments`
- `budget_request_decisions`

The migration also configures the Supabase Storage bucket metadata for:

- `budget-request-attachments`

## Permissions

- President, treasurer, officer, advisor, and admin roles can create and submit budget requests.
- Organization members can view budget requests for their organization.
- Advisors can review requests for organizations where they have the advisor/admin org role.
- Platform admins can view and manage all budget requests.
- Only admins can mark requests paid or closed.
- Denials and change requests require a reason through the workflow function.
- RLS uses text-safe auth comparisons to support production `profiles.id` stored as `text`.

## Known Limitations

- YardLine does not disburse funds in this phase.
- YardLine does not integrate with ACH, Stripe payouts, bank transfers, or university accounting systems.
- Advisor review is role-based through `organization_members`; email-only external advisor approval is not implemented.
- Finance export is CSV download from the admin UI, not a direct accounting-system integration.

## Manual Supabase Setup Needed

- Apply migrations in order through Supabase SQL editor or CLI:
  - `0004_phase5_trust_safety.sql`
  - `0005_phase6_organizations.sql`
  - `0006_phase7_budget_requests.sql`
- Confirm the Storage bucket exists:
  - `budget-request-attachments`
- Accepted attachment types:
  - PDF
  - PNG
  - JPG/JPEG
  - DOC
  - DOCX

## Remaining Launch / Deployment Tasks

- Apply the migration to production Supabase.
- Smoke test budget request creation, line-item totals, submission, admin review, attachment upload, CSV export, and notifications.
- Confirm campus staff roles are represented in `organization_members` for advisor review.
- Add any school-specific finance export columns before launch if required by the finance office.

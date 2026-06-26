# Live Organization Engagement QA Report

Date: 2026-06-26  
Branch: `live-e2e-org-engagement-qa`  
Frontend: https://yardlinerepo.vercel.app  
Backend: https://yardlinerepo-production.up.railway.app  
Supabase migration assumed applied: `0009_organization_engagement.sql`

## Accounts Used

- Creator: `ausarkhan@gmail.com` (`role=user`)
- Buyer/Admin: `markmurphy235@gmail.com` (`role=admin`)

## Live Test Data

- Primary QA organization: `YardLine Live QA 20260626171832`
- Primary QA organization ID: `21be17c2-b584-4440-9668-ca39a02a4a4c`
- Announcement ID: `54971f8c-1680-41cc-85a0-54236d67982c`
- Organization event ID: `a0fda2e3-604d-49c6-aadb-47b8336b0bd7`
- Join request ID: `160d414a-4ae2-48b8-bb13-2aacca5da50d`
- Organization inbox conversation ID: `4f650f2a-564b-48bc-b276-36c67289e1ec`
- Open/verified probe organization ID: `b9eeb303-6505-411b-8697-3359915017a0`
- Paid checkout probe event ID: `69338ebe-dbe6-4976-8f45-77092ed64706`

## What Passed

- Creator OTP login succeeded.
- Creator created a new organization.
- Creator was automatically seeded as `president`.
- Organization announcement creation succeeded and was readable from the organization feed.
- Organization event creation succeeded and was readable under the organization.
- Membership policy updates persisted for `open`, `approval_required`, and `closed`.
- Open organization direct member join succeeded.
- Buyer/admin found the organization.
- Buyer/admin submitted a rich join request with reason, classification/year, major, and interests.
- Buyer/admin messaged the shared organization inbox.
- Creator president viewed the shared organization inbox and the inbound message.
- Creator president approved the join request and buyer/admin became a member.
- Creator president replied from the organization inbox.
- Buyer/admin could read the inbox reply.
- Creator president promoted and demoted the member.
- Zero-president guardrail blocked demoting the only president with: `Organizations must have at least one active president.`
- My Organizations style data passed: joined membership rows, announcements, org events, and no remaining pending request after approval.
- Unverified organization budget creation was blocked by RLS.
- Backend health returned `200 {"status":"ok"}`.
- Vercel-to-Railway CORS preflight allowed `https://yardlinerepo.vercel.app`.
- Profile avatar and banner storage uploads passed.
- Reviews read path passed with zero reviews for the QA event.
- Notifications read path passed; creator had 2 notifications.
- Stripe checkout route created a test-mode Checkout Session successfully.

## What Failed

1. Closed organizations accepted direct join-request inserts through Supabase REST.
   - Frontend button is disabled correctly, but RLS allowed bypassing the UI.
   - First closed request created a pending row, then the next request hit `org_join_pending_idx`.

2. Malformed organization inbox conversations could be created.
   - Insert with `context_type='organization'`, `context_id='not-a-uuid'`, and `participant_b='org:not-a-uuid'` succeeded.
   - Sending a message to an invalid conversation was correctly blocked by messages RLS.

3. Verified organization budget creation failed in production.
   - `budget_can_submit(org_id)` returned `true`.
   - Creator was an active `president`.
   - Insert into `budget_requests` still failed with RLS `42501`.

4. Ordinary-member negative tests could not be cleanly completed with only the supplied accounts.
   - `markmurphy235@gmail.com` is an admin, so it can perform actions an ordinary member cannot.
   - Admin-capable actions observed from that account were not counted as ordinary-member permission failures.

## Bugs Fixed

Added `supabase/migrations/0010_org_engagement_qa_fixes.sql`:

- Restricts join-request inserts to active organizations with `membership_policy = 'approval_required'`.
- Adds a trigger preventing non-admin users from self-verifying organizations.
- Refreshes budget request create RLS to require:
  - `created_by = auth.uid()::text`
  - `budget_can_submit(organization_id)`
  - active verified organization.
- Replaces conversation insert RLS so organization conversations require:
  - valid UUID `context_id`
  - `participant_b = 'org:' || context_id`
  - existing active organization
  - requester, organization approver, or admin authorization.

## Remaining Blockers

- Apply `supabase/migrations/0010_org_engagement_qa_fixes.sql` manually in Supabase before broader user testing.
- Re-run:
  - closed organization join request negative test
  - invalid organization inbox conversation negative test
  - verified organization budget request positive test
- Use a third non-admin, non-creator account to fully validate ordinary-member negatives.

## Exact Reproduction Steps

Closed organization join RLS bypass:

1. Login as creator.
2. Create an active organization.
3. Set `membership_policy = 'closed'`.
4. Login as another authenticated user.
5. Insert into `organization_join_requests` with that org ID and requester user ID.
6. Production before fix: row is created.
7. Expected after fix: insert is denied by RLS.

Invalid organization inbox conversation:

1. Login as any authenticated user.
2. Insert into `conversations`:
   - `participant_a = auth.uid()`
   - `participant_b = 'org:not-a-uuid'`
   - `context_type = 'organization'`
   - `context_id = 'not-a-uuid'`
3. Production before fix: row is created.
4. Expected after fix: insert is denied by RLS.

Verified budget creation failure:

1. Create or obtain an active verified organization where creator is president.
2. Confirm `budget_can_submit(org_id)` returns `true`.
3. Insert a draft `budget_requests` row as that president.
4. Production before fix: RLS denies insert with `42501`.
5. Expected after fix: verified org budget request insert succeeds.

## Manual Supabase Migrations Required

- Apply: `supabase/migrations/0010_org_engagement_qa_fixes.sql`

## Verification Commands

- `npm run build` in `webapp`: passed.
- `npm run lint` in `webapp`: passed with 9 existing fast-refresh warnings.
- Backend typecheck: not run because backend code was not touched.

## Readiness

YardLine is not ready for broader user testing until `0010_org_engagement_qa_fixes.sql` is applied and the three blocked follow-up checks pass. After that, the tested organization lifecycle is broadly functional.

# Organization Engagement Summary

## Routes and Components Changed

- `webapp/src/pages/OrganizationDetail.tsx`
  - Reworked organization tabs around Announcements, Inbox, Events, Members, and About.
  - Added membership request state, verified badge display, and Message Organization entry point.
- `webapp/src/pages/OrgDashboard.tsx`
  - Added dashboard tabs for Announcements, Inbox, Events, Members, and Budget.
  - Added shared inbox management for officers/advisors, improved member lists, pending requests,
    member counts, and role controls.
  - Gated budget request access to verified organizations while preserving existing budget flow.
- `webapp/src/pages/Organizations.tsx`
  - Added a simple My Organizations section with memberships, recent announcements, and pending
    join requests.
- `webapp/src/pages/Chat.tsx`
  - Displays organization inbox conversations with organization identity instead of treating them
    as direct user chats.
- `webapp/src/components/organizations/JoinButton.tsx`
  - Added the membership request dialog with reason, classification/year, major, and interests.
  - Supports open membership, approval-required requests, closed orgs, member state, and pending
    request state.
- `webapp/src/components/organizations/MessageOrganizationDialog.tsx`
  - New dialog for starting an organization-linked conversation.
- `webapp/src/components/organizations/OrgInbox.tsx`
  - New shared inbox panel for organization leaders to review and reply to conversations.
- `webapp/src/components/organizations/JoinRequestList.tsx`
  - Shows the richer request metadata.
- `webapp/src/components/organizations/MemberManageControl.tsx`
  - Restricts member management to leaders/admins and blocks unsafe president removal/demotion.
- `webapp/src/components/organizations/OrgForm.tsx`
  - Adds membership policy editing. Verification level is intentionally not exposed to ordinary
    organization editors.
- `webapp/src/components/messaging/ConversationList.tsx`
  - Shows organization names/logos for organization-linked conversations.
- `webapp/src/hooks/useOrganizations.ts`, `webapp/src/hooks/useMessaging.ts`,
  `webapp/src/lib/organizations.ts`, and `webapp/src/lib/types.ts`
  - Added the query/mutation and type support for membership requests, My Organizations feed,
    shared organization inbox, and verification status display.

## Tables Reused or Added

- Reused `organizations`
  - Added `membership_policy` with values `open`, `approval_required`, and `closed`.
  - Added `verification_level` with values `community` and `verified`.
- Reused `organization_join_requests`
  - Added `classification_year`, `major`, and `interests`.
- Reused `organization_members`
  - Added RLS and trigger guardrails for self open-join, leader-managed role changes, member
    removal, and preventing zero active presidents.
- Reused `organization_announcements`
  - Announcements remain the existing organization announcement model.
- Reused `conversations` and `messages`
  - Organization inbox conversations use:
    - `context_type = 'organization'`
    - `context_id = organizations.id::text`
    - `participant_a = requester user id`
    - `participant_b = 'org:' || organization_id`
- No new application feature tables were added.

## Permission Model

- Members can view organization events, view allowed announcements, leave an organization, and
  message the organization.
- Open organizations allow authenticated users to join directly as active members.
- Approval-required organizations create pending join requests for officer review.
- Officers, treasurers, presidents, advisors, and admins can review join requests and reply from
  the organization inbox.
- Presidents and admins can promote/demote members and remove members.
- Ordinary members cannot promote themselves.
- Client and database guardrails prevent deleting or demoting the last active president.
- Community/unverified organizations can build membership, post announcements, host events, and
  use messaging.
- Verified organizations additionally expose budget request access and verified status display.

## Manual Supabase Migration Required

Apply:

```sql
supabase/migrations/0009_organization_engagement.sql
```

This migration is additive and policy-focused. It must be applied before the new membership
policy fields, richer join requests, open join flow, and shared organization inbox RLS work in
production.

## Known Limitations

- The shared organization inbox is intentionally not a group chat. Replies are organization-linked
  conversations between a requester and the organization leadership surface.
- Announcement comments/reactions were not added.
- Verification assignment is not exposed in the ordinary organization edit form. It should remain
  an admin/data-governed operation.
- The My Organizations feed is intentionally simple and list-based for this sprint.
- Organization inbox conversations reuse the existing direct message UI in `/chat` for the
  requester side, with organization identity added.

## Suggested Next QA Steps

- Apply migration `0009_organization_engagement.sql` to staging/production.
- Verify open, approval-required, and closed membership policies with two real test accounts.
- Confirm officers/advisors can approve and deny join requests while ordinary members cannot.
- Confirm the last active president cannot be removed or demoted.
- Send organization inbox messages as an outsider/member, then reply as president/officer/advisor.
- Confirm leadership changes do not hide existing organization inbox conversations.
- Verify public, members-only, and officers-only announcements remain governed by existing RLS.
- Verify unverified organizations cannot submit budget requests and verified organizations can use
  the unchanged budget request flow.

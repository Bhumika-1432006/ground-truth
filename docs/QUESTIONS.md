# Open questions

Answer them in place, with a name and date. Blockers first.

## Blockers

1. **Bhumika has read-only access to the repo.** She can't push branches or open PRs from them. Chirag: raise her to *Write* (Settings -> Collaborators).
2. **Ayush isn't a collaborator yet.** Invite AyushVUpadhye with Write access, or confirm he's helping without repo access.
3. **The exact submission deadline time (and timezone) on Sun 11 Oct.** We plan to submit Saturday night either way; we still need the hard cut-off.
4. **CloudFront on the account's plan** (carried over from leash#38, never confirmed). If it's blocked, we serve from the S3 website endpoint (HTTP only). See #2.

## Rules and judging (check the Environmental Hacks page; don't guess)

5. What are the judging criteria and weights? Is there a separate design or video score as at First Commit?
6. What does the submission form ask for: repo, live URL, video length limit, write-up fields, team member handles?
7. Is the spike work before the event start allowed in the repo, or should it be marked as pre-event research?
8. Must the AWS use be on a specific account or credits programme?

## Data and product

9. **OpenAQ API rate limit for our key.** About 50 stations hourly is fine; a 28-day backfill through the API is not. Plan: backfill from the archive and use the API only for the last 4 days. Confirm the limit on the key's dashboard.
10. Do we include NCR stations (Noida, Ghaziabad, Gurugram, Faridabad) on the map? Proposal: yes, because they hold the clearest physics failures (Vikas Sadan, Arya Nagar), and label them NCR.
11. Thresholds for watch and flag are a first guess (PLAN.md). Freeze them on Friday after one run on Oct-Nov 2025 data, and don't tune them to make a station we like light up.
12. Wording on the site for flagged stations. Proposal: "doesn't agree with its neighbours", "changed against its own history", "reports impossible values". Never "fake", "tampered" or "sprayed".

# Research Notes

[Purpose: capture accumulated project knowledge that cannot be derived by reading the code — findings that took real effort to discover]

## How This File Is Different

Every other steering-custom template is generated once from a codebase scan and describes *patterns* (conventions, architecture, standards). This file is the opposite:
- It starts empty, or nearly empty — there is nothing to "analyze" on day one.
- It grows continuously, one finding at a time, across many separate conversations.
- It is a catalog of *facts and answers*, not a catalog of *patterns*. That's intentional — do not try to reshape it into a patterns document, and do not fold its contents into `tech.md`/`structure.md`, which exist specifically to avoid exhaustive catalogs.

## What Qualifies

- Database table/view/field semantics that aren't self-evident from the schema (what a field actually *means*, what a table represents)
- Who/what writes to a given table or system, and when
- Behavioral differences between environments, tenants, or deployments
- Stakeholder questions and their answers
- Constraints or limitations discovered during investigation (rate limits, undocumented quirks, dialect differences)
- Anything that required non-trivial effort to find out — a debugging session, a stakeholder conversation, reading vendor docs, trial and error

## What Does NOT Qualify

- Code patterns or conventions already visible in the codebase (that belongs in `tech.md`/`structure.md` or another steering-custom file, not here)
- Git history or "who changed what" (that's what `git log`/`git blame` are for)
- Temporary task state or in-progress work
- Content scoped to a different project/repo (each project's research notes stay local to that project)

## Organization

- Organize by **topic**, not by date. Create a new `##` section per topic the first time it comes up; append to it thereafter.
- Prefer short, dense entries over narrative. State the finding, then why it matters if that's not obvious.
- If a finding is later found to be wrong or stale, correct or remove it — don't leave contradictory entries stacked on top of each other.

## Example Entry

```
## Nightly sync job — retry behavior

The `orders-sync` cron job retries a failed batch up to 3 times with a fixed
5s delay, not exponential backoff (confirmed by reading the vendor's job
scheduler logs, since this isn't documented anywhere). A batch that still
fails after 3 attempts is silently dropped, not dead-lettered — so a
transient outage longer than ~15s can lose data with no alert.
```

---
_Grows through continuous capture across conversations. No environment-specific secrets. No content that duplicates core steering or another project's notes._

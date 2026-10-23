# Research & Design Decisions

## Summary
- **Feature**: `text-widgets`
- **Discovery Scope**: New Feature (greenfield; no existing code or steering)
- **Key Findings**:
  - The latest test tooling has tight Node engine ranges (Vitest 5 requires Node `^22.12.0 || ^24`; jsdom 30 requires Node `^22.22.2`). The local machine runs Node 22.12.0, so jsdom is pinned to 28.x and Docker uses Node 24 LTS.
  - "Done typing" is best modelled as a per-widget debounce (800 ms) plus an immediate flush on blur and on page hide. Coalescing saves so that at most one is in flight per widget gives "latest text wins" without server-side versioning.
  - A JavaScript `Map` keeps insertion order and gives O(1) get/set/delete. It meets the creation-order and constant-time requirements (1.4, 4.3, 7.5) with no extra index structure.

## Research Log

### Runtime and package versions (verified with `npm view`, 2026-10-23)
- **Context**: Choose current, mutually compatible versions for a TypeScript full-stack app.
- **Sources Consulted**: npm registry metadata (`version`, `engines`, `peerDependencies`).
- **Findings**:
  - react 19.3.1, vite 8.3.5, @vitejs/plugin-react 6.1.2 (Node `^20.19 || >=22.12`).
  - vitest 5.0.5 (Node `^22.12 || ^24 || >=26`; peer vite `^6.4 || ^7 || ^8`).
  - express 5.3.0 (Node >=18) with @types/express 5.0.6; supertest 7.3.1.
  - zod 4.6.7; tsx 4.23.15.
  - @testing-library/react 16.3.3, @testing-library/user-event 14.6.8.
  - jsdom 30.1.3 requires Node `^22.22.2`, which is incompatible with local Node 22.12.0. jsdom 28.x supports `^22.12.0`.
  - TypeScript 7.x (the native Go compiler) is the latest release. 6.0.3 is the latest JS-based release.
- **Implications**: Pin `engines.node` to `>=22.12.0` and add an `.nvmrc` with `24`. Use jsdom `^28`. Use TypeScript `~6.0.3` to avoid tooling incompatibility with the TS 7 native compiler (Vite and Vitest strip types with esbuild/oxc, so `tsc` is only used for `--noEmit` type checks).

### Detecting "done typing"
- **Context**: Requirement 3 says to save when the user is done typing, without saving on every keystroke.
- **Sources Consulted**: Common autosave UX patterns (Google Docs, Notion, the Trumpet text widget help article), MDN `visibilitychange` / `pagehide` / `fetch keepalive`.
- **Findings**:
  - A trailing debounce of 500–1000 ms is the common pattern; 800 ms balances responsiveness against request volume.
  - Blur is a strong "done" signal and should flush immediately.
  - Reloading or closing the tab within the debounce window would lose text unless pending saves are flushed on `pagehide`. `fetch(..., { keepalive: true })` lets the request outlive the page (body limit 64 KiB per request).
- **Implications**: Introduce an `AutosaveScheduler` that offers debounce, flush, cancel and coalescing. Unload flushes use `keepalive`. Bodies over 64 KiB fall back to a normal fetch (best effort).

### Ordering of concurrent saves
- **Context**: Requirement 3.6 says the latest typed text must be the value finally stored.
- **Findings**: Responses to parallel requests can arrive out of order. Options are (a) server-side version numbers that reject stale writes, or (b) client-side serialisation: at most one in-flight save per widget, and if text changed meanwhile, send the newest text once the in-flight request settles.
- **Implications**: Option (b) is chosen. It is simpler, keeps the API stateless, and guarantees last-write-wins for a single tab. Multi-tab conflicts are out of scope (see Risks).

### Text length semantics
- **Context**: Requirement 5 requires at least 10,000 characters, Unicode support, and a defined maximum.
- **Findings**: The HTML `maxlength` attribute and JavaScript `String.length` both count UTF-16 code units, as does zod's `.max()`. Emoji count as 2 units. In the worst case, JSON encoding of control characters (`\u0000`) expands one unit to 6 bytes.
- **Implications**: Set `MAX_TEXT_LENGTH = 50_000` UTF-16 code units, shared by client and server. Set the Express JSON body limit to `512kb`, which covers the worst-case 300 KB plus envelope.

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Monolithic SPA + layered REST API (selected) | React SPA; Express API split into router → service → repository port; shared types package | Clear boundaries, each layer unit-testable, repository is swappable for a database | Slightly more files than a single-file server | Matches the "code quality" evaluation criterion |
| Next.js full-stack | Route handlers plus React in one framework | One toolchain | Heavier framework; SSR not needed; in-memory state is less predictable in dev/serverless | Rejected: over-engineered for the scope |
| Client-only with localStorage | No backend | Trivial | Violates "sent to the backend to be stored" | Rejected |
| WebSocket sync | Real-time push of keystrokes | Live collaboration potential | Complexity, harder to test, not required | Listed under future work |

## Design Decisions

### Decision: npm workspaces monorepo with a shared package
- **Context**: Client and server must agree on the widget shape, validation limits and the API contract.
- **Alternatives Considered**:
  1. Two independent projects that duplicate types.
  2. A monorepo with a `shared` workspace (types, zod schemas, constants).
- **Selected Approach**: Option 2, with `packages/shared`, `apps/server` and `apps/web`.
- **Rationale**: One source of truth for `Widget`, `MAX_TEXT_LENGTH` and request schemas, which removes drift.
- **Trade-offs**: Requires workspace-aware build ordering. Mitigated by compiling the shared package with TypeScript project references, or consuming its TS source directly through Vite/tsx.

### Decision: Server-generated IDs, widget appended after creation response
- **Context**: Requirement 1.5 says a widget must persist on creation.
- **Alternatives Considered**:
  1. Optimistic insert with a client-generated UUID and an idempotent `PUT`.
  2. `POST` returns a server-generated UUID and the client appends on success.
- **Selected Approach**: Option 2.
- **Rationale**: Simpler contract, no ID trust or validation of client IDs, and no reconciliation. Latency on a local API is negligible.
- **Trade-offs**: The widget appears after one round trip. The add button shows a pending state. Each click issues its own request (1.3).
- **Follow-up**: Revisit option 1 if offline support is added.

### Decision: Draft text owned locally by each widget component
- **Context**: Efficiency. A keystroke in one widget must not re-render every widget, especially with large text.
- **Alternatives Considered**:
  1. Global reducer holding all texts.
  2. Board holds the widget list (id, saved text). Each `TextWidget` owns its draft text and save status. Widgets are memoised.
- **Selected Approach**: Option 2.
- **Rationale**: A keystroke costs one component render and O(1) state update, regardless of widget count. It also naturally enforces independence (2.2, 2.3).
- **Trade-offs**: Board-level "unsaved changes" aggregation needs the scheduler (which tracks pending IDs) rather than React state.

### Decision: Repository port with an in-memory adapter
- **Context**: The tips allow in-memory storage. Code quality favours replaceable persistence.
- **Selected Approach**: A `WidgetRepository` interface with an `InMemoryWidgetRepository` backed by `Map<WidgetId, Widget>`.
- **Trade-offs**: Data is lost on server restart (accepted per 4.6). A SQLite or file adapter is future work.

### Decision: Single deployable in production/Docker
- **Context**: Bonus Docker requirement (10.7) with a single command.
- **Selected Approach**: A multi-stage Dockerfile builds the web bundle and server. Express serves the static SPA and `/api` on one port (3000). In development, Vite (5173) proxies `/api` to the server (3001).
- **Rationale**: Same-origin in every environment means no CORS configuration and one container.

## Risks & Mitigations
- **Text lost on tab close within the debounce window.** Flush on `pagehide`/`visibilitychange=hidden` using `fetch keepalive`.
- **Multi-tab concurrent edits overwrite each other (last write wins).** Documented as a tradeoff. Future work: an optimistic concurrency `version` field and `409` conflicts.
- **jsdom/Node engine mismatch on a reviewer's machine.** Pin versions, add `.nvmrc`, and document Node ≥ 22.12 in the README. Docker is an alternative path.
- **Unbounded widget count.** Memory grows linearly. Acceptable for the challenge scope. Future work: pagination and a per-pod limit.
- **Concurrent create requests resolve out of order.** Rare, and list order on reload reflects server arrival order. Accepted.

## References
- [Trumpet: How do I add text to a pod](https://intercom.help/trumpet/en/articles/6389888-how-do-i-add-text-to-a-pod) — product context for text widgets
- [MDN: fetch keepalive](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#keepalive) — unload-safe saves (64 KiB limit)
- [MDN: Page Lifecycle / pagehide](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event) — flush trigger
- [MDN: maxlength](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/maxlength) — counts UTF-16 code units
- [Express 5 docs](https://expressjs.com/en/5x/api.html) — `express.json({ limit })`, async error propagation
- [Vitest docs](https://vitest.dev/guide/) — projects/workspaces, fake timers
- [Testing Library user-event](https://testing-library.com/docs/user-event/intro) — realistic typing simulation

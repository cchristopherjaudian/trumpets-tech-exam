# Implementation Plan

> Commit to Git at the end of every sub-task with a descriptive message so the history reflects incremental progress (10.6).

- [ ] 1. Workspace foundation and shared contract
- [x] 1.1 Set up the version-controlled TypeScript monorepo and test runner
  - Initialise Git with an ignore list covering dependencies, build output, coverage and environment files.
  - Create a workspace layout with separate server, web and shared packages, plus a strict TypeScript base configuration that every package extends.
  - Pin the Node version (≥ 22.12, Docker on 24) through engines and a version file, and pin compatible tool versions as recorded in the design.
  - Configure a single test command that runs every package's tests and reports pass/fail, plus a type-check command.
  - Add a trivial passing test to prove the runner discovers all packages.
  - Ensure no secrets or machine-specific configuration are committed.
  - _Requirements: 9.5, 10.6, 10.8_

- [x] 1.2 Define the shared widget contract used by client and server
  - Describe the widget model (unique identifier, text, creation and last-updated timestamps) and the list response shape.
  - Define the maximum text length (50,000 UTF-16 code units) as one shared constant.
  - Define validation schemas for creating a widget (optional text, default empty), updating text (required string within the limit) and widget identifiers (UUID).
  - Define the uniform error envelope and its error codes (validation, not found, payload too large, internal).
  - Unit-test the schemas: accept empty, 1,000, 10,000 and 50,000-character strings and Unicode/emoji. Reject non-string text, over-limit text and malformed identifiers.
  - _Requirements: 5.1, 5.3, 5.4, 5.5, 7.2, 7.4, 7.6_

- [ ] 2. Widget Service backend
- [x] 2.1 (P) Build the in-memory widget store
  - Store widgets keyed by identifier with constant-time get, insert, update and delete.
  - Return widgets in creation order, and keep a widget's position unchanged when its text is updated.
  - Return copies so callers cannot mutate stored data.
  - Unit-test ordering after inserts, updates and deletes, the result of deleting a missing widget, and copy isolation.
  - Can run in parallel with 3.1–3.4: it only depends on the shared contract from 1.2.
  - _Requirements: 1.4, 4.6, 7.5_

- [x] 2.2 Implement widget lifecycle rules in the service layer
  - Create a widget with a server-generated unique identifier, the provided or empty text, and matching creation and update timestamps.
  - Update a widget's text and refresh its last-updated timestamp while keeping its identifier, creation time and position.
  - Delete a widget. Report a not-found outcome for unknown identifiers on update and delete, without throwing.
  - Inject the clock and identifier generator so tests are deterministic.
  - Unit-test create, list, update, delete and not-found paths, including that a failed operation leaves stored data unchanged.
  - Depends on 2.1.
  - _Requirements: 1.5, 3.7, 6.3, 7.1, 7.3_

- [x] 2.3 Expose the REST API with boundary validation and uniform errors
  - Provide endpoints to list, create, update the text of, and delete widgets, plus a health check, all exchanging JSON.
  - Validate request bodies and identifiers against the shared schemas before reaching the service. Respond with validation errors and field details on failure.
  - Limit request body size (512 KB). Map oversize bodies to "payload too large" and malformed JSON to a validation error.
  - Map not-found outcomes and unknown API routes to not-found errors. Map unexpected failures to a generic internal error and log the details server-side only.
  - Build the application through a composition function that accepts storage, clock and ID generator overrides, with a separate entry point that reads the port from the environment and starts listening.
  - Depends on 2.2.
  - _Requirements: 5.4, 7.1, 7.3, 7.4, 7.6_

- [x] 2.4 Test the API end to end against the composed application
  - Cover the full flow: create, then list in creation order, update text, list again, delete, and confirm the widget is no longer listed.
  - Verify a 1,000-character string and a Unicode/emoji string with line breaks are stored and returned identically.
  - Verify over-limit text and non-string text are rejected with validation errors and the previously stored text is unchanged.
  - Verify oversize bodies, malformed JSON, invalid identifiers and unknown identifiers return the correct status and error envelope.
  - _Requirements: 1.5, 2.5, 5.2, 5.3, 5.4, 5.5, 6.3, 7.1, 7.3, 7.4, 9.1, 9.3_

- [ ] 3. Widget App foundations
- [x] 3.1 Scaffold the React web application and its test environment
  - Create the single-page app with a development server that proxies API requests to the backend (same origin, no CORS).
  - Configure component tests with a DOM environment (jsdom 28.x), Testing Library and user-event, integrated with the root test command.
  - Add a single minimal stylesheet covering layout column, spacing, widget borders, whitespace-preserving text and save-status colours.
  - Render a placeholder page and a smoke test proving the setup works.
  - _Requirements: 8.4, 9.5_

- [ ] 3.2 (P) Build the reusable UI primitives
  - A button used for every action in the interface, with primary, secondary and danger variants, defaulting to a non-submit button.
  - A generic labelled multi-line text input. It reports changed values, enforces the shared maximum length, optionally shows a character counter, and preserves whitespace and line breaks.
  - A bordered widget container with a title, an actions area and a footer, able to host any widget type and exposed as a labelled region.
  - A save-status indicator announcing "saving", "saved", "unsaved" and "error" politely to assistive technology.
  - An alert component with optional retry and dismiss actions.
  - Unit-test each primitive for rendering, accessible labelling and callback behaviour, including that the text input accepts 10,000 characters.
  - Depends on 3.1. Can run in parallel with 3.3 and 3.4.
  - _Requirements: 1.6, 2.1, 2.4, 2.5, 3.8, 5.1, 8.1, 8.2, 8.3, 8.4, 8.5, 9.4_

- [ ] 3.3 (P) Build the typed API client
  - Wrap the four widget operations so each returns an explicit success or failure result instead of throwing, distinguishing HTTP errors (with status and error code) from network failures.
  - Support an "outlive the page" option for saves, applied only when the payload is under the browser's 60 KB keepalive budget.
  - Make the client injectable into the component tree so tests can substitute a fake.
  - Unit-test with a stubbed fetch: success parsing, HTTP error envelope mapping, network failure mapping, Unicode text round-trip encoding, and the keepalive threshold.
  - Depends on 1.2 and 3.1. Can run in parallel with 3.2 and 3.4.
  - _Requirements: 3.7, 4.1, 5.5, 6.2_

- [ ] 3.4 (P) Build the framework-independent autosave scheduler
  - Track each widget's last saved text, current draft and save status independently.
  - Restart a per-widget idle timer (800 ms) on every change. Save when it fires, or immediately on an explicit flush.
  - Skip saving when the draft equals the last saved text, and return the status to "saved" if the user reverts their edits.
  - Allow at most one in-flight save per widget. Coalesce changes made during a save into a single follow-up save of the newest text.
  - On failure mark the widget "error" and keep the draft for retry. Support flushing all dirty widgets at once for page hide.
  - Cancel a widget's timer and pending state on request, and ignore late responses for cancelled widgets.
  - Unit-test every rule above with fake timers and a controllable save function, including out-of-order completion.
  - Depends on 1.2 (types only). The save function is injected, so this can run in parallel with 3.2 and 3.3.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 6.6_

- [ ] 4. Widget App features
- [ ] 4.1 Provide app-wide services and unload-safe saving
  - Create one API client and one autosave scheduler for the app and make them available to all components.
  - Connect the scheduler's save action to the API client's text update.
  - Flush all pending saves with the keepalive option when the page is hidden or about to unload, and dispose cleanly on unmount.
  - Test that hiding the page triggers a flush of dirty widgets.
  - Depends on 3.3 and 3.4.
  - _Requirements: 3.2, 4.2_

- [ ] 4.2 Implement board state: load, add and delete
  - Load all widgets on start with distinct loading, ready and error phases, and support retrying a failed load.
  - Seed the scheduler's saved baseline for each loaded or newly created widget.
  - Add a widget per click by requesting creation from the backend and appending the result in order. Track pending creations without blocking further clicks, and surface creation failures as a dismissible notice.
  - Delete a widget optimistically: cancel its pending save, remove it from the list, and request deletion. On failure, restore it at its original position and show a notice. Treat "already gone" as success.
  - Unit-test the state transitions, including rollback ordering.
  - Depends on 4.1.
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 4.1, 4.3, 4.5, 6.2, 6.4, 6.5, 6.6_

- [ ] 4.3 Build the text widget with independent editing and autosave
  - Hold each widget's draft text locally, initialised from its stored text, so editing one widget never affects another or re-renders siblings.
  - Send every change to the scheduler, flush on blur, and display the live save status with a retry action in the error state.
  - Render inside the bordered container with an accessible text input label and a delete control labelled with the widget's position.
  - Memoise the widget so typing elsewhere does not re-render it.
  - Depends on 3.2 and 4.1.
  - _Requirements: 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.8, 5.6, 6.1_

- [ ] 4.4 Compose the widget board page
  - Show a header with the "Add widget" button and a pending indicator while creations are in flight.
  - Show a loading indicator while widgets load, an alert with retry if loading fails, and an empty-state message when there are no widgets.
  - Render widgets in stored order, keyed by identifier, and display action notices for create and delete failures.
  - Mount the board as the application root.
  - Depends on 4.2 and 4.3.
  - _Requirements: 1.1, 1.2, 1.7, 4.2, 4.3, 4.4, 4.5, 6.5_

- [ ] 4.5 Test the board's user flows with a fake API
  - Clicking "Add widget" repeatedly adds one bordered widget per click, in order. The empty state disappears after the first widget.
  - Typing in one widget leaves other widgets' text unchanged. Exactly one save is sent after the idle period, and one on blur, containing only that widget's text.
  - On mount, stored widgets render with their exact saved text (including a 1,000-character string) in original order. Loading and error-with-retry states render correctly.
  - Deleting removes only that widget. A failed delete restores it in place with an error alert. A pending save for a deleted widget is never sent.
  - Performance sanity: with 50 widgets and 10,000-character text, typing in one widget re-renders only that widget.
  - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 2.2, 2.3, 3.1, 3.2, 3.4, 4.2, 4.3, 4.4, 4.5, 5.2, 5.6, 6.2, 6.4, 6.5, 6.6, 9.2, 9.3_

- [ ] 5. Integration and packaging
- [ ] 5.1 Wire the production build and single-origin serving
  - Have the backend optionally serve the built web app and fall back to the app's entry page for non-API routes.
  - Provide root commands to run both apps together in development, build all packages in dependency order, and start the production build on one port.
  - Add an API test confirming static hosting and the fallback do not shadow API routes or API 404s.
  - Manually smoke-test the production build: add widgets, type, reload, confirm text is restored, delete, reload.
  - Depends on 2.3 and 4.4.
  - _Requirements: 4.2, 7.6, 10.1_

- [ ] 5.2 (P) Containerise the application
  - Multi-stage image: install dependencies, build all packages, then a slim runtime on Node 24 with production dependencies only, running as a non-root user.
  - Configure the runtime to serve the web build and API on port 3000, with a health check against the health endpoint.
  - Provide a compose file and an ignore file so a single documented command builds and starts the app.
  - Verify the container starts, reports healthy, and passes the same manual smoke test.
  - Depends on 5.1. Can run in parallel with 5.3.
  - _Requirements: 10.7_

- [ ] 5.3 (P) Write the project README
  - Prerequisites and step-by-step instructions to install, run in development, run the production build, run with Docker, and run tests and type checks.
  - Explain the architecture, the implementation approach and key choices: the "done typing" definition, coalesced saves, local draft state, the shared contract, and the repository port.
  - Discuss tradeoffs (in-memory storage, last-write-wins across tabs, server-generated IDs) and what would be done with more time.
  - Document the AI-assisted spec-driven workflow and the prompts used.
  - Confirm the repository is ready to publish publicly, with no secrets or machine-specific paths.
  - Can run in parallel with 5.2.
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.8_

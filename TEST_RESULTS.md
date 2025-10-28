# Test Report — October 27, 2025

## Summary
- Test Suites: 13 passed, 13 total
- Tests: 66 passed, 66 total
- Snapshots: 0
- Time: ~3s (local CI run)

# Test Report — October 28, 2025

## Summary
- Test Suites: 28 passed, 28 total
- Tests: 106 passed, 106 total
- Snapshots: 0
- Time: ~6.5s (local CI run)
- Coverage: 36.33% lines, 21.91% branches, 31.54% functions

All current unit and integration tests are passing.

## What's covered

### API Routes (12 test files)
  - `/api/summarize` — request validation, guest mode behavior, logged-in save flow
  - `/api/search` — validation, embedding pipeline, semantic search
  - `/api/transcribe` — file upload handling, Groq transcription
  - `/api/workspaces` — auth gating, listing, creation
  - `/api/folders` — auth gating, listing, creation
  - `/api/folders/[id]` — GET single folder, PATCH updates, DELETE
  - `/api/canvases` — list and create canvases with auth
  - `/api/canvases/[id]` — GET canvas with nodes/edges, PATCH updates, DELETE
  - `/api/templates` — list system/user templates, create custom
  - `/api/templates/[id]` — GET, POST (use template), DELETE
  - `/api/analytics` — GET analytics data with range, POST track events
  - `/api/share/[shareId]` — public note sharing without auth
  - **Auth/Security tests** — 401/403 permission boundaries verified

### Components (9 test files)
  - `AnalyticsDashboard` — loading states, data rendering, chart display, range selection
  - `CanvasEditor` — toolbar, node management, save/export flows, ReactFlow integration
  - `FolderSidebar` — empty state, folder selection, fetch mocking
  - `WorkspaceManager` — initial load, workspace creation flow
  - UI Components:
    - `Button` — variants, sizes, disabled states, click handlers
    - `Dialog` — open/close, content, accessibility
    - `Card` — structure, header, content, footer
    - `Input` — rendering, props, disabled state

### Libraries / Utilities (7 test files)
  - `lib/logger` — levels, metadata, request/response logging
  - `lib/encryption` — encrypt/decrypt, password hashing/verification
  - `lib/calendarLinks` — provider URL formats and ICS generation
  - `lib/utils` — className merger (cn) behavior
  - `lib/supabase` — client initialization
  - `lib/i18n` — resource presence and key checks
  - `lib/groq` — summary structure contract
  - `lib/guestMode` — usage and limits

## Key test infrastructure
- Test runner: Jest (jsdom environment)
- Setup file: `jest.setup.js`
  - Provides window and speech API stubs
  - Adds minimal Web API polyfills needed for Next.js routes in Jest:
    - Response.json static helper (when missing)
  - Mocks env vars for Supabase and Groq SDK

- ESM/SDK mocks (to avoid importing heavy browser-incompatible code):
  - `@xenova/transformers` (pipeline) — mocked factory returning a small vector
  - `groq-sdk` — mocked factory returning predictable responses
  - `@/lib/supabase` — mocked singleton for routes using it directly
  - `recharts` — mocked for component tests to avoid DOM/ResizeObserver issues
  - `reactflow` — mocked for canvas editor tests

## How to run
- Run all tests:

```bash
npm test
```

- Include coverage report:

```bash
npm test -- --coverage
```

Coverage thresholds are configured in `jest.config.js` (global 35% lines, 20% branches, 30% functions). Thresholds are realistic based on current test breadth and will increase as more components and pages are tested.

## Notes and learnings
- Next.js Response helpers (NextResponse.json) expect a compatible `Response.json` static method in the environment. We added a minimal shim in `jest.setup.js` so route handlers work seamlessly in Jest.
- ESM-only packages (e.g., `@xenova/transformers`) must be mocked before importing route modules to prevent Jest from attempting to parse their source.
- For server-only SDKs (`groq-sdk`), tests mock the module or the higher-level wrapper (`@/lib/groq`) before dynamically importing the route that uses them.
- Where appropriate, assertions focus on HTTP status for validation failures to avoid environment-specific body shape differences.
- Heavy UI libraries (recharts, reactflow) are mocked to simple pass-through components for faster, more reliable tests.

## Quality gates
- Build: PASS (project builds successfully)
- Lint/Typecheck: PASS (no TypeScript errors in tests or source)
- Tests: PASS (28/28 suites, 106/106 tests)
- Coverage: 36.33% lines (above 35% threshold)

## Next steps
To increase coverage further:
- Add more component tests: SummarizerApp, History, SearchBar, TemplateSelector, VoiceInputButton, EncryptionDialog, LanguageSelector, NavigationMenu
- Test page components: app/page.tsx, app/analytics/page.tsx, app/canvas/[id]/page.tsx
- Add integration tests for complex user flows (e.g., full summarization workflow with save)
- Test custom hooks: useSpeech, useVoiceInput
- Add E2E tests with Playwright for critical user journeys
- Gradually increase coverage thresholds as more code is tested

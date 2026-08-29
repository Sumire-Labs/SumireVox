# API audit and remediation progress

## Goal

Perform an evidence-based security, correctness, compatibility, and test audit
of `apps/api`, safely remediate confirmed material findings, and preserve the
published API contract unless a documented security correction requires change.

## Delivery plan and Oracle gates

1. **Repository and API contract mapping** — owners: `@explorer` (route/docs
   inventory; auth/validation/error/test topology), orchestrator (reconcile).
   Gate 1 reviews coverage and scope before risk findings are acted on.
2. **Evidence-based audit and reproduction** — owners: `@explorer` (endpoint
   review), `@librarian` only if version-specific Hono/Stripe behavior requires
   authoritative confirmation; `@fixer` owns the audit record and focused
   regression reproductions. Gate 2 reviews severity, compatibility, and fix
   priorities.
3. **Remediation and regression tests** — owner: `@fixer` for bounded API,
   test, and documentation edits; no UI scope. Gate 3 reviews security,
   behavior, and maintainability of the delivered changes.
4. **Final verification and reporting** — owners: orchestrator (project
   commands and reconciliation), `@explorer` for post-change structural scan
   if module boundaries change. Gate 4 reviews final release risk and residual
   findings.

Every gate has one initial Oracle review, with up to two re-reviews only when
the remediation changes the reviewed decision/risk or cannot be verified by
focused evidence.

## Current phase

Phase 1 — in progress. Establish factual repository/API inventory and baseline
state before deriving audit findings.

## Baseline

- Deepwork ignore rules verified and added on 2026-08-18:
  `.gitignore` includes `.slim/deepwork/`; `.ignore` includes the two required
  negated paths.
- The baseline worktree already contains uncommitted API, Prisma, Nginx, test,
  and documentation changes. They will be treated as pre-existing work: no
  reset, discard, or unrelated commit will be made. Later remediation ownership
  will be narrowed after the Phase 1 inventory identifies file overlap.
- No code, API behavior, or production infrastructure has been touched by this
  deepwork session.

## Evidence and findings

### Accepted Phase 1 security-topology evidence

- Authentication and authorisation controls are mapped in
  `apps/api/src/middleware/{session-middleware,require-auth,require-guild-admin,require-bot-admin}.ts`;
  routes apply router-level authentication and guild/bot-admin checks as
  appropriate. Ownership checks exist for boost assignment in
  `apps/api/src/services/boost-service.ts`.
- Validation is Zod-based (`apps/api/src/middleware/validate.ts`) and rejects
  unknown fields for strict schemas; route/service coverage is uneven.
- CORS has an explicit configured origin and credential support
  (`apps/api/src/index.ts`); cookies are HttpOnly, production-Secure, and
  SameSite=Lax (`apps/api/src/routes/auth.ts`).
- Error responses use the documented envelope via `AppError`; unexpected
  exceptions return a non-leaking 500 (`apps/api/src/middleware/error-handler.ts`).
- Preliminary issues requiring Phase 2 reproduction or contract review:
  unconstrained channel/boost guild IDs; no configured request body limit;
  trusted forwarded-IP rate-limit keys; partial endpoint rate limiting; missing
  explicit Stripe/Redis operation bounds; non-transactional boost
  reconciliation; and significant missing middleware/route tests. See the
  Phase 1 specialist result for exact locations until the audit record is
  produced.
- These items are hypotheses or coverage gaps, not confirmed vulnerabilities.
  Proxy configuration, Stripe SDK defaults, Redis failure behaviour, CSRF
  exposure, and concurrent reconciliation must be verified before remediation.

### Pending Phase 1 evidence

None.

### Accepted Phase 1 API-contract evidence

- `apps/api/src/index.ts` is the Hono entry point. It mounts the webhook before
  session middleware, exposes `/health`, and has no path-based API versioning
  or OpenAPI/Swagger definition.
- The API inventory spans auth, guild, dictionary, user/boost, Stripe webhook,
  bot-admin, VOICEVOX, bot-instance, and health routes. The successful API
  response envelope is `{ success: true, data }`; errors are
  `{ success: false, error: { code, message } }`, except the Stripe webhook's
  intentional `{ received: true }` acknowledgement.
- All documented endpoints in `docs/api-endpoints.md` have implementations.
  Confirmed contract/documentation issues are inconsistent expired-Discord-token
  error codes and several under-specified response/error shapes.
- Route-level tests currently cover only the Stripe webhook. Auth, user,
  guild, admin, dictionary, VOICEVOX, bot-instance, health, and most
  middleware authorization/error paths lack direct coverage.
- Package commands and prerequisites are recorded in `AGENTS.md` and
  `apps/api/package.json`: generate Prisma before typecheck/build and build the
  shared package before isolated API build. `pnpm lint` is intentionally a no-op.

## Phase 1 completion record

- Goal: establish an implementation-and-documentation inventory and security
  control topology without changing API behaviour.
- Evidence: independent reconnaissance sessions `exp-1` and `exp-2`; relevant
  local files are listed above and in their session reports.
- Changed tracked paths: `.gitignore`, `.ignore` only (required Deepwork local
  state visibility rules). No API implementation was changed.
- Validation: ignore entries were inspected before modification; both required
  entries were absent and added once. Worktree baseline revealed unrelated,
  pre-existing API changes that remain untouched.
- Commit: `570c9a3 chore(deepwork): initialize local progress state` (only
  `.gitignore` and `.ignore`).
- Gate 1 decision/risk: confirm that the Phase 2 audit scope covers every
  public route and high-risk cross-cutting control without treating unverified
  hypotheses as confirmed security defects.

## Gate 1 — conditionally approved, reconciled

Oracle review `ora-1` accepted the Phase 1 factual inventory subject to the
following Phase 2 scope amendments. These are required evidence checks, not
confirmed defects:

1. Produce an endpoint-by-control matrix for every public route: authN, authZ,
   validation, error-envelope behaviour, rate limiting, and test evidence.
2. Test and document default 404/405 behaviour against the API envelope
   contract (`apps/api/src/index.ts`).
3. Treat forwarded-IP trust as deployment-dependent; inspect repository proxy
   evidence but do not equate uncommitted Nginx files with production truth.
   If independent infrastructure evidence is unavailable, mark it unverified.
4. Resolve the scope overlap with pre-existing tests before any audit test is
   written; never overwrite or commit those changes as this session's work.
5. Verify Stripe outbox processing idempotency or document the single-process
   operational assumption; limit the boost-reconciliation race analysis to its
   startup-only, non-transactional scope.
6. Verify the Redis-degraded behaviour of `/health` and client/subscriber
   command bounds.
7. Enumerate each documentation/contract gap precisely, including VOICEVOX
   auth placement, configured CORS origin, expired-token error-code choice, and
   observable null/approval response shapes.
8. Correct the test-coverage record: validation and rate-limit middleware have
   limited tests; the listed auth/error/session middleware and all non-webhook
   route handlers remain untested.

Optional hardening (broad endpoint rate limits, explicit Node server timeouts,
OpenAPI/versioning) is out of the confirmed-finding path unless Phase 2 yields
evidence of a current behavioural defect. Refresh-token UX remains a required
contract decision but may be accepted as intentional.

No Gate 1 re-review is needed: this is a bounded scope-record update, and the
reviewed decision/risk is unchanged. Phase 2 may proceed.

## Current phase

Phase 2 — in progress. Build per-route evidence, reproduce only confirmed
contract/control faults, and document severity, compatibility, and the safe
remediation set before any code changes.

### Active Phase 2 evidence lanes

- `exp-1` (read-only): endpoint-by-control matrix and pre-existing test overlap.
- `exp-2` (read-only): source-level risk evidence and safe reproduction design.
- `lib-1` (read-only): version-qualified official Hono, Node adapter, and Stripe
  defaults. The parent orchestrator owns evidence reconciliation and all later
  validation; no lane may change project files.

### Accepted Phase 2 evidence: route-control matrix

- The matrix covers 45 public endpoints, including the Stripe webhook and
  health check. Its authoritative working record is the `exp-1` session result;
  route definitions and exact control citations are in
  `apps/api/src/{index,routes,middleware,schemas,services}`.
- Every non-webhook route handler lacks direct route tests. Existing direct
  middleware tests are limited to validation and a single rate-limit case.
- Pre-existing, uncommitted Stripe/outbox source and test work owns the webhook
  test surface. This session must not add, move, alter, or commit webhook/outbox
  tests or their implementation without an explicit overlap decision. No
  pending test change touches the other route families.

### Accepted Phase 2 evidence: source-level risk review

- Confirmed against the documented API contract: `apps/api/src/index.ts` has no
  unmatched-route handler, so unknown paths and unsupported methods bypass the
  JSON error envelope. This is a candidate material compatibility fix.
- Confirmed deployment-independent inconsistencies: boost assignment and some
  channel identifiers accept arbitrary non-empty strings; production Nginx has
  a 10 MiB request limit while direct/dev API access has no app-level limit;
  expired Discord-token codes and several docs route/auth/response descriptions
  are inconsistent.
- Redis session reads may queue or fail during Redis outage because the main
  client has default offline-queue semantics. The `/health` handler itself does
  not contact Redis/DB, but upstream session middleware reads Redis when a
  request carries a session cookie. Exact outage timing requires local
  reproduction.
- Forwarded-IP rate limiting is correct with the current repository Nginx
  overwrite/append configuration but remains deployment-dependent; direct API
  exposure would permit spoofed header keys. The repository configuration is
  evidence of intended deployment only, **not evidence of deployed production
  infrastructure**.
- The refresh token is stored but unused; this is a confirmed session-lifecycle
  contract choice requiring an explicit accept-or-fix decision, not an automatic
  security finding.
- Outbox multi-process locking and reconciliation races apply to uncommitted
  worktree code. Their impact remains unverified and must not be reported as a
  current deployed API defect without an explicit worktree-ownership decision.

### Accepted Phase 2 external evidence

- Resolved package versions: Hono 4.12.8, `@hono/node-server` 1.19.11, and
  Stripe 17.7.0. Hono 4.12.8 defaults unmatched and wrong-method requests to
  plain-text 404; it cannot use the later `methodNotAllowed` middleware without
  a dependency upgrade. `app.notFound` is available for a JSON 404 correction.
- Hono 4.12.8 provides `bodyLimit`; the Node adapter and Node HTTP server do
  not impose a body-size bound. The library provides an app-layer remediation
  that can align with the existing Nginx 10 MiB policy without changing the
  public request schema.
- Stripe 17.7.0 defaults to an 80-second timeout and two network retries.
  These are explicit, finite bounds, so lack of a client override is not a
  confirmed unbounded-wait defect. Whether 80 seconds is acceptable remains an
  operational policy decision, not a required compatibility fix.
- `@hono/node-server` can pass Node server timeout settings through
  `serverOptions`; absent an observed slow-request exposure, changing these is
  deferred hardening rather than an audit remediation.

### Scope amendment — 2026-08-18

The user authorized integration of the pre-existing, uncommitted API worktree
changes into this audit and remediation. They are now in scope for review,
testing, correction, documentation, and eventual focused commits; no baseline
change may be discarded. The active documentation lane was launched under the
former isolation rule, so its wording will be amended after it completes before
the Phase 2 record is accepted.

### Phase 2 verification plan

- **F-01 claim:** actual API construction returns the documented JSON error
  envelope for unmatched paths. Current evidence is Hono's documented
  plain-text default. A durable `createApp` test affordance will isolate the
  route assembly from process startup, then a focused app test will first
  record the current 404 behaviour without DB/Redis/network dependencies.
- **F-02/F-03/F-04 claim:** body-size, Snowflake, and expired-token semantics
  are applied at the public route boundary. Route-level tests are preferred;
  if router dependencies prevent isolation, the record will retain exact manual
  reproduction steps rather than introduce broad mocks or unrelated refactors.
- **F-07/F-09 claim:** failure and proxy behaviour are environment-bound.
  Local mocks/config tests can establish intended code paths, but only a
  controlled Redis/Nginx integration run can establish outage/deployment
  behaviour. No production request is permitted.
- **Outbox/reconciliation claim:** concurrent handling must preserve one event
  processing attempt and boost allocation invariants. Deterministic Prisma
  mocks with forced interleaving are preferred to external services. Tests will
  prove a current gap or constrain it as unverified.
- Validation budget: focused test owner(s) establish the claims above; the
  parent runs the relevant API tests, then the complete monorepo build/test
  only after remediation changes the implementation.

## Phase 2 completion record (pending Gate 2)

- Goal: establish endpoint coverage, distinguish confirmed defects from
  unverified/deployment-bound risks, and add a durable test seam without
  prematurely changing API behaviour.
- Changed paths: `docs/api-audit-2026-08-18.md`, `apps/api/src/app.ts`,
  `apps/api/src/index.ts`, and `apps/api/src/app.test.ts`.
- Evidence: the audit record contains the 45-route matrix, findings, source
  references, official dependency facts, planned local test cases, and the
  user-approved integration scope for existing worktree changes.
- Verification affordance: `createApp()` extracts only route assembly from
  process startup. `app.test.ts` records the current Hono plain-text 404 for an
  unmatched path and wrong `/health` method before remediation.
- Runtime validation blocker: direct `command -v node`, `pnpm`, and `corepack`
  produced no executable path. Therefore the focused test command and all
  TypeScript/build/test validation are unexecuted, not inferred to pass.
- Gate 2 decision/risk: confirm severity and the smallest safe fix set given
  user-authorized integration of existing worktree changes, determine which
  concerns must remain documented/unverified until a Node-capable environment
  is available, and reject any over-broad refactor or incompatible API change.

## Gate 2 — approved, reconciled

Oracle review `ora-1` approved Phase 3 with this bounded remediation set:

1. Add a JSON `NOT_FOUND` 404 handler and turn the baseline app test into the
   corrected contract test. Hono 4.12.8 must document wrong methods as 404;
   dependency upgrade/405 middleware is out of scope.
2. Require a Discord Snowflake for user boost-assignment `guildId` only. Do not
   expand into channel-ID validation in this phase.
3. Make `SESSION_EXPIRED` the canonical client-visible Discord-token expiry
   code by mapping the guild-admin boundary locally; do not rewrite errors
   globally.
4. Correct the corresponding API documentation (VOICEVOX and dictionary auth,
   CORS environment configuration, 404/incorrect-method contract, and the
   client-visible token-error table).

The body-limit, Stripe timeout, Node server timeout, refresh-token flow,
Redis-outage change, forwarded-IP handling, outbox process locking, and boost
reconciliation concurrency are explicitly deferred or blocked by runtime /
deployment evidence. No security control may be weakened.

Phase 2 runtime tests remain unexecuted because the environment has no Node,
pnpm, or corepack. This limitation is accepted only for static Phase 3 work;
Gate 3 cannot approve without API test and build evidence from a Node-capable
environment. The factual `/health` statement was corrected above following
the Oracle review. No Gate 2 re-review is necessary.

## Current phase

Phase 3 — in progress. Amend the published contract documentation, then apply
only the four approved corrections with focused tests and static reconciliation.

## Phase 3 completion record (pending Gate 3)

- Goal: safely remediate only the Gate 2-approved API contract, input
  validation, token-expiry consistency, and documentation gaps.
- Changed implementation/test paths: `apps/api/src/app.ts`,
  `apps/api/src/index.ts`, `apps/api/src/app.test.ts`,
  `apps/api/src/routes/user.ts`,
  `apps/api/src/middleware/require-guild-admin.ts`,
  `apps/api/src/middleware/__tests__/require-guild-admin.test.ts`, and
  `apps/api/src/routes/__tests__/user-boost-assign.test.ts`.
- Changed documentation: `docs/api-endpoints.md` and
  `docs/api-audit-2026-08-18.md` now record the API contract and the applied
  status without claiming unexecuted tests pass.
- Applied behaviour: unmatched paths and wrong methods return the JSON
  `NOT_FOUND` 404 contract; both boost-assignment paths require a Snowflake;
  guild-admin Discord 401s map locally to `SESSION_EXPIRED`; documentation
  reflects the client-visible error and auth/CORS contracts.
- Focused static validation: read all changed implementation and test files,
  corrected one test-relative import after review, and ran `git diff --check`
  successfully. Route/middleware order in `createApp` remains unchanged.
- Runtime validation remains blocked: Node, pnpm, corepack, and node_modules
  are unavailable. No test, typecheck, build, or full suite has been run.
- Gate 3 decision/risk: verify that the extraction preserves architecture and
  the corrections are minimal, secure, compatible, and correctly documented;
  identify only material remediation required before requesting a Node-capable
  validation environment.

### Phase 3 structural scan

`exp-1` confirmed the `createApp` extraction preserves dependency direction and
every prior mount order, introduces no import cycle or test-only production
branch, and leaves startup/shutdown side effects in `index.ts`. The JSON 404
and token-code mapping are deliberate public contract corrections, with focused
tests. The scan found no material structural remediation.

## Gate 3 — approved, reconciled

Oracle review `ora-1` approved the Phase 3 code and documentation changes for
Node-enabled validation. The only actionable review finding was factual phase
attribution in `docs/api-audit-2026-08-18.md`; it was corrected in one
documentation-only pass. No re-review is required because the correction did
not change an implementation decision, API risk, or evidence claim.

## Current phase

Phase 4 — blocked pending a Node-capable environment. Required evidence is:

1. `pnpm db:generate`
2. `pnpm --filter @sumirevox/api test -- src/app.test.ts src/middleware/__tests__/require-guild-admin.test.ts src/routes/__tests__/user-boost-assign.test.ts`
3. `pnpm --filter @sumirevox/api build`
4. `pnpm test`
5. `pnpm build`

The parent will run these commands once Node 22+ and pnpm are available on
`PATH` and dependencies have been installed. No commit is created before this
evidence is reconciled.

Docker 29 is available in the execution environment. At the user's request,
Phase 4 will use the repository's `apps/api/Dockerfile` Node 22 build stage for
isolated Prisma generation and API build, then run focused Vitest tests in that
image with networking disabled. Full-workspace commands will be evaluated after
the API evidence succeeds.

### Docker validation finding

`docker build --target build --tag sumirevox-api-validation:local --file
apps/api/Dockerfile .` was executed on 2026-08-18. Dependency installation
completed, but the build failed at Dockerfile line 20 before Prisma generation,
API build, or tests: `pnpm --filter @sumirevox/shared build` reported
`ERR_PNPM_NO_PKG_MANIFEST No package.json found in /app`.

The `build` stage copies dependency directories from `deps` but not the root
`package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml` required for pnpm
workspace resolution. This is a reproducible API image build/deployment blocker
unrelated to the Phase 3 API code. The minimal candidate remediation is to copy
those three root workspace files into the build stage, then repeat the exact
Docker build and tests. The optional `@discordjs/opus` native build warning and
Prisma OpenSSL warning did not fail installation; they remain observations until
the primary build blocker is cleared.

After adding the three workspace files, the identical Docker build progressed
to shared-package TypeScript compilation and failed at the next missing root
input: `TS5083 Cannot read file '/app/tsconfig.base.json'`. Both
`packages/shared/tsconfig.json` and `apps/api/tsconfig.json` extend that file.
The validated minimal Dockerfile correction must therefore include the root
TypeScript base config as well as the three workspace files. The F-10 record
will be corrected before applying this additional one-file build fix; no test
or API build has run yet.

With all four root inputs copied, the Docker build completed the shared build
and reached Prisma generation. It then failed because Dockerfile line 23 uses
`npx prisma generate`; no root Prisma CLI is present, so npx downloaded Prisma
7.9.1 rather than the repository's locked Prisma 6 CLI. Prisma 7 rejects the
existing schema datasource URL (`P1012`). Project guidance identifies the CLI
at `apps/bot/node_modules/.bin/prisma`, which is already copied into the build
stage. The next minimal F-10 correction is to invoke that locked binary with
`--schema=apps/bot/prisma/schema.prisma`, eliminating the network-selected
major version. This is a reproducible Docker build defect, not a schema change
or a reason to upgrade Prisma.

### Full-suite validation finding

The full Docker validation command completed dependency installation and Prisma
generation. Shared tests (27) and bot tests (93) passed. API tests ran 18 test
files successfully (52 tests), including all five new focused tests, but the
uncommitted `apps/api/src/services/__tests__/boost-service.test.ts` failed
during module import because it mocks database/logger/services but not
`../../infrastructure/config.js`. `boost-service.ts` imports config, which
requires `DISCORD_CLIENT_ID`; the container intentionally has no `.env`.

This is a reproducible test-isolation blocker rather than an API runtime defect.
The minimal repair is a test-local config mock with the `boostCooldownDays`
field used by `boost-service`. No production configuration default or test-wide
environment override will be introduced. Full root build did not run because
the root test command exited non-zero.

## Phase 4 validation record (pending Gate 4)

- F-10 remediation was verified with
  `docker build --target build --tag sumirevox-api-validation:local --file apps/api/Dockerfile .`.
  The final build passed the shared TypeScript build, locked Prisma 6 client
  generation, and API TypeScript build. The build-stage Docker image then ran
  the focused tests with `--network none`: 3 files / 5 tests passed.
- F-11 remediation was verified with a Node 22 Docker container after Prisma
  generation: all shared tests (3 files / 27 tests), API tests (19 files / 53
  tests), and bot tests (10 files / 93 tests) passed. `pnpm build` then passed
  for shared, API, bot, web, and admin workspaces.
- `git diff --check` passed after all changes. Docker-created `.pnpm-store/`
  was verified as generated cache data and removed; it is not part of the
  delivery.
- Prisma OpenSSL detection warnings and optional `@discordjs/opus` native-build
  warnings were observed during dependency installation/generation. They did
  not block the Docker API build, any test, or workspace build. They remain
  unverified runtime/deployment observations.
- Gate 4 decision/risk: validate final correction scope, Dockerfile safety,
  full evidence, documentation status, residual runtime/deployment risk, and
  whether the result is safe to commit without further remediation.

## Gate 4 — approved, reconciled

Oracle review `ora-1` independently confirmed the Docker build artifact,
validation counts, clean diff check, F-10/F-11 minimality, documentation
status, and final compatibility/security posture. It approved commit readiness
without re-review. The remaining Prisma/OpenSSL and optional Opus warnings are
non-blocking observations; deployment startup against a real Postgres database
and a health-check smoke test remain recommended but intentionally unperformed.

## Commit scope

The user authorized integration of the existing API worktree. Commit
`607ab0a fix(api): harden delivery and validation` includes the validated API,
Prisma migration, API/deployment documentation, and Nginx changes under
`apps/api`, `apps/bot/prisma`, `docs`, and `nginx`.
The separately pre-existing `AGENTS.md` edit remains unstaged and untouched.

## Validation

- `git diff --check` passed after all changes.
- Docker API build target, isolated focused tests, full workspace tests, and
  full workspace build passed as recorded above.

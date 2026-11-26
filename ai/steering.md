# AI-Assisted Design

## Shared Design Before Code

- When requirements are ambiguous or underspecified, interview the user until the design is clear, then generate code. A short back-and-forth beats a large code dump that misses the intent.
- For non-trivial design decisions (new features, architecture changes, data modeling), confirm the approach before implementing.
- Use the `grilling` skill when the user wants a plan stress-tested or says "grill me". Invoke it proactively when a request is large or underspecified enough that jumping to code would be premature.

## Interface-First Design

- For non-trivial modules, design the interface (signatures, types, contracts) first and present it for review before filling in the logic.
- Treat complex modules as gray boxes: the interface is the contract, the implementation is delegated detail.

## Deep Modules

- Favor large, self-contained modules with simple interfaces over many small, fragmented files. Hide complexity behind a clean API.
- Optimize code organization for navigability and testability, not file count or granularity.
- Use the `improve-codebase-architecture` skill when the user wants to refactor, consolidate fragmented modules, or improve testability. Suggest it when many small tightly-coupled files would benefit from one clean interface.

## Test-Driven Development

- Work red-green: write one test for one behavior, run it and watch it fail, implement, run it and watch it pass, then take the next behavior.
- Keep steps small. Each new block of code is covered by a test that ran before it existed.
- Use the `tdd` skill when the user asks for test-first work, red-green-refactor, or integration tests. Invoke it proactively for non-trivial features to enforce vertical slices.
- For throwaway or exploratory work where the design is still unknown, use the `prototype` skill instead; return to test-first once the approach is settled.

# UI and Visual Design

Load the matching skill before building or reviewing anything visual. Several can apply at once; load every one whose case matches.

## Skill Routing

- **Websites and public pages** (landing, marketing, portfolio, product page, hero), new or existing: load both `hallmark` and `design-taste-frontend`. Hallmark's Floor is the hard baseline; taste deals the direction and runs the look-and-fix loop. For an existing page, invoke Hallmark in its `redesign <path>` or `audit <path>` mode.
- **Product UI** (dashboards, admin panels, settings, tools, data views): `interface-design`.
- **Interaction polish** (press and hover states, popovers, tooltips, transitions, component feel): `emil-design-eng`.
- **Apple-style fluid UI** (springs, momentum, interruptible transitions, materials and depth, optical typography): `apple-design`.
- **Diagrams and charts** (architecture, flowchart, sequence, ER, timeline, any data chart): `diagram-design`.
- **Worst-case data stress test** of a component or screen: `break-ui`.
- **Mobile web** (PWA, touch, viewport, safe areas, "feels wrong on my phone"): `mobile-native`. React Native or Expo motion: `animate-expo`.

## Motion

- Build one animation: `animate`. Several elements moving together (stagger, sequence, crossfade): `choreograph`.
- Drag, swipe, sheets, fling, pull-to-refresh: `gestures`.
- Jank or dropped frames, choosing which property to animate: `animation-performance`.
- Critique existing motion or a diff: `review-animations`. Audit a whole codebase into a plan: `improve-animations`.
- Find places that should animate: `find-animation-opportunities`. Strip excess motion ("feels slow", "too much animation"): `remove-animations`.

## Verify Visually

- Look at what you built before handing it back: render it and take screenshots (`agent-browser`) at mobile, tablet, and desktop widths, then fix what you see.

# General

## Code

- Start with the simplest solution that works. Add abstractions only when complexity demands them, and optimize only for a measured need.
- Write minimal, production-ready code: complete implementations with real values, no placeholders or TODO markers.
- Use strict typing: strict mode in TypeScript, full type hints in Python.
- Favor explicit over implicit: clear names, obvious signatures, small single-purpose functions.
- Handle every error deliberately: catch specific exceptions, log or surface them, and fail loudly.
- Comments explain why. Names and structure explain what.
- Prefer the standard library over new dependencies.
- Treat security and performance as requirements from the first draft.
- No emojis in code, comments, or responses.

## Response Style

- Be extremely concise in chat prose: drop articles, pronouns, and filler when meaning stays clear. Write code, comments, commit messages, and user-facing docs in full sentences.
- During design dialogue and clarifying questions, favor being understood over being terse.
- Lead with code or the answer. Explain only what the code cannot show, in one clear sentence.
- End without a recap summary unless one is requested.
- When rules conflict: correctness > security > clarity > concision.

## Output Location

- Deliver investigations, analyses, debugging results, research, and recommendations directly in chat.
- Create files only for code that runs, project configuration, or when the user explicitly asks for a file. Summary or notes documents count as "explicitly asked" only.

## Git Commits

- Use single-line conventional commits (`fix:`, `feat:`, `chore:`). Go multiline only when one line cannot carry the change.

## Subagent Delegation

Delegation is pre-authorized for the cases below; delegate without waiting to be asked. Everything else is direct work.

Delegate when:

- Read-heavy fan-out: surveying 3+ files, directories, or repos; codebase exploration; log or trace triage. Use a read-only explorer (pi: `scout`).
- External research: docs, API behavior, version-specific facts. Use a researcher (pi: `researcher`; add `evidence-auditor` when claims drive a decision).
- Mechanical edits with a deterministic check: renames, migrations, bulk config updates where tests, lint, or build prove correctness. Use a worker (pi: `worker`, fed by a `scout` handoff when context is needed).
- Independent review of a non-trivial change before presenting it. Use a reviewer (pi: `reviewer`).
- A hard design or debugging tradeoff where a second opinion changes the decision. Use an advisor (pi: `oracle`, which forks the current conversation).

Work directly when:

- Designing, clarifying requirements, or debugging.
- The edit is small or touches only a few lines.
- The task depends on conversation history or earlier decisions, unless the agent forks context.
- Work touches production, infrastructure state, credentials, or anything irreversible.

Handoff and verification:

- Give fresh-context subagents a self-contained brief: goal, relevant paths, constraints, prior decisions, and expected output format.
- Treat subagent summaries as claims. After a worker edits, read the diff and rerun the check yourself before reporting success.
- Parallelize only independent read-heavy work. One writer per set of files.

## Hard Stop Rule

Never end a turn while an executable next step remains. Execute any stated or implied next action via tool call in the same turn; progress updates are not stopping points. End only when the work is complete, you are blocked on user input or permission, or no executable action remains.

# Python Standards

## Type Annotations

- Use modern syntax: `list[T]`, `dict[K, V]`, `X | None`.
- Annotate every parameter, return type, and collection variable: `items: list[dict[str, Any]] = []`.
- Type unstructured API JSON as `dict[str, Any]` and read optional fields with `.get()` and a default.

## Logging

- Use the `logging` module for operational messages; reserve `print` for intended program output.
- Read the level from the `LOG_LEVEL` environment variable (default `INFO`).
- Format: `'%(asctime)s - %(levelname)s - %(message)s'` with datefmt `'%Y-%m-%d %H:%M:%S'`.
- Levels: DEBUG for detail, INFO for progress, WARNING for recoverable issues, ERROR for failures.

## Concurrency and HTTP

- Match the concurrency model to the code: `asyncio` with `httpx.AsyncClient` when the code is already async, otherwise `ThreadPoolExecutor` for I/O-bound work (API calls, file operations). Start at 10-20 concurrent requests and tune to the rate limit; bound async fan-out with an `asyncio.Semaphore`.
- Reuse one client per host for its connection pool: `requests.Session`, `httpx.Client`, or `httpx.AsyncClient`. Size the pool to the concurrency: `HTTPAdapter(pool_maxsize=<workers>)` for requests (default 10), `httpx.Limits(max_connections=<workers>)` for httpx (default 100).
- Configure the client (headers, auth, timeouts, pool limits) before starting workers, and pass it to them; workers only send requests through it.
- Close clients when done: use them as context managers (`with` / `async with`).

## AWS SDK (boto3)

- Build clients with `botocore.config.Config`: `retries={"mode": "standard"}` (or `"adaptive"` under sustained throttling) and `max_pool_connections` matching the worker count.
- The retry mode already retries throttling errors. Add explicit backoff only around loops that still exceed limits after retries.
- Use `cast()` on TypedDict responses to keep type checkers satisfied.
- Design call patterns to avoid N×M request fan-out; prefer batch and paginated APIs.
- Read the region from environment variables.

## AWS CLI

- Prefix AWS CLI `help` commands with `MANPAGER=cat` (e.g., `MANPAGER=cat aws s3 help`). The shell's default `MANPAGER` is `nvim`, which blocks non-interactive execution.

# Terraform Standards

- Consult the official provider docs on registry.terraform.io before writing or modifying resources, data sources, or provider configuration. Verify argument names, required vs optional attributes, and defaults.

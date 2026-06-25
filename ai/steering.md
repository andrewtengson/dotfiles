# AI-Assisted Design

## Shared Design Before Code

- When requirements are ambiguous or underspecified, ask clarifying questions before generating code. Interview the user until the design is clear — don't guess and generate.
- If a task involves non-trivial design decisions (new features, architecture changes, data modeling), confirm the approach before implementing.
- Prefer a short back-and-forth to establish shared understanding over a single large code dump that misses the intent.
- Use the `grill-me` skill when the user wants to stress-test a plan, get grilled on their design, or explicitly says "grill me." Invoke it proactively when a request is large or underspecified enough that jumping to code would be premature.

## Test-Driven Development

- When implementing new functionality, write the test first, then the implementation. Don't generate both in a single pass without running the test.
- Take small, deliberate steps. One test, one behavior. Avoid generating large blocks of untested code.
- Use the test as a feedback loop: write test, run it (expect failure), implement, run it (expect pass), then move to the next behavior.
- Use the `tdd` skill when the user wants to build features or fix bugs using TDD, mentions "red-green-refactor", wants integration tests, or asks for test-first development. Invoke it proactively when implementing non-trivial features to enforce vertical slicing over bulk code generation.

## Deep Modules

- Favor large, self-contained modules with simple interfaces over many small, fragmented files.
- A module should hide complexity behind a clean API. Internal implementation details should not leak into the interface.
- When organizing code, optimize for navigability and testability — not for maximum file count or maximum granularity.
- Use the `improve-codebase-architecture` skill when the user wants to refactor, consolidate fragmented modules, or improve testability. Suggest it when a codebase has many small tightly-coupled files that would benefit from being wrapped behind clean interfaces.

## Interface-First Design

- For non-trivial modules, design the interface (function signatures, types, contracts) before writing the implementation.
- Present the interface to the user for review before filling in the logic.
- Treat complex modules as gray boxes: the interface is the contract, the implementation is delegated detail.

# General

## Code Quality Standards

- Write minimal, production-ready code. No placeholder comments, no TODO markers, no example data.
- Prioritize type safety. Use strict typing in TypeScript and type hints in Python.
- No emojis in responses or code comments.
- Favor explicit over implicit. Clear variable names, obvious function signatures.
- Error handling is mandatory. No silent failures, no bare try-catch blocks.

## Code Style

- Keep functions small and focused. Single responsibility principle.
- Avoid over-engineering. Solve the actual problem, not hypothetical future problems.
- No unnecessary abstractions. Add layers only when complexity demands it.
- Comments explain why, not what. Code should be self-documenting.

## Response Style

- Be direct. Skip pleasantries and filler phrases.
- Show code, not explanations. Let implementations speak for themselves.
- When explaining is necessary, be concise. One clear sentence beats three vague ones.
- No recap summaries unless explicitly requested.

## Git Commits

- Use conventional commits (e.g., `fix:`, `feat:`) in a single line unless a multiline message is absolutely necessary.

## Implementation Approach

- Start with the simplest solution that works.
- Optimize only when there's a measurable need.
- Prefer standard library over dependencies.
- Security and performance are non-negotiable, not afterthoughts.

## Output Preferences

- Default to displaying results directly in the chat window. No file creation for investigations, analyses, or solutions.
- Never create markdown files, text files, or documentation files to summarize findings unless explicitly requested.
- File creation is only appropriate when:
  - User explicitly asks to create a file
  - Implementing actual code that needs to be executed
  - Creating configuration files for a project setup
- For research, debugging, explanations, or recommendations: output directly to chat.

# Python Standards

## Type Annotations

- Use modern syntax: `list[T]`, `dict[K, V]`, `X | None` instead of `List[T]`, `Dict[K, V]`, `Optional[X]`.
- For JSON responses from APIs, use `dict[str, Any]` with explicit type annotations.
- Annotate all function parameters and return types.
- Use `from typing import Any` when dealing with unstructured data.
- Use `.get()` methods with defaults when accessing optional dictionary fields from APIs (Python-specific).
- Add explicit type annotations to variables: `items: List[Dict[str, Any]] = []` (Python-specific).

## Logging

- Use Python's `logging` module, not print statements for operational messages.
- Configure log level via `LOG_LEVEL` environment variable (default: INFO).
- Format: `'%(asctime)s - %(levelname)s - %(message)s'` with `'%Y-%m-%d %H:%M:%S'`.
- Use appropriate levels: DEBUG (detailed), INFO (progress), WARNING (recoverable), ERROR (failures).

## Concurrency and HTTP Requests

- Use `ThreadPoolExecutor` for I/O-bound tasks (API calls, file operations) (Python-specific).
- Reuse HTTP connections with `requests.Session()` for multiple requests to the same host (Python-specific).
- Session objects are thread-safe and maintain connection pools automatically (Python-specific).
- For scraping/API projects: pass session to worker functions to share connection pool (Python-specific).
- Set appropriate worker counts (10-20 for API calls, adjust based on rate limits).

## AWS SDK Best Practices

- Configure retry policies and connection pooling in boto3 client config (Python-specific).
- Use `cast()` for AWS TypedDict responses to maintain type compatibility (Python-specific).
- Handle AWS-specific exceptions (ThrottlingException) with appropriate retry logic (Python-specific).
- Implement efficient API usage patterns (avoid N×M combinations when possible).
- Configure region via environment variables for flexibility.

## AWS CLI

- When running AWS CLI `help` commands, set `MANPAGER=cat` for that invocation (e.g., `MANPAGER=cat aws s3 help`). The shell's default `MANPAGER` is `nvim`, which opens an interactive pager that blocks non-interactive execution.

# Terraform Standards

## Best Practices

- Always consult the official Terraform provider documentation (registry.terraform.io) when working with resources, data sources, or provider configurations. Verify argument names, required vs optional attributes, and default values before writing or modifying resource blocks.

# Browser Access

## agent-browser

- Use [agent-browser](https://agent-browser.dev/) for browser automation tasks (navigation, form filling, screenshots, scraping).
- Install: `npm install -g agent-browser` or `brew install agent-browser`.
- Use `snapshot -i` to get a compact accessibility tree with refs, then interact via refs (`click @e1`, `type @e2 "text"`).
- Prefer `snapshot` over `screenshot` for context efficiency (~200-400 tokens vs full DOM).
- Use sessions for isolated browser instances when handling multiple sites or auth contexts.
- Docs: https://agent-browser.dev/commands for full command reference.

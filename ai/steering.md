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

## Implementation Approach

- Start with the simplest solution that works.
- Optimize only when there's a measurable need.
- Prefer standard library over dependencies.
- Security and performance are non-negotiable, not afterthoughts.

## File Organization

- When creating new files or projects in the vibe-coded directory, create them in a dedicated subdirectory within vibe-coded (e.g., vibe-coded/project-name/) to reduce clutter.
- Exception: If the user explicitly specifies a different location, honor that request.

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

# Terraform Standards

## Best Practices

- Always consult the official Terraform provider documentation (registry.terraform.io) when working with resources, data sources, or provider configurations. Verify argument names, required vs optional attributes, and default values before writing or modifying resource blocks.

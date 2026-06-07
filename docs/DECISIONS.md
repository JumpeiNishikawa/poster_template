# Decisions

## 2026-06-07: Generated Projects Use AGENTS.md First

### Decision

New poster projects generated from this template should use `AGENTS.md` as the primary local guide, with `docs/PROJECT_LOG.md`, `docs/DECISIONS.md`, `docs/REFERENCES.md`, and `docs/TASKS.md` as portable project memory.

### Rationale

JSAI2026poster needed durable handoff notes for status, decisions, source observations, and remaining tasks. Keeping that information in project-local Markdown makes the work portable across coding agents and manual editing.

### Impact

`tools/new-poster.ps1` now creates a `docs/` directory and copies the memory templates into each new poster project.

## 2026-06-07: Font Size Rules Are Ranged Where Practice Requires It

### Decision

Keep the template default body size at 32pt, but document the allowed body range as 28-36pt and enforce ranges in `tools/lint.mjs`.

### Rationale

The previous spec said `--fs-body` was 28pt, while the actual template used 32pt and the completed JSAI poster used a larger body size for A0 readability. A narrow fixed value was not matching practice.

### Impact

Font-size changes are still constrained, but valid A0 readability adjustments can be represented without making lint meaningless.


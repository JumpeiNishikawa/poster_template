# Decisions

## 2026-06-19: Contrast Checking (WCAG 2.1 AA) in lint + secondary-as-text rule

### Decision

`tools/lint.mjs` now checks the contrast of fixed text-on-surface pairs against **WCAG 2.1 AA** (the W3C standard; JIS X 8341-3 matches it). `< 3.0:1` is an error (fails even large-text AA), `< 4.5:1` is a warning (below normal-text AA). Deliberately de-emphasized text (`--col-muted`, `--col-text-sub`) is reported as info only.

The default secondary (#F97213 orange) cannot carry white text (2.82:1) nor be used as text on white. Rule adopted (`poster_spec.md §3-7`): **orange is used as a shape/fill** (borders, number-badge ground, list-markers, `.mk` marker, blobs — not contrast-checked), but **white-on-orange and orange-text-on-white are not allowed**. To comply, the template recolors the digit in `.n`, the `feature`/`secondary` kind labels, and `.badge` to `--col-text` (dark on orange ≈ 6.55:1), and the `cond-table` accent row now differentiates by background tint only (no orange text).

### Rationale

The user asked to add contrast judgment for text on markers/colored blocks. WCAG 2.1 AA is the right basis. The check surfaced a real issue in the shipped palette: orange is too light for white text. Rather than darken the brand orange, we keep it for shapes and require dark text on it — preserving the look while meeting AA. The check resolves hex/rgb(a)/oklch (incl. relative `from`) and composites alpha, so it stays correct as the 2 swappable colors change.

### Impact

- `tools/lint.mjs` exits 1 if any enforce pair is `< 4.5:1` (warning) or `< 3.0:1` (error); prints all ratios for reference.
- Color swaps must keep enforce pairs ≥ AA (lint guards this). Gradient surfaces, `.sc--tint`, and figure/image colors are not statically checkable and are verified via AI visual review of the rendered PNG/PDF (`poster_spec.md §6-2` checklist).

## 2026-06-07: Generated Projects Use AGENTS.md First

### Decision

New poster projects generated from this template should use `AGENTS.md` as the primary local guide, with `docs/PROJECT_LOG.md`, `docs/DECISIONS.md`, `docs/REFERENCES.md`, and `docs/TASKS.md` as portable project memory.

### Rationale

An earlier poster project needed durable handoff notes for status, decisions, source observations, and remaining tasks. Keeping that information in project-local Markdown makes the work portable across coding agents and manual editing.

### Impact

`tools/new-poster.ps1` now creates a `docs/` directory and copies the memory templates into each new poster project.

## 2026-06-07: Font Size Rules Are Ranged Where Practice Requires It

### Decision

Keep the template default body size at 32pt, but document the allowed body range as 28-36pt and enforce ranges in `tools/lint.mjs`.

### Rationale

The previous spec said `--fs-body` was 28pt, while the actual template used 32pt and the completed poster used a larger body size for A0 readability. A narrow fixed value was not matching practice.

### Impact

Font-size changes are still constrained, but valid A0 readability adjustments can be represented without making lint meaningless.

## 2026-06-17: Backport from a Downstream Open-Campus A4 Flyer (generic knowledge only)

### Decision

Fold the *generic* lessons from a downstream A4 flyer project (an open-campus handout) back into this poster template, but **do not** widen the template's scope to a general "print material" template. The template stays A0-poster-only; the flyer's A4/two-page structure and project-specific assets are not adopted. (Nuance: the *Lucide* icon set itself is recommended as the first-choice when a poster wants icons — see `ai_poster_workflow.md §4`; only the flyer's specific icon picks are dropped.)

Adopted: (1) **print fonts embedded locally** as the recommended default for final output (`poster_spec.md §3-1`, `docs/FONT_EMBEDDING.md`, a built-in `#font-warning` detector, and a commented `@font-face` switch in the template HTML); (2) **new color variables use `oklch()`** with opaque tints (`poster_spec.md §2-3`); (3) the **screen-vs-PDF page-count gotcha** (`§6-1`); (4) the **stale-artifact fix** in `tools/render.mjs`; (5) a generalized `tools/view_pdf.ps1`; (6) work norms (measure-from-source, commit-per-logical-unit) and the SVG `overflow:visible` / card-title-overhang tips in `ai_poster_workflow.md` and `scaffold/AGENTS.md`.

### Rationale

Two corrections to the downstream hand-off note (since consumed and removed) drove the design:

- The flyer's "stale artifact" commit did **not** delete old outputs; it fixed a success-detection logic bug (`status≠0 && !exists` → would pass on a leftover file). The template's `render.mjs` had the same bug, fixed minimally by deleting the artifact before render and using `status≠0 || !exists`.
- The flyer does not actually use `oklch`; its tints are hand-tuned opaque hex with the comment "luminance matched to blue (0.628), fixed hex to avoid rgba print degradation." That manual luminance-matching is exactly what `oklch` automates, so the rule is justified — and the rgba-print caveat is captured alongside it.

Embedding fonts is recommended (not forced) because a template cannot pre-subset for text it does not yet contain; projects subset their own glyphs before printing.

### Impact

`tools/new-poster.ps1` now also distributes `tools/view_pdf.ps1`, `docs/FONT_EMBEDDING.md`, and a `fonts/` directory to each project. `poster_spec.md`, the template HTML, `ai_poster_workflow.md`, `scaffold/AGENTS.md`, and the maintainer guides were updated. The inbox note is fully consumed and removed.

## 2026-06-17: Project Spin-Up Stays "Generate Self-Contained" (not fork / not path-reference)

### Decision

Concrete posters/flyers are created by `tools/new-poster.ps1` as self-contained copies (each its own git repo), **not** by forking this template repo and **not** by pointing an agent at this repo's path. Template updates do not auto-propagate; learnings flow back via the harvest procedure (`docs/BACKPORT.md`). `new-poster.ps1` now stamps the source template commit into each project's `docs/PROJECT_LOG.md`, and `-RefreshTools` re-copies framework files (tools + `poster_spec.md`) into an existing project on demand.

### Rationale

Evaluated against self-containment, downstream-agent autonomy, GitHub publishing, update propagation, and knowledge return:

- **Fork** carries updates both ways (upstream merge / PR) but bundles the whole templating apparatus into every single-artifact project, and merges are painful because projects heavily rewrite `poster_template.html`.
- **Empty folder + path reference** always sees the latest template but breaks self-containment (no standalone lint/render), breaks handoff, and forces the downstream CLI agent to juggle two locations.
- **Generate** keeps each poster self-contained and trivially publishable (git-init'd → push = its own GitHub repo); its only cost is manual update/return, which the harvest procedure and `-RefreshTools` make explicit and repeatable.

### Impact

`new-poster.ps1` gains provenance stamping and `-RefreshTools`; `docs/BACKPORT.md` (maintainer-side apply) and `scaffold/docs/HARVEST.md` (project-side extract) document the round-trip; `scaffold/AGENTS.md` instructs each project to harvest on completion. Also: `out/` now tracks only the stable `poster.pdf`/`poster.png` (GitHub publishing), with working renders still ignored.

## 2026-06-18: Color Layer — Gradients & Bleed Derived From the 2 Brand Colors (OKLCH)

### Decision

Add an optional **color layer** (natural gradients + "にじみ"/bleed blobs) to the template, taking the adoptable ideas from an external proposal (`html_poster_color_system_proposal.md`). Adopted: (1) **role-based gradient tokens** (`--grad-page/header/heading/accent/flow`, `--col-surface-tint`, `--blob-*`); (2) **three strength tiers** (`subtle`/`medium`/`strong`) defined by OKLCH L/C deltas; (3) **block-by-block usage rules** and a **print/readability checklist** (`poster_spec.md §2-4`, `§4-6`, `§6-2`); (4) opt-in classes `.blob-layer` / `.sc--tint` / `.flow-band` / `.badge`.

**Explicitly *not* adopted** (kept in the repo's spirit): the proposal's external `theme/*.yml` files. The template is single-file by rule (`poster_spec.md §1`), so the same token system is **internalized into `:root`**. The proposal's separate token palette would also fork from the existing "edit only the 2 brand colors" promise.

### Rationale

The repo already derives the whole poster from `--col-primary` / `--col-secondary`. Rather than introduce a parallel palette, **all gradient/bleed colors are auto-derived from those 2 colors via OKLCH relative color** (`oklch(from var(--col-primary) … )`), so swapping the 2 vars still re-tones every gradient — the existing promise is preserved, not broken. Engineering choices that match the repo's defensive style:

- **Graceful degradation:** the whole layer lives in one `@supports (color: oklch(from white l c h)) and (background: linear-gradient(in oklab, …))` block. Unsupported browsers fall back to the original solid colors — same paranoia as the `#font-warning` detector.
- **`@supports`/print-block ordering:** the new CSS is inserted *before* `@media print` so the block stays last before `</style>` and `lint.mjs`'s dimension regex keeps matching.
- **`isolation: isolate` on `#poster`** so the `z-index:-1` bleed layer paints behind content identically on screen and in the static-positioned print layout.
- **Defaults stay conservative:** only the subtle page/header/heading gradients are on by default (verified the template still renders 1 page, 56.5 mm headroom). Bleed blobs, tinting, flow bands, badges are opt-in.

### Impact

`poster_template.html` gains the `:root` tokens, the `@supports` color layer, and the opt-in classes (default look essentially unchanged — subtler, not flatter). `poster_spec.md` gains §2-4 (color layer + strength tiers + usage table), §4-6 (class reference), §6-2 (pre-print checklist), and a version bump to 1.1. Generated projects inherit all of this automatically (`new-poster.ps1` copies the template HTML + `poster_spec.md`). A throwaway showcase, `color-demo.html` (git-ignored via `.gitignore`; not committed), exercises every new element and renders to 1 page (165 mm headroom); both files pass `lint.mjs`.


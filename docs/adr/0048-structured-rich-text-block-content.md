---
status: accepted
---

# Structured Rich-text Block content

Issue #100 selects a versioned, toolbar-library-independent structured document
for Rich-text Blocks, with explicit formatting, asset references, and internal
link targets, rendered as static HTML. This replaces ADR 0034's Markdown storage
and textarea-only constraints for this Block: the expanded formatting, images,
and stable internal links justify a migration boundary rather than a lossy
Markdown round trip. Legacy Rich-text content converts automatically while
preserving the existing renderer's displayed meaning; other Blocks' Markdown
fields retain ADR 0034's contract.

The complete contract was confirmed on 2026-09-17. This decision does not select a UI stack
or relax the requirement for safe, deterministic Node/browser rendering.

## Public export and preservation

Unsupported imported rich-text content is preserved without simplification and
cannot be edited until supported. Unsupported rich text or missing image bytes
in public content block public export without an override; Draft-only problems
do not. Editable archive saving remains available. These are explicit exceptions
to ADR 0016's override model: preserving author content and producing complete
public output take precedence over forcing a lossy export.

Broken prose links retain target identity but warn and render unlinked text.
This revises issue #97's blanket blocking rule for ordinary Article links;
unavailable targets in active explicit Article-list selections still block public
export without an override. Missing image descriptions remain warnings.

---
status: accepted
---

# Custom Block content and Theme compatibility

In issue #105, Custom Block content must remain editable when switching
Themes, but a Custom Block with no design in the active Theme is omitted
from the public Site. Export lists the omitted Blocks and requires the
author to acknowledge their omission before proceeding, allowing the
author to publish without requiring a fallback design or losing content.

This deliberately permits incomplete visual coverage by a Theme instead
of requiring every Custom Block to supply a default design.

Built-in Blocks use their existing renderer when a Custom Theme supplies
no override. The omission rule applies to Custom Blocks without a design,
not to built-in Blocks with an available renderer.

If Theme or Custom Block rendering code crashes, export stops and
identifies the failing extension. The author cannot bypass a rendering
failure through the acknowledgement flow for deliberately omitted Blocks.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project coding conventions requested by the owner

- Read docs/CODE_GUIDE.md when changing UI structure.
- Write formatted, readable code. Never compress entire components or stylesheets into single lines.
- Keep pages focused on routing, authorization, and composing components.
- Reuse shared controls and layouts from src/components/ui. Components own their required styles.
- Keep feature compositions in components and validation/data access in modules.
- Explain non-obvious behavior and security boundaries with concise comments; document flows in CODE_GUIDE.md.
- For visual changes, verify the rendered desktop/mobile UI. A passing build is not visual verification.

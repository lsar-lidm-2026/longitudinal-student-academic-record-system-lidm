<!-- BEGIN:nextjs-agent-rules -->
# Next.js 16 — Critical Notes

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Key Points
- App Router (NOT Pages Router) is the default
- File-based routing under `app/`
- Layout files for shared UI (sidebar, navbar)
- Loading and error states via `loading.tsx` and `error.tsx`
- Server Components by default (use 'use client' for interactivity)
<!-- END:nextjs-agent-rules -->

# ADR-010: the public pages are served by the real-time process

Date: 2026-09-11. Status: accepted.

## Context

Chapter 11 of the cahier says the duel invitation link must work without the application. That
needs a public web page at a stable address: `apps/web`, built by Vite into static files.

Nothing in the project hosts static files yet. The admin (`apps/admin`) is built but never
deployed either; it is an internal tool and can wait. The public page cannot: a duel link that
leads nowhere is a duel that does not exist.

Three options were on the table.

1. A static host (Netlify, Cloudflare Pages, Vercel). Free, fast, made for this. Needs a new
   account, a new deploy pipeline and a new place to keep secrets.
2. Supabase Storage with a public bucket. No new account. No single-page routing, no custom
   headers, and a bucket URL is not an address anyone would open from a text message.
3. The Fly application that already exists. Its `temps-reel` process is the only thing in the
   project reachable from the internet; it already has a hostname, TLS and a deploy command.

## Decision

The built pages of `apps/web` go into the server image and are served by the `temps-reel`
process. `DOSSIER_WEB` points at the bundle; when it is unset, the process serves no pages,
which is what a developer's machine and the worker want.

Three routes are answered with the page itself, because a single-page application needs the
same document at every address it owns: `/duel/:jeton`, `/confidentialite`, `/conditions`.
`/assets/*` and `/favicon.svg` are served as files. Everything else keeps the JSON 404 the API
already had.

The Supabase URL and publishable key are baked in at build time, as Docker build arguments.
Both are public by design: every rule is enforced by row-level security in the database, and the
invitee is an anonymous principal with the narrowest rights in the project.

## Consequences

- A duel link reads `https://leq-serveur.fly.dev/duel/<jeton>` today. It works, and it is ugly.
  Phase 9 buys a domain and points `EXPO_PUBLIC_LIEN_DUEL` at it; that constant in
  `apps/mobile/src/app/duel/nouveau.tsx` is the only place to change.
- Publishing a change to the pages means deploying the server. That is heavier than a static
  host, and it is acceptable while duels ship off behind a flag.
- The server image grows by the size of the bundle (about 450 kB of JavaScript, 5 kB of CSS).
- The public process now serves two unrelated things. If the debate loop of Phase 8 ever needs
  the whole machine, the pages move to a static host and this decision is superseded. Nothing in
  `apps/web` depends on where it is served from, so that move is a deploy change, not a rewrite.

## Alternatives rejected

Option 1 stays the better long-term answer and will be revisited at Phase 9, when a domain and a
store listing exist anyway. It was not taken now because it asks Roch for an account before the
feature can be tried, and the feature is ready today.

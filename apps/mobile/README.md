# @leq/mobile

The LEQ app: Expo SDK 57, Expo Router, React Native, TypeScript. Every string is French and lives in `src/i18n/fr.ts`.

## What exists (Phase 0 shell)

- Design tokens from the validated mockup (`src/theme/tokens.ts`): bleu nuit, bleu, or, orange, warm neutrals, Manrope 500 to 800, radii, a light and a dark theme.
- Bulle, the mascot, as a breathing placeholder (`src/components/Bulle.tsx`), and the UI primitives (button, card, title, icon, state screens).
- The tab bar with Aujourd'hui, Défis, Progrès, Moi, and L'Arène inserted only when the `arene` flag is on (mockup C0: no ghost tab).
- Screens A1 (welcome) and A2 (the microphone contract) implemented; the four tabs as real shells with placeholder cards where later phases bring content; X1 (empty progress) implemented.
- Supabase client with anonymous sign-in on first launch and session persistence in AsyncStorage; configuration and flags loaded with TanStack Query and cached on the phone so the app opens offline.

## Run

```bash
cp apps/mobile/.env.example apps/mobile/.env     # EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run ios --workspace @leq/mobile              # Expo dev server, then the iOS simulator
npm run typecheck --workspace @leq/mobile
npm run lint --workspace @leq/mobile
npm test --workspace @leq/mobile                 # jest-expo: tab bar flag behaviour, string interpolation
```

The app needs a Supabase project to start (the shell blocks on the first configuration load, then works from cache). Until the project exists, the tab bar and screens can be reviewed in code and in the test renderer only.

Typed routes (`experiments.typedRoutes`) are off: the generator in Expo's CLI cannot find `expo-router` while npm keeps it nested under this workspace (docs/STATUS.md explains). Route strings are plain strings.

Store builds go through EAS cloud, never this Mac (macOS beta, see docs/RUNBOOK.md). Bundle identifier `com.leqapp.mobile`, awaiting confirmation before the first store upload (docs/OPEN-INPUTS.md).

## Not here yet

Recording (Phase 1, after the capture decision in docs/decisions/ADR-007-capture-audio.md), the offline queue, notifications, account creation, everything past A2. The `CLAUDE.md` and `AGENTS.md` files come from the Expo template and document SDK 57 conventions; the LEQ rules are in `docs/`.

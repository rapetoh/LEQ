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

## Flow A (Phase 1, in progress)

- `src/services/enregistrement.ts`: the recorder over `react-native-audio-api` (session in measurement mode, 16 kHz mono M4A in the cache, level meter, interruption ends the take).
- `src/services/fileMachine.ts` and `file.ts`: the local queue of takes (phone-only states, backoff, expiry), wired in `prises.ts` with AsyncStorage, the cache directory and `expo-network`; `tentatives.ts` uploads and inserts idempotently by attempt id.
- `src/hooks/useSuiviPrise.ts`: follows a take to the server statuses (Realtime, polling fallback).
- Screens A3 to A7 under `src/app/accueil/`, with X2, X3 and X4 as states.

- `src/services/notifications.ts`: push permission and token registration (`jetons_push`), tap handling; `src/app/reglages.tsx`: G3 with the voice statement, export request, account deletion, notification switches, night mode.

## Sign-in and usage (2026-09-13)

- `src/services/identite.ts`: Sign in with Apple (`expo-apple-authentication`, a hashed nonce) and Google (`@react-native-google-signin/google-signin`), both native sheets, both ending in `supabase.auth.signInWithIdToken`. The Google client ids come from `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; without the web id the Google button is not rendered.
- `src/services/usage.ts`: PostHog. A closed list of product events (`compter`), the person identified by their Supabase id from the root layout (`useIdentiteUsage`), nothing about the voice ever sent. Without `EXPO_PUBLIC_POSTHOG_KEY` every call is a no-op, which is the state of a test and of a fresh checkout.

## Not here yet

RevenueCat and the offers screen's real prices (account awaited), crash reporting. The `CLAUDE.md` and `AGENTS.md` files come from the Expo template and document SDK 57 conventions; the LEQ rules are in `docs/`.

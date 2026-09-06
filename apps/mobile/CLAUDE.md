# LEQ mobile (@leq/mobile)

This is the Expo SDK 57 app of the LEQ monorepo. Before touching anything, read the project docs in
/Users/roch/Desktop/LEQ/docs (DATA-MODEL.md is the contract; STATUS.md, SCREENS.md, STRINGS.md track the work)
and this workspace's README.md (what is real, what is stubbed). Rules that apply here:

- Every user-facing string lives in src/i18n/fr.ts, in plain French, tutoiement, buttons are verbs,
  messages are information, no em dashes anywhere, inclusive dot as in the mockup ("prêt·e").
- Domain identifiers are French (tentatives, drapeaux, configuration), technical plumbing is English.
- Colors, radii, spacing and fonts come from src/theme/tokens.ts, never inline hex values in screens.
- Feature flags (drapeaux) decide what exists on screen: no ghost tab, no empty room.

The Expo conventions below come from the SDK 57 template and still apply.

@AGENTS.md

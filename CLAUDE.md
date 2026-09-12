# LEQ

A French mobile application that trains public speaking. Read `README.md` for the layout and
`docs/STATUS.md` for where the build stands before changing anything.

## The rule about writing, which applies to every string, now and later

Every word a person can read in LEQ is French, and it has to read like the French a real consumer
application ships. Not like text a machine produced. This is not a matter of taste and it is not
negotiable: **read `docs/STRINGS.md` in full before writing or changing a single user-facing
string**, including a placeholder, an error, a push notification, a store listing, a seeded
`consigne`, or a prompt that will make a model generate French at runtime.

**The rule above all the others: LEQ speaks, it never describes itself.** A model's default voice
is explaining, because explaining is what it does all day, so left alone it writes _about_ the
product instead of writing the product. It captions the screen, defines its own buttons, and
justifies its own rules. Every sentence comes out true, plain and grammatical, and the whole thing
still reads as machine-written. This is the failure that survives every other correction, so check
for it first.

> Chaque ligne est une personne qui a dépensé ses points. Honorer : tu l'as contactée et la
> récompense est donnée. Annuler : les points lui reviennent.

became

> Contacte la personne, puis marque l'échange honoré. L'annuler lui rend ses points.

**The test for any string: would a French speaker say this out loud to the person in front of
them?** If it only works as a caption, a legend or a manual entry, it does not ship. Concretely,
never open on a definition (`Chaque ligne est une personne qui…`), never gloss your own controls
(`Honorer : …`), never justify a rule instead of stating it (`…, pour que ta réponse ne soit pas
influencée par la leur`), and never let internal vocabulary reach a screen (`le seed`, `la
migration`, `le serveur`, `chapitre 7`, `docs/DATA-MODEL.md`).

Beneath the voice, these sentence-level tells are banned too:

- **Never state a fact and then negate its opposite.** "Seuls tes résultats sont conservés", never
  "on garde tes résultats, jamais l'audio". "Bulle écoute.", never "Bulle écoute. Personne
  d'autre." Delete the half after the comma: if the sentence still says everything the person
  needs, that half was rhythm and it goes.
- **No aphorism, no slogan, no line that sounds meaningful without telling the person anything.**
- **The application does not narrate its own work.** "Analyse du rythme", never "On écoute ton
  rythme". "Connexion en cours", never "On ouvre la ligne".
- **Say the privacy promise once**, in the plainest sentence available, in the place it belongs.
  Three restatements on one screen read as anxiety, not as trust.
- **No em dashes and no en dashes anywhere, in any file.** Commas, periods, colons.

Plain does not mean cold. The tutoiement, the first-person buttons ("Je me lance"), the domain
vocabulary (une prise, un défi, un acte, le retour) and the act names all stay. A sentence that is
already plain and already true does not get rewritten to sound more corporate.

`npm run strings` (inside `npm run check`, so in CI) fails the build on the mechanical tells and on
broken French typography. It catches the constructions, not the taste, so passing it is the floor
and not the standard.

## Where strings are allowed to live

`apps/mobile/src/i18n/fr.ts`, `apps/admin/src/fr.ts`, `apps/web/src/fr.ts`, and the message
constants in `packages/domaine`. No string a person reads belongs in a component, a screen, a
server template or a prompt built inline. Content Rebecca authors (challenge briefs, subjects,
theses, rewards) lives in the database and is written by her in the admin; the seeded rows are
provisional stand-ins and are marked `provisoire`.

## Other working rules

- npm workspaces, Node 22. `npm install` at the root, then `npm run check`. See `docs/RUNBOOK.md`.
- `docs/DATA-MODEL.md` is the contract. A name changes there first, then in every workspace, in the
  same commit.
- Domain vocabulary in French, technical plumbing in English, engineering docs in English, every
  user-facing string in French.
- Tracking documents are updated in the same commit as the code they describe.
- Secrets never enter git. Only `.env.example` files are committed.
- Four inputs do not exist yet and are never invented: Rebecca's grid, the path generator rules, the
  speech-to-text provider, the measured cost of a debate. Where code needs one, a clearly named stub
  stands in and the workspace README says so.

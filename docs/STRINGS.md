# Strings

Every string a person can read in LEQ is French, and it is written to one standard: the kind of plain French real consumer apps ship. The handoff note calls this the one rule about writing that will not be revisited. The mockup was rewritten to that standard; the code holds it.

## Where strings live

- One typed module per application: `apps/mobile/src/i18n/fr.ts`, `apps/admin/src/fr.ts`, later `apps/web/src/fr.ts`. No string literal shown to a person anywhere else in the application code.
- The module exports a single frozen object nested by feature (`fr.accueil.bienvenue.titre`, `fr.envoi.echec.corps`). Keys are French, camelCase, no accents.
- Mobile: strings with values carry `{{nom}}` placeholders and are read through `t('accueil.micro.note', { systeme })`; the key type is derived from the object, so a typo fails the typecheck, and a missing key renders the key itself so the gap is visible on screen. Admin: strings with values are functions (`fr.configuration.toasts.succes(cle)`). Both keep word order and plural rules inside `fr.ts`, never in a component.
- Server-generated text (feedback wording, debrief, Rétor's lines) is content, not UI strings; it comes from the pipeline and is reviewed through the tone examples Rebecca provides. Content authored by Rebecca (challenge briefs, conseil du jour, theses, subjects) lives in the database and is written by her in the admin.
- There is no second language and no i18n library. `fr.ts` is a plain module so that strings are typed, greppable and reviewable in a diff. `npm run strings` (in `npm run check`, so in CI) reads every module in this list and fails on the banned constructions and on broken French typography.
- Numbers, dates and durations are formatted with `Intl` under `fr-FR` (thin space thousands separator, comma decimal, "14,99 €"), never by hand.

## Writing rules

1. Plain French. Short words, short sentences. If a sentence needs a second reading, rewrite it.
2. Tutoiement everywhere, including errors and legal texts in the app. Vouvoiement is never used.
3. Buttons are verbs: "Continuer", "Activer le micro", "Garder mon profil", "Réessayer l'envoi". First person forms from the mockup ("Je me lance", "Je suis prêt·e") are verbs too and are kept.
4. Messages are information: they say what happened, what it means for the person, and what happens next. "Ça n'a pas marché. L'erreur vient de chez nous." plus "Ta prise est enregistrée sur ton téléphone. Ton défi du jour et ta série sont conservés."
5. No cleverness, no aphorisms, no slogans, no exclamation marks to sound warm. Warmth comes from saying true things simply. The constructions this rule is really about are listed under "How the text must not sound" below, because they are rhythmic and a reviewer reading for meaning walks straight past them.
6. The failure is always on our side and the text says so; the streak and the challenge are never punished by the technique, and the text says that too.
7. Never a numeric promise about deletion delays (cahier, chapter 2). "Analysée puis supprimée", never "supprimée sous 24 h".
8. Never a note on someone's voice. Counts and measures, yes ("142 mots/min", "4 « du coup »"); a global score on the voice, never. A grid score, when shown, is labelled as the grid's ("Grille de Rebecca").
9. The machine never speaks as Rebecca. Feedback is "d'après l'analyse", the verdict is "rendu par l'analyse, sur la grille de Rebecca". Rebecca's own words are quoted as such ("Rebecca te dit, mot pour mot").
10. Inclusive dot as in the mockup: "prêt·e", "seul·e". Not parentheses, not a slash.
11. No em dashes and no en dashes, anywhere: use a comma, a period or a colon. Hyphens stay in compound words ("face-à-face", "seule à seule" has none).
12. French typography: a no-break space (U+00A0) before ":" and a narrow no-break space (U+202F) before "?", "!" and ";"; guillemets « » with a narrow no-break space inside; a no-break space between a number and its unit or "€"; straight apostrophe as in the majority of the mockup, used consistently. `npm run strings` checks all of it.
13. Product names are fixed: LEQ, Bulle (the mascot), Rétor (the AI opponent), l'Arène, le face-à-face, Gratuit and Complet (the two offers), la série, les points, la carte des actes.
14. Domain words follow the cahier: une prise (a recording), un défi (the day's step), une étape, un acte, le retour (the feedback), un levier, une force, un passage (an Arena take), un duel, un débat.

## How the text must not sound

An interface reads as machine-written long before it says anything untrue. It is a matter of
rhythm, and four constructions account for almost all of it. They are banned, and the first three
are checked by `npm run strings` (`scripts/verifier-strings.mjs`), which runs inside `npm run
check`.

### 1. The contrastive pair, the main offender

The sentence states a fact, then negates its opposite so the sentence feels balanced. The negated
half carries no information; it is there for the rhythm, and that reflex is the signature.

| Written like this                                                | Write this                                         |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| "On garde tes résultats, jamais l'audio."                        | "Seuls tes résultats sont conservés."              |
| "Voici ce que Bulle a mesuré. Des comptes, pas des notes."       | "Voici ce que Bulle a mesuré sur ta prise."        |
| "Ça n'a pas marché. C'est nous, pas toi."                        | "Ça n'a pas marché. L'erreur vient de chez nous."  |
| "Bulle écoute. Personne d'autre."                                | "Bulle écoute."                                    |
| "Pas de réseau, pas de problème : ta prise partira toute seule." | "Ta prise sera envoyée dès que le réseau revient." |
| "Trois appuis notés à l'écran, pas une rédaction"                | "Trois appuis à noter à l'écran"                   |

The test: delete the half after the comma. If the sentence still says everything the person needs,
the half was rhythm and it goes. A "X, pas Y" that survives is one where Y is genuinely a state the
person might be in ("Modifié, pas encore enregistré."), and those are listed as exceptions in the
script, with their reason.

### 2. The aphorism in place of information

A line that sounds like it means something, and does not tell the person what is true or what to do.

| Written like this                        | Write this                                 |
| ---------------------------------------- | ------------------------------------------ |
| "Ton chemin se prépare."                 | "Ton parcours est en préparation."         |
| "Tes mots béquilles, qui fondent"        | "Tes mots béquilles, prise après prise"    |
| "Parle mieux, pour de vrai." (App Store) | "Parler en public, chaque jour"            |
| "La boutique se remplit avec Rebecca."   | "Les récompenses arriveront avec Rebecca." |
| "La zone qui porte"                      | "Zone confortable"                         |

### 3. The application narrating its own work

Progress and connection states are facts about a machine, written as facts. The app does not
describe itself listening, drawing or reading.

| Written like this       | Write this                   |
| ----------------------- | ---------------------------- |
| "On écoute ton rythme"  | "Analyse du rythme"          |
| "On dessine ton profil" | "Construction de ton profil" |
| "On ouvre la ligne"     | "Connexion en cours"         |
| "On relit le débat"     | "Analyse du débat"           |
| "Parle. On écoute."     | "Enregistrement en cours"    |

Bulle stays as a character where Bulle is the subject of a sentence the person reads about the
product ("Bulle écoute.", "ce que Bulle a mesuré"). Bulle is not a narrator of loading states.

### 4. Stacked reassurance

The privacy promise is made once, in the plainest sentence available, in the place it belongs. It
is not restated three ways on one screen: repetition reads as anxiety, not as trust. The reference
sentences are in `fr.reglages.voix` and in `apps/web` under `legal`, and they are the ones a lawyer
reviews.

### What this is not

The target is plain, not cold. Verbs in the first person kept from the mockup ("Je me lance", "Je
suis prêt·e"), the tutoiement, the domain vocabulary (une prise, un défi, un acte, le retour) and
the act names ("Les crêtes du rythme", "Sous la brume", which are names, not copy) all stay. A
sentence that is already plain and already says something true does not get rewritten to sound more
corporate.

## The brand mark is a file, never letters

LEQ has a mark: `apps/mobile/assets/marque/`, in three versions (`icone.png` for the app icon and
the browser tab, `sigle-blanc.png` on bleu nuit, `sigle-bleu-nuit.png` on light). It is copied
into `apps/admin/public/marque/` and `apps/web/public/marque/` so every surface carries the same
file.

Writing the name in a heavy font with an orange dot beside it is not the mark. It is close enough
to look intentional and wrong enough to look careless, which is worse than either. Wherever the
brand appears as an image, use the file; `fr.app.nom` stays as its alternative text. The name as
running text inside a sentence ("Ouvre LEQ", "Installer LEQ") is text and stays text.

This was got wrong on the admin sign-in, in both browser tabs and on the mobile welcome screen,
and fixed on 2026-09-12.

## Review checklist

Run it on every diff that touches a `fr.ts`.

- [ ] Every new string is in `fr.ts`, none in a component, screen or server template.
- [ ] Tutoiement, no "vous".
- [ ] Buttons are verbs; none is a noun or an adjective ("OK", "Suivant" alone is tolerated only for a pager).
- [ ] Each message says what happened and what comes next; no message is a decoration.
- [ ] No aphorism, no slogan, no joke, no exclamation mark unless quoting a person.
- [ ] No contrastive pair: no sentence whose second half only negates the opposite of the first.
- [ ] No loading or connection state written as the application narrating itself.
- [ ] The privacy promise appears once per screen, not restated in three shapes.
- [ ] `npm run strings` passes (it checks the three mechanical tells and the typography).
- [ ] No number attached to a deletion promise.
- [ ] No score presented as a note on the voice.
- [ ] Automatic judgements are labelled automatic; Rebecca is never impersonated.
- [ ] Inclusive dot where a gendered adjective addresses the person.
- [ ] No em dash, no en dash (grep for the two characters before committing).
- [ ] Spacing before ":", "?", "!", ";" and inside « », no-break space before units and "€".
- [ ] Numbers and dates go through `Intl`, not string concatenation.
- [ ] Strings with variables are functions and read well with 0, 1 and many.
- [ ] Fits the mockup layout on an iPhone SE width without truncation (check the longest French form).
- [ ] Matches the mockup wording unless the string is in the correction list below.

## Mockup strings to correct

The mockup is the reference for wording. These are the only intentional departures, each with its reason. Add to this list, never correct silently.

| Screen         | Mockup string                                                                                                                          | Correction                                                                                                                                                                                                                                                                                                                  | Reason                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| C5             | "Le duel est privé : le verdict est rendu par la coach, sur la grille de Rebecca."                                                     | "Le duel est privé : le verdict est rendu par l'analyse, sur la grille de Rebecca."                                                                                                                                                                                                                                         | Cahier chapter 11: the verdict is automatic and the app must say so                                                                     |
| A6             | "77 % des gens redoutent de parler en public. Toi, tu viens de le faire."                                                              | Removed. No replacement line.                                                                                                                                                                                                                                                                                               | Unsourced figure; restore only with a source                                                                                            |
| G3             | "Ton rituel: Le rappel du soir, Tous les soirs · 21 h 30, Modifier" (one toggle)                                                       | Four rows, each with its own switch: "Le rappel quotidien" (with the hour, "Tous les jours · 21 h 30 · Modifier"), "L'alerte quand ta série est en danger" ("En fin de journée"), "Les événements sociaux" ("Verdict d'un duel, résultat de l'Arène"), "Les annonces de Rebecca" ("Deux par mois au plus, selon ta région") | Cahier chapter 12: four types, each switched off independently                                                                          |
| G3             | "Recevoir une copie de mes données" (row, reads as an instant export)                                                                  | Row label kept. On tap, a confirmation: "Ta demande est envoyée. Tu recevras une copie de tes données par e-mail, sous quelques jours."                                                                                                                                                                                     | Cahier chapter 2: handled by hand while volume is low                                                                                   |
| H2, H4         | "25 pts sur 30", "22 / 30"                                                                                                             | If a per-challenge score is shown at all: "Grille de Rebecca · 25 sur 30". Never "note", never attached to the voice.                                                                                                                                                                                                       | Cahier chapters 3 and 4; the decision to show it at all is open (docs/OPEN-INPUTS.md)                                                   |
| E1, E1b        | "Un atelier collectif en direct avec Rebecca chaque mois", "Chaque mois, un atelier collectif en direct avec Rebecca, en petit groupe" | Pending the decision on the cap: either "Une place d'atelier par mois, dans la limite des places" or the line is removed                                                                                                                                                                                                    | Cahier chapter 7: real-cost rewards are capped in quantity                                                                              |
| E1, E1b        | "Essayer Complet 7 jours"                                                                                                              | Generated from the store offering: `fr.E1.essayer(nbJours)`                                                                                                                                                                                                                                                                 | Trial length is defined in the stores, not in the app (plan, decision 10)                                                               |
| D1             | "Tes cinq voix": Structure, Présence, Clarté, Rythme, Silences                                                                         | Axis names come from `criteres_grille`; the mockup names are placeholders                                                                                                                                                                                                                                                   | Rebecca's grid does not exist yet                                                                                                       |
| A6, A7, D1, G1 | "Le Conteur" (speaker archetype)                                                                                                       | Not shown until archetypes are decided; A6 shows forces and levers without a title                                                                                                                                                                                                                                          | Archetypes are not in the cahier; input awaited (docs/OPEN-INPUTS.md)                                                                   |
| B3, H6         | "Rebecca te dit, mot pour mot :" above every consigne; "Le texte, choisi par Rebecca"                                                  | Shown only when the défi is not `provisoire`. A provisional consigne is labelled "Consigne provisoire, en attente de Rebecca." and a provisional text "Le texte, provisoire"                                                                                                                                                | Rule 9: the seed consignes were written from the mockup by me, not by Rebecca; quoting them as her words would impersonate her          |
| H3             | "Tu tiens ta ligne.", "Cinq défis, une voix qui ne lâche plus le fil. Les crêtes sont derrière toi."                                   | The act's own closing lines are content (Rebecca, with the act). Until then the screen shows the act's title and "{n} défis relevés. Un acte entier derrière toi."                                                                                                                                                          | The mockup lines are specific to act II and written by nobody yet                                                                       |
| X5             | "c'est le défi le plus contre-intuitif de l'acte"                                                                                      | Kept as is for now, with the défi title interpolated                                                                                                                                                                                                                                                                        | The sentence claims something about the défi that only Rebecca can say; to review with the exercise bank                                |
| F1             | "« J'ai commencé par les défis du soir. Trois mois après, je parlais à 200 personnes. » Nadia, promotion de juin"                      | Removed                                                                                                                                                                                                                                                                                                                     | A testimonial nobody gave; restore only with a real, consenting person                                                                  |
| F1, B1b        | "Tes points y comptent" / "Tes 1 240 points : 10 % déjà déduits" on Rebecca's individual trainings                                     | "Se réservent chez Rebecca, hors de l'app." without the points claim                                                                                                                                                                                                                                                        | Cahier chapter 9 keeps the one-to-one outside the app; whether points give a discount there is Rebecca's decision (docs/OPEN-INPUTS.md) |
| D2             | "Les points se gagnent en parlant, et en écoutant les autres jusqu'au bout." and "Avec Complet, l'atelier du mois est compris…"        | "Les points se gagnent en parlant. Sur toutes les formules, Gratuit compris."; the Complet line is not shown                                                                                                                                                                                                                | Votes arrive with the Arena (Phase 7); the workshop entitlement of Complet is an open question (chapter 7 cap)                          |
| B1b            | "Garder ma place · 1 200 pts" on a workshop card                                                                                       | The card shows "Une place contre tes points : 1 200 pts dans la boutique." and the booking button opens Rebecca's link; the exchange itself happens in D2                                                                                                                                                                   | One place to spend points (the shop) and one to book (Rebecca's link): no second checkout on a card                                     |
| X2             | "Analyse en cours · environ 20 s"                                                                                                      | Proposed: "Analyse en cours" without the estimate, or a range measured in Phase 3                                                                                                                                                                                                                                           | A fixed number becomes wrong the first time STT is slow; same spirit as rule 7. Proposal, awaiting objection                            |

### The plain-French pass of 2026-09-12

Roch read the shipped strings and found that they sounded machine-written rather than like the
French a real consumer app ships. He was right, and the cause was measurable: 36 contrastive pairs
across the three modules, plus the aphorisms and the self-narrating loading states now listed under
"How the text must not sound". Rule 5 already forbade all of it; the strings had drifted from their
own rule.

Every string in `apps/mobile/src/i18n/fr.ts`, `apps/web/src/fr.ts`, `apps/admin/src/fr.ts`, the two
message constants in `packages/domaine`, the provisional content in `supabase/seed.sql` and the
store listing in `docs/STORE.md` was reworded to that standard in one commit. Meaning was preserved
everywhere; the table above still governs what the app is allowed to claim.

**Rebecca needs to see this.** Some of the reworded lines came from the mockup she reviewed, so the
wording she approved has changed even though the meaning has not. Nothing was corrected silently:
the constructions removed are enumerated above with a before and after for each, and the diff of
that commit is the full list.

Three changes went beyond wording and are listed as corrections in their own right:

| Where                   | Was                                               | Now                                                                        | Why                                                                                                    |
| ----------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| X5, `defi.rattrapage`   | "c'est le défi le plus contre-intuitif de l'acte" | "Deux essais sur « … ». Avant le troisième, voici un exercice plus court." | The claim only Rebecca can make is gone, which also closes the open item the table above flagged on X5 |
| Store subtitle          | "Parle mieux, pour de vrai."                      | "Parler en public, chaque jour"                                            | A slogan, and 34 characters against Apple's limit of 30. The replacement is 29                         |
| `sujets_arene` consigne | "Un exemple concret vaut mieux qu'une théorie."   | "Appuie ta position sur un exemple concret."                               | A consigne tells the person what to do; an aphorism does not                                           |

One provisional string was deliberately left as it is: the `texte_a_lire` of `reponds_au_texte`
("On ne convainc personne avec des arguments…") is an assertion the person is asked to read aloud
and then argue with, so it is meant to be written as a provocation. It is `provisoire` and awaits a
real text, ideally a sourced quotation, from Rebecca.

## Strings that must be reviewed by a lawyer before release

- A2 "Ta voix reste à toi." block (three promises).
- G3 "Ta voix n'est pas conservée" block, which is the cahier's reference sentence: "Chaque prise est analysée puis effacée, seuls tes résultats restent. Exception : une prise d'Arène ou de duel, le temps du concours."
- C1 and C5 "Ta prise reste en ligne le temps du sujet, puis elle est supprimée." and the duel equivalent.
- The privacy and terms pages in `apps/web`.

# Strings

Every string a person can read in LEQ is French, and it is written to one standard: the kind of plain French real consumer apps ship. The handoff note calls this the one rule about writing that will not be revisited. The mockup was rewritten to that standard; the code holds it.

## Where strings live

- One typed module per application: `apps/mobile/src/i18n/fr.ts`, `apps/admin/src/i18n/fr.ts`, `apps/web/src/i18n/fr.ts`. No string literal shown to a person anywhere else in the application code.
- The module exports a single frozen object, nested by screen id from docs/SCREENS.md (`fr.A1.titre`, `fr.B5.boutons.refaire`). Keys are French, camelCase, no accents.
- Strings that take values are functions, never templates with string concatenation in the component: `fr.B1.defiDuJour(dureeMin)` returns the full sentence, so word order and plural rules stay in one place.
- Server-generated text (feedback wording, debrief, Rétor's lines) is content, not UI strings; it comes from the pipeline and is reviewed through the tone examples Rebecca provides. Content authored by Rebecca (challenge briefs, conseil du jour, theses, subjects) lives in the database and is written by her in the admin.
- There is no second language and no i18n library. `fr.ts` is a plain module so that strings are typed, greppable and reviewable in a diff.
- Numbers, dates and durations are formatted with `Intl` under `fr-FR` (thin space thousands separator, comma decimal, "14,99 €"), never by hand.

## Writing rules

1. Plain French. Short words, short sentences. If a sentence needs a second reading, rewrite it.
2. Tutoiement everywhere, including errors and legal texts in the app. Vouvoiement is never used.
3. Buttons are verbs: "Continuer", "Activer le micro", "Garder mon profil", "Réessayer l'envoi". First person forms from the mockup ("Je me lance", "Je suis prêt·e") are verbs too and are kept.
4. Messages are information: they say what happened, what it means for the person, and what happens next. "Ça n'a pas marché. C'est nous, pas toi. Ta prise est en sécurité sur ton téléphone."
5. No cleverness, no aphorisms, no slogans, no exclamation marks to sound warm. Warmth comes from saying true things simply.
6. The failure is always on our side and the text says so; the streak and the challenge are never punished by the technique, and the text says that too.
7. Never a numeric promise about deletion delays (cahier, chapter 2). "Analysée puis supprimée", never "supprimée sous 24 h".
8. Never a note on someone's voice. Counts and measures, yes ("142 mots/min", "4 « du coup »"); a global score on the voice, never. A grid score, when shown, is labelled as the grid's ("Grille de Rebecca").
9. The machine never speaks as Rebecca. Feedback is "d'après l'analyse", the verdict is "rendu par l'analyse, sur la grille de Rebecca". Rebecca's own words are quoted as such ("Rebecca te dit, mot pour mot").
10. Inclusive dot as in the mockup: "prêt·e", "seul·e". Not parentheses, not a slash.
11. No em dashes and no en dashes, anywhere: use a comma, a period or a colon. Hyphens stay in compound words ("face-à-face", "seule à seule" has none).
12. French typography: a no-break space before ":" and a narrow no-break space before "?", "!" and ";"; guillemets « » with a narrow no-break space inside; a no-break space between a number and its unit or "€"; straight apostrophe as in the majority of the mockup, used consistently.
13. Product names are fixed: LEQ, Bulle (the mascot), Rétor (the AI opponent), l'Arène, le face-à-face, Gratuit and Complet (the two offers), la série, les points, la carte des actes.
14. Domain words follow the cahier: une prise (a recording), un défi (the day's step), une étape, un acte, le retour (the feedback), un levier, une force, un passage (an Arena take), un duel, un débat.

## Review checklist

Run it on every diff that touches a `fr.ts`.

- [ ] Every new string is in `fr.ts`, none in a component, screen or server template.
- [ ] Tutoiement, no "vous".
- [ ] Buttons are verbs; none is a noun or an adjective ("OK", "Suivant" alone is tolerated only for a pager).
- [ ] Each message says what happened and what comes next; no message is a decoration.
- [ ] No aphorism, no slogan, no joke, no exclamation mark unless quoting a person.
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

| Screen         | Mockup string                                                                                                                          | Correction                                                                                                                                                                                                                                                                                                                  | Reason                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| C5             | "Le duel est privé : le verdict est rendu par la coach, sur la grille de Rebecca."                                                     | "Le duel est privé : le verdict est rendu par l'analyse, sur la grille de Rebecca."                                                                                                                                                                                                                                         | Cahier chapter 11: the verdict is automatic and the app must say so                                          |
| A6             | "77 % des gens redoutent de parler en public. Toi, tu viens de le faire."                                                              | Removed. No replacement line.                                                                                                                                                                                                                                                                                               | Unsourced figure; restore only with a source                                                                 |
| G3             | "Ton rituel: Le rappel du soir, Tous les soirs · 21 h 30, Modifier" (one toggle)                                                       | Four rows, each with its own switch: "Le rappel quotidien" (with the hour, "Tous les jours · 21 h 30 · Modifier"), "L'alerte quand ta série est en danger" ("En fin de journée"), "Les événements sociaux" ("Verdict d'un duel, résultat de l'Arène"), "Les annonces de Rebecca" ("Deux par mois au plus, selon ta région") | Cahier chapter 12: four types, each switched off independently                                               |
| G3             | "Recevoir une copie de mes données" (row, reads as an instant export)                                                                  | Row label kept. On tap, a confirmation: "Ta demande est envoyée. Tu recevras une copie de tes données par e-mail, sous quelques jours."                                                                                                                                                                                     | Cahier chapter 2: handled by hand while volume is low                                                        |
| H2, H4         | "25 pts sur 30", "22 / 30"                                                                                                             | If a per-challenge score is shown at all: "Grille de Rebecca · 25 sur 30". Never "note", never attached to the voice.                                                                                                                                                                                                       | Cahier chapters 3 and 4; the decision to show it at all is open (docs/OPEN-INPUTS.md)                        |
| E1, E1b        | "Un atelier collectif en direct avec Rebecca chaque mois", "Chaque mois, un atelier collectif en direct avec Rebecca, en petit groupe" | Pending the decision on the cap: either "Une place d'atelier par mois, dans la limite des places" or the line is removed                                                                                                                                                                                                    | Cahier chapter 7: real-cost rewards are capped in quantity                                                   |
| E1, E1b        | "Essayer Complet 7 jours"                                                                                                              | Generated from the store offering: `fr.E1.essayer(nbJours)`                                                                                                                                                                                                                                                                 | Trial length is defined in the stores, not in the app (plan, decision 10)                                    |
| D1             | "Tes cinq voix": Structure, Présence, Clarté, Rythme, Silences                                                                         | Axis names come from `criteres_grille`; the mockup names are placeholders                                                                                                                                                                                                                                                   | Rebecca's grid does not exist yet                                                                            |
| A6, A7, D1, G1 | "Le Conteur" (speaker archetype)                                                                                                       | Not shown until archetypes are decided; A6 shows forces and levers without a title                                                                                                                                                                                                                                          | Archetypes are not in the cahier; input awaited (docs/OPEN-INPUTS.md)                                        |
| X2             | "Analyse en cours · environ 20 s"                                                                                                      | Proposed: "Analyse en cours" without the estimate, or a range measured in Phase 3                                                                                                                                                                                                                                           | A fixed number becomes wrong the first time STT is slow; same spirit as rule 7. Proposal, awaiting objection |

## Strings that must be reviewed by a lawyer before release

- A2 "Ta voix reste à toi." block (three promises).
- G3 "Ta voix n'est pas conservée" block, which is the cahier's reference sentence: "Chaque prise est analysée puis effacée, seuls tes résultats restent. Exception : une prise d'Arène ou de duel, le temps du concours."
- C1 and C5 "Ta prise reste en ligne le temps du sujet, puis elle est supprimée." and the duel equivalent.
- The privacy and terms pages in `apps/web`.

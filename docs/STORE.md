# Store listing, privacy labels and review notes

Everything the two stores ask for before LEQ can be published, written from what the application
actually does. The privacy answers are not a guess: each line below names the table or the bucket
it comes from, so anyone can check it against `docs/DATA-MODEL.md` and the migrations.

Status: drafted 2026-09-12, **not yet submitted**. The lines marked **Roch** need a decision or an
account he holds. The privacy policy and the terms still need a lawyer (cahier chapter 2).

## 1. Identity

| Field                    | Value                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Name                     | LEQ                                                                                            |
| Bundle id / package      | `com.leqapp.mobile`                                                                            |
| App Store Connect id     | 6809261668                                                                                     |
| Primary language         | French (France)                                                                                |
| Category                 | Education, secondary Productivity                                                              |
| Age rating               | 12+ (user-generated content in the Arena and duels, moderated)                                 |
| Support e-mail           | join.leq@gmail.com                                                                             |
| Support and privacy URLs | **Roch**: a domain. Until then `https://leq-serveur.fly.dev/confidentialite` and `/conditions` |

## 2. Listing text (French)

**Subtitle, 30 characters max**

> Parler en public, chaque jour

**Promotional text, 170 characters max**

> Un défi de parole par jour. LEQ analyse ta voix en quelques minutes et t'indique quoi
> travailler, sur les critères de Rebecca, coach en prise de parole.

**Description**

> LEQ t'entraîne à parler en public, tous les jours, en quelques minutes.
>
> Tu enregistres. LEQ mesure ton débit, tes silences, tes mots béquilles et la tenue de ta voix.
> Tu reçois un retour construit sur les critères de Rebecca, coach en prise de parole : ce qui a
> marché, et le point à travailler ensuite.
>
> **Ton défi du jour**
> Un parcours en trois actes, un défi par jour, du format court aux cinq minutes préparées. La
> difficulté suit ce que tu sais déjà faire.
>
> **Ta voix n'est pas conservée**
> Chaque prise est analysée puis effacée. Seuls tes résultats sont conservés, sous forme de texte
> et de chiffres. L'application ne garde aucune bibliothèque de tes enregistrements.
>
> **L'Arène et les duels**
> Un sujet par semaine, les passages des autres, un vote par paires. Ou un duel privé : deux
> personnes, le même sujet, quarante-huit heures. Le verdict est rendu par l'analyse, sur les
> critères de Rebecca, et l'application le dit.
>
> **Le face-à-face**
> Un débat en direct contre Rétor, une intelligence artificielle qui répond vraiment à ton
> argument. Le débriefing s'appuie sur le texte du débat.
>
> **Ta série**
> Une journée est validée dès que tu enregistres. Une récupération par mois est disponible en cas
> de jour manqué.

**Keywords, 100 characters** (no spaces after commas, Apple counts them)

> parler,oral,prise de parole,éloquence,discours,coach,voix,trac,débat,entretien,confiance

**What's new, first version**

> La première version de LEQ : le parcours quotidien, l'analyse de ta voix et le retour construit
> sur les critères de Rebecca.

## 3. App Store privacy labels

Answer per data type. "Linked to you" means tied to the account; "tracking" is Apple's own sense
(sharing with a data broker or cross-app advertising), and LEQ does none of it.

| Data type                | Collected | Linked | Tracking | Purpose           | Where it lives                                                                                                           |
| ------------------------ | --------- | ------ | -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| E-mail address           | Yes       | Yes    | No       | App functionality | `auth.users`, for signing in                                                                                             |
| Name (first name only)   | Yes       | Yes    | No       | App functionality | `profils.prenom`, optional, shown only if opted in                                                                       |
| Audio data               | Yes       | Yes    | No       | App functionality | `audio-tentatives`, **deleted after analysis**; an Arena or duel take lives in `audio-public` for the contest, then goes |
| Coarse location (region) | Yes       | Yes    | No       | App functionality | `profils.region`, a chosen region from a fixed list, never GPS                                                           |
| Product interaction      | Yes       | Yes    | No       | App functionality | `tentatives`, `evaluations`, streak and points ledgers                                                                   |
| Device id (push token)   | Yes       | Yes    | No       | App functionality | `jetons_push`, only to deliver the notifications the person switched on                                                  |
| Diagnostics (crash data) | **Roch**  | No     | No       | App functionality | Only if a crash reporter is added (section 6)                                                                            |

Not collected, and worth stating because reviewers look for it: no contacts, no photos, no
precise location, no browsing history, no advertising identifier, no purchase history beyond the
subscription state the store itself holds, no third-party analytics.

**The sentence that explains the audio line**, for the reviewer and for the label's description:

> La voix est enregistrée, envoyée pour analyse, puis supprimée. Seuls les résultats de l'analyse
> sont conservés. Une exception, annoncée à l'utilisateur au moment de l'envoi : une prise d'Arène
> ou de duel reste en ligne le temps du vote, puis elle est supprimée.

## 4. Play Data safety

Same content, in Google's shape.

| Section                    | Answer                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| Data collected             | E-mail, first name, audio, approximate location (region), app activity, device id (push token) |
| Data shared                | With processors only (hosting, transcription, model, voice, push), never sold, never brokered  |
| Encrypted in transit       | Yes, everywhere                                                                                |
| Deletion                   | Yes, from the app: Réglages → Supprimer mon compte, and by e-mail at join.leq@gmail.com        |
| Data collected is optional | First name and region are optional; audio is required to use the app at all                    |

## 5. Notes for the reviewer

> LEQ est en français. Pour tester :
>
> 1. L'écran d'accueil propose un diagnostic sans compte. Appuyez sur « C'est parti », autorisez le
>    micro, répondez à trois questions et enregistrez une minute de parole. Le retour arrive en
>    moins d'une minute.
> 2. Le compte n'est demandé qu'après, pour conserver le résultat.
> 3. L'Arène, les duels et le face-à-face sont contrôlés par des drapeaux côté serveur. Dites-nous
>    si vous voulez les voir et nous les activons pour votre compte.
>
> L'enregistrement est supprimé après analyse : c'est volontaire et décrit dans la politique de
> confidentialité.

**Roch**: a demo account with an e-mail and password the reviewer can use, in case they refuse the
anonymous path. Apple asks for one whenever any part of the app sits behind a login.

## 6. What is still open

| Item                                             | Who                | Note                                                                              |
| ------------------------------------------------ | ------------------ | --------------------------------------------------------------------------------- |
| Privacy policy and terms, real text              | Lawyer             | `apps/web/src/pages` holds the honest draft from chapter 2 and says it is a draft |
| A domain                                         | **Roch**           | Support, privacy and duel links all point at the Fly hostname until then          |
| Demo account for the reviewer                    | **Roch**           |                                                                                   |
| Screenshots, 6.7" and 6.1"                       | Me                 | Taken from the simulator once the provisional content is replaced                 |
| Crash reporting                                  | **Roch**           | Sentry needs an account and a DSN. The app is wired to stay silent without one    |
| Provider DPAs                                    | **Roch**           | One per processor, after the bench picks them (`docs/EXTERNAL-SERVICES.md`)       |
| Price and the plan that contains the face-à-face | **Roch** + Rebecca | Chapter 9: the cost of one real session has to be measured first                  |
| The sentence that defines "version one is done"  | **Roch** + Rebecca | Chapter 18                                                                        |

# ADR-012. A public take is live on send; the screening holds, Rebecca withdraws

Date: 2026-09-17. Status: accepted. Replaces decision 12 of the plan (« moderation is a state »).

## Context

Phase 7 shipped the Arena with an approval queue: every public take passed `en_moderation`
between analysis and publication, and an admin published it by hand. The cahier des charges never
asked for that. Chapter 11 says Rebecca must be able to withdraw a public take or suspend an
account, and defines what goes (sexual content, harassment of real people, what is illegal) and
what stays (politics, religion, ethics). The queue was an addition of the plan. In practice nobody
staffed it: the first real passage waited a day, and the moderation page had no way to play it.

## Decision

1. `publier_prise()` publishes at once. The status `en_moderation` no longer exists.
2. The worker screens the transcript of an Arena or duel take at analysis time with OpenAI's
   moderation endpoint (free), maps the provider's categories onto the six of chapter 11, and
   writes the verdict in `analyses.moderation`. Categories the cahier does not name are ignored,
   so the filter cannot grow stricter than the policy on its own.
3. A flagged take gets the status `signalee`: visible to its author and to admins, to nobody
   else, never served to voters. A take without a verdict publishes: an outage of the filter must
   not close the Arena.
4. Every event about a take is told to the person by push, in the words of the Arena tab (held,
   published, withdrawn); a flag is told to every admin with the app. One job per event.
5. Rebecca reviews with the audio, the transcript and the reasons, through an admin-only function
   scoped to public takes, then publishes or withdraws. Withdrawal after the fact stays as it was.

## Consequences

- The Arena reads as the cahier describes it: a person speaks, the others hear them.
- The screening is a classifier, not a judge: it will miss some things and flag some things. The
  withdrawal path covers the first; Rebecca's review covers the second. Neither blocks the honest
  majority.
- The transcript of a public take is readable by an admin. It already was the only thing kept
  from the voice, and the person chose to make that take public; nothing of a private take opens.

# ADR-009: Ledgers, not counters

Status: Accepted
Date: 2026-09-06

## Context

Chapter 6 of the cahier defines the streak by one rule: what validates a day is recording, and a technical failure on our side must never break it. Chapter 7 defines points that are earned by speaking and by voting, spent in a shop, and a monthly quantity cap on any reward that costs Rebecca real money. Chapter 10 adds a debate quota that a session cut on our side must not consume. Phones record offline and upload later, sometimes the next day, in any timezone. A stored counter (`serie.compteur`, `points.solde`) has to be updated at exactly the right moment by exactly the right process, and every retry, late arrival, refund or cancelled exchange becomes a special case that corrupts it silently.

## Decision

- Points are an append-only ledger, `mouvements_points`: one row per credit or debit with a `motif` and a `reference` (the attempt, the vote, the exchange), unique together. The balance is the sum. A replayed job or a doubled webhook inserts nothing the second time; a cancelled exchange is a new `remboursement` row, never an edit.
- The streak is never stored. `calculer_serie` replays the distinct local days that have a `tentatives` row (any state) plus the days covered by a recovery, computes the current run, the record and the week strip. Each attempt carries its recording time with its IANA timezone, so an offline take that arrives tomorrow validates the day it was spoken. The record survives a break by construction.
- One recovery per month (`recuperations_serie_par_mois`), activated by the person, covers exactly one missed day: yesterday, when yesterday is empty and the day before was active, even if the person already recorded today. A gap of two days or more is a broken streak; that fragility is the mechanism (chapter 6).
- The shop's cap is a count of exchanges in the month, not a stored remaining quantity. `echanger_recompense` takes an advisory lock per person and per capped reward, checks the balance and the count, then inserts the exchange and the debit in one transaction.
- The debate quota (Phase 8) follows the same rule: a session ledger with an outcome, where an interrupted session is not consumed.
- Only security definer functions write these tables. Clients read their own rows.

## Consequences

- Idempotence comes from the schema, not from careful code: the unique key on (`motif`, `reference`) is the whole protection against double credit.
- Every number the app shows is reproducible from rows a person can read, which is what the GDPR export needs anyway.
- Replaying the streak costs a scan of one person's attempts on every read. At the volumes of a coaching app this is milliseconds; a materialised cache can be added later without changing the contract.
- Correcting a mistake means adding a compensating row (`ajustement`), visible in the history, never editing one.

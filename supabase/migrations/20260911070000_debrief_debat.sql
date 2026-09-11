-- LEQ, migration "debrief_debat" (Phase 8). The end-of-debate note of chapter 10.
--
-- It is written from the transcript, never from the audio, which is why it can exist at all:
-- there is no debate audio anywhere to read (chapter 2). It lands on the session itself rather
-- than in a table of its own, because there is exactly one per debate and it is never queried
-- apart from it.

alter table public.debats
  add column if not exists debrief jsonb;
comment on column public.debats.debrief is
  'Moments clés et axe de travail, écrits depuis la transcription écrite. Null tant que le débriefing n''est pas fait.';

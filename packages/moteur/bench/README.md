# STT bench (Phase 2)

Compares speech-to-text providers on French audio before the engine is finalised (cahier, chapter 15). Nothing here decides anything yet: the corpus is empty and the providers have no API key. The harness runs today with the `stub` transcriber, so the report format and the metrics are already exercised.

## Corpus layout

```
bench/corpus/
  metadata.json          one entry per recording
  <id>.wav               16 kHz mono PCM recommended (any WAV the codec reads)
  <id>.txt               reference transcript, plain text, punctuation optional
```

`metadata.json`:

```json
[
  {
    "id": "cv-fr-0001",
    "source": "common-voice-fr",
    "accent": "belge",
    "debit": "rapide",
    "bruit": "calme",
    "duree_s": 6.2,
    "consentement": "licence CC0"
  }
]
```

`accent` values used in the report: `france`, `belge`, `suisse`, `quebecois`, `africain`, `autre`. `debit`: `lent`, `normal`, `rapide`. `bruit`: `calme`, `bureau`, `rue`. Recordings of Roch, Rebecca and consenting trainees carry `"consentement": "écrit, <date>"`. The corpus is git-ignored: it holds voices.

## Metrics

- **WER** (word error rate) per recording and per accent group, with the French normalisation of `src/wer.ts` (lowercase, apostrophes and hyphens split, punctuation dropped, accents kept).
- **Latency**: wall-clock time of the batch call, p50 and p95 per provider.
- **Cost per minute**: declared by the adapter from the provider's public price list, so the report shows the money side next to the quality side.
- **Processing region and retention**: declared by the adapter (EU processing available or not, zero-retention terms), because the cahier's chapter 2 makes both a product commitment.

Streaming latency (the debate) is measured separately once the streaming adapters exist; the batch bench comes first.

## Run

```bash
npm run build --workspace @leq/moteur
DEEPGRAM_API_KEY=... node packages/moteur/dist/bench/src/cli.js --fournisseurs stub,deepgram --corpus packages/moteur/bench/corpus --sortie packages/moteur/bench/rapports
```

Providers: `stub` (always available), `deepgram`, `gladia`, `openai`, `assemblyai`. A provider without its key is reported as "clé API manquante" and skipped, not silently dropped. The report is a Markdown file named by date in `bench/rapports/` (git-ignored); the decision goes into an ADR with the numbers copied in.

## Status

The four real adapters raise "Clé API manquante" and do not call any API yet: their HTTP integration is written when the keys arrive, against the provider documentation of that day, and verified on the corpus. Doing it blind would produce code nobody can trust.

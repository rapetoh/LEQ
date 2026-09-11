# @leq/web (Phase 7)

Public web surface of LEQ. It holds:

- **the duel invitation** at `/duel/:jeton`. Chapter 11 of the cahier: the link works without the
  application. The invitee reads the subject, records in the browser (MediaRecorder), sends, and
  sees the verdict. They never hear the inviter's take before recording, which is the whole point
  of the rule: otherwise everyone aligns on the first good answer heard;
- **the legal pages** `/confidentialite` and `/conditions`, carrying the chapter 2 statement;
- **the install link**, shown only when `VITE_LIEN_APPLICATION` is set, so the page never offers
  a dead link before the app is published.

## How a duel invitee goes through it

1. `lire_duel_par_jeton` answers the subject, the ceiling and the deadline. Nothing else: not the
   other take, not who sent it.
2. Pressing "Enregistrer ma réponse" signs in anonymously and calls `rejoindre_duel`, which claims
   the invitee's seat. This happens **before** recording, so a refusal (duel closed, expired,
   already answered) is said before the effort, not after it.
3. The browser records with automatic gain, noise suppression and echo cancellation off, the same
   way the phone does: those three change the very measures the grid reads.
4. The take is uploaded to `audio-tentatives` at `{uid}/{tentative}.m4a` and the `tentatives` row
   is inserted with `type = 'duel'`. The `.m4a` name is what the storage policy of the socle
   migration accepts; the bytes are whatever the browser wrote (mp4 on Safari, webm on Chrome and
   Firefox) and the worker decodes by probing the content, not the name.
5. The page waits for the analysis, then calls `publier_prise`: the deliberate gesture of chapter 11. The conservation sentence sits next to the send button, because chapter 2 says the person
   is told at the moment of sending.
6. `cloturer_duel` runs on the server when both have spoken or at the deadline. The page polls the
   duel row and shows the verdict, said plainly to be rendered by the analysis.

## Running it

```
cp .env.example .env.local   # then fill in the publishable key
npm run dev -w @leq/web      # http://localhost:5175/duel/<jeton>
```

Recording needs a secure context: `localhost` works, a plain-http LAN address does not.

/**
 * What one face-à-face consumed at the providers, counted as it happens.
 *
 * The plan refused to invent the cost of a debate (chapter 9 prices the paid plan on it), and
 * a bill at the end of the month says nothing about one session. So every provider call
 * reports what it used, the session adds it up, and the row keeps the total. Units are the
 * providers' own: seconds of audio in, tokens through the language model, characters and
 * seconds of voice out. No price lives here; prices change, and the reading is done elsewhere.
 */

export interface ConsommationTranscription {
  /** Seconds of the person's audio handed to the transcriber. */
  audio_entree_s: number
  /** Audio tokens the provider says it billed, when it says so. */
  jetons_audio?: number
  /** Text tokens the provider produced, when it says so. */
  jetons_texte?: number
}

export interface ConsommationTexte {
  /** Prompt tokens, cached ones included. */
  jetons_entree: number
  /** Prompt tokens served from the provider's cache, billed at the lower rate. */
  jetons_caches: number
  jetons_sortie: number
  appels: number
}

export interface ConsommationVoix {
  caracteres: number
  /** Seconds of voice received, from the byte count of the PCM. */
  audio_s: number
  appels: number
}

export interface ConsommationDebat {
  version: 1
  transcription: ConsommationTranscription
  retor: ConsommationTexte
  voix: ConsommationVoix
  /** Added by the job that writes the note, after the session is closed. */
  debrief?: ConsommationTexte
}

export function consommationVide(): ConsommationDebat {
  return {
    version: 1,
    transcription: { audio_entree_s: 0 },
    retor: { jetons_entree: 0, jetons_caches: 0, jetons_sortie: 0, appels: 0 },
    voix: { caracteres: 0, audio_s: 0, appels: 0 },
  }
}

/** Adds one provider report to the running total. Every field is a sum. */
export class CompteurConsommation {
  private total = consommationVide()

  transcription(partie: ConsommationTranscription): void {
    const t = this.total.transcription
    t.audio_entree_s = arrondir(t.audio_entree_s + partie.audio_entree_s)
    if (partie.jetons_audio !== undefined)
      t.jetons_audio = (t.jetons_audio ?? 0) + partie.jetons_audio
    if (partie.jetons_texte !== undefined)
      t.jetons_texte = (t.jetons_texte ?? 0) + partie.jetons_texte
  }

  texte(partie: ConsommationTexte): void {
    ajouterTexte(this.total.retor, partie)
  }

  voix(partie: ConsommationVoix): void {
    const v = this.total.voix
    v.caracteres += partie.caracteres
    v.audio_s = arrondir(v.audio_s + partie.audio_s)
    v.appels += partie.appels
  }

  lire(): ConsommationDebat {
    return structuredClone(this.total)
  }
}

export function ajouterTexte(cible: ConsommationTexte, partie: ConsommationTexte): void {
  cible.jetons_entree += partie.jetons_entree
  cible.jetons_caches += partie.jetons_caches
  cible.jetons_sortie += partie.jetons_sortie
  cible.appels += partie.appels
}

/** What a chat completion answers about itself, in the fields this code reads. */
export function lireUsageChat(usage: unknown): ConsommationTexte {
  const u = (usage ?? {}) as {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
  }
  return {
    jetons_entree: entier(u.prompt_tokens),
    jetons_caches: entier(u.prompt_tokens_details?.cached_tokens),
    jetons_sortie: entier(u.completion_tokens),
    appels: 1,
  }
}

function entier(valeur: unknown): number {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? Math.max(0, Math.round(valeur)) : 0
}

function arrondir(secondes: number): number {
  return Math.round(secondes * 100) / 100
}

import { BUCKET_MEDIAS, cheminMedia, urlMedia, verifierMedia } from '@leq/domaine'
import { useId, useRef, useState } from 'react'

import { fr } from '../fr'
import { supabase } from '../services/supabase'

/**
 * The picture on a workshop, an announcement or a reward. Drag one in or pick one; it is
 * uploaded at once and the field holds the path, never a full URL, so the project can move
 * hosts without rewriting a single row.
 *
 * An invitation with no image reads as a system message, which is the whole reason this exists.
 */
export function ChampImage({
  usage,
  valeur,
  onChange,
  libelle,
  aide,
}: {
  usage: 'ateliers' | 'annonces' | 'recompenses'
  valeur: string | null
  onChange: (chemin: string | null) => void
  libelle: string
  aide?: string
}) {
  const id = useId()
  const entree = useRef<HTMLInputElement | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [survol, setSurvol] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const url = urlMedia(import.meta.env.VITE_SUPABASE_URL ?? '', valeur)

  const televerser = async (fichier: File) => {
    setErreur(null)
    const refus = verifierMedia(fichier)
    if (refus) {
      setErreur(refus === 'type' ? fr.media.refusType : fr.media.refusTaille)
      return
    }
    setEnvoi(true)
    try {
      const chemin = cheminMedia(usage, crypto.randomUUID(), fichier.type)
      const { error } = await supabase.storage
        .from(BUCKET_MEDIAS)
        .upload(chemin, fichier, { contentType: fichier.type, upsert: true })
      if (error) throw new Error(error.message)
      onChange(chemin)
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : fr.media.erreur)
    } finally {
      setEnvoi(false)
      if (entree.current) entree.current.value = ''
    }
  }

  return (
    <div className="media">
      <label className="etiquette" htmlFor={id}>
        {libelle}
      </label>

      {url ? (
        <div className="media-apercu">
          <img src={url} alt="" />
        </div>
      ) : (
        <div
          className="media-zone"
          data-survol={survol ? 'true' : undefined}
          onDragOver={(e) => {
            e.preventDefault()
            setSurvol(true)
          }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            e.preventDefault()
            setSurvol(false)
            const fichier = e.dataTransfer.files[0]
            if (fichier) void televerser(fichier)
          }}
        >
          <input
            id={id}
            ref={entree}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={envoi}
            onChange={(e) => {
              const fichier = e.target.files?.[0]
              if (fichier) void televerser(fichier)
            }}
          />
          <span aria-hidden="true" style={{ fontSize: 22 }}>
            ⊕
          </span>
          <p>{envoi ? fr.media.envoi : fr.media.deposer}</p>
          <p className="media-aide">{fr.media.formats}</p>
        </div>
      )}

      {url ? (
        <div className="media-actions">
          <button
            type="button"
            className="bouton bouton-secondaire bouton-petit"
            disabled={envoi}
            onClick={() => entree.current?.click()}
          >
            {fr.media.remplacer}
          </button>
          <button
            type="button"
            className="bouton bouton-discret bouton-petit"
            disabled={envoi}
            onClick={() => onChange(null)}
          >
            {fr.media.retirer}
          </button>
          <input
            ref={entree}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            hidden
            onChange={(e) => {
              const fichier = e.target.files?.[0]
              if (fichier) void televerser(fichier)
            }}
          />
        </div>
      ) : null}

      {aide && !erreur ? <p className="media-aide">{aide}</p> : null}
      {erreur ? <p className="erreur-champ">{erreur}</p> : null}
    </div>
  )
}

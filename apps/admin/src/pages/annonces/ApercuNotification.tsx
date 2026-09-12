import { urlMedia } from '@leq/domaine'

import { fr } from '../../fr'

/**
 * What the announcement will look like where it lands: a notification on a locked phone.
 *
 * An announcement is the one thing in this space that leaves the building and cannot be taken
 * back. Composing it blind, in a stack of fields, is how a title gets written that is beautiful
 * in a text area and truncated on a lock screen.
 */
export function ApercuNotification({
  titre,
  corps,
  image,
}: {
  titre: string
  corps: string
  image: string | null
}) {
  const url = urlMedia(import.meta.env.VITE_SUPABASE_URL ?? '', image)
  return (
    <aside aria-label={fr.annonces.apercu}>
      <p className="etiquette">{fr.annonces.apercu}</p>
      <div className="apercu-telephone">
        <div className="apercu-ecran">
          <div className="apercu-notification">
            <p className="apercu-entete">
              <img src={`${import.meta.env.BASE_URL}marque/icone.png`} alt="" />
              {fr.app.nom}
            </p>
            <p className="apercu-titre">{titre || fr.annonces.apercuTitre}</p>
            <p className="apercu-corps">{corps || fr.annonces.apercuCorps}</p>
            {url ? <img className="apercu-image" src={url} alt="" /> : null}
          </div>
        </div>
      </div>
      <p className="media-aide" style={{ marginTop: 8, maxWidth: 300 }}>
        {fr.annonces.apercuAide}
      </p>
    </aside>
  )
}

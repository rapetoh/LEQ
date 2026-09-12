import { useNavigate } from 'react-router'

import { Bouton } from '../composants/Bouton'
import { Sigle } from '../composants/Sigle'
import { fr } from '../fr'

// Chapter 2, written for the person and not for the lawyer. The wording itself still goes to a
// lawyer before publication, which the page says out loud rather than hiding.
export function Confidentialite() {
  const naviguer = useNavigate()
  return (
    <main className="document">
      <div className="entete-marque">
        <Sigle />
      </div>
      <h1>{fr.legal.confidentialiteTitre}</h1>
      <p className="petit">{fr.legal.relecture}</p>

      <h2>{fr.legal.voixTitre}</h2>
      <p>{fr.legal.voixTexte}</p>
      <p>{fr.legal.voixException}</p>

      <h2>{fr.legal.compteTitre}</h2>
      <p>{fr.legal.compteTexte}</p>

      <h2>{fr.legal.contactTitre}</h2>
      <p>{fr.legal.contactTexte}</p>

      <div className="pousse">
        <Bouton libelle={fr.legal.retour} variante="texte" onClick={() => void naviguer(-1)} />
      </div>
    </main>
  )
}

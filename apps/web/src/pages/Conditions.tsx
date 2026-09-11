import { useNavigate } from 'react-router'

import { Bouton } from '../composants/Bouton'
import { fr } from '../fr'

export function Conditions() {
  const naviguer = useNavigate()
  return (
    <main className="document">
      <h1>{fr.legal.conditionsTitre}</h1>
      <p className="petit">{fr.legal.relecture}</p>
      <p>{fr.legal.conditionsTexte}</p>
      <div className="pousse">
        <Bouton libelle={fr.legal.retour} variante="texte" onClick={() => void naviguer(-1)} />
      </div>
    </main>
  )
}

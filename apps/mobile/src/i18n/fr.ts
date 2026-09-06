// Every user-facing string of the app. Plain French, tutoiement, buttons are verbs,
// messages are information. No em dashes. Interpolation uses {{nom}}.
export const fr = {
  marque: 'LEQ',
  onglets: {
    aujourdhui: "Aujourd'hui",
    arene: "L'Arène",
    defis: 'Défis',
    progres: 'Progrès',
    moi: 'Moi',
  },
  commun: {
    continuer: 'Continuer',
    retour: 'Retour',
    reessayer: 'Réessayer',
    plusTard: 'Plus tard',
    fermer: 'Fermer',
    chargement: 'Un instant',
    enConstruction: 'En construction',
    bientot: 'Bientôt',
    pret: 'Je suis prêt·e',
    bulle: 'Bulle',
  },
  erreurs: {
    generique: "Ça n'a pas marché. C'est nous, pas toi.",
    reseau: 'Pas de réseau. LEQ réessaie dès qu’il revient.',
    configuration:
      "On n'a pas pu charger les réglages de LEQ. Vérifie ta connexion, puis réessaie.",
    session: "On n'a pas pu ouvrir ta session. Vérifie ta connexion, puis réessaie.",
  },
  accueil: {
    bienvenue: {
      titre: 'Découvre quel orateur tu es.',
      sousTitre:
        'Trois questions, une prise de voix, et on te dessine ton profil. Sans compte, sans engagement.',
      commencer: "C'est parti",
      dejaUnCompte: "J'ai déjà un compte",
    },
    micro: {
      titre: 'Ta voix reste à toi.',
      promesse1: "Ta voix est analysée puis effacée. On garde tes résultats, jamais l'audio.",
      promesse2: "Rien n'est publié sans ton geste. L'Arène, c'est toi qui décides.",
      promesse3: 'Tu peux tout supprimer, à tout moment, en un geste dans Réglages.',
      activer: 'Activer le micro',
      note: '{{systeme}} te demandera confirmation juste après',
      refuse:
        "Sans micro, LEQ ne peut pas t'écouter. Tu peux l'autoriser dans les réglages du téléphone, maintenant ou plus tard.",
      ouvrirReglages: 'Ouvrir les réglages du téléphone',
      continuerSansMicro: 'Continuer sans micro',
    },
  },
  aujourdhui: {
    salutation: 'Salut, {{prenom}}',
    salutationSansPrenom: 'Salut',
    defiDuJour: 'Ton défi du jour · {{minutes}} min',
    points: '+{{points}} pts',
    jeMeLance: 'Je me lance',
    conseilDuJour: 'Le conseil du jour',
    pointsLibelle: 'points',
    sujetSemaine: 'Sujet de la semaine',
    avecRebecca: 'Avec Rebecca, ce mois-ci',
    toutVoir: 'Tout voir',
    areneBientotTitre: 'Bientôt ici',
    areneBientot:
      "L'Arène ouvre bientôt : un sujet public chaque semaine, et des duels entre amis. On te préviendra.",
    placeholderDefi:
      'Ton défi du jour arrive avec le parcours. En attendant, ta prise de départ te dessine ton profil.',
    placeholderConseil: 'Le conseil du jour arrive avec le retour de Bulle.',
    placeholderPoints: 'Tes points apparaîtront ici après ta première prise.',
    placeholderSujet: "Le sujet de la semaine arrive avec l'Arène.",
    placeholderRebecca: 'Les ateliers de Rebecca apparaîtront ici quand elle en ouvrira un.',
  },
  arene: {
    titre: "L'Arène",
    sujetDuMoment: 'Le sujet du moment',
    mesDuels: 'Mes duels',
    placeholderSujet:
      'Le sujet de la semaine arrive ici : tu parles, tu écoutes les autres, tu votes. Leurs points se dévoilent quand tu as parlé toi aussi.',
    placeholderDuels:
      "Tes duels vivront ici. Un sujet, une durée maximale chacun, 48 h. Le verdict vient de l'analyse, expliqué sur la grille de Rebecca.",
  },
  defis: {
    titre: 'Défis',
    placeholder:
      'La carte des actes arrive avec le parcours : trois actes, Poser sa voix, Tenir sa ligne, Emporter la salle. Chaque nœud ouvre un défi.',
  },
  progres: {
    titre: 'Progrès',
    vide: {
      titre: "Tes progrès s'afficheront ici.",
      corps: 'Débit, silences, mots béquilles : tout commence à ta première prise.',
      apercuDebit: 'Ton débit, semaine après semaine',
      apercuBequilles: 'Tes mots béquilles, qui fondent',
      action: 'Faire ma première prise · 2 min',
    },
  },
  moi: {
    titre: 'Moi',
    placeholderProfil: "Ton profil d'orateur apparaîtra ici après ta première prise.",
    faceAFace: 'Le face-à-face',
    mesRecompenses: 'Mes récompenses',
    monAbonnement: 'Mon abonnement',
    reglages: 'Réglages et confidentialité',
    ateliers: "Les ateliers de Rebecca : ta prochaine étape hors de l'app",
    confort: 'Confort',
    modeNuit: 'Mode nuit',
    modeAutomatique: 'Automatique',
    modeClair: 'Clair',
    modeSombre: 'Sombre',
    reduireAnimations: 'Réduire les animations',
    reduireAnimationsDetail: 'Bulle reste calme, rien ne bouge',
    reduireAnimationsSysteme: 'Suit le réglage du téléphone',
  },
  envoi: {
    echec: {
      titre: "Ça n'a pas marché. C'est nous, pas toi.",
      corps:
        "Ta prise est en sécurité sur ton téléphone. Ton défi du jour n'est pas perdu, et ta série non plus.",
      serieIntacte: 'Série de {{jours}} jours : intacte',
      reessayer: "Réessayer l'envoi",
      plusTard: 'Plus tard, la prise reste ici',
    },
  },
} as const

type Chemins<T, Prefixe extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefixe}${K}`
    : T[K] extends object
      ? Chemins<T[K], `${Prefixe}${K}.`>
      : never
}[keyof T & string]

export type CleTexte = Chemins<typeof fr>

export type ParametresTexte = Record<string, string | number>

function lireChemin(cle: string): string | undefined {
  let courant: unknown = fr
  for (const segment of cle.split('.')) {
    if (courant === null || typeof courant !== 'object') return undefined
    courant = (courant as Record<string, unknown>)[segment]
  }
  return typeof courant === 'string' ? courant : undefined
}

/**
 * Returns the French string for a dotted key, with {{nom}} placeholders replaced by params.
 * A missing key returns the key itself so the screen still renders and the gap is visible.
 */
export function t(cle: CleTexte, params?: ParametresTexte): string {
  const texte = lireChemin(cle)
  if (texte === undefined) return cle
  if (!params) return texte
  return texte.replace(/\{\{\s*([\w]+)\s*\}\}/g, (tout: string, nom: string) => {
    const valeur = params[nom]
    return valeur === undefined ? tout : String(valeur)
  })
}

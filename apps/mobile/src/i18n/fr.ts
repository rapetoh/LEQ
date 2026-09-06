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
  questions: {
    compteur: 'Question {{numero}} sur {{total}}',
    continuer: 'Continuer',
    note: 'Ça sert au retour, pas à te classer',
  },
  prise: {
    surtitre: 'Ta prise de départ',
    unePrise: 'Une seule prise',
    consigne: 'Raconte la dernière fois où tu as dû parler devant les autres. Comme à un ami.',
    ecoute: "Bulle écoute. Personne d'autre.",
    ecouteCalme: 'Bulle écoute. Prends ton temps.',
    plage: 'entre {{min}} et {{max}}',
    horsLigne: 'Hors ligne',
    horsLigneDetail:
      "Pas de réseau, pas de problème : ta prise partira toute seule dès qu'il revient.",
    demarrer: 'Commencer',
    refaire: 'Refaire',
    terminer: 'Terminer',
    annuler: 'Annuler',
    tropCourte: 'Ta prise fait moins de {{min}} secondes. Parle encore un peu, puis termine.',
    interrompue: "Ta prise s'est arrêtée à cause d'un appel ou d'une alerte. Tu peux la refaire.",
    micRefuse: "Sans micro, LEQ ne peut pas t'écouter. Autorise-le dans les réglages du téléphone.",
    erreur: "L'enregistrement n'a pas démarré. C'est nous, pas toi. Réessaie dans un instant.",
  },
  analyse: {
    envoi: 'Envoi en cours',
    envoiDetail: "On l'analyse, puis on l'efface : il ne restera que ton retour.",
    attenteReseau: 'En attente du réseau',
    attenteReseauDetail:
      'Ta prise est en sécurité sur ton téléphone. Elle partira toute seule dès que le réseau revient.',
    envoyee: 'Envoyée',
    enCours: 'Analyse en cours',
    etapeRythme: 'On écoute ton rythme',
    etapeBequilles: 'On repère tes mots béquilles',
    etapeProfil: 'On dessine ton profil',
    effacement: "Ton audio sera effacé après l'analyse. On ne garde que ce qui te fait progresser.",
    retourIci: 'Ton retour arrive ici',
    quitter: 'Quitter, on te préviendra',
    echecTitre: "Ça n'a pas marché. C'est nous, pas toi.",
    echecCorps:
      "Ta prise est en sécurité sur ton téléphone. Ton défi du jour n'est pas perdu, et ta série non plus.",
    reessayer: "Réessayer l'envoi",
    plusTard: 'Plus tard, la prise reste ici',
    echecServeurCorps:
      "L'analyse n'a pas abouti. Ta prise a été effacée, comme promis. Rien n'est perdu : tu peux la refaire.",
    refairePrise: 'Refaire ma prise',
    inconnu: 'On ne retrouve pas cette prise. Tu peux en faire une nouvelle.',
  },
  profil: {
    surtitre: "Entendu dans ta voix, rien d'inventé",
    titre: "Ton profil d'orateur",
    intro: 'Voici ce que Bulle a mesuré. Des comptes, pas des notes.',
    debit: 'mots par minute',
    debitZone: 'La zone qui porte est entre 130 et 150 mots par minute.',
    bequilles: 'mots béquilles',
    bequillesAucun: 'Aucun mot béquille repéré.',
    bequillesDetail: 'Le plus fréquent : « {{mot}} », {{fois}} fois.',
    silences: 'silences',
    silencesTenus: '{{tenus}} tenus',
    silencesDetail: "Un silence tenu, c'est une seconde ou plus. Il donne du poids à ce qui suit.",
    duree: 'de parole',
    note: 'La grille de Rebecca arrive bientôt. Elle dira quoi travailler en premier.',
    garder: 'Garder mon profil',
  },
  compte: {
    surtitre: 'Ton profil',
    titre: 'Garde-le, et vois-le changer.',
    intro: 'Un compte, un geste : ton profil, ta série et tes points te suivent.',
    apple: 'Continuer avec Apple',
    google: 'Continuer avec Google',
    email: 'Continuer avec mon e-mail',
    emailChamp: 'Ton adresse e-mail',
    emailEnvoyer: 'Recevoir un code',
    codeChamp: 'Le code reçu par e-mail',
    codeValider: 'Valider',
    codeEnvoye: 'Un code à six chiffres est parti vers {{email}}.',
    plusTard: "Plus tard, je veux d'abord essayer",
    resteIci: 'Ton profil reste sur ce téléphone en attendant',
    bientot: "Apple et Google arrivent avec la prochaine version. L'e-mail marche déjà.",
    erreurEmail: "Cette adresse n'a pas l'air complète.",
    erreurCode: "Ce code ne correspond pas. Vérifie l'e-mail, ou demande un nouveau code.",
    erreurReseau: "On n'a pas pu envoyer le code. Vérifie ta connexion, puis réessaie.",
    prenomChamp: 'Ton prénom',
    prenomAide: "C'est le nom que Bulle utilisera pour te saluer.",
  },
  reglages: {
    titre: 'Réglages',
    voix: {
      titre: 'Ta voix, tes données',
      sousTitre: "Ta voix n'est pas conservée",
      texte:
        "Chaque prise est analysée puis effacée, seuls tes résultats restent. Exception : une prise d'Arène ou de duel, le temps du concours.",
      publierPrenom: 'Publier sous mon prénom',
      publierPrenomDetail: "Sinon : « Voix {{numero}} », anonyme dans l'Arène",
      export: 'Recevoir une copie de mes données',
      exportEnvoye:
        'Ta demande est envoyée. Tu recevras une copie de tes données par e-mail, sous quelques jours.',
      exportCompteRequis: "Crée d'abord ton compte : c'est là que la copie te sera envoyée.",
      supprimer: 'Supprimer mon compte',
      supprimerTitre: 'Supprimer ton compte ?',
      supprimerTexte:
        'Ton profil, tes résultats et tes prises en attente disparaissent. Les prises déjà envoyées dans l’Arène sont retirées. Il n’y a pas de retour en arrière.',
      supprimerConfirmer: 'Supprimer',
      supprimerAnnuler: 'Garder mon compte',
      supprimerErreur: "La suppression n'a pas pu partir. Vérifie ta connexion, puis réessaie.",
    },
    rituel: {
      titre: 'Ton rituel',
      rappel: 'Le rappel quotidien',
      rappelHeure: 'Tous les jours · {{heure}}',
      serie: 'L’alerte quand ta série est en danger',
      serieDetail: 'En fin de journée',
      social: 'Les événements sociaux',
      socialDetail: "Verdict d'un duel, résultat de l'Arène",
      annonces: 'Les annonces de Rebecca',
      annoncesDetail: 'Deux par mois au plus, selon ta région',
      note: 'Les rappels arrivent avec le parcours. Tes choix sont déjà gardés.',
    },
    confort: {
      titre: 'Confort',
      modeNuit: 'Mode nuit',
      automatique: 'Automatique',
      clair: 'Clair',
      sombre: 'Sombre',
      animations: 'Réduire les animations',
      animationsDetail: 'Bulle reste calme, rien ne bouge',
    },
    enregistre: 'Enregistré',
    erreur: "Le réglage n'a pas été enregistré. Vérifie ta connexion, puis réessaie.",
  },
  notifications: {
    retourPretTitre: 'Ton retour est prêt',
    retourPretCorps: 'Ta prise a été analysée. Ouvre LEQ pour lire ce que Bulle a entendu.',
  },
  defi: {
    surtitre: 'Ton défi du jour · {{minutes}} min',
    points: '+{{points}} pts',
    position: 'Acte {{acte}} · {{titre}} · défi {{ordre}} sur {{total}}',
    positionCourte: 'Acte {{acte}} · {{titre}} · {{ordre}} sur {{total}}',
    jeMeLance: 'Je me lance',
    rebeccaDit: 'Rebecca te dit, mot pour mot :',
    retourRegardera: 'Le retour regardera : {{focus}}',
    rienDAutre: "Rien d'autre. Pas de surprise.",
    dernier: "Acte {{acte}} · dernier défi, il ferme l'acte",
    texteProvisoire: 'Le texte, provisoire',
    etapeLongue: {
      preparer: 'Prépare · {{minutes}} min',
      preparerDetail: "Trois appuis notés à l'écran, pas une rédaction",
      parler: 'Parle · {{minutes}} min',
      parlerDetail: 'Tes appuis restent sous tes yeux pendant la prise',
      retour: 'Le retour',
      retourDetail: 'Ce que Bulle a mesuré, puis la carte qui avance',
    },
    verrouille: "Ce défi s'ouvre après le précédent.",
    dejaReleve: "Ce défi est déjà relevé. Le suivant t'attend sur la carte.",
    introuvable: 'On ne retrouve pas ce défi. La carte des actes a la suite.',
    versAujourdhui: "Retour à Aujourd'hui",
    pret: 'Je suis prêt·e',
    lireEtParler: 'Lire, puis parler',
    preparer: 'Préparer · {{minutes}} min',
    texteChoisi: 'Le texte, choisi par Rebecca',
    lecture: '{{secondes}} s de lecture',
    lisLe: "Lis-le une fois à voix haute. Puis dis-nous s'il a raison.",
    minuterieApresLecture: 'La minuterie part après ta lecture, pas avant.',
    longNote:
      "Cinq minutes, c'est long la première fois. C'est normal, et c'est le but de l'exercice.",
    provisoire: 'Consigne provisoire, en attente de Rebecca.',
    formule: 'Formule {{formule}} · {{rythme}}',
    unParJour: 'un défi par jour',
    sansLimite: 'défis illimités',
    plusieursParJour: 'plusieurs défis par jour',
    enchainer: 'Enchaîner ›',
    termine: {
      titre: 'Ton défi du jour est fait.',
      corps: "Avec la formule Gratuit, c'est un défi par jour. Le suivant se débloque demain.",
      enchainer: 'Enchaîner autant que tu veux',
      enchainerDetail: 'La formule Complet : défis illimités, duels privés compris',
      enAttendant: 'En attendant',
      enAttendantDetail: 'Ton retour du jour est là, et la carte des actes montre la suite.',
      enAttendantArene: "En attendant, c'est ouvert",
      enAttendantAreneDetail:
        "Le sujet de la semaine dans l'Arène, l'écoute des autres, et tes votes.",
      voirArene: "Voir l'Arène",
      voirProgres: 'Voir mes progrès',
      voirFormules: 'Voir les formules',
    },
    essaisEpuises: {
      titre: "Trois essais aujourd'hui, c'est assez.",
      corps: 'Le défi t’attend demain, avec un œil neuf. Ta série ne bouge pas.',
    },
    parcoursTermine: {
      titre: 'Tu as traversé tout le chemin.',
      corps: "La suite arrive avec Rebecca. En attendant, l'Arène et tes progrès restent ouverts.",
    },
    aucuneEtape: {
      titre: 'Ton chemin se prépare.',
      corps: 'Les défis arrivent avec le parcours. Ta prise de départ te dessine déjà ton profil.',
    },
    rattrapage: {
      titre: "Un exercice plus court, d'abord.",
      corps:
        "Deux essais sur « {{titre}} », et c'est normal : c'est le défi le plus contre-intuitif de l'acte. Avant le troisième, un exercice plus court.",
      duree: '{{secondes}} s',
      faire: "L'exercice de {{secondes}} secondes",
      retenter: 'Retenter le défi directement',
      exerciceIndisponible:
        "Pas d'exercice prévu pour ce défi pour l'instant. Tu peux le retenter directement.",
      commencer: "Commencer l'exercice",
      enCours: 'Bulle écoute. Juste ça.',
      fait: "C'est fait",
      termineTitre: 'Exercice fait.',
      termineCorps: "Le défi t'attend, avec ce geste en plus.",
      retourDefi: 'Revenir au défi',
    },
    resultat: {
      reussi: 'Défi réussi',
      echoue: 'Pas encore',
      grille: 'Grille de Rebecca · {{note}} sur {{max}}',
      entendu: "Ce que l'analyse a entendu",
      grilleLibelle: 'Grille de Rebecca',
      sousNote: '{{score}} / {{max}}',
      echoueCorps:
        "Le seuil de ce défi n'est pas atteint cette fois. Ta série ne bouge pas, et le défi t'attend.",
      retenter: 'Retenter le défi',
      exerciceDabord: "L'exercice plus court, d'abord",
      grilleAttend:
        'La grille de Rebecca dira si le défi est validé. En attendant, voici ce que Bulle a mesuré.',
      suivant: 'Défi suivant · {{titre}}',
      carte: 'Retour à la carte',
      refaire: "Refais l'exercice",
    },
    acteTraverse: {
      surtitre: 'Acte {{acte}} · traversé',
      corps: '{{nb}} défis relevés. Un acte entier derrière toi.',
      corpsUn: 'Un défi relevé, et un acte entier derrière toi.',
      decouvrir: "Découvrir l'acte {{acte}} · {{titre}}",
      fin: 'Tu as traversé tout le chemin. La suite arrive avec Rebecca.',
      plusTard: 'Plus tard',
    },
  },
  carte: {
    titre: 'Défis',
    releves: '{{faits}} relevés sur {{total}}',
    sousLaBrume: 'Sous la brume',
    enCours: 'Acte {{acte}} · en cours',
    traverse: 'Traversé · {{faits}}/{{total}}',
    traverseLong: 'Traversé · {{faits}} défis sur {{total}}',
    acte: 'Acte {{acte}} · {{titre}}',
    detailResultat: '{{debit}} mots/min · {{bequilles}} béquilles · {{quand}}',
    note: '{{note}} / {{max}}',
    conservation:
      'Les prises ne sont pas conservées. Leurs résultats, oui : les béquilles baissent défi après défi.',
    verrouille: 'Se déverrouille après le défi précédent',
    ouvrir: 'Ouvrir',
    formatTexte: 'Texte à lire',
    formatLong: 'Grand format',
    aVenir: 'À venir',
    surtitreActe: 'Défis · la carte',
    sansGrille: 'Validé, sans grille',
    vide: 'La carte se dessine avec le parcours. Elle arrive avec les défis de Rebecca.',
    introuvable: 'On ne retrouve pas cet acte.',
  },
  retour: {
    surtitre: "Bulle · d'après l'analyse de ta prise",
    mesure: 'Ce qui se mesure',
    motsParMin: 'mots / min',
    bequilles: 'mots béquilles',
    bequilleMot: '« {{mot}} »',
    silencesTenus: 'silences tenus',
    pointsForts: 'Ce qui a porté',
    axes: 'À travailler ensuite',
    introuvable: 'On ne retrouve pas ce retour. Ta prochaine prise en fera un nouveau.',
    tropTot: "Ton retour n'est pas encore là. Il arrive avec l'analyse.",
    suivreAnalyse: "Suivre l'analyse",
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
    voirCarte: 'Voir la carte des actes',
    erreurParcours: "On n'a pas pu charger ton défi du jour. Vérifie ta connexion, puis réessaie.",
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

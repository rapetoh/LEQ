/**
 * Every user-facing string of the public surface (decision 17): plain French, tutoiement,
 * buttons are verbs, messages are information. No aphorism, no em dash, the inclusive dot as
 * in the mockup. Someone opening a duel link has never heard of LEQ, so the page explains
 * itself in three sentences and then gets out of the way.
 */
export const fr = {
  commun: {
    bulle: 'Bulle, la mascotte de LEQ',
    chargement: 'Un instant',
    reessayer: 'Réessayer',
    fermer: 'Fermer',
  },

  duel: {
    surtitre: 'Duel de parole',
    titre: 'On te défie.',
    intro:
      "Vous répondez au même sujet, chacun de votre côté. Tu n'entends pas la réponse de l'autre avant d'avoir donné la tienne.",
    sujetTitre: 'Le sujet',
    delai: (heures: string) => `Il te reste ${heures} pour répondre.`,
    delaiCourt: "Il te reste moins d'une heure pour répondre.",
    plafond: (duree: string) => `${duree} au maximum`,
    surDuree: (duree: string) => `sur ${duree}`,
    tempsEcoule: 'Temps enregistré',
    automatique: "Le verdict est rendu par l'analyse, sur les critères de Rebecca.",

    // The three gestures.
    commencer: 'Enregistrer ma réponse',
    arreter: 'Terminer',
    refaire: 'Refaire',
    envoyer: 'Envoyer ma réponse',
    tropCourte: (secondes: number) => `Parle au moins ${secondes} secondes avant de terminer.`,
    minimum: (secondes: number) => `${secondes} secondes minimum`,

    // States.
    preparation: 'On ouvre le micro',
    enCours: 'Parle. On écoute.',
    prete: 'Ta réponse est prête.',
    preteDetail: "Tu peux l'envoyer, ou la refaire si elle ne te va pas.",
    conservation:
      'Ta prise reste en ligne le temps du duel, puis elle est supprimée. On ne garde que le résultat.',
    envoi: 'Envoi en cours',
    analyse: 'Analyse en cours',
    analyseDetail: "Ça prend moins d'une minute. Tu peux laisser la page ouverte.",
    attenteTitre: 'Ta réponse est partie.',
    attenteDetail:
      'Le verdict arrive quand vous aurez parlé tou·te·s les deux, ou à la fin des 48 h.',

    // Verdict, for the invitee.
    verdictTitre: 'Le verdict',
    gagne: 'Tu gagnes.',
    perdu: "C'est l'autre qui gagne.",
    egalite: 'Égalité.',
    verdictDetail: "Rendu par l'analyse, sur les critères de Rebecca.",

    // Refusals and failures, in the person's words.
    introuvable: 'Ce lien ne mène à aucun duel.',
    introuvableDetail: "Demande un nouveau lien à la personne qui t'a défié·e.",
    closTitre: 'Ce duel est terminé.',
    closDetail: 'Les réponses ne sont plus acceptées.',
    expireTitre: 'Le délai est passé.',
    expireDetail: "Les 48 h sont écoulées, ce duel s'est fermé sans verdict.",
    completTitre: "Quelqu'un a déjà répondu.",
    completDetail: "Ce duel n'attend plus personne.",
    surSoiTitre: "C'est ton propre duel.",
    surSoiDetail: 'Ouvre LEQ pour suivre les réponses de la personne que tu as défiée.',
    erreur: "Ça n'a pas marché. C'est chez nous, pas chez toi.",

    // Microphone.
    microTitre: 'On a besoin du micro.',
    microDetail:
      "Autorise le micro dans ton navigateur, puis recharge la page. Rien n'est enregistré avant que tu appuies.",
    navigateurTitre: 'Ce navigateur ne sait pas enregistrer.',
    navigateurDetail: 'Ouvre le lien dans Safari, Chrome ou Firefox, ou installe LEQ.',

    // The app.
    quEstCeQueLeq: "LEQ, c'est quoi",
    presentation:
      "Une application qui entraîne à parler en public. Tu enregistres, elle mesure ta voix, et Rebecca t'indique quoi travailler.",
    installer: 'Installer LEQ',
  },

  legal: {
    confidentialiteTitre: 'Confidentialité',
    conditionsTitre: 'Conditions',
    relecture:
      'Ce texte est en cours de rédaction. Il sera relu par un juriste avant la publication de LEQ.',
    voixTitre: 'Ta voix',
    voixTexte:
      "Ta voix est analysée puis supprimée. On ne garde que tes résultats, c'est-à-dire du texte et des chiffres.",
    voixException:
      "Il y a une exception. Quand tu envoies une prise dans l'Arène ou dans un duel, elle reste en ligne le temps que les autres écoutent et votent, puis elle est supprimée elle aussi.",
    compteTitre: 'Ton compte',
    compteTexte:
      'Répondre à un duel ne demande pas de compte. On crée une identité anonyme le temps du duel, sans nom ni adresse.',
    contactTitre: 'Nous écrire',
    contactTexte: 'Une question sur tes données : join.leq@gmail.com',
    conditionsTexte:
      "Les conditions générales d'utilisation de LEQ seront publiées ici avant la mise en ligne de l'application.",
    retour: 'Revenir',
  },
} as const

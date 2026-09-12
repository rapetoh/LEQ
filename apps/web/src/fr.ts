/**
 * Every user-facing string of the public surface (decision 17): plain French, tutoiement,
 * buttons are verbs, messages are information. No aphorism, no slogan, no sentence built on
 * a negated opposite ("X, pas Y"), no em dash, the inclusive dot as in the mockup. See
 * docs/STRINGS.md. Someone opening a duel link has never heard of LEQ, so the page explains
 * itself in three sentences and then gets out of the way.
 */
export const fr = {
  app: {
    nom: 'LEQ',
  },
  commun: {
    bulle: 'Bulle, la mascotte de LEQ',
    chargement: 'Chargement',
    reessayer: 'Réessayer',
    fermer: 'Fermer',
  },

  duel: {
    surtitre: 'Duel de parole',
    titre: 'Tu as été défié·e.',
    intro:
      "Vous répondez au même sujet, chacun de votre côté. Tu ne verras sa réponse qu'après avoir enregistré la tienne.",
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
    envoyerEncore: 'Envoyer encore',
    echecAnalyse: "L'analyse n'est pas revenue. Ta prise est gardée, tu peux renvoyer.",
    tropCourte: (secondes: number) => `Parle au moins ${secondes} secondes avant de terminer.`,
    minimum: (secondes: number) => `${secondes} secondes minimum`,

    // States.
    preparation: 'Ouverture du micro',
    enCours: 'Enregistrement en cours',
    prete: 'Ta réponse est prête.',
    preteDetail: "Tu peux l'envoyer, ou la refaire si elle ne te convient pas.",
    conservation:
      'Ta prise reste en ligne le temps du duel, puis elle est supprimée. Seul le résultat est conservé.',
    envoi: 'Envoi en cours',
    analyse: 'Analyse en cours',
    analyseDetail: "L'analyse prend moins d'une minute. Tu peux laisser la page ouverte.",
    attenteTitre: 'Ta réponse est partie.',
    attenteDetail:
      'Le verdict arrive quand vous aurez parlé tou·te·s les deux, ou à la fin des 48 h.',

    // Verdict, for the invitee.
    // Qui répond.
    prenomChamp: 'Ton prénom',
    prenomAide: "Il s'affiche à la personne qui t'a défié·e.",
    emailChamp: 'Ton adresse e-mail',
    emailAide: 'Elle sert à te dire qui a gagné.',
    prenomManquant: 'Écris ton prénom.',
    emailManquant: 'Écris une adresse e-mail valable.',

    verdictTitre: 'Le verdict',
    gagne: 'Tu gagnes.',
    perdu: "L'autre personne gagne.",
    egalite: 'Égalité.',
    sansVerdict: "L'analyse n'a pas pu vous départager.",
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
    erreur: "Ça n'a pas marché. L'erreur vient de chez nous.",

    // Microphone.
    microTitre: 'Le micro est nécessaire.',
    microDetail:
      "Autorise le micro dans ton navigateur, puis recharge la page. L'enregistrement ne démarre qu'au moment où tu appuies.",
    navigateurTitre: "Ce navigateur ne gère pas l'enregistrement.",
    navigateurDetail: 'Ouvre le lien dans Safari, Chrome ou Firefox, ou installe LEQ.',

    // The app.
    quEstCeQueLeq: "LEQ, c'est quoi",
    presentation:
      "Une application pour s'entraîner à parler en public. Tu enregistres, LEQ mesure ta voix, et le retour t'indique quoi travailler, sur les critères de Rebecca.",
    installer: 'Installer LEQ',
  },

  legal: {
    confidentialiteTitre: 'Confidentialité',
    conditionsTitre: 'Conditions',
    relecture:
      'Ce texte est en cours de rédaction. Il sera relu par un juriste avant la publication de LEQ.',
    voixTitre: 'Ta voix',
    voixTexte:
      "Ta voix est analysée puis supprimée. Seuls tes résultats sont conservés, c'est-à-dire du texte et des chiffres.",
    voixException:
      "Il y a une exception. Quand tu envoies une prise dans l'Arène ou dans un duel, elle reste en ligne le temps que les autres écoutent et votent, puis elle est supprimée.",
    compteTitre: 'Ton compte',
    compteTexte:
      'Répondre à un duel ne demande pas de compte. Une identité anonyme, sans nom ni adresse, est créée le temps du duel.',
    contactTitre: 'Nous écrire',
    contactTexte: 'Une question sur tes données : join.leq@gmail.com',
    conditionsTexte:
      "Les conditions générales d'utilisation de LEQ seront publiées ici avant la mise en ligne de l'application.",
    retour: 'Revenir',
  },
} as const

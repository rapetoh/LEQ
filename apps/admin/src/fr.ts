// Every user-facing string of the admin lives here (decision 17).
// Plain French, tutoiement, buttons are verbs, messages are information. No em dashes.

export const fr = {
  app: {
    nom: 'LEQ',
    sousTitre: 'Espace de Rebecca',
  },

  commun: {
    chargement: 'Chargement en cours.',
    reessayer: 'Réessayer',
    enregistrer: 'Enregistrer',
    annuler: 'Annuler',
    continuer: 'Continuer',
    fermer: 'Fermer',
    modifieLe: (date: string) => `Modifié le ${date}`,
    oui: 'Oui',
    non: 'Non',
  },

  navigation: {
    libelle: 'Navigation principale',
    accueil: 'Accueil',
    configuration: 'Configuration',
    drapeaux: 'Drapeaux',
    seDeconnecter: 'Se déconnecter',
  },

  connexion: {
    titre: 'Se connecter',
    intro: 'Connecte-toi avec ton adresse e-mail et ton mot de passe.',
    email: 'Adresse e-mail',
    motDePasse: 'Mot de passe',
    valider: 'Se connecter',
    enCours: 'Connexion en cours',
    identifiantsIncorrects: 'Identifiants incorrects.',
    indisponible: 'Connexion impossible pour le moment. Réessaie dans un instant.',
  },

  acces: {
    reserve: 'Cet espace est réservé à Rebecca.',
    connecteAvec: (email: string) => `Tu es connecté·e avec ${email}.`,
    verification: 'Vérification de ta session.',
  },

  accueil: {
    titre: 'Accueil',
    intro:
      "Ici, tu règles l'application : ses valeurs, et ce qui est visible pour les utilisateurs.",
    disponible: 'Disponible maintenant',
    bientot: 'Bientôt',
    aVenirIntro: 'Trois espaces arrivent, dans cet ordre.',
    cartes: {
      configuration: {
        titre: 'Configuration',
        texte: "Les valeurs de l'application : points, durées, quotas, délais.",
        action: 'Ouvrir la configuration',
      },
      drapeaux: {
        titre: 'Drapeaux',
        texte: "Allumer ou éteindre l'Arène, les duels et le face-à-face.",
        action: 'Ouvrir les drapeaux',
      },
    },
    aVenir: {
      grille: {
        titre: 'La grille',
        texte: 'Tes critères, versionnés, calibrés sur des prises réelles que tu auras écoutées.',
      },
      defis: {
        titre: 'Les défis',
        texte: 'Les étapes du parcours : formats, consignes, seuils de réussite.',
      },
      banques: {
        titre: 'Les banques de sujets',
        texte: "Sujets de l'Arène, thèses du face-à-face, exercices de remédiation.",
      },
    },
  },

  configuration: {
    titre: 'Configuration',
    intro:
      "Chaque valeur est lue par l'application au démarrage. Un changement s'applique aux prochains lancements.",
    colonnes: {
      cle: 'Clé',
      description: 'Description',
      valeur: 'Valeur',
      actions: 'Actions',
    },
    sections: {
      points: 'Points',
      diagnostic: 'Diagnostic',
      parcours: 'Rythme du parcours',
      arene: 'Arène et duels',
      faceAFace: 'Face-à-face',
      annonces: 'Annonces',
      nettoyage: 'Nettoyage',
      autres: 'Autres',
    },
    vide: 'Aucune valeur dans la base. Lance la migration et le seed.',
    erreurChargement: 'Impossible de charger la configuration.',
    erreurs: {
      nombre: 'Saisis un nombre.',
      vide: 'Saisis une valeur.',
      json: 'JSON invalide.',
    },
    etats: {
      modifie: 'Modifié, pas encore enregistré.',
      enregistrement: 'Enregistrement',
    },
    toasts: {
      succes: (cle: string) => `Valeur enregistrée : ${cle}.`,
      erreur: 'Enregistrement impossible. La valeur précédente est rétablie.',
    },
    champ: {
      valeurDe: (cle: string) => `Valeur de ${cle}`,
      annulerPour: (cle: string) => `Annuler les changements de ${cle}`,
      enregistrerPour: (cle: string) => `Enregistrer ${cle}`,
    },
  },

  drapeaux: {
    titre: 'Drapeaux',
    intro:
      'Un drapeau allumé rend la fonction visible à tous les utilisateurs dès leur prochain lancement.',
    vide: 'Aucun drapeau dans la base. Lance la migration et le seed.',
    erreurChargement: 'Impossible de charger les drapeaux.',
    etats: {
      allume: 'Allumé',
      eteint: 'Éteint',
      absent: 'Absent de la base',
    },
    basculer: (objet: string) => `Allumer ou éteindre ${objet}`,
    confirmationTitre: (objet: string) => `Allumer ${objet}`,
    items: {
      arene: {
        nom: "L'Arène",
        objet: "l'Arène",
        description: 'Le sujet de la semaine, les prises publiques et les votes.',
        confirmation: "Allumer l'Arène la rend visible à tous les utilisateurs. Continuer ?",
      },
      duels: {
        nom: 'Les duels',
        objet: 'les duels',
        description: 'Les défis entre deux personnes, avec un verdict rendu par l’analyse.',
        confirmation: 'Allumer les duels les rend visibles à tous les utilisateurs. Continuer ?',
      },
      face_a_face: {
        nom: 'Le face-à-face',
        objet: 'le face-à-face',
        description: 'Le débat en direct avec Rétor.',
        confirmation: 'Allumer le face-à-face le rend visible à tous les utilisateurs. Continuer ?',
      },
    },
    toasts: {
      succes: 'Enregistré.',
      erreur: "Enregistrement impossible. L'état précédent est rétabli.",
    },
  },
} as const

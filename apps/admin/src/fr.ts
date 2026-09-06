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
    defis: 'Défis',
    exercices: 'Exercices',
    recompenses: 'Récompenses',
    echanges: 'Échanges',
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
    aVenirIntro: 'Deux espaces arrivent, dans cet ordre.',
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
      defis: {
        titre: 'Les défis',
        texte: 'Les étapes du parcours, acte par acte : formats, consignes, seuils de réussite.',
        action: 'Ouvrir les défis',
      },
      exercices: {
        titre: 'Les exercices',
        texte: 'Les exercices de rattrapage, proposés après deux échecs sur un défi.',
        action: 'Ouvrir les exercices',
      },
      recompenses: {
        titre: 'Les récompenses',
        texte: 'La boutique : ce que les points achètent, à quel prix, et combien par mois.',
        action: 'Ouvrir les récompenses',
      },
      echanges: {
        titre: 'Les échanges',
        texte: 'Les points échangés par les utilisateurs, à honorer ou à annuler.',
        action: 'Ouvrir les échanges',
      },
    },
    aVenir: {
      grille: {
        titre: 'La grille',
        texte: 'Tes critères, versionnés, calibrés sur des prises réelles que tu auras écoutées.',
      },
      banques: {
        titre: 'Les banques de sujets',
        texte: "Sujets de l'Arène, thèses du face-à-face.",
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
      serie: 'Série et points',
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
        description: "Les défis entre deux personnes, avec un verdict rendu par l'analyse.",
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

  banques: {
    formats: {
      standard: 'Défi',
      texte: 'Défi texte',
      long: 'Grand format',
    },
    badges: {
      provisoire: 'Provisoire',
      valide: 'Validé',
      inactif: 'Inactif',
    },
    erreurs: {
      requis: 'Ce champ est obligatoire.',
      nombre: 'Saisis un nombre.',
      entier: 'Saisis un nombre entier.',
      positif: 'Saisis un nombre positif.',
      cle: 'Lettres minuscules, chiffres et tirets bas seulement.',
      texteRequis: 'Un défi texte a besoin de son texte à lire.',
      preparationRequise: 'Un grand format a besoin de sa durée de préparation.',
      contrat: 'Cette valeur ne respecte pas le contrat.',
    },
    champs: {
      cle: 'Clé technique',
      cleAide: 'Unique, en minuscules, sans espace : elle ne change plus après la création.',
      titre: 'Titre',
      consigne: 'Consigne',
      consigneAide: 'Ce que la personne lit avant de parler. Tes mots, mot pour mot.',
      competence: 'Compétence travaillée',
      competenceAide: 'Le même mot relie un défi et ses exercices de rattrapage.',
      provisoire: 'Provisoire',
      provisoireAide:
        "Tant que c'est coché, l'application dit que la consigne attend Rebecca. Décoche quand le texte est le tien.",
      actif: 'Actif',
      actifAide: "Un défi inactif n'entre plus dans les nouveaux parcours.",
      actifAideExercice: "Un exercice inactif n'est plus proposé.",
    },
  },

  defis: {
    titre: 'Les défis',
    intro:
      "Le parcours, acte par acte. Un titre ou une consigne modifiée s'affiche tout de suite pour tout le monde ; l'ordre et le seuil de réussite s'appliquent aux parcours créés ensuite.",
    creer: 'Créer un défi',
    vide: 'Aucun défi dans la base. Lance le seed, ou crée le premier.',
    erreurChargement: 'Impossible de charger les défis.',
    acte: (ordre: number) => `Acte ${ordre}`,
    nombreDefis: (n: number) => (n === 1 ? '1 défi' : `${n} défis`),
    aucunDefi: 'Aucun défi dans cet acte.',
    renommer: 'Renommer',
    ajouterActe: 'Ajouter un acte',
    acteTitre: "Titre de l'acte",
    acteSousTitre: 'Sous-titre',
    acteEnregistre: 'Acte enregistré.',
    monter: (titre: string) => `Monter ${titre}`,
    descendre: (titre: string) => `Descendre ${titre}`,
    modifier: 'Modifier',
    resume: (minutes: number, points: number) => `${minutes} min · ${points} pts`,
    seuil: (seuil: string) => `seuil ${seuil}`,
    ordreEchange: 'Ordre modifié.',
    erreurOrdre: "L'ordre n'a pas pu être modifié.",
    edition: {
      titreCreation: 'Nouveau défi',
      titreModification: 'Modifier le défi',
      introuvable: "Ce défi n'existe pas.",
      retour: 'Retour aux défis',
      acte: 'Acte',
      ordre: "Ordre dans l'acte",
      format: 'Format',
      formatAide:
        'Défi : deux minutes de parole. Défi texte : un texte à lire, puis à défendre. Grand format : une préparation, puis cinq minutes.',
      focus: 'Ce que le retour regardera',
      focusAide: 'Annoncé dans le brief : « Le retour regardera : … ». Une seule chose.',
      dureeMax: 'Durée maximale de parole',
      points: 'Points',
      seuil: 'Seuil de réussite',
      seuilAide: 'Note totale de la grille à atteindre. Sans grille publiée, le défi reste ouvert.',
      texte: 'Le texte à lire',
      dureeLecture: 'Durée de lecture estimée',
      preparation: 'Durée de préparation',
      plan: 'Les appuis du plan',
      planAide: 'Affichés pendant la préparation et la prise. Trois, en général.',
      appuiTitre: "Titre de l'appui",
      appuiDetail: 'Détail',
      ajouterAppui: 'Ajouter un appui',
      retirerAppui: (n: number) => `Retirer l'appui ${n}`,
      secondes: 's',
      marquerValide: 'Marquer comme validé',
      marquerValideTitre: 'Marquer ce défi comme validé',
      marquerValideMessage:
        "L'application cessera de dire que la consigne est provisoire. Vérifie que le texte est bien le tien. Continuer ?",
      desactiver: 'Désactiver',
      desactiverTitre: 'Désactiver ce défi',
      desactiverMessage:
        "Il n'entrera plus dans les nouveaux parcours. Les personnes qui l'ont déjà dans leur chemin le gardent. Continuer ?",
      reactiver: 'Réactiver',
      cree: 'Défi créé.',
      enregistre: 'Défi enregistré.',
      erreur: 'Enregistrement impossible.',
      erreurDoublon: 'Un défi porte déjà cette clé, ou cet ordre dans cet acte.',
    },
  },

  exercices: {
    titre: 'Les exercices',
    intro:
      'Les exercices de rattrapage : après deux échecs sur un défi, la personne se voit proposer le premier exercice actif de la même compétence, avant un troisième essai.',
    creer: 'Créer un exercice',
    vide: 'Aucun exercice dans la base. Lance le seed, ou crée le premier.',
    erreurChargement: 'Impossible de charger les exercices.',
    duree: (secondes: number) => `${secondes} s`,
    competence: (competence: string) => `compétence : ${competence}`,
    modifier: 'Modifier',
    nouveau: 'Nouvel exercice',
    modification: "Modifier l'exercice",
    dureeChamp: 'Durée',
    cree: 'Exercice créé.',
    enregistre: 'Exercice enregistré.',
    erreur: 'Enregistrement impossible.',
    erreurDoublon: 'Un exercice porte déjà cette clé.',
  },

  recompenses: {
    titre: 'Les récompenses',
    intro:
      "La boutique du chapitre 7. Un coût en points par récompense ; un plafond par mois pour ce qui te coûte de l'argent réel : au-delà, elle attend le mois suivant. Une distinction ne s'achète pas.",
    creer: 'Créer une récompense',
    nouvelle: 'Nouvelle récompense',
    vide: 'Aucune récompense dans la base. Lance le seed, ou crée la première.',
    erreurChargement: 'Impossible de charger les récompenses.',
    modifier: 'Modifier',
    cout: (points: number) => `${new Intl.NumberFormat('fr-FR').format(points)} pts`,
    sansCout: 'sans coût',
    plafond: (n: number) => (n === 1 ? '1 par mois' : `${n} par mois`),
    sansPlafond: 'sans plafond',
    cree: 'Récompense créée.',
    enregistre: 'Récompense enregistrée.',
    erreur: 'Enregistrement impossible.',
    erreurDoublon: 'Une récompense porte déjà cette clé.',
    champs: {
      type: 'Type',
      typeAide:
        "Contenu, réduction, atelier : s'échangent contre des points. Distinction : se gagne, ne s'achète pas.",
      ordre: 'Ordre dans la boutique',
      sousTitre: 'Sous-titre',
      description: 'Description',
      cout: 'Coût en points',
      plafond: 'Plafond par mois',
      plafondAide: "Vide = sans limite. À remplir dès que la récompense te coûte de l'argent réel.",
      distinctionAide:
        "Une distinction n'a ni coût ni plafond : elle se gagne, par exemple pour le n°1 du mois.",
      provisoireAide: "Tant que c'est coché, l'application dit que la récompense attend Rebecca.",
      actifAide: "Une récompense inactive n'apparaît plus dans la boutique.",
    },
  },

  echanges: {
    titre: 'Les échanges',
    intro:
      "Chaque ligne est une personne qui a dépensé ses points. Honorer : tu l'as contactée et la récompense est donnée. Annuler : les points lui reviennent.",
    tous: 'Tous',
    vide: 'Aucun échange dans cette liste.',
    erreurChargement: 'Impossible de charger les échanges.',
    par: (prenom: string) => `par ${prenom}`,
    sansPrenom: 'une personne sans prénom',
    honorer: 'Honorer',
    annuler: 'Annuler',
    annulerTitre: 'Annuler cet échange',
    annulerMessage: (titre: string, points: number) =>
      `${titre} : les ${new Intl.NumberFormat('fr-FR').format(points)} points reviennent à la personne. Continuer ?`,
    traite: 'Échange mis à jour.',
    erreur: "L'échange n'a pas pu être mis à jour.",
    statuts: {
      a_traiter: 'À traiter',
      honore: 'Honoré',
      annule: 'Annulé',
    },
  },
} as const

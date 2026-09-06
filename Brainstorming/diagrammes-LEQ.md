# LEQ, diagrammes

Août 2026

Ces diagrammes accompagnent le cahier des charges. Ils sont écrits en Mermaid, donc en texte, ce qui permet de les modifier sans repasser par un outil de dessin et de les suivre au même titre que le reste du projet.

Le modèle de domaine vient en premier parce que tous les autres s'appuient sur les noms qu'il fixe.

---

## 1. Modèle de domaine

Ce que manipule l'application et comment les objets s'attachent les uns aux autres. Deux choses méritent d'être remarquées ici. L'enregistrement audio n'apparaît nulle part comme quelque chose qu'on garde, seule l'analyse subsiste. Et la prise envoyée dans l'Arène est un objet distinct d'une tentative ordinaire, précisément parce que son cycle de vie est différent.

```mermaid
classDiagram
    class Utilisateur {
        id
        prenom
        email
        ville
        dateInscription
        profilLocuteur
    }

    class ReponseAccueil {
        contexte
        objectif
        blocage
    }

    class Parcours {
        id
        dateGeneration
        etapeCourante
    }

    class Acte {
        ordre
        titre
        statut
    }

    class Etape {
        ordre
        consigne
        competenceIntroduite
        dureeMax
        statut
        nombreEchecs
    }

    class Tentative {
        id
        dateEnregistrement
        dateEnvoi
        duree
        statut
    }

    class Analyse {
        debit
        stabiliteDebit
        motsBequilles
        silences
        volumeMoyen
        chutesFinPhrase
        variationHauteur
        repetitions
        tempsAvantDemarrage
        transcription
    }

    class Evaluation {
        noteGlobale
        sousNotes
        pointsForts
        axesTravail
        exerciceCourt
    }

    class CritereGrille {
        nom
        definition
        mesuresUtilisees
        poids
        seuilReussite
    }

    class Serie {
        compteurActuel
        record
        derniereJourneeValidee
        recuperationsRestantes
    }

    class CompteurPoints {
        solde
        cumul
    }

    class Recompense {
        libelle
        coutPoints
        quantiteMensuelle
        quantiteRestante
    }

    class Abonnement {
        formule
        dateDebut
        quotaFaceAFace
        quotaRestant
    }

    class SujetArene {
        libelle
        dateActivation
        dateCloture
        statut
    }

    class PriseArene {
        dateEnvoi
        anonyme
        nombreVoix
        dateSuppression
    }

    class Vote {
        dateVote
        priseChoisie
    }

    class Duel {
        sujet
        dateCreation
        dateLimite
        statut
        verdict
    }

    class Debat {
        these
        origineThese
        tonAdversaire
        duree
        statut
        transcription
    }

    class Atelier {
        titre
        ville
        enLigne
        date
    }

    Utilisateur "1" --> "1" ReponseAccueil
    Utilisateur "1" --> "1" Parcours
    Utilisateur "1" --> "1" Serie
    Utilisateur "1" --> "1" CompteurPoints
    Utilisateur "1" --> "1" Abonnement
    Utilisateur "1" --> "*" Tentative
    Utilisateur "1" --> "*" PriseArene
    Utilisateur "1" --> "*" Vote
    Utilisateur "1" --> "*" Debat
    Utilisateur "1" --> "*" Duel

    Parcours "1" --> "*" Acte
    Acte "1" --> "*" Etape
    Etape "1" --> "*" Tentative

    Tentative "1" --> "1" Analyse
    Analyse "1" --> "1" Evaluation
    Evaluation "*" --> "*" CritereGrille

    PriseArene "1" --> "1" Analyse
    Duel "1" --> "2" PriseArene
    Debat "1" --> "1" Evaluation

    SujetArene "1" --> "*" PriseArene
    PriseArene "1" --> "*" Vote

    CompteurPoints "*" --> "*" Recompense
    Utilisateur "*" --> "*" Atelier
```

---

## 2. Cycle de vie d'une tentative

C'est le diagramme le plus important du lot, parce qu'il contient tous les cas où les choses se passent mal et que ce sont eux qu'on oublie en général. Une tentative qui échoue pour une raison technique ne consomme pas le défi du jour et ne casse pas la série.

```mermaid
stateDiagram-v2
    [*] --> Enregistrement
    Enregistrement --> Annulee : l'utilisateur annule
    Enregistrement --> EnAttenteReseau : pas de connexion
    Enregistrement --> Envoi : connexion disponible

    EnAttenteReseau --> Envoi : la connexion revient
    EnAttenteReseau --> Expiree : sept jours sans envoi

    Envoi --> Transcription : envoi reussi
    Envoi --> EchecTechnique : envoi interrompu

    Transcription --> Mesure : transcription obtenue
    Transcription --> EchecTechnique : transcription impossible

    Mesure --> Evaluation
    Evaluation --> AudioSupprime
    AudioSupprime --> RetourDisponible

    RetourDisponible --> EtapeValidee : note au dessus du seuil
    RetourDisponible --> EtapeEchouee : note sous le seuil

    EtapeEchouee --> Enregistrement : nouvel essai
    EtapeEchouee --> ExerciceRattrapage : deuxieme echec
    ExerciceRattrapage --> Enregistrement

    EchecTechnique --> Envoi : nouvelle tentative automatique
    EchecTechnique --> AbandonTechnique : echec definitif

    EtapeValidee --> [*]
    AbandonTechnique --> [*]
    Annulee --> [*]
    Expiree --> [*]

    note right of AbandonTechnique
        Le defi n'est pas consomme,
        la serie n'est pas touchee.
    end note

    note right of AudioSupprime
        L'audio disparait ici,
        seule l'analyse subsiste.
    end note
```

---

## 3. Qui fait quoi

Trois acteurs. L'utilisateur, Rebecca dans son espace d'administration, et l'analyse automatique qui n'est pas une personne mais qui prend des décisions visibles par l'utilisateur, donc qui mérite d'apparaître.

```mermaid
graph LR
    U((Utilisateur))
    R((Rebecca))
    IA((Analyse automatique))

    U --> UC1[Passer le diagnostic]
    U --> UC2[Creer son compte]
    U --> UC3[Faire le defi du jour]
    U --> UC4[Consulter sa progression]
    U --> UC5[Envoyer une prise dans l'Arene]
    U --> UC6[Voter par paires]
    U --> UC7[Lancer un duel]
    U --> UC8[Debattre en face a face]
    U --> UC9[Echanger ses points]
    U --> UC10[Supprimer son compte]

    R --> UC11[Definir la grille]
    R --> UC12[Ecrire les defis]
    R --> UC13[Alimenter les banques de sujets]
    R --> UC14[Regler points et recompenses]
    R --> UC15[Annoncer un atelier]
    R --> UC16[Moderer une prise publique]
    R --> UC17[Allumer l'Arene et les duels]

    IA --> UC18[Transcrire et mesurer]
    IA --> UC19[Noter sur la grille]
    IA --> UC20[Generer le parcours]
    IA --> UC21[Rendre un verdict de duel]
    IA --> UC22[Argumenter en face a face]

    UC11 -.alimente.-> UC19
    UC11 -.alimente.-> UC21
    UC12 -.alimente.-> UC20
    UC13 -.alimente.-> UC22
```

---

## 4. La boucle quotidienne

Ce qui se passe entre le moment où quelqu'un ouvre l'application et celui où il reçoit son retour. Le point à retenir est qu'il peut partir pendant l'analyse et qu'on le rappelle.

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant App
    participant Serveur
    participant Transcription
    participant Moteur as Moteur d'analyse

    U->>App: ouvre l'application
    App->>Serveur: quelle est l'etape du jour
    Serveur-->>App: consigne et competence visee
    App-->>U: affiche le defi

    U->>App: enregistre sa prise
    App->>Serveur: envoie l'audio
    App-->>U: tu peux quitter, on te previent

    Serveur->>Transcription: audio
    Transcription-->>Serveur: texte et horodatages
    Serveur->>Moteur: texte, horodatages, signal
    Moteur-->>Serveur: mesures et note sur la grille
    Serveur->>Serveur: supprime l'audio
    Serveur->>Serveur: met a jour serie, points, progression

    Serveur-->>U: notification, ton retour est pret
    U->>App: ouvre le retour
    App-->>U: points forts, axes, mesures, exercice court
```

---

## 5. Le face-à-face

La difficulté est dans la boucle du milieu, qui doit tourner sous les deux secondes à chaque tour. Tout le reste est simple.

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant App
    participant Serveur
    participant Transcription
    participant Modele
    participant Voix as Synthese vocale

    U->>App: choisit une these dans la banque
    U->>App: choisit le ton et la duree
    App->>Serveur: ouvre la session
    Serveur->>Serveur: verifie le quota restant
    Serveur-->>App: session ouverte

    loop chaque tour
        U->>App: parle
        App->>Transcription: audio du tour
        Transcription-->>Serveur: texte
        Serveur->>Modele: contexte du debat et dernier argument
        Modele-->>Serveur: contre-argument
        Serveur->>Voix: texte a dire
        Voix-->>App: audio
        App-->>U: l'adversaire repond
    end

    alt le debat va au bout
        Serveur->>Modele: transcription complete
        Modele-->>Serveur: debriefing
        Serveur-->>U: moments cles et axe de travail
    else coupure de notre cote
        Serveur-->>U: session interrompue, reprise possible
        Serveur->>Serveur: ne decompte pas le quota
    end
```

---

## 6. La semaine d'Arène

Un sujet vit sept jours. On peut parler et voter pendant toute cette durée, ce qui évite d'imposer un créneau à des gens qui ont une vie par ailleurs.

```mermaid
flowchart TD
    A[Banque de sujets] --> B[Un sujet devient actif]
    B --> C{L'utilisateur a-t-il deja parle}
    C -->|non| D[Les prises des autres restent masquees]
    D --> E[Il enregistre sa prise]
    E --> F{Controle du contenu}
    F -->|refuse| G[Prise rejetee, il peut recommencer]
    F -->|accepte| H[Prise publiee et conservee]
    G --> E
    H --> I[Acces au vote]
    C -->|oui| I

    I --> J[Deux prises anonymes cote a cote]
    J --> K[Il choisit la plus convaincante]
    K --> L[Points de vote credites]
    L --> J

    B --> M[Sept jours passent]
    M --> N[Cloture du sujet]
    N --> O[Classement au nombre de voix]
    O --> P[Podium annonce]
    N --> Q[Toutes les prises sont supprimees]
    P --> R[Le sujet suivant devient actif]
    Q --> R
    R --> C
```

---

## 7. Ce que ces diagrammes ne couvrent pas encore

Deux zones restent volontairement vides parce que les décisions ne sont pas prises. Les règles que doit respecter le générateur de parcours, qui mériteront leur propre schéma une fois écrites. Et le détail de l'espace d'administration, qui dépend de ce que Rebecca voudra réellement piloter au quotidien.

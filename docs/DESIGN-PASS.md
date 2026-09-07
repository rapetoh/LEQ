# Passe design contre la maquette (2026-09-06)

La maquette est le plancher : chaque écran construit doit l'égaler ou faire un peu mieux. Relevé par un lecteur indépendant sur les écrans construits jusqu'à la Phase 6. Une ligne est cochée quand la correction est faite (le passage sur le simulateur reste à faire par Roch). Fait le 2026-09-06 : la salle sombre pour A4, B4, A5, X2, X3 (A2 et A3 passés aussi) ; la carte héros orange de B1 avec ses pilules et ses points de progression ; le prénom sur B1 et Moi ; les appuis du plan dans le brief ; les étapes d'attente dès l'envoi ; la carte « série intacte » sur X3 ; la hiérarchie de A4 ; l'heure du rappel modifiable ; la tuile silences ; le bouton « Défi suivant ». Restent : l'anneau de progression du chrono, le chemin sinueux de H1, la flamme, A2 et A3 sur bleu nuit, les barres de D2, les icônes, les espaces insécables de la typographie française, les détails listés ci-dessous.

- [x] **X3 (et A5/X2, même composant)** (manque) `apps/mobile/src/components/EcranAnalyse.tsx`  
      Maquette : Sous le corps de X3, une carte bleu nuit avec la flamme : « Série de 6 jours : intacte ». C'est la preuve visible que la panne ne touche pas la série.  
      Construit : Titre, corps et deux boutons seulement. La clé fr.envoi.echec.serieIntacte existe mais n'est utilisée nulle part ; useSerie() (Phase 5, faite) fournit déjà la série courante.  
      Correction : Dans l'état echec === 'telephone', ajouter une Carte avec t('envoi.echec.serieIntacte', { jours: serie.courante }) (et une variante sans nombre quand la série est à 0).
- [x] **G3** (manque) `apps/mobile/src/app/reglages.tsx`  
      Maquette : Ligne « Le rappel du soir · Tous les soirs · 21 h 30 · Modifier » : l'heure se change. La correction STRINGS.md garde explicitement « Tous les jours · 21 h 30 · Modifier ».  
      Construit : La ligne « Le rappel quotidien » affiche l'heure (heureCourte) et un interrupteur, mais aucune action « Modifier » ni sélecteur d'heure : heure_rappel n'est jamais modifiable depuis l'app.  
      Correction : Ajouter un bouton texte « Modifier » (clé fr.reglages.rituel.modifier) qui ouvre un sélecteur d'heure (DateTimePicker) et écrit heure_rappel via la mutation existante, puis invalide profil_rappels.
- [x] **B1** (manque) `apps/mobile/src/app/(onglets)/aujourdhui.tsx`  
      Maquette : En-tête « Mardi 5 août » puis « Salut, Camille » : le prénom saisi à A7.  
      Construit : Toujours t('aujourdhui.salutationSansPrenom') = « Salut ». La clé fr.aujourdhui.salutation « Salut, {{prenom}} » existe mais n'est pas utilisée alors que profils.prenom est enregistré à A7 et déjà lu dans reglages.tsx.  
      Correction : Lire profils.prenom (même requête que reglages, ou un hook useProfil partagé) et afficher t('aujourdhui.salutation', { prenom }) quand il existe, salutationSansPrenom sinon.
- [x] **G1** (manque) `apps/mobile/src/app/(onglets)/moi.tsx`  
      Maquette : Avatar 72 px avec badge flamme, nom « Camille V. » en 26 px, puis « Le Conteur · depuis juin 2026 ». Hors archétype (retiré volontairement), il reste le prénom et la date d'arrivée.  
      Construit : Une CartePlaceholder « Ton profil d'orateur apparaîtra ici après ta première prise. » remplace tout le bloc identité ; le prénom (A7) n'apparaît nulle part sur Moi, et fr.moi.depuis « Depuis {{mois}} » n'est utilisé nulle part.  
      Correction : Afficher le prénom (Titre niveau ecran) et t('moi.depuis', { mois }) à partir de profils.cree_le (Intl, mois + année), avec un emplacement d'avatar ; garder le placeholder uniquement pour la ligne d'archétype.
- [x] **B3** (manque) `apps/mobile/src/app/defi/[etapeId]/index.tsx`  
      Maquette : Sous la carte « Le retour regardera », trois cartes blanches numérotées 1, 2, 3 : « L'affirmation, sans précaution », « La preuve, vécue », « Ce qui change si on te suit » (le plan du défi).  
      Construit : defi.plan n'est jamais rendu dans le brief ; il n'apparaît que pendant la préparation du format long (EcranPrise). Or le seed donne bien un plan à « Convaincs-moi en trois phrases » (format standard).  
      Correction : Dans ContenuBrief, quand defi.plan.length > 0 et format !== 'long', rendre les appuis avec le composant Etape existant (numéro, titre, detail) dans une Carte.
- [x] **H2** (manque) `apps/mobile/src/app/retour/[tentativeId].tsx`  
      Maquette : Carte « La carte avance » avec le mini-chemin (deux nœuds or, un orange) et « « Sans notes » se déverrouille sur les crêtes. », puis bouton principal orange « Défi suivant · Sans notes » et lien « Retour à la carte ».  
      Construit : Aucune carte « La carte avance » ; le bouton principal est « Retour à la carte » et fr.defi.resultat.suivant « Défi suivant · {{titre}} » n'est utilisé nulle part. Le type Retour ne connaît pas l'étape suivante.  
      Correction : Après une étape validée, charger l'étape suivante (useCarte : étape disponible de même acte, ou première du suivant) et afficher la carte d'annonce plus le bouton t('defi.resultat.suivant', { titre }) qui ouvre /defi/[id] ; « Retour à la carte » passe en variante texte.
- [x] **X2 (et A5)** (manque) `apps/mobile/src/components/EcranAnalyse.tsx`  
      Maquette : Trois cartes d'étape visibles dès l'envoi : « Envoyée » (faite), « Analyse en cours » (point or), « Ton retour arrive ici » (point gris). L'attente n'est jamais un écran sans repère.  
      Construit : Pendant la phase téléphone (envoi, attente réseau) rien n'est listé : seulement titre et corps. Les cartes n'apparaissent qu'en phase serveur et ce sont celles de A5 (rythme, béquilles, profil). fr.analyse.envoyee n'est utilisé nulle part ; « Ton retour arrive ici » est une note en bas, pas une étape.  
      Correction : Rendre la liste d'étapes dans toutes les phases non échouées : envoi / envoyée, analyse en cours (avec les trois sous-étapes de A5 quand la phase serveur les précise), ton retour arrive ici ; marquer l'étape courante par la teinte voix et un point.
- [x] **A2, A3, A4, A5, B4, X2, X3, X4** (moins_bien) `apps/mobile/src/components/EcranPrise.tsx`  
      Maquette : Tous ces écrans sont sur bleu nuit #001636 (« la pièce se calme », « la salle se tait ») : textes blancs, cartes #0d2a4e, onde or.  
      Construit : micro.tsx, questions.tsx, EcranPrise.tsx et EcranAnalyse.tsx rendent sur theme.fond (blanc chaud en mode clair). Seuls A1 (bienvenue.tsx) et H3 utilisent theme.hero.  
      Correction : Passer ces quatre écrans sur theme.hero avec heroTexte / heroTexteSecondaire, Titre surFondSombre, Bouton surFondSombre, et une teinte de carte sombre (#0d2a4e) ajoutée à Carte pour les promesses, les étapes d'analyse et le bandeau hors ligne.
- [x] **A4** (moins_bien) `apps/mobile/src/app/accueil/prise.tsx`  
      Maquette : Le gros titre (29 px) est la consigne « Raconte la dernière fois où tu as dû parler devant les autres. Comme à un ami. » ; « Ta prise de départ » et « Une seule prise » sont deux petites mentions de 11 px en haut.  
      Construit : titre={t('prise.unePrise')} : « Une seule prise » devient le Titre 28 px et la consigne passe en corps 16 px. La hiérarchie est inversée.  
      Correction : Donner la consigne comme titre d'EcranPrise et afficher « Une seule prise » à droite du surtitre (petite étiquette), comme la maquette.
- [ ] **A4, B4, X4** (moins_bien) `apps/mobile/src/components/EcranPrise.tsx`  
      Maquette : Chrono 40 px dans un anneau de 190 px (conic-gradient or qui se remplit du min au max) sur A4, chrono 56 px sur B4 ; bouton d'arrêt rond de 92 px au centre, « Refaire/Annuler » et « Terminer/Pause » de part et d'autre.  
      Construit : Chrono en typographie.chiffre (32 px), pas d'anneau de progression, trois boutons pilule empilés (Terminer, Refaire, Annuler). Aucune commande « Pause ».  
      Correction : Ajouter un anneau de progression (react-native-svg ou reanimated) autour du chrono, monter le chrono à 40 à 56 px, et une rangée Refaire · bouton rond d'arrêt · Terminer ; « Pause » si le service d'enregistrement peut suspendre, sinon garder Refaire.
- [x] **B1** (moins_bien) `apps/mobile/src/app/(onglets)/aujourdhui.tsx`  
      Maquette : La carte du défi est le héros : dégradé orange saturé, texte blanc, deux pilules bleu nuit en capitales « TON DÉFI DU JOUR · 2 MIN » et « +25 PTS », titre 25 px, cinq points de progression (l'actuel plus gros, blanc), bouton blanc « Je me lance → », pied « Formule Gratuit · un défi par jour ».  
      Construit : Carte teinte orange = accentDoux (#FFF3E2, pâle), texte sombre, surtitre en simple étiquette (pas de pilule), titre section 20 px, aucun point de progression, bouton orange standard. La carte ne se distingue plus des autres.  
      Correction : Créer une teinte « heroOrange » (dégradé ou #FF5E01) pour CarteDuJour avec textes blancs, mettre le surtitre en pilule comme les points, ajouter une rangée de points (nb_etapes_acte, ordre courant) dans EnteteDefi, bouton blanc à texte orange.
- [ ] **H1** (moins_bien) `apps/mobile/src/app/(onglets)/defis.tsx`  
      Maquette : Une carte : la brume est un bandeau bleu nuit avec un cadenas, l'acte en cours une grande contrée bleu pâle en dégradé avec un chemin SVG sinueux et des nœuds ronds (52 px or = fait, 74 px orange avec Bulle = courant, blanc = verrouillé) portant une pilule blanche de titre ; l'acte traversé un bandeau or en dégradé avec un rond bleu nuit coché.  
      Construit : Trois cartes de la même famille : « douce » pour la brume (sans cadenas), blanche avec une liste verticale de pastilles 32 px pour l'acte en cours, « voix » avec un chevron pour l'acte traversé. La métaphore de carte devient une liste.  
      Correction : Rendre l'acte en cours dans une grande Carte à fond dégradé (bleuDoux) avec les nœuds disposés en zigzag reliés par un chemin (react-native-svg), les tailles et couleurs des nœuds de la maquette et le titre en pilule ; bandeau bleu nuit + icône cadenas pour la brume, bandeau or + rond coché pour le traversé.
- [ ] **F1** (moins_bien) `apps/mobile/src/app/rebecca.tsx`  
      Maquette : Surtitre 11 px en capitales « Aller plus loin avec Rebecca », puis le titre 30 px « Ce que tu fais seul·e dans ton salon, tu es prêt·e à le faire dans une salle. » ; carte atelier avec un emplacement photo de 150 px ; bouton principal bleu « Voir l'atelier », lien « Une autre fois ».  
      Construit : « Aller plus loin avec Rebecca » est le Titre 28 px et la phrase forte passe en corps 16 px (hiérarchie inversée). Pas d'emplacement photo. Aucun bouton principal : « Voir mes récompenses » en secondaire et « Une autre fois » ; fr.rebecca.voirAtelier n'est utilisé nulle part.  
      Correction : Surtitre en typographie.etiquette, la phrase en Titre ; réserver une zone image dans CarteAtelier (photo si un champ arrive, sinon un aplat voixDoux) ; bouton principal « Voir l'atelier » ouvrant atelier.lien quand il existe.
- [ ] **D1b** (moins_bien) `apps/mobile/src/app/(onglets)/progres.tsx`  
      Maquette : Carte orange pâle « TES POINTS » avec le solde « 1 240 » en 22 px et un bouton pilule orange « Mes récompenses › ».  
      Construit : Un seul Bouton secondaire « Mes récompenses », sans le solde, alors que usePoints() est disponible (utilisé sur B1 et G1).  
      Correction : Carte teinte orange avec t('recompenses.titre'), le solde en typographie.chiffre (formaterEntier) et le bouton principal « Mes récompenses » dedans.
- [ ] **B3, H6, H7, B1** (moins_bien) `apps/mobile/src/components/EnteteDefi.tsx`  
      Maquette : Sous le titre, cinq points (or = faits, orange plus gros = courant, gris = à venir) puis « Acte II · Les crêtes du rythme · défi 3 sur 5 ». Le surtitre « Défi · 2 min » est une pilule colorée, comme « +25 pts ».  
      Construit : Position en texte petit seulement, aucun point de progression ; le surtitre est une étiquette nue, seule la pilule des points existe.  
      Correction : Ajouter à EnteteDefi une rangée de points (props ordre/total déjà connus via positionDefi) et mettre le surtitre en pilule (teinte selon le format : orange doux standard, bleu doux texte, bleu nuit/or long).
- [x] **B3** (detail) `apps/mobile/src/app/defi/[etapeId]/index.tsx`  
      Maquette : La carte de consigne porte un rond photo de 44 px (Rebecca) à gauche de « Rebecca te dit, mot pour mot : » ; en bas, lien « Un autre sujet » sous « Je suis prêt·e ».  
      Construit : Pas d'emplacement d'avatar ; le lien du bas est « Retour ».  
      Correction : Réserver un rond de 44 px (photo de Rebecca ou aplat voixDoux) quand la consigne n'est pas provisoire ; garder « Retour » tant qu'il n'existe pas de banque de sujets alternatifs, et le noter dans STRINGS.md pour que l'écart soit volontaire.
- [ ] **H6, H7** (detail) `apps/mobile/src/app/defi/[etapeId]/index.tsx`  
      Maquette : H6 : bouton « Lire, puis parler ». H7 : bouton « Préparer · 2 min » ; étape 2 « Parle · 5 min / L'anneau marque tes trois appuis en chemin » ; étape 3 « Le retour, en deux temps / La structure d'abord, la voix ensuite ».  
      Construit : Bouton « Je suis prêt·e » pour les trois formats (fr.defi.preparer n'est utilisé nulle part, lireEtParler seulement sur l'écran suivant) ; étape 2 « Tes appuis restent sous tes yeux pendant la prise » ; étape 3 « Le retour / Ce que Bulle a mesuré, puis la carte qui avance ». Ces reformulations ne figurent pas dans la table de corrections de STRINGS.md.  
      Correction : Libellé du bouton selon le format (pret / lireEtParler / preparer) ; soit revenir aux libellés de la maquette pour les étapes 2 et 3, soit ajouter les deux reformulations à STRINGS.md avec leur raison (l'anneau n'existe pas, le retour en deux temps attend la Phase 3).
- [ ] **H5, H5b** (detail) `apps/mobile/src/i18n/fr.ts`  
      Maquette : Bouton bleu nuit « Aller dans l'Arène ».  
      Construit : fr.defi.termine.voirArene = « Voir l'Arène », hors table de corrections.  
      Correction : Remettre « Aller dans l'Arène » (ou ajouter la correction à STRINGS.md). « Voir les formules » attend E1 : pas compté.
- [ ] **B1b (et B1)** (detail) `apps/mobile/src/app/aujourdhui/rebecca.tsx`  
      Maquette : Carte atelier en dégradé sombre : « ATELIER COLLECTIF · EN DIRECT », pilule « 12 places », titre 22 px. Ligne « Une heure, seule à seule » avec icône 44 px et chevron. Sur B1 : photo ronde de Rebecca (44 px, liseré or) et deux boutons « Garder ma place » / « Une heure à deux ».  
      Construit : Étiquette « Atelier · en direct » (fr.aujourdhui.atelierEnDirect) sans « collectif » ; la ligne individuelle reprend le titre de F1 « Ses formations individuelles » (STRINGS.md ne corrige que la ligne de détail) ; carte en teinte voix, titre 17 px ; sur B1 pas de photo ni de raccourci vers le seule-à-seule ; fr.aujourdhui.garderPlace n'est utilisé nulle part.  
      Correction : « Atelier collectif · en direct » ; titre « Une heure, seule à seule » sur B1b (garder « Ses formations individuelles » pour F1) ; emplacement photo 44 px dans CarteAtelier ; sur B1, seconde action vers la ligne individuelle de B1b.
- [ ] **B1, D1, G1, X3** (detail) `apps/mobile/src/app/(onglets)/progres.tsx`  
      Maquette : La flamme de série (goutte orange à cœur or) : dans la pilule de B1 devant « 6 », sur chaque jour actif de « Ta semaine » (D1), en badge sur l'avatar de G1, devant « Série de 6 jours : intacte » (X3).  
      Construit : Aucune flamme : B1 affiche « 6 / jours de suite » dans un carré, D1 des ronds pleins de 22 px, G1 rien, X3 rien.  
      Correction : Un petit composant Flamme (deux formes ou SF flame.fill / Material local-fire-department via Icone) réutilisé aux quatre endroits.
- [x] **A3** (detail) `apps/mobile/src/app/accueil/questions.tsx`  
      Maquette : À droite de « QUESTION 2 SUR 3 », trois barres de 22 × 5 px, or jusqu'à la question courante.  
      Construit : Le compteur texte seulement.  
      Correction : Rangée de QUESTIONS_ACCUEIL.length barres (voix / carteDouce) alignée à droite du compteur.
- [x] **B5, B5b, H2** (detail) `apps/mobile/src/components/TuilesMesures.tsx`  
      Maquette : Troisième tuile « 6 / SILENCES, 2 TENUS » : le total et les tenus.  
      Construit : Seulement mesures.silences.tenus sous « silences tenus » ; le total disparaît (A6 l'affiche pourtant).  
      Correction : Grand chiffre = silences.total, libellé = « silences, {{tenus}} tenus » (nouvelle clé fr.retour.silencesDetail).
- [ ] **H2, H4** (detail) `apps/mobile/src/app/retour/[tentativeId].tsx`  
      Maquette : H2 : médaille ronde or de 74 px au-dessus de « Défi réussi » ; dans « Ce que l'analyse a entendu », un rond de 22 px (or si le critère est bon, gris sinon) devant chaque ligne. H4 : rond or coché de 30 px devant chaque défi.  
      Construit : Pas de médaille ; lignes critère + score sans indicateur ; lignes de H4 sans rond.  
      Correction : Un rond teinte voix (score/max ≥ 0,8) ou carteDouce devant chaque sous-note ; un rond coché par ligne validée dans acte/[acteId]/index.tsx ; une pastille or de 74 px avec Icone checkmark au-dessus du titre « Défi réussi ».
- [ ] **D2** (detail) `apps/mobile/src/app/recompenses.tsx`  
      Maquette : Chaque récompense a une tuile icône de 46 px et, quand elle est échangeable, une barre de progression (piste #FFE9C2, remplissage orange) sous le titre avec « 1 200 pts atteints · à toi » ; « FORMULE GRATUIT » en pilule.  
      Construit : Titre, sous-titre, pilule de coût et une ligne d'état texte (« Plus que N pts ») ; pas de barre ni d'icône ; la formule en texte petit.  
      Correction : Barre solde/cout (rayons.pilule, 5 px) sous le titre pour les récompenses échangeables, emplacement icône 46 px par type, formule en pilule carteDouce.
- [x] **G3** (detail) `apps/mobile/src/app/reglages.tsx`  
      Maquette : « Réduire les animations / Bulle reste calme, rien ne bouge » avec un interrupteur ; « Recevoir une copie de mes données › » ligne entière tapable avec chevron ; « Sinon : « Voix 87 » » est un exemple.  
      Construit : Ligne « Réduire les animations » en lecture seule (suit le réglage système, sans interrupteur) ; l'export porte un bouton texte « Continuer » ; le numéro 87 est codé en dur pour tout le monde (t('reglages.voix.publierPrenomDetail', { numero: 87 })).  
      Correction : Interrupteur local (AsyncStorage) qui force Bulle et CielEtoile au calme en plus du réglage système ; ligne export en Pressable avec chevron ; libellé sans numéro (« Sinon : anonyme dans l'Arène, sous un numéro de voix ») tant que le numéro réel n'existe pas.
- [x] **A2** (detail) `apps/mobile/src/app/accueil/micro.tsx`  
      Maquette : Bulle 96 px centrée au-dessus du titre 32 px centré, le bloc centré verticalement.  
      Construit : Bulle petite (40 px) alignée à gauche, titre aligné à gauche, tout en haut.  
      Correction : Bulle taille moyenne centrée, Titre centre, bloc en justifyContent center.
- [ ] **H3** (detail) `apps/mobile/src/app/acte/[acteId]/traverse.tsx`  
      Maquette : Bouton principal or (#FFBD59, texte bleu nuit) « Découvrir l'acte III · Emporter la salle » sur le dégradé bleu nuit.  
      Construit : Bouton principal orange standard.  
      Correction : Variante « or » de Bouton (fond couleurs.or, texte bleuNuit) pour les écrans héros de célébration.
- [ ] **Toutes (fr.ts)** (detail) `apps/mobile/src/i18n/fr.ts`  
      Maquette : STRINGS.md règle 12 : espace insécable avant « : » et avant l'unité, fine insécable avant « ? », « ! », « ; » et à l'intérieur des guillemets. (La maquette HTML n'en contient pas non plus : l'écart est avec la règle, pas avec la maquette ; signalé parce que demandé.)  
      Construit : fr.ts ne contient aucun U+00A0 ni U+202F : 30 chaînes avec espace sécable avant « : » (« Exception : une prise… », « record : {{record}} »), « Supprimer ton compte ? », « Échanger {{cout}} points ? », « « {{mot}} » », et toutes les unités (« 2 min », « {{secondes}} s », « +{{points}} pts », « 48 h »). Idem dans le code : `${h} h ${m}` (reglages.tsx), `${min} min ${s} s` (profil.tsx), « {defi.consigne} » (index.tsx, EcranPrise.tsx).  
      Correction : Passer fr.ts au peigne (script : remplacer « : » par « : », « ? » par « ? », espaces intérieurs des guillemets par U+202F, chiffre + unité par U+00A0) et ajouter un test qui interdit l'espace sécable dans ces positions ; même traitement dans les quatre gabarits de code.

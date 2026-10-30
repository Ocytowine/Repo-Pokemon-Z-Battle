# Parties locales, sauvegarde automatique, cloud et mises à jour

## Import d'une sauvegarde du fangame — code local du 2026-10-30

Le choix de partie propose un fichier `Game*.rxdata` ou, dans l'APK Android,
une recherche limitée au dossier choisi par le joueur. Le convertisseur affiche
un aperçu et ses limites avant de toucher au slot. Si ce slot contient déjà une
partie, ses branches manuelle et automatique sont mises en copie de secours ;
« Restaurer la partie précédente » permet de les remettre. Le fichier d'origine
reste intact. L'import et la restauration suspendent l'envoi cloud automatique
du slot jusqu'a une synchronisation manuelle complete. « Garder ma version
locale » n'envoie que la branche choisie ; l'autre reste protegee.
Les données non converties sont signalées dans l'aperçu ; garder le `.rxdata`
pour une reprise après extension du portage.

## Audit du 2026-10-30

Le transport cloud conserve le snapshot complet de chaque slot : monde,
progression, Pokémon, Sac et profil. Un test de retour enrichi vérifie aussi
`POKERIDER`, les switches, les variables, l'équipe et le Ranch. Le bouton
« Synchroniser » prépare désormais le dernier point automatique stable avant
l'envoi et rejoue une demande reçue pendant une synchronisation en cours.
Une scène active ou un échec d'écriture locale empêche d'annoncer la progression
récente comme envoyée. L'automatique cloud reste différée de dix minutes.

Les données du fangame original sans équivalent actuel (`visitedMaps`,
`movedEvents`, `erasedEvents`) attendent le contrat de conversion ; elles ne
peuvent pas encore figurer dans le cloud de l'app. Un contrôle de parité entre
le téléphone et la révision distante appartient à la recette du prochain lot
complet ; il n'est pas nécessaire pour l'audit local du code.

État au 2026-10-28 : le premier lot local est codé et les tests automatisés
passent. Sa vérification sur téléphone reste à faire. La passerelle de connexion
cloud est déployée dans `apps/cloud-save-worker` et sa politique Access est
active pour l'adresse du porteur. La connexion navigateur a été validée ;
un APK d'essai de connexion a été installé sur Samsung et la session a été validée.
La synchronisation des données et la recherche de mises
à jour restent à implémenter.

La base D1 `pokemon-z-battle-saves` est créée en région Europe de l'Ouest.
Le bucket privé R2 `pokemon-z-battle-saves-private` est créé avec la juridiction
Union européenne. Le Worker est lié aux deux ressources et déployé. Les tables
de versions et pointeurs sont initialisées mais encore vides. Aucun contenu de
sauvegarde n'est encore envoyé depuis l'APK.

## Expérience voulue

- Deux parties indépendantes, nommées Partie 1 et Partie 2. Chaque partie possède
  sa sauvegarde manuelle, son identité de Dresseur, son équipe, son Sac et sa
  progression. Choisir une partie vide démarre une nouvelle aventure.
- Une carte « Sauvegarde automatique » est présentée pour la partie active. En
  stockage, **chaque partie a son propre automatique** : passer à l'autre partie
  ne détruit pas le secours de la précédente.
- Une sauvegarde automatique n'écrase jamais une sauvegarde manuelle. Au
  démarrage, si l'automatique est plus récent, le joueur choisit quelle version
  reprendre. La version non choisie reste disponible.
- L'automatique est créé après des étapes cohérentes (fin de combat et de
  règlement, capture terminée, transfert achevé, événements terminés), puis au
  plus toutes les deux minutes de jeu actif. Ne pas enregistrer au milieu d'une
  cinématique, d'un combat ou d'une transaction en attente. La mise en arrière
  plan est un dernier essai, pas le seul mécanisme de sécurité.
- La sauvegarde v2 actuelle devient Partie 1 sans effacement. La copie de travail
  personnelle existante peut alimenter son premier automatique si elle contient
  des progrès plus récents. La migration est rejouable et vérifiée par tests.

## Contrat de données et Coop

Une révision contient `schemaVersion`, `savedAt`, `worldSave` (carte,
position, direction, mode, état personnel et narratif cohérent), l'identité et
les choix de nouvelle partie. L'identifiant de partie figure dans sa clé de
stockage. Elle ne contient pas les assets du jeu. Les
préférences d'appareil et les paramètres audio restent globaux. Le jeu ne charge
qu'une partie active à la fois.

L'état appartient au joueur local en solo comme en Coop. L'hôte conserve la
position et la narration du monde qu'il dirige. L'invité sauvegarde sa progression
personnelle sans transformer sa position temporaire chez l'hôte en point de
reprise solo. Aucun inventaire ni sauvegarde privée n'est répliqué à la room.
Changer de partie attend la sortie du combat, des séquences et de la room active ;
la reprise après reconnexion garde le même identifiant de partie.

## Cloudflare, deuxième lot

Pour un premier essai privé, connexion par code de courriel avec Cloudflare
Access, limitée aux adresses autorisées. Un **Worker distinct** du Worker Coop
valide l'identité et expose la liste des révisions ainsi que l'envoi/la reprise
d'une partie. D1 contient utilisateurs, parties, révisions et pointeurs courants ;
R2 privé contient les snapshots versionnés. Il faut valider d'abord le parcours
de connexion et les cookies dans la WebView Android. Si l'accès s'ouvre à un
public plus large, retenir un fournisseur d'identité adapté à l'application.

La sauvegarde locale reste utilisable hors ligne ; l'envoi est mis en attente.
Chaque écriture cloud apporte la révision parente attendue. Si un second appareil
a déjà avancé, le serveur refuse l'écrasement : l'interface montre les deux
versions et propose de conserver l'une ou de dupliquer l'autre dans une place
libre. Ne jamais fusionner automatiquement les états narratifs ou Pokémon.
Conserver quelques révisions anciennes pour réparer une erreur de manipulation.
Les appels et les objets sont toujours bornés à l'identité authentifiée.

La room Coop ne stocke pas les sauvegardes personnelles. Le compte cloud ne
change ni l'autorité du combat, ni celle des événements partagés.

### Jalon connexion d'essai (2026-10-28)

Le compte Cloudflare existant peut héberger un second Worker nommé
`pokemon-z-battle-cloud-save`. Le fournisseur One-time PIN a été activé par le
porteur. Le Worker n'a pour l'instant que `GET /api/session` : il confirme le
courriel issu d'Access et répond `401` sans identité. Aucun accès aux parties,
aucun D1/R2 et aucune synchronisation ne sont encore actifs.

Wrangler est connecté au compte Cloudflare existant et le Worker est déployé à
`https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev`. Le test sans
identité recevait `401` avant Access ; après activation de la stratégie,
l'appel non connecté est redirigé vers la page de connexion (`302`). La règle
Allow utilise uniquement l'adresse exacte du porteur. Ne pas appliquer Access au Worker Coop :
la protection directe bloque ses WebSockets. La connexion avec code affiche
`authenticated: true` dans un navigateur. L'APK ouvre une WebView de connexion
partageant ses cookies Android avec le jeu ; au retour, une requête native a
confirmé que la session est utilisable dans l'app. Le Worker expose maintenant
l'inventaire, la lecture et l'écriture conditionnelle des révisions. À ce stade
de l'essai, aucune sauvegarde n'avait encore été envoyée.

### Raccord client prêt pour recette Android (2026-10-28)

Dans Menu → Sauvegardes, « Synchroniser » associe l'adresse Access de l'appareil
et compare les quatre sauvegardes. Une sauvegarde locale absente du cloud est
envoyée. Une version connue modifiée localement est envoyée seulement si la
révision cloud est toujours celle connue par l'appareil. La connexion est
revérifiée avant chaque opération ; un changement de compte bloque l'envoi.
Les modifications suivantes déclenchent une tentative différée ; un retour du
réseau relance la comparaison. Si l'app est hors ligne, la sauvegarde reste locale
et la différence sera retrouvée au prochain passage.

Une version cloud seule ou un conflit n'écrase jamais la version locale sans
choix du joueur. Le menu donne « Récupérer cloud » et, en conflit, « Garder
locale », avec confirmation avant remplacement. La récupération de la partie
active recharge le jeu ; la sélection est bloquée pendant Coop ou une action.
L'état est personnel : hôte et invité écrivent leurs propres sauvegardes depuis
le même code local ; la room Coop ne reçoit ni compte, ni snapshot. Le contrat de
révision est commun aux deux chemins. Tests unitaires de deux appareils et des
conflits passés ; test réel Samsung, y compris R2 et reconnexion, encore ouvert.

Retour de récupération réelle : après une réinstallation, la manuelle de la
Partie 1 a été lue depuis R2. La reprise automatique de la partie provisoire,
plus récente, pouvait reprendre l'écran au redémarrage même après récupération
de la manuelle. Le choix explicite de la manuelle neutralise maintenant cette
automatique jusqu'à une nouvelle automatique. Les listes indiquent joueur, lieu,
effectif de l'équipe et premier Pokémon avec son niveau pour reconnaître une
version avant de la charger. Après installation du correctif, la manuelle a été
activée sur le Samsung : Route 5, équipe de six Pokémon et Dardargnan niveau 21.
Le porteur confirme le retour visuel de sa partie ; la révision cloud est restée
inchangée.

### Fréquence cloud et historique borné (2026-10-28)

Les sauvegardes automatiques locales restent fréquentes. Leur envoi au cloud est
limité à une tentative au plus tôt dix minutes après la dernière tentative
automatique sur cet appareil, même si elle a échoué. Les changements intermédiaires restent dans l'emplacement
local et la prochaine tentative envoie sa version la plus récente. Une sauvegarde
manuelle déclenche son propre envoi après une seconde, sans forcer l'envoi de
l'automatique. Le bouton « Synchroniser » permet toujours un envoi immédiat des
quatre emplacements. Le retour du réseau relance les tentatives ; les conflits
continuent de demander un choix explicite.

Après chaque nouvel envoi automatique réussi, le Worker conserve sa version
courante et au plus 29 anciennes versions automatiques par compte et par partie.
Il efface aussi leurs objets R2. Les versions manuelles ne sont pas élaguées.
Cette limite réduit l'accumulation ; elle ne définit pas une politique de
conservation des manuelles. Le compte cloud, les sauvegardes et les décisions de
conflit restent personnels, en solo comme pour l'hôte et l'invité Coop.

Recette technique : tests du délai et des deux chemins d'envoi ; essai Wrangler
local avec 34 envois automatiques successifs, puis comptage D1 : 30 révisions
automatiques restantes et version courante lisible dans R2. Avant déploiement,
le compte distant comptait 12 automatiques pour la Partie 1 et une pour la
Partie 2 ; aucune suppression immédiate n'est attendue.

## Mises à jour Android, troisième lot

Suivi détaillé et procédure actuelle : [APK Android privée et mises à jour](ANDROID_MISE_A_JOUR_PRIVEE.md).

Première étape : au démarrage, une requête courte lit un manifeste de version
hébergé sur Cloudflare (`versionCode`, version lisible, notes, lien de téléchargement)
et affiche « Une mise à jour est disponible ». L'absence de réseau ne bloque pas
le jeu. Le téléchargement et l'installation restent volontaires.

Avant de diffuser ce lien, produire des versions signées avec une clé stable et
augmenter `versionCode` à chaque APK. Les builds de débogage actuels utilisent
`versionCode 1` et la clé propre au PC qui compile : une installation provenant
d'un autre PC ne peut pas toujours mettre à jour l'application déjà installée.
L'APK contient les médias du jeu ; décider explicitement de sa distribution
avant de rendre un téléchargement public.

## Ordre de réalisation

1. Deux parties locales, migration de la sauvegarde actuelle, sauvegarde
   automatique et choix de reprise ; tests de solo, hôte, invité et restauration.
2. Connexion d'essai et synchronisation Cloudflare avec conflits et hors ligne.
3. Chaîne de publication Android signée, puis notification de mise à jour.

## Premier lot local : réalisation et recette

Le menu Sauvegardes affiche Partie 1, Partie 2 et l'automatique de la partie
active. Le bouton Sauvegarder écrit la version manuelle. L'automatique est écrit
après une mutation de progression stabilisée et au plus tard après deux minutes
d'activité ; une tentative est également faite en arrière-plan. Un choix de
reprise apparaît au lancement quand l'automatique est plus récent et différent
de la manuelle. Le menu permet ensuite de revenir à la version manuelle.

Le passage à une autre partie recharge la sauvegarde complète de cette partie.
Il est indisponible dans une room Coop ou pendant une action. Sur l'appareil qui
possédait une sauvegarde avant ce lot, cette dernière devient Partie 1. Le
contenu des fichiers source reste local à l'appareil et n'entre jamais dans Git.

Tests automatisés : migration rejouable, isolation des deux parties, démarrage
d'une Partie 2 vide, identité du Dresseur, sauvegarde automatique de l'invité
sans déplacer son point de reprise solo, reprise manuelle après automatique et
lecture d'un emplacement endommagé. Recette téléphone à faire : sauvegarder la
partie actuelle, installer le nouvel APK, vérifier la reprise de Partie 1,
créer Partie 2, jouer et sauvegarder dans chacune, puis fermer et relancer l'app
pour confirmer l'indépendance des équipes et positions. Vérifier aussi hôte et
invité Coop. Ne pas remplacer l'APK du téléphone sans cette recette.

Références : [note initiale](Débug/Amélioration/slot%20sauvegarde.md),
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/),
[D1](https://developers.cloudflare.com/d1/),
[R2](https://developers.cloudflare.com/r2/get-started/workers-api/),
[règles de mise à jour Android](https://developer.android.com/google/play/app-updates).

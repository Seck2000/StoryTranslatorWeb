# StoryTranslatorWeb — Guide technique des fonctionnalités

**Document complémentaire au plan de continuation (PFE)**  
**Cours :** INF39615-7T — Session été 2026  
**Auteure :** Aissatou Seck  

---

## Objet du document

Le présent guide détaille, pour chaque fonctionnalité retenue dans le plan de continuation, l’objectif visé, l’approche de réalisation et les technologies associées. Il est rédigé de manière à être compréhensible par un lecteur non spécialiste tout en précisant les choix techniques destinés à la mise en œuvre.

**Document de référence :** `PLAN_CONTINUATION_PFE.md`

---

## Architecture de référence

L’application repose sur une architecture client–serveur classique :

| Composant | Rôle | Technologie actuelle ou prévue |
|-----------|------|--------------------------------|
| **Interface utilisateur** | Affichage, interaction, formulaires | React (Vite), Tailwind CSS |
| **API applicative** | Authentification, données, traduction, fichiers | Node.js, Express |
| **Persistance structurée** | Comptes, progressions, favoris, métadonnées | PostgreSQL ou MongoDB |
| **Persistance fichiers** | Images d’histoires, avatars, archives ZIP | Système de fichiers serveur (évolution possible vers stockage objet) |
| **Services externes** | Traduction, courriel (réinitialisation mot de passe) | API REST tierces |
| **Intégration continue** | Contrôle qualité automatisé | GitHub Actions, ESLint, tests automatisés |
| **Hébergement** | Mise à disposition publique | Vercel/Netlify (frontend), Render/Railway (backend), base managée |

---

## Section A — Comptes et données

### 1. Inscription utilisateur

**Objectif**  
Permettre la création d’un compte personnel associé à une adresse courriel (ou identifiant unique) et à un mot de passe.

**Description fonctionnelle**  
L’utilisateur accède à un formulaire d’inscription. Après validation des champs, le système crée un enregistrement utilisateur en base de données. Les doublons (courriel déjà utilisé) sont refusés avec un message explicite.

**Approche de mise en œuvre**  
1. Création d’une route API `POST /api/auth/register`.  
2. Validation des entrées (format courriel, longueur du mot de passe).  
3. Hachage du mot de passe avant persistance (voir point 4).  
4. Interface React dédiée reliée à cette route.

**Technologies**  
React, Express, base de données relationnelle ou documentaire, bibliothèque de validation (ex. Zod, Joi).

---

### 2. Connexion et déconnexion

**Objectif**  
Authentifier un utilisateur existant et mettre fin à sa session applicative.

**Description fonctionnelle**  
La connexion vérifie les identifiants et établit une session. La déconnexion invalide l’accès aux ressources protégées côté client (suppression du jeton d’authentification).

**Approche de mise en œuvre**  
1. Route `POST /api/auth/login` : vérification du mot de passe par comparaison avec le hash stocké.  
2. Émission d’un jeton signé (JWT) renvoyé au client.  
3. Route ou action `POST /api/auth/logout` (invalidation côté client ; optionnel : liste noire de jetons côté serveur).  
4. Pages ou composants React « Connexion » et bouton « Déconnexion ».

**Technologies**  
React, Express, JWT (`jsonwebtoken`), bcrypt.

---

### 3. Sessions sécurisées côté serveur

**Objectif**  
Garantir que seuls les utilisateurs authentifiés accèdent aux données personnelles et aux opérations sensibles.

**Description fonctionnelle**  
Chaque requête vers une route protégée doit présenter un jeton valide. Le serveur refuse l’accès en l’absence ou en cas d’expiration du jeton.

**Approche de mise en œuvre**  
1. Middleware Express d’authentification : extraction du jeton depuis l’en-tête `Authorization: Bearer <token>`.  
2. Vérification de la signature et de l’expiration du JWT.  
3. Injection de l’identifiant utilisateur (`userId`) dans le contexte de la requête pour les routes suivantes.

**Technologies**  
Express (middleware), JWT, variables d’environnement (`JWT_SECRET`).

---

### 4. Mot de passe sécurisé

**Objectif**  
Protéger les mots de passe contre la lecture directe en cas d’accès non autorisé à la base de données.

**Description fonctionnelle**  
Aucun mot de passe en clair n’est stocké. Seul un empreinte cryptographique (hash) est conservée. Des règles minimales de complexité sont appliquées à l’inscription.

**Approche de mise en œuvre**  
1. Hachage avec algorithme adapté (coût configurable) à l’inscription et à la réinitialisation.  
2. Comparaison sécurisée à la connexion.  
3. Politique minimale : longueur, caractères requis (selon exigences du cours).

**Technologies**  
bcrypt ou argon2 (module Node.js).

---

### 5. Réinitialisation du mot de passe

**Objectif**  
Permettre à un utilisateur ayant oublié son mot de passe d’en définir un nouveau de manière sécurisée.

**Description fonctionnelle**  
L’utilisateur saisit son courriel. Le système envoie un lien à durée limitée. Ce lien mène à un formulaire de nouveau mot de passe.

**Approche de mise en œuvre**  
1. Route `POST /api/auth/forgot-password` : génération d’un jeton à usage unique et à expiration courte.  
2. Envoi du lien par courriel (service SMTP ou API transactional).  
3. Route `POST /api/auth/reset-password` : validation du jeton, hachage et mise à jour en base.  
4. Pages React associées.

**Technologies**  
Nodemailer, SendGrid ou Resend ; stockage temporaire du jeton (table dédiée ou JWT signé à courte durée).

---

### 6. Base de données

**Objectif**  
Centraliser la persistance des comptes, des métadonnées des histoires et des données d’usage (progression, favoris, historique, préférences).

**Description fonctionnelle**  
Les informations structurées sont stockées dans un système de gestion de base de données. Les fichiers volumineux (images, ZIP) demeurent sur le système de fichiers ou sur un stockage objet ; la base conserve les références (chemins, identifiants).

**Approche de mise en œuvre**  
1. Modélisation des entités : `User`, `Story`, `Progress`, `Favorite`, `ReadingHistory`, `UserPreference`, éventuellement `TranslationCache`.  
2. Choix du SGBD : PostgreSQL (relations explicites) ou MongoDB (documents proches du format JSON des histoires).  
3. Couche d’accès : ORM ou ODM (Prisma, Mongoose, ou driver natif).  
4. Scripts de migration ou d’initialisation du schéma.

**Technologies**  
PostgreSQL + Prisma, ou MongoDB + Mongoose ; MongoDB Atlas / Supabase / Neon en production.

---

### 7. Progression de lecture sauvegardée en ligne

**Objectif**  
Conserver, pour chaque utilisateur et chaque histoire, l’indice de la scène atteinte, indépendamment du navigateur utilisé.

**Description fonctionnelle**  
Lors de la lecture, la progression est enregistrée sur le serveur. Au retour sur une histoire, l’application propose de reprendre au dernier point sauvegardé.

**Approche de mise en œuvre**  
1. Table ou collection liant `userId`, `storyId`, `sceneIndex`, `updatedAt`.  
2. Routes `GET` et `PUT` (ou `PATCH`) `/api/progress/:storyId`.  
3. Appels API depuis le lecteur React (remplacement ou complément du `localStorage` actuel).

**Technologies**  
Express, base de données, React (`useEffect` sur changement de scène).

---

### 8. Favoris

**Objectif**  
Permettre à l’utilisateur de marquer des histoires pour consultation ultérieure.

**Description fonctionnelle**  
Un contrôle d’interface (icône ou bouton) ajoute ou retire une histoire de la liste des favoris de l’utilisateur connecté.

**Approche de mise en œuvre**  
1. Relation many-to-many simplifiée : paires `(userId, storyId)` en base.  
2. Routes `POST /api/favorites` et `DELETE /api/favorites/:storyId`.  
3. Route `GET /api/favorites` pour l’espace personnel.

**Technologies**  
Express, base de données, React.

---

### 9. Historique de lecture

**Objectif**  
Tracer les histoires consultées ou terminées par l’utilisateur, avec horodatage.

**Description fonctionnelle**  
Chaque ouverture ou achèvement d’une histoire génère une entrée d’historique consultable depuis le profil ou le tableau de bord.

**Approche de mise en œuvre**  
1. Enregistrement lors du démarrage et/ou de la fin de lecture (`eventType`, `storyId`, `timestamp`).  
2. Route `GET /api/history` avec pagination si nécessaire.

**Technologies**  
Express, base de données, React.

---

### 10. Histoires récemment lues

**Objectif**  
Afficher rapidement les dernières histoires consultées par l’utilisateur.

**Description fonctionnelle**  
Liste limitée (par exemple cinq éléments) dérivée de l’historique, triée par date décroissante.

**Approche de mise en œuvre**  
Requête sur l’historique ou table dédiée « récentes », agrégée par `storyId` avec date maximale ; exposition via `GET /api/recent` ou inclusion dans le tableau de bord.

**Technologies**  
Requêtes SQL/MongoDB, React.

---

### 11. Préférences utilisateur

**Objectif**  
Persister les réglages personnels (notamment la langue d’affichage ou de lecture par défaut).

**Description fonctionnelle**  
L’utilisateur configure ses préférences depuis son espace personnel ; les valeurs sont rechargées à chaque session.

**Approche de mise en œuvre**  
1. Champ JSON ou colonnes dédiées sur l’entité `User`.  
2. Routes `GET` et `PATCH /api/users/me/preferences`.

**Technologies**  
Base de données, Express, React.

---

## Section B — Espace personnel

### 12. Tableau de bord / espace personnel utilisateur

**Objectif**  
Offrir une vue centralisée des données liées au compte : progression, favoris, historique, histoires récentes.

**Description fonctionnelle**  
Page accessible uniquement aux utilisateurs connectés, structurée en sections ou cartes informatives.

**Approche de mise en œuvre**  
1. Route frontend protégée (ex. `/dashboard`).  
2. Garde d’authentification : redirection vers la connexion si absence de jeton.  
3. Agrégation des appels API des points 7 à 11.

**Technologies**  
React Router, Express, Tailwind CSS.

---

### 13. Profil utilisateur et photo de profil

**Objectif**  
Permettre la consultation et la modification du profil, incluant le téléversement d’une image d’avatar.

**Description fonctionnelle**  
Affichage du nom, du courriel et de l’avatar. Formulaire de mise à jour du profil et du fichier image.

**Approche de mise en œuvre**  
1. Route `PATCH /api/users/me` pour les champs texte.  
2. Route `POST /api/users/me/avatar` avec `multipart/form-data` (middleware `multer`, déjà utilisé pour l’import ZIP).  
3. Stockage du fichier dans un répertoire dédié ; enregistrement de l’URL ou du chemin en base.  
4. Validation du type et de la taille du fichier.

**Technologies**  
multer, Express, React ; en production, stockage objet (Cloudinary, S3) recommandé pour la scalabilité.

---

## Section C — Quiz

### 14. Quiz interactif en fin d’histoire

**Objectif**  
Évaluer la compréhension du récit par des questions à choix multiples affichées après la dernière scène.

**Description fonctionnelle**  
Chaque histoire peut inclure un ensemble de questions définies en français dans le fichier source. L’interface présente les questions, enregistre les réponses et affiche un retour (score ou message de réussite).

**Approche de mise en œuvre**  
1. Extension du schéma `story.json` : propriété `quiz` (questions, choix, index de la bonne réponse).  
2. Composant React `Quiz` déclenché à la fin du parcours de lecture.  
3. Coordination avec le module de traduction (section D) pour afficher le quiz dans la langue choisie par l’utilisateur, lorsque celle-ci diffère du français source.

**Technologies**  
JSON, React, API de traduction (section D).

---

## Section D — Langues et traduction

### 15. Contenu source en français uniquement

**Objectif**  
Simplifier la production et la maintenance des contenus en ne rédigeant les histoires et les quiz qu’en français.

**Description fonctionnelle**  
Les fichiers `story.json` ne contiennent plus de champs multilingues manuels (`fr`, `en`, `ar`). Le texte est stocké sous forme de chaînes françaises uniques par scène et par question.

**Approche de mise en œuvre**  
1. Refonte du format JSON et adaptation du lecteur React.  
2. Migration des histoires existantes vers le nouveau format.  
3. Mise à jour de la documentation du format d’import ZIP.

**Technologies**  
JSON, React ; scripts de migration Node.js si volume important.

---

### 16. Traduction via API

**Objectif**  
Proposer l’affichage des textes dans d’autres langues sans duplication manuelle dans les fichiers.

**Description fonctionnelle**  
Le serveur transmet le texte français et la langue cible à un service de traduction externe, puis renvoie le résultat au client.

**Approche de mise en œuvre**  
1. Route `POST /api/translate` (corps : `text`, `targetLang`).  
2. Appel serveur vers l’API du fournisseur (DeepL, Google Cloud Translation, LibreTranslate, etc.).  
3. Clé API stockée exclusivement dans les variables d’environnement.

**Technologies**  
Express, SDK ou client HTTP du fournisseur choisi, `dotenv`.

---

### 17. Choix de la langue cible par l’utilisateur

**Objectif**  
Permettre à l’utilisateur de sélectionner la langue dans laquelle il souhaite lire l’histoire et le quiz.

**Description fonctionnelle**  
Sélecteur de langue dans l’interface ; la liste correspond aux langues supportées par l’API de traduction retenue.

**Approche de mise en œuvre**  
1. État global ou local `targetLang` dans React.  
2. À chaque changement de langue ou de scène : demande de traduction ou lecture depuis le cache (point 18).  
3. Persistance optionnelle dans les préférences utilisateur (point 11).

**Technologies**  
React, API de traduction.

---

### 18. Cache ou persistance des traductions (optionnel)

**Objectif**  
Réduire la latence, le coût des appels API et la dépendance au réseau pour les textes déjà traduits.

**Description fonctionnelle**  
Avant d’appeler le service externe, le système vérifie si la paire (texte source, langue cible) a déjà été traduite et stockée.

**Approche de mise en œuvre**  
1. Clé de cache : empreinte du texte français + code langue.  
2. Table `translations` ou stockage clé-valeur.  
3. Politique d’expiration configurable si nécessaire.

**Technologies**  
Base de données ; Redis en variante avancée.

---

## Section E — Qualité du code

### 19. Tests unitaires

**Objectif**  
Vérifier automatiquement le comportement des composants critiques et prévenir les régressions.

**Description fonctionnelle**  
Suite de tests exécutables en ligne de commande, couvrant la logique métier, les routes API principales et, le cas échéant, des composants React isolés.

**Approche de mise en œuvre**  
1. **Backend :** Jest + Supertest pour les routes d’authentification, de progression et de traduction.  
2. **Frontend :** Vitest + React Testing Library pour les composants clés (lecteur, quiz).  
3. Script `npm test` dans les paquets `client` et `server`.

**Technologies**  
Jest, Vitest, Supertest, React Testing Library.

---

### 20. Pipeline CI/CD (GitHub Actions)

**Objectif**  
Automatiser le contrôle de qualité à chaque modification du dépôt Git.

**Description fonctionnelle**  
Lors d’un push ou d’une pull request, une pipeline exécute l’analyse statique du code (lint) et les tests unitaires. L’échec d’une étape signale un problème avant fusion.

**Approche de mise en œuvre**  
1. Fichier de workflow `.github/workflows/ci.yml`.  
2. Étapes : installation des dépendances, `npm run lint`, `npm test` (client et serveur).  
3. Affichage du statut sur GitHub (succès / échec).

**Technologies**  
GitHub Actions, ESLint (déjà configuré côté client : `npm run lint`).

**Précision — Lint**  
Le *linting* est une analyse automatique du code source visant à détecter des erreurs potentielles, des incohérences de style et certaines mauvaises pratiques, sans exécuter l’application dans un navigateur.

---

## Section F — Hébergement et déploiement

### 21. Déploiement du frontend

**Objectif**  
Rendre l’interface React accessible sur Internet via une URL stable.

**Description fonctionnelle**  
Le code source est compilé en assets statiques optimisés et servis par une plateforme d’hébergement web.

**Approche de mise en œuvre**  
1. Commande de build : `npm run build` (sortie `dist/`).  
2. Connexion du dépôt GitHub à Vercel ou Netlify.  
3. Configuration de l’URL de l’API backend en variable d’environnement de build.

**Technologies**  
Vite, Vercel ou Netlify.

---

### 22. Déploiement du backend

**Objectif**  
Exposer l’API Express de manière continue et accessible au frontend déployé.

**Description fonctionnelle**  
Le serveur Node.js tourne sur un hébergeur cloud ; le port et les variables d’environnement sont configurés selon la plateforme.

**Approche de mise en œuvre**  
1. Déploiement du répertoire `server/` sur Render ou Railway.  
2. Commande de démarrage : `node index.js` (ou script npm `start`).  
3. Configuration CORS pour autoriser uniquement l’origine du frontend en production.

**Technologies**  
Render, Railway, Node.js, Express.

---

### 23. Base de données hébergée à distance

**Objectif**  
Assurer la persistance des données en environnement de production, indépendamment de la machine de développement.

**Description fonctionnelle**  
Instance de base de données managée, connectée au backend via une chaîne de connexion sécurisée.

**Approche de mise en œuvre**  
1. Création d’une instance (MongoDB Atlas, Supabase, Neon, etc.).  
2. Injection de `DATABASE_URL` dans les variables d’environnement du backend.  
3. Exécution des migrations ou scripts d’initialisation avant mise en service.

**Technologies**  
MongoDB Atlas, Supabase (PostgreSQL), ou équivalent.

---

### 24. Variables d’environnement

**Objectif**  
Séparer les secrets et la configuration déployée du code source versionné.

**Description fonctionnelle**  
Les paramètres sensibles (clés API, secret JWT, URL de base de données) ne figurent pas dans le dépôt public ; ils sont définis sur chaque environnement (local, production).

**Approche de mise en œuvre**  
1. Fichier `.env` local listé dans `.gitignore`.  
2. Fichier `.env.example` documentant les clés requises sans valeurs réelles.  
3. Configuration identique sur les plateformes d’hébergement.

**Technologies**  
`dotenv` (Node.js), panneaux de configuration Vercel / Render.

---

### 25. Mise en place du HTTPS

**Objectif**  
Chiffrer les échanges entre le navigateur et les serveurs (protection des identifiants et des jetons).

**Description fonctionnelle**  
L’accès à l’application s’effectue via des URL en `https://` ; le navigateur affiche l’indicateur de connexion sécurisée.

**Approche de mise en œuvre**  
Les plateformes retenues (Vercel, Netlify, Render) provisionnent automatiquement des certificats TLS (Let’s Encrypt). Aucune implémentation manuelle n’est requise en conditions normales.

**Technologies**  
TLS fourni par l’hébergeur.

---

### 26. Application accessible via une URL publique

**Objectif**  
Permettre la démonstration et l’évaluation du projet par le professeur et les utilisateurs sans installation locale.

**Description fonctionnelle**  
L’application est joignable par une adresse web permanente (sous-domaine fourni par l’hébergeur ou nom de domaine personnalisé).

**Approche de mise en œuvre**  
1. URL par défaut fournie par Vercel et Render après déploiement.  
2. Option : achat d’un nom de domaine et configuration DNS (enregistrement CNAME vers l’hébergeur).

**Technologies**  
DNS du registrar, tableaux de bord Vercel/Render.

---

## Synthèse des dépendances entre fonctionnalités

```
Base de données (6)
    └── Authentification (1–5, 3)
            └── Données utilisateur (7–11)
                    └── Espace personnel (12–13)
                            └── Quiz (14) + Traduction (15–18)
                                    └── Tests (19) + CI/CD (20)
                                            └── Déploiement (21–26)
```

---

## Conclusion

Ce guide technique complète le plan de continuation en précisant, pour chacune des vingt-six fonctionnalités retenues, les objectifs, les modalités de réalisation et l’écosystème technologique associé. Il constitue une base de travail pour le rapport de projet, la supervision pédagogique et l’ordonnancement des livrables.

---

*Document technique — StoryTranslatorWeb — Session été 2026*

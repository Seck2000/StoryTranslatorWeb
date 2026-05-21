# StoryTranslatorWeb – Plan de continuation (périmètre validé)

**Cours :** Projet de fin d’études en informatique (INF39615-7T)  
**Session :** Été 2026  
**Étudiante :** Aissatou Seck  

---

## 1. Contexte (état actuel)

Application **web** (React + serveur Node/Express) : lecture d’histoires multilingues (fr, en, ar), synthèse vocale, import ZIP, progression en `localStorage`.

---

## 3. Liste des fonctionnalités à réaliser

### A. Comptes et données

1. Inscription utilisateur  
2. Connexion / déconnexion  
3. Sessions sécurisées côté serveur  
4. Mot de passe sécurisé (hachage, bonnes pratiques)  
5. Réinitialisation du mot de passe  
6. Base de données (utilisateurs, histoires, métadonnées, liens vers les fichiers)  
7. Progression de lecture sauvegardée en ligne (par utilisateur et par histoire)  
8. Favoris  
9. Historique de lecture  
10. Histoires récemment lues  
11. Préférences utilisateur (ex. langue par défaut)  

### B. Espace personnel

12. Tableau de bord / espace personnel utilisateur  
13. Profil utilisateur avec photo de profil (affichage, modification, upload)  

### C. Quiz

14. Quiz interactif à la fin d’une histoire (questions liées au contenu lu)  

### D. Langues et traduction

15. Contenu source en français uniquement : les histoires (scènes, quiz, etc.) sont rédigées et stockées en français.  
16. Traduction via API : appel côté serveur à un service de traduction pour afficher le texte dans d’autres langues à la demande (sans maintenir manuellement chaque langue dans les fichiers `story.json`).  
17. Choix de la langue cible par l’utilisateur dans l’interface (liste des langues supportées par l’API).  
18. Gestion du cache ou de la persistance des traductions (optionnel, pour limiter les appels API et améliorer les performances).  

### E. Qualité du code

19. Tests unitaires (logique métier, routes API critiques, composants clés).  
20. Pipeline CI/CD (ex. GitHub Actions) : exécution automatique des tests et du lint à chaque push / pull request, pour garder un code propre et suivre les versions du dépôt.  

### F. Hébergement et déploiement

21. Déploiement du **frontend** (application React) sur une plateforme d’hébergement web.  
22. Déploiement du **backend** (API Node/Express) sur un service d’hébergement adapté.  
23. Base de données **hébergée à distance** (liée au backend en production).  
24. Configuration des **variables d’environnement** (URL de l’API, clés de traduction, secrets d’authentification).  
25. Mise en place du **HTTPS** pour sécuriser l’accès à l’application.  
26. Application accessible en ligne via une **URL publique** (nom de domaine si applicable).  

**Technologies envisagées :** Vercel ou Netlify (frontend), Render ou Railway (backend), MongoDB Atlas ou PostgreSQL hébergé (base de données).

---

## 5. Ordre de réalisation suggéré

1. Base de données + modèles (utilisateur, progression, favoris, historique, préférences)  
2. Authentification (inscription, connexion, sessions, mots de passe, réinitialisation)  
3. Synchronisation progression / favoris / historique / récentes / préférences  
4. Espace personnel + photo de profil  
5. Module quiz en fin d’histoire  
6. **Hébergement et déploiement** (frontend, backend, base de données, HTTPS, URL publique)  

---

## 6. Conclusion

La continuité du projet vise une plateforme web personnalisée : chaque utilisateur dispose d’un compte, de données persistées en base, d’un espace personnel avec photo de profil, et d’un **quiz** pour renforcer l’apprentissage après la lecture.

L’application sera également **déployée en ligne** afin d’être accessible publiquement, avec un hébergement sécurisé du frontend, du backend et de la base de données.

---

**Annexe technique :** voir `GUIDE_TECHNIQUE_FONCTIONNALITES.md` pour le détail de mise en œuvre, les approches et les technologies associées à chaque fonctionnalité.

*Document de travail – à transmettre au professeur superviseur.*

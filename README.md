# StoryTranslator

Application web d'apprentissage des langues pour enfants, par la lecture d'histoires illustrées.

**Dépôt :** [https://github.com/Seck2000/StoryTranslatorWeb](https://github.com/Seck2000/StoryTranslatorWeb)

## Fonctionnalités

- Lecture d'histoires multilingues (FR, EN, AR, ES, DE, IT, PT)
- Synthèse vocale du navigateur
- Comptes utilisateurs (JWT + bcrypt) et rôles `user` / `admin`
- Persistance PostgreSQL (profil, favoris, progression, historique)
- Interface selon la langue maternelle
- Quiz de fin d'histoire avec Gemini
- Mode oral avec transcription Whisper (OpenAI)
- Import d'histoires en ZIP (espace admin)
- Tests unitaires (Vitest) + CI GitHub Actions

## Prérequis

- Node.js 22+
- PostgreSQL
- Clés API : Gemini et OpenAI (Whisper)

## Installation

### 1. Base de données

Créer une base PostgreSQL, puis configurer `server/.env` à partir de `server/.env.example` :

```env
DATABASE_URL="postgresql://postgres:MOT_DE_PASSE@localhost:5432/StoryTranslatorDB"
PORT=3000
JWT_SECRET="une-longue-chaine-secrete"
GEMINI_API_KEY="votre-cle"
GEMINI_CHAT_MODEL="gemini-2.5-flash"
OPENAI_API_KEY="votre-cle-openai"
WHISPER_MODEL="whisper-1"
```

Puis, dans `server/` :

```bash
npx prisma migrate deploy
# ou : npx prisma db push
```

### 2. Serveur

```bash
cd server
npm install
node index.js
```

API : `http://localhost:3000`

### 3. Client

```bash
cd client
npm install
npm run dev
```

Interface : `http://localhost:5173` (ou le port indiqué par Vite)

## Tests

À la racine du projet :

```bash
npm install
npm test
```

## Intégration continue (CI)

Le workflow GitHub Actions (`.github/workflows/tests.yml`) lance automatiquement les tests Vitest à chaque `push` ou `pull request`.  
Il n'y a pas de déploiement automatique (pas de CD).

## Structure

```
StoryTranslatorWeb/
  client/          # React + Vite
  server/          # Express + Prisma
  tests/           # Tests unitaires
  rapport/         # Rapport LaTeX (PFE)
  .github/         # CI GitHub Actions
```



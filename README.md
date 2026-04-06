# StoryTranslator Web

Application web interactive de lecture et de traduction d'histoires illustrées pour enfants. Le site permet de lire des histoires scène par scène avec des images, du texte traduit en plusieurs langues (français, anglais, arabe) et une lecture audio par synthèse vocale.

## Fonctionnalités

- Lecture d'histoires illustrées scène par scène
- Traduction en 3 langues : Français, Anglais, Arabe
- Synthèse vocale (Text-to-Speech) intégrée au navigateur
- Affichage de droite à gauche (RTL) pour l'arabe
- Possibilité de masquer/afficher le texte
- Barre de progression des scènes
- Importation de nouvelles histoires via fichier ZIP
- Validation automatique des fichiers importés
- Lecture aléatoire d'une histoire
- Sauvegarde de la progression (reprise de lecture)
- Design responsive (mobile et desktop)

## Technologies utilisées

### Frontend (client)
- **React.js** — Bibliothèque pour construire l'interface utilisateur
- **Vite** — Outil de développement rapide pour React
- **Tailwind CSS** — Framework CSS pour le style
- **Axios** — Communication HTTP avec le serveur
- **Lucide React** — Icônes vectorielles
- **Web Speech API** — Synthèse vocale native du navigateur

### Backend (serveur)
- **Node.js** — Environnement d'exécution JavaScript côté serveur
- **Express** — Framework pour créer les routes API
- **Multer** — Gestion de l'upload de fichiers
- **Unzipper** — Extraction des fichiers ZIP

## Structure du projet

```
StoryTranslatorWeb/
├── client/                  # Application React (Frontend)
│   ├── src/
│   │   ├── App.jsx          # Composant principal de l'application
│   │   ├── main.jsx         # Point d'entrée React
│   │   └── index.css        # Styles globaux (Tailwind)
│   ├── index.html           # Page HTML de base
│   ├── vite.config.js       # Configuration de Vite
│   ├── tailwind.config.js   # Configuration de Tailwind CSS
│   └── package.json         # Dépendances du frontend
│
├── server/                  # Serveur Node.js (Backend)
│   ├── index.js             # Point d'entrée du serveur (routes API)
│   ├── uploads/             # Histoires importées par l'utilisateur
│   ├── histoire_lina/       # Histoire pré-installée : Une journée au parc
│   ├── histoire_mer/        # Histoire pré-installée : Une aventure sous la mer
│   ├── histoire_sami/       # Histoire pré-installée : L'anniversaire surprise
│   └── package.json         # Dépendances du backend
│
├── rapport.tex              # Rapport de projet (LaTeX)
└── README.md
```

## Prérequis

- [Node.js](https://nodejs.org/) (version 18 ou supérieure)
- Un navigateur web moderne (Chrome, Firefox, Edge)

## Installation et lancement

### 1. Cloner le projet

```bash
git clone https://github.com/Seck2000/StoryTranslatorWeb.git
cd StoryTranslatorWeb
```

### 2. Installer les dépendances du serveur

```bash
cd server
npm install
```

### 3. Lancer le serveur

```bash
node index.js
```

Le serveur démarre sur `http://localhost:3000`.

### 4. Installer les dépendances du client (dans un nouveau terminal)

```bash
cd client
npm install
```

### 5. Lancer le client

```bash
npm run dev
```

Le client démarre sur `http://localhost:5173` (ou un port similaire affiché dans le terminal).

### 6. Ouvrir le site

Ouvrir le navigateur à l'adresse affichée par Vite (ex: `http://localhost:5173`).

## Format des histoires (story.json)

Chaque histoire est un dossier contenant un fichier `story.json` et un dossier `images/`. Le fichier JSON suit ce format :

```json
{
  "title": "Titre de l'histoire",
  "thumbnail": "images/scene1.png",
  "scenes": [
    {
      "image": "images/scene1.png",
      "character": {
        "name": "Nom du personnage",
        "avatar": "images/scene1.png"
      },
      "text": {
        "fr": "Texte en français",
        "en": "Text in English",
        "ar": "النص بالعربية"
      }
    }
  ]
}
```

Pour importer une nouvelle histoire, compressez le dossier en `.zip` et utilisez le bouton d'import sur le site.

## Auteure

**Aissatou Seck** — Projet en informatique II (INF34615-7T), UQAR

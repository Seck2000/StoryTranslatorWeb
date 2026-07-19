# Rapport LaTeX — StoryTranslator (INF39615)

## Solution la plus simple (recommandée sur Overleaf)

Utilise **un seul fichier** : `StoryTranslator_Rapport_Overleaf.tex`

1. Sur Overleaf : **Nouveau projet > Projet vide**
2. Supprime le `main.tex` par défaut (ou vide-le)
3. Uploade **uniquement** `StoryTranslator_Rapport_Overleaf.tex`
4. Menu Overleaf (en haut à gauche) > **Document principal** > choisis ce fichier
5. Compilateur : **PdfLaTeX** > Recompiler

Ne mets **pas** le contenu de ce fichier dans `titlepage.tex` ni dans `includes.tex`.

## Si tu utilises 3 fichiers (`main.tex` + `includes` + `titlepage`)

Sur Overleaf, chaque fichier doit contenir **exactement** :

| Fichier | Contenu attendu |
|---------|-----------------|
| `main.tex` | `\documentclass` + `\newcommand` auteurs + `\input{includes}` + corps |
| `includes.tex` | seulement les `\usepackage{...}` (pas de `\documentclass`) |
| `titlepage.tex` | seulement `\begin{titlepage}...\end{titlepage}` (pas de `\documentclass`) |

Document principal = `main.tex`.

### Erreurs typiques

- `Can be used only in preamble` + `\documentclass` dans `titlepage.tex`  
  → tu as collé tout le rapport dans `titlepage.tex`. Remplace-le par le petit `titlepage.tex` du dépôt.

- `Command \reporttitle already defined` / `TeX capacity exceeded`  
  → boucle d'includes (fichiers mélangés). Utilise plutôt le fichier unique.

## Fichiers du dossier

| Fichier | Rôle |
|---------|------|
| `StoryTranslator_Rapport_Overleaf.tex` | **Tout-en-un** pour Overleaf |
| `main.tex` | Document principal (version multi-fichiers) |
| `includes.tex` | Packages |
| `titlepage.tex` | Page de titre seule |

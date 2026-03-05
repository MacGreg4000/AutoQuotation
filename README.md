# MétréPlan

Application web de métré sur plans PDF — mesurez des longueurs, surfaces, compteurs et toitures directement sur vos plans numériques, organisez-les en postes de devis et exportez en PDF ou Excel.

---

## Fonctionnalités

- **Chargement de plans PDF** multi-pages avec navigation par page
- **Calibration de l'échelle** : tracer un segment sur une cote connue pour calibrer automatiquement
- **4 types de mesures** :
  - Longueur (tracé de polyligne)
  - Surface (polygone fermé)
  - Compteur (points cliquables nommés)
  - Toiture (surface × facteur de pente)
- **Bordereau de métrés** : regroupez les mesures dans des postes nommés et colorés ; totaux calculés automatiquement
- **Export PDF** : rapport complet avec en-tête, bordereau, résumé exécutif et détail des mesures
- **Export Excel** : fichier `.xlsx` multi-onglets (Bordereau, Résumé, toutes mesures, une feuille par page)
- **Sauvegarde / Chargement** : format `.mplan` (JSON) — aucun serveur requis, tout reste local
- **Historique annuler / refaire** (Ctrl+Z / Ctrl+Y), jusqu'à 50 états
- Zoom, déplacement et sélection des mesures sur le canevas

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| [Node.js](https://nodejs.org/) | 18.x ou supérieur |
| npm | 9.x ou supérieur (inclus avec Node.js) |
| Navigateur moderne | Chrome, Firefox, Edge, Safari (récent) |

> **Note** : Aucune base de données, aucun serveur back-end. L'application fonctionne entièrement dans le navigateur.

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/MacGreg4000/AutoQuotation.git
cd AutoQuotation
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Lancer en mode développement

```bash
npm run dev
```

L'application est accessible sur **http://localhost:5173** (ou le port indiqué dans le terminal).

---

## Build de production

```bash
npm run build
```

Les fichiers compilés se trouvent dans le dossier `dist/`. Déployez ce dossier sur n'importe quel hébergeur de fichiers statiques (Netlify, Vercel, GitHub Pages, nginx, Apache…).

### Prévisualiser le build localement

```bash
npm run preview
```

---

## Utilisation rapide

### Ouvrir un plan
1. Cliquez sur **Ouvrir un PDF** dans la barre supérieure (ou glissez-déposez un fichier PDF).
2. Naviguez entre les pages avec les flèches ◀ ▶.

### Calibrer l'échelle
1. Appuyez sur **C** (ou cliquez sur l'outil Calibration 🎯 dans la barre de gauche).
2. Tracez un segment sur une dimension connue du plan.
3. Entrez la valeur réelle et l'unité dans la boîte de dialogue.
4. La calibration est sauvegardée dans le projet.

### Prendre des mesures
| Outil | Raccourci | Usage |
|-------|-----------|-------|
| Sélection | S | Sélectionner / déplacer |
| Navigation | Espace | Panoramique (glisser) |
| Longueur | 1 | Cliquer les points, double-clic pour terminer |
| Surface | 2 | Cliquer les sommets, double-clic pour fermer |
| Compteur | 3 | Cliquer pour chaque élément à compter |
| Toiture | 4 | Comme Surface, avec facteur de pente |

### Créer un bordereau de métrés
1. Ouvrez l'onglet **Métré** dans le panneau de droite.
2. Cliquez **+ Nouveau poste** et nommez-le (ex. : « Sol carrelage 60×60 »).
3. Cliquez sur le poste pour l'activer (point bleu dans la barre d'outils).
4. Prenez vos mesures sur le plan — elles s'accumulent automatiquement dans ce poste.
5. Désactivez le poste avec le bouton **×** dans la barre d'outils.

### Exporter
- **PDF** : bouton **Exporter PDF** dans la barre supérieure
- **Excel** : bouton **Exporter XLS** dans la barre supérieure

### Sauvegarder / Charger un projet
- **Sauvegarder** : bouton 💾 → fichier `.mplan` (JSON) téléchargé localement
- **Charger** : bouton 📂 → sélectionnez un fichier `.mplan`

> Le fichier `.mplan` ne contient **pas** le PDF — celui-ci doit être rechargé séparément.

---

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `S` | Outil Sélection |
| `Espace` | Outil Navigation (panoramique) |
| `C` | Outil Calibration |
| `1` | Outil Longueur |
| `2` | Outil Surface |
| `3` | Outil Compteur |
| `4` | Outil Toiture |
| `Entrée` / Double-clic | Valider la mesure en cours |
| `Échap` | Annuler la mesure en cours |
| `Suppr` | Supprimer la mesure sélectionnée |
| `Ctrl+Z` | Annuler |
| `Ctrl+Y` | Refaire |
| Molette souris | Zoom centré sur le curseur |

---

## Architecture technique

```
src/
├── components/
│   ├── Canvas/
│   │   ├── CanvasArea.tsx      # Canevas principal (Konva), gestion des outils et mesures
│   │   └── PdfRenderer.tsx     # Rendu PDF.js → canvas HTML
│   ├── RightPanel/
│   │   └── RightPanel.tsx      # Panneau droit : onglets Mesures et Métré
│   └── Toolbar/
│       └── Toolbar.tsx         # Barre d'outils gauche
├── lib/
│   ├── exportPdf.ts            # Génération rapport PDF (jsPDF)
│   └── exportExcel.ts          # Génération fichier Excel (SheetJS)
├── store/
│   ├── useProjectStore.ts      # État projet (mesures, postes, calibration, historique)
│   ├── useToolStore.ts         # État outil actif, couleur, unité, pente
│   └── usePdfStore.ts          # État PDF (document, page, zoom)
├── types/
│   └── index.ts                # Interfaces TypeScript (Project, Measurement, Poste…)
└── App.tsx                     # Composition principale, barre supérieure
```

---

## Stack technique

| Librairie | Rôle |
|-----------|------|
| React 19 + TypeScript | UI et typage |
| Vite 7 | Bundler / serveur de développement |
| Konva / react-konva | Canevas 2D interactif |
| PDF.js (pdfjs-dist) | Rendu de fichiers PDF |
| Zustand | Gestion d'état globale |
| Tailwind CSS v4 | Styles utilitaires |
| jsPDF | Export PDF |
| SheetJS (xlsx) | Export Excel |
| Lucide React | Icônes |

---

## Format de fichier `.mplan`

```json
{
  "id": "abc123",
  "name": "Nom du projet",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "calibration": {
    "pixelDistance": 245.3,
    "realValue": 365,
    "unit": "cm",
    "ratio": 0.00136
  },
  "measurements": [
    {
      "id": "m1",
      "name": "Longueur mur Nord",
      "type": "length",
      "page": 1,
      "points": [{"x": 100, "y": 200}, {"x": 350, "y": 200}],
      "value": 365.0,
      "unit": "cm",
      "color": "#3b82f6",
      "visible": true,
      "posteId": "p1"
    }
  ],
  "postes": [
    {
      "id": "p1",
      "name": "Peinture murs",
      "color": "#3b82f6"
    }
  ]
}
```

---

## Confidentialité

Toutes les données restent **100 % locales** dans votre navigateur. Aucune donnée n'est envoyée vers un serveur. Les fichiers PDF et les projets `.mplan` ne quittent jamais votre machine.

---

## Licence

Projet privé — tous droits réservés.

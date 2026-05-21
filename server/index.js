// ==========================================
// IMPORTATION DES MODULES
// ==========================================
require('dotenv').config();

const express = require('express'); // Le framework principal pour créer le serveur web
const { pool } = require('./db');
const cors = require('cors'); // Autorise la communication entre notre client React et ce serveur
const multer = require('multer'); // Outil pour gérer l'upload de fichiers (comme nos .zip)
const path = require('path'); // Outil pour manipuler les chemins de dossiers facilement
const fs = require('fs'); // "File System", pour lire, créer ou supprimer des fichiers
const unzipper = require('unzipper'); // Module pour extraire le contenu des fichiers .zip

// Initialisation de l'application
const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURATION (Middlewares)
// ==========================================
app.use(cors()); // Accepte les requêtes venant d'autres ports (ex: notre React sur 5174)
app.use(express.json()); // Permet au serveur de comprendre les données JSON

// On rend le dossier 'uploads' accessible publiquement
// Si on va sur http://localhost:3000/uploads/image.png, le serveur affichera l'image.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuration de Multer : stockage temporaire des fichiers dans 'temp_uploads'
const upload = multer({ dest: 'temp_uploads/' });

// Sécurité : On s'assure que le dossier 'uploads' existe au démarrage
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

// ==========================================
// ROUTES (Les portes d'entrée de notre serveur)
// ==========================================

// 0. Vérification de la connexion à PostgreSQL
app.get('/api/health/db', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ ok: true, database: 'connected' });
    } catch (error) {
        console.error('Erreur connexion base de données:', error);
        res.status(500).json({ ok: false, database: 'error', message: error.message });
    }
});

// 1. ROUTE POUR RÉCUPÉRER LA LISTE DES HISTOIRES (GET)
app.get('/api/stories', (req, res) => {
    // fs.readdir lit le contenu du dossier UPLOADS_DIR
    fs.readdir(UPLOADS_DIR, { withFileTypes: true }, (err, entries) => {
        if (err) {
            // Si erreur de lecture, on renvoie une erreur au client
            return res.status(500).json({ error: 'Impossible de lire le dossier des histoires' });
        }
        
        // On ne garde que les dossiers (chaque dossier représente une histoire)
        const storyFolders = entries.filter(dirent => dirent.isDirectory());
        
        // On parcourt chaque dossier pour lire son fichier story.json
        const storyList = storyFolders.map(folder => {
            const storyPath = path.join(UPLOADS_DIR, folder.name);
            let metadata = { id: folder.name, title: folder.name, thumbnail: null }; // Valeurs par défaut
            
            let jsonPath = path.join(storyPath, 'story.json');
            let rootDir = ''; // Sert à mémoriser si le json est dans un sous-dossier
            
            // Si story.json n'est pas à la racine, on regarde dans le premier sous-dossier
            if (!fs.existsSync(jsonPath)) {
                const subDirs = fs.readdirSync(storyPath).filter(f => fs.statSync(path.join(storyPath, f)).isDirectory());
                if (subDirs.length > 0) {
                     jsonPath = path.join(storyPath, subDirs[0], 'story.json');
                     rootDir = subDirs[0] + '/'; 
                }
            }

            // Si on a bien trouvé un fichier story.json, on le lit
            if (fs.existsSync(jsonPath)) {
                try {
                    // On lit le fichier texte et on le transforme en objet JavaScript
                    const data = JSON.parse(fs.readFileSync(jsonPath));
                    const serverId = folder.name; 
                    
                    // On fusionne nos valeurs par défaut avec les données lues
                    metadata = { ...metadata, ...data, id: serverId }; 
                    
                    // On ajuste le chemin de l'image de couverture pour le web
                    if (metadata.thumbnail && !metadata.thumbnail.startsWith('http')) {
                         metadata.thumbnail = `http://localhost:${PORT}/uploads/${serverId}/${rootDir}${metadata.thumbnail}`;
                    }
                    
                    // On ajuste aussi les chemins de toutes les images des scènes et avatars
                    if (metadata.scenes) {
                        metadata.scenes = metadata.scenes.map(scene => ({
                            ...scene,
                            image: scene.image.startsWith('http') ? scene.image : `${rootDir}${scene.image}`,
                            character: {
                                ...scene.character,
                                avatar: scene.character.avatar.startsWith('http') ? scene.character.avatar : `${rootDir}${scene.character.avatar}`
                            }
                        }));
                    }
                } catch (e) {
                    console.error(`Erreur lecture story.json pour ${folder.name}`, e);
                }
            }
            return metadata; // On retourne l'histoire formatée
        });

        // On envoie la liste finale au client React
        res.json(storyList);
    });
});

// 2. ROUTE POUR IMPORTER UNE NOUVELLE HISTOIRE ZIP (POST)
app.post('/api/upload', upload.single('file'), async (req, res) => {
    // Si aucun fichier n'a été reçu, on bloque
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier envoyé' });
    }

    const tempPath = req.file.path; // Chemin temporaire du zip
    const storyId = `story_${Date.now()}`; // Création d'un nom de dossier unique avec la date
    const targetDir = path.join(UPLOADS_DIR, storyId); // Le dossier final

    try {
        // Étape 1 : Extraire le contenu du .zip dans le dossier final
        await fs.createReadStream(tempPath)
            .pipe(unzipper.Extract({ path: targetDir }))
            .promise();

        // Étape 2 : Supprimer le fichier .zip temporaire
        fs.unlinkSync(tempPath);

        // Étape 3 : Vérifier que le zip contenait bien un fichier story.json
        let jsonPath = path.join(targetDir, 'story.json');
        let isValid = fs.existsSync(jsonPath);

        // Recherche dans les sous-dossiers si non trouvé à la racine
        if (!isValid) {
            const subDirs = fs.readdirSync(targetDir).filter(f => fs.statSync(path.join(targetDir, f)).isDirectory());
            if (subDirs.length > 0) {
                jsonPath = path.join(targetDir, subDirs[0], 'story.json');
                isValid = fs.existsSync(jsonPath);
            }
        }

        // Si l'histoire n'est pas valide (pas de story.json)
        if (!isValid) {
            // On supprime le dossier invalide pour nettoyer le serveur
            fs.rmSync(targetDir, { recursive: true, force: true });
            return res.status(400).json({ error: "Ce fichier n'est pas une histoire valide. Le fichier story.json est manquant." });
        }
        
        // Tout est bon, on prévient le client
        res.json({ success: true, message: 'Histoire importée avec succès', id: storyId });
    } catch (error) {
        console.error("Erreur lors de l'extraction", error);
        res.status(500).json({ error: 'Erreur technique lors du traitement du fichier zip' });
    }
});

// ==========================================
// DÉMARRAGE DU SERVEUR
// ==========================================
app.listen(PORT, () => {
    console.log(`Serveur backend démarré avec succès sur http://localhost:${PORT} !`);
});

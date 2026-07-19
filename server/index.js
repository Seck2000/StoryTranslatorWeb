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
const authRoutes = require('./routes/auth');
const libraryRoutes = require('./routes/library');
const aiRoutes = require('./routes/ai');
const speechRoutes = require('./routes/speech');
const { authMiddleware, adminMiddleware } = require('./middleware/auth');
const { storyMatchesAgeBand } = require('./utils/ageBands');

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

// Authentification (inscription, connexion, profil)
app.use('/api/auth', authRoutes);

// Données personnelles de lecture (progression, favoris, historique)
app.use('/api/library', libraryRoutes);

// Discussion IA en fin d'histoire
app.use('/api/ai', aiRoutes);

// Transcription vocale (Whisper)
app.use('/api/speech', speechRoutes);

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
// Admin = toute la bibliothèque ; enfant = uniquement sa tranche d'âge
app.get('/api/stories', authMiddleware, async (req, res) => {
    fs.readdir(UPLOADS_DIR, { withFileTypes: true }, async (err, entries) => {
        if (err) {
            return res.status(500).json({ error: 'Impossible de lire le dossier des histoires' });
        }

        const storyFolders = entries.filter(dirent => dirent.isDirectory() && dirent.name !== 'avatars');

        const storyList = storyFolders.map(folder => {
            const storyPath = path.join(UPLOADS_DIR, folder.name);
            let metadata = { id: folder.name, title: folder.name, thumbnail: null };

            let jsonPath = path.join(storyPath, 'story.json');
            let rootDir = '';

            if (!fs.existsSync(jsonPath)) {
                const subDirs = fs.readdirSync(storyPath).filter(f => fs.statSync(path.join(storyPath, f)).isDirectory());
                if (subDirs.length > 0) {
                     jsonPath = path.join(storyPath, subDirs[0], 'story.json');
                     rootDir = subDirs[0] + '/';
                }
            }

            if (!fs.existsSync(jsonPath)) {
                return null;
            }

            try {
                const data = JSON.parse(fs.readFileSync(jsonPath));
                const serverId = folder.name;

                if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
                    return null;
                }

                metadata = { ...metadata, ...data, id: serverId };

                if (metadata.thumbnail && !metadata.thumbnail.startsWith('http')) {
                    metadata.thumbnail = `http://localhost:${PORT}/uploads/${serverId}/${rootDir}${metadata.thumbnail}`;
                }

                metadata.scenes = metadata.scenes.map(scene => ({
                    ...scene,
                    image: scene.image?.startsWith('http') ? scene.image : `${rootDir}${scene.image || ''}`,
                    character: {
                        ...scene.character,
                        avatar: scene.character?.avatar?.startsWith('http')
                            ? scene.character.avatar
                            : `${rootDir}${scene.character?.avatar || ''}`
                    }
                }));
            } catch (e) {
                console.error(`Erreur lecture story.json pour ${folder.name}`, e);
                return null;
            }
            return metadata;
        }).filter(Boolean);

        try {
            if (req.user.role === 'admin') {
                return res.json(storyList);
            }

            const userResult = await pool.query(
                `SELECT p."ageBand"
                 FROM "User" u
                 LEFT JOIN "UserPreference" p ON p."userId" = u.id
                 WHERE u.id = $1`,
                [req.user.id]
            );
            const bandId = userResult.rows[0]?.ageBand || null;

            if (!bandId) {
                return res.json([]);
            }

            const filtered = storyList.filter((story) => storyMatchesAgeBand(story, bandId));
            return res.json(filtered);
        } catch (filterError) {
            console.error('Erreur filtrage histoires:', filterError);
            return res.status(500).json({ error: 'Impossible de filtrer les histoires.' });
        }
    });
});

// 2. ROUTE POUR IMPORTER UNE NOUVELLE HISTOIRE ZIP (POST) — admin seulement
app.post('/api/upload', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier envoyé' });
    }

    const tempPath = req.file.path;
    const storyId = `story_${Date.now()}`;
    const targetDir = path.join(UPLOADS_DIR, storyId);

    try {
        await fs.createReadStream(tempPath)
            .pipe(unzipper.Extract({ path: targetDir }))
            .promise();

        fs.unlinkSync(tempPath);

        let jsonPath = path.join(targetDir, 'story.json');
        let isValid = fs.existsSync(jsonPath);

        if (!isValid) {
            const subDirs = fs.readdirSync(targetDir).filter(f => fs.statSync(path.join(targetDir, f)).isDirectory());
            if (subDirs.length > 0) {
                jsonPath = path.join(targetDir, subDirs[0], 'story.json');
                isValid = fs.existsSync(jsonPath);
            }
        }

        if (!isValid) {
            fs.rmSync(targetDir, { recursive: true, force: true });
            return res.status(400).json({ error: "Ce fichier n'est pas une histoire valide. Le fichier story.json est manquant." });
        }

        res.json({ success: true, message: 'Histoire importée avec succès', id: storyId });
    } catch (error) {
        console.error("Erreur lors de l'extraction", error);
        res.status(500).json({ error: 'Erreur technique lors du traitement du fichier zip' });
    }
});

// ==========================================
// DÉMARRAGE DU SERVEUR
// ==========================================
const server = app.listen(PORT, () => {
    console.log(`Serveur backend démarré avec succès sur http://localhost:${PORT} !`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(
            `Le port ${PORT} est déjà utilisé. Arrêtez l'autre processus Node, ou changez PORT dans .env.`
        );
        console.error(`Astuce Windows : netstat -ano | findstr :${PORT}`);
    } else {
        console.error('Erreur démarrage serveur:', err);
    }
    process.exit(1);
});

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const BCRYPT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

const ALLOWED_LANGS = ['fr', 'en', 'ar', 'es', 'de', 'it', 'pt'];
const ALLOWED_LEVELS = ['debutant', 'intermediaire', 'avance'];
const ALLOWED_AGE_BANDS = ['petits', 'moyens', 'grands'];
const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');

if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const avatarUpload = multer({
    storage: multer.diskStorage({
        destination: AVATAR_DIR,
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
            cb(null, `${req.user.id}-${Date.now()}${ext}`);
        },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Le fichier doit être une image.'));
        }
        cb(null, true);
    },
});

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function signToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );
}

function buildDisplayName(firstName, lastName) {
    const full = [firstName, lastName].filter(Boolean).join(' ').trim();
    return full || null;
}

function publicUser(row, preferences = null) {
    const firstName = row.firstName ?? null;
    const lastName = row.lastName ?? null;
    return {
        id: row.id,
        email: row.email,
        firstName,
        lastName,
        displayName: row.displayName || buildDisplayName(firstName, lastName),
        avatarUrl: row.avatarUrl ?? null,
        role: row.role || 'user',
        createdAt: row.createdAt,
        preferences: preferences
            ? {
                  spokenLang: preferences.spokenLang,
                  learningLang: preferences.learningLang,
                  level: preferences.level,
                  defaultLang: preferences.defaultLang,
                  ageBand: preferences.ageBand || 'moyens',
              }
            : undefined,
    };
}

async function fetchUserWithPreferences(userId) {
    const result = await pool.query(
        `SELECT u.id, u.email, u."firstName", u."lastName", u."displayName", u."avatarUrl", u.role, u."createdAt",
                p."spokenLang", p."learningLang", p.level, p."defaultLang", p."ageBand"
         FROM "User" u
         LEFT JOIN "UserPreference" p ON p."userId" = u.id
         WHERE u.id = $1`,
        [userId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    const preferences = row.spokenLang
        ? {
              spokenLang: row.spokenLang,
              learningLang: row.learningLang,
              level: row.level,
              defaultLang: row.defaultLang,
              ageBand: row.ageBand || 'moyens',
          }
        : null;
    return publicUser(row, preferences);
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const passwordConfirm = req.body.passwordConfirm;
    const firstName = req.body.firstName?.trim() || null;
    const lastName = req.body.lastName?.trim() || null;
    const spokenLang = req.body.spokenLang || 'fr';
    const learningLang = req.body.learningLang || 'en';
    const level = req.body.level || 'debutant';
    const ageBand = req.body.ageBand || 'moyens';

    if (!firstName || !lastName) {
        return res.status(400).json({ error: 'Le prénom et le nom sont obligatoires.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Adresse courriel invalide.' });
    }
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }
    if (password !== passwordConfirm) {
        return res.status(400).json({ error: 'Les mots de passe ne correspondent pas.' });
    }
    if (!ALLOWED_LANGS.includes(spokenLang) || !ALLOWED_LANGS.includes(learningLang)) {
        return res.status(400).json({ error: 'Langue invalide.' });
    }
    if (spokenLang === learningLang) {
        return res.status(400).json({
            error: 'La langue cible doit être différente de la langue maternelle.',
        });
    }
    if (!ALLOWED_LEVELS.includes(level)) {
        return res.status(400).json({ error: 'Niveau invalide.' });
    }
    if (!ALLOWED_AGE_BANDS.includes(ageBand)) {
        return res.status(400).json({ error: 'Tranche d’âge invalide.' });
    }
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ error: 'Configuration serveur incomplète (JWT_SECRET).' });
    }

    const displayName = buildDisplayName(firstName, lastName);
    const client = await pool.connect();

    try {
        const existing = await client.query('SELECT id FROM "User" WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse courriel.' });
        }

        const id = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const now = new Date();

        await client.query(
            `INSERT INTO "User" (id, email, "passwordHash", "firstName", "lastName", "displayName", role, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
            [id, email, passwordHash, firstName, lastName, displayName, 'user', now]
        );

        const prefId = crypto.randomUUID();
        await client.query(
            `INSERT INTO "UserPreference" (id, "userId", "defaultLang", "spokenLang", "learningLang", level, "ageBand")
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [prefId, id, learningLang, spokenLang, learningLang, level, ageBand]
        );

        const user = await fetchUserWithPreferences(id);
        const token = signToken({ id, email });

        res.status(201).json({
            message: 'Compte créé avec succès.',
            token,
            user,
        });
    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({ error: 'Erreur lors de la création du compte.' });
    } finally {
        client.release();
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!isValidEmail(email) || !password) {
        return res.status(400).json({ error: 'Courriel ou mot de passe incorrect.' });
    }
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ error: 'Configuration serveur incomplète (JWT_SECRET).' });
    }

    try {
        const result = await pool.query(
            `SELECT id, "passwordHash" FROM "User" WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Courriel ou mot de passe incorrect.' });
        }

        const row = result.rows[0];
        const match = await bcrypt.compare(password, row.passwordHash);
        if (!match) {
            return res.status(401).json({ error: 'Courriel ou mot de passe incorrect.' });
        }

        const user = await fetchUserWithPreferences(row.id);
        const token = signToken(user);

        res.json({
            message: 'Connexion réussie.',
            token,
            user,
        });
    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion.' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await fetchUserWithPreferences(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur introuvable.' });
        }
        res.json({ user });
    } catch (error) {
        console.error('Erreur profil:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
    }
});

// PATCH /api/auth/me
router.patch('/me', authMiddleware, async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const firstName = req.body.firstName?.trim() || null;
    const lastName = req.body.lastName?.trim() || null;
    const spokenLang = req.body.spokenLang || 'fr';
    const learningLang = req.body.learningLang || 'en';
    const level = req.body.level || 'debutant';
    const ageBand = req.body.ageBand || 'moyens';
    const isAdmin = req.user.role === 'admin';

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Adresse courriel invalide.' });
    }
    if (!firstName || !lastName) {
        return res.status(400).json({ error: 'Le prénom et le nom sont obligatoires.' });
    }
    if (!ALLOWED_LANGS.includes(spokenLang) || !ALLOWED_LANGS.includes(learningLang)) {
        return res.status(400).json({ error: 'Langue invalide.' });
    }
    if (spokenLang === learningLang) {
        return res.status(400).json({
            error: 'La langue cible doit être différente de la langue maternelle.',
        });
    }
    if (!ALLOWED_LEVELS.includes(level)) {
        return res.status(400).json({ error: 'Niveau invalide.' });
    }
    if (!isAdmin && !ALLOWED_AGE_BANDS.includes(ageBand)) {
        return res.status(400).json({ error: 'Tranche d’âge invalide.' });
    }

    const client = await pool.connect();
    let committed = false;
    try {
        await client.query('BEGIN');

        const duplicate = await client.query(
            `SELECT id FROM "User" WHERE email = $1 AND id <> $2`,
            [email, req.user.id]
        );
        if (duplicate.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Cette adresse courriel est déjà utilisée.' });
        }

        const displayName = buildDisplayName(firstName, lastName);
        await client.query(
            `UPDATE "User"
             SET email = $1, "firstName" = $2, "lastName" = $3, "displayName" = $4, "updatedAt" = NOW()
             WHERE id = $5`,
            [email, firstName, lastName, displayName, req.user.id]
        );

        const resolvedAgeBand = ALLOWED_AGE_BANDS.includes(ageBand) ? ageBand : 'moyens';
        await client.query(
            `INSERT INTO "UserPreference" (id, "userId", "defaultLang", "spokenLang", "learningLang", level, "ageBand")
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT ("userId")
             DO UPDATE SET "defaultLang" = EXCLUDED."defaultLang",
                           "spokenLang" = EXCLUDED."spokenLang",
                           "learningLang" = EXCLUDED."learningLang",
                           level = EXCLUDED.level,
                           "ageBand" = EXCLUDED."ageBand"`,
            [
                crypto.randomUUID(),
                req.user.id,
                learningLang,
                spokenLang,
                learningLang,
                level,
                resolvedAgeBand,
            ]
        );

        await client.query('COMMIT');
        committed = true;

        const user = await fetchUserWithPreferences(req.user.id);
        if (!user) {
            return res.status(500).json({
                error: 'Profil enregistré, mais relecture impossible. Recharge la page.',
            });
        }
        res.json({ user });
    } catch (error) {
        if (!committed) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Erreur rollback profil:', rollbackError);
            }
        }
        console.error('Erreur modification profil:', error);
        res.status(500).json({
            error: 'Erreur lors de la modification du profil.',
            detail: error.message,
        });
    } finally {
        client.release();
    }
});

// POST /api/auth/me/avatar
router.post('/me/avatar', authMiddleware, (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'La photo doit faire moins de 2 Mo.' });
            }
            return res.status(400).json({ error: 'Envoi de la photo impossible.' });
        }
        return res.status(400).json({ error: err.message || 'Fichier image invalide.' });
    });
}, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucune photo envoyée.' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    try {
        await pool.query(
            `UPDATE "User"
             SET "avatarUrl" = $1, "updatedAt" = NOW()
             WHERE id = $2`,
            [avatarUrl, req.user.id]
        );

        const user = await fetchUserWithPreferences(req.user.id);
        if (!user) {
            return res.status(500).json({
                error: 'Photo enregistrée, mais relecture impossible. Recharge la page.',
            });
        }
        res.json({ user });
    } catch (error) {
        console.error('Erreur upload avatar:', error);
        res.status(500).json({ error: "Erreur lors de l'enregistrement de la photo." });
    }
});

module.exports = router;

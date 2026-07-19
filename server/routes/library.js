const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// GET /api/library/progress — toutes les progressions de l'utilisateur
router.get('/progress', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT "storyId", "sceneIndex", "updatedAt"
             FROM "ReadingProgress"
             WHERE "userId" = $1
             ORDER BY "updatedAt" DESC`,
            [req.user.id]
        );

        res.json({ progress: result.rows });
    } catch (error) {
        console.error('Erreur liste progressions:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des progressions.' });
    }
});

// GET /api/library/progress/:storyId
router.get('/progress/:storyId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT "storyId", "sceneIndex", "updatedAt"
             FROM "ReadingProgress"
             WHERE "userId" = $1 AND "storyId" = $2`,
            [req.user.id, req.params.storyId]
        );

        res.json({ progress: result.rows[0] || null });
    } catch (error) {
        console.error('Erreur récupération progression:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de la progression.' });
    }
});

// PUT /api/library/progress/:storyId
router.put('/progress/:storyId', async (req, res) => {
    const sceneIndex = Number(req.body.sceneIndex);
    if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
        return res.status(400).json({ error: 'Indice de scène invalide.' });
    }

    try {
        const id = crypto.randomUUID();
        const result = await pool.query(
            `INSERT INTO "ReadingProgress" (id, "userId", "storyId", "sceneIndex", "updatedAt")
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT ("userId", "storyId")
             DO UPDATE SET "sceneIndex" = EXCLUDED."sceneIndex", "updatedAt" = NOW()
             RETURNING "storyId", "sceneIndex", "updatedAt"`,
            [id, req.user.id, req.params.storyId, sceneIndex]
        );

        res.json({ progress: result.rows[0] });
    } catch (error) {
        console.error('Erreur sauvegarde progression:', error);
        res.status(500).json({ error: 'Erreur lors de la sauvegarde de la progression.' });
    }
});

// POST /api/library/history
router.post('/history', async (req, res) => {
    const { storyId, eventType = 'started' } = req.body;
    if (!storyId || !['started', 'completed'].includes(eventType)) {
        return res.status(400).json({ error: 'Historique invalide.' });
    }

    try {
        const id = crypto.randomUUID();
        const result = await pool.query(
            `INSERT INTO "ReadingHistory" (id, "userId", "storyId", "eventType", "createdAt")
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING "storyId", "eventType", "createdAt"`,
            [id, req.user.id, storyId, eventType]
        );

        res.status(201).json({ history: result.rows[0] });
    } catch (error) {
        console.error('Erreur historique:', error);
        res.status(500).json({ error: "Erreur lors de l'enregistrement de l'historique." });
    }
});

// GET /api/library/history/recent
router.get('/history/recent', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT "storyId", MAX("createdAt") AS "lastReadAt"
             FROM "ReadingHistory"
             WHERE "userId" = $1
             GROUP BY "storyId"
             ORDER BY "lastReadAt" DESC
             LIMIT 6`,
            [req.user.id]
        );

        res.json({ recent: result.rows });
    } catch (error) {
        console.error('Erreur histoires récentes:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des histoires récentes.' });
    }
});

// GET /api/library/favorites
router.get('/favorites', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT "storyId", "createdAt"
             FROM "Favorite"
             WHERE "userId" = $1
             ORDER BY "createdAt" DESC`,
            [req.user.id]
        );

        res.json({ favorites: result.rows });
    } catch (error) {
        console.error('Erreur favoris:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des favoris.' });
    }
});

// POST /api/library/favorites
router.post('/favorites', async (req, res) => {
    const { storyId } = req.body;
    if (!storyId) {
        return res.status(400).json({ error: 'Histoire invalide.' });
    }

    try {
        const id = crypto.randomUUID();
        const result = await pool.query(
            `INSERT INTO "Favorite" (id, "userId", "storyId", "createdAt")
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT ("userId", "storyId")
             DO UPDATE SET "createdAt" = "Favorite"."createdAt"
             RETURNING "storyId", "createdAt"`,
            [id, req.user.id, storyId]
        );

        res.status(201).json({ favorite: result.rows[0] });
    } catch (error) {
        console.error('Erreur ajout favori:', error);
        res.status(500).json({ error: "Erreur lors de l'ajout du favori." });
    }
});

// DELETE /api/library/favorites/:storyId
router.delete('/favorites/:storyId', async (req, res) => {
    try {
        await pool.query(
            `DELETE FROM "Favorite"
             WHERE "userId" = $1 AND "storyId" = $2`,
            [req.user.id, req.params.storyId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur suppression favori:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du favori.' });
    }
});

module.exports = router;

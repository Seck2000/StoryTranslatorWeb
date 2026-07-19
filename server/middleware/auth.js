const jwt = require('jsonwebtoken');
const { pool } = require('../db');

async function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentification requise.' });
    }

    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query(
            `SELECT id, email, role FROM "User" WHERE id = $1`,
            [payload.sub]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Session invalide ou expirée.' });
        }

        const row = result.rows[0];
        req.user = {
            id: row.id,
            email: row.email,
            role: row.role || 'user',
        };
        next();
    } catch {
        return res.status(401).json({ error: 'Session invalide ou expirée.' });
    }
}

function adminMiddleware(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });
    }
    next();
}

module.exports = { authMiddleware, adminMiddleware };

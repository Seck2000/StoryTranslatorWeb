require('dotenv').config();

const { Pool } = require('pg');

// Connexion PostgreSQL (compatible Windows ARM / Snapdragon).
// Les tables sont gérées par Prisma Migrate (prisma/migrations).
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
    console.error('Erreur pool PostgreSQL:', err);
});

module.exports = { pool };

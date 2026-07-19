require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user'`);
  console.log('Colonne role OK');

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@storytranslator.local').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

  const existing = await pool.query('SELECT id FROM "User" WHERE email = $1', [adminEmail]);

  if (existing.rows.length > 0) {
    await pool.query('UPDATE "User" SET role = $1, "updatedAt" = NOW() WHERE email = $2', [
      'admin',
      adminEmail,
    ]);
    console.log(`Compte existant promu admin: ${adminEmail}`);
  } else {
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const now = new Date();
    await pool.query(
      `INSERT INTO "User" (id, email, "passwordHash", "firstName", "lastName", "displayName", role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
      [id, adminEmail, passwordHash, 'Admin', 'Bibliothèque', 'Admin Bibliothèque', 'admin', now]
    );
    await pool.query(
      `INSERT INTO "UserPreference" (id, "userId", "defaultLang", "spokenLang", "learningLang", level)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), id, 'fr', 'fr', 'en', 'debutant']
    );
    console.log(`Admin créé: ${adminEmail} / ${adminPassword}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

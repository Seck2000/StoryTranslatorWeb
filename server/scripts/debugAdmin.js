require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const user = await pool.query(
    `SELECT id, email, role, "passwordHash" IS NOT NULL AS has_pw FROM "User" WHERE email = $1`,
    ['admin@storytranslator.local']
  );
  console.log('USER ROW:', user.rows[0]);

  const full = await pool.query(
    `SELECT u.id, u.email, u."firstName", u."lastName", u."displayName", u."avatarUrl", u.role, u."createdAt",
            p."spokenLang", p."learningLang", p.level, p."defaultLang", p."ageBand"
     FROM "User" u
     LEFT JOIN "UserPreference" p ON p."userId" = u.id
     WHERE u.email = $1`,
    ['admin@storytranslator.local']
  );
  console.log('JOIN ROW:', full.rows[0]);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

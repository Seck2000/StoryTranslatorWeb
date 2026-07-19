require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `ALTER TABLE "UserPreference" ADD COLUMN IF NOT EXISTS "ageBand" TEXT NOT NULL DEFAULT 'moyens'`
  );
  console.log('ageBand column OK');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

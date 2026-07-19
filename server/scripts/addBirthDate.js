require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3)');
  console.log('birthDate column OK');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

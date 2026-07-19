require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const email = (process.argv[2] || 'aminabalde@gmail.com').trim().toLowerCase();

  const result = await pool.query(
    `UPDATE "User" SET role = 'admin', "updatedAt" = NOW() WHERE email = $1 RETURNING email, role, "firstName"`,
    [email]
  );

  if (result.rows.length === 0) {
    console.error('Utilisateur introuvable:', email);
    process.exit(1);
  }

  console.log('Promu admin:', result.rows[0]);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

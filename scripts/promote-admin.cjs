const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function main() {
  const result = await sql(
    "UPDATE users SET role = 'admin' WHERE email = 'uptontechorg@gmail.com' RETURNING id, email, role"
  );
  if (result.length === 0) {
    console.log('No user found with that email — no rows updated.');
  } else {
    console.log('Success! Updated user:', result[0]);
  }
}
main().catch(console.error);

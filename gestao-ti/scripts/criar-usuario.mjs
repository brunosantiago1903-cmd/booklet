// Cria (ou atualiza a senha de) um usuário.
// Uso: node scripts/criar-usuario.mjs <email> <senha> "<nome>" [gestor|tecnico]
// Em Docker: docker compose exec app node scripts/criar-usuario.mjs admin@x senha "Bruno" gestor
import postgres from "postgres";
import bcrypt from "bcryptjs";

const [email, senha, nome, papel = "gestor"] = process.argv.slice(2);
if (!email || !senha || !nome) {
  console.error('Uso: node scripts/criar-usuario.mjs <email> <senha> "<nome>" [gestor|tecnico]');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);
const hash = bcrypt.hashSync(senha, 10);

await sql`
  insert into usuarios (nome, email, senha_hash, papel)
  values (${nome}, ${email}, ${hash}, ${papel})
  on conflict (email) do update set senha_hash = excluded.senha_hash, nome = excluded.nome, papel = excluded.papel
`;

console.log(`✅ Usuário ${email} (${papel}) pronto.`);
await sql.end();

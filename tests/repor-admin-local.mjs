// Repõe a conta de administrador no armazenamento LOCAL, para desenvolvimento.
//
//   node tests/repor-admin-local.mjs            → admin / admin
//   node tests/repor-admin-local.mjs uma-outra  → admin / uma-outra
//
// Escreve diretamente em .netlify/blobs-serve/, que só existe na máquina de
// quem desenvolve — em produção esta pasta não existe e o script recusa correr.
// É por isso que consegue definir uma palavra-passe curta como "admin": a
// política de comprimento mínimo é imposta pelo endpoint de mudança de
// palavra-passe, que este script não usa.
//
// ⚠️ Correr os testes (`npx playwright test`) volta a tomar conta da conta e a
// definir a palavra-passe de testes. Volte a correr este script a seguir se
// quiser o admin/admin de volta.
import { readdirSync, existsSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { hashPassword } from '../netlify/functions/_shared/crypto.mjs';

const RAIZ = '.netlify/blobs-serve';
// O "netlify-cli" grava os dois-pontos do nome do site em URL-encoding no
// disco (site%3Aauth) — um ":" literal não é válido num nome de pasta no
// Windows, por isso tem de ser esta forma para funcionar em qualquer SO.
const ENTRADAS = join(RAIZ, 'entries/unlinked/site%3Aauth');
const METADADOS = join(RAIZ, 'metadata/unlinked/site%3Aauth');

if (!existsSync(RAIZ)) {
  console.error(
    'Não encontrei .netlify/blobs-serve/.\n' +
      'Este script é só para desenvolvimento local: arranque primeiro o servidor\n' +
      'com "npm run dev" (ao menos uma vez) e volte a tentar.'
  );
  process.exit(1);
}

const password = process.argv[2] || 'admin';
const username = 'admin';

function escrever(chave, valor) {
  mkdirSync(ENTRADAS, { recursive: true });
  mkdirSync(METADADOS, { recursive: true });
  writeFileSync(join(ENTRADAS, chave), JSON.stringify(valor));
  writeFileSync(join(METADADOS, chave), '{}');
}

const agora = Date.now();
escrever('user', {
  username,
  displayName: 'Administrador',
  passwordHash: await hashPassword(password),
  mustChangePassword: false, // sem troca forçada: é uma conta de desenvolvimento
  createdAt: agora,
  passwordChangedAt: agora,
  lastLoginAt: 0,
  lastLoginIp: '',
  resetApplied: null,
  totp: null,
});

// Limpa sessões abertas e contadores de tentativas — senão um bloqueio de uma
// corrida de testes anterior continuava a barrar a entrada.
let limpos = 0;
for (const ficheiro of readdirSync(ENTRADAS)) {
  if (ficheiro.startsWith('session%3A') || ficheiro.startsWith('rl%3A')) {
    rmSync(join(ENTRADAS, ficheiro), { force: true });
    rmSync(join(METADADOS, ficheiro), { force: true });
    limpos += 1;
  }
}

console.log(`Conta local reposta: ${username} / ${password}`);
console.log(`Sessões e contadores de tentativas limpos: ${limpos}`);
console.log('Arranque com "npm run dev" e abra http://localhost:4323/admin.html');

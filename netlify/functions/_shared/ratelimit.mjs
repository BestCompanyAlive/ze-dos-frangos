// Travão de força bruta. Conta falhas por conta e por endereço IP, com bloqueio
// escalonado. Os contadores vivem nos Blobs com consistência forte, senão duas
// tentativas em paralelo liam o mesmo valor e o limite não valeria nada.
import { getJSON, setJSON, del } from './store.mjs';
import { sha256 } from './crypto.mjs';

const WINDOW_MS = 15 * 60 * 1000;

// [nº de falhas, duração do bloqueio em ms] — da mais grave para a mais leve.
const ESCALADA = {
  conta: [
    [20, 24 * 60 * 60 * 1000],
    [10, 60 * 60 * 1000],
    [5, 15 * 60 * 1000],
  ],
  ip: [
    [40, 24 * 60 * 60 * 1000],
    [20, 60 * 60 * 1000],
    [10, 15 * 60 * 1000],
  ],
};

function bucketKey(tipo, id) {
  return `rl:${tipo}:${sha256(id)}`;
}

function bloqueioPara(tipo, falhas) {
  for (const [limite, duracao] of ESCALADA[tipo]) {
    if (falhas >= limite) return duracao;
  }
  return 0;
}

/** Devolve { bloqueado, segundos } sem alterar nada. */
export async function checkLimit(tipo, id) {
  const registo = await getJSON(bucketKey(tipo, id));
  if (!registo || !registo.bloqueadoAte) return { bloqueado: false, segundos: 0 };
  const restante = registo.bloqueadoAte - Date.now();
  if (restante <= 0) return { bloqueado: false, segundos: 0 };
  return { bloqueado: true, segundos: Math.ceil(restante / 1000) };
}

/** Regista uma tentativa falhada e aplica o bloqueio se houver escalada. */
export async function recordFailure(tipo, id) {
  const key = bucketKey(tipo, id);
  const agora = Date.now();
  const registo = (await getJSON(key)) || { falhas: 0, primeiraEm: agora, bloqueadoAte: 0 };
  // Fora da janela e sem bloqueio ativo: recomeça a contagem.
  if (agora - registo.primeiraEm > WINDOW_MS && registo.bloqueadoAte < agora) {
    registo.falhas = 0;
    registo.primeiraEm = agora;
  }
  registo.falhas += 1;
  const duracao = bloqueioPara(tipo, registo.falhas);
  if (duracao) registo.bloqueadoAte = agora + duracao;
  await setJSON(key, registo);
  return registo;
}

/** Limpa o contador — chamado depois de uma autenticação com sucesso. */
export async function clearFailures(tipo, id) {
  await del(bucketKey(tipo, id));
}

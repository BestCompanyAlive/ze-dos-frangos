// Registo de acessos: as últimas ocorrências relevantes na conta, para o
// administrador conseguir ver entradas que não reconheça. Buffer circular — os
// mais antigos caem fora.
import { getJSON, setJSON } from './store.mjs';

const AUDIT_KEY = 'audit';
const MAX_EVENTOS = 100;

export const EVENTOS = {
  LOGIN_OK: 'entrada',
  LOGIN_FALHA: 'entrada falhada',
  LOGIN_BLOQUEADO: 'entrada bloqueada',
  LOGOUT: 'saída',
  PASSWORD_ALTERADA: 'palavra-passe alterada',
  PASSWORD_REPOSTA: 'palavra-passe reposta pelo administrador do sistema',
  PERFIL_ALTERADO: 'perfil alterado',
  SESSOES_TERMINADAS: 'outras sessões terminadas',
};

export async function audit(evento, { ip, userAgent } = {}) {
  try {
    const eventos = (await getJSON(AUDIT_KEY)) || [];
    eventos.unshift({
      evento,
      em: Date.now(),
      ip: ip || 'desconhecido',
      userAgent: String(userAgent || '').slice(0, 200),
    });
    await setJSON(AUDIT_KEY, eventos.slice(0, MAX_EVENTOS));
  } catch {
    // O registo nunca pode impedir a operação em si.
  }
}

export async function readAudit(limit = 50) {
  const eventos = (await getJSON(AUDIT_KEY)) || [];
  return eventos.slice(0, limit);
}

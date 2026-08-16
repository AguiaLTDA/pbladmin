import { runAsync } from '../config/db';

export async function logAudit(
  usuarioId: number | null,
  acao: string,
  recurso: string,
  recursoId?: string | number,
  detalhes?: any,
  ipAddress: string = '127.0.0.1'
) {
  try {
    const detalhesJson = detalhes ? JSON.stringify(detalhes) : null;
    await runAsync(
      `INSERT INTO logs_auditoria (usuario_id, acao, recurso, recurso_id, detalhes_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [usuarioId, acao, recurso, recursoId ? String(recursoId) : null, detalhesJson, ipAddress]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

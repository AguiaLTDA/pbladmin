import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ShieldCheck, Search, Clock } from 'lucide-react';

export const AuditoriaAdminView: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    let query = '/audit?';
    if (busca) query += `busca=${encodeURIComponent(busca)}&`;

    apiRequest<any[]>(query)
      .then((res) => setLogs(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Trilha de Auditoria & Segurança</h2>
          <p className="text-muted text-sm">
            Registro imutável de todas as ações executadas no sistema (criação, uploads, revisões, publicações, downloads e autenticações).
          </p>
        </div>
      </div>

      <div className="card mb-4" style={{ padding: '1rem' }}>
        <div className="flex items-center gap-2">
          <Search size={18} className="text-muted" />
          <input
            type="text"
            className="form-control"
            placeholder="Buscar evento por ação, usuário ou recurso..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
          />
          <button onClick={fetchLogs} className="btn btn-secondary">Buscar</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">Carregando histórico de auditoria...</div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Data e Hora</th>
                <th>Ação Executada</th>
                <th>Usuário Executante</th>
                <th>Perfil</th>
                <th>Recurso Afetado</th>
                <th>ID Recurso</th>
                <th>Detalhes Técnicos (JSON)</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock size={14} className="text-muted" />
                      <span>{new Date(l.criado_em).toLocaleString('pt-BR')}</span>
                    </div>
                  </td>
                  <td><strong style={{ color: 'var(--primary)' }}>{l.acao}</strong></td>
                  <td>{l.usuario_nome || 'Sistema'}</td>
                  <td><span className="user-role-badge role-admin">{l.perfil_nome || 'SISTEMA'}</span></td>
                  <td><code>{l.recurso}</code></td>
                  <td>{l.recurso_id || '-'}</td>
                  <td>
                    <code style={{ fontSize: '0.75rem', background: 'var(--bg-main)', padding: '0.2rem 0.4rem', borderRadius: '4px', maxWidth: '280px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.detalhes_json || '-'}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

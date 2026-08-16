import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { PBLActivity } from '../../types';
import { Inbox, Eye, Search, Filter, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface Props {
  navigate: (path: string) => void;
}

export const CaixaEntradaPBLView: React.FC<Props> = ({ navigate }) => {
  const [activities, setActivities] = useState<PBLActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchActivities = () => {
    setLoading(true);
    let query = `/pbl/activities?t=${Date.now()}`;
    if (statusFilter) query += `&status=${statusFilter}`;
    if (search) query += `&busca=${encodeURIComponent(search)}`;

    apiRequest<PBLActivity[]>(query)
      .then((res) => setActivities(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchActivities();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchActivities();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Caixa de Entrada — Submissões PBL</h2>
          <p className="text-muted text-sm">
            Atividades submetidas pelos docentes aguardando revisão, validação e publicação.
          </p>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="card mb-4" style={{ padding: '1rem' }}>
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-4">
          <div style={{ flex: 1, minWidth: '240px' }} className="flex items-center gap-2">
            <Search size={18} className="text-muted" />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por título ou código único..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ minWidth: '200px' }} className="flex items-center gap-2">
            <Filter size={18} className="text-muted" />
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos os Status</option>
              <option value="ENVIADO_ANALISE">Aguardando Análise Inicial</option>
              <option value="REENVIADO">Reenviado após Ajustes</option>
              <option value="EM_ANALISE">Em Análise</option>
              <option value="AJUSTES_SOLICITADOS">Ajustes Solicitados</option>
              <option value="APROVADO">Aprovado (Pendente Publicação)</option>
              <option value="PUBLICADO">Publicado</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary">
            Filtrar
          </button>
        </form>
      </div>

      {/* Tabela de Submissões */}
      {loading ? (
        <div className="text-center py-8 text-muted">Carregando submissões...</div>
      ) : activities.length === 0 ? (
        <div className="card text-center py-8">
          <Inbox size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhuma atividade encontrada</h3>
          <p className="text-muted text-sm">Não há submissões pendentes no filtro selecionado.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Título da Atividade PBL</th>
                <th>Curso / Disciplina</th>
                <th>Professor Responsável</th>
                <th>Status</th>
                <th>Versão</th>
                <th>Última Atualização</th>
                <th style={{ textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => (
                <tr key={act.id}>
                  <td>
                    <span className="font-bold" style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
                      {act.codigo_unico}
                    </span>
                  </td>
                  <td>
                    <div className="font-bold">{act.titulo}</div>
                  </td>
                  <td>
                    <div>{act.curso_nome}</div>
                    <div className="text-muted text-sm">{act.disciplina_nome}</div>
                  </td>
                  <td>{act.professor_nome}</td>
                  <td>
                    <span className={`status-badge status-${act.status}`}>
                      {act.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span className="btn btn-sm btn-secondary" style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}>
                      v{act.versao_atual}
                    </span>
                  </td>
                  <td>{new Date(act.atualizado_em).toLocaleString('pt-BR')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/admin/revisao/${act.id}`)}
                      className="btn btn-primary btn-sm"
                    >
                      <Eye size={16} />
                      Revisar & Avaliar
                    </button>
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

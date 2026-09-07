import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { PBLActivity, AtividadeExcluida } from '../../types';
import {
  Inbox,
  Eye,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit3,
  PlusCircle,
  Trash2,
  RotateCcw
} from 'lucide-react';

interface Props {
  navigate: (path: string) => void;
}

export const CaixaEntradaPBLView: React.FC<Props> = ({ navigate }) => {
  const { showToast } = useToast();
  const [activities, setActivities] = useState<PBLActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [excluidas, setExcluidas] = useState<AtividadeExcluida[]>([]);
  const [mostrarLixeira, setMostrarLixeira] = useState(false);

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

  const fetchExcluidas = () => {
    apiRequest<AtividadeExcluida[]>('/pbl/activities/excluidas')
      .then(setExcluidas)
      .catch(() => setExcluidas([]));
  };

  useEffect(() => {
    fetchActivities();
  }, [statusFilter]);

  useEffect(() => {
    fetchExcluidas();
  }, []);

  const handleExcluir = async (act: PBLActivity) => {
    if (
      !window.confirm(
        `Excluir a atividade "${act.titulo}"? Ela sai da Caixa de Entrada, dos relatórios e do portal ` +
          `dos alunos. As entregas e notas ficam guardadas, e a atividade pode ser restaurada pela lixeira.`
      )
    ) {
      return;
    }

    try {
      const res = await apiRequest<{ message: string }>(`/pbl/activities/${act.id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      fetchActivities();
      fetchExcluidas();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir a atividade.', 'error');
    }
  };

  const handleRestaurar = async (act: AtividadeExcluida) => {
    try {
      const res = await apiRequest<{ message: string }>(`/pbl/activities/${act.id}/restaurar`, { method: 'POST' });
      showToast(res.message, 'success');
      fetchActivities();
      fetchExcluidas();
    } catch (err: any) {
      showToast(err.message || 'Erro ao restaurar a atividade.', 'error');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchActivities();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Atividades PBL — Criação, Revisão & Publicação</h2>
          <p className="text-muted text-sm">
            Crie novas atividades, acompanhe rascunhos e revise, valide e publique as submissões.
          </p>
        </div>
        <button onClick={() => navigate('/admin/pbl/criar')} className="btn btn-primary">
          <PlusCircle size={18} />
          Nova Atividade PBL
        </button>
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
              <option value="RASCUNHO">Rascunho</option>
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
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => navigate(`/admin/pbl/editar/${act.id}`)}
                        className="btn btn-secondary btn-sm"
                      >
                        <Edit3 size={16} />
                        Editar
                      </button>
                      <button
                        onClick={() => navigate(`/admin/revisao/${act.id}`)}
                        className="btn btn-primary btn-sm"
                      >
                        <Eye size={16} />
                        Revisar & Avaliar
                      </button>
                      <button
                        onClick={() => handleExcluir(act)}
                        className="btn btn-secondary btn-sm"
                        title="Excluir esta atividade (recuperável)"
                      >
                        <Trash2 size={16} />
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lixeira de atividades PBL excluídas */}
      <div className="card" style={{ padding: '1rem', marginTop: '1rem' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <Trash2 size={18} color="var(--primary)" /> Lixeira de atividades ({excluidas.length})
          </h3>
          <button onClick={() => setMostrarLixeira((v) => !v)} className="btn btn-secondary btn-sm">
            {mostrarLixeira ? 'Ocultar' : 'Ver excluídas'}
          </button>
        </div>

        {mostrarLixeira && (
          <div style={{ marginTop: '0.75rem' }}>
            {excluidas.length === 0 ? (
              <span className="text-muted text-sm">Nenhuma atividade excluída.</span>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Título</th>
                      <th>Curso / Disciplina</th>
                      <th>Excluída em</th>
                      <th style={{ textAlign: 'right' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excluidas.map((act) => (
                      <tr key={act.id}>
                        <td>
                          <strong style={{ color: 'var(--primary)' }}>{act.codigo_unico}</strong>
                        </td>
                        <td>{act.titulo}</td>
                        <td className="text-sm">
                          {[act.curso_nome, act.disciplina_nome].filter(Boolean).join(' • ') || '-'}
                        </td>
                        <td>{act.deletado_em ? new Date(act.deletado_em).toLocaleString('pt-BR') : '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => handleRestaurar(act)} className="btn btn-primary btn-sm">
                            <RotateCcw size={14} /> Restaurar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { BarChart3, Download, Search, Filter, FileSpreadsheet } from 'lucide-react';

export const RelatoriosAdminView: React.FC = () => {
  const { showToast } = useToast();
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchReport = () => {
    setLoading(true);
    let query = '/reports/general?';
    if (statusFilter) query += `status=${statusFilter}&`;

    apiRequest<any[]>(query)
      .then((res) => setReportData(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReport();
  }, [statusFilter]);

  const handleExportCSV = (tipo: 'ATIVIDADES' | 'ENTREGAS') => {
    const url = `http://localhost:4000/api/reports/export/csv?tipo=${tipo}`;
    const token = localStorage.getItem('pbl_auth_token');

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `relatorio_${tipo.toLowerCase()}_pbl.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast(`Relatório em CSV exportado com sucesso!`, 'success');
      })
      .catch((err) => showToast('Erro ao exportar CSV.', 'error'));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Central de Relatórios & Métricas PBL</h2>
          <p className="text-muted text-sm">
            Consolidado de atividades criadas por professor, alcance de alunos e entregas realizadas.
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => handleExportCSV('ATIVIDADES')} className="btn btn-secondary">
            <FileSpreadsheet size={18} /> Exportar Atividades (CSV)
          </button>
          <button onClick={() => handleExportCSV('ENTREGAS')} className="btn btn-primary">
            <Download size={18} /> Exportar Entregas & Notas (CSV)
          </button>
        </div>
      </div>

      <div className="card mb-4" style={{ padding: '1rem' }}>
        <div className="flex items-center gap-4">
          <Filter size={18} className="text-muted" />
          <span className="text-sm font-bold">Filtrar Status:</span>
          <select className="form-control" style={{ maxWidth: '240px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos os Status</option>
            <option value="PUBLICADO">Publicados</option>
            <option value="APROVADO">Aprovados</option>
            <option value="ENVIADO_ANALISE">Em Análise</option>
            <option value="AJUSTES_SOLICITADOS">Ajustes Solicitados</option>
            <option value="RASCUNHO">Rascunhos</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">Gerando dados do relatório...</div>
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
                <th>Alunos Alcançados</th>
                <th>Entregas Concluídas</th>
                <th>Data Criação</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((r, i) => (
                <tr key={i}>
                  <td><strong style={{ color: 'var(--primary)' }}>{r.codigo_unico}</strong></td>
                  <td><div className="font-bold">{r.titulo}</div></td>
                  <td><div>{r.curso_nome}</div><div className="text-muted text-sm">{r.disciplina_nome}</div></td>
                  <td>{r.professor_nome}</td>
                  <td><span className={`status-badge status-${r.status}`}>{r.status.replace('_', ' ')}</span></td>
                  <td>{r.total_alunos_alcancados} alunos</td>
                  <td><strong>{r.total_entregas} entregas</strong></td>
                  <td>{new Date(r.criado_em).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

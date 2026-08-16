import React, { useState, useEffect } from 'react';
import { apiRequest, getDownloadUrl } from '../../services/api';
import { PBLActivity, StudentSubmission } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Award, Download, CheckCircle, Search, Eye, FileText, Send } from 'lucide-react';

export const EntregasProfessorView: React.FC = () => {
  const { showToast } = useToast();
  const [activities, setActivities] = useState<PBLActivity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<number | ''>('');
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  // Evaluation Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
  const [notaEscrita, setNotaEscrita] = useState<number>(0);
  const [notaOral, setNotaOral] = useState<number>(0);
  const [observacoes, setObservacoes] = useState('');
  const [liberadoAluno, setLiberadoAluno] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<PBLActivity[]>('/pbl/activities')
      .then((res) => {
        const published = res.filter((a) => a.status === 'PUBLICADO');
        setActivities(published);
        if (published.length > 0) {
          setSelectedActivityId(published[0].id);
        }
      })
      .catch((err) => showToast(err.message, 'error'));
  }, []);

  const fetchSubmissions = (actId: number) => {
    setLoading(true);
    apiRequest<StudentSubmission[]>(`/submissions/activity/${actId}`)
      .then((res) => setSubmissions(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedActivityId) {
      fetchSubmissions(Number(selectedActivityId));
    }
  }, [selectedActivityId]);

  const openEvaluationModal = (sub: StudentSubmission) => {
    setSelectedSubmission(sub);
    setNotaEscrita(sub.nota_escrita || 0);
    setNotaOral(sub.nota_oral || 0);
    setObservacoes(sub.observacoes || '');
    setLiberadoAluno(sub.liberado_aluno !== 0);
    setShowModal(true);
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;

    setSubmitting(true);
    try {
      await apiRequest(`/submissions/${selectedSubmission.id}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({
          notaEscrita,
          notaOral,
          observacoes,
          liberadoAluno
        })
      });

      showToast('Avaliação e feedback registrados com sucesso!', 'success');
      setShowModal(false);
      if (selectedActivityId) fetchSubmissions(Number(selectedActivityId));
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar avaliação.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Acompanhamento de Entregas & Lançamento de Notas</h2>
          <p className="text-muted text-sm">
            Consulte as respostas e arquivos enviados pelos alunos e registre notas e observações formativas.
          </p>
        </div>
      </div>

      <div className="card mb-4" style={{ padding: '1rem' }}>
        <div className="form-group mb-0">
          <label className="form-label font-bold">Selecione a Atividade Publicada:</label>
          <select
            className="form-control"
            value={selectedActivityId}
            onChange={(e: any) => setSelectedActivityId(e.target.value)}
          >
            {activities.length === 0 && <option value="">Nenhuma atividade publicada disponível</option>}
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigo_unico} - {a.titulo} ({a.curso_nome})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">Carregando entregas dos alunos...</div>
      ) : submissions.length === 0 ? (
        <div className="card text-center py-8">
          <Award size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhuma entrega recebida ainda</h3>
          <p className="text-muted text-sm">Os alunos desta atividade ainda não finalizaram a submissão.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Grupo</th>
                <th>Status Entrega</th>
                <th>Data do Envio</th>
                <th>Comprovante Hash</th>
                <th>Nota Total</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => (
                <tr key={sub.id}>
                  <td>
                    <div className="font-bold">{sub.aluno_nome}</div>
                    <div className="text-muted text-sm">{sub.aluno_email}</div>
                  </td>
                  <td>{sub.grupo_nome || 'Individual'}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        background: sub.status === 'ENVIADO' ? '#dcfce7' : sub.status === 'ATRASADO' ? '#fee2e2' : '#f1f5f9',
                        color: sub.status === 'ENVIADO' ? '#15803d' : sub.status === 'ATRASADO' ? '#b91c1c' : '#475569'
                      }}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td>{sub.data_envio ? new Date(sub.data_envio).toLocaleString('pt-BR') : '-'}</td>
                  <td>
                    <code style={{ fontSize: '0.75rem', background: 'var(--bg-main)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                      {sub.comprovante_hash || 'Sem Comprovante'}
                    </code>
                  </td>
                  <td>
                    <strong>{(sub.nota_total || 0).toFixed(2)} pts</strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => openEvaluationModal(sub)}
                      className="btn btn-primary btn-sm"
                    >
                      <Award size={14} /> Avaliar & Feedback
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Lançamento de Notas */}
      {showModal && selectedSubmission && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="font-bold flex items-center gap-2">
                <Award size={20} color="var(--primary)" />
                Avaliação de Entrega — {selectedSubmission.aluno_nome}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-sm btn-secondary">X</button>
            </div>

            <form onSubmit={handleEvaluate}>
              <div className="modal-body">
                <div className="card mb-4" style={{ background: 'var(--bg-main)', padding: '0.85rem' }}>
                  <span className="font-bold text-sm block mb-1">Conteúdo da Resposta Enviada:</span>
                  <p style={{ whiteSpace: 'pre-line', fontSize: '0.85rem' }}>
                    {selectedSubmission.conteudo_resposta || 'Nenhuma resposta em texto digitada pelo aluno.'}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="mb-4">
                  <div className="form-group">
                    <label className="form-label required">Nota Escrita / Trabalho</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={notaEscrita}
                      onChange={(e) => setNotaEscrita(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Nota Oral / Pitch</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={notaOral}
                      onChange={(e) => setNotaOral(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="form-group mb-4">
                  <label className="form-label">Observações e Feedback Qualitativo</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: '100px' }}
                    placeholder="Escreva orientações de melhoria e elogios pedagógicos..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
                    <input
                      type="checkbox"
                      checked={liberadoAluno}
                      onChange={(e) => setLiberadoAluno(e.target.checked)}
                    />
                    Liberar nota e feedback para visualização no Portal do Aluno
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Salvando...' : 'Salvar Avaliação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../services/api';
import { PBLActivity, StudentSubmission, SubmissionFile } from '../../types';
import { useToast } from '../../context/ToastContext';
import { VisualizadorArquivo } from '../../components/VisualizadorArquivo';
import { Award, Eye, FileText, Users, BookOpen } from 'lucide-react';

interface ArquivoOrientativo extends SubmissionFile {
  aprovado_pelo_admin?: number;
  versao_material?: string;
}

interface ArquivoEmFoco {
  id: number;
  nome: string;
  mimeType?: string;
  descricao?: string;
}

function formatarTamanho(bytes: number): string {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const EntregasProfessorView: React.FC = () => {
  const { showToast } = useToast();
  const [activities, setActivities] = useState<PBLActivity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<number | ''>('');
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [orientativos, setOrientativos] = useState<ArquivoOrientativo[]>([]);
  const [loading, setLoading] = useState(false);

  // Visualização de arquivo dentro da plataforma (orientativo ou PDF do grupo)
  const [arquivoEmFoco, setArquivoEmFoco] = useState<ArquivoEmFoco | null>(null);

  // Avaliação
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

  const carregarAtividade = (actId: number) => {
    setLoading(true);

    // Material orientativo aprovado + entregas dos grupos da minha turma.
    Promise.all([
      apiRequest<any>(`/pbl/activities/${actId}`),
      apiRequest<StudentSubmission[]>(`/submissions/activity/${actId}`)
    ])
      .then(([detalhes, entregas]) => {
        setOrientativos(detalhes?.arquivos || []);
        setSubmissions(entregas);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedActivityId) {
      carregarAtividade(Number(selectedActivityId));
    }
  }, [selectedActivityId]);

  /** Entregas agrupadas por turma e, dentro dela, por grupo PBL. */
  const porTurmaEGrupo = useMemo(() => {
    const mapa = new Map<string, Map<string, StudentSubmission[]>>();

    for (const sub of submissions) {
      const turma = sub.turma_nome || 'Turma não identificada';
      const grupo = sub.grupo_nome || 'Entregas individuais';

      if (!mapa.has(turma)) mapa.set(turma, new Map());
      const grupos = mapa.get(turma)!;
      if (!grupos.has(grupo)) grupos.set(grupo, []);
      grupos.get(grupo)!.push(sub);
    }

    return Array.from(mapa.entries()).map(([turma, grupos]) => ({
      turma,
      grupos: Array.from(grupos.entries()).map(([grupo, itens]) => ({ grupo, itens }))
    }));
  }, [submissions]);

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
        body: JSON.stringify({ notaEscrita, notaOral, observacoes, liberadoAluno })
      });

      showToast('Avaliação e feedback registrados com sucesso!', 'success');
      setShowModal(false);
      if (selectedActivityId) carregarAtividade(Number(selectedActivityId));
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar avaliação.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderArquivos = (arquivos: SubmissionFile[] | undefined, contexto: string) => {
    if (!arquivos || arquivos.length === 0) {
      return <span className="text-muted text-sm">Nenhum arquivo anexado.</span>;
    }

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {arquivos.map((f) => (
          <button
            key={f.id}
            className="btn btn-secondary btn-sm"
            onClick={() =>
              setArquivoEmFoco({ id: f.id, nome: f.nome_original, mimeType: f.mime_type, descricao: contexto })
            }
            title={`${f.nome_original} — ${formatarTamanho(f.tamanho_bytes)}`}
          >
            <FileText size={13} /> {f.nome_original}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ fontSize: '1.4rem' }}>Acompanhamento de Entregas & Lançamento de Notas</h2>
        <p className="text-muted text-sm">
          Revise o material orientativo do PBL e receba os PDFs dos grupos das turmas em que você leciona.
        </p>
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

      {/* 1. Material orientativo do PBL, revisado dentro da plataforma */}
      <div className="card mb-4" style={{ padding: '1rem' }}>
        <h3 className="font-bold flex items-center gap-2 mb-1">
          <BookOpen size={18} color="var(--primary)" /> Material orientativo do PBL
        </h3>
        <p className="text-muted text-sm mb-3">
          Abra e revise os documentos aprovados sem sair da plataforma. O Arquivo 1 é o primeiro da lista.
        </p>

        {orientativos.length === 0 ? (
          <span className="text-muted text-sm">Nenhum material anexado a esta atividade.</span>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Documento</th>
                  <th>Tamanho</th>
                  <th>Situação</th>
                  <th style={{ textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {orientativos.map((f, idx) => (
                  <tr key={f.id}>
                    <td>
                      <strong>Arquivo {idx + 1}</strong>
                    </td>
                    <td>{f.nome_original}</td>
                    <td>{formatarTamanho(f.tamanho_bytes)}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          background: f.aprovado_pelo_admin ? '#dcfce7' : '#f1f5f9',
                          color: f.aprovado_pelo_admin ? '#15803d' : '#475569'
                        }}
                      >
                        {f.aprovado_pelo_admin ? 'Aprovado' : 'Em análise'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          setArquivoEmFoco({
                            id: f.id,
                            nome: f.nome_original,
                            mimeType: f.mime_type,
                            descricao: `Material orientativo — Arquivo ${idx + 1}`
                          })
                        }
                      >
                        <Eye size={14} /> Revisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Entregas dos grupos, por turma */}
      {loading ? (
        <div className="text-center py-8 text-muted">Carregando entregas dos alunos...</div>
      ) : submissions.length === 0 ? (
        <div className="card text-center py-8">
          <Award size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhuma entrega recebida ainda</h3>
          <p className="text-muted text-sm">
            Os grupos das turmas em que você leciona ainda não finalizaram a submissão.
          </p>
        </div>
      ) : (
        porTurmaEGrupo.map(({ turma, grupos }) => (
          <div key={turma} className="mb-4">
            <h3 className="font-bold flex items-center gap-2 mb-2">
              <Users size={18} color="var(--primary)" /> {turma}
            </h3>

            {grupos.map(({ grupo, itens }) => (
              <div key={grupo} className="card mb-3" style={{ padding: '1rem' }}>
                <div className="flex items-center justify-between mb-2">
                  <strong>{grupo}</strong>
                  <span className="text-muted text-sm">
                    {itens.length} {itens.length === 1 ? 'entrega' : 'entregas'}
                  </span>
                </div>

                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Aluno</th>
                        <th>Status</th>
                        <th>Envio</th>
                        <th>Arquivos entregues (PDF)</th>
                        <th>Comprovante</th>
                        <th>Nota</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((sub) => (
                        <tr key={sub.id}>
                          <td>
                            <div className="font-bold">{sub.aluno_nome}</div>
                            <div className="text-muted text-sm">{sub.aluno_email}</div>
                          </td>
                          <td>
                            <span
                              className="status-badge"
                              style={{
                                background:
                                  sub.status === 'ENVIADO' ? '#dcfce7' : sub.status === 'ATRASADO' ? '#fee2e2' : '#f1f5f9',
                                color:
                                  sub.status === 'ENVIADO' ? '#15803d' : sub.status === 'ATRASADO' ? '#b91c1c' : '#475569'
                              }}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td>{sub.data_envio ? new Date(sub.data_envio).toLocaleString('pt-BR') : '-'}</td>
                          <td>{renderArquivos(sub.arquivos, `${grupo} — ${sub.aluno_nome}`)}</td>
                          <td>
                            <code
                              style={{
                                fontSize: '0.72rem',
                                background: 'var(--bg-main)',
                                padding: '0.2rem 0.4rem',
                                borderRadius: '4px'
                              }}
                            >
                              {sub.comprovante_hash || 'Sem comprovante'}
                            </code>
                          </td>
                          <td>
                            <strong>{(sub.nota_total || 0).toFixed(2)} pts</strong>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={() => openEvaluationModal(sub)} className="btn btn-primary btn-sm">
                              <Award size={14} /> Avaliar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {arquivoEmFoco && (
        <VisualizadorArquivo
          arquivoId={arquivoEmFoco.id}
          nomeArquivo={arquivoEmFoco.nome}
          mimeType={arquivoEmFoco.mimeType}
          descricao={arquivoEmFoco.descricao}
          onClose={() => setArquivoEmFoco(null)}
        />
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

                <div className="card mb-4" style={{ background: 'var(--bg-main)', padding: '0.85rem' }}>
                  <span className="font-bold text-sm block mb-2">Arquivos da entrega:</span>
                  {renderArquivos(
                    selectedSubmission.arquivos,
                    `Entrega de ${selectedSubmission.aluno_nome}`
                  )}
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

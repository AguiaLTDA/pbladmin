import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiRequest, baixarArquivoAutenticado } from '../../services/api';
import { MedalhaContexto } from '../../components/MedalhaContexto';
import { PBLActivity, StudentSubmission, SubmissionFile, EntregaExcluida } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { VisualizadorArquivo } from '../../components/VisualizadorArquivo';
import { Award, Download, Eye, FileText, BookOpen, Trash2, RotateCcw, Search, X } from 'lucide-react';

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

type EntregaComDesconto = StudentSubmission & {
  nota_escrita_original?: number | null;
  pbl_1?: boolean;
  periodo_nome?: string;
  primeira_entrega_final_em?: string | null;
};

function formatarTamanho(bytes: number): string {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function descontoEscrito(sub: StudentSubmission): number {
  const entrega = sub as EntregaComDesconto;
  const dataEnvio = new Date(sub.data_envio || '').getTime();
  const primeiraFinal = new Date(entrega.primeira_entrega_final_em || '').getTime();
  const primeiraNoPrazo = primeiraFinal <= Date.parse('2026-11-04T23:59:59.999-03:00') &&
    dataEnvio <= Date.parse('2026-11-15T23:59:59.999-03:00');
  return entrega.pbl_1 && entrega.periodo_nome === '2026/2' && !primeiraNoPrazo &&
    dataEnvio > Date.parse('2026-11-04T23:59:59.999-03:00') &&
    dataEnvio <= Date.parse('2026-11-15T23:59:59.999-03:00') ? 20 : 0;
}

export const EntregasProfessorView: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  // A coordenadoria usa esta mesma tela, com poder adicional de excluir/restaurar entregas.
  const isAdmin = user?.perfilNome === 'ADMIN';
  const [activities, setActivities] = useState<PBLActivity[]>([]);
  const [excluidas, setExcluidas] = useState<EntregaExcluida[]>([]);
  const [mostrarLixeira, setMostrarLixeira] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<number | ''>('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [search, setSearch] = useState('');
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [orientativos, setOrientativos] = useState<ArquivoOrientativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [orientativosLoading, setOrientativosLoading] = useState(false);
  const [orientativosError, setOrientativosError] = useState('');
  const orientativosRequest = useRef(0);

  // Visualização de arquivo dentro da plataforma (orientativo ou entrega do grupo)
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
      })
      .catch((err) => showToast(err.message, 'error'));
  }, []);

  const carregarSubmissoes = () => {
    setLoading(true);
    setLoadError('');
    apiRequest<StudentSubmission[]>('/submissions')
      .then((entregas) => {
        if (!Array.isArray(entregas)) throw new Error('A listagem de entregas está indisponível. Tente novamente mais tarde.');
        setSubmissions(entregas);
      })
      .catch((err) => setLoadError(err.message || 'Não foi possível carregar as entregas.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregarSubmissoes();
  }, []);

  useEffect(() => {
    const request = ++orientativosRequest.current;
    setOrientativos([]);
    setOrientativosError('');
    if (!selectedActivityId) {
      setOrientativosLoading(false);
      return;
    }

    setOrientativosLoading(true);
    apiRequest<any>(`/pbl/activities/${selectedActivityId}`)
      .then((detalhes) => {
        if (request === orientativosRequest.current) setOrientativos(detalhes?.arquivos || []);
      })
      .catch((err) => {
        if (request === orientativosRequest.current) setOrientativosError(err.message || 'Não foi possível carregar o material orientativo.');
      })
      .finally(() => {
        if (request === orientativosRequest.current) setOrientativosLoading(false);
      });
  }, [selectedActivityId]);

  const carregarExcluidas = () => {
    apiRequest<EntregaExcluida[]>('/submissions/excluidas')
      .then(setExcluidas)
      .catch(() => setExcluidas([]));
  };

  useEffect(() => {
    if (isAdmin) carregarExcluidas();
  }, [isAdmin]);

  const handleExcluir = async (sub: StudentSubmission) => {
    if (
      !window.confirm(
        `Excluir a entrega de ${sub.aluno_nome}? Ela sai das telas, dos relatórios e do portal do aluno, ` +
          `mas fica na lixeira e pode ser restaurada.`
      )
    ) {
      return;
    }

    try {
      const res = await apiRequest<{ message: string }>(`/submissions/${sub.id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      carregarSubmissoes();
      carregarExcluidas();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir a entrega.', 'error');
    }
  };

  const handleRestaurar = async (entrega: EntregaExcluida) => {
    try {
      const res = await apiRequest<{ message: string }>(`/submissions/${entrega.id}/restaurar`, { method: 'POST' });
      showToast(res.message, 'success');
      carregarSubmissoes();
      carregarExcluidas();
    } catch (err: any) {
      showToast(err.message || 'Erro ao restaurar a entrega.', 'error');
    }
  };

  const grupos = useMemo(() => {
    const opcoes = new Map<string, string>();
    for (const sub of submissions) {
      opcoes.set(String(sub.grupo_id ?? 'individual'), sub.grupo_id == null
        ? 'Entregas individuais'
        : `${sub.grupo_nome || 'Grupo sem nome'}${sub.turma_nome ? ` — ${sub.turma_nome}` : ''}`);
    }
    return Array.from(opcoes, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [submissions]);
  const linhas = useMemo(() => {
    const termo = normalizarBusca(search.trim());
    return submissions.flatMap((sub) => {
      const atividade = activities.find((a) => a.id === sub.atividade_id);
      if (selectedActivityId && sub.atividade_id !== Number(selectedActivityId)) return [];
      if (selectedGroup && String(sub.grupo_id ?? 'individual') !== selectedGroup) return [];
      // Uma linha por entrega: os arquivos do mesmo envio ficam juntos e há um único "Avaliar".
      if (termo && ![
        ...(sub.arquivos || []).map((arquivo) => arquivo.nome_original),
        sub.aluno_nome,
        sub.grupo_nome,
        sub.atividade_titulo,
        sub.codigo_unico
      ].some((campo) => normalizarBusca(campo || '').includes(termo))) return [];
      return [{ sub, atividade }];
    });
  }, [activities, search, selectedActivityId, selectedGroup, submissions]);
  const activeFilters = Boolean(selectedActivityId || selectedGroup || search.trim());
  const clearFilters = () => { setSelectedActivityId(''); setSelectedGroup(''); setSearch(''); };

  const openEvaluationModal = (sub: StudentSubmission) => {
    setSelectedSubmission(sub);
    setNotaEscrita((sub as EntregaComDesconto).nota_escrita_original ?? sub.nota_escrita ?? 0);
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
      carregarSubmissoes();
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar avaliação.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const baixarArquivo = async (arquivo: SubmissionFile) => {
    try {
      await baixarArquivoAutenticado(arquivo.id, arquivo.nome_original);
    } catch (err: any) {
      showToast(err.message || 'Não foi possível baixar o arquivo.', 'error');
    }
  };

  const renderArquivos = (arquivos: SubmissionFile[] | undefined, contexto: string) => {
    if (!arquivos || arquivos.length === 0) {
      return <span className="text-muted text-sm">Nenhum arquivo anexado.</span>;
    }

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {arquivos.map((f) => (
          <div key={f.id} className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setArquivoEmFoco({ id: f.id, nome: f.nome_original, mimeType: f.mime_type, descricao: contexto })
              }
              title={`${f.nome_original} — ${formatarTamanho(f.tamanho_bytes)}`}
            >
              <FileText size={13} /> {f.nome_original}
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => baixarArquivo(f)}
              aria-label={`Baixar ${f.nome_original}`}
              title={`Baixar ${f.nome_original}`}
            >
              <Download size={13} /> {/\.pptx$/i.test(f.nome_original) ? 'Baixar PPTX' : 'Baixar'}
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ fontSize: '1.4rem' }}>
          {isAdmin ? 'Entregas & Relatórios PBL' : 'Acompanhamento de Entregas & Lançamento de Notas'}
        </h2>
        <p className="text-muted text-sm">
          {isAdmin
            ? 'Consulte, avalie e exclua as entregas recebidas. A exclusão é recuperável: o registro vai para a lixeira no fim da página.'
            : 'Consulte os arquivos enviados pelas turmas, filtre por atividade ou grupo e acompanhe as avaliações.'}
        </p>
      </div>

      <div className="card mb-4" style={{ padding: '1rem' }}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="form-group mb-0" style={{ flex: '1 1 240px' }}>
            <label className="form-label font-bold" htmlFor="entrega-atividade">Atividade</label>
            <select id="entrega-atividade" className="form-control" value={selectedActivityId} onChange={(e) => setSelectedActivityId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Todas as atividades</option>
              {activities.map((a) => <option key={a.id} value={a.id}>{a.codigo_unico} — {a.titulo}</option>)}
            </select>
          </div>
          <div className="form-group mb-0" style={{ flex: '1 1 190px' }}>
            <label className="form-label font-bold" htmlFor="entrega-grupo">Grupo</label>
            <select id="entrega-grupo" className="form-control" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
              <option value="">Todos os grupos</option>
              {selectedGroup && !grupos.some((grupo) => grupo.id === selectedGroup) && <option value={selectedGroup}>Grupo selecionado (sem entregas)</option>}
              {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>)}
            </select>
          </div>
          <div className="form-group mb-0" style={{ flex: '2 1 280px' }}>
            <label className="form-label font-bold" htmlFor="entrega-busca">Buscar arquivo, grupo ou atividade</label>
            <div className="flex items-center gap-2"><Search size={18} className="text-muted" /><input id="entrega-busca" type="search" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome do arquivo, grupo, título ou código" /></div>
          </div>
          {activeFilters && <button type="button" onClick={clearFilters} className="btn btn-secondary" aria-label="Limpar filtros"><X size={15} /> Limpar filtros</button>}
        </div>
        <div className="text-muted text-sm mt-2" aria-live="polite">{loading ? 'Carregando arquivos…' : `${linhas.length} ${linhas.length === 1 ? 'resultado' : 'resultados'}`}</div>
      </div>

      {/* 1. Material orientativo do PBL, revisado dentro da plataforma */}
      {selectedActivityId && <div className="card mb-4" style={{ padding: '1rem' }}>
        <h3 className="font-bold flex items-center gap-2 mb-1">
          <BookOpen size={18} color="var(--primary)" /> Material orientativo do PBL
        </h3>
        <p className="text-muted text-sm mb-3">
          Abra e revise os documentos aprovados sem sair da plataforma. O Arquivo 1 é o primeiro da lista.
        </p>

        {orientativosLoading ? <span className="text-muted text-sm">Carregando material orientativo…</span> : orientativosError ? <span role="alert" className="text-sm">{orientativosError}</span> : orientativos.length === 0 ? (
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
      </div>}

      {/* 2. Arquivos das entregas, com filtros combináveis */}
      {loading ? (
        <div className="text-center py-8 text-muted" role="status">Carregando arquivos enviados…</div>
      ) : loadError ? (
        <div className="card text-center py-8" role="alert"><h3 className="font-bold">Não foi possível carregar as entregas</h3><p className="text-muted text-sm">{loadError}</p><button className="btn btn-primary btn-sm" onClick={carregarSubmissoes}>Tentar novamente</button></div>
      ) : linhas.length === 0 ? (
        <div className="card text-center py-8">
          <Award size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">{submissions.length === 0 ? 'Nenhuma entrega recebida ainda' : 'Nenhuma entrega corresponde aos filtros'}</h3>
          <p className="text-muted text-sm">
            {submissions.length === 0 ? 'As entregas enviadas pelas turmas aparecerão nesta lista.' : 'Altere a busca ou os filtros para ver outras entregas.'}
          </p>
          {activeFilters && <button type="button" onClick={clearFilters} className="btn btn-secondary btn-sm">Limpar filtros</button>}
        </div>
      ) : (
        <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Arquivos</th>
                        <th>Grupo</th>
                        <th>Turma</th>
                        <th>Atividade</th>
                        <th>Envio</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map(({ sub, atividade }) => {
                        const semNota = sub.natureza === 'OBRIGATORIA_SEM_NOTA' || atividade?.natureza === 'OBRIGATORIA_SEM_NOTA';
                        return <tr key={sub.id}>
                          <td>
                            {renderArquivos(sub.arquivos, `Entrega de ${sub.grupo_nome || sub.aluno_nome || 'aluno'}`)}
                            <div className="text-muted text-sm">Enviado por {sub.aluno_nome} <MedalhaContexto completo={sub.contexto_completo} tamanho={13} /> · {sub.aluno_email}</div>
                          </td>
                          <td>
                            {sub.grupo_nome || 'Entrega individual'}
                          </td>
                          <td>{sub.turma_nome || '-'}</td>
                          <td><div className="font-bold">{sub.atividade_titulo}</div><div className="text-muted text-sm">{sub.codigo_unico}</div></td>
                          <td>{sub.data_envio ? new Date(sub.data_envio).toLocaleString('pt-BR') : '-'}<div className="text-muted text-sm">{sub.status} · {sub.comprovante_hash ? `Comprovante ${sub.comprovante_hash}` : 'Sem comprovante'}</div></td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex gap-2 justify-end" style={{ flexWrap: 'wrap' }}>
                              {semNota ? <span className="text-muted text-sm">Sem nota</span> : <><strong>{(sub.nota_total || 0).toFixed(2)} pts</strong><button onClick={() => openEvaluationModal(sub)} className="btn btn-primary btn-sm"><Award size={14} /> Avaliar</button></>}
                              {isAdmin && <button onClick={() => handleExcluir(sub)} className="btn btn-secondary btn-sm" title="Excluir esta entrega (recuperável)"><Trash2 size={14} /> Excluir</button>}
                            </div>
                            {!semNota && (sub as EntregaComDesconto).nota_escrita_original != null && <small className="block text-muted">Escrita original: {(sub as EntregaComDesconto).nota_escrita_original!.toFixed(2)}</small>}
                          </td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
        </div>
      )}

      {/* 3. Lixeira de entregas — só a coordenadoria vê e restaura */}
      {isAdmin && (
        <div className="card mt-4 mb-4" style={{ padding: '1rem' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <Trash2 size={18} color="var(--primary)" /> Lixeira de entregas ({excluidas.length})
            </h3>
            <button onClick={() => setMostrarLixeira((v) => !v)} className="btn btn-secondary btn-sm">
              {mostrarLixeira ? 'Ocultar' : 'Ver excluídas'}
            </button>
          </div>

          {mostrarLixeira && (
            <div style={{ marginTop: '0.75rem' }}>
              {excluidas.length === 0 ? (
                <span className="text-muted text-sm">Nenhuma entrega excluída.</span>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Aluno</th>
                        <th>Atividade</th>
                        <th>Grupo</th>
                        <th>Excluída em</th>
                        <th style={{ textAlign: 'right' }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excluidas.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <div className="font-bold">
                              {e.aluno_nome}
                              <MedalhaContexto completo={e.contexto_completo} tamanho={13} />
                            </div>
                            <div className="text-muted text-sm">{e.aluno_email}</div>
                          </td>
                          <td>
                            <div className="text-sm">{e.atividade_titulo}</div>
                            <div className="text-muted text-sm">{e.codigo_unico}</div>
                          </td>
                          <td>{e.grupo_nome || '-'}</td>
                          <td>{e.deletado_em ? new Date(e.deletado_em).toLocaleString('pt-BR') : '-'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button onClick={() => handleRestaurar(e)} className="btn btn-primary btn-sm">
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
                Avaliação de Entrega — {selectedSubmission.grupo_nome || selectedSubmission.aluno_nome}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-sm btn-secondary">X</button>
            </div>

            <form onSubmit={handleEvaluate}>
              <div className="modal-body">
                <p className="text-muted text-sm mb-4">
                  {!selectedSubmission.grupo_nome
                    ? `Entrega individual de ${selectedSubmission.aluno_nome}.`
                    : ['ENVIADO', 'ATRASADO'].includes(selectedSubmission.status)
                      ? `Entrega do grupo ${selectedSubmission.grupo_nome}, enviada por ${selectedSubmission.aluno_nome}. A nota vale para todos os integrantes do grupo.`
                      : `Rascunho do grupo ${selectedSubmission.grupo_nome}, salvo por ${selectedSubmission.aluno_nome}. Os colegas só veem a nota depois do envio final.`}
                </p>
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
                    <label className="form-label required">
                      {descontoEscrito(selectedSubmission) > 0 ? 'Nota Escrita antes do desconto / Trabalho' : 'Nota Escrita / Trabalho'}
                    </label>
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

                {descontoEscrito(selectedSubmission) > 0 && (
                  <p className="text-muted text-sm mb-4">
                    Desconto automático de 20% na nota escrita por envio após o prazo. Nota escrita resultante: {(Math.round(notaEscrita * 0.8 * 100) / 100).toFixed(2)} pts. A nota oral não recebe desconto.
                  </p>
                )}

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

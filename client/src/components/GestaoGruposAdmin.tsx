import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { GrupoOption, GrupoMembro, TurmaOption, GrupoComMaterial } from '../types';
import { MAX_INTEGRANTES_GRUPO, rotuloTipoDocumento } from '../constants/academico';
import { AnexarPblGrupoModal } from './AnexarPblGrupoModal';
import { VisualizadorArquivo } from './VisualizadorArquivo';
import {
  Plus,
  Trash2,
  Users,
  Search,
  UserPlus,
  UserMinus,
  ChevronDown,
  ChevronRight,
  Filter,
  UserX,
  Paperclip,
  FileCheck2,
  FileText,
  Eye
} from 'lucide-react';

interface GestaoGruposAdminProps {
  grupos: GrupoOption[];
  turmas: TurmaOption[];
  onChanged: () => void;
}

/**
 * Gestão de grupos PBL pela coordenadoria: cria, exclui e remaneja integrantes.
 * O aluno continua podendo montar o próprio grupo no portal dele — aqui é a mesma
 * base de dados, vista pelo lado do admin.
 */
export const GestaoGruposAdmin: React.FC<GestaoGruposAdminProps> = ({ grupos, turmas, onChanged }) => {
  const { showToast } = useToast();

  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [membros, setMembros] = useState<Record<number, GrupoMembro[]>>({});
  // Sem isso, o grupo aparece como "sem integrantes" no instante entre abrir e a resposta chegar.
  const [carregandoMembrosId, setCarregandoMembrosId] = useState<number | null>(null);

  const [showCriar, setShowCriar] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaTurmaId, setNovaTurmaId] = useState<number | ''>('');
  const [criando, setCriando] = useState(false);

  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<GrupoMembro[]>([]);
  const [buscando, setBuscando] = useState(false);

  // Quem já recebeu material e o que recebeu — a fonte do selo "PBL 1" e do
  // aviso de duplicação no modal de anexo.
  const [materialPorGrupo, setMaterialPorGrupo] = useState<Record<number, GrupoComMaterial>>({});
  const [grupoAnexando, setGrupoAnexando] = useState<GrupoOption | null>(null);
  // Conferir o conteudo do PDF sem sair do portal. Ate aqui a coordenacao via o
  // NOME do arquivo do grupo e nada mais: para saber se o caso certo foi para o
  // grupo certo era preciso abrir a pasta do Drive, onde os arquivos estao com
  // nome gerado e nao dizem a que grupo pertencem.
  const [arquivoEmFoco, setArquivoEmFoco] = useState<{ id: number; nome: string; grupo: string } | null>(null);

  const [turmaFiltro, setTurmaFiltro] = useState<number | ''>('');
  // Grupo vazio é um problema a resolver, não um estado normal: ou ninguém entrou
  // ainda, ou os integrantes saíram e ele virou casca. Daí o filtro próprio.
  const [ocupacaoFiltro, setOcupacaoFiltro] = useState<'' | 'vazios' | 'com_vagas' | 'lotados'>('');
  // Filtro próprio para o PBL 1: a pergunta "quem ainda não recebeu" é o motivo
  // de a coordenação abrir esta aba durante a distribuição.
  const [pblFiltro, setPblFiltro] = useState<'' | 'com_pbl1' | 'sem_pbl1'>('');

  // Só as turmas que de fato têm grupo — evita um seletor gigante com opções vazias.
  const turmasComGrupos = useMemo(() => {
    const mapa = new Map<number, string>();
    grupos.forEach((g) => {
      if (g.turma_id) mapa.set(g.turma_id, g.turma_nome || `Turma #${g.turma_id}`);
    });
    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [grupos]);

  const totalDe = (g: GrupoOption) => Number(g.total_integrantes || 0);
  const temPbl1 = (g: GrupoOption) => Boolean(materialPorGrupo[g.id]?.temPbl1);

  const carregarMateriais = () => {
    apiRequest<GrupoComMaterial[]>('/files/grupos-com-material')
      .then((lista) => {
        const mapa: Record<number, GrupoComMaterial> = {};
        lista.forEach((g) => (mapa[g.grupoId] = g));
        setMaterialPorGrupo(mapa);
      })
      .catch(() => setMaterialPorGrupo({}));
  };

  useEffect(() => {
    carregarMateriais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gruposDaTurma = useMemo(
    () => (turmaFiltro === '' ? grupos : grupos.filter((g) => g.turma_id === Number(turmaFiltro))),
    [grupos, turmaFiltro]
  );

  // Contadores calculados sobre a turma já escolhida: o "3 vazios" se refere ao
  // que está à vista, não ao total da instituição.
  const contagem = useMemo(() => {
    let vazios = 0;
    let comVagas = 0;
    let lotados = 0;
    gruposDaTurma.forEach((g) => {
      const total = totalDe(g);
      if (total === 0) vazios++;
      else if (total >= MAX_INTEGRANTES_GRUPO) lotados++;
      else comVagas++;
    });
    return { vazios, comVagas, lotados };
  }, [gruposDaTurma]);

  const contagemPbl = useMemo(() => {
    let com = 0;
    gruposDaTurma.forEach((g) => {
      if (temPbl1(g)) com++;
    });
    return { com, sem: gruposDaTurma.length - com };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gruposDaTurma, materialPorGrupo]);

  const gruposFiltrados = useMemo(() => {
    return gruposDaTurma.filter((g) => {
      const total = totalDe(g);
      if (ocupacaoFiltro === 'vazios' && total !== 0) return false;
      if (ocupacaoFiltro === 'lotados' && total < MAX_INTEGRANTES_GRUPO) return false;
      if (ocupacaoFiltro === 'com_vagas' && !(total > 0 && total < MAX_INTEGRANTES_GRUPO)) return false;
      if (pblFiltro === 'com_pbl1' && !temPbl1(g)) return false;
      if (pblFiltro === 'sem_pbl1' && temPbl1(g)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gruposDaTurma, ocupacaoFiltro, pblFiltro, materialPorGrupo]);

  const algumFiltroAtivo = turmaFiltro !== '' || ocupacaoFiltro !== '' || pblFiltro !== '';

  const carregarMembros = (grupoId: number) => {
    setCarregandoMembrosId(grupoId);
    apiRequest<GrupoMembro[]>(`/academic/groups/${grupoId}/membros`)
      .then((lista) => setMembros((prev) => ({ ...prev, [grupoId]: lista })))
      .catch(() => setMembros((prev) => ({ ...prev, [grupoId]: [] })))
      .finally(() => setCarregandoMembrosId((atual) => (atual === grupoId ? null : atual)));
  };

  const alternarExpandido = (grupoId: number) => {
    const abrindo = expandidoId !== grupoId;
    setExpandidoId(abrindo ? grupoId : null);
    setTermo('');
    setResultados([]);
    if (abrindo) carregarMembros(grupoId);
  };

  useEffect(() => {
    if (expandidoId === null || termo.trim().length < 3) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const timeout = setTimeout(() => {
      apiRequest<GrupoMembro[]>(`/academic/students/search?q=${encodeURIComponent(termo.trim())}`)
        .then(setResultados)
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 350);
    return () => clearTimeout(timeout);
  }, [termo, expandidoId]);

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim() || !novaTurmaId) {
      showToast('Informe o nome do grupo e a turma.', 'error');
      return;
    }

    setCriando(true);
    try {
      await apiRequest('/academic/groups', {
        method: 'POST',
        body: JSON.stringify({ nome: novoNome.trim(), turmaId: Number(novaTurmaId) })
      });
      showToast('Grupo criado com sucesso!', 'success');
      setShowCriar(false);
      setNovoNome('');
      setNovaTurmaId('');
      onChanged();
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar o grupo.', 'error');
    } finally {
      setCriando(false);
    }
  };

  const handleExcluirGrupo = async (grupo: GrupoOption) => {
    if (
      !window.confirm(
        `Excluir o grupo "${grupo.nome}"? Os integrantes continuam matriculados na turma, apenas sem grupo.`
      )
    ) {
      return;
    }

    try {
      const res = await apiRequest<{ message: string }>(`/academic/groups/${grupo.id}`, { method: 'DELETE' });
      showToast(res.message, 'success');
      setExpandidoId(null);
      onChanged();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir o grupo.', 'error');
    }
  };

  const handleAdicionar = async (grupoId: number, aluno: GrupoMembro) => {
    try {
      const res = await apiRequest<{ message: string; membros?: GrupoMembro[] }>(
        `/academic/groups/${grupoId}/membros`,
        { method: 'POST', body: JSON.stringify({ usuarioId: aluno.id }) }
      );
      showToast(res.message, 'success');
      if (res.membros) setMembros((prev) => ({ ...prev, [grupoId]: res.membros as GrupoMembro[] }));
      else carregarMembros(grupoId);
      setTermo('');
      setResultados([]);
      onChanged();
    } catch (err: any) {
      showToast(err.message || 'Erro ao adicionar o aluno ao grupo.', 'error');
    }
  };

  const handleRemover = async (grupoId: number, aluno: GrupoMembro) => {
    if (!window.confirm(`Remover ${aluno.nome} deste grupo? Ele continua matriculado na turma, sem grupo.`)) return;

    try {
      const res = await apiRequest<{ message: string; membros?: GrupoMembro[] }>(
        `/academic/groups/${grupoId}/membros/${aluno.id}`,
        { method: 'DELETE' }
      );
      showToast(res.message, 'success');
      if (res.membros) setMembros((prev) => ({ ...prev, [grupoId]: res.membros as GrupoMembro[] }));
      else carregarMembros(grupoId);
      onChanged();
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover o aluno do grupo.', 'error');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <span className="font-bold text-sm">
          Grupos PBL por turma. Clique em um grupo para ver e remanejar os integrantes.
        </span>
        <button onClick={() => setShowCriar(true)} className="btn btn-primary btn-sm">
          <Plus size={16} /> Novo Grupo
        </button>
      </div>

      <div className="card mb-4" style={{ padding: '0.85rem 1rem' }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2" style={{ minWidth: '280px', flex: 1 }}>
            <Filter size={18} className="text-muted" />
            <select
              className="form-control"
              value={turmaFiltro}
              onChange={(e) => setTurmaFiltro(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Todas as turmas ({grupos.length} grupos)</option>
              {turmasComGrupos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2" style={{ minWidth: '240px' }}>
            <select
              className="form-control"
              value={ocupacaoFiltro}
              onChange={(e) => setOcupacaoFiltro(e.target.value as typeof ocupacaoFiltro)}
            >
              <option value="">Qualquer ocupação ({gruposDaTurma.length})</option>
              <option value="vazios">Vazios — sem integrantes ({contagem.vazios})</option>
              <option value="com_vagas">Com vagas ({contagem.comVagas})</option>
              <option value="lotados">Lotados ({contagem.lotados})</option>
            </select>
          </div>

          <div className="flex items-center gap-2" style={{ minWidth: '230px' }}>
            <select
              className="form-control"
              value={pblFiltro}
              onChange={(e) => setPblFiltro(e.target.value as typeof pblFiltro)}
            >
              <option value="">Qualquer situação de PBL 1</option>
              <option value="com_pbl1">Com PBL 1 entregue ({contagemPbl.com})</option>
              <option value="sem_pbl1">Sem PBL 1 ainda ({contagemPbl.sem})</option>
            </select>
          </div>

          <span className="text-muted text-sm">
            Exibindo {gruposFiltrados.length} de {grupos.length} grupo(s).
          </span>

          {algumFiltroAtivo && (
            <button
              onClick={() => {
                setTurmaFiltro('');
                setOcupacaoFiltro('');
                setPblFiltro('');
              }}
              className="btn btn-secondary btn-sm"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Atalho para o caso que motiva a varredura: grupos sem ninguém dentro.
            Só aparece quando existem, e some assim que o filtro já está aplicado. */}
        {contagem.vazios > 0 && ocupacaoFiltro !== 'vazios' && (
          <button
            onClick={() => setOcupacaoFiltro('vazios')}
            className="btn btn-secondary btn-sm"
            style={{ marginTop: '0.75rem', color: '#b45309', borderColor: '#fcd34d', background: '#fffbeb' }}
          >
            <UserX size={14} />
            {contagem.vazios === 1
              ? 'Ver 1 grupo vazio'
              : `Ver os ${contagem.vazios} grupos vazios`}
            {turmaFiltro !== '' && ' desta turma'}
          </button>
        )}
      </div>

      {gruposFiltrados.length === 0 ? (
        <div className="card text-center py-8">
          <Users size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">
            {ocupacaoFiltro === 'vazios'
              ? 'Nenhum grupo vazio'
              : ocupacaoFiltro !== ''
                ? 'Nenhum grupo nesta faixa de ocupação'
                : turmaFiltro === ''
                  ? 'Nenhum grupo cadastrado'
                  : 'Nenhum grupo nesta turma'}
          </h3>
          <p className="text-muted text-sm">
            {ocupacaoFiltro === 'vazios'
              ? turmaFiltro === ''
                ? 'Todos os grupos têm pelo menos um integrante.'
                : 'Todos os grupos desta turma têm pelo menos um integrante.'
              : ocupacaoFiltro !== ''
                ? 'Ajuste os filtros de turma ou de ocupação para ver outros grupos.'
                : turmaFiltro === ''
                  ? 'Crie um grupo aqui ou deixe que os próprios alunos se organizem pelo portal deles.'
                  : 'Escolha outra turma no filtro ou crie um grupo para esta turma.'}
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Nome do Grupo PBL</th>
                <th>Turma Pertencente</th>
                <th>Integrantes</th>
                <th>PBL do grupo</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {gruposFiltrados.map((g) => (
                <React.Fragment key={g.id}>
                  <tr>
                    <td>
                      <button
                        onClick={() => alternarExpandido(g.id)}
                        className="flex items-center gap-2 font-bold"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
                      >
                        {expandidoId === g.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {g.nome}
                      </button>
                    </td>
                    <td>{g.turma_nome}</td>
                    <td>
                      {totalDe(g)}/{MAX_INTEGRANTES_GRUPO}
                      {totalDe(g) === 0 && (
                        <span className="grupo-vazio-selo">
                          <UserX size={12} /> vazio
                        </span>
                      )}
                      {totalDe(g) >= MAX_INTEGRANTES_GRUPO && (
                        <span className="text-muted text-sm"> — lotado</span>
                      )}
                    </td>
                    <td>
                      {/* O selo responde de relance a pergunta que move a distribuição:
                          este grupo já ficou com o PBL 1 ou ainda não? */}
                      {temPbl1(g) ? (
                        <span className="grupo-com-pbl1" title="Este grupo já recebeu o PBL 1">
                          <FileCheck2 size={12} /> PBL 1
                        </span>
                      ) : materialPorGrupo[g.id] ? (
                        <span className="text-muted text-sm">
                          {materialPorGrupo[g.id].total} material(is), sem PBL 1
                        </span>
                      ) : (
                        <span className="text-muted text-sm">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setGrupoAnexando(g)}
                          className="btn btn-primary btn-sm"
                          title="Anexar o PDF do PBL a este grupo"
                        >
                          <Paperclip size={14} /> Anexar PBL
                        </button>
                        <button onClick={() => alternarExpandido(g.id)} className="btn btn-secondary btn-sm">
                          <Users size={14} /> Integrantes
                        </button>
                        <button
                          onClick={() => handleExcluirGrupo(g)}
                          className="btn btn-secondary btn-sm"
                          title="Excluir este grupo"
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandidoId === g.id && (
                    <tr>
                      <td colSpan={5} style={{ background: 'var(--bg-main)' }}>
                        <div style={{ padding: '0.5rem 0.25rem' }}>
                          <div className="mb-3">
                            <span className="font-bold text-sm">Arquivos PBL deste grupo</span>
                            {materialPorGrupo[g.id]?.materiais.length ? (
                              <ul style={{ listStyle: 'none', padding: 0, margin: '0.4rem 0 0' }}>
                                {materialPorGrupo[g.id].materiais.map((m) => (
                                  <li
                                    key={m.atividadeId}
                                    className="flex items-center gap-2 text-sm"
                                    style={{ padding: '0.2rem 0' }}
                                  >
                                    <FileText size={14} className="text-muted" />
                                    <span>{m.arquivoNome || m.titulo}</span>
                                    <span className="text-muted">
                                      — {rotuloTipoDocumento(m.tipoDocumento)}
                                    </span>
                                    {m.arquivoId && (
                                      <button
                                        className="btn btn-sm btn-outline"
                                        onClick={() =>
                                          setArquivoEmFoco({
                                            id: m.arquivoId as number,
                                            nome: m.arquivoNome || m.titulo,
                                            grupo: g.nome
                                          })
                                        }
                                        title="Abrir o arquivo na plataforma"
                                      >
                                        <Eye size={13} /> Abrir
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-muted text-sm" style={{ margin: '0.4rem 0' }}>
                                Nenhum arquivo anexado a este grupo ainda.
                              </div>
                            )}
                            <button
                              onClick={() => setGrupoAnexando(g)}
                              className="btn btn-secondary btn-sm"
                              style={{ marginTop: '0.35rem' }}
                            >
                              <Paperclip size={14} /> Anexar arquivo PBL
                            </button>
                          </div>

                          <span className="font-bold text-sm">Integrantes de {g.nome}</span>

                          {carregandoMembrosId === g.id ? (
                            <div className="text-muted text-sm" style={{ margin: '0.5rem 0' }}>
                              Carregando integrantes...
                            </div>
                          ) : membros[g.id]?.length ? (
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0' }}>
                              {membros[g.id].map((m) => (
                                <li
                                  key={m.id}
                                  className="flex items-center justify-between"
                                  style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}
                                >
                                  <div>
                                    <div className="text-sm font-bold">{m.nome}</div>
                                    <div className="text-muted text-sm">{m.email}</div>
                                  </div>
                                  <button
                                    onClick={() => handleRemover(g.id, m)}
                                    className="btn btn-secondary btn-sm"
                                    title="Tirar do grupo"
                                  >
                                    <UserMinus size={14} /> Remover
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-muted text-sm" style={{ margin: '0.5rem 0' }}>
                              Nenhum integrante neste grupo.
                            </div>
                          )}

                          <div style={{ marginTop: '0.75rem', maxWidth: '480px' }}>
                            <label className="form-label">Adicionar aluno ao grupo</label>
                            <div style={{ position: 'relative' }}>
                              <Search
                                size={14}
                                style={{
                                  position: 'absolute',
                                  left: '0.6rem',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  color: 'var(--text-muted, #6b7280)'
                                }}
                              />
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Nome ou e-mail do aluno..."
                                value={termo}
                                onChange={(e) => setTermo(e.target.value)}
                                style={{ paddingLeft: '2rem' }}
                              />
                            </div>

                            {buscando && (
                              <div className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>
                                Buscando...
                              </div>
                            )}

                            {!buscando && termo.trim().length >= 3 && resultados.length === 0 && (
                              <div className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>
                                Nenhum aluno encontrado.
                              </div>
                            )}

                            {resultados.length > 0 && (
                              <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
                                {resultados.map((aluno) => (
                                  <li
                                    key={aluno.id}
                                    className="flex items-center justify-between"
                                    style={{ padding: '0.35rem 0' }}
                                  >
                                    <div>
                                      <div className="text-sm font-bold">{aluno.nome}</div>
                                      <div className="text-muted text-sm">{aluno.email}</div>
                                    </div>
                                    <button
                                      onClick={() => handleAdicionar(g.id, aluno)}
                                      className="btn btn-primary btn-sm"
                                    >
                                      <UserPlus size={14} /> Adicionar
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {arquivoEmFoco && (
        <VisualizadorArquivo
          arquivoId={arquivoEmFoco.id}
          nomeArquivo={arquivoEmFoco.nome}
          mimeType="application/pdf"
          descricao={`Arquivo do grupo ${arquivoEmFoco.grupo}`}
          onClose={() => setArquivoEmFoco(null)}
        />
      )}

      {grupoAnexando && (
        <AnexarPblGrupoModal
          grupo={grupoAnexando}
          material={materialPorGrupo[grupoAnexando.id]}
          onClose={() => setGrupoAnexando(null)}
          onEnviado={() => {
            carregarMateriais();
            onChanged();
          }}
        />
      )}

      {showCriar && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="font-bold flex items-center gap-2">
                <Plus size={20} color="var(--primary)" />
                Criar Novo Grupo PBL
              </h3>
              <button onClick={() => setShowCriar(false)} className="btn btn-sm btn-secondary">
                X
              </button>
            </div>

            <form onSubmit={handleCriar}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Turma</label>
                  <select
                    className="form-control"
                    value={novaTurmaId}
                    onChange={(e: any) => setNovaTurmaId(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">-- Selecione a turma --</option>
                    {turmas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} ({t.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label required">Nome do Grupo</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ex: Grupo Marcopolo"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    required
                  />
                  <div className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>
                    O nome precisa ser único dentro da turma escolhida.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowCriar(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={criando} className="btn btn-primary">
                  {criando ? 'Criando...' : 'Criar Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

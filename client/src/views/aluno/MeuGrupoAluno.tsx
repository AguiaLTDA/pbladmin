import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { TurmaOption, GrupoOption, GrupoMembro, MinhaMatricula } from '../../types';
import { Users, UserPlus, CheckCircle2, RefreshCw, LogIn, Search, UserCheck, Repeat } from 'lucide-react';

interface AdicionarColegaProps {
  grupoId: number;
  onAdicionado: (grupoId: number, membros: GrupoMembro[]) => void;
}

/** Busca um colega por nome/e-mail e o indica diretamente para este grupo. */
const AdicionarColega: React.FC<AdicionarColegaProps> = ({ grupoId, onAdicionado }) => {
  const { showToast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<GrupoMembro[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [adicionandoId, setAdicionandoId] = useState<number | null>(null);

  useEffect(() => {
    if (!aberto || termo.trim().length < 3) {
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
  }, [termo, aberto]);

  const handleAdicionar = async (colega: GrupoMembro) => {
    setAdicionandoId(colega.id);
    try {
      const res = await apiRequest<{ message: string; membros: GrupoMembro[] }>(`/academic/groups/${grupoId}/membros`, {
        method: 'POST',
        body: JSON.stringify({ usuarioId: colega.id })
      });
      showToast(res.message, 'success');
      if (res.membros) onAdicionado(grupoId, res.membros);
      setTermo('');
      setResultados([]);
      setAberto(false);
    } catch (err: any) {
      showToast(err.message || 'Não foi possível adicionar este colega.', 'error');
    } finally {
      setAdicionandoId(null);
    }
  };

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}>
        <UserPlus size={14} /> Indicar colega
      </button>
    );
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div className="flex items-center gap-2">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #6b7280)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Nome ou e-mail do colega..."
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoFocus
            style={{ paddingLeft: '2rem' }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setTermo('');
            setResultados([]);
          }}
          className="btn btn-secondary btn-sm"
        >
          Cancelar
        </button>
      </div>

      {buscando && <div className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>Buscando...</div>}

      {!buscando && termo.trim().length >= 3 && resultados.length === 0 && (
        <div className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>Nenhum aluno encontrado.</div>
      )}

      {resultados.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
          {resultados.map((colega) => (
            <li
              key={colega.id}
              className="flex items-center justify-between"
              style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}
            >
              <div>
                <div className="text-sm font-bold">{colega.nome}</div>
                <div className="text-muted text-sm">{colega.email}</div>
              </div>
              <button
                onClick={() => handleAdicionar(colega)}
                disabled={adicionandoId === colega.id}
                className="btn btn-primary btn-sm"
              >
                <UserCheck size={14} />
                {adicionandoId === colega.id ? 'Adicionando...' : 'Adicionar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface SeletorGrupoProps {
  turmaId: number;
  onConfirmado: (grupoId: number, membros: GrupoMembro[]) => void;
  onCancelar?: () => void;
  textoBotao?: string;
}

/**
 * Escolhe o grupo dentro de uma turma já definida (cria um novo pelo nome ou
 * entra num existente). Reaproveitado tanto na matrícula em turma nova quanto
 * na troca de grupo numa turma em que o aluno já está.
 */
const SeletorGrupo: React.FC<SeletorGrupoProps> = ({ turmaId, onConfirmado, onCancelar, textoBotao = 'Confirmar Grupo' }) => {
  const { showToast } = useToast();
  const [gruposDaTurma, setGruposDaTurma] = useState<GrupoOption[]>([]);
  const [carregandoGrupos, setCarregandoGrupos] = useState(true);
  const [modoGrupo, setModoGrupo] = useState<'existente' | 'novo'>('novo');
  const [grupoExistenteId, setGrupoExistenteId] = useState<number | ''>('');
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCarregandoGrupos(true);
    apiRequest<GrupoOption[]>(`/academic/groups?turmaId=${turmaId}`)
      .then(setGruposDaTurma)
      .catch((err: any) => showToast(err.message || 'Erro ao carregar grupos da turma.', 'error'))
      .finally(() => setCarregandoGrupos(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modoGrupo === 'existente' && !grupoExistenteId) {
      showToast('Selecione o grupo ao qual você pertence.', 'error');
      return;
    }
    if (modoGrupo === 'novo' && !novoGrupoNome.trim()) {
      showToast('Informe o nome do grupo.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { turmaId };
      if (modoGrupo === 'existente') body.grupoId = Number(grupoExistenteId);
      else body.grupoNome = novoGrupoNome.trim();

      const res = await apiRequest<{ message: string; grupoId: number; membros: GrupoMembro[] }>(
        '/academic/my-enrollment',
        { method: 'POST', body: JSON.stringify(body) }
      );
      showToast(res.message, 'success');
      if (res.grupoId) onConfirmado(res.grupoId, res.membros || []);
    } catch (err: any) {
      showToast(err.message || 'Não foi possível confirmar o grupo.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setModoGrupo('novo')}
          className={`btn btn-sm ${modoGrupo === 'novo' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Criar novo grupo
        </button>
        <button
          type="button"
          onClick={() => setModoGrupo('existente')}
          className={`btn btn-sm ${modoGrupo === 'existente' ? 'btn-primary' : 'btn-secondary'}`}
          disabled={gruposDaTurma.length === 0}
        >
          <LogIn size={14} /> Entrar em um grupo existente ({gruposDaTurma.length})
        </button>
      </div>

      {modoGrupo === 'novo' ? (
        <div className="form-group">
          <label className="form-label required">Nome do grupo</label>
          <input
            type="text"
            className="form-control"
            placeholder="Ex: Grupo Marcopolo"
            value={novoGrupoNome}
            onChange={(e) => setNovoGrupoNome(e.target.value)}
          />
          <div className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>
            Se já existir um grupo com este nome nesta turma, você entrará nele em vez de criar um duplicado.
          </div>
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label required">Grupo</label>
          {carregandoGrupos ? (
            <div className="text-muted text-sm">Carregando grupos da turma...</div>
          ) : (
            <select
              className="form-control"
              value={grupoExistenteId}
              onChange={(e: any) => setGrupoExistenteId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">-- Selecione o grupo --</option>
              {gruposDaTurma.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome} ({g.total_integrantes || 0} integrante{g.total_integrantes === 1 ? '' : 's'})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="btn btn-secondary">
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1 }}>
          {submitting ? 'Confirmando...' : textoBotao}
        </button>
      </div>
    </form>
  );
};

export const MeuGrupoAlunoView: React.FC = () => {
  const { showToast } = useToast();

  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [minhasMatriculas, setMinhasMatriculas] = useState<MinhaMatricula[]>([]);
  const [loading, setLoading] = useState(true);

  const [turmaSelecionada, setTurmaSelecionada] = useState<number | ''>('');
  const [trocandoGrupoDaTurma, setTrocandoGrupoDaTurma] = useState<number | null>(null);

  const [membrosPorGrupo, setMembrosPorGrupo] = useState<Record<number, GrupoMembro[]>>({});

  const carregar = async () => {
    setLoading(true);
    try {
      const [t, m] = await Promise.all([
        apiRequest<TurmaOption[]>('/academic/classes'),
        apiRequest<MinhaMatricula[]>('/academic/my-enrollment')
      ]);
      setTurmas(t);
      setMinhasMatriculas(m);

      // Pré-carrega os integrantes dos grupos que o aluno já integra.
      const idsGrupos = m.filter((x) => x.grupo_id).map((x) => x.grupo_id as number);
      await Promise.all(
        idsGrupos.map(async (grupoId) => {
          try {
            const membros = await apiRequest<GrupoMembro[]>(`/academic/groups/${grupoId}/membros`);
            setMembrosPorGrupo((prev) => ({ ...prev, [grupoId]: membros }));
          } catch {
            /* segue sem os integrantes deste grupo */
          }
        })
      );
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar turmas e matrículas.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const turmasDisponiveis = useMemo(() => {
    const idsJaMatriculado = new Set(minhasMatriculas.map((m) => m.turma_id));
    return turmas.filter((t) => !idsJaMatriculado.has(t.id));
  }, [turmas, minhasMatriculas]);

  const handleNovaMatricula = async (grupoId: number, membros: GrupoMembro[]) => {
    setMembrosPorGrupo((prev) => ({ ...prev, [grupoId]: membros }));
    setTurmaSelecionada('');
    await carregar();
  };

  const handleTrocaConfirmada = async (grupoId: number, membros: GrupoMembro[]) => {
    setMembrosPorGrupo((prev) => ({ ...prev, [grupoId]: membros }));
    setTrocandoGrupoDaTurma(null);
    await carregar();
  };

  if (loading) return <div className="p-4 text-center">Carregando suas turmas e grupos...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Meus Grupos PBL</h2>
          <p className="text-muted text-sm">
            Selecione sua turma e informe o grupo ao qual você pertence. Se um colega já criou o
            grupo, basta escolher o mesmo nome — vocês serão vinculados automaticamente. Você
            também pode indicar um colega diretamente pelo nome ou e-mail dele, e trocar de grupo
            a qualquer momento.
          </p>
        </div>
        <button onClick={carregar} className="btn btn-secondary btn-sm">
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      {/* Matrículas já confirmadas */}
      {minhasMatriculas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }} className="mb-4">
          {minhasMatriculas.map((m) => (
            <div key={m.matricula_id} className="card" style={{ padding: '1.25rem' }}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={16} color="#16a34a" />
                <span className="font-bold">{m.turma_nome}</span>
              </div>
              <div className="text-muted text-sm mb-2">{m.turma_codigo}</div>

              {m.grupo_nome ? (
                <>
                  <div className="pill-tag pill-tag-green" style={{ marginBottom: '0.5rem' }}>
                    <Users size={12} /> {m.grupo_nome}
                  </div>
                  {membrosPorGrupo[m.grupo_id as number]?.length ? (
                    <ul className="text-sm text-muted" style={{ paddingLeft: '1rem', margin: 0 }}>
                      {membrosPorGrupo[m.grupo_id as number].map((membro) => (
                        <li key={membro.id}>{membro.nome}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-muted text-sm">Você é o único integrante até o momento.</div>
                  )}

                  <AdicionarColega
                    grupoId={m.grupo_id as number}
                    onAdicionado={(grupoId, membros) =>
                      setMembrosPorGrupo((prev) => ({ ...prev, [grupoId]: membros }))
                    }
                  />
                </>
              ) : (
                <span className="text-muted text-sm">Sem grupo definido nesta turma.</span>
              )}

              {trocandoGrupoDaTurma === m.turma_id ? (
                <SeletorGrupo
                  turmaId={m.turma_id}
                  onConfirmado={handleTrocaConfirmada}
                  onCancelar={() => setTrocandoGrupoDaTurma(null)}
                  textoBotao="Confirmar Novo Grupo"
                />
              ) : (
                <button
                  onClick={() => setTrocandoGrupoDaTurma(m.turma_id)}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '0.5rem' }}
                >
                  <Repeat size={14} /> {m.grupo_nome ? 'Trocar de grupo' : 'Escolher grupo'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Matrícula em uma turma nova */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <UserPlus size={18} />
          Matricular-se em uma nova turma
        </h3>

        {turmasDisponiveis.length === 0 ? (
          <div className="text-muted text-sm">
            Você já está matriculado em todas as turmas disponíveis. Para trocar de grupo, use o
            botão "Trocar de grupo" no card da turma acima.
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label required">Turma</label>
              <select
                className="form-control"
                value={turmaSelecionada}
                onChange={(e: any) => setTurmaSelecionada(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">-- Selecione a sua turma --</option>
                {turmasDisponiveis.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({t.codigo})
                  </option>
                ))}
              </select>
            </div>

            {turmaSelecionada && (
              <SeletorGrupo
                turmaId={turmaSelecionada}
                onConfirmado={handleNovaMatricula}
                textoBotao="Confirmar Matrícula e Grupo"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

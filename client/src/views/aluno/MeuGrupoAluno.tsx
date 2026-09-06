import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { TurmaOption, GrupoOption, GrupoMembro, MinhaMatricula } from '../../types';
import { Users, UserPlus, CheckCircle2, RefreshCw, LogIn } from 'lucide-react';

export const MeuGrupoAlunoView: React.FC = () => {
  const { showToast } = useToast();

  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [minhasMatriculas, setMinhasMatriculas] = useState<MinhaMatricula[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [turmaSelecionada, setTurmaSelecionada] = useState<number | ''>('');
  const [gruposDaTurma, setGruposDaTurma] = useState<GrupoOption[]>([]);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [modoGrupo, setModoGrupo] = useState<'existente' | 'novo'>('novo');
  const [grupoExistenteId, setGrupoExistenteId] = useState<number | ''>('');
  const [novoGrupoNome, setNovoGrupoNome] = useState('');

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

  useEffect(() => {
    if (!turmaSelecionada) {
      setGruposDaTurma([]);
      return;
    }
    setCarregandoGrupos(true);
    apiRequest<GrupoOption[]>(`/academic/groups?turmaId=${turmaSelecionada}`)
      .then(setGruposDaTurma)
      .catch((err: any) => showToast(err.message || 'Erro ao carregar grupos da turma.', 'error'))
      .finally(() => setCarregandoGrupos(false));
  }, [turmaSelecionada]);

  const turmasDisponiveis = useMemo(() => {
    const idsJaMatriculado = new Set(minhasMatriculas.map((m) => m.turma_id));
    return turmas.filter((t) => !idsJaMatriculado.has(t.id));
  }, [turmas, minhasMatriculas]);

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turmaSelecionada) {
      showToast('Selecione a sua turma.', 'error');
      return;
    }
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
      const body: Record<string, unknown> = { turmaId: Number(turmaSelecionada) };
      if (modoGrupo === 'existente') body.grupoId = Number(grupoExistenteId);
      else body.grupoNome = novoGrupoNome.trim();

      const res = await apiRequest<{ message: string; grupoId: number; membros: GrupoMembro[] }>(
        '/academic/my-enrollment',
        { method: 'POST', body: JSON.stringify(body) }
      );
      showToast(res.message, 'success');
      if (res.grupoId) {
        setMembrosPorGrupo((prev) => ({ ...prev, [res.grupoId]: res.membros || [] }));
      }

      setTurmaSelecionada('');
      setGrupoExistenteId('');
      setNovoGrupoNome('');
      setModoGrupo('novo');
      await carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível confirmar sua matrícula e grupo.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-4 text-center">Carregando suas turmas e grupos...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Meus Grupos PBL</h2>
          <p className="text-muted text-sm">
            Selecione sua turma e informe o grupo ao qual você pertence. Se um colega já criou o
            grupo, basta escolher o mesmo nome — vocês serão vinculados automaticamente.
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
                </>
              ) : (
                <span className="text-muted text-sm">Sem grupo definido nesta turma.</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formulário de auto-matrícula */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <UserPlus size={18} />
          {turmasDisponiveis.length > 0 ? 'Matricular-se em uma turma' : 'Trocar de grupo em uma turma já matriculada'}
        </h3>

        <form onSubmit={handleConfirmar}>
          <div className="form-group">
            <label className="form-label required">Turma</label>
            <select
              className="form-control"
              value={turmaSelecionada}
              onChange={(e: any) => setTurmaSelecionada(e.target.value ? Number(e.target.value) : '')}
              required
            >
              <option value="">-- Selecione a sua turma --</option>
              {(turmasDisponiveis.length > 0 ? turmasDisponiveis : turmas).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} ({t.codigo})
                </option>
              ))}
            </select>
          </div>

          {turmaSelecionada && (
            <>
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
            </>
          )}

          <button type="submit" className="btn btn-primary" disabled={submitting || !turmaSelecionada}>
            {submitting ? 'Confirmando...' : 'Confirmar Matrícula e Grupo'}
          </button>
        </form>
      </div>
    </div>
  );
};

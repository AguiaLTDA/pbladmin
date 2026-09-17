import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { GrupoOption, DirecionamentoArquivo, TurmaOption } from '../types';
import { Send, Trash2, UserCheck, Users, BookOpen, Loader2, CheckSquare, ClipboardList } from 'lucide-react';
import { TIPO_PRE_PBL_1, rotuloTipoDocumento } from '../constants/academico';

interface CursoOpcao {
  id: number;
  nome: string;
  codigo?: string;
}

interface AulaGrade {
  professor_id: number;
  professor_nome: string;
  disciplina_nome?: string;
}

interface DirecionarArquivoModalProps {
  arquivoId: number;
  nomeArquivo: string;
  /** Papel do documento no ciclo do PBL; muda o que a tela explica ao admin. */
  tipoDocumento?: string | null;
  onClose: () => void;
  onDirecionado: () => void;
}

/**
 * Direciona um arquivo do gerenciador a partir de <b>curso e turma</b>.
 *
 * O professor deixou de ser o critério de entrada: a coordenação pensa em "esta
 * turma precisa deste material", não em "quais docentes eu marco". Os
 * destinatários saem dos vínculos da grade — quem leciona na turma escolhida
 * recebe —, e a tela mostra antes quem serão, para que a escolha não seja cega.
 * O material fica visível a esses docentes; o que chega ao aluno continua vindo
 * pela atividade publicada.
 */
export const DirecionarArquivoModal: React.FC<DirecionarArquivoModalProps> = ({
  arquivoId,
  nomeArquivo,
  tipoDocumento,
  onClose,
  onDirecionado
}) => {
  const ehPrePBL1 = tipoDocumento === TIPO_PRE_PBL_1;
  const { showToast } = useToast();

  const [cursos, setCursos] = useState<CursoOpcao[]>([]);
  const [turmas, setTurmas] = useState<TurmaOption[]>([]);
  const [grupos, setGrupos] = useState<GrupoOption[]>([]);

  const [cursoId, setCursoId] = useState<number | ''>('');
  const [turmasEscolhidas, setTurmasEscolhidas] = useState<number[]>([]);
  const [gruposEscolhidos, setGruposEscolhidos] = useState<number[]>([]);
  const [observacao, setObservacao] = useState('');

  const [docentesPrevistos, setDocentesPrevistos] = useState<AulaGrade[]>([]);
  const [carregandoDocentes, setCarregandoDocentes] = useState(false);

  const [existentes, setExistentes] = useState<DirecionamentoArquivo[]>([]);
  const [enviando, setEnviando] = useState(false);

  const carregarExistentes = () => {
    apiRequest<DirecionamentoArquivo[]>(`/files/${arquivoId}/direcionamentos`)
      .then(setExistentes)
      .catch(() => setExistentes([]));
  };

  useEffect(() => {
    apiRequest<CursoOpcao[]>('/academic/courses')
      .then(setCursos)
      .catch((err: any) => showToast(err.message || 'Erro ao listar cursos.', 'error'));
    apiRequest<TurmaOption[]>('/academic/classes')
      .then(setTurmas)
      .catch(() => setTurmas([]));
    carregarExistentes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivoId]);

  const turmasDoCurso = useMemo(() => {
    if (cursoId === '') return [];
    const curso = cursos.find((c) => c.id === Number(cursoId));
    // O endpoint de turmas devolve o nome do curso, não o id — comparar pelo
    // nome é o que os dois lados têm em comum aqui.
    return turmas.filter((t) => t.curso_nome === curso?.nome);
  }, [turmas, cursos, cursoId]);

  // Grupos só existem por turma, então dependem das turmas marcadas.
  useEffect(() => {
    if (turmasEscolhidas.length === 0) {
      setGrupos([]);
      setGruposEscolhidos([]);
      return;
    }
    Promise.all(
      turmasEscolhidas.map((turmaId) =>
        apiRequest<GrupoOption[]>(`/academic/groups?turmaId=${turmaId}`).catch(() => [] as GrupoOption[])
      )
    ).then((listas) => setGrupos(listas.flat()));
  }, [turmasEscolhidas]);

  /**
   * Quem vai receber, mostrado antes do envio. Sem esta prévia, a coordenação
   * escolheria uma turma sem saber se ela tem docente vinculado — e só
   * descobriria pelo erro depois de clicar.
   */
  useEffect(() => {
    if (turmasEscolhidas.length === 0) {
      setDocentesPrevistos([]);
      return;
    }
    setCarregandoDocentes(true);
    Promise.all(
      turmasEscolhidas.map((turmaId) =>
        apiRequest<AulaGrade[]>(`/academic/schedule?turmaId=${turmaId}`).catch(() => [] as AulaGrade[])
      )
    )
      .then((listas) => {
        const mapa = new Map<number, AulaGrade>();
        listas.flat().forEach((a) => {
          if (a.professor_id && !mapa.has(a.professor_id)) mapa.set(a.professor_id, a);
        });
        setDocentesPrevistos(
          Array.from(mapa.values()).sort((a, b) => a.professor_nome.localeCompare(b.professor_nome, 'pt-BR'))
        );
      })
      .finally(() => setCarregandoDocentes(false));
  }, [turmasEscolhidas]);

  const alternar = (lista: number[], id: number, set: (v: number[]) => void) =>
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const handleDirecionar = async () => {
    if (cursoId === '' && turmasEscolhidas.length === 0) {
      showToast('Escolha um curso ou marque ao menos uma turma.', 'error');
      return;
    }

    // Curso sem turma marcada alcança o curso inteiro — é uma decisão grande o
    // bastante para merecer confirmação explícita.
    if (turmasEscolhidas.length === 0) {
      const curso = cursos.find((c) => c.id === Number(cursoId));
      if (
        !window.confirm(
          `Nenhuma turma marcada: "${nomeArquivo}" será direcionado aos docentes de TODAS as turmas ativas de ${curso?.nome}. Confirma?`
        )
      ) {
        return;
      }
    }

    setEnviando(true);
    try {
      const res = await apiRequest<{ message: string }>(`/files/${arquivoId}/direcionamentos`, {
        method: 'POST',
        body: JSON.stringify({
          cursoIds: cursoId === '' ? [] : [Number(cursoId)],
          turmaIds: turmasEscolhidas,
          grupoIds: gruposEscolhidos,
          observacao: observacao.trim() || undefined
        })
      });
      showToast(res.message, 'success');
      setObservacao('');
      carregarExistentes();
      onDirecionado();
    } catch (err: any) {
      showToast(err.message || 'Erro ao direcionar o arquivo.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const handleRemover = async (direcionamento: DirecionamentoArquivo) => {
    if (!window.confirm(`Remover o direcionamento para ${direcionamento.professor_nome}?`)) return;

    try {
      const res = await apiRequest<{ message: string }>(`/files/direcionamentos/${direcionamento.id}`, {
        method: 'DELETE'
      });
      showToast(res.message, 'success');
      carregarExistentes();
      onDirecionado();
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover o direcionamento.', 'error');
    }
  };

  const alvoTexto = (d: DirecionamentoArquivo) =>
    [d.curso_nome, d.turma_nome, d.disciplina_nome, d.grupo_nome].filter(Boolean).join(' • ') ||
    'Sem turma específica';

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '760px' }}>
        <div className="modal-header">
          <h3 className="font-bold flex items-center gap-2">
            <Send size={20} color="var(--primary)" />
            Direcionar arquivo
          </h3>
          <button onClick={onClose} className="btn btn-sm btn-secondary">X</button>
        </div>

        <div className="modal-body">
          <p className="text-muted text-sm mb-4">
            Enviando <strong>{nomeArquivo}</strong>. Escolha o <strong>curso</strong> e, se quiser
            restringir, as <strong>turmas</strong>. Os docentes vinculados a essas turmas recebem o
            material automaticamente — não é preciso selecioná-los.
          </p>

          {/* O Pré-PBL 1 existe para ser revisado antes de virar PBL 1: dizer
              isso aqui evita que a coordenação o trate como material de aula. */}
          {ehPrePBL1 && (
            <div
              className="card text-sm"
              style={{ padding: '0.7rem 0.9rem', marginBottom: '1rem', borderLeft: '3px solid #b45309' }}
            >
              <div className="font-bold flex items-center gap-2" style={{ marginBottom: '0.25rem' }}>
                <ClipboardList size={14} color="#b45309" /> {rotuloTipoDocumento(tipoDocumento)}
              </div>
              Os docentes das turmas escolhidas poderão comentar e sugerir alterações neste arquivo em
              "Materiais Recebidos". As sugestões chegam a você na aba <strong>Revisão Docente →
              Sugestões de materiais</strong> e ficam visíveis também aos demais professores da mesma
              turma. Os alunos não veem nada disso.
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Curso</label>
            <select
              className="form-control"
              value={cursoId}
              onChange={(e) => {
                setCursoId(e.target.value ? Number(e.target.value) : '');
                // As turmas marcadas pertencem ao curso anterior: mantê-las
                // direcionaria para onde a coordenação não está olhando.
                setTurmasEscolhidas([]);
                setGruposEscolhidos([]);
              }}
            >
              <option value="">-- Selecione o curso --</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {cursoId !== '' && (
            <>
              <div className="form-group">
                <div className="flex items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Turmas {turmasEscolhidas.length === 0 && '(nenhuma marcada = todas as turmas do curso)'}
                  </label>

                  {turmasDoCurso.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setTurmasEscolhidas(
                          turmasEscolhidas.length === turmasDoCurso.length
                            ? []
                            : turmasDoCurso.map((t) => t.id)
                        )
                      }
                      className="btn btn-secondary btn-sm"
                    >
                      <CheckSquare size={13} />
                      {turmasEscolhidas.length === turmasDoCurso.length
                        ? 'Desmarcar todas'
                        : `Marcar todas (${turmasDoCurso.length})`}
                    </button>
                  )}
                </div>
                {turmasDoCurso.length === 0 ? (
                  <span className="text-muted text-sm">Este curso não tem turmas ativas.</span>
                ) : (
                  <div className="flex" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                    {turmasDoCurso.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={turmasEscolhidas.includes(t.id)}
                          onChange={() => alternar(turmasEscolhidas, t.id, setTurmasEscolhidas)}
                        />
                        <BookOpen size={12} /> {t.nome}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {grupos.length > 0 && (
                <div className="form-group">
                  <div className="flex items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>
                      Grupos das turmas marcadas (opcional)
                    </label>

                    {grupos.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setGruposEscolhidos(
                            gruposEscolhidos.length === grupos.length ? [] : grupos.map((g) => g.id)
                          )
                        }
                        className="btn btn-secondary btn-sm"
                      >
                        <CheckSquare size={13} />
                        {gruposEscolhidos.length === grupos.length
                          ? 'Desmarcar todos'
                          : `Marcar todos (${grupos.length})`}
                      </button>
                    )}
                  </div>
                  <div className="flex" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                    {grupos.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={gruposEscolhidos.includes(g.id)}
                          onChange={() => alternar(gruposEscolhidos, g.id, setGruposEscolhidos)}
                        />
                        <Users size={12} /> {g.nome}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Quem receberá — mostrado antes de clicar, não depois do erro. */}
              {turmasEscolhidas.length > 0 && (
                <div className="card" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
                  <div className="font-bold text-sm mb-2 flex items-center gap-2">
                    <UserCheck size={14} color="var(--primary)" />
                    {carregandoDocentes
                      ? 'Verificando quem leciona nestas turmas...'
                      : `${docentesPrevistos.length} docente(s) receberão este material`}
                  </div>

                  {carregandoDocentes ? (
                    <Loader2 size={14} className="animate-spin text-muted" />
                  ) : docentesPrevistos.length === 0 ? (
                    <div className="text-sm" style={{ color: '#b45309' }}>
                      Nenhum docente está vinculado às turmas marcadas. Vincule um professor à turma
                      antes de direcionar, senão o material não chega a ninguém.
                    </div>
                  ) : (
                    <div className="text-muted text-sm">
                      {docentesPrevistos.map((d) => d.professor_nome).join(' · ')}
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Observação (opcional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: material base para o PBL deste semestre"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </div>
            </>
          )}

          {existentes.length > 0 && (
            <div className="mt-4">
              <div className="font-bold text-sm mb-2">Direcionamentos deste arquivo:</div>
              <div className="flex flex-col gap-2">
                {existentes.map((d) => (
                  <div
                    key={d.id}
                    className="card flex items-center justify-between gap-2"
                    style={{ padding: '0.6rem 0.85rem', flexWrap: 'wrap' }}
                  >
                    <div>
                      <div className="text-sm font-bold flex items-center gap-2">
                        <UserCheck size={14} color="var(--primary)" /> {d.professor_nome}
                      </div>
                      <div className="text-muted text-sm">{alvoTexto(d)}</div>
                      {d.observacao && <div className="text-sm mt-1">{d.observacao}</div>}
                    </div>
                    <button onClick={() => handleRemover(d)} className="btn btn-secondary btn-sm">
                      <Trash2 size={14} /> Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">Fechar</button>
          <button
            onClick={handleDirecionar}
            disabled={enviando || cursoId === ''}
            className="btn btn-primary"
          >
            <Send size={16} /> {enviando ? 'Direcionando...' : 'Direcionar'}
          </button>
        </div>
      </div>
    </div>
  );
};

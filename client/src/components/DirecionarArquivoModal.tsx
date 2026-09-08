import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { ProfessorBindings, GrupoOption, DirecionamentoArquivo } from '../types';
import { Send, Trash2, UserCheck, Users } from 'lucide-react';

interface Professor {
  id: number;
  nome: string;
  email: string;
  ativo?: number;
}

interface DirecionarArquivoModalProps {
  arquivoId: number;
  nomeArquivo: string;
  onClose: () => void;
  onDirecionado: () => void;
}

/**
 * Direciona um arquivo do gerenciador a um ou mais docentes. Os alvos
 * (turma, disciplina, grupo) vêm dos vínculos reais de cada professor
 * escolhido — o servidor recusa alvo que não seja dele. O material fica
 * visível apenas ao destinatário.
 */
export const DirecionarArquivoModal: React.FC<DirecionarArquivoModalProps> = ({
  arquivoId,
  nomeArquivo,
  onClose,
  onDirecionado
}) => {
  const { showToast } = useToast();

  const [professores, setProfessores] = useState<Professor[]>([]);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [vinculos, setVinculos] = useState<ProfessorBindings | null>(null);
  const [grupos, setGrupos] = useState<GrupoOption[]>([]);
  const [carregandoVinculos, setCarregandoVinculos] = useState(false);

  const [turmasEscolhidas, setTurmasEscolhidas] = useState<number[]>([]);
  const [disciplinasEscolhidas, setDisciplinasEscolhidas] = useState<number[]>([]);
  const [gruposEscolhidos, setGruposEscolhidos] = useState<number[]>([]);
  const [observacao, setObservacao] = useState('');

  const [existentes, setExistentes] = useState<DirecionamentoArquivo[]>([]);
  const [enviando, setEnviando] = useState(false);

  const carregarExistentes = () => {
    apiRequest<DirecionamentoArquivo[]>(`/files/${arquivoId}/direcionamentos`)
      .then(setExistentes)
      .catch(() => setExistentes([]));
  };

  useEffect(() => {
    apiRequest<Professor[]>('/academic/users?perfil=PROFESSOR')
      .then((lista) => setProfessores(lista.filter((p) => p.ativo)))
      .catch((err: any) => showToast(err.message || 'Erro ao listar professores.', 'error'));
    carregarExistentes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivoId]);

  // Os alvos disponíveis são os do ÚLTIMO professor marcado: com vários docentes
  // selecionados, cada um recebe apenas as turmas que forem dele.
  const professorReferencia = selecionados[selecionados.length - 1];

  useEffect(() => {
    if (!professorReferencia) {
      setVinculos(null);
      setGrupos([]);
      return;
    }
    setCarregandoVinculos(true);
    apiRequest<ProfessorBindings>(`/academic/my-bindings?professorId=${professorReferencia}`)
      .then(setVinculos)
      .catch(() => setVinculos(null))
      .finally(() => setCarregandoVinculos(false));
  }, [professorReferencia]);

  // Grupos só existem por turma, então dependem das turmas marcadas.
  useEffect(() => {
    if (turmasEscolhidas.length === 0) {
      setGrupos([]);
      return;
    }
    Promise.all(
      turmasEscolhidas.map((turmaId) =>
        apiRequest<GrupoOption[]>(`/academic/groups?turmaId=${turmaId}`).catch(() => [] as GrupoOption[])
      )
    ).then((listas) => setGrupos(listas.flat()));
  }, [turmasEscolhidas]);

  const alternar = (lista: number[], valor: number, set: (v: number[]) => void) => {
    set(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
  };

  const handleDirecionar = async () => {
    if (selecionados.length === 0) {
      showToast('Selecione pelo menos um professor.', 'error');
      return;
    }

    setEnviando(true);
    try {
      const res = await apiRequest<{ message: string }>(`/files/${arquivoId}/direcionamentos`, {
        method: 'POST',
        body: JSON.stringify({
          professorIds: selecionados,
          turmaIds: turmasEscolhidas,
          disciplinaIds: disciplinasEscolhidas,
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
          <p className="text-muted text-sm mb-3">
            <strong>{nomeArquivo}</strong> — o arquivo fica visível apenas para os docentes escolhidos.
            O material do aluno continua vindo pela atividade PBL publicada.
          </p>

          <div className="form-group">
            <label className="form-label required">Professores</label>
            <div
              style={{
                maxHeight: '160px',
                overflowY: 'auto',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: '8px',
                padding: '0.5rem'
              }}
            >
              {professores.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                  style={{ padding: '0.2rem 0' }}
                >
                  <input
                    type="checkbox"
                    checked={selecionados.includes(p.id)}
                    onChange={() => alternar(selecionados, p.id, setSelecionados)}
                  />
                  {p.nome}
                  <span className="text-muted">({p.email})</span>
                </label>
              ))}
            </div>
          </div>

          {selecionados.length > 0 && (
            <>
              <div className="text-muted text-sm mb-2">
                Alvos abaixo são os vínculos de <strong>{vinculos ? `${professores.find((p) => p.id === professorReferencia)?.nome}` : '...'}</strong>.
                Cada docente selecionado recebe só as turmas que forem dele.
              </div>

              {carregandoVinculos ? (
                <div className="text-muted text-sm mb-3">Carregando turmas e disciplinas...</div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Turmas</label>
                    {vinculos?.turmas?.length ? (
                      <div className="flex" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                        {vinculos.turmas.map((t) => (
                          <label key={t.id} className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={turmasEscolhidas.includes(t.id)}
                              onChange={() => alternar(turmasEscolhidas, t.id, setTurmasEscolhidas)}
                            />
                            {t.nome} ({t.codigo})
                          </label>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted text-sm">
                        Este docente não tem turmas no horário — o arquivo irá sem turma específica.
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Disciplinas</label>
                    {vinculos?.disciplinas?.length ? (
                      <div className="flex" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                        {vinculos.disciplinas.map((d) => (
                          <label key={d.id} className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={disciplinasEscolhidas.includes(d.id)}
                              onChange={() => alternar(disciplinasEscolhidas, d.id, setDisciplinasEscolhidas)}
                            />
                            {d.nome}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted text-sm">Nenhuma disciplina vinculada.</span>
                    )}
                  </div>

                  {grupos.length > 0 && (
                    <div className="form-group">
                      <label className="form-label">Grupos das turmas marcadas</label>
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
                </>
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
          <button onClick={handleDirecionar} disabled={enviando} className="btn btn-primary">
            <Send size={16} /> {enviando ? 'Direcionando...' : 'Direcionar'}
          </button>
        </div>
      </div>
    </div>
  );
};

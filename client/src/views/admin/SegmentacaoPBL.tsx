import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { RuleInput } from '../../types';
import { Users, Filter, CheckCircle2, UserX, ArrowRight, ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface Props {
  activityId: string;
  navigate: (path: string) => void;
}

interface PreviewResult {
  totalAlunosUnicos: number;
  totalCursos: number;
  totalTurmas: number;
  totalGrupos: number;
  alunosIncluidos: Array<{ id: number; nome: string; email: string; turmaNome?: string }>;
  alunosExcluidos: Array<{ id: number; nome: string; email: string; motivo?: string }>;
}

export const SegmentacaoPBLView: React.FC<Props> = ({ activityId, navigate }) => {
  const { showToast } = useToast();

  const [regras, setRegras] = useState<RuleInput[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Entities options loaded from API
  const [courses, setCourses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  // New Rule Form State
  const [newTipo, setNewTipo] = useState<'curso' | 'disciplina' | 'turma' | 'grupo' | 'aluno'>('turma');
  const [newEntidadeId, setNewEntidadeId] = useState<number | ''>('');
  const [newAcao, setNewAcao] = useState<'INCLUIR' | 'EXCLUIR'>('INCLUIR');

  useEffect(() => {
    // Load academic entities
    Promise.all([
      apiRequest('/academic/courses'),
      apiRequest('/academic/classes'),
      apiRequest('/academic/groups'),
      apiRequest('/academic/users?perfil=ALUNO')
    ])
      .then(([c, cl, g, s]) => {
        setCourses(c);
        setClasses(cl);
        setGroups(g);
        setStudents(s);

        // Pre-select first class if available as initial rule
        if (cl.length > 0) {
          const initialRule: RuleInput = { entidadeTipo: 'turma', entidadeId: cl[0].id, acao: 'INCLUIR' };
          setRegras([initialRule]);
          calculatePreview([initialRule]);
        }
      })
      .catch((err) => showToast(err.message, 'error'));
  }, []);

  const calculatePreview = (rules: RuleInput[]) => {
    if (rules.length === 0) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    apiRequest<PreviewResult>('/publication/preview', {
      method: 'POST',
      body: JSON.stringify({ regras: rules })
    })
      .then((res) => setPreview(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoadingPreview(false));
  };

  const handleAddRule = () => {
    if (!newEntidadeId) {
      showToast('Selecione um item para adicionar à regra.', 'warning');
      return;
    }

    const rule: RuleInput = {
      entidadeTipo: newTipo,
      entidadeId: Number(newEntidadeId),
      acao: newAcao
    };

    const updated = [...regras, rule];
    setRegras(updated);
    calculatePreview(updated);
    setNewEntidadeId('');
  };

  const handleRemoveRule = (index: number) => {
    const updated = regras.filter((_, i) => i !== index);
    setRegras(updated);
    calculatePreview(updated);
  };

  const getEntityName = (tipo: string, id: number) => {
    if (tipo === 'curso') return courses.find((x) => x.id === id)?.nome || `Curso #${id}`;
    if (tipo === 'turma') return classes.find((x) => x.id === id)?.nome || `Turma #${id}`;
    if (tipo === 'grupo') return groups.find((x) => x.id === id)?.nome || `Grupo #${id}`;
    if (tipo === 'aluno') return students.find((x) => x.id === id)?.nome || `Aluno #${id}`;
    return `#${id}`;
  };

  const handleProceed = () => {
    if (!preview || preview.totalAlunosUnicos === 0) {
      showToast('A segmentação deve alcançar ao menos 1 aluno para prosseguir.', 'warning');
      return;
    }

    // Pass rules to publishing screen via localStorage
    localStorage.setItem(`pbl_segmentation_${activityId}`, JSON.stringify({ regras }));
    navigate(`/admin/agendamento/${activityId}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(`/admin/revisao/${activityId}`)} className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          Voltar para Revisão
        </button>
        <span className="font-bold text-sm text-muted">ETAPA 2 DE 3: SEGMENTAÇÃO DE PÚBLICO</span>
      </div>

      <div className="card mb-4">
        <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Definição do Público Alvo da Atividade</h2>
        <p className="text-muted text-sm">
          Selecione os cursos, turmas, grupos ou alunos individuais que receberão este PBL. Você também pode incluir uma turma inteira e adicionar exceções (excluir alunos específicos).
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Painel de Regras */}
        <div className="card">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Filter size={18} color="var(--primary)" />
            Configuração de Regras de Alcance
          </h3>

          {/* Form Adicionar Regra */}
          <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
            <span className="font-bold text-sm mb-2 block">Adicionar Nova Regra:</span>
            
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <select className="form-control" value={newAcao} onChange={(e: any) => setNewAcao(e.target.value)}>
                  <option value="INCLUIR">INCLUIR (Adicionar ao alcance)</option>
                  <option value="EXCLUIR">EXCLUIR (Remover exceção)</option>
                </select>

                <select className="form-control" value={newTipo} onChange={(e: any) => { setNewTipo(e.target.value); setNewEntidadeId(''); }}>
                  <option value="turma">Turma Completa</option>
                  <option value="grupo">Grupo PBL Específico</option>
                  <option value="curso">Curso Inteiro</option>
                  <option value="aluno">Aluno Individual</option>
                </select>
              </div>

              <select className="form-control" value={newEntidadeId} onChange={(e: any) => setNewEntidadeId(e.target.value)}>
                <option value="">-- Selecione o item --</option>
                {newTipo === 'curso' && courses.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                {newTipo === 'turma' && classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.nome} ({cl.disciplina_nome})</option>)}
                {newTipo === 'grupo' && groups.map((g) => <option key={g.id} value={g.id}>{g.nome} - {g.turma_nome}</option>)}
                {newTipo === 'aluno' && students.map((s) => <option key={s.id} value={s.id}>{s.nome} ({s.email})</option>)}
              </select>

              <button type="button" onClick={handleAddRule} className="btn btn-secondary btn-sm" style={{ marginTop: '0.25rem' }}>
                <Plus size={16} />
                Adicionar Regra
              </button>
            </div>
          </div>

          {/* Regras Ativas */}
          <span className="font-bold text-sm mb-2 block">Regras Ativas ({regras.length}):</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {regras.length === 0 ? (
              <p className="text-muted text-sm">Nenhuma regra definida ainda.</p>
            ) : (
              regras.map((r, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2"
                  style={{
                    borderRadius: '8px',
                    background: r.acao === 'INCLUIR' ? 'var(--primary-light)' : '#fee2e2',
                    border: `1px solid ${r.acao === 'INCLUIR' ? 'var(--primary)' : '#fca5a5'}`
                  }}
                >
                  <div className="text-sm">
                    <strong style={{ color: r.acao === 'INCLUIR' ? 'var(--primary)' : '#991b1b' }}>
                      [{r.acao}] {r.entidadeTipo.toUpperCase()}:
                    </strong>{' '}
                    {getEntityName(r.entidadeTipo, r.entidadeId)}
                  </div>
                  <button onClick={() => handleRemoveRule(idx)} className="btn btn-sm btn-secondary" style={{ padding: '0.2rem' }}>
                    <Trash2 size={14} color="#ef4444" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Prévia de Resultados Calculados */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Users size={18} color="var(--primary)" />
              Prévia do Alcance Nominal em Tempo Real
            </h3>

            {loadingPreview ? (
              <div className="text-muted text-sm text-center py-4">Calculando desduplicação e alcance...</div>
            ) : !preview ? (
              <div className="text-muted text-sm text-center py-4">Adicione regras para visualizar a prévia nominal de alunos.</div>
            ) : (
              <div>
                <div className="grid-kpi mb-4">
                  <div className="kpi-card" style={{ '--kpi-color': '#10b981', '--kpi-bg': '#d1fae5' } as React.CSSProperties}>
                    <div className="kpi-value">{preview.totalAlunosUnicos}</div>
                    <div className="kpi-label">Alunos Únicos Alcançados</div>
                  </div>
                  <div className="kpi-card" style={{ '--kpi-color': '#ef4444', '--kpi-bg': '#fee2e2' } as React.CSSProperties}>
                    <div className="kpi-value">{preview.alunosExcluidos.length}</div>
                    <div className="kpi-label">Alunos Excluídos (Exceções)</div>
                  </div>
                </div>

                {/* Lista Nominal de Alunos Incluídos */}
                <span className="font-bold text-sm mb-2 block">Alunos Incluídos ({preview.alunosIncluidos.length}):</span>
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} className="mb-4">
                  {preview.alunosIncluidos.map((al) => (
                    <div key={al.id} className="flex items-center gap-2 text-sm p-1" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span className="font-bold">{al.nome}</span>
                      <span className="text-muted text-xs">({al.email})</span>
                    </div>
                  ))}
                </div>

                {/* Lista Nominal de Excluídos */}
                {preview.alunosExcluidos.length > 0 && (
                  <div>
                    <span className="font-bold text-sm mb-2 block text-danger">Alunos Explicitamente Excluídos:</span>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {preview.alunosExcluidos.map((al) => (
                        <div key={al.id} className="flex items-center gap-2 text-sm p-1" style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <UserX size={16} color="#ef4444" />
                          <span className="font-bold" style={{ color: '#991b1b' }}>{al.nome}</span>
                          <span className="text-muted text-xs">({al.motivo})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={handleProceed}
              disabled={!preview || preview.totalAlunosUnicos === 0}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
            >
              Avançar para Agendamento & Publicação
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

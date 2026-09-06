import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { PBLStep } from '../../types';
import { Save, Send, Plus, Trash2, ArrowLeft } from 'lucide-react';

interface Props {
  activityId?: string;
  navigate: (path: string) => void;
}

/**
 * Autoria de atividades PBL — exclusiva do Admin. O professor responsável é
 * atribuído aqui e passa a enxergar a atividade (para avaliar as entregas)
 * assim que ela for publicada; ele não cria nem edita o conteúdo.
 */
export const EditorPBLAdminView: React.FC<Props> = ({ activityId, navigate }) => {
  const { showToast } = useToast();
  const isEditing = !!activityId;

  // Entidades Acadêmicas
  const [courses, setCourses] = useState<any[]>([]);
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [professors, setProfessors] = useState<any[]>([]);

  // Campos do Formulário
  const [titulo, setTitulo] = useState('');
  const [cursoId, setCursoId] = useState<number | ''>('');
  const [disciplinaId, setDisciplinaId] = useState<number | ''>('');
  const [periodoLetivoId, setPeriodoLetivoId] = useState<number | ''>('');
  const [professorId, setProfessorId] = useState<number | ''>('');

  const [contextoProblema, setContextoProblema] = useState('');
  const [problemaCentral, setProblemaCentral] = useState('');
  const [objetivosAprendizagem, setObjetivosAprendizagem] = useState('');
  const [competenciasHabilidades, setCompetenciasHabilidades] = useState('');
  const [conhecimentosPrevios, setConhecimentosPrevios] = useState('');
  const [instrucoesGerais, setInstrucoesGerais] = useState('');
  const [perguntasNorteadoras, setPerguntasNorteadoras] = useState('');
  const [produtosEsperados, setProdutosEsperados] = useState('');
  const [formaRealizacao, setFormaRealizacao] = useState<'INDIVIDUAL' | 'GRUPO'>('INDIVIDUAL');
  const [criteriosAvaliacao, setCriteriosAvaliacao] = useState('');
  const [cargaHorariaEstimada, setCargaHorariaEstimada] = useState<number>(10);
  const [observacoesProfessor, setObservacoesProfessor] = useState('');

  // Etapas Dinâmicas do PBL
  const [etapas, setEtapas] = useState<PBLStep[]>([
    { ordem: 1, titulo: 'Análise de Problema e Leitura de Cenário', descricao: '', obrigatoria: true }
  ]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest('/academic/courses'),
      apiRequest('/academic/disciplines'),
      apiRequest('/academic/periods'),
      apiRequest('/academic/users?perfil=PROFESSOR')
    ])
      .then(([c, d, p, profs]) => {
        setCourses(c);
        setDisciplines(d);
        setPeriods(p);
        setProfessors(profs);
        if (p.length > 0 && !periodoLetivoId) setPeriodoLetivoId(p[0].id);
      })
      .catch((err) => showToast(err.message, 'error'));

    if (isEditing) {
      apiRequest(`/pbl/activities/${activityId}`)
        .then((res) => {
          const act = res.atividade;
          const ver = res.versaoAtual;
          setTitulo(act.titulo);
          setCursoId(act.curso_id);
          setDisciplinaId(act.disciplina_id);
          setPeriodoLetivoId(act.periodo_letivo_id);
          setProfessorId(act.professor_id);

          if (ver) {
            setContextoProblema(ver.contexto_problema || '');
            setProblemaCentral(ver.problema_central || '');
            setObjetivosAprendizagem(ver.objetivos_aprendizagem || '');
            setCompetenciasHabilidades(ver.competencias_habilidades || '');
            setConhecimentosPrevios(ver.conhecimentos_previos || '');
            setInstrucoesGerais(ver.instrucoes_gerais || '');
            setPerguntasNorteadoras(ver.perguntas_norteadoras || '');
            setProdutosEsperados(ver.produtos_esperados || '');
            setFormaRealizacao(ver.forma_realizacao || 'INDIVIDUAL');
            setCriteriosAvaliacao(ver.criterios_avaliacao || '');
            setCargaHorariaEstimada(ver.carga_horaria_estimada || 10);
            setObservacoesProfessor(ver.observacoes_professor || '');
          }

          if (res.etapas && res.etapas.length > 0) {
            setEtapas(res.etapas);
          }
        })
        .catch((err) => showToast(err.message, 'error'));
    }
  }, [activityId]);

  const handleAddStep = () => {
    setEtapas((prev) => [...prev, { ordem: prev.length + 1, titulo: '', descricao: '', obrigatoria: true }]);
  };

  const handleRemoveStep = (index: number) => {
    setEtapas((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: string, value: any) => {
    setEtapas((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  };

  const saveActivity = async (submitToAnalysis: boolean = false) => {
    if (!titulo || !cursoId || !disciplinaId || !professorId) {
      showToast('Preencha os campos de Título, Curso, Disciplina e Professor Responsável.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        titulo,
        cursoId: Number(cursoId),
        disciplinaId: Number(disciplinaId),
        periodoLetivoId: Number(periodoLetivoId),
        professorId: Number(professorId),
        contextoProblema,
        problemaCentral,
        objetivosAprendizagem,
        competenciasHabilidades,
        conhecimentosPrevios,
        instrucoesGerais,
        perguntasNorteadoras,
        produtosEsperados,
        formaRealizacao,
        criteriosAvaliacao,
        cargaHorariaEstimada,
        observacoesProfessor,
        etapas
      };

      let targetId = activityId;

      if (isEditing) {
        await apiRequest(`/pbl/activities/${activityId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        const createRes = await apiRequest('/pbl/activities', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        targetId = createRes.id;
      }

      if (submitToAnalysis && targetId) {
        const submitRes = await apiRequest(`/pbl/activities/${targetId}/submit`, { method: 'POST' });
        showToast(submitRes.message, 'success');
      } else {
        showToast('Rascunho salvo com sucesso!', 'success');
      }

      navigate('/admin/caixa-entrada');
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar atividade.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDisciplines = disciplines.filter((d) => !cursoId || d.curso_id === Number(cursoId));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/admin/caixa-entrada')} className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          Voltar
        </button>

        <div className="flex gap-2">
          <button type="button" onClick={() => saveActivity(false)} disabled={submitting} className="btn btn-secondary">
            <Save size={18} />
            Salvar Rascunho
          </button>

          <button type="button" onClick={() => saveActivity(true)} disabled={submitting} className="btn btn-primary">
            <Send size={18} />
            {submitting ? 'Enviando...' : 'Enviar para Análise'}
          </button>
        </div>
      </div>

      <div className="card mb-4">
        <h2 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>
          {isEditing ? 'Editar Atividade PBL' : 'Criar Nova Atividade PBL'}
        </h2>
        <p className="text-muted text-sm">
          Preencha o cenário-problema, etapas e entregas, e atribua o professor responsável pela
          turma. Ele passará a avaliar as entregas assim que a atividade for publicada.
        </p>
      </div>

      <form style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Seção 1: Dados Gerais */}
        <div className="card">
          <h3 className="font-bold mb-4">1. Identificação Geral da Atividade</h3>

          <div className="form-group mb-4">
            <label className="form-label required">Título da Atividade PBL</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: TRANSFORMAÇÃO DIGITAL E CLIMA ORGANIZACIONAL NA EMPRESA X"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label required">Curso</label>
              <select
                className="form-control"
                value={cursoId}
                onChange={(e: any) => {
                  setCursoId(e.target.value);
                  setDisciplinaId('');
                }}
                required
              >
                <option value="">-- Selecione o curso --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Disciplina</label>
              <select className="form-control" value={disciplinaId} onChange={(e: any) => setDisciplinaId(e.target.value)} required>
                <option value="">-- Selecione a disciplina --</option>
                {filteredDisciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Período Letivo</label>
              <select className="form-control" value={periodoLetivoId} onChange={(e: any) => setPeriodoLetivoId(e.target.value)} required>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Professor Responsável</label>
              <select className="form-control" value={professorId} onChange={(e: any) => setProfessorId(e.target.value)} required>
                <option value="">-- Selecione o docente --</option>
                {professors.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({p.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Seção 2: Núcleo PBL */}
        <div className="card">
          <h3 className="font-bold mb-4">2. Núcleo PBL (Cenário, Problema & Objetivos)</h3>

          <div className="form-group mb-4">
            <label className="form-label required">Contexto / Cenário-Problema</label>
            <textarea
              className="form-control"
              style={{ minHeight: '120px' }}
              placeholder="Descreva a situação real ou fictícia contextualizada em que os alunos atuarão..."
              value={contextoProblema}
              onChange={(e) => setContextoProblema(e.target.value)}
            />
          </div>

          <div className="form-group mb-4">
            <label className="form-label required">Problema Central</label>
            <textarea
              className="form-control"
              placeholder="Descreva a pergunta/desafio disparador que os alunos devem solucionar..."
              value={problemaCentral}
              onChange={(e) => setProblemaCentral(e.target.value)}
            />
          </div>

          <div className="form-group mb-4">
            <label className="form-label required">Objetivos de Aprendizagem</label>
            <textarea
              className="form-control"
              placeholder="Liste os objetivos pedagógicos esperados nesta atividade..."
              value={objetivosAprendizagem}
              onChange={(e) => setObjetivosAprendizagem(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Competências e Habilidades</label>
              <textarea
                className="form-control"
                placeholder="Competências técnicas e comportamentais..."
                value={competenciasHabilidades}
                onChange={(e) => setCompetenciasHabilidades(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Conhecimentos Prévios Recomendados</label>
              <textarea
                className="form-control"
                placeholder="Requisitos teóricos prévios..."
                value={conhecimentosPrevios}
                onChange={(e) => setConhecimentosPrevios(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Seção 3: Etapas & Entregas */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">3. Etapas do Processo PBL</h3>
            <button type="button" onClick={handleAddStep} className="btn btn-secondary btn-sm">
              <Plus size={16} /> Adicionar Etapa
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="mb-4">
            {etapas.map((e, idx) => (
              <div
                key={idx}
                style={{
                  padding: '1rem',
                  background: 'var(--bg-main)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm">Etapa #{idx + 1}</span>
                  {etapas.length > 1 && (
                    <button type="button" onClick={() => handleRemoveStep(idx)} className="btn btn-sm btn-secondary">
                      <Trash2 size={14} color="#ef4444" />
                    </button>
                  )}
                </div>

                <div className="form-group mb-2">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Título da Etapa (Ex: Leitura e Diagnóstico)"
                    value={e.titulo}
                    onChange={(ev) => handleStepChange(idx, 'titulo', ev.target.value)}
                  />
                </div>

                <div className="form-group mb-0">
                  <textarea
                    className="form-control"
                    style={{ minHeight: '60px' }}
                    placeholder="Descrição orientadora desta etapa..."
                    value={e.descricao}
                    onChange={(ev) => handleStepChange(idx, 'descricao', ev.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label required">Produtos / Entregas Esperadas</label>
              <textarea
                className="form-control"
                placeholder="Ex: Relatório Executivo em PDF e Apresentação em Pitch..."
                value={produtosEsperados}
                onChange={(e) => setProdutosEsperados(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Critérios de Avaliação & Rubrica</label>
              <textarea
                className="form-control"
                placeholder="Descreva a distribuição de nota e rubrica..."
                value={criteriosAvaliacao}
                onChange={(e) => setCriteriosAvaliacao(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4 items-center mt-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Forma de Realização</label>
              <select className="form-control" value={formaRealizacao} onChange={(e: any) => setFormaRealizacao(e.target.value)}>
                <option value="INDIVIDUAL">Individual</option>
                <option value="GRUPO">Em Grupo</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Carga Horária Estimada (Horas)</label>
              <input
                type="number"
                className="form-control"
                value={cargaHorariaEstimada}
                onChange={(e) => setCargaHorariaEstimada(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Botões de Ação Inferior */}
        <div className="card flex justify-end gap-2">
          <button type="button" onClick={() => saveActivity(false)} disabled={submitting} className="btn btn-secondary">
            <Save size={18} /> Salvar Rascunho
          </button>
          <button type="button" onClick={() => saveActivity(true)} disabled={submitting} className="btn btn-primary">
            <Send size={18} /> {submitting ? 'Enviando...' : 'Enviar para Análise'}
          </button>
        </div>
      </form>
    </div>
  );
};

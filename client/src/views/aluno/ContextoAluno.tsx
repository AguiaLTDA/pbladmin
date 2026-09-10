import React, { useEffect, useMemo, useState } from 'react';
import { Award, Briefcase, Loader2, Save } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ContextoAluno, ContextoAlunoInput } from '../../types';
import { MedalhaContexto } from '../../components/MedalhaContexto';

/** As perguntas abertas, na ordem do formulário. As chaves espelham as colunas da API. */
const PERGUNTAS: { campo: keyof ContextoAlunoInput; titulo: string; apoio: string }[] = [
  {
    campo: 'daily_tasks',
    titulo: 'O que você faz no dia a dia do seu trabalho?',
    apoio: 'Descreva suas tarefas e responsabilidades habituais.'
  },
  {
    campo: 'workplace_challenges',
    titulo: 'Quais problemas ou desafios você enfrenta no trabalho?',
    apoio: 'Situações que te travam, se repetem ou dão retrabalho.'
  },
  {
    campo: 'relevant_experience',
    titulo: 'Você tem alguma experiência profissional anterior relevante?',
    apoio: 'Empregos, estágios, negócio próprio ou trabalho voluntário.'
  },
  {
    campo: 'key_learnings',
    titulo: 'O que você já aprendeu na prática que considera importante?',
    apoio: 'Aprendizados que vieram do trabalho, não da sala de aula.'
  },
  {
    campo: 'course_connection',
    titulo: 'Como o seu curso se conecta com o que você vive no trabalho?',
    apoio: 'Onde a teoria encosta na sua rotina — e onde não encosta.'
  },
  {
    campo: 'career_goals',
    titulo: 'Onde você quer chegar profissionalmente?',
    apoio: 'Objetivos de carreira a curto e médio prazo.'
  }
];

const PORTES = [
  { valor: '', rotulo: 'Prefiro não informar' },
  { valor: 'mei', rotulo: 'MEI / autônomo' },
  { valor: 'pequena', rotulo: 'Pequena empresa' },
  { valor: 'media', rotulo: 'Média empresa' },
  { valor: 'grande', rotulo: 'Grande empresa' },
  { valor: 'nao_se_aplica', rotulo: 'Não se aplica (não trabalho hoje)' }
];

const vazio: ContextoAlunoInput = {
  work_sector: '',
  company_size: '',
  daily_tasks: '',
  workplace_challenges: '',
  relevant_experience: '',
  key_learnings: '',
  course_connection: '',
  career_goals: ''
};

export const ContextoAlunoView: React.FC = () => {
  const { showToast } = useToast();
  const [form, setForm] = useState<ContextoAlunoInput>(vazio);
  const [contexto, setContexto] = useState<ContextoAluno | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const dados = await apiRequest<ContextoAluno>('/student/context');
        if (!ativo) return;
        setContexto(dados);
        setForm({
          work_sector: dados.workSector ?? '',
          company_size: dados.companySize ?? '',
          daily_tasks: dados.dailyTasks ?? '',
          workplace_challenges: dados.workplaceChallenges ?? '',
          relevant_experience: dados.relevantExperience ?? '',
          key_learnings: dados.keyLearnings ?? '',
          course_connection: dados.courseConnection ?? '',
          career_goals: dados.careerGoals ?? ''
        });
      } catch (err: any) {
        if (ativo) showToast(err?.message || 'Não foi possível carregar seu contexto.', 'error');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [showToast]);

  const minimoCaracteres = contexto?.minimoCaracteres ?? 15;
  const minimoParaMedalha = contexto?.minimoParaMedalha ?? 4;

  /**
   * Progresso calculado localmente enquanto o aluno digita, com o mesmo critério
   * do servidor — sem isso o contador só andaria depois de salvar.
   */
  const respondidas = useMemo(
    () => PERGUNTAS.filter((p) => (form[p.campo] || '').trim().length >= minimoCaracteres).length,
    [form, minimoCaracteres]
  );

  const faltam = Math.max(0, minimoParaMedalha - respondidas);
  const alcancaMedalha = respondidas >= minimoParaMedalha;

  const alterar = (campo: keyof ContextoAlunoInput, valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async () => {
    setSalvando(true);
    try {
      const salvo = await apiRequest<ContextoAluno>('/student/context', {
        method: 'PUT',
        body: JSON.stringify(form)
      });
      setContexto(salvo);
      if (salvo.ganhouMedalha) {
        showToast(`Medalha conquistada: ${salvo.medalha?.titulo}!`, 'success');
      } else if (salvo.perdeuMedalha) {
        showToast(
          `Contexto salvo, mas com menos de ${minimoParaMedalha} respostas a medalha ficou suspensa.`,
          'info'
        );
      } else {
        showToast('Contexto salvo.', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Não foi possível salvar seu contexto.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-muted" style={{ padding: '2rem' }}>
        <Loader2 size={18} className="animate-spin" />
        Carregando seu contexto...
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: '0.5rem' }}>
          <Briefcase size={20} />
          <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Meu Contexto Profissional</h2>
          <MedalhaContexto completo={contexto?.completed} tamanho={18} comRotulo />
        </div>

        <p className="text-muted text-sm" style={{ lineHeight: 1.6 }}>
          Conte como é a sua realidade de trabalho, hoje e antes. Essas respostas orientam a escrita
          dos casos PBL, para que os problemas propostos se pareçam com os que você enfrenta de
          verdade. <strong>Todas as perguntas são opcionais</strong> — responda só o que quiser.
        </p>

        {/* Indicador de progresso e a regra da medalha, na mesma peça: o aluno vê
            quanto falta e por que vale a pena continuar. */}
        <div className="contexto-progresso">
          <div className="flex items-center justify-between" style={{ marginBottom: '0.4rem' }}>
            <span className="text-sm font-bold">
              {respondidas} de {PERGUNTAS.length} respondidas
            </span>
            <span className="text-sm text-muted">Mínimo para a medalha: {minimoParaMedalha}</span>
          </div>

          <div className="contexto-barra" aria-hidden="true">
            <div
              className={`contexto-barra-preenchida ${alcancaMedalha ? 'completa' : ''}`}
              style={{ width: `${Math.min(100, (respondidas / PERGUNTAS.length) * 100)}%` }}
            />
          </div>

          <div className="flex items-center gap-2" style={{ marginTop: '0.6rem' }}>
            <Award size={16} color={alcancaMedalha ? '#b45309' : 'var(--text-muted)'} />
            <span className="text-sm">
              {alcancaMedalha ? (
                <>
                  Você atingiu o critério da medalha <strong>Contexto Completo</strong>
                  {contexto?.completed ? ' — ela já aparece ao lado do seu nome.' : ' — salve para recebê-la.'}
                </>
              ) : (
                <>
                  Responda pelo menos <strong>{minimoParaMedalha}</strong> perguntas
                  {faltam > 0 && ` (faltam ${faltam})`} para ganhar a medalha de{' '}
                  <strong>Contexto Completo</strong> — e ela pode valer horas de atividade
                  complementar.
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="font-bold" style={{ marginBottom: '1rem' }}>Onde você trabalha</h3>

        <div className="grid grid-2" style={{ gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Setor de atuação</label>
            <input
              type="text"
              className="form-control"
              maxLength={100}
              placeholder="Ex.: Saúde, Varejo, Construção civil..."
              value={form.work_sector || ''}
              onChange={(e) => alterar('work_sector', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Porte da empresa</label>
            <select
              className="form-control"
              value={form.company_size || ''}
              onChange={(e) => alterar('company_size', e.target.value)}
            >
              {PORTES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-muted" style={{ fontSize: '0.75rem' }}>
          Estes dois campos ajudam a contextualizar, mas não contam para a medalha.
        </p>
      </div>

      <div className="card">
        <h3 className="font-bold" style={{ marginBottom: '1rem' }}>Sua experiência</h3>

        {PERGUNTAS.map((pergunta) => {
          const valor = form[pergunta.campo] || '';
          const conta = valor.trim().length >= minimoCaracteres;

          return (
            <div className="form-group" key={pergunta.campo}>
              <label className="form-label flex items-center gap-2">
                {pergunta.titulo}
                {conta && <Award size={13} color="#b45309" aria-label="Resposta válida para a medalha" />}
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder={pergunta.apoio}
                value={valor}
                onChange={(e) => alterar(pergunta.campo, e.target.value)}
              />
              {valor.trim().length > 0 && !conta && (
                <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                  Escreva pelo menos {minimoCaracteres} caracteres para esta resposta contar na medalha.
                </span>
              )}
            </div>
          );
        })}

        <button onClick={salvar} className="btn btn-primary" disabled={salvando}>
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {salvando ? 'Salvando...' : 'Salvar meu contexto'}
        </button>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  Search,
  Users
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ContextoAlunoResumo, PanoramaContextos } from '../../types';
import { MedalhaContexto } from '../../components/MedalhaContexto';

const PERGUNTAS: { campo: keyof ContextoAlunoResumo; titulo: string }[] = [
  { campo: 'dailyTasks', titulo: 'O que faz no dia a dia do trabalho' },
  { campo: 'workplaceChallenges', titulo: 'Problemas e desafios que enfrenta' },
  { campo: 'relevantExperience', titulo: 'Experiência profissional anterior' },
  { campo: 'keyLearnings', titulo: 'O que aprendeu na prática' },
  { campo: 'courseConnection', titulo: 'Conexão entre o curso e o trabalho' },
  { campo: 'careerGoals', titulo: 'Objetivos profissionais' }
];

const PORTES: Record<string, string> = {
  mei: 'MEI / autônomo',
  pequena: 'Pequena empresa',
  media: 'Média empresa',
  grande: 'Grande empresa',
  nao_se_aplica: 'Não se aplica'
};

type Situacao = '' | 'completo' | 'incompleto' | 'sem_resposta';

export const ContextosAlunosAdminView: React.FC = () => {
  const { showToast } = useToast();
  const [dados, setDados] = useState<PanoramaContextos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [expandidoId, setExpandidoId] = useState<number | null>(null);

  const [cursoFiltro, setCursoFiltro] = useState<number | ''>('');
  const [turmaFiltro, setTurmaFiltro] = useState<number | ''>('');
  const [grupoFiltro, setGrupoFiltro] = useState<number | ''>('');
  const [situacao, setSituacao] = useState<Situacao>('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await apiRequest<PanoramaContextos>('/student/contexts');
        if (ativo) setDados(res);
      } catch (err: any) {
        if (ativo) showToast(err?.message || 'Não foi possível carregar os contextos.', 'error');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [showToast]);

  const alunos = dados?.alunos || [];

  /**
   * Os seletores são alimentados pelos próprios dados, e não por chamadas
   * separadas de cursos/turmas/grupos: assim nunca aparece no filtro uma turma
   * que não tem nenhum aluno na lista, e o painel não depende de três endpoints
   * ficarem sincronizados entre si.
   */
  const cursos = useMemo(() => {
    const mapa = new Map<number, string>();
    alunos.forEach((a) => mapa.set(a.cursoId, a.cursoNome));
    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    );
  }, [alunos]);

  // Turma e grupo respeitam a hierarquia: escolher o curso reduz as turmas
  // disponíveis, e escolher a turma reduz os grupos.
  const turmas = useMemo(() => {
    const mapa = new Map<number, string>();
    alunos
      .filter((a) => cursoFiltro === '' || a.cursoId === Number(cursoFiltro))
      .forEach((a) => mapa.set(a.turmaId, a.turmaNome));
    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    );
  }, [alunos, cursoFiltro]);

  const grupos = useMemo(() => {
    const mapa = new Map<number, string>();
    alunos
      .filter((a) => cursoFiltro === '' || a.cursoId === Number(cursoFiltro))
      .filter((a) => turmaFiltro === '' || a.turmaId === Number(turmaFiltro))
      .forEach((a) => {
        if (a.grupoId) mapa.set(a.grupoId, a.grupoNome || `Grupo #${a.grupoId}`);
      });
    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    );
  }, [alunos, cursoFiltro, turmaFiltro]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return alunos
      .filter((a) => cursoFiltro === '' || a.cursoId === Number(cursoFiltro))
      .filter((a) => turmaFiltro === '' || a.turmaId === Number(turmaFiltro))
      .filter((a) => grupoFiltro === '' || a.grupoId === Number(grupoFiltro))
      .filter((a) => {
        if (situacao === 'completo') return a.completed;
        if (situacao === 'incompleto') return a.respondeu && !a.completed;
        if (situacao === 'sem_resposta') return !a.respondeu;
        return true;
      })
      .filter(
        (a) =>
          termo === '' ||
          a.nome.toLowerCase().includes(termo) ||
          a.email.toLowerCase().includes(termo) ||
          (a.workSector || '').toLowerCase().includes(termo)
      );
  }, [alunos, cursoFiltro, turmaFiltro, grupoFiltro, situacao, busca]);

  // O resumo acompanha o recorte à vista: filtrar por uma turma deve responder
  // "quantos desta turma responderam", não repetir o número da instituição.
  const resumo = useMemo(
    () => ({
      alunos: filtrados.length,
      completos: filtrados.filter((a) => a.completed).length,
      iniciados: filtrados.filter((a) => a.respondeu && !a.completed).length,
      semResposta: filtrados.filter((a) => !a.respondeu).length
    }),
    [filtrados]
  );

  const limparFiltros = () => {
    setCursoFiltro('');
    setTurmaFiltro('');
    setGrupoFiltro('');
    setSituacao('');
    setBusca('');
  };

  const algumFiltro =
    cursoFiltro !== '' || turmaFiltro !== '' || grupoFiltro !== '' || situacao !== '' || busca !== '';

  /** Exporta o recorte à vista para quem vai escrever o caso PBL fora do portal. */
  const exportarCsv = () => {
    const cabecalho = [
      'Nome', 'E-mail', 'Curso', 'Turma', 'Grupo', 'Situação', 'Respondidas',
      'Setor', 'Porte', ...PERGUNTAS.map((p) => p.titulo)
    ];
    const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = filtrados.map((a) =>
      [
        a.nome, a.email, a.cursoNome, a.turmaNome, a.grupoNome || '—',
        a.completed ? 'Completo' : a.respondeu ? 'Iniciado' : 'Sem resposta',
        `${a.respondidas} de ${dados?.totalPerguntas ?? 6}`,
        a.workSector || '', a.companySize ? PORTES[a.companySize] || a.companySize : '',
        ...PERGUNTAS.map((p) => a[p.campo])
      ].map(escapar).join(';')
    );

    // BOM para o Excel em português abrir os acentos corretamente.
    const blob = new Blob(['﻿' + [cabecalho.map(escapar).join(';'), ...linhas].join('\r\n')], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contextos-alunos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`${filtrados.length} contexto(s) exportado(s).`, 'success');
  };

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-muted" style={{ padding: '2rem' }}>
        <Loader2 size={18} className="animate-spin" />
        Carregando os contextos dos alunos...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Contexto Profissional dos Alunos</h2>
          <p className="text-muted text-sm">
            O que os estudantes relatam sobre a própria realidade de trabalho, para orientar a escrita
            dos casos PBL. Segmentado por curso, turma e grupo.
          </p>
        </div>

        <button onClick={exportarCsv} className="btn btn-secondary" disabled={filtrados.length === 0}>
          <Download size={16} />
          Exportar recorte (CSV)
        </button>
      </div>

      <div className="grid-kpi" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card" style={{ '--kpi-color': '#0284c7', '--kpi-bg': '#e0f2fe' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper"><Users size={22} /></div>
          <div>
            <div className="kpi-value">{resumo.alunos}</div>
            <div className="kpi-label">Alunos no recorte</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#b45309', '--kpi-bg': '#fef3c7' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper"><Award size={22} /></div>
          <div>
            <div className="kpi-value">{resumo.completos}</div>
            <div className="kpi-label">
              Contexto completo
              {resumo.alunos > 0 && ` (${Math.round((resumo.completos / resumo.alunos) * 100)}%)`}
            </div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#7c3aed', '--kpi-bg': '#ede9fe' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper"><Briefcase size={22} /></div>
          <div>
            <div className="kpi-value">{resumo.iniciados}</div>
            <div className="kpi-label">Começaram, não concluíram</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#64748b', '--kpi-bg': '#f1f5f9' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper"><Users size={22} /></div>
          <div>
            <div className="kpi-value">{resumo.semResposta}</div>
            <div className="kpi-label">Ainda não responderam</div>
          </div>
        </div>
      </div>

      <div className="card mb-4" style={{ padding: '0.85rem 1rem' }}>
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={18} className="text-muted" />

          <select
            className="form-control"
            style={{ minWidth: '200px', flex: 1 }}
            value={cursoFiltro}
            onChange={(e) => {
              setCursoFiltro(e.target.value ? Number(e.target.value) : '');
              // Turma e grupo pertencem ao curso anterior: mantê-los produziria
              // uma lista vazia sem explicação aparente.
              setTurmaFiltro('');
              setGrupoFiltro('');
            }}
          >
            <option value="">Todos os cursos ({cursos.length})</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          <select
            className="form-control"
            style={{ minWidth: '190px', flex: 1 }}
            value={turmaFiltro}
            onChange={(e) => {
              setTurmaFiltro(e.target.value ? Number(e.target.value) : '');
              setGrupoFiltro('');
            }}
          >
            <option value="">Todas as turmas ({turmas.length})</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>

          <select
            className="form-control"
            style={{ minWidth: '180px', flex: 1 }}
            value={grupoFiltro}
            onChange={(e) => setGrupoFiltro(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todos os grupos ({grupos.length})</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </select>

          <select
            className="form-control"
            style={{ minWidth: '170px' }}
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as Situacao)}
          >
            <option value="">Qualquer situação</option>
            <option value="completo">Contexto completo</option>
            <option value="incompleto">Iniciado, incompleto</option>
            <option value="sem_resposta">Sem resposta</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3" style={{ marginTop: '0.75rem' }}>
          <div className="flex items-center gap-2" style={{ flex: 1, minWidth: '240px' }}>
            <Search size={16} className="text-muted" />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nome, e-mail ou setor de atuação..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <span className="text-muted text-sm">
            Exibindo {filtrados.length} de {alunos.length} aluno(s).
          </span>

          {algumFiltro && (
            <button onClick={limparFiltros} className="btn btn-secondary btn-sm">
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="card text-center py-8">
          <Briefcase size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">
            {alunos.length === 0 ? 'Nenhum aluno matriculado' : 'Nenhum aluno neste recorte'}
          </h3>
          <p className="text-muted text-sm">
            {alunos.length === 0
              ? 'O panorama lista alunos com matrícula ativa — é a matrícula que informa turma e grupo.'
              : 'Ajuste os filtros de curso, turma, grupo ou situação para ver outros alunos.'}
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Curso / Turma</th>
                <th>Grupo</th>
                <th>Setor de Atuação</th>
                <th>Respostas</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => (
                <React.Fragment key={a.id}>
                  <tr>
                    <td>
                      <button
                        onClick={() => setExpandidoId(expandidoId === a.id ? null : a.id)}
                        className="flex items-center gap-2 font-bold"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', textAlign: 'left' }}
                        title={a.respondeu ? 'Ver as respostas' : 'Este aluno ainda não respondeu'}
                      >
                        {expandidoId === a.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {a.nome}
                        <MedalhaContexto completo={a.completed} tamanho={13} />
                      </button>
                      <div className="text-muted text-sm">{a.email}</div>
                    </td>
                    <td>
                      <div>{a.cursoNome}</div>
                      <div className="text-muted text-sm">{a.turmaNome}</div>
                    </td>
                    <td>{a.grupoNome || <span className="text-muted">sem grupo</span>}</td>
                    <td>
                      {a.workSector || <span className="text-muted">—</span>}
                      {a.companySize && (
                        <div className="text-muted text-sm">{PORTES[a.companySize] || a.companySize}</div>
                      )}
                    </td>
                    <td>
                      {a.respondidas} de {dados?.totalPerguntas ?? 6}
                      {!a.respondeu && <span className="text-muted text-sm"> — sem resposta</span>}
                      {a.respondeu && !a.completed && (
                        <span className="text-muted text-sm"> — incompleto</span>
                      )}
                    </td>
                  </tr>

                  {expandidoId === a.id && (
                    <tr>
                      <td colSpan={5} style={{ background: 'var(--bg-main)' }}>
                        {a.respondeu ? (
                          <div style={{ padding: '0.5rem 0.25rem' }}>
                            {PERGUNTAS.map((pergunta) => {
                              const resposta = String(a[pergunta.campo] || '').trim();
                              return (
                                <div key={pergunta.campo} style={{ marginBottom: '0.9rem' }}>
                                  <div className="font-bold text-sm">{pergunta.titulo}</div>
                                  {resposta ? (
                                    <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                      {resposta}
                                    </div>
                                  ) : (
                                    <div className="text-muted text-sm">Não respondeu esta pergunta.</div>
                                  )}
                                </div>
                              );
                            })}

                            {a.completedAt && (
                              <div className="text-muted text-sm">
                                Medalha conquistada em {new Date(a.completedAt).toLocaleDateString('pt-BR')}.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-muted text-sm" style={{ padding: '0.75rem 0.25rem' }}>
                            Este aluno ainda não preencheu o Contexto Profissional. O formulário é
                            opcional e fica no portal do aluno, em "Meu Contexto Profissional".
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

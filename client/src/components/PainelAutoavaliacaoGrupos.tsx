import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Filter, Layers, Loader2, Search, Star, Users } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { AlunoStatusAutoavaliacao, JanelaAutoavaliacao, PanoramaAutoavaliacao } from '../types';

type Situacao = '' | 'completo' | 'pendente';

interface PainelAutoavaliacaoGruposProps {
  titulo?: string;
  descricao?: string;
  abaInicial?: 'alunos' | 'grupos';
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

/**
 * Panorama da retro-autoavaliação, compartilhado pelo portal do professor
 * ("Autoavaliação dos Grupos que Participo") e do admin ("Autoavaliação dos
 * Grupos"). O recorte de quem aparece é decidido no servidor — a coordenação
 * vê a instituição inteira, o docente só as turmas que leciona.
 */
export const PainelAutoavaliacaoGrupos: React.FC<PainelAutoavaliacaoGruposProps> = ({
  titulo = 'Autoavaliação dos Grupos',
  descricao = 'Quem já avaliou a desenvoltura dos colegas de grupo na rodada corrente, segmentado por curso, turma e grupo.',
  abaInicial = 'alunos'
}) => {
  const { showToast } = useToast();
  const [janelas, setJanelas] = useState<JanelaAutoavaliacao[]>([]);
  const [janelaId, setJanelaId] = useState<number | ''>('');
  const [dados, setDados] = useState<PanoramaAutoavaliacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<'alunos' | 'grupos'>(abaInicial);
  const [grupoExpandido, setGrupoExpandido] = useState<number | null>(null);

  const [cursoFiltro, setCursoFiltro] = useState<number | ''>('');
  const [turmaFiltro, setTurmaFiltro] = useState<number | ''>('');
  const [grupoFiltro, setGrupoFiltro] = useState<number | ''>('');
  const [situacao, setSituacao] = useState<Situacao>('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    apiRequest<JanelaAutoavaliacao[]>('/autoavaliacao/janelas')
      .then(setJanelas)
      .catch(() => setJanelas([]));
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    const query = janelaId ? `?janelaId=${janelaId}` : '';
    apiRequest<PanoramaAutoavaliacao>(`/autoavaliacao/status${query}`)
      .then((res) => {
        if (ativo) setDados(res);
      })
      .catch((err: any) => {
        if (ativo) showToast(err?.message || 'Não foi possível carregar a autoavaliação.', 'error');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [janelaId]);

  const alunos = dados?.alunos || [];

  const cursos = useMemo(() => {
    const mapa = new Map<number, string>();
    alunos.forEach((a) => mapa.set(a.cursoId, a.cursoNome));
    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [alunos]);

  const turmas = useMemo(() => {
    const mapa = new Map<number, string>();
    alunos
      .filter((a) => cursoFiltro === '' || a.cursoId === Number(cursoFiltro))
      .forEach((a) => mapa.set(a.turmaId, a.turmaNome));
    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [alunos, cursoFiltro]);

  const grupos = useMemo(() => {
    const mapa = new Map<number, string>();
    alunos
      .filter((a) => cursoFiltro === '' || a.cursoId === Number(cursoFiltro))
      .filter((a) => turmaFiltro === '' || a.turmaId === Number(turmaFiltro))
      .forEach((a) => mapa.set(a.grupoId, a.grupoNome));
    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [alunos, cursoFiltro, turmaFiltro]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return alunos
      .filter((a) => cursoFiltro === '' || a.cursoId === Number(cursoFiltro))
      .filter((a) => turmaFiltro === '' || a.turmaId === Number(turmaFiltro))
      .filter((a) => grupoFiltro === '' || a.grupoId === Number(grupoFiltro))
      .filter((a) => {
        if (situacao === 'completo') return a.completo;
        if (situacao === 'pendente') return !a.completo;
        return true;
      })
      .filter((a) => termo === '' || a.nome.toLowerCase().includes(termo) || a.email.toLowerCase().includes(termo));
  }, [alunos, cursoFiltro, turmaFiltro, grupoFiltro, situacao, busca]);

  const resumo = useMemo(
    () => ({
      alunos: filtrados.length,
      completos: filtrados.filter((a) => a.completo).length,
      pendentes: filtrados.filter((a) => !a.completo).length
    }),
    [filtrados]
  );

  const gruposAgregados = useMemo(() => {
    const mapa = new Map<
      number,
      { id: number; nome: string; turmaNome: string; cursoNome: string; membros: AlunoStatusAutoavaliacao[] }
    >();
    filtrados.forEach((a) => {
      const atual = mapa.get(a.grupoId) || {
        id: a.grupoId,
        nome: a.grupoNome,
        turmaNome: a.turmaNome,
        cursoNome: a.cursoNome,
        membros: []
      };
      atual.membros.push(a);
      mapa.set(a.grupoId, atual);
    });
    return Array.from(mapa.values())
      .map((g) => ({
        ...g,
        completos: g.membros.filter((m) => m.completo).length,
        membros: g.membros.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      }))
      .sort(
        (a, b) =>
          a.cursoNome.localeCompare(b.cursoNome, 'pt-BR') ||
          a.turmaNome.localeCompare(b.turmaNome, 'pt-BR') ||
          a.nome.localeCompare(b.nome, 'pt-BR')
      );
  }, [filtrados]);

  const limparFiltros = () => {
    setCursoFiltro('');
    setTurmaFiltro('');
    setGrupoFiltro('');
    setSituacao('');
    setBusca('');
  };
  const algumFiltro = cursoFiltro !== '' || turmaFiltro !== '' || grupoFiltro !== '' || situacao !== '' || busca !== '';

  const nomeAluno = (a: AlunoStatusAutoavaliacao) => (
    <span className={a.completo ? 'autoavaliacao-nome-completo' : 'autoavaliacao-nome-pendente'}>{a.nome}</span>
  );

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-muted" style={{ padding: '2rem' }}>
        <Loader2 size={18} className="animate-spin" />
        Carregando a autoavaliação dos grupos...
      </div>
    );
  }

  if (!dados?.janela) {
    return (
      <div className="card text-center py-8">
        <Star size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
        <h3 className="font-bold">Nenhuma rodada de autoavaliação cadastrada</h3>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>{titulo}</h2>
          <p className="text-muted text-sm">{descricao}</p>
        </div>

        {janelas.length > 1 && (
          <select
            className="form-control"
            style={{ minWidth: '220px' }}
            value={janelaId}
            onChange={(e) => setJanelaId(e.target.value ? Number(e.target.value) : '')}
          >
            {janelas.map((j) => (
              <option key={j.id} value={j.id}>
                {j.titulo}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="card mb-4" style={{ padding: '0.85rem 1rem' }}>
        <strong>{dados.janela.titulo}</strong>
        <span className="text-muted text-sm">
          {' '}
          — {formatarData(dados.janela.abreEm)} a {formatarData(dados.janela.fechaEm)}
          {dados.status === 'FUTURA' && ' (ainda não abriu)'}
          {dados.status === 'ENCERRADA' && ' (prazo encerrado)'}
          {dados.status === 'ABERTA' && ' (em andamento)'}
        </span>
      </div>

      <div className="grid-kpi" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card" style={{ '--kpi-color': '#0284c7', '--kpi-bg': '#e0f2fe' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <Users size={22} />
          </div>
          <div>
            <div className="kpi-value">{resumo.alunos}</div>
            <div className="kpi-label">Alunos no recorte</div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#16a34a', '--kpi-bg': '#dcfce7' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <Star size={22} />
          </div>
          <div>
            <div className="kpi-value">{resumo.completos}</div>
            <div className="kpi-label">
              Já avaliaram o grupo
              {resumo.alunos > 0 && ` (${Math.round((resumo.completos / resumo.alunos) * 100)}%)`}
            </div>
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#dc2626', '--kpi-bg': '#fee2e2' } as React.CSSProperties}>
          <div className="kpi-icon-wrapper">
            <Users size={22} />
          </div>
          <div>
            <div className="kpi-value">{resumo.pendentes}</div>
            <div className="kpi-label">Ainda não avaliaram</div>
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
              setTurmaFiltro('');
              setGrupoFiltro('');
            }}
          >
            <option value="">Todos os cursos ({cursos.length})</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
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
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
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
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>

          <select
            className="form-control"
            style={{ minWidth: '170px' }}
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as Situacao)}
          >
            <option value="">Qualquer situação</option>
            <option value="completo">Já avaliaram</option>
            <option value="pendente">Ainda não avaliaram</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3" style={{ marginTop: '0.75rem' }}>
          <div className="flex items-center gap-2" style={{ flex: 1, minWidth: '240px' }}>
            <Search size={16} className="text-muted" />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nome ou e-mail..."
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

      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <button onClick={() => setAba('alunos')} className={`btn btn-sm ${aba === 'alunos' ? 'btn-primary' : 'btn-secondary'}`}>
          <Users size={15} /> Alunos ({filtrados.length})
        </button>
        <button onClick={() => setAba('grupos')} className={`btn btn-sm ${aba === 'grupos' ? 'btn-primary' : 'btn-secondary'}`}>
          <Layers size={15} /> Grupos ({gruposAgregados.length})
        </button>
      </div>

      {aba === 'grupos' ? (
        gruposAgregados.length === 0 ? (
          <div className="card text-center py-8">
            <Layers size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
            <h3 className="font-bold">Nenhum grupo neste recorte</h3>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Grupo PBL</th>
                  <th>Curso / Turma</th>
                  <th>Integrantes</th>
                  <th>Já avaliaram o grupo</th>
                </tr>
              </thead>
              <tbody>
                {gruposAgregados.map((g) => (
                  <React.Fragment key={g.id}>
                    <tr>
                      <td>
                        <button
                          onClick={() => setGrupoExpandido(grupoExpandido === g.id ? null : g.id)}
                          className="flex items-center gap-2 font-bold"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', textAlign: 'left' }}
                        >
                          {grupoExpandido === g.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {g.nome}
                        </button>
                      </td>
                      <td>
                        <div>{g.cursoNome}</div>
                        <div className="text-muted text-sm">{g.turmaNome}</div>
                      </td>
                      <td>{g.membros.length}</td>
                      <td>
                        {g.completos} de {g.membros.length}
                        {g.completos === 0 && <span className="text-muted text-sm"> — ninguém avaliou ainda</span>}
                      </td>
                    </tr>

                    {grupoExpandido === g.id && (
                      <tr>
                        <td colSpan={4} style={{ background: 'var(--bg-main)' }}>
                          <div style={{ padding: '0.5rem 0.25rem' }}>
                            {g.membros.map((m) => (
                              <div key={m.id} className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: '0.6rem' }}>
                                <span className="text-sm font-bold">{nomeAluno(m)}</span>
                                <span className="text-muted text-sm">
                                  Deu {m.notasDadas} de {m.totalColegas} nota(s)
                                  {m.totalNotasRecebidas > 0 &&
                                    ` · recebeu média ${m.mediaRecebida?.toFixed(1)} (${m.totalNotasRecebidas} avaliação${m.totalNotasRecebidas > 1 ? 'ões' : ''})`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-8">
          <Users size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">{alunos.length === 0 ? 'Nenhum aluno com grupo definido' : 'Nenhum aluno neste recorte'}</h3>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Curso / Turma</th>
                <th>Grupo</th>
                <th>Avaliações dadas</th>
                <th>Nota recebida (média)</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="font-bold">{nomeAluno(a)}</div>
                    <div className="text-muted text-sm">{a.email}</div>
                  </td>
                  <td>
                    <div>{a.cursoNome}</div>
                    <div className="text-muted text-sm">{a.turmaNome}</div>
                  </td>
                  <td>{a.grupoNome}</td>
                  <td>
                    {a.notasDadas} de {a.totalColegas}
                  </td>
                  <td>
                    {a.mediaRecebida !== null ? (
                      <>
                        {a.mediaRecebida.toFixed(1)}{' '}
                        <span className="text-muted text-sm">
                          ({a.totalNotasRecebidas} avaliação{a.totalNotasRecebidas > 1 ? 'ões' : ''})
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">— sem avaliações recebidas</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

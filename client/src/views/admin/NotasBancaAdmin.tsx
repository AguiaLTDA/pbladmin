import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Download, Filter, Link2, Loader2, ShieldCheck, Star } from 'lucide-react';
import { apiRequest, baixarBlob } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  AvaliacaoBanca,
  CRITERIOS_BANCA,
  formatarNota,
  notaBanca,
  rotuloStatusBanca
} from '../../components/FormularioAvaliacaoBanca';
import { AvaliacaoBancaPainel } from '../professor/AvaliacaoBancaProfessor';
import { rotuloDiaBanca } from '../../constants/salasBanca';

const notaDaAvaliacao = (a: AvaliacaoBanca) => (a.nota_final != null ? a.nota_final : notaBanca(a));

function exportarCsv(linhas: AvaliacaoBanca[]) {
  const header = [
    'atualizado_em',
    'dia',
    'sala',
    'avaliador_nome',
    'avaliador_email',
    'origem',
    'curso',
    'turma',
    'grupo',
    ...CRITERIOS_BANCA.map((c) => c.key),
    'nota_banca_0_1_3',
    'nota_final',
    'status',
    'pontos_fortes',
    'pontos_melhoria',
    'nao_contribuiram'
  ];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const dados = linhas.map((a) => {
    const nota = notaBanca(a);
    return [
      new Date(a.atualizado_em).toLocaleString('pt-BR'),
      a.dia ?? '',
      a.sala ?? 'Outra sala',
      a.avaliador_nome,
      a.avaliador_email,
      a.origem === 'publico' ? 'formulário público' : 'plataforma',
      a.curso_nome ?? '',
      a.turma_nome,
      a.grupo_nome,
      ...CRITERIOS_BANCA.map((c) => a[c.key]),
      nota.toFixed(2),
      a.nota_final == null ? '' : a.nota_final.toFixed(2),
      rotuloStatusBanca(a.status),
      a.pontos_fortes ?? '',
      a.pontos_melhoria ?? '',
      a.nao_contribuiram ?? ''
    ];
  });
  const csv = '﻿' + [header, ...dados].map((r) => r.map(escape).join(',')).join('\n');
  baixarBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `notas-banca-pbl-${new Date().toISOString().slice(0, 10)}.csv`
  );
}

const NotasBanca: React.FC = () => {
  const { showToast } = useToast();
  const [linhas, setLinhas] = useState<AvaliacaoBanca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [diaFiltro, setDiaFiltro] = useState('');
  const [salaFiltro, setSalaFiltro] = useState('');
  const [turmaFiltro, setTurmaFiltro] = useState<number | ''>('');
  const [grupoFiltro, setGrupoFiltro] = useState<number | ''>('');
  const [aberto, setAberto] = useState<number | null>(null);

  useEffect(() => {
    apiRequest<AvaliacaoBanca[]>('/banca/avaliacoes')
      .then((r) => setLinhas(Array.isArray(r) ? r : []))
      .catch((err) => showToast(err.message || 'Erro ao carregar as notas da banca.', 'error'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opcoes = useMemo(() => {
    const dias = new Set<string>();
    const salas = new Set<string>();
    const turmas = new Map<number, string>();
    const grupos = new Map<number, { nome: string; turma: number }>();
    linhas.forEach((a) => {
      if (a.dia) dias.add(a.dia);
      if (diaFiltro === '' || a.dia === diaFiltro) salas.add(a.sala ?? 'Outra sala');
      turmas.set(a.turma_id, a.turma_nome);
      grupos.set(a.grupo_id, { nome: a.grupo_nome, turma: a.turma_id });
    });
    const ord = <T,>(m: Map<number, T>, nome: (v: T) => string) =>
      Array.from(m.entries()).sort((x, y) => nome(x[1]).localeCompare(nome(y[1]), 'pt-BR'));
    return {
      dias: Array.from(dias).sort(),
      salas: Array.from(salas).sort((x, y) => x.localeCompare(y, 'pt-BR')),
      turmas: ord(turmas, (v) => v),
      grupos: ord(grupos, (v) => v.nome).filter(([, g]) => turmaFiltro === '' || g.turma === turmaFiltro)
    };
  }, [linhas, turmaFiltro, diaFiltro]);

  const filtradas = linhas.filter(
    (a) =>
      (diaFiltro === '' || a.dia === diaFiltro) &&
      (salaFiltro === '' || (a.sala ?? 'Outra sala') === salaFiltro) &&
      (turmaFiltro === '' || a.turma_id === turmaFiltro) &&
      (grupoFiltro === '' || a.grupo_id === grupoFiltro)
  );

  // Média do grupo considera todas as avaliações dele (não só as do filtro de banca).
  const mediaGrupo = useMemo(() => {
    const m = new Map<number, number[]>();
    linhas.forEach((a) => m.set(a.grupo_id, [...(m.get(a.grupo_id) || []), notaDaAvaliacao(a)]));
    return new Map(Array.from(m.entries()).map(([k, v]) => [k, v.reduce((s, n) => s + n, 0) / v.length]));
  }, [linhas]);

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-muted" style={{ padding: '2rem' }}>
        <Loader2 size={18} className="animate-spin" /> Carregando as notas da banca...
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-4" style={{ padding: '0.85rem 1rem' }}>
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={18} className="text-muted" />
          <select className="form-control" style={{ minWidth: '170px', flex: 1 }} value={diaFiltro}
            onChange={(e) => {
              setDiaFiltro(e.target.value);
              setSalaFiltro('');
            }}>
            <option value="">Todos os dias</option>
            {opcoes.dias.map((d) => (
              <option key={d} value={d}>{rotuloDiaBanca(d)}</option>
            ))}
          </select>
          <select className="form-control" style={{ minWidth: '170px', flex: 1 }} value={salaFiltro}
            onChange={(e) => setSalaFiltro(e.target.value)}>
            <option value="">Todas as salas (bancas)</option>
            {opcoes.salas.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
          <select className="form-control" style={{ minWidth: '200px', flex: 1 }} value={turmaFiltro}
            onChange={(e) => {
              setTurmaFiltro(e.target.value ? Number(e.target.value) : '');
              setGrupoFiltro('');
            }}>
            <option value="">Todas as turmas</option>
            {opcoes.turmas.map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>
          <select className="form-control" style={{ minWidth: '200px', flex: 1 }} value={grupoFiltro}
            onChange={(e) => setGrupoFiltro(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Todos os grupos</option>
            {opcoes.grupos.map(([id, g]) => (
              <option key={id} value={id}>{g.nome}</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!filtradas.length}
            onClick={() => exportarCsv(filtradas)}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      <p className="text-muted text-sm mb-2">
        {filtradas.length} {filtradas.length === 1 ? 'avaliação' : 'avaliações'} ·{' '}
        {new Set(filtradas.map((a) => a.grupo_id)).size} grupos. A nota usada na média do grupo é a nota final quando
        informada; senão, a nota da banca pelos critérios do manual (domínio 0,5, clareza e organização 0,3, material 0,2, arguição 0,3; até 1,3), cada um pela média das suas perguntas.
      </p>

      {filtradas.length === 0 ? (
        <div className="card text-center py-8">
          <Star size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhuma avaliação da banca ainda</h3>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Banca (dia · sala)</th>
                <th>Turma</th>
                <th>Grupo</th>
                <th>Avaliador(a)</th>
                <th>Nota da banca</th>
                <th>Nota final</th>
                <th>Status</th>
                <th>Média do grupo</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((a) => (
                <React.Fragment key={a.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setAberto(aberto === a.id ? null : a.id)}>
                    <td>{rotuloDiaBanca(a.dia)} · {a.sala ?? 'Outra sala'}</td>
                    <td>{a.turma_nome}</td>
                    <td><strong>{a.grupo_nome}</strong></td>
                    <td>
                      {a.avaliador_nome}
                      {a.origem === 'publico' && (
                        <span className="text-muted text-sm" style={{ display: 'block' }}>formulário público</span>
                      )}
                    </td>
                    <td>{formatarNota(notaBanca(a))}</td>
                    <td>{formatarNota(a.nota_final)}</td>
                    <td>{rotuloStatusBanca(a.status)}</td>
                    <td><strong>{formatarNota(mediaGrupo.get(a.grupo_id))}</strong></td>
                  </tr>
                  {aberto === a.id && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.03))' }}>
                        <div className="text-sm" style={{ display: 'grid', gap: '0.35rem' }}>
                          {CRITERIOS_BANCA.map((c) => (
                            <div key={c.key}>{c.label}: <strong>{a[c.key]}</strong></div>
                          ))}
                          {a.pontos_fortes && <div><strong>Pontos fortes:</strong> {a.pontos_fortes}</div>}
                          {a.pontos_melhoria && <div><strong>Pontos de melhoria:</strong> {a.pontos_melhoria}</div>}
                          {a.nao_contribuiram && <div><strong>Não contribuíram:</strong> {a.nao_contribuiram}</div>}
                          <div className="text-muted">
                            {a.avaliador_email} · atualizado em {new Date(a.atualizado_em).toLocaleString('pt-BR')}
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
    </div>
  );
};

type EventoPublico = {
  id: number;
  evento: 'ACESSO' | 'IDENTIFICACAO' | 'ENVIO' | 'ACESSO_NEGADO';
  sessao: string | null;
  email: string | null;
  nome: string | null;
  ip: string | null;
  user_agent: string | null;
  criado_em: string;
  avaliacao_id: number | null;
  grupo_nome: string | null;
  turma_nome: string | null;
  detalhes: {
    operacao?: 'CRIADA' | 'ATUALIZADA';
    dia?: string;
    sala?: string | null;
    notas?: Record<string, number>;
    notaSugerida?: number;
    notaFinal?: number | null;
    status?: string;
    pontosFortes?: string | null;
    pontosMelhoria?: string | null;
    naoContribuiram?: string | null;
    tokenInicio?: string;
    xForwardedFor?: string | null;
  } | null;
};

const ROTULO_EVENTO: Record<EventoPublico['evento'], string> = {
  ACESSO: 'Abriu o link',
  IDENTIFICACAO: 'Identificou-se',
  ENVIO: 'Enviou avaliação',
  ACESSO_NEGADO: 'Link inválido'
};

/** Resumo legível do navegador/sistema a partir do User-Agent. */
function dispositivo(ua: string | null): string {
  if (!ua) return '—';
  const so = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Outro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Outro';
  return `${nav} · ${so}`;
}

/** Auditoria do link público: quem abriu, com que e-mail, de qual IP e o que enviou. */
const AuditoriaLinkPublico: React.FC = () => {
  const { showToast } = useToast();
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<EventoPublico['evento'] | ''>('');
  const [aberto, setAberto] = useState<number | null>(null);

  const carregar = () => {
    setCarregando(true);
    apiRequest<EventoPublico[]>('/banca/auditoria-publica')
      .then((r) => setEventos(Array.isArray(r) ? r : []))
      .catch((err) => showToast(err.message || 'Erro ao carregar a auditoria.', 'error'))
      .finally(() => setCarregando(false));
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const termo = busca.trim().toLowerCase();
  const filtrados = eventos.filter(
    (e) =>
      (tipo === '' || e.evento === tipo) &&
      (!termo ||
        [e.email, e.nome, e.ip, e.grupo_nome, e.turma_nome, e.detalhes?.sala].some((v) => (v || '').toLowerCase().includes(termo)))
  );

  const resumo = {
    acessos: eventos.filter((e) => e.evento === 'ACESSO').length,
    avaliadores: new Set(eventos.filter((e) => e.evento === 'IDENTIFICACAO' && e.email).map((e) => e.email)).size,
    envios: eventos.filter((e) => e.evento === 'ENVIO').length,
    negados: eventos.filter((e) => e.evento === 'ACESSO_NEGADO').length
  };

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-muted" style={{ padding: '2rem' }}>
        <Loader2 size={18} className="animate-spin" /> Carregando a auditoria do link público...
      </div>
    );
  }

  return (
    <div>
      <div className="grid-kpi" style={{ marginBottom: '1rem' }}>
        {[
          { v: resumo.acessos, l: 'Aberturas do link', c: '#0284c7', bg: '#e0f2fe' },
          { v: resumo.avaliadores, l: 'E-mails identificados', c: '#16a34a', bg: '#dcfce7' },
          { v: resumo.envios, l: 'Avaliações enviadas', c: '#7c3aed', bg: '#ede9fe' },
          { v: resumo.negados, l: 'Tentativas com link inválido', c: '#dc2626', bg: '#fee2e2' }
        ].map((k) => (
          <div key={k.l} className="kpi-card" style={{ '--kpi-color': k.c, '--kpi-bg': k.bg } as React.CSSProperties}>
            <div className="kpi-icon-wrapper"><ShieldCheck size={22} /></div>
            <div>
              <div className="kpi-value">{k.v}</div>
              <div className="kpi-label">{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mb-4" style={{ padding: '0.85rem 1rem' }}>
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={18} className="text-muted" />
          <input className="form-control" style={{ flex: 2, minWidth: '220px' }} value={busca}
            placeholder="Buscar por e-mail, nome, IP, grupo, turma ou sala"
            onChange={(e) => setBusca(e.target.value)} />
          <select className="form-control" style={{ flex: 1, minWidth: '180px' }} value={tipo}
            onChange={(e) => setTipo(e.target.value as EventoPublico['evento'] | '')}>
            <option value="">Todos os eventos</option>
            {(Object.keys(ROTULO_EVENTO) as EventoPublico['evento'][]).map((k) => (
              <option key={k} value={k}>{ROTULO_EVENTO[k]}</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={carregar}>Atualizar</button>
        </div>
      </div>

      <p className="text-muted text-sm mb-2">
        {filtrados.length} {filtrados.length === 1 ? 'evento' : 'eventos'}. O e-mail de quem abriu o link vem da
        identificação feita na mesma visita. O IP é o de quem acessou (via Cloudflare). Clique numa linha para ver
        os detalhes.
      </p>

      {filtrados.length === 0 ? (
        <div className="card text-center py-8">
          <ShieldCheck size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhum evento registrado</h3>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Evento</th>
                <th>E-mail</th>
                <th>IP</th>
                <th>Dispositivo</th>
                <th>O que fez</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => {
                const d = e.detalhes || {};
                const oQueFez =
                  e.evento === 'ENVIO'
                    ? `${d.operacao === 'ATUALIZADA' ? 'Atualizou' : 'Criou'} a avaliação de ${e.grupo_nome ?? '—'} (${e.turma_nome ?? '—'}) · ${rotuloDiaBanca(d.dia)} · ${d.sala ?? 'Outra sala'} · nota ${formatarNota(d.notaFinal ?? d.notaSugerida ?? null)}`
                    : e.evento === 'IDENTIFICACAO'
                      ? `Entrou como ${e.nome ?? '—'}`
                      : e.evento === 'ACESSO_NEGADO'
                        ? `Token iniciado por "${d.tokenInicio ?? ''}"`
                        : 'Abriu o formulário';
                return (
                  <React.Fragment key={e.id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => setAberto(aberto === e.id ? null : e.id)}>
                      <td>{new Date(e.criado_em).toLocaleString('pt-BR')}</td>
                      <td><strong>{ROTULO_EVENTO[e.evento]}</strong></td>
                      <td>
                        {e.email ?? <span className="text-muted">não identificado</span>}
                        {e.nome && <span className="text-muted text-sm" style={{ display: 'block' }}>{e.nome}</span>}
                      </td>
                      <td className="text-sm">{e.ip ?? '—'}</td>
                      <td className="text-sm">{dispositivo(e.user_agent)}</td>
                      <td className="text-sm">{oQueFez}</td>
                    </tr>
                    {aberto === e.id && (
                      <tr>
                        <td colSpan={6} style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.03))' }}>
                          <div className="text-sm" style={{ display: 'grid', gap: '0.35rem' }}>
                            {e.evento === 'ENVIO' && (
                              <>
                                {CRITERIOS_BANCA.map((c) => (
                                  <div key={c.key}>{c.label}: <strong>{d.notas?.[c.key] ?? '—'}</strong></div>
                                ))}
                                <div>
                                  Nota da banca: <strong>{formatarNota(d.notaSugerida ?? null)}</strong> · Nota final:{' '}
                                  <strong>{formatarNota(d.notaFinal ?? null)}</strong> · Status:{' '}
                                  <strong>{d.status ? rotuloStatusBanca(d.status) : '—'}</strong>
                                </div>
                                {d.pontosFortes && <div><strong>Pontos fortes:</strong> {d.pontosFortes}</div>}
                                {d.pontosMelhoria && <div><strong>Pontos de melhoria:</strong> {d.pontosMelhoria}</div>}
                                {d.naoContribuiram && <div><strong>Não contribuíram:</strong> {d.naoContribuiram}</div>}
                                <div className="text-muted">Avaliação nº {e.avaliacao_id ?? '—'}</div>
                              </>
                            )}
                            <div className="text-muted" style={{ wordBreak: 'break-all' }}>
                              Sessão: {e.sessao ?? '—'} · Navegador: {e.user_agent ?? '—'}
                              {d.xForwardedFor ? ` · X-Forwarded-For: ${d.xForwardedFor}` : ''}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const NotasBancaAdminView: React.FC = () => {
  const { showToast } = useToast();
  const [aba, setAba] = useState<'notas' | 'avaliar' | 'auditoria'>('notas');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ token: string }>('/banca/link-publico')
      .then((r) => setToken(r?.token ?? null))
      .catch(() => setToken(null));
  }, []);

  const linkPublico = token ? `${window.location.origin}/${token}` : null;
  const copiarLink = async () => {
    if (!linkPublico) return;
    try {
      await navigator.clipboard.writeText(linkPublico);
      showToast('Link do formulário público copiado.', 'success');
    } catch {
      showToast(`Copie o link: ${linkPublico}`, 'info');
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ fontSize: '1.4rem' }}>Notas da Banca</h2>
        <p className="text-muted text-sm">Avaliações das bancas do PBL oral. Visível apenas para a coordenação.</p>
      </div>
      <div className="card mb-4 flex flex-wrap items-center justify-between gap-2" style={{ padding: '0.85rem 1rem' }}>
        <span className="text-sm" style={{ wordBreak: 'break-all' }}>
          Formulário público (sem login, o avaliador informa e-mail e nome):{' '}
          <strong>{linkPublico ?? 'carregando o link...'}</strong>
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={copiarLink} disabled={!linkPublico}>
          <Link2 size={14} /> Copiar link
        </button>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button type="button" onClick={() => setAba('notas')}
          className={`btn btn-sm ${aba === 'notas' ? 'btn-primary' : 'btn-secondary'}`}>
          <ClipboardList size={16} /> Notas
        </button>
        <button type="button" onClick={() => setAba('avaliar')}
          className={`btn btn-sm ${aba === 'avaliar' ? 'btn-primary' : 'btn-secondary'}`}>
          <Star size={16} /> Avaliar
        </button>
        <button type="button" onClick={() => setAba('auditoria')}
          className={`btn btn-sm ${aba === 'auditoria' ? 'btn-primary' : 'btn-secondary'}`}>
          <ShieldCheck size={16} /> Auditoria do link público
        </button>
      </div>
      {aba === 'notas' && <NotasBanca />}
      {aba === 'avaliar' && <AvaliacaoBancaPainel mostrarCabecalho={false} />}
      {aba === 'auditoria' && <AuditoriaLinkPublico />}
    </div>
  );
};

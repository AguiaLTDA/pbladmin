import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Download, Filter, Loader2, Star } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  AvaliacaoBanca,
  CRITERIOS_BANCA,
  formatarNota,
  mediaCriterios,
  rotuloStatusBanca
} from '../../components/FormularioAvaliacaoBanca';
import { AvaliacaoBancaPainel } from '../professor/AvaliacaoBancaProfessor';
import { rotuloDiaBanca } from '../../constants/salasBanca';

const notaDaAvaliacao = (a: AvaliacaoBanca) => (a.nota_final != null ? a.nota_final : mediaCriterios(a) * 0.3);

function exportarCsv(linhas: AvaliacaoBanca[]) {
  const header = [
    'atualizado_em',
    'dia',
    'sala',
    'avaliador_nome',
    'avaliador_email',
    'curso',
    'turma',
    'grupo',
    ...CRITERIOS_BANCA.map((c) => c.key),
    'media',
    'nota_media_0_1_5',
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
    const media = mediaCriterios(a);
    return [
      new Date(a.atualizado_em).toLocaleString('pt-BR'),
      a.dia ?? '',
      a.sala ?? 'Outra sala',
      a.avaliador_nome,
      a.avaliador_email,
      a.curso_nome ?? '',
      a.turma_nome,
      a.grupo_nome,
      ...CRITERIOS_BANCA.map((c) => a[c.key]),
      media.toFixed(2),
      (media * 0.3).toFixed(2),
      a.nota_final == null ? '' : a.nota_final.toFixed(2),
      rotuloStatusBanca(a.status),
      a.pontos_fortes ?? '',
      a.pontos_melhoria ?? '',
      a.nao_contribuiram ?? ''
    ];
  });
  const csv = '﻿' + [header, ...dados].map((r) => r.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `notas-banca-pbl-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
        informada; senão, a média dos critérios × 0,3.
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
                <th>Nota média</th>
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
                    <td>{a.avaliador_nome}</td>
                    <td>{formatarNota(mediaCriterios(a) * 0.3)}</td>
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

export const NotasBancaAdminView: React.FC = () => {
  const [aba, setAba] = useState<'notas' | 'avaliar'>('notas');
  return (
    <div>
      <div className="mb-4">
        <h2 style={{ fontSize: '1.4rem' }}>Notas da Banca</h2>
        <p className="text-muted text-sm">Avaliações das bancas do PBL oral. Visível apenas para a coordenação.</p>
      </div>
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => setAba('notas')}
          className={`btn btn-sm ${aba === 'notas' ? 'btn-primary' : 'btn-secondary'}`}>
          <ClipboardList size={16} /> Notas
        </button>
        <button type="button" onClick={() => setAba('avaliar')}
          className={`btn btn-sm ${aba === 'avaliar' ? 'btn-primary' : 'btn-secondary'}`}>
          <Star size={16} /> Avaliar
        </button>
      </div>
      {aba === 'notas' ? <NotasBanca /> : <AvaliacaoBancaPainel mostrarCabecalho={false} />}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { RevisaoDocentePayload, OrientadorReviewRow, RevisaoPBLGrupo } from '../types';
import { MessageSquare, Award, BookOpen, RefreshCw } from 'lucide-react';

type Aba = 'orientador' | 'pbl';

/** Rótulo de segmentação: curso • turma • disciplina, omitindo o que não houver. */
function segmento(curso?: string | null, turma?: string | null, disciplina?: string | null): string {
  return [curso, turma, disciplina].filter(Boolean).join(' • ') || 'Sem segmentação informada';
}

/** Agrupa qualquer lista por uma chave calculada, preservando a ordem de chegada. */
function agrupar<T>(itens: T[], chave: (item: T) => string): Array<[string, T[]]> {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    const k = chave(item);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k)!.push(item);
  }
  return Array.from(mapa.entries());
}

/**
 * Aba "Revisão Docente" do admin: reúne os dois retornos do professor.
 * A revisão do arquivo orientador é texto que ele escreve; a revisão dos PBLs
 * dos grupos é o feedback que ele já registra ao avaliar cada entrega.
 */
export const RevisaoDocenteAdmin: React.FC = () => {
  const { showToast } = useToast();
  const [dados, setDados] = useState<RevisaoDocentePayload>({ orientador: [], pblGrupos: [] });
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>('orientador');
  const [filtroProfessor, setFiltroProfessor] = useState('');

  const carregar = () => {
    setCarregando(true);
    apiRequest<RevisaoDocentePayload>('/academic/revisao-docente')
      .then((res) => setDados({ orientador: res.orientador || [], pblGrupos: res.pblGrupos || [] }))
      .catch((err: any) => showToast(err.message || 'Erro ao carregar a revisão docente.', 'error'))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const professores = useMemo(() => {
    const nomes = new Set<string>();
    dados.orientador.forEach((r) => nomes.add(r.professor_nome));
    dados.pblGrupos.forEach((r) => nomes.add(r.professor_nome));
    return Array.from(nomes).sort();
  }, [dados]);

  const orientadorFiltrado = useMemo(
    () => dados.orientador.filter((r) => !filtroProfessor || r.professor_nome === filtroProfessor),
    [dados.orientador, filtroProfessor]
  );

  const pblFiltrado = useMemo(
    () => dados.pblGrupos.filter((r) => !filtroProfessor || r.professor_nome === filtroProfessor),
    [dados.pblGrupos, filtroProfessor]
  );

  const renderOrientador = (itens: OrientadorReviewRow[]) => {
    if (itens.length === 0) {
      return (
        <div className="card text-center py-8">
          <MessageSquare size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhuma revisão do arquivo orientador</h3>
          <p className="text-muted text-sm">
            Quando um docente enviar a revisão do material dele, ela aparece aqui por curso, turma e disciplina.
          </p>
        </div>
      );
    }

    return agrupar(itens, (r) => r.professor_nome).map(([professor, revisoes]) => (
      <div key={professor} className="card mb-4" style={{ padding: '1.25rem' }}>
        <div className="font-bold" style={{ fontSize: '1.05rem' }}>{professor}</div>
        <div className="text-muted text-sm mb-3">{revisoes[0]?.professor_email}</div>

        {agrupar(revisoes, (r) => segmento(r.curso_nome, r.turma_nome, r.disciplina_nome)).map(([seg, lista]) => (
          <div key={seg} className="mb-3">
            <span className="pill-tag" style={{ marginBottom: '0.5rem', display: 'inline-block' }}>{seg}</span>
            <div className="flex flex-col gap-2">
              {lista.map((item) => (
                <div key={item.id} className="card" style={{ padding: '0.75rem 1rem' }}>
                  <div className="text-sm">{item.texto}</div>
                  <div className="text-muted text-sm mt-1">
                    {new Date(item.criado_em).toLocaleString('pt-BR')}
                    {item.arquivo_nome ? ` • ${item.arquivo_nome}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ));
  };

  const renderPBL = (itens: RevisaoPBLGrupo[]) => {
    if (itens.length === 0) {
      return (
        <div className="card text-center py-8">
          <Award size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhuma revisão de PBL dos grupos</h3>
          <p className="text-muted text-sm">
            Aqui entra o feedback que o docente escreve ao avaliar as entregas, agrupado por turma e grupo.
          </p>
        </div>
      );
    }

    return agrupar(itens, (r) => r.professor_nome).map(([professor, revisoes]) => (
      <div key={professor} className="card mb-4" style={{ padding: '1.25rem' }}>
        <div className="font-bold" style={{ fontSize: '1.05rem' }}>{professor}</div>
        <div className="text-muted text-sm mb-3">{revisoes[0]?.professor_email}</div>

        {agrupar(revisoes, (r) => segmento(r.curso_nome, r.turma_nome, r.disciplina_nome)).map(([seg, lista]) => (
          <div key={seg} className="mb-3">
            <span className="pill-tag" style={{ marginBottom: '0.5rem', display: 'inline-block' }}>{seg}</span>

            {agrupar(lista, (r) => r.grupo_nome || 'Entregas individuais').map(([grupo, entregas]) => (
              <div key={grupo} className="mb-2">
                <div className="font-bold text-sm mb-1">{grupo}</div>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Aluno</th>
                        <th>Atividade</th>
                        <th>Nota</th>
                        <th>Revisão do docente</th>
                        <th>Liberada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entregas.map((e) => (
                        <tr key={e.id}>
                          <td className="text-sm">{e.aluno_nome}</td>
                          <td className="text-sm">
                            {e.atividade_titulo}
                            <div className="text-muted text-sm">{e.codigo_unico}</div>
                          </td>
                          <td className="font-bold">{(e.nota_total || 0).toFixed(2)}</td>
                          <td className="text-sm">{e.texto || <span className="text-muted">Sem texto</span>}</td>
                          <td>
                            <span
                              className="status-badge"
                              style={{
                                background: e.liberado_aluno ? '#dcfce7' : '#f1f5f9',
                                color: e.liberado_aluno ? '#15803d' : '#475569'
                              }}
                            >
                              {e.liberado_aluno ? 'SIM' : 'NÃO'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    ));
  };

  return (
    <div>
      <div
        className="flex items-center justify-between gap-2 mb-4"
        style={{ flexWrap: 'wrap' }}
      >
        <div>
          <span className="font-bold text-sm">
            Retorno dos docentes, segmentado por curso, turma e disciplina.
          </span>
          <div className="text-muted text-sm">
            A coordenação apenas consulta aqui — quem escreve é o professor, no portal dele.
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
          <select
            className="form-control"
            style={{ minWidth: '220px' }}
            value={filtroProfessor}
            onChange={(e) => setFiltroProfessor(e.target.value)}
          >
            <option value="">Todos os docentes</option>
            {professores.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button onClick={carregar} className="btn btn-secondary btn-sm" disabled={carregando}>
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <button
          onClick={() => setAba('orientador')}
          className={`btn btn-sm ${aba === 'orientador' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <BookOpen size={16} /> Arquivo orientador ({orientadorFiltrado.length})
        </button>
        <button
          onClick={() => setAba('pbl')}
          className={`btn btn-sm ${aba === 'pbl' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Award size={16} /> PBL dos grupos ({pblFiltrado.length})
        </button>
      </div>

      {carregando ? (
        <div className="text-center py-8 text-muted">Carregando a revisão docente...</div>
      ) : aba === 'orientador' ? (
        renderOrientador(orientadorFiltrado)
      ) : (
        renderPBL(pblFiltrado)
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { MaterialDirecionado } from '../../types';
import { VisualizadorArquivo } from '../../components/VisualizadorArquivo';
import { FolderOpen, Eye, RefreshCw, FileText, MessageSquare, ClipboardList, Crown } from 'lucide-react';
import { ComentariosMaterial } from '../../components/ComentariosMaterial';
import { SugestoesMaterial } from '../../components/SugestoesMaterial';
import { rotuloTipoDocumento } from '../../constants/academico';

function formatarTamanho(bytes: number): string {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Materiais que a coordenação direcionou a este docente, agrupados pelo alvo
 * (curso • turma • disciplina • grupo) que a coordenação indicou.
 */
export const MateriaisRecebidosProfessorView: React.FC = () => {
  const { showToast } = useToast();
  const [materiais, setMateriais] = useState<MaterialDirecionado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [emFoco, setEmFoco] = useState<MaterialDirecionado | null>(null);
  // Comentar é ação deliberada: a caixa fica fechada até o docente pedir,
  // para a tabela não virar um mural.
  const [comentandoId, setComentandoId] = useState<number | null>(null);
  // Sugerir à coordenação é outro fio, com outra audiência: fica em um painel
  // próprio para o docente não confundir com o que os alunos leem.
  const [sugerindoId, setSugerindoId] = useState<number | null>(null);

  const carregar = () => {
    setCarregando(true);
    apiRequest<MaterialDirecionado[]>('/files/meus-direcionados')
      .then(setMateriais)
      .catch((err: any) => showToast(err.message || 'Erro ao carregar seus materiais.', 'error'))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const porAlvo = useMemo(() => {
    const mapa = new Map<string, MaterialDirecionado[]>();
    for (const m of materiais) {
      const alvo =
        [m.curso_nome, m.turma_nome, m.disciplina_nome, m.grupo_nome].filter(Boolean).join(' • ') ||
        'Sem turma específica';
      if (!mapa.has(alvo)) mapa.set(alvo, []);
      mapa.get(alvo)!.push(m);
    }
    return Array.from(mapa.entries());
  }, [materiais]);

  if (carregando) {
    return <div className="text-center py-8 text-muted">Carregando os materiais direcionados a você...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2" style={{ flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Materiais Recebidos da Coordenação</h2>
          <p className="text-muted text-sm">
            Arquivos que a coordenação direcionou a você, organizados por curso, turma, disciplina e grupo.
          </p>
        </div>
        <button onClick={carregar} className="btn btn-secondary btn-sm">
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      {materiais.length === 0 ? (
        <div className="card text-center py-8">
          <FolderOpen size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhum material direcionado a você</h3>
          <p className="text-muted text-sm">
            Quando a coordenação enviar um arquivo para as suas turmas, ele aparece aqui.
          </p>
        </div>
      ) : (
        porAlvo.map(([alvo, itens]) => (
          <div key={alvo} className="card mb-4" style={{ padding: '1.25rem' }}>
            <div className="flex items-center gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
              <span className="pill-tag pill-tag-green">{alvo}</span>
              {/* Quem é o líder importa aqui: é com ele que a coordenação fecha
                  as sugestões desta turma. */}
              {itens[0]?.professor_lider_nome && (
                <span className="pill-tag pill-tag-amber" title="Professor líder designado pela coordenação">
                  <Crown size={11} /> líder: {itens[0].professor_lider_nome}
                </span>
              )}
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Tamanho</th>
                    <th>Observação da coordenação</th>
                    <th>Recebido em</th>
                    <th style={{ textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((m) => (
                    <React.Fragment key={m.id}>
                    <tr>
                      <td>
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <FileText size={15} color="var(--primary)" />
                          {m.nome_original}
                        </div>
                      </td>
                      <td>
                        <span className="pill-tag pill-tag-green">{rotuloTipoDocumento(m.tipo_documento)}</span>
                      </td>
                      <td>{formatarTamanho(m.tamanho_bytes)}</td>
                      <td className="text-sm">
                        {m.observacao || <span className="text-muted">-</span>}
                      </td>
                      <td className="text-sm">
                        {new Date(m.criado_em).toLocaleString('pt-BR')}
                        {m.direcionado_por_nome && (
                          <div className="text-muted text-sm">por {m.direcionado_por_nome}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex justify-end gap-2" style={{ flexWrap: 'wrap' }}>
                          <button onClick={() => setEmFoco(m)} className="btn btn-primary btn-sm">
                            <Eye size={14} /> Abrir
                          </button>
                          {/* Só faz sentido comentar o material de uma turma
                              identificada — sem turma, não há audiência. */}
                          {m.turma_id && (
                            <button
                              onClick={() => setComentandoId(comentandoId === m.id ? null : m.id)}
                              className="btn btn-secondary btn-sm"
                              title="Escrever um comentário visível aos alunos desta turma"
                            >
                              <MessageSquare size={14} /> Comentar
                            </button>
                          )}
                          {/* Sem turma não há a quem dirigir a sugestão: o fio é
                              por (arquivo, turma), como a própria discussão. */}
                          {m.turma_id && (
                            <button
                              onClick={() => setSugerindoId(sugerindoId === m.id ? null : m.id)}
                              className="btn btn-secondary btn-sm"
                              title="Sugerir alterações à coordenação (os alunos não veem)"
                            >
                              <ClipboardList size={14} /> Sugerir à coordenação
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {comentandoId === m.id && m.turma_id && (
                      <tr>
                        <td colSpan={6} style={{ background: 'var(--bg-main)' }}>
                          <ComentariosMaterial
                            arquivoId={m.arquivo_id}
                            turmaId={m.turma_id}
                            grupoId={m.grupo_id ?? null}
                            podeComentar
                          />
                        </td>
                      </tr>
                    )}

                    {sugerindoId === m.id && m.turma_id && (
                      <tr>
                        <td colSpan={6} style={{ background: 'var(--bg-main)' }}>
                          <SugestoesMaterial
                            arquivoId={m.arquivo_id}
                            turmaId={m.turma_id}
                            turmaNome={m.turma_nome}
                          />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {emFoco && (
        <VisualizadorArquivo
          arquivoId={emFoco.arquivo_id}
          nomeArquivo={emFoco.nome_original}
          mimeType={emFoco.mime_type}
          descricao={[emFoco.curso_nome, emFoco.turma_nome, emFoco.disciplina_nome].filter(Boolean).join(' • ')}
          onClose={() => setEmFoco(null)}
        />
      )}
    </div>
  );
};

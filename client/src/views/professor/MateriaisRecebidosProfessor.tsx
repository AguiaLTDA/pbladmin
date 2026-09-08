import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { MaterialDirecionado } from '../../types';
import { VisualizadorArquivo } from '../../components/VisualizadorArquivo';
import { FolderOpen, Eye, RefreshCw, FileText } from 'lucide-react';

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
            <span className="pill-tag pill-tag-green" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>
              {alvo}
            </span>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Tamanho</th>
                    <th>Observação da coordenação</th>
                    <th>Recebido em</th>
                    <th style={{ textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <FileText size={15} color="var(--primary)" />
                          {m.nome_original}
                        </div>
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
                        <button onClick={() => setEmFoco(m)} className="btn btn-primary btn-sm">
                          <Eye size={14} /> Abrir
                        </button>
                      </td>
                    </tr>
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

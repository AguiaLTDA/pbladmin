import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api';
import { OrientadorComment, OrientadorFile, ProfessorBindings } from '../../types';
import { useToast } from '../../context/ToastContext';
import { VisualizadorArquivo } from '../../components/VisualizadorArquivo';
import { BookOpen, Eye, Upload, FileText, Send } from 'lucide-react';

function formatarTamanho(bytes: number): string {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Arquivo orientador vinculado pela coordenação (admin) à conta do professor.
 * O professor pode revisar (abrir dentro da plataforma), editar — substituir
 * pelo upload de uma nova versão — e enviar sugestões de alteração por
 * disciplina, que ficam disponíveis para a coordenação na aba "Revisão pelos
 * Professores" do painel do admin.
 */
export const ArquivoOrientadorProfessorView: React.FC = () => {
  const { showToast } = useToast();
  const [arquivo, setArquivo] = useState<OrientadorFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mostrarVisualizador, setMostrarVisualizador] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [disciplinas, setDisciplinas] = useState<ProfessorBindings['disciplinas']>([]);
  const [comentarios, setComentarios] = useState<OrientadorComment[]>([]);
  const [disciplinaId, setDisciplinaId] = useState<number | ''>('');
  const [texto, setTexto] = useState('');
  const [enviandoSugestao, setEnviandoSugestao] = useState(false);

  const carregar = () => {
    setLoading(true);
    apiRequest<OrientadorFile | null>('/academic/my-orientador-file')
      .then((res) => setArquivo(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));

    apiRequest<ProfessorBindings>('/academic/my-bindings')
      .then((res) => setDisciplinas(res.disciplinas))
      .catch((err) => showToast(err.message, 'error'));

    carregarComentarios();
  };

  const carregarComentarios = () => {
    apiRequest<OrientadorComment[]>('/academic/my-orientador-file/comments')
      .then((res) => setComentarios(res))
      .catch((err) => showToast(err.message, 'error'));
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleEditar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const upload = await apiRequest<{ id: number }>('/files/upload', {
        method: 'POST',
        body: formData
      });

      await apiRequest('/academic/my-orientador-file', {
        method: 'PUT',
        body: JSON.stringify({ arquivoId: upload.id })
      });

      showToast('Arquivo orientador atualizado com sucesso!', 'success');
      carregar();
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar o arquivo orientador.', 'error');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleEnviarSugestao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disciplinaId || !texto.trim()) return;

    setEnviandoSugestao(true);
    try {
      await apiRequest('/academic/my-orientador-file/comments', {
        method: 'POST',
        body: JSON.stringify({ disciplinaId: Number(disciplinaId), texto: texto.trim() })
      });
      showToast('Sugestão enviada para a coordenação!', 'success');
      setTexto('');
      carregarComentarios();
    } catch (err: any) {
      showToast(err.message || 'Erro ao enviar a sugestão.', 'error');
    } finally {
      setEnviandoSugestao(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted">Carregando o arquivo orientador...</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ fontSize: '1.4rem' }}>Arquivo Orientador</h2>
        <p className="text-muted text-sm">
          Material de orientação vinculado à sua conta pela coordenação. Revise-o dentro da
          plataforma, envie uma nova versão quando precisar corrigi-lo, ou registre sugestões de
          alteração por disciplina para a coordenação analisar.
        </p>
      </div>

      {!arquivo ? (
        <div className="card text-center py-8">
          <BookOpen size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhum arquivo orientador vinculado ainda</h3>
          <p className="text-muted text-sm">
            A coordenação ainda não vinculou um arquivo orientador à sua conta.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <FileText size={28} color="var(--primary)" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{arquivo.nome_original}</span>
                  {arquivo.rotulo && <span className="pill-tag pill-tag-green">{arquivo.rotulo}</span>}
                </div>
                <div className="text-muted text-sm">
                  {formatarTamanho(arquivo.tamanho_bytes)} · vinculado em{' '}
                  {new Date(arquivo.vinculado_em).toLocaleString('pt-BR')}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => setMostrarVisualizador(true)}>
                <Eye size={16} /> Revisar
              </button>

              <button
                className="btn btn-secondary"
                disabled={enviando}
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={16} /> {enviando ? 'Enviando...' : 'Editar (substituir arquivo)'}
              </button>
              <input
                ref={inputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={handleEditar}
              />
            </div>
          </div>
        </div>
      )}

      {arquivo && (
        <div className="card mt-4" style={{ padding: '1.25rem' }}>
          <h3 className="font-bold mb-2" style={{ fontSize: '1.1rem' }}>
            Enviar sugestão de alteração
          </h3>
          <p className="text-muted text-sm mb-3">
            Escolha a disciplina a que a sugestão se refere. A coordenação verá seu retorno na
            revisão administrativa, organizado por disciplina.
          </p>

          <form onSubmit={handleEnviarSugestao}>
            <div className="form-group">
              <label className="form-label required">Disciplina</label>
              <select
                className="form-control"
                value={disciplinaId}
                onChange={(e: any) => setDisciplinaId(e.target.value)}
                required
              >
                <option value="">-- Selecione a disciplina --</option>
                {disciplinas.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome} ({d.curso_nome})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required">Sugestão / observação</label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Descreva o ajuste ou sugestão para este material..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={enviandoSugestao}>
              <Send size={16} /> {enviandoSugestao ? 'Enviando...' : 'Enviar sugestão'}
            </button>
          </form>

          {comentarios.length > 0 && (
            <div className="mt-4">
              <div className="font-bold text-sm mb-2">Suas sugestões enviadas:</div>
              <div className="flex flex-col gap-2">
                {comentarios.map((c) => (
                  <div key={c.id} className="card" style={{ padding: '0.75rem 1rem' }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="pill-tag">{c.disciplina_nome}</span>
                      <span className="text-muted text-sm">
                        {new Date(c.criado_em).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-sm mt-1">{c.texto}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mostrarVisualizador && arquivo && (
        <VisualizadorArquivo
          arquivoId={arquivo.arquivo_id}
          nomeArquivo={arquivo.nome_original}
          mimeType={arquivo.mime_type}
          descricao="Arquivo Orientador"
          onClose={() => setMostrarVisualizador(false)}
        />
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { fetchFileObjectUrl } from '../services/api';

interface VisualizadorArquivoProps {
  arquivoId: number;
  nomeArquivo: string;
  mimeType?: string;
  descricao?: string;
  onClose: () => void;
}

/**
 * Abre um arquivo do acervo dentro da plataforma, sem download prévio.
 * PDFs e imagens são renderizados inline; demais formatos oferecem o download.
 * O conteúdo chega por fetch autenticado, então a autorização do backend
 * (turma/atividade do docente) continua valendo.
 */
export const VisualizadorArquivo: React.FC<VisualizadorArquivoProps> = ({
  arquivoId,
  nomeArquivo,
  mimeType,
  descricao,
  onClose
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let urlAtual: string | null = null;
    let cancelado = false;

    fetchFileObjectUrl(arquivoId)
      .then((url) => {
        if (cancelado) {
          URL.revokeObjectURL(url);
          return;
        }
        urlAtual = url;
        setObjectUrl(url);
      })
      .catch((err: any) => !cancelado && setErro(err.message || 'Falha ao carregar o arquivo.'))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
      if (urlAtual) URL.revokeObjectURL(urlAtual);
    };
  }, [arquivoId]);

  const ehPdf = (mimeType || '').includes('pdf') || nomeArquivo.toLowerCase().endsWith('.pdf');
  const ehImagem = (mimeType || '').startsWith('image/');

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '1000px', width: '95%' }}>
        <div className="modal-header">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <FileText size={20} color="var(--primary)" />
              {nomeArquivo}
            </h3>
            {descricao && <p className="text-muted text-sm">{descricao}</p>}
          </div>
          <button onClick={onClose} className="btn btn-sm btn-secondary" aria-label="Fechar">
            <X size={14} />
          </button>
        </div>

        <div className="modal-body" style={{ minHeight: '60vh' }}>
          {carregando && <div className="text-center py-8 text-muted">Carregando o arquivo...</div>}

          {erro && (
            <div className="card text-center py-8">
              <h4 className="font-bold mb-1">Não foi possível abrir o arquivo</h4>
              <p className="text-muted text-sm">{erro}</p>
            </div>
          )}

          {objectUrl && ehPdf && (
            <iframe
              src={objectUrl}
              title={nomeArquivo}
              style={{ width: '100%', height: '70vh', border: '1px solid var(--border)', borderRadius: '8px' }}
            />
          )}

          {objectUrl && ehImagem && (
            <img src={objectUrl} alt={nomeArquivo} style={{ maxWidth: '100%', borderRadius: '8px' }} />
          )}

          {objectUrl && !ehPdf && !ehImagem && (
            <div className="card text-center py-8">
              <FileText size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
              <p className="text-muted text-sm mb-3">
                Este formato não tem pré-visualização na plataforma. Faça o download para abrir.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {objectUrl && (
            <a href={objectUrl} download={nomeArquivo} className="btn btn-secondary">
              <Download size={14} /> Baixar
            </a>
          )}
          <button onClick={onClose} className="btn btn-primary">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

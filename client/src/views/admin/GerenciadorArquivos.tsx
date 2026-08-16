import React, { useState, useEffect } from 'react';
import { apiRequest, getDownloadUrl } from '../../services/api';
import { FileItem } from '../../types';
import { useToast } from '../../context/ToastContext';
import { FolderOpen, Upload, Download, Trash2, FileText, Search, ShieldCheck } from 'lucide-react';

export const GerenciadorArquivosView: React.FC = () => {
  const { showToast } = useToast();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchFiles = () => {
    setLoading(true);
    apiRequest<FileItem[]>('/files')
      .then((res) => setFiles(res))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await apiRequest('/files/upload', {
        method: 'POST',
        body: formData
      });
      showToast(`Arquivo '${file.name}' enviado com sucesso!`, 'success');
      fetchFiles();
    } catch (err: any) {
      showToast(err.message || 'Erro ao fazer upload.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Tem certeza que deseja mover '${name}' para a lixeira (exclusão lógica)?`)) return;

    try {
      await apiRequest(`/files/${id}`, { method: 'DELETE' });
      showToast(`Arquivo '${name}' movido para a lixeira.`, 'info');
      fetchFiles();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir arquivo.', 'error');
    }
  };

  const filteredFiles = files.filter((f) =>
    f.nome_original.toLowerCase().includes(search.toLowerCase()) ||
    (f.categoria && f.categoria.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Gerenciador de Arquivos & Materiais</h2>
          <p className="text-muted text-sm">
            Repositório central de materiais de apoio, PDFs, vídeos, planilhas e hashes de auditoria.
          </p>
        </div>

        <label className="btn btn-primary cursor-pointer">
          <Upload size={18} />
          {uploading ? 'Enviando...' : 'Fazer Upload de Arquivo'}
          <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>

      <div className="card mb-4" style={{ padding: '1rem' }}>
        <div className="flex items-center gap-2">
          <Search size={18} className="text-muted" />
          <input
            type="text"
            className="form-control"
            placeholder="Buscar arquivo por nome ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">Carregando repositório de arquivos...</div>
      ) : filteredFiles.length === 0 ? (
        <div className="card text-center py-8">
          <FolderOpen size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhum arquivo encontrado</h3>
          <p className="text-muted text-sm">Faça o upload de documentos de estudo ou materiais das atividades.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Nome do Arquivo</th>
                <th>Categoria</th>
                <th>Tamanho</th>
                <th>Hash MD5 (Auditoria)</th>
                <th>Enviado Por</th>
                <th>Data do Envio</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((f) => (
                <tr key={f.id}>
                  <td>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <FileText size={16} color="var(--primary)" />
                      <span>{f.nome_original}</span>
                    </div>
                  </td>
                  <td>
                    <span className="btn btn-sm btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}>
                      {f.categoria}
                    </span>
                  </td>
                  <td>{(f.tamanho_bytes / 1024).toFixed(0)} KB</td>
                  <td>
                    <code style={{ fontSize: '0.75rem', background: 'var(--bg-main)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                      {f.hash_md5 || 'N/A'}
                    </code>
                  </td>
                  <td>{f.enviado_por_nome}</td>
                  <td>{f.criado_em ? new Date(f.criado_em).toLocaleDateString('pt-BR') : '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <a
                        href={getDownloadUrl(f.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        title="Download Seguro Stream"
                      >
                        <Download size={14} />
                      </a>
                      <button
                        onClick={() => handleDelete(f.id, f.nome_original)}
                        className="btn btn-danger btn-sm"
                        title="Mover para a lixeira (Exclusão Lógica)"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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

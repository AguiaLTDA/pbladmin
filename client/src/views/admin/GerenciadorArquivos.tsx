import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest, baixarArquivoAutenticado } from '../../services/api';
import { FileItem } from '../../types';
import { useToast } from '../../context/ToastContext';
import { TIPOS_DOCUMENTO, rotuloTipoDocumento } from '../../constants/academico';
import { FolderOpen, Upload, Download, Trash2, FileText, Search, ShieldCheck, Send, Users, Filter, CheckCircle2, Eye } from 'lucide-react';
import { VisualizadorArquivo } from '../../components/VisualizadorArquivo';
import { DirecionarArquivoModal } from '../../components/DirecionarArquivoModal';
import { EnviarArquivoGrupoModal } from '../../components/EnviarArquivoGrupoModal';

export const GerenciadorArquivosView: React.FC = () => {
  const { showToast } = useToast();
  const baixar = async (id: number, nome: string) => {
    try {
      await baixarArquivoAutenticado(id, nome);
    } catch (err: any) {
      showToast(err.message || 'Não foi possível baixar o arquivo.', 'error');
    }
  };

  const [files, setFiles] = useState<FileItem[]>([]);
  // Abrir na plataforma em vez de baixar: conferir o conteudo de um PDF antes de
  // direciona-lo ou de trocar o arquivo de um grupo nao deveria exigir salvar o
  // arquivo no computador de quem confere.
  const [arquivoEmFoco, setArquivoEmFoco] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [search, setSearch] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  // Tipo aplicado ao lote que está subindo. Fica fora do handler para o usuário
  // escolher antes de abrir o seletor de arquivos.
  const [tipoUpload, setTipoUpload] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [destinoFiltro, setDestinoFiltro] = useState<'' | 'direcionado' | 'sem_destino'>('');
  const [turmaFiltro, setTurmaFiltro] = useState<number | ''>('');
  const [arquivoParaDirecionar, setArquivoParaDirecionar] = useState<FileItem | null>(null);
  const [arquivoParaGrupo, setArquivoParaGrupo] = useState<FileItem | null>(null);

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

  /**
   * Upload de vários arquivos, um de cada vez. Sequencial de propósito: em
   * paralelo, um lote grande estouraria o limite de requisições e uma falha no
   * meio deixaria dúvida sobre o que subiu. Assim cada arquivo tem sucesso ou
   * erro próprio, e o que já subiu permanece.
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selecionados = Array.from(e.target.files || []);
    if (selecionados.length === 0) return;

    setUploading(true);
    setProgresso({ feito: 0, total: selecionados.length });

    const falhas: string[] = [];
    let enviados = 0;

    for (const file of selecionados) {
      const formData = new FormData();
      formData.append('file', file);
      if (tipoUpload) formData.append('tipoDocumento', tipoUpload);
      try {
        await apiRequest('/files/upload', { method: 'POST', body: formData });
        enviados++;
      } catch (err: any) {
        falhas.push(`${file.name}: ${err?.message || 'erro no envio'}`);
      }
      setProgresso({ feito: enviados + falhas.length, total: selecionados.length });
    }

    if (enviados > 0) {
      showToast(
        selecionados.length === 1
          ? `Arquivo '${selecionados[0].name}' enviado com sucesso!`
          : `${enviados} de ${selecionados.length} arquivos enviados.`,
        'success'
      );
    }
    if (falhas.length > 0) {
      showToast(`${falhas.length} arquivo(s) falharam: ${falhas[0]}`, 'error');
    }

    // Libera o mesmo arquivo para ser reenviado sem trocar de seleção.
    e.target.value = '';
    setUploading(false);
    setProgresso(null);
    fetchFiles();
  };

  // O portal não tem restauração de arquivo: o que existe é a pasta "Excluídos"
  // no Drive, e o aviso precisa dizer onde o PDF foi parar — senão a coordenação
  // acha que o material sumiu.
  const handleDelete = async (id: number, name: string) => {
    if (
      !window.confirm(
        `Excluir '${name}' do portal?` +
          String.fromCharCode(10, 10) +
          'O arquivo sai da lista e o PDF vai para a pasta "Excluídos" no Google Drive. ' +
          'Quem já recebeu este material deixa de conseguir abri-lo, e não há como desfazer pelo portal.'
      )
    ) {
      return;
    }

    try {
      const res = await apiRequest<{ message: string }>(`/files/${id}`, { method: 'DELETE' });
      showToast(res?.message || `Arquivo '${name}' excluído.`, 'info');
      fetchFiles();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir arquivo.', 'error');
    }
  };

  const totalDirecionamentos = (f: FileItem) => Number(f.total_direcionamentos || 0);

  // As opções de categoria e turma vêm dos próprios arquivos carregados: nunca
  // aparece no filtro um valor que não devolveria nenhuma linha.
  const categorias = useMemo(
    () =>
      Array.from(new Set(files.map((f) => f.categoria).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
    [files]
  );

  const turmasDestino = useMemo(() => {
    const mapa = new Map<number, string>();
    files.forEach((f) => {
      (f.turmas_destino_ids || []).forEach((id, i) => {
        const nome = (f.turmas_destino || [])[i];
        if (nome) mapa.set(id, nome);
      });
    });
    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    );
  }, [files]);

  const filteredFiles = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return files
      .filter(
        (f) =>
          termo === '' ||
          f.nome_original.toLowerCase().includes(termo) ||
          (f.categoria && f.categoria.toLowerCase().includes(termo)) ||
          (f.enviado_por_nome || '').toLowerCase().includes(termo) ||
          (f.turmas_destino || []).some((t) => t.toLowerCase().includes(termo)) ||
          (f.grupos_destino || []).some((g) => g.toLowerCase().includes(termo))
      )
      .filter((f) => categoriaFiltro === '' || f.categoria === categoriaFiltro)
      .filter((f) =>
        tipoFiltro === ''
          ? true
          : tipoFiltro === 'SEM_TIPO'
            ? !f.tipo_documento
            : f.tipo_documento === tipoFiltro
      )
      .filter((f) => {
        if (destinoFiltro === 'direcionado') return totalDirecionamentos(f) > 0;
        if (destinoFiltro === 'sem_destino') return totalDirecionamentos(f) === 0;
        return true;
      })
      .filter((f) => turmaFiltro === '' || (f.turmas_destino_ids || []).includes(Number(turmaFiltro)));
  }, [files, search, categoriaFiltro, tipoFiltro, destinoFiltro, turmaFiltro]);

  const semDestino = useMemo(() => files.filter((f) => totalDirecionamentos(f) === 0).length, [files]);

  const semTipo = useMemo(() => files.filter((f) => !f.tipo_documento).length, [files]);

  const algumFiltro =
    search !== '' || categoriaFiltro !== '' || tipoFiltro !== '' || destinoFiltro !== '' || turmaFiltro !== '';

  const limparFiltros = () => {
    setSearch('');
    setCategoriaFiltro('');
    setTipoFiltro('');
    setDestinoFiltro('');
    setTurmaFiltro('');
  };

  /** Reclassifica um arquivo já enviado, sem precisar subir de novo. */
  const alterarTipo = async (arquivo: FileItem, tipo: string) => {
    try {
      await apiRequest(`/files/${arquivo.id}/tipo-documento`, {
        method: 'PUT',
        body: JSON.stringify({ tipoDocumento: tipo || null })
      });
      // Atualiza só a linha alterada: recarregar a lista inteira faria a tabela
      // piscar e perder a posição da rolagem no meio de uma reclassificação.
      setFiles((atuais) =>
        atuais.map((f) => (f.id === arquivo.id ? { ...f, tipo_documento: tipo || null } : f))
      );
    } catch (err: any) {
      showToast(err.message || 'Não foi possível alterar o tipo.', 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Gerenciador de Arquivos & Materiais</h2>
          <p className="text-muted text-sm">
            Repositório central de materiais de apoio, PDFs, vídeos, planilhas e hashes de auditoria.
          </p>
        </div>

        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
          {/* O tipo é escolhido ANTES de abrir o seletor de arquivos, porque
              vale para o lote inteiro — perguntar por arquivo tornaria o envio
              de quinze PDFs insuportável. */}
          <select
            className="form-control"
            style={{ minWidth: '200px' }}
            value={tipoUpload}
            onChange={(e) => setTipoUpload(e.target.value)}
            disabled={uploading}
            title="Tipo aplicado a todos os arquivos deste envio"
          >
            <option value="">Tipo do documento (opcional)</option>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t.valor} value={t.valor}>{t.rotulo}</option>
            ))}
          </select>

          <label className="btn btn-primary cursor-pointer">
          <Upload size={18} />
          {uploading
            ? `Enviando ${progresso?.feito ?? 0} de ${progresso?.total ?? 0}...`
            : 'Fazer Upload de Arquivos'}
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            disabled={uploading}
          />
          </label>
        </div>
      </div>

      <div className="card mb-4" style={{ padding: '0.85rem 1rem' }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2" style={{ flex: 1, minWidth: '260px' }}>
            <Search size={18} className="text-muted" />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nome, categoria, quem enviou, turma ou grupo de destino..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Filter size={18} className="text-muted" />

          <select
            className="form-control"
            style={{ minWidth: '170px' }}
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
          >
            <option value="">Todas as categorias ({categorias.length})</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="form-control"
            style={{ minWidth: '190px' }}
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t.valor} value={t.valor}>{t.rotulo}</option>
            ))}
            <option value="SEM_TIPO">Sem tipo definido ({semTipo})</option>
          </select>

          <select
            className="form-control"
            style={{ minWidth: '190px' }}
            value={destinoFiltro}
            onChange={(e) => setDestinoFiltro(e.target.value as typeof destinoFiltro)}
          >
            <option value="">Qualquer situação</option>
            <option value="direcionado">Já direcionados</option>
            <option value="sem_destino">Sem destino ({semDestino})</option>
          </select>

          <select
            className="form-control"
            style={{ minWidth: '190px' }}
            value={turmaFiltro}
            onChange={(e) => setTurmaFiltro(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todas as turmas de destino ({turmasDestino.length})</option>
            {turmasDestino.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3" style={{ marginTop: '0.7rem' }}>
          <span className="text-muted text-sm">
            Exibindo {filteredFiles.length} de {files.length} arquivo(s).
          </span>

          {/* Atalho para o caso que trava a distribuição: o que subiu e nunca saiu daqui. */}
          {semDestino > 0 && destinoFiltro !== 'sem_destino' && (
            <button
              onClick={() => setDestinoFiltro('sem_destino')}
              className="btn btn-secondary btn-sm"
              style={{ color: '#b45309', borderColor: '#fcd34d', background: '#fffbeb' }}
            >
              Ver os {semDestino} sem destino
            </button>
          )}

          {algumFiltro && (
            <button onClick={limparFiltros} className="btn btn-secondary btn-sm">
              Limpar filtros
            </button>
          )}
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
                <th>Tipo do Documento</th>
                <th>Categoria</th>
                <th>Tamanho</th>
                <th>Hash MD5 (Auditoria)</th>
                <th>Enviado Por</th>
                <th>Direcionado a</th>
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
                    {/* Editável na própria linha: errar o rótulo num lote de
                        quinze é comum, e corrigir não deveria custar um reenvio. */}
                    <select
                      className="form-control"
                      style={{ fontSize: '0.78rem', padding: '0.25rem 0.4rem', minWidth: '150px' }}
                      value={f.tipo_documento || ''}
                      onChange={(e) => alterarTipo(f, e.target.value)}
                      title={rotuloTipoDocumento(f.tipo_documento)}
                    >
                      <option value="">Sem tipo</option>
                      {TIPOS_DOCUMENTO.map((t) => (
                        <option key={t.valor} value={t.valor}>{t.rotulo}</option>
                      ))}
                    </select>
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
                  <td>
                    {/* COUNT do Postgres chega como string: "0" é truthy, daí o Number(). */}
                    {Number(f.total_direcionamentos || 0) > 0 ? (
                      <div>
                        <span className="pill-tag pill-tag-green">
                          <CheckCircle2 size={11} /> distribuído
                        </span>
                        {/* O destino em si importa mais que a contagem de docentes:
                            é por turma e grupo que a coordenação se orienta. */}
                        <div className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>
                          {(f.turmas_destino || []).length > 0 && (
                            <div title={(f.turmas_destino || []).join(', ')}>
                              {(f.turmas_destino || []).slice(0, 2).join(', ')}
                              {(f.turmas_destino || []).length > 2 &&
                                ` +${(f.turmas_destino || []).length - 2}`}
                            </div>
                          )}
                          {(f.grupos_destino || []).length > 0 && (
                            <div title={(f.grupos_destino || []).join(', ')}>
                              {(f.grupos_destino || []).length} grupo
                              {(f.grupos_destino || []).length === 1 ? '' : 's'}
                            </div>
                          )}
                          <div>
                            {f.total_direcionamentos} docente
                            {Number(f.total_direcionamentos) === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="pill-tag pill-tag-amber">sem destino</span>
                    )}
                  </td>
                  <td>{f.criado_em ? new Date(f.criado_em).toLocaleDateString('pt-BR') : '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setArquivoParaDirecionar(f)}
                        className="btn btn-secondary btn-sm"
                        title="Direcionar a professores (curso, turma, disciplina, grupo)"
                      >
                        <Send size={14} /> Direcionar
                      </button>
                      <button
                        onClick={() => setArquivoParaGrupo(f)}
                        className="btn btn-secondary btn-sm"
                        title="Atalho: publica direto para os alunos de um grupo PBL"
                      >
                        <Users size={14} /> Enviar para Grupo
                      </button>
                      <button
                        onClick={() => setArquivoEmFoco(f)}
                        className="btn btn-secondary btn-sm"
                        title="Abrir na plataforma, sem baixar"
                      >
                        <Eye size={14} /> Abrir
                      </button>
                      <button
                        onClick={() => baixar(f.id, f.nome_original)}
                        className="btn btn-secondary btn-sm"
                        title="Baixar o arquivo"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(f.id, f.nome_original)}
                        className="btn btn-danger btn-sm"
                        title="Excluir do portal (move o arquivo para a pasta Excluídos no Drive)"
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

      {arquivoEmFoco && (
        <VisualizadorArquivo
          arquivoId={arquivoEmFoco.id}
          nomeArquivo={arquivoEmFoco.nome_original}
          mimeType={arquivoEmFoco.mime_type}
          descricao={rotuloTipoDocumento(arquivoEmFoco.tipo_documento)}
          onClose={() => setArquivoEmFoco(null)}
        />
      )}

      {arquivoParaDirecionar && (
        <DirecionarArquivoModal
          arquivoId={arquivoParaDirecionar.id}
          nomeArquivo={arquivoParaDirecionar.nome_original}
          tipoDocumento={arquivoParaDirecionar.tipo_documento}
          onClose={() => setArquivoParaDirecionar(null)}
          onDirecionado={fetchFiles}
        />
      )}

      {arquivoParaGrupo && (
        <EnviarArquivoGrupoModal
          arquivoId={arquivoParaGrupo.id}
          nomeArquivo={arquivoParaGrupo.nome_original}
          onClose={() => setArquivoParaGrupo(null)}
          onEnviado={fetchFiles}
        />
      )}
    </div>
  );
};

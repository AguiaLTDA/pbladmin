import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { GrupoComMaterial, GrupoOption } from '../types';
import { TIPOS_DOCUMENTO, TIPO_PBL_1, rotuloTipoDocumento } from '../constants/academico';
import { FileUp, Paperclip, AlertTriangle, FileText } from 'lucide-react';

interface ArquivoRepositorio {
  id: number;
  nome_original: string;
  categoria: string;
  tipo_documento: string | null;
  criado_em: string;
}

interface AnexarPblGrupoModalProps {
  grupo: GrupoOption;
  /** O que este grupo já recebeu, para avisar antes de duplicar material. */
  material?: GrupoComMaterial;
  onClose: () => void;
  onEnviado: () => void;
}

/**
 * Anexa o PDF do PBL a UM grupo, sem sair da aba de grupos.
 *
 * A distribuição em lote continua no Gerenciador de Arquivos
 * (EnviarArquivoGrupoModal): lá o ponto de partida é o arquivo e o destino é uma
 * lista de grupos. Aqui é o contrário — o grupo está na tela, o arquivo é que
 * falta —, e é por isso que o upload acontece dentro do próprio modal em vez de
 * exigir subir o PDF antes em outra tela.
 */
export const AnexarPblGrupoModal: React.FC<AnexarPblGrupoModalProps> = ({
  grupo,
  material,
  onClose,
  onEnviado
}) => {
  const { showToast } = useToast();

  const [origem, setOrigem] = useState<'upload' | 'repositorio'>('upload');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arquivoExistenteId, setArquivoExistenteId] = useState<number | ''>('');
  const [tipoDocumento, setTipoDocumento] = useState<string>(TIPO_PBL_1);
  const [substituir, setSubstituir] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [repositorio, setRepositorio] = useState<ArquivoRepositorio[]>([]);
  const [carregandoRepositorio, setCarregandoRepositorio] = useState(false);

  const jaTemMaterial = (material?.total || 0) > 0;
  const totalIntegrantes = Number(grupo.total_integrantes || 0);

  useEffect(() => {
    if (origem !== 'repositorio' || repositorio.length > 0) return;
    setCarregandoRepositorio(true);
    apiRequest<ArquivoRepositorio[]>('/files')
      .then(setRepositorio)
      .catch(() => setRepositorio([]))
      .finally(() => setCarregandoRepositorio(false));
  }, [origem, repositorio.length]);

  // O PBL circula em PDF; os demais formatos ficam no fim para não atrapalhar a
  // busca, mas continuam disponíveis — o servidor não recusa outros tipos.
  const arquivosOrdenados = useMemo(() => {
    const peso = (a: ArquivoRepositorio) => (a.categoria === 'PDF' ? 0 : 1);
    return [...repositorio].sort(
      (a, b) => peso(a) - peso(b) || a.nome_original.localeCompare(b.nome_original, 'pt-BR')
    );
  }, [repositorio]);

  const handleEnviar = async () => {
    if (origem === 'upload' && !arquivo) {
      showToast('Escolha o arquivo PDF do PBL.', 'error');
      return;
    }
    if (origem === 'repositorio' && !arquivoExistenteId) {
      showToast('Escolha um arquivo do repositório.', 'error');
      return;
    }
    if (jaTemMaterial && !substituir) {
      const ok = window.confirm(
        `O grupo "${grupo.nome}" já recebeu ${material?.total} material(is). ` +
          'Continuar ACRESCENTA este arquivo e mantém o que já está lá. ' +
          'Para trocar, cancele e marque "substituir o material anterior".'
      );
      if (!ok) return;
    }

    setEnviando(true);
    try {
      let arquivoId: number;

      if (origem === 'upload') {
        const formData = new FormData();
        formData.append('file', arquivo as File);
        if (tipoDocumento) formData.append('tipoDocumento', tipoDocumento);
        const subido = await apiRequest<{ id: number }>('/files/upload', {
          method: 'POST',
          body: formData
        });
        arquivoId = subido.id;
      } else {
        arquivoId = Number(arquivoExistenteId);
        const atual = repositorio.find((a) => a.id === arquivoId);
        // Reclassificar é o que faz o selo de PBL 1 aparecer: sem isso, um
        // arquivo antigo sem tipo chegaria ao grupo mudo para a listagem.
        if (atual && atual.tipo_documento !== tipoDocumento) {
          await apiRequest(`/files/${arquivoId}/tipo-documento`, {
            method: 'PUT',
            body: JSON.stringify({ tipoDocumento })
          });
        }
      }

      await apiRequest(`/files/${arquivoId}/enviar-para-grupo`, {
        method: 'POST',
        body: JSON.stringify({ grupoId: grupo.id, substituir })
      });

      showToast(`${rotuloTipoDocumento(tipoDocumento)} publicado para ${grupo.nome}.`, 'success');
      onEnviado();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao anexar o arquivo ao grupo.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h3 className="font-bold flex items-center gap-2">
            <Paperclip size={20} color="var(--primary)" />
            Anexar PBL ao grupo
          </h3>
          <button onClick={onClose} className="btn btn-sm btn-secondary">X</button>
        </div>

        <div className="modal-body">
          <p className="text-muted text-sm mb-3">
            <strong>{grupo.nome}</strong>
            {grupo.turma_nome ? ` — ${grupo.turma_nome}` : ''} · {totalIntegrantes} integrante
            {totalIntegrantes === 1 ? '' : 's'}. O arquivo aparece para os alunos do grupo em
            "Materiais de Apoio".
          </p>

          {totalIntegrantes === 0 && (
            <div
              className="card mb-3"
              style={{ padding: '0.75rem', background: '#fef3c7', border: '1px solid #f59e0b' }}
            >
              <div className="flex items-start gap-2 text-sm" style={{ color: '#92400e' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  Este grupo está vazio. O envio será recusado pelo servidor enquanto não houver
                  aluno matriculado nele.
                </span>
              </div>
            </div>
          )}

          {jaTemMaterial && (
            <div
              className="card mb-3"
              style={{ padding: '0.75rem', borderLeft: '4px solid #047857' }}
            >
              <div className="font-bold text-sm" style={{ color: '#047857' }}>
                Este grupo já recebeu {material?.total} material(is)
              </div>
              <ul className="text-sm text-muted" style={{ paddingLeft: '1.1rem', margin: '0.35rem 0 0' }}>
                {material?.materiais.map((m) => (
                  <li key={m.atividadeId}>
                    {m.arquivoNome || m.titulo}
                    {m.tipoDocumento ? ` — ${rotuloTipoDocumento(m.tipoDocumento)}` : ''}
                  </li>
                ))}
              </ul>
              <label
                className="flex items-center gap-2 text-sm cursor-pointer"
                style={{ marginTop: '0.5rem' }}
              >
                <input
                  type="checkbox"
                  checked={substituir}
                  onChange={(e) => setSubstituir(e.target.checked)}
                />
                Substituir o material anterior (o antigo sai do portal do aluno)
              </label>
            </div>
          )}

          <div className="form-group">
            <label className="form-label required">Tipo do documento</label>
            <select
              className="form-control"
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value)}
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
            <div className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>
              É o tipo escolhido aqui que acende o selo "PBL 1" na lista de grupos.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">Arquivo</label>
            <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setOrigem('upload')}
                className={`btn btn-sm ${origem === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <FileUp size={14} /> Enviar novo PDF
              </button>
              <button
                type="button"
                onClick={() => setOrigem('repositorio')}
                className={`btn btn-sm ${origem === 'repositorio' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <FileText size={14} /> Usar arquivo já enviado
              </button>
            </div>

            {origem === 'upload' ? (
              <>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                />
                {arquivo && (
                  <div className="text-muted text-sm" style={{ marginTop: '0.35rem' }}>
                    {arquivo.name} — {(arquivo.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                )}
              </>
            ) : carregandoRepositorio ? (
              <div className="text-muted text-sm">Carregando arquivos...</div>
            ) : (
              <select
                className="form-control"
                value={arquivoExistenteId}
                onChange={(e) => setArquivoExistenteId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">-- Selecione o arquivo --</option>
                {arquivosOrdenados.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome_original}
                    {a.tipo_documento ? ` (${rotuloTipoDocumento(a.tipo_documento)})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          <button onClick={handleEnviar} disabled={enviando} className="btn btn-primary">
            <Paperclip size={16} /> {enviando ? 'Anexando...' : 'Anexar ao grupo'}
          </button>
        </div>
      </div>
    </div>
  );
};

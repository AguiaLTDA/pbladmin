import React, { useState, useEffect } from 'react';
import { apiRequest, getDownloadUrl } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  FileText,
  Download,
  Upload,
  Send,
  Save,
  CheckCircle2,
  AlertTriangle,
  Award,
  ArrowLeft,
  ShieldCheck,
  Paperclip,
  Trash2
} from 'lucide-react';

interface Props {
  activityId: string;
  navigate: (path: string) => void;
}

export const DetalhesPBLAlunoView: React.FC<Props> = ({ activityId, navigate }) => {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Student Submission state
  const [conteudoResposta, setConteudoResposta] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchDetails = () => {
    setLoading(true);
    apiRequest<any>(`/submissions/student/activities/${activityId}`)
      .then((res) => {
        setData(res);
        if (res.entrega) {
          setConteudoResposta(res.entrega.conteudo_resposta || '');
        }
        if (res.arquivosEntrega) {
          setUploadedFiles(res.arquivosEntrega);
        }
      })
      .catch((err) => {
        showToast(err.message, 'error');
        // Redirect to student dashboard if 403 or 404
        navigate('/aluno/atividades');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetails();
  }, [activityId]);

  if (loading || !data) {
    return <div className="p-4 text-center text-muted">Carregando detalhes da atividade PBL...</div>;
  }

  const { atividade, versao, etapas, arquivos, entrega, feedback } = data;

  const isFinalSubmitted = entrega && (entrega.status === 'ENVIADO' || entrega.status === 'ATRASADO');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await apiRequest('/files/upload', {
        method: 'POST',
        body: formData
      });
      setUploadedFiles((prev) => [...prev, res]);
      showToast(`Arquivo '${file.name}' anexado à sua entrega.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao anexar arquivo.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachedFile = (fileId: number) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleSaveSubmission = async (finalSubmit: boolean) => {
    if (finalSubmit && !conteudoResposta.trim() && uploadedFiles.length === 0) {
      showToast('Preencha uma resposta em texto ou anexe um arquivo para enviar.', 'warning');
      return;
    }

    if (finalSubmit && !window.confirm('Tem certeza que deseja realizar a entrega final? O comprovante com hash de entrega será gerado.')) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest(`/submissions/student/activities/${activityId}/answer`, {
        method: 'POST',
        body: JSON.stringify({
          conteudoResposta: conteudoResposta.trim(),
          arquivoIds: uploadedFiles.map((f) => f.id),
          finalSubmit
        })
      });

      showToast(res.message, 'success');
      fetchDetails();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar entrega.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/aluno/atividades')} className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          Voltar para Minhas Atividades
        </button>
        <span className="font-bold text-sm text-muted">CÓDIGO: {atividade.codigo_unico}</span>
      </div>

      {/* Card Cabeçalho */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>{atividade.curso_nome} • {atividade.disciplina_nome}</span>
          <span className="text-sm text-muted">Prazo de Entrega: <strong>{new Date(atividade.prazo_entrega).toLocaleString('pt-BR')}</strong></span>
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{atividade.titulo}</h2>
        <span className="text-sm text-muted">Professor Responsável: {atividade.professor_nome}</span>
      </div>

      {/* Resultado & Feedback Liberado pelo Docente */}
      {feedback && (
        <div className="card mb-4" style={{ background: '#dcfce7', border: '2px solid #16a34a' }}>
          <div className="flex items-center gap-2 mb-2 font-bold" style={{ color: '#15803d', fontSize: '1.1rem' }}>
            <Award size={22} />
            <span>Resultado da Avaliação & Feedback do Docente</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }} className="mb-3">
            <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div className="text-xs text-muted font-bold">NOTA ESCRITA</div>
              <div className="font-bold text-lg" style={{ color: '#15803d' }}>{feedback.nota_escrita.toFixed(2)} pts</div>
            </div>

            <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div className="text-xs text-muted font-bold">NOTA ORAL</div>
              <div className="font-bold text-lg" style={{ color: '#15803d' }}>{feedback.nota_oral.toFixed(2)} pts</div>
            </div>

            <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div className="text-xs text-muted font-bold">NOTA TOTAL CONSOLIDADA</div>
              <div className="font-bold text-xl" style={{ color: '#15803d' }}>{feedback.nota_total.toFixed(2)} pts</div>
            </div>
          </div>

          {feedback.observacoes && (
            <div style={{ background: 'white', padding: '0.85rem', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.9rem' }}>
              <strong>Observações do Professor ({feedback.avaliador_nome}):</strong>
              <p style={{ whiteSpace: 'pre-line', marginTop: '0.25rem' }}>{feedback.observacoes}</p>
            </div>
          )}
        </div>
      )}

      {/* Comprovante Hash de Entrega Efetuada */}
      {isFinalSubmitted && (
        <div className="card mb-4" style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)' }}>
          <div className="flex items-center gap-2 font-bold mb-1" style={{ color: 'var(--primary)' }}>
            <ShieldCheck size={20} />
            <span>Comprovante Oficial de Entrega Emitido</span>
          </div>
          <p className="text-sm mb-2">Sua resposta foi transmitida e registrada com sucesso no banco de dados da instituição.</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted font-bold">HASH DE COMPROVAÇÃO:</span>
            <code style={{ background: 'var(--bg-surface)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              {entrega.comprovante_hash}
            </code>
          </div>
        </div>
      )}

      {/* Instruções do PBL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }} className="mb-4">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h4 className="font-bold mb-2">1. Cenário-Problema</h4>
            <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem' }}>{versao?.contexto_problema}</p>
          </div>

          <div>
            <h4 className="font-bold mb-2" style={{ color: 'var(--primary)' }}>2. Problema Central</h4>
            <div style={{ padding: '1rem', background: 'var(--bg-main)', borderLeft: '4px solid var(--primary)', borderRadius: '6px', fontWeight: 500 }}>
              {versao?.problema_central}
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2">3. Objetivos de Aprendizagem</h4>
            <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem' }}>{versao?.objetivos_aprendizagem}</p>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h4 className="font-bold mb-2">4. Etapas da Atividade</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {etapas.map((e: any) => (
                <div key={e.id} style={{ padding: '0.65rem', background: 'var(--bg-main)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <span className="font-bold">Etapa {e.ordem}: {e.titulo}</span>
                  <div className="text-muted">{e.descricao}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2">5. Produtos Esperados & Critérios</h4>
            <p style={{ whiteSpace: 'pre-line', fontSize: '0.85rem' }}>{versao?.produtos_esperados}</p>
            <p style={{ whiteSpace: 'pre-line', fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
              <strong>Critérios:</strong> {versao?.criterios_avaliacao}
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-2">6. Materiais de Apoio Aprovados ({arquivos.length})</h4>
            {arquivos.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-2 mb-1" style={{ background: 'var(--bg-main)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-2 text-sm">
                  <FileText size={16} color="var(--primary)" />
                  <span>{f.nome_original}</span>
                </div>
                <a href={getDownloadUrl(f.id)} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">
                  <Download size={14} /> Baixar
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Área de Resposta & Submissão do Aluno */}
      <div className="card">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          <Send size={20} color="var(--primary)" />
          Área de Envio da Sua Resposta / Entrega
        </h3>
        <p className="text-muted text-sm mb-4">
          Digite a solução do problema central ou anexe os arquivos da sua resposta. Você pode salvar como rascunho quantas vezes quiser antes de realizar a entrega final.
        </p>

        <div className="form-group mb-4">
          <label className="form-label font-bold">Sua Solução / Resposta em Texto</label>
          <textarea
            className="form-control"
            style={{ minHeight: '140px' }}
            placeholder="Digite aqui o relatório, diagnóstico e respostas das etapas do PBL..."
            value={conteudoResposta}
            onChange={(e) => setConteudoResposta(e.target.value)}
            disabled={isFinalSubmitted}
          />
        </div>

        {/* Anexos da Entrega */}
        <div className="form-group mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="form-label font-bold">Arquivos da Sua Entrega ({uploadedFiles.length})</label>
            {!isFinalSubmitted && (
              <label className="btn btn-secondary btn-sm cursor-pointer">
                <Paperclip size={14} />
                {uploading ? 'Anexando...' : 'Anexar Arquivo'}
                <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
              </label>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {uploadedFiles.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-2" style={{ background: 'var(--bg-main)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                <div className="flex items-center gap-2">
                  <FileText size={16} color="var(--primary)" />
                  <span className="font-bold">{f.nome_original}</span>
                </div>
                {!isFinalSubmitted && (
                  <button type="button" onClick={() => handleRemoveAttachedFile(f.id)} className="btn btn-sm btn-secondary">
                    <Trash2 size={14} color="#ef4444" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Botões de Envio */}
        {!isFinalSubmitted ? (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => handleSaveSubmission(false)}
              disabled={submitting}
              className="btn btn-secondary"
            >
              <Save size={18} /> Salvar Rascunho
            </button>
            <button
              type="button"
              onClick={() => handleSaveSubmission(true)}
              disabled={submitting}
              className="btn btn-success"
              style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
            >
              <Send size={18} /> {submitting ? 'Enviando...' : 'Realizar Entrega Final'}
            </button>
          </div>
        ) : (
          <div className="p-3 text-center" style={{ background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span className="font-bold text-sm" style={{ color: '#16a34a' }}>
              ✓ Entrega finalizada. Para alterações, entre em contato com o professor ou coordenador.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

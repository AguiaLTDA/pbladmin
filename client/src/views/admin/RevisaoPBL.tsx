import { useState, useEffect } from 'react';
import { apiRequest, getDownloadUrl } from '../../services/api';
import { PBLActivity, PBLVersion, PBLStep, FileItem } from '../../types';
import { useToast } from '../../context/ToastContext';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  History,
  Download,
  Send,
  MessageSquare,
  Sparkles,
  ArrowLeft
} from 'lucide-react';

interface Props {
  activityId: string;
  navigate: (path: string) => void;
}

interface ActivityDetailsResponse {
  atividade: PBLActivity;
  versaoAtual: PBLVersion;
  etapas: PBLStep[];
  versoes: PBLVersion[];
  analises: any[];
  comentarios: any[];
  arquivos: FileItem[];
}

export const RevisaoPBLView: React.FC<Props> = ({ activityId, navigate }) => {
  const { showToast } = useToast();
  const [data, setData] = useState<ActivityDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Review modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [observacoesInternas, setObservacoesInternas] = useState('');
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchDetails = () => {
    setLoading(true);
    apiRequest<ActivityDetailsResponse>(`/pbl/activities/${activityId}`)
      .then((res) => {
        setData(res);
        setObservacoesInternas(res.versaoAtual?.observacoes_internas_admin || '');
        setSelectedVersionNum(res.atividade.versao_atual);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetails();
  }, [activityId]);

  if (loading || !data) {
    return <div className="p-4 text-center text-muted">Carregando dados da atividade para revisão...</div>;
  }

  const { atividade, versaoAtual, etapas, versoes, analises, comentarios, arquivos } = data;

  const activeVer = versoes.find((v) => v.numero_versao === selectedVersionNum) || versaoAtual;

  const handleReviewAction = async (decisao: 'APROVADO' | 'REPROVADO' | 'AJUSTES_SOLICITADOS') => {
    if (decisao === 'AJUSTES_SOLICITADOS' && !justificativa.trim()) {
      showToast('Escreva a justificativa obrigatória para a solicitação de ajustes.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest(`/pbl/activities/${activityId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decisao,
          justificativa: justificativa.trim(),
          observacoesInternas: observacoesInternas.trim()
        })
      });

      showToast(
        decisao === 'APROVADO'
          ? 'Atividade APROVADA com sucesso! Redirecionando para segmentação...'
          : `Análise concluída: ${decisao.replace('_', ' ')}`,
        'success'
      );

      setShowAdjustModal(false);

      if (decisao === 'APROVADO') {
        navigate(`/admin/segmentacao/${activityId}`);
      } else {
        fetchDetails();
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao registrar revisão.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Voltar & Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/admin/caixa-entrada')} className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          Voltar para Caixa de Entrada
        </button>
        <span className={`status-badge status-${atividade.status}`}>
          {atividade.status.replace('_', ' ')}
        </span>
      </div>

      {/* Card Principal */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-sm text-muted">CÓDIGO: {atividade.codigo_unico}</span>
          <span className="text-muted text-sm">Versão Atual: v{atividade.versao_atual}</span>
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{atividade.titulo}</h2>

        <div className="flex flex-wrap gap-4 text-sm text-muted">
          <span><strong>Curso:</strong> {atividade.curso_nome}</span>
          <span><strong>Disciplina:</strong> {atividade.disciplina_nome}</span>
          <span><strong>Professor:</strong> {atividade.professor_nome} ({atividade.professor_email})</span>
          <span><strong>Período:</strong> {atividade.periodo_nome}</span>
        </div>
      </div>

      {/* Seletor de Histórico de Versões */}
      {versoes.length > 1 && (
        <div className="card mb-4" style={{ padding: '0.85rem 1.25rem', background: 'var(--primary-light)' }}>
          <div className="flex items-center gap-2 mb-2 font-bold text-sm">
            <History size={16} />
            <span>Comparar / Visualizar Histórico de Versões:</span>
          </div>
          <div className="flex gap-2">
            {versoes.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVersionNum(v.numero_versao)}
                className={`btn btn-sm ${selectedVersionNum === v.numero_versao ? 'btn-primary' : 'btn-secondary'}`}
              >
                Versão v{v.numero_versao} {v.numero_versao === atividade.versao_atual && '(Mais Recente)'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo da Atividade PBL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }} className="mb-4">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h4 className="font-bold mb-2">1. Contexto / Cenário-Problema</h4>
            <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem', color: 'var(--text-main)' }}>
              {activeVer?.contexto_problema || 'Nenhum contexto fornecido.'}
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-2" style={{ color: 'var(--primary)' }}>2. Problema Central</h4>
            <div style={{ padding: '1.0rem', background: 'var(--bg-main)', borderLeft: '4px solid var(--primary)', borderRadius: '6px', fontWeight: 500, fontSize: '0.95rem' }}>
              {activeVer?.problema_central || 'Nenhum problema central fornecido.'}
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-2">3. Objetivos de Aprendizagem</h4>
            <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem' }}>
              {activeVer?.objetivos_aprendizagem || 'Não especificado.'}
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-2">4. Competências e Habilidades</h4>
            <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem' }}>
              {activeVer?.competencias_habilidades || 'Não especificado.'}
            </p>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h4 className="font-bold mb-2">5. Etapas da Atividade</h4>
            {etapas.length === 0 ? (
              <p className="text-muted text-sm">Nenhuma etapa cadastrada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {etapas.map((e) => (
                  <div key={e.id} style={{ padding: '0.75rem', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div className="font-bold text-sm">Etapa {e.ordem}: {e.titulo}</div>
                    <div className="text-muted text-sm">{e.descricao}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-bold mb-2">6. Produtos ou Entregas Esperadas</h4>
            <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem' }}>
              {activeVer?.produtos_esperados || 'Não especificado.'}
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-2">7. Critérios de Avaliação</h4>
            <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem' }}>
              {activeVer?.criterios_avaliacao || 'Não especificado.'}
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-2">8. Materiais e Anexos ({arquivos.length})</h4>
            {arquivos.length === 0 ? (
              <p className="text-muted text-sm">Nenhum arquivo anexo enviado pelo professor.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {arquivos.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2" style={{ background: 'var(--bg-main)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText size={16} color="var(--primary)" />
                      <span>{f.nome_original}</span>
                      <span className="text-muted">({(f.tamanho_bytes / 1024).toFixed(0)} KB)</span>
                    </div>
                    <a href={getDownloadUrl(f.id)} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">
                      <Download size={14} />
                      Baixar
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Observações Internas da Administração */}
      <div className="card mb-4">
        <h4 className="font-bold mb-2">Observações Internas do Setor Administrativo</h4>
        <textarea
          className="form-control"
          placeholder="Escreva notas e observações internas de compilação que ficarão visíveis apenas para administradores..."
          value={observacoesInternas}
          onChange={(e) => setObservacoesInternas(e.target.value)}
        />
      </div>

      {/* Histórico de Análises Anteriores */}
      {analises.length > 0 && (
        <div className="card mb-4">
          <h4 className="font-bold mb-2">Histórico de Pareceres da Administração</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {analises.map((a) => (
              <div key={a.id} style={{ padding: '0.75rem', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                <div className="flex justify-between font-bold mb-1">
                  <span>{a.analista_nome} - Parecer: <strong style={{ color: a.decisao === 'APROVADO' ? 'green' : a.decisao === 'REPROVADO' ? 'red' : 'orange' }}>{a.decisao}</strong></span>
                  <span className="text-muted">{new Date(a.criado_em).toLocaleString('pt-BR')}</span>
                </div>
                <div>{a.justificativa}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Painel de Decisão de Análise (Ações do Administrador) */}
      <div className="card" style={{ background: 'var(--bg-surface-elevated)', border: '2px solid var(--primary)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">Decisão da Revisão Administrativa</h3>
            <p className="text-muted text-sm">
              Escolha uma das ações para dar prosseguimento ao fluxo da atividade PBL.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAdjustModal(true)}
              className="btn btn-warning"
              disabled={submitting}
            >
              <AlertTriangle size={18} />
              Solicitar Ajustes ao Professor
            </button>

            <button
              onClick={() => handleReviewAction('REPROVADO')}
              className="btn btn-danger"
              disabled={submitting}
            >
              <XCircle size={18} />
              Reprovar
            </button>

            <button
              onClick={() => handleReviewAction('APROVADO')}
              className="btn btn-success"
              disabled={submitting}
            >
              <CheckCircle size={18} />
              Aprovar & Definir Público
            </button>
          </div>
        </div>
      </div>

      {/* Modal para Solicitar Ajustes (Justificativa Obrigatória) */}
      {showAdjustModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="font-bold flex items-center gap-2">
                <AlertTriangle color="#d97706" size={20} />
                Solicitar Ajustes ao Professor (Obrigatório)
              </h3>
              <button onClick={() => setShowAdjustModal(false)} className="btn btn-sm btn-secondary">X</button>
            </div>

            <div className="modal-body">
              <p className="text-sm mb-4">
                Descreva de forma clara e detalhada os ajustes necessários no conteúdo, rubricas ou instruções. O professor receberá esta justificativa e enviará uma nova versão.
              </p>

              <div className="form-group">
                <label className="form-label required">Justificativa da Devolução</label>
                <textarea
                  className="form-control"
                  style={{ minHeight: '120px' }}
                  placeholder="Ex: Favor ajustar a rubrica de avaliação para incluir os critérios orais e detalhar os objetivos de aprendizagem para os alunos da turma ADMCONT..."
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowAdjustModal(false)} className="btn btn-secondary">Cancelar</button>
              <button
                onClick={() => handleReviewAction('AJUSTES_SOLICITADOS')}
                className="btn btn-warning"
                disabled={submitting || !justificativa.trim()}
              >
                {submitting ? 'Enviando...' : 'Confirmar e Notificar Professor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

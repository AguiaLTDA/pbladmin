import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { GrupoOption } from '../types';
import { Users, Send, AlertTriangle } from 'lucide-react';

interface TurmaOpcao {
  id: number;
  nome: string;
  codigo: string;
  curso_nome?: string;
  disciplina_nome?: string;
}

interface EnviarArquivoGrupoModalProps {
  arquivoId: number;
  nomeArquivo: string;
  onClose: () => void;
  onEnviado: () => void;
}

/**
 * Atalho para publicar um arquivo do gerenciador direto para um grupo PBL.
 * Por trás dos panos, o servidor cria uma atividade mínima e já a publica
 * segmentada para esse grupo — ver enviarArquivoParaGrupo no backend.
 */
export const EnviarArquivoGrupoModal: React.FC<EnviarArquivoGrupoModalProps> = ({
  arquivoId,
  nomeArquivo,
  onClose,
  onEnviado
}) => {
  const { showToast } = useToast();
  const [turmas, setTurmas] = useState<TurmaOpcao[]>([]);
  const [grupos, setGrupos] = useState<GrupoOption[]>([]);
  const [turmaId, setTurmaId] = useState<number | ''>('');
  const [grupoId, setGrupoId] = useState<number | ''>('');
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    apiRequest<TurmaOpcao[]>('/academic/classes')
      .then(setTurmas)
      .catch((err: any) => showToast(err.message || 'Erro ao listar turmas.', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setGrupoId('');
    if (!turmaId) {
      setGrupos([]);
      return;
    }
    setCarregandoGrupos(true);
    apiRequest<GrupoOption[]>(`/academic/groups?turmaId=${turmaId}`)
      .then(setGrupos)
      .catch(() => setGrupos([]))
      .finally(() => setCarregandoGrupos(false));
  }, [turmaId]);

  const handleEnviar = async () => {
    if (!grupoId) {
      showToast('Selecione o grupo de destino.', 'error');
      return;
    }

    const grupo = grupos.find((g) => g.id === grupoId);
    if (
      !window.confirm(
        `Publicar "${nomeArquivo}" para o grupo "${grupo?.nome}"? Isso cria uma atividade PBL mínima (visível nos relatórios) só para carregar este material — os alunos do grupo verão o arquivo imediatamente em "Materiais de Apoio", sem entrega esperada.`
      )
    ) {
      return;
    }

    setEnviando(true);
    try {
      const res = await apiRequest<{ message: string }>(`/files/${arquivoId}/enviar-para-grupo`, {
        method: 'POST',
        body: JSON.stringify({ grupoId })
      });
      showToast(res.message, 'success');
      onEnviado();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Erro ao enviar o arquivo para o grupo.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3 className="font-bold flex items-center gap-2">
            <Users size={20} color="var(--primary)" />
            Enviar arquivo para um grupo
          </h3>
          <button onClick={onClose} className="btn btn-sm btn-secondary">X</button>
        </div>

        <div className="modal-body">
          <p className="text-muted text-sm mb-3">
            <strong>{nomeArquivo}</strong> — atalho rápido para colocar este material na tela dos alunos de
            um grupo específico.
          </p>

          <div className="card mb-3" style={{ padding: '0.75rem', background: '#fef3c7', border: '1px solid #f59e0b' }}>
            <div className="flex items-start gap-2 text-sm" style={{ color: '#92400e' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                Isso cria, por trás dos panos, uma atividade PBL mínima (título prefixado com "Material:") já
                publicada — ela aparece na Central de Relatórios como qualquer outra atividade. Não é necessário
                configurar nada além do grupo abaixo.
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">Turma</label>
            <select className="form-control" value={turmaId} onChange={(e: any) => setTurmaId(Number(e.target.value) || '')}>
              <option value="">-- Selecione a turma --</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} ({t.codigo}){t.curso_nome ? ` — ${t.curso_nome}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label required">Grupo</label>
            {carregandoGrupos ? (
              <div className="text-muted text-sm">Carregando grupos...</div>
            ) : (
              <select
                className="form-control"
                value={grupoId}
                onChange={(e: any) => setGrupoId(Number(e.target.value) || '')}
                disabled={!turmaId}
              >
                <option value="">
                  {turmaId ? '-- Selecione o grupo --' : 'Selecione a turma primeiro'}
                </option>
                {grupos.map((g) => {
                  // COUNT do Postgres chega como string — precisa converter antes de comparar.
                  const total = Number(g.total_integrantes || 0);
                  return (
                    <option key={g.id} value={g.id}>
                      {g.nome} ({total} integrante{total === 1 ? '' : 's'})
                    </option>
                  );
                })}
              </select>
            )}
            {turmaId && !carregandoGrupos && grupos.length === 0 && (
              <span className="text-muted text-sm">Nenhum grupo cadastrado nesta turma ainda.</span>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button onClick={handleEnviar} disabled={enviando || !grupoId} className="btn btn-primary">
            <Send size={16} /> {enviando ? 'Enviando...' : 'Publicar para o grupo'}
          </button>
        </div>
      </div>
    </div>
  );
};

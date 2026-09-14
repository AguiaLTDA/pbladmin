import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ComentarioMaterial } from '../types';

interface Props {
  arquivoId: number;
  turmaId: number;
  /** Quando o material foi para um grupo, o comentário nasce vinculado a ele. */
  grupoId?: number | null;
  /** Docente e coordenação escrevem; o aluno apenas lê. */
  podeComentar?: boolean;
}

/**
 * Comentários públicos sobre um material, visíveis à turma.
 *
 * A mesma peça serve às duas pontas: o docente escreve na tela de Materiais
 * Recebidos e o aluno lê na atividade. Manter um componente só evita que as duas
 * telas discordem sobre o que é um comentário — e o que separa quem escreve de
 * quem lê é uma prop, não uma cópia do código.
 */
export const ComentariosMaterial: React.FC<Props> = ({
  arquivoId,
  turmaId,
  grupoId = null,
  podeComentar = false
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [comentarios, setComentarios] = useState<ComentarioMaterial[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = () => {
    apiRequest<ComentarioMaterial[]>(`/files/${arquivoId}/comentarios?turmaId=${turmaId}`)
      .then(setComentarios)
      .catch(() => setComentarios([]))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    setCarregando(true);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivoId, turmaId]);

  const publicar = async () => {
    const conteudo = texto.trim();
    if (!conteudo) {
      showToast('Escreva o comentário antes de publicar.', 'error');
      return;
    }

    setEnviando(true);
    try {
      const res = await apiRequest<{ message: string }>(`/files/${arquivoId}/comentarios`, {
        method: 'POST',
        body: JSON.stringify({ turmaId, grupoId, texto: conteudo })
      });
      showToast(res.message, 'success');
      setTexto('');
      carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível publicar o comentário.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (comentario: ComentarioMaterial) => {
    if (!window.confirm('Remover este comentário? Os alunos deixarão de vê-lo.')) return;
    try {
      await apiRequest(`/files/comentarios/${comentario.id}`, { method: 'DELETE' });
      showToast('Comentário removido.', 'info');
      carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível remover o comentário.', 'error');
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="font-bold text-sm flex items-center gap-2" style={{ marginBottom: '0.6rem' }}>
        <MessageSquare size={15} color="var(--primary)" />
        Comentários do professor
        {comentarios.length > 0 && <span className="text-muted">({comentarios.length})</span>}
      </div>

      {carregando ? (
        <Loader2 size={15} className="animate-spin text-muted" />
      ) : comentarios.length === 0 ? (
        <div className="text-muted text-sm">
          {podeComentar
            ? 'Nenhum comentário ainda. O que você escrever aqui fica visível aos alunos da turma.'
            : 'O professor ainda não comentou este material.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {comentarios.map((c) => (
            <div
              key={c.id}
              className="card"
              style={{ padding: '0.6rem 0.85rem', borderLeft: '3px solid var(--primary)' }}
            >
              <div className="flex items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
                <div className="text-sm font-bold">
                  {c.autor_nome}
                  <span className="text-muted" style={{ fontWeight: 400 }}>
                    {' '}
                    · {new Date(c.criado_em).toLocaleString('pt-BR')}
                    {c.grupo_nome && ` · ${c.grupo_nome}`}
                  </span>
                </div>

                {/* Só o autor (ou a coordenação) apaga — e o botão não existe para
                    quem não pode, em vez de existir e falhar no clique. */}
                {(user?.id === c.autor_id || user?.perfilNome === 'ADMIN') && (
                  <button onClick={() => remover(c)} className="btn btn-secondary btn-sm">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: '0.3rem' }}>
                {c.texto}
              </div>
            </div>
          ))}
        </div>
      )}

      {podeComentar && (
        <div style={{ marginTop: '0.75rem' }}>
          <textarea
            className="form-control"
            rows={3}
            maxLength={4000}
            placeholder="Escreva uma orientação para a turma sobre este material..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex items-center justify-between gap-2" style={{ marginTop: '0.45rem' }}>
            <span className="text-muted" style={{ fontSize: '0.72rem' }}>
              Visível a todos os alunos da turma{grupoId ? ' que receberam este material' : ''}. Eles
              recebem uma notificação.
            </span>
            <button onClick={publicar} disabled={enviando || !texto.trim()} className="btn btn-primary btn-sm">
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {enviando ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

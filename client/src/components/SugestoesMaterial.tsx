import React, { useEffect, useState } from 'react';
import { ClipboardList, Send, Trash2, Loader2, Crown, Lock } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { SugestaoMaterial, SugestoesMaterialPayload } from '../types';

interface Props {
  arquivoId: number;
  turmaId: number;
  /** Nome da turma, só para deixar claro de qual discussão se trata. */
  turmaNome?: string | null;
}

/**
 * Janela de sugestões da docência sobre um material (ex.: o Pré-PBL 1).
 *
 * É o canal fechado do sistema: escrevem os docentes vinculados à turma e a
 * coordenação, e só eles leem — o aluno não tem rota para chegar aqui. É o
 * oposto de <ComentariosMaterial>, que existe justamente para ser lido pela
 * turma; por isso são dois componentes, e não um com uma prop de visibilidade:
 * confundir os dois vazaria para o aluno o que a docência escreveu à
 * coordenação.
 *
 * Todos os professores da mesma turma veem o mesmo fio, de propósito: sem isso,
 * dois docentes mandariam pedidos contraditórios sobre o mesmo arquivo sem
 * nunca saber disso.
 */
export const SugestoesMaterial: React.FC<Props> = ({ arquivoId, turmaId, turmaNome }) => {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [sugestoes, setSugestoes] = useState<SugestaoMaterial[]>([]);
  const [liderNome, setLiderNome] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = () => {
    apiRequest<SugestoesMaterialPayload>(`/files/${arquivoId}/sugestoes?turmaId=${turmaId}`)
      .then((res) => {
        setSugestoes(res.sugestoes || []);
        setLiderNome(res.liderNome ?? null);
      })
      .catch(() => setSugestoes([]))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    setCarregando(true);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivoId, turmaId]);

  const enviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo) {
      showToast('Escreva a sugestão antes de enviar.', 'error');
      return;
    }

    setEnviando(true);
    try {
      const res = await apiRequest<{ message: string }>(`/files/${arquivoId}/sugestoes`, {
        method: 'POST',
        body: JSON.stringify({ turmaId, texto: conteudo })
      });
      showToast(res.message, 'success');
      setTexto('');
      carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível registrar a sugestão.', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (sugestao: SugestaoMaterial) => {
    if (!window.confirm('Remover esta sugestão?')) return;
    try {
      await apiRequest(`/files/sugestoes/${sugestao.id}`, { method: 'DELETE' });
      showToast('Sugestão removida.', 'info');
      carregar();
    } catch (err: any) {
      showToast(err.message || 'Não foi possível remover a sugestão.', 'error');
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="font-bold text-sm flex items-center gap-2" style={{ marginBottom: '0.35rem' }}>
        <ClipboardList size={15} color="var(--primary)" />
        Sugestões e alterações para a coordenação
        {sugestoes.length > 0 && <span className="text-muted">({sugestoes.length})</span>}
      </div>

      {/* O aviso de audiência vem antes da caixa de texto: quem escreve precisa
          saber quem lê ANTES de escrever, não depois de publicar. */}
      <div className="text-muted text-sm flex items-center gap-2" style={{ marginBottom: '0.6rem' }}>
        <Lock size={12} />
        Visível apenas à coordenação e aos docentes de {turmaNome || 'desta turma'}. Os alunos não leem
        esta janela.
      </div>

      {liderNome && (
        <div className="text-sm flex items-center gap-2" style={{ marginBottom: '0.6rem' }}>
          <Crown size={13} color="#b45309" />
          <span className="text-muted">Professor líder da turma:</span> <strong>{liderNome}</strong>
        </div>
      )}

      {carregando ? (
        <Loader2 size={15} className="animate-spin text-muted" />
      ) : sugestoes.length === 0 ? (
        <div className="text-muted text-sm">
          Nenhuma sugestão ainda. Escreva abaixo o que precisa ser ajustado neste material.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sugestoes.map((s) => (
            <div
              key={s.id}
              className="card"
              style={{ padding: '0.6rem 0.85rem', borderLeft: '3px solid #b45309' }}
            >
              <div className="flex items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
                <div className="text-sm font-bold flex items-center gap-2">
                  {s.autor_nome}
                  {s.autor_e_lider && (
                    <span className="pill-tag pill-tag-amber" title="Professor líder da turma">
                      <Crown size={10} /> líder
                    </span>
                  )}
                  {s.autor_perfil === 'ADMIN' && <span className="pill-tag pill-tag-green">coordenação</span>}
                  <span className="text-muted" style={{ fontWeight: 400 }}>
                    · {new Date(s.criado_em).toLocaleString('pt-BR')}
                  </span>
                </div>

                {(user?.id === s.autor_id || user?.perfilNome === 'ADMIN') && (
                  <button onClick={() => remover(s)} className="btn btn-secondary btn-sm">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <div className="text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: '0.3rem' }}>
                {s.texto}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '0.75rem' }}>
        <textarea
          className="form-control"
          rows={3}
          maxLength={4000}
          placeholder="Ex: trocar o caso 2 por um contexto agrícola; a pergunta 3 está ambígua..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="flex items-center justify-between gap-2" style={{ marginTop: '0.45rem' }}>
          <span className="text-muted" style={{ fontSize: '0.72rem' }}>
            A coordenação e os demais docentes da turma recebem uma notificação.
          </span>
          <button onClick={enviar} disabled={enviando || !texto.trim()} className="btn btn-primary btn-sm">
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {enviando ? 'Enviando...' : 'Enviar sugestão'}
          </button>
        </div>
      </div>
    </div>
  );
};

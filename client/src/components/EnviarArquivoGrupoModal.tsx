import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { GrupoComMaterial } from '../types';
import { useToast } from '../context/ToastContext';
import { GrupoOption } from '../types';
import { Users, Send, AlertTriangle, CheckSquare } from 'lucide-react';

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
  // Vários grupos por envio: distribuir um mesmo caso a sete grupos era
  // sete aberturas do modal.
  const [gruposEscolhidos, setGruposEscolhidos] = useState<number[]>([]);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Quais grupos já receberam material — o sinal que evita distribuir duas vezes
  // para o mesmo grupo e esquecer outro.
  const [comMaterial, setComMaterial] = useState<Record<number, GrupoComMaterial>>({});

  useEffect(() => {
    apiRequest<GrupoComMaterial[]>('/files/grupos-com-material')
      .then((lista) => {
        const mapa: Record<number, GrupoComMaterial> = {};
        lista.forEach((g) => (mapa[g.grupoId] = g));
        setComMaterial(mapa);
      })
      .catch(() => setComMaterial({}));
  }, []);

  useEffect(() => {
    apiRequest<TurmaOpcao[]>('/academic/classes')
      .then(setTurmas)
      .catch((err: any) => showToast(err.message || 'Erro ao listar turmas.', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setGruposEscolhidos([]);
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

  const alternarGrupo = (id: number) =>
    setGruposEscolhidos((atual) =>
      atual.includes(id) ? atual.filter((g) => g !== id) : [...atual, id]
    );

  const jaAtendidos = gruposEscolhidos.filter((id) => comMaterial[id]);

  const handleEnviar = async () => {
    if (gruposEscolhidos.length === 0) {
      showToast('Marque ao menos um grupo de destino.', 'error');
      return;
    }

    // A pergunta sobre substituir só faz sentido para os grupos que já têm
    // material — e é feita uma vez para o lote, não uma por grupo, senão
    // distribuir para sete grupos seriam sete diálogos iguais.
    let substituir = false;
    if (jaAtendidos.length > 0) {
      const nomes = jaAtendidos.map((id) => {
        const g = grupos.find((x) => x.id === id);
        return `• ${g?.nome} (${comMaterial[id].total} material(is))`;
      });
      substituir = window.confirm(
        [
          `${jaAtendidos.length} dos ${gruposEscolhidos.length} grupos marcados já receberam material:`,
          '',
          ...nomes,
          '',
          'OK = SUBSTITUIR nesses grupos (o material anterior sai do portal do aluno).',
          `Cancelar = ACRESCENTAR "${nomeArquivo}" e manter o que já está lá.`
        ].join(String.fromCharCode(10))
      );
    } else if (
      !window.confirm(
        `Publicar "${nomeArquivo}" para ${gruposEscolhidos.length} grupo(s)? Isso cria uma atividade PBL mínima (visível nos relatórios) por grupo, só para carregar este material — os alunos verão o arquivo imediatamente em "Materiais de Apoio", sem entrega esperada.`
      )
    ) {
      return;
    }

    setEnviando(true);
    setProgresso({ feito: 0, total: gruposEscolhidos.length });

    // Sequencial: cada envio cria atividade, versão, segmentação e publicação.
    // Em paralelo, uma falha no meio deixaria dúvida sobre quais grupos foram
    // atendidos — assim cada grupo tem resultado próprio e o que passou fica.
    const falhas: string[] = [];
    let ok = 0;

    for (const grupoId of gruposEscolhidos) {
      const grupo = grupos.find((g) => g.id === grupoId);
      try {
        await apiRequest(`/files/${arquivoId}/enviar-para-grupo`, {
          method: 'POST',
          body: JSON.stringify({ grupoId, substituir })
        });
        ok++;
      } catch (err: any) {
        falhas.push(`${grupo?.nome}: ${err?.message || 'erro no envio'}`);
      }
      setProgresso({ feito: ok + falhas.length, total: gruposEscolhidos.length });
    }

    if (ok > 0) showToast(`Material publicado para ${ok} grupo(s).`, 'success');
    if (falhas.length > 0) showToast(`${falhas.length} grupo(s) falharam — ${falhas[0]}`, 'error');

    setEnviando(false);
    setProgresso(null);
    onEnviado();
    // Com falhas, o modal fica aberto para a coordenação ver o que sobrou.
    if (falhas.length === 0) onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3 className="font-bold flex items-center gap-2">
            <Users size={20} color="var(--primary)" />
            Enviar arquivo para grupos
          </h3>
          <button onClick={onClose} className="btn btn-sm btn-secondary">X</button>
        </div>

        <div className="modal-body">
          <p className="text-muted text-sm mb-3">
            <strong>{nomeArquivo}</strong> — atalho rápido para colocar este material na tela dos alunos.
            Marque quantos grupos quiser da mesma turma; cada um recebe o próprio material.
          </p>

          <div className="card mb-3" style={{ padding: '0.75rem', background: '#fef3c7', border: '1px solid #f59e0b' }}>
            <div className="flex items-start gap-2 text-sm" style={{ color: '#92400e' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                Isso cria, por trás dos panos, uma atividade PBL mínima (título prefixado com "Material:") já
                publicada — ela aparece na Central de Relatórios como qualquer outra atividade. Não é necessário
                configurar nada além dos grupos abaixo.
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
            <div className="flex items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
              <label className="form-label required" style={{ marginBottom: 0 }}>
                Grupos {gruposEscolhidos.length > 0 && `(${gruposEscolhidos.length} marcados)`}
              </label>

              {grupos.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setGruposEscolhidos(
                      gruposEscolhidos.length === grupos.length ? [] : grupos.map((g) => g.id)
                    )
                  }
                  className="btn btn-secondary btn-sm"
                >
                  <CheckSquare size={13} />
                  {gruposEscolhidos.length === grupos.length
                    ? 'Desmarcar todos'
                    : `Marcar todos (${grupos.length})`}
                </button>
              )}
            </div>

            {carregandoGrupos ? (
              <div className="text-muted text-sm">Carregando grupos...</div>
            ) : !turmaId ? (
              <div className="text-muted text-sm">Selecione a turma primeiro.</div>
            ) : (
              <div
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.5rem'
                }}
              >
                {grupos.map((g) => {
                  // COUNT do Postgres chega como string — precisa converter antes de comparar.
                  const total = Number(g.total_integrantes || 0);
                  const recebido = comMaterial[g.id];
                  return (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                      style={{ padding: '0.3rem 0.15rem' }}
                    >
                      <input
                        type="checkbox"
                        checked={gruposEscolhidos.includes(g.id)}
                        onChange={() => alternarGrupo(g.id)}
                      />
                      <span>
                        {g.nome}{' '}
                        <span className="text-muted">
                          ({total} integrante{total === 1 ? '' : 's'})
                        </span>
                      </span>
                      {recebido && (
                        <span className="grupo-com-material">já recebeu {recebido.total}</span>
                      )}
                      {total === 0 && (
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                          — grupo vazio, o envio será recusado
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            {turmaId && !carregandoGrupos && grupos.length === 0 && (
              <span className="text-muted text-sm">Nenhum grupo cadastrado nesta turma ainda.</span>
            )}

            {/* Resumo do lote: com vários grupos marcados, listar o conteúdo de
                cada um ocuparia a tela — o que decide a ação é quantos já foram
                atendidos. */}
            {jaAtendidos.length > 0 && (
              <div
                className="card"
                style={{ marginTop: '0.75rem', padding: '0.75rem', borderLeft: '4px solid #047857' }}
              >
                <div className="font-bold text-sm" style={{ color: '#047857' }}>
                  {jaAtendidos.length} dos {gruposEscolhidos.length} grupos marcados já receberam material
                </div>
                <ul className="text-sm text-muted" style={{ paddingLeft: '1.1rem', margin: '0.35rem 0 0' }}>
                  {jaAtendidos.map((id) => {
                    const g = grupos.find((x) => x.id === id);
                    return (
                      <li key={id}>
                        {g?.nome}: {comMaterial[id].materiais.map((m) => m.arquivoNome || m.titulo).join(', ')}
                      </li>
                    );
                  })}
                </ul>
                <div className="text-muted text-sm" style={{ marginTop: '0.4rem' }}>
                  Ao enviar, você escolhe entre substituir o material anterior desses grupos ou acrescentar este.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancelar</button>
          <button
            onClick={handleEnviar}
            disabled={enviando || gruposEscolhidos.length === 0}
            className="btn btn-primary"
          >
            <Send size={16} />{' '}
            {enviando
              ? `Enviando ${progresso?.feito ?? 0} de ${progresso?.total ?? 0}...`
              : gruposEscolhidos.length > 1
                ? `Publicar para ${gruposEscolhidos.length} grupos`
                : 'Publicar para o grupo'}
          </button>
        </div>
      </div>
    </div>
  );
};

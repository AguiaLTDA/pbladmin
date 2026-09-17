import React, { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { EtapaCronogramaPBL } from '../../constants/academico';
import { buscarCronograma, salvarCronograma } from '../../services/cronograma';
import { CronogramaPBL } from '../../components/CronogramaPBL';
import { CalendarDays, Save, Plus, Trash2, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';

/**
 * Edição do cronograma oficial das atividades PBL. O que for salvo aqui é a
 * mesma fonte que os portais do professor e do aluno leem na aba "Calendário de
 * Prazos" — não existe segunda cópia para manter em dia.
 */
export const CronogramaAdminView: React.FC = () => {
  const { showToast } = useToast();
  const [periodo, setPeriodo] = useState('');
  const [totalAvaliativo, setTotalAvaliativo] = useState('');
  const [etapas, setEtapas] = useState<EtapaCronogramaPBL[]>([]);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = (avisar = false) => {
    setCarregando(true);
    buscarCronograma()
      .then((dados) => {
        setPeriodo(dados.periodo);
        setTotalAvaliativo(dados.totalAvaliativo);
        setEtapas(dados.etapas);
        setAtualizadoEm(dados.atualizadoEm ?? null);
        if (avisar) showToast('Cronograma recarregado do servidor.', 'info');
      })
      .catch((err: any) => showToast(err.message || 'Erro ao carregar o cronograma.', 'error'))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
  }, []);

  const alterarEtapa = (indice: number, campo: keyof EtapaCronogramaPBL, valor: string) => {
    setEtapas((prev) =>
      prev.map((etapa, i) => {
        if (i !== indice) return etapa;
        if (campo === 'ordem') {
          return { ...etapa, ordem: valor.trim() === '' ? null : Number(valor) };
        }
        return { ...etapa, [campo]: valor };
      })
    );
  };

  const adicionarEtapa = () => {
    setEtapas((prev) => [
      ...prev,
      { ordem: prev.length + 1, titulo: '', prazoTexto: '', fim: '', pontos: undefined }
    ]);
  };

  const removerEtapa = (indice: number) => {
    setEtapas((prev) => prev.filter((_, i) => i !== indice));
  };

  /** Troca a etapa de lugar com a vizinha; a ordem da lista é a da exibição. */
  const moverEtapa = (indice: number, direcao: -1 | 1) => {
    setEtapas((prev) => {
      const destino = indice + direcao;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      const guardado = copia[indice];
      copia[indice] = copia[destino];
      copia[destino] = guardado;
      return copia;
    });
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const resposta = await salvarCronograma({ periodo, totalAvaliativo, etapas });
      showToast(resposta.message || 'Cronograma atualizado.', 'success');
      carregar();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar o cronograma.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>Calendário de Prazos — Cronograma PBL</h2>
          <p className="text-muted text-sm">
            Datas oficiais do semestre. O que for salvo aqui aparece imediatamente na aba
            &quot;Calendário de Prazos&quot; do aluno e do professor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => carregar(true)} disabled={carregando} className="btn btn-secondary">
            <RotateCcw size={16} />
            Recarregar
          </button>
          <button onClick={handleSalvar} disabled={salvando || carregando} className="btn btn-primary">
            <Save size={18} />
            {salvando ? 'Salvando...' : 'Salvar e Publicar'}
          </button>
        </div>
      </div>

      {carregando ? (
        <div className="text-center py-8 text-muted">Carregando cronograma...</div>
      ) : (
        <>
          <div className="card mb-4" style={{ padding: '1.25rem' }}>
            <h3 className="font-bold flex items-center gap-2 mb-2">
              <CalendarDays size={18} color="var(--primary)" />
              Cabeçalho do quadro
            </h3>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                <label className="form-label required">Semestre</label>
                <input
                  className="form-control"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  placeholder="2026/2"
                />
              </div>

              <div className="form-group" style={{ flex: '1 1 260px', marginBottom: 0 }}>
                <label className="form-label required">Total das entregas avaliativas</label>
                <input
                  className="form-control"
                  value={totalAvaliativo}
                  onChange={(e) => setTotalAvaliativo(e.target.value)}
                  placeholder="2,5 pontos"
                />
              </div>
            </div>

            {atualizadoEm && (
              <p className="text-muted text-sm" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                Última alteração publicada em {new Date(atualizadoEm).toLocaleString('pt-BR')}.
              </p>
            )}
          </div>

          <div
            className="flex items-center justify-between mb-2"
            style={{ flexWrap: 'wrap', gap: '0.5rem' }}
          >
            <h3 className="font-bold" style={{ fontSize: '1.05rem' }}>
              Etapas ({etapas.length})
            </h3>
            <button onClick={adicionarEtapa} className="btn btn-secondary btn-sm">
              <Plus size={16} />
              Adicionar etapa
            </button>
          </div>

          {etapas.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-muted text-sm">
                Nenhuma etapa cadastrada. Adicione ao menos uma antes de salvar.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {etapas.map((etapa, indice) => (
                <div key={indice} className="card" style={{ padding: '1rem' }}>
                  <div
                    className="flex items-center justify-between mb-2"
                    style={{ flexWrap: 'wrap', gap: '0.5rem' }}
                  >
                    <span className="font-bold text-sm text-muted">Etapa {indice + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => moverEtapa(indice, -1)}
                        disabled={indice === 0}
                        className="btn btn-secondary btn-sm"
                        title="Mover para cima"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => moverEtapa(indice, 1)}
                        disabled={indice === etapas.length - 1}
                        className="btn btn-secondary btn-sm"
                        title="Mover para baixo"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        onClick={() => removerEtapa(indice)}
                        className="btn btn-danger btn-sm"
                        title="Remover etapa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: '0 0 110px', marginBottom: '0.75rem' }}>
                      <label className="form-label">Numeração</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        value={etapa.ordem ?? ''}
                        onChange={(e) => alterarEtapa(indice, 'ordem', e.target.value)}
                        placeholder="—"
                      />
                    </div>

                    <div className="form-group" style={{ flex: '2 1 280px', marginBottom: '0.75rem' }}>
                      <label className="form-label required">Título</label>
                      <input
                        className="form-control"
                        value={etapa.titulo}
                        onChange={(e) => alterarEtapa(indice, 'titulo', e.target.value)}
                        placeholder="Entrega do PBL escrito"
                      />
                    </div>

                    <div className="form-group" style={{ flex: '0 0 170px', marginBottom: '0.75rem' }}>
                      <label className="form-label required">Data final</label>
                      <input
                        className="form-control"
                        type="date"
                        value={etapa.fim}
                        onChange={(e) => alterarEtapa(indice, 'fim', e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ flex: '1 1 240px', marginBottom: '0.75rem' }}>
                      <label className="form-label">Prazo exibido</label>
                      <input
                        className="form-control"
                        value={etapa.prazoTexto}
                        onChange={(e) => alterarEtapa(indice, 'prazoTexto', e.target.value)}
                        placeholder="de 23 a 27 de novembro"
                      />
                    </div>

                    <div className="form-group" style={{ flex: '0 0 150px', marginBottom: '0.75rem' }}>
                      <label className="form-label">Pontuação</label>
                      <input
                        className="form-control"
                        value={etapa.pontos || ''}
                        onChange={(e) => alterarEtapa(indice, 'pontos', e.target.value)}
                        placeholder="1,0 ponto"
                      />
                    </div>
                  </div>

                  <p className="text-muted text-sm" style={{ margin: 0 }}>
                    A <strong>data final</strong> é o que marca a etapa como encerrada nos portais; o{' '}
                    <strong>prazo exibido</strong> é o texto que o aluno lê (se ficar vazio, o sistema
                    escreve &quot;até DD de mês&quot;). Deixe a <strong>pontuação</strong> vazia nas
                    etapas que não valem nota.
                  </p>
                </div>
              ))}
            </div>
          )}

          <h3 className="font-bold mb-2" style={{ fontSize: '1.05rem', marginTop: '1.5rem' }}>
            Pré-visualização (como aluno e professor veem)
          </h3>
          {/* Lê do servidor, não do formulário: mostra o que está PUBLICADO hoje,
              e se atualiza sozinho assim que o "Salvar e Publicar" conclui. */}
          <CronogramaPBL />
        </>
      )}
    </div>
  );
};

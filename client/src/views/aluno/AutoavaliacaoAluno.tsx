import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { MeuGrupoAutoavaliacao, TurmaParaAutoavaliar } from '../../types';
import { SeletorEstrelas } from '../../components/SeletorEstrelas';
import { Star, Lock, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

interface CartaoGrupoProps {
  turma: TurmaParaAutoavaliar;
  podeEditar: boolean;
  onSalvo: (turmaId: number, colegas: TurmaParaAutoavaliar['colegas']) => void;
}

const CartaoGrupo: React.FC<CartaoGrupoProps> = ({ turma, podeEditar, onSalvo }) => {
  const { showToast } = useToast();
  const [notas, setNotas] = useState<Record<number, number | null>>(
    Object.fromEntries(turma.colegas.map((c) => [c.id, c.nota]))
  );
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setNotas(Object.fromEntries(turma.colegas.map((c) => [c.id, c.nota])));
  }, [turma.colegas]);

  const faltam = turma.colegas.filter((c) => notas[c.id] == null).length;
  const temColegas = turma.colegas.length > 0;
  const completa = temColegas && turma.completo && faltam === 0;
  const notasPreenchidas = turma.colegas.length - faltam;

  const handleSalvar = async () => {
    const semNota = turma.colegas.filter((c) => notas[c.id] == null);
    if (semNota.length > 0) {
      showToast('Dê uma nota de 1 a 5 estrelas para cada colega antes de enviar.', 'error');
      return;
    }
    setSalvando(true);
    try {
      const corpo = {
        grupoId: turma.grupoId,
        notas: Object.fromEntries(turma.colegas.map((c) => [c.id, notas[c.id]]))
      };
      const resposta = await apiRequest<{ persistido?: boolean; message?: string }>(
        '/autoavaliacao/meu-grupo', { method: 'POST', body: JSON.stringify(corpo) }
      );
      if (resposta.persistido === false) {
        showToast(resposta.message || 'Esta resposta não foi salva no servidor.', 'info');
        return;
      }
      showToast('Autoavaliação registrada com sucesso.', 'success');
      onSalvo(
        turma.turmaId,
        turma.colegas.map((c) => ({ ...c, nota: notas[c.id] ?? null }))
      );
    } catch (err: any) {
      showToast(err.message || 'Não foi possível salvar sua autoavaliação.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <div className="font-bold">{turma.grupoNome}</div>
          <div className="text-muted text-sm">{turma.turmaNome}</div>
        </div>
        {completa ? (
          <span className="pill-tag pill-tag-green" style={{ background: 'var(--success-light, #dcfce7)', color: '#14532d' }}>
            <CheckCircle2 size={12} /> Sua avaliação concluída
          </span>
        ) : !temColegas ? (
          <span className="pill-tag">Sem colegas para avaliar</span>
        ) : (
          <span className="pill-tag" style={{ color: 'var(--warning, #b45309)' }}>
            <Clock size={12} /> Pendente de envio
          </span>
        )}
      </div>

      {!temColegas ? (
        <div className="text-muted text-sm">Você é o único integrante deste grupo até o momento.</div>
      ) : (
        <>
          <p className="text-muted text-sm" style={{ margin: '0.25rem 0 0' }}>
            {completa
              ? `Sua avaliação foi registrada para ${turma.colegas.length} ${turma.colegas.length === 1 ? 'colega' : 'colegas'}.`
              : `${notasPreenchidas} de ${turma.colegas.length} colegas com nota escolhida; envie para registrar.`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.75rem' }}>
            {turma.colegas.map((colega) => (
              <div
                key={colega.id}
                className="flex items-center justify-between flex-wrap gap-2"
                style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border-color, #e5e7eb)' }}
              >
                <span className="font-bold text-sm">{colega.nome}</span>
                <SeletorEstrelas
                  valor={notas[colega.id] ?? null}
                  somenteLeitura={!podeEditar}
                  onChange={(nota) => setNotas((prev) => ({ ...prev, [colega.id]: nota }))}
                />
              </div>
            ))}
          </div>

          {podeEditar && (
            <button
              onClick={handleSalvar}
              disabled={salvando}
              className={`btn ${completa ? 'btn-success' : 'btn-primary'}`}
              style={{ marginTop: '1rem' }}
            >
              {salvando ? 'Enviando...' : faltam > 0 ? `Enviar (faltam ${faltam})` : completa ? 'Atualizar autoavaliação' : 'Enviar Autoavaliação'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export const AutoavaliacaoAlunoView: React.FC = () => {
  const { showToast } = useToast();
  const [dados, setDados] = useState<MeuGrupoAutoavaliacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<MeuGrupoAutoavaliacao>('/autoavaliacao/meu-grupo');
      setDados(res);
    } catch (err: any) {
      setErroCarregamento(true);
      showToast(err.message || 'Erro ao carregar sua autoavaliação.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSalvo = (turmaId: number, colegas: TurmaParaAutoavaliar['colegas']) => {
    setDados((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        turmas: prev.turmas.map((t) =>
          t.turmaId === turmaId ? { ...t, colegas, completo: colegas.every((c) => c.nota !== null) } : t
        )
      };
    });
  };

  if (loading) return <div className="p-4 text-center">Carregando sua autoavaliação...</div>;

  const status = dados?.status;
  const janela = dados?.janela;
  const gruposAvaliaveis = dados?.turmas.filter((turma) => turma.colegas.length > 0) || [];
  const gruposConcluidos = gruposAvaliaveis.filter(
    (turma) => turma.completo && turma.colegas.every((colega) => colega.nota !== null)
  ).length;
  const autoavaliacaoConcluida = Boolean(
    janela && status !== 'FUTURA' && status !== 'INEXISTENTE' && gruposAvaliaveis.length > 0 &&
    gruposConcluidos === gruposAvaliaveis.length
  );

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ fontSize: '1.4rem' }}>Autoavaliação do Grupo</h2>
        <p className="text-muted text-sm">
          Avalie a desenvoltura de cada colega no projeto PBL: 1 estrela indica ausência de participação
          ou participação irrelevante, e 5 estrelas indicam total dedicação à realização do projeto.
        </p>
      </div>

      {autoavaliacaoConcluida && (
        <div
          role="status"
          className="card flex items-center gap-3 mb-4"
          style={{ background: 'var(--success-light, #dcfce7)', borderLeft: '5px solid var(--success, #16a34a)', color: '#14532d', padding: '1rem 1.25rem' }}
        >
          <CheckCircle2 size={30} color="var(--success, #16a34a)" style={{ flexShrink: 0 }} />
          <div>
            <div className="font-bold" style={{ color: 'var(--success, #15803d)' }}>Autoavaliação concluída</div>
            <p className="text-sm" style={{ margin: '0.2rem 0 0' }}>
              Sua autoavaliação foi registrada na rodada <strong>{janela?.titulo}</strong> — {gruposConcluidos} de {gruposAvaliaveis.length} avaliações de grupo concluídas.
            </p>
          </div>
        </div>
      )}

      {erroCarregamento ? (
        <div className="card text-center py-8">
          <AlertTriangle size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Não foi possível carregar sua autoavaliação</h3>
          <p className="text-muted text-sm">Tente consultar novamente em instantes.</p>
        </div>
      ) : !janela && (
        <div className="card text-center py-8">
          <Star size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhuma rodada de autoavaliação cadastrada</h3>
          <p className="text-muted text-sm">Procure a coordenação do seu curso.</p>
        </div>
      )}

      {janela && status === 'FUTURA' && (
        <div className="card mb-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div className="flex items-start gap-3">
            <Clock size={20} color="#1d4ed8" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <div>
              <strong style={{ color: '#1d4ed8' }}>{janela.titulo} ainda não abriu</strong>
              <p className="text-sm" style={{ margin: '0.35rem 0 0', color: '#1e3a8a' }}>
                O período para avaliar seus colegas de grupo abre em {formatarData(janela.abreEm)} e vai até{' '}
                {formatarData(janela.fechaEm)}.
              </p>
            </div>
          </div>
        </div>
      )}

      {janela && status === 'ENCERRADA' && (
        <div className="card mb-4" style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
          <div className="flex items-start gap-3">
            <Lock size={20} color="#b45309" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <div>
              <strong style={{ color: '#b45309' }}>Prazo encerrado</strong>
              <p className="text-sm" style={{ margin: '0.35rem 0 0', color: '#78350f' }}>
                O período de {janela.titulo.toLowerCase()} terminou em {formatarData(janela.fechaEm)}. Abaixo você
                confere o que foi enviado.
              </p>
            </div>
          </div>
        </div>
      )}

      {janela && (dados?.turmas.length || 0) === 0 && (
        <div className="card text-center py-8">
          <Star size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Você ainda não está em nenhum grupo</h3>
          <p className="text-muted text-sm">
            Confirme seu grupo em "Meus Grupos PBL" antes de fazer a autoavaliação.
          </p>
        </div>
      )}

      {janela &&
        dados?.turmas.map((turma) => (
          <CartaoGrupo
            key={turma.turmaId}
            turma={turma}
            podeEditar={status === 'ABERTA'}
            onSalvo={handleSalvo}
          />
        ))}
    </div>
  );
};

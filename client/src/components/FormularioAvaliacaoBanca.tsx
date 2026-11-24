import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { OUTRA_SALA, SALAS_BANCA } from '../constants/salasBanca';

// Perguntas do formulário da banca: as sete do formulário de julho + material de apoio.
export const CRITERIOS_BANCA = [
  { key: 'score_clarity', label: 'Clareza e objetividade na apresentação do problema' },
  { key: 'score_mastery', label: 'Domínio do conteúdo pelos integrantes do grupo' },
  { key: 'score_solution', label: 'Qualidade da solução proposta / entregável' },
  { key: 'score_coherence', label: 'Coerência entre o problema real e a solução apresentada' },
  { key: 'score_organization', label: 'Organização e estrutura da apresentação (slides, tempo, sequência lógica)' },
  { key: 'score_material', label: 'Qualidade do material de apoio (slides ou equivalente, no modelo institucional)' },
  { key: 'score_questions', label: 'Capacidade de responder às perguntas da banca' },
  { key: 'score_teamwork', label: 'Trabalho em equipe e distribuição das falas' }
] as const;

// Critérios do PBL oral do Manual do Aluno (seção 6). Cada um vale a média das suas
// perguntas / 5 × peso; a banca atribui até 1,3 dos 1,5 pontos. A presença na Expo
// UNIVC (0,2) não é avaliada aqui. "Trabalho em equipe" não tem peso no manual:
// fica registrado, sem entrar na nota.
export const GRUPOS_MANUAL_BANCA = [
  { titulo: 'Domínio do conteúdo', peso: 0.5, questoes: ['score_mastery', 'score_solution', 'score_coherence'] },
  { titulo: 'Clareza e organização da exposição', peso: 0.3, questoes: ['score_clarity', 'score_organization'] },
  { titulo: 'Qualidade do material de apoio', peso: 0.2, questoes: ['score_material'] },
  { titulo: 'Resposta à arguição', peso: 0.3, questoes: ['score_questions'] }
] as const;

export const QUESTOES_SEM_PESO = ['score_teamwork'] as const;

export const NOTA_MAXIMA_BANCA = 1.3;

export type CriterioBanca = (typeof CRITERIOS_BANCA)[number]['key'];

export const STATUS_BANCA = [
  { value: 'approved', label: 'Sim, aprovado' },
  { value: 'approved_with_notes', label: 'Aprovado com ressalvas' },
  { value: 'rejected', label: 'Não aprovado — necessita revisão' }
] as const;

export type StatusBanca = (typeof STATUS_BANCA)[number]['value'];

export interface GrupoBanca {
  id: number;
  nome: string;
  turma_id: number;
  turma_nome: string;
  curso_nome: string | null;
  alunos: number;
  integrantes: string | null;
}

export type AvaliacaoBanca = {
  id: number;
  grupo_id: number;
  grupo_nome: string;
  turma_id: number;
  turma_nome: string;
  curso_nome: string | null;
  avaliador_id: number | null;
  avaliador_nome: string;
  avaliador_email: string;
  origem?: 'publico' | 'plataforma';
  dia: string | null;
  sala: string | null;
  pontos_fortes: string | null;
  pontos_melhoria: string | null;
  nao_contribuiram: string | null;
  nota_final: number | null;
  status: StatusBanca;
  criado_em: string;
  atualizado_em: string;
} & Record<CriterioBanca, number>;

/** Nota da banca (0 a 1,3): por critério do manual, média das suas perguntas / 5 × peso. */
export const notaBanca = (a: Partial<Record<CriterioBanca, number | null>>) =>
  Number(
    GRUPOS_MANUAL_BANCA.reduce(
      (s, g) => s + (g.questoes.reduce((t, q) => t + Number(a[q] || 0), 0) / g.questoes.length / 5) * g.peso,
      0
    ).toFixed(2)
  );

const rotuloQuestao = (k: CriterioBanca) => CRITERIOS_BANCA.find((c) => c.key === k)?.label ?? k;

const pesoTexto = (p: number) => p.toLocaleString('pt-BR', { minimumFractionDigits: 1 });

export const formatarNota = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const rotuloStatusBanca = (s: string) => STATUS_BANCA.find((o) => o.value === s)?.label ?? s;

interface Props {
  /** Avaliação existente para editar (reenvio atualiza a anterior). */
  editando?: AvaliacaoBanca | null;
  onSalvo?: (resultado?: { grupoNome: string; nota: number | null }) => void;
  /** Formulário público (link /<token>, sem login): avaliador já identificado na etapa anterior. */
  publico?: { token: string; sessao: string; email: string; nome: string };
}

type Formulario = {
  dia: string;
  sala: string;
  turmaId: number | '';
  grupoId: number | '';
  notas: Partial<Record<CriterioBanca, number>>;
  pontos_fortes: string;
  pontos_melhoria: string;
  nao_contribuiram: string;
  nota_final: string;
  status: StatusBanca | '';
};

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const diaPadrao = () => (SALAS_BANCA.some((d) => d.data === hoje()) ? hoje() : '');

const VAZIO: Formulario = {
  dia: '',
  sala: '',
  turmaId: '',
  grupoId: '',
  notas: {},
  pontos_fortes: '',
  pontos_melhoria: '',
  nao_contribuiram: '',
  nota_final: '',
  status: ''
};

const EscalaQuestao: React.FC<{ rotulo: string; valor?: number; onChange: (n: number) => void }> = ({
  rotulo,
  valor,
  onChange
}) => (
  <div className="form-group">
    <label className="form-label required">{rotulo}</label>
    <div className="flex gap-2 flex-wrap">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`btn btn-sm ${valor === n ? 'btn-primary' : 'btn-secondary'}`}
          style={{ minWidth: '2.75rem' }}
          aria-pressed={valor === n}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  </div>
);

export const FormularioAvaliacaoBanca: React.FC<Props> = ({ editando, onSalvo, publico }) => {
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const { showToast } = useToast();
  const [grupos, setGrupos] = useState<GrupoBanca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<Formulario>(VAZIO);

  useEffect(() => {
    apiRequest<GrupoBanca[]>(
      publico ? `/public/banca/${publico.token}/grupos?sessao=${encodeURIComponent(publico.sessao)}` : '/banca/grupos'
    )
      .then((g) => setGrupos(Array.isArray(g) ? g : []))
      .catch((err) => {
        if (publico) setErroCarga(err.message || 'Não foi possível abrir o formulário.');
        else showToast(err.message || 'Erro ao carregar os grupos.', 'error');
      })
      .finally(() => setCarregando(false));
    // showToast não é memoizado no contexto; carregar uma vez só.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editando) {
      setForm({ ...VAZIO, dia: diaPadrao() });
      return;
    }
    const notas: Partial<Record<CriterioBanca, number>> = {};
    CRITERIOS_BANCA.forEach((c) => (notas[c.key] = editando[c.key]));
    const diaCadastrado = SALAS_BANCA.find((d) => d.data === editando.dia);
    const salaConhecida = diaCadastrado?.salas.some((x) => x.sala === editando.sala);
    setForm({
      dia: editando.dia || '',
      sala: salaConhecida ? editando.sala! : OUTRA_SALA,
      turmaId: editando.turma_id,
      grupoId: editando.grupo_id,
      notas,
      pontos_fortes: editando.pontos_fortes || '',
      pontos_melhoria: editando.pontos_melhoria || '',
      nao_contribuiram: editando.nao_contribuiram || '',
      nota_final: editando.nota_final == null ? '' : String(editando.nota_final).replace('.', ','),
      status: editando.status
    });
  }, [editando]);

  const salasDoDia = SALAS_BANCA.find((d) => d.data === form.dia)?.salas ?? [];
  const turmasDaSala = salasDoDia.find((x) => x.sala === form.sala)?.turmas;

  // Turmas da sala escolhida (dia + sala); "Outra sala" libera todas as participantes.
  const turmas = useMemo(() => {
    const mapa = new Map<number, { id: number; nome: string; curso: string | null }>();
    grupos
      .filter((g) => form.sala === OUTRA_SALA || (turmasDaSala ?? []).includes(g.turma_nome))
      .forEach((g) => mapa.set(g.turma_id, { id: g.turma_id, nome: g.turma_nome, curso: g.curso_nome }));
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [grupos, form.sala, turmasDaSala]);

  const gruposDaTurma = useMemo(
    () => grupos.filter((g) => g.turma_id === form.turmaId),
    [grupos, form.turmaId]
  );
  const grupoSelecionado = grupos.find((g) => g.id === form.grupoId);
  const todasNotas = CRITERIOS_BANCA.every((c) => form.notas[c.key]);
  const notaSugerida = todasNotas ? notaBanca(form.notas) : null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.dia || !form.sala) return showToast('Selecione o dia e a sala da banca.', 'error');
    if (!form.grupoId) return showToast('Selecione a turma e o grupo.', 'error');
    if (!todasNotas) return showToast('Avalie todos os critérios de 1 a 5.', 'error');
    if (!form.status) return showToast('Informe se o trabalho foi aprovado.', 'error');
    if (form.nota_final.trim()) {
      const n = Number(form.nota_final.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > NOTA_MAXIMA_BANCA) return showToast('A nota final da banca deve ficar entre 0 e 1,3.', 'error');
    }

    setSalvando(true);
    try {
      const corpoIdentidade = publico
        ? { grupo_id: form.grupoId, sessao: publico.sessao, avaliador_email: publico.email, avaliador_nome: publico.nome }
        : {};
      await apiRequest(publico ? `/public/banca/${publico.token}/avaliacao` : `/banca/grupos/${form.grupoId}/avaliacao`, {
        method: publico ? 'POST' : 'PUT',
        body: JSON.stringify({
          ...corpoIdentidade,
          dia: form.dia,
          sala: form.sala === OUTRA_SALA ? null : form.sala,
          ...form.notas,
          pontos_fortes: form.pontos_fortes,
          pontos_melhoria: form.pontos_melhoria,
          nao_contribuiram: form.nao_contribuiram,
          nota_final: form.nota_final.trim() ? form.nota_final.replace(',', '.') : null,
          status: form.status
        })
      });
      showToast(
        `Avaliação do grupo ${grupoSelecionado?.nome ?? ''} registrada. Nota da banca: ${formatarNota(notaSugerida)} (0 a 1,3).`,
        'success'
      );
      // Mantém dia, sala e turma para agilizar o próximo grupo da mesma banca.
      setForm({ ...VAZIO, dia: form.dia, sala: form.sala, turmaId: form.turmaId });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onSalvo?.({ grupoNome: grupoSelecionado?.nome ?? '', nota: notaSugerida });
    } catch (err: any) {
      showToast(err.message || 'Não foi possível enviar a avaliação.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-muted" style={{ padding: '2rem' }}>
        <Loader2 size={18} className="animate-spin" /> Carregando turmas e grupos...
      </div>
    );
  }

  if (erroCarga) {
    return (
      <div className="card text-center" style={{ padding: '2rem 1.5rem' }}>
        <h3 className="font-bold mb-2">Não foi possível abrir o formulário</h3>
        <p className="text-muted mb-0">{erroCarga}</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar}>
      <div className="card mb-4">
        <h3 className="font-bold mb-3">Banca, turma e grupo</h3>
        <div className="form-group">
          <label className="form-label required">Dia</label>
          <select
            className="form-control"
            value={form.dia}
            disabled={!!editando}
            onChange={(e) => setForm({ ...form, dia: e.target.value, sala: '', turmaId: '', grupoId: '' })}
          >
            <option value="">Selecione o dia</option>
            {SALAS_BANCA.map((d) => (
              <option key={d.data} value={d.data}>{d.rotulo}</option>
            ))}
          </select>
        </div>
        {form.dia !== '' && (
          <div className="form-group">
            <label className="form-label required">Sala</label>
            <select
              className="form-control"
              value={form.sala}
              disabled={!!editando}
              onChange={(e) => setForm({ ...form, sala: e.target.value, turmaId: '', grupoId: '' })}
            >
              <option value="">Selecione a sala</option>
              {salasDoDia.map((x) => (
                <option key={x.sala} value={x.sala}>{x.sala}</option>
              ))}
              <option value={OUTRA_SALA}>Outra sala (todas as turmas)</option>
            </select>
          </div>
        )}
        {form.sala !== '' && (
        <div className="form-group">
          <label className="form-label required">Turma</label>
          <select
            className="form-control"
            value={form.turmaId}
            disabled={!!editando}
            onChange={(e) => setForm({ ...form, turmaId: e.target.value ? Number(e.target.value) : '', grupoId: '' })}
          >
            <option value="">Selecione a turma</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
                {t.curso ? ` — ${t.curso}` : ''}
              </option>
            ))}
          </select>
          {turmas.length === 0 && (
            <p className="text-muted text-sm mt-2">Nenhuma turma com grupos nesta sala. Use "Outra sala".</p>
          )}
        </div>
        )}
        {form.turmaId !== '' && (
          <div className="form-group mb-0">
            <label className="form-label required">Grupo</label>
            <select
              className="form-control"
              value={form.grupoId}
              disabled={!!editando}
              onChange={(e) => setForm({ ...form, grupoId: e.target.value ? Number(e.target.value) : '' })}
            >
              <option value="">Selecione o grupo</option>
              {gruposDaTurma.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome} ({g.alunos} {g.alunos === 1 ? 'aluno' : 'alunos'})
                </option>
              ))}
            </select>
            {grupoSelecionado && (
              <div className="text-sm mt-2" style={{ padding: '0.65rem 0.85rem', borderRadius: '0.5rem', background: 'var(--bg-secondary, #f4f6f5)' }}>
                <p className="font-bold mb-1">Alunos do grupo</p>
                {grupoSelecionado.integrantes ? (
                  <ul className="mb-0" style={{ paddingLeft: '1.1rem', listStyle: 'disc' }}>
                    {grupoSelecionado.integrantes.split(', ').map((nome) => (
                      <li key={nome}>{nome}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted mb-0">Nenhum aluno listado.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card mb-4">
        <h3 className="font-bold mb-1">Critérios</h3>
        <p className="text-muted text-sm mb-3">
          Marque cada item de 1 (Insuficiente) a 5 (Excelente). As perguntas estão agrupadas nos critérios do PBL
          oral do Manual do Aluno; cada critério vale até o peso indicado, e a banca atribui até 1,3 ponto. A
          presença na Expo UNIVC (0,2) não é avaliada aqui.
        </p>
        {GRUPOS_MANUAL_BANCA.map((g) => (
          <div key={g.titulo} className="mb-4">
            <h4 className="font-bold mb-2" style={{ fontSize: '0.95rem' }}>
              {g.titulo} <span className="text-muted" style={{ fontWeight: 400 }}>(até {pesoTexto(g.peso)})</span>
            </h4>
            {g.questoes.map((k) => (
              <EscalaQuestao key={k} rotulo={rotuloQuestao(k)} valor={form.notas[k]}
                onChange={(n) => setForm({ ...form, notas: { ...form.notas, [k]: n } })} />
            ))}
          </div>
        ))}
        <div className="mb-4">
          <h4 className="font-bold mb-2" style={{ fontSize: '0.95rem' }}>
            Participação <span className="text-muted" style={{ fontWeight: 400 }}>(registro, não entra na nota)</span>
          </h4>
          {QUESTOES_SEM_PESO.map((k) => (
            <EscalaQuestao key={k} rotulo={rotuloQuestao(k)} valor={form.notas[k]}
              onChange={(n) => setForm({ ...form, notas: { ...form.notas, [k]: n } })} />
          ))}
        </div>
        <p className="text-sm mb-0">
          Nota da banca: <strong>{formatarNota(notaSugerida)}</strong> <span className="text-muted">(de 0 a 1,3)</span>
        </p>
      </div>

      <div className="card mb-4">
        <h3 className="font-bold mb-3">Comentários</h3>
        <div className="form-group">
          <label className="form-label">Pontos fortes</label>
          <textarea className="form-control" rows={3} maxLength={2000} value={form.pontos_fortes}
            onChange={(e) => setForm({ ...form, pontos_fortes: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Pontos de melhoria</label>
          <textarea className="form-control" rows={3} maxLength={2000} value={form.pontos_melhoria}
            onChange={(e) => setForm({ ...form, pontos_melhoria: e.target.value })} />
        </div>
        <div className="form-group mb-0">
          <label className="form-label">Integrantes que não contribuíram</label>
          <textarea className="form-control" rows={2} maxLength={2000} value={form.nao_contribuiram}
            placeholder="Nomes de quem não participou da apresentação, se houver"
            onChange={(e) => setForm({ ...form, nao_contribuiram: e.target.value })} />
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="font-bold mb-3">Resultado</h3>
        <div className="form-group">
          <label className="form-label">Nota final da banca (opcional, de 0 a 1,3)</label>
          <input className="form-control" inputMode="decimal" style={{ maxWidth: '10rem' }}
            placeholder={notaSugerida == null ? 'ex.: 1,20' : formatarNota(notaSugerida)}
            value={form.nota_final} onChange={(e) => setForm({ ...form, nota_final: e.target.value })} />
        </div>
        <div className="form-group mb-0">
          <label className="form-label required">O trabalho foi aprovado?</label>
          <div className="flex flex-col gap-2">
            {STATUS_BANCA.map((s) => (
              <label key={s.value} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                <input type="radio" name="status-banca" value={s.value} checked={form.status === s.value}
                  onChange={() => setForm({ ...form, status: s.value })} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={salvando}>
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {editando ? 'Salvar alterações' : 'Enviar avaliação'}
        </button>
        {editando && (
          <button type="button" className="btn btn-secondary" onClick={() => onSalvo?.()}>
            Cancelar edição
          </button>
        )}
      </div>
    </form>
  );
};

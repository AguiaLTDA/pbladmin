import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { OUTRA_SALA, SALAS_BANCA } from '../constants/salasBanca';

// Formulário de avaliação da banca do PBL oral — o mesmo das bancas de julho.
export const CRITERIOS_BANCA = [
  { key: 'score_clarity', label: 'Clareza e objetividade na apresentação do problema' },
  { key: 'score_mastery', label: 'Domínio do conteúdo pelos integrantes do grupo' },
  { key: 'score_solution', label: 'Qualidade da solução proposta / entregável' },
  { key: 'score_coherence', label: 'Coerência entre o problema real e a solução apresentada' },
  { key: 'score_organization', label: 'Organização e estrutura da apresentação (slides, tempo, sequência lógica)' },
  { key: 'score_questions', label: 'Capacidade de responder às perguntas da banca' },
  { key: 'score_teamwork', label: 'Trabalho em equipe e distribuição das falas' }
] as const;

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
  avaliador_id: number;
  avaliador_nome: string;
  avaliador_email: string;
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

export const mediaCriterios = (a: Partial<Record<CriterioBanca, number>>) =>
  CRITERIOS_BANCA.reduce((s, c) => s + Number(a[c.key] || 0), 0) / CRITERIOS_BANCA.length;

export const formatarNota = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const rotuloStatusBanca = (s: string) => STATUS_BANCA.find((o) => o.value === s)?.label ?? s;

interface Props {
  /** Avaliação existente para editar (reenvio atualiza a anterior). */
  editando?: AvaliacaoBanca | null;
  onSalvo?: () => void;
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

export const FormularioAvaliacaoBanca: React.FC<Props> = ({ editando, onSalvo }) => {
  const { showToast } = useToast();
  const [grupos, setGrupos] = useState<GrupoBanca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<Formulario>(VAZIO);

  useEffect(() => {
    apiRequest<GrupoBanca[]>('/banca/grupos')
      .then((g) => setGrupos(Array.isArray(g) ? g : []))
      .catch((err) => showToast(err.message || 'Erro ao carregar os grupos.', 'error'))
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
  const notaSugerida = todasNotas ? mediaCriterios(form.notas) * 0.3 : null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.dia || !form.sala) return showToast('Selecione o dia e a sala da banca.', 'error');
    if (!form.grupoId) return showToast('Selecione a turma e o grupo.', 'error');
    if (!todasNotas) return showToast('Avalie todos os critérios de 1 a 5.', 'error');
    if (!form.status) return showToast('Informe se o trabalho foi aprovado.', 'error');
    if (form.nota_final.trim()) {
      const n = Number(form.nota_final.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > 1.5) return showToast('A nota final deve ficar entre 0 e 1,5.', 'error');
    }

    setSalvando(true);
    try {
      await apiRequest(`/banca/grupos/${form.grupoId}/avaliacao`, {
        method: 'PUT',
        body: JSON.stringify({
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
        `Avaliação do grupo ${grupoSelecionado?.nome ?? ''} registrada. Nota média: ${formatarNota(notaSugerida)} (0 a 1,5).`,
        'success'
      );
      // Mantém dia, sala e turma para agilizar o próximo grupo da mesma banca.
      setForm({ ...VAZIO, dia: form.dia, sala: form.sala, turmaId: form.turmaId });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onSalvo?.();
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
            {grupoSelecionado?.integrantes && (
              <p className="text-muted text-sm mt-2">Integrantes: {grupoSelecionado.integrantes}</p>
            )}
          </div>
        )}
      </div>

      <div className="card mb-4">
        <h3 className="font-bold mb-1">Critérios</h3>
        <p className="text-muted text-sm mb-3">De 1 (Insuficiente) a 5 (Excelente).</p>
        {CRITERIOS_BANCA.map((c) => (
          <div key={c.key} className="form-group">
            <label className="form-label required">{c.label}</label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-sm ${form.notas[c.key] === n ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minWidth: '2.75rem' }}
                  aria-pressed={form.notas[c.key] === n}
                  onClick={() => setForm({ ...form, notas: { ...form.notas, [c.key]: n } })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-sm mb-0">
          Nota média (média × 0,3): <strong>{formatarNota(notaSugerida)}</strong> <span className="text-muted">(escala 0 a 1,5)</span>
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
          <label className="form-label">Nota final (opcional, de 0 a 1,5)</label>
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

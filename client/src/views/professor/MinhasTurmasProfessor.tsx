import React, { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Users, BookOpen, Wifi } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { ProfessorBindings, ScheduleEntry, DiaSemana } from '../../types';
import { useToast } from '../../context/ToastContext';

const ROTULO_DIA: Record<DiaSemana, string> = {
  SEGUNDA: 'Segunda',
  TERCA: 'Terça',
  QUARTA: 'Quarta',
  QUINTA: 'Quinta',
  SEXTA: 'Sexta',
  CALENDARIO: 'Conforme calendário'
};

const ORDEM_DIA: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'CALENDARIO'];

/**
 * Painel do docente com as turmas e disciplinas em que ele leciona.
 * Tudo vem do horário acadêmico — o backend já devolve apenas o que é dele.
 */
export const MinhasTurmasProfessorView: React.FC = () => {
  const { showToast } = useToast();
  const [vinculos, setVinculos] = useState<ProfessorBindings | null>(null);
  const [grade, setGrade] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest<ProfessorBindings>('/academic/my-bindings'),
      apiRequest<ScheduleEntry[]>('/academic/schedule')
    ])
      .then(([b, g]) => {
        setVinculos(b);
        setGrade(g);
      })
      .catch((err) => showToast(err.message || 'Erro ao carregar seus vínculos.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-muted">Carregando suas turmas e o horário acadêmico...</div>;
  }

  const turmas = vinculos?.turmas || [];

  const aulasPorDia = ORDEM_DIA.map((dia) => ({
    dia,
    aulas: grade.filter((a) => a.dia_semana === dia)
  })).filter((g) => g.aulas.length > 0);

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ fontSize: '1.4rem' }}>Minhas Turmas & Horário Acadêmico</h2>
        <p className="text-muted text-sm">
          Vínculos derivados da grade acadêmica. Você só visualiza as turmas em que leciona e as
          respectivas entregas.
        </p>
      </div>

      {turmas.length === 0 ? (
        <div className="card text-center py-8">
          <Users size={36} className="text-muted mb-2" style={{ margin: '0 auto' }} />
          <h3 className="font-bold">Nenhuma turma vinculada</h3>
          <p className="text-muted text-sm">
            Seu nome não consta no horário acadêmico importado. Procure a coordenação para revisar a grade.
          </p>
        </div>
      ) : (
        <>
          <div className="table-responsive mb-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Turma</th>
                  <th>Curso</th>
                  <th>Disciplinas que você leciona</th>
                  <th style={{ textAlign: 'right' }}>Alunos</th>
                </tr>
              </thead>
              <tbody>
                {turmas.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="font-bold">{t.nome}</div>
                      <div className="text-muted text-sm">
                        {t.codigo} · {t.turno} · {t.periodo_nome}
                      </div>
                    </td>
                    <td>{t.curso_nome || '-'}</td>
                    <td className="text-sm">
                      {(t.disciplinas_nomes || '').split(' | ').filter(Boolean).join(' · ') || '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{t.total_alunos}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="font-bold mb-2 flex items-center gap-2">
            <CalendarDays size={18} color="var(--primary)" /> Minha grade de aulas
          </h3>

          {aulasPorDia.map(({ dia, aulas }) => (
            <div key={dia} className="mb-4">
              <div className="nav-section-title">{ROTULO_DIA[dia]}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.85rem' }}>
                {aulas.map((a) => (
                  <div key={a.id} className="card" style={{ padding: '0.9rem' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                        {a.curso_nome}
                      </span>
                      {a.modalidade === 'EAD' && (
                        <span className="status-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                          <Wifi size={11} /> EAD
                        </span>
                      )}
                    </div>

                    <div className="font-bold mb-1">{a.disciplina_nome}</div>
                    <div className="text-muted text-sm mb-2">{a.turmas_nomes} · {a.turno}</div>

                    <div className="text-sm flex items-center gap-2">
                      <BookOpen size={13} /> Módulo {a.modulo}
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <MapPin size={13} /> {a.local || 'Local a definir'}
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <CalendarDays size={13} /> {a.hora_inicio} às {a.hora_fim}
                    </div>

                    {a.juncao && (
                      <div className="text-muted text-sm mt-2 flex items-center gap-2">
                        <Users size={13} /> {a.juncao}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

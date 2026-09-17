import React from 'react';
import { CronogramaPBL } from '../../components/CronogramaPBL';
import { CalendarDays } from 'lucide-react';

interface Props {
  navigate: (path: string) => void;
}

/**
 * Aba "Calendário de Prazos" do professor. Mostra exatamente o mesmo quadro que
 * o aluno vê, lido do cronograma que a coordenação mantém em /admin/cronograma —
 * é o que garante que docente e turma nunca discutam datas diferentes.
 */
export const CalendarioPrazosProfessorView: React.FC<Props> = ({ navigate }) => (
  <div>
    <div className="mb-4">
      <h2 style={{ fontSize: '1.4rem' }}>Calendário e Linha do Tempo de Prazos</h2>
      <p className="text-muted text-sm">
        Cronograma oficial das atividades PBL definido pela coordenação. É a mesma tela que os seus
        alunos enxergam.
      </p>
    </div>

    <CronogramaPBL />

    <div className="card flex items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
      <div className="flex items-center gap-2">
        <CalendarDays size={18} color="var(--primary)" />
        <span className="text-sm">
          Os prazos de cada entrega das suas turmas ficam em Acompanhamento &amp; Entregas.
        </span>
      </div>
      <button onClick={() => navigate('/professor/entregas')} className="btn btn-secondary btn-sm">
        Abrir Acompanhamento &amp; Entregas
      </button>
    </div>
  </div>
);

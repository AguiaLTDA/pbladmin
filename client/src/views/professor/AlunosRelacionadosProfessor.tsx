import React from 'react';
import { PanoramaContextosAlunos } from '../../components/PanoramaContextosAlunos';

interface Props {
  /** O dashboard abre esta tela já na aba correspondente ao indicador clicado. */
  abaInicial?: 'alunos' | 'grupos';
}

/**
 * Os alunos e grupos das turmas que o docente leciona. O recorte é aplicado no
 * servidor a partir dos vínculos da grade — esta tela não filtra por professor,
 * ela apenas exibe o que o endpoint devolve.
 */
export const AlunosRelacionadosProfessorView: React.FC<Props> = ({ abaInicial = 'alunos' }) => (
  <PanoramaContextosAlunos
    abaInicial={abaInicial}
    titulo="Alunos & Grupos Relacionados"
    descricao={
      'Os estudantes matriculados nas turmas que você leciona e os grupos PBL que eles formam. ' +
      'A medalha indica quem preencheu o Contexto Profissional — clique no nome para ler o relato ' +
      'e aproximar suas aulas e casos da realidade de trabalho da turma.'
    }
  />
);

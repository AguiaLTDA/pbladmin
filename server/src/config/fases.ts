/**
 * Fases do calendário PBL que abrem e fecham a cada semestre.
 *
 * O cadastro de grupos é uma janela: abre no início do semestre e fecha quando
 * as equipes estão formadas. Fechada, nenhum aluno cria grupo, entra em grupo,
 * troca de grupo ou puxa colega — qualquer ajuste passa a ser da coordenação,
 * que continua com a gestão completa em Cursos, Turmas & Grupos.
 *
 * Reabrir no semestre seguinte é definir CADASTRO_GRUPOS_ABERTO=true no
 * ambiente (Render e .env local), sem alterar código nem publicar de novo. O
 * padrão é FECHADO: esquecer a variável tranca o cadastro, que é o erro barato
 * — o contrário abriria a formação de equipes sem ninguém perceber.
 */
import dotenv from 'dotenv';

dotenv.config();

export const CADASTRO_GRUPOS_ABERTO = String(process.env.CADASTRO_GRUPOS_ABERTO || '').toLowerCase() === 'true';

/** Texto único da recusa: a API e a tela do aluno dizem exatamente o mesmo. */
export const MENSAGEM_GRUPOS_ENCERRADO =
  'O período de cadastro e alteração de grupos PBL está encerrado. ' +
  'Para entrar em um grupo, sair, trocar ou incluir um colega, procure a coordenação do seu curso.';

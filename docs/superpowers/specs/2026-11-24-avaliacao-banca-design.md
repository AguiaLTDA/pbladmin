# Avaliação da Banca no PBL

Data: 24/11/2026 · Urgência: as bancas do PBL oral começam hoje às 19h.
Versão simplificada, a pedido do usuário ("máximo de simplicidade").

## Intenção

Levar para dentro do PBL o formulário de avaliação de bancas usado na rodada
anterior (app Lovable "avaliacaopbl"). No app antigo, o formulário era público,
o avaliador digitava nome e e-mail, e cursos e grupos ficavam fixos no código.
Aqui o avaliador é o usuário logado (professor ou admin), e as turmas e os grupos
vêm do banco do PBL.

## Metas

- Professor e admin abrem o formulário e escolhem livremente **dia → sala**. A
  sala só filtra as turmas oferecidas (`client/src/constants/salasBanca.ts`, a
  partir das planilhas da coordenação). Depois escolhem turma → grupo, entre os
  grupos ativos com alunos matriculados. A opção "Outra sala" libera todas as turmas.
  Não há escala por professor.
- O formulário traz as 7 perguntas de julho e mais "qualidade do material de apoio", de 1 a 5,
  agrupadas nos critérios do PBL oral do Manual do Aluno. Cada critério vale a média das suas
  perguntas / 5 × peso:
  - domínio do conteúdo (0,5): domínio, solução, coerência;
  - clareza e organização (0,3): clareza, organização;
  - material de apoio (0,2): material;
  - arguição (0,3): respostas à banca.

  A nota da banca vai até 1,3. A presença na Expo (0,2) fica fora do formulário, e "trabalho em
  equipe" é registrado sem peso. Também há pontos fortes, pontos de melhoria, integrantes que não
  contribuíram, nota final opcional (0 a 1,3) e status.
- Uma avaliação por avaliador e grupo. O reenvio atualiza a anterior.
- Uma aba só do admin, "Notas da Banca", lista as notas por banca (dia · sala) e
  filtra por dia, sala, turma e grupo. Mostra a média do grupo e exporta CSV.

## Fora do escopo agora

- Escala de bancas (quem avalia qual grupo). A planilha da coordenação continua
  sendo a referência, fora do sistema.
- Gravar em `feedbacks.nota_oral`. Fica para uma etapa posterior, que trate
  ausências e a presença na Expo.
- Aluno ver a avaliação da banca.

## Abordagens

1. **Formulário livre turma → grupo + aba de notas do admin (escolhida).** É o
   menor caminho que cumpre o pedido.
2. Escala no banco a partir da planilha, com cada professor vendo só os grupos
   dele. Foi descartada hoje pelo prazo, mas pode virar uma segunda etapa.
3. Formulário público como o antigo. Foi descartado porque os avaliadores têm
   conta no PBL.

## Desenho

- **Dados:** tabela `avaliacoes_banca`, criada em `server/src/db/migrate.ts`, com
  `grupo_id`, `avaliador_id`, `dia DATE`, `sala TEXT` (nula = outra sala), sete `score_*` SMALLINT com CHECK 1–5,
  `pontos_fortes`, `pontos_melhoria`, `nao_contribuiram`, `nota_final
  NUMERIC(3,2)` nula com CHECK 0–1,5, `status` com CHECK, `criado_em` e
  `atualizado_em`. Única em `(grupo_id, avaliador_id)`.
- **API:**
  - `GET /banca/grupos` (ADMIN, PROFESSOR): turmas e grupos participantes.
  - `PUT /banca/grupos/:grupoId/avaliacao` (ADMIN, PROFESSOR): upsert com auditoria.
  - `GET /banca/minhas` (ADMIN, PROFESSOR): avaliações do próprio usuário.
  - `GET /banca/avaliacoes` (ADMIN): todas as avaliações.
- **Interface:**
  - Professor: item "Avaliação da Banca", com o formulário e a lista das avaliações
    que ele já enviou (clicar reabre para editar).
  - Admin: item "Notas da Banca", com duas abas: "Notas" (filtros por banca,
    turma e grupo, média por grupo, exportação CSV) e "Avaliar" (o mesmo formulário).

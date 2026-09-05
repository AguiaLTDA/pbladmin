# Plataforma Web de Gestão de Conteúdo Educacional PBL (Problem-Based Learning)

Uma aplicação Full-Stack responsiva, segura e persistente para gestão de conteúdo educacional baseada na metodologia **PBL (Aprendizagem Baseada em Problemas)** com 3 portais integrados e fluxo completo de aprovação pedagógica.

---

## 🚀 Arquitetura e Tecnologias

* **Frontend**: React 18, TypeScript, Vite, Lucide Icons, Recharts.
* **Estilização**: Sistema de Design Customizado em Vanilla CSS (Variáveis HSL, Glassmorphism, Micro-animações, Grid/Flexbox responsivo, suporte a Tema Claro/Escuro).
* **Backend**: Node.js, Express, TypeScript, JWT (JSON Web Tokens), Bcryptjs, Multer.
* **Banco de Dados**: SQLite Relacional (`database.sqlite`) com Foreign Keys ativadas, soft deletes (`deletado_em IS NULL`) e histórico de auditoria.
* **Armazenamento de Arquivos**: Módulo de upload com validação de extensão/MIME, hash MD5, categorias, streaming protegido e exclusão lógica.

---

## 🔌 Como o frontend resolve as chamadas de API

Toda requisição passa por `apiRequest` em [`client/src/services/api.ts`](client/src/services/api.ts)
e é resolvida na seguinte ordem, da fonte mais confiável para a menos confiável:

1. **Backend Express local** (`http://localhost:4000`) — banco SQLite real, JWT,
   bcrypt, RBAC e auditoria. É a **autoridade**: se ele responder qualquer HTTP
   status, essa resposta vale, inclusive os erros (401/403/404/422).
2. **Supabase** — usado apenas quando `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` estão configuradas. A senha é validada pelo
   Supabase Auth (`signInWithPassword`), no servidor.
3. **Dados de demonstração em memória** — vitrine estática do GitHub Pages.
   **Não persiste nada.** Operações de escrita nesse modo retornam uma mensagem
   explícita de que a ação foi simulada e não foi salva.

Os passos 2 e 3 só entram em cena quando o passo anterior está indisponível
(falha de rede ou não configurado) — nunca para mascarar um erro de negócio.
Credenciais inválidas sempre chegam ao usuário como erro.

> ⚠️ Para operar com dados reais de alunos, use o backend Express ou o Supabase.
> O modo de demonstração existe apenas para a vitrine pública.

---

## 🔑 Acesso à Demonstração

As credenciais dos perfis de demonstração (Administrador, Professor e Aluno)
**não são publicadas neste repositório nem exibidas na tela de login** — são
fornecidas pela Coordenadoria Acadêmica a quem precisa avaliar a plataforma.

Os perfis disponíveis para avaliação são:

| Perfil | O que demonstra |
| :--- | :--- |
| **Administrador** | Revisão pedagógica, segmentação, publicação, gestão acadêmica, arquivos e auditoria. |
| **Professor** | Criação de PBLs, envio para análise, ajuste de versão e avaliação das entregas. |
| **Aluno** | Atividades publicadas direcionadas a ele, entrega com comprovante hash e consulta de notas. |
| **Aluno excluído** | Exclusão manual no motor de segmentação, para validar o bloqueio de acesso (403/404). |

Ao semear o banco local, o console do servidor imprime as credenciais geradas —
é a forma recomendada de obtê-las em ambiente de desenvolvimento.

---

## ⚡ Como Executar a Aplicação Localmente

### 1. Iniciar o Servidor Backend (Porta 4000)
```bash
cd server
npm run dev
```
* O banco de dados SQLite (`server/database.sqlite`) é criado e semeado automaticamente na primeira execução com dados reais extraídos do CSV de turmas, alunos e professores.

### 2. Iniciar o Frontend React (Porta 3000)
```bash
cd client
npm run dev
```
* Acesse a aplicação no navegador em: `http://localhost:3000`

---

## 📅 Horário Acadêmico e Vínculo do Professor

O vínculo **Professor → Turma → Disciplina** é derivado automaticamente da grade
de aulas noturna, declarada em
[`server/src/db/horarioAcademico.ts`](server/src/db/horarioAcademico.ts) (76 aulas,
7 cursos, 21 turmas, 20 docentes).

A cada boot do servidor, [`services/horarioImport.ts`](server/src/services/horarioImport.ts):

1. cria/atualiza cursos, disciplinas, turmas e usuários docentes;
2. grava a grade em `horarios_academicos` + `horarios_turmas` (aulas em junção
   atendem várias turmas);
3. recalcula `vinculos_professores` com `origem = 'HORARIO'` — vínculos manuais
   feitos pelo admin (`origem = 'MANUAL'`) são preservados.

Para reprocessar a grade sem reiniciar: `POST /api/academic/schedule/import` (ADMIN).

### O que o professor passa a enxergar

| Recurso | Regra aplicada |
| :--- | :--- |
| `GET /academic/classes` · `/groups` | Apenas turmas e grupos em que ele leciona |
| `GET /academic/schedule` | Apenas as próprias aulas (admin vê a grade completa) |
| `GET /academic/my-bindings` | Suas turmas + disciplinas + total de alunos |
| `GET /pbl/activities` | Atividades que criou **ou** das disciplinas/turmas que leciona |
| `GET /submissions/activity/:id` | Entregas dos alunos matriculados nas suas turmas, **com os PDFs anexados** |
| `POST /submissions/:id/evaluate` | Bloqueado (403) fora das suas turmas |
| `GET /files/download/:id` | Só arquivos próprios, material das suas atividades e entregas das suas turmas |

Telas do docente: **Minhas Turmas & Horário** (`#/professor/turmas`) e
**Acompanhamento & Entregas** (`#/professor/entregas`), que abre o material
orientativo e os PDFs dos grupos dentro da plataforma, sem download prévio.

O e-mail dos docentes importados segue o padrão
`prof.<primeironome>.<sobrenome>@pbl.edu.br` (ex.: `prof.jussara.pereira@pbl.edu.br`).
A senha inicial é definida no importador e impressa no console do servidor
durante a semeadura — não é publicada aqui.

---

## 🎓 Cadastro de Estudantes com Google Sheets

Os estudantes são cadastrados em uma **planilha do Google Sheets** através de um
Web App do Google Apps Script (código em [`google-apps-script/Codigo.gs`](google-apps-script/Codigo.gs)).

### Onde cadastrar

| Caminho | Quem usa | Descrição |
| :--- | :--- | :--- |
| `#/cadastro` | Público (sem login) | Autocadastro do estudante, acessível pelo link **"Cadastre-se como estudante"** na tela de login. |
| `#/admin/estudantes` | Administrador | Cadastro manual, listagem, busca por curso/turma, exportação em CSV e reenvio de pendências. |

### Campos gravados na planilha

`ID` · `Data do Cadastro` · `Nome Completo` · `E-mail` · `Matrícula` · `CPF` ·
`Telefone` · `Curso` · `Turma` · `Período` · `Origem` · `Status`

O Web App valida os campos obrigatórios (nome, e-mail, matrícula e curso) e
recusa e-mails ou matrículas duplicados. Todo cadastro entra com status
`PENDENTE` para validação da secretaria.

### Configuração

Siga o passo a passo em
[`google-apps-script/README_APPS_SCRIPT.md`](google-apps-script/README_APPS_SCRIPT.md)
e defina as variáveis:

```env
VITE_GOOGLE_SHEETS_URL=https://script.google.com/macros/s/SEU_ID/exec
VITE_GOOGLE_SHEETS_TOKEN=seu-token
```

Localmente em `client/.env`; em produção, como **Secrets do repositório**
(Settings → Secrets and variables → Actions). Sem essas variáveis o formulário
continua funcionando, porém os cadastros ficam apenas em uma fila local do
navegador, sinalizada na interface, e podem ser sincronizados depois pelo botão
**"Sincronizar agora"**.

---

## 🔄 Publicação Automática no GitHub

O workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compila
o frontend e publica no GitHub Pages a cada `push` em `main`/`master`.

Para enviar as alterações locais:

```bash
git add -A
git commit -m "Descrição da alteração"
git push
```

O GitHub Actions cuida do build e do deploy — acompanhe em **Actions** no
repositório.

---

## 📋 Demonstração dos Fluxos Críticos (Critérios de Aceite)

1. **Criação pelo Professor**: O professor entra no sistema (`prof.jussara@pbl.edu.br`), cria uma atividade PBL, cadastra etapas, anexa arquivos e submete para análise.
2. **Revisão com Solicitação de Ajustes pelo Admin**: O administrador (`admin@pbl.edu.br`) recebe a atividade na Caixa de Entrada, analisa e solicita correções com justificativa obrigatória.
3. **Nova Versão e Re-submissão**: O professor visualiza o parecer, aplica as correções e reenvia (gerando automaticamente a Versão 2 no histórico).
4. **Aprovação e Compilação pelo Admin**: O administrador compara visualmente v1 e v2, refina o texto final e aprova.
5. **Motor de Segmentação com Exclusão Manual**: O administrador seleciona a Turma A e adiciona uma regra de exclusão explícita para o aluno `André Alves Oliveira`. A prévia calcula o alcance nominal de alunos desduplicados.
6. **Agendamento & Publicação**: O administrador define o prazo final de entrega e publica a atividade.
7. **Visualização Restrita pelo Aluno**: A aluna `Ketlly Beatriz` acessa e visualiza a atividade. O aluno `André Alves` (excluído) não visualiza o PBL e qualquer tentativa de acesso por URL direta é bloqueada com Erro 403 / 404 pelo backend.
8. **Envio da Entrega com Comprovante Hash**: A aluna faz download do material aprovado, elabora a solução em texto, anexa o arquivo e realiza a entrega final. O sistema gera um Hash Comprovante oficial e imutável.
9. **Avaliação pelo Professor**: O docente visualiza a entrega da aluna, atribui nota escrita e nota oral, registra o feedback e libera a nota no portal do aluno.
10. **Auditoria de Ações**: O administrador consulta a Trilha de Auditoria com o log de todas as operações realizadas no sistema.

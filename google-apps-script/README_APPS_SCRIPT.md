# Integração com o Google Sheets — Cadastro de Estudantes

O frontend roda como site estático no GitHub Pages, então não existe servidor
próprio para guardar credenciais de uma conta de serviço do Google. A gravação
na planilha é feita por um **Web App do Google Apps Script**, que roda dentro da
própria conta Google da secretaria e expõe apenas as operações necessárias.

```
Navegador (GitHub Pages)  ──POST JSON──▶  Web App Apps Script  ──appendRow──▶  Google Sheets
```

---

## 1. Criar a planilha

1. Acesse <https://sheets.new> e crie uma planilha nova.
2. Renomeie para algo como **Cadastro de Estudantes PBL — UNIVC**.
3. Não é preciso criar cabeçalhos: a aba `Estudantes` e as colunas são criadas
   automaticamente no primeiro cadastro.

## 2. Publicar o Web App

1. Na planilha, vá em **Extensões → Apps Script**.
2. Apague o conteúdo do `Código.gs` e cole todo o conteúdo de
   [`Codigo.gs`](./Codigo.gs).
3. Altere a constante `TOKEN` para um valor secreto seu:
   ```js
   var TOKEN = 'troque-por-um-valor-proprio';
   ```
4. Salve (💾).
5. Clique em **Implantar → Nova implantação**.
6. Em **Tipo**, escolha **App da Web** e configure:
   - **Descrição**: `Cadastro de estudantes PBL`
   - **Executar como**: `Eu (seu e-mail)`
   - **Quem pode acessar**: `Qualquer pessoa`
7. Clique em **Implantar** e autorize o acesso quando o Google pedir
   (a tela "app não verificado" é esperada — escolha **Avançado → Acessar**).
8. Copie a **URL do app da Web**, que termina em `/exec`.

> **Importante:** toda vez que você editar o `Codigo.gs`, é preciso ir em
> **Implantar → Gerenciar implantações → ✏️ Editar → Versão: Nova versão** para
> que a alteração entre no ar. Só salvar não publica.

## 3. Configurar o frontend

### Desenvolvimento local

Crie o arquivo `client/.env` (ele está no `.gitignore`):

```env
VITE_GOOGLE_SHEETS_URL=https://script.google.com/macros/s/SEU_ID/exec
VITE_GOOGLE_SHEETS_TOKEN=troque-por-um-valor-proprio
```

### Produção (GitHub Pages)

No repositório, vá em **Settings → Secrets and variables → Actions → New
repository secret** e crie os dois secrets com os mesmos nomes e valores:

| Secret | Valor |
| :--- | :--- |
| `VITE_GOOGLE_SHEETS_URL` | a URL `/exec` da implantação |
| `VITE_GOOGLE_SHEETS_TOKEN` | o mesmo valor da constante `TOKEN` |

O workflow `.github/workflows/deploy.yml` já injeta as duas variáveis no build.

## 4. Testar

Abra no navegador (trocando pelos seus valores):

```
https://script.google.com/macros/s/SEU_ID/exec?token=SEU_TOKEN&action=ping
```

A resposta esperada é `{"ok":true,"message":"Web App ativo."}`.

Para listar os cadastros: troque `action=ping` por `action=list`.

---

## Endpoints

| Método | Parâmetros | Retorno |
| :--- | :--- | :--- |
| `POST` | corpo JSON com `token`, `nome`, `email`, `matricula`, `curso` (obrigatórios) e `cpf`, `telefone`, `turma`, `periodo`, `origem` (opcionais) | `{ ok, id, message }` |
| `GET` | `?token=...&action=list` | `{ ok, total, estudantes[] }` |
| `GET` | `?token=...&action=ping` | `{ ok, message }` |

O Apps Script sempre responde com HTTP 200 — o resultado real vem no campo
`ok` do corpo, que é o que o frontend verifica.

### Regras aplicadas pelo Web App

- **Campos obrigatórios**: nome, e-mail (com formato válido), matrícula e curso.
- **Duplicidade**: recusa cadastros com e-mail ou matrícula já existentes.
- **Concorrência**: usa `LockService` para não perder registros simultâneos.
- **Status inicial**: todo cadastro entra como `PENDENTE` para validação da
  secretaria.

---

## Limitações e segurança

- O `TOKEN` viaja no bundle JavaScript do site, então **não é um segredo forte**:
  ele evita chamadas casuais, não um atacante determinado. Como o Web App só
  permite inserir e listar cadastros (nunca apagar ou editar), o risco fica
  restrito a spam de linhas na planilha. Se isso virar problema, o caminho é
  colocar um reCAPTCHA no formulário ou mover a gravação para uma Edge Function
  do Supabase, onde o segredo fica no servidor.
- O `action=list` expõe os dados dos estudantes a quem tiver o token. A tela
  administrativa é o consumidor previsto; considere isso ao compartilhar o token.
- Cotas do Apps Script: aproximadamente 20.000 execuções/dia em contas Google
  Workspace, mais que suficiente para o volume de matrículas.

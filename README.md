<div align="center">

# 🏋️ GymLog

### Cada treino conta.

Seu diário de academia para registrar treinos, acompanhar cargas<br />
e consultar exercícios em um só lugar.

![Status: em desenvolvimento](https://img.shields.io/badge/status-em_desenvolvimento-2563eb?style=flat-square)
![React 19](https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vite 8](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white)

[Sobre](#sobre) · [Funcionalidades](#funcionalidades) · [Como executar](#como-executar) · [Deploy](#deploy-na-vercel) · [Roadmap](#roadmap)

</div>

---

## Sobre

Qual foi a carga no último treino? Quantas repetições você fez? Como executar aquele exercício?

O **GymLog** nasce para reunir essas informações em um diário de treino simples de consultar e atualizar. A proposta é ajudar quem treina a organizar sua rotina, registrar o que fez e acompanhar a própria evolução.

A experiência planejada é direta: escolher os exercícios, montar o treino e registrar séries, repetições e cargas. Um catálogo com demonstrações em GIF vai servir de referência visual durante a consulta dos exercícios.

> **Estado atual:** o projeto está na etapa de setup. React, TypeScript, Tailwind e a configuração de deploy estão preparados, com uma página inicial provisória. O backend mínimo usa Vercel Functions e o driver do Neon. As tabelas, funcionalidades de treino e autenticação ainda não foram implementadas.

## Funcionalidades

O que queremos construir:

| Recurso | O que você poderá fazer | Status |
| --- | --- | --- |
| 📝 Registro de treinos | Anotar os exercícios realizados em cada treino | Planejado |
| 🏋️ Cargas e repetições | Registrar carga, séries e repetições por exercício | Planejado |
| 📚 Catálogo de exercícios | Consultar e escolher exercícios para montar seus treinos | Planejado |
| 🎞️ Demonstrações em GIF | Visualizar uma referência de execução de cada exercício | Planejado |
| 📈 Histórico | Consultar registros anteriores e acompanhar a evolução | Planejado |
| 💾 Persistência | Salvar os dados para continuar de onde parou | Planejado |

O banco escolhido é PostgreSQL 18 no Neon. A fonte dos GIFs ainda será definida. Login e sincronização entre dispositivos também dependem dessa próxima etapa.

## Stack

| Tecnologia | Papel no projeto |
| --- | --- |
| **React 19** | Construção da interface com componentes |
| **TypeScript** | Tipagem do código e dos futuros dados de treino |
| **Vite 8** | Servidor de desenvolvimento e build de produção |
| **Tailwind CSS 4** | Estilização da interface, integrado pelo plugin do Vite |
| **ESLint** | Análise estática e regras para o código |
| **Vercel** | Hospedagem do frontend e das funções do backend |
| **Neon / PostgreSQL 18** | Banco de dados em São Paulo |

O GymLog é uma **SPA (Single Page Application)** em React, sem Next.js. O frontend já está publicado na Vercel. A configuração das funções e da SPA está versionada em `vercel.json`.

## Como executar

### Pré-requisitos

- **Node.js 22.14 ou superior na linha 22** — a versão de referência está em `.nvmrc`.
- **npm**, incluído na instalação do Node.js.
- **Git**, para clonar o projeto e versionar alterações.

### Iniciar o ambiente local

Na pasta do projeto, instale as dependências:

```bash
npm ci
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Abra o endereço informado pelo Vite no terminal, normalmente `http://localhost:5173`.

**O frontend pode rodar sem banco. Para executar a API, configure `DATABASE_URL` no `.env`.**

### Comandos disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor local com atualização durante a edição |
| `npm run build` | Verifica o TypeScript e gera a versão de produção em `dist/` |
| `npm run preview` | Serve o build de produção localmente para conferência |
| `npm run typecheck` | Verifica os tipos sem gerar arquivos |
| `npm run lint` | Executa a análise do ESLint |

Para conferir uma alteração antes de enviá-la ao repositório:

```bash
npm run lint
npm run typecheck
npm run build
```

## Estrutura do projeto

```text
GymProject/
├── src/
│   ├── App.tsx          # Página inicial provisória
│   ├── index.css        # Tailwind e estilos globais
│   └── main.tsx         # Ponto de entrada da aplicação React
├── .gitignore          # Arquivos excluídos do versionamento
├── .nvmrc              # Versão de referência do Node.js
├── eslint.config.js    # Regras de análise estática
├── index.html          # Documento HTML de entrada
├── package.json        # Dependências e scripts
├── package-lock.json   # Versões resolvidas das dependências
├── tsconfig.json       # Configuração do TypeScript
├── vercel.json         # Configuração de deploy e fallback da SPA
└── vite.config.ts      # Plugins do React e do Tailwind
```

As pastas `node_modules/` e `dist/` são geradas localmente e não são versionadas.

## Deploy na Vercel

Com o código disponível em um repositório Git:

1. Importe o repositório na Vercel.
2. Selecione a pasta do projeto como diretório raiz.
3. Confira as configurações abaixo.
4. Execute o deploy.

| Configuração | Valor |
| --- | --- |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Variáveis de ambiente | `DATABASE_URL` para a API |

O arquivo `vercel.json` já define o build, a pasta de saída e o redirecionamento interno para `index.html`. Esse fallback prepara a hospedagem para futuras rotas da SPA; o roteamento da aplicação ainda não foi implementado.

## Backend mínimo

A API fica em `api/` e roda como Vercel Functions em São Paulo. O código compartilhado do servidor fica em `server/`, separado do frontend. Não é necessário Next.js ou um servidor Express.

| Arquivo | Responsabilidade |
| --- | --- |
| `api/health.ts` | Endpoint de diagnóstico da conexão |
| `server/db.ts` | Acesso ao Neon via driver serverless HTTP |
| `tsconfig.server.json` | Verificação de tipos do backend |

### Verificar a conexão

`GET /api/health` executa apenas `SELECT 1` e retorna:

```json
{ "status": "ok", "database": "connected" }
```

Quando a variável estiver ausente ou o banco não responder, retorna HTTP 503 com uma mensagem genérica. Outros métodos retornam 405. A resposta não é armazenada em cache e a consulta tem timeout de 8 segundos. Nenhuma credencial ou dado de usuário é retornado. Esse endpoint consulta o banco e pode acordar um compute suspenso; evite monitoramento frequente.

### Desenvolvimento com API

Com uma versão atual da Vercel CLI instalada (`npm install -g vercel@latest`) e o projeto vinculado, execute:

```bash
npm run dev:full
```

Esse comando executa `vercel dev`, que serve o frontend e as funções. `npm run dev` executa apenas o Vite. Use o endereço mostrado no terminal, seguido de `/api/health`.

```bash
npm run test:backend
npm run typecheck
npm run build
```

Os testes verificam a rejeição de métodos de escrita e a resposta segura sem configuração. As futuras rotas de treinos deverão validar a sessão e restringir o acesso aos dados do usuário antes de serem publicadas.

## Roadmap

- [x] Preparar React com Vite e TypeScript
- [x] Integrar Tailwind CSS
- [x] Configurar ESLint e verificação de tipos
- [x] Criar página inicial provisória
- [x] Preparar configuração de deploy na Vercel
- [x] Integrar a conexão com PostgreSQL no Neon
- [ ] Criar as tabelas de exercícios e treinos
- [ ] Criar catálogo e seleção de exercícios
- [ ] Adicionar demonstrações em GIF
- [ ] Permitir criar e registrar treinos
- [ ] Registrar séries, repetições e cargas
- [ ] Disponibilizar histórico de treinos

## Padrão de commits

O **Husky** adiciona o emoji automaticamente no hook `commit-msg`, e o **Commitlint** valida o resultado. Os hooks são ativados por `npm install` ou `npm ci`.

Escreva apenas o tipo, o escopo opcional e a descrição:

```bash
git add caminho/do/arquivo
git commit -m "feat: adicionar treino"
# Salvo como: feat: ✨ adicionar treino
```

Também funciona com `npm run commit -- -m "feat: adicionar treino"`. Sem argumentos, `npm run commit` abre o editor configurado no Git. Os arquivos devem ser adicionados ao stage antes do commit.

### Formato final

```text
feat: ✨ adicionar treino
fix(treinos): 🐛 corrigir carga
chore(deps): 🔗 atualizar dependências
chore(release): 🚀 publicar versão
feat!: ✨ alterar formato dos treinos
```

O emoji vem depois dos dois-pontos. Os escopos `chore(deps)` e `chore(release)` têm emojis próprios; outros escopos usam o emoji do tipo. O marcador `!` é preservado e o tipo `breaking` usa 💥.

### Tabela de emojis

| Tipo ou tipo(escopo) | Emoji | Código |
| --- | --- | --- |
| `feat` | ✨ | `:sparkles:` |
| `fix` | 🐛 | `:bug:` |
| `docs` | 📚 | `:books:` |
| `style` | 💎 | `:gem:` |
| `refactor` | ♻️ | `:recycle:` |
| `perf` | ⚡ | `:zap:` |
| `test` | 🚨 | `:rotating_light:` |
| `chore` | 🔧 | `:wrench:` |
| `chore(release)` | 🚀 | `:rocket:` |
| `chore(deps)` | 🔗 | `:link:` |
| `build` | 📦 | `:package:` |
| `ci` | 👷 | `:construction_worker:` |
| `release` | 🚀 | `:rocket:` |
| `security` | 🔒 | `:lock:` |
| `i18n` | 🌐 | `:globe_with_meridians:` |
| `breaking` | 💥 | `:boom:` |
| `config` | ⚙️ | `:gear:` |
| `add` | ➕ | `:heavy_plus_sign:` |
| `remove` | ➖ | `:heavy_minus_sign:` |

Se o título já tiver um emoji da tabela ou seu código, o hook substitui pelo emoji correto sem duplicá-lo. O corpo e os rodapés da mensagem são preservados.

Tipo e escopo devem estar em minúsculas. A descrição é obrigatória, sem ponto final, e o título completo deve ter até 100 caracteres. Tipos fora da tabela são rejeitados. Commits automáticos de merge e revert seguem as exceções padrão do Commitlint.

Para validar diretamente, informe a mensagem **já com o emoji**:

```bash
echo "feat: ✨ adicionar treino" | npm run commitlint
```

Para verificar a normalização e o hook sem criar commits:

```bash
node --test scripts/commit-format.test.js
```

A tabela e as regras ficam em `scripts/commit-format.js`. O hook usa essa mesma tabela para normalizar e validar as mensagens.

## Cuidados com a configuração

### Ambiente do backend / Neon

O banco do GymLog usa PostgreSQL 18 no Neon, na região **AWS South America East 1 — São Paulo (`sa-east-1`)**. O `vercel.json` configura as Vercel Functions para **São Paulo (`gru1`)**, conforme a [lista de regiões da Vercel](https://vercel.com/docs/regions).

O arquivo local `.env`, na raiz do projeto, está preparado para receber a conexão:

```dotenv
DATABASE_URL=""
```

Cole entre as aspas a connection string completa fornecida pelo Neon, mantendo os parâmetros de conexão. Não cole o comando `psql`, apenas a URL. Esse arquivo é ignorado pelo Git; `.env.example` é o modelo versionado para outras instalações.

Na Vercel, cadastre `DATABASE_URL` nas variáveis de ambiente do projeto para o ambiente desejado e faça um novo deploy. O arquivo local não é enviado à Vercel: `.vercelignore` exclui os arquivos `.env*` do upload. Para previews, use uma branch de desenvolvimento do banco.

A conexão está implementada em `server/db.ts`, usando `process.env.DATABASE_URL`. A URL e o módulo de banco nunca devem ser importados pelo código em `src/`. As tabelas e o Neon Auth ainda serão implementados.

Arquivos `.env`, dependências e saídas de build estão cobertos pelo `.gitignore`. Quando integrações forem adicionadas, documente as variáveis necessárias em um `.env.example`, sem valores secretos.

Variáveis com prefixo `VITE_` ficam disponíveis no navegador. Elas não devem conter senhas de banco, chaves privadas ou credenciais administrativas.

---

<div align="center">

**GymLog · Um registro de cada treino. Um histórico da sua evolução.**

</div>

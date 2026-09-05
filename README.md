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

> **Estado atual:** login e email funcionando; fichas, sessões com registro de séries e timer de descanso implementados. Dados privados protegidos por sessão e RLS no Neon. Consulte os guias de [autenticação](docs/authentication.md) e [treinos e descanso](docs/workouts.md).

## Funcionalidades

O que queremos construir:

| Recurso | O que você poderá fazer | Status |
| --- | --- | --- |
| 📝 Registro de treinos | Criar fichas e registrar sessões de treino | Implementado |
| 🏋️ Cargas e repetições | Registrar carga, séries e repetições por exercício | Implementado |
| 📚 Catálogo de exercícios | Escolher exercícios do catálogo local para montar fichas | Implementado (12 exercícios) |
| 🎞️ Demonstrações em GIF | Visualizar uma referência de execução de cada exercício | Planejado |
| 📈 Histórico | Consultar as séries dos treinos recentes | Implementado; gráficos futuros |
| 💾 Persistência | Salvar fichas e séries; retomar treino em andamento | Implementado |
| ⏱️ Descanso | Timer automático com pausa, +30 s e aviso sonoro opcional | Implementado |

O banco escolhido é PostgreSQL 18 no Neon. A integração de catálogo com **AscendAPI / ExerciseDB V2** já consulta exercícios, imagens e vídeos pelo backend. A seleção nas fichas usa o catálogo local. A interface de mídias externas e o vínculo com o fornecedor ainda serão implementados. O endpoint exige login. As mídias retornadas pelo fornecedor não são necessariamente GIFs.

## API de exercícios e imagens

Configure a chave no `.env` do servidor e execute `npm run dev:full`. O endpoint `/api/catalog` permite consultar o fornecedor sem expor a chave ao navegador:

- `/api/catalog?resource=bodyparts`: partes do corpo e suas imagens.
- `/api/catalog?name=bench&limit=10`: exercícios com filtros e paginação.
- `/api/catalog?resource=exercise&id=exr_...`: detalhe com imagens, vídeo e instruções.

Consulte o [guia da integração](docs/exerciseApi.md) para variáveis, filtros, respostas e testes. As consultas são em tempo real: o cache e a persistência dependem do plano do fornecedor, e suas URLs de mídia rotacionam semanalmente. Nenhum conteúdo externo foi importado no Neon nesta etapa.

## Stack

O [planejamento do banco de dados](docs/databasePlan.md) detalha tabelas, relações e decisões de produto. A estrutura inicial já foi aplicada. O [guia de operação](docs/databaseOperations.md) documenta as migrations, o acesso ao banco e o que falta integrar na API.

```bash
npm run db:status   # Consultar migrations e contagens do catálogo
npm run db:migrate  # Aplicar migrations pendentes, com transação e checksum
npm run db:verify   # Validar regras e RLS com dados temporários e rollback
```

Os comandos usam o `.env` local. O banco tem 10 grupos musculares, 6 equipamentos e 12 exercícios iniciais. Os GIFs e as instruções detalhadas ainda dependem de curadoria. As migrations não são executadas automaticamente durante o deploy.

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

### Estrutura do projeto

```text
src/components/   componentes React, cada um com pasta e CSS próprios
src/hooks/        hooks reutilizáveis
src/services/     clientes de autenticação e API
src/utils/        formatação e regras compartilhadas da interface
server/           domínio, integrações e persistência do backend
api/              funções HTTP da Vercel
tests/            specs de backend, frontend, integração e ferramentas
tools/            comandos administrativos de banco, catálogo e Git
database/         migrations imutáveis e seeds do catálogo
docs/             documentação técnica e de produto
```

Código e testes usam nomes de arquivo em camelCase. Testes terminam em `.spec`.
As migrations mantêm os nomes originais porque o banco registra nome e checksum
de cada arquivo aplicado.

### Pré-requisitos

- **Node.js 22.14 ou superior na linha 22** — a versão de referência está em `.nvmrc`.
- **npm**, incluído na instalação do Node.js.
- **Git**, para clonar o projeto e versionar alterações.

### Iniciar o ambiente local

Na pasta do projeto, instale as dependências:

```bash
npm install
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev:full
```

### Testes e cobertura

Execute todos os testes unitários e de estrutura com:

```bash
npm test
```

Para medir os módulos de regras de negócio, serviços HTTP e utilitários com limite mínimo de 80% em linhas, funções, branches e statements:

```bash
npm run test:coverage
```

O comando mostra o resumo no terminal e gera o relatório navegável em `coverage/index.html`.

### Commit Pattern

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

<div align="center">

**GymLog · Um registro de cada treino. Um histórico da sua evolução.**

</div>

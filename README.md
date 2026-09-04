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
npm install
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

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

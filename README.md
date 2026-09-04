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

> **Estado atual:** o projeto está na etapa de setup. React, TypeScript, Tailwind e a configuração de deploy estão preparados, com uma página inicial provisória. As funcionalidades de treino e o banco de dados ainda não foram implementados.

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

A tecnologia do banco e a fonte dos GIFs ainda serão definidas. Login e sincronização entre dispositivos também dependem dessa próxima etapa.

## Stack

| Tecnologia | Papel no projeto |
| --- | --- |
| **React 19** | Construção da interface com componentes |
| **TypeScript** | Tipagem do código e dos futuros dados de treino |
| **Vite 8** | Servidor de desenvolvimento e build de produção |
| **Tailwind CSS 4** | Estilização da interface, integrado pelo plugin do Vite |
| **ESLint** | Análise estática e regras para o código |
| **Vercel** | Plataforma prevista para publicar a aplicação |

O GymLog é uma **SPA (Single Page Application)** em React, sem Next.js. A configuração da Vercel está versionada em `vercel.json`; isso prepara o deploy, mas não significa que o app já esteja publicado.

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

**O setup atual não exige banco, conta externa ou variáveis de ambiente.**

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
| Variáveis de ambiente | Nenhuma nesta etapa |

O arquivo `vercel.json` já define o build, a pasta de saída e o redirecionamento interno para `index.html`. Esse fallback prepara a hospedagem para futuras rotas da SPA; o roteamento da aplicação ainda não foi implementado.

## Roadmap

- [x] Preparar React com Vite e TypeScript
- [x] Integrar Tailwind CSS
- [x] Configurar ESLint e verificação de tipos
- [x] Criar página inicial provisória
- [x] Preparar configuração de deploy na Vercel
- [ ] Definir e integrar um banco de dados simples
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

Arquivos `.env`, dependências e saídas de build estão cobertos pelo `.gitignore`. Quando integrações forem adicionadas, documente as variáveis necessárias em um `.env.example`, sem valores secretos.

Variáveis com prefixo `VITE_` ficam disponíveis no navegador. Elas não devem conter senhas de banco, chaves privadas ou credenciais administrativas.

---

<div align="center">

**GymLog · Um registro de cada treino. Um histórico da sua evolução.**

</div>

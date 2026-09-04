# GymLog — autenticação e perfil

## Implementado

- Cadastro por nome/email/senha, login e logout.
- Solicitação de recuperação de senha e formulário para definir a nova senha pelo token do email.
- Reenvio de email de confirmação.
- Estado de sessão no frontend e área autenticada.
- Proxy `/api/auth/*` baseado no toolkit oficial `@neondatabase/auth/server`, sem Next.js.
- Cookies de sessão gerenciados pelo Neon Auth e preservados pelo adapter, incluindo múltiplos `Set-Cookie`.
- `/api/me` valida a sessão e faz upsert idempotente do perfil.
- `/api/catalog` exige uma sessão válida antes de consultar o fornecedor.
- Acesso ao perfil por `RUNTIME_DATABASE_URL`, papel `gymlog_runtime`, e `SET LOCAL ROLE gymlog_app` com contexto do usuário na mesma transação.

O SDK está fixado em `@neondatabase/auth@0.5.0-beta`, pois o toolkit independente de framework ainda é beta. O schema gerenciado `neon_auth` não foi modificado.

## Configuração local

No `.env`, preencher:

```dotenv
NEON_AUTH_BASE_URL=""
NEON_AUTH_COOKIE_SECRET=""
APP_URL="http://localhost:3000"
RUNTIME_DATABASE_URL=""
```

- `NEON_AUTH_BASE_URL`: URL completa exibida no Neon Console → Auth → Configuration, normalmente terminada em `/auth`. Usar a mesma branch e banco das tabelas da aplicação.
- `NEON_AUTH_COOKIE_SECRET`: segredo aleatório de no mínimo 32 caracteres. Já foi gerado localmente; não substituir a cada inicialização.
- `APP_URL`: origem exata da aplicação, com protocolo e porta. Em outra porta local, atualizar esse valor antes de iniciar.
- `RUNTIME_DATABASE_URL`: credencial restrita já provisionada e salva no `.env`. `DATABASE_URL` continua disponível para administração/health; migrations também aceitam `MIGRATION_DATABASE_URL`.

Não colocar essas variáveis em `VITE_*`. O navegador usa apenas a URL da própria aplicação e o proxy `/api/auth`.

No Neon Auth, habilitar login por email/senha, adicionar a origem local aos domínios/origens confiáveis e configurar o envio de emails conforme as opções do serviço. Recomenda-se confirmação de email antes do acesso. O aplicativo respeita a política configurada no Neon; não presume que ela já esteja habilitada.

O recebimento real de emails de confirmação e recuperação depende dessa configuração no serviço e precisa ser testado com uma conta controlada pelo usuário.

## Vercel

Cadastrar `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `RUNTIME_DATABASE_URL` e `APP_URL` nas variáveis do ambiente de destino. Em Production, `APP_URL` deve ser o domínio HTTPS final, por exemplo `https://gymlog-delta-livid.vercel.app`. Adicionar também essa origem ao Neon Auth.

Manter o segredo estável no ambiente. Preview deve apontar para uma branch de desenvolvimento e ter origem correspondente cadastrada; não liberar curingas arbitrários. As credenciais locais não são enviadas com o código.

## Rotas e fluxo

| Rota | Uso |
| --- | --- |
| `/entrar` | Login |
| `/criar-conta` | Cadastro |
| `/recuperar-senha` | Solicitar email de recuperação |
| `/redefinir-senha?token=...` | Definir nova senha |
| `/verificar-email` | Reenviar confirmação |
| `/app` | Área autenticada com perfil |
| `/api/auth/*` | Proxy limitado às operações de email e sessão |
| `/api/me` | Perfil do usuário autenticado |
| `/api/catalog` | Catálogo externo autenticado |
| `/api/health` | Diagnóstico público, sem dados de usuário |

As páginas HTML são públicas como em qualquer SPA; os dados são protegidos na API. A interface só carrega o perfil após obter uma sessão. O endpoint valida a sessão novamente no servidor, com `disableCookieCache: 'true'`, sem confiar na sessão exibida pelo React ou em um UUID recebido do cliente.

O proxy aceita apenas rotas de email/sessão listadas no código; não expõe administração de usuários, organizações ou OAuth. Requisições de escrita exigem `Origin` igual a `APP_URL`, evitando solicitações de outros sites. O corpo tem limite de 16 KiB. URLs de callback usadas pela interface apontam para a própria aplicação, e o Neon deve validar suas origens confiáveis.

O perfil usa o UUID da identidade validada. O nome inicial vem do Neon Auth; acessos posteriores não sobrescrevem o nome configurado no perfil. Cada transação define o papel restrito e o contexto local, evitando compartilhar a identidade entre requisições.

## Conexão restrita

`npm run db:provision-runtime` é uma operação administrativa explícita: cria `gymlog_runtime` com senha aleatória e concede apenas `gymlog_app`, salvando a URL no `.env` ignorado pelo Git. Se já houver URL, não altera credenciais. Se o papel já existir sem a URL local, a recuperação deve ser feita administrativamente, sem recriar/resetar automaticamente a senha.

As credenciais de execução não podem criar tabelas, alterar catálogo ou ignorar RLS. Não criar usuários de autenticação por SQL: utilizar sempre Neon Auth.

## Testes

```bash
npm run test:backend
npm run build
npm run lint
npm run fmt
npm run dev:full
```

Os testes automatizados simulam o provedor e verificam origem, método, allowlist de rotas, forwarding do corpo, cookies múltiplos, rejeição sem sessão e revalidação da sessão revogada. Não enviam emails nem criam contas externas.

Depois de configurar a Auth URL e o email no console:

1. Criar conta, confirmar o email quando exigido e entrar.
2. Conferir `/api/me` com status 200 e perfil correto.
3. Consultar catálogo na mesma sessão; deve retornar 200.
4. Sair e conferir `/api/me` e catálogo com 401.
5. Recarregar a página para validar persistência de sessão.
6. Solicitar recuperação, abrir o link, trocar a senha e entrar com a nova.
7. Testar duas contas para confirmar perfis separados.

Sem `NEON_AUTH_BASE_URL`, o sistema falha de forma fechada com 503. A implementação não deve ser considerada validada contra o serviço real até concluir essa configuração e os testes de cadastro/email.

## Referências

- [Toolkit oficial para adapters de servidor](https://github.com/neondatabase/neon-js/blob/main/packages/auth/BUILDING-AN-ADAPTER.md)
- [SDK de autenticação e adapter React](https://github.com/neondatabase/neon-js/tree/main/packages/auth)

## Configuração verificada em 04/09/2026

A Auth URL foi obtida da branch production do projeto gymlog e cadastrada no .env local e na Vercel Production. O domínio HTTPS do GymLog foi cadastrado como confiável. Allow Localhost, cadastro/login por email e o servidor de email compartilhado do Neon já estavam habilitados. A confirmação obrigatória no cadastro está desabilitada na configuração atual.

A URL desta região usa o domínio neonauth.sa-east-1.aws.neon.tech, aceito pelo backend junto ao formato neon.build. Foram verificados contra o serviço real: sessão anônima (200/null), rejeição das APIs privadas sem login (401) e conexão ao banco (200). Cadastro, perfil autenticado e entrega dos emails ainda precisam de teste com uma conta do usuário.

## Loading da interface

O componente reutilizável LoadingState usa um halter SVG que salta e gira, com sombra sincronizada em CSS. É usado ao consultar a sessão, carregar o perfil e aguardar as ações dos formulários/logout. Todos os loadings aparecem centralizados na tela inteira, inclusive os acionados por botões ou componentes internos. LoadingState usa um portal no body e posição fixa, sem depender do layout do componente pai. O texto é anunciado com role=status; o desenho é decorativo. prefers-reduced-motion desativa as animações. Não há atraso artificial nas requisições.

Login e envio de emails foram confirmados pelo usuário em 04/09/2026.

As skills neon e neon-postgres estão instaladas em .agents/skills para o Codex. Instalação equivalente pelo repositório oficial: npx --yes skills add neondatabase/agent-skills --skill neon --skill neon-postgres --agent codex -y. As skills fornecem instruções; autenticação da CLI continua independente.


# GymLog — operação do banco

## Estado aplicado

Aplicado em 2026-09-04 ao banco Neon configurado no `.env`, PostgreSQL 18.6.

- 12 tabelas de domínio e `gymlog_migrations` para controle de versões.
- 10 grupos musculares, 6 categorias de equipamento e 12 exercícios iniciais.
- Sem GIFs, URLs inventadas ou importação de mídia externa. Instruções técnicas ainda precisam de curadoria.
- FKs, checks, índices, timestamps, snapshots de exercícios e validação de conclusão de sessão.
- Papel `gymlog_app` sem login, privilégios administrativos ou bypass de RLS.
- RLS nas tabelas privadas e leitura autenticada do catálogo; alterações no catálogo somente pela administração.
- O schema `neon_auth` existente foi preservado; não foram criadas identidades de teste.

O [plano de modelagem](databasePlan.md) continua disponível. Os arquivos em `database/migrations` são a fonte executável do schema.

## Comandos

Execute na raiz, com Node.js compatível com o projeto e `.env` preenchido:

```bash
npm run db:status
npm run db:migrate
npm run db:verify
```

`MIGRATION_DATABASE_URL`, quando definida, tem precedência sobre `DATABASE_URL` nesses comandos. Use uma conexão administrativa para migrations. Nenhuma URL é impressa pelos scripts.

`db:migrate` usa uma conexão transacional WebSocket pelo driver já instalado do Neon. Cria o controle de migrations, obtém um advisory lock e aplica todos os arquivos pendentes na mesma transação. Uma falha reverte aquele lote inteiro. As mensagens “Prepared” só significam aplicação definitiva depois da confirmação “committed successfully”.

Migrations já aplicadas são verificadas por SHA-256 e não são repetidas. A normalização de CRLF/LF evita falsas divergências entre Windows e Linux. Não edite nem remova uma migration aplicada: crie um novo arquivo numerado. Seeds usam slugs estáveis e não sobrescrevem a curadoria existente.

O lock coordena execuções concorrentes do próprio runner; não substitui coordenação com alterações manuais feitas no console.

Não há execução automática de migrations durante build ou deploy da Vercel. Mudanças futuras devem ser testadas em branch de desenvolvimento do Neon e aplicadas de forma deliberada. Essa primeira criação foi autorizada para o banco configurado; as verificações usaram rollback, sem criar uma branch Neon adicional.

## Migrations

| Arquivo | Conteúdo |
| --- | --- |
| `001_schema.sql` | Tabelas, tipos de domínio, índices, FKs e timestamps |
| `002_rules_and_access.sql` | Papel restrito, RLS, snapshots e regras entre tabelas |
| `003_catalog_seed.sql` | Taxonomias, exercícios e músculos relacionados |
| `004_catalog_read_permissions.sql` | Leitura de snapshot sem exigir escrita no catálogo |
| `005_catalog_and_template_rest.sql` | IDs externos, descanso por ficha e bloqueio de exercício repetido |

## Seed curado em português

`database/seeds/curatedExercisesPtBr.sql` contém os grupos, equipamentos, exercícios e relações enviados para o catálogo manual em português. Ele é idempotente e complementa o catálogo sincronizado da API sem removê-lo.

```bash
npm run db:seed:curated
```

O comando executa o arquivo inteiro dentro de uma transação administrativa. Qualquer falha provoca rollback; credenciais e detalhes da conexão não são impressos.

## Catálogo fixo do aplicativo

`database/seeds/fixedCatalogPtBr.sql` contém os 107 exercícios usados na
versão principal do GymLog. O seed arquiva outras fontes sem apagar referências
históricas e pode ser reaplicado sem duplicar registros:

```bash
npm run db:seed:fixed
```

## O que é garantido no banco

- Nome não vazio, posições positivas, carga decimal finita e não negativa.
- Proprietário do filho igual ao proprietário do pai por FKs compostas.
- Somente uma sessão em andamento por usuário.
- Conclusão exige pelo menos uma série concluída e nenhuma pendente; validada por constraint triggers ao finalizar a transação.
- Repetições e duração correspondem ao modo de registro do exercício.
- Série concluída exige medida realizada, carga explícita (incluindo zero para peso corporal) e data de conclusão.
- Snapshot copiado pelo banco ao inserir exercício na sessão; não pode ser alterado depois.
- Modos de medição do catálogo são estáveis; para mudar a convenção, criar outra variação de exercício.
- Exercício ativo exige músculo principal; restrição adiada permite inserir exercício e músculos na mesma transação.
- Fichas usadas pelo histórico não podem ser apagadas isoladamente.
- Remover uma sessão apaga apenas seus exercícios e séries.
- Reordenações podem adiar as constraints únicas de posição dentro da transação.

Incluir um exercício consulta a versão visível do catálogo naquela instrução SQL. Se o catálogo for arquivado concorrentemente logo depois, o histórico já criado continua válido.

## Como o backend deve usar RLS

O papel `gymlog_app` não possui senha nem login. Foi concedido à identidade administrativa que executou a migration. A autenticação do usuário no Neon Auth **ainda precisa ser integrada à API**.

Somente depois de validar a sessão, o backend pode executar na mesma transação:

```sql
BEGIN;
SET LOCAL ROLE gymlog_app;
-- O UUID abaixo deve vir da sessão validada, nunca diretamente do cliente.
SELECT set_config('gymlog.user_id', $1, true);
-- Consultas parametrizadas da aplicação.
COMMIT;
```

Esse bloco é um exemplo de sequência transacional; `$1` deve ser enviado como parâmetro pelo driver. Se usar o modo HTTP do Neon, contexto e consultas devem estar na mesma chamada transacional. Uma chamada separada para configurar contexto não prepara a próxima conexão.

Sem contexto, o papel não vê dados privados nem catálogo. Com contexto, só pode manipular dados próprios. Ele não pode alterar o catálogo nem a tabela de migrations.

**A atual `DATABASE_URL` continua administrativa.** A rota pública `/api/health` só executa `SELECT 1`. Não criar rotas CRUD usando essa conexão diretamente. Ao integrar Auth, provisionar uma credencial de execução separada com acesso ao papel restrito e manter a credencial administrativa apenas para migrations. A RLS não valida tokens por conta própria nem protege consultas feitas por papéis com bypass.

## Validação sem dados persistentes

`db:verify` executa verificações reais no PostgreSQL com fixtures dentro de `BEGIN ... ROLLBACK`. Usa dois perfis temporários na transação, adiando apenas a FK para a identidade; não escreve em `neon_auth`. Também confirma que a FK rejeitaria esses perfis no commit. O script sempre reverte ao finalizar, inclusive em falhas.

Verifica: papel restrito, ausência de contexto, isolamento entre usuários, catálogo somente leitura, FKs de propriedade, sessão única, faixas de repetição, cargas, modo de registro, conclusão consistente, independência do histórico, snapshots imutáveis e exclusão em cascata. Pode adquirir locks breves durante as verificações; preferir branch de desenvolvimento para uso frequente.

`db:verify` testa invariantes do banco, não o login, a sincronização do frontend ou os endpoints futuros. `db:status` mostra versões e contagens do catálogo, sem listar usuários ou treinos.

## Próximas entregas

1. Integração Neon Auth e credencial restrita de execução.
2. API de perfil, consulta do catálogo e fichas.
3. Operação transacional para iniciar ficha copiando exercícios e metas.
4. Salvar séries com IDs idempotentes e comparação da `version` do pai.
5. Finalização, correção do histórico, paginação e consultas de evolução.
6. Curadoria de instruções e contratação/seleção da fonte de GIFs.

As colunas `version` estão criadas; comparar/incrementar versões e tratar reenvios de requisições são responsabilidades dos serviços da API, ainda não implementados. Não há tabelas extras de estatísticas: elas serão derivadas das sessões concluídas.

## Alterações futuras e recuperação

Não existe comando destrutivo de reset neste projeto. Para corrigir uma migration aplicada, criar outra migration. Antes de mudanças destrutivas futuras, usar uma branch/backup do Neon e planejar compatibilidade com a versão da API em produção. Nunca versionar `.env` ou compartilhar connection strings em logs, issues ou documentação.

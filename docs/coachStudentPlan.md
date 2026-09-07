# GymLog — planejamento de coach e aluno

**Status: primeira versão implementada em 2026-09-05.** Este documento complementa o [planejamento do banco](databasePlan.md). O schema foi adicionado pelas migrations `006` a `009`, sem alterar migrations anteriores.

A programação das fichas atribuídas e a visualização mensal estão detalhadas em [agenda semanal e calendário](weeklyScheduleCalendarPlan.md).

## Decisões de produto

- Uma conta continua sendo uma conta comum e pode habilitar o perfil de coach. Não existe um papel exclusivo de professor ou aluno.
- Um coach também registra e executa os próprios treinos normalmente.
- Um aluno pode manter vínculos ativos com até três coaches ao mesmo tempo.
- Uma ficha recebida é somente leitura para o aluno.
- O coach pode consultar todo o histórico de treino do aluno enquanto o vínculo estiver ativo, inclusive treinos criados pelo aluno ou por outro coach.
- Encerrar ou revogar o vínculo remove o acesso futuro do coach. O histórico e as fichas executadas continuam pertencendo ao aluno.
- Uma mesma ficha pode ser atribuída a vários alunos.
- Cada atribuição referencia uma versão imutável da ficha. Alterações posteriores na ficha original não mudam silenciosamente o conteúdo já recebido.
- Instruções podem existir na ficha, em cada exercício e especificamente para cada aluno atribuído.

## Modelo proposto

### `coach_profiles`

| Campo | Regra |
| --- | --- |
| `profile_id` | PK e FK para `profiles(id)` |
| `enabled_at` | Quando o perfil de coach foi habilitado |
| `disabled_at` | Nulo enquanto o recurso estiver habilitado |
| `created_at`, `updated_at` | Datas de controle |

Habilitar ou desabilitar esse perfil não altera a propriedade de fichas ou sessões pessoais. Desabilitar impede novos convites e atribuições, mas preserva registros anteriores.

### `coach_student_invites`

| Campo | Regra |
| --- | --- |
| `id` | UUID |
| `coach_id` | FK para `coach_profiles(profile_id)` |
| `token_hash` | Hash único do token; o token original nunca é persistido |
| `status` | `pending`, `accepted`, `revoked` ou `expired` |
| `expires_at`, `accepted_at`, `revoked_at` | Datas coerentes com o estado |
| `accepted_by` | Aluno que aceitou, preenchido no aceite |
| `created_at`, `updated_at` | Datas de controle |

O link contém um token aleatório de alta entropia e uso único. A API compara o hash, verifica expiração, revogação e coach ativo e consome o convite na mesma transação que cria o vínculo. O link não identifica o aluno antecipadamente, salvo se futuramente o produto optar por convite destinado a um email específico.

### `coach_student_relationships`

| Campo | Regra |
| --- | --- |
| `id` | UUID |
| `coach_id`, `student_id` | FKs para os dois perfis; devem ser diferentes |
| `invite_id` | Convite que originou o vínculo |
| `status` | `active` ou `ended` |
| `can_view_history` | Permissão concedida no aceite; inicialmente sempre verdadeira |
| `accepted_at`, `ended_at` | Início e encerramento do vínculo |
| `created_at`, `updated_at` | Datas de controle |

Permitir apenas um vínculo ativo para o mesmo par coach/aluno. O limite de três coaches ativos é contado por `student_id`, não por convites pendentes. O aceite deve bloquear o perfil do aluno dentro da transação antes de contar vínculos, evitando que convites simultâneos ultrapassem o limite.

O aluno pode encerrar qualquer vínculo. O coach também pode remover o aluno. Ambos os casos mudam o estado para `ended`; registros não são apagados. Um novo aceite futuro cria um novo vínculo e não reativa silenciosamente o anterior.

### `workout_assignment_versions`

Representa o snapshot imutável de uma ficha enviado pelo coach.

| Campo | Regra |
| --- | --- |
| `id` | UUID |
| `coach_id` | Proprietário e autor do snapshot |
| `source_template_id` | Ficha original do coach |
| `source_template_version` | Versão da ficha no momento da publicação |
| `revision` | Versão sequencial da atribuição |
| `name`, `notes`, `rest_seconds` | Cópia dos dados da ficha |
| `created_at` | Data de publicação; sem `updated_at` |

Os exercícios e séries ficam em `workout_assignment_exercises` e `workout_assignment_sets`, também imutáveis e com a mesma estrutura relevante dos itens da ficha. Não usar apenas a versão da ficha original como snapshot: a ficha pode ser arquivada, editada ou ter exercícios substituídos.

Uma correção do coach cria uma nova revisão. Os destinatários existentes só passam para a revisão nova por uma ação explícita e auditável; sessões já iniciadas continuam na revisão anterior.

### `workout_assignments`

Agrupa o envio de uma versão para um ou mais alunos.

| Campo | Regra |
| --- | --- |
| `id` | UUID |
| `coach_id` | Autor do envio |
| `assignment_version_id` | Snapshot imutável publicado |
| `title`, `instructions` | Contexto geral do envio |
| `created_at`, `archived_at` | Datas de controle |

### `workout_assignment_recipients`

| Campo | Regra |
| --- | --- |
| `id` | UUID |
| `assignment_id` | Envio compartilhado |
| `relationship_id`, `student_id` | Vínculo ativo e destinatário |
| `instructions` | Orientação individual para esse aluno |
| `status` | `assigned`, `started`, `completed` ou `withdrawn` |
| `assigned_at`, `withdrawn_at` | Datas de controle |

`UNIQUE(assignment_id, student_id)` impede destinatário duplicado. A atribuição só pode ser criada para um vínculo ativo. Encerrar o vínculo impede novas atribuições e novas consultas pelo coach, mas não remove do aluno as atribuições recebidas nem as sessões realizadas.

## Execução e histórico

`workout_sessions` receberá referências opcionais a `assignment_recipient_id` e `assignment_version_id`. Ao iniciar uma ficha recebida, a API copia o snapshot para `session_exercises` e `session_sets`, como já faz com fichas próprias. A sessão continua com `user_id` igual ao aluno.

O aluno não ganha permissão de `UPDATE` nas tabelas de snapshot ou atribuição. Ele pode alterar somente o estado operacional do próprio destinatário e criar ou executar suas próprias sessões. Se quiser adaptar o treino, uma funcionalidade futura poderá oferecer “duplicar para minhas fichas”, gerando uma ficha pessoal sem modificar a recebida.

O coach consulta as sessões do aluno por uma rota dedicada. A autorização exige, na mesma transação:

1. sessão autenticada do coach;
2. perfil de coach habilitado;
3. vínculo ativo com o aluno;
4. `can_view_history = true`.

A consulta pode mostrar o histórico completo do aluno enquanto essas condições forem verdadeiras. O backend nunca troca o contexto RLS do coach pelo do aluno. A leitura compartilhada precisa de política própria baseada no vínculo ativo, ou de funções SQL restritas que façam essa verificação. Encerrado o vínculo, o coach perde acesso imediatamente.

## Integridade e concorrência

- O limite de três coaches é uma regra entre linhas e precisa de lock transacional no perfil do aluno. Uma trigger pode servir como segunda barreira.
- Aceitar convite, criar vínculo e marcar convite como aceito ocorre em uma única transação.
- Publicar o snapshot e todos os exercícios e séries ocorre em uma única transação.
- Atribuir para vários alunos valida todos os vínculos antes de inserir qualquer destinatário; falha parcial deve reverter o envio inteiro.
- Snapshots publicados não recebem `UPDATE` ou `DELETE` pelo papel da aplicação.
- Tokens aparecem somente no link. Banco e logs armazenam no máximo o hash e um identificador seguro do convite.
- FKs compostas devem garantir que coach, aluno, vínculo, atribuição e destinatário sejam coerentes.

## APIs previstas

| Operação | Resultado |
| --- | --- |
| Habilitar/desabilitar perfil de coach | Atualiza `coach_profiles` |
| Criar, listar e revogar convite | Gerencia links pendentes do coach |
| Visualizar e aceitar convite | Cria vínculo após autenticação do aluno |
| Listar ou encerrar vínculos | Mostra coaches do aluno e alunos do coach |
| Publicar versão de ficha | Cria snapshot imutável |
| Atribuir versão | Cria envio e destinatários |
| Listar fichas recebidas | Retorna atribuições do aluno, somente leitura |
| Executar ficha recebida | Cria sessão pertencente ao aluno |
| Consultar histórico do aluno | Exige vínculo ativo e permissão |

As operações estão disponíveis em `GET/POST /api/coach`. A interface oferece habilitação do perfil, geração e aceite do convite, encerramento do vínculo, atribuição de fichas e histórico do aluno. Fichas recebidas aparecem em **Minhas fichas** e são executáveis sem oferecer edição.

## Testes obrigatórios antes da entrega

- A conta coach ainda cria e executa fichas pessoais.
- O quarto vínculo ativo do aluno é rejeitado, inclusive com aceites simultâneos.
- Convite expirado, revogado, já usado ou pertencente a coach desabilitado é rejeitado.
- Aluno não altera snapshot, exercícios, séries ou instruções recebidas.
- Alterar a ficha original não muda atribuições existentes.
- Uma atribuição atende vários alunos sem compartilhar dados de execução entre eles.
- Coach acessa o histórico completo somente durante vínculo ativo.
- Outro coach e usuários sem vínculo não acessam o aluno.
- Encerrar vínculo preserva sessões e atribuições do aluno e interrompe o acesso do coach.
- Sessão criada de uma atribuição mantém o snapshot mesmo após nova revisão ou encerramento do vínculo.

## Ordem de implementação

1. Criar uma branch de desenvolvimento do banco no Neon.
2. Escrever uma migration nova com tabelas, índices, constraints, grants e RLS.
3. Estender a verificação transacional do banco para dois coaches e um aluno.
4. Implementar domínio e endpoints de convite e vínculo.
5. Implementar publicação, atribuição e listagem somente leitura.
6. Integrar a execução recebida ao fluxo atual de sessões.
7. Implementar a visão de alunos e histórico para o coach.
8. Criar a interface de ativação, convites, alunos e fichas recebidas.

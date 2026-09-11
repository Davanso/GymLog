# GymLog — planejamento de agenda semanal e calendário

**Status: Etapa 1 implementada em 2026-09-08.** O schema foi adicionado pela migration `010`, sem alterar migrations anteriores. Este documento complementa o [planejamento do banco](databasePlan.md) e o módulo de [coach e aluno](coachStudentPlan.md).

## Objetivo

Permitir que uma ficha seja programada para um ou mais dias da semana e transformar essa programação em um calendário de aderência. Uma ficha de peito, por exemplo, pode ser planejada para toda segunda-feira. O calendário mostra o que estava previsto e o que foi realizado em cada data.

Para coaches, o mesmo calendário permite selecionar um aluno com vínculo ativo e acompanhar sua agenda e seu histórico.

## Decisões propostas

- Uma ficha pode ser programada para vários dias da semana.
- Cada dia da semana pode pertencer a apenas uma ficha ativa por aluno. Dias já usados ficam
  indisponíveis nas demais fichas.
- A programação é opcional; fichas sem dia continuam funcionando normalmente.
- Treinos avulsos aparecem no calendário mesmo sem programação.
- Usar dias ISO: segunda-feira `1` até domingo `7`.
- Datas são interpretadas no fuso configurado no perfil do aluno.
- Alterar a agenda vale a partir de uma data escolhida e não reescreve o passado.
- Fichas recebidas continuam somente leitura. O coach define a agenda ao atribuir ou posteriormente; o aluno visualiza e executa.
- O aluno pode programar suas próprias fichas. A agenda de uma ficha recebida é controlada exclusivamente pelo coach.
- O aluno pode solicitar ao coach uma mudança recorrente de dias ou o reagendamento pontual de uma ocorrência. A mudança só é aplicada após aprovação.
- O coach acessa o calendário de um aluno somente enquanto o vínculo estiver ativo.
- Notificações internas registram novas atribuições, solicitações, respostas e mudanças de agenda.

## Por que o dia da semana não deve ficar na ficha

Adicionar apenas uma coluna `weekday` em `workout_templates` criaria limitações:

- impediria a mesma ficha na segunda e na quinta;
- misturaria conteúdo da ficha com planejamento de agenda;
- alterações retroativas poderiam transformar dias antigos em faltas;
- não representaria reagendamentos, pausas ou datas de início e fim;
- dificultaria usar fichas atribuídas por coaches.

A agenda recorrente deve ser uma entidade separada. O calendário também precisa de ocorrências datadas para preservar o que estava previsto em cada dia.

## Modelo proposto

### `workout_schedules`

Representa uma regra semanal recorrente.

| Campo | Regra |
| --- | --- |
| `id` | UUID |
| `user_id` | Aluno ou usuário que executará o treino |
| `template_id` | Ficha pessoal, quando a origem for do próprio usuário |
| `assignment_recipient_id` | Ficha recebida, quando a origem for um coach |
| `created_by` | Perfil que criou a agenda: o próprio usuário ou seu coach |
| `weekday` | Inteiro de `1` a `7` |
| `starts_on` | Primeira data em que a regra pode gerar ocorrências |
| `ends_on` | Data opcional de encerramento |
| `status` | `active` ou `ended` |
| `created_at`, `updated_at` | Datas de controle |

Exatamente uma origem deve existir: `template_id` ou `assignment_recipient_id`. A API confirma que a ficha pessoal pertence ao `user_id`, ou que o destinatário da atribuição é esse aluno e o vínculo com o coach está ativo.

Uma ficha em dois dias da semana possui duas regras. Um índice único impede repetir a mesma origem, usuário, dia e período ativo.

### `scheduled_workouts`

Representa o treino esperado em uma data específica e preserva o calendário histórico.

| Campo | Regra |
| --- | --- |
| `id` | UUID |
| `user_id` | Pessoa que deverá executar |
| `schedule_id` | Regra que originou a ocorrência |
| `scheduled_date` | Data local do usuário, tipo `date` |
| `template_id` | Referência da ficha pessoal, quando aplicável |
| `assignment_version_id` | Snapshot recebido do coach, quando aplicável |
| `session_id` | Sessão realizada para essa ocorrência |
| `status` | `planned`, `completed`, `missed`, `cancelled` ou `rescheduled` |
| `created_at`, `updated_at` | Datas de controle |

`UNIQUE(schedule_id, scheduled_date)` evita ocorrências duplicadas. `session_id` também deve ser único: uma sessão não conclui dois compromissos diferentes.

A ocorrência guarda a versão atribuída ao aluno. Mudanças futuras do coach não alteram o treino previsto naquela data. Para ficha pessoal, a sessão já cria seus próprios snapshots no início; opcionalmente uma evolução futura pode congelar também a versão da ficha antes do início.

## Geração das ocorrências

Gerar ocorrências em uma janela móvel, por exemplo, oito semanas futuras e todo o período consultado no passado. A operação deve ser idempotente com `INSERT ... ON CONFLICT DO NOTHING`.

Não depender exclusivamente de um cron executado à meia-noite. Ao abrir a agenda, consultar o calendário ou iniciar um treino, a API garante as ocorrências da janela necessária. Um job periódico pode antecipar esse trabalho, mas a correção do produto não depende dele.

Quando a agenda muda:

1. encerrar a regra anterior em uma data;
2. preservar suas ocorrências passadas;
3. cancelar apenas ocorrências futuras ainda não iniciadas;
4. criar uma nova regra com a nova vigência;
5. gerar as novas ocorrências sem modificar sessões existentes.

## Relação com sessões

`workout_sessions` receberá `scheduled_workout_id` opcional. Ao iniciar pelo calendário, a API bloqueia a ocorrência, confirma que ainda está disponível e cria a sessão na mesma transação.

Ao finalizar a sessão, a ocorrência muda para `completed`. Cancelar uma sessão não conclui a ocorrência; ela pode continuar `planned` até o fim do dia ou voltar explicitamente para esse estado. Excluir uma sessão concluída deve reavaliar a ocorrência associada, evitando manter um dia verde sem treino existente.

Treinos iniciados fora do calendário continuam válidos e aparecem como eventos avulsos. Na primeira versão, não associar automaticamente um treino avulso a uma ocorrência apenas por ter a mesma ficha e data; essa escolha pode conectar o registro errado quando existem dois treinos planejados.

## Regras visuais do calendário

As cores representam aderência, não apenas a existência de qualquer registro:

| Situação do dia | Cor |
| --- | --- |
| Todos os treinos planejados foram concluídos | Verde |
| Existe treino avulso concluído e nenhum planejamento pendente | Verde |
| O dia terminou com ao menos um treino planejado não concluído | Vermelho |
| Parte dos treinos foi concluída, mas algum planejado não | Vermelho, com contagem `1 de 2 realizados` |
| Hoje ainda possui treino pendente | Cor neutra de destaque; ainda não é falta |
| Dia futuro | Neutro |
| Dia sem treino planejado nem realizado | Neutro |
| Todas as ocorrências foram canceladas justificadamente | Neutro com indicação de cancelamento |

“Dia terminou” significa meia-noite seguinte no fuso IANA do aluno. O backend deve devolver o estado sem exigir que o navegador calcule fusos ou determine faltas.

O vermelho nunca é aplicado a dias de descanso, datas futuras ou dias anteriores ao início da agenda. Um treino cancelado não deve produzir verde.

## Experiência do usuário

### Agenda da ficha

Na criação e edição de ficha pessoal, incluir uma seção “Dias de treino” com os sete dias da semana. Nenhum dia começa selecionado. Salvar a ficha e sua agenda ocorre de forma atômica ou apresenta claramente uma falha parcial recuperável.

Para uma ficha recebida, os dias aparecem como informação somente leitura. A agenda identifica o coach responsável.

### Calendário do aluno

- Visualização mensal como padrão e navegação entre meses.
- Indicadores verde, vermelho e neutro com texto ou ícone; a cor não pode ser o único meio de transmitir o estado.
- Ao selecionar um dia, listar fichas previstas, situação, horário das sessões realizadas, coach de origem e ações disponíveis.
- Em um compromisso de hoje, permitir iniciar ou retomar o treino.
- Permitir abrir sessões antigas sem carregar o mês inteiro novamente.

### Calendário do coach

- A aba “Calendário” mantém o calendário do próprio coach como estado inicial.
- Um seletor lista somente alunos com vínculo ativo.
- Ao selecionar um aluno, a API retorna a agenda e o histórico daquele aluno após verificar o vínculo.
- Exibir claramente o nome do aluno selecionado para evitar que o coach interprete ou altere a agenda errada.
- A primeira versão permite leitura do calendário e criação de agenda para fichas atribuídas pelo próprio coach. Não permite alterar fichas pessoais do aluno ou agendas criadas por outro coach.
- Se o vínculo for encerrado durante a tela aberta, a próxima consulta ou mutação retorna `403` e remove os dados do aluno da interface.

### Solicitações e notificações

- Uma solicitação recorrente propõe um novo conjunto de dias para uma ficha recebida.
- Uma solicitação pontual referencia uma ocorrência existente e propõe uma nova data.
- O coach pode aprovar ou rejeitar e incluir uma observação para o aluno.
- Aprovar uma mudança recorrente encerra as regras anteriores e cria regras futuras; aprovar uma mudança pontual preserva a ocorrência original como `rescheduled`.
- A central de notificações fica na aba Calendário e mantém estado lido/não lido.
- Web Push, preferências por dispositivo e badge do PWA ficam para a Etapa 2. A implementação deverá consumir os eventos persistidos em `app_notifications`.

Para testar a central interna na Etapa 1:

1. entre como coach, atribua uma ficha ou altere os dias de uma ficha já atribuída;
2. entre como aluno e abra **Calendário > Notificações** para ver o aviso;
3. como aluno, solicite uma mudança de agenda em uma ficha recebida;
4. volte ao coach para aprovar ou recusar; a resposta aparecerá na central do aluno.

A central permanece visível quando vazia para deixar claro onde os avisos serão exibidos. Abrir a
central marca os itens existentes como lidos. Push do navegador ainda não faz parte desta etapa.

### Etapa 2 — relatórios e push

- Criar uma aba separada “Relatórios”, sem sobrecarregar o calendário.
- Oferecer resumos semanal e mensal de aderência, duração, séries, faltas e evolução de carga.
- Permitir que o coach consulte os mesmos resumos no contexto de um aluno autorizado.
- Adicionar PWA, Service Worker, assinaturas Web Push e preferências de notificação por categoria/dispositivo.

## API prevista

| Operação | Comportamento |
| --- | --- |
| Criar ou alterar agenda pessoal | Valida propriedade da ficha e vigência |
| Criar agenda de atribuição | Exige coach, vínculo ativo e atribuição do próprio coach |
| Listar agenda | Retorna regras atuais do usuário autorizado |
| Consultar mês | Garante ocorrências e retorna dias agregados e eventos |
| Iniciar ocorrência | Cria sessão e vincula ao compromisso atomicamente |
| Consultar calendário de aluno | Exige vínculo ativo e permissão de histórico |
| Encerrar programação | Preserva passado e cancela ocorrências futuras elegíveis |
| Solicitar mudança recorrente ou pontual | Registra pedido pendente e notifica o coach |
| Responder solicitação | Aprova ou rejeita atomicamente e notifica o aluno |
| Listar/marcar notificações | Retorna a central do usuário e controla itens não lidos |

A resposta mensal deve vir agregada para evitar uma requisição por dia. Exemplo conceitual:

```json
{
  "month": "2026-09",
  "timezone": "America/Sao_Paulo",
  "days": [
    {
      "date": "2026-09-07",
      "status": "completed",
      "completed": 1,
      "planned": 1
    }
  ]
}
```

## Autorização e privacidade

- O aluno consulta o próprio calendário e histórico.
- O coach consulta o calendário completo do aluno apenas com vínculo ativo e `can_view_history`.
- Um coach só cria ou altera a agenda de uma ficha que ele mesmo atribuiu.
- Outro coach não vê instruções privadas nem administra atribuições que não criou, mesmo atendendo o mesmo aluno.
- A sessão realizada pertence sempre ao aluno.
- O backend resolve `user_id` a partir da sessão ou do vínculo autorizado; nunca aceita livremente um proprietário enviado pelo frontend.
- Políticas RLS ou funções SQL restritas devem validar o vínculo em cada leitura compartilhada.

## Índices sugeridos

| Uso | Índice |
| --- | --- |
| Agenda ativa do usuário | `workout_schedules(user_id, status, weekday)` |
| Ocorrências do mês | `scheduled_workouts(user_id, scheduled_date)` |
| Pendências de uma regra | `scheduled_workouts(schedule_id, status, scheduled_date)` |
| Sessão vinculada | `UNIQUE(scheduled_workouts.session_id) WHERE session_id IS NOT NULL` |
| Agenda de uma atribuição | `workout_schedules(assignment_recipient_id, status)` |

## Testes obrigatórios

- A mesma ficha pode ser programada em dois dias sem duplicar ocorrências.
- Alterar a agenda não muda dias passados.
- Datas são geradas corretamente no fuso do aluno, inclusive em transições de horário oficial quando aplicável.
- Hoje pendente não fica vermelho; somente um dia local já encerrado vira falta.
- Dia sem planejamento permanece neutro.
- Dois treinos previstos e apenas um concluído resultam em dia vermelho e contagem parcial.
- Treino avulso concluído aparece em verde quando não existe pendência planejada.
- Inícios simultâneos da mesma ocorrência criam uma única sessão.
- Excluir sessão concluída remove a conclusão da ocorrência.
- Aluno não edita agenda de ficha recebida.
- Coach não altera agenda criada por outro coach.
- Coach sem vínculo ativo não consulta calendário nem histórico do aluno.
- O quarto coach continua rejeitado mesmo quando tenta criar agenda ou atribuição.

## Ordem de implementação

1. Aplicar a migration `010` em uma branch de desenvolvimento do Neon e executar os testes de integração.
2. Validar a experiência responsiva do calendário com aluno e coach reais.
3. Implementar a Etapa 2 somente após observar o uso das solicitações e notificações internas.

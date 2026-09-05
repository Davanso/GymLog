# Fichas, sessões e descanso

## Fluxo entregue

Depois do login, **Meus treinos** permite criar, editar e excluir fichas. Cada ficha tem nome, observações e até 20 exercícios ordenados do catálogo local. Para cada exercício: observação própria, 1–10 séries, repetição única ou faixa (como `10-12` e `de 10 a 12`), duração quando aplicável e carga em kg. O descanso de 0–3600 segundos pertence à ficha. As séries do mesmo exercício têm metas iguais nesta interface.

Treinos concluídos ou cancelados podem ser apagados permanentemente na seção
**Treinos recentes**. A operação exige confirmação, remove séries e exercícios
da sessão em cascata e só aceita registros encerrados pertencentes ao usuário.

**Iniciar treino** cria uma sessão com cópias do nome, exercícios e metas. Alterações posteriores na ficha não alteram o treino iniciado. Apenas uma sessão pode ficar em andamento por usuário. **Retomar treino** recupera as séries já salvas, inclusive após recarregar a página.

O realizado começa vazio: a meta é apenas uma sugestão. O usuário informa repetições/duração e carga, e escolhe **Concluir série**. Zero kg é um valor válido (por exemplo, peso corporal sem carga adicional); um campo vazio não significa zero. Também é possível pular uma série. Cada confirmação é salva no banco antes de iniciar o descanso.

Para finalizar, é necessário concluir ao menos uma série e concluir ou pular todas as demais. Cancelamento preserva os registros parciais e os identifica como cancelados. A lista de **Treinos recentes** mostra os últimos 20 registros e permite consultar suas séries. Correção posterior do histórico e gráficos ficam para outra etapa.

Excluir uma ficha a arquiva: ela sai da lista, mas as sessões e referências históricas continuam existindo. Há confirmação visual antes de excluir, cancelar treino ou descartar edição.

## Timer

- Início automático após salvar uma série concluída, se ainda houver séries pendentes e o descanso for maior que zero.
- Pausar, retomar, adicionar 30 segundos ou pular o descanso. Pular descanso não pula uma série.
- Aviso visual ao terminar e som opcional, habilitado pelo próprio usuário.
- Horário absoluto de término, em vez de descontar um segundo a cada callback: atrasos do navegador não acumulam erro de contagem.
- Persistência local por usuário e sessão, incluindo pausa. Ao voltar à sessão no mesmo navegador, a contagem usa o tempo realmente decorrido. O timer não é sincronizado entre dispositivos ou abas; os registros de séries são sincronizados pelo banco.
- Áudio depende das permissões e do estado do navegador. Não há promessa de alarme com navegador fechado ou sistema suspenso; ao retornar, o horário de término é recalculado. Ative o som novamente ao reabrir a tela de treino.
- Novo descanso substitui o anterior com confirmação. Descanso 0 desativa o início automático.

O halter centralizado fica reservado ao carregamento inicial sem dados, aparecendo apenas se a espera passar de 250 ms. Operações sobre dados já visíveis mantêm a tela e mostram um status discreto, bloqueando os controles até a resposta. O timer não usa loading durante a contagem.

## Catálogo

A seleção mantém os exercícios curados e os 200 exercícios disponibilizados pelo plano gratuito da AscendAPI. `npm run catalog:sync` percorre as oito páginas de 25 itens, consulta os detalhes e atualiza o catálogo de forma idempotente. Os nomes possuem uma tabela explícita em português; equipamentos, músculos, tipos e instruções passam pela camada de localização antes de chegar à interface. A chave da RapidAPI permanece somente no servidor.

Os músculos detalhados do fornecedor são consolidados em grupos curtos no arquivo `server/muscleGroupMap.ts`. Esse é o ponto único para ajustes manuais: `muscleGroupMap` agrupa anatomia, `bodyPartGroup` define categorias por parte corporal e `exerciseGroupOverrides` corrige exercícios específicos cujo cadastro do fornecedor é inconsistente. Depois de uma alteração, execute `npm run catalog:sync`. A lista atual é Abdômen, Adutores, Antebraços, Bíceps, Corpo inteiro, Costas, Glúteos, Ombros, Panturrilhas, Peito, Pescoço, Posteriores de coxa, Quadríceps e Tríceps.

O dashboard separa `primary_muscle_groups` de `secondary_muscle_groups`. O filtro por grupo usa somente os principais; músculos auxiliares aparecem como informação e continuam pesquisáveis por texto, mas não colocam o exercício em outra categoria.

O botão **Ver execução** está disponível no editor e durante o treino. Ele abre um popup centralizado com legenda em português, vídeo, imagem de apoio e instruções. A sincronização encontrou imagem nos 200 exercícios e vídeo em 199; o único detalhe sem vídeo persistido recebeu HTTP 429 do CDN após três tentativas e continua com imagem. A interface usa primeiro a mídia persistida, por isso um limite momentâneo do fornecedor não impede a demonstração. Apenas URLs HTTPS do domínio permitido pelo adaptador são exibidas.

No editor, **Ver execução** aparece diretamente em cada resultado sincronizado do catálogo e também no card depois que o exercício é adicionado. Os exercícios curados antigos sem mídia externa não exibem uma ação vazia.

## API

Todas as rotas abaixo exigem sessão verificada. O proprietário vem exclusivamente do Neon Auth; nenhum `user_id` do corpo é usado. As respostas usam `Cache-Control: no-store`.

| Método | Rota/operação | Resposta |
| --- | --- | --- |
| GET | `/api/workouts` | Exercícios locais, fichas, sessão ativa e 20 sessões recentes |
| GET | `/api/workouts?session=UUID` | Uma sessão e suas séries, somente do usuário autenticado |
| POST | `{ action: "create", template }` | Cria e retorna ficha normalizada com versão |
| POST | `{ action: "update", template, version }` | Retorna ficha atualizada com nova versão |
| POST | `{ action: "archive", id, version }` | Arquiva ficha |
| POST | `{ action: "start", id, templateId, version }` | Cria sessão ou retorna a mesma operação já criada |
| POST | `{ action: "set", id, version, setId, status, amount, load }` | Salva série e retorna sessão atualizada |
| POST | `{ action: "finish" ou "cancel", id, version }` | Encerra a sessão |
| POST | `{ action: "delete-session", id }` | Exclui uma sessão encerrada do histórico |

`template` tem `id` UUID gerado pelo cliente, `name`, `notes`, `restSeconds` e `items`. O descanso é único por ficha. Cada item contém `exerciseId`, `sets`, `reps`, `repsMax`, `seconds`, `load` e `notes`; o mesmo `exerciseId` não pode aparecer duas vezes. Apenas a faixa de repetições ou `seconds` fica preenchida. `version` de início é a versão da ficha; as operações de série/finalização usam a versão da sessão.

No registro da série, `status` aceita `completed` ou `skipped`. `amount` corresponde a repetições ou segundos conforme o snapshot. `load` é a carga real em kg. Para uma série pulada, os valores reais são descartados.

Gravações exigem JSON e `Origin` igual a `APP_URL`; o corpo tem limite de 16 KiB. Entradas inválidas retornam 400, ausência de sessão 401, origem inválida 403, registro de outro usuário/inexistente 404 e versão antiga ou sessão já encerrada 409. Em conflito, recarregue os dados e confira antes de tentar novamente. Não há sobrescrita silenciosa nem fila offline.

## Banco e concorrência

Nenhuma migration nova foi necessária. As tabelas e triggers existentes são reutilizadas. Todas as operações de negócio usam uma conexão WebSocket por requisição e uma transação com `SET LOCAL ROLE gymlog_app`, contexto do usuário e commit/rollback. A conexão vem apenas de `RUNTIME_DATABASE_URL`; não existe fallback administrativo.

Criação e início bloqueiam a linha do perfil para serializar requisições do mesmo usuário. Edições bloqueiam a ficha; registros bloqueiam a sessão e conferem a versão. O índice único de sessão ativa reforça a regra no banco. Criação de ficha com o mesmo ID e conteúdo retorna o registro existente; conteúdo conflitante retorna 409. Início com o mesmo ID de operação retorna a sessão existente. Repetir uma gravação de série com versão antiga exige conferência via 409, sem duplicar séries.

## Validação

```bash
npm run test:backend
npm run test:frontend
npm run test:tooling
npm run test:integration
npm run build
npm run lint
npm run fmt
```

`test:integration` é explícito e usa `MIGRATION_DATABASE_URL` ou `DATABASE_URL` do `.env`. Cria identidades de perfil fictícias apenas dentro de uma transação com FK adiada e rollback obrigatório; não cria usuários no Neon Auth e não persiste dados de teste. Use preferencialmente uma branch de desenvolvimento. Testa isolamento entre dois usuários, repetição de criação/início, conflito de versão, snapshots, carga zero, séries puladas, finalização, exclusão do histórico e arquivamento sem perder referências.

Os testes unitários cobrem limites e tipos de entrada e o relógio com tempo simulado. A interface foi conferida com dados simulados no navegador, em desktop e largura de celular, incluindo criação, início, registro de série, pausa e +30 segundos. Nenhum treino foi criado na conta real do usuário durante essa conferência.

## Interface e desempenho

O editor mostra o título dentro do card, número separado, campos de metas e barra de ações fixa. As unidades seguem Kg/total, Kg/mão, Kg/máquina, Kg/adicional e Kg/assistência. Ordenação só aparece com dois ou mais exercícios. Botões indisponíveis usam cursor de indisponibilidade, sem simular carregamento.

Sair sem mudanças retorna imediatamente. Se houver alterações, um diálogo próprio oferece continuar editando ou descartar, com foco contido, Escape e retorno de foco. Salvar sem mudanças não envia requisição.

Respostas de criação/edição atualizam as fichas em memória; início/finalização atualizam sessão ativa e recentes; exclusão remove a ficha da lista somente após confirmação da API. Não há GET de dashboard adicional após essas operações nem ao voltar da sessão. Registros já abertos ficam em cache durante a montagem da tela. O cache não guarda dados no disco nem ignora conflitos: versões antigas continuam retornando 409, com opção explícita de recarregar.

O perfil e o dashboard usam `sessionStorage` para exibir imediatamente a última versão conhecida e fazem revalidação em segundo plano. O cache é isolado pelo usuário e é descartado ao fechar a sessão do navegador. O backend reutiliza um pool pequeno por instância serverless; cada requisição ainda abre sua própria transação, papel restrito e contexto RLS. A criação de uma sessão copia exercícios e séries em lote, e a leitura de uma sessão reúne seu conteúdo em uma consulta.

Todas as decisões destrutivas ou de encerramento usam o `ConfirmDialog` acessível do app: sair da edição, remover exercício, excluir ficha, pular série, substituir descanso, finalizar ou cancelar treino. Escape, clique no fundo e o botão seguro fecham o popup sem executar a ação.

O layout autenticado possui uma navegação lateral persistente. **Minhas fichas** é a primeira tab e o mesmo contêiner receberá as próximas áreas do GymLog; em telas pequenas, a navegação vira uma barra compacta no topo.

Enquanto houver alterações não salvas, logo, tab **Minhas fichas**, botão de retorno e saída da conta passam pela mesma confirmação de descarte. Ao confirmar uma dessas navegações, o app marca a saída como autorizada para que `beforeunload` não abra um segundo aviso. Recarregar, fechar a aba e voltar pelo navegador usam `beforeunload`; nesses casos o navegador exige seu próprio diálogo e não permite que a página substitua a interface nativa.

Verificação de interface com respostas simuladas: busca por gluteos encontra Glúteos; abrir edição e sair sem mudanças mantém o contador de rede em 1 (GET inicial); editar e salvar leva a 2 (apenas o POST, sem GET posterior). Diálogo, Escape e layouts de desktop/celular conferidos.

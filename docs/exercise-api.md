# GymLog — integração com AscendAPI / ExerciseDB

## Conexão

O backend consulta ExerciseDB V2 pelo RapidAPI. O navegador chama `/api/catalog`; a chave é anexada pelo servidor e nunca é retornada ao cliente. A integração usa `fetch` do Node, sem dependências adicionais.

No `.env` local:

```dotenv
RAPIDAPI_KEY=""
RAPIDAPI_HOST="edb-with-videos-and-images-by-ascendapi.p.rapidapi.com"
```

Use `RAPIDAPI_KEY` e `RAPIDAPI_HOST` no `.env` e na Vercel. Os nomes `x-rapidapi-key` e `x-rapidapi-host` são apenas headers HTTP enviados pelo servidor; hífens não são aceitos nos nomes das variáveis pela Vercel CLI. O host é validado contra o único provedor permitido; não aceita destinos arbitrários. Reinicie `npm run dev:full` após alterar o `.env`.

Na Vercel, cadastrar as variáveis de servidor no ambiente apropriado antes do deploy. A configuração local não é enviada automaticamente. A chave não deve usar prefixo `VITE_` nem ser colocada em arquivos versionados.

## Endpoints

Todos os recursos usam `GET /api/catalog`. O parâmetro `resource` é opcional e assume `exercises`.

| Consulta | Exemplo |
| --- | --- |
| Partes do corpo e imagens | `/api/catalog?resource=bodyparts` |
| Grupos musculares do fornecedor | `/api/catalog?resource=muscles` |
| Equipamentos | `/api/catalog?resource=equipments` |
| Tipos de exercício | `/api/catalog?resource=exercisetypes` |
| Listagem | `/api/catalog?limit=10` |
| Filtrar por nome e parte do corpo | `/api/catalog?name=bench&bodyParts=CHEST&limit=10` |
| Próxima página | `/api/catalog?limit=10&after=EXERCISE_ID` |
| Página anterior | `/api/catalog?limit=10&before=EXERCISE_ID` |
| Busca textual | `/api/catalog?resource=search&search=bench%20press` |
| Detalhe com imagens, vídeo e instruções | `/api/catalog?resource=exercise&id=EXERCISE_ID` |
| Importar um exercício selecionado | `POST /api/catalog` com `{ "externalId": "EXERCISE_ID" }` |

Substitua `EXERCISE_ID` pelo `externalId` recebido, no formato `exr_...`. Na listagem são aceitos `name`, `keywords`, `targetMuscles`, `secondaryMuscles`, `exerciseType`, `bodyParts`, `equipments`, `limit`, `after` e `before`. Use de 1 a 25 resultados por página, default 10. Não combine os dois cursores. Use `URLSearchParams` para codificar filtros.

Busca textual usa o endpoint próprio do fornecedor, sem parâmetros de paginação. A listagem filtrada deve ser usada quando for necessário paginar. Taxonomias e texto dos exercícios são retornados no idioma original do fornecedor, sem tradução automática.

## Respostas

Listas retornam `{ data: [...] }`. Listagem e busca incluem `meta` com `total`, `hasNextPage`, `hasPreviousPage`, `nextCursor` e `previousCursor`. Quando o fornecedor não informa total/cursor, retornam `null`; flags ausentes retornam `false`.

O detalhe retorna `{ data: {...} }`. O exercício normalizado contém:

- `provider: "ascendapi"`, `externalId`, `name`.
- `imageUrl`, `imageUrls` por resolução e `videoUrl`.
- `bodyParts`, `equipments`, `targetMuscles`, `secondaryMuscles`, `exerciseType`.
- `instructions` e `overview`, quando disponíveis.

Na listagem alguns campos de detalhe podem estar vazios. A interface deve consultar o detalhe ao abrir um exercício. Mídias ausentes retornam `null`; listas ausentes retornam `[]`. Somente URLs HTTPS do CDN `exercisedb.dev` são expostas como mídia.

O plano atual informa `Exercise Library Size = 200`. O comando abaixo sincroniza todos os itens e seus detalhes:

```bash
npm run catalog:sync
```

O sincronizador trabalha em lotes de quatro, reaproveita itens com vídeo e tenta cada detalhe até três vezes. Se o fornecedor limitar um detalhe, salva o resumo e a imagem; uma execução futura tenta completar o vídeo. A tabela versionada `exercise-name-translations.ts` garante nomes estáveis em português, enquanto a camada `exercise-translations.ts` localiza taxonomias e textos de instrução.

O `externalId` não é enviado diretamente para as FKs das fichas. `POST /api/catalog` recebe somente esse identificador, consulta o detalhe diretamente no fornecedor e importa de forma idempotente nome, equipamento, músculos e mídia permitida. A resposta contém o UUID local que pode ser usado em `exerciseId`. A gravação usa a conexão administrativa exclusivamente no módulo server-only de importação; as operações do usuário continuam sob `gymlog_app` e RLS.

## Imagens e vídeos

O produto contratado no exemplo é ExerciseDB V2: a resposta real consultada contém imagens JPG/WebP e vídeo MP4. Não presumir que uma imagem seja GIF. O frontend pode usar a URL da imagem em `<img>` e a URL do vídeo em `<video controls>`; nenhum header secreto é necessário no CDN.

Segundo a [política do fornecedor](https://docs.ascendapi.com/guides/caching), armazenar dados depende da autorização do plano, e URLs de mídia rotacionam semanalmente. Por isso esta implementação consulta em tempo real, sem cache de aplicação/CDN, downloads em lote ou persistência das respostas no banco. A autorização para persistir conteúdo deverá ser confirmada antes de ligar os exercícios externos às fichas e ao histórico.

## Falhas e limites

| HTTP | Situação |
| --- | --- |
| 400 | Parâmetros, identificador ou paginação inválidos |
| 404 | Fornecedor não encontrou o exercício |
| 405 | Método diferente de GET |
| 429 | Limite de requisições atingido no fornecedor |
| 502 | Erro de acesso ao fornecedor ou resposta inválida |
| 503 | Chave ausente ou host configurado incorretamente |
| 504 | Timeout de 10 segundos |

As respostas de erro são genéricas e não incluem o corpo de erro do fornecedor, headers ou credenciais. Redirects do fornecedor são recusados, evitando enviar a chave para outro destino. Não existem retries automáticos que consumam a cota repetidamente.

O endpoint exige sessão válida do Neon Auth. Configure conforme o [guia de autenticação](authentication.md). Sem sessão, retorna 401; configuração de autenticação ausente retorna 503. Controle de consumo por usuário ainda deve ser implementado; o limite retornado pelo fornecedor não equivale a uma proteção distribuída da aplicação. A rota não fornece acesso a dados privados do Neon.

## Desenvolvimento e testes

```bash
npm run dev:full
npm run test:backend
npm run build
```

`npm run dev:full` usa a Vercel CLI instalada nas dependências do projeto e exige projeto vinculado. Rode `npm ci` ao clonar ou atualizar as dependências. Use a porta mostrada no terminal para chamar `/api/catalog?resource=bodyparts`. O comando Vite isolado não executa as funções.

Se aparecer `NO_RESPONSE_FROM_FUNCTION` com `Cannot read properties of undefined (reading 'startsWith')`, confira a versão da CLI exibida no início do terminal. A CLI global 41.3.2 falhou antes de executar os handlers neste projeto; a versão local 59.11.2 foi validada com `/api/health` e `/api/catalog?resource=bodyparts`, ambos retornando 200. Encerre o processo antigo com Ctrl+C e reinicie por `npm run dev:full`, evitando chamar a instalação global com `vercel dev` diretamente.

Os testes usam respostas simuladas para não gastar cota: validação de entrada, normalização, paginação, mídias, proteção da chave, falhas/timeout e comportamento HTTP. A conexão real foi conferida separadamente com a chave local.

## Teste manual

Inicie `npm run dev:full` com a porta correspondente a `APP_URL`. Configure o Neon Auth e entre no navegador. Na mesma origem, abra os endpoints da tabela acima: os cookies da sessão são enviados automaticamente. Sem login, o catálogo retorna 401.

No Postman ou Insomnia, autentique pela rota `POST /api/auth/sign-in/email`, com JSON contendo email/senha e header `Origin` igual a `APP_URL`; mantenha o cookie jar para as consultas seguintes. Nunca informe a chave RapidAPI no cliente.

`/api/health` continua público e deve retornar `database: connected`. Com sessão válida, `/api/catalog?limit=100` retorna 400 e POST no catálogo retorna 405. Consultas reais consomem a cota do fornecedor; os testes automatizados não.

## Referências técnicas

- [Quickstart do fornecedor](https://docs.ascendapi.com/quickstart/overview)
- [OpenAPI ExerciseDB V2](https://docs.ascendapi.com/api-reference/exercisedb-v2/exercisedb-v2.json)
- [Política de cache e URLs de mídia](https://docs.ascendapi.com/guides/caching)

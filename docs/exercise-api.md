# GymLog — integração com AscendAPI / ExerciseDB

## Conexão

O backend consulta ExerciseDB V2 pelo RapidAPI. O navegador chama `/api/catalog`; a chave é anexada pelo servidor e nunca é retornada ao cliente. A integração usa `fetch` do Node, sem dependências adicionais.

No `.env` local:

```dotenv
RAPIDAPI_KEY=""
RAPIDAPI_HOST="edb-with-videos-and-images-by-ascendapi.p.rapidapi.com"
```

Os nomes existentes `x-rapidapi-key` e `x-rapidapi-host` também são aceitos para compatibilidade com a configuração atual. Prefira os nomes em maiúsculas para novas instalações. Se ambos existirem, `RAPIDAPI_*` tem precedência. O host é validado contra o único provedor permitido; não aceita destinos arbitrários.

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

O `externalId` não é o UUID da tabela local `exercises`. Nesta etapa não há importação, associação automática aos 12 exercícios locais ou gravação no Neon. Não enviar esse identificador externo para FKs das fichas. Essa associação deverá ser modelada quando forem definidos os direitos de persistência e o fluxo de seleção.

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

O endpoint de catálogo é leitura pública nesta etapa, sem integração de login. Antes da abertura ao público, integrar autenticação e controle de consumo por usuário; o limite retornado pelo fornecedor não equivale a uma proteção distribuída da aplicação. A rota não fornece acesso a dados privados do Neon.

## Desenvolvimento e testes

```bash
npm run dev:full
npm run test:backend
npm run build
```

`npm run dev:full` exige Vercel CLI atual e projeto vinculado. Use a porta mostrada no terminal para chamar `/api/catalog?resource=bodyparts`. O comando Vite isolado não executa as funções.

Os testes usam respostas simuladas para não gastar cota: validação de entrada, normalização, paginação, mídias, proteção da chave, falhas/timeout e comportamento HTTP. A conexão real foi conferida separadamente com a chave local.

## Referências

- [Quickstart do fornecedor](https://docs.ascendapi.com/quickstart/overview)
- [OpenAPI ExerciseDB V2](https://docs.ascendapi.com/api-reference/exercisedb-v2/exercisedb-v2.json)
- [Política de cache e URLs de mídia](https://docs.ascendapi.com/guides/caching)

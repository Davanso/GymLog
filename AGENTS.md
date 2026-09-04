# Orientações do GymLog

- Evitar código duplicado e funções com responsabilidades misturadas. Reutilizar lógica comum quando houver repetição real, sem criar abstrações desnecessárias.
- Manter handlers HTTP, integração com provedores e acesso ao banco separados.
- Nunca expor credenciais no frontend, logs, testes ou arquivos versionados.
- Preservar migrations já aplicadas, inclusive sua formatação: o runner verifica checksums. Mudanças de schema exigem uma nova migration.
- Ao terminar alterações no projeto, executar `npm run fmt`. Corrigir falhas de formatação antes de entregar.
- Rodar as verificações relevantes para o comportamento alterado e manter a documentação correspondente atualizada.

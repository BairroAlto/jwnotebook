# Gmail no NotaBook

A ferramenta usa OAuth 2.0 e a Gmail API em modo somente leitura. A ligação da conta fica associada ao utilizador do NotaBook e pode ser restaurada depois de fechar e reabrir o navegador. Os emails ficam apenas na memória do navegador; a nota guarda somente `gmailPreferencias`.

## Activação no Google Cloud

1. Activa a **Gmail API** no projecto Google associado ao NotaBook.
2. Adiciona o scope `https://www.googleapis.com/auth/gmail.readonly` ao ecrã de consentimento OAuth.
3. Em **Google Auth Platform → Clientes**, cria um cliente **Aplicação Web**.
4. Adiciona `https://notabook.site` e os endereços locais usados no desenvolvimento às origens JavaScript autorizadas.
5. Coloca o Client ID criado em `GOOGLE_GMAIL_CLIENT_ID` em `gmail-config.js`.
6. No Worker Cloudflare, configura os secrets `GOOGLE_GMAIL_CLIENT_ID` e `GOOGLE_GMAIL_CLIENT_SECRET` com o mesmo cliente OAuth.
7. Gera uma chave aleatória de 32 bytes em Base64 e guarda-a no secret `GMAIL_TOKEN_ENCRYPTION_KEY` do Worker.
8. Executa `cloudflare/gmail.sql` na D1 (o Worker também cria as tabelas automaticamente quando recebe o primeiro pedido Gmail).
9. Para publicação pública, conclui a verificação OAuth pedida pela Google para este scope restrito.

A ferramenta usa Google Identity Services directamente. Assim, cada utilizador pode escolher qualquer conta Google, sem ligar ou substituir a conta usada no login Firebase. O código de autorização é trocado no Worker; o `refresh token` é cifrado antes de ser guardado na D1. Nunca coloques um client secret no frontend.

## Limites e privacidade

- Até 100 mensagens completas por utilizador e por dia, controladas no Worker e reflectidas localmente na interface.
- Pedidos em lotes de cinco para evitar picos de quota.
- Cache em memória durante dois minutos.
- O access token é usado apenas no Worker e renovado automaticamente através do refresh token cifrado.
- Nenhum remetente, assunto, excerto ou conteúdo de email é persistido na nota.

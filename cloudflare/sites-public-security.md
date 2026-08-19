# Segurança dos Sites públicos

A página pública não lê o Firestore directamente. O navegador chama apenas
`GET /sites/{notaId}` no Worker `notabook-storage`. O Worker lê o snapshot com
uma credencial de servidor, valida o plano actual em D1 e devolve somente os
campos públicos permitidos.

## Secrets necessários no Worker

Configura estes valores no Cloudflare Workers → Settings → Variables and
Secrets. A chave privada deve ser um Secret e nunca deve entrar no Git:

- `FIREBASE_PROJECT_ID`: `jwnotebook`
- `FIREBASE_CLIENT_EMAIL`: email da conta de serviço Firebase criada para o
  Worker
- `FIREBASE_PRIVATE_KEY`: chave privada PEM dessa conta de serviço

A conta de serviço deve ter apenas permissão de leitura do Firestore, por
exemplo `Cloud Datastore Viewer`. Não uses a chave privada no navegador nem em
`firebase-config.js`.

Se estes secrets não existirem, o Worker responde `503` e não expõe dados. Isso
é intencional: a publicação falha fechada até a leitura segura estar pronta.

## Publicação da correcção

1. Confirma que os três secrets estão configurados no mesmo ambiente do
   Worker.
2. Publica novamente o ficheiro
   [notabook-storage-worker-stripe.js](notabook-storage-worker-stripe.js).
3. Testa um Site activo através do Worker.
4. Publica as regras de [firestore.rules](../firestore.rules). As colecções
   `sites` e `SitesPublicos` deixam de aceitar leituras directas.
5. Abre `sites.html?id=ID_DA_NOTA` e verifica que o pedido vai para
   `/sites/ID_DA_NOTA`, não para a API Firestore.

Um Site activo de um plano permitido deve responder `200`. Um Site inexistente,
desactivado ou cujo proprietário perdeu o plano deve responder `404`. Uma
leitura directa da API Firestore deve responder `403` sem credenciais.

## Limite de pedidos públicos

O Worker cria automaticamente a tabela D1 `public_site_rate_limits` e aplica
limites por IP antes de consultar o Firestore:

- `GET /sites/{id}`: 90 pedidos por minuto;
- `GET /sites/{id}/cover`: 180 pedidos por minuto.

O endereço IP é transformado num resumo SHA-256 antes de ser guardado. Ao
atingir o limite, a resposta é `429` e inclui `Retry-After: 60`.

## Perfis sociais mínimos

Os documentos `users` são privados e só podem ser lidos pelo próprio
utilizador ou por um `ruler`. Amigos, Share e PALCO usam a colecção
`PerfisPublicos`, que contém apenas identidade social mínima e o consentimento
de partilha PALCO. Cada utilizador sincroniza o seu perfil público quando entra
na aplicação.

# Agenda da Nota — configuração de produção

A Agenda usa Firebase Cloud Messaging para entregar notificações Web Push e o
Worker Cloudflare para guardar e processar lembretes. Nenhuma chave privada deve
ser colocada no navegador ou no repositório.

## 1. Firebase Cloud Messaging

1. Ativa a API Firebase Cloud Messaging no projeto `jwnotebook`.
2. Em Firebase Console → Cloud Messaging → Web Push certificates, gera ou
   importa um par de chaves Web Push.
3. Guarda apenas a chave pública no Worker como variável
   `FCM_VAPID_PUBLIC_KEY`.
4. A conta de serviço indicada por `FIREBASE_CLIENT_EMAIL` deve ter a permissão
   mínima necessária para enviar mensagens FCM. Mantém
   `FIREBASE_PRIVATE_KEY` como Secret Cloudflare.

As variáveis Firebase já usadas pelos Sites públicos são reutilizadas:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Opcionalmente, define `APP_ORIGIN=https://notabook.site`. Se não existir, este
é o valor seguro predefinido usado nos links das notificações.

## 2. D1 e publicação do Worker

O Worker cria as tabelas de lembretes automaticamente. Também podes executar
`reminders.sql` na base D1 antes da publicação.

Publica em conjunto, como módulos ES:

- `notabook-storage-worker-stripe.js`
- `reminders-worker.js`

Não publiques apenas o ficheiro principal, porque este importa o módulo de
lembretes.

## 3. Cron Trigger

No Worker `notabook-storage`, adiciona um Cron Trigger:

```text
* * * * *
```

O processamento corre em UTC uma vez por minuto. A data escolhida no browser é
convertida para UTC antes de ser guardada.

## 4. Planos

A feature criada é `ferramenta_agenda_nota`, inicialmente com plano mínimo
`premium`. O painel administrativo pode mudá-la para `free`, `premium` ou
`premium_plus`.

O Worker verifica o plano quando o lembrete é criado e novamente antes do
envio. Uma descida de plano suspende o lembrete com `paused_plan`; não apaga os
dados do utilizador.

## 5. Dispositivos

Cada instalação autenticada regista um identificador local na tabela
`push_devices`. Um dispositivo novo fica desligado por predefinição e só obtém
um token FCM quando o utilizador o liga no popup da Agenda. Terminar a sessão
remove esse dispositivo da conta.

Os registos antigos de `push_subscriptions` são migrados uma única vez e ficam
desligados, para que a escolha das plataformas seja sempre explícita. O token
nunca é devolvido ao navegador quando a lista de dispositivos é consultada.

## 6. Teste mínimo

1. Instala ou atualiza a PWA.
2. Abre uma nota → Opções da Nota → Agenda.
3. Confirma que o dispositivo aparece desligado e liga-o.
4. Agenda um lembrete para alguns minutos depois e autoriza notificações.
5. Fecha a aplicação e confirma a entrega apenas nos dispositivos ligados.
6. Clica na notificação e confirma que abre `index.html?nota=...`.

Em iPhone ou iPad, a aplicação deve estar adicionada ao ecrã principal para
receber Web Push.

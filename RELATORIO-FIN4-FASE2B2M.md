# FIN-4 Fase 2B.2M — Lease temporário e vínculo atômico do recibo

Data UTC: 2026-07-23T18:51:38Z  
Decisão: **LEASE E FLUXO DO RECIBO IMPLEMENTADOS, VALIDADOS E DESARMADOS**

## Causa corrigida

O contrato anterior tornava impossível uma projeção aceita pelo validador chegar
ao adaptador: a projeção exigia allowlist global inativa e o adaptador exigia a
mesma allowlist ativa.

O novo contrato mantém a allowlist global obrigatoriamente `active=false` e
autoriza o único gate por uma `allowlistLease` assinada, curta, explícita e
vinculada ao envio. Allowlist global ativa, ausência de lease ou lease
divergente são estados fail-closed.

## Arquitetura

### Allowlist lease

Schema sanitizado:

- `schemaVersion`, `domain`;
- `leaseId`, `gateId`;
- `projectionId`, `projectionDigest`;
- `approvalId`, `approvalRevision`;
- `correlationId`;
- `senderSuffix`, `recipientSuffix`;
- `templateHash`;
- `evidenceId`, `evidenceHash`;
- `issuedAt`, `notBefore`, `expiresAt`;
- `maxUses`, `usedCount`, `state`;
- `nonce`, `digest`, `hmac`.

Domínio HMAC: `FIN4_ALLOWLIST_LEASE_V1`. TTL máximo: 300 segundos.
Estados: `LEASED_ACTIVE`, `RESERVED`, `CONSUMED`, `EXPIRED`, `REVOKED`.

### Consumo canônico XPDCNET

O endpoint loopback continua em
`127.0.0.1:3036/v1/fin4/canonical-consumptions`.

Uma transação MongoDB faz:

1. match explícito da lease por ID, digest, estado, usedCount, maxUses e prazo;
2. transição da lease para `CONSUMED`, usedCount=1;
3. match explícito da aprovação por ID, revisão, estado, usedCount, maxUses e
   prazo;
4. transição da aprovação para `CONSUMED`, usedCount=1;
5. persistência do receiptId, requestDigest e evento de auditoria.

Qualquer falha aborta os dois documentos. Resultado de commit ambíguo produz
`CONSUMPTION_REVIEW_REQUIRED`, sem nova tentativa.

### Projeção e recibo no chatbot

Estados da projeção:

- `VALIDATION_ONLY`;
- `EXECUTABLE_AVAILABLE`;
- `BOUND_TO_RECEIPT`;
- `SPENT`;
- `EXPIRED`;
- `REVOKED`.

Estados do recibo:

- `RECEIVED`;
- `RESERVED_FOR_TRANSPORT`;
- `SPENT`;
- `CONSUMPTION_REVIEW_REQUIRED`.

A ingestão do recibo valida HMAC, TTL e todos os vínculos. Em uma transação, o
recibo é persistido e a projeção passa de `EXECUTABLE_AVAILABLE` para
`BOUND_TO_RECEIPT`. O adaptador só aceita essa projeção com o receiptId
explicitamente vinculado.

Antes do transporte, lease e recibo são reservados por ID exato e transições
atômicas. Após qualquer tentativa, recibo, projeção e cópia local da lease são
finalizados. Replay, concorrência e outro receiptId não encontram predicado
válido.

Rotas locais preparadas:

- `POST /v1/fin4/allowlist-leases`;
- `POST /v1/fin4/canonical-receipts`;
- `POST /v1/fin4/control-projections`;
- `POST /v1/whatsapp/send`.

Todas permanecem protegidas pelos gates existentes; ingestão e envio estão
desabilitados ao final.

## Arquivos modificados

XPDCNET:

- `src/fin4/allowlistLease.js`
- `src/fin4/allowlistLease.test.js`
- `src/fin4/canonicalConsumption.js`
- `src/fin4/canonicalConsumption.test.js`
- `src/fin4/canonicalConsumptionGateway.js`
- `src/models/Fin4AllowlistLease.js`
- `src/models/Fin4CanonicalProjection.js`

Chatbot:

- `src/fin4/allowlistLease.js`
- `src/fin4/canonicalReceipt.js`
- `src/fin4/canonicalReceipt.test.js`
- `src/fin4/controlProjection.js`
- `src/fin4/internalGateway.js`
- `src/fin4/internalGateway.test.js`
- `src/fin4/leaseProjection.test.js`
- `src/fin4/metaAdapter.js`
- `src/fin4/metaAdapter.test.js`
- `src/models/Fin4AllowlistLease.js`
- `src/models/Fin4CanonicalReceipt.js`
- `src/models/Fin4ControlProjection.js`

Backup de rollback: `/tmp/fin4-2b2m-backup-20260723`.

## Validação

- XPDCNET completo: 467 PASS, 0 FAIL.
- Chatbot FIN-4: 61 PASS, 0 FAIL.
- Total: 528 PASS, 0 FAIL.

Casos cobertos:

- allowlist inativa com/sem lease e allowlist ativa sem lease;
- lease válida, expirada, alterada e revogada;
- divergência de partes, template, projeção, correlação e evidência;
- reserva/consumo concorrente;
- consumo conjunto de aprovação e lease;
- falha antes e após persistência e regra de incerteza;
- HMAC/byte/TTL do recibo;
- receiptId ausente, ingestão concorrente e outro receiptId;
- vínculo atômico `BOUND_TO_RECEIPT`;
- reserva concorrente e estados `SPENT`;
- revalidação após restart lógico por ID/digest;
- `VALIDATION_ONLY` não executável;
- falha do transporte fake sem retry;
- zero chamada ao gateway produtivo e à Meta.

Os consumos ocorreram exclusivamente em objetos sintéticos e repositórios
fakes. Nenhum documento de lease, projeção executável ou recibo foi criado no
banco real.

## Deploy

- XPDCNET API: PID `2390018 -> 2399556`, restarts `13 -> 14`.
- Chatbot: PID `2390037 -> 2399606`, restarts `13 -> 14`.
- Admin preservado: PID `2316271`, restarts `6`.
- `unstable=0` nos três.
- PM2: 18 processos; nenhum worker FIN-4.
- `pm2 save`: não executado.
- Nginx, MongoDB, servidor e demais processos não foram reiniciados.

Seis sondas consecutivas retornaram HTTP 200 para API local/pública, Admin
local/público, chatbot, gateway e endpoint canônico. CPU e memória ficaram
dentro do baseline e não houve loop de restart.

## Estado real final

- Aprovação: `AUTHORIZED_NOT_CONSUMED`, usedCount=0, maxUses=1.
- `canonicalConsumption`: ausente.
- Allowlist global: inativa.
- Leases reais XPDCNET/chatbot: 0/0.
- Projeções executáveis reais XPDCNET/chatbot: 0/0.
- Recibos produtivos: 0.
- Projeção anterior: `VALIDATION_ONLY`, activeForSend=false.
- Outbox/executáveis: 0/0.
- Requisições FIN-4 desde o deploy: 0.
- Chamadas gateway/Meta desta fase: 0/0.
- Mensagens FIN-4 reais desta fase: 0.
- Armamento/reserva: ausentes.
- execution/enqueue/worker/WhatsApp: false/false/false/false.
- Kill switch: ativo.
- gateway sendEnabled=false.
- endpoint canônico enabled=false.
- ingestão de recibos=false.
- D-3/D-2 bloqueados.
- Processos temporários residuais: 0.

## Inbound para eventual próximo gate

- Timestamp Meta: `2026-07-23T18:24:25Z`.
- Expiração: `2026-07-24T18:24:25Z`.
- Brasília: `24/07/2026 às 15:24:25`.
- Registro revalidado pelo mesmo ID/fingerprint, sem alteração.
- Na conclusão havia mais de 30 minutos restantes.

Qualquer gate futuro deve revalidar novamente o mesmo registro e todos os
controles imediatamente antes de armar. Esta fase não autorizou envio.

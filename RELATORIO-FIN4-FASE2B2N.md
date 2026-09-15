# FIN-4 Fase 2B.2N — Gate real único com lease e recibo vinculado

Data UTC: 2026-07-23T20:09:18Z  
Decisão: **GATE BLOQUEADO**

## Evidência Meta revalidada

- ID interno selecionado explicitamente: `6a625c5c6bcb70346c64320b`.
- Direção: inbound.
- Origem/destino: finais `4910 -> 7145`.
- Texto: `Teste interno FIN-4.`
- Timestamp bruto Meta: `2026-07-23T18:24:25.000Z`.
- Expiração: `2026-07-24T18:24:25.000Z`.
- Hash sanitizado do waMessageId:
  `3b04ef5068742c700f07db27638ddee8294c45d438a4c2a25b7593bbac1b5260`.
- `reselected=false`.
- Janela válida e com mais de 30 minutos restantes.
- Evidência derivada não foi persistida porque o gate bloqueou antes da primeira
  mutação.

## Testes e pré-gate

- XPDCNET completo: 467 PASS, 0 FAIL.
- Chatbot FIN-4: 61 PASS, 0 FAIL.
- Total: 528 PASS, 0 FAIL.
- Controles canônicos: 3/3.
- Aprovação: `AUTHORIZED_NOT_CONSUMED`, usedCount=0, maxUses=1.
- Allowlist global: active=false.
- Leases/projeções executáveis/recibos: 0/0/0.
- Outbox/executáveis: 0/0.
- Gateway sendEnabled=false.
- Ingestão de recibos=false.
- Endpoint canônico enabled=false.
- Armamento e reserva: ausentes.
- execution/enqueue/worker/WhatsApp=false.
- Kill switch ativo; D-3/D-2 bloqueados.
- PM2: 18 processos, nenhum worker FIN-4, unstable=0.

## Bloqueadores técnicos

### 1. Dependência criptográfica circular

O contrato implantado exige simultaneamente:

- a projeção contém `allowlistLease.digest`, e o digest canônico da projeção
  cobre esse campo;
- a lease contém `projectionDigest`, e o digest canônico da lease cobre esse
  campo.

Assim:

1. gerar a lease requer conhecer o digest final da projeção;
2. gerar o digest final da projeção requer conhecer o digest final da lease;
3. reconstruir qualquer um altera o digest incorporado no outro.

Uma prova sintética confirmou:

- a primeira lease não vincula o digest final da projeção;
- reconstruir a lease com o digest da projeção altera o digest da lease;
- atualizar a projeção com o novo digest da lease altera novamente o digest da
  projeção.

Não existe sequência operacional determinística que produza o par de documentos
aceito pelos dois validadores. Tentar contornar exigiria remover um vínculo do
digest, introduzir um identificador pré-digest estável ou alterar o contrato,
ações não autorizadas durante um gate real.

### 2. Segredo HMAC canônico ausente no XPDCNET API

O endpoint `127.0.0.1:3036` valida e assina usando
`FIN4_INTERNAL_HMAC_SECRET`. A verificação sanitizada do ambiente carregado pelo
XPDCNET API retornou `internalHmacPresent=false`.

O segredo de projeção legado existe, mas possui outro nome e não foi copiado,
impresso ou reutilizado implicitamente. Habilitar o endpoint nessas condições
terminaria em `FIN4_CANONICAL_SECRET_MISSING`.

O chatbot possui suas credenciais necessárias, sem exposição de valores.

## Ações não realizadas

- IDs reais de gate/projeção/lease/request/nonce: 0.
- Evidência persistida: 0.
- Lease real: 0.
- Projeção executável real: 0.
- Item READY/PROCESSING: 0.
- Aprovação consumida: 0.
- Recibo produtivo: 0.
- Restarts: 0.
- Chamadas ao endpoint canônico: 0.
- Chamadas ao gateway: 0.
- Chamadas Meta FIN-4: 0.
- Mensagens FIN-4: 0.
- Duplicidades/retries: 0/0.

## Estado final e estabilidade

- XPDCNET API: PID 2399556, restarts 14, unstable 0.
- Chatbot: PID 2399606, restarts 14, unstable 0.
- Admin: PID 2316271, restarts 6, unstable 0.
- Todos os PIDs e contadores foram preservados.
- PM2 permaneceu com 18 processos.
- `pm2 save` não foi executado.
- Seis sondas consecutivas: API local/pública, Admin local/público, chatbot,
  gateway e endpoint canônico retornaram HTTP 200.
- CPU estabilizada em 0% para API/chatbot; memória dentro do baseline.
- Nenhum erro crítico novo ou loop de restart.

Estado do banco e flags:

- aprovação `AUTHORIZED_NOT_CONSUMED`, usedCount=0;
- `canonicalConsumption` ausente;
- allowlist global inativa;
- leases/projeções executáveis/recibos 0/0/0;
- outbox/executáveis 0/0;
- armamento ausente;
- sendEnabled=false;
- ingestão de recibos=false;
- endpoint canônico enabled=false;
- execution/enqueue/worker/WhatsApp=false;
- kill switch ativo;
- D-3/D-2 bloqueados;
- processos temporários residuais 0.

## Próxima correção necessária

Em uma fase sem envio real:

1. eliminar a dependência circular usando um binding estável e não circular
   (por exemplo, projectionId + sourceRevision + leaseId), mantendo HMAC e
   vínculos completos;
2. provisionar no XPDCNET API um segredo dedicado compatível com o chatbot, sem
   copiar credencial Meta e sem expor o valor;
3. testar a geração realista do par projeção/lease, não apenas objetos com
   digests arbitrários;
4. exigir novamente autorização e revalidar a janela antes de qualquer gate.

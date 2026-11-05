# Arquivos em quarentena

Estes arquivos foram confirmados como **não referenciados** em `frontend/index.html`
nem em nenhum outro `.html`/`.js` do projeto (auditoria de 2026-08-20).

Cada um tem um substituto ativo que já assumiu a função:

| Arquivo em quarentena | Substituto ativo |
|---|---|
| `pages/create-farm.js` | `pages/create-farm/index.js` |
| `pages/pluviometria.js` | `pages/pluviometria/index.js` |
| `pages/estacao/index.js` | `pages/estacoes/index.js` |
| `pages/estacao/view.details.js` | `pages/estacoes/view.details.js` |
| `dropdown.js` | (sem substituto direto identificado — órfão puro) |

**Regra:** se depois de um tempo em produção nada quebrar, apagar de vez.
Se algo quebrar, o arquivo está aqui pra restaurar rápido (`git mv` de volta).

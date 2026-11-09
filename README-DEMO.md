# Irricontrol · Fazenda Demo

Versão demo da platform-design. A fazenda começa **vazia** (sem central, sem pivôs, sem carretéis). Você cria tudo e simula na hora.

## Como rodar

**Opção 1: servidor Node (porta 3100)**
```bash
npm run setup     # só na 1ª vez
npm start         # abre em http://localhost:3100
```

**Opção 2: qualquer servidor estático**
```bash
npx serve frontend          # ou: python -m http.server 8080 --directory frontend
```

**Opção 3: Netlify.** O `netlify.toml` já publica a pasta `frontend`.

> A demo não usa backend. Tudo que você cria fica salvo no **localStorage do navegador**.
> Por isso ela roda em outra porta (3100) e não mistura dados com a plataforma (3000).

## O que está liberado

| Sidebar | Status |
|---|---|
| Visão Geral | ✅ liberado |
| Pluviometria | ✅ liberado |
| Operações, Conectividade, Notificações, Relatórios, Telemetria, Monitoramento | 🔒 "em breve" (não abre nem com Ctrl+D) |
| Configurações, Assinatura, Área do Parceiro | 🔒 bloqueados |
| ↺ (último botão do rodapé) | **Resetar demo** → apaga tudo e volta à fazenda vazia |

O card da fazenda (lista de equipamentos + **Criar equipamento**) funciona normalmente.

## Roteiro da demo

1. **Central:** lápis ✏️ no card → *Editar fazenda* → **Geral**: digite o rádio da central → **Localização**: coordenadas da central → *Salvar*. A central aparece no mapa.
2. **Pivô:** *Criar equipamento* → SmartConnect/Nexus (ou SmartTouch) → posiciona centro e raio → avança até *Finalizar*.
3. **Carretel:** *Criar equipamento* → Carretel → nova etapa **Localização**: 1º clique = carretel, 2º clique = início do carrinho (dá pra arrastar) → *Finalizar*.
4. **Simular:**
   - **Pivô:** clique no pivô → *Iniciar Pivô* (modal de operação), ou use a barra de simulação (🧪 no rodapé do mapa) e escolha o status.
   - **Carretel:** clique no carretel → *Iniciar Carretel* → informe a velocidade → *Iniciar*. Ou pela barra 🧪: status **Irrigando**.
     O carrinho é recolhido até o carretel: a faixa fica azul (irrigada) e o restante segue laranja. No fim, o sensor de parada atua (Stand-By). O botão ⏮ no card da barra volta o carrinho para o início.
     Aceleração: 1 s na tela = ~17 min reais (400 m a 18,8 m/h ≈ 77 s).
   - Velocidade do pivô na simulação: 3 min por volta a 100% (`REAL_LAP_MS_AT_100` em `assets/js/simulation.js`).

## O que mudou em relação à platform-design

- `assets/js/api-config.js`: modo 100% estático (localStorage).
- `data/farms.json` / `frontend/data/farms.json`: só a "Fazenda Demo", vazia.
- `index.html`: itens bloqueados na sidebar, botão Resetar demo, novos scripts/CSS.
- **Novo** `assets/js/demo.js` + `assets/css/demo.css`: reset e ajustes visuais.
- **Novo** `assets/js/demo-carretel-sim.js`: motor de simulação do carretel.
- **Novo** `assets/js/pages/equipamentos/rainstar-location.js`: etapa Localização do carretel.
- `create-equipment.js`: carretel ganhou a etapa Localização.
- `simulation.js`: barra de simulação lista os carretéis também.
- `carreteis/index.js`: *Iniciar* e *Desligar Carretel* acionam a simulação.
- `mapa.js`: mapa centraliza na fazenda quando ela está vazia; central da fazenda aparece na Visão Geral.
- `mapa.js`: **animação sem travar**: na simulação só o braço/faixa do pivô e a faixa/carrinho do carretel são atualizados (~20 fps). O mapa não é redesenhado inteiro a cada quadro: nada pisca, o balão continua aberto e atualizando, e o movimento não para com o mouse parado em cima do mapa.
- `fazenda-edit`: rádio da central editável; corrigido o painel que abria com o nome em branco.
- `pluviometria/core.data.js`: sem o pluviômetro de teste injetado.
- Semente do `farms.json` não sobrescreve mais o que foi criado (só vale na 1ª visita).


## Atualização 09/11/2026 — dados coerentes em todas as telas

- **Novo** `assets/js/core/demo-history.js` (`window.IcDemoHistory`): motor único de histórico fictício.
  Cada equipamento criado já nasce com ~400 dias de histórico (determinístico pelo id, datas relativas a hoje):
  operações, eventos, consumo, energia por posto tarifário, falhas, chuva por pluviômetro, nível do medidor etc.
  Detalhes, gráficos, tooltips do mapa e Relatórios leem dessa mesma fonte → os números batem entre si e com o período escolhido.
- Detalhes ligados ao motor: Pivô (SmartConnect/Nexus), SmartTouch, LineStar, Bomba, Medidor de nível, Carretel,
  Pluviômetro + tela de Pluviometria, Estação meteorológica e Cosmofield (KPIs, histórico paginado, gráficos, última comunicação).
- **Relatórios da Fazenda**: listas e tabelas montadas só com os equipamentos criados na fazenda
  (`assets/js/pages/relatorios/demo-data.js`); relatório de **Pluviometria removido**.
- **Configurações › Preferências › Navegação**: os seletores de ação abrem **pra cima** (não cortam mais no fim da tela).
- Responsividade: pizzas de consumo, barras diárias, eixo de datas do gráfico de tensão, cabeçalho dos detalhes e
  indicadores/tabelas dos relatórios se ajustam a telas menores.

---
Deploy atualizado em 2026-11-05 16:38.

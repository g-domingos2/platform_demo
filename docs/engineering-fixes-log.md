# Correções de engenharia — log de execução

A partir de 2026-09-11, o trabalho passou a ser guiado exclusivamente por correções reportadas pela engenharia (bugs/ajustes já validados por quem testa a plataforma), um item por vez. Este documento é o log dessas correções — cada entrada registra o pedido original, o que foi feito, a validação executada e o resultado.

Regra combinada com o usuário: tudo que for feito e validado deve ser commitado e enviado ao git (`origin/main`) assim que a rodada de itens correlatos estiver concluída — não fica trabalho pendente sem subir.

## 2026-09-11 — Medidor de Nível (Level Meter): create wizard

Pedido da engenharia (via prints da tela "Create equipment - Level Meter"):

1. Em Localização, o pin do mini-mapa só definia posição por clique — precisa aceitar arrastar (drag-and-drop). Mesmo bug reportado na Repetidora.
2. No passo 3 (Ficha Técnica), o título aparecia em PT-BR mesmo com o idioma ativo em EN.
3. No passo 3: trocar o campo "Meter name" (`Nome do medidor`) para "Equipment name" (`Nome do equipamento`); remover o campo "System name" (`Nome do sistema`); remover o título "Ficha Técnica" de dentro do conteúdo do passo.
4. No passo 5 (Bombas Vinculadas / Linked Pumps), o texto de explicação do banner informativo aparecia em PT-BR mesmo em EN.
5. No passo 5, a lista de seleção de bombas fechava a cada clique, obrigando reabrir pra cada bomba adicional — precisa continuar aberta até o usuário fechar manualmente (clicar fora ou no botão).
6. (Adicional, mesma rodada) Nos campos de Valor mínimo/máximo (passo Nível), o texto informativo trata o desligamento automático de bombas como se fosse sempre válido — mas esse comportamento só existe na versão 5.3 (GH); a 5.2 não tem bombas vinculadas. Pedido: atualizar os textos pra refletir essa condição.

Feito em `frontend/assets/js/pages/equipamentos/medidor.js`:

- `initMiniMap`: marcador do mini-mapa criado com `draggable: true`; novo helper `setPoint(lat, lng)` compartilhado entre o clique no mapa e o novo handler `marker.on("dragend", ...)`, evitando duplicar a lógica de atualizar input/state.
- `renderConfigStep` (passo 3): removido o `<h3>Ficha Técnica</h3>` interno; removido o campo `Nome do sistema` (`mdCfgSysName`) inteiro; campo `Nome do medidor` renomeado para `Nome do equipamento` — reaproveita a chave de tradução já existente `"Nome do equipamento": "Equipment name"` (usada pelo Carretel), sem precisar de entrada nova no dicionário. Grid do topo do passo passou de 3 para 2 colunas (Nome do equipamento + Versão).
- `readConfigStep`/`validateConfigStep`: removida a leitura/validação de `sysName`.
- `renderBombasStep` (passo 5): o clique numa opção da lista não fecha mais o menu (`closeMenu()` removido do handler de seleção, mantendo apenas `renderChips()`/`renderMenu()`/`positionMenu()`); o menu continua fechando normalmente ao clicar fora ou no próprio botão de seleção (comportamento já existente, não tocado). Alerta de limite (`Você pode vincular no máximo 10 bombas.`) agora passa por `t()` — antes era uma string solta em `alert()`, que não é varrida pelo scanner de DOM do i18n.
- `renderNivelStep`: textos do banner "Configurações de Gráfico" e do tooltip do campo "Valor máximo" agora variam conforme `state.version` (`isGH = state.version === "5.3"`): a versão GH menciona explicitamente que atingir o valor desliga as bombas GH vinculadas; a 5.2 (sem bombas vinculadas) menciona só a referência visual do gráfico, sem prometer um desligamento que essa versão não tem.
- Novo helper `const t = (text) => window.IcI18n?.t?.(text) ?? text;` adicionado ao arquivo (não existia nenhum uso de i18n em JS puro nesse arquivo até agora, só tradução via varredura de DOM).

Feito em `frontend/assets/js/pages/equipamentos/repetidora.js`:

- Mesmo padrão de drag-and-drop: marcador criado com `draggable: true` e `marker.on("dragend", ...)` chamando o `setPoint(lat, lng, false)` já existente (reaproveitado, sem duplicar lógica).

Feito em `frontend/assets/js/i18n/dict.js` / `dict.es.js`:

- Adicionadas as traduções que faltavam: texto completo do banner do passo "Bombas Vinculadas" (`Nesta aba você pode vincular...`), `Você pode vincular no máximo 10 bombas.`, `Desvincular` (atributo `title` do botão de desvincular cada chip).
- Adicionadas as duas variantes novas de texto do passo Nível (GH e não-GH) tanto pro banner quanto pro tooltip do "Valor máximo".
- Removida a entrada agora órfã `"Valor máximo percentual desejado do nível máximo do reservatório. Uma vez atingido esse valor, o Medidor de nível desligará as bombas associadas."` (texto antigo, incondicional, que não é mais gerado por nenhum lugar do código).

**Sobre o item 2 (título "Ficha Técnica" em PT no breadcrumb do passo 3):** investigado a fundo — o breadcrumb (`create-equipment.js`, função `renderSteps`) já chama `tCe("Ficha Técnica")`, e `dict.js` já tem `"Ficha Técnica": "Technical Sheet"` registrado (confirmado byte a byte, sem divergência de acentuação/encoding entre os dois arquivos, e sem chave duplicada no dicionário). Não encontrei nenhum caminho de código que explique o texto aparecer sem tradução — o mecanismo está correto e a tradução já está no `main`. A suspeita mais provável é que o print da engenharia foi tirado antes dessa entrada existir no dicionário, ou por cache do navegador/CDN do GitHub Pages. Nenhuma mudança de código foi feita pra esse item específico por não haver bug localizável; pedido para a engenharia reconferir depois deste deploy e, se persistir, reabrir com um print novo.

Validação executada:

```bash
node --check frontend/assets/js/pages/equipamentos/medidor.js
node --check frontend/assets/js/pages/equipamentos/repetidora.js
node --check frontend/assets/js/i18n/dict.js
node --check frontend/assets/js/i18n/dict.es.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, HTTP 200 nos quatro arquivos na instância local (porta 3000).

Pendência: validação visual manual no navegador (arrastar o pin em Medidor e Repetidora; trocar idioma pra EN e conferir os passos 3/5; selecionar múltiplas bombas sem a lista fechar; trocar versão 5.2/5.3 e conferir os dois textos do passo Nível).

## 2026-09-11 — Estação Meteorológica: aba "Geral" (dashboard) escondida atrás de Ctrl+D

Pedido do usuário: a aba `Geral` da Estação (dashboard estilo Cosmofield — Dashboard/Leituras/Previsão, construído em sessões anteriores) não deve fazer parte do fluxo normal de create/config por enquanto. A decisão da engenharia é que a Estação segue o mesmo padrão dos demais equipamentos — uma tela de **create+config** simples, e **separadamente** uma tela de **Detalhes** de verdade (cockpit, no padrão Pivô/Bomba/Carretel). Como a tela de Detalhes ainda não existe, o conteúdo da aba Geral não pode ser perdido (vai virar a base dela), mas também não pode continuar aparecendo pro usuário comum.

Solução: aba `Geral` escondida atrás do atalho de dev features já existente no app (Ctrl+D), em vez de apagada. Aba `Configurações` passou a ser a aba padrão/ativa ao abrir a tela.

Feito:

- `frontend/pages/estacao-meteorologica.html`: botão da aba `Geral` e seu painel (`[data-tab-body="general"]`) marcados com `data-dev-only` + `is-hidden` por padrão; `is-active`/`aria-selected` movidos da aba `Geral` pra aba `Configurações`.
- `frontend/assets/js/app.js`: o mecanismo de Ctrl+D que já existia (liga/desliga `window.__icDevFeaturesOn`, usado hoje por `.nav__badge--soon` e `#btnWeeklySchedule`) ganhou um terceiro alvo genérico — qualquer elemento com `[data-dev-only]` tem a classe `is-hidden` alternada junto, tanto no toggle inicial quanto no handler de `keydown`. Generalizei pra `[data-dev-only]` (em vez de mais um `getElementById` hardcoded) porque a Estação carrega dinamicamente dentro de `#pageSlot`, então qualquer tela futura que precise do mesmo esconderijo reaproveita sem tocar em `app.js` de novo.
- `frontend/assets/js/pages/estacoes/view.details.js`: `showDetailsView` — aba padrão ao abrir mudou de `"general"` pra `"config"` (só abre em `"general"` se explicitamente pedido via `options.tab`). `activateTab()` reaplica o toggle `[data-dev-only]` a cada chamada, porque a tela da Estação é montada dentro de `#pageSlot` *depois* do toggle inicial do `app.js` rodar — sem isso, quem já tinha Ctrl+D ligado antes de abrir a Estação veria a aba escondida mesmo assim.

Validação executada:

```bash
node --check frontend/assets/js/pages/estacoes/view.details.js
node --check frontend/assets/js/app.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, HTTP 200 em `estacao-meteorologica.html`, `estacoes/view.details.js` e `app.js`.

Pendência: validação visual (abrir Estação — deve abrir direto em Configurações, sem a aba Geral visível; apertar Ctrl+D — aba Geral deve aparecer e funcionar normalmente; apertar Ctrl+D de novo — some).

### Próximo passo combinado com o usuário (ainda não iniciado): tela de Detalhes da Estação

Construir uma tela de Detalhes nova e separada pra Estação Meteorológica, no padrão cockpit já usado por Pivô/Bomba/Carretel (`.pincard`, `.pivo-agenda` com filtro de data, KPIs, card de histórico, card de gráfico) — reaproveitando o conteúdo hoje escondido na aba `Geral`:

- O conteúdo de **Leituras** (hoje sub-aba dentro de Geral) entra na posição onde hoje fica o card de **Histórico** nas outras telas de detalhes.
- O **gráfico** (Temp/Umidade/Vento/ETo/Chuva/Radiação/Bateria, já construído no padrão Cosmofield) entra na posição onde hoje fica o card de **Gráfico de Consumo**.
- KPIs/indicadores e filtro de data seguem o padrão visual já usado (`.pincard__kpis`, `.pivo-agenda`).
- Arquivo novo, copiado da estrutura de uma tela de detalhes existente (ex.: `bomba.details.html`/`carretel.details.html`) mas com nome e classes próprias prefixadas `weatherstation-` (não `estacao-`/`estd-`, que já são usados pela tela de create/config, e não `pivo-`/`bmbd-` genérico) — objetivo explícito do usuário: evitar repetir o incidente desta sessão em que uma mudança no CSS compartilhado de um equipamento quebrou (ou foi quebrada por) outro, por nomenclatura ambígua.
- Ainda não iniciado — combinado registrar aqui antes de começar a construção, dado o tamanho da tarefa (equivalente à construção completa das telas de detalhes do Carretel feita mais cedo nesta sessão).

## 2026-09-11 — Estação Meteorológica: aba "Localização" (somente leitura) na Configurações

Pergunta da engenharia, respondida e implementada na mesma rodada: confirma-se que o **create** da Estação não precisa (e não deve ter) etapa de Localização — a posição vem automática da plataforma Davis junto com as leituras, decisão já tomada e implementada em sessão anterior (`ESTACAO_STEPS = ["Equipamento", "Ficha Técnica"]`, sem step de mapa).

Na **Configurações** (aba `config`), porém, faltava uma seção "Localização" pra visualizar (não editar) onde a Davis está reportando a estação — pedido explícito, com print de referência de outro equipamento (Repetidora) mostrando o padrão visual esperado: nav lateral `Geral | Localização`, mapa + campo de coordenadas. Diferença combinada: pra Estação esse campo é **somente informativo** (sem botão "Obter Localização", sem edição), já que o dado vem automático.

Feito:

- `frontend/pages/estacao-meteorologica.html`: novo item de nav lateral `Localização` (`data-target="#wsEditLocation"`) ao lado de `Ficha Técnica`, dentro da aba Configurações. Nova seção `#wsEditLocation` com mapa somente-leitura (`.equip-mini-map`, mesma classe usada no create do Medidor/Repetidora) + campo `Localização do equipamento` com `readonly` (sem ação de limpar/editar) + texto explicando que o valor vem automático da Davis.
- `frontend/assets/js/pages/estacoes/view.details.js`:
  - `renderConfigForm()` agora também preenche `#wsEditLocationCoords` com as coordenadas atuais do equipamento (ou `—` se não houver).
  - Nova `renderLocationMap()`: mapa Leaflet sem nenhuma interação (`dragging`/`scrollWheelZoom`/`doubleClickZoom` desligados, sem clique-pra-mover), com o marcador padrão da plataforma (`pinIcon()`) na posição atual — só pra conferência visual, não editável. Renderiza sob demanda (quando o usuário clica em "Localização"), porque o Leaflet precisa do container já visível pra medir certo.
  - Handler de navegação lateral (`data-target`) ganhou o terceiro caso: `#wsEditLocation` → `renderLocationMap()`.
  - `destroyDetailsView()` agora chama `destroyMinimap()` e destrói `locationMapInstance` explicitamente — nenhuma das duas coisas acontecia antes (o minimapa da Geral tinha o mesmo bug de instância Leaflet "fantasma" já corrigido no Carretel nesta sessão; corrigido aqui também, de graça, por estar mexendo na mesma função).

Validação executada:

```bash
node --check frontend/assets/js/pages/estacoes/view.details.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, tags `<section>`/`<div>` de `estacao-meteorologica.html` conferidas em par (10/10 e 117/117), HTTP 200 em `estacao-meteorologica.html` e `estacoes/view.details.js`.

Pendência: validação visual (abrir Configurações → Localização e conferir que o mapa centraliza no pin certo, sem permitir arrastar/clicar; conferir que o campo de coordenadas bate com o que aparece no mapa principal da fazenda).

## 2026-09-11 — Estação Meteorológica: tela de Detalhes (construída)

Trabalho combinado na entrada "Estação Meteorológica: aba Geral escondida" acima. Tela nova e separada de create+config, no padrão cockpit de Pivô/Bomba/Carretel, com **Leituras** na posição do card de Histórico e o **gráfico** na posição do Gráfico de Consumo (Previsão ficou de fora desta rodada, por decisão do usuário). Clicar numa estação no mapa/lista agora abre esta tela; "Editar" continua abrindo o painel de create+config de sempre.

Arquivos novos:

- `frontend/pages/weatherstation.details.html` — `#weatherstationPanel`, estrutura `.pincard` (minimapa, status, título, seletor, 4 KPIs principais: Temperatura/Umidade/Vento/ETo hoje, botão Editar) → `.weatherstation-agenda` (filtro de período, popover compartilhado `js-period-trigger`) → card `.weatherstation-kpis` com os 3 indicadores restantes (Radiação/Chuva hoje/Última transmissão) → `.weatherstation-bottom-row` com `.weatherstation-history` (Leituras, tabela densa paginada) e `.weatherstation-mini-chart` (Temperatura x Umidade).
- `frontend/assets/js/pages/estacoes/weatherstation-details.js` — `window.IcWeatherStationDetails.open({ estId, fromMap })`/`.close()`/`.renderData()`. Minimapa e seletor de estação copiados do padrão do Carretel (mesma correção de mapa "fantasma" já aplicada lá — reaproveita a instância só quando o container bate). Tabela de Leituras e paginação reaproveitam o mock de leituras horárias (`Est.data.ensureHourly`) já usado pela aba Geral escondida. Gráfico Temperatura x Umidade em SVG simples (grade, rótulos, tooltip nativo via `<title>`), no mesmo espírito visual do Horímetro/Vazão feito pro Carretel antes nesta sessão — sem o motor de zoom/navegador do dashboard escondido, que fica guardado pra outro momento.

Arquivos alterados:

- `frontend/assets/js/pages/estacoes/view.details.js`: `Est.data` ganhou `getEstacoesList`/`getFocusEst`/`normalizeEst`/`ensureHourly`/`fetchWeather`/`readCache`/`todayIsoSp` expostos — é lógica pura de dados (sem DOM/CSS), então compartilhar não reintroduz o risco de acoplamento visual que motivou renomear pra `weatherstation-*`; evita também duas fontes de verdade pro mesmo mock de leituras entre a aba Geral escondida e a tela de Detalhes nova.
- `frontend/assets/js/pages/estacoes/index.js`: `IcEstacaoDetails.open()`/`.close()` agora apontam pra `window.IcWeatherStationDetails` em vez do painel de create+config. `IcEstacaoEdit` não muda — continua abrindo `estacao-meteorologica.html` na aba Configurações.
- `frontend/index.html`: registrado `./assets/js/pages/estacoes/weatherstation-details.js`.
- `frontend/assets/css/pages/pivos.css`: nova seção "Estação Meteorológica — tela de Detalhes" ao final do arquivo — 74 regras (claro + escuro) duplicadas de `pivo-card-container`/`pivo-right-column`/`pivo-selector*`/`pivo-agenda*`/`pivo-data-card*`/`pivo-history__table*`/`pivo-history__pagination`/`pivo-bottom-row`/`carretel-kpis`/`carretel-kpi`/`bmbd-mini-chart*` sob o prefixo `weatherstation-*`, mais media queries reconstruídas à mão (a extração automática perde o wrapper de `@media` — mesmo cuidado já tomado no rename da Bomba) e um bloco novo `.weatherstation-axis-svg`/`.weatherstation-axis-label`/`.weatherstation-axis-title` pro gráfico. Nenhuma regra `pivo-*`/`carretel-*`/`bmbd-*` existente foi alterada — só inserção, zero efeito colateral em Pivô/Carretel/LineStar/Bomba.

Achado à parte, registrado mas não alterado: durante esta tarefa percebi que `carretel.details.html`/`carreteis/index.js` não usam mais a implementação de gráfico em SVG (`renderAxisChart`/`.carretel-axis-svg`) que eu tinha construído mais cedo nesta sessão — em algum commit posterior (provavelmente da mesma ferramenta externa do incidente da Bomba) o gráfico do Carretel foi reescrito pra uma implementação em `<div>` (`.carretel-bar-chart`/`.carretel-line-chart`, com tooltip interativo por hover). O resultado atual parece funcional e já usa nomenclatura própria do Carretel (não `pivo-`/`bmbd-`), então não mexi nisso — só registro aqui pra não gerar confusão caso o `renderAxisChart` seja procurado depois e não seja mais encontrado.

Validação executada:

```bash
node --check frontend/assets/js/pages/estacoes/weatherstation-details.js
node --check frontend/assets/js/pages/estacoes/index.js
node --check frontend/assets/js/i18n/dict.js
node --check frontend/assets/js/i18n/dict.es.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, chaves CSS balanceadas, tags `<article>`/`<div>`/`<section>` de `weatherstation.details.html` em par (5/5, 40/40, 1/1), HTTP 200 em todos os arquivos novos/alterados. Grep confirmou zero classe `pivo-*`/`bmbd-*`/`cf-*` remanescente em `weatherstation.details.html` e na nova seção do CSS; em `weatherstation-details.js` só sobraram `is-pivo-details`/`is-pivo-details-only` (flag de body compartilhada, justificada) e uma menção em comentário.

Pendência: validação visual manual completa (abrir uma estação pelo mapa, conferir KPIs/minimapa/seletor/tabela de Leituras/paginação/gráfico, trocar de estação pelo seletor, clicar Editar e confirmar que abre a Configurações da estação certa, luz e escuro, desktop e mobile). Previsão (cards de clima) fica pendente pra uma próxima rodada, por decisão do usuário.

## 2026-09-11 — Estação: ajustes finos da tela de Detalhes (KPIs, indicadores do período, export CSV, gráfico fiel ao dashboard escondido)

Feedback do usuário depois de ver a tela de Detalhes rodando, com prints. Quatro pedidos:

1. **Pincard (posição do 1º print)**: mostrar os 6 indicadores — Temperatura, Umidade, Vento, Radiação, ETo, Chuva — em vez de só 4 (Temp/Umidade/Vento/ETo). `.pincard__kpis` já suporta isso de graça (`grid-template-columns: repeat(4, auto)` quebra pra 2ª linha sozinho, e já existe `:nth-child(n+4) { margin-top }` pra esse caso). Ícones adicionados: `fa-sun` (Radiação), `fa-cloud-rain` (Chuva).
2. **Card "indicadores" (posição do 2º print)**: virou uma linha densa só, no visual exato do `.cf-stats` do dashboard escondido (rótulo pequeno maiúsculo + valor embaixo, divisores verticais finos) — só que renomeado `.weatherstation-stats*` (mesmo motivo de sempre: `.cf-stats` é compartilhado com o Cosmofield). Os 7 itens (Temperatura/Umidade/Vento/Radiação/ETo/Chuva/Última transmissão) agora mostram **acumulado do período selecionado no filtro de data** (média pra Temp/Umidade/Vento/Radiação, soma pra ETo/Chuva), não mais o valor instantâneo de "hoje".
3. **Tabela de Leituras**: a contagem ("N leituras") saiu do cabeçalho e foi pro rodapé esquerdo da tabela, ao lado de um novo botão "Exportar CSV" (baixa todas as leituras mockadas em CSV) — a paginação continua no rodapé direito, agora os dois dividindo a mesma linha de rodapé (`.weatherstation-history__foot`).
4. **Gráfico Temperatura x Umidade**: reescrito do zero pra bater exatamente com o gráfico da aba "Geral" escondida da própria Estação (`chartDrawMain`, em `estacoes/view.details.js`) — grade horizontal (5 divisões, `#eef2f7`), dois eixos à esquerda (Temperatura por dentro, Umidade por fora, cada um com rótulos na cor da própria série), linhas sólidas `stroke-width:1.8`, linha-guia + pontos + balão de tooltip acompanhando o cursor (`.weatherstation-tip*`, duplicado de `.cf-tip*`). Restrito às duas séries pedidas, sem o motor de zoom/navegador interno — o filtro de período da tela (`.weatherstation-agenda`) já cumpre esse papel.

Corrigido de quebra (achado ao implementar o item 4, mas afeta o app inteiro): `feature.periodPicker.js` atualizava o rótulo do botão de período só se ele tivesse a classe exata `.pivo-agenda__period-label` — como Bomba já usa `.bmbd-agenda__period-label` (rename desta sessão) e agora a Estação usa `.weatherstation-agenda__period-label`, o rótulo desses dois nunca era atualizado ao escolher um período no popover (bug pré-existente na Bomba, nunca detectado por falta de teste visual). Trocado o seletor pra `.js-period-trigger span` — sempre há exatamente um `<span>` dentro do gatilho (o outro filho é o ícone), então funciona pra qualquer prefixo de classe sem precisar listar cada equipamento à mão.

Arquivos alterados:

- `frontend/pages/weatherstation.details.html`: pincard com 6 KPIs; card "indicadores" reescrito pra `.weatherstation-stats`; rodapé da tabela de Leituras reestruturado (`.weatherstation-history__foot` com contagem + botão CSV à esquerda, paginação à direita).
- `frontend/assets/js/pages/estacoes/weatherstation-details.js`: `renderPeriodStats()` (novo, indicadores acumulados do período), `renderTempHumidityChart()` reescrito (dual-axis fiel ao dashboard escondido, com `getSelectedPeriodRange()`/`rowsInPeriod()` reaproveitando o filtro de data), `exportReadingsCsv()` (novo), listener de `pluv:periodChanged` pra re-renderizar indicadores/gráfico quando o período muda.
- `frontend/assets/js/pages/pluviometria/feature.periodPicker.js`: seletor do rótulo do período generalizado (ver bug acima).
- `frontend/assets/css/pages/pivos.css`: `.weatherstation-kpis`/`.weatherstation-kpi` (não usadas mais) trocadas por `.weatherstation-stats*` (duplicado de `.cf-stats*`); `.weatherstation-axis-label`/`.weatherstation-axis-title` removidas (o novo gráfico usa atributo SVG direto, igual ao original, não classe CSS); `.weatherstation-tip*` nova (duplicado de `.cf-tip*`); `.weatherstation-history__foot`/`__foot-left`/`__export-btn` novas; `.weatherstation-mini-chart` ganhou `position: relative` (necessário pro tooltip se posicionar certo).

Validação executada:

```bash
node --check frontend/assets/js/pages/estacoes/weatherstation-details.js
node --check frontend/assets/js/pages/pluviometria/feature.periodPicker.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, chaves CSS balanceadas, tags `<article>`/`<div>` de `weatherstation.details.html` em par (5/5, 68/68), HTTP 200 em todos os arquivos tocados. Grep confirmou zero classe `pivo-*`/`bmbd-*`/`cf-*` remanescente fora do comentário de topo do arquivo e das flags `is-pivo-details*` (justificadas).

Pendência: validação visual (conferir os 6 KPIs no header, os indicadores do card 2 mudando ao trocar o período no filtro, o botão de exportar CSV baixando um arquivo válido, e o gráfico com o mesmo visual do dashboard escondido — cores dos eixos, tooltip seguindo o cursor). Também não testei em navegador se o fix do `feature.periodPicker.js` corrigiu de fato o rótulo da Bomba (só verificado por leitura de código).

## 2026-09-11 — Estação: mais uma rodada de ajustes na tela de Detalhes (min/máx de temperatura, export CSV reposicionado, ícone da estação no minimapa, gráfico com todas as variáveis + legenda + eixos)

Nova rodada de feedback depois de ver a tela rodando, com prints. Itens, na ordem em que chegaram:

1. **Indicadores — Temperatura**: mostrar média do período, mas também máximo e mínimo.
2. **Exportar CSV**: sair do rodapé (esquerda) e ir pro cabeçalho da tabela de Leituras, à direita — a contagem de leituras ("N leituras") ficou sozinha no rodapé esquerdo, paginação continua à direita do rodapé.
3. **Minimapa**: usar o ícone real da Estação (anemômetro/cata-vento, o mesmo do marcador no mapa principal), não mais o pin genérico verde.
4. **Gráfico**: mostrar todas as variáveis de leitura, igual ao dashboard escondido — não só Temperatura/Umidade.
5. (Complementar) Clique na legenda liga/desliga cada série; replicar também os eixos (múltiplos, por série) que existiam na tela escondida.
6. (Complementar) Remover a informação de "média do período" que aparecia no cabeçalho do card do gráfico.
7. (Complementar) Título do card do gráfico: "Temperatura e Umidade" → **"Gráfico de Clima"**.
8. (Refinamento nos indicadores, depois de ver o resultado) Critério de agregação por variável, descrito na própria label:
   - **Temperatura**: média do período (valor principal) + máx/mín do período (sublinha menor).
   - **Umidade, Vento, Radiação**: última leitura do período (não mais média).
   - **ETo, Chuva**: acumulado (soma) do período — já estava assim, mantido.
   - **Última transmissão**: inalterado.
9. (Refinamento no gráfico) Por padrão, só **ETo** e **Chuva** vêm ativas ao abrir a tela — as demais séries continuam na legenda, e o usuário liga cada uma clicando.

Feito:

- `frontend/assets/js/core/map-icons.js`: novo `weatherStationIcon()` — mesmo SVG de anemômetro usado em `mapa.js:drawWeatherStation`, extraído pra cá pra não duplicar o desenho em dois lugares (mapa principal e minimapa da tela de Detalhes nunca desalinham). `mapa.js` atualizado pra chamar essa função em vez de ter o SVG inline.
- `frontend/assets/js/pages/estacoes/weatherstation-details.js`:
  - `initMinimap()` usa `weatherStationIcon()` em vez de `pinIcon()`.
  - `renderPeriodStats()` reescrita: `tempRange` (min/máx) preenche um novo elemento `weatherstationPeriodTempRange`; Umidade/Vento/Radiação passam a ler `rows[rows.length - 1]` (`state._hourly`/`rowsInPeriod()` vêm do mais antigo pro mais recente, então o último item do array é sempre a leitura mais recente do período); ETo/Chuva continuam soma.
  - Constantes `CHART_SERIES`/`CHART_AXES` (copiadas das equivalentes em `view.details.js`, mesmos valores/cores) + `activeSeries` (estado do toggle de cada série, só `eto`/`rain` começam ligadas) + `AXIS_COL_W`.
  - `chartBuildAxes()` (novo, adaptado do `view.details.js`): agrupa séries ativas por eixo, calcula min/max por eixo (`zeroBased` quando aplicável), ordena eixos por lado (esquerda/direita) e índice, calculando a posição `x` de cada eixo.
  - `renderClimateChart()` substitui `renderTempHumidityChart()`: desenha grade, todos os eixos ativos (rótulos na cor da própria série, unidade no topo do eixo), barras (Chuva) atrás das linhas, linhas sólidas/tracejadas (Bateria) por cima, rótulos do eixo X, e tooltip com linha-guia + ponto por série ativa + balão listando todas as séries ativas naquele instante.
  - `renderLegend()` (novo): botões de legenda com swatch (linha/traço/barra conforme o tipo da série), clique alterna `activeSeries[key]` e re-renderiza legenda + gráfico.
  - `exportReadingsCsv()` sem mudança de lógica, só o botão que a aciona mudou de lugar no HTML.
- `frontend/pages/weatherstation.details.html`:
  - Botão "Exportar CSV" movido pro `<header>` do card de Leituras (ao lado do título); rodapé da tabela simplificado pra só contagem (esquerda) + paginação (direita).
  - Card "indicadores": Temperatura ganhou uma sublinha (`weatherstation-stats__subvalue`) pro máx/mín; labels de todos os 6 itens agora descrevem o critério de agregação entre parênteses.
  - Card do gráfico: título "Gráfico de Clima", removido o bloco de resumo (`weatherstation-mini-chart-summary`), adicionado container de legenda (`#weatherstationChartLegend`).
- `frontend/assets/css/pages/pivos.css`: `.weatherstation-mini-chart-summary/-value/-label/-unit/-footer` removidas (não usadas mais); `.weatherstation-legend*` nova (duplicado de `.cf-chart-card__legend`/`.cf-legend-item*`/`.cf-legend-swatch*`, renomeado pelo mesmo motivo de sempre); `.weatherstation-stats__subvalue` nova; `.weatherstation-history__foot-left` removida (o botão de export saiu do rodapé).

Validação executada:

```bash
node --check frontend/assets/js/pages/estacoes/weatherstation-details.js
node --check frontend/assets/js/core/map-icons.js
node --check frontend/assets/js/pages/mapa.js
node --check frontend/assets/js/i18n/dict.js
node --check frontend/assets/js/i18n/dict.es.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, chaves CSS balanceadas, tags `<article>`/`<div>` de `weatherstation.details.html` em par (5/5, 65/65), HTTP 200 em todos os arquivos tocados. Grep confirmou zero classe `pivo-*`/`bmbd-*`/`cf-*` remanescente fora do comentário de topo do arquivo e da flag `is-pivo-details` (justificada).

Pendência: validação visual completa (ícone do anemômetro aparecendo no minimapa; card de indicadores com os critérios certos por variável; gráfico abrindo só com ETo/Chuva ativas e ligando as outras pela legenda; eixos múltiplos com cor certa por série; tooltip mostrando só as séries ativas).

### 2026-09-11 — Ajustes finos adicionais (mesma rodada): eixo próprio pra ETo/Chuva, legenda mais bonita, menos espaço morto

Últimos retoques pedidos na sequência, ainda sobre a tela de Detalhes:

- **Eixos de ETo e Chuva separados**: antes as duas dividiam o mesmo eixo (`axisId: "water"`, à direita). Agora `eto` tem seu próprio eixo à **esquerda** (`order: 3`, depois de Temperatura/Umidade/Vento) e `rain` mantém eixo à **direita** (`order: 0`, antes de Radiação/Bateria) — a pedido do usuário, pra não misturar as duas escalas na mesma régua quando ambas (que são as que vêm ativas por padrão) aparecem juntas.
- **Label da Temperatura encurtada**: "Temperatura (média do período)" → "Temperatura (média)", mesmo padrão de brevidade dos outros rótulos ("última leitura", "acumulado").
- **Legenda com visual mais cuidado**: itens viraram "pill" (fundo suave, borda arredondada, hover), swatch de linha ficou mais grosso (14×3px) e o de "ponto" (usado antes só no tooltip) virou o padrão do swatch genérico (círculo), mais fácil de diferenciar rapidamente por cor.
- **Menos espaço morto no card do gráfico**: `.weatherstation-mini-chart` perdeu o `min-height: 280px` fixo (não fazia mais sentido depois de tirar o bloco de resumo) e o padding vertical caiu de 20px pra 16px/12px; `margin-bottom` do cabeçalho caiu de 20px pra 8px; margem/padding da legenda também reduzidos.

Arquivos alterados: `frontend/assets/js/pages/estacoes/weatherstation-details.js` (CHART_SERIES/CHART_AXES), `frontend/pages/weatherstation.details.html` (label), `frontend/assets/js/i18n/dict.js`/`dict.es.js` (label), `frontend/assets/css/pages/pivos.css` (`.weatherstation-mini-chart*`, `.weatherstation-legend*`).

Validação: `node --check` no JS, chaves CSS balanceadas, `npm run check:encoding`, HTTP 200 em todos os arquivos tocados.

### 2026-09-11 — Legenda ordenada/centralizada + card do gráfico sem sobra de espaço embaixo

- Ordem da legenda: `LEGEND_ORDER = ["eto", "rain", "temp", "humidity", "wind", "radiation", "battery"]` — ETo e Chuva (as que vêm ativas por padrão) aparecem primeiro, resto na ordem original. `.weatherstation-legend` já tinha `justify-content: center`, então a centralização era automática assim que a lista para de crescer de mais.
- `.weatherstation-mini-chart` ganhou `align-self: start`: antes o card esticava pra acompanhar a altura da tabela de Leituras ao lado (`align-items: stretch` do `.weatherstation-bottom-row`), mas o conteúdo do gráfico (svg de altura fixa + legenda) não crescia junto, sobrando uma faixa vazia embaixo do card. Agora o card fica do tamanho do próprio conteúdo.

Arquivos: `frontend/assets/js/pages/estacoes/weatherstation-details.js`, `frontend/assets/css/pages/pivos.css`. Validação: `node --check`, chaves CSS balanceadas, `npm run check:encoding`, HTTP 200.

### 2026-09-11 — Legenda centralizada em relação ao meio do eixo X (não do card)

Ajuste fino: `justify-content: center` centralizava a legenda em relação à largura inteira do card, mas o meio do plot (área entre os eixos) quase nunca coincide com o meio do card — a margem esquerda/direita do gráfico muda dinamicamente conforme quantos eixos estão ativos de cada lado (`PAD_L`/`PAD_R`, calculados por `chartBuildAxes`).

Corrigido em `renderClimateChart()`: depois de calcular `PAD_L`/`PAD_R`, calcula a fração `plotCenterFrac` (0 a 1) de onde o meio do plot cai dentro da largura total do SVG, e aplica um padding assimétrico (só esquerda OU só direita, nunca os dois) no `#weatherstationChartLegend` — o truque desloca o ponto que o `justify-content: center` usa como "meio" da caixa de conteúdo, sem precisar mexer no `justify-content` em si.

Validação: `node --check`, `npm run check:encoding`, HTTP 200.

### 2026-09-11 — Correção da centralização da legenda (ainda não estava certa)

O primeiro ajuste (padding assimétrico em %) tinha um problema de referência: a porcentagem de padding do CSS é calculada em cima da largura real do elemento pai no momento do layout, mas eu estava calculando a fração a partir do `W` do viewBox do SVG — que só bate com a largura real se nada tiver mudado entre medir o SVG e aplicar o padding na legenda. Qualquer diferença (ex.: a legenda tem padding próprio que o SVG não tem) already bastava pra description ficar torta.

Trocado por uma abordagem mais direta: `justify-content: center` já centraliza a legenda (com quebra de linha incluída) em relação à própria largura do card — em vez de mexer em padding, aplico um `transform: translateX(<px>)` calculado a partir da largura *real* medida do mesmo elemento pai do SVG (`svg.parentElement.getBoundingClientRect().width`), deslocando esse centro pro ponto exato onde o meio do plot cai. `translateX` não interfere no wrap da legenda (diferente de mexer em padding, que reduz a largura disponível e pode quebrar linha mais cedo).

Arquivo: `frontend/assets/js/pages/estacoes/weatherstation-details.js`. Validação: `node --check`, `npm run check:encoding`, HTTP 200 — ainda não confirmado visualmente num navegador.

### 2026-09-11 — Título "Gráfico de Clima": i18n faltando + formatação igual ao "Leituras"

Dois problemas no título do card do gráfico: (1) `"Gráfico de Clima"` não tinha entrada no dicionário, então ficava em PT mesmo com o idioma em EN/ES; (2) uma regra antiga (`.weatherstation-mini-chart-header .weatherstation-data-card__title`, herdada do padrão `bmbd-mini-chart` de quando esse card ainda tinha um resumo de valor ao lado do título) deixava esse título menor e mais claro (15px, `--muted-600`, peso 500) do que o título "Leituras" (20px, peso 600, cor escura) — mesma classe `.weatherstation-data-card__title`, visual diferente só por causa dessa regra extra.

Corrigido: adicionada a tradução em `dict.js`/`dict.es.js`; removida a regra de override, então os dois títulos ("Leituras" e "Gráfico de Clima") agora usam exatamente o mesmo estilo base de `.weatherstation-data-card__title`.

Validação: chaves CSS balanceadas, `node --check` nos dicionários, `npm run check:encoding`, HTTP 200.

## 2026-09-11 — Medidor de Nível: campos de Vazão Residual (A/B/C) viram opcionais

Pedido: em Medidor > Vazão Residual, os coeficientes A/B/C da curva chave deixam de ser obrigatórios, tanto no create quanto na Configurações (edição).

Feito:

- `frontend/assets/js/pages/equipamentos/medidor.js` (create): removido `<span class="equip-required">*</span>` dos labels A/B/C; `validateConfigStep` não bloqueia mais o avanço do passo quando A/B/C estão vazios (só o nome do equipamento continua obrigatório).
- `frontend/pages/medidor-edit.html` (Configurações): removido `<span class="edit-panel__req">*</span>` dos mesmos três labels.
- `frontend/assets/js/pages/medidores/view.edit.js`: removida a checagem em `buildSavePayload()` que impedia salvar sem os três coeficientes preenchidos.

Não há nenhum outro lugar no código que leia `coefA`/`coefB`/`coefC` além dessas duas telas (conferido por grep), então não existe risco de cálculo quebrar com os campos vazios — ficam salvos como estão (vazio/`0`, dependendo de onde são lidos) sem afetar mais nada.

Validação: `node --check` nos dois arquivos JS, `npm run check:encoding`, HTTP 200 em `medidor.js`, `medidores/view.edit.js` e `medidor-edit.html`.

Pendência: validação visual (criar/editar um Medidor de Nível deixando A/B/C em branco e confirmar que salva sem erro).

## 2026-09-11 — Carretel: consolida "Pressão ideal" + "Correção de pressão" em um único campo "Pressão mínima" (bar)

Print da engenharia mostrando o passo 2 (Ficha Técnica) do create do Carretel com "Ideal pressure" e "Pressure correction" como dois campos separados — pedido: deixar só um campo "Pressão mínima", em bar.

Achado ao investigar: o campo interno já se chamava `minPressure` (mesma chave de dado usada pela Configurações), só o **label exibido** é que ainda dizia "Pressão ideal" em vez de "Pressão mínima" — e existia um segundo campo separado, `pressureCorrection`, que a Configurações do Carretel nunca teve (conferido em `carretel-edit.html`/`carreteis/edit.js`: só existe `minPressure` lá, já correto).

Feito em `frontend/assets/js/pages/equipamentos/rainstar.js` (create):

- Label do campo `rsMinPressure` trocado de "Pressão ideal" pra "Pressão mínima" (unidade "bar" já estava certa).
- Removido inteiramente o campo `rsPressureCorrection`/`pressureCorrection` — do JSX/template, do `bindStep2`, do `readStep2` (incluindo o alias `pressureAdj`) e do array de campos obrigatórios em `validateStep2`.

Confirmado por grep que `pressureCorrection`/`pressureAdj` não são lidos em nenhum outro lugar do código (só sobravam em `data/farms.json`/`frontend/data/farms.json`, dados mock existentes — inofensivo, um valor a mais que ninguém lê). Removidas as traduções órfãs `"Pressão ideal"`/`"Correção de pressão"` de `dict.js`/`dict.es.js` (a chave `"Pressão mínima"` já tinha tradução, reaproveitada).

Validação: `node --check` em `rainstar.js` e nos dois dicionários, `npm run check:encoding`, HTTP 200.

Pendência: validação visual (abrir o create do Carretel, conferir que só aparece "Pressão mínima" em bar, sem "Pressão ideal"/"Correção de pressão").

## 2026-09-11 — Carretel: remove o campo "Modo de Irrigação" da Configurações (Controles)

Pedido do usuário: o campo não deveria estar na Configurações — quem decide o modo de irrigação é o comando de iniciar o carretel (toggle "Você deseja agendar a execução?" no modal "Iniciar Carretel"), não uma configuração persistente do equipamento.

Feito:

- `frontend/pages/carretel-edit.html`: removido o campo `Modo de Irrigação` (dropdown Início imediato / Hora de início programada) da aba Controles, e a linha correspondente no grid de detalhes do histórico mockado.
- `frontend/assets/js/pages/carreteis/edit.js`: removidas todas as referências a `irrigationMode` — `setSelectValue` do dropdown, o `menuKey === "irrigationMode"` do handler de seleção, e a leitura/gravação em `buildSavePayload`/`applySave`/`persistCrtPayload`. Importante: **não** ficou nenhum `irrigationMode: "immediate"` hardcoded sendo salvo — se tivesse ficado, salvar a Configurações sobrescreveria silenciosamente qualquer `irrigationMode` real definido pelo modal "Iniciar Carretel" toda vez que o usuário salvasse qualquer outra coisa na tela.

A tradução "Modo de Irrigação" continua em uso (modal "Iniciar Carretel", em `carreteis/index.js`), então não foi mexida no dicionário.

Validação: `node --check`, tags `<div>` de `carretel-edit.html` em par (101/101), `npm run check:encoding`, HTTP 200.

Pendência: validação visual (abrir a Configurações de um carretel, conferir que "Modo de Irrigação" não aparece mais em Controles, e que salvar não altera o modo real do equipamento).

## 2026-09-11 — Carretel: nova etapa "Pré e Pós-Irrigação" no create (opcional, réplica da Configurações)

Primeiro dos itens combinados na entrada anterior. Nova etapa no create do Carretel, entre "Ficha Técnica" e "Conectividade", com os mesmos campos/comportamento que já existem na aba Geral da Configurações — toggle liga/desliga Pré-Irrigação e Pós-Irrigação, cada um com Duração (min) e Distância (m), habilitados só quando o respectivo toggle está ativo. Nenhum campo é obrigatório.

Feito:

- `frontend/assets/js/pages/create-equipment.js`: `RAINSTAR_STEPS` ganhou a etapa `"Pré e Pós-Irrigação"` (entre Ficha Técnica e Conectividade); dispatch de render/validação atualizado (a etapa "Controles" nunca existiu de fato no create — era um resquício do desenho original de 4 etapas — reaproveitei o mesmo slot `Step3` já cabeado no dispatcher genérico).
- `frontend/assets/js/pages/equipamentos/rainstar.js`: novo `renderStep3`/`bindStep3`/`readStep3`/`validateStep3` — markup idêntico ao de `carretel-edit.html` (toggle `.pivo-edit__switch`, campos de Duração/Distância desabilitados até o toggle ligar). `validateStep3` sempre retorna `ok:true` (nada é obrigatório). Estado interno do passo fica em chaves achatadas (`preEnabled`/`preDuration`/...), mas `readStep3()` também devolve o formato aninhado `preIrrigation: { enabled, duration, distance }` / `postIrrigation: { ... }` — **sem isso**, o equipamento criado teria os dados em formato diferente do que `normalizeCrt()` (Configurações, `carreteis/edit.js`) espera, e a Configurações mostraria tudo desabilitado/zerado mesmo depois de preenchido no create.

Achado e corrigido de quebra (mesmo arquivo, achado ao estilizar a etapa nova): `.edit-panel__grid-3` e `.pref-divider` só têm estilo quando dentro de containers específicos (`.pivo-edit-specifics`, `#repEditPanel`, `.cosmofield-page`) — fora deles ficam sem nenhum efeito visual (mesmo problema já documentado num comentário do `pivo-edit.css` pra outro caso). O create do equipamento não é nenhum desses containers, então usar essas classes ali renderizava sem grid/sem divisória. Troquei por estilo inline equivalente na nova etapa, e aproveitei pra corrigir a mesma classe (`edit-panel__grid-3`) que já estava sendo usada (sem efeito, mas também sem quebrar nada visualmente já que só tinha 1 campo real + 2 divs vazias) no `renderStep4` (Conectividade) da mesma tela — pré-existente, não introduzido agora.

Traduções adicionadas: `"Pré e Pós-Irrigação"` (rótulo da etapa no breadcrumb) em `dict.js`/`dict.es.js`. `Pré-Irrigação`/`Pós-Irrigação`/`Duração`/`Distância` já tinham tradução (reaproveitadas da Configurações).

Validação executada:

```bash
node --check frontend/assets/js/pages/equipamentos/rainstar.js
node --check frontend/assets/js/pages/create-equipment.js
node --check frontend/assets/js/i18n/dict.js
node --check frontend/assets/js/i18n/dict.es.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, HTTP 200 em todos os arquivos tocados.

Pendência: validação visual (criar um carretel, ligar Pré e/ou Pós-Irrigação com valores, terminar o create, abrir a Configurações do mesmo carretel e conferir que os toggles/valores aparecem certos — é o teste que garante que o formato aninhado ficou correto).

### 2026-09-11 — Correção: visual de "campo desabilitado" faltando no toggle de Pré/Pós-Irrigação

O usuário apontou que o comportamento de habilitar/desabilitar não estava completo — comparou com o padrão já usado no Irripump (Ficha Técnica, toggle "Habilitar limite de consumo de água"): lá, desligar o toggle não só desabilita o campo (atributo `disabled`), como também aplica um estilo visual de "trava" no grupo do input inteiro (fundo cinza, borda mais clara, cursor `not-allowed`) e limpa o valor digitado.

Na minha implementação anterior eu só tinha setado o atributo `disabled` no `<input>`, sem a classe que dá esse visual — resultado: o campo ficava funcionalmente desabilitado, mas sem o estilo "trancado" esperado, e o valor digitado ficava pendurado escondido em vez de ser limpo.

Corrigido em `renderStep3`/`bindStep3` (`rainstar.js`): `.rs-input-group` (grupo do input) ganha a classe `rs-input-group--locked` — já existente em `create-equipment.css`, é o equivalente exato do `.is-disabled` do Irripump, só que para a família de classes `rs-*` que o create do Carretel usa — tanto na renderização inicial (conforme `preEnabled`/`postEnabled` salvos) quanto ao vivo, no handler do toggle. Ao desligar um toggle, o valor de Duração/Distância correspondente também é limpo (`input.value = ""` + `state[...] = ""`), igual ao Irripump.

Validação: `node --check`, `npm run check:encoding`, HTTP 200.

Pendência: validação visual (ligar Pré-Irrigação, digitar valores, desligar o toggle — conferir que os campos ficam com o visual de "trancado" e os valores somem, igual ao toggle de limite de consumo do Irripump).

### Próximos passos combinados com o usuário (ainda não iniciados)

## 2026-09-11 — Carretel: Configurações reorganizada em 4 seções, no padrão do Medidor de Nível

Pedido: padronizar a divisão de informações da Configurações do Carretel pra ter tudo que existe no create, numa ordem que faça sentido — usando o Medidor de Nível como referência de "boa organização" (lá a Configurações tem nav lateral `Geral | Localização | Nível | Bombas Vinculadas`, cada seção espelhando uma etapa do create). Zonas de Irrigação continua existindo só na Configurações (create não tem e não vai ter) — comportamento dela ainda a receber do usuário antes de mudar o que já existe (mockado).

Antes: só 2 seções — `Geral` (Conectividade + Nome + Pré-Irrigação + Pós-Irrigação + Zonas de Irrigação, tudo misturado) e `Controles` (campos técnicos).

Depois, 4 seções na nav lateral, cada uma espelhando uma etapa do create (na mesma ordem):

1. **Geral** — Conectividade (ID do equipamento) + Nome do equipamento. Só isso — mesmo padrão do Medidor, que também dobra a Conectividade (só 1 campo) pra dentro do Geral em vez de dar aba própria.
2. **Ficha Técnica** (renomeada de "Controles" — nome exato da etapa 2 do create) — Método de configuração, Modelo, Taxa de fluxo, Comprimento da mangueira, Largura de trabalho, Pressão mínima, Diâmetro do bico. Conteúdo idêntico ao que já existia em "Controles", só o título e o id da seção mudaram.
3. **Pré e Pós-Irrigação** (nova seção própria — antes vinha junto do Geral) — os dois blocos de toggle + Duração/Distância, extraídos de dentro do Geral sem nenhuma mudança de campo/comportamento.
4. **Zonas de Irrigação** (nova seção própria — antes vinha junto do Geral) — botão "Criar Zona" + empty state, extraído de dentro do Geral sem nenhuma mudança de campo/comportamento (removido só o `<h3>` duplicado, já que o cabeçalho da seção (`<h2>`) já diz "Zonas de Irrigação").

Nenhum id de campo mudou (`crtEditName`, `crtEditPreEnabled`, `crtEditCreateZoneBtn`, etc.) — só os ids das `<section>` (`crtEditControls` → `crtEditTechSheet`, mais os dois novos `crtEditIrrigationTiming`/`crtEditZones`) e o `data-target` dos botões da nav lateral. Como `carreteis/edit.js` só faz `document.querySelectorAll("#crtEditPanel ...")` (nunca escopado a uma seção específica) e o handler de troca de aba lateral já é genérico (por `data-target`/id da section, mesmo mecanismo usado em todas as outras telas de edição), a reorganização não exigiu nenhuma mudança de JS — só HTML.

Validação executada:

```bash
node -e "confere <section>/<div> de carretel-edit.html em par"
npm run check:encoding
```

Resultado: `<section>` 7/7, `<div>` 103/103, encoding limpo, HTTP 200.

Pendência: validação visual (abrir a Configurações de um carretel, navegar pelas 4 seções, conferir que salvar continua funcionando normalmente com os campos nas novas seções).

### Próximos passos combinados com o usuário (ainda não iniciados)

- Comportamento de Zonas de Irrigação (criação/edição real) — usuário vai detalhar antes de implementar.

## 2026-09-11 — Carretel: comportamento real de Zonas de Irrigação (até 4 zonas, velocidade por trecho)

Pedido do usuário: Zonas de Irrigação serve para, durante a puxada do carretel, aplicar lâminas/velocidades diferentes ao longo do recolhimento da mangueira, com até 4 zonas definidas em metros. Regras: (1) só libera criar outra zona se a zona atual (a última) está totalmente preenchida e válida; (2) a barra visual vai se preenchendo conforme mais zonas são adicionadas; (3) o Início de cada zona a partir da 2ª é automaticamente o Fim da anterior (campo travado, não editável).

Implementado em `carretel-edit.html` (seção `#crtEditZones`) + `carreteis/edit.js`, substituindo o placeholder mockado (`alert(...)`) por comportamento real:

- **Estado**: `state.zonesDraft` — array em memória de até 4 `{ start, end, speed }`, inicializado a partir de `equip.data.zones` (via `normalizeCrtData`) sempre que o carretel em foco é (re)renderizado.
- **Barra visual** (`#crtEditZonesBar`): um segmento colorido por zona (4 cores fixas), largura proporcional ao trecho (`Fim - Início`), rótulo "Zona N: Xm". Escondida (`display:none`) quando não há zonas.
- **Linhas** (`#crtEditZonesRows`): cada zona com Início (m), Fim (m), Velocidade (m/h) — usando `.sc-input-group`/`.sc-input`, mesma família de campo do resto da Configurações — e um botão de lixeira.
  - Zona 1: Início editável (padrão "0").
  - Zonas 2–4: Início **desabilitado**, sincronizado ao vivo com o Fim da zona anterior (`.sc-input-group .sc-input:disabled` já dá o visual "trancado" de graça, sem precisar de modificador extra — diferente do `rs-input-group` do create).
  - Validação ao vivo (evento `input`, sem re-render completo pra não perder o foco): se Fim ≤ Início, a borda do grupo fica vermelha e aparece a dica "Mínimo de Xm" abaixo do campo.
- **Criar Zona**: botão fica desabilitado enquanto a última zona não estiver válida (`end > start` e `speed > 0`) ou quando já existem 4 zonas. Ao clicar, adiciona uma zona nova com Início = Fim da anterior (ou 0, se for a primeira).
- **Remover** (lixeira): remove a zona clicada **e todas as posteriores** (em vez de só a zona em si) — evita deixar uma cadeia de Início/Fim inconsistente, já que o Início de cada zona depende do Fim da anterior.
- **Persistência**: `buildSavePayload()` grava só as zonas efetivamente válidas (`zoneIsValid`, filtrando uma zona final incompleta) em `equip.data.zones`, tanto em `applySave` (estado local) quanto em `persistCrtPayload` (dataset salvo).

Validação executada: `node --check` (edit.js, dict.js, dict.es.js), contagem de `<div>` (104/104), `npm run check:encoding`, HTTP 200 nos arquivos tocados (`carretel-edit.html`, `carreteis/edit.js`, `i18n/dict.js`, `i18n/dict.es.js`).

Pendência: validação visual no navegador (criar as 4 zonas em sequência, conferir a barra preenchendo, testar Fim ≤ Início mostrando o erro, remover uma zona do meio e confirmar que as posteriores somem, salvar e reabrir a Configurações pra ver as zonas persistidas).

## 2026-09-11 — Carretel: alinha rótulo "Zona N" e botão de excluir com os campos

Feedback do usuário: na linha de cada zona, o rótulo "Zona N" e o botão de lixeira estavam alinhados verticalmente com os títulos das colunas (Início/Fim/Velocidade), não com as caixas de input.

Correção em `carreteis/edit.js` (`renderZonesRows`): em vez de tentar reproduzir a altura do `<label>` real via padding manual (a altura exata não é trivial de descobrir, espalhada entre vários CSS), cada célula ("Zona N" e o botão de lixeira) passou a ficar dentro do mesmo wrapper `.pivo-edit__field` com um `<label style="visibility:hidden;">` idêntico ao das colunas vizinhas antes do conteúdo real — garante alinhamento pixel-perfect com Início/Fim/Velocidade independente da regra CSS real por trás do label.

Validação: `node --check`, HTTP 200. Commit `c12004c`.

## 2026-09-11 — Carretel: marca Fim e Velocidade das zonas como obrigatórios

Feedback do usuário: Fim e Velocidade de cada zona precisam do asterisco vermelho antes do nome do campo, igual ao padrão já usado nos demais campos obrigatórios da tela.

Correção em `carreteis/edit.js` (`renderZonesRows`): label vira `<span class="edit-panel__req">*</span> Fim` / `... Velocidade`, mesmo padrão do resto do arquivo (ex.: `crtEditFlowRate`). Início não recebe marcação — é travado (derivado da zona anterior) ou opcional na 1ª zona.

Validação: `node --check`, HTTP 200. Commit `2777f94`.

## 2026-09-11 — Carretel: demarca o raio do comprimento puxado no minimapa de Posição Inicial

Pedido do usuário: no minimapa do modal "Posição Inicial da Irrigação", demarcar visualmente o raio do comprimento de mangueira puxado, pra dar uma noção clara da delimitação (o ponto de início só pode ficar a essa distância fixa do carro aspersor).

Implementado em `carreteis/index.js` (`openSetStartPositionModal` → `renderSelection`): adicionado um `L.circle` centrado no carro aspersor (`sprinklerCar`) com `radius: pulled` (o comprimento puxado, em metros), traço tracejado azul (`#2563eb`, `dashArray: "6 6"`) e preenchimento bem sutil (`fillOpacity: 0.08`), desenhado antes dos marcadores/linha de seleção pra ficar por baixo. Redesenhado a cada `renderSelection()` junto com o resto da camada.

Validação: `node --check`, `npm run check:encoding`, HTTP 200 em `carreteis/index.js`.

Pendência: validação visual no navegador (abrir o modal de Posição Inicial de um carretel com mangueira puxada e conferir que o círculo aparece corretamente ao redor do carro aspersor, com raio compatível com o "Comprimento puxado" exibido).

## 2026-09-11 — Carretel: aba "Zonas de Irrigação" (somente leitura) no modal Iniciar Carretel + velocidade na barra do Config

Pedido do usuário: no modal de operação ("Iniciar Carretel"), adicionar uma 3ª opção "Zonas de Irrigação" que, em vez das caixas de Velocidade/Taxa, mostra a mesma figura (barra colorida) definida em Configurações → Zonas de Irrigação, sem poder editar — só visualização. Cada segmento deve mostrar, além do trecho em metros, um "|" seguido da velocidade da zona. Pediu também que esse "| velocidade" apareça na barra do Config (hoje só mostrava "Zona N: Xm").

Implementado:

- `carreteis/edit.js` (`renderZonesBar`): cada segmento passou de `"Zona N: Xm"` para `"Zona N: Xm | Y m/h"` (`--` quando a velocidade ainda não foi preenchida).
- `carreteis/index.js` (`openStartModal`): nova aba `data-op-tab="zones"` ao lado de "Definir Velocidade"/"Definir Taxa de Irrigação". Novo helper `buildZonesBarHtml(zones)` gera a mesma barra colorida (reaproveitando as 4 cores fixas) a partir de `equip.data.zones` já salvo, cada segmento com `"Zona N: Xm | Y m/h"`; sem zonas cadastradas, mostra o mesmo aviso "Nenhuma zona de irrigação cadastrada." usado no Config. A troca de aba agora também esconde o `.carretel-modal__grid` (Velocidade/Taxa) quando "Zonas de Irrigação" está ativa, e mostra/esconde o bloco somente-leitura.
- `pivos.css`: novas classes `.carretel-modal__zones-bar` (barra flex, 36px, cantos arredondados) e `.carretel-modal__zones-empty` (estado vazio, mesmo visual do dashed-border do Config).

Validação: `node --check` (index.js, edit.js), `npm run check:encoding`, HTTP 200 nos 3 arquivos tocados (`carreteis/index.js`, `carreteis/edit.js`, `pivos.css`). Nenhuma string nova precisou de tradução (todas já existiam em `dict.js`/`dict.es.js`).

Pendência: validação visual no navegador (abrir "Iniciar Carretel" de um carretel com zonas configuradas, clicar na aba "Zonas de Irrigação" e conferir a barra somente-leitura com "| velocidade", e conferir a mesma barra atualizada em Configurações → Zonas de Irrigação).

## 2026-09-11 — Carretel: salvar Configurações não fecha mais a tela

Pedido do usuário: depois de salvar as edições da Configuração de um carretel, a tela pode continuar aberta — não precisa voltar pra Visão Geral.

Antes, o clique em "Salvar" chamava `applySave(payload)` seguido de `closeEditView()` de forma síncrona (fechando a tela na hora, antes até da gravação assíncrona em `persistCrtPayload` terminar), e só mostrava algo pro usuário em caso de erro.

Correção em `carreteis/edit.js` (handler de `crtEditSaveBtn`): removido o `closeEditView()`. O botão agora `await`a `persistCrtPayload(payload)` de verdade, com feedback visual (mesmo padrão já usado no LineStar: `linestar-edit.js`): botão vira spinner + "Salvando...", e ao terminar mostra toast de sucesso ("Carretel salvo com sucesso!" via `IcToast`/`IcNotify`) e o botão pisca "Salvo!" por 2s antes de voltar ao normal; em caso de falha, mantém o toast de erro já existente. O botão "Voltar" (`crtEditBack`) continua fechando a tela normalmente — só o fluxo de salvar deixou de navegar embora.

Novas strings em `dict.js`/`dict.es.js`: "Salvando..." e "Carretel salvo com sucesso!" ("Salvo!" já existia).

Validação: `node --check` (edit.js, dict.js, dict.es.js), `npm run check:encoding`, HTTP 200 nos 3 arquivos.

Pendência: validação visual no navegador (editar um carretel, salvar, e confirmar que a tela de Configurações permanece aberta com o feedback de sucesso, em vez de voltar pra Visão Geral).

## 2026-09-11 — i18n: varredura completa de textos exibidos (pt / en / es)

Pedido do usuário: todo texto exibido no projeto tem que respeitar o i18n em en/pt/es, conforme a opção selecionada em Configurações — fazer a cobertura de todo texto possível sem quebrar nada.

Abordagem: como o tradutor (`i18n/core.js`) é uma whitelist que casa o texto **exato** de cada nó do DOM, a cobertura foi medida com um extrator que varre todo o `frontend/` (HTML e JS) e lista os textos exibidos que não têm chave no dicionário. O extrator decodifica entidades HTML (`&ccedil;`) e escapes unicode (`\u00e7`), separa o texto que fica colado a handlers inline, e ignora o que não deve ser traduzido.

Resultado: dicionário passou de **1.585 para 3.082 chaves**, com paridade total entre `dict.js` (en) e `dict.es.js` (es) — zero chaves órfãs nos dois sentidos, zero traduções vazias.

Cobertura adicionada (entre outros): faturamento e detalhes de fatura, relatórios, pluviometria e manutenção de pluviômetros, cadastro de equipamentos/módulos/funções, criação e edição de fazenda, telemetria, gestão, monitoramento, estados de operação e alarmes de pivô/bomba/carretel, mensagens de validação de formulário, toasts de sucesso/erro, feriados, períodos e textos de acessibilidade (`aria-label`, `title`, `placeholder`).

Ficaram intencionalmente **sem** tradução: nomes de fabricantes e modelos (Bauer, Valley, Lindsay, Reinke, Zimmatic, Rainstar E55 XL...), nomes de idioma no seletor, estados brasileiros, e nomes de equipamentos/fazendas cadastrados (dado do cliente, não rótulo de interface).

Correções estruturais necessárias para a tradução funcionar:

- **Rótulos colados a valores dinâmicos.** Trechos como `duração de ${x} horas` ou `Última comunicação: ${data}` formam um único nó de texto cujo valor muda junto com o dado, então o dicionário nunca casava. O rótulo passou a ficar em seu próprio `<span>`, separado do valor. Corrigidos: Faixas de Energia do Editar Fazenda e de Cadastros (incluindo o badge "REDUZIDO"), tooltips do mapa (ETo/Chuva/Temp./Umidade/Vento/Radiação/Última comunicação), manutenção de pluviômetros, cards de pluviometria, módulos em cadastro de equipamentos, KPIs de telemetria, alertas de programação, legenda de limite de consumo da bomba, paginação do LineStar e contador de itens da toolbar.
- **`pivos/view.edit.js`** localizava os títulos "Dados gerais" e "Modo de Operação" comparando o texto do DOM apenas em pt e en; com a interface em espanhol a busca falharia. Agora aceita os três idiomas.
- **Textos fixos em inglês no fonte** (que apareciam em inglês mesmo com a interface em português): "No data available" e "Occurrences" no modal de falhas do LineStar, e "Live" na barra de telemetria — trocados para português e traduzidos pelo dicionário.
- **Duas chaves duplicadas e divergentes** no dicionário: `"Pressão Atual"` estava mapeada para `"Average Pressure"` (cópia errada de `"Pressão Média"`) e `"Fuso horário"` tinha duas grafias em inglês. Deduplicadas.

Validação: `node --check` em todos os arquivos tocados, `npm run check:encoding`, HTTP 200 nos arquivos servidos, carga dos dois dicionários num sandbox verificando paridade/duplicatas/vazios, e simulação do casamento nó-a-nó do tradutor sobre o HTML gerado pelas Faixas de Energia (confirmando que rótulos traduzem e valores como horários e seriais ficam intactos).

Pendência: validação visual no navegador, trocando o idioma em Configurações entre Português / English / Español e percorrendo as telas principais.

## 2026-09-11 — i18n: pente fino da varredura (alert/confirm, título da aba e rótulos restantes)

Revisão da varredura anterior, procurando o que o extrator heurístico não conseguia ver. Achou três buracos reais:

**1. `alert()` / `confirm()` — 60 mensagens que nunca eram traduzidas.** Esses diálogos são do navegador: a string não entra no DOM, então o `MutationObserver` do i18n nunca a alcança. As mensagens já tinham entrado no dicionário na varredura anterior, mas o dicionário nunca era consultado — continuavam em português nos três idiomas. Todas passaram a chamar `t()` (via helper `tMsg`/`tCe`/`tBmb`, no mesmo padrão que `create-equipment.js` já usava). Cobre confirmação de exclusão, validações de formulário de cadastro (fazenda, talhão, pivô, equipamento, contrato, fatura), avisos de salvamento e geolocalização.

**2. `<title>` das páginas.** O `refresh()` do core só varre `document.body`, então o título da aba ficava em português em qualquer idioma. `i18n/core.js` passou a traduzir `document.title` também, guardando o original em pt para conseguir voltar/trocar de idioma — mesma estratégia usada nos nós de texto.

**3. Mais rótulos colados a valores dinâmicos**, no mesmo padrão já corrigido antes (o nó de texto inteiro varia junto com o valor, então nunca casa): contadores de funções ativas/pendentes e aviso de parâmetros faltando no Irripump, limiar de chuva válida na edição de pluviômetro, cabeçalho "Editar/Adicionar <tipo>" dos formulários de cadastro, e o `title` da linha de limite de consumo no gráfico da bomba.

Também verificado e sem ocorrências: atributos traduzíveis com aspas simples, e atributos traduzíveis com interpolação (além do da bomba, já corrigido).

Validação: `node --check` em todos os arquivos tocados, `npm run check:encoding`, HTTP 200, e um teste que carrega `core.js` + os dois dicionários num sandbox e roda `t()` sobre os textos dos diálogos nos três idiomas (pt-BR/en/es), além de um teste equivalente para o `document.title` — confirmando que ambos traduzem e voltam ao português.

Pendência: validação visual no navegador, trocando o idioma em Configurações e disparando um fluxo com confirmação (ex.: excluir um talhão) para conferir o texto do diálogo.

## 2026-09-11 — i18n: textos dentro de gráficos (legenda, tooltip e KPIs de período)

Reportado pelo usuário: no detalhe do pivô, o card "Consumption" mostrava "Volume Total nos Últimos 7 dias" e "Horas Totais de Trabalho nos Últimos 7 dias" em português, e no "Pressure Comparison (bar)" a legenda e o tooltip mostravam "Altitude do GPS", "Pressão de comparação · Última torre" e "Pressão · Última torre" — tudo isso com a interface em inglês.

Causa: os gráficos são marcados de propósito com `data-i18n-skip` (`view.charts.js`), porque o SVG e a camada de hover reescrevem o DOM a cada frame e o `MutationObserver` do i18n re-traduziria a árvore inteira, travando a página. Ou seja: **nenhum texto dentro de um gráfico pode depender do tradutor do DOM** — tem que ser traduzido na origem.

O arquivo já tinha um helper `ax()` para os títulos de eixo, mas ele consultava uma tabela local (`AXIS_I18N`) que cobria só seis termos — por isso "Pressure (bar)"/"Angle" traduziam e o resto não.

Correções em `pivos/view.charts.js`:

- `ax()` passou a consultar o **dicionário central** (`IcI18n.t()`) primeiro, caindo na tabela local só como reserva. Deixa de haver um dicionário paralelo para os gráficos.
- Aplicado `ax()` aos rótulos das séries de todos os gráficos de linha (Altitude do GPS, Pressão · Última torre, Pressão de comparação · Última torre, Lâmina, Tensão) — o que corrige de uma vez a legenda **e** o tooltip de hover, que reusa o mesmo `label`.
- Aplicado `ax()` aos rótulos dos donuts de Horas de Trabalho e Custos de Energia (Horário de Pico, Fora do Horário de Pico, Reduzido).
- KPIs do card de Consumo: `Volume Total ${periodLabel}` formava um nó de texto único que variava junto com o período, então nunca casava no dicionário. Agora rótulo e período são traduzidos na origem.

Verificado e já correto: os gráficos do Carretel (`carreteis/index.js`), que também ficam sob `data-i18n-skip`, já passavam rótulos e títulos de eixo por `t()`. Nenhum `<canvas>` do projeto desenha texto (só heatmap e imagem), então não há texto preso em bitmap.

Validação: `node --check`, `npm run check:encoding`, HTTP 200, e um teste que carrega `core.js` + dicionários num sandbox e roda `t()` sobre todos os rótulos de gráfico em en e es, confirmando que nenhum volta igual ao português.

## 2026-09-11 — i18n: rodada final do pente fino (gráficos restantes, status do carretel e datas por idioma)

Continuação da revisão. Auditado o que ainda não tinha sido verificado de forma sistemática: `textContent`/`innerHTML` com literal fora do dicionário (nenhum), `setAttribute` de atributo traduzível (nenhum), `setCustomValidity` (nenhum), `document.title` alterado por JS (nenhum), `<input type=button/submit>` com `value` visível (nenhum), `<optgroup label>` / `<option label>` (nenhum), `<text>` em SVG (nenhum) e atributos textuais fora da lista que o core varre (só `data-label` com nome de equipamento, que não se traduz mesmo).

Corrigido:

- **Donuts do card de Consumo** (`pivos/view.charts.js`): quatro rótulos ("Horário de Pico" / "Fora do Horário de Pico") tinham escrito com escape unicode (`Hor\u00e1rio`) e passaram despercebidos na rodada anterior — ficaram sem `ax()` enquanto os equivalentes logo abaixo já tinham sido corrigidos.
- **Status do carretel** (`carreteis/index.js`): a tabela de eventos montava o status via `statusMeta(equip).text` sem `t()`. O badge da tela já traduzia; a tabela não.
- **Datas com nome de mês / dia da semana**: 12 chamadas ainda usavam o locale fixo `"pt-BR"`, então mostravam "set", "sexta-feira" etc. mesmo com a interface em inglês ou espanhol. Passaram a usar `IcI18n.getLocale()`, mesmo padrão que `carreteis/index.js` e `create-farm/view.render.js` já seguiam. Afeta estação meteorológica (incluindo a aba Previsão), telemetria, mapa, gráficos do pivô e o utilitário compartilhado `core/equip-utils.js`. As chamadas puramente numéricas (`dd/mm`) foram deixadas como estão, para não mexer na ordem dos campos.

Verificado e já correto: os toasts (`IcToast`) entram no DOM via `appendChild`, então o tradutor os alcança, e as três mensagens literais já estavam no dicionário. Achado um bloco de CSS morto em `create-equipment.css` (`.sc-loc__sector-group`) com texto em `content:` — a classe não existe em nenhum HTML/JS, então o texto nunca chega à tela; ficou como está por não ser um problema de i18n real.

Validação: `node --check` nos arquivos tocados, `npm run check:encoding`, HTTP 200, verificação de paridade do dicionário, e conferência da saída de data nos três locales.

## 2026-09-11 — i18n: tabelas de meses fixas em português

Reportado pelo usuário: no histórico do carretel, a data "11 set 2026 13:10" continuava em português com a interface em inglês.

Causa: além do locale fixo já corrigido nas chamadas `toLocale*String`, havia **tabelas de meses escritas à mão em português** no código, que nenhum locale alcança.

Corrigido (passaram a derivar o nome do mês/dia do idioma selecionado, via `IcI18n.getLocale()`):

- `carreteis/index.js` — `HISTORY_MONTHS_PT`, usada no histórico de eventos (o caso do print).
- `core/equip-utils.js` — `formatLastUpdate`, utilitário compartilhado por vários equipamentos, então o mesmo mês abreviado aparecia em várias telas.
- `bombas/view.edit.js` e `bombas/view.edit.gh.js` — `MONTH_NAMES_PT` e `WEEKDAYS_PT` do datepicker próprio: o título ("setembro de 2026") e as iniciais dos dias da semana ("D S T Q Q S S") eram fixos em português.

O formato em português continua idêntico ao anterior — em inglês vira "11 Sep 2026 13:10" / "September 2026" / "S M T W T F S", em espanhol "11 sept 2026 13:10" / "septiembre de 2026" / "D L M X J V S".

Verificado e já correto: as grades de meses de `cadastros/form.energia.js` ("Jan", "Fev"...) e de `cadastros/view.energia.js` ("Janeiro", "Fevereiro"...) renderizam cada mês como nó de texto isolado, e todos os 12 nomes — abreviados e por extenso — já estão no dicionário, então o tradutor do DOM os alcança. O atributo `data-mes`, usado como chave de lógica, não está na lista de atributos traduzíveis, então não quebra.

Validação: `node --check` nos quatro arquivos, `npm run check:encoding`, HTTP 200, e conferência da saída de data nos três locales (histórico, título do datepicker e iniciais da semana).

## 2026-10-26 — Cosmofield: tela de Detalhes (construída)

Pedido do usuário: o Cosmofield não tinha tela de Detalhes no padrão de engenharia dos demais equipamentos — o clique levava direto para um painel único que misturava o "dashboard" (aba Geral: Dashboard / Calendário / Dados brutos) com Configurações e Histórico. Construir uma tela de Detalhes própria, **baseada na da Estação Meteorológica** (não na do pivô), com o conteúdo da aba Geral: indicadores e gráfico em cima, Dados brutos embaixo à esquerda, Calendário embaixo à direita. O "Editar" leva para Configurações/Histórico. Na revisão, o usuário pediu explicitamente para **não criar indicadores novos** (só os que já existiam), deixar o **filtro de período como único controle do gráfico** (com a opção "Todo o período") e, validada a tela, **omitir a aba Geral antiga comentando o código** — sem apagar.

Estrutura da tela (de cima pra baixo):

1. **Pincard** — minimapa com o ícone da sonda (mesma cor/alerta do mapa) e Voltar; status igual ao selo do tooltip do mapa (o alerta — `SEM COMUNICAÇÃO` / `BATERIA BAIXA` — ou, sem alerta, `xx% DA ÁGUA DISPONÍVEL`); título com seletor de Cosmofield; os **4 KPIs do card da sonda na lista de equipamentos**, na mesma ordem e com os mesmos ícones (Umidade atual, Lâmina recomendada, Tensão da bateria, Próxima irrigação); "Última comunicação"; botão Editar.
2. **Período** — o mesmo popover global (`js-period-trigger`), **único controle de janela da tela**: recorta o gráfico e os dados brutos. Abre no período global, como as outras telas de detalhes (padrão da plataforma: últimos 7 dias). O preset **"Todo o período"** aparece aqui (ver `feature.periodPicker.js` abaixo).
3. **Indicadores** — os **6 do dashboard da aba Geral**, com o mesmo markup (`.cf-stats`): Umidade atual, Água disponível, Lâmina recomendada, Próxima irrigação, Tensão da bateria, Última transmissão.
4. **Dashboard** — o gráfico de umidade do solo da aba Geral (legenda, ajuda), **sem barra de zoom, sem navegador e sem o botão de menu** (as três listrinhas não tinham ação nenhuma) — a janela vem do filtro de período. Sem "Adicionar evento" (fica só no Calendário).
5. **Dados brutos | Calendário** — mesma tabela paginada (com Exportar → modal de exportação de sempre) e mesmo calendário (navegação, seletor de mês, clique no dia, "Adicionar evento" e lançamento manual).

Espaçamento entre Período, indicadores e gráfico: o gap de 12px da coluna (o `.cf-stats` trazia margem própria de 18/20px, zerada nesta tela).

Decisão de arquitetura: o conteúdo **não foi duplicado**. Os renderizadores da aba Geral em `cosmofield/index.js` já trabalhavam sobre o `root` recebido; passaram a ser expostos em `window.IcCosmofield.general` e a tela nova os chama sobre o próprio root (mesmos IDs `cf*` dentro de `#cosmofieldDetailsPanel`). Os 4 KPIs do pincard copiam o valor dos indicadores (`cfKpi*`) em vez de recalcular. Só o layout é novo, com prefixo próprio `cosmofield-details-*` (mesmo motivo da Estação: não acoplar ao CSS de outro equipamento). Trocar de sonda ou voltar do Editar **remonta a tela a partir do markup em cache**, porque o `IcCosmofieldChart.init` registra listeners no próprio card a cada chamada — reiniciá-lo sobre o mesmo DOM dobraria os cliques da legenda.

Arquivos novos:

- `frontend/pages/cosmofield.details.html` — `#cosmofieldDetailsPanel`, estrutura acima + os três modais (ajuda do gráfico, evento do calendário, exportação).
- `frontend/assets/js/pages/cosmofield/cosmofield-details.js` — `window.IcCosmofieldDetails.open({ equipId, fromMap })` / `.close()` / `.refresh()` / `.renderData()`. Minimapa, seletor, cabeçalho e período próprios; o resto vem de `IcCosmofield.general`.

Arquivos alterados:

- `pages/cosmofield.html` (painel Configurações/Histórico): **aba Geral omitida — comentada, não apagada** (botão da aba, conteúdo Dashboard/Calendário/Dados brutos, botão Exportar e os três modais que só ela usava; os comentários internos do bloco viraram `[TEXTO]` para não fechar o comentário externo). Configurações passa a ser a aba ativa. Título do Voltar: "Editar Cosmofield", no padrão das demais telas de edição (Editar Pivô, Editar Carretel...).
- `cosmofield/index.js`: `focusDevice(equipId)` (abre na sonda clicada; antes o clique abria sempre a última sonda selecionada); `IcCosmofield.open(options)` aceita `equipId`; novo `window.IcCosmofieldEdit.open({ equipId, tab })` / `.close()` — o painel `cosmofield.html` num overlay `#cfEditOverlay` por cima dos Detalhes, aberto na aba Configurações; Voltar fecha o overlay e atualiza os Detalhes; `bindUI(root)` com root explícito, com as chamadas que só montavam a aba Geral **comentadas** (as funções continuam, usadas pelos Detalhes) e o estado inicial dos botões lido da aba ativa; `IcCosmofield.close()` fecha também Detalhes e overlay.
- `cosmofield/chart.js`: `IcCosmofieldChart.setRange(start, end)` — move a janela do último gráfico montado por datas, presa a pelo menos 2 dias dentro da série; navegador e botões de zoom passam a ser opcionais no card (sem eles, as funções do navegador não fazem nada — o painel antigo, que tem os dois, segue igual).
- `pluviometria/feature.periodPicker.js`: preset **"Todo o período"** no popover global, logo depois de "Últimos 90 dias". Só aparece quando o gatilho informa o intervalo dos dados da tela (`data-period-all-start` / `data-period-all-end`, `yyyy-mm-dd`) — a tela de Detalhes do Cosmofield preenche com o início e o fim da série. Nas demais telas o popover não muda (conferido na Estação: os mesmos 10 presets).
- `core/map-icons.js`: `IcMapIcons.cosmofieldIcon({ tone, alert })` — SVG do marcador, agora compartilhado entre `mapa.js:drawCosmofield` (mesmo HTML de antes) e o minimapa.
- `mapa.js`: novo `IcCosmofieldStatus(reading)` — status único do selo do tooltip e da barra de status dos Detalhes. Corrige também dois efeitos colaterais do commit `27de4b6` (que tirou todos os `label:` do arquivo ao remover a legenda das faixas de irrigação): o **selo do tooltip** do Cosmofield ficava só a cor, sem texto (a "marquinha" no canto superior direito do hover), e os **chips do card lateral** mostravam "3 undefined / 2 undefined" (voltaram Alerta / Atenção / Adequado). Marcador, card da lista e o botão "Detalhes" do modal (`create-farm/view.render.js`, `cosmofield/modal.js`) navegam com `{ equipId }`; a preferência "Ação ao clicar no Cosmofield" (modal × tela de dispositivo) continua valendo igual.
- `app.js`: rota `cosmofield` abre os Detalhes (repassa `options.equipId`) e fecha os demais detalhes antes; `IcCosmofieldDetails.close()` em todas as rotas que já fechavam `IcEstacaoDetails`.
- `index.html`: registrado `cosmofield-details.js`.
- `css/pages/cosmofield.css`: nova seção "Tela de Detalhes" ao final (layout, pincard, seletor, período, cards, tabela densa, calendário, responsivo e tema escuro). Linha de baixo empilha abaixo de 1400px (com a sidebar aberta, as duas colunas ficavam estreitas demais pra tabela de 8 colunas).
- `css/pages/config.css`: `#cfEditOverlay` incluído nas listas de overlays de edição (rolagem e tema escuro), junto de `#estdEditOverlay`.
- `i18n/dict.js` e `dict.es.js`: "Detalhes do Cosmofield", "Selecionar outro Cosmofield", "Editar Cosmofield" e "Todo o período" (en/es).

Validação executada:

```bash
node --check (todos os JS tocados)
npm run check:encoding
```

Mais testes de ponta a ponta em Chrome headless (servidor local em cópia isolada dos dados, sem gravar em `data/`), 32/32 na última rodada: abertura pela rota com `equipId`, pelo marcador → modal → Detalhes, pelo marcador direto com a preferência "tela de dispositivo" e pelo menu lateral; pincard com os 4 KPIs do card (ícones e valores iguais aos indicadores); os 6 indicadores do dashboard antigo; status igual ao selo do tooltip, inclusive SEM COMUNICAÇÃO (KPIs em cinza) e BATERIA BAIXA; selo do tooltip e chips do card com texto em todas as sondas; gráfico sem zoom/navegador/menu; abertura em "Últimos 7 dias"; "Últimos 30 dias" e "Todo o período" recortando gráfico, tabela e rótulo (e "Todo o período" marcado no popover); popover da Estação sem mudança; espaçamento de 12px entre os cards; "Adicionar evento" só no Calendário e lançamento salvo; Editar abrindo o overlay "Editar Cosmofield" só com Configurações/Histórico, Salvar visível, "Última comunicação" preenchida, Histórico abrindo e Voltar re-renderizando os Detalhes; textos em inglês; zero erro de JS no console. Markup ativo de `cosmofield.html` e `cosmofield.details.html` conferido com todas as tags em par. Conferido visualmente em 1600px e 1100px, claro e escuro, lado a lado com a tela da Estação.

Achado à parte, não alterado (fora do Cosmofield): o mesmo commit `27de4b6` tirou os rótulos dos botões da Conectividade (Relevo / Manter linhas / Mostrar GPS — dica e aria-label viram "undefined") e dos chips Online/Offline de equipamentos com módulos (`MODULE_BADGE`). Bombas e Medidores não foram afetados porque têm texto de reserva.

Pendência: validação final do usuário e push (o commit desta rodada fica só local até a aprovação).

## 2026-10-26 — Cosmofield: filtro de período enxuto e selo do hover

Continuação da entrada anterior, mesma rodada de validação com o usuário.

1. **Filtro de período do Cosmofield só com Últimos 7 / 14 / 30 / 90 dias e Todo o período.** O popover é global (Pivô, Bomba, Estação, Pluviometria, Relatórios), então o corte foi feito pela própria tela: novo atributo `data-period-presets` no gatilho (`feature.periodPicker.js`, lista separada por vírgula). O botão de período dos Detalhes do Cosmofield usa `7d,14d,30d,90d,all`; sem o atributo o popover mostra todos os presets, como sempre (conferido na Estação: os mesmos 10).
2. **Selo de status do hover do Cosmofield cortado.** O texto "96% DA ÁGUA DISPONÍVEL" é mais longo que os status dos outros equipamentos, e `.pivot-tooltip--pivot-card .pivot-tooltip__status` tem `max-width: 148px` com `nowrap` — o texto vazava pelas duas pontas (branco sobre branco). Só no tooltip do Cosmofield (`mapa.css`): fonte de 10px para 9px e sem o teto de largura. Medido em pt/en/es e nos estados de alerta: o texto cabe inteiro, sem cortar o nome da sonda.
3. **Verificações pedidas pelo usuário.**
   - **i18n:** varredura em tempo de execução, em inglês e espanhol, de tudo que a tela abre (Detalhes, popover de período, modais de evento/exportação/ajuda, seletor de sonda, Editar → Configurações e Histórico, hover e modal do mapa). Nenhum texto de interface ficou sem tradução; os únicos textos em português são dados (e-mail do mock, "Cosmofield Talhão 3", "Pivô 15").
   - **Preferência "Ação ao clicar no Cosmofield"** (Configurações → Preferências → Navegação), testada pela própria tela de Configurações: "Ir para a tela de dispositivo" → marcador e card da lista abrem os Detalhes direto; "Abrir o modal de informações" → marcador e card abrem o modal, e o "Detalhes" do modal leva aos Detalhes da mesma sonda.

Validação: `node --check`, `npm run check:encoding`, chaves de CSS em par, testes de ponta a ponta em Chrome headless (cópia isolada dos dados) — 32/32 na tela de Detalhes e 11/11 em preferência + i18n, zero erro de JS no console.

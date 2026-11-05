# Carretel / Hose Reel — sistema completo no padrão da plataforma atual

Este documento é a revisão do plano original do carretel. O objetivo não é redesenhar livremente: primeiro vamos reconstruir as telas do carretel no padrão visual atual da `platform-design`, replicando a plataforma antiga validada pela engenharia. Melhorias ficam mapeadas como futuro.

## Princípios fechados

- Replicar o comportamento da plataforma antiga antes de propor melhorias.
- Usar o padrão atual da plataforma para layout, edit-panel, cards, botões, modais e tabelas.
- i18n sempre em `pt-BR`, `en` e `es` para textos visíveis, status, placeholders, tooltips, botões e validações.
- Não usar dados pessoais reais em fixtures, prints, histórico, usuários, e-mails, IMEIs, endereços ou identificadores de cliente.
- Carretel é 4G/Ecostar celular para conectividade.
- O wizard de criação não terá etapa de mapa; posição vem do controlador em runtime.
- Desconectado aparece na lista, mas não deve aparecer no mapa sem posição operacional válida.
- O desenho no mapa é uma faixa única adaptável a qualquer direção entre posição inicial e reel.

## Estado atual do projeto

- O create atual está em `frontend/assets/js/pages/equipamentos/rainstar.js`.
- O fluxo atual é simples demais: `['Equipamento', 'Configuração']`.
- O mapa ainda reaproveita parte da lógica de pivô para `rainstar`, o que precisa ser separado.
- O projeto não tinha um arquivo separado com a lista completa de modelos; as opções abaixo foram reconstruídas pelos prints enviados.

## Opções controladas

### Método de configuração

- `Puxando o carrinho (Padrão)`
- `Puxando a mangueira`
- `Direção autônoma`

### Modelos

- `-`
- `eco ProRain F30`
- `eco ProRain F40`
- `eco ProRain F50`
- `Rainstar A2`
- `Rainstar A3`
- `Rainstar A4`
- `Rainstar E100`
- `Rainstar E11`
- `Rainstar E200`
- `Rainstar E21`
- `Rainstar E300`
- `Rainstar E31`
- `Rainstar E400`
- `Rainstar E41`
- `Rainstar E500`
- `Rainstar E51`
- `Rainstar E55 L`
- `Rainstar E55 XL`
- `Rainstar E600 4W`
- `Rainstar E600 4WB`
- `Rainstar T32`
- `Rainstar T42`
- `Rainstar T51`
- `Rainstar T61`

## Telas a reconstruir

### 1. Lista lateral no mapa

A seção `Carretéis` deve listar todos os carreteis, inclusive desconectados, com:

- Nome do equipamento.
- Badge de status.
- Comprimento puxado da mangueira.
- Pressão atual.
- Sinal do modem.
- Carga da bateria.
- Última comunicação.

Estados obrigatórios vistos nos prints:

- `PARADO POR SENSOR DE PARADA` em amarelo.
- `VELOCIDADE NÃO ATINGIDA` em vermelho.
- `DESCONECTADO` em cinza.
- `ESPERANDO CONEXÃO` em cinza.
- `IRRIGANDO` em azul, com chips extras de velocidade/taxa, como `20m/h` ou `17.5m/h`, e tempo, como `15:49` ou `19:31`.

A contagem do grupo deve resumir os estados, como `Stand-By`, `Alerta` e `Irrigando`, conforme o padrão visual da lista atual.

### 2. Mapa e tooltip

Quando conectado/operando, o carretel deve desenhar:

- Retângulo/faixa irrigada da posição inicial até o reel.
- Linha central da mangueira.
- Trecho azul para parte irrigada/puxada.
- Trecho laranja para parte restante/parada.
- Ícone do reel na ponta da máquina.
- Marcador do carrinho/canhão quando fizer sentido.

Tooltip/popover deve mostrar o card compacto da plataforma antiga:

- Nome.
- Status.
- Comprimento puxado.
- Pressão.
- Sinal.
- Bateria.
- Última comunicação.

### 3. Criar equipamento

O fluxo deve ser refeito, sem mapa, com dados técnicos e controles:

- Nome do equipamento.
- Machine Address / IMEI / ID único.
- Método de configuração.
- Modelo com a lista controlada acima.
- Taxa de fluxo / vazão.
- Largura operacional / largura de trabalho.
- Alcance, se mantido no create legacy.
- Comprimento da mangueira.
- Diâmetro do bocal.
- Pressão ideal ou mínima, conforme a tela.
- Correção de pressão, se mantida no create legacy.
- Modo de irrigação: início imediato ou horário programado.
- Conectividade 4G informativa.

### 4. Detalhes / cockpit

Tela de detalhes deve seguir o print antigo dentro do novo design:

- Botão voltar.
- Minimapa com faixa do carretel.
- Header com status, nome, KPIs e botão editar.
- Ações: definir posição inicial, iniciar carretel, desligar/parar carretel.
- Filtro de data.
- Cards de resumo: comprimento puxado, pré-irrigação, pós-irrigação, versão do firmware.
- Histórico com abas `Eventos` e `Operações`.
- Gráficos: horímetro total, horímetro diário e vazão.

### 5. Modal Iniciar Carretel

Deve replicar o modal antigo:

- Alerta informativo.
- Operação por velocidade ou taxa de irrigação.
- Campo velocidade com `m/h`.
- Campo taxa de irrigação com `mm`.
- Toggle de agendamento.
- Hora habilitada somente quando aplicável.
- Cancelar e Iniciar.

### 6. Editar Carretel

Usar padrão `edit-panel` atual:

- Header com voltar, seletor de carretel e salvar.
- Aba `Configurações` com nav lateral `Geral` e `Controles`.
- Aba `Histórico` com nav lateral `Histórico de Configurações` e `Favoritos`.

Geral:

- Endereço da máquina readonly.
- Nome obrigatório.
- Pré-irrigação: toggle, duração e distância.
- Pós-irrigação: toggle, duração e distância.
- Zonas de irrigação com ação `Criar Zona` e empty state.

Controles:

- Método de configuração obrigatório.
- Modelo obrigatório.
- Comprimento da mangueira.
- Largura de trabalho.
- Pressão mínima.
- Diâmetro do bico/bocal.
- Taxa de fluxo/vazão.
- Modo de irrigação obrigatório.

Histórico:

- Tabela com data, usuário mock, status controlador e ações.
- Status como `Recebido`.
- Ações de favoritar e download.
- Favoritos com empty state.

## Dados mock esperados

Semear 5 carreteis mock, cobrindo:

- Irrigando.
- Stand-by conectado.
- Parado por sensor de parada.
- Velocidade não atingida.
- Desconectado / esperando conexão.

Todos devem usar nomes e identificadores fictícios. Histórico pode usar usuário institucional mock, por exemplo `Bauer Irricontrol`, sem e-mail real de pessoa física.

## Shape de dados proposto

Configuração:

```js
{
  name,
  machineAddress,
  model,
  setupMethod,
  hoseLength,
  workingWidth,
  minPressure,
  nozzleDiameter,
  flowRate,
  irrigationMode,
  preIrrigation: { enabled, duration, distance },
  postIrrigation: { enabled, duration, distance },
  irrigationZones: [],
  firmwareVersion,
  communication: '4g'
}
```

Runtime mock:

```js
{
  connected,
  signal,
  battery,
  status,
  reelLat,
  reelLng,
  startLat,
  startLng,
  pulledPipeLength,
  currentPressure,
  currentSpeed,
  irrigationRate,
  timeRemaining,
  lastCommunication
}
```

## Fases

1. Dados mock e listas controladas.
2. Lista lateral `Carretéis` e status.
3. Geometria própria no mapa, separada de pivô.
4. Detalhes/cockpit.
5. Modal iniciar/parar.
6. Editar carretel.
7. Wizard de criação atualizado.
8. i18n completo pt-BR/en/es.
9. Verificação desktop e mobile.

## Arquivos prováveis

- `frontend/assets/js/pages/equipamentos/rainstar.js`
- `frontend/assets/js/pages/create-equipment.js`
- `frontend/assets/js/pages/mapa.js`
- `frontend/assets/js/pages/create-farm/view.render.js`
- `frontend/pages/carretel.details.html`
- `frontend/assets/js/pages/carreteis/details.js`
- `frontend/pages/carretel-edit.html`
- `frontend/assets/js/pages/carreteis/edit.js`
- `frontend/assets/js/i18n/dict.js`
- `frontend/assets/js/i18n/dict.es.js`
- `data/farms.json`
- `frontend/data/farms.json`

## Melhorias futuras

- Recomendações agronômicas.
- Regras avançadas de energia e tarifas.
- Edição avançada de geometria/faixas.
- Integração real com Ecostar.
- Melhorias analíticas nos gráficos.
## Log de execução

### 2026-09-11 — Etapa inicial executada

Objetivo da etapa: iniciar a reconstrução das telas de Carretel/Rainstar seguindo a plataforma antiga, já no padrão visual do `platform-design`, com i18n PT/EN/ES e sem dados pessoais reais.

Feito:

- Refatorado `frontend/assets/js/pages/equipamentos/rainstar.js`.
  - Criação do carretel passou de formulário simples de 2 etapas para fluxo preparado em 4 etapas: `Equipamento`, `Ficha Técnica`, `Controles`, `Conectividade`.
  - Lista oficial de métodos configurada:
    - `Puxando o carrinho (Padrão)`
    - `Puxando a mangueira`
    - `Direção autônoma`
  - Lista de modelos configurada conforme prints/legado:
    - `-`
    - `eco ProRain F30`
    - `eco ProRain F40`
    - `eco ProRain F50`
    - `Rainstar A2`
    - `Rainstar A3`
    - `Rainstar A4`
    - `Rainstar E100`
    - `Rainstar E11`
    - `Rainstar E200`
    - `Rainstar E21`
    - `Rainstar E300`
    - `Rainstar E31`
    - `Rainstar E400`
    - `Rainstar E41`
    - `Rainstar E500`
    - `Rainstar E51`
    - `Rainstar E55 L`
    - `Rainstar E55 XL`
    - `Rainstar E600 4W`
    - `Rainstar E600 4WB`
    - `Rainstar T32`
    - `Rainstar T42`
    - `Rainstar T51`
    - `Rainstar T61`
  - Campos adicionados/normalizados: `machineAddress`, `setupMethod`, `model`, `hoseLength`, `workingWidth`, `minPressure`, `nozzleDiameter`, `flowRate`, `irrigationMode`, `firmwareVersion`, `modemId`, `simIccid`.
  - Mantidos aliases antigos (`imei`, `method`, `flow`, `width`, `pressure`, `nozzle`) para compatibilidade com dados já existentes.
  - Autoformatação básica adicionada: IMEI/ICCID apenas números; campos numéricos aceitam decimal com `.` e normalizam vírgula.
  - Conectividade definida como 4G/Ecostar, sem rádio IrriMesh.

- Atualizado `frontend/assets/js/pages/create-equipment.js`.
  - `rainstar` agora usa `RAINSTAR_STEPS = ["Equipamento", "Ficha Técnica", "Controles", "Conectividade"]`.
  - Renderização e validação despacham para `renderStep2/readStep2`, `renderStep3/readStep3`, `renderStep4/readStep4` conforme etapa.

- Atualizado `frontend/assets/js/pages/create-farm/view.render.js`.
  - Adicionado reconhecimento específico de `category: "carreteis"` + `type: "rainstar"`.
  - Lista lateral `Carretéis` agora mostra badge/status próprio do carretel, separado de pivô/LineStar.
  - Estados suportados na lista:
    - `IRRIGANDO` azul, com velocidade e tempo restante quando disponíveis.
    - `PARADO POR SENSOR DE PARADA` amarelo.
    - `VELOCIDADE NÃO ATINGIDA` vermelho.
    - `DESCONECTADO` cinza.
    - `ESPERANDO CONEXÃO` cinza.
  - Métricas do card alinhadas aos prints: comprimento puxado da mangueira, pressão atual, sinal do modem, carga da bateria e última comunicação.

- Atualizado `frontend/assets/js/pages/mapa.js`.
  - `rainstar` deixou de ser tratado como pivô circular em `extractPivotData`.
  - Adicionada extração própria `extractRainstarData`.
  - Adicionado desenho próprio `drawRainstar` na camada `carretelLayer`.
  - Geometria Rainstar: faixa entre posição inicial e posição do carretel; trecho irrigado em azul e trecho restante em laranja.
  - Carretel desconectado sem coordenadas fica na lista, mas não aparece no mapa, conforme validação de engenharia.
  - Conectividade do Rainstar resolvida como 4G.
  - Contadores da categoria `Carretéis` agora agrupam pelos estados reais do Rainstar.

- Criados 5 carretéis mockados em `data/farms.json` e `frontend/data/farms.json`.
  - `MHP 10`: parado por sensor de parada, bateria 100%, sinal bom.
  - `MHP 11`: velocidade não atingida, bateria 100%, sinal bom.
  - `MHP 12`: desconectado, sem coordenada operacional no mapa, bateria 0%, sem sinal.
  - `MHP 28`: irrigando, 316.7 m puxados, 7.90 bar, sinal médio, bateria 92%, 20 m/h, 15:49 restante.
  - `MHP 37`: irrigando, 351.3 m puxados, 9.10 bar, sinal bom, bateria 100%, 17.5 m/h, 19:31 restante.
  - Todos usam dados fictícios e não pessoais (`machineAddress`/IMEI mockado, modem/SIM mockados).

- Atualizados dicionários i18n:
  - `frontend/assets/js/i18n/dict.js`
  - `frontend/assets/js/i18n/dict.es.js`
  - Incluídas traduções EN/ES dos novos textos, estados e labels do carretel.

Validação executada:

```bash
node --check frontend/assets/js/pages/equipamentos/rainstar.js
node --check frontend/assets/js/pages/create-equipment.js
node --check frontend/assets/js/pages/create-farm/view.render.js
node --check frontend/assets/js/pages/mapa.js
node --check frontend/assets/js/i18n/dict.js
node --check frontend/assets/js/i18n/dict.es.js
node -e "JSON.parse(require('fs').readFileSync('data/farms.json','utf8')); JSON.parse(require('fs').readFileSync('frontend/data/farms.json','utf8')); console.log('json ok')"
```

Resultado: sintaxe JS válida e JSON válido.

Pendências próximas:

1. Abrir a tela no navegador e validar visualmente lista lateral + mapa com os 5 carretéis.
2. Ajustar CSS fino caso algum badge/ícone fique fora do padrão dos prints.
3. Implementar tela de detalhes/cockpit do carretel.
4. Implementar modal `Iniciar Carretel` e comandos iniciar/desligar.
5. Implementar tela `Editar Carretel` com abas `Configurações` e `Histórico`.
6. Completar gráficos e histórico mockados da tela de detalhe.
7. Revisar responsividade desktop/mobile.

### 2026-09-11 — Continuação: tela inicial de detalhes

Feito:

- Criado `frontend/pages/carretel.details.html`.
  - Estrutura inicial baseada no padrão visual das telas de pivô/LineStar.
  - Inclui mapa pequeno, botão voltar, status, seletor de carretel, métricas principais, botões de ação, filtro de data, cards técnicos, histórico, horímetro total, horímetro diário e vazão.

- Criado `frontend/assets/js/pages/carreteis/index.js`.
  - Expõe `window.IcCarretel.open({ carretelId, fromMap })`.
  - Clique no card/mapa agora pode abrir a tela de detalhes.
  - Renderiza dados reais do mock selecionado: status, velocidade, tempo restante, pressão, sinal, bateria, firmware e última comunicação.
  - Seletor permite alternar entre os cinco carretéis mockados.
  - Mini mapa renderiza faixa do carretel com trecho irrigado azul e trecho restante laranja quando há coordenadas.
  - Modal inicial `Iniciar Carretel` criado no padrão do print, com alternância visual de velocidade/taxa ainda mockada.
  - Botões `Desligar Carretel` e `Editar` estão como ações mockadas até as próximas fases.

- Atualizado `frontend/index.html`.
  - Registrado script `./assets/js/pages/carreteis/index.js`.

- Atualizado `frontend/assets/css/pages/pivos.css`.
  - CSS inicial para cards KPI, gráficos mockados, grid da tela de carretel e modal `Iniciar Carretel`.

Validação executada:

```bash
node --check frontend/assets/js/pages/carreteis/index.js
node --check frontend/assets/js/pages/mapa.js
node --check frontend/assets/js/pages/create-farm/view.render.js
Invoke-WebRequest http://localhost:3000/pages/carretel.details.html
Invoke-WebRequest http://localhost:3000/assets/js/pages/carreteis/index.js
```

Resultado: sintaxe válida; HTML e JS servidos com HTTP 200 pela instância local na porta 3000.

Pendências atualizadas:

1. Validação visual manual no navegador após refresh.
2. Trocar ações mockadas por edição real e comando real/simulado de iniciar/desligar.
3. Implementar tela `Editar Carretel` completa.
4. Refinar gráficos e histórico para espelhar com mais fidelidade a plataforma antiga.
5. Adicionar traduções EN/ES dos textos específicos da nova tela de detalhes/modal.

### 2026-09-11 — Ajuste: carrossel de status em Carretéis

Feito:

- Atualizado `frontend/assets/js/pages/mapa.js`.
  - O agrupamento de status da categoria `Carretéis` agora usa o mesmo carrossel de badges já usado em `Medidores de Nível`.
  - Quando os badges de status dos carretéis não couberem no botão da categoria, eles entram em `map-card__toggle-counts is-scrolling` com `map-card__toggle-counts-track`, repetindo o padrão do exemplo validado pelo usuário.

Validação executada:

```bash
node --check frontend/assets/js/pages/mapa.js
```

Resultado: sintaxe válida.

### 2026-09-11 — Correção: create do carretel, carrossel geral e bomba em alerta

Feito:

- Corrigido `frontend/assets/js/pages/equipamentos/rainstar.js`.
  - O fluxo de criação do carretel voltou ao padrão validado nos prints da plataforma antiga: etapa `Equipamento` + etapa `Ficha Técnica`.
  - `Controles` deixou de ser uma etapa separada no create e voltou a ser uma seção interna da `Ficha Técnica`.
  - Campos técnicos principais ficam na mesma tela: nome, IMEI, método de configuração, modelo, taxa de fluxo, largura operacional, alcance, diâmetro do bocal, pressão ideal, correção de pressão e modo de irrigação.
  - Mantidos aliases antigos (`imei`, `method`, `flow`, `width`, `range`, `nozzle`, `pressure`, `pressureAdj`) para compatibilidade.

- Corrigido `frontend/assets/js/pages/create-equipment.js`.
  - `RAINSTAR_STEPS` agora é `["Equipamento", "Ficha Técnica"]`.

- Ajustado `frontend/assets/css/pages/create-equipment.css`.
  - Adicionado CSS específico para `rs-form--rainstar`, evitando que o conteúdo do create fique em linha e desconfigure o modal.
  - Grid da ficha técnica agora segue 2 colunas no topo e 3 colunas nos controles, com responsividade para 1 coluna.

- Atualizado `frontend/assets/js/pages/mapa.js`.
  - O carrossel de badges de status agora é aplicado a todas as categorias quando os badges não couberem no botão da categoria, não apenas em `Medidores de Nível` e `Carretéis`.
  - Criado `window.IcResolveBombaStatus` para padronizar status de bomba: alerta, ligada via internet e desligada.
  - Contadores de `Bombas` agora reconhecem alerta vermelho.

- Atualizado `frontend/assets/js/pages/create-farm/view.render.js`.
  - Card lateral de bomba agora usa `IcResolveBombaStatus` e consegue exibir `ALERTA` em vermelho.

- Atualizados mocks em `data/farms.json` e `frontend/data/farms.json`.
  - `Bomba 1` marcada como alerta/sem comunicação para validação visual.

Validação executada:

```bash
node --check frontend/assets/js/pages/equipamentos/rainstar.js
node --check frontend/assets/js/pages/create-equipment.js
node --check frontend/assets/js/pages/mapa.js
node --check frontend/assets/js/pages/create-farm/view.render.js
node -e "JSON.parse(require('fs').readFileSync('data/farms.json','utf8')); JSON.parse(require('fs').readFileSync('frontend/data/farms.json','utf8')); console.log('json ok')"
```

Resultado: sintaxe válida e JSON válido.

### 2026-09-11 — Card status carousel and alert coloring
- Fixed broken status text in the map equipment summary caused by corrupted `Nível` literals in `frontend/assets/js/pages/mapa.js`.
- Changed the equipment status summary so every category can use the badge carousel when badges overflow.
- Forced the carousel for Cosmofield when it has multiple status groups, matching the behavior expected for hidden status badges.
- Confirmed pump alert resolution uses `map-card__equip-badge--danger`, so pumps with `alerta`/communication failure show the same red alert badge pattern as the other equipment categories.
- Validation: `node --check` for `mapa.js`, `create-farm/view.render.js`, `carreteis/index.js`, `equipamentos/rainstar.js`, `create-equipment.js`; JSON parse for `data/farms.json` and `frontend/data/farms.json`.

### 2026-09-11 — Permanent UTF-8/mojibake guardrail
- Normalized existing mojibake across frontend source files, including broken map-card labels such as `Nível`, `Atenção`, `Sem comunicação`, weather station labels, em dashes, degree symbols and invisible control characters.
- Removed UTF-8 BOM markers from legacy JS/CSS/HTML files so JSON parsing and source rendering remain stable.
- Added `scripts/check-encoding.js` to fail on BOM, replacement characters, C1 controls, soft hyphens and common Latin-1/Windows-1252 mojibake markers.
- Added `npm run check:encoding` and wired it into `npm run build`.
- Added `.editorconfig` with `charset = utf-8` and LF endings to keep editors aligned.
- Validation passed: `npm run check:encoding`, `npm run build`, JS syntax checks for the affected map/rainstar/linestar/pivot/pluviometry files, and JSON parsing for project data files.

### 2026-09-11 — Seta de direção no mapa, padronização do create e ajuste da tela de detalhes

Feito:

- Atualizado `frontend/assets/js/pages/mapa.js` e `frontend/assets/css/pages/mapa.css`.
  - `drawRainstar` não desenha mais um ponto simples na posição do carrinho: quando há faixa (`hasLane`), o marcador agora é uma seta (`map-carretel-arrow`) apontando no sentido do movimento (da posição inicial em direção ao reel), no mesmo espírito do indicador de sentido de giro já usado no pivô.
  - Sem faixa (sem posição inicial válida), mantém o ponto simples como fallback.

- Corrigido `frontend/assets/js/pages/equipamentos/rainstar.js` (create).
  - Removido o campo `Modo de Irrigação` (início imediato / hora programada) do wizard de criação — esse campo não existe no create da plataforma antiga; ele pertence ao comando de iniciar o carretel (modal `Iniciar Carretel`) e, futuramente, à aba `Controles` da tela `Editar Carretel`.
  - `readStep2` mantém `irrigationMode: "immediate"` como valor padrão para não quebrar o shape de dados existente, só que sem input no create.
  - Removida a validação obrigatória do campo e a função `bindRadio`, que ficou sem uso.

- Completado o i18n do create e da tela de detalhes do carretel em `frontend/assets/js/i18n/dict.js` e `dict.es.js`.
  - Vários textos do create estavam sem tradução (ex.: `Largura operacional`, `Alcance`, `Diâmetro do Bocal`, `Pressão ideal`, `Correção de pressão`), o que fazia a tela ficar com PT-BR e EN misturados quando o idioma ativo não era `pt-BR`.
  - Mesma correção aplicada à tela de detalhes (`Filtro de data`, `Período:`, `Definir Posição Inicial`, `Pré-Irrigação`, `Pós-Irrigação`, `Horímetro Total`, `Horímetro Diário`, `Ecostar Online`, `Selecionar outro equipamento`) e ao modal `Iniciar Carretel` (`Ajuste os parâmetros...`, `Definir Velocidade`, `Definir Taxa de Irrigação`, `Você deseja agendar a execução?`, texto de aviso do modo de irrigação, `Iniciar`, `Nova conexão`, mensagens mockadas de desligar/editar).

- Corrigido `frontend/pages/carretel.details.html` e `frontend/assets/js/pages/carreteis/index.js`.
  - O botão `Definir Posição Inicial` estava travado com `disabled` fixo no HTML e sem handler nenhum — inconsistente com os outros dois botões de ação (`Iniciar Carretel`, `Desligar Carretel`), que já eram clicáveis mesmo mockados.
  - Removido o `disabled` e adicionado handler mockado (`alert` i18n) explicando que a posição inicial vem automaticamente do controlador Ecostar, no mesmo padrão dos outros dois botões.

Validação executada:

```bash
node --check frontend/assets/js/pages/equipamentos/rainstar.js
node --check frontend/assets/js/pages/mapa.js
node --check frontend/assets/js/pages/carreteis/index.js
node --check frontend/assets/js/i18n/dict.js
node --check frontend/assets/js/i18n/dict.es.js
```

Resultado: sintaxe válida. Servidor local (porta 3000) respondeu HTTP 200 para `carretel.details.html`, `carreteis/index.js`, `equipamentos/rainstar.js`, `dict.js` e `dict.es.js`.

Pendências (releitura do plano, nada mudou de fase desde o último log):

1. Validação visual manual no navegador (troca de idioma PT/EN/ES + os três botões de ação) ainda não foi feita por mim nesta sessão — peço para o usuário conferir.
2. `Desligar Carretel`, `Editar` e `Definir Posição Inicial` continuam mockados (`alert`), sem comando real nem tela de edição por trás.
3. Tela `Editar Carretel` (seção 6 do plano — abas `Configurações`/`Histórico`, padrão `edit-panel`) ainda não existe. É o maior item pendente do plano.
4. Gráficos (horímetro total/diário, vazão) e histórico continuam com dados estáticos mockados, sem refinamento adicional.
5. Revisão de responsividade desktop/mobile ainda não foi feita para as telas de carretel.

Ainda não há varredura completa de i18n para todo o restante da plataforma (pivô, bomba, estação, etc.) além do carretel — isso ficou registrado como pedido separado do usuário e será tratado por equipamento, um de cada vez, começando pelo pivô (maior volume de texto sem tradução, especialmente na grade de detalhes do histórico).

### 2026-09-11 — Weather station provider selector
- Updated the weather station create/config form to start with a required `provider` selector.
- Added Davis as the only available provider for now, with provider-specific Davis integration fields: equipment name, Davis ID, API key, station ID and API secret.
- Kept the data model future-ready by saving `provider`, `providerLabel` and `vendor` alongside the existing Davis fields.
- Added live formatting for Davis ID uppercase and station ID numeric-only.
- Added EN/ES i18n keys for the provider selector and provider integration note.
- Added visual provider note styling in the create-equipment CSS.
- Validation passed: `npm run check:encoding`, `npm run build`, JS syntax checks for the weather-station form, create-equipment flow and i18n dictionaries, plus JSON parsing for project data files.


### 2026-09-11 — Weather station provider UI cleanup
- Removed the green provider summary strip from the weather station create/config form.
- Renamed the visible Davis-specific identifier label to the generic `Provider ID` so the UI remains provider-agnostic for future integrations.
- Removed unused provider-note CSS.
- Validation passed: `npm run check:encoding` and JS syntax checks for the weather station form and i18n dictionaries.

### 2026-09-11 — Weather station provider selector, agora também no config/edição

Continuação do trabalho de outra sessão que fez a mudança apenas no create. Mesma alteração aplicada em `frontend/pages/estacao-meteorologica.html` (aba Configurações) e `frontend/assets/js/pages/estacoes/view.details.js`:

- Adicionado campo `Provedor` (select) na Ficha Técnica da edição, com `Davis` como única opção por enquanto, usando `data-equip-select` + `window.IcEquipSelectInit` (mesmo mecanismo do wizard de criação), sem precisar reescrever manualmente o widget de trigger/lista.
- Label `Identificação Davis` renomeado para `Provider ID` no formulário de edição e no grid de histórico (cabeçalho da tabela + itens expandidos), para ficar igual ao create.
- `normalizeEst` agora lê `data.provider` (default `"davis"`).
- `renderConfigForm` seta o valor do select `wsEditProvider` e chama `IcEquipSelectInit` para sincronizar o rótulo visível do widget.
- `buildSavePayload`/`applySave`/`persistEstPayload` agora carregam e persistem `provider`/`providerLabel` junto dos campos já existentes (`vendor` continua fixo como `"Davis"` já que é o único fornecedor implementado).
- Não foi adicionada nenhuma faixa verde de resumo (mesma decisão já tomada no create).

Validação executada:

```bash
node --check frontend/assets/js/pages/estacoes/view.details.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo. Servidor local (porta 3000) respondeu HTTP 200 para `estacao-meteorologica.html` e `estacoes/view.details.js`.

Pendência: validação visual manual no navegador (abrir uma estação existente, conferir que o seletor mostra "Davis" pré-selecionado e que salvar não quebra os dados já mockados).

### 2026-09-11 — Tela Editar Carretel (seção 6 do plano)

Maior item pendente do plano do carretel. Construída seguindo o padrão `edit-panel` já usado por Bomba/Repetidora (essas duas foram usadas como referência direta de estrutura), sem etapa de mapa/Localização (carretel não tem — posição vem do controlador Ecostar em runtime).

Feito:

- Criado `frontend/pages/carretel-edit.html`.
  - Header com Voltar, seletor de carretel (`edit-panel__select-field`) e botão Salvar — mesmo padrão de `bomba-edit.html`/`repetidora-edit.html`.
  - Aba `Configurações`, nav lateral `Geral` e `Controles`.
    - `Geral`: Endereço da máquina (readonly), Nome (obrigatório), toggle+duração+distância para Pré-Irrigação e Pós-Irrigação (campos de duração/distância desabilitados enquanto o toggle está off, mesmo padrão do "Habilitar sensor de pressão" da Bomba), e bloco `Zonas de Irrigação` com botão `Criar Zona` (mockado) e empty state `Nenhuma zona de irrigação cadastrada.` — não há nenhum precedente de "lista com create + empty state" no restante do código pra copiar 1:1, então usei um card com borda tracejada no mesmo espírito do empty state de Favoritos.
    - `Controles`: Método de configuração e Modelo (dropdowns `edit-panel__select-field` no mesmo padrão do campo "Tipo" da Repetidora — plain markup com trigger/list/hidden input, sem JS extra), Comprimento da mangueira, Largura de trabalho, Pressão mínima, Diâmetro do bico, Taxa de fluxo, Modo de Irrigação (dropdown 2 opções).
  - Aba `Histórico`, nav lateral `Histórico de Configurações` e `Favoritos`, ambos copiados do padrão exato da Bomba: tabela com Data/Usuário/Status (`Recebido`)/Ações, expandir/recolher detalhes por linha, favoritar/baixar por linha, paginação, e a aba Favoritos com o mesmo empty state `Nenhuma configuração favoritada.`.
  - Histórico mockado usa `bauer@irricontrol.com` como usuário, consistente com o resto da plataforma (identidade institucional mock, sem pessoa física).

- Criado `frontend/assets/js/pages/carreteis/edit.js` (`window.IcCarretelEdit.open({ carretelId })` / `.close()`).
  - Estrutura copiada de perto de `repetidoras/view.edit.js`: monta o HTML no `#pageSlot`, reusa a classe de body `is-pivo-details` (a mesma que `carretel.details.html` já usa — assim o `resetOverviewShell()` do `app.js` já sabe limpar essa tela ao trocar de rota, sem precisar mexer no `app.js`), liga tabs/nav/expand-row/dropdowns/seletor com os mesmos handlers genéricos por delegação de evento que Bomba/Repetidora usam.
  - `buildSavePayload`/`applySave`/`persistCrtPayload` seguem o mesmo formato de gravação em `data/farms.json` via `window.Cad.data.persistFarmDataset`, preenchendo tanto as chaves canônicas (`setupMethod`, `flowRate`, `workingWidth`, `minPressure`) quanto os aliases antigos (`method`, `flow`, `width`, `pressure`) que o resto do código do carretel já espera.
  - Toggle de Pré/Pós-Irrigação desabilita e limpa os campos de duração/distância quando desligado, mesmo padrão da Bomba.
  - Botão `Criar Zona` e o clique no seletor de carretel/edição seguem mockados/alertados onde ainda não há funcionalidade real, mesmo padrão já usado no resto do carretel.

- Registrado `./assets/js/pages/carreteis/edit.js` em `frontend/index.html`.
- O botão `Editar` da tela de detalhes (`carreteis/index.js`) agora fecha os detalhes e abre `IcCarretelEdit.open({ carretelId })` de verdade, em vez do alert mockado.
- Completo o i18n (pt-BR fonte + EN/ES) de todos os textos novos da tela em `dict.js`/`dict.es.js`: título, campos, dropdowns, tabela de histórico (incluindo as chaves com dois-pontos usadas nos detalhes expandidos), paginação estática (`10/20/50 / página` — texto que também estava faltando em Bomba/Repetidora/Medidor, então essas telas ganham a tradução de graça por reuso da mesma chave exata) e mensagens mockadas.

Validação executada:

```bash
node --check frontend/assets/js/pages/carreteis/edit.js
node --check frontend/assets/js/pages/carreteis/index.js
node --check frontend/assets/js/i18n/dict.js
node --check frontend/assets/js/i18n/dict.es.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo. Servidor local (porta 3000) respondeu HTTP 200 para `carretel-edit.html`, `carreteis/edit.js` e `index.html`.

Pendências:

1. Validação visual manual no navegador (abrir um carretel, editar, salvar, conferir troca de idioma).
2. Criação de zonas de irrigação continua mockada (sem modal/fluxo real).
3. Histórico da tela de edição continua com linhas mockadas fixas, não reflete ainda as edições reais feitas na tela.
4. Comando real (não mockado) de iniciar/desligar carretel e definir posição inicial seguem como próxima fase, junto com o restante do plano (fases 8/9: i18n completo do restante da plataforma e verificação responsiva).

### 2026-09-11 — Reposicionamento dos 5 carretéis mock + remoção dos Pivôs 27/28

A pedido do usuário, os 5 carretéis mock ganharam posições iniciais/finais reais fornecidas por ele, e os Pivôs 27 e 28 foram removidos para abrir espaço no mapa para essas novas posições.

Feito em `data/farms.json` e `frontend/data/farms.json` (script único aplicado aos dois arquivos, que continuam idênticos byte a byte):

- Atualizado `startLat`/`startLng`/`reelLat`/`reelLng` de `MHP 10`, `MHP 11`, `MHP 12`, `MHP 28` e `MHP 37`, na ordem em que o usuário enviou os 5 pares de coordenadas (posição inicial → posição do carretel/reel). `MHP 12`, que antes ficava sem coordenada operacional (desconectado, fora do mapa por design), passou a ter posição real também — não há mais motivo pra escondê-lo do mapa já que a regra era "sem posição válida", não "sempre sem posição".
- Removidos `Pivô 27` (`equip_1774977245512`) e `Pivô 28` (`equip_1774977264877`) da lista de equipamentos da fazenda.
- `Teste CF3` (Cosmofield que estava vinculado ao Pivô 28) teve `linkedPivotId`/`linkedPivotName` removidos do seu `data`, ficando desvinculado — a posição própria do Cosmofield (`lat`/`lng`) foi mantida sem alteração.
- Conferido que nenhum outro arquivo (ex.: `app-state.json`, `pivo-edit.html`) referencia os equipamentos removidos de forma que quebre em runtime: o seletor de pivô em `pivo-edit.html` é reconstruído dinamicamente a partir de `farms.json` por `renderPivotSelectorList()` (`pivos/view.edit.js`), então as duas opções estáticas remanescentes no HTML (`Pivô 27`/`Pivô 28`) nunca chegam a aparecer — são sobrescritas no primeiro render.

Validação executada:

```bash
node -e "JSON.parse(require('fs').readFileSync('data/farms.json','utf8')); JSON.parse(require('fs').readFileSync('frontend/data/farms.json','utf8')); console.log('json ok')"
npm run check:encoding
```

Resultado: JSON válido nos dois arquivos, ainda idênticos entre si, encoding limpo.

### 2026-09-11 — Causa raiz: servidor com cache em memória desatualizado

O usuário reportou que o mapa ainda mostrava os Pivôs 27/28 e os carretéis nas posições antigas, mesmo depois das edições em `data/farms.json`. Causa raiz identificada em `server/index.js`: as rotas `/api/farms` servem de `farmsCache`, uma cópia em memória lida do disco **uma única vez na inicialização** do processo (`farmsCache = await loadFarmsFromDisk()`). As edições diretas no JSON feitas via script nunca passaram por `writeFarms()`, então o servidor continuava respondendo com o snapshot antigo — o navegador busca `/api/farms` a cada troca de tela (`loadFarmDatasetUncached` em `cadastros/core.data.js`) e sincroniza isso para `localStorage.ic_farms`, então o problema se propagava para toda a sessão do navegador.

Correção: matei os processos `node server/index.js` / `npm start` antigos e subi um novo (`npm start` em background), forçando a releitura do `data/farms.json` atualizado. Confirmado via `curl http://localhost:3000/api/farms` que os Pivôs 27/28 já não aparecem e os 5 carretéis retornam as coordenadas corretas.

Também aproveitado para limpar `startLat/startLng/reelLat/reelLng` dos 5 carretéis: os registros de MHP 10/11/28/37 ainda carregavam `initialLat/initialLng/lat/lng` de quando eram tratados como pivô circular — não causavam bug (o `extractRainstarData` do `mapa.js` já prioriza `startLat`/`reelLat` corretamente), mas eram dados mortos e confusos numa área que está sob investigação ativa. Removidos dos dois `farms.json`.

**Nota para continuidade:** qualquer edição futura em `data/farms.json` feita por fora da própria aplicação (script direto, edição manual) só passa a valer depois de reiniciar o processo do servidor — ele não observa o arquivo. Rodar `node server/index.js` de novo (ou `npm start`) resolve.

### 2026-09-11 — Tela de detalhes usava classes CSS inexistentes ("está toda quebrada")

Investigação a fundo do relato "a tela de detalhes de carretel está toda quebrada". Causa raiz: `carretel.details.html` foi escrito usando vários nomes de classe que **nunca existiram em nenhum CSS do projeto** — provavelmente inventados por analogia em vez de checados contra o CSS real. Resultado: a maior parte da tela renderizava sem nenhum estilo (sem cards, sem espaçamento, sem cor de status, botão voltar cru, abas Eventos/Operações sem função).

Classes fantasmas encontradas e corrigidas (nenhuma tinha `grep` positivo em `frontend/assets/css`):

- `pivo-section-card`, `pivo-section-title`, `pivo-section-head` → trocados pelos reais `pivo-data-card` / `pivo-data-card__header` / `pivo-data-card__title` (mesmo padrão usado em `bomba.details.html`, `pivo.details.html`).
- `pivo-period-row`, `pivo-period-btn` → trocados pelo card real `pivo-agenda` / `pivo-agenda__header` / `pivo-agenda__title` / `pivo-agenda__period-btn.js-period-trigger` / `pivo-agenda__period-label`. Bônus: `.js-period-trigger` já tem um handler global delegado (`pluviometria/feature.periodPicker.js`) que abre o popover de calendário/presets — o filtro de data do carretel ganhou esse popover funcionando de graça, sem escrever nenhum JS novo.
- `pincard__content` → `pincard__info` (real).
- `pincard__metrics` / `pincard__metric` → renomeados para `carretel-metrics` / `carretel-metric` (não existe equivalente genérico reaproveitável — os KPIs em caixa do pivô, `pincard__kpi`, são visualmente outra coisa; o carretel usa uma listinha compacta de ícone+valor, como no print original). CSS novo adicionado em `pivos.css`.
- `pincard__actions-top` → estrutura errada desde a raiz: faltava o `pincard__side` (coluna da direita que empilha `pincard__actions` em cima e `pincard__controls` embaixo, real, `justify-content:space-between`). Corrigido para a estrutura real usada em `bomba.details.html`/`pivo.details.html`.
- `pincard__back-btn` → `minimap-back-btn` (real, botão flutuante posicionado sobre o minimapa).
- `pincard__status-bar.is-warning` e `.is-info` não tinham cor de fundo definida em lugar nenhum — os badges `PARADO POR SENSOR DE PARADA` (amarelo) e `IRRIGANDO` (azul) ficavam sem cor nenhuma. Adicionadas as duas variantes em `pivos.css` (`#d98c00` e `#3b82f6`, mesmas cores já usadas no mapa via `RAINSTAR_STATUS_VISUALS`).
- Estrutura do container: `pivo-right-column`/`pivo-card-container` fechavam logo depois do cockpit (`pincard`), deixando Filtro de data, KPIs, Histórico e gráficos fora do container — sem o `gap:12px` entre cards nem o `max-width` do container. Movida a fechada da div pra o final do arquivo, envolvendo tudo (mesmo padrão de `bomba.details.html`).

Verificação sistemática: rodado um script que extrai toda classe usada em `carretel.details.html` e confere contra o CSS real, uma por uma — hoje 0 classes inventadas restantes (as 4 sem CSS próprio — `carretel-chart--bars`, `carretel-view`, `comm-label`, `pincard__status-text` — são ganchos semânticos que herdam estilo do pai/contexto de propósito, não bugs).

Também corrigido: as abas `Eventos`/`Operações` do histórico não tinham handler de clique nenhum (`data-carretel-history-tab` nunca era lido em `carreteis/index.js`) — clicar em "Operações" não fazia nada. Adicionado o bind do clique + uma função `renderHistory` que troca cabeçalho e linhas da tabela conforme a aba (Operações mostra Início/Fim/Comprimento puxado, mockado).

Arquivos alterados: `frontend/pages/carretel.details.html`, `frontend/assets/css/pages/pivos.css`, `frontend/assets/js/pages/carreteis/index.js`.

Validação executada:

```bash
node --check frontend/assets/js/pages/carreteis/index.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, HTTP 200 pra `carretel.details.html`, `carreteis/index.js` e `pivos.css`. Passo de auditoria sistemática de classes CSS (extrair todas do HTML e comparar contra o CSS real) não acusou mais nenhuma classe inventada.

Pendência: validação visual manual no navegador — o F5 do usuário agora deve puxar dados corretos da API (`/api/farms`) e a tela de detalhes deve renderizar com os cards estilizados, mas ainda não vi isso rodar num navegador de verdade nesta sessão.

### 2026-09-11 — Minimapa da tela de detalhes agora reaproveita o desenho do mapa principal

Pedido do usuário: o minimapa da tela de detalhes deve ficar visualmente idêntico ao desenho do carretel na visão geral (faixa com as cores de status + seta de direção), não uma versão simplificada à parte.

Causa: `initMinimap()` em `carreteis/index.js` tinha sua própria lógica de desenho, escrita antes da faixa em polígono e da seta de direção existirem no mapa principal — usava só duas polylines grossas (azul/laranja fixas) e um círculo branco, sem nenhuma cor de status real e sem a seta.

Correção — extraída a lógica de desenho pura do `drawRainstar` em `frontend/assets/js/pages/mapa.js` para uma função reaproveitável:

- Nova função `drawRainstarLane(targetLayer, rainstar, visual)` em `mapa.js`, exposta como `window.IcDrawRainstarLane`. Recebe a layer/mapa de destino em vez de usar a `carretelLayer` fixa, e devolve os layers criados (faixa em polígono com cor de status, linha central, seta de direção ou ponto se não houver faixa) sem vincular tooltip/clique — isso fica por conta de quem chama, já que o mapa principal precisa de tooltip+clique e o minimapa não.
- `drawRainstar` (mapa principal) agora só resolve `visual`/`tooltipHtml` e chama `drawRainstarLane`, sem duplicar a lógica de desenho.
- `extractRainstarData` também exposta como `window.IcExtractRainstarData` (antes só existia dentro do escopo do módulo do mapa).
- `initMinimap()` em `carreteis/index.js` reescrita para usar `window.IcExtractRainstarData(equip)` + `window.IcResolveRainstarStatus(equip)` + `window.IcDrawRainstarLane(minimap, rainstar, visual)` — o minimapa agora desenha exatamente a mesma faixa colorida por status e a mesma seta de direção do mapa principal, com uma única fonte de verdade pro desenho.
- Removida a função `haversine` de `carreteis/index.js`, que ficou sem uso depois da troca (o cálculo de distância agora vem de dentro do `extractRainstarData` compartilhado).

Também corrigido, como parte do pedido "o padrão não está 100% seguido": `.carretel-grid` e `.carretel-flow-card` tinham `margin-top: 16px` fixo — isso era necessário quando esses cards ainda estavam fora do `pivo-right-column` (container com `gap: 12px` que faz o espaçamento entre cards em todas as outras telas). Agora que o container engloba tudo (correção da sessão anterior), esse `margin-top` duplicava o espaçamento e deixava o gap entre cards inconsistente com o resto da plataforma. Removido dos dois.

Arquivos alterados: `frontend/assets/js/pages/mapa.js`, `frontend/assets/js/pages/carreteis/index.js`, `frontend/assets/css/pages/pivos.css`.

Validação executada:

```bash
node --check frontend/assets/js/pages/mapa.js
node --check frontend/assets/js/pages/carreteis/index.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, HTTP 200 pros três arquivos.

Pendência: validação visual manual — abrir um carretel com faixa (ex.: MHP 28 ou MHP 37, que estão irrigando) e conferir que o minimapa mostra a mesma faixa/seta colorida que aparece na visão geral do mapa. Ainda não vi isso rodar num navegador de verdade.

### 2026-09-11 — Botão "Definir Posição Inicial" sem estilo nenhum

Causa: `.pincard__control-btn` (classe base dos três botões de ação do cockpit) não tem nenhuma cor/borda própria — só os modificadores `.is-start` (verde) e `.is-stop` (vermelho) têm estilo definido. Em todas as outras telas (Pivô, SmartTouch, Bomba, LineStar, Centerstar) só existem esses dois botões; o Carretel é o único com um terceiro botão ("Definir Posição Inicial") sem nenhum desses dois modificadores — então ele renderizava com a aparência crua padrão do navegador, destoando dos outros dois.

Correção: adicionado `.pincard__control-btn.is-neutral` em `pivos.css` (fundo branco, borda `#d1d5db`, texto `#4b5563`, hover verde `#16a34a` — mesma linguagem visual do botão secundário `.pincard__btn-text` já usado no "Editar"), e aplicada a classe no botão em `carretel.details.html`.

Validação: `npm run check:encoding`, brace-balance do CSS, HTTP 200 para `pivos.css` e `carretel.details.html`.

### 2026-09-11 — MHP 10 (PARADO POR SENSOR DE PARADA) parado no meio da faixa

Pedido do usuário: o carretel com esse status deveria aparecer como se tivesse irrigado e parado no meio da área, não com `pulledPipeLength: 0` (que deixa o carrinho grudado na posição inicial, sem faixa irrigada nenhuma no mapa).

Calculada a distância real entre `startLat/startLng` e `reelLat/reelLng` de `MHP 10` (~1554m, com as coordenadas novas) e ajustado `pulledPipeLength`/`hosePulledLength` de `0` para `780` (~50% do percurso) em `data/farms.json` e `frontend/data/farms.json`. Com isso `extractRainstarData` (mapa.js) calcula `progress ≈ 0.5`, e o carrinho/seta aparecem parados no meio da faixa, com metade irrigada (azul) e metade restante (laranja/amarelo do status).

Servidor reiniciado (mesma causa raiz já documentada: `farmsCache` só lê o disco na inicialização) e confirmado via `curl /api/farms` que `pulledPipeLength` já vem `780` para o `MHP 10`.

Validação: `node -e "JSON.parse(...)"` nos dois arquivos, `curl /api/farms` confirmando o valor novo.

### 2026-09-11 — Faixa irrigada do PARADO POR SENSOR DE PARADA deveria ficar azul

Pedido do usuário: como o MHP 10 parou no meio da operação (não antes de começar), o trecho já irrigado deve continuar azul (mesma cor de "irrigando"), só o trecho restante deve ficar laranja/amarelo.

Causa: em `RAINSTAR_STATUS_VISUALS` (`mapa.js`), `stopped_stop_sensor` tinha `fill` e `remainingFill` iguais (`#d98c00`, laranja) — a faixa inteira ficava laranja, como se nada tivesse sido irrigado.

Correção: `fill` do `stopped_stop_sensor` mudado pra `#3b82f6` (mesmo azul do `irrigating`), mantendo `remainingFill: "#d98c00"`. Pra não perder o sinal de alerta na posição exata onde parou, adicionado um campo novo `markerFill` (usado só pela seta/ponto do carrinho, não pela faixa) — `stopped_stop_sensor.markerFill = "#d98c00"`, então a seta continua laranja (alerta) mesmo com a faixa atrás dela agora azul. `drawRainstarLane` atualizado pra usar `visual.markerFill || visual.fill` na cor da seta/ponto.

Arquivo alterado: `frontend/assets/js/pages/mapa.js` (é JS estático, sem cache do servidor — não precisou reiniciar nada).

Validação: `node --check`, `npm run check:encoding`, HTTP 200.

### 2026-09-11 — Etapa/seção Conectividade no create e no edit (padrão SmartTouch), IMEI relocado

Pedido: create do carretel precisa de uma etapa final "Conectividade" replicando a do SmartTouch; a mesma seção deve existir no Editar Carretel; o campo IMEI/endereço da máquina sai da Ficha Técnica porque agora mora só na Conectividade. Depois de uma primeira versão com campos extras (Tecnologia, ID do modem, ICCID do SIM, Versão do Firmware), o usuário confirmou que a etapa deve ter **apenas** o campo "ID do equipamento", igual ao SmartTouch — sem nada além disso. Versão final:

- `frontend/assets/js/pages/create-equipment.js`: `RAINSTAR_STEPS` passa de `["Equipamento", "Ficha Técnica"]` para `["Equipamento", "Ficha Técnica", "Conectividade"]`. O dispatch para `rainstar`/label `"Conectividade"` → `renderStep4`/`readStep4`/`validateStep4` **já existia** no arquivo desde a versão original de 4 etapas (nunca foi removido no revert) — não precisou mexer no dispatch, só implementar os métodos em `rainstar.js` e ligar o array de steps.
- `frontend/assets/js/pages/equipamentos/rainstar.js`:
  - Removido o campo "IMEI (ID único)" do `renderStep2`/`bindStep2`/`readStep2`/`validateStep2` (Ficha Técnica).
  - `renderStep4` novo: só o campo "ID do equipamento", no componente real `farm-radio-field` (com clear/check/QR, mesma estrutura usada por SmartTouch/Pivô/Bomba) — nada de campo extra.
  - `machineAddress`/`imei` viram obrigatórios em `validateStep4` em vez de `validateStep2`.
- `frontend/pages/carretel-edit.html`: removido o campo solto "Endereço da máquina" da aba Geral; adicionada seção `<h3>Conectividade</h3>` no topo da aba Geral (mesmo padrão de Bomba/SmartTouch — sub-seção dentro de Geral, não uma aba nova) com o mesmo `farm-radio-field` de "ID do equipamento", reaproveitando o id `crtEditMachineAddress` (zero mudança de wiring necessária no JS pra esse campo).
- `frontend/assets/js/pages/carreteis/edit.js`: adicionado bind do botão `.farm-radio-clear` pro campo de ID do equipamento. (Uma versão intermediária chegou a adicionar leitura/gravação de `modemId`/`simIccid`/`firmwareVersion` — revertida por completo depois do usuário pedir só o campo único; conferido que não sobrou nenhuma referência morta a esses três campos em nenhum dos três arquivos.)
- i18n: nenhuma entrada nova precisou ser criada — "ID do equipamento", "Limpar" e "Escanear QR Code" já estavam traduzidos em `dict.js`/`dict.es.js` de outros equipamentos.

Validação executada:

```bash
node --check frontend/assets/js/pages/equipamentos/rainstar.js
node --check frontend/assets/js/pages/create-equipment.js
node --check frontend/assets/js/pages/carreteis/edit.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, HTTP 200 pros arquivos de create/edit do carretel, zero ocorrências residuais de `modemId`/`simIccid`/`firmwareVersion`.

## Fila registrada — pedidos ainda não iniciados (aguardando esta etapa terminar)

Por pedido do usuário, disparados em sequência enquanto a etapa acima estava em andamento. Cada um só entra em execução depois do anterior estar pronto e validado — não trabalhar em paralelo/intercalado:

1. **Ícone quebrado + padrão visual do cockpit** — botão "Informações" usava `fa-regular fa-circle-info` (não existe no free tier do Font Awesome; toda outra ocorrência no projeto usa `fa-solid`) — **já corrigido** nesta sessão. Usuário quer revisão mais ampla de cores/disposição comparando com Pivô; disse que vai mandar mais referência visual de "como tem que ser".
2. **Seletor "Geral" no card Histórico, habilitado só na aba Eventos** — HTML/CSS do botão já adicionados (`#carretelHistoryFilterBtn`, `.pivo-history__filter-btn` com estado `:disabled`); falta ligar a lógica de habilitar/desabilitar conforme a aba ativa em `carreteis/index.js`.
3. **Tabela de Operações com as colunas reais** (Início/Fim/Hora de Pico/Total/Lâmina d'água/Modo/Motivo da Parada/Talhão, com estado vazio "Não há dados" + ícone) — reconstruir `renderHistory()` pra essas colunas; div de empty state já adicionada no HTML (`#carretelHistoryEmpty`), falta a lógica JS de mostrar/esconder e a tabela vazia por padrão em vez das 3 colunas mockadas que existem hoje.
4. **Padronizar o modal "Iniciar Carretel"** para usar o componente real `.op-modal` (mesmo usado por `bmbdStartModal` da Bomba) em vez do `.carretel-modal` customizado atual.
5. ~~Clique no carretel no mapa principal deve respeitar `localStorage['ic:pivot-click-action']`~~ — **feito**, ver log abaixo.
6. **Gráficos de Horímetro Total, Horímetro Diário e Vazão com dados mock reais e funcionais** — hoje são só decoração CSS estática (uma linha/barras fixas via CSS, sem nenhum dado por trás). Criar mock de série temporal e desenhar via SVG inline (mesmo padrão usado em `bomba.details.html` — `bmbd-mini-chart`, `pivo-chart-container`, paths SVG à mão), não uma lib nova.

Itens 1-4 e 6 continuam na fila, ainda não iniciados.

### 2026-09-11 — Clique no carretel no mapa respeita a config "o que fazer com o pivô" (item 5 da fila)

Pedido do usuário: "primeiro clique no carretel abrir modal de operação como em pivôs" — clicar no carretel no mapa principal deve respeitar a mesma configuração `localStorage['ic:pivot-click-action']` já usada por Pivô/LineStar/Bomba ("details" vs "schedule"), e o modal de operação (`Iniciar Carretel`) precisa ter uma opção "Detalhes" pra chegar na tela de detalhes a partir dele.

Feito:

- `frontend/assets/js/pages/mapa.js`: handler de clique do `drawRainstar` reescrito para seguir exatamente o mesmo padrão já usado por Pivô/Bomba — checa `IcEquipmentDeleteShortcut.handleMapClick` primeiro (mesmo guard de todos os outros equipamentos clicáveis no mapa), lê `localStorage['ic:pivot-click-action']` (mesma chave, reaproveitada de propósito — não criei uma chave separada pro carretel), e quando é `"schedule"` chama `window.IcCarretel.openStartModal(equip)` em vez de abrir os detalhes.
- `frontend/assets/js/pages/carreteis/index.js`: `openStartModal` (antes só uma função interna, chamada apenas pelo botão "Iniciar Carretel" da tela de detalhes) agora também é exposta em `window.IcCarretel.openStartModal`, reutilizável a partir do clique no mapa.
- Adicionado botão "Detalhes" no cabeçalho do modal `Iniciar Carretel` (ao lado do X de fechar), no mesmo lugar/estilo que o `OpModal` do pivô usa (`op-modal__details-btn`, do lado do fechar, só aparece quando há um `pivotId`/`equip.id`). Clicar fecha o modal e abre `IcCarretel.open({ carretelId, fromMap: true })`.
- CSS novo em `pivos.css`: `.carretel-modal__header-actions` (wrapper flex absolutamente posicionado no canto do modal, substituindo o posicionamento solto que só o X tinha antes) e `.carretel-modal__details-btn` (link azul simples, mesma paleta do `op-modal__details-btn` legado — não usei as classes `.op-modal__*` porque o modal do carretel ainda é o `.carretel-modal` customizado; padronizar pro componente real `.op-modal` continua sendo o item 4 da fila, separado).
- i18n: "Detalhes" já estava traduzido (usado em várias outras telas), nenhuma entrada nova precisou ser criada.

Validação executada:

```bash
node --check frontend/assets/js/pages/mapa.js
node --check frontend/assets/js/pages/carreteis/index.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, HTTP 200 pra `mapa.js`, `carreteis/index.js` e `pivos.css`.

Pendência: validação visual manual (clicar num carretel no mapa com a config em "schedule" e conferir que abre o modal certo, e que o botão Detalhes funciona).

### 2026-09-11 — Modal "Iniciar Carretel": abas Velocidade/Taxa funcionais + toggle no padrão da plataforma

Pedido do usuário, com print de referência: clicar em "Definir Velocidade"/"Definir Taxa de Irrigação" deve habilitar o campo correspondente e desabilitar o outro (hoje os dois ficavam sempre editáveis, sem relação nenhuma com a aba selecionada); o toggle de "Você deseja agendar a execução?" tinha um checkbox HTML cru em vez do switch padrão da plataforma.

Feito em `frontend/assets/js/pages/carreteis/index.js` (`openStartModal`):

- Abas ganharam `data-op-tab="speed"/"rate"`, os campos ganharam `data-op-field="speed"/"rate"`. Clique na aba alterna `.is-active` nela e `.is-disabled` + `input.disabled` no campo correspondente — só um fica editável por vez, exatamente como no print de referência (Velocidade editável por padrão, Taxa de Irrigação cinza/desabilitada até trocar de aba).
- Checkbox cru do agendamento trocado pelo componente real `.pivo-edit__switch` (mesmo toggle usado em Pré/Pós-Irrigação no Editar Carretel e no resto da plataforma). Ligado o campo "Hora" a esse toggle: habilita/desabilita junto.
- Toggle de agendamento só vem habilitado quando `data.irrigationMode === "scheduled_start"` — combina com o texto de aviso logo abaixo ("O Modo de Irrigação deve estar configurado como Hora de início programada para usar o agendamento").
- Campo "Hora" reestruturado pro mesmo padrão de caixa com borda dos campos de Velocidade/Taxa (label > span > input + sufixo), com ícone de relógio (`fa-regular fa-clock`) no lugar da unidade, batendo com o print.
- CSS novo em `pivos.css`: `.is-disabled` para os campos da operação (fundo cinza, texto acinzentado) e ajustes de `.carretel-modal__time-field`/`.carretel-modal__time` pro novo formato em caixa.

Validação executada:

```bash
node --check frontend/assets/js/pages/carreteis/index.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, HTTP 200 pra `carreteis/index.js` e `pivos.css`.

Pendência: validação visual manual (abrir o modal, alternar as abas, ligar o toggle de agendamento e conferir que o campo Hora libera).

### 2026-09-11 — Correção: toggle do modal quebrado por vazamento de CSS

Usuário reportou "esse modal ficou ruim" depois da mudança anterior. Causa raiz encontrada por inspeção de especificidade CSS (sem acesso a navegador): `.carretel-modal label { display: grid; ... }` e `.carretel-modal label span { border: 1px solid; border-radius: 5px; ... }` foram escritas pensando só nos campos Velocidade/Taxa/Hora, mas são seletores genéricos — batem em **qualquer** `<label>`/`<span>` dentro de `.carretel-modal`, inclusive o `<label class="pivo-edit__switch">` que acabei de introduzir pro toggle de agendamento.

`.pivo-edit__switch` (definido em `pivo-edit.css`) precisa de `position:relative; display:inline-block;` no label e `position:absolute` no `.pivo-edit__switch-slider` pra funcionar como pílula com bolinha deslizante. Como `.carretel-modal label span` tem especificidade maior que `.pivo-edit__switch-slider` sozinho, ela vencia e substituía o slider por uma caixa com borda quadrada — o toggle ficava visualmente quebrado.

Correção em `pivos.css`: os seletores genéricos agora excluem o switch e o checkbox explicitamente — `.carretel-modal label:not(.pivo-edit__switch)`, `.carretel-modal label:not(.pivo-edit__switch) span`, `.carretel-modal input:not([type="checkbox"])`. Os campos Velocidade/Taxa/Hora continuam com o mesmo visual de caixa; o toggle de agendamento agora usa o CSS real do `.pivo-edit__switch` sem interferência.

Validação: brace-balance do CSS, `npm run check:encoding`, HTTP 200 pra `pivos.css`.

### 2026-09-11 — Correções pontuais no modal (leitura errada de print + specificidade CSS)

Errei a leitura de um print e removi o botão "Detalhes" do cabeçalho (ele tinha que ficar). Restaurado.

Bugs reais de CSS por especificidade genérica (mesma classe de problema do toggle, mas em outros dois pontos):
- `<span class="carretel-modal__field-label">` (o texto "Velocidade"/"Taxa de Irrigação") caía na regra genérica `.carretel-modal label span` e ganhava caixa com borda própria — virava uma segunda caixinha em cima da caixa do input, em vez de um rótulo simples. Corrigido excluindo `.carretel-modal__field-label` desse seletor.
- `.carretel-modal__schedule` virou `<div>` (deixou de ser `<label>`) quando o toggle real foi adicionado, então parou de herdar o `font-size:12px` da regra genérica de label — o texto "Você deseja agendar a execução?" ficou no tamanho de fonte padrão do navegador (maior). Corrigido com `font-size`/`color` explícitos na própria `.carretel-modal__schedule`.

Validação: `node --check`, brace-balance do CSS, `npm run check:encoding`, HTTP 200.

### 2026-09-11 — Toggle de agendamento não ligava

Eu tinha deixado o toggle `disabled` a menos que `data.irrigationMode === "scheduled_start"` — nenhum dos 5 carretéis mock tem esse modo (todos são `"immediate"`), então o toggle nunca podia ser ligado em nenhum equipamento de teste. Removida essa trava (não era pedido, foi inferência minha em cima do texto informativo abaixo do toggle). Toggle agora sempre interativo; o texto avisando sobre o Modo de Irrigação continua ali só como informação.

### 2026-09-11 — KPIs do cockpit padronizados com o componente real `.pincard__kpis`

Item 1 da fila: padronizar a disposição das informações no cockpit do carretel comparando com Pivô/Bomba. A lista vertical de ícone+texto (`.carretel-metrics`/`.carretel-metric`, classes inventadas só pro carretel) foi trocada pelo componente real e compartilhado `.pincard__kpis` / `.pincard__kpi` / `.pincard__kpi-icon` / `.pincard__kpi-val` / `.pincard__kpi-lbl` — o mesmo usado por Pivô (6 KPIs) e Bomba (3 KPIs). Detalhe do componente real que eu não conhecia até ler o CSS: `.pincard__kpi-lbl` é um **tooltip que só aparece no hover**, não um rótulo sempre visível — o valor (`.pincard__kpi-val`) fica sozinho ao lado do ícone por padrão.

- `frontend/pages/carretel.details.html`: os 4 metrics (comprimento puxado, pressão, sinal, bateria) agora usam a estrutura real, com os textos de tooltip reaproveitando strings que já existiam traduzidas (`Comprimento puxado da mangueira`, `Pressão Atual`, `Sinal do Modem`, `Carga da Bateria` — mesmas usadas no tooltip do mapa). IDs mantidos (`carretelPulled`, `carretelPressure`, `carretelSignal`, `carretelBattery`), então `carreteis/index.js` não precisou de nenhuma mudança.
- `frontend/assets/css/pages/pivos.css`: removidas as classes `.carretel-metrics`/`.carretel-metric` (mortas depois da troca, confirmado que não sobrou nenhum outro uso no projeto).
- Nota: `.pincard__kpis` tem regras de grid fixas por `nth-child` pensadas pra 3 ou 6 itens (comentário no CSS: "grid 3×2"); com exatamente 4 itens (caso do carretel) o layout fica 3 na primeira linha + 1 sozinho na segunda — mesmo assim mais alinhado ao padrão real da plataforma do que a lista vertical customizada de antes.

Validação: HTML legível, brace-balance do CSS, `npm run check:encoding`, HTTP 200, varredura de classes (nenhuma nova classe inventada sem CSS).

### 2026-09-11 — Minimapa da tela de detalhes: dois bugs reais corrigidos

Usuário reportou "o minimapa do detalhes dá uma bugada e não carrega". Dois bugs de verdade encontrados por leitura de código:

1. **Mapa Leaflet reaproveitado depois de destruído.** `carreteis/index.js` guarda `minimap` numa variável de módulo, mas a tela de detalhes é remontada do zero a cada `IcCarretel.open()` (`slot.innerHTML` novo — o `<div id="carretelMinimap">` antigo é destruído e um novo é criado). O `close()` nunca zerava `minimap`, então na segunda vez que a tela abria, o código via `minimap` não-nulo e pulava a criação de um novo `L.map()` — ficava tentando desenhar num mapa Leaflet fantasma, preso a um elemento que não existe mais no DOM, enquanto o `<div>` novo na tela ficava em branco pra sempre. Corrigido em dois pontos: `close()` agora destrói o mapa (`minimap.remove()`) e zera a variável; `initMinimap()` também checa se o container do mapa guardado ainda é o mesmo elemento que está na tela agora (`minimap.getContainer() !== el`) e recria se não for — cobre o caso de navegação pela sidebar, que reseta a tela sem passar pelo `close()` do carretel (confirmado nesta sessão que `app.js` faz isso direto, sem chamar `IcCarretel.close()`).
2. **Tile de satélite usando endpoint não-oficial do Google** (`https://{s}.google.com/vt/lyrs=s&...`), que não é suportado publicamente pelo Google e falha de forma inconsistente (403, bloqueio por referer, etc.). Todo o resto da plataforma (mapa principal em `mapa.js`, minimapas de Repetidora/Pivô/Bomba) usa o tile confiável do ArcGIS (`server.arcgisonline.com/.../World_Imagery/...`). Trocado o carretel pro mesmo endpoint.

Validação: `node --check`, `npm run check:encoding`, HTTP 200.

Pendência: validação visual (abrir detalhes, voltar, abrir de novo — inclusive trocando de carretel pela sidebar — e conferir que o minimapa carrega toda vez).

### Nota — convenção de nomes de classe usadas nas telas do carretel

Registrado a pedido do usuário, que notou classes com prefixo `pivo-`/`pincard` nos arquivos do carretel e questionou se isso não deveria ser documentado com mais clareza. Esclarecendo pra não confundir leitura futura do código/log:

- **Classes com prefixo `pivo-`/`pincard` NÃO são exclusivas do Pivô** — são componentes compartilhados de toda a plataforma, batizados assim porque o Pivô foi o primeiro equipamento construído. Confirmado por grep: `.pincard`, `.pivo-data-card`, `.pivo-history__table`, `.pivo-agenda`, `.pivo-bottom-row`, `.pivo-selector`, `.pivo-edit__switch` etc. já aparecem em 8-9 telas diferentes (Bomba, Medidor, LineStar, SmartTouch, Centerstar, Pluviômetro, Estação, Pivô e Carretel). Foi justamente reaproveitar esses componentes reais que corrigiu o bug original desta sessão ("a tela de detalhes está toda quebrada") — o carretel tinha classes **inventadas só pra ele com nome parecido** (`pivo-section-card`, `pivo-period-row`) que não existiam em nenhum CSS do projeto.
- **Classes exclusivas do carretel usam o prefixo `carretel-`**: `.carretel-kpi`/`.carretel-kpis`, `.carretel-chart`/`.carretel-chart-stack`, `.carretel-modal` (e todos os `.carretel-modal__*`), `.carretel-grid`, `.carretel-flow-card`. Essas sim só existem no CSS do carretel.
- **Arquivos** já seguem a convenção certa desde o início: `carretel.details.html`, `carretel-edit.html`, `frontend/assets/js/pages/carreteis/index.js`, `frontend/assets/js/pages/carreteis/edit.js` — nenhum arquivo do carretel tem "pivo" no nome.

Não fiz nenhuma renomeação de classe compartilhada — isso quebraria as outras 8 telas que dependem dela e recriaria o mesmo problema de fragmentação que motivou a correção original. Se o pedido for especificamente sobre isso (ex.: duplicar CSS pra namespace só do carretel), preciso de confirmação explícita antes, já que é uma mudança de escopo bem maior e vai contra o princípio do próprio plano ("usar o padrão atual da plataforma").

### 2026-09-11 — Histórico: linhas compactas, seletor "Geral" funcional, gráficos reorganizados

Três pedidos do usuário com prints de referência, tratados juntos:

1. **Linhas do histórico muito altas/espaçadas.** Print de referência mostrava ~15 linhas no mesmo espaço vertical onde antes cabiam ~3. Adicionada classe `pivo-history__table--dense` (escopada só pra essa tabela — não mexi no `.pivo-history__table` genérico usado por Pivô/Bomba/etc., não fui autorizado a alterar o padrão deles): `padding: 8px 16px` em vez de `12px 16px`, e o botão de expandir (`+`/`-`) perdeu o círculo com borda, virando só o glifo, batendo com o print.
2. **Seletor "Geral" era só um botão estático.** Virou um dropdown de verdade: `frontend/pages/carretel.details.html` ganhou `#carretelHistoryFilter` com menu (`#carretelHistoryFilterMenu`) e as 3 opções vistas no print do usuário — `Geral`, `Protocolo`, `Tabela de Protocolo` (essa combinação de opções não existe em nenhum outro lugar do projeto pra copiar; construída do zero com o padrão visual de dropdown já usado noutros menus da plataforma). `carreteis/index.js` liga abrir/fechar, seleção, texto do botão, e mantém a trava "habilitado só na aba Eventos" pedida antes (desabilita ao trocar pra Operações). A lógica de filtragem em si (o que "Protocolo"/"Tabela de Protocolo" fariam de diferente) não foi implementada — não há como saber o comportamento real sem mais contexto; hoje só troca o rótulo do botão.
3. **Gráficos: manter só Horímetro Diário e Vazão, os dois ao lado da tabela de Histórico/Operações.** Removido o card "Horímetro Total" (não tinha dado nenhum por trás mesmo, era decoração CSS). `Vazão` saiu de baixo (card solto de largura total) e entrou na pilha lateral (`.carretel-chart-stack`) ao lado do Histórico, junto com Horímetro Diário. CSS morto removido (`.carretel-flow-card` não é mais referenciada em nenhum HTML).

Arquivos alterados: `frontend/pages/carretel.details.html`, `frontend/assets/css/pages/pivos.css`, `frontend/assets/js/pages/carreteis/index.js`.

Validação executada:

```bash
node --check frontend/assets/js/pages/carreteis/index.js
npm run check:encoding
```

Resultado: sintaxe válida, HTML legível, brace-balance do CSS, encoding limpo, HTTP 200 nos três arquivos. Varredura de classes repetida — nenhuma classe nova sem CSS (só os mesmos 6 ganchos semânticos intencionais já catalogados antes).

Pendência: validação visual (densidade das linhas, abrir/fechar o dropdown Geral/Protocolo/Tabela de Protocolo, novo layout dos 2 gráficos ao lado da tabela).

### 2026-09-11 — Bug fora do escopo do carretel: SmartTouch/UniversalTouch, Step "Localização" quebrado em inglês/espanhol

Fora do plano do carretel, mas investigado na mesma sessão a pedido do usuário (relato da engenharia de que "sumiu a location"). Não tem relação com a remoção da Localização da Estação Meteorológica (commit `1d5de77`, anterior a esta sessão, escopado corretamente só pra `estacao_metereologica` — confirmado por `git show --stat` e leitura do diff, nenhum código compartilhado tocado).

Causa raiz real, em `frontend/assets/js/pages/equipamentos/smarttouch.js`: `renderStep2` (a etapa "Localização" do create de SmartTouch/UniversalTouch, `FOUR_STEPS_ST`) decidia o que renderizar lendo o **texto já traduzido** do breadcrumb ativo (`getActiveStepLabel()` → `.create-equip__step-label` → `textContent`) e comparando com a string fixa `"Localização"`. Em pt-BR o texto do breadcrumb continua "Localização" (sem tradução aplicada) e a comparação batia; em en/es o texto vira "Location"/"Ubicación", a comparação falha, e a função caía no `else` e renderizava `renderConfigStep` (Ficha Técnica) no lugar — daí o usuário ver raio/velocidade/autorreversão/modo de operação onde deveria estar o mapa/coordenadas.

O dispatch em `create-equipment.js` (`if (selectedType === "smarttouch" && label === "Localização")`) já usa a string estável do array interno `FOUR_STEPS_ST`, nunca traduzida — só chama `renderStep2` quando o step é mesmo "Localização". Ou seja, a checagem duplicada dentro do `smarttouch.js` era redundante e insegura. Corrigido removendo a checagem: `renderStep2` agora sempre chama `renderLocationStep` direto.

Não mexido: `readStep2` (linhas ~655 e ~2713) tem uma checagem parecida (`getActiveStepLabel() === "Configuração"`), mas o dispatch externo só chama `readStep2` do smarttouch quando o label é "Localização" também — a essa branch parece ser código morto/de outro fluxo não identificado nesta investigação. Não toquei por não ter certeza do propósito e não ser o bug relatado.

Também corrigida, no mesmo print: "Habilitar autorreversão" sem tradução (`dict.js`/`dict.es.js`) — gap pontual de i18n, não relacionado ao bug de roteamento.

Arquivos alterados: `frontend/assets/js/pages/equipamentos/smarttouch.js`, `frontend/assets/js/i18n/dict.js`, `frontend/assets/js/i18n/dict.es.js`.

Validação: `node --check` nos três arquivos, `npm run check:encoding`, HTTP 200.

Pendência: validação visual — abrir "Criar equipamento" → SmartTouch/UniversalTouch em inglês, conferir que o Step 2 mostra o mapa/Localização do centro/Raio total irrigado (não Ficha Técnica), e que "Enable auto-reversal" aparece traduzido.

### 2026-09-11 — Retomado após a investigação: aba Operações do carretel com colunas reais + mock

Continuação do item 3 da fila, interrompido por "parou tudo" durante a investigação do bug do SmartTouch. Retomado a pedido do usuário ("vamos recuperar onde paramos").

- `frontend/assets/js/pages/carreteis/index.js`: aba Operações trocou de 3 colunas simplificadas (Início/Fim/Comprimento puxado) pras 8 colunas reais do print de referência: Início, Fim, Hora de Pico, Total, Lâmina d'água, Modo, Motivo da Parada, Talhão. Nova função `buildMockOperationRows` gera 6 ciclos de operação voltando no tempo (mesmo espírito do `buildMockEventRows` já feito pra aba Eventos), variando duração/talhão/motivo da parada/modo por índice pra não repetir tudo igual.
- i18n: adicionadas as traduções que faltavam pras colunas/valores novos (`Hora de Pico`, `Total`, `Lâmina d'água`, `Motivo da Parada`, `Sim`, `Não`, `Concluído`, `Parada manual`, `Sensor de parada`, `Falha de comunicação`) em `dict.js`/`dict.es.js`. `Modo` e `Talhão` já existiam.
- A tabela de Operações agora é bem mais larga que a de Eventos (9 colunas incluindo o botão de expandir); `.pivo-history__table-wrapper` já tem `overflow-x: auto`, então ela rola horizontalmente dentro do card em vez de estourar o layout — não precisou de CSS novo pra isso.

Validação executada:

```bash
node --check frontend/assets/js/pages/carreteis/index.js
node --check frontend/assets/js/i18n/dict.js
node --check frontend/assets/js/i18n/dict.es.js
npm run check:encoding
```

Resultado: sintaxe válida, encoding limpo, HTTP 200 nos três arquivos.

Pendência: validação visual (trocar pra aba Operações e conferir as 8 colunas + rolagem horizontal).

**Estado atual: nada do trabalho do carretel desta leva (linhas compactas, dropdown Geral/Protocolo, gráficos reorganizados, mock de Eventos e agora Operações) foi commitado/subido ainda** — está tudo validado localmente, esperando revisão do usuário antes do commit.

### 2026-09-11 — Botão "+" de expandir não fazia nada em nenhuma das duas abas

Usuário: "em history/operations não seguem o mesmo padrão". Causa: o botão de expandir (`+`/`-`) de cada linha do histórico (Eventos e Operações) renderizava mas nunca teve handler de clique nenhum — em nenhuma das duas abas, desde que foram criadas. No padrão real (`bombas/view.details.js`, `pivo.details.html`), clicar no botão alterna a visibilidade de uma `<tr class="pivo-history__row-details">` logo abaixo da linha, com detalhes extras, e troca o ícone `+`/`-`.

Implementado igual pras duas abas em `carreteis/index.js`:
- Cada linha renderizada agora tem `data-row-id` e uma linha de detalhes irmã (`pivo-history__details` / `pivo-history__details-grid` / `pivo-history__detail-item` — todas classes reais já usadas por Bomba/Pivô, confirmadas no CSS antes de usar).
- Eventos: detalhe mostra Sinal do Modem, Carga da Bateria e Comprimento puxado da mangueira (reaproveitando os dados atuais do equipamento mockado, mesmo espírito do resto do histórico).
- Operações: detalhe mostra Pressão Atual, Velocidade e Largura operacional.
- Um único listener delegado no `#carretelHistoryBody` (em vez de um por linha) cuida do clique, porque as linhas são recriadas a cada `renderHistory()` — sem isso teria que re-ligar listeners toda troca de aba/equipamento.

Validação: `node --check`, `npm run check:encoding`, HTTP 200, conferido que todas as classes `pivo-history__detail*` usadas já existem no CSS real (não são inventadas).

Pendência: validação visual (clicar no "+" em uma linha de cada aba e conferir que expande/recolhe e troca o ícone).

### 2026-09-11 — Gráficos Horímetro Diário e Vazão viram funcionais, com dados mock reais

Pedido do usuário: "vamos agora criar os dados reais das figuras de horimetro e flow rate e fazer o gráfico funcional assim como fizemos em pivô", refinado logo depois para "não precisa viajar muito, só meio que fazer as mesmas coisas de estilo que temos em Depth x Angle e Rainfall dos detalhes de pivô" (com print de referência dos dois gráficos do Pivô) — ou seja: reaproveitar o *estilo visual* (grade com rótulos numéricos, título de eixo Y rotacionado, rótulos e título no eixo X, tooltip), sem reaproveitar o motor de gráfico do Pivô (`pivos/view.charts.js`), que é grande, privado à tela de Pivô e fortemente acoplado — decisão tomada após investigar esse arquivo e confirmar que não compensa importar/generalizar pra um card só.

Feito em `frontend/assets/js/pages/carreteis/index.js`:
- `seedFor(equip)`: seed numérico estável por equipamento (baseado no id), pra series mock consistentes entre renders do mesmo carretel em vez de aleatório puro a cada re-render.
- `buildDailyHoursSeries(equip)`: série mock de horas de operação por dia (7 pontos), variando por seed e pelo status atual do equipamento (mais horas quando `irrigando`).
- `buildFlowSeries(equip, d)`: série mock de vazão (m³/h) ao longo do dia (pontos horários), ancorada na pressão/vazão atuais do mock quando disponíveis, com leve variação senoidal + ruído por seed pra parecer operação real em vez de linha reta.
- `niceAxisMax(max, steps)`: helper de eixo "arredondado bonito" (mesmo espírito do que qualquer lib de gráfico faz), evita máximos tipo `137` virarem o topo do eixo Y.
- `renderAxisChart(svg, { values, labels, type, yTitle, xTitle, color, unit })`: renderizador genérico em SVG puro (sem lib), `viewBox="0 0 460 220"`, margens fixas, 4 linhas de grade horizontais com rótulo numérico (classe `carretel-axis-label`), título do eixo Y rotacionado -90° (classe `carretel-axis-title`), rótulos do eixo X (desbastados pra no máx. ~7 quando há mais pontos que isso) e título do eixo X, barras (`type: "bar"`) ou linha+área+pontos (`type: "line"`), com `<title>` nativo em cada barra/ponto pra tooltip (sem JS de posicionamento customizado — reaproveita o tooltip nativo do navegador, suficiente pro pedido).
- `renderBars(equip)` (Horímetro Diário) e `renderFlowChart(equip, d)` (Vazão) reescritos pra montar os dados via `buildDailyHoursSeries`/`buildFlowSeries` e chamar `renderAxisChart`, além de atualizar o valor/rodapé do card (`#carretelDailyValue`/`#carretelDailyFooter`, `#carretelFlowValue`/`#carretelFlowFooter`) com média/pico usando as traduções já existentes `t("Média")`/`t("Pico")`.
- Chamada em `IcCarretel.renderData()` passou a ser `renderBars(equip); renderFlowChart(equip, d);`.

Feito em `frontend/pages/carretel.details.html`:
- Os dois contêineres de gráfico (`#carretelDailyChart`, `#carretelFlowSvg`) trocaram de `<div>`/SVG pequeno pra `<svg viewBox="0 0 460 220" class="bmbd-svg carretel-axis-svg">`, que é o que `renderAxisChart` preenche.

Feito em `frontend/assets/css/pages/pivos.css`:
- Removida a geração de CSS da era anterior (barras em flexbox com `<div>`, `.carretel-chart`/`.carretel-bars`/`.carretel-chart__tip` etc.), que ficou obsoleta assim que o JS passou a gerar SVG completo com grade/eixos.
- Adicionadas `.carretel-axis-svg` (altura 220px, acompanhando o viewBox), `.carretel-axis-svg .carretel-axis-label` (rótulos numéricos/de data, pequenos e discretos) e `.carretel-axis-svg .carretel-axis-title` (títulos de eixo, um pouco maiores/mais fortes), no mesmo peso visual do print de referência do Pivô.

Validação executada:

```bash
node --check frontend/assets/js/pages/carreteis/index.js
npm run check:encoding
curl http://localhost:3000/pages/carretel.details.html
curl http://localhost:3000/assets/css/pages/pivos.css
curl http://localhost:3000/assets/js/pages/carreteis/index.js
```

Resultado: sintaxe válida, encoding limpo, chaves CSS balanceadas, HTTP 200 nos três arquivos tocados.

Pendência: validação visual manual (abrir os detalhes de um carretel irrigando e conferir grade/rótulos/título rotacionado/tooltip nos dois gráficos, e também um carretel parado/desconectado pra ver a série mock se comportando razoavelmente mesmo sem operação ativa).

**Estado atual: nada desta leva de gráficos foi commitado/subido ainda** — validado localmente, esperando revisão/"suba" do usuário antes do commit.

### 2026-09-11 — Correção de uma ferramenta externa que apagou o card de Consumo da Bomba

Entre uma mensagem e outra desta sessão, outra ferramenta de IA (fora deste chat) trabalhou direto neste mesmo repositório local, sem passar pelo fluxo desta conversa: commitou e deu push em `eaa8051` (que acabou levando junto o trabalho de gráficos do carretel desta sessão, ainda não commitado até então) e depois em `1bf059f`, que devia só ajustar o ícone/texto do modal "Definir Posição Inicial" do carretel (trocar o "ponto preto" por ícone, afinar o traço de 5 para 3.2 — isso ficou certo) mas, ao investigar uma reclamação de "gráfico de consumo aparecendo nos detalhes da bomba", apagou o card inteiro de Consumo da Bomba (`frontend/pages/bomba.details.html`, 61 linhas, e `frontend/assets/js/pages/bombas/view.details.js`, 452 linhas) — incluindo funcionalidade legítima e antiga da Bomba (gráfico de barras "Gráfico de Consumo" por dia + KPIs "Consumo" de volume/horas), sem terminar a correção nem confirmar com o usuário.

O que realmente devia ser removido era só o sub-bloco "Custos em Energia" (donut Horário de Pico/Fora do Horário de Pico/Reduzido, `#pivoChartCustos`), que o próprio comentário do código já identificava como "mesmo componente visual usado no gráfico de consumo do pivô" — ou seja, o pedaço que veio do Pivô por reuso indevido, não a funcionalidade de Consumo da Bomba como um todo.

Corrigido nesta sessão:
- `frontend/pages/bomba.details.html` e `frontend/assets/js/pages/bombas/view.details.js` restaurados ao estado anterior à exclusão (`git checkout eaa8051 -- <arquivos>`), recuperando o `Gráfico de Consumo` (barras por dia) e os KPIs do card `Consumo` (Volume Total, Volume Total no Último Mês, Horas Totais de Trabalho, Horas Totais de Trabalho no Último Mês).
- Removido apenas o sub-bloco `.pivo-consumo__chart--energy` ("Custos em Energia", donut de tarifa por horário) do HTML.
- Removidas do JS as funções exclusivas desse donut: `polarPoint`, `donutSlicePath`, `fmtCurrencyBR`, `attachDonutTooltip`, `updateConsumoDonut`, e a chamada `updateConsumoDonut(days)` dentro de `renderConsumoChart`.
- `splitTotal`/`generateConsumoData` simplificados: como `peak`/`offpeak`/`reduced` só existiam para alimentar o donut removido, `generateConsumoData` agora gera `{ label, total }` direto, sem o split de tarifa morto.
- Conferido que não sobrou nenhuma referência a `pivoChartCustos`, `pivoCostsLegend`, `donutSlicePath`, `polarPoint`, `attachDonutTooltip`, `updateConsumoDonut`, `fmtCurrencyBR` ou `splitTotal` em nenhum dos dois arquivos.
- Aproveitado para completar o i18n do modal `Definir Posição Inicial` do carretel, que nunca tinha sido traduzido (gap encontrado ao validar o texto do ícone corrigido pela outra ferramenta): `Posição Inicial da Irrigação`, `Posição inicial da irrigação`, `Comprimento puxado`, `Posição inicial`, o texto completo do aviso do ícone, e os `alert()` de erro (`Puxe a mangueira...`, `Mapa indisponível...`, `Posição do carro aspersor indisponível.`, `Geolocalização indisponível...`, `Não foi possível obter a localização.`) — em `dict.js`/`dict.es.js`.
- Também as traduções que faltavam nos gráficos novos de Horímetro Diário/Vazão (`média/dia`, `atual`, `Vazão (m³/h)`), pendência que ficou visível no print em inglês enviado pelo usuário.

Validação executada:

```bash
node --check frontend/assets/js/pages/bombas/view.details.js
node --check frontend/assets/js/pages/carreteis/index.js
node --check frontend/assets/js/i18n/dict.js
node --check frontend/assets/js/i18n/dict.es.js
node -e "JSON.parse(...) data/farms.json e frontend/data/farms.json"
npm run check:encoding
```

Resultado: sintaxe válida, JSON válido, encoding limpo, HTTP 200 em `bomba.details.html`, `bombas/view.details.js`, `dict.js`, `dict.es.js`. Tags `<article>` de `bomba.details.html` conferidas em par (9 abertura / 9 fechamento).

Nota registrada a pedido do usuário: mudanças feitas por qualquer ferramenta fora desta conversa neste mesmo repositório local podem aparecer como commits já existentes/já no `origin/main` quando esta sessão retoma — sempre checar `git log`/`git status` antes de assumir que "nada foi commitado ainda".

### 2026-09-11 — Removido card "Consumo" da Bomba + prefixo pivo-* trocado por bmbd-* nos arquivos exclusivos da Bomba

Duas continuações da mesma linha de correção acima, a pedido do usuário.

**1) Removido o card `Consumo` (KPIs de volume/horas) da tela de detalhes da Bomba.**
Depois de restaurar o `Gráfico de Consumo` (barras) e o card `Consumo`, o usuário pediu pra remover só o card `Consumo` mesmo (ficou só o `Gráfico de Consumo`). Removido de `frontend/pages/bomba.details.html` o `<article class="pivo-data-card pivo-consumo-card">` inteiro (KPIs `Volume Total`, `Volume Total no Último Mês`, `Horas Totais de Trabalho`, `Horas Totais de Trabalho no Último Mês`). Em `frontend/assets/js/pages/bombas/view.details.js`, removidas as funções que só existiam pra alimentar esses KPIs: `updateConsumoKpis`, `getPeriodLabel`, `matchSelectedPreset`, `PRESET_LABELS`, `getEquipmentTotalStats`, `EQUIPMENT_TOTAL_REFERENCE_MONTHS`, `EQUIPMENT_TOTAL_MONTHLY_RANGE`, `isSameDay`, `FLOW_RATE`, e a chamada `updateConsumoKpis(days, range)` dentro de `renderConsumoChart`. Conferido sem sobra de referência a nenhum desses nomes.

**2) Renomeado prefixo `pivo-*` para `bmbd-*` nos arquivos exclusivos da Bomba** (`frontend/pages/bomba.details.html` e `frontend/assets/js/pages/bombas/view.details.js`).

Motivo (palavras do usuário): "pra eu não alterar algo na bomba e mudar no pivô" — depois do incidente desta mesma sessão em que uma ferramenta externa apagou funcionalidade real da Bomba por causa de nomenclatura "pivo-" ambígua dentro do arquivo da Bomba, o usuário pediu que os elementos usados só pela Bomba parem de usar o prefixo compartilhado, mesmo sabendo que isso significa duplicar CSS (perguntei antes de fazer, já que a alternativa — manter o sistema compartilhado como está, já que a peça causadora do incidente já tinha sido removida — evitaria duplicação; o usuário optou por duplicar mesmo assim).

Escopo do que foi (e não foi) renomeado, decidido por arquivo e por regra CSS, não por "contém a palavra pivo":
- Renomeadas 37 classes usadas por `bomba.details.html`/`view.details.js` que são puramente estruturais/visuais e só addressed o CSS compartilhado de `pivos.css` sem nenhuma lógica cross-page: `pivo-card-container`, `pivo-right-column`, `pivo-agenda*`, `pivo-data-card*`, `pivo-history*` (todas as variantes BEM), `pivo-timeline*`, `pivo-bottom-row`, `pivo-selector*`, `pivo-section-nav__btn` → equivalentes `bmbd-*`.
- **Não renomeado** `is-pivo-details-only`: é uma classe de estado do `<body>` controlada centralmente por `frontend/assets/js/app.js` (`applyPivoDetailsOnlyLayout`/`resetPivoDetailsOnlyLayout`), usada genericamente por *todas* as telas de detalhes de equipamento (Pivô, Bomba, Carretel, Medidor, Pluviometria, Estação) pra esconder o mapa quando qualquer uma delas está aberta — apesar do nome, não é exclusiva de Pivô, e renomear exigiria mexer em `app.js` (arquivo compartilhado por todos os equipamentos), o que contradiz o pedido de mexer só nos arquivos da Bomba.
- **Não renomeado** o próprio conceito de "Pivô" como equipamento (`category === "pivos"`, `IcPivos.open`, `{ label: "Pivôs", type: "pivos" }` no seletor de equipamentos da Bomba) — isso é uma referência correta ao equipamento Pivô de verdade, não uma classe CSS emprestada.
- Verificado com grep que `.pivo-section-nav__btn`/`.pivo-selector*` são reimplementados de forma independente em cada tela de detalhes (Bomba, Medidor, Pivô, LineStar, Pluviometria têm cada um o seu próprio handler/CSS), então renomear só na Bomba não quebra nenhuma outra tela.
- CSS duplicado em `frontend/assets/css/pages/pivos.css` (adicionado ao final do arquivo, seção "Bomba (motobomba) — componentes exclusivos"): 118 regras copiadas 1:1 das equivalentes `pivo-*` (claro e escuro) com o seletor trocado pra `bmbd-*`, mais um bloco `@media (max-width: 640px)` reconstruído à mão (a extração automática tinha perdido o wrapper de media query nesse trecho — corrigido antes de inserir). Ficaram de fora da duplicação as variantes que nunca se aplicam ao DOM da Bomba: tudo escopado por `#pivosPanel`/`#linestarPanel` (a Bomba usa `#bmbdPanel`), `.pivo-bottom-row--smarttouch`, `.pivo-angle-charts`, `.pivo-timeseries-row`, `.pivo-consumo-card`/`.pivo-consumo__grid` (removidos da Bomba), `.pivo-energy__top`, `.pivo-smarttouch-charts-col`, `.pivo-history--no-tabs` (a Bomba sempre tem abas Eventos/Operações).
- Nenhuma regra `pivo-*` existente foi alterada ou removida de `pivos.css` — só houve inserção (628 linhas adicionadas, zero remoções), então Pivô/Carretel/LineStar/Pluviometria/Medidor continuam usando exatamente o CSS de antes, sem qualquer efeito colateral.
- `mdnd-bottom-row`/`mdnd-history` (prefixo de Medidor de Nível, presente em `bomba.details.html` e também em `medidor.details.html`) foram deixados como estão — são classes sem CSS próprio hoje (não fazem nada), pré-existentes a este incidente e fora do escopo desta rodada; achado registrado aqui caso vire pedido futuro.

Validação executada:

```bash
node -e "verifica chaves { } balanceadas em pivos.css"
node --check frontend/assets/js/pages/bombas/view.details.js
node -e "conta <article> abertura/fechamento em bomba.details.html"
npm run check:encoding
```

Resultado: chaves CSS balanceadas, sintaxe JS válida, 8 `<article>` abertura / 8 fechamento, encoding limpo, HTTP 200 em `bomba.details.html`, `bombas/view.details.js` e `pivos.css`. Grep confirmou zero classes-alvo `pivo-*` remanescentes em `bomba.details.html`; em `view.details.js` só sobraram `is-pivo-details-only` (justificado acima) e referências reais ao equipamento Pivô.

Pendência: validação visual manual no navegador (luz e escuro, desktop e ~640px) pra confirmar que a Bomba renderiza idêntica a antes do rename — a duplicação foi feita por extração/substituição automatizada de texto, revisada regra por regra, mas ainda não vista rodando num browser real.

**Nada deste bloco (remoção do card Consumo + rename pivo→bmbd) foi commitado/subido ainda** — esperando confirmação do usuário antes do commit.

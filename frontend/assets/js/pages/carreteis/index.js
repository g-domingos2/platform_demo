// assets/js/pages/carreteis/index.js
(function initCarretelDetails() {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const t = (text) => window.IcI18n?.t?.(text) ?? text;
  let selectedId = null;
  let selectorOutsideClickHandler = null;
  let minimap = null;
  let minimapLayers = [];

  const STATUS_META = {
    irrigating: { text: "IRRIGANDO", cls: "is-info" },
    stopped_stop_sensor: { text: "PARADO POR SENSOR DE PARADA", cls: "is-warning" },
    speed_not_reached: { text: "VELOCIDADE NÃO ATINGIDA", cls: "is-danger" },
    disconnected: { text: "DESCONECTADO", cls: "is-neutral" },
    waiting_connection: { text: "ESPERANDO CONEXÃO", cls: "is-neutral" },
  };

  function activeFarm() {
    return window.IcFarmGetActive?.() || window.IcFarmActive || window.icFarmData || null;
  }

  function rainstars() {
    const farm = activeFarm();
    return (farm?.equipments || []).filter((equip) => String(equip?.category || "") === "carreteis" && String(equip?.type || "") === "rainstar");
  }

  function getSelected() {
    const list = rainstars();
    return list.find((equip) => equip.id === selectedId) || list[0] || null;
  }

  function fmtNumber(value, digits = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "--";
    return n.toFixed(digits).replace(/\.0$/, "");
  }

  const ZONE_COLORS = ["#3b82f6", "#f97316", "#14b8a6", "#a16207"];
  function buildZonesBarHtml(zones) {
    if (!Array.isArray(zones) || !zones.length) {
      return `<div class="carretel-modal__zones-empty">${t("Nenhuma zona de irrigação cadastrada.")}</div>`;
    }
    return `<div class="carretel-modal__zones-bar">${zones
      .map((z, i) => {
        const start = Number(z.start) || 0;
        const end = Number(z.end) || start;
        const span = Math.max(end - start, 0);
        const speedLabel = Number.isFinite(Number(z.speed)) && z.speed !== "" ? `${fmtNumber(z.speed, 1)} m/h` : "--";
        return `<div style="flex:${span > 0 ? span : 1} 0 0; background:${ZONE_COLORS[i] || ZONE_COLORS[0]};">${t("Zona")} ${i + 1}: ${span}m | ${speedLabel}</div>`;
      })
      .join("")}</div>`;
  }

  function fmtDate(value) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(window.IcI18n?.getLocale?.() || "pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
  }

  function statusMeta(equip) {
    const key = String(equip?.data?.status || equip?.status || "stopped_stop_sensor").toLowerCase();
    return STATUS_META[key] || STATUS_META.stopped_stop_sensor;
  }

  // Mês abreviado no idioma selecionado (era uma tabela fixa em português).
  function shortMonth(date) {
    const locale = window.IcI18n?.getLocale?.() || "pt-BR";
    return date.toLocaleDateString(locale, { month: "short" }).replace(".", "");
  }
  function fmtHistoryDate(date) {
    const dd = String(date.getDate()).padStart(2, "0");
    const mmm = shortMonth(date);
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    return `${dd} ${mmm} ${date.getFullYear()} ${hh}:${mi}`;
  }

  // Mock de histórico: repete o ciclo Atualização (status atual) / Nova
  // conexão / Atualização (desconectado) voltando no tempo, pra preencher a
  // tabela com várias páginas de linhas em vez de só 3-4 mockadas na mão.
  // Período global (mesmo popover das outras telas de detalhes)
  function engineRange() {
    return window.IcDemoHistory.periodFrom(window.Plv?.state?.period, 7);
  }
  function engineOk(equip) {
    return !!(window.IcDemoHistory && equip?.id && window.IcDemoHistory.findEquipment(equip.id));
  }

  function buildMockEventRows(equip, d) {
    if (engineOk(equip)) {
      const DH = window.IcDemoHistory;
      const range = engineRange();
      const rows = [];
      const meta = statusMeta(equip);
      // Operação em andamento (simulação) aparece no topo
      if (meta.text === "IRRIGANDO" && range.end >= new Date(DH.NOW.getTime() - 60000)) {
        rows.push({ dateObj: DH.NOW, type: "Atualização", status: `IRRIGANDO | ${fmtNumber(d.currentSpeed || 18.8, 1)}m/h` });
      }
      DH.reel.ops(equip, range.start, range.end).forEach((op) => {
        const sp = `${fmtNumber(op.speeds[0], 1)}m/h`;
        const push = (date, type, status) => { if (date >= range.start && date <= range.end) rows.push({ dateObj: date, type, status }); };
        push(op.start, "Nova conexão", `IRRIGANDO | ${sp}`);
        push(new Date(op.start.getTime() + 2 * 60000), "Atualização", `IRRIGANDO | ${sp}`);
        const endStatus = op.reason === "Concluído" ? "PARADO - FIM DO PERCURSO"
          : op.reason === "Sensor de parada" ? "PARADO - SENSOR DE PARADA"
            : op.reason === "Parada manual" ? "PARADO - PARADA MANUAL" : "PARADO - VELOCIDADE NÃO ATINGIDA";
        push(op.end, "Atualização", endStatus);
        const disc = new Date(op.end.getTime() + (12 + (op.retracted % 9)) * 60000);
        push(disc, "Atualização", "DESCONECTADO");
      });
      rows.sort((a, b) => b.dateObj - a.dateObj);
      return rows.map((r) => ({ ...r, date: fmtHistoryDate(r.dateObj) }));
    }
    const meta = statusMeta(equip);
    const currentStatus = `${t(d.statusText || meta.text)}${(meta.text === "IRRIGANDO" && d.currentSpeed) ? ` | ${fmtNumber(d.currentSpeed, 1)}m/h` : ""}`;
    const base = d.lastCommunication ? new Date(d.lastCommunication) : new Date();
    let cursor = Number.isNaN(base.getTime()) ? new Date() : base;
    const rows = [];
    const CYCLES = 6;
    for (let i = 0; i < CYCLES; i++) {
      rows.push({ date: fmtHistoryDate(cursor), type: "Atualização", status: currentStatus });
      cursor = new Date(cursor.getTime() - 2 * 60000);
      rows.push({ date: fmtHistoryDate(cursor), type: "Nova conexão", status: currentStatus });
      cursor = new Date(cursor.getTime() - (10 + i) * 60000);
      rows.push({ date: fmtHistoryDate(cursor), type: "Atualização", status: "DESCONECTADO" });
      cursor = new Date(cursor.getTime() - (24 * 60 - 12 + i * 3) * 60000);
    }
    return rows;
  }

  const PROTOCOL_MESSAGE = "0:BES1;1:0821;2:0;3:1;4:1;5:215524A431;6:;7:0;8:4;9:18.8;10:0;11:12-25;12:0;13:12-25;15:1;16:10;17:10;18:1;19:10;20:10;21:0;22:1;23:00-00;24:00-00;25:1;26:0;27:0;28:0.0;29:2;30:1;31:100;33:19.3;34:20.8;35:1011.2;39:400;40:100;41:1680;42:12.25;43:256;44:13;45:4;46:89;47:4500;48:150;49:3;50:25;51:8;52:8;53:3;54:20;55:0;56:20.0;57:5.0;58:0.91;59:72.0;60:32.2;65:0;66:1;67:0;68:1;69:0;70:0;71:2.00;72:0.03;73:5;74:100;75:5;76:20;77:7.0;78:7.0;80:0.0;81:0.0;99:1;108:0;109:0.0;110:0.0;111:0.0;112:0.0;113:0;114:0.0;115:0.0;116:0.0;117:0.0;118:0;119:0.0;120:0.0;121:0.0;122:0.0;123:0;124:0.0;125:0.0;126:0.0;127:0.0;128:00-00;129:00-00;130:00-00;131:0;132:100.0;133:0.5;134:1;135:50;136:50;137:3;138:1;139:2;140:19;142:120;144:0;145:0;146:0;150:-0.676588;151:53.788590;152:76;156:26-9-21 11-23-41;335:5;336:697;337:0;900:1;";

  const PROTOCOL_MAP = {
    0: "Protocolo", 1: "Tamanho da mensagem", 2: "Checksum", 3: "Versão", 4: "Tipo de mensagem",
    5: "IMEI", 6: "Comando", 7: "Status", 8: "Código de parada", 9: "Velocidade definida",
    10: "Taxa de irrigação definida", 11: "Horário de início", 12: "Modo", 13: "Horário de parada",
    15: "Estado da pré-irrigação", 16: "Duração da pré-irrigação", 17: "Distância da pré-irrigação",
    18: "Estado da pós-irrigação", 19: "Duração da pós-irrigação", 20: "Distância da pós-irrigação",
    21: "ID do programa", 22: "Estado do aspersor", 23: "Início do aspersor", 24: "Parada do aspersor",
    25: "Estado da lâmpada de sinalização", 26: "Duração da lâmpada de sinalização", 27: "Distância da lâmpada de sinalização",
    28: "Comprimento puxado da mangueira", 29: "Unidade de irrigação", 30: "Formato de unidade",
    31: "Carga da bateria", 33: "Horas de operação do motor 1", 34: "Horas de operação do motor 2",
    35: "Horas de irrigação", 39: "Comprimento da mangueira", 40: "Diâmetro da mangueira",
    41: "Diâmetro do núcleo do carretel", 42: "Rotações por camada", 43: "Dentes da engrenagem maior", 44: "Dentes da engrenagem menor",
    45: "Número de ímãs", 46: "Ovalização da mangueira", 47: "Primeiro pulso", 48: "Pulso curto",
    49: "Tempo entre pulsos", 50: "Número de pulsos curtos", 51: "Tempo para fechar",
    52: "Pulso de partida da turbina", 53: "Desligamento", 54: "Tempo de monitoramento",
    55: "Monitoramento de pressão", 56: "Diâmetro do bico", 57: "Pressão no bico",
    58: "Alfa", 59: "Largura da faixa", 60: "Vazão",
    65: "Estado do sensor de velocidade 1", 66: "Estado do sensor de velocidade 2", 67: "Estado do sensor de parada",
    68: "Estado da entrada reserva", 69: "Estado do pressostato", 70: "Estado do contador de água",
    71: "Kp", 72: "Ki", 73: "Mínimo do controlador", 74: "Máximo do controlador",
    75: "Tolerância do controlador", 76: "Tolerância de monitoramento", 77: "Corrente da turbina",
    78: "Corrente da válvula", 80: "Pressão atual", 81: "Velocidade atual",
    99: "Índice do programa de irrigação",
    108: "Zona 1 ativa", 109: "Início da zona 1", 110: "Fim da zona 1", 111: "Velocidade da zona 1", 112: "Taxa da zona 1",
    113: "Zona 2 ativa", 114: "Início da zona 2", 115: "Fim da zona 2", 116: "Velocidade da zona 2", 117: "Taxa da zona 2",
    118: "Zona 3 ativa", 119: "Início da zona 3", 120: "Fim da zona 3", 121: "Velocidade da zona 3", 122: "Taxa da zona 3",
    123: "Zona 4 ativa", 124: "Início da zona 4", 125: "Fim da zona 4", 126: "Velocidade da zona 4", 127: "Taxa da zona 4",
    128: "Horário de início (programa)", 129: "Horário de parada (programa)", 130: "Pausa",
    131: "Duração da pausa", 132: "Vazão por pulso", 133: "Pressão mínima",
    134: "Sensor de vazão", 135: "Tempo para fechar (pressão baixa)", 136: "Limite de velocidade",
    137: "Passos do controlador", 138: "Correção de velocidade", 139: "GPS",
    140: "Intensidade do sinal do modem", 142: "Tempo de ping", 144: "Horário de desligamento",
    145: "Horário de ativação", 146: "Abrir válvula lentamente",
    150: "Longitude GPS", 151: "Latitude GPS", 152: "Altitude GPS", 156: "Data/hora GPS",
    335: "Camada atual", 336: "Rotações na camada atual", 337: "Soma do contador",
    900: "Modo de economia de energia",
  };

  function parseProtocolMessage(msg) {
    const entries = [];
    msg.split(";").forEach((part) => {
      const idx = part.indexOf(":");
      if (idx < 0) return;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1);
      if (key === "") return;
      entries.push({ key: Number(key), value: value || "" });
    });
    return entries;
  }

  function buildProtocolTableHtml(title, rows) {
    if (!rows || !rows.length) return "";
    const header = `<thead><tr><th>Protocolo</th><th>Valor</th><th>Parâmetro</th></tr></thead>`;
    const body = rows.map((r) => `<tr><td>${r.key}</td><td>${r.value}</td><td>${PROTOCOL_MAP[r.key] || "Desconhecido"}</td></tr>`).join("");
    return `
      <div class="pivo-history__protocol-table-card">
        <div class="pivo-history__protocol-table-title">${title}</div>
        <div class="pivo-history__protocol-table-wrap">
          <table class="pivo-history__protocol-table">${header}<tbody>${body}</tbody></table>
        </div>
      </div>`;
  }

  function buildProtocolGridHtml() {
    const all = parseProtocolMessage(PROTOCOL_MESSAGE);
    const pre = all.filter((r) => [15, 16, 17].includes(r.key));
    const post = all.filter((r) => [18, 19, 20].includes(r.key));
    const general = all.filter((r) => ![15, 16, 17, 18, 19, 20, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127].includes(r.key));
    const zones = all.filter((r) => [108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127].includes(r.key));
    const cards = [
      buildProtocolTableHtml("Pré-Irrigação", pre),
      buildProtocolTableHtml("Pós-Irrigação", post),
      buildProtocolTableHtml("Informações Gerais", general),
      buildProtocolTableHtml("Zonas", zones),
    ].filter(Boolean).join("");
    return `<div class="pivo-history__details">
      <div class="pivo-history__protocol-grid">${cards}</div>
    </div>`;
  }

  function buildEventDetailsHtml(filter) {
    if (filter === "protocolo") {
      return `
        <div class="pivo-history__details">
          <div class="pivo-history__protocol-title">Detalhes</div>
          <div class="pivo-history__protocol-section">
            <div class="pivo-history__protocol-label">Mensagem:</div>
            <div class="pivo-history__protocol-value">${PROTOCOL_MESSAGE}</div>
          </div>
        </div>`;
    }
    if (filter === "tabela-protocolo") {
      return buildProtocolGridHtml();
    }
    return `
      <div class="pivo-history__details">

        <!-- Operation -->
        <div class="pivo-history__details-section">
          <div class="pivo-history__details-section-title">Operação</div>
          <div class="pivo-history__details-section-grid">
            <div class="pivo-history__detail-item pivo-history__detail-item--full"><span class="pivo-history__detail-label">Enviado por:</span> <strong class="pivo-history__detail-value">Nome</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Origem:</span> <strong class="pivo-history__detail-value">Dispositivo</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Status:</span> <strong class="pivo-history__detail-value">Irrigando</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Comando:</span> <strong class="pivo-history__detail-value">NENHUM</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Modo:</span> <strong class="pivo-history__detail-value">Início imediato</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">ID do programa:</span> <strong class="pivo-history__detail-value">0</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Unidade de irrigação:</span> <strong class="pivo-history__detail-value">Velocidade (m/h)</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Velocidade definida:</span> <strong class="pivo-history__detail-value">17.3 m/h</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Taxa de irrigação definida:</span> <strong class="pivo-history__detail-value">0 mm/h</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Horário de início:</span> <strong class="pivo-history__detail-value">17/09/2026 16:45:00</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Horário de parada:</span> <strong class="pivo-history__detail-value">18/09/2026 02:44:00</strong></div>
          </div>
        </div>

        <!-- Water & Pressure -->
        <div class="pivo-history__details-section">
          <div class="pivo-history__details-section-title">Água e Pressão</div>
          <div class="pivo-history__details-section-grid">
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Pressão atual:</span> <strong class="pivo-history__detail-value">1.40bar</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Pressão no bico:</span> <strong class="pivo-history__detail-value">5 bar</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Vazão:</span> <strong class="pivo-history__detail-value">32.2 m³/h</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Pressão mínima:</span> <strong class="pivo-history__detail-value">0.5 bar</strong></div>
          </div>
        </div>

        <!-- Hose & Position -->
        <div class="pivo-history__details-section">
          <div class="pivo-history__details-section-title">Mangueira e Posição</div>
          <div class="pivo-history__details-section-grid">
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Comprimento puxado da mangueira:</span> <strong class="pivo-history__detail-value">172.8 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Comprimento da mangueira:</span> <strong class="pivo-history__detail-value">400 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Diâmetro da mangueira:</span> <strong class="pivo-history__detail-value">100 mm</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Largura da faixa:</span> <strong class="pivo-history__detail-value">72 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Velocidade:</span> <strong class="pivo-history__detail-value">17.3 m/h</strong></div>
          </div>
        </div>

        <!-- Pre/Post Irrigation -->
        <div class="pivo-history__details-section">
          <div class="pivo-history__details-section-title">Pré/Pós-Irrigação</div>
          <div class="pivo-history__details-section-grid">
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Estado da pré-irrigação:</span> <strong class="pivo-history__detail-value">Inativo</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Duração da pré-irrigação:</span> <strong class="pivo-history__detail-value">10 min</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Distância da pré-irrigação:</span> <strong class="pivo-history__detail-value">10 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Estado da pós-irrigação:</span> <strong class="pivo-history__detail-value">Inativo</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Duração da pós-irrigação:</span> <strong class="pivo-history__detail-value">10 min</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Distância da pós-irrigação:</span> <strong class="pivo-history__detail-value">10 m</strong></div>
          </div>
        </div>

        <!-- Power & Communication -->
        <div class="pivo-history__details-section">
          <div class="pivo-history__details-section-title">Energia e Comunicação</div>
          <div class="pivo-history__details-section-grid">
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Carga da bateria:</span> <strong class="pivo-history__detail-value">100 %</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Intensidade do sinal do modem:</span> <strong class="pivo-history__detail-value">17</strong></div>
          </div>
        </div>

        <!-- Sensors -->
        <div class="pivo-history__details-section">
          <div class="pivo-history__details-section-title">Sensores</div>
          <div class="pivo-history__details-section-grid">
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Estado do sensor de velocidade 1:</span> <strong class="pivo-history__detail-value">Sim</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Estado do sensor de velocidade 2:</span> <strong class="pivo-history__detail-value">Sim</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Estado do sensor de parada:</span> <strong class="pivo-history__detail-value">Sim</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Estado do pressostato:</span> <strong class="pivo-history__detail-value">Não</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Estado do contador de água:</span> <strong class="pivo-history__detail-value">Não</strong></div>
          </div>
        </div>

        <!-- Zones -->
        <div class="pivo-history__details-section">
          <div class="pivo-history__details-section-title">Zonas</div>
          <div class="pivo-history__details-section-grid">
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Zona 1 ativa:</span> <strong class="pivo-history__detail-value">Não</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Início da zona 1:</span> <strong class="pivo-history__detail-value">0 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Fim da zona 1:</span> <strong class="pivo-history__detail-value">0 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Velocidade da zona 1:</span> <strong class="pivo-history__detail-value">0 m/h</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Taxa da zona 1:</span> <strong class="pivo-history__detail-value">0 mm/h</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Zona 2 ativa:</span> <strong class="pivo-history__detail-value">Não</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Início da zona 2:</span> <strong class="pivo-history__detail-value">0 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Fim da zona 2:</span> <strong class="pivo-history__detail-value">0 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Velocidade da zona 2:</span> <strong class="pivo-history__detail-value">0 m/h</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Taxa da zona 2:</span> <strong class="pivo-history__detail-value">0 mm/h</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Zona 3 ativa:</span> <strong class="pivo-history__detail-value">Não</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Início da zona 3:</span> <strong class="pivo-history__detail-value">0 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Fim da zona 3:</span> <strong class="pivo-history__detail-value">0 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Velocidade da zona 3:</span> <strong class="pivo-history__detail-value">0 m/h</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Taxa da zona 3:</span> <strong class="pivo-history__detail-value">0 mm/h</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Zona 4 ativa:</span> <strong class="pivo-history__detail-value">Não</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Início da zona 4:</span> <strong class="pivo-history__detail-value">0 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Fim da zona 4:</span> <strong class="pivo-history__detail-value">0 m</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Velocidade da zona 4:</span> <strong class="pivo-history__detail-value">0 m/h</strong></div>
            <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">Taxa da zona 4:</span> <strong class="pivo-history__detail-value">0 mm/h</strong></div>
          </div>
        </div>

      </div>`;
  }

  const OPERATION_PLOTS = ["3", "7A", "12", "5B", "9", "2"];
  const OPERATION_STOP_REASONS = ["Concluído", "Parada manual", "Sensor de parada", "Falha de comunicação", "Concluído", "Sensor de parada"];
  const OPERATION_MODES = ["Velocidade", "Taxa de Irrigação"];

  // Mock de operações: um ciclo de irrigação por dia, voltando no tempo, com
  // duração/talhão/motivo variando por índice pra não repetir tudo igual.
  function buildMockOperationRows(equip, d) {
    if (engineOk(equip)) {
      const DH = window.IcDemoHistory;
      const range = engineRange();
      return DH.reel.ops(equip, range.start, range.end).map((op) => {
        const peak = (() => {
          for (let t = op.start.getTime(); t < op.end.getTime(); t += 30 * 60000) {
            const h = new Date(t).getHours();
            if (h >= 18 && h < 21) return "Sim";
          }
          return "Não";
        })();
        return {
          start: fmtHistoryDate(op.start),
          end: fmtHistoryDate(op.end),
          peak,
          total: `${fmtNumber(op.retracted, 1)}m`.replace(".0m", "m"),
          blade: `${fmtNumber(op.laminaMm, 1)}mm`,
          volume: `${fmtNumber(op.volume, 1)}m³`.replace(".0m³", "m³"),
          mode: op.mode,
          stopReason: op.reason,
          plot: OPERATION_PLOTS[DH.hash(op.id) % OPERATION_PLOTS.length],
          pressure: op.pressure,
          speed: op.speeds[0],
        };
      });
    }
    const base = d.lastCommunication ? new Date(d.lastCommunication) : new Date();
    let cursor = Number.isNaN(base.getTime()) ? new Date() : base;
    const fullLength = Math.max(0, Number(d.hoseLength) || 400);
    const rows = [];
    const CYCLES = 6;
    for (let i = 0; i < CYCLES; i++) {
      const durationMin = 90 + i * 15;
      const end = cursor;
      const start = new Date(end.getTime() - durationMin * 60000);
      const total = i === 0 ? Math.max(0, Number(d.pulledPipeLength) || 0) : Math.round((fullLength * (0.3 + (i % 3) * 0.2)) * 10) / 10;
      const bladeMm = 8 + (i % 4) * 2.5;
      const workingWidth = Math.max(0, Number(d.workingWidth) || 72);
      const volumeM3 = Math.round(total * workingWidth * (bladeMm / 1000) * 10) / 10;
      rows.push({
        start: fmtHistoryDate(start),
        end: fmtHistoryDate(end),
        peak: i % 3 === 1 ? "Sim" : "Não",
        total: `${fmtNumber(total, 1)}m`.replace(".0m", "m"),
        blade: `${fmtNumber(bladeMm, 1)}mm`,
        volume: `${fmtNumber(volumeM3, 1)}m³`.replace(".0m³", "m³"),
        mode: OPERATION_MODES[i % OPERATION_MODES.length],
        stopReason: OPERATION_STOP_REASONS[i % OPERATION_STOP_REASONS.length],
        plot: OPERATION_PLOTS[i % OPERATION_PLOTS.length],
      });
      cursor = new Date(start.getTime() - (18 * 60 + i * 20) * 60000);
    }
    return rows;
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function renderSelectorItems(menu) {
    const items = rainstars();
    menu.innerHTML = items.map((equip) => `<button type="button" class="pivo-selector__item ${equip.id === selectedId ? "is-active" : ""}" data-carretel-id="${equip.id}">${equip.name || equip.data?.name || "Carretel"}</button>`).join("");
    menu.querySelectorAll("[data-carretel-id]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedId = btn.dataset.carretelId;
        menu.style.display = "none";
        $("carretelSelectBtn")?.classList.remove("is-active");
        window.IcCarretel.renderData();
      });
    });
  }

  function initMinimap() {
    const el = $("carretelMinimap");
    const equip = getSelected();
    if (!el || !window.L || !equip) return;

    // A tela de detalhes é remontada do zero a cada open() (slot.innerHTML
    // novo), então o <div id="carretelMinimap"> de antes já foi destruído.
    // Se `minimap` ainda aponta pro mapa Leaflet velho (container fora do
    // DOM), reaproveitar dá em mapa fantasma: o div novo fica em branco.
    if (minimap && minimap.getContainer?.() !== el) {
      try { minimap.off(); minimap.remove(); } catch (_) { }
      minimap = null;
      minimapLayers = [];
    }

    minimapLayers.forEach((layer) => layer.remove());
    minimapLayers = [];
    if (!minimap) {
      minimap = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false });
      window.IcBindRainstarIconScale?.(minimap);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20 }).addTo(minimap);
    }
    setTimeout(() => minimap.invalidateSize(), 60);

    // Reaproveita exatamente o mesmo desenho (faixa + seta de direção) do
    // mapa principal, pra minimapa e visão geral ficarem sempre idênticos.
    const rainstar = window.IcExtractRainstarData?.(equip);
    if (!rainstar) {
      minimap.setView([activeFarm()?.lat || -12.413107, activeFarm()?.lng || -45.433619], 15);
      return;
    }
    const visual = window.IcResolveRainstarStatus?.(equip) || {};
    minimapLayers = window.IcDrawRainstarLane?.(minimap, rainstar, visual) || [];

    if (rainstar.hasLane) {
      minimap.fitBounds([[rainstar.start.lat, rainstar.start.lng], [rainstar.reel.lat, rainstar.reel.lng]], { padding: [24, 24], maxZoom: 17 });
    } else {
      minimap.setView([rainstar.reel.lat, rainstar.reel.lng], 16);
    }
  }

  function getRainstarPoint(d, latKeys, lngKeys) {
    const lat = latKeys.map((key) => asFiniteNumber(d?.[key])).find((value) => value != null);
    const lng = lngKeys.map((key) => asFiniteNumber(d?.[key])).find((value) => value != null);
    return lat != null && lng != null ? { lat, lng } : null;
  }

  function bearingRad(from, to) {
    const phi1 = from.lat * Math.PI / 180;
    const phi2 = to.lat * Math.PI / 180;
    const delta = (to.lng - from.lng) * Math.PI / 180;
    const y = Math.sin(delta) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(delta);
    return Math.atan2(y, x);
  }

  function destinationPoint(origin, distanceMeters, bearing) {
    const radius = 6371000;
    const delta = distanceMeters / radius;
    const phi1 = origin.lat * Math.PI / 180;
    const lambda1 = origin.lng * Math.PI / 180;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(bearing));
    const lambda2 = lambda1 + Math.atan2(
      Math.sin(bearing) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );
    return { lat: phi2 * 180 / Math.PI, lng: ((lambda2 * 180 / Math.PI + 540) % 360) - 180 };
  }

  function formatLatLng(point) {
    if (!point) return "--";
    return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
  }

  async function persistStartPosition(equip, start) {
    const farm = activeFarm();
    const d = equip?.data || {};
    d.startLat = start.lat;
    d.startLng = start.lng;
    d.initialLat = start.lat;
    d.initialLng = start.lng;
    d.startPositionPendingIrrigation = true;
    equip.updatedAt = new Date().toISOString();

    if (farm && Array.isArray(farm.equipments)) {
      const liveEquip = farm.equipments.find((item) => String(item?.id || "") === String(equip?.id || ""));
      if (liveEquip) {
        liveEquip.data = liveEquip.data || {};
        liveEquip.data.startLat = start.lat;
        liveEquip.data.startLng = start.lng;
        liveEquip.data.initialLat = start.lat;
        liveEquip.data.initialLng = start.lng;
        liveEquip.data.startPositionPendingIrrigation = true;
        liveEquip.updatedAt = equip.updatedAt;
      }
    }

    if (typeof window.Cad?.data?.getAllFarms !== "function" || typeof window.Cad?.data?.persistFarmDataset !== "function") return false;
    const farms = window.Cad.data.getAllFarms();
    const farmIndex = farms.findIndex((item) => String(item?.id || "") === String(farm?.id || ""));
    if (farmIndex < 0) return false;
    const targetFarm = { ...farms[farmIndex] };
    const equipments = (Array.isArray(targetFarm.equipments) ? targetFarm.equipments : []).map((item) => ({
      ...item,
      data: item?.data && typeof item.data === "object" ? { ...item.data } : {},
    }));
    const equipIndex = equipments.findIndex((item) => String(item?.id || "") === String(equip?.id || ""));
    if (equipIndex < 0) return false;
    equipments[equipIndex] = {
      ...equipments[equipIndex],
      updatedAt: equip.updatedAt,
      data: {
        ...equipments[equipIndex].data,
        startLat: start.lat,
        startLng: start.lng,
        initialLat: start.lat,
        initialLng: start.lng,
        startPositionPendingIrrigation: true,
      },
    };
    targetFarm.equipments = equipments;
    farms[farmIndex] = targetFarm;
    await window.Cad.data.persistFarmDataset(farms);
    window.CreateFarm?.setters?.setFarms?.(farms);
    return true;
  }

  function openSetStartPositionModal(equip) {
    const d = equip?.data || {};
    const pulled = asFiniteNumber(d.pulledPipeLength ?? d.hosePulledLength) || 0;
    if (!(pulled > 0)) {
      alert(t("Puxe a mangueira antes de definir a posição inicial."));
      return;
    }
    if (!window.L) {
      alert(t("Mapa indisponível no momento."));
      return;
    }

    const sprinklerCar = getRainstarPoint(d, ["reelLat", "lat", "centerLat"], ["reelLng", "lng", "centerLng"]);
    if (!sprinklerCar) {
      alert(t("Posição do carro aspersor indisponível."));
      return;
    }

    let selectedStart = getRainstarPoint(d, ["startLat", "initialLat", "refLat"], ["startLng", "initialLng", "refLng"]);
    let startBearing = selectedStart ? bearingRad(sprinklerCar, selectedStart) : null;
    if (startBearing != null) selectedStart = destinationPoint(sprinklerCar, pulled, startBearing);

    const overlay = document.createElement("div");
    overlay.className = "carretel-start-modal-backdrop";
    overlay.innerHTML = `
      <div class="carretel-start-modal" role="dialog" aria-modal="true" aria-label="${t("Posição Inicial da Irrigação")}">
        <button type="button" class="carretel-start-modal__close" aria-label="${t("Fechar")}"><i class="fa-solid fa-xmark"></i></button>
        <h2>${t("Posição Inicial da Irrigação")}</h2>
        <div class="carretel-start-modal__notice"><i class="fa-solid fa-circle-exclamation"></i><span>${t("O ícone indica a posição atual do carro aspersor informada pelo painel. Defina o ponto verde como a posição inicial da irrigação; a distância entre os pontos usa o comprimento de mangueira puxado.")}</span></div>
        <div class="carretel-start-modal__toolbar">
          <label class="carretel-start-modal__field">
            <span><em>*</em> ${t("Posição inicial da irrigação")}</span>
            <strong id="carretelStartLocation">${formatLatLng(selectedStart)}</strong>
          </label>
          <button type="button" class="carretel-start-modal__locate" data-locate><i class="fa-solid fa-location-dot"></i> ${t("Obter localização")}</button>
          <div class="carretel-start-modal__pulled">
            <span>${t("Comprimento puxado")}</span>
            <strong>${fmtNumber(pulled, 1)} m</strong>
          </div>
        </div>
        <div class="carretel-start-modal__map" id="carretelStartMap"></div>
        <div class="carretel-start-modal__actions">
          <button type="button" data-close>${t("Cancelar")}</button>
          <button type="button" class="is-primary" data-save ${selectedStart ? "" : "disabled"}>${t("Salvar")}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => {
      try { startMap?.off(); startMap?.remove(); } catch (_) { }
      overlay.remove();
    };

    const mapEl = overlay.querySelector("#carretelStartMap");
    const startMap = L.map(mapEl, { zoomControl: true, attributionControl: false });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20 }).addTo(startMap);
    const layer = L.layerGroup().addTo(startMap);

    const locationEl = overlay.querySelector("#carretelStartLocation");
    const saveBtn = overlay.querySelector("[data-save]");

    const startIcon = L.divIcon({
      className: "carretel-start-map__start-icon",
      html: '<span></span>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    const hoseIcon = window.IcRainstarReelIcon();

    const renderSelection = ({ fit = false } = {}) => {
      layer.clearLayers();
      L.circle([sprinklerCar.lat, sprinklerCar.lng], {
        radius: pulled,
        color: "#2563eb",
        weight: 2,
        opacity: 0.8,
        dashArray: "6 6",
        fill: true,
        fillColor: "#2563eb",
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(layer);
      L.marker([sprinklerCar.lat, sprinklerCar.lng], {
        icon: hoseIcon,
        interactive: false,
      }).addTo(layer);
      if (selectedStart) {
        L.polyline([[selectedStart.lat, selectedStart.lng], [sprinklerCar.lat, sprinklerCar.lng]], {
          color: "#ffffff",
          weight: 4,
          opacity: 0.9,
        }).addTo(layer);
        L.polyline([[selectedStart.lat, selectedStart.lng], [sprinklerCar.lat, sprinklerCar.lng]], {
          color: "#2563eb",
          weight: 2,
          opacity: 0.95,
        }).addTo(layer);
        const arrowAngle = (bearingRad(selectedStart, sprinklerCar) * 180) / Math.PI;
        L.marker([selectedStart.lat, selectedStart.lng], {
          icon: L.divIcon({
            className: "carretel-start-map__direction-icon",
            html: `<span style="--carretel-start-angle:${arrowAngle}deg;"></span>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          interactive: false,
        }).addTo(layer);
        const marker = L.marker([selectedStart.lat, selectedStart.lng], {
          icon: startIcon,
          draggable: true,
          autoPan: true,
          title: t("Posição inicial"),
        }).addTo(layer);
        marker.on("dragend", (event) => setBearingFromLatLng(event.target.getLatLng(), { fit: false }));
      }
      if (fit) {
        const bounds = selectedStart
          ? L.latLngBounds([[sprinklerCar.lat, sprinklerCar.lng], [selectedStart.lat, selectedStart.lng]])
          : L.latLng(sprinklerCar.lat, sprinklerCar.lng).toBounds(Math.max(pulled * 4, 900));
        startMap.fitBounds(bounds, { padding: [72, 72], maxZoom: 15 });
      }
      if (locationEl) locationEl.textContent = formatLatLng(selectedStart);
      if (saveBtn) saveBtn.disabled = !selectedStart;
    };

    const setBearingFromLatLng = (latlng, { fit = false } = {}) => {
      startBearing = bearingRad(sprinklerCar, { lat: latlng.lat, lng: latlng.lng });
      selectedStart = destinationPoint(sprinklerCar, pulled, startBearing);
      renderSelection({ fit });
    };

    startMap.on("click", (event) => setBearingFromLatLng(event.latlng));
    overlay.querySelector("[data-locate]")?.addEventListener("click", () => {
      if (!navigator.geolocation) {
        alert(t("Geolocalização indisponível no navegador."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => setBearingFromLatLng({ lat: position.coords.latitude, lng: position.coords.longitude }, { fit: true }),
        () => alert(t("Não foi possível obter a localização."))
      );
    });
    overlay.querySelectorAll("[data-close], .carretel-start-modal__close").forEach((btn) => btn.addEventListener("click", close));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    saveBtn?.addEventListener("click", async () => {
      if (!selectedStart) return;
      saveBtn.disabled = true;
      await persistStartPosition(equip, selectedStart);
      close();
      window.IcCarretel?.renderData?.();
      if (window.IcMapRenderPivots) setTimeout(() => window.IcMapRenderPivots(activeFarm()), 0);
    });

    setTimeout(() => {
      startMap.invalidateSize();
      renderSelection({ fit: true });
    }, 80);
  }

  let historyTab = "events";
  let historyFilter = "geral";

  function renderHistory(equip) {
    const head = $("carretelHistoryHead");
    const body = $("carretelHistoryBody");
    if (!head || !body) return;
    const d = equip?.data || {};

    if (historyTab === "operations") {
      head.innerHTML = `<tr><th></th><th>${t("Início")}</th><th>${t("Fim")}</th><th>${t("Hora de Pico")}</th><th>${t("Total")}</th><th>${t("Lâmina d'água")}</th><th>${t("Volume Total Aplicado")}</th><th>${t("Modo")}</th><th>${t("Motivo da Parada")}</th><th>${t("Talhão")}</th></tr>`;
      const rows = buildMockOperationRows(equip, d);
      if (!rows.length) { body.innerHTML = `<tr class="pivo-history__row"><td colspan="10" style="text-align:center;padding:28px 12px;color:#64748b;">${t("Nenhuma operação no período selecionado.")}</td></tr>`; return; }
      body.innerHTML = rows.map((row, i) => {
        const rowId = `op-${i}`;
        return `
        <tr class="pivo-history__row" data-row-id="${rowId}">
          <td class="pivo-history__col-btn"><button class="expand-btn"><i class="fa-solid fa-plus"></i></button></td>
          <td>${row.start}</td>
          <td>${row.end}</td>
          <td>${t(row.peak)}</td>
          <td>${row.total}</td>
          <td>${row.blade}</td>
          <td>${row.volume}</td>
          <td>${t(row.mode)}</td>
          <td>${t(row.stopReason)}</td>
          <td>${t("Talhão")} ${row.plot}</td>
        </tr>
        <tr class="pivo-history__row-details" id="details-${rowId}" style="display:none;">
          <td colspan="10">
            <div class="pivo-history__details">
              <div class="pivo-history__details-grid">
                <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">${t("Pressão Atual")}:</span> <strong class="pivo-history__detail-value">${Number.isFinite(Number(row.pressure ?? d.currentPressure)) ? `${Number(row.pressure ?? d.currentPressure).toFixed(2)}bar` : "--"}</strong></div>
                <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">${t("Velocidade")}:</span> <strong class="pivo-history__detail-value">${fmtNumber(row.speed || d.currentSpeed || 18.8, 1)}m/h</strong></div>
                <div class="pivo-history__detail-item"><span class="pivo-history__detail-label">${t("Largura operacional")}:</span> <strong class="pivo-history__detail-value">${fmtNumber(d.workingWidth || 72, 0)}m</strong></div>
              </div>
            </div>
          </td>
        </tr>`;
      }).join("");
      return;
    }

    head.innerHTML = `<tr><th></th><th>${t("Ocorrência")}</th><th>${t("Tipo")}</th><th>${t("Status")}</th></tr>`;
    const rows = buildMockEventRows(equip, d);
    if (!rows.length) { body.innerHTML = `<tr class="pivo-history__row"><td colspan="4" style="text-align:center;padding:28px 12px;color:#64748b;">${t("Nenhum evento no período selecionado.")}</td></tr>`; return; }
    body.innerHTML = rows.map((row, i) => {
      const rowId = `ev-${i}`;
      return `
      <tr class="pivo-history__row" data-row-id="${rowId}">
        <td class="pivo-history__col-btn"><button class="expand-btn"><i class="fa-solid fa-plus"></i></button></td>
        <td>${row.date}</td>
        <td>${t(row.type)}</td>
        <td>${t(row.status)}</td>
      </tr>
      <tr class="pivo-history__row-details" id="details-${rowId}" style="display:none;">
        <td colspan="4">
          ${buildEventDetailsHtml(historyFilter)}
        </td>
      </tr>`
    }).join("");
  }

  function asFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function toDate(value) {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function readPointArray(source, valueKeys, dateKeys = ["date", "time", "timestamp", "createdAt"]) {
    if (!Array.isArray(source)) return [];
    return source.map((item, index) => {
      const rawValue = valueKeys.map((key) => item?.[key]).find((value) => asFiniteNumber(value) != null);
      const value = asFiniteNumber(rawValue);
      if (value == null) return null;
      const rawDate = dateKeys.map((key) => item?.[key]).find(Boolean);
      return { value, date: rawDate ? toDate(rawDate) : null, index };
    }).filter(Boolean);
  }

  function seedFor(equip) {
    let seed = 0;
    String(equip?.id || equip?.name || "carretel").split("").forEach((ch) => {
      seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0;
    });
    return seed || 1;
  }

  function seededUnit(seed, index) {
    let t = (seed + Math.imul(index + 1, 0x6d2b79f5)) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function buildDailyHoursSeries(equip, d) {
    if (engineOk(equip)) {
      const DH = window.IcDemoHistory;
      const range = engineRange();
      const ops = DH.reel.ops(equip, range.start, range.end);
      return DH.dailyFromOps(ops, range.start, range.end, "durH").map((p, index) => ({ value: Math.round(p.value * 10) / 10, date: p.date, index }));
    }
    const history = readPointArray(d.dailyHourmeter || d.hourmeterDaily || d.dailyHours || d.hourHistory, ["hours", "hourmeter", "value", "total"]);
    if (history.length) return history;

    const speed = asFiniteNumber(d.currentSpeed);
    const pulled = asFiniteNumber(d.pulledPipeLength ?? d.hosePulledLength);
    const explicit = asFiniteNumber(d.dailyHourmeterHours ?? d.currentDailyHours ?? d.hoursToday);
    const currentHours = explicit ?? (speed && pulled != null ? pulled / speed : null);
    const base = Math.max(2.5, Math.min(18, currentHours ?? 9 + (seedFor(equip) % 5)));
    const end = toDate(d.lastCommunication || equip?.updatedAt || equip?.createdAt);
    const seed = seedFor(equip);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(end.getTime() - (6 - index) * 86400000);
      const wave = Math.sin((index + 1) * 0.9 + (seed % 11)) * 0.18;
      const jitter = (seededUnit(seed, index) - 0.5) * 0.22;
      const value = Math.max(0, Math.min(24, base * (1 + wave + jitter)));
      return { value: Math.round(value * 10) / 10, date, index };
    });
  }

  function buildFlowSeries(equip, d) {
    if (engineOk(equip)) {
      const DH = window.IcDemoHistory;
      const range = engineRange();
      const ops = DH.reel.ops(equip, range.start, range.end).slice().reverse();
      if (ops.length) return ops.map((op, index) => ({ value: Math.round(op.laminaMm * 100) / 100, date: op.start, index }));
    }
    const history = readPointArray(d.flowHistory || d.flowRateHistory || d.flowReadings || d.telemetry?.flow, ["flow", "flowRate", "currentFlow", "value"]);
    if (history.length) return history;

    const current = asFiniteNumber(d.currentFlow ?? d.currentFlowRate ?? d.flowRate ?? d.flow);
    const base = Math.max(4, current ?? 14);
    const end = toDate(d.lastCommunication || equip?.updatedAt || equip?.createdAt);
    const seed = seedFor(equip) + 97;
    return Array.from({ length: 9 }, (_, index) => {
      const date = new Date(end.getTime() - (8 - index) * 3 * 3600000);
      const wave = Math.sin(index * 0.75 + (seed % 13)) * 0.1;
      const jitter = (seededUnit(seed, index) - 0.5) * 0.08;
      const value = Math.max(0, base * (1 + wave + jitter));
      return { value: Math.round(value * 10) / 10, date, index };
    });
  }

  // "Nice" round step for a Y axis with `steps` gridlines cobrindo [0, max].
  function niceAxisMax(max, steps) {
    if (!(max > 0)) return { max: steps, step: 1 };
    const rawStep = max / steps;
    const pow10 = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const options = [1, 2, 2.5, 5, 10].map((m) => m * pow10);
    const step = options.find((o) => o * steps >= max) || options[options.length - 1];
    return { max: step * steps, step };
  }

  function smoothPath(points) {
    if (points.length < 2) return "";
    let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y - (p0.y - p2.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y + (p1.y - p3.y) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }

  function fmtChartDate(date) {
    if (!date) return t("Hoje");
    return date.toLocaleDateString(window.IcI18n?.getLocale?.() || "pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  }

  function fmtChartDateTime(date) {
    if (!date) return t("Hoje");
    const locale = window.IcI18n?.getLocale?.() || "pt-BR";
    const day = date.toLocaleDateString(locale, { day: "2-digit", month: "short" }).replace(".", "");
    const hour = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    return `${day} ${hour}`;
  }

  function fmtChartTime(date) {
    if (!date) return "";
    return date.toLocaleTimeString(window.IcI18n?.getLocale?.() || "pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function setAxisLabels(container, selector, values) {
    container?.querySelectorAll(`${selector} span`).forEach((span, i) => {
      span.textContent = values[i] ?? "";
    });
  }

  function attachBarTooltip(plotSelector, barsEl) {
    const plot = document.querySelector(plotSelector);
    if (!plot || !barsEl) return;
    plot.querySelectorAll(":scope > .carretel-chart-tooltip").forEach((el) => el.remove());
    const tooltip = document.createElement("div");
    tooltip.className = "carretel-chart-tooltip";
    tooltip.innerHTML = `<span class="carretel-chart-tooltip__dot"></span><span class="carretel-chart-tooltip__label"></span><strong class="carretel-chart-tooltip__value"></strong>`;
    plot.appendChild(tooltip);
    const dotEl = tooltip.querySelector(".carretel-chart-tooltip__dot");
    const labelEl = tooltip.querySelector(".carretel-chart-tooltip__label");
    const valueEl = tooltip.querySelector(".carretel-chart-tooltip__value");
    const hide = () => tooltip.classList.remove("is-visible");
    const positionTooltip = (event, fallbackEl) => {
      const rect = plot.getBoundingClientRect();
      const fallbackRect = fallbackEl?.getBoundingClientRect?.();
      const clientX = Number.isFinite(event.clientX) ? event.clientX : (fallbackRect ? fallbackRect.left + fallbackRect.width / 2 : rect.left);
      const clientY = Number.isFinite(event.clientY) ? event.clientY : (fallbackRect ? fallbackRect.top : rect.top);
      tooltip.style.left = `${clientX - rect.left}px`;
      tooltip.style.top = `${clientY - rect.top}px`;
    };
    barsEl.querySelectorAll(".carretel-bar-chart__group").forEach((group) => {
      const show = (event) => {
        if (dotEl) dotEl.style.background = group.dataset.color || "#60a5fa";
        if (labelEl) labelEl.textContent = group.dataset.label || "";
        if (valueEl) valueEl.textContent = group.dataset.tooltipValue || "--";
        positionTooltip(event, group);
        tooltip.classList.add("is-visible");
      };
      group.addEventListener("mouseenter", show);
      group.addEventListener("mousemove", positionTooltip);
      group.addEventListener("focusin", show);
      group.addEventListener("mouseleave", hide);
      group.addEventListener("focusout", hide);
    });
  }

  function renderLineChart(el, readings, { label, color, unit, yTitle, xTitle, formatX = fmtChartDate, formatTickX = formatX }) {
    if (!el) return;
    el.setAttribute("data-i18n-skip", "");
    if (el._lineHoverCleanup) el._lineHoverCleanup();
    el.querySelectorAll(".carretel-line-chart__svg, .carretel-line-chart__hover, .carretel-line-chart__axis-title").forEach((node) => node.remove());
    if (!readings.length) return;

    const steps = 5;
    const values = readings.map((point) => Math.max(0, point.value));
    const lo = 0;
    const { max: hi } = niceAxisMax(Math.max(...values, 0.1), steps);
    const yLabels = [];
    for (let i = steps; i >= 0; i -= 1) yLabels.push(fmtNumber(lo + ((hi - lo) / steps) * i, hi < 10 ? 1 : 0));
    setAxisLabels(el, ".carretel-line-chart__y", yLabels);
    const xLabels = ["", "", "", "", ""];
    if (readings.length === 1) xLabels[2] = formatTickX(readings[0].date);
    else [0, 1, 2, 3, 4].forEach((slot) => {
      const idx = Math.round((slot / 4) * (readings.length - 1));
      xLabels[slot] = formatTickX(readings[idx].date);
    });
    setAxisLabels(el, ".carretel-line-chart__x", xLabels);

    const W = 1000, H = 250;
    const sx = (index) => readings.length === 1 ? W / 2 : (index / (readings.length - 1)) * W;
    const sy = (value) => H - ((value - lo) / (hi - lo || 1)) * H;
    const px = readings.map((point, index) => ({ x: sx(index), y: sy(point.value), point }));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "carretel-line-chart__svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "none");
    for (let i = 1; i < 5; i += 1) {
      const grid = document.createElementNS("http://www.w3.org/2000/svg", "line");
      grid.setAttribute("x1", 0);
      grid.setAttribute("x2", W);
      grid.setAttribute("y1", (H / 5) * i);
      grid.setAttribute("y2", (H / 5) * i);
      grid.setAttribute("class", "carretel-line-chart__grid-line");
      svg.appendChild(grid);
    }
    if (px.length > 1) {
      const line = smoothPath(px);
      const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
      area.setAttribute("d", `${line} L${px[px.length - 1].x.toFixed(1)},${H} L${px[0].x.toFixed(1)},${H} Z`);
      area.setAttribute("fill", color);
      area.setAttribute("fill-opacity", "0.12");
      svg.appendChild(area);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", line);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(path);
    }
    px.forEach((p) => {
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", p.x.toFixed(1));
      dot.setAttribute("cy", p.y.toFixed(1));
      dot.setAttribute("r", "3");
      dot.setAttribute("fill", color);
      svg.appendChild(dot);
    });
    el.appendChild(svg);

    [{ text: yTitle, cls: "carretel-line-chart__axis-title--y" }, { text: xTitle, cls: "carretel-line-chart__axis-title--x" }].forEach((axis) => {
      const axisEl = document.createElement("span");
      axisEl.className = `carretel-line-chart__axis-title ${axis.cls}`;
      axisEl.textContent = axis.text;
      el.appendChild(axisEl);
    });

    const hover = document.createElement("div");
    hover.className = "carretel-line-chart__hover";
    hover.hidden = true;
    hover.innerHTML = `<div class="carretel-line-chart__hover-line"></div><div class="carretel-line-chart__hover-dot" style="--c:${color}"></div><div class="carretel-line-chart__hover-tip"></div>`;
    el.appendChild(hover);
    const dot = hover.querySelector(".carretel-line-chart__hover-dot");
    const tip = hover.querySelector(".carretel-line-chart__hover-tip");
    const move = (event) => {
      const rect = el.getBoundingClientRect();
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const idx = readings.length === 1 ? 0 : Math.round(ratio * (readings.length - 1));
      const point = readings[idx];
      const dotRatio = readings.length === 1 ? 0.5 : idx / (readings.length - 1);
      hover.hidden = false;
      hover.style.left = `${dotRatio * 100}%`;
      dot.style.top = `${(sy(point.value) / H) * 100}%`;
      tip.innerHTML = `<strong>${formatX(point.date)}</strong><span class="carretel-line-chart__hover-row"><i style="background:${color}"></i>${label}: <b>${fmtNumber(point.value, 1)} ${unit}</b></span>`;
      tip.classList.toggle("is-right", dotRatio > 0.62);
    };
    const leave = () => { hover.hidden = true; };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", leave);
    el._lineHoverCleanup = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", leave);
    };
  }

  function renderBars(equip, d) {
    const barsEl = $("carretelDailyBars");
    const yEl = $("carretelDailyY");
    if (!barsEl) return;
    const points = buildDailyHoursSeries(equip, d || equip?.data || {});
    const vals = points.map((point) => point.value);
    const { max: yMax, step: yStep } = niceAxisMax(Math.max(...vals, 0.1), 4);
    if (yEl) yEl.innerHTML = [4, 3, 2, 1, 0].map((i) => `<span>${fmtNumber(yStep * i, yMax < 10 ? 1 : 0)} h</span>`).join("");
    const plotEl = document.querySelector("#carretelDailyChart .carretel-bar-chart__plot");
    const isScrollable = points.length > 12;
    barsEl.style.gridTemplateColumns = isScrollable ? `repeat(${points.length}, 40px)` : `repeat(${Math.max(1, points.length)}, minmax(44px, 1fr))`;
    barsEl.style.width = isScrollable ? "max-content" : "";
    barsEl.style.minWidth = "100%";
    if (plotEl) {
      plotEl.style.width = isScrollable ? "max-content" : "";
      plotEl.style.minWidth = "100%";
    }
    barsEl.innerHTML = points.map((point) => {
      const heightPct = yMax > 0 ? (point.value / yMax) * 100 : 0;
      const label = fmtChartDate(point.date);
      const isZero = point.value <= 0;
      return `
        <div class="carretel-bar-chart__group" data-label="${label}" data-tooltip-value="${fmtNumber(point.value, 1)} h" data-color="${isZero ? "#1f2937" : "#60a5fa"}" style="cursor:default;">
          <div class="carretel-bar-chart__columns">
            <div class="carretel-bar-chart__bar ${isZero ? "is-zero" : "is-hourmeter"}" style="height:${heightPct.toFixed(2)}%;"></div>
          </div>
          <div class="carretel-bar-chart__label">${label}</div>
        </div>`;
    }).join("");
    attachBarTooltip("#carretelDailyChart .carretel-bar-chart__plot", barsEl);

  }

  function renderFlowChart(equip, d) {
    const barsEl = $("carretelFlowBars");
    const yEl = $("carretelFlowY");
    if (!barsEl) return;
    const points = buildFlowSeries(equip, d);
    if (!points.length) return;
    const vals = points.map((p) => p.value);
    const { max: yMax, step: yStep } = niceAxisMax(Math.max(...vals, 0.1), 4);
    if (yEl) yEl.innerHTML = [4, 3, 2, 1, 0].map((i) => `<span>${fmtNumber(yStep * i, yMax < 10 ? 1 : 0)}</span>`).join("");
    const plotEl = document.querySelector("#carretelFlowChart .carretel-bar-chart__plot");
    const isScrollable = points.length > 12;
    barsEl.style.gridTemplateColumns = isScrollable ? `repeat(${points.length}, 40px)` : `repeat(${Math.max(1, points.length)}, minmax(44px, 1fr))`;
    barsEl.style.width = isScrollable ? "max-content" : "";
    barsEl.style.minWidth = "100%";
    if (plotEl) {
      plotEl.style.width = isScrollable ? "max-content" : "";
      plotEl.style.minWidth = "100%";
    }
    barsEl.innerHTML = points.map((point) => {
      const heightPct = yMax > 0 ? (point.value / yMax) * 100 : 0;
      // uma barra por operação do período → rótulo com o dia da operação
      const label = fmtChartDate(point.date);
      return `
        <div class="carretel-bar-chart__group" data-label="${fmtChartDateTime(point.date)}" data-tooltip-value="${fmtNumber(point.value, 2)} mm" data-color="#3b82f6" style="cursor:default;">
          <div class="carretel-bar-chart__columns">
            <div class="carretel-bar-chart__bar" style="height:${heightPct.toFixed(2)}%; background:#3b82f6;"></div>
          </div>
          <div class="carretel-bar-chart__label">${label}</div>
        </div>`;
    }).join("");
    attachBarTooltip("#carretelFlowChart .carretel-bar-chart__plot", barsEl);
  }

  function openStartModal(equip) {
    const d = equip?.data || {};
    const overlay = document.createElement("div");
    overlay.className = "carretel-modal-backdrop";
    overlay.innerHTML = `
      <div class="carretel-modal" role="dialog" aria-modal="true" aria-label="${t("Iniciar Carretel")}">
        <div class="carretel-modal__header-actions">
          <button type="button" class="carretel-modal__close" aria-label="${t("Fechar")}"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <h2>${t("Iniciar Carretel")}</h2>
        <div class="carretel-modal__info"><i class="fa-solid fa-circle-info"></i> ${t("Ajuste os parâmetros para iniciar a irrigação")}</div>
        <h3>${t("Operação")}</h3>
        <div class="carretel-modal__tabs">
          <button type="button" class="is-active" data-op-tab="speed">${t("Definir Velocidade")}</button>
          <button type="button" data-op-tab="rate">${t("Definir Taxa de Irrigação")}</button>
          <button type="button" data-op-tab="zones">${t("Zonas de Irrigação")}</button>
        </div>
        <div class="carretel-modal__grid">
          <label data-op-field="speed"><span class="carretel-modal__field-label">${t("Velocidade")}</span><span><input value="${fmtNumber(d.currentSpeed || 18.8, 1)}"><em>m/h</em></span></label>
          <label data-op-field="rate" class="is-disabled"><span class="carretel-modal__field-label">${t("Taxa de Irrigação")}</span><span><input value="${fmtNumber(d.irrigationRate || 23.79, 2)}" disabled><em>mm</em></span></label>
        </div>
        <div class="carretel-modal__zones-readonly" data-op-field="zones" style="display:none;">${buildZonesBarHtml(d.zones)}</div>
        <div class="carretel-modal__schedule">
          <span>${t("Você deseja agendar a execução?")}</span>
          <label class="pivo-edit__switch">
            <input type="checkbox" id="carretelModalSchedule">
            <span class="pivo-edit__switch-slider"></span>
          </label>
        </div>
        <label class="carretel-modal__time-field"><span><input class="carretel-modal__time" placeholder="${t("Hora")}" disabled><em><i class="fa-regular fa-clock"></i></em></span></label>
        <p>${t('O "Modo de Irrigação" deve estar configurado como "Hora de início programada" para usar o agendamento.')}</p>
        <div class="carretel-modal__actions"><button type="button" data-close>${t("Cancelar")}</button><button type="button" class="is-primary" data-close data-demo-start>${t("Iniciar")}</button></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll("[data-close], .carretel-modal__close").forEach((btn) => btn.addEventListener("click", () => overlay.remove()));

    // DEMO: "Iniciar" dispara a simulação do carretel com a velocidade informada
    overlay.querySelector("[data-demo-start]")?.addEventListener("click", () => {
      if (!equip?.id || !window.IcCarretelSim) return;
      const speedInput = overlay.querySelector('[data-op-field="speed"] input');
      const speed = parseFloat(String(speedInput?.value || "").replace(",", "."));
      const scheduled = overlay.querySelector("#carretelModalSchedule")?.checked;
      if (scheduled) {
        window.IcNotify?.success?.(t("Irrigação agendada (demo)."));
        return;
      }
      if (window.IcCarretelSim.start(equip.id, { speed: Number.isFinite(speed) && speed > 0 ? speed : undefined })) {
        window.IcNotify?.success?.(t("Carretel iniciado."));
      }
    });

    const modalGrid = overlay.querySelector(".carretel-modal__grid");
    overlay.querySelectorAll("[data-op-tab]").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        const key = tabBtn.dataset.opTab;
        overlay.querySelectorAll("[data-op-tab]").forEach((b) => b.classList.toggle("is-active", b === tabBtn));
        if (modalGrid) modalGrid.style.display = key === "zones" ? "none" : "";
        overlay.querySelectorAll("[data-op-field]").forEach((field) => {
          const isActive = field.dataset.opField === key;
          field.classList.toggle("is-disabled", !isActive);
          field.style.display = field.dataset.opField === "zones" ? (isActive ? "block" : "none") : "";
          const input = field.querySelector("input");
          if (input) input.disabled = !isActive;
        });
      });
    });

    const scheduleToggle = overlay.querySelector("#carretelModalSchedule");
    const timeInput = overlay.querySelector(".carretel-modal__time");
    scheduleToggle?.addEventListener("change", () => {
      if (timeInput) timeInput.disabled = !scheduleToggle.checked;
    });

    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
  }

  function renderKpiPre(enabled) {
    setText("carretelKpiPre", `${t("Pré")} - ${enabled ? t("Habilitado") : t("Desabilitado")}`);
  }

  function renderKpiPost(enabled) {
    setText("carretelKpiPost", `${t("Pós")} - ${enabled ? t("Habilitado") : t("Desabilitado")}`);
  }

  document.addEventListener("pluv:periodChanged", () => {
    if (!$("carretelHistoryBody")) return;
    const equip = getSelected();
    if (!equip) return;
    renderHistory(equip);
    renderBars(equip, equip.data || {});
    renderFlowChart(equip, equip.data || {});
  });

  window.IcCarretel = {
    async open(options = {}) {
      selectedId = options.carretelId || selectedId || rainstars()[0]?.id || null;
      const slot = $("pageSlot");
      if (!slot) return;
      document.body.classList.remove("is-pivo-details-only");
      document.body.classList.add("is-pivo-details");
      window.icMapSetWheelMode?.("ctrl");
      try {
        const html = await fetch(`./pages/carretel.details.html?v=${Date.now()}`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
        slot.innerHTML = html;
        this.bindEvents();
        this.renderData();
        if (options.fromMap) slot.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        document.body.classList.remove("is-pivo-details");
        window.icMapSetWheelMode?.("free");
        console.error("Failed to load carretel.details.html", err);
      }
    },

    close() {
      const slot = $("pageSlot");
      if (slot) slot.innerHTML = "";
      document.body.classList.remove("is-pivo-details");
      window.icMapSetWheelMode?.("free");
      if (minimap) {
        try { minimap.off(); minimap.remove(); } catch (_) { }
        minimap = null;
        minimapLayers = [];
      }
    },

    bindEvents() {
      document.querySelectorAll(".js-carretel-back").forEach((btn) => btn.addEventListener("click", () => {
        this.close();
        document.querySelector('.nav__item[data-route="visao-geral"]')?.click();
      }));
      const menu = $("carretelSelectorMenu");
      if (menu) {
        if (selectorOutsideClickHandler) document.removeEventListener("click", selectorOutsideClickHandler);
        selectorOutsideClickHandler = (event) => {
          const btn = event.target.closest("#carretelSelectBtn");
          if (btn) {
            event.stopPropagation();
            const hidden = getComputedStyle(menu).display === "none";
            if (hidden) renderSelectorItems(menu);
            menu.style.display = hidden ? "flex" : "none";
            btn.classList.toggle("is-active", hidden);
            return;
          }
          if (!menu.contains(event.target)) {
            menu.style.display = "none";
            $("carretelSelectBtn")?.classList.remove("is-active");
          }
        };
        document.addEventListener("click", selectorOutsideClickHandler);
      }
      document.querySelectorAll("[data-carretel-history-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          historyTab = btn.dataset.carretelHistoryTab;
          document.querySelectorAll("[data-carretel-history-tab]").forEach((b) => b.classList.toggle("is-active", b === btn));
          $("carretelHistoryFilterBtn").disabled = historyTab !== "events";
          renderHistory(getSelected());
        });
      });

      // Expandir/recolher detalhes de uma linha do histórico — delegado no
      // tbody, já que as linhas são recriadas a cada renderHistory().
      $("carretelHistoryBody")?.addEventListener("click", (event) => {
        const expandBtn = event.target.closest(".expand-btn");
        if (!expandBtn) return;
        const row = expandBtn.closest(".pivo-history__row");
        const detailsRow = row?.nextElementSibling;
        if (!detailsRow || !detailsRow.classList.contains("pivo-history__row-details")) return;
        const isExpanded = detailsRow.style.display !== "none";
        detailsRow.style.display = isExpanded ? "none" : "table-row";
        const icon = expandBtn.querySelector("i");
        if (icon) icon.className = isExpanded ? "fa-solid fa-plus" : "fa-solid fa-minus";
      });

      const filterWrap = $("carretelHistoryFilter");
      const filterBtn = $("carretelHistoryFilterBtn");
      const filterLabel = $("carretelHistoryFilterLabel");
      if (filterBtn) filterBtn.disabled = historyTab !== "events";
      filterBtn?.addEventListener("click", () => {
        if (filterBtn.disabled) return;
        filterWrap?.classList.toggle("is-open");
      });
      filterWrap?.querySelectorAll("[data-filter-value]").forEach((opt) => {
        opt.addEventListener("click", () => {
          filterWrap.querySelectorAll("[data-filter-value]").forEach((o) => o.classList.toggle("is-active", o === opt));
          if (filterLabel) filterLabel.textContent = opt.textContent;
          historyFilter = opt.dataset.filterValue || "geral";
          filterWrap.classList.remove("is-open");
          renderHistory(getSelected());
        });
      });
      document.addEventListener("click", (event) => {
        if (filterWrap && !filterWrap.contains(event.target)) filterWrap.classList.remove("is-open");
      });
      $("carretelStartBtn")?.addEventListener("click", () => openStartModal(getSelected()));
      $("carretelStopBtn")?.addEventListener("click", () => {
        const equip = getSelected();
        if (equip && window.IcCarretelSim) { window.IcCarretelSim.stop(equip.id); window.IcNotify?.success?.(t("Carretel desligado.")); }
      });
      $("carretelSetStartBtn")?.addEventListener("click", () => openSetStartPositionModal(getSelected()));
      $("carretelEditBtn")?.addEventListener("click", () => {
        const equip = getSelected();
        if (window.IcCarretelEdit && equip) {
          // Abre o edit como overlay por cima da tela de detalhes (igual ao pivo)
          window.IcCarretelEdit.open({ carretelId: equip.id });
        } else {
          alert(t("Edição do carretel será implementada na próxima etapa do plano."));
        }
      });
    },

    renderData() {
      const equip = getSelected();
      if (!equip) return;
      selectedId = equip.id;
      const d = equip.data || {};
      const meta = statusMeta(equip);
      const status = $("carretelStatus");
      if (status) {
        status.className = `pincard__status-bar ${meta.cls}`;
        const speed = Number(d.currentSpeed);
        const isIrrigating = meta.text === "IRRIGANDO";
        const extra = isIrrigating && Number.isFinite(speed) ? `  ${fmtNumber(speed, 1)}m/h${d.timeRemaining ? `  ${d.timeRemaining}` : ""}` : "";
        status.querySelector(".pincard__status-text").textContent = `${t(meta.text)}${extra}`;
      }
      setText("carretelTitleLabel", equip.name || d.name || "Carretel");
      setText("carretelPulled", `${fmtNumber(d.pulledPipeLength, 1)}m`.replace(".0m", "m"));
      setText("carretelPressure", Number.isFinite(Number(d.currentPressure)) ? `${Number(d.currentPressure).toFixed(2)}bar` : "--");
      setText("carretelSignal", t(d.signal || (d.connected === false ? "Sem sinal" : "Bom")));
      setText("carretelBattery", Number.isFinite(Number(d.battery)) ? `${Number(d.battery).toFixed(0)}%` : "--");
      let lastRaw = d.lastCommunication || equip.updatedAt || equip.createdAt;
      if (window.IcDemoHistory) {
        const eng = window.IcDemoHistory.lastCommunication(equip);
        const cur = new Date(lastRaw);
        if (Number.isNaN(cur.getTime()) || eng - cur > 3600000) lastRaw = eng;
      }
      const last = fmtDate(lastRaw);
      window.Plv?.period?.syncUI?.();
      const lastEl = $("carretelLastUpdate");
      if (lastEl) lastEl.innerHTML = `<span class="comm-label">${t("Última comunicação:")}</span> ${last}`;
      setText("carretelKpiPulled", `${fmtNumber(d.pulledPipeLength, 1)}m`.replace(".0m", "m"));
      setText("carretelKpiSpeed", Number.isFinite(Number(d.currentSpeed)) ? `${fmtNumber(d.currentSpeed, 1)} m/h` : "--");
      setText("carretelKpiTime", d.timeRemaining || "--");
      renderKpiPre(d.preIrrigation?.enabled);
      renderKpiPost(d.postIrrigation?.enabled);
      setText("carretelKpiFirmware", d.firmwareVersion || "--");
      const setStartBtn = $("carretelSetStartBtn");
      if (setStartBtn) {
        const canSetStart = (asFiniteNumber(d.pulledPipeLength ?? d.hosePulledLength) || 0) > 0;
        setStartBtn.disabled = !canSetStart;
        setStartBtn.classList.toggle("is-disabled", !canSetStart);
        setStartBtn.title = canSetStart ? "" : t("Puxe a mangueira antes de definir a posição inicial.");
      }
      renderHistory(equip);
      renderBars(equip, d);
      renderFlowChart(equip, d);
      setTimeout(initMinimap, 80);
    },

    openStartModal,
    openSetStartPositionModal,
  };
})();

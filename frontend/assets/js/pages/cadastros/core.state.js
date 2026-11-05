(function () {
  "use strict";
  const Cad = (window.Cad = window.Cad || {});

  Cad.BR_VIEW = { center: [-14.235, -51.9253], zoom: 4 };

  Cad.SEG_COLORS = ["#1D4ED8", "#8B5CF6", "#22C55E", "#84CC16", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#F43F5E"];

  Cad.FARM_API_URL = `${window.IC_API_CONFIG?.baseUrl || ""}/api/farms`;

  Cad.EQUIP_CATEGORY_BY_TYPE = {
    smart_connect: "pivos",
    smarttouch: "pivos",
    irripump: "bombas",
    medidor: "medidores",
    pluviometro: "pluviometros",
    repetidora: "repetidoras",
    rainstar: "carreteis",
    estacao_metereologica: "estacoes",
    cosmofield: "cosmofields"
  };

  Cad.EQUIP_TYPE_OPTIONS = [
    { value: "smart_connect", label: "Central (SmartConnect)" },
    { value: "repetidora", label: "Repetidora" },
    { value: "irripump", label: "Irripump" },
    { value: "medidor", label: "Medidor de Nível" },
    { value: "pluviometro", label: "Pluviômetro" },
    { value: "estacao_metereologica", label: "Estação Meteorológica" },
    { value: "rainstar", label: "Carretel (Rainstar)" }
  ];

  Cad.EQUIP_PICKER_CARDS = [
    { value: "irripump", label: "Irripump", img: "./assets/img/equipamentos/irripump.png", desc: "Painel de controle de bombeamentos para a casa de bombas." },
    { value: "medidor", label: "Medidor de Nível", img: "./assets/img/equipamentos/medidor.png", desc: "Medidor de nível para monitoramento de poços, rios e reservatórios." },
    { value: "repetidora", label: "Repetidora", img: "./assets/img/equipamentos/repetidora.png", desc: "Repetidoras de sinal, solares ou bivolt, para a rede mesh Irricontrol." },
    { value: "pluviometro", label: "Pluviômetro", img: "./assets/img/equipamentos/pluviometro.png", desc: "Pluviômetro para monitoramento de chuva e precipitação." },
    { value: "estacao_metereologica", label: "Estação Meteorológica", img: "./assets/img/equipamentos/estacao_metereologica.png", desc: "Estações meteorológicas para monitoramento de microclima e previsão do tempo." },
    { value: "rainstar", label: "Carretel (Rainstar)", img: "./assets/img/equipamentos/rainstar.png", desc: "Carretéis Bauer da série Rainstar com Ecostar embarcada." },
  ];

  // Mutable map references wrapped in object so assignments are visible cross-file
  Cad.maps = {
    fazendasMap: null,
    fazendasMapLayer: null,
    fazendasPickLayer: null,
    fazendasFarmMarker: null,
    fazendasCentralMarker: null,
    sectionMaps: {},
    pivoTalhoesOutsideClickHandler: null,
  };

  Cad.state = {
    activeView: 'list',
    currentType: null,
    editingId: null,
    isPickingFarmLocation: false,
    isPickingCentralLocation: false,
    isPickingEquipmentLocation: false
  };

  Cad.talhoesState = {
    map: null,
    points: [],
    polygon: null,
    previewPolygon: null,
    hoverPoint: null,
    draftLine: null,
    allLayer: null,
    editLayer: null,
    drawLayer: null,
    isDrawing: false,
    vertexMarkers: [],
    midpointMarkers: []
  };

  Cad.pivosState = {
    map: null,
    listLayer: null,
    editLayer: null,
    talhoesBgLayer: null,
    pickTarget: null
  };

  // MOJIBAKE patterns for encoding detection
  Cad.MOJIBAKE_PATTERN = /(?:[\uFFFD]f[\u0080-\u00BF]|[\uFFFD],[\u0080-\u00BF]|â[\u0080-\u00BF])/;
  Cad.MOJIBAKE_PATTERN_GLOBAL = /(?:[\uFFFD]f[\u0080-\u00BF]|[\uFFFD],[\u0080-\u00BF]|â[\u0080-\u00BF])/g;

})();

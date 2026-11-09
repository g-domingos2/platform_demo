// assets/js/pages/relatorios/index.js
(function () {
  "use strict";
  const tMsg = (text) => window.IcI18n?.t?.(text) ?? text;

  // Tradução pontual para rótulos definidos via JS (lê a preferência de idioma).
  // Prioriza o dicionário do idioma ativo (en/es/...); se faltar e o idioma for
  // inglês, usa o "en" inline; caso contrário mantém o português.
  const IRRIGATION_DETAIL_DATA = {
    "irrigationDetailRow1": [
      [
        "28/07/2026",
        "Irrigação",
        "237,59",
        "57,59",
        "7,69",
        "3.270,06",
        "3,85",
        "768,46"
      ],
      [
        "24/07/2026",
        "Irrigação",
        "147,59",
        "237,59",
        "7,30",
        "1.550,91",
        "1,82",
        "364,46"
      ],
      [
        "19/07/2026",
        "Irrigação",
        "27,59",
        "147,59",
        "7,23",
        "2.048,50",
        "2,41",
        "481,40"
      ],
      [
        "13/07/2026",
        "Irrigação",
        "297,59",
        "27,59",
        "6,77",
        "1.439,47",
        "1,69",
        "338,28"
      ],
      [
        "06/07/2026",
        "Irrigação",
        "177,59",
        "297,59",
        "7,05",
        "1.996,82",
        "2,35",
        "469,25"
      ],
      [
        "29/06/2026",
        "Irrigação",
        "87,59",
        "177,59",
        "7,40",
        "1.572,37",
        "1,85",
        "369,51"
      ],
      [
        "24/06/2026",
        "Irrigação",
        "267,59",
        "87,59",
        "7,42",
        "3.152,32",
        "3,71",
        "740,80"
      ],
      [
        "20/06/2026",
        "Irrigação",
        "177,59",
        "267,59",
        "7,53",
        "1.599,77",
        "1,88",
        "375,95"
      ],
      [
        "14/06/2026",
        "Irrigação",
        "177,59",
        "177,59",
        "6,83",
        "5.804,53",
        "6,83",
        "1.364,06"
      ],
      [
        "09/06/2026",
        "Irrigação",
        "177,59",
        "177,59",
        "7,10",
        "6.038,30",
        "7,10",
        "1.419,00"
      ],
      [
        "06/06/2026",
        "Irrigação",
        "177,59",
        "177,59",
        "7,42",
        "6.307,19",
        "7,42",
        "1.482,19"
      ],
      [
        "01/06/2026",
        "Irrigação",
        "57,59",
        "177,59",
        "7,71",
        "2.184,21",
        "2,57",
        "513,29"
      ]
    ],
    "irrigationDetailRow2": [
      [
        "28/07/2026",
        "Irrigação",
        "344,13",
        "104,13",
        "7,44",
        "2.357,56",
        "2,48",
        "554,03"
      ],
      [
        "23/07/2026",
        "Irrigação",
        "344,13",
        "344,13",
        "7,70",
        "7.319,61",
        "7,70",
        "1.720,11"
      ],
      [
        "21/07/2026",
        "Irrigação",
        "344,13",
        "344,13",
        "7,31",
        "6.948,53",
        "7,31",
        "1.632,91"
      ],
      [
        "15/07/2026",
        "Irrigação",
        "164,13",
        "344,13",
        "7,34",
        "3.485,77",
        "3,67",
        "819,15"
      ],
      [
        "12/07/2026",
        "Irrigação",
        "74,13",
        "164,13",
        "8,21",
        "1.950,68",
        "2,05",
        "458,41"
      ],
      [
        "05/07/2026",
        "Irrigação",
        "74,13",
        "74,13",
        "7,96",
        "7.565,45",
        "7,96",
        "1.777,88"
      ],
      [
        "03/07/2026",
        "Irrigação",
        "344,13",
        "74,13",
        "7,98",
        "1.894,22",
        "1,99",
        "445,14"
      ],
      [
        "28/06/2026",
        "Irrigação",
        "344,13",
        "344,13",
        "7,73",
        "7.343,56",
        "7,73",
        "1.725,74"
      ],
      [
        "24/06/2026",
        "Irrigação",
        "164,13",
        "344,13",
        "7,24",
        "3.440,34",
        "3,62",
        "808,48"
      ],
      [
        "19/06/2026",
        "Irrigação",
        "74,13",
        "164,13",
        "7,73",
        "1.834,81",
        "1,93",
        "431,18"
      ],
      [
        "15/06/2026",
        "Irrigação",
        "344,13",
        "74,13",
        "7,05",
        "1.674,40",
        "1,76",
        "393,48"
      ],
      [
        "10/06/2026",
        "Irrigação",
        "224,13",
        "344,13",
        "7,44",
        "2.356,59",
        "2,48",
        "553,80"
      ],
      [
        "08/06/2026",
        "Irrigação",
        "104,13",
        "224,13",
        "8,00",
        "2.534,05",
        "2,67",
        "595,50"
      ],
      [
        "04/06/2026",
        "Irrigação",
        "344,13",
        "104,13",
        "7,22",
        "2.287,75",
        "2,41",
        "537,62"
      ],
      [
        "01/06/2026",
        "Irrigação",
        "344,13",
        "344,13",
        "7,85",
        "7.454,24",
        "7,85",
        "1.751,75"
      ]
    ],
    "irrigationDetailRow3": [
      [
        "26/07/2026",
        "Irrigação",
        "116,86",
        "236,86",
        "7,97",
        "2.920,84",
        "2,66",
        "686,40"
      ],
      [
        "21/07/2026",
        "Irrigação",
        "296,86",
        "116,86",
        "7,89",
        "4.339,72",
        "3,95",
        "1.019,83"
      ],
      [
        "18/07/2026",
        "Irrigação",
        "206,86",
        "296,86",
        "8,77",
        "2.410,64",
        "2,19",
        "566,50"
      ],
      [
        "13/07/2026",
        "Irrigação",
        "206,86",
        "206,86",
        "8,64",
        "9.506,92",
        "8,64",
        "2.234,13"
      ],
      [
        "11/07/2026",
        "Irrigação",
        "206,86",
        "206,86",
        "8,33",
        "9.164,77",
        "8,33",
        "2.153,72"
      ],
      [
        "07/07/2026",
        "Irrigação",
        "116,86",
        "206,86",
        "8,53",
        "2.344,65",
        "2,13",
        "550,99"
      ],
      [
        "02/07/2026",
        "Irrigação",
        "296,86",
        "116,86",
        "8,60",
        "4.728,27",
        "4,30",
        "1.111,14"
      ],
      [
        "29/06/2026",
        "Irrigação",
        "296,86",
        "296,86",
        "7,57",
        "8.329,08",
        "7,57",
        "1.957,33"
      ],
      [
        "23/06/2026",
        "Irrigação",
        "206,86",
        "296,86",
        "8,77",
        "2.410,50",
        "2,19",
        "566,47"
      ],
      [
        "21/06/2026",
        "Irrigação",
        "86,86",
        "206,86",
        "8,52",
        "3.122,92",
        "2,84",
        "733,89"
      ],
      [
        "16/06/2026",
        "Irrigação",
        "356,86",
        "86,86",
        "8,05",
        "2.212,51",
        "2,01",
        "519,94"
      ],
      [
        "11/06/2026",
        "Irrigação",
        "176,86",
        "356,86",
        "8,78",
        "4.830,16",
        "4,39",
        "1.135,09"
      ],
      [
        "09/06/2026",
        "Irrigação",
        "356,86",
        "176,86",
        "7,72",
        "4.244,08",
        "3,86",
        "997,36"
      ],
      [
        "04/06/2026",
        "Irrigação",
        "236,86",
        "356,86",
        "7,77",
        "2.848,33",
        "2,59",
        "669,36"
      ],
      [
        "01/06/2026",
        "Irrigação",
        "236,86",
        "236,86",
        "8,51",
        "9.358,81",
        "8,51",
        "2.199,32"
      ]
    ],
    "irrigationDetailRow4": [
      [
        "27/07/2026",
        "Irrigação",
        "131,15",
        "221,15",
        "5,80",
        "1.812,60",
        "1,45",
        "425,96"
      ],
      [
        "25/07/2026",
        "Irrigação",
        "131,15",
        "131,15",
        "5,38",
        "6.726,45",
        "5,38",
        "1.580,71"
      ],
      [
        "19/07/2026",
        "Irrigação",
        "311,15",
        "131,15",
        "5,81",
        "3.629,91",
        "2,90",
        "853,03"
      ],
      [
        "11/07/2026",
        "Irrigação",
        "191,15",
        "311,15",
        "6,15",
        "2.563,71",
        "2,05",
        "602,47"
      ],
      [
        "06/07/2026",
        "Irrigação",
        "11,15",
        "191,15",
        "5,89",
        "3.679,13",
        "2,94",
        "864,60"
      ],
      [
        "01/07/2026",
        "Irrigação",
        "11,15",
        "11,15",
        "5,66",
        "7.070,67",
        "5,66",
        "1.661,61"
      ],
      [
        "27/06/2026",
        "Irrigação",
        "281,15",
        "11,15",
        "5,57",
        "1.739,82",
        "1,39",
        "408,86"
      ],
      [
        "21/06/2026",
        "Irrigação",
        "101,15",
        "281,15",
        "5,61",
        "3.507,76",
        "2,81",
        "824,32"
      ],
      [
        "14/06/2026",
        "Irrigação",
        "281,15",
        "101,15",
        "5,68",
        "3.552,18",
        "2,84",
        "834,76"
      ],
      [
        "09/06/2026",
        "Irrigação",
        "281,15",
        "281,15",
        "5,48",
        "6.847,71",
        "5,48",
        "1.609,21"
      ],
      [
        "06/06/2026",
        "Irrigação",
        "281,15",
        "281,15",
        "5,47",
        "6.832,90",
        "5,47",
        "1.605,73"
      ],
      [
        "01/06/2026",
        "Irrigação",
        "281,15",
        "281,15",
        "5,83",
        "7.290,24",
        "5,83",
        "1.713,21"
      ]
    ],
    "irrigationDetailRow5": [
      [
        "26/07/2026",
        "Irrigação",
        "223,07",
        "343,07",
        "5,93",
        "2.768,60",
        "1,98",
        "650,62"
      ],
      [
        "22/07/2026",
        "Irrigação",
        "223,07",
        "223,07",
        "5,94",
        "8.316,36",
        "5,94",
        "1.954,35"
      ],
      [
        "18/07/2026",
        "Irrigação",
        "133,07",
        "223,07",
        "6,41",
        "2.243,77",
        "1,60",
        "527,28"
      ],
      [
        "10/07/2026",
        "Irrigação",
        "313,07",
        "133,07",
        "6,28",
        "4.397,88",
        "3,14",
        "1.033,50"
      ],
      [
        "06/07/2026",
        "Irrigação",
        "313,07",
        "313,07",
        "6,64",
        "9.289,46",
        "6,64",
        "2.183,02"
      ],
      [
        "02/07/2026",
        "Irrigação",
        "223,07",
        "313,07",
        "6,14",
        "2.150,37",
        "1,54",
        "505,34"
      ],
      [
        "28/06/2026",
        "Irrigação",
        "43,07",
        "223,07",
        "6,34",
        "4.440,69",
        "3,17",
        "1.043,56"
      ],
      [
        "23/06/2026",
        "Irrigação",
        "283,07",
        "43,07",
        "5,86",
        "2.734,06",
        "1,95",
        "642,50"
      ],
      [
        "19/06/2026",
        "Irrigação",
        "193,07",
        "283,07",
        "6,46",
        "2.261,06",
        "1,62",
        "531,35"
      ],
      [
        "11/06/2026",
        "Irrigação",
        "103,07",
        "193,07",
        "6,64",
        "2.325,45",
        "1,66",
        "546,48"
      ],
      [
        "06/06/2026",
        "Irrigação",
        "343,07",
        "103,07",
        "6,38",
        "2.975,61",
        "2,13",
        "699,27"
      ],
      [
        "01/06/2026",
        "Irrigação",
        "223,07",
        "343,07",
        "6,51",
        "3.039,71",
        "2,17",
        "714,33"
      ]
    ],
    "irrigationDetailRow6": [
      [
        "27/07/2026",
        "Irrigação",
        "259,80",
        "79,80",
        "6,68",
        "5.007,47",
        "3,34",
        "1.176,76"
      ],
      [
        "21/07/2026",
        "Irrigação",
        "79,80",
        "259,80",
        "6,57",
        "4.924,37",
        "3,28",
        "1.157,23"
      ],
      [
        "17/07/2026",
        "Irrigação",
        "259,80",
        "79,80",
        "6,59",
        "4.939,00",
        "3,29",
        "1.160,66"
      ],
      [
        "11/07/2026",
        "Irrigação",
        "139,80",
        "259,80",
        "6,21",
        "3.105,55",
        "2,07",
        "729,80"
      ],
      [
        "09/07/2026",
        "Irrigação",
        "19,80",
        "139,80",
        "6,72",
        "3.361,67",
        "2,24",
        "789,99"
      ],
      [
        "01/07/2026",
        "Irrigação",
        "259,80",
        "19,80",
        "6,73",
        "3.367,43",
        "2,24",
        "791,35"
      ],
      [
        "26/06/2026",
        "Irrigação",
        "259,80",
        "259,80",
        "6,22",
        "9.325,71",
        "6,22",
        "2.191,54"
      ],
      [
        "22/06/2026",
        "Irrigação",
        "169,80",
        "259,80",
        "5,97",
        "2.237,18",
        "1,49",
        "525,74"
      ],
      [
        "19/06/2026",
        "Irrigação",
        "349,80",
        "169,80",
        "6,08",
        "4.563,64",
        "3,04",
        "1.072,45"
      ],
      [
        "15/06/2026",
        "Irrigação",
        "169,80",
        "349,80",
        "6,76",
        "5.067,02",
        "3,38",
        "1.190,75"
      ],
      [
        "10/06/2026",
        "Irrigação",
        "49,80",
        "169,80",
        "6,06",
        "3.029,47",
        "2,02",
        "711,93"
      ],
      [
        "05/06/2026",
        "Irrigação",
        "49,80",
        "49,80",
        "6,30",
        "9.449,56",
        "6,30",
        "2.220,65"
      ],
      [
        "01/06/2026",
        "Irrigação",
        "49,80",
        "49,80",
        "6,71",
        "10.058,84",
        "6,71",
        "2.363,83"
      ]
    ],
    "irrigationDetailRow7": [
      [
        "27/07/2026",
        "Irrigação",
        "225,81",
        "315,81",
        "7,97",
        "2.090,97",
        "1,99",
        "491,38"
      ],
      [
        "23/07/2026",
        "Irrigação",
        "45,81",
        "225,81",
        "7,70",
        "4.044,12",
        "3,85",
        "950,37"
      ],
      [
        "18/07/2026",
        "Irrigação",
        "225,81",
        "45,81",
        "8,17",
        "4.287,35",
        "4,08",
        "1.007,53"
      ],
      [
        "13/07/2026",
        "Irrigação",
        "45,81",
        "225,81",
        "7,67",
        "4.024,95",
        "3,83",
        "945,86"
      ],
      [
        "10/07/2026",
        "Irrigação",
        "315,81",
        "45,81",
        "8,11",
        "2.128,31",
        "2,03",
        "500,15"
      ],
      [
        "06/07/2026",
        "Irrigação",
        "225,81",
        "315,81",
        "8,23",
        "2.160,69",
        "2,06",
        "507,76"
      ],
      [
        "01/07/2026",
        "Irrigação",
        "105,81",
        "225,81",
        "8,07",
        "2.822,78",
        "2,69",
        "663,35"
      ],
      [
        "25/06/2026",
        "Irrigação",
        "345,81",
        "105,81",
        "7,51",
        "2.627,26",
        "2,50",
        "617,41"
      ],
      [
        "21/06/2026",
        "Irrigação",
        "345,81",
        "345,81",
        "7,79",
        "8.178,64",
        "7,79",
        "1.921,98"
      ],
      [
        "18/06/2026",
        "Irrigação",
        "165,81",
        "345,81",
        "8,55",
        "4.490,10",
        "4,28",
        "1.055,17"
      ],
      [
        "13/06/2026",
        "Irrigação",
        "45,81",
        "165,81",
        "7,63",
        "2.671,76",
        "2,54",
        "627,86"
      ],
      [
        "08/06/2026",
        "Irrigação",
        "225,81",
        "45,81",
        "7,62",
        "3.998,06",
        "3,81",
        "939,54"
      ],
      [
        "02/06/2026",
        "Irrigação",
        "135,81",
        "225,81",
        "8,62",
        "2.264,05",
        "2,16",
        "532,05"
      ],
      [
        "01/06/2026",
        "Irrigação",
        "15,81",
        "135,81",
        "8,24",
        "2.885,19",
        "2,75",
        "678,02"
      ]
    ],
    "irrigationDetailRow8": [
      [
        "29/07/2026",
        "Irrigação",
        "231,58",
        "321,58",
        "5,56",
        "1.808,40",
        "1,39",
        "424,97"
      ],
      [
        "23/07/2026",
        "Irrigação",
        "141,58",
        "231,58",
        "5,95",
        "1.933,37",
        "1,49",
        "454,34"
      ],
      [
        "20/07/2026",
        "Irrigação",
        "321,58",
        "141,58",
        "5,67",
        "3.687,79",
        "2,84",
        "866,63"
      ],
      [
        "17/07/2026",
        "Irrigação",
        "141,58",
        "321,58",
        "5,96",
        "3.872,51",
        "2,98",
        "910,04"
      ],
      [
        "14/07/2026",
        "Irrigação",
        "321,58",
        "141,58",
        "6,27",
        "4.076,30",
        "3,14",
        "957,93"
      ],
      [
        "08/07/2026",
        "Irrigação",
        "141,58",
        "321,58",
        "5,96",
        "3.870,99",
        "2,98",
        "909,68"
      ],
      [
        "05/07/2026",
        "Irrigação",
        "141,58",
        "141,58",
        "5,53",
        "7.191,43",
        "5,53",
        "1.689,99"
      ],
      [
        "28/06/2026",
        "Irrigação",
        "51,58",
        "141,58",
        "5,76",
        "1.873,14",
        "1,44",
        "440,19"
      ],
      [
        "22/06/2026",
        "Irrigação",
        "231,58",
        "51,58",
        "5,88",
        "3.819,28",
        "2,94",
        "897,53"
      ],
      [
        "18/06/2026",
        "Irrigação",
        "231,58",
        "231,58",
        "5,82",
        "7.569,76",
        "5,82",
        "1.778,89"
      ],
      [
        "15/06/2026",
        "Irrigação",
        "231,58",
        "231,58",
        "6,24",
        "8.109,71",
        "6,24",
        "1.905,78"
      ],
      [
        "09/06/2026",
        "Irrigação",
        "111,58",
        "231,58",
        "5,71",
        "2.476,12",
        "1,90",
        "581,89"
      ],
      [
        "02/06/2026",
        "Irrigação",
        "351,58",
        "111,58",
        "6,02",
        "2.607,93",
        "2,01",
        "612,86"
      ],
      [
        "01/06/2026",
        "Irrigação",
        "351,58",
        "351,58",
        "6,26",
        "8.137,38",
        "6,26",
        "1.912,28"
      ]
    ],
    "irrigationDetailRow9": [
      [
        "27/07/2026",
        "Irrigação",
        "109,15",
        "229,15",
        "7,59",
        "2.278,42",
        "2,53",
        "535,43"
      ],
      [
        "23/07/2026",
        "Irrigação",
        "289,15",
        "109,15",
        "7,77",
        "3.494,41",
        "3,88",
        "821,19"
      ],
      [
        "17/07/2026",
        "Irrigação",
        "199,15",
        "289,15",
        "7,40",
        "1.664,87",
        "1,85",
        "391,24"
      ],
      [
        "13/07/2026",
        "Irrigação",
        "199,15",
        "199,15",
        "6,96",
        "6.263,14",
        "6,96",
        "1.471,84"
      ],
      [
        "09/07/2026",
        "Irrigação",
        "79,15",
        "199,15",
        "7,24",
        "2.170,84",
        "2,41",
        "510,15"
      ],
      [
        "05/07/2026",
        "Irrigação",
        "259,15",
        "79,15",
        "7,29",
        "3.281,01",
        "3,65",
        "771,04"
      ],
      [
        "01/07/2026",
        "Irrigação",
        "139,15",
        "259,15",
        "7,28",
        "2.185,31",
        "2,43",
        "513,55"
      ],
      [
        "27/06/2026",
        "Irrigação",
        "319,15",
        "139,15",
        "7,30",
        "3.286,87",
        "3,65",
        "772,41"
      ],
      [
        "24/06/2026",
        "Irrigação",
        "319,15",
        "319,15",
        "6,85",
        "6.163,19",
        "6,85",
        "1.448,35"
      ],
      [
        "19/06/2026",
        "Irrigação",
        "139,15",
        "319,15",
        "7,64",
        "3.439,01",
        "3,82",
        "808,17"
      ],
      [
        "14/06/2026",
        "Irrigação",
        "139,15",
        "139,15",
        "7,25",
        "6.525,00",
        "7,25",
        "1.533,38"
      ],
      [
        "10/06/2026",
        "Irrigação",
        "49,15",
        "139,15",
        "7,58",
        "1.704,45",
        "1,89",
        "400,55"
      ],
      [
        "05/06/2026",
        "Irrigação",
        "319,15",
        "49,15",
        "7,12",
        "1.602,87",
        "1,78",
        "376,67"
      ],
      [
        "01/06/2026",
        "Irrigação",
        "229,15",
        "319,15",
        "7,90",
        "1.776,39",
        "1,97",
        "417,45"
      ]
    ],
    "irrigationDetailRow10": [
      [
        "27/07/2026",
        "Irrigação",
        "294,31",
        "24,31",
        "5,84",
        "2.115,46",
        "1,46",
        "497,13"
      ],
      [
        "24/07/2026",
        "Irrigação",
        "294,31",
        "294,31",
        "6,23",
        "9.039,90",
        "6,23",
        "2.124,38"
      ],
      [
        "19/07/2026",
        "Irrigação",
        "174,31",
        "294,31",
        "6,38",
        "3.081,67",
        "2,13",
        "724,19"
      ],
      [
        "15/07/2026",
        "Irrigação",
        "174,31",
        "174,31",
        "6,75",
        "9.793,18",
        "6,75",
        "2.301,40"
      ],
      [
        "10/07/2026",
        "Irrigação",
        "174,31",
        "174,31",
        "6,38",
        "9.253,28",
        "6,38",
        "2.174,52"
      ],
      [
        "03/07/2026",
        "Irrigação",
        "84,31",
        "174,31",
        "6,54",
        "2.370,38",
        "1,63",
        "557,04"
      ],
      [
        "01/07/2026",
        "Irrigação",
        "324,31",
        "84,31",
        "6,56",
        "3.168,82",
        "2,19",
        "744,67"
      ],
      [
        "26/06/2026",
        "Irrigação",
        "144,31",
        "324,31",
        "6,65",
        "4.822,70",
        "3,33",
        "1.133,33"
      ],
      [
        "20/06/2026",
        "Irrigação",
        "24,31",
        "144,31",
        "6,19",
        "2.993,70",
        "2,06",
        "703,52"
      ],
      [
        "14/06/2026",
        "Irrigação",
        "264,31",
        "24,31",
        "5,84",
        "2.824,40",
        "1,95",
        "663,73"
      ],
      [
        "09/06/2026",
        "Irrigação",
        "144,31",
        "264,31",
        "5,86",
        "2.830,47",
        "1,95",
        "665,16"
      ],
      [
        "03/06/2026",
        "Irrigação",
        "324,31",
        "144,31",
        "6,07",
        "4.402,14",
        "3,04",
        "1.034,50"
      ],
      [
        "01/06/2026",
        "Irrigação",
        "324,31",
        "324,31",
        "6,23",
        "9.030,95",
        "6,23",
        "2.122,27"
      ]
    ]
  };



  
  // Relatório de Carretéis: uma linha por operação no período (mock gerado a partir
  // da configuração e do histórico de operações que já existem na plataforma).
  const CARRETEL_REPORT_DETAIL = {
    "carretelReportDetail1": [
      {dayOffset: 0, startMin: 300, durMin: 2280, mode: "Zonas", speeds: [11.67,10,8.75,10], start: "-12.393977, -45.392844", end: "-12.390627, -45.393515", reason: "Concluído"},
      {dayOffset: 2, startMin: 347, durMin: 2160, mode: "Velocidade", speeds: [10], start: "-12.394146, -45.394685", end: "-12.390972, -45.395320", reason: "Concluído"},
      {dayOffset: 4, startMin: 394, durMin: 2331, mode: "Taxa de Irrigação", speeds: [8.75], start: "-12.394314, -45.396526", end: "-12.391316, -45.397126", reason: "Concluído"},
      {dayOffset: 6, startMin: 441, durMin: 1406, mode: "Zonas", speeds: [11.67,10,8.75,10], start: "-12.395188, -45.398225", end: "-12.393248, -45.398613", reason: "Sensor de parada"},
      {dayOffset: 8, startMin: 488, durMin: 2220, mode: "Velocidade", speeds: [10], start: "-12.395268, -45.400083", end: "-12.392006, -45.400736", reason: "Concluído"},
      {dayOffset: 10, startMin: 535, durMin: 2100, mode: "Zonas", speeds: [11.67,10,8.75,10], start: "-12.395436, -45.401924", end: "-12.392351, -45.402541", reason: "Concluído"},
      {dayOffset: 12, startMin: 342, durMin: 1474, mode: "Taxa de Irrigação", speeds: [8.75], start: "-12.396134, -45.403658", end: "-12.394238, -45.404038", reason: "Sensor de parada"},
      {dayOffset: 14, startMin: 389, durMin: 2160, mode: "Velocidade", speeds: [10], start: "-12.396214, -45.405517", end: "-12.393040, -45.406152", reason: "Concluído"}
    ],
    "carretelReportDetail2": [
      {dayOffset: 1, startMin: 323, durMin: 1200, mode: "Velocidade", speeds: [15], start: "-12.389217, -45.405467", end: "-12.389911, -45.408133", reason: "Concluído"},
      {dayOffset: 3, startMin: 370, durMin: 832, mode: "Velocidade", speeds: [15], start: "-12.390039, -45.405052", end: "-12.390520, -45.406901", reason: "Velocidade não atingida"},
      {dayOffset: 5, startMin: 960, durMin: 660, mode: "Taxa de Irrigação", speeds: [14], start: "-12.390999, -45.405171", end: "-12.391647, -45.407659", reason: "Concluído"},
      {dayOffset: 7, startMin: 464, durMin: 1240, mode: "Velocidade", speeds: [15], start: "-12.391798, -45.404668", end: "-12.392515, -45.407423", reason: "Concluído"},
      {dayOffset: 9, startMin: 511, durMin: 784, mode: "Zonas", speeds: [17.5,15.56,14,15.56], start: "-12.392689, -45.404520", end: "-12.393140, -45.406253", reason: "Velocidade não atingida"},
      {dayOffset: 11, startMin: 318, durMin: 1160, mode: "Velocidade", speeds: [15], start: "-12.393580, -45.404372", end: "-12.394251, -45.406949", reason: "Concluído"}
    ],
    "carretelReportDetail3": [
      {dayOffset: 0, startMin: 346, durMin: 462, mode: "Velocidade", speeds: [20], start: "-12.379867, -45.398513", end: "-12.379513, -45.397143", reason: "Falha de comunicação"},
      {dayOffset: 2, startMin: 393, durMin: 585, mode: "Velocidade", speeds: [20], start: "-12.379287, -45.398860", end: "-12.378840, -45.397126", reason: "Parada manual"},
      {dayOffset: 4, startMin: 440, durMin: 802, mode: "Taxa de Irrigação", speeds: [19.44], start: "-12.378570, -45.398673", end: "-12.377973, -45.396361", reason: "Concluído"}
    ],
    "carretelReportDetail4": [
      {dayOffset: 1, startMin: 369, durMin: 1050, mode: "Velocidade", speeds: [20], start: "-12.377576, -45.406972", end: "-12.378337, -45.410095", reason: "Concluído"},
      {dayOffset: 3, startMin: 416, durMin: 990, mode: "Zonas", speeds: [25,20,16.67,20], start: "-12.378247, -45.406990", end: "-12.378965, -45.409935", reason: "Concluído"},
      {dayOffset: 5, startMin: 463, durMin: 1080, mode: "Velocidade", speeds: [20], start: "-12.378809, -45.406562", end: "-12.379592, -45.409774", reason: "Concluído"},
      {dayOffset: 7, startMin: 510, durMin: 960, mode: "Taxa de Irrigação", speeds: [20], start: "-12.379524, -45.406759", end: "-12.380220, -45.409614", reason: "Concluído"},
      {dayOffset: 9, startMin: 317, durMin: 1020, mode: "Velocidade", speeds: [20], start: "-12.380108, -45.406420", end: "-12.380847, -45.409454", reason: "Concluído"},
      {dayOffset: 11, startMin: 364, durMin: 990, mode: "Zonas", speeds: [25,20,16.67,20], start: "-12.380757, -45.406349", end: "-12.381475, -45.409294", reason: "Concluído"},
      {dayOffset: 13, startMin: 411, durMin: 930, mode: "Velocidade", speeds: [20], start: "-12.381428, -45.406367", end: "-12.382102, -45.409133", reason: "Concluído"},
      {dayOffset: 15, startMin: 458, durMin: 684, mode: "Velocidade", speeds: [20], start: "-12.381969, -45.405850", end: "-12.382465, -45.407884", reason: "Sensor de parada"},
      {dayOffset: 17, startMin: 505, durMin: 990, mode: "Taxa de Irrigação", speeds: [20], start: "-12.382640, -45.405868", end: "-12.383357, -45.408813", reason: "Concluído"},
      {dayOffset: 19, startMin: 312, durMin: 1020, mode: "Zonas", speeds: [25,20,16.67,20], start: "-12.383246, -45.405619", end: "-12.383985, -45.408653", reason: "Concluído"},
      {dayOffset: 21, startMin: 359, durMin: 960, mode: "Velocidade", speeds: [20], start: "-12.383917, -45.405637", end: "-12.384613, -45.408492", reason: "Concluído"},
      {dayOffset: 23, startMin: 406, durMin: 1080, mode: "Velocidade", speeds: [20], start: "-12.384457, -45.405120", end: "-12.385240, -45.408332", reason: "Concluído"},
      {dayOffset: 25, startMin: 453, durMin: 990, mode: "Taxa de Irrigação", speeds: [20], start: "-12.385150, -45.405227", end: "-12.385868, -45.408172", reason: "Concluído"},
      {dayOffset: 27, startMin: 500, durMin: 1020, mode: "Velocidade", speeds: [20], start: "-12.385756, -45.404978", end: "-12.386495, -45.408012", reason: "Concluído"}
    ],
    "carretelReportDetail5": [
      {dayOffset: 0, startMin: 392, durMin: 1269, mode: "Velocidade", speeds: [17.5], start: "-12.373225, -45.407624", end: "-12.374030, -45.410926", reason: "Concluído"},
      {dayOffset: 2, startMin: 439, durMin: 1200, mode: "Velocidade", speeds: [17.5], start: "-12.373896, -45.407643", end: "-12.374658, -45.410766", reason: "Concluído"},
      {dayOffset: 4, startMin: 486, durMin: 907, mode: "Taxa de Irrigação", speeds: [17.86], start: "-12.374502, -45.407393", end: "-12.375089, -45.409802", reason: "Velocidade não atingida"},
      {dayOffset: 6, startMin: 533, durMin: 1303, mode: "Velocidade", speeds: [17.5], start: "-12.375086, -45.407054", end: "-12.375913, -45.410445", reason: "Concluído"},
      {dayOffset: 8, startMin: 340, durMin: 1142, mode: "Zonas", speeds: [20.83,17.86,15.63,17.86], start: "-12.375801, -45.407251", end: "-12.376540, -45.410285", reason: "Concluído"},
      {dayOffset: 10, startMin: 387, durMin: 1234, mode: "Velocidade", speeds: [17.5], start: "-12.376385, -45.406912", end: "-12.377168, -45.410124", reason: "Concluído"},
      {dayOffset: 12, startMin: 434, durMin: 624, mode: "Velocidade", speeds: [17.5], start: "-12.377077, -45.407019", end: "-12.377473, -45.408643", reason: "Parada manual"},
      {dayOffset: 14, startMin: 481, durMin: 1176, mode: "Taxa de Irrigação", speeds: [17.86], start: "-12.377661, -45.406680", end: "-12.378423, -45.409804", reason: "Concluído"},
      {dayOffset: 16, startMin: 528, durMin: 1269, mode: "Velocidade", speeds: [17.5], start: "-12.378245, -45.406342", end: "-12.379050, -45.409643", reason: "Concluído"},
      {dayOffset: 18, startMin: 335, durMin: 1166, mode: "Velocidade", speeds: [17.5], start: "-12.378938, -45.406449", end: "-12.379678, -45.409483", reason: "Concluído"},
      {dayOffset: 20, startMin: 382, durMin: 1209, mode: "Zonas", speeds: [20.83,17.86,15.63,17.86], start: "-12.379522, -45.406110", end: "-12.380305, -45.409323", reason: "Concluído"},
      {dayOffset: 22, startMin: 429, durMin: 1200, mode: "Velocidade", speeds: [17.5], start: "-12.380172, -45.406039", end: "-12.380933, -45.409162", reason: "Concluído"},
      {dayOffset: 24, startMin: 476, durMin: 1303, mode: "Velocidade", speeds: [17.5], start: "-12.380734, -45.405611", end: "-12.381560, -45.409002", reason: "Concluído"}
    ]
  };

  // Equipamentos do relatório de Carretéis: vazão e largura de trabalho vêm do cadastro
  // de cada equipamento (farms.json); o modelo é fixo. As operações acima guardam só o
  // que o equipamento registra (início, duração, velocidades configuradas por zona,
  // modo, motivo da parada e coordenadas); comprimento recolhido, volume, área e lâminas
  // são calculados a partir da vazão e da largura, então as fórmulas sempre batem.
  const CARRETEL_EQUIPMENT = {
    carretelReportDetail1: { name: "MHP 10", model: "Rainstar E100", flow: 14, width: 200 },
    carretelReportDetail2: { name: "MHP 11", model: "Rainstar E11", flow: 14, width: 100 },
    carretelReportDetail3: { name: "MHP 12", model: "Rainstar E200", flow: 14, width: 72 },
    carretelReportDetail4: { name: "MHP 28", model: "Rainstar E500", flow: 36, width: 72 },
    carretelReportDetail5: { name: "MHP 37", model: "Rainstar E600 4W", flow: 36, width: 72 }
  };

  const isEn = () => !!(window.IcI18n && window.IcI18n.isEnglish && window.IcI18n.isEnglish());
  const t = (pt, en) => {
    const i = window.IcI18n;
    if (i && i.t) { const h = i.t(pt); if (h !== pt) return h; }
    return isEn() ? en : pt;
  };

  async function mountReportView(options) {
    const slot = document.getElementById("pageSlot");
    if (!slot) return;
    const html = await fetch("./pages/relatorios.html").then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });
    slot.innerHTML = html;
    // Filtros só com os equipamentos criados na fazenda (antes do init dos multiselects)
    window.IcReportDemo?.prepare?.(slot);
    initReportUI(slot, options || {});
    window.IcReportDemo?.attach?.(slot);
  }

  function hideMapCard() {
    const mapCard = document.getElementById("mapCard");
    if (mapCard) mapCard.style.display = "none";
  }

  function showMapCard() {
    const mapCard = document.getElementById("mapCard");
    if (mapCard) mapCard.style.display = "";
  }

  const REPORT_SCHEDULE_STORAGE_KEY = "ic_report_schedules_v1";
  const REPORT_BUTTON_TYPES = {
    btnExportReportIrrigacao: "Irrigação",
    btnExportReportPivots: "Operação",
    btnExportReportEnergy: "Energia",
    btnExportReportCarreteis: "Carretéis",
  };
  const REPORT_SECTION_TYPES = {
    reportIrrigacao: "Irrigação",
    reportPivots: "Operação",
    reportEnergy: "Operação",
    reportWater: "Energia",
    reportCarreteis: "Carretéis",
  };
  REPORT_BUTTON_TYPES.btnExportReportWater = "Energia";
  const WEEKDAY_META = [
    { key: "mon", short: "Seg" },
    { key: "tue", short: "Ter" },
    { key: "wed", short: "Qua" },
    { key: "thu", short: "Qui" },
    { key: "fri", short: "Sex" },
    { key: "sat", short: "Sáb" },
    { key: "sun", short: "Dom" },
  ];

  const REPORT_PERIOD_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const REPORT_PERIOD_WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const REPORT_PERIOD_BASELINE_DAYS = 30;
  const REPORT_VALUE_PLACEHOLDER = "__REPORT_VALUE__";
  const REPORT_NUMBER_RE = /-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/;

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function canonicalReportType(value) {
    const normalized = normalizeText(value);
    if (!normalized) return "";
    if (normalized.includes("carret")) return "Carretéis";
    if (normalized.includes("irrig")) return "Irrigação";
    if (normalized.includes("opera") || normalized.includes("pivo")) return "Operação";
    if (normalized.includes("energ")) return "Energia";
    if (normalized.includes("pluv")) return "Pluviometria";
    return String(value || "").trim();
  }

  function readStoredSchedules() {
    try {
      const parsed = JSON.parse(localStorage.getItem(REPORT_SCHEDULE_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeStoredSchedules(list) {
    try {
      localStorage.setItem(REPORT_SCHEDULE_STORAGE_KEY, JSON.stringify(list));
    } catch (_) { }
  }

  function createScheduleId() {
    return `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDateBR(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${value.getFullYear()}`;
  }

  function toDateOnly(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  function normalizeDateRange(start, end) {
    const a = toDateOnly(start);
    const b = toDateOnly(end);
    if (!a || !b) return null;
    return a.getTime() <= b.getTime()
      ? { start: a, end: b }
      : { start: b, end: a };
  }

  function addDays(date, amount) {
    const base = toDateOnly(date);
    if (!base) return null;
    const next = new Date(base);
    next.setDate(next.getDate() + Number(amount || 0));
    return next;
  }

  function daysBetweenInclusive(start, end) {
    const normalized = normalizeDateRange(start, end);
    if (!normalized) return 0;
    return Math.max(1, Math.round((normalized.end.getTime() - normalized.start.getTime()) / 86400000) + 1);
  }

  function isoFromDate(value) {
    const date = toDateOnly(value);
    if (!date) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function dateFromISO(value) {
    const parts = String(value || "").split("-");
    if (parts.length !== 3) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function hashString(value) {
    const text = String(value || "");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getDefaultReportRange() {
    const end = toDateOnly(new Date()) || new Date();
    const start = addDays(end, -(REPORT_PERIOD_BASELINE_DAYS - 1));
    return normalizeDateRange(start, end);
  }

  function detectReportPreset(range) {
    const normalized = normalizeDateRange(range?.start, range?.end);
    if (!normalized) return "";
    const today = toDateOnly(new Date());
    if (!today || normalized.end.getTime() !== today.getTime()) return "";

    const days = daysBetweenInclusive(normalized.start, normalized.end);
    if (days === 1) return "1d";
    if (days === 7) return "7d";
    if (days === 14) return "14d";
    if (days === 30) return "30d";

    if (
      normalized.start.getFullYear() === today.getFullYear() &&
      normalized.start.getMonth() === today.getMonth() &&
      normalized.start.getDate() === 1
    ) {
      return "invoice";
    }

    if (
      normalized.start.getFullYear() === today.getFullYear() &&
      normalized.start.getMonth() === 0 &&
      normalized.start.getDate() === 1
    ) {
      return "season";
    }

    return "";
  }

  function buildReportRangeFromPreset(preset) {
    const today = toDateOnly(new Date()) || new Date();
    let start = new Date(today);
    if (preset === "invoice") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset === "season") {
      start = new Date(today.getFullYear(), 0, 1);
    } else {
      let days = 1;
      if (preset === "7d") days = 7;
      if (preset === "14d") days = 14;
      if (preset === "30d") days = 30;
      start.setDate(today.getDate() - (days - 1));
    }
    return normalizeDateRange(start, today);
  }

  function parseLocaleNumber(value) {
    const token = String(value || "").match(REPORT_NUMBER_RE)?.[0];
    if (!token) return Number.NaN;

    const lastDot = token.lastIndexOf(".");
    const lastComma = token.lastIndexOf(",");
    let normalized = token;

    if (lastDot > -1 && lastComma > -1) {
      normalized = token.replace(/\./g, "").replace(",", ".");
    } else if (lastComma > -1) {
      const digitsAfter = token.length - lastComma - 1;
      normalized = digitsAfter > 0 && digitsAfter <= 2
        ? token.replace(/\./g, "").replace(",", ".")
        : token.replace(/,/g, "");
    } else if (lastDot > -1) {
      const digitsAfter = token.length - lastDot - 1;
      normalized = digitsAfter > 0 && digitsAfter <= 2
        ? token.replace(/,/g, "")
        : token.replace(/\./g, "");
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  function extractNumberMeta(source) {
    const raw = String(source || "");
    const match = REPORT_NUMBER_RE.exec(raw);
    if (!match) return null;

    const token = match[0];
    const tokenStart = match.index;
    const lastDot = token.lastIndexOf(".");
    const lastComma = token.lastIndexOf(",");
    let decimalSeparator = "";

    if (lastDot > -1 && lastComma > -1) {
      decimalSeparator = lastDot > lastComma ? "." : ",";
    } else if (lastComma > -1) {
      const digitsAfter = token.length - lastComma - 1;
      decimalSeparator = digitsAfter > 0 && digitsAfter <= 2 ? "," : "";
    } else if (lastDot > -1) {
      const digitsAfter = token.length - lastDot - 1;
      decimalSeparator = digitsAfter > 0 && digitsAfter <= 2 ? "." : "";
    }

    const decimals = decimalSeparator ? token.length - token.lastIndexOf(decimalSeparator) - 1 : 0;
    let thousandsSeparator = "";
    if (decimalSeparator) {
      thousandsSeparator = decimalSeparator === "," ? "." : ",";
    } else if (token.includes(".")) {
      thousandsSeparator = ".";
    } else if (token.includes(",")) {
      thousandsSeparator = ",";
    }

    return {
      token,
      tokenStart,
      tokenEnd: tokenStart + token.length,
      decimals,
      decimalSeparator,
      thousandsSeparator: thousandsSeparator || ".",
      useThousands: !!thousandsSeparator,
      value: parseLocaleNumber(token),
    };
  }

  function formatNumberFromMeta(value, meta) {
    if (!meta || !Number.isFinite(value)) return String(value || "");
    const decimals = Math.max(0, Number(meta.decimals || 0));
    const fixed = Number(value).toFixed(decimals);
    let [intPart, decimalPart = ""] = fixed.split(".");
    const negative = intPart.startsWith("-");
    const unsigned = negative ? intPart.slice(1) : intPart;
    const grouped = (meta.useThousands || Math.abs(Number(intPart)) >= 1000)
      ? unsigned.replace(/\B(?=(\d{3})+(?!\d))/g, meta.thousandsSeparator || ".")
      : unsigned;
    const prefix = negative ? "-" : "";
    if (!decimals) return `${prefix}${grouped}`;
    return `${prefix}${grouped}${meta.decimalSeparator || ","}${decimalPart}`;
  }

  function classifyMetric(label) {
    const key = normalizeText(label).replace(/\s+/g, " ");
    if (!key) return "text";
    if (
      key.includes("equipamento") ||
      key.includes("modelo") ||
      key.includes("cultivo") ||
      key.includes("segmento") ||
      key.includes("talhao") ||
      key.includes("angulo") ||
      key.includes("inicio da operacao") ||
      key.includes("hora iniciada") ||
      key.includes("inicio") ||
      key.includes("termino") ||
      key.includes("tipo de falha") ||
      key.includes("latitude") ||
      key.includes("longitude") ||
      key.includes("id operacao") ||
      key.includes("hidrometro vinculado") ||
      key.includes("operador") ||
      key.includes("trecho") ||
      key.includes("status") ||
      key.includes("diferenca")
    ) {
      return "text";
    }
    if (key.startsWith("data")) return "date";
    if (key.includes("acumulado ano") || key.includes("acumulado safra")) return "season_total";
    if (key.includes("acumulado mes")) return "month_total";
    if (key.includes("area") && !key.includes("custo por area")) return "fixed";
    if (
      key.includes("custo unitario") ||
      key.includes("custo medio") ||
      key.includes("por evento") ||
      key.includes("/kwh") ||
      key.includes("/mm/ha")
    ) {
      return "stable_rate";
    }
    if (
      key.includes("lamina media") ||
      key.includes("duracao media") ||
      key.includes("intensidade media") ||
      key.includes("tempo medio")
    ) {
      return "soft_average";
    }
    if (key.includes("maior chuva") || key.includes("intensidade maxima")) return "peak";
    if (key.includes("dias com chuva")) return "count_days";
    if (key.includes("falhas") || key.includes("eventos")) return "count";
    if (
      key.includes("taxa") ||
      key.includes("ciclos completos") ||
      /\(\s*%\s*\)/.test(String(label || "")) ||
      /%\s*$/.test(String(label || ""))
    ) {
      return "percentage";
    }
    if (key.includes("tempo") || key.includes("ligado") || (key.includes("duracao") && !key.includes("media"))) return "duration_total";
    if (
      key.includes("volume") ||
      key.includes("consumo") ||
      key.includes("precipitacao") ||
      key.includes("acumulado") ||
      key.includes("custo") ||
      key.includes("ultimo ciclo") ||
      key.includes("ultimas 24h")
    ) {
      return "total";
    }
    return "total";
  }

  function buildPeriodProfile(range) {
    const days = Math.max(1, daysBetweenInclusive(range?.start, range?.end));
    return {
      days,
      ratio: days / REPORT_PERIOD_BASELINE_DAYS,
      logRatio: Math.log(days + 1) / Math.log(REPORT_PERIOD_BASELINE_DAYS + 1),
    };
  }

  function transformMetricValue(baseValue, binding, profile) {
    if (!Number.isFinite(baseValue) || !binding) return baseValue;
    const noise = ((hashString(binding.seedKey || binding.label || binding.kind || "") % 1000) / 1000) * 2 - 1;
    const ratio = Math.max(0.05, profile.ratio);
    const logRatio = profile.logRatio;
    const closeShift = 1 + ((logRatio - 1) * 0.08) + (noise * 0.015);
    const avgShift = 1 + ((logRatio - 1) * 0.2) + (noise * 0.03);
    const peakShift = 1 + ((logRatio - 1) * 0.24) + (noise * 0.04);

    if (binding.kind === "fixed") return baseValue;
    if (binding.kind === "count") return Math.max(0, Math.round(baseValue * ratio * (0.98 + (noise * 0.08))));
    if (binding.kind === "count_days") {
      const next = Math.max(0, Math.round(baseValue * ratio * (0.92 + (noise * 0.08))));
      return Math.min(profile.days, next);
    }
    if (binding.kind === "duration_total") return Math.max(0, baseValue * ratio * (0.97 + (noise * 0.06)));
    if (binding.kind === "total") return Math.max(0, baseValue * ratio * (0.98 + (noise * 0.06)));
    if (binding.kind === "month_total") return Math.max(0, baseValue * (0.45 + (ratio * 0.55) + (noise * 0.02)));
    if (binding.kind === "season_total") return Math.max(0, baseValue * (0.72 + (ratio * 0.28) + (noise * 0.02)));
    if (binding.kind === "stable_rate") return Math.max(0, baseValue * closeShift);
    if (binding.kind === "soft_average") return Math.max(0, baseValue * avgShift);
    if (binding.kind === "peak") return Math.max(0, baseValue * peakShift);
    if (binding.kind === "percentage") return clamp(baseValue + ((logRatio - 1) * 8) + (noise * 1.8), 0, 100);
    return baseValue;
  }

  function parseDurationHHMM(text) {
    const m = /(\d+)h(\d+)min/i.exec(String(text || ""));
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    return null;
  }

  function formatDurationHHMM(totalMinutes) {
    const mins = Math.max(0, Math.round(totalMinutes));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}min`;
  }

  function createMetricBinding(el, label, seedKey, options = {}) {
    const source = options.mode === "html" ? el.innerHTML : el.textContent;
    const kind = options.kind || classifyMetric(label);
    if (kind === "duration_total" && options.mode !== "html") {
      const totalMins = parseDurationHHMM(source);
      if (totalMins !== null) {
        return {
          el,
          label,
          kind,
          mode: options.mode || "text",
          baseValue: totalMins,
          isDurationHHMM: true,
          template: null,
          numberMeta: { value: totalMins, decimals: 0, decimalSeparator: "", thousandsSeparator: ".", useThousands: false, tokenStart: 0, tokenEnd: source.length },
          seedKey: seedKey || label,
        };
      }
    }
    const meta = extractNumberMeta(source);
    if (!meta || !Number.isFinite(meta.value)) return null;
    return {
      el,
      label,
      kind,
      mode: options.mode || "text",
      baseValue: meta.value,
      template: options.mode === "html"
        ? `${source.slice(0, meta.tokenStart)}${REPORT_VALUE_PLACEHOLDER}${source.slice(meta.tokenEnd)}`
        : null,
      numberMeta: meta,
      seedKey: seedKey || label,
    };
  }

  function applyMetricBinding(binding, profile) {
    if (!binding?.el || !binding.numberMeta) return;
    const nextValue = transformMetricValue(binding.baseValue, binding, profile);
    if (binding.isDurationHHMM) {
      binding.el.textContent = formatDurationHHMM(nextValue);
      return;
    }
    const formatted = formatNumberFromMeta(nextValue, binding.numberMeta);
    if (binding.mode === "html" && binding.template) {
      binding.el.innerHTML = binding.template.replace(REPORT_VALUE_PLACEHOLDER, formatted);
      return;
    }
    binding.el.textContent = formatted;
  }

  function buildTableHeaderMap(table) {
    const headers = [];
    Array.from(table.querySelectorAll("thead tr")).forEach((row) => {
      Array.from(row.cells).forEach((cell, index) => {
        const label = cell.textContent.replace(/\s+/g, " ").trim();
        headers[index] = [headers[index], label].filter(Boolean).join(" ");
      });
    });
    return headers;
  }

  function captureReportBindings(root) {
    const state = {
      stats: [],
      tableCells: [],
      detailDates: [],
      exportDates: Array.from(root.querySelectorAll("#modalExport input[type='date']")),
      footers: Array.from(root.querySelectorAll(".farm-report__stats-footer")),
    };

    root.querySelectorAll(".farm-report__stats-item").forEach((item, index) => {
      const labelEl = item.querySelector(".farm-report__stats-label");
      const valueEl = item.querySelector(".farm-report__stats-value");
      if (!labelEl || !valueEl) return;
      if (valueEl.hasAttribute("data-carretel-derived")) return;
      // Indicadores calculados de verdade (relatorios/demo-data.js) não escalam por período
      if (valueEl.closest("[data-demo-live]")) return;
      const reportId = item.closest("[data-stats-for]")?.getAttribute("data-stats-for") || "stats";
      const label = labelEl.textContent.replace(/\s+/g, " ").trim();
      const statsOptions = { mode: "html" };
      if (reportId === "reportPivots") statsOptions.kind = "fixed";
      // Carretéis: a área é a soma das faixas irrigadas no período, então cresce com ele.
      if (reportId === "reportCarreteis" && classifyMetric(label) === "fixed") statsOptions.kind = "total";
      const binding = createMetricBinding(valueEl, label, `${reportId}|stats|${index}|${label}`, statsOptions);
      if (binding) state.stats.push(binding);
    });

    root.querySelectorAll("table:not(.pivot-fault-detail-table)").forEach((table, tableIndex) => {
      const headerMap = buildTableHeaderMap(table);
      if (table.querySelector("[data-demo-body], [data-carretel-body]")) return;
      const isGerencial = !!table.closest("#reportPivots");
      const isCarreteis = !!table.closest("#reportCarreteis");
      Array.from(table.querySelectorAll("tbody tr")).forEach((row, rowIndex) => {
        Array.from(row.cells).forEach((cell, cellIndex) => {
          const headerLabel = headerMap[cellIndex] || "";
          const naturalKind = classifyMetric(headerLabel);
          if (naturalKind === "text") return;
          if (naturalKind === "date") return;
          // Operações, paradas e % de operação do Carretéis saem do detalhe e não escalam com o período.
          if (cell.hasAttribute("data-carretel-derived")) return;
          const kind = isGerencial ? "fixed" : (isCarreteis && naturalKind === "fixed" ? "total" : naturalKind);
          const binding = createMetricBinding(
            cell,
            headerLabel,
            `table|${tableIndex}|${rowIndex}|${cellIndex}|${headerLabel}`,
            { mode: "text", kind }
          );
          if (binding) state.tableCells.push(binding);
        });
      });
    });

    root.querySelectorAll(".irrigation-detail-table .js-detail-date").forEach((cell, rowIndex) => {
      state.detailDates.push({ el: cell, offset: rowIndex });
    });

    return state;
  }

  function syncRainLabels(root, range) {
    const labels = Array.from(root.querySelectorAll('[data-stats-for="reportRain"] .farm-report__stats-label'));
    if (labels.length < 6) return;
    const days = Math.max(1, daysBetweenInclusive(range?.start, range?.end));
    labels[0].textContent = days <= 1 ? t("Último ciclo 7h-7h", "Last cycle 7h-7h") : t("Média diária", "Daily average");
    labels[1].textContent = days <= 1
      ? t("Últimas 24h", "Last 24h")
      : days <= 30
        ? t(`Acumulado ${days} dias`, `${days}-day Accumulated`)
        : t("Acumulado do Período", "Period Accumulated");
    labels[2].textContent = t("Acumulado Mês", "Month Accumulated");
    labels[3].textContent = days > 60 ? t("Acumulado Safra", "Season Accumulated") : t("Acumulado Ano", "Year Accumulated");
    labels[4].textContent = t("Maior Chuva Diaria no Periodo", "Highest Daily Rain in the Period");
    labels[5].textContent = t("Dias com Chuva", "Rainy Days");
  }

  function applyReportRange(root, bindingState, range, source) {
    const normalized = normalizeDateRange(range?.start, range?.end) || getDefaultReportRange();
    const profile = buildPeriodProfile(normalized);
    const label = `${formatDateBR(normalized.start)} - ${formatDateBR(normalized.end)}`;

    root.querySelectorAll(".js-period-trigger .pivo-agenda__period-label").forEach((el) => {
      el.textContent = label;
    });

    bindingState.exportDates.forEach((input, index) => {
      input.value = isoFromDate(index === 0 ? normalized.start : normalized.end);
    });

    bindingState.stats.forEach((binding) => applyMetricBinding(binding, profile));
    bindingState.tableCells.forEach((binding) => applyMetricBinding(binding, profile));
    bindingState.detailDates.forEach((binding) => {
      const nextDate = addDays(normalized.end, -binding.offset);
      if (nextDate) binding.el.textContent = formatDateBR(nextDate);
    });
    bindingState.footers.forEach((footer) => {
      footer.textContent = "";
    });

    syncRainLabels(root, normalized);
    root.dataset.reportPeriodRange = label;
    root.dataset.reportPeriodSource = source || "init";
    root.dispatchEvent(new CustomEvent("ic-report-range", { detail: normalized }));
    window.__icRelatoriosPeriod = {
      start: isoFromDate(normalized.start),
      end: isoFromDate(normalized.end),
    };
    return normalized;
  }

  const reportRangePicker = (() => {
    let popover = null;
    let panel = null;
    let leftTitle = null;
    let rightTitle = null;
    let leftMonthHost = null;
    let rightMonthHost = null;
    let anchorEl = null;
    let getRange = null;
    let setRange = null;
    let draftStart = null;
    let draftEnd = null;
    let previewDate = null;
    let baseMonth = null;
    let isOpen = false;

    function ensurePopover() {
      if (popover) return;
      popover = document.createElement("div");
      popover.className = "report-range-popover pluv-range-popover";
      popover.hidden = true;
      popover.innerHTML = `
        <div class="pluv-range-popover__arrow"></div>
        <div class="pluv-range-popover__panel" role="dialog" aria-label="Selecionar período do relatório">
          <aside class="pluv-range-popover__presets">
            <button type="button" data-preset="1d">Último dia</button>
            <button type="button" data-preset="7d">Últimos 7 dias</button>
            <button type="button" data-preset="14d">Últimos 14 dias</button>
            <button type="button" data-preset="30d">Últimos 30 dias</button>
          </aside>
          <section class="pluv-range-popover__cal">
            <header class="pluv-range-popover__cal-head">
              <button type="button" class="nav nav--prev" aria-label="Mês anterior">&#8249;</button>
              <div class="month-title month-title--left">-</div>
              <div class="month-title month-title--right">-</div>
              <button type="button" class="nav nav--next" aria-label="Próximo mês">&#8250;</button>
            </header>
            <div class="pluv-range-popover__months">
              <div class="month month--left"></div>
              <div class="month month--right"></div>
            </div>
          </section>
        </div>
      `;

      document.body.appendChild(popover);
      panel = popover.querySelector(".pluv-range-popover__panel");
      leftTitle = popover.querySelector(".month-title--left");
      rightTitle = popover.querySelector(".month-title--right");
      leftMonthHost = popover.querySelector(".month--left");
      rightMonthHost = popover.querySelector(".month--right");

      panel?.addEventListener("click", (event) => {
        const presetButton = event.target.closest("[data-preset]");
        if (presetButton) {
          const nextRange = buildReportRangeFromPreset(presetButton.getAttribute("data-preset"));
          if (nextRange && setRange) setRange(nextRange.start, nextRange.end, "preset");
          close();
          return;
        }

        if (event.target.closest(".nav--prev")) {
          baseMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() - 1, 1);
          render();
          return;
        }

        if (event.target.closest(".nav--next")) {
          baseMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1);
          render();
          return;
        }

        const dayButton = event.target.closest(".pluv-range-popover__day");
        if (!dayButton || dayButton.disabled) return;
        const date = dateFromISO(dayButton.getAttribute("data-date"));
        if (!date) return;

        if (!draftStart || draftEnd) {
          draftStart = toDateOnly(date);
          draftEnd = null;
          previewDate = null;
          render();
          return;
        }

        const normalized = normalizeDateRange(draftStart, date);
        if (!normalized || !setRange) return;
        setRange(normalized.start, normalized.end, "picker");
        close();
      });

      panel?.addEventListener("mouseover", (event) => {
        const dayButton = event.target.closest(".pluv-range-popover__day");
        if (!dayButton || dayButton.disabled || !draftStart || draftEnd) return;
        previewDate = dateFromISO(dayButton.getAttribute("data-date"));
        render();
      });

      panel?.addEventListener("mouseleave", () => {
        if (!draftStart || draftEnd) return;
        previewDate = null;
        render();
      });

      document.addEventListener("click", (event) => {
        if (!isOpen) return;
        if (popover?.contains(event.target) || anchorEl?.contains(event.target)) return;
        close();
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          close();
        }
      });

      window.addEventListener("resize", () => {
        if (isOpen) position();
      }, { passive: true });

      window.addEventListener("scroll", () => {
        if (isOpen) position();
      }, true);
    }

    function renderDay(date, isMuted) {
      const iso = isoFromDate(date);
      let cls = "pluv-range-popover__day";
      const isEdge = !isMuted && (
        (draftStart && date.getTime() === draftStart.getTime()) ||
        (draftEnd && date.getTime() === draftEnd.getTime()) ||
        (!draftEnd && previewDate && date.getTime() === previewDate.getTime())
      );
      const isInRange = !isMuted && draftStart && draftEnd &&
        date.getTime() > draftStart.getTime() &&
        date.getTime() < draftEnd.getTime();
      const isPreview = !isMuted && draftStart && !draftEnd && previewDate &&
        date.getTime() > Math.min(draftStart.getTime(), previewDate.getTime()) &&
        date.getTime() < Math.max(draftStart.getTime(), previewDate.getTime());

      if (isMuted) cls += " is-disabled";
      if (isInRange) cls += " is-inrange";
      if (isPreview) cls += " is-preview";
      if (isEdge) cls += " is-edge";
      return `<button type="button" class="${cls}" ${isMuted ? "disabled" : ""} data-date="${iso}">${date.getDate()}</button>`;
    }

    function renderMonthGrid(monthDate) {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const offset = firstDay.getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysInPrev = new Date(year, month, 0).getDate();

      let html = '<div class="pluv-range-popover__weekdays">';
      REPORT_PERIOD_WEEKDAYS.forEach((label) => {
        html += `<span>${label}</span>`;
      });
      html += '</div><div class="pluv-range-popover__grid">';

      for (let index = 0; index < offset; index += 1) {
        html += renderDay(new Date(year, month - 1, daysInPrev - offset + index + 1), true);
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        html += renderDay(new Date(year, month, day), false);
      }

      const usedCells = offset + daysInMonth;
      const trailing = (7 - (usedCells % 7)) % 7;
      for (let index = 1; index <= trailing; index += 1) {
        html += renderDay(new Date(year, month + 1, index), true);
      }

      html += "</div>";
      return html;
    }

    function syncPresetButtons() {
      if (!popover || !getRange) return;
      const preset = detectReportPreset(getRange());
      popover.querySelectorAll("[data-preset]").forEach((button) => {
        button.classList.toggle("is-active", button.getAttribute("data-preset") === preset);
      });
    }

    function render() {
      if (!baseMonth || !leftMonthHost || !rightMonthHost || !leftTitle || !rightTitle) return;
      const leftMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1);
      const rightMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1);
      leftTitle.textContent = `${leftMonth.getFullYear()} ${REPORT_PERIOD_MONTHS[leftMonth.getMonth()]}`;
      rightTitle.textContent = `${rightMonth.getFullYear()} ${REPORT_PERIOD_MONTHS[rightMonth.getMonth()]}`;
      leftMonthHost.innerHTML = renderMonthGrid(leftMonth);
      rightMonthHost.innerHTML = renderMonthGrid(rightMonth);
      syncPresetButtons();
    }

    function position() {
      if (!popover || !panel || !anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const panelWidth = panel.getBoundingClientRect().width || panel.offsetWidth || 0;
      const panelHeight = panel.getBoundingClientRect().height || panel.offsetHeight || 0;
      const safe = 8;
      const offset = 8;
      let top = rect.bottom + offset;
      let placement = "bottom";

      if (top + panelHeight > window.innerHeight - safe) {
        top = rect.top - panelHeight - offset;
        placement = "top";
      }

      let left = rect.left;
      if (left + panelWidth > window.innerWidth - safe) left = window.innerWidth - panelWidth - safe;
      if (left < safe) left = safe;

      popover.style.top = `${Math.max(safe, top)}px`;
      popover.style.left = `${left}px`;
      popover.dataset.placement = placement;

      const arrowLeft = rect.left + (rect.width / 2) - left;
      popover.style.setProperty("--arrow-left", `${clamp(arrowLeft, 20, Math.max(20, panelWidth - 20))}px`);
    }

    function open(triggerEl, rangeGetter, rangeSetter) {
      ensurePopover();
      anchorEl = triggerEl;
      getRange = rangeGetter;
      setRange = rangeSetter;
      const current = rangeGetter?.() || getDefaultReportRange();
      draftStart = current?.start ? toDateOnly(current.start) : null;
      draftEnd = current?.end ? toDateOnly(current.end) : null;
      previewDate = null;
      baseMonth = new Date((draftStart || new Date()).getFullYear(), (draftStart || new Date()).getMonth(), 1);
      render();
      popover.hidden = false;
      popover.style.visibility = "hidden";
      position();
      popover.style.visibility = "visible";
      isOpen = true;
    }

    function close() {
      if (!popover) return;
      popover.hidden = true;
      popover.style.visibility = "";
      popover.style.removeProperty("top");
      popover.style.removeProperty("left");
      popover.removeAttribute("data-placement");
      isOpen = false;
      previewDate = null;
    }

    function bindTrigger(triggerEl, rangeGetter, rangeSetter) {
      if (!triggerEl || triggerEl.dataset.reportPeriodBound === "true") return;
      triggerEl.dataset.reportPeriodBound = "true";
      triggerEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isOpen && anchorEl === triggerEl) {
          close();
          return;
        }
        open(triggerEl, rangeGetter, rangeSetter);
      });
      triggerEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        triggerEl.click();
      });
    }

    return {
      bindTrigger,
      close,
    };
  })();

  function formatScheduleFrequency(schedule) {
    if (!schedule) return "";
    if (schedule.frequency === "weekly") {
      const labels = WEEKDAY_META
        .filter((day) => Array.isArray(schedule.weekdays) && schedule.weekdays.includes(day.key))
        .map((day) => day.short);
      return labels.length ? `Semanal | ${labels.join(", ")}` : "Semanal";
    }
    if (schedule.frequency === "monthly") {
      return schedule.monthDay ? `Mensal | dia ${schedule.monthDay}` : "Mensal";
    }
    return "Diario | todos os dias";
  }

  window.IcRelatorios = {
    async open(options) {
      document.body.classList.add("is-relatorios");
      hideMapCard();
      await mountReportView(options || {});
      window.dispatchEvent(new Event("ic:layout-change"));
    },

    close() {
      reportRangePicker.close();
      if (window.__icRelatoriosCleanup) {
        window.__icRelatoriosCleanup();
        window.__icRelatoriosCleanup = null;
      }
      document.body.classList.remove("is-relatorios");
      const slot = document.getElementById("pageSlot");
      if (slot) slot.innerHTML = "";
      showMapCard();
      window.dispatchEvent(new Event("ic:layout-change"));
    },
  };

  function getFarmData() {
    const state = window.CreateFarm?.state;
    const farms = Array.isArray(state?.farms) ? state.farms : [];
    const activeId =
      state?.currentFarmId ||
      sessionStorage.getItem("ic_active_farm") ||
      sessionStorage.getItem("ic_active_farm_id");
    let farm = farms.find((item) => item.id === activeId) || farms[0];

    if (!farm) {
      try {
        const stored = JSON.parse(localStorage.getItem("ic_farms") || "[]");
        if (Array.isArray(stored)) {
          farm = stored.find((item) => item.id === activeId) || stored[0];
        }
      } catch (_) { }
    }

    return farm || null;
  }

  const DEFAULT_ACC_OUTLINE = [
    { a: 350, r: 0.8 }, { a: 20, r: 0.82 }, { a: 70, r: 0.82 }, { a: 110, r: 0.8 },
    { a: 145, r: 0.78 }, { a: 170, r: 0.78 },
    { a: 190, r: 0.78 }, { a: 190, r: 0.55 }, { a: 215, r: 0.55 }, { a: 215, r: 0.78 },
    { a: 240, r: 0.78 },
    { a: 255, r: 0.78 }, { a: 255, r: 0.38 }, { a: 285, r: 0.38 }, { a: 285, r: 0.78 },
    { a: 305, r: 0.78 }, { a: 305, r: 0.5 }, { a: 330, r: 0.5 }, { a: 330, r: 0.78 },
  ];

  function parseOutline(raw) {
    if (!raw) return DEFAULT_ACC_OUTLINE;
    const points = raw.split(",").map((item) => {
      const [a, r] = item.trim().split(":");
      const angle = Number(a);
      const radius = Number(r);
      if (Number.isNaN(angle) || Number.isNaN(radius)) return null;
      return { a: angle, r: radius };
    }).filter(Boolean);
    return points.length ? points : DEFAULT_ACC_OUTLINE;
  }

  function drawPivotAccum(canvas, cfg) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 2;
    const ringCount = cfg.ringCount ?? 3;

    const deg2rad = (d) => (d * Math.PI) / 180;
    const polar = (angleDeg, radius01) => {
      const a = deg2rad(angleDeg - 90);
      const r = radius01 * R;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    };

    const outlineP = cfg.outline ?? DEFAULT_ACC_OUTLINE;
    const pts = outlineP.map((p) => polar(p.a, p.r));

    // Desenha anéis de referência (azuis e sutis)
    for (let i = 1; i <= ringCount; i += 1) {
      const rr = (R * i) / ringCount;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(59, 130, 246, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (pts.length) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();

      // Preenchimento Azul Suave
      ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
      ctx.fill();

      // Contorno Azul mais definido
      ctx.strokeStyle = "rgba(30, 64, 175, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Centro
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }


  function initReportUI(root, options) {
    if (window.__icRelatoriosCleanup) {
      window.__icRelatoriosCleanup();
      window.__icRelatoriosCleanup = null;
    }
    const reportUICleanupFns = [];
    window.__icRelatoriosCleanup = () => {
      reportUICleanupFns.forEach((fn) => fn());
      reportUICleanupFns.length = 0;
    };

    const farm = getFarmData();
    const farmName = farm?.name || "Fazenda";
    const titleEl = root.querySelector("[data-report-farm]");
    if (titleEl) titleEl.textContent = farmName;

    const reportRoot = root.querySelector(".farm-report") || root;
    const sections = root.querySelectorAll(".edit-panel__section");
    const selector = root.querySelector("[data-report-selector]");
    const selectorTrigger = root.querySelector("[data-report-selector-trigger]");
    const selectorMenu = root.querySelector("[data-report-selector-menu]");
    const selectorValue = root.querySelector("[data-report-selector-value]");
    const selectorItems = Array.from(root.querySelectorAll("[data-report-selector-item]"));
    const reportBindingState = captureReportBindings(root);
    const storedRange = window.__icRelatoriosPeriod
      ? normalizeDateRange(dateFromISO(window.__icRelatoriosPeriod.start), dateFromISO(window.__icRelatoriosPeriod.end))
      : null;
    let activeReportRange = storedRange || getDefaultReportRange();

    function getActiveReportRange() {
      return activeReportRange;
    }

    function setActiveReportRange(start, end, source) {
      activeReportRange = applyReportRange(root, reportBindingState, { start, end }, source);
      return activeReportRange;
    }

    function setSelectorOpen(isOpen) {
      if (!selector || !selectorTrigger || !selectorMenu) return;
      selector.classList.toggle("is-open", isOpen);
      selectorTrigger.setAttribute("aria-expanded", String(isOpen));
      selectorMenu.setAttribute("aria-hidden", String(!isOpen));
    }

    function activateReport(targetId, label) {
      selectorItems.forEach((item) => {
        const isActive = item.getAttribute("data-target") === targetId;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-selected", String(isActive));
      });

        // Show section
      sections.forEach((section) => section.classList.remove("is-active"));
      const target = root.querySelector(targetId);
      if (target) target.classList.add("is-active");

        // Show matching stats bar
      const sectionIdForStats = targetId.replace(/^#/, "");
      root.querySelectorAll("[data-stats-for]").forEach((el) => {
        el.classList.toggle("is-active", el.dataset.statsFor === sectionIdForStats);
      });

        // Show matching filter bar and move selector into it
      const sectionId = targetId.replace(/^#/, "");
      let activeBar = null;
      root.querySelectorAll(".farm-report__filters[data-filter-for]").forEach((bar) => {
        const isActive = bar.dataset.filterFor === sectionId;
        bar.classList.toggle("is-active", isActive);
        if (isActive) activeBar = bar;
      });

      if (activeBar && selector) {
        const header = activeBar.querySelector(".pivo-agenda__header");
        if (header && selector.parentElement !== header) {
          const placeholder = header.querySelector(".report-selector-placeholder");
          // "Tipo" é sempre o primeiro .pivo-agenda__title do header — comparar
          // pelo texto quebrava em inglês (i18n traduz pra "Type" e a
          // comparação com a string fixa em pt deixava de bater).
          const typeTitle = header.querySelector(".pivo-agenda__title");

          if (placeholder) {
            placeholder.appendChild(selector);
          } else if (typeTitle) {
            typeTitle.after(selector);
          } else {
            header.insertBefore(selector, header.firstChild);
          }
        }
      }

      requestAnimationFrame(() => {
        activeBar?.querySelectorAll("[data-report-multi]").forEach((multi) => {
          multi._renderChips?.();
        });
      });

        // Update chips/crumbs
      if (selectorValue) {
        const activeItem = selectorItems.find(i => i.getAttribute("data-target") === targetId);
        const svg = activeItem?.querySelector("svg");
        selectorValue.innerHTML = "";
        if (svg) selectorValue.appendChild(svg.cloneNode(true));
        selectorValue.appendChild(document.createTextNode(label));
      }

        // Scroll to top
      const content = root.querySelector(".edit-panel__content");
      if (content) content.scrollTop = 0;

      setSelectorOpen(false);
    }

    if (selectorTrigger) {
      selectorTrigger.addEventListener("click", (event) => {
        event.stopPropagation();
        setSelectorOpen(!selector?.classList.contains("is-open"));
      });
    }

    if (selectorMenu) {
      selectorMenu.addEventListener("click", (event) => {
        const item = event.target.closest("[data-report-selector-item]");
        if (!item) return;
        const targetId = item.getAttribute("data-target");
        if (!targetId) return;
        activateReport(targetId, item.textContent.trim());
      });
    }

    const handleSelectorOutsideClick = (event) => {
      if (!selector?.contains(event.target)) setSelectorOpen(false);
    };
    document.addEventListener("click", handleSelectorOutsideClick);
    reportUICleanupFns.push(() => document.removeEventListener("click", handleSelectorOutsideClick));

    // Relatórios escondidos: cada item do menu com data-report-secret="shift+<letra>"
    // aparece ao pressionar Shift + <letra> e o relatório já abre. Depois de
    // revelado, o item fica no menu até sair da tela de Relatórios. Não dispara
    // em campos de texto, exceto na busca de equipamentos do próprio filtro.
    const handleSecretReportKeydown = (event) => {
      if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      const el = event.target;
      const typing = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (typing && !el.matches("[data-report-search]")) return;
      const letter = /^Key([A-Z])$/.exec(event.code || "")?.[1];
      if (!letter) return;
      const item = root.querySelector(`[data-report-secret="shift+${letter.toLowerCase()}"]`);
      if (!item) return;
      event.preventDefault();
      item.style.display = "";
      activateReport(item.getAttribute("data-target"), item.textContent.trim());
    };
    document.addEventListener("keydown", handleSecretReportKeydown);
    reportUICleanupFns.push(() => document.removeEventListener("keydown", handleSecretReportKeydown));

    if (selectorItems.length) {
      const initialTarget = options?.initialReportTarget || null;
      const activeItem =
        selectorItems.find((item) => item.getAttribute("data-target") === initialTarget) ||
        selectorItems.find((item) => item.classList.contains("is-active")) ||
        selectorItems[0];
      if (activeItem) {
        activateReport(activeItem.getAttribute("data-target"), activeItem.textContent.trim());
      }
    }

    root.querySelectorAll(".js-period-trigger").forEach((trigger) => {
      reportRangePicker.bindTrigger(trigger, getActiveReportRange, setActiveReportRange);
    });
    setActiveReportRange(activeReportRange.start, activeReportRange.end, "init");

    // Back button
    const backBtn = root.querySelector("#relatoriosBack");
    if (backBtn) {
      backBtn.addEventListener("click", (e) => {
        e.stopImmediatePropagation();
        reportRangePicker.close();
        if (window.IcNavigate) {
          window.IcNavigate("dashboard");
        } else {
          document.querySelector('.nav__item[data-route="visao-geral"]')?.click();
        }
      });
    }

    // Export modal logic
    const modal = root.querySelector("#modalExport");
    const exportBtns = root.querySelectorAll("#btnExportReport, #btnExportReportRain, #btnExportReportEnergy, #btnExportReportWater, #btnExportReportIrrigacao");
    
    if (modal) {
      exportBtns.forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          modal.classList.add("is-open");
          modal.setAttribute("aria-hidden", "false");
        };
      });

      modal.querySelectorAll("[data-modal-close]").forEach(close => {
        close.onclick = () => {
          modal.classList.remove("is-open");
          modal.setAttribute("aria-hidden", "true");
        };
      });

      // Toggle report types
      modal.querySelectorAll(".report-modal__option").forEach(opt => {
        opt.onclick = (e) => {
          const check = opt.querySelector('input[type="checkbox"]');
          if (check) check.checked = !check.checked;
          opt.classList.toggle("is-active", check ? check.checked : false);
        };
      });

      // Toggle formats
      const formatBtns = modal.querySelectorAll(".report-modal__format");
      formatBtns.forEach(btn => {
        btn.onclick = () => {
          formatBtns.forEach(b => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          
          if (window.IcNotify) {
            window.IcNotify.success(`Relatórios exportados com sucesso em ${btn.querySelector("strong").textContent}!`);
            modal.classList.remove("is-open");
          }
        };
      });
    }

    const exportModal = modal;
    const scheduleModal = root.querySelector("#modalSchedule");
    const allExportButtons = Array.from(root.querySelectorAll('[id^="btnExportReport"]'));
    const scheduleSaveBtn = scheduleModal?.querySelector("[data-schedule-save]");
    const scheduleCountEl = scheduleModal?.querySelector("[data-schedule-count]");
    const scheduleHistoryEl = scheduleModal?.querySelector("[data-schedule-history]");
    const scheduleEmailInput = scheduleModal?.querySelector("[data-schedule-email]");
    const scheduleTimeInput = scheduleModal?.querySelector("[data-schedule-time]");
    const scheduleMonthDayInput = scheduleModal?.querySelector("[data-schedule-month-day]");
    const scheduleIdInput = scheduleModal?.querySelector("[data-schedule-id]");
    const scheduleFrequencyBtns = Array.from(scheduleModal?.querySelectorAll("[data-schedule-frequency-btn]") || []);
    const scheduleWeekdayBtns = Array.from(scheduleModal?.querySelectorAll("[data-weekday]") || []);
    let scheduleDraftType = "Operação";
    let editingScheduleId = null;
    let schedules = readStoredSchedules().map((schedule) => ({
      ...schedule,
      reports: Array.isArray(schedule.reports) && schedule.reports.length
        ? schedule.reports.map((item) => canonicalReportType(item)).filter(Boolean)
        : [canonicalReportType(schedule.reportType)].filter(Boolean),
      reportType: canonicalReportType(schedule.reportType || (Array.isArray(schedule.reports) ? schedule.reports[0] : "")),
      frequency: ["daily", "weekly", "monthly"].includes(schedule.frequency) ? schedule.frequency : "daily",
    }));

    allExportButtons.forEach((button) => {
      button.onclick = null;
    });
    exportModal?.querySelectorAll("[data-modal-close], .report-modal__option, .report-modal__format").forEach((node) => {
      node.onclick = null;
    });

    function notifySuccess(message) {
      if (window.IcNotify?.success) window.IcNotify.success(message);
    }

    function openModal(modalEl) {
      if (!modalEl) return;
      modalEl.classList.add("is-open");
      modalEl.setAttribute("aria-hidden", "false");
    }

    function closeModal(modalEl) {
      if (!modalEl) return;
      if (modalEl.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      modalEl.classList.remove("is-open");
      modalEl.setAttribute("aria-hidden", "true");
    }

    function getReportTypeFromTrigger(trigger) {
      const fromSection = REPORT_SECTION_TYPES[trigger?.closest(".edit-panel__section")?.id];
      if (fromSection) return fromSection;
      const fromId = REPORT_BUTTON_TYPES[trigger?.id];
      if (fromId) return fromId;
      const fromData = canonicalReportType(trigger?.dataset?.reportType || trigger?.dataset?.reportKind);
      if (fromData) return fromData;
      return "Operação";
    }

    function getSelectedReportTypes(modalEl) {
      const options = Array.from(modalEl?.querySelectorAll("[data-report-option].is-active") || []);
      if (options.length) {
        return options
          .map((option) => canonicalReportType(option.dataset.reportOption || option.textContent))
          .filter(Boolean);
      }

      return [];
    }

    function setSelectedReportTypes(modalEl, reportTypes) {
      const selected = new Set((reportTypes || []).map((item) => canonicalReportType(item)).filter(Boolean));
      const options = Array.from(modalEl?.querySelectorAll("[data-report-option]") || []);
      options.forEach((option) => {
        const optionType = canonicalReportType(option.dataset.reportOption || option.textContent);
        const input = option.querySelector('input[type="checkbox"]');
        const isActive = selected.has(optionType);
        option.classList.toggle("is-active", isActive);
        if (input) input.checked = isActive;
      });
    }

    function setActiveFormat(modalEl, formatLabel) {
      modalEl?.querySelectorAll("[data-format]").forEach((button) => {
        const isActive = normalizeText(button.dataset.format || button.textContent) === normalizeText(formatLabel);
        button.classList.toggle("is-active", isActive);
      });
    }

    function getActiveFormat(modalEl) {
      return modalEl?.querySelector("[data-format].is-active")?.dataset.format || "Excel";
    }

    function getActiveFormats(modalEl) {
      const active = [...(modalEl?.querySelectorAll("[data-format].is-active") || [])];
      return active.map(b => b.dataset.format).filter(Boolean);
    }

    function setScheduleFrequency(frequency) {
      const nextFrequency = ["daily", "weekly", "monthly"].includes(frequency) ? frequency : "daily";
      if (scheduleModal) scheduleModal.dataset.scheduleFrequency = nextFrequency;
      if (nextFrequency === "weekly" && !scheduleWeekdayBtns.some((button) => button.classList.contains("is-active"))) {
        scheduleWeekdayBtns[0]?.classList.add("is-active");
      }
      if (nextFrequency === "monthly" && scheduleMonthDayInput && !scheduleMonthDayInput.value) {
        scheduleMonthDayInput.value = "1";
      }
      scheduleFrequencyBtns.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.frequency === nextFrequency);
      });
      scheduleModal?.querySelectorAll("[data-schedule-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.schedulePanel === nextFrequency);
      });
    }

    function getScheduleFrequency() {
      return scheduleModal?.dataset.scheduleFrequency || "daily";
    }

    function resetScheduleForm(defaultType) {
      editingScheduleId = null;
      scheduleDraftType = defaultType || scheduleDraftType || "Operação";
      setSelectedReportTypes(scheduleModal, [scheduleDraftType]);
      setActiveFormat(scheduleModal, "Excel");
      setScheduleFrequency("daily");
      scheduleWeekdayBtns.forEach((button) => button.classList.remove("is-active"));
      if (scheduleIdInput) scheduleIdInput.value = "";
      if (scheduleMonthDayInput) scheduleMonthDayInput.value = "";
      if (scheduleEmailInput) scheduleEmailInput.value = "";
      if (scheduleTimeInput) scheduleTimeInput.value = "07:00";
      if (scheduleSaveBtn) scheduleSaveBtn.textContent = t("Salvar programação", "Save schedule");
    }

    function fillScheduleForm(schedule) {
      if (!schedule) return;
      editingScheduleId = schedule.id || null;
      setSelectedReportTypes(
        scheduleModal,
        Array.isArray(schedule.reports) && schedule.reports.length
          ? schedule.reports
          : [canonicalReportType(schedule.reportType)].filter(Boolean)
      );
      setActiveFormat(scheduleModal, schedule.format || "Excel");
      setScheduleFrequency(schedule.frequency || "daily");
      scheduleWeekdayBtns.forEach((button) => {
        button.classList.toggle("is-active", Array.isArray(schedule.weekdays) && schedule.weekdays.includes(button.dataset.weekday));
      });
      if (scheduleIdInput) scheduleIdInput.value = schedule.id || "";
      if (scheduleMonthDayInput) scheduleMonthDayInput.value = schedule.monthDay ? String(schedule.monthDay) : "";
      if (scheduleEmailInput) scheduleEmailInput.value = schedule.email || "";
      if (scheduleTimeInput) scheduleTimeInput.value = schedule.time || "07:00";
      if (scheduleSaveBtn) scheduleSaveBtn.textContent = t("Salvar alterações", "Save changes");
    }

    function renderScheduleHistory() {
      if (!scheduleHistoryEl) return;
      if (scheduleCountEl) scheduleCountEl.textContent = String(schedules.length);

      if (!schedules.length) {
        scheduleHistoryEl.innerHTML = `
          <div class="report-schedule__history-empty">
            Nenhuma programação criada ainda. Use "Agendar envio" para salvar exportações automáticas por e-mail.
          </div>
        `;
        return;
      }

      scheduleHistoryEl.innerHTML = schedules.map((schedule) => {
        const reports = Array.isArray(schedule.reports) && schedule.reports.length
          ? schedule.reports
          : [canonicalReportType(schedule.reportType)].filter(Boolean);
        const title = reports.length === 1 ? reports[0] : `${reports.length} relatórios programados`;
        const frequency = formatScheduleFrequency(schedule);
        const format = schedule.format || "Excel";
        const email = schedule.email || "-";
        const time = schedule.time || "--:--";
        return `
          <article class="report-schedule__history-card">
            <div class="report-schedule__history-main">
              <h4 class="report-schedule__history-title">${escapeHtml(title)}</h4>
              <p class="report-schedule__history-meta"><strong>${escapeHtml(frequency)}</strong> • ${escapeHtml(format)} • ${escapeHtml(time)}</p>
              <p class="report-schedule__history-meta">${escapeHtml(reports.join(", "))}</p>
              <p class="report-schedule__history-meta">${escapeHtml(email)}</p>
            </div>
            <div class="report-schedule__history-actions">
              <button class="report-schedule__history-btn" type="button" data-schedule-edit="${escapeHtml(schedule.id)}">Editar</button>
              <button class="report-schedule__history-btn report-schedule__history-btn--danger" type="button" data-schedule-delete="${escapeHtml(schedule.id)}">Excluir</button>
            </div>
          </article>
        `;
      }).join("");
    }

    function validateSchedulePayload(payload) {
      if (!payload.reports.length) return "Selecione pelo menos um relatório para programar.";
      if (payload.frequency === "weekly" && !payload.weekdays.length) {
        return "Escolha pelo menos um dia da semana para o envio semanal.";
      }
      if (payload.frequency === "monthly" && !payload.monthDay) {
        return "Escolha o dia do mês para o envio mensal.";
      }
      if (!payload.email) return "Informe o e-mail que vai receber os relatórios.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        return "Informe um e-mail válido para o envio automático.";
      }
      if (!payload.time) return "Escolha o horário do envio automático.";
      return "";
    }

    [exportModal, scheduleModal].forEach((modalEl) => {
      if (!modalEl) return;

      modalEl.querySelector(".report-modal__backdrop")?.addEventListener("click", () => closeModal(modalEl));

      modalEl.querySelectorAll("[data-modal-close]").forEach((closeButton) => {
        closeButton.addEventListener("click", () => closeModal(modalEl));
      });

      modalEl.querySelectorAll("[data-report-option]").forEach((option) => {
        option.addEventListener("click", (event) => {
          event.preventDefault();
          const input = option.querySelector('input[type="checkbox"]');
          const nextState = !(input && input.checked);
          if (input) input.checked = nextState;
          option.classList.toggle("is-active", nextState);
        });
      });
    });

    allExportButtons.forEach((button) => {
      const reportType = getReportTypeFromTrigger(button);
      button.dataset.reportType = reportType;

      if (!button.parentElement?.querySelector(`[data-open-schedule-modal][data-source="${button.id}"]`)) {
        const scheduleButton = document.createElement("button");
        scheduleButton.type = "button";
        scheduleButton.className = "farm-report__schedule-btn";
        scheduleButton.dataset.openScheduleModal = "true";
        scheduleButton.dataset.source = button.id;
        scheduleButton.dataset.reportType = reportType;
        scheduleButton.innerHTML = '<i class="fa-regular fa-clock"></i>Agendar envio';
        button.insertAdjacentElement("afterend", scheduleButton);
      }

      button.addEventListener("click", (event) => {
        event.preventDefault();
        setSelectedReportTypes(exportModal, [reportType]);
        setActiveFormat(exportModal, "Excel");
        openModal(exportModal);
      });
    });

    exportModal?.querySelectorAll("[data-format]").forEach((button) => {
      button.addEventListener("click", () => {
        button.classList.toggle("is-active");
      });
    });

    exportModal?.querySelector("#btnDownloadReport")?.addEventListener("click", () => {
      const selectedReports = getSelectedReportTypes(exportModal);
      if (!selectedReports.length) {
        window.alert(tMsg("Selecione pelo menos um tipo de relatório para exportar."));
        return;
      }
      const formats = getActiveFormats(exportModal);
      if (!formats.length) {
        window.alert(tMsg("Selecione pelo menos um formato de arquivo."));
        return;
      }
      notifySuccess(`Exportação preparada em ${formats.join(", ")} para ${selectedReports.join(", ")}.`);
      closeModal(exportModal);
    });

    scheduleModal?.querySelectorAll("[data-format]").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveFormat(scheduleModal, button.dataset.format || "Excel");
      });
    });

    root.querySelectorAll("[data-open-schedule-modal]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const reportType = getReportTypeFromTrigger(button);
        resetScheduleForm(reportType);
        renderScheduleHistory();
        openModal(scheduleModal);
      });
    });

    scheduleFrequencyBtns.forEach((button) => {
      button.addEventListener("click", () => {
        setScheduleFrequency(button.dataset.frequency || "daily");
      });
    });

    scheduleWeekdayBtns.forEach((button) => {
      button.addEventListener("click", () => {
        button.classList.toggle("is-active");
      });
    });

    scheduleHistoryEl?.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-schedule-edit]");
      if (editButton) {
        const schedule = schedules.find((item) => item.id === editButton.dataset.scheduleEdit);
        if (!schedule) return;
        fillScheduleForm(schedule);
        openModal(scheduleModal);
        return;
      }

      const deleteButton = event.target.closest("[data-schedule-delete]");
      if (!deleteButton) return;

      const scheduleId = deleteButton.dataset.scheduleDelete;
      if (!scheduleId) return;
      if (!window.confirm(tMsg("Deseja remover esta programação de envio?"))) return;

      schedules = schedules.filter((item) => item.id !== scheduleId);
      writeStoredSchedules(schedules);
      if (editingScheduleId === scheduleId) resetScheduleForm(scheduleDraftType);
      renderScheduleHistory();
      notifySuccess("Programação removida com sucesso.");
    });

    scheduleSaveBtn?.addEventListener("click", () => {
      const payload = {
        reports: getSelectedReportTypes(scheduleModal),
        frequency: getScheduleFrequency(),
        weekdays: scheduleWeekdayBtns.filter((button) => button.classList.contains("is-active")).map((button) => button.dataset.weekday),
        monthDay: scheduleMonthDayInput?.value || "",
        format: getActiveFormat(scheduleModal),
        email: scheduleEmailInput?.value.trim() || "",
        time: scheduleTimeInput?.value || "",
      };

      const validationMessage = validateSchedulePayload(payload);
      if (validationMessage) {
        window.alert(validationMessage);
        return;
      }

      if (editingScheduleId) {
        schedules = schedules.map((item) => (
          item.id === editingScheduleId
            ? { ...item, ...payload, reportType: payload.reports[0] || "", updatedAt: Date.now() }
            : item
        ));
        notifySuccess("Programação atualizada com sucesso.");
      } else {
        schedules = [{
          id: createScheduleId(),
          ...payload,
          reportType: payload.reports[0] || "",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }, ...schedules];
        notifySuccess("Programação salva com sucesso.");
      }

      writeStoredSchedules(schedules);
      renderScheduleHistory();
      resetScheduleForm(payload.reports[0] || scheduleDraftType);
    });

    renderScheduleHistory();

    const tabs = Array.from(root.querySelectorAll(".farm-report__tab"));
    const weekWrap = root.querySelector("[data-report-week]");
    const weekToggle = weekWrap?.querySelector(".farm-report__week-input");
    const monthWrap = root.querySelector("[data-report-month-picker]");
    const monthToggle = root.querySelector("[data-report-month-toggle]");
    const quarterWrap = root.querySelector("[data-report-quarter-picker]");
    const quarterToggle = root.querySelector("[data-report-quarter-toggle]");

    function setPeriod(period) {
      if (reportRoot) reportRoot.dataset.reportPeriod = period;
      tabs.forEach((tab) => {
        const isActive = tab.textContent?.trim().toLowerCase() === periodLabel(period);
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      });
      if (weekWrap && period !== "weekly") weekWrap.classList.remove("is-open");
      if (monthWrap && period !== "monthly") monthWrap.classList.remove("is-open");
      if (quarterWrap && period !== "quarterly") quarterWrap.classList.remove("is-open");
    }

    function periodLabel(period) {
      if (period === "weekly") return "semanal";
      if (period === "monthly") return "mensal";
      return "trimestral";
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const label = tab.textContent?.trim().toLowerCase();
        if (label === "semanal") setPeriod("weekly");
        else if (label === "mensal") setPeriod("monthly");
        else setPeriod("quarterly");
      });
    });

    setPeriod("weekly");

    // Chuva: gráfico + calendário mensal (reuso do módulo de pluviometria)
    const rainChartView = root.querySelector("#rainChartView");
    const rainMonthlyPanel = root.querySelector("#rainMonthlyPanel");
    if (rainChartView && rainMonthlyPanel && window.Plv?.rain?.renderRainChart) {
      window.Plv.state = window.Plv.state || {};
      if (!(window.Plv.state.selected instanceof Set)) {
        window.Plv.state.selected = new Set();
      }
      if (!window.Plv.state.rainPeriod) {
        window.Plv.state.rainPeriod = "7d";
      }

      rainChartView.classList.remove("is-hidden");
      rainMonthlyPanel.classList.remove("is-hidden");

      window.Plv.rain.bindRainUI?.();
      window.Plv.rain.renderRainChart();
    }

    if (weekToggle) {
      weekToggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        weekWrap?.classList.toggle("is-open");
      });
    }

    const handleWeekWrapOutsideClick = (event) => {
      if (!weekWrap) return;
      if (weekWrap.contains(event.target)) return;
      weekWrap.classList.remove("is-open");
    };
    document.addEventListener("click", handleWeekWrapOutsideClick);
    reportUICleanupFns.push(() => document.removeEventListener("click", handleWeekWrapOutsideClick));

    if (monthToggle && monthWrap) {
      monthToggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        monthWrap.classList.toggle("is-open");
      });
    }

    const handleMonthWrapOutsideClick = (event) => {
      if (!monthWrap) return;
      if (monthWrap.contains(event.target)) return;
      monthWrap.classList.remove("is-open");
    };
    document.addEventListener("click", handleMonthWrapOutsideClick);
    reportUICleanupFns.push(() => document.removeEventListener("click", handleMonthWrapOutsideClick));

    if (quarterToggle && quarterWrap) {
      quarterToggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        quarterWrap.classList.toggle("is-open");
      });
    }

    const handleQuarterWrapOutsideClick = (event) => {
      if (!quarterWrap) return;
      if (quarterWrap.contains(event.target)) return;
      quarterWrap.classList.remove("is-open");
    };
    document.addEventListener("click", handleQuarterWrapOutsideClick);
    reportUICleanupFns.push(() => document.removeEventListener("click", handleQuarterWrapOutsideClick));

    const monthInput = root.querySelector("[data-report-month]");
    if (monthInput && !monthInput.value) {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      monthInput.value = ym;
    }

    // Generic Multi-select Filters (Pivots, Pluviometers, etc.)
    root.querySelectorAll("[data-report-multi]").forEach((multi) => {
      const chipsHost = multi.querySelector("[data-report-chips]");
      const searchInput = multi.querySelector("[data-report-search]");
      const dropdown = multi.querySelector("[data-report-dropdown]");
      const listHost = multi.querySelector("[data-report-list]");
      const selectAllBtn = multi.querySelector("[data-report-select-all]");
      const removeAllBtn = multi.querySelector("[data-report-remove-all]");

      if (!chipsHost || !dropdown || !listHost) return;

      function getItemLabel(itemEl) {
        const labelClone = itemEl.cloneNode(true);
        labelClone.querySelector(".check")?.remove();
        return labelClone.textContent.trim();
      }

      function findChipByLabel(label) {
        return Array.from(chipsHost.querySelectorAll(".farm-report__chip:not(.farm-report__chip--count)"))
          .find((chip) => chip.dataset.label === label);
      }

      function createChip(label, itemEl) {
        const chip = document.createElement("span");
        const chipLabel = document.createElement("span");
        const chipRemove = document.createElement("button");

        chip.className = "farm-report__chip";
        chip.dataset.label = label;
        chipLabel.className = "farm-report__chip-label";
        chipLabel.textContent = label;
        chipRemove.type = "button";
        chipRemove.setAttribute("aria-label", `Remover ${label}`);
        chipRemove.textContent = "x";
        chipRemove.onclick = (e) => {
          e.stopPropagation();
          if (itemEl.classList.contains("is-selected")) {
            toggleItem(itemEl);
          }
        };

        chip.append(chipLabel, chipRemove);
        return chip;
      }

      function openDropdown() {
        dropdown.classList.add("is-open");
        dropdown.setAttribute("aria-hidden", "false");
      }

      function closeDropdown() {
        dropdown.classList.remove("is-open");
        dropdown.setAttribute("aria-hidden", "true");
      }

      function renderChips() {
        const allChips = Array.from(chipsHost.querySelectorAll(".farm-report__chip:not(.farm-report__chip--count)"));
        let countChip = chipsHost.querySelector(".farm-report__chip--count");
        const control = multi.querySelector("[data-report-multi-control]");

        allChips.forEach((chip) => {
          chip.style.display = "";
        });
        if (countChip) countChip.remove();
        if (!allChips.length || !control) return;

        const controlRect = control.getBoundingClientRect();
        if (!controlRect.width) return;

        const controlStyles = window.getComputedStyle(control);
        const chipsStyles = window.getComputedStyle(chipsHost);
        const controlGap = parseFloat(controlStyles.columnGap || controlStyles.gap) || 0;
        const chipGap = parseFloat(chipsStyles.columnGap || chipsStyles.gap) || controlGap;
        const controlPadding = (parseFloat(controlStyles.paddingLeft) || 0) + (parseFloat(controlStyles.paddingRight) || 0);
        const searchMinWidth = searchInput ? Math.max(parseFloat(window.getComputedStyle(searchInput).minWidth) || 0, 24) : 0;
        const chevronWidth = multi.querySelector(".farm-report__chev")?.getBoundingClientRect().width || 16;
        const reservedWidth = controlPadding + searchMinWidth + chevronWidth + (controlGap * 2) + 18;
        const available = Math.max(0, controlRect.width - reservedWidth);
        const chipWidths = allChips.map((chip) => chip.getBoundingClientRect().width);

        const getUsedWidth = (count) => chipWidths
          .slice(0, count)
          .reduce((total, width, index) => total + width + (index ? chipGap : 0), 0);

        let visibleCount = allChips.length;
        while (visibleCount > 0 && getUsedWidth(visibleCount) > available) {
          visibleCount--;
        }

        if (visibleCount >= allChips.length) return;

        // need room for the +N badge — hide one more if needed
        countChip = document.createElement("span");
        countChip.className = "farm-report__chip farm-report__chip--count";
        chipsHost.appendChild(countChip);

        const updateCountChip = () => {
          countChip.textContent = `+${allChips.length - visibleCount}`;
        };

        const getTotalWithCount = () => {
          const countWidth = countChip.getBoundingClientRect().width;
          return getUsedWidth(visibleCount) + countWidth + (visibleCount ? chipGap : 0);
        };

        updateCountChip();
        while (visibleCount > 0 && getTotalWithCount() > available) {
          visibleCount--;
          updateCountChip();
        }

        if (visibleCount > 1) {
          visibleCount--;
          updateCountChip();
        }

        while (visibleCount > 0 && getTotalWithCount() > available) {
          visibleCount--;
          updateCountChip();
        }

        allChips.forEach((chip, index) => {
          chip.style.display = index < visibleCount ? "" : "none";
        });
      }

      function toggleItem(itemEl) {
        const label = getItemLabel(itemEl);
        const isSelected = itemEl.classList.toggle("is-selected");

        if (isSelected) {
          if (!findChipByLabel(label)) {
            chipsHost.appendChild(createChip(label, itemEl));
          }
        } else {
          const chip = findChipByLabel(label);
          if (chip) chip.remove();
        }
        renderChips();
      }

      multi.querySelectorAll("[data-report-item]").forEach((item) => {
        item.onclick = (e) => {
          e.stopPropagation();
          toggleItem(item);
        };
      });

      const initialSelectedItems = Array.from(multi.querySelectorAll("[data-report-item].is-selected"));
      chipsHost.querySelectorAll(".farm-report__chip").forEach((chip) => chip.remove());
      initialSelectedItems.forEach((item) => {
        chipsHost.appendChild(createChip(getItemLabel(item), item));
      });

      multi._renderChips = renderChips;
      renderChips();
      searchInput?.addEventListener("focus", renderChips);
      searchInput?.addEventListener("blur", renderChips);

      multi.addEventListener("click", (e) => {
        if (e.target.closest("[data-report-select-all]") || e.target.closest("[data-report-remove-all]")) return;
        const isOpen = dropdown.classList.contains("is-open");
        root.querySelectorAll("[data-report-dropdown]").forEach(d => d.classList.remove("is-open"));
        if (!isOpen) openDropdown();
        searchInput?.focus();
      });

      const handleMultiOutsideClick = (e) => {
        if (!multi.contains(e.target)) closeDropdown();
      };
      document.addEventListener("click", handleMultiOutsideClick);
      reportUICleanupFns.push(() => document.removeEventListener("click", handleMultiOutsideClick));

      if (searchInput) {
        searchInput.addEventListener("input", () => {
          const q = searchInput.value.toLowerCase();
          multi.querySelectorAll("[data-report-item]").forEach(item => {
            const txt = item.textContent.toLowerCase();
            item.style.display = txt.includes(q) ? "" : "none";
          });
        });
        searchInput.addEventListener("click", (e) => e.stopPropagation());
      }

      if (selectAllBtn) {
        selectAllBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          multi.querySelectorAll("[data-report-item]").forEach(item => {
            if (!item.classList.contains("is-selected")) {
              toggleItem(item);
            }
          });
        });
      }

      if (removeAllBtn) {
        removeAllBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          multi.querySelectorAll("[data-report-item].is-selected").forEach(item => {
            toggleItem(item);
          });
        });
      }
    });

    const allMultis = root.querySelectorAll("[data-report-multi]");
    const handleMultisResize = () => {
      allMultis.forEach(m => {
        const rc = m._renderChips;
        if (rc) rc();
      });
    };
    window.addEventListener("resize", handleMultisResize, { passive: true });
    reportUICleanupFns.push(() => window.removeEventListener("resize", handleMultisResize));

    const headRow = root.querySelector("[data-report-head-row]");
    const bodyRow = root.querySelector("[data-report-body]");
    if (headRow && bodyRow) {
      const syncHead = () => {
        headRow.scrollLeft = bodyRow.scrollLeft;
      };
      bodyRow.addEventListener("scroll", syncHead, { passive: true });
      reportUICleanupFns.push(() => bodyRow.removeEventListener("scroll", syncHead));
      syncHead();
    }

    const accumPivots = root.querySelectorAll(".farm-report__pivot--accum");
    accumPivots.forEach((accumPivot) => {
      const canvas = accumPivot.querySelector("canvas");
      const outline = parseOutline(accumPivot.dataset.accOutline);
      const ringCount = Number(accumPivot.dataset.accRings) || 3;
      if (canvas) {
        requestAnimationFrame(() => {
          drawPivotAccum(canvas, { outline, ringCount });
        });
      }
    });

    function renderIrrigationDetailRow(detailRow) {
      const rowsData = IRRIGATION_DETAIL_DATA[detailRow.id];
      if (!rowsData) return;
      const tbodyHtml = rowsData.map((cols) => {
        const [date, tipo, angStart, angEnd, laminaConfig, volume, laminaRel, custo] = cols;
        return `<tr>
          <td class="js-detail-date">${date}</td>
          <td>${tipo}</td>
          <td>${angStart}</td>
          <td>${angEnd}</td>
          <td>${laminaConfig}</td>
          <td>${volume}</td>
          <td>${laminaRel}</td>
          <td>${custo}</td>
        </tr>`;
      }).join("");
      detailRow.querySelector("td").innerHTML = `
        <div class="irrigation-detail-wrap">
          <table class="irrigation-detail-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Ângulo de Início (°)</th>
                <th>Ângulo de Fim (°)</th>
                <th>Lâmina Configurada (mm)</th>
                <th>Volume Aplicado (m³)</th>
                <th>Lâmina Relativa (mm)</th>
                <th>Custo ($)</th>
              </tr>
            </thead>
            <tbody>${tbodyHtml}</tbody>
          </table>
        </div>`;
      detailRow.dataset.rendered = "true";
    }

    // Relatório de Carretéis: tabela, indicadores e linhas de operação saem de
    // CARRETEL_REPORT_DETAIL + CARRETEL_EQUIPMENT para o período selecionado, então
    // resumo, cards e detalhe sempre batem entre si.
    //   comprimento recolhido (m) = horas x velocidade efetiva (média harmônica das zonas)
    //   volume (m³)             = vazão (m³/h) x horas
    //   lâmina configurada (mm) = vazão / (velocidade configurada x largura) x 1000
    //   área irrigada (ha)      = comprimento recolhido x largura / 10.000
    //   lâmina relativa (mm)    = volume / área / 10
    // Parada inesperada = operação que não terminou em "Concluído".
    const carretelBody = root.querySelector("[data-carretel-body]");
    const carretelExpanded = new Set();
    const carretelNf = (v, d = 2) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
    const carretelHHMM = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

    function carretelCalcOp(op, equip) {
      const hours = op.durMin / 60;
      const effSpeed = op.speeds.length / op.speeds.reduce((sum, s) => sum + 1 / s, 0);
      const retracted = hours * effSpeed;
      const volume = equip.flow * hours;
      const area = (retracted * equip.width) / 10000;
      return {
        hours,
        retracted,
        volume,
        area,
        relDepth: area > 0 ? volume / area / 10 : 0,
        cfgDepths: op.speeds.map((s) => (equip.flow / (s * equip.width)) * 1000)
      };
    }

    function renderCarretelReport(range) {
      if (!carretelBody) return;
      const stored = window.__icRelatoriosPeriod;
      const end = range?.end || dateFromISO(stored?.end) || new Date();
      const start = range?.start || dateFromISO(stored?.start) || end;
      const days = Math.max(1, daysBetweenInclusive(start, end));
      const total = { ops: 0, stops: 0, area: 0, hours: 0, volume: 0 };
      let html = "";
      Object.keys(CARRETEL_EQUIPMENT).forEach((id, i) => {
        const equip = CARRETEL_EQUIPMENT[id];
        // +2 dias: operações de até ~48 h ainda terminam dentro do período.
        const ops = (CARRETEL_REPORT_DETAIL[id] || []).filter((op) => op.dayOffset + 2 <= days - 1);
        const calcs = ops.map((op) => carretelCalcOp(op, equip));
        const sum = (key) => calcs.reduce((n, c) => n + c[key], 0);
        const hours = sum("hours");
        const stops = ops.filter((op) => op.reason !== "Concluído").length;
        total.ops += ops.length;
        total.stops += stops;
        total.area += sum("area");
        total.hours += hours;
        total.volume += sum("volume");
        const detailRows = ops.map((op, k) => {
          const c = calcs[k];
          const day = addDays(end, -(op.dayOffset + 2));
          const endMin = op.startMin + op.durMin;
          return `<tr>
            <td>${formatDateBR(day)} ${carretelHHMM(op.startMin)}</td>
            <td>${formatDateBR(addDays(day, Math.floor(endMin / 1440)))} ${carretelHHMM(endMin)}</td>
            <td>${op.reason}</td>
            <td>${op.mode}</td>
            <td>${formatDurationHHMM(op.durMin)}</td>
            <td>${carretelNf(c.retracted)}</td>
            <td>${carretelNf(c.volume)}</td>
            <td>${carretelNf(c.area)}</td>
            <td>${carretelNf(c.relDepth)}</td>
          </tr>`;
        }).join("");
        const detailBody = ops.length
          ? `<table class="irrigation-detail-table">
              <thead>
                <tr>
                  <th>Data de início</th>
                  <th>Data de fim</th>
                  <th>Motivo da parada</th>
                  <th>Modo</th>
                  <th>Duração</th>
                  <th>Comprimento recolhido (m)</th>
                  <th>Volume aplicado (m³)</th>
                  <th>Área irrigada (ha)</th>
                  <th>Lâmina relativa de irrigação (mm)</th>
                </tr>
              </thead>
              <tbody>${detailRows}</tbody>
            </table>`
          : `<div style="padding: 12px 16px; color: #64748b;">Sem operações no período</div>`;
        const expanded = carretelExpanded.has(id);
        html += `
          <tr class="${i % 2 === 0 ? "is-even" : ""}">
            <td class="text-left">
              <button class="expand-btn irrigation-toggle-btn" type="button" aria-label="Expandir detalhes de ${equip.name}" aria-expanded="${expanded}" data-carretel-report-toggle data-target="#${id}"><i class="fa-solid ${expanded ? "fa-minus" : "fa-plus"}"></i></button>
              ${equip.name}
            </td>
            <td class="text-left">${equip.model}</td>
            <td>${ops.length}</td>
            <td>${stops}</td>
            <td>${carretelNf((hours / (days * 24)) * 100, 1)}%</td>
            <td>${carretelNf(hours)}</td>
            <td>${carretelNf(sum("retracted"))}</td>
            <td>${carretelNf(sum("volume"))}</td>
            <td>${carretelNf(sum("area"))}</td>
            <td>${carretelNf(sum("relDepth"))}</td>
          </tr>
          <tr class="irrigation-detail-row" id="${id}"${expanded ? "" : " hidden"}><td colspan="10"><div class="irrigation-detail-wrap">${detailBody}</div></td></tr>`;
      });
      carretelBody.innerHTML = html;

      const setStat = (key, text, unit) => {
        const el = root.querySelector(`[data-carretel-derived="${key}"]`);
        if (el) el.innerHTML = unit ? `${text} <span class="unit">${unit}</span>` : text;
      };
      setStat("operations", String(total.ops));
      setStat("area", carretelNf(total.area), "ha");
      setStat("volume", carretelNf(total.volume), "m³");
      setStat("depth", carretelNf(total.area > 0 ? total.volume / total.area / 10 : 0), "mm");
      setStat("hours", carretelNf(total.hours), "h");
      setStat("stops", String(total.stops));
    }

    // Na demo o relatório de carretéis é montado por relatorios/demo-data.js
    if (carretelBody && !window.IcReportDemo) {
      carretelBody.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-carretel-report-toggle]");
        if (!btn) return;
        const detailRow = root.querySelector(btn.getAttribute("data-target"));
        if (!detailRow) return;
        const willExpand = detailRow.hasAttribute("hidden");
        detailRow.toggleAttribute("hidden", !willExpand);
        if (willExpand) carretelExpanded.add(detailRow.id); else carretelExpanded.delete(detailRow.id);
        btn.setAttribute("aria-expanded", String(willExpand));
        const icon = btn.querySelector("i");
        if (icon) {
          icon.classList.toggle("fa-plus", !willExpand);
          icon.classList.toggle("fa-minus", willExpand);
        }
      });
      const handleCarretelRange = (event) => renderCarretelReport(event.detail);
      root.addEventListener("ic-report-range", handleCarretelRange);
      reportUICleanupFns.push(() => root.removeEventListener("ic-report-range", handleCarretelRange));
      renderCarretelReport();
    }

    const irrigationToggles = root.querySelectorAll("[data-irrigation-toggle]");
    irrigationToggles.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetSel = btn.getAttribute("data-target");
        if (!targetSel) return;
        const detailRow = root.querySelector(targetSel);
        if (!detailRow) return;

        const willExpand = detailRow.hasAttribute("hidden");
        if (willExpand && detailRow.dataset.rendered !== "true") {
          renderIrrigationDetailRow(detailRow);
        }
        detailRow.toggleAttribute("hidden", !willExpand);
        btn.setAttribute("aria-expanded", String(willExpand));
        const icon = btn.querySelector("i");
        if (icon) {
          icon.classList.toggle("fa-plus", !willExpand);
          icon.classList.toggle("fa-minus", willExpand);
        }
      });
    });

    if (!document.documentElement.dataset.reportArrowScroll) {
      document.documentElement.dataset.reportArrowScroll = "true";
      const scrollState = { dir: 0, raf: 0 };

      const stepScroll = () => {
        if (!scrollState.dir) {
          scrollState.raf = 0;
          return;
        }

        if (!document.body.classList.contains("is-relatorios")) {
          scrollState.dir = 0;
          scrollState.raf = 0;
          return;
        }

        const timelineWrap = document.querySelector(".farm-report__timeline-wrap");
        if (!timelineWrap || timelineWrap.scrollWidth <= timelineWrap.clientWidth) {
          scrollState.dir = 0;
          scrollState.raf = 0;
          return;
        }

        const speed = Math.max(1, Math.round(timelineWrap.clientWidth * 0.004));
        timelineWrap.scrollLeft += scrollState.dir * speed;
        scrollState.raf = requestAnimationFrame(stepScroll);
      };

      document.addEventListener("keydown", (event) => {
        if (!document.body.classList.contains("is-relatorios")) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
          return;
        }

        const timelineWrap = document.querySelector(".farm-report__timeline-wrap");
        if (!timelineWrap || timelineWrap.scrollWidth <= timelineWrap.clientWidth) return;

        event.preventDefault();
        const dir = event.key === "ArrowRight" ? 1 : -1;
        if (!event.repeat && scrollState.dir !== dir) {
          const jump = Math.max(20, Math.round(timelineWrap.clientWidth * 0.04));
          timelineWrap.scrollLeft += dir * jump;
        }

        scrollState.dir = dir;
        if (!scrollState.raf) scrollState.raf = requestAnimationFrame(stepScroll);
      });

      document.addEventListener("keyup", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        scrollState.dir = 0;
      });

      window.addEventListener("blur", () => {
        scrollState.dir = 0;
      });
    }

    // Garante que a rolagem vertical do mouse sobre as tabelas de irrigação
    // sempre mova a página (.main), independente de qualquer overflow
    // interno que o navegador esteja usando como scroll container.
    const scrollableMain = root.closest(".main") || document.querySelector(".main");
    root.querySelectorAll(".irrigation-report__table-wrap").forEach((wrap) => {
      if (wrap.dataset.wheelFixBound === "true") return;
      wrap.dataset.wheelFixBound = "true";
      wrap.addEventListener("wheel", (event) => {
        if (!scrollableMain || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        event.preventDefault();
        scrollableMain.scrollTop += event.deltaY;
      }, { passive: false });
    });
  }
})();


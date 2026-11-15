// Conteudo da missao: EVAs, paradas cientificas, parametros de seguranca e dados ambientais.
// Posicoes das paradas vem das coordenadas REAIS do Curiosity no sol indicado (js/data-nasa.js).

window.MISSION = {
  name: 'ARES-GALE · Expedição Monte Sharp',
  site: 'Cratera Gale · Aeolis Mons (Monte Sharp) · ~4,8°S 137,4°E',

  // Criterios do projeto para caminhada com traje (conservadores, ajustaveis)
  slope: { ok: 10, caution: 15 }, // graus: <10 verde, 10-15 amarelo, >15 vermelho
  suit: {
    flatSpeedKmh: 2.0,      // velocidade de caminhada com traje em terreno plano (estimativa de projeto)
    plssHours: 8,           // autonomia do sistema de suporte de vida portatil
    reserveHours: 1.5,      // reserva minima ao fim da EVA
  },

  // Radiacao - Curiosity RAD
  radiation: {
    gcrDoseEqPerSol: 0.64,  // mSv/sol na superficie (Hassler et al., Science 2014, RAD)
    gcrAbsorbedPerSol: 0.21,// mGy/sol (mesma fonte)
    sep2024: {              // evento solar de 20/mai/2024 medido pelo RAD em Gale (NASA, jun/2024)
      date: '20 mai 2024',
      absorbed_mGy: 8.1,
      note: 'Maior evento de partículas solares medido pelo RAD desde o pouso; equivalente a ~30 raios-X de tórax.'
    },
    careerLimit_mSv: 600,   // limite de carreira NASA-STD-3001
    roverShield: 0.5,       // fracao da dose dentro do rover pressurizado (ESTIMATIVA do projeto)
  },

  // Modelo diurno didatico calibrado por faixas publicadas do REMS em Gale
  weather: {
    sunrise: 6.0, sunset: 18.0,           // hora solar local media (LMST)
    airMin: -75, airMax: -10,             // °C
    groundMin: -85, groundMax: 8,         // °C
    pressurePa: 750,                       // Pa (varia ~700-900 Pa com a estacao)
    windDay: [2, 9],                       // m/s
  },

  evas: [
    {
      id: 'EVA-1',
      title: 'Canal Gediz Vallis',
      objective: 'Investigar os depósitos de detritos do canal e o campo de enxofre elementar descoberto em 2024.',
      start: 9.5, // LMST
      stops: [
        { sol: 4102, name: 'Desembarque · boca do canal', type: 'base', dwell: 20,
          science: 'Checagem de trajes e rádio. Panorâmica de referência e calibração das ferramentas.',
          hazards: ['Saída do rover: degrau e poeira na escotilha.'],
          tasks: ['Teste de comunicação EV1/EV2/rover', 'Panorâmica de 360°'] },
        { sol: 4144, name: 'Leque de detritos do Gediz Vallis', type: 'science', dwell: 60,
          science: 'O canal Gediz Vallis foi escavado no Monte Sharp e preenchido por blocos trazidos por fluxos de água e detritos — um dos episódios úmidos mais jovens registrados em Gale.',
          hazards: ['Blocos soltos e chão irregular: risco de torção.', 'Inclinações locais acima de 15°.'],
          tasks: ['Medir tamanho e arredondamento de 30 blocos', 'Coletar 3 litologias distintas', 'Fotografar a estratificação dos depósitos'] },
        { sol: 4200, name: 'Campo de enxofre elementar', type: 'science', dwell: 75,
          science: 'Em 30/mai/2024 (sol 4200) o Curiosity passou sobre uma rocha que se partiu e revelou cristais amarelos de enxofre puro — a primeira detecção de enxofre elementar em Marte.',
          hazards: ['Rochas frágeis: não pisar nos blocos claros.', 'Poeira fina adere ao traje e às juntas.'],
          tasks: ['Mapear a extensão do campo', 'Amostra em contêiner selado', 'Verificar se há enxofre em rocha in situ'] },
        { sol: 4253, name: 'Parede sul · mirante estratigráfico', type: 'science', dwell: 45,
          science: 'Contato entre os depósitos do canal e a unidade de sulfatos subjacente: registra a passagem de um Marte mais úmido para um mais seco.',
          hazards: ['Trecho mais íngreme da EVA: o rover mediu inclinação de até ~18°.', 'Usar bastão e passo curto.'],
          tasks: ['Perfil estratigráfico fotográfico', 'Medida de orientação das camadas'] },
        { sol: 4321, name: 'Recolhimento · rover pressurizado', type: 'base', dwell: 15,
          science: 'Fim da EVA-1. Amostras no compartimento externo do rover.',
          hazards: ['Remover poeira do traje antes da acoplagem.'],
          tasks: ['Inventário de amostras', 'Relatório de voz'] },
      ]
    },
    {
      id: 'EVA-2',
      title: 'Rede de boxwork',
      objective: 'Estudar as cristas de boxwork — minerais depositados por água subterrânea em fraturas e expostos pela erosão.',
      start: 9.5,
      stops: [
        { sol: 4537, name: 'Desembarque · unidade de sulfatos', type: 'base', dwell: 20,
          science: 'Transição para a área de boxwork. Checagem de trajes e calibração.',
          hazards: ['Areia solta próxima ao rover.'],
          tasks: ['Teste de comunicação', 'Panorâmica de referência'] },
        { sol: 4580, name: 'Borda da rede de boxwork', type: 'science', dwell: 60,
          science: 'Da órbita, o boxwork aparece como uma malha de cristas que se estende por quilômetros. Indica que a água subterrânea persistiu aqui quando a superfície já secava.',
          hazards: ['Cristas estreitas: só andar no topo onde a largura for > 1 m.'],
          tasks: ['Medir altura e largura de 10 cristas', 'Amostrar crista e depressão para comparar a química'] },
        { sol: 4609, name: 'Cristas centrais', type: 'science', dwell: 60,
          science: 'Núcleo da malha de boxwork: os minerais que cimentaram as fraturas guardam a química da água subterrânea antiga — um alvo prioritário de habitabilidade.',
          hazards: ['Inclinação ~13° no acesso.', 'Bordas de crista podem ceder.'],
          tasks: ['Amostra do veio central', 'Imagens de microtextura (lupa de mão)'] },
        { sol: 4641, name: 'Depressão entre cristas', type: 'science', dwell: 45,
          science: 'Material mais fino acumulado entre as cristas: compara a erosão com os veios resistentes.',
          hazards: ['Areia acumulada: risco de afundar o pé.', 'Inclinação ~13°.'],
          tasks: ['Trincheira rasa de 10 cm', 'Amostra de regolito'] },
        { sol: 4687, name: 'Recolhimento · rover pressurizado', type: 'base', dwell: 15,
          science: 'Fim da EVA-2.',
          hazards: ['Remover poeira do traje antes da acoplagem.'],
          tasks: ['Inventário de amostras', 'Relatório de voz'] },
      ]
    }
  ],

  // Zonas cientificas aproximadas, derivadas das posicoes do rover nesses intervalos de sol
  zones: [
    { name: 'Canal Gediz Vallis', sols: [4100, 4330], color: '#e0a040' },
    { name: 'Unidade de sulfatos', sols: [4330, 4560], color: '#c9c27a' },
    { name: 'Região de boxwork', sols: [4560, 4720], color: '#7fc6d9' },
  ],

  sources: [
    ['Imagem HiRISE (MRO) · mosaico do local do Curiosity', 'NASA/JPL/UArizona via Mars Trek'],
    ['Imagem CTX (MRO) · mosaico de Gale', 'NASA/JPL/MSSS via Mars Trek'],
    ['DEM HiRISE 1 m de Gale', 'NASA/JPL/UArizona/USGS via Mars Trek'],
    ['MOLA + HRSC · relevo sombreado', 'NASA/GSFC · ESA/DLR/FU Berlin via Mars Trek'],
    ['THEMIS IR noturno 100 m (Mars Odyssey)', 'NASA/JPL/ASU via Mars Trek'],
    ['Trajeto e posições do Curiosity (MMGIS)', 'NASA/JPL-Caltech'],
    ['Fotos Navcam (Curiosity, imagens brutas)', 'NASA/JPL-Caltech'],
    ['Radiação: RAD (Hassler et al. 2014; evento SEP mai/2024)', 'NASA/JPL-Caltech/SwRI'],
    ['Clima: modelo diurno calibrado por faixas do REMS', 'NASA/JPL-Caltech/CAB'],
  ]
};

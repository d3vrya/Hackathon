// Gera js/data-places.js a partir da nomenclatura IAU do catálogo do Mars Trek (data/trek_nomenclature.json)
// Fonte: https://trek.nasa.gov/mars/TrekServices/ws/index/eq/searchItems (itemType nomenclature)
const fs = require('fs');
const PT = { 'Crater, craters': 'Cratera', 'Mons, montes': 'Monte', 'Vallis, valles': 'Vale', 'Planitia, planitiae': 'Planície',
  'Planum, plana': 'Planalto', 'Palus, paludes': 'Planície baixa', 'Chasma, chasmata': 'Cânion', 'Fossa, fossae': 'Fossa',
  'Mensa, mensae': 'Mesa', 'Collis, colles': 'Colinas', 'Terra, terrae': 'Terra', 'Dorsum, dorsa': 'Cordilheira',
  'Patera, paterae': 'Cratera vulcânica', 'Tholus, tholi': 'Domo', 'Labyrinthus, labyrinthi': 'Labirinto', 'Chaos, chaoses': 'Terreno caótico',
  'Serpens, serpentes': 'Serpente (crista sinuosa)', 'Albedo Feature': 'Feição de albedo', 'Landing site name': 'Local de pouso' };
const d = JSON.parse(fs.readFileSync('data/trek_nomenclature.json'));
const out = d.map(p => [p.name, PT[p.type] || p.type, Math.round(p.lon * 1e4) / 1e4, Math.round(p.lat * 1e4) / 1e4]);
fs.writeFileSync('js/data-places.js', `// GERADO por tools/build-places.js · Nomenclatura planetária IAU/USGS via NASA Mars Trek\n// [nome, tipo, lon, lat]\nwindow.PLACES = ${JSON.stringify(out)};\n`);
console.log('places', out.length);

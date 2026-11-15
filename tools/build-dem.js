// Converte data/dem_gale_4m.f32 em js/data-dem.js (Int16 base64, decímetros acima de -4100 m)
// Uso (na raiz do projeto): node tools/build-dem.js
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('data/dem_gale_4m.json'));
const b = fs.readFileSync('data/dem_gale_4m.f32');
const g = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
const OFF = -4100, q = new Int16Array(g.length);
for (let i = 0; i < g.length; i++) q[i] = g[i] < -30000 ? -32768 : Math.round((g[i] - OFF) * 10);
const out = `// GERADO por tools/build-dem.js a partir do DEM HiRISE de Gale (USGS Astrogeology / equipe MSL).
// Fonte: https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif.ovr (nível 4 m)
// Valores: Int16 em decímetros, elevação = valor/10 + ${OFF} m. Sem dado = -32768.
window.DEM = ${JSON.stringify({ ...m, offset: OFF, scale: 0.1 })};
window.DEM.b64 = "${Buffer.from(q.buffer).toString('base64')}";
`;
fs.writeFileSync('js/data-dem.js', out);
console.log('js/data-dem.js', (out.length / 1e6).toFixed(2), 'MB');

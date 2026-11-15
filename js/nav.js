// Navegação estilo Google Maps: busca de lugares, rotas A→B, passo a passo e "Street View" marciano.
(() => {
'use strict';
const A = window.ARES; if (!A) return;
const { M, N, app, map, DEMG, ROVER, dist, bearing, fmtD, fmtT, fmtDur, num, esc, slopeClass, solDate, fmtDate, inDem, COLORS } = A;
const $ = id => document.getElementById(id);
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CARD = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
const cardinal = b => CARD[Math.round(((b % 360) + 360) % 360 / 45) % 8];
const angDiff = (a, b) => ((a - b + 540) % 360) - 180; // com sinal: >0 = à direita
const nearestSol = sol => { let best = 0, bd = Infinity; ROVER.forEach((p, i) => { const d = Math.abs(p.sol - sol); if (d < bd) { bd = d; best = i; } }); return best; };
const nearestStop = c => { let best = 0, bd = Infinity; ROVER.forEach((p, i) => { const d = dist(p.c, c); if (d < bd) { bd = d; best = i; } }); return { idx: best, d: bd }; };

// ======================================================================
// Camada própria: pino, origem/destino, prévias de rota, posição do Street View
// ======================================================================
const src = new ol.source.Vector();
const pinStyle = (color, label) => new ol.style.Style({
  image: new ol.style.Circle({ radius: 9, fill: new ol.style.Fill({ color }), stroke: new ol.style.Stroke({ color: '#fff', width: 3 }) }),
  text: label ? new ol.style.Text({ text: label, offsetY: -20, font: '600 12px Segoe UI, sans-serif', fill: new ol.style.Fill({ color: '#fff' }), stroke: new ol.style.Stroke({ color: '#000', width: 3 }) }) : undefined,
});
const navLayer = new ol.layer.Vector({
  source: src, zIndex: 18,
  style: f => {
    const k = f.get('kind');
    if (k === 'pin') return pinStyle('#ff4d5e', f.get('label'));
    if (k === 'from') return pinStyle('#5ab0ff', 'A');
    if (k === 'to') return pinStyle('#ff4d5e', 'B');
    if (k === 'sv') return [new ol.style.Style({ image: new ol.style.Circle({ radius: 14, fill: new ol.style.Fill({ color: 'rgba(255,200,0,.25)' }) }) }), pinStyle('#ffc800')];
    if (k === 'alt') return new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(160,170,180,.85)', width: 5 }) });
    if (k === 'altsel') return [new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,.75)', width: 8 }) }), new ol.style.Style({ stroke: new ol.style.Stroke({ color: COLORS[f.get('cls')], width: 5 }) })];
    return null;
  },
});
map.addLayer(navLayer);
const setPoint = (kind, c, label) => {
  src.getFeatures().filter(f => f.get('kind') === kind).forEach(f => src.removeFeature(f));
  if (c) src.addFeature(new ol.Feature({ kind, label, geometry: new ol.geom.Point(c) }));
};
const clearKinds = kinds => src.getFeatures().filter(f => kinds.includes(f.get('kind'))).forEach(f => src.removeFeature(f));

// ======================================================================
// Índice de busca
// ======================================================================
const PLACES = [];
M.evas.forEach(e => e.stops.forEach((s, k) => {
  const p = ROVER[nearestSol(s.sol)];
  PLACES.push({ name: s.name, type: `Parada ${e.id} · ${e.title}`, c: p.c, icon: s.type === 'base' ? '■' : '●', sol: s.sol, desc: s.science, eva: e, k, mission: true });
}));
M.zones.forEach(z => {
  const ps = ROVER.filter(p => p.sol >= z.sols[0] && p.sol <= z.sols[1]); if (!ps.length) return;
  const c = [ps.reduce((s, p) => s + p.lon, 0) / ps.length, ps.reduce((s, p) => s + p.lat, 0) / ps.length];
  PLACES.push({ name: z.name, type: 'Zona científica (aprox.)', c, icon: '▧', mission: true });
});
(window.PLACES || []).forEach(([n, t, lon, lat]) => PLACES.push({ name: n, type: `${t} · nomenclatura IAU`, c: [lon, lat], icon: '◇' }));
PLACES.forEach(p => { p.key = norm(p.name); });

function search(q) {
  q = q.trim(); if (!q) return [];
  const out = [];
  // coordenadas: "-4.78 137.40", "4.78S 137.40E", "-4,78; 137,40"
  const m = q.replace(/,(?=\d)/g, '.').match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NSns])?[\s,;]+(-?\d+(?:\.\d+)?)\s*°?\s*([EeWwLlOo])?$/);
  if (m) {
    let lat = +m[1], lon = +m[3];
    if (/[sS]/.test(m[2] || '')) lat = -Math.abs(lat);
    if (/[wWoO]/.test(m[4] || '')) lon = -Math.abs(lon);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 360) out.push({ name: `${num(Math.abs(lat), 5)}°${lat < 0 ? 'S' : 'N'} ${num(lon, 5)}°E`, type: 'Coordenada', c: [lon > 180 ? lon - 360 : lon, lat], icon: '⌖' });
  }
  // sol do Curiosity
  const s = q.match(/^sol\s*(\d+)$/i) || q.match(/^(\d{1,4})$/);
  if (s) {
    const sol = +s[1], i = nearestSol(sol), p = ROVER[i];
    out.push({ name: `Curiosity no sol ${p.sol}`, type: `${fmtDate(solDate(p.sol))} · ${num(p.km, 2)} km percorridos`, c: p.c, icon: '▶', sol: p.sol, roverIdx: i });
  }
  const nq = norm(q), words = nq.split(/\s+/);
  const scored = [];
  for (const p of PLACES) {
    if (!words.every(w => p.key.includes(w))) continue;
    let sc = p.key.startsWith(nq) ? 0 : p.key.split(/\s+/).some(w => w.startsWith(words[0])) ? 1 : 2;
    if (p.mission) sc -= 0.5;
    scored.push([sc, p]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));
  return out.concat(scored.slice(0, 8 - out.length).map(x => x[1]));
}

function attachSearch(input, list, onPick) {
  let items = [], sel = -1;
  const render = () => {
    list.hidden = !items.length;
    list.innerHTML = items.map((p, i) => `<li data-i="${i}" class="${i === sel ? 'sel' : ''}"><span class="ri">${p.icon}</span><span>${esc(p.name)}</span><span class="rt">${esc(p.type)}</span></li>`).join('');
  };
  input.addEventListener('input', () => { items = search(input.value); sel = items.length ? 0 : -1; render(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && items[sel]) { const p = items[sel]; items = []; render(); onPick(p); }
    else if (e.key === 'Escape') { items = []; render(); }
  });
  list.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (!li) return; e.preventDefault(); const p = items[+li.dataset.i]; items = []; render(); onPick(p); });
  input.addEventListener('blur', () => setTimeout(() => { items = []; render(); }, 150));
}

// ======================================================================
// Cartão de lugar
// ======================================================================
let current = null;
function flyTo(c, zoom) { map.getView().animate({ center: c, zoom: zoom ?? Math.max(map.getView().getZoom(), inDem(c) ? 16 : 8), duration: 700 }); }

function showPlace(p, fly = true) {
  current = p;
  $('searchInput').value = p.name;
  setPoint('pin', p.c, null);
  if (fly) flyTo(p.c);
  const el = DEMG && inDem(p.c) ? DEMG.elevAt(p.c) : NaN, sl = DEMG && inDem(p.c) ? DEMG.slopeAt(p.c) : NaN;
  const ns = nearestStop(p.c), svOK = ns.d < 60;
  const ph = p.sol && A.photosFor(p.sol), img = ph && ph.imgs.find(i => i.kind === 'horizonte');
  const fromCrew = app.st ? dist(app.st.c, p.c) : NaN;
  $('placeCard').innerHTML = `
    <button class="icon-btn pc-close" id="pcClose" aria-label="Fechar">✕</button>
    ${img ? `<img class="pc-photo" src="${esc(img.src)}" alt="Navcam no sol ${p.sol}" id="pcPhoto">` : ''}
    <h2>${esc(p.name)}</h2>
    <div class="pc-type">${esc(p.type)}</div>
    <div class="kv">
      <span class="k">Coordenadas</span><span class="v">${num(Math.abs(p.c[1]), 4)}°${p.c[1] < 0 ? 'S' : 'N'} ${num(p.c[0], 4)}°E</span>
      ${isNaN(el) ? '' : `<span class="k">Elevação</span><span class="v">${Math.round(el)} m</span><span class="k">Inclinação</span><span class="v ${slopeClass(sl)}">${num(sl, 0)}°</span>`}
      ${isNaN(fromCrew) ? '' : `<span class="k">Da tripulação</span><span class="v">${fmtD(fromCrew)}</span>`}
      ${svOK ? `<span class="k">Curiosity esteve aqui</span><span class="v">sol ${ROVER[ns.idx].sol}</span>` : ''}
    </div>
    ${p.desc ? `<p class="muted" style="margin:8px 0 0">${esc(p.desc)}</p>` : ''}
    ${!inDem(p.c) ? '<p class="cap" style="margin:8px 0 0">Fora da área do DEM HiRISE: rotas a pé indisponíveis aqui.</p>' : ''}
    <div class="pc-actions">
      ${inDem(p.c) ? '<button class="btn primary" id="pcRoute">◆ Rotas até aqui</button><button class="btn" id="pcFrom">Sair daqui</button>' : ''}
      ${svOK ? '<button class="btn" id="pcSv">📷 Street View</button>' : ''}
      ${p.eva ? '<button class="btn" id="pcStop">Detalhes da parada</button>' : ''}
    </div>`;
  $('placeCard').hidden = false;
  $('pcClose').onclick = closePlace;
  if ($('pcRoute')) $('pcRoute').onclick = () => { openDir(); if (!dir.from && app.st) setEnd('from', crewPlace(), false); setEnd('to', p); };
  if ($('pcFrom')) $('pcFrom').onclick = () => { openDir(); setEnd('from', p); };
  if ($('pcSv')) $('pcSv').onclick = () => openSV(ns.idx);
  if ($('pcPhoto')) $('pcPhoto').onclick = () => openSV(nearestSol(p.sol));
  if ($('pcStop')) $('pcStop').onclick = () => {
    const k = M.evas.indexOf(p.eva);
    if (app.evaIdx !== k) A.loadEva(k);
    A.openStop(p.k);
  };
}
function closePlace() { $('placeCard').hidden = true; setPoint('pin', null); current = null; }
attachSearch($('searchInput'), $('searchResults'), p => showPlace(p));

// ======================================================================
// Rotas A → B
// ======================================================================
const dir = { from: null, to: null, alts: [], sel: 0 };
const crewPlace = () => ({ name: 'Posição da tripulação', c: app.st.c.slice(), icon: '◉', type: 'Agora' });
function openDir() { $('dirBox').hidden = false; $('searchBox').hidden = true; $('placeCard').hidden = true; setPoint('pin', null); }
function closeDir() {
  $('dirBox').hidden = true; $('searchBox').hidden = false;
  dir.from = dir.to = null; dir.alts = []; $('dirFrom').value = $('dirTo').value = ''; $('dirAlts').innerHTML = '';
  clearKinds(['from', 'to', 'alt', 'altsel']);
}
function setEnd(which, p, run = true) {
  dir[which] = p; $(which === 'from' ? 'dirFrom' : 'dirTo').value = p.name;
  setPoint(which, p.c);
  if (run) computeRoutes();
}
attachSearch($('dirFrom'), $('dirResults'), p => setEnd('from', p));
attachSearch($('dirTo'), $('dirResults'), p => setEnd('to', p));
$('dirBtn').onclick = () => { openDir(); if (current) { if (app.st) setEnd('from', crewPlace(), false); setEnd('to', current); } else $('dirFrom').focus(); };
$('dirClose').onclick = closeDir;
$('dirSwap').onclick = () => { const f = dir.from, t = dir.to; dir.from = null; dir.to = null; if (t) setEnd('from', t, false); else { $('dirFrom').value = ''; setPoint('from', null); } if (f) setEnd('to', f, false); else { $('dirTo').value = ''; setPoint('to', null); } computeRoutes(); };
$('dirFromCrew').onclick = () => app.st && setEnd('from', crewPlace());
$('dirFromRover').onclick = () => app.st && setEnd('from', { name: 'Rover pressurizado', c: app.st.roverC.slice(), icon: '■', type: 'Abrigo' });

function customEva(from, to) {
  return {
    id: 'ROTA', title: 'Rota livre', custom: true, start: 9.5,
    objective: `De ${from.name} até ${to.name}, evitando encostas acima do limite.`,
    stops: [
      { name: from.name, type: 'base', dwell: 0, c: from.c, science: 'Ponto de partida da rota livre.', hazards: [], tasks: ['Conferir trajes e rádio'] },
      { name: to.name, type: 'science', dwell: 30, c: to.c, science: to.desc || 'Destino escolhido no mapa.', hazards: [], tasks: ['Observação e coleta no destino'] },
    ],
  };
}
const walkH = p => p.events.filter(e => e.type === 'walk').reduce((s, e) => s + e.t1 - e.t0, 0);

function computeRoutes() {
  const box = $('dirAlts'); dir.alts = []; clearKinds(['alt', 'altsel']);
  if (!dir.from || !dir.to) { box.innerHTML = '<div class="dir-msg">Escolha origem e destino: busque um lugar ou clique no mapa.</div>'; return; }
  if (!inDem(dir.from.c) || !inDem(dir.to.c)) { box.innerHTML = '<div class="dir-msg">Rotas a pé só dentro da área do DEM HiRISE (canal Gediz Vallis e boxwork, ~3 × 4 km). Aproxime o mapa do trajeto do Curiosity.</div>'; return; }
  if (dist(dir.from.c, dir.to.c) < 8) { box.innerHTML = '<div class="dir-msg">Origem e destino estão no mesmo ponto.</div>'; return; }
  box.innerHTML = '<div class="dir-msg">Calculando rotas…</div>';
  setTimeout(() => {
    const opts = [[12, 'Mais segura'], [15, 'Recomendada'], [20, 'Mais rápida']];
    for (const [lim, label] of opts) {
      const eva = customEva(dir.from, dir.to), plan = A.buildPlan(eva, 'safe', lim);
      if (dir.alts.some(a => Math.abs(a.plan.total - plan.total) < plan.total * 0.01 && Math.round(a.plan.maxSlope) === Math.round(plan.maxSlope))) continue;
      dir.alts.push({ lim, label, eva, plan, walk: walkH(plan) });
    }
    const best = Math.min(...dir.alts.map(a => a.walk));
    dir.sel = Math.max(0, dir.alts.findIndex(a => a.lim === 15));
    renderAlts(best);
    const ext = ol.extent.boundingExtent(dir.alts.flatMap(a => a.plan.pts.map(p => p.c)));
    map.getView().fit(ol.extent.buffer(ext, 0.001), { padding: [80, 60, 60, 420], duration: 500 });
  }, 20);
}

function drawAlts() {
  clearKinds(['alt', 'altsel']);
  dir.alts.forEach((a, i) => { if (i !== dir.sel) src.addFeature(new ol.Feature({ kind: 'alt', geometry: new ol.geom.LineString(a.plan.pts.map(p => p.c)) })); });
  const a = dir.alts[dir.sel]; if (!a) return;
  let run = null; const P = a.plan.pts;
  const flush = () => run && src.addFeature(new ol.Feature({ kind: 'altsel', cls: run.cls, geometry: new ol.geom.LineString(run.coords) }));
  for (let i = 1; i < P.length; i++) {
    const cls = P[i].slope <= Math.min(10, a.lim - 2) ? 'ok' : P[i].slope <= a.lim ? 'caution' : 'danger';
    if (run && run.cls === cls) run.coords.push(P[i].c); else { flush(); run = { cls, coords: [P[i - 1].c, P[i].c] }; }
  }
  flush();
}

function renderAlts(best) {
  $('dirAlts').innerHTML = dir.alts.map((a, i) => `
    <div class="alt ${i === dir.sel ? 'sel' : ''}" data-i="${i}">
      <div class="alt-top"><span class="alt-time ${a.walk === best ? 'fast' : ''}">${fmtDur(a.walk)}</span><span>${fmtD(a.plan.total)}</span></div>
      <div class="alt-sub">${a.label} · limite ${a.lim}° · máx. ${Math.round(a.plan.maxSlope)}° · subida ${Math.round(a.plan.climb)} m${a.plan.infeasible.length ? ' · <span style="color:var(--danger)">trecho sem caminho seguro (reta)</span>' : ''}</div>
      ${i === dir.sel ? '<button class="btn primary" data-start="1">▶ Iniciar navegação</button>' : ''}
    </div>`).join('');
  drawAlts();
}
$('dirAlts').addEventListener('click', e => {
  if (e.target.closest('[data-start]')) return startNav();
  const el = e.target.closest('.alt'); if (!el) return;
  dir.sel = +el.dataset.i; renderAlts(Math.min(...dir.alts.map(a => a.walk)));
});

function startNav() {
  const a = dir.alts[dir.sel]; if (!a) return;
  app.custom = a.eva; app.limit = a.lim; app.mode = 'safe';
  closeDir();
  A.setPlaying(false);
  A.loadEva(A.evas().length - 1);
}

// ======================================================================
// Passo a passo
// ======================================================================
let steps = [];
function turnInfo(t) {
  const a = Math.abs(t), side = t > 0 ? 'direita' : 'esquerda';
  if (a < 20) return { icon: '↑', txt: 'Continue em frente' };
  if (a < 60) return { icon: t > 0 ? '↗' : '↖', txt: `Vire levemente à ${side}` };
  if (a < 120) return { icon: t > 0 ? '→' : '←', txt: `Vire à ${side}` };
  if (a < 160) return { icon: t > 0 ? '↘' : '↙', txt: `Vire acentuadamente à ${side}` };
  return { icon: '↶', txt: 'Retorne' };
}
function buildSteps(plan) {
  const P = plan.pts, wpAt = new Map(plan.wps.map(w => [w.idx, w]));
  const groups = []; let g = null;
  for (let i = 1; i < P.length; i++) {
    if (P[i].segLen < 0.5) { if (g) g.i1 = i; continue; }
    const h = bearing(P[i - 1].c, P[i].c);
    if (!g || wpAt.has(g.i1) || Math.abs(angDiff(h, g.lastH)) > 35) { g = { i0: i - 1, i1: i, lastH: h, len: P[i].segLen }; groups.push(g); }
    else { g.i1 = i; g.lastH = h; g.len += P[i].segLen; }
  }
  const merged = [];
  for (const x of groups) { const prev = merged[merged.length - 1]; if (prev && x.len < 15 && !wpAt.has(prev.i1)) { prev.i1 = x.i1; prev.len += x.len; } else merged.push({ ...x }); }
  const out = []; let prevH = null;
  merged.forEach((x, n) => {
    const h = bearing(P[x.i0].c, P[x.i1].c), climb = P[x.i1].elev - P[x.i0].elev;
    let maxS = 0; for (let k = x.i0 + 1; k <= x.i1; k++) if (!P[k].exempt) maxS = Math.max(maxS, P[k].slope);
    // ao sair de uma parada: rumo absoluto; no meio do caminho: curva relativa ao trecho anterior
    const head = prevH == null || wpAt.has(x.i0) ? { icon: '↑', txt: `Saia rumo ${cardinal(h)} (${Math.round(h)}°)` } : turnInfo(angDiff(h, prevH));
    const leave = wpAt.get(x.i0), t0 = leave ? leave.etd : P[x.i0].t;
    const terr = Math.abs(climb) >= 3 ? `${climb > 0 ? 'subida' : 'descida'} de ${Math.round(Math.abs(climb))} m` : 'terreno plano';
    const cls = slopeClass(maxS);
    out.push({ icon: head.icon, text: `${head.txt} e siga ${fmtD(x.len)}${head.txt.startsWith('Saia') ? '' : ` rumo ${cardinal(h)}`}`,
      sub: `${fmtT(t0)} · ${terr} · até <span class="${cls === 'danger' ? 'bad' : cls === 'caution' ? 'warn' : ''}">${Math.round(maxS)}°</span>`,
      short: head.txt, cum0: P[x.i0].cum, cum1: P[x.i1].cum, t0, c: P[x.i0].c, kind: 'walk' });
    prevH = h;
    const w = wpAt.get(x.i1);
    if (w && x.i1 !== 0) out.push({ icon: '⚑', text: `Chegue a ${w.name}`, sub: `${fmtT(w.eta)} · permanência ${w.dwell} min`, short: `Chegada: ${w.name}`, cum0: P[x.i1].cum, cum1: P[x.i1].cum, t0: w.eta, c: P[x.i1].c, kind: 'arrive', wp: w });
  });
  return out;
}
function renderSteps(plan) {
  steps = buildSteps(plan);
  $('stepList').innerHTML = steps.map((s, i) => `<li data-i="${i}"><span class="si ${s.kind === 'arrive' ? 'arr' : ''}">${s.icon}</span><span class="st">${esc(s.text)}</span><span class="sm">${s.sub}</span></li>`).join('');
  lastActive = -1;
}
let lastActive = -1;
function activeStep(st) {
  if (st.atWp) return steps.findIndex(s => s.kind === 'arrive' && s.wp === st.atWp);
  let i = steps.findIndex(s => s.kind === 'walk' && st.cum >= s.cum0 - 0.01 && st.cum < s.cum1);
  if (i < 0) i = st.cum <= 0.01 ? 0 : steps.length - 1;
  return i;
}
$('stepList').addEventListener('click', e => {
  const li = e.target.closest('li'); if (!li) return;
  const s = steps[+li.dataset.i]; app.t = s.t0 + 1e-4; A.update();
  map.getView().animate({ center: s.c, duration: 400 });
});

A.app.hooks.plan.push(renderSteps);
A.app.hooks.update.push(st => {
  const i = activeStep(st);
  if (i !== lastActive) {
    lastActive = i;
    document.querySelectorAll('#stepList li').forEach((li, k) => { li.classList.toggle('active', k === i); li.classList.toggle('done', k < i); });
    const li = document.querySelector(`#stepList li[data-i="${i}"]`); if (li) li.scrollIntoView({ block: 'nearest' });
  }
  // faixa de manobra no HUD
  if (app.hud) {
    const s = steps[i], next = steps[i + 1];
    $('hudStep').innerHTML = !s ? '' : s.kind === 'arrive'
      ? `<span class="hs-i">⚑</span><div><div class="hs-d">Em parada</div><div class="hs-t">${esc(s.wp.name)}</div></div>`
      : next ? `<span class="hs-i">${next.icon}</span><div><div class="hs-d">${fmtD(Math.max(0, s.cum1 - st.cum))}</div><div class="hs-t">${esc(next.short)}</div></div>`
        : `<span class="hs-i">⚑</span><div><div class="hs-d">${fmtD(Math.max(0, s.cum1 - st.cum))}</div><div class="hs-t">Destino</div></div>`;
  }
});
if (app.plan) { renderSteps(app.plan); A.update(); }

// ======================================================================
// "Street View" marciano: fotos Navcam do Curiosity em qualquer parada do trajeto
// ======================================================================
let svMode = false;
const travStyle = A.V.traverse.getStyle();
const svStyle = [new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,.6)', width: 7 }) }), new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#4aa3ff', width: 4 }) })];
$('svBtn').onclick = () => {
  svMode = !svMode; $('svBtn').setAttribute('aria-pressed', String(svMode));
  A.V.traverse.setStyle(svMode ? svStyle : travStyle);
  if (svMode) { A.V.traverse.setVisible(true); map.getTargetElement().style.cursor = 'crosshair'; }
  else map.getTargetElement().style.cursor = '';
};

const svCache = new Map();
async function fetchNav(sol) {
  if (svCache.has(sol)) return svCache.get(sol);
  let imgs = [];
  try {
    for (const inst of ['NAV_LEFT_B', 'NAV_LEFT_A']) {
      const url = `https://mars.nasa.gov/api/v1/raw_image_items/?order=date_taken%20asc&per_page=100&page=0&condition_1=msl:mission&condition_2=${sol}:sol:gte&condition_3=${sol}:sol:lte&condition_4=${inst}:instrument`;
      const r = await fetch(url); const j = await r.json();
      imgs = (j.items || []).filter(i => !i.is_thumbnail && (i.extended || {}).sample_type === 'full')
        .map(i => ({ src: i.https_url || i.url, az: Math.round(+i.extended.mast_az), el: Math.round(+i.extended.mast_el), date: i.date_taken, cam: inst.startsWith('NAV') ? 'Navcam esquerda' : inst }));
      if (imgs.length) break;
    }
  } catch (e) { /* sem rede: usa as fotos locais, se houver */ }
  if (!imgs.length) { const ph = A.photosFor(sol); if (ph) imgs = ph.imgs.map(i => ({ src: i.src, az: i.az, el: i.el, date: i.date, cam: 'Navcam esquerda (cópia local)' })); }
  // prioriza fotos do horizonte
  imgs.sort((a, b) => (Math.abs(a.el + 10) > 25) - (Math.abs(b.el + 10) > 25));
  svCache.set(sol, imgs);
  return imgs;
}

const sv = { idx: 0, imgs: [], j: 0, token: 0 };
async function openSV(idx) {
  sv.idx = Math.max(0, Math.min(ROVER.length - 1, idx)); sv.j = 0; const tok = ++sv.token;
  const p = ROVER[sv.idx];
  $('sv').hidden = false; $('svImg').removeAttribute('src'); $('svThumbs').innerHTML = '';
  $('svInfo').innerHTML = `<h2>Curiosity · sol ${p.sol}</h2><span class="cap">Carregando fotos…</span>`;
  setPoint('sv', p.c); drawSvMini();
  const imgs = await fetchNav(p.sol);
  if (tok !== sv.token) return;
  sv.imgs = imgs; showSvImg();
}
function showSvImg() {
  const p = ROVER[sv.idx], im = sv.imgs[sv.j];
  const near = app.st ? dist(app.st.c, p.c) : NaN;
  $('svInfo').innerHTML = `<h2>Curiosity · sol ${p.sol} · ${fmtDate(solDate(p.sol))}</h2>
    <span class="cap">${im ? `${esc(im.cam)} · foto ${sv.j + 1}/${sv.imgs.length} · azimute ${im.az}° (referencial do rover) · elevação ${im.el}°` : 'Sem fotos Navcam neste ponto. Use ◀ ▶ para ir a outra parada.'}</span>
    <span class="cap">Parada ${sv.idx + 1}/${ROVER.length} · ${num(p.km, 2)} km percorridos · elev. ${Math.round(p.elev)} m${isNaN(near) ? '' : ` · ${fmtD(near)} da tripulação`}</span>
    <span class="cap">NASA/JPL-Caltech · imagem bruta</span>`;
  if (im) $('svImg').src = im.src; else $('svImg').removeAttribute('src');
  $('svThumbs').innerHTML = sv.imgs.map((x, k) => `<img src="${esc(x.src)}" data-k="${k}" class="${k === sv.j ? 'sel' : ''}" loading="lazy" alt="Foto ${k + 1}">`).join('');
  const sel = $('svThumbs').querySelector('.sel'); if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function drawSvMini() {
  const c = $('svMini'), g = c.getContext('2d'), S = c.width, half = S / 2, range = 300, p = ROVER[sv.idx];
  const toPx = q => [half + (q[0] - p.c[0]) * A.MPU / range * half, half - (q[1] - p.c[1]) * A.MPU / range * half];
  g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(half, half, half - 1, 0, 7); g.clip();
  g.strokeStyle = '#4aa3ff'; g.lineWidth = 3; g.beginPath();
  for (let i = Math.max(0, sv.idx - 40); i < Math.min(ROVER.length, sv.idx + 40); i++) { const q = toPx(ROVER[i].c); i === Math.max(0, sv.idx - 40) ? g.moveTo(...q) : g.lineTo(...q); }
  g.stroke();
  if (app.st) { const q = toPx(app.st.c); g.fillStyle = '#fff'; g.beginPath(); g.arc(q[0], q[1], 4, 0, 7); g.fill(); }
  g.restore();
  g.fillStyle = '#ffc800'; g.beginPath(); g.arc(half, half, 6, 0, 7); g.fill();
  g.fillStyle = '#9aa3ad'; g.font = '10px Consolas, monospace'; g.fillText('N', half - 3, 12); g.fillText('300 m', 8, S - 8);
}
const svStep = d => { sv.j = (sv.j + d + sv.imgs.length) % Math.max(1, sv.imgs.length); showSvImg(); };
$('svPrevImg').onclick = () => svStep(-1);
$('svNextImg').onclick = () => svStep(1);
$('svPrevStop').onclick = () => openSV(sv.idx - 1);
$('svNextStop').onclick = () => openSV(sv.idx + 1);
$('svThumbs').addEventListener('click', e => { const im = e.target.closest('img'); if (im) { sv.j = +im.dataset.k; showSvImg(); } });
const closeSV = () => { $('sv').hidden = true; sv.token++; setPoint('sv', null); map.getView().animate({ center: ROVER[sv.idx].c, duration: 400 }); };
$('svClose').onclick = closeSV;
document.addEventListener('keydown', e => {
  if ($('sv').hidden) return;
  if (e.key === 'Escape') closeSV(); else if (e.key === 'ArrowRight') svStep(1); else if (e.key === 'ArrowLeft') svStep(-1);
  else if (e.key === 'ArrowUp') openSV(sv.idx + 1); else if (e.key === 'ArrowDown') openSV(sv.idx - 1);
});

// ======================================================================
// Cliques no mapa
// ======================================================================
map.on('click', e => {
  if (map.forEachFeatureAtPixel(e.pixel, () => true, { layerFilter: l => l === A.V.marks })) return; // parada da EVA: tratado pelo app
  const c = e.coordinate;
  if (svMode) {
    let best = -1, bd = Infinity;
    ROVER.forEach((p, i) => { const px = map.getPixelFromCoordinate(p.c); const d = Math.hypot(px[0] - e.pixel[0], px[1] - e.pixel[1]); if (d < bd) { bd = d; best = i; } });
    if (best >= 0 && bd < 30) openSV(best);
    return;
  }
  const pt = { name: `${num(Math.abs(c[1]), 5)}°S ${num(c[0], 5)}°E`, type: 'Ponto selecionado no mapa', c: c.slice(), icon: '⌖' };
  if (!$('dirBox').hidden) { if (!dir.from) setEnd('from', pt); else setEnd('to', pt); return; }
  showPlace(pt, false);
});
})();

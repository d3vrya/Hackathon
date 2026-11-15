(() => {
'use strict';
const M = window.MISSION, N = window.NASA;

// ======================================================================
// Utilidades
// ======================================================================
const R_MARS = 3389500;                 // raio médio de Marte (m)
const DEG = Math.PI / 180;
const HOURS_PER_SOL = 24.6597;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function dist(a, b) { // [lon,lat] -> metros na superfície de Marte
  const dLat = (b[1] - a[1]) * DEG, dLon = (b[0] - a[0]) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MARS * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const y = Math.sin((b[0] - a[0]) * DEG) * Math.cos(b[1] * DEG);
  const x = Math.cos(a[1] * DEG) * Math.sin(b[1] * DEG) - Math.sin(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.cos((b[0] - a[0]) * DEG);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}
const fmtT = h => { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 + 1e-6); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
const fmtD = m => m >= 1000 ? (m / 1000).toFixed(2).replace('.', ',') + ' km' : Math.round(m) + ' m';
const fmtDur = h => { const m = Math.max(0, Math.round(h * 60)); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`; };
const num = (x, d = 1) => x.toFixed(d).replace('.', ',');
const slopeClass = d => d < M.slope.ok ? 'ok' : d <= M.slope.caution ? 'caution' : 'danger';
const COLORS = { ok: '#3ecf8e', caution: '#f5c242', danger: '#ff4d5e' };
const solDate = sol => new Date(Date.UTC(2012, 7, 6) + sol * 1.02749125 * 86400000);
const fmtDate = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

// ======================================================================
// Dados do rover -> plano da EVA
// ======================================================================
const ROVER = N.roverStops.map(s => ({ sol: s[0], lon: s[1], lat: s[2], elev: s[3], tilt: s[4], km: s[5], c: [s[1], s[2]] }));

function nearestIdx(pts, sol) {
  let best = 0, bd = Infinity;
  pts.forEach((p, i) => { const d = Math.abs(p.sol - sol) + (p.sol > sol ? 0.25 : 0); if (d < bd) { bd = d; best = i; } });
  return best;
}

// ======================================================================
// DEM HiRISE de Gale (grade de 4 m) -> elevação e inclinação em qualquer ponto
// ======================================================================
const DEMG = (() => {
  const D = window.DEM; if (!D || !D.b64) return null;
  const bytes = Uint8Array.from(atob(D.b64), ch => ch.charCodeAt(0));
  const q = new Int16Array(bytes.buffer);
  const W = D.w, H = D.h, z = new Float32Array(W * H), s = new Float32Array(W * H);
  for (let i = 0; i < q.length; i++) z[i] = q[i] === -32768 ? NaN : q[i] * D.scale + D.offset;
  const cellM = D.d * DEG * R_MARS;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const il = Math.max(0, i - 1), ir = Math.min(W - 1, i + 1), ju = Math.max(0, j - 1), jd = Math.min(H - 1, j + 1);
    const dzdx = (z[j * W + ir] - z[j * W + il]) / ((ir - il) * cellM);
    const dzdy = (z[jd * W + i] - z[ju * W + i]) / ((jd - ju) * cellM);
    s[j * W + i] = Math.atan(Math.hypot(dzdx, dzdy)) / DEG;
  }
  const fx = c => (c[0] - D.lon0) / D.d, fy = c => (D.lat0 - c[1]) / D.d;
  const inside = c => { const x = fx(c), y = fy(c); return x >= 0 && y >= 0 && x <= W - 1 && y <= H - 1; };
  const cellOf = c => [Math.min(W - 1, Math.max(0, Math.round(fx(c)))), Math.min(H - 1, Math.max(0, Math.round(fy(c))))];
  const center = k => { const i = k % W, j = (k - i) / W; return [D.lon0 + i * D.d, D.lat0 - j * D.d]; };
  const elevAt = c => {
    if (!inside(c)) return NaN;
    const x = fx(c), y = fy(c), i = Math.min(W - 2, Math.floor(x)), j = Math.min(H - 2, Math.floor(y)), a = x - i, b = y - j;
    return z[j * W + i] * (1 - a) * (1 - b) + z[j * W + i + 1] * a * (1 - b) + z[(j + 1) * W + i] * (1 - a) * b + z[(j + 1) * W + i + 1] * a * b;
  };
  const slopeAt = c => { if (!inside(c)) return NaN; const [i, j] = cellOf(c); return s[j * W + i]; };
  const extent = [D.lon0 - D.d / 2, D.lat0 - (H - 0.5) * D.d, D.lon0 + (W - 0.5) * D.d, D.lat0 + D.d / 2];
  // percorre todas as células atravessadas pela linha p→q (travessia de grade, Amanatides–Woo)
  const lineCells = (p, q, cb) => {
    const x0 = fx(p) + 0.5, y0 = fy(p) + 0.5, x1 = fx(q) + 0.5, y1 = fy(q) + 0.5;
    let i = Math.floor(x0), j = Math.floor(y0);
    const dx = x1 - x0, dy = y1 - y0, sx = Math.sign(dx), sy = Math.sign(dy);
    const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity;
    let tmx = dx ? (sx > 0 ? i + 1 - x0 : x0 - i) * tdx : Infinity;
    let tmy = dy ? (sy > 0 ? j + 1 - y0 : y0 - j) * tdy : Infinity;
    const visitAt = (a, b) => { if (a >= 0 && b >= 0 && a < W && b < H) cb(a, b); };
    visitAt(i, j);
    while (Math.min(tmx, tmy) <= 1 + 1e-9) {
      if (Math.abs(tmx - tmy) < 1e-6) { // cruza exatamente uma quina: visita as duas células laterais
        visitAt(i + sx, j); visitAt(i, j + sy); i += sx; j += sy; tmx += tdx; tmy += tdy;
      } else if (tmx < tmy) { tmx += tdx; i += sx; } else { tmy += tdy; j += sy; }
      visitAt(i, j);
    }
  };
  return { W, H, z, s, cellM, cellOf, center, elevAt, slopeAt, lineCells, extent, src: D.src };
})();

// ======================================================================
// Planejador A*: menor tempo de caminhada evitando células acima do limite
// ======================================================================
const legCache = new Map();
function planLeg(a, b, limit) {
  const key = `${a}|${b}|${limit}`;
  if (legCache.has(key)) return legCache.get(key);
  const { W, H, z, s, cellM } = DEMG;
  const [si, sj] = DEMG.cellOf(a), [gi, gj] = DEMG.cellOf(b);
  const start = sj * W + si, goal = gj * W + gi, MARGIN = 200;
  const x0 = Math.max(0, Math.min(si, gi) - MARGIN), x1 = Math.min(W - 1, Math.max(si, gi) + MARGIN);
  const y0 = Math.max(0, Math.min(sj, gj) - MARGIN), y1 = Math.min(H - 1, Math.max(sj, gj) + MARGIN);
  // células a até 2 de uma parada (~8–11 m) são liberadas: a parada pode estar em terreno inclinado
  const nearEnd = (i, j) => (Math.abs(i - si) <= 2 && Math.abs(j - sj) <= 2) || (Math.abs(i - gi) <= 2 && Math.abs(j - gj) <= 2);
  const vmax = M.suit.flatSpeedKmh * Math.exp(0.175);
  const h = (i, j) => Math.hypot(i - gi, j - gj) * cellM / 1000 / vmax;
  const g = new Float32Array(W * H).fill(Infinity), came = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  // fila de prioridade (heap binário)
  const hk = [], hv = [];
  const push = (k, f) => { let n = hk.length; hk.push(k); hv.push(f); while (n > 0) { const p = (n - 1) >> 1; if (hv[p] <= hv[n]) break; [hk[p], hk[n]] = [hk[n], hk[p]]; [hv[p], hv[n]] = [hv[n], hv[p]]; n = p; } };
  const pop = () => {
    const top = hk[0], lk = hk.pop(), lv = hv.pop();
    if (hk.length) { hk[0] = lk; hv[0] = lv; let n = 0; for (;;) { const l = 2 * n + 1, r = l + 1; let m = n; if (l < hk.length && hv[l] < hv[m]) m = l; if (r < hk.length && hv[r] < hv[m]) m = r; if (m === n) break; [hk[m], hk[n]] = [hk[n], hk[m]]; [hv[m], hv[n]] = [hv[n], hv[m]]; n = m; } }
    return top;
  };
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  g[start] = 0; push(start, h(si, sj));
  while (hk.length) {
    const c = pop(); if (c === goal) break; if (closed[c]) continue; closed[c] = 1;
    const ci = c % W, cj = (c - ci) / W;
    for (const [dx, dy] of NB) {
      const ni = ci + dx, nj = cj + dy;
      if (ni < x0 || ni > x1 || nj < y0 || nj > y1) continue;
      const n = nj * W + ni; if (closed[n] || isNaN(z[n])) continue;
      const sN = s[n]; if (sN > limit && !nearEnd(ni, nj)) continue;
      // diagonal: não cortar a quina de uma célula acima do limite
      if (dx && dy) {
        const sa = s[cj * W + ni], sb = s[nj * W + ci];
        if ((sa > limit && !nearEnd(ni, cj)) || (sb > limit && !nearEnd(ci, nj))) continue;
      }
      const d = cellM * (dx && dy ? Math.SQRT2 : 1), grade = (z[n] - z[c]) / d;
      const sp = M.suit.flatSpeedKmh * Math.exp(-3.5 * Math.abs(grade + 0.05)) / Math.exp(-0.175);
      const gd = Math.atan(Math.abs(grade)) / DEG, cross = Math.sqrt(Math.max(0, sN * sN - gd * gd));
      // custo = tempo, penalizando inclinação lateral e células perto do limite
      const ng = g[c] + d / 1000 / sp * (1 + cross / 25 + (sN > limit - 3 ? 0.3 : 0));
      if (ng < g[n]) { g[n] = ng; came[n] = c; push(n, ng + h(ni, nj)); }
    }
  }
  if (!isFinite(g[goal])) { legCache.set(key, null); return null; }
  const cells = []; for (let c = goal; c !== -1; c = came[c]) cells.push(c); cells.reverse();
  // suavização por linha de visada (segmentos de até 40 m que não cruzam células acima do limite)
  const pc = cells.map(DEMG.center); pc[0] = a; pc[pc.length - 1] = b;
  const losOK = (p, q) => {
    let ok = true;
    DEMG.lineCells(p, q, (i, j) => { if (ok && !nearEnd(i, j) && s[j * W + i] > limit) ok = false; });
    return ok;
  };
  const smooth = [pc[0]]; let i = 0;
  while (i < pc.length - 1) {
    let j = i + 1;
    for (let k = i + 2; k < pc.length && dist(pc[i], pc[k]) <= 40; k++) { if (losOK(pc[i], pc[k])) j = k; else break; }
    smooth.push(pc[j]); i = j;
  }
  // densifica (pontos a cada ~12 m) para perfil e horários
  const out = [smooth[0]];
  for (let k = 1; k < smooth.length; k++) {
    const p = smooth[k - 1], q = smooth[k], n = Math.max(1, Math.ceil(dist(p, q) / 12));
    for (let m = 1; m <= n; m++) out.push([p[0] + (q[0] - p[0]) * m / n, p[1] + (q[1] - p[1]) * m / n]);
  }
  legCache.set(key, out);
  return out;
}

// inclinação de um trecho pelo DEM: máximo nas células atravessadas, ignorando a mesma zona
// em volta das paradas que o planejador libera (±2 células, ~8 m)
function segSlope(a, b, wpC, limit) {
  const wcells = wpC.map(DEMG.cellOf);
  let mx = -1, over = 0, cnt = 0;
  DEMG.lineCells(a, b, (ci, cj) => {
    if (wcells.some(([wi, wj]) => Math.abs(ci - wi) <= 2 && Math.abs(cj - wj) <= 2)) return;
    const v = DEMG.s[cj * DEMG.W + ci]; if (isNaN(v)) return;
    cnt++; if (v > mx) mx = v; if (v > limit) over++;
  });
  if (!cnt) return { max: DEMG.slopeAt([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) || 0, overFrac: 0, exempt: true };
  return { max: mx, overFrac: over / cnt, exempt: false };
}

function straightLine(a, b, step = 12) {
  const n = Math.max(1, Math.ceil(dist(a, b) / step)), out = [];
  for (let m = 0; m <= n; m++) out.push([a[0] + (b[0] - a[0]) * m / n, a[1] + (b[1] - a[1]) * m / n]);
  return out;
}
const inDem = c => DEMG && !isNaN(DEMG.elevAt(c));

function buildPlan(eva, mode = 'rover', limit = M.slope.caution) {
  // paradas com coordenada livre (rota A→B) ou ligadas a um sol do rover
  const stopPts = eva.stops.map(s => s.c ? { c: s.c } : ROVER[nearestIdx(ROVER, s.sol)]);
  if (eva.custom) mode = 'safe';
  let pts, wpIdx; const infeasible = [];
  if (mode === 'safe' && DEMG) {
    pts = []; wpIdx = [0];
    for (let k = 1; k < stopPts.length; k++) {
      const a = stopPts[k - 1].c, b = stopPts[k].c;
      let leg = inDem(a) && inDem(b) ? planLeg(a, b, limit) : null;
      if (!leg) { // sem caminho abaixo do limite: mantém o trecho do rover (ou linha reta) e sinaliza
        infeasible.push(k);
        leg = eva.custom ? straightLine(a, b)
          : ROVER.slice(nearestIdx(ROVER, eva.stops[k - 1].sol), nearestIdx(ROVER, eva.stops[k].sol) + 1).map(p => p.c);
      }
      leg.forEach((c, j) => { if (j === 0 && pts.length) return; const e = DEMG.elevAt(c); pts.push({ c, lon: c[0], lat: c[1], elev: isNaN(e) ? (pts.length ? pts[pts.length - 1].elev : 0) : e }); });
      wpIdx.push(pts.length - 1);
    }
  } else {
    const i0 = nearestIdx(ROVER, eva.stops[0].sol), i1 = nearestIdx(ROVER, eva.stops[eva.stops.length - 1].sol);
    pts = ROVER.slice(i0, i1 + 1).map(p => ({ ...p }));
    wpIdx = eva.stops.map((s, k) => k === 0 ? 0 : k === eva.stops.length - 1 ? pts.length - 1 : nearestIdx(pts, s.sol));
  }
  const wpC = wpIdx.map(i => pts[i].c);
  pts[0].cum = 0; pts[0].segLen = 0; pts[0].grade = 0; pts[0].overFrac = 0;
  pts[0].slope = DEMG ? DEMG.slopeAt(pts[0].c) : pts[0].tilt;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const d = Math.max(dist(a.c, b.c), 0.5);
    const grade = (b.elev - a.elev) / d;
    b.segLen = d; b.grade = grade; b.cum = a.cum + d;
    if (DEMG) { const ss = segSlope(a.c, b.c, wpC, limit); b.slope = ss.max; b.overFrac = ss.overFrac; b.exempt = ss.exempt; }
    else { b.slope = Math.max(Math.atan(Math.abs(grade)) / DEG, (a.tilt + b.tilt) / 2); b.overFrac = b.slope > limit ? 1 : 0; }
  }
  // paradas -> índice na rota
  let sci = 0;
  const wps = eva.stops.map((s, k) => ({ ...s, idx: wpIdx[k], num: k + 1, label: s.type === 'base' ? 'R' : String(++sci) }));
  // velocidade com traje: função de Tobler normalizada, penalidade extra para terreno > 15°
  const speedKmh = p => {
    const f = Math.exp(-3.5 * Math.abs(p.grade + 0.05)) / Math.exp(-0.175);
    return M.suit.flatSpeedKmh * f * (p.slope > M.slope.caution ? 0.75 : 1);
  };
  // linha do tempo: caminhada + permanência nas paradas
  const events = []; let t = eva.start;
  const wpAt = new Map(wps.map(w => [w.idx, w]));
  for (let i = 0; i < pts.length; i++) {
    const w = wpAt.get(i);
    pts[i].t = t;
    if (w) { w.eta = t; const t1 = t + w.dwell / 60; events.push({ type: 'dwell', t0: t, t1, i, wp: w }); t = t1; w.etd = t; }
    if (i < pts.length - 1) {
      const b = pts[i + 1]; const dt = b.segLen / 1000 / speedKmh(b);
      events.push({ type: 'walk', t0: t, t1: t + dt, i }); t += dt;
    }
  }
  const total = pts[pts.length - 1].cum;
  const elevs = pts.map(p => p.elev);
  return {
    eva, pts, wps, events, start: eva.start, end: t, total, mode, limit, infeasible,
    overLen: pts.reduce((sum, p) => sum + p.segLen * p.overFrac, 0),
    minElev: Math.min(...elevs), maxElev: Math.max(...elevs),
    maxSlope: Math.max(0, ...pts.slice(1).filter(p => !p.exempt).map(p => p.slope)),
    climb: pts.slice(1).reduce((s, p, i) => s + Math.max(0, p.elev - pts[i].elev), 0),
  };
}

function stateAt(plan, t) {
  const { pts, events } = plan;
  t = Math.min(Math.max(t, plan.start), plan.end);
  let ev = events.find(e => t >= e.t0 && t <= e.t1) || events[events.length - 1];
  let c, elev, cum, i = ev.i, frac = 0;
  if (ev.type === 'walk') {
    const a = pts[ev.i], b = pts[ev.i + 1];
    frac = ev.t1 > ev.t0 ? (t - ev.t0) / (ev.t1 - ev.t0) : 1;
    c = [a.lon + (b.lon - a.lon) * frac, a.lat + (b.lat - a.lat) * frac];
    elev = a.elev + (b.elev - a.elev) * frac; cum = a.cum + (b.cum - a.cum) * frac;
  } else { const p = pts[ev.i]; c = p.c; elev = p.elev; cum = p.cum; }
  const nextWp = plan.wps.find(w => w.idx > i) || null;
  const atWp = ev.type === 'dwell' ? ev.wp : null;
  // direção de deslocamento
  const k = Math.min(i + 1, pts.length - 1);
  const heading = bearing(pts[Math.max(0, k - 1)].c, pts[k].c);
  // inclinação máxima nos próximos 120 m
  let ahead = 0, aheadAt = 0;
  for (let j = i + 1; j < pts.length && pts[j].cum - cum <= 120; j++) if (pts[j].slope > ahead) { ahead = pts[j].slope; aheadAt = pts[j].cum - cum; }
  // rover: estacionado no início; reposiciona-se no ponto final quando a tripulação passa da metade
  const roverC = cum < plan.total / 2 ? pts[0].c : pts[pts.length - 1].c;
  return { t, c, elev, cum, i, ev, atWp, nextWp, heading, ahead, aheadAt, roverC, elapsed: t - plan.start, local: pts[i] };
}

// ======================================================================
// Ambiente: radiação, clima, consumíveis, alertas
// ======================================================================
const RAD = M.radiation;
const SHELTER_H = 0.25; // meta: chegar ao abrigo (rover) em até 15 min num evento solar
const gcrRateH = RAD.gcrDoseEqPerSol / HOURS_PER_SOL; // mSv/h

function weatherAt(t) {
  const W = M.weather, sr = W.sunrise, ss = W.sunset, peak = 14;
  const curve = (min, max, pk) => {
    if (t >= sr && t <= pk) return min + (max - min) * (1 - Math.cos(Math.PI * (t - sr) / (pk - sr))) / 2;
    const since = t > pk ? t - pk : t + 24 - pk;
    return min + (max - min) * Math.exp(-since / 3.2);
  };
  const day = t > sr && t < ss;
  const uv = day ? Math.sin(Math.PI * (t - sr) / (ss - sr)) : 0;
  const wind = W.windDay[0] + (W.windDay[1] - W.windDay[0]) * (day ? Math.sin(Math.PI * (t - sr) / (ss - sr)) ** 2 : 0);
  return { air: curve(W.airMin, W.airMax, peak), ground: curve(W.groundMin, W.groundMax, 13), uv, wind, pressure: W.pressurePa * (1 + 0.04 * Math.cos(2 * Math.PI * (t - 4) / 24)), sunLeft: ss - t };
}

function analyze(plan, st, sep) {
  const wx = weatherAt(st.t);
  const dose = st.elapsed * gcrRateH;
  const toRover = dist(st.c, st.roverC);
  const walkBackH = toRover / 1000 / M.suit.flatSpeedKmh;
  const plssLeft = M.suit.plssHours - st.elapsed;
  const plannedDur = plan.end - plan.start;
  const alerts = [];
  if (sep) alerts.push({ lvl: 'danger', msg: `EVENTO DE PARTÍCULAS SOLARES — retornar ao rover: ${fmtD(toRover)}, ~${fmtDur(walkBackH)}.` });
  if (plssLeft < M.suit.reserveHours) alerts.push({ lvl: 'danger', msg: `Reserva do PLSS atingida (${fmtDur(plssLeft)}). Encerrar EVA.` });
  if (plannedDur > M.suit.plssHours - M.suit.reserveHours) alerts.push({ lvl: 'caution', msg: `Plano excede a autonomia com reserva (${fmtDur(plannedDur)}).` });
  if (st.ahead > M.slope.caution && !st.atWp) alerts.push({ lvl: 'danger', msg: `Trecho íngreme em ${fmtD(st.aheadAt)}: ${num(st.ahead, 0)}°. Passo curto e bastão.` });
  else if (st.ahead >= M.slope.ok && !st.atWp) alerts.push({ lvl: 'caution', msg: `Inclinação de ${num(st.ahead, 0)}° nos próximos ${fmtD(Math.max(st.aheadAt, 10))}.` });
  if (wx.sunLeft < 1.5) alerts.push({ lvl: 'caution', msg: `Pôr do sol em ${fmtDur(Math.max(wx.sunLeft, 0))}.` });
  if (st.atWp) alerts.push({ lvl: 'ok', msg: `Em parada: ${st.atWp.name} (até ${fmtT(st.atWp.etd)}).` });
  if (!alerts.length) alerts.push({ lvl: 'ok', msg: 'Condições nominais. Seguir para a próxima parada.' });
  return { wx, dose, toRover, walkBackH, plssLeft, alerts };
}

// ======================================================================
// Mapa (OpenLayers) — projeção geográfica de Marte
// ======================================================================
const MPU = 2 * Math.PI * R_MARS / 360;
const MARS = new ol.proj.Projection({
  code: 'MARS:GEO', units: 'degrees', extent: [-180, -90, 180, 90], global: true,
  metersPerUnit: MPU, getPointResolution: r => r,
});
ol.proj.addProjection(MARS);
const RES = Array.from({ length: 21 }, (_, z) => 0.703125 / 2 ** z);
const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';

// rampa hipsométrica para o DEM (valores 8 bits do Trek em Gale ficam ~44–72)
const RAMP = [[0, [43, 131, 186]], [0.25, [171, 221, 164]], [0.5, [255, 255, 191]], [0.75, [253, 174, 97]], [1, [215, 25, 28]]];
function rampColor(t) {
  t = Math.min(1, Math.max(0, t));
  for (let k = 1; k < RAMP.length; k++) if (t <= RAMP[k][0]) {
    const [t0, c0] = RAMP[k - 1], [t1, c1] = RAMP[k], f = (t - t0) / (t1 - t0);
    return c0.map((v, j) => v + (c1[j] - v) * f);
  }
  return RAMP[RAMP.length - 1][1];
}
const LUT = Array.from({ length: 256 }, (_, v) => rampColor((v - 44) / 28));
function colorizeDem(px) { for (let p = 0; p < px.length; p += 4) { const c = LUT[px[p]]; px[p] = c[0]; px[p + 1] = c[1]; px[p + 2] = c[2]; } }

function trekLayer(o) {
  const tileGrid = new ol.tilegrid.TileGrid({ extent: [-180, -90, 180, 90], origin: [-180, 90], resolutions: RES.slice(0, o.maxZ + 1), tileSize: 256 });
  const source = new ol.source.XYZ({
    projection: MARS, tileGrid, wrapX: false, transition: 150,
    url: `${TREK}/${o.id}/1.0.0/default/default028mm/{z}/{y}/{x}.${o.ext || 'png'}`,
  });
  if (o.transform) {
    source.setTileLoadFunction((tile, url) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
          const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
          const d = cx.getImageData(0, 0, cv.width, cv.height); o.transform(d.data); cx.putImageData(d, 0, 0);
          tile.getImage().src = cv.toDataURL();
        } catch (e) { tile.getImage().src = url; }
      };
      img.onerror = () => { tile.getImage().src = url; };
      img.src = url;
    });
  }
  const layer = new ol.layer.Tile({ source, opacity: o.opacity ?? 1, visible: o.visible ?? true, extent: o.bbox, preload: 1 });
  layer.meta = o;
  return layer;
}

const L = {
  viking:  trekLayer({ name: 'Viking · mosaico global colorido', src: 'Viking MDIM 2.1 · 232 m/px', type: 'Óptico', id: 'Mars_Viking_MDIM21_ClrMosaic_global_232m', ext: 'jpg', maxZ: 7 }),
  mola:    trekLayer({ name: 'Relevo sombreado MOLA + HRSC', src: 'MGS MOLA / Mars Express HRSC · 200 m/px', type: 'Topográfico', id: 'Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw', ext: 'jpg', maxZ: 8, visible: false, opacity: 0.6 }),
  ctx:     trekLayer({ name: 'CTX · mosaico de Gale', src: 'MRO CTX · ~6 m/px', type: 'Óptico', id: 'curiosity_ctx_mosaic', maxZ: 10, bbox: [136.2768, -7.2137, 139.3864, -3.5805] }),
  hirise:  trekLayer({ name: 'HiRISE · mosaico do local', src: 'MRO HiRISE · ~25 cm/px', type: 'Óptico', id: 'curiosity_hirise_mosaic', maxZ: 16, bbox: [137.1225, -4.9255, 137.7298, -4.2490] }),
  dem:     trekLayer({ name: 'Elevação (DEM HiRISE 1 m)', src: 'Cores = altitude relativa; azul baixo, vermelho alto', type: 'Topográfico', id: 'Gale_DEM_SMG_1m', maxZ: 14, bbox: [137.1225, -4.9255, 137.7298, -4.2490], visible: false, opacity: 0.55, transform: colorizeDem }),
  themis:  trekLayer({ name: 'THEMIS IR noturno', src: 'Mars Odyssey · 100 m/px · claro = rocha (alta inércia térmica), escuro = areia/poeira', type: 'Térmico', id: 'THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018', maxZ: 9, visible: false, opacity: 0.7 }),
};

// inclinação real do terreno, calculada do DEM (camada raster gerada no navegador)
L.slope = new ol.layer.Image({ visible: false, opacity: 0.5 });
L.slope.meta = { name: 'Inclinação do terreno (DEM)', src: 'DEM HiRISE 1 m (USGS/MSL), grade 4 m · amarelo ≥ seguro, vermelho > limite, roxo > 30°', type: 'Topográfico' };
let slopeKey = '';
function updateSlopeLayer() {
  if (!DEMG) return;
  const key = `${M.slope.ok}|${M.slope.caution}`; if (key === slopeKey) return; slopeKey = key;
  const { W, H, s } = DEMG, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), im = g.createImageData(W, H), px = im.data;
  for (let k = 0; k < W * H; k++) {
    const v = s[k], c = v > 30 ? [170, 60, 220, 210] : v > M.slope.caution ? [255, 60, 80, 170] : v >= M.slope.ok ? [245, 194, 66, 100] : null;
    if (c) { px[4 * k] = c[0]; px[4 * k + 1] = c[1]; px[4 * k + 2] = c[2]; px[4 * k + 3] = c[3]; }
  }
  g.putImageData(im, 0, 0);
  L.slope.setSource(new ol.source.ImageStatic({ url: cv.toDataURL(), imageExtent: DEMG.extent, projection: MARS, interpolate: false }));
}

// ---------- camadas vetoriais ----------
const srcAlt = new ol.source.Vector();
const srcZones = new ol.source.Vector(), srcTraverse = new ol.source.Vector(), srcRoute = new ol.source.Vector(), srcMarks = new ol.source.Vector(), srcLive = new ol.source.Vector();

function zoneStyle(f) {
  const c = f.get('color');
  return new ol.style.Style({
    fill: new ol.style.Fill({ color: c + '22' }), stroke: new ol.style.Stroke({ color: c, width: 1.5, lineDash: [6, 4] }),
    text: new ol.style.Text({ text: f.get('name'), font: '600 12px Segoe UI, sans-serif', fill: new ol.style.Fill({ color: c }), stroke: new ol.style.Stroke({ color: '#000', width: 3 }), overflow: true }),
  });
}
const V = {
  zones: new ol.layer.Vector({ source: srcZones, style: zoneStyle }),
  traverse: new ol.layer.Vector({ source: srcTraverse, style: new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,.55)', width: 1.5, lineDash: [4, 4] }) }) }),
  radius: new ol.layer.Vector({ source: srcLive, style: f => f.get('kind') === 'radius' ? new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#5ab0ff', width: 1.5, lineDash: [8, 6] }), fill: new ol.style.Fill({ color: 'rgba(90,176,255,.06)' }) }) : null }),
  route: new ol.layer.Vector({ source: srcRoute, style: f => [
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,.75)', width: 8 }) }),
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: COLORS[f.get('cls')], width: 4.5 }) }),
  ] }),
  alt: new ol.layer.Vector({ source: srcAlt, style: [
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,.6)', width: 4 }) }),
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#ffffff', width: 2, lineDash: [6, 5] }) }),
  ] }),
  marks: new ol.layer.Vector({ source: srcMarks, style: markStyle }),
  live: new ol.layer.Vector({ source: srcLive, style: liveStyle }),
};
V.zones.meta = { name: 'Zonas científicas (aprox.)', src: 'Delimitadas pelas posições do Curiosity em cada fase', type: 'Missão' };
V.traverse.meta = { name: 'Trajeto histórico do Curiosity', src: `NASA/JPL MMGIS · até o sol ${N.lastSol}`, type: 'Missão' };
V.route.meta = { name: 'Rota da EVA por inclinação', src: 'Inclinação pelo DEM HiRISE ao longo do trajeto', type: 'Missão' };
V.alt.meta = { name: 'Rota alternativa (comparação)', src: 'A outra opção: trilha do rover ou rota segura A*', type: 'Missão' };
V.radius.meta = { name: 'Raio de abrigo (15 min a pé até o rover)', src: 'Segurança: alcance em caso de evento solar', type: 'Missão' };

function markStyle(f) {
  const base = f.get('base');
  return new ol.style.Style({
    image: base
      ? new ol.style.RegularShape({ points: 4, radius: 12, angle: Math.PI / 4, fill: new ol.style.Fill({ color: '#5ab0ff' }), stroke: new ol.style.Stroke({ color: '#000', width: 2 }) })
      : new ol.style.Circle({ radius: 12, fill: new ol.style.Fill({ color: '#ff7a3d' }), stroke: new ol.style.Stroke({ color: '#000', width: 2 }) }),
    text: new ol.style.Text({ text: base ? 'R' : String(f.get('num')), font: '700 12px Segoe UI, sans-serif', fill: new ol.style.Fill({ color: '#1a0d05' }) }),
  });
}
function liveStyle(f) {
  const k = f.get('kind');
  if (k === 'crew') return [
    new ol.style.Style({ image: new ol.style.Circle({ radius: 16, fill: new ol.style.Fill({ color: 'rgba(255,255,255,.18)' }) }) }),
    new ol.style.Style({ image: new ol.style.Circle({ radius: 8, fill: new ol.style.Fill({ color: '#fff' }), stroke: new ol.style.Stroke({ color: '#ff7a3d', width: 3 }) }),
      text: new ol.style.Text({ text: 'EV1 · EV2', offsetY: -22, font: '600 11px Segoe UI, sans-serif', fill: new ol.style.Fill({ color: '#fff' }), stroke: new ol.style.Stroke({ color: '#000', width: 3 }) }) }),
  ];
  if (k === 'rover') return new ol.style.Style({
    image: new ol.style.RegularShape({ points: 4, radius: 10, angle: Math.PI / 4, fill: new ol.style.Fill({ color: '#5ab0ff' }), stroke: new ol.style.Stroke({ color: '#fff', width: 2 }) }),
    text: new ol.style.Text({ text: 'ROVER', offsetY: 20, font: '600 10px Segoe UI, sans-serif', fill: new ol.style.Fill({ color: '#5ab0ff' }), stroke: new ol.style.Stroke({ color: '#000', width: 3 }) }),
  });
  return null;
}

const map = new ol.Map({
  target: 'map',
  layers: [L.viking, L.mola, L.ctx, L.hirise, L.dem, L.themis, L.slope, V.zones, V.traverse, V.radius, V.alt, V.route, V.marks, V.live],
  view: new ol.View({ projection: MARS, center: [137.395, -4.795], resolutions: RES, zoom: 14, maxZoom: 20 }),
  controls: [new ol.control.Zoom(), new ol.control.ScaleLine({ units: 'metric' })],
});

// trajeto completo
srcTraverse.addFeature(new ol.Feature(new ol.geom.LineString(N.traverseFull)));

// zonas: envoltória convexa das posições do rover em cada intervalo de sol, com margem de ~80 m
function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
for (const z of M.zones) {
  const r = 80 / MPU, pts = [];
  ROVER.filter(p => p.sol >= z.sols[0] && p.sol <= z.sols[1]).forEach(p => { for (let a = 0; a < 360; a += 30) pts.push([p.lon + r * Math.cos(a * DEG), p.lat + r * Math.sin(a * DEG)]); });
  if (pts.length < 3) continue;
  const h = hull(pts); h.push(h[0]);
  srcZones.addFeature(new ol.Feature({ geometry: new ol.geom.Polygon([h]), name: z.name, color: z.color }));
}

// feições dinâmicas
const fCrew = new ol.Feature({ kind: 'crew', geometry: new ol.geom.Point([0, 0]) });
const fRover = new ol.Feature({ kind: 'rover', geometry: new ol.geom.Point([0, 0]) });
const fRadius = new ol.Feature({ kind: 'radius', geometry: new ol.geom.Circle([0, 0], 1) });
srcLive.addFeatures([fRadius, fRover, fCrew]);
V.live.setZIndex(20); V.marks.setZIndex(15);

// ======================================================================
// Estado da aplicação
// ======================================================================
const app = { plan: null, t: 0, playing: false, sep: false, hud: false, evaIdx: 0, mode: 'rover', limit: M.slope.caution, custom: null, hooks: { update: [], plan: [] } };
const evas = () => app.custom ? [...M.evas, app.custom] : M.evas;

function loadEva(k, keepView = false) {
  const changed = app.evaIdx !== k || !app.plan || app.plan.eva !== evas()[k];
  app.evaIdx = k;
  const eva = evas()[k];
  M.slope.caution = app.limit; M.slope.ok = Math.min(10, app.limit - 2);
  const rover = eva.custom ? null : buildPlan(eva, 'rover', app.limit), safe = DEMG ? buildPlan(eva, 'safe', app.limit) : null;
  app.plans = { rover, safe };
  const plan = app.plan = ((app.mode === 'safe' || !rover) && safe) ? safe : rover;
  const other = plan === rover ? safe : rover;
  app.t = changed ? plan.start : Math.min(Math.max(app.t, plan.start), plan.end);
  // rota colorida + alternativa tracejada
  srcRoute.clear(); srcMarks.clear(); srcAlt.clear();
  if (other) srcAlt.addFeature(new ol.Feature(new ol.geom.LineString(other.pts.map(p => p.c))));
  // agrupa trechos consecutivos da mesma classe de inclinação numa só linha
  let run = null;
  for (let i = 1; i < plan.pts.length; i++) {
    const cls = slopeClass(plan.pts[i].slope);
    if (run && run.cls === cls) run.coords.push(plan.pts[i].c);
    else { if (run) srcRoute.addFeature(new ol.Feature({ geometry: new ol.geom.LineString(run.coords), cls: run.cls })); run = { cls, coords: [plan.pts[i - 1].c, plan.pts[i].c] }; }
  }
  if (run) srcRoute.addFeature(new ol.Feature({ geometry: new ol.geom.LineString(run.coords), cls: run.cls }));
  plan.wps.forEach(w => srcMarks.addFeature(new ol.Feature({ geometry: new ol.geom.Point(plan.pts[w.idx].c), num: w.label, base: w.type === 'base', wp: w })));
  if (!keepView) map.getView().fit(ol.extent.buffer(srcRoute.getExtent(), 0.002), { padding: [40, 40, 40, 40], duration: 600 });
  renderTabs(); renderPlan(); renderRouteCard(); updateSlopeLayer(); updateLegend();
  app.hooks.plan.forEach(f => f(plan)); update();
}

function updateLegend() {
  $('lgOk').textContent = `< ${M.slope.ok}°`;
  $('lgCau').textContent = `${M.slope.ok}–${M.slope.caution}°`;
  $('lgDan').textContent = `> ${M.slope.caution}°`;
}

function renderRouteCard() {
  const { rover, safe } = app.plans;
  $('limitVal').textContent = app.limit + '°'; $('limitSlider').value = app.limit;
  document.querySelectorAll('#routeMode button').forEach(b => {
    b.setAttribute('aria-pressed', String(rover ? b.dataset.m === app.mode : b.dataset.m === 'safe'));
    b.disabled = !rover && b.dataset.m === 'rover';
  });
  if (!safe) { $('routeCmp').innerHTML = '<tr><td>DEM indisponível: só a trilha do rover.</td></tr>'; return; }
  if (!rover) {
    $('routeCmp').innerHTML = `<tbody>${[['Distância', fmtD(safe.total)], ['Duração', fmtDur(safe.end - safe.start)], ['Inclin. máx.', Math.round(safe.maxSlope) + '°'], [`Acima de ${app.limit}°`, fmtD(safe.overLen)], ['Subida', Math.round(safe.climb) + ' m']].map(([k, v]) => `<tr><th>${k}</th><td class="on">${v}</td></tr>`).join('')}</tbody>` +
      (safe.infeasible.length ? `<caption class="cap" style="caption-side:bottom;text-align:left;padding-top:6px">Sem caminho abaixo de ${app.limit}° (ou fora do DEM): trecho em linha reta.</caption>` : '');
    return;
  }
  const on = m => (app.mode === m ? 'on' : 'off');
  const row = (k, f, fmt) => {
    const a = f(rover), b = f(safe), best = a === b ? '' : a < b ? 'r' : 's';
    return `<tr><th>${k}</th><td class="${on('rover')} ${best === 'r' ? 'better' : ''}">${fmt(a)}</td><td class="${on('safe')} ${best === 's' ? 'better' : ''}">${fmt(b)}</td></tr>`;
  };
  $('routeCmp').innerHTML = `<thead><tr><th></th><th>Rover</th><th>A*</th></tr></thead><tbody>` +
    row('Distância', p => Math.round(p.total), v => fmtD(v)) +
    row('Duração', p => Math.round((p.end - p.start) * 60), v => fmtDur(v / 60)) +
    row('Inclin. máx.', p => Math.round(p.maxSlope), v => v + '°') +
    row(`Acima de ${app.limit}°`, p => Math.round(p.overLen), v => fmtD(v)) +
    row('Subida', p => Math.round(p.climb), v => v + ' m') + '</tbody>' +
    (safe.infeasible.length ? `<caption class="cap" style="caption-side:bottom;text-align:left;padding-top:6px">Sem caminho abaixo de ${app.limit}° em ${safe.infeasible.length} trecho(s): mantido o trecho do rover.</caption>` : '');
}

// ======================================================================
// Renderização dos painéis
// ======================================================================
function renderTabs() {
  $('evaTabs').innerHTML = evas().map((e, k) => `<button class="eva-tab" role="tab" aria-selected="${k === app.evaIdx}" data-k="${k}">${e.id} · ${esc(e.title)}</button>`).join('');
}

function renderPlan() {
  const p = app.plan, e = p.eva;
  $('evaTitle').textContent = `${e.id} · ${e.title}`;
  $('evaObjective').textContent = e.objective;
  $('evaStats').innerHTML = [
    ['Distância', fmtD(p.total)], ['Duração', fmtDur(p.end - p.start)],
    ['Subida total', Math.round(p.climb) + ' m'], ['Inclin. máx.', num(p.maxSlope, 0) + '°'],
    ['Janela', `${fmtT(p.start)}–${fmtT(p.end)}`], ['Dose prevista', num((p.end - p.start) * gcrRateH, 2) + ' mSv'],
  ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
  $('stopList').innerHTML = p.wps.map((w, k) => {
    const pt = p.pts[w.idx];
    return `<li class="${w.type}" data-k="${k}" data-n="${w.label}">
      <div class="s-name">${esc(w.name)}</div>
      <div class="s-meta">${fmtT(w.eta)} · ${w.dwell} min · ${fmtD(pt.cum)} · ${num(stopSlope(pt), 0)}°</div></li>`;
  }).join('');
}

function stopSlope(pt) { const v = DEMG ? DEMG.slopeAt(pt.c) : NaN; return isNaN(v) ? (pt.tilt ?? pt.slope ?? 0) : v; }

function kv(rows) { return rows.map(([k, v, cls]) => `<span class="k">${k}</span><span class="v ${cls || ''}">${v}</span>`).join(''); }

function update() {
  const p = app.plan, st = stateAt(p, app.t), an = analyze(p, st, app.sep);
  app.st = st; app.an = an;
  // mapa
  fCrew.getGeometry().setCoordinates(st.c);
  fRover.getGeometry().setCoordinates(st.roverC);
  fRadius.setGeometry(new ol.geom.Circle(st.roverC, (M.suit.flatSpeedKmh * 1000 * SHELTER_H) / MPU));
  fRadius.set('kind', 'radius');
  // linha do tempo
  $('tlClock').textContent = fmtT(st.t);
  $('tlSlider').value = Math.round(1000 * (st.t - p.start) / (p.end - p.start));
  // lista de paradas
  document.querySelectorAll('#stopList li').forEach((li, k) => {
    const w = p.wps[k];
    li.classList.toggle('active', st.atWp === w || (!st.atWp && st.nextWp === w));
    li.classList.toggle('done', st.t > w.etd + 1e-6 && st.atWp !== w);
  });
  // alertas
  $('alerts').innerHTML = an.alerts.map(a => `<div class="alert ${a.lvl}">${a.lvl === 'ok' ? '●' : '▲'} <span>${esc(a.msg)}</span></div>`).join('');
  // posição
  const nx = st.nextWp ? p.pts[st.nextWp.idx] : null;
  $('posInfo').innerHTML = kv([
    ['Lat / Lon', `${num(Math.abs(st.c[1]), 4)}°S ${num(st.c[0], 4)}°E`],
    ['Elevação', `${Math.round(st.elev)} m`],
    ['Percorrido', `${fmtD(st.cum)} / ${fmtD(p.total)}`],
    ['Inclinação local', `${num(st.local.slope ?? st.local.tilt, 0)}°`, slopeClass(st.local.slope ?? st.local.tilt)],
    ['Próxima parada', st.nextWp ? `${fmtD(nx.cum - st.cum)} · ${fmtT(st.nextWp.eta)}` : '—'],
    ['Rover (abrigo)', `${fmtD(an.toRover)} · ${fmtDur(an.walkBackH)}`, an.walkBackH > SHELTER_H ? 'caution' : 'ok'],
  ]);
  // radiação
  const sepRate = RAD.sep2024.absorbed_mGy / 24;
  $('radInfo').innerHTML = kv([
    ['Taxa GCR', `${num(gcrRateH * 1000, 0)} µSv/h`],
    ['Dose na EVA', `${num(an.dose, 3)} mSv`],
    ['Prevista (EVA)', `${num((p.end - p.start) * gcrRateH, 2)} mSv`],
    ['% limite carreira', `${num(100 * an.dose / RAD.careerLimit_mSv, 3)}%`],
    ...(app.sep ? [['Evento SEP', `+${num(sepRate, 2)} mGy/h*`, 'danger'], ['Ação', 'Abrigar no rover', 'danger']] : [['Clima espacial', 'Calmo', 'ok']]),
  ]) + (app.sep ? `<p class="cap" style="grid-column:1/-1;margin:6px 0 0">*${RAD.sep2024.absorbed_mGy} mGy medidos pelo RAD em ${RAD.sep2024.date}, distribuídos em 24 h. ${esc(RAD.sep2024.note)}</p>` : '');
  // ambiente
  const wx = an.wx;
  $('wxInfo').innerHTML = kv([
    ['Ar', `${Math.round(wx.air)} °C`], ['Solo', `${Math.round(wx.ground)} °C`],
    ['Pressão', `${Math.round(wx.pressure)} Pa`], ['Vento', `${num(wx.wind, 0)} m/s`],
    ['UV', wx.uv > 0.9 ? 'Extremo' : wx.uv > 0.6 ? 'Muito alto' : wx.uv > 0 ? 'Alto' : 'Noite', wx.uv > 0.9 ? 'caution' : ''],
    ['Luz restante', fmtDur(Math.max(0, wx.sunLeft)), wx.sunLeft < 1.5 ? 'caution' : ''],
  ]);
  // consumíveis
  const frac = Math.max(0, an.plssLeft / M.suit.plssHours);
  const bar = $('plssBar'); bar.style.width = (frac * 100) + '%';
  bar.style.background = an.plssLeft < M.suit.reserveHours ? 'var(--danger)' : frac < 0.4 ? 'var(--caution)' : 'var(--ok)';
  $('plssInfo').innerHTML = kv([
    ['PLSS restante', fmtDur(an.plssLeft), an.plssLeft < M.suit.reserveHours ? 'danger' : ''],
    ['Tempo de EVA', fmtDur(st.elapsed)],
    ['Reserva no fim', fmtDur(M.suit.plssHours - (p.end - p.start)), M.suit.plssHours - (p.end - p.start) < M.suit.reserveHours ? 'caution' : 'ok'],
  ]);
  drawProfile();
  if (app.hud) updateHud();
  app.hooks.update.forEach(f => f(st, an));
}

// ======================================================================
// Perfil de elevação
// ======================================================================
const cv = $('profile');
function drawProfile() {
  const p = app.plan, dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const padL = 46, padR = 10, padT = 10, padB = 18;
  const lo = p.minElev - 5, hi = p.maxElev + 5;
  const X = d => padL + (W - padL - padR) * d / p.total, Y = e => padT + (H - padT - padB) * (1 - (e - lo) / (hi - lo));
  // área
  g.beginPath(); g.moveTo(X(0), Y(lo)); p.pts.forEach(q => g.lineTo(X(q.cum), Y(q.elev))); g.lineTo(X(p.total), Y(lo)); g.closePath();
  g.fillStyle = 'rgba(255,122,61,.10)'; g.fill();
  // linha colorida por inclinação
  g.lineWidth = 2.5;
  for (let i = 1; i < p.pts.length; i++) { const a = p.pts[i - 1], b = p.pts[i]; g.strokeStyle = COLORS[slopeClass(b.slope)]; g.beginPath(); g.moveTo(X(a.cum), Y(a.elev)); g.lineTo(X(b.cum), Y(b.elev)); g.stroke(); }
  // eixos
  g.fillStyle = '#9aa3ad'; g.font = '11px Consolas, monospace'; g.textAlign = 'right';
  g.fillText(Math.round(p.maxElev) + ' m', padL - 6, Y(p.maxElev) + 4); g.fillText(Math.round(p.minElev) + ' m', padL - 6, Y(p.minElev) + 4);
  g.textAlign = 'left'; g.fillText('0', padL, H - 4); g.textAlign = 'right'; g.fillText(fmtD(p.total), W - padR, H - 4);
  // paradas
  p.wps.forEach(w => {
    const q = p.pts[w.idx], x = X(q.cum);
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, padT); g.lineTo(x, H - padB); g.stroke();
    g.fillStyle = w.type === 'base' ? '#5ab0ff' : '#ff7a3d'; g.beginPath(); g.arc(x, Y(q.elev), 7, 0, 7); g.fill();
    g.fillStyle = '#1a0d05'; g.textAlign = 'center'; g.font = '700 10px Segoe UI, sans-serif'; g.fillText(w.label, x, Y(q.elev) + 3.5);
  });
  // posição atual
  if (app.st) {
    const x = X(app.st.cum);
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, padT); g.lineTo(x, H - padB); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, Y(app.st.elev), 4.5, 0, 7); g.fill();
  }
}
cv.addEventListener('click', ev => {
  const p = app.plan, r = cv.getBoundingClientRect(), padL = 46, padR = 10;
  const d = Math.min(Math.max((ev.clientX - r.left - padL) / (r.width - padL - padR), 0), 1) * p.total;
  const e = p.events.find(e => e.type === 'walk' && p.pts[e.i].cum <= d && p.pts[e.i + 1].cum >= d);
  if (e) { const a = p.pts[e.i].cum, b = p.pts[e.i + 1].cum; app.t = e.t0 + (e.t1 - e.t0) * (b > a ? (d - a) / (b - a) : 0); update(); }
});

// ======================================================================
// Detalhe da parada (fotos em primeira pessoa)
// ======================================================================
function photosFor(sol) { return Object.values(N.photos).find(x => x.sol === sol) || N.photos[sol] || null; }
function imgTag(im, cls = '') { return `<img src="${esc(im.src)}" data-remote="${esc(im.remote)}" onerror="if(this.dataset.remote&&this.src!==this.dataset.remote){this.src=this.dataset.remote}" class="${cls}" alt="Navcam do Curiosity, azimute ${im.az}°" loading="lazy">`; }

function openStop(k) {
  const p = app.plan, w = p.wps[k], pt = p.pts[w.idx], ph = photosFor(w.sol);
  const imgs = ph ? ph.imgs : [];
  const sl = stopSlope(pt), cls = slopeClass(sl);
  const doseAt = (w.eta - p.start) * gcrRateH;
  $('modalBody').innerHTML = `
    <h2>${esc(w.name)}</h2>
    <div><span class="tag">${p.eva.id}</span>${w.sol ? `<span class="tag">Sol ${w.sol} · ${fmtDate(solDate(w.sol))}</span>` : ''}<span class="tag ${cls}">Inclinação ${num(sl, 0)}° (DEM)</span>${pt.tilt != null ? `<span class="tag">Rover mediu ${num(pt.tilt, 0)}°</span>` : ''}<span class="tag">Elev. ${Math.round(pt.elev)} m</span></div>
    ${imgs.length ? `<div class="gallery"><div><div id="gMain">${imgTag(imgs[0])}</div><div class="cap" id="gCap"></div></div>
      <div class="thumbs">${imgs.map((im, j) => imgTag(im, j === 0 ? 'sel' : '').replace('<img', `<img data-j="${j}"`)).join('')}</div></div>` : '<p class="muted">Sem imagens para este sol.</p>'}
    <div class="cols">
      <div><h3>Ciência</h3><p>${esc(w.science)}</p><h3>Tarefas</h3><ul>${w.tasks.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div><h3>Perigos</h3><ul>${w.hazards.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <h3 style="margin-top:12px">Planejamento</h3>
        <div class="kv">${kv([['Chegada', fmtT(w.eta) + ' LMST'], ['Permanência', w.dwell + ' min'], ['Distância do início', fmtD(pt.cum)], ['Dose acumulada', num(doseAt, 3) + ' mSv'], ['Temperatura do ar', Math.round(weatherAt(w.eta).air) + ' °C'], ['Coordenadas', `${num(Math.abs(pt.lat), 5)}°S ${num(pt.lon, 5)}°E`]])}</div></div>
    </div>`;
  const cap = j => { const im = imgs[j]; if (im) $('gCap').textContent = `Navcam esquerda · sol ${ph.sol} · ${im.kind === 'solo' ? 'visão do solo' : 'visão do horizonte'} · azimute ${im.az}° · elevação ${im.el}° · NASA/JPL-Caltech`; };
  if (imgs.length) { cap(0); $('modalBody').querySelectorAll('.thumbs img').forEach(t => t.onclick = () => { const j = +t.dataset.j; $('gMain').innerHTML = imgTag(imgs[j]); cap(j); $('modalBody').querySelectorAll('.thumbs img').forEach(x => x.classList.toggle('sel', x === t)); }); }
  $('stopModal').hidden = false;
  map.getView().animate({ center: pt.c, duration: 500 });
}
$('modalClose').onclick = () => { $('stopModal').hidden = true; };
$('stopModal').addEventListener('click', e => { if (e.target.id === 'stopModal') $('stopModal').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('stopModal').hidden = true; if (app.hud) toggleHud(false); } });

// ======================================================================
// Painel de camadas
// ======================================================================
function renderLayers() {
  const all = [L.hirise, L.ctx, L.viking, L.slope, L.dem, L.mola, L.themis, V.route, V.alt, V.traverse, V.zones, V.radius];
  const groups = {};
  all.forEach(l => (groups[l.meta.type] = groups[l.meta.type] || []).push(l));
  const order = ['Óptico', 'Topográfico', 'Térmico', 'Missão'];
  $('layersPanel').innerHTML = order.map(gk => `<h4>${gk}</h4>` + groups[gk].map(l => {
    const id = 'ly_' + all.indexOf(l);
    return `<div class="lyr"><input type="checkbox" id="${id}" ${l.getVisible() ? 'checked' : ''}><label for="${id}">${esc(l.meta.name)}</label>
      <span class="src">${esc(l.meta.src)}</span>
      <input type="range" min="0" max="100" value="${Math.round(l.getOpacity() * 100)}" data-for="${id}" aria-label="Opacidade ${esc(l.meta.name)}"></div>`;
  }).join('')).join('') + '<p class="cap">Mais dados: radiação (RAD) e ambiente (REMS) no painel à direita e na linha do tempo.</p>';
  all.forEach((l, i) => {
    $('ly_' + i).onchange = e => l.setVisible(e.target.checked);
    $('layersPanel').querySelector(`[data-for="ly_${i}"]`).oninput = e => l.setOpacity(e.target.value / 100);
  });
}
$('layersBtn').onclick = () => { const p = $('layersPanel'); p.hidden = !p.hidden; $('layersBtn').setAttribute('aria-expanded', String(!p.hidden)); };

// ======================================================================
// Interações do mapa
// ======================================================================
map.on('pointermove', e => {
  const c = e.coordinate, el = DEMG ? DEMG.elevAt(c) : NaN;
  $('coord').textContent = `${num(Math.abs(c[1]), 5)}°${c[1] < 0 ? 'S' : 'N'}  ${num(c[0], 5)}°E` + (isNaN(el) ? '' : `  ·  ${Math.round(el)} m  ·  ${num(DEMG.slopeAt(c), 0)}°`);
  map.getTargetElement().style.cursor = map.hasFeatureAtPixel(e.pixel, { layerFilter: l => l === V.marks }) ? 'pointer' : '';
});
map.on('click', e => {
  const f = map.forEachFeatureAtPixel(e.pixel, f => f, { layerFilter: l => l === V.marks });
  if (f) openStop(app.plan.wps.indexOf(app.plan.wps.find(w => w === f.get('wp'))));
});

// ======================================================================
// Linha do tempo / reprodução
// ======================================================================
$('tlSlider').oninput = e => { const p = app.plan; app.t = p.start + (p.end - p.start) * e.target.value / 1000; update(); };
let lastTs = 0;
function loop(ts) {
  if (!app.playing) return;
  const dt = lastTs ? (ts - lastTs) / 1000 : 0; lastTs = ts;
  app.t += dt * (+$('speedSel').value) / 3600;
  if (app.t >= app.plan.end) { app.t = app.plan.end; setPlaying(false); }
  update();
  if (app.playing) requestAnimationFrame(loop);
}
function setPlaying(on) {
  if (on && app.t >= app.plan.end) app.t = app.plan.start;
  app.playing = on; lastTs = 0;
  $('playBtn').textContent = on ? '❚❚' : '▶'; $('hudPlay').textContent = on ? '❚❚' : '▶';
  if (on) requestAnimationFrame(loop);
}
$('playBtn').onclick = () => setPlaying(!app.playing);
$('hudPlay').onclick = () => setPlaying(!app.playing);
$('sepToggle').onchange = e => { app.sep = e.target.checked; update(); };
function setMode(m) {
  if (m === app.mode || (m === 'rover' && !app.plans.rover)) return;
  app.mode = m;
  if (m === 'safe' && !app.slopeShown) { app.slopeShown = true; L.slope.setVisible(true); renderLayers(); }
  loadEva(app.evaIdx, true);
}
$('routeMode').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) setMode(b.dataset.m); });
$('limitSlider').oninput = e => { $('limitVal').textContent = e.target.value + '°'; };
$('limitSlider').onchange = e => { app.limit = +e.target.value; loadEva(app.evaIdx, true); };
$('evaTabs').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { setPlaying(false); loadEva(+b.dataset.k); } });
$('stopList').addEventListener('click', e => { const li = e.target.closest('li'); if (li) openStop(+li.dataset.k); });

// ======================================================================
// HUD do capacete
// ======================================================================
function toggleHud(on) {
  app.hud = on; $('hud').hidden = !on;
  if (on) { app.hudBgSol = null; update(); }
}
$('hudBtn').onclick = () => toggleHud(true);
$('hudExit').onclick = () => toggleHud(false);

function updateHud() {
  const p = app.plan, st = app.st, an = app.an;
  const target = st.atWp || st.nextWp || p.wps[p.wps.length - 1];
  const tp = p.pts[target.idx];
  // fundo: foto do horizonte do alvo
  // sem sol (rota livre): usa as fotos do ponto do Curiosity com fotos mais próximo do alvo
  const bgSol = target.sol || Object.values(N.photos).map(ph => ({ sol: ph.sol, d: dist(ROVER[nearestIdx(ROVER, ph.sol)].c, tp.c) })).sort((a, b) => a.d - b.d)[0].sol;
  if (app.hudBgSol !== bgSol) {
    app.hudBgSol = bgSol;
    const ph = photosFor(bgSol);
    const im = ph && (ph.imgs.filter(i => i.kind === 'horizonte').sort((a, b) => b.el - a.el)[0] || ph.imgs[0]);
    $('hudBg').style.backgroundImage = im ? `url("${im.src}"), url("${im.remote}")` : 'none';
  }
  const brg = st.atWp ? st.heading : bearing(st.c, tp.c);
  const heading = st.heading;
  // fita da bússola
  const tape = $('hudTape'), w = tape.parentElement.clientWidth, ppd = w / 120;
  const names = { 0: 'N', 45: 'NE', 90: 'L', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
  let html = '';
  for (let d = Math.ceil((heading - 60) / 15) * 15; d <= heading + 60; d += 15) {
    const n = ((d % 360) + 360) % 360; html += `<span style="left:${w / 2 + (d - heading) * ppd}px">${names[n] || n}</span>`;
  }
  let rel = ((brg - heading + 540) % 360) - 180;
  if (Math.abs(rel) <= 60) html += `<span class="wp" style="left:${w / 2 + rel * ppd}px;top:20px">◆</span>`;
  tape.style.width = w + 'px'; tape.innerHTML = html;
  $('hudArrow').style.transform = `rotate(${rel}deg)`;
  const row = (lab, val, cls = '') => `<div class="hud-row"><div class="lab">${lab}</div><div class="val ${cls}">${val}</div></div>`;
  $('hudLeft').innerHTML =
    row('PLSS', fmtDur(an.plssLeft), an.plssLeft < M.suit.reserveHours ? 'danger' : '') +
    row('DOSE EVA', num(an.dose, 3) + ' mSv', app.sep ? 'danger' : '') +
    row('TEMP AR', Math.round(an.wx.air) + ' °C') +
    row('INCLINAÇÃO', num(st.local.slope ?? st.local.tilt, 0) + '°', slopeClass(st.local.slope ?? st.local.tilt) === 'ok' ? '' : slopeClass(st.local.slope ?? st.local.tilt)) +
    row('ROVER', fmtD(an.toRover), an.walkBackH > SHELTER_H ? 'caution' : '');
  $('hudRight').innerHTML =
    row(st.atWp ? 'EM PARADA' : 'PRÓXIMO', esc(target.name)) +
    row('DISTÂNCIA', st.atWp ? '—' : fmtD(Math.max(0, tp.cum - st.cum))) +
    row(st.atWp ? 'SAÍDA' : 'CHEGADA', fmtT(st.atWp ? st.atWp.etd : target.eta)) +
    row('RUMO', Math.round(brg) + '°');
  const top = an.alerts.find(a => a.lvl === 'danger') || an.alerts.find(a => a.lvl === 'caution');
  const al = $('hudAlert'); al.className = 'hud-alert ' + (top ? top.lvl : ''); al.textContent = top ? top.msg : (st.atWp ? st.atWp.tasks[0] : '');
  $('hudClock').textContent = `${fmtT(st.t)} LMST · ${p.eva.id}`;
  drawMini(st);
}

function drawMini(st) {
  const c = $('hudMini'), g = c.getContext('2d'), S = c.width, half = S / 2, range = 400; // metros
  g.clearRect(0, 0, S, S);
  const toPx = q => { const dx = (q[0] - st.c[0]) * MPU * Math.cos(st.c[1] * DEG), dy = (q[1] - st.c[1]) * MPU; return [half + dx / range * half, half - dy / range * half]; };
  g.save(); g.beginPath(); g.arc(half, half, half - 1, 0, 7); g.clip();
  g.lineWidth = 3;
  for (let i = 1; i < app.plan.pts.length; i++) { const a = toPx(app.plan.pts[i - 1].c), b = toPx(app.plan.pts[i].c); g.strokeStyle = COLORS[slopeClass(app.plan.pts[i].slope)]; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  app.plan.wps.forEach(w => { const q = toPx(app.plan.pts[w.idx].c); g.fillStyle = w.type === 'base' ? '#5ab0ff' : '#ff7a3d'; g.beginPath(); g.arc(q[0], q[1], 5, 0, 7); g.fill(); });
  const r = toPx(st.roverC); g.fillStyle = '#5ab0ff'; g.fillRect(r[0] - 5, r[1] - 5, 10, 10);
  g.restore();
  g.fillStyle = '#7dffb0'; g.beginPath(); g.arc(half, half, 5, 0, 7); g.fill();
  g.font = '10px Consolas, monospace'; g.fillText('N', half - 3, 12); g.fillText('400 m', 6, S - 8);
}

// ======================================================================
// Inicialização
// ======================================================================
$('siteLabel').textContent = M.site;
$('credits').textContent = 'Fontes: ' + M.sources.map(s => `${s[0]} (${s[1]})`).join(' · ');
// API interna para o módulo de navegação (js/nav.js)
window.ARES = { M, N, app, map, MARS, MPU, DEMG, ROVER, L, V, srcLive, evas, buildPlan, planLeg, loadEva, update, setPlaying, toggleHud, openStop, photosFor,
  dist, bearing, fmtD, fmtT, fmtDur, num, esc, slopeClass, solDate, fmtDate, inDem, COLORS, gcrRateH };

// parâmetros de URL para demonstração: #eva=2&t=11.2&stop=2&hud=1&sep=1&layers=dem,themis
const Q = new URLSearchParams(location.hash.slice(1));
if (Q.get('layers')) Q.get('layers').split(',').forEach(k => { const l = L[k] || V[k]; if (l) l.setVisible(true); });
if (Q.get('limit')) app.limit = Math.min(25, Math.max(10, +Q.get('limit') || 15));
if (Q.get('route') === 'safe' && DEMG) { app.mode = 'safe'; app.slopeShown = true; L.slope.setVisible(true); }
renderLayers();
loadEva(Math.min(Math.max((+Q.get('eva') || 1) - 1, 0), M.evas.length - 1));
if (Q.get('t')) { app.t = +Q.get('t'); update(); }
if (Q.get('sep') === '1') { $('sepToggle').checked = true; app.sep = true; update(); }
if (Q.get('stop')) openStop(+Q.get('stop'));

// ---------- tela de abertura: números calculados a partir dos dados ----------
function renderIntro() {
  const lim = 15, pr = M.evas.map(e => ({ rover: buildPlan(e, 'rover', lim), safe: DEMG ? buildPlan(e, 'safe', lim) : null }));
  const sum = f => pr.reduce((s, p) => s + f(p), 0);
  const cards = [];
  if (DEMG) {
    const overR = sum(p => p.rover.overLen), overS = sum(p => p.safe.overLen);
    cards.push([`${fmtD(overR)} → ${fmtD(overS)}`, `de encosta acima de ${lim}° na trilha do rover × na rota segura A* (2 EVAs)`]);
    const diffs = ROVER.filter(p => p.sol >= 4080 && p.sol <= 4720).map(p => Math.abs(DEMG.elevAt(p.c) - p.elev)).filter(v => !isNaN(v)).sort((a, b) => a - b);
    if (diffs.length) cards.push([`${num(diffs[diffs.length >> 1], 2)} m`, `diferença mediana entre o DEM HiRISE e a elevação medida pelo Curiosity (${diffs.length} pontos)`]);
    cards.push([`${fmtD(sum(p => p.safe.total))} · ${fmtDur(sum(p => p.safe.end - p.safe.start))}`, 'de caminhada em 2 EVAs, cada uma dentro da autonomia do traje com reserva']);
  }
  cards.push([String(Object.values(N.photos).reduce((s, p) => s + p.imgs.length, 0)), 'fotos reais da superfície (Navcam), tiradas exatamente nas paradas']);
  $('introNumbers').innerHTML = cards.map(([b, s]) => `<div class="num-card"><b>${b}</b><span>${esc(s)}</span></div>`).join('');
  $('introKm').textContent = `${num(N.roverStops[N.roverStops.length - 1][5], 1)} km`;
}
function showIntro(on) { if (on) renderIntro(); $('intro').hidden = !on; if (on) setPlaying(false); }
$('introBtn').onclick = () => showIntro(true);
$('intro').addEventListener('click', e => {
  const b = e.target.closest('[data-go]'); if (!b) return;
  const go = b.dataset.go; showIntro(false);
  if (go === '1' || go === '2') { if (app.evaIdx !== +go - 1) loadEva(+go - 1); }
  if (go === 'hud') toggleHud(true);
});
if (!location.hash || Q.get('intro') === '1') showIntro(true);
if (Q.get('hud') === '1') toggleHud(true);
window.addEventListener('resize', () => { drawProfile(); if (app.hud) updateHud(); });
})();

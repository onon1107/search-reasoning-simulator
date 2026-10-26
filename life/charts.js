// SVG 차트 도우미 — 외부 라이브러리 없이 matplotlib / seaborn / plotly 결과를 흉내 냅니다.
(function () {
  const D = window.LE_DATA;
  const col = (name) => D.v[D.cols.indexOf(name)];

  const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
  function ticks(min, max, n = 5) {
    const span = max - min || 1;
    const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  const fmt = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(a % 1e6 ? 1 : 0) + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(0) + 'k';
    return +v.toFixed(2) + '';
  };
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const std = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
  function kde(values, xs) {
    const n = values.length, h = std(values) * Math.pow(n, -0.2) || 1;
    const c = 1 / (n * h * Math.sqrt(2 * Math.PI));
    return xs.map((x) => { let s = 0; for (const v of values) { const z = (x - v) / h; s += Math.exp(-0.5 * z * z); } return s * c; });
  }
  function pearson(x, y) {
    const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0;
    for (let i = 0; i < x.length; i++) { const dx = x[i] - mx, dy = y[i] - my; a += dx * dy; b += dx * dx; c += dy * dy; }
    return a / Math.sqrt(b * c);
  }
  function linfit(x, y) {
    const mx = mean(x), my = mean(y); let a = 0, b = 0;
    for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; }
    const w = a / b; return { w, b: my - w * mx };
  }

  function frame(W, H, m, xd, yd, opt = {}) {
    const x = scale(xd[0], xd[1], m.l, W - m.r), y = scale(yd[0], yd[1], H - m.b, m.t);
    let g = '';
    const xt = opt.xticks || ticks(xd[0], xd[1], opt.nx || 6), yt = opt.yticks || ticks(yd[0], yd[1], opt.ny || 5);
    if (opt.grid !== false) yt.forEach((t) => { g += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/>`; });
    g += `<line class="ax" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/><line class="ax" x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}"/>`;
    if (!opt.noXLabels) xt.forEach((t) => { g += `<text x="${x(t)}" y="${H - m.b + 15}" text-anchor="middle">${opt.xfmt ? opt.xfmt(t) : fmt(t)}</text>`; });
    if (!opt.noYLabels) yt.forEach((t) => { g += `<text x="${m.l - 6}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`; });
    if (opt.xlabel) g += `<text class="ttl" x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle">${opt.xlabel}</text>`;
    if (opt.ylabel) g += `<text class="ttl" transform="translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle">${opt.ylabel}</text>`;
    return { x, y, g };
  }
  const svg = (W, H, inner, label) => `<div class="chart"><svg viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${label || ''}">${inner}</svg></div>`;

  // pandas Series.hist() — 기본 10개 구간
  function pandasHist(values, { bins = 10, color = '#1f77b4', xlabel = '', ylabel = '' } = {}) {
    const W = 560, H = 330, m = { l: 52, r: 16, t: 14, b: 44 };
    const min = Math.min(...values), max = Math.max(...values), bw = (max - min) / bins;
    const counts = new Array(bins).fill(0);
    values.forEach((v) => counts[Math.min(bins - 1, Math.floor((v - min) / bw))]++);
    const f = frame(W, H, m, [min - bw * 0.5, max + bw * 0.5], [0, Math.max(...counts) * 1.05], { xlabel, ylabel });
    let bars = '';
    counts.forEach((c, i) => {
      const x0 = f.x(min + i * bw), x1 = f.x(min + (i + 1) * bw);
      bars += `<rect x="${x0}" y="${f.y(c)}" width="${x1 - x0 - 0.5}" height="${f.y(0) - f.y(c)}" fill="${color}"><title>${(min + i * bw).toFixed(1)}~${(min + (i + 1) * bw).toFixed(1)}: ${c}개</title></rect>`;
    });
    return { html: svg(W, H, f.g + bars, '히스토그램'), counts, min, bw };
  }

  // seaborn displot(kde=True)
  function displot(values, { xlabel = '', color = '#1f77b4' } = {}) {
    const W = 440, H = 400, m = { l: 52, r: 14, t: 14, b: 46 };
    const n = values.length, min = Math.min(...values), max = Math.max(...values);
    const sorted = [...values].sort((a, b) => a - b);
    const iqr = sorted[Math.floor(n * 0.75)] - sorted[Math.floor(n * 0.25)];
    const fdw = 2 * iqr / Math.cbrt(n), sturges = Math.ceil(Math.log2(n)) + 1;
    const bins = Math.max(sturges, fdw > 0 ? Math.ceil((max - min) / fdw) : 0);
    const bw = (max - min) / bins, counts = new Array(bins).fill(0);
    values.forEach((v) => counts[Math.min(bins - 1, Math.floor((v - min) / bw))]++);
    const xs = Array.from({ length: 120 }, (_, i) => min - bw + (i / 119) * (max - min + 2 * bw));
    const dens = kde(values, xs).map((d) => d * n * bw);
    const ymax = Math.max(...counts, ...dens) * 1.05;
    const f = frame(W, H, m, [min - bw, max + bw], [0, ymax], { xlabel, ylabel: 'Count', grid: false });
    let g = '';
    counts.forEach((c, i) => {
      g += `<rect x="${f.x(min + i * bw)}" y="${f.y(c)}" width="${f.x(min + (i + 1) * bw) - f.x(min + i * bw)}" height="${f.y(0) - f.y(c)}" fill="${color}" fill-opacity=".45" stroke="${color}" stroke-opacity=".9" stroke-width=".6"/>`;
    });
    g += `<path d="${xs.map((x, i) => (i ? 'L' : 'M') + f.x(x).toFixed(1) + ' ' + f.y(dens[i]).toFixed(1)).join('')}" fill="none" stroke="${color}" stroke-width="2"/>`;
    return svg(W, H, f.g + g, 'displot');
  }

  // seaborn heatmap — YlOrRd
  const YLORRD = ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'];
  function cmap(t) {
    t = Math.max(0, Math.min(1, t)) * (YLORRD.length - 1);
    const i = Math.min(YLORRD.length - 2, Math.floor(t)), f = t - i;
    const a = YLORRD[i], b = YLORRD[i + 1];
    const h = (s, k) => parseInt(s.slice(1 + 2 * k, 3 + 2 * k), 16);
    return '#' + [0, 1, 2].map((k) => Math.round(h(a, k) + (h(b, k) - h(a, k)) * f).toString(16).padStart(2, '0')).join('');
  }
  function heatmap() {
    const cols = D.cols, M = D.corr, k = cols.length, cell = 34, L = 210, T = 10, B = 190;
    const W = L + k * cell + 70, H = T + k * cell + B;
    const vmin = Math.min(...M.flat()), vmax = 1;
    let g = '';
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
      const v = M[i][j], t = (v - vmin) / (vmax - vmin);
      g += `<rect class="hm" data-i="${i}" data-j="${j}" x="${L + j * cell}" y="${T + i * cell}" width="${cell}" height="${cell}" fill="${cmap(t)}" stroke="#fff" stroke-width="1"/>`;
      g += `<text x="${L + j * cell + cell / 2}" y="${T + i * cell + cell / 2 + 3.5}" text-anchor="middle" style="fill:${t > 0.6 ? '#fff' : '#222'};font-size:9.5px;pointer-events:none">${v.toFixed(2)}</text>`;
    }
    cols.forEach((c, i) => {
      g += `<text x="${L - 6}" y="${T + i * cell + cell / 2 + 4}" text-anchor="end" style="font-size:11.5px">${c}</text>`;
      g += `<text transform="translate(${L + i * cell + cell / 2 + 4} ${T + k * cell + 8}) rotate(-90)" text-anchor="end" style="font-size:11.5px">${c}</text>`;
    });
    const cx = L + k * cell + 22, ch = k * cell;
    for (let s = 0; s < 60; s++) g += `<rect x="${cx}" y="${T + (s / 60) * ch}" width="16" height="${ch / 60 + 0.5}" fill="${cmap(1 - s / 60)}"/>`;
    [1, 0.5, 0, -0.5].filter((v) => v >= vmin).forEach((v) => {
      const yy = T + (1 - (v - vmin) / (vmax - vmin)) * ch;
      g += `<text x="${cx + 22}" y="${yy + 4}">${v}</text>`;
    });
    return svg(W, H, g, '상관관계 히트맵');
  }

  // seaborn pairplot(hue='Status', palette='bright')
  const BRIGHT = ['#023eff', '#ff7c00'];
  function pairplot() {
    const vars = ['Measles', 'GDP', 'Life expectancy'], st = col('Status');
    const data = vars.map(col), P = 190, m = 44, gap = 10, W = m + 3 * P + 2 * gap + 110, H = 3 * P + 2 * gap + m + 10;
    const dom = data.map((a) => { const lo = Math.min(...a), hi = Math.max(...a), p = (hi - lo) * 0.05; return [lo - p, hi + p]; });
    let g = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const ox = m + c * (P + gap), oy = 6 + r * (P + gap);
      const x = scale(dom[c][0], dom[c][1], ox, ox + P), y = scale(dom[r][0], dom[r][1], oy + P, oy);
      g += `<rect x="${ox}" y="${oy}" width="${P}" height="${P}" fill="none" class="grid"/>`;
      if (r === c) {
        const xs = Array.from({ length: 80 }, (_, i) => dom[c][0] + (i / 79) * (dom[c][1] - dom[c][0]));
        const curves = [0, 1].map((h) => { const vals = data[c].filter((_, i) => st[i] === h); return kde(vals, xs).map((d) => d * vals.length); });
        const top = Math.max(...curves.flat());
        curves.forEach((cv, h) => {
          const yy = (d) => oy + P - (d / top) * (P - 8);
          g += `<path d="M${x(xs[0])} ${oy + P}${xs.map((xv, i) => 'L' + x(xv).toFixed(1) + ' ' + yy(cv[i]).toFixed(1)).join('')}L${x(xs[79])} ${oy + P}Z" fill="${BRIGHT[h]}" fill-opacity=".25" stroke="${BRIGHT[h]}" stroke-width="1.5"/>`;
        });
      } else {
        for (let i = 0; i < data[0].length; i += 1) {
          g += `<circle cx="${x(data[c][i]).toFixed(1)}" cy="${y(data[r][i]).toFixed(1)}" r="2" fill="${BRIGHT[st[i]]}" fill-opacity=".55"/>`;
        }
      }
      if (r === 2) ticks(dom[c][0], dom[c][1], 3).forEach((t) => { g += `<text x="${x(t)}" y="${oy + P + 13}" text-anchor="middle">${fmt(t)}</text>`; });
      if (c === 0 && r !== 0) ticks(dom[r][0], dom[r][1], 3).forEach((t) => { g += `<text x="${ox - 4}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`; });
      if (r === 2) g += `<text class="ttl" x="${ox + P / 2}" y="${oy + P + 30}" text-anchor="middle">${vars[c]}</text>`;
      if (c === 0) g += `<text class="ttl" transform="translate(10 ${oy + P / 2}) rotate(-90)" text-anchor="middle">${vars[r]}</text>`;
    }
    const lx = m + 3 * P + 2 * gap + 18;
    g += `<text class="ttl" x="${lx}" y="${H / 2 - 30}">Status</text>`;
    [0, 1].forEach((h) => { g += `<circle cx="${lx + 6}" cy="${H / 2 - 10 + h * 20}" r="5" fill="${BRIGHT[h]}"/><text x="${lx + 18}" y="${H / 2 - 6 + h * 20}" style="font-size:12px">${h}</text>`; });
    return svg(W, H, g, 'pairplot');
  }

  // plotly px.violin(box=True)
  const PLOTLY = ['#636efa', '#EF553B'];
  function violin() {
    const le = col('Life expectancy'), st = col('Status');
    const W = 620, H = 400, m = { l: 56, r: 100, t: 16, b: 46 };
    const lo = Math.min(...le) - 2, hi = Math.max(...le) + 2;
    const f = frame(W, H, m, [0, 2], [lo, hi], { noXLabels: true, xlabel: 'Status', ylabel: 'Life expectancy' });
    let g = '';
    [0, 1].forEach((h) => {
      const vals = le.filter((_, i) => st[i] === h).sort((a, b) => a - b);
      const vmin = vals[0], vmax = vals[vals.length - 1];
      const ys = Array.from({ length: 90 }, (_, i) => vmin + (i / 89) * (vmax - vmin));
      const d = kde(vals, ys), top = Math.max(...d), cx = f.x(h + 0.5), half = (f.x(1) - f.x(0)) * 0.42;
      const right = ys.map((yv, i) => `${(cx + (d[i] / top) * half).toFixed(1)} ${f.y(yv).toFixed(1)}`);
      const left = ys.map((yv, i) => `${(cx - (d[i] / top) * half).toFixed(1)} ${f.y(yv).toFixed(1)}`).reverse();
      g += `<path d="M${right.join('L')}L${left.join('L')}Z" fill="${PLOTLY[h]}" fill-opacity=".5" stroke="${PLOTLY[h]}" stroke-width="2"/>`;
      const q = (p) => vals[Math.floor(p * (vals.length - 1))];
      const q1 = q(0.25), q2 = q(0.5), q3 = q(0.75), bw = 9;
      g += `<line x1="${cx}" x2="${cx}" y1="${f.y(vmin)}" y2="${f.y(vmax)}" stroke="${PLOTLY[h]}" stroke-width="1.5"/>`;
      g += `<rect x="${cx - bw}" y="${f.y(q3)}" width="${bw * 2}" height="${f.y(q1) - f.y(q3)}" fill="${PLOTLY[h]}" stroke="#fff" stroke-width="1"/>`;
      g += `<line x1="${cx - bw}" x2="${cx + bw}" y1="${f.y(q2)}" y2="${f.y(q2)}" stroke="#fff" stroke-width="2"/>`;
      g += `<text x="${cx}" y="${H - m.b + 15}" text-anchor="middle">${h}</text>`;
      g += `<text x="${cx + half + 4}" y="${f.y(q2) + 4}" style="font-size:11px">중앙값 ${q2.toFixed(1)}세</text>`;
      g += `<text x="${cx + half + 4}" y="${f.y(vmin) + 4}" style="font-size:11px">최솟값 ${vmin}세</text>`;
    });
    const lx = W - m.r + 16;
    g += `<text class="ttl" x="${lx}" y="${m.t + 12}">Status</text>`;
    [0, 1].forEach((h) => { g += `<rect x="${lx}" y="${m.t + 22 + h * 20}" width="12" height="12" fill="${PLOTLY[h]}" fill-opacity=".7"/><text x="${lx + 18}" y="${m.t + 32 + h * 20}" style="font-size:12px">${h}</text>`; });
    return svg(W, H, f.g + g, 'violin');
  }

  // scatter (+ 선택 회귀선)
  function scatter(x, y, { xlabel = '', ylabel = '', line = null, color = '#1f77b4', lineColor = 'red', r = 2.4, W = 560, H = 380 } = {}) {
    const m = { l: 56, r: 16, t: 14, b: 46 };
    const pad = (a) => { const lo = Math.min(...a), hi = Math.max(...a), p = (hi - lo) * 0.04 || 1; return [lo - p, hi + p]; };
    const xd = pad(x), yd = pad(y);
    const f = frame(W, H, m, xd, yd, { xlabel, ylabel });
    let g = '';
    for (let i = 0; i < x.length; i++) g += `<circle cx="${f.x(x[i]).toFixed(1)}" cy="${f.y(y[i]).toFixed(1)}" r="${r}" fill="${color}" fill-opacity=".55"/>`;
    if (line) {
      const pts = line.xs.map((xv, i) => `${f.x(xv).toFixed(1)} ${f.y(line.ys[i]).toFixed(1)}`);
      g += `<path d="M${pts.join('L')}" fill="none" stroke="${lineColor}" stroke-width="2.5"/>`;
    }
    return svg(W, H, f.g + g, 'scatter');
  }

  // 실제 vs 예측 막대
  function compareBars(actual, pred) {
    const W = 600, H = 300, m = { l: 46, r: 14, t: 14, b: 40 };
    const n = actual.length, lo = 50, hi = 82;
    const f = frame(W, H, m, [0, n], [lo, hi], { noXLabels: true, ylabel: '기대수명(세)' });
    const slot = (f.x(1) - f.x(0)), bw = slot * 0.32;
    let g = '';
    for (let i = 0; i < n; i++) {
      const cx = f.x(i + 0.5);
      g += `<rect x="${cx - bw - 1}" y="${f.y(actual[i])}" width="${bw}" height="${f.y(lo) - f.y(actual[i])}" fill="#3b5bdb" rx="3"><title>실제 ${actual[i]}</title></rect>`;
      g += `<rect x="${cx + 1}" y="${f.y(pred[i])}" width="${bw}" height="${f.y(lo) - f.y(pred[i])}" fill="#f08c00" rx="3"><title>예측 ${pred[i]}</title></rect>`;
      g += `<text x="${cx}" y="${H - m.b + 15}" text-anchor="middle">${i + 1}번</text>`;
      const d = actual[i] - pred[i];
      g += `<text x="${cx}" y="${Math.min(f.y(actual[i]), f.y(pred[i])) - 5}" text-anchor="middle" style="font-size:10.5px">${d > 0 ? '+' : ''}${d.toFixed(1)}</text>`;
    }
    return svg(W, H, f.g + g, '실제와 예측 비교');
  }

  window.Charts = { col, mean, std, pearson, linfit, pandasHist, displot, heatmap, pairplot, violin, scatter, compareBars, cmap };
})();

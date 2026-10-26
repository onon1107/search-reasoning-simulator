/* =====================================================================
 *  charts.js - 실습 결과를 그리는 SVG 차트 모듈
 *  seaborn 의 pairplot / heatmap 과 성능 비교 그래프를 직접 그린다.
 *  색은 CSS 커스텀 속성에서 읽어오므로 라이트/다크 모드가 함께 바뀐다.
 * ===================================================================== */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var SPECIES = ['Adelie', 'Chinstrap', 'Gentoo'];
  var SHAPES = ['circle', 'triangle', 'square'];

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function palette() {
    return {
      sp: [cssVar('--sp-0'), cssVar('--sp-1'), cssVar('--sp-2')],
      ink: cssVar('--ink'),
      ink2: cssVar('--ink-2'),
      muted: cssVar('--ink-muted'),
      grid: cssVar('--line'),
      axis: cssVar('--line-strong'),
      surface: cssVar('--surface-1'),
      divNeg: cssVar('--div-neg'),
      divMid: cssVar('--div-mid'),
      divPos: cssVar('--div-pos'),
      seqLo: cssVar('--seq-100'),
      seqHi: cssVar('--seq-700'),
      accent: cssVar('--accent')
    };
  }

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    }
    if (parent) parent.appendChild(n);
    return n;
  }
  function svgRoot(parent, w, h) {
    parent.innerHTML = '';
    var s = el('svg', {
      viewBox: '0 0 ' + w + ' ' + h,
      width: w, height: h,
      role: 'img', 'font-family': 'inherit'
    }, parent);
    s.style.maxWidth = '100%';
    s.style.height = 'auto';
    return s;
  }
  function text(parent, x, y, str, opts) {
    opts = opts || {};
    var t = el('text', {
      x: x, y: y,
      fill: opts.fill || '#000',
      'font-size': opts.size || 11,
      'font-weight': opts.weight || 400,
      'text-anchor': opts.anchor || 'start',
      'dominant-baseline': opts.baseline || 'alphabetic'
    }, parent);
    if (opts.rotate) t.setAttribute('transform', 'rotate(' + opts.rotate + ' ' + x + ' ' + y + ')');
    t.textContent = str;
    return t;
  }

  /* 2px 표면 링을 두른 마커 — 종마다 모양이 달라 색 없이도 구분된다 */
  function marker(parent, shape, x, y, r, fill, ring) {
    var g;
    if (shape === 'triangle') {
      var h = r * 1.5;
      g = el('polygon', {
        points: [x, y - h * 0.62, x - r * 1.15, y + h * 0.5, x + r * 1.15, y + h * 0.5].join(' ')
      }, parent);
    } else if (shape === 'square') {
      g = el('rect', { x: x - r * 0.92, y: y - r * 0.92, width: r * 1.84, height: r * 1.84, rx: 1 }, parent);
    } else {
      g = el('circle', { cx: x, cy: y, r: r }, parent);
    }
    g.setAttribute('fill', fill);
    g.setAttribute('stroke', ring);
    g.setAttribute('stroke-width', 1.2);
    return g;
  }

  /* ------------------------------ 툴팁 ------------------------------ */
  var tipEl = null;
  function tip(html, ev) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tooltip';
      document.body.appendChild(tipEl);
    }
    tipEl.innerHTML = html;
    tipEl.hidden = false;
    var pad = 14;
    var r = tipEl.getBoundingClientRect();
    var x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
    tipEl.style.left = Math.max(8, x) + 'px';
    tipEl.style.top = Math.max(8, y) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; }

  /* --------------------------- 축 눈금 계산 --------------------------- */
  function niceTicks(lo, hi, n) {
    n = n || 4;
    var span = hi - lo;
    if (span <= 0) return [lo];
    var raw = span / n;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
    var out = [], v = Math.ceil(lo / step) * step;
    for (; v <= hi + step * 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  function fmtTick(v) {
    if (Math.abs(v) >= 1000) return (v / 1000) + 'k';
    return String(Math.round(v * 100) / 100);
  }

  /* ========================= 1. 산점도 행렬 =========================
   * seaborn.pairplot(df, hue='species') 에 대응.
   * 대각선에는 종별 분포(히스토그램), 나머지 칸에는 두 속성의 산점도.
   */
  function pairplot(container, rows, feats, labels) {
    var P = palette();
    var n = feats.length;
    var cell = 112, gap = 10, left = 78, bottom = 50, top = 8, right = 8;
    var W = left + n * cell + (n - 1) * gap + right;
    var H = top + n * cell + (n - 1) * gap + bottom;
    var svg = svgRoot(container, W, H);

    var ranges = feats.map(function (f) {
      var vals = rows.map(function (r) { return r.x[f]; });
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var pad = (hi - lo) * 0.06;
      return [lo - pad, hi + pad];
    });

    for (var i = 0; i < n; i++) {        // 행 = y축 속성
      for (var j = 0; j < n; j++) {      // 열 = x축 속성
        var cx = left + j * (cell + gap);
        var cy = top + i * (cell + gap);
        var g = el('g', { transform: 'translate(' + cx + ',' + cy + ')' }, svg);
        el('rect', {
          x: 0, y: 0, width: cell, height: cell, rx: 4,
          fill: 'none', stroke: P.grid, 'stroke-width': 1
        }, g);

        var xr = ranges[j], yr = ranges[i];
        var sx = function (v) { return ((v - xr[0]) / (xr[1] - xr[0])) * cell; };
        var sy = function (v) { return cell - ((v - yr[0]) / (yr[1] - yr[0])) * cell; };

        if (i === j) {
          drawHist(g, rows, feats[i], xr, cell, P);
        } else {
          drawScatter(g, rows, feats[j], feats[i], sx, sy, cell, P, labels);
        }

        if (j === 0) {
          text(svg, cx - 48, cy + cell / 2, labels[feats[i]], {
            fill: P.ink2, size: 10.5, weight: 600, anchor: 'middle',
            rotate: -90, baseline: 'middle'
          });
          var yt = niceTicks(yr[0], yr[1], 3);
          yt.forEach(function (v) {
            text(svg, cx - 24, cy + sy(v) + 3, fmtTick(v), { fill: P.muted, size: 9, anchor: 'end' });
          });
        }
        if (i === n - 1) {
          text(svg, cx + cell / 2, cy + cell + 30, labels[feats[j]], {
            fill: P.ink2, size: 10.5, weight: 600, anchor: 'middle'
          });
          var xt = niceTicks(xr[0], xr[1], 3);
          xt.forEach(function (v) {
            text(svg, cx + sx(v), cy + cell + 13, fmtTick(v), { fill: P.muted, size: 9, anchor: 'middle' });
          });
        }
      }
    }
    return svg;
  }

  function drawScatter(g, rows, fx, fy, sx, sy, cell, P, labels) {
    rows.forEach(function (r) {
      var x = sx(r.x[fx]), y = sy(r.x[fy]);
      var m = marker(g, SHAPES[r.y], x, y, 2.9, P.sp[r.y], P.surface);
      m.setAttribute('fill-opacity', 0.82);
      m.__pt = r;
    });
    // 최근접점 탐색 레이어 — 작은 마커를 정확히 짚지 않아도 값이 읽힌다
    var hit = el('rect', { x: 0, y: 0, width: cell, height: cell, fill: 'transparent' }, g);
    hit.style.cursor = 'crosshair';
    hit.addEventListener('mousemove', function (ev) {
      var box = hit.getBoundingClientRect();
      var px = (ev.clientX - box.left) / box.width * cell;
      var py = (ev.clientY - box.top) / box.height * cell;
      var best = null, bd = 1e9;
      rows.forEach(function (r) {
        var dx = sx(r.x[fx]) - px, dy = sy(r.x[fy]) - py;
        var d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = r; }
      });
      if (best && bd < 420) {
        tip('<span class="sp" style="color:' + P.sp[best.y] + '">' + SPECIES[best.y] + '</span><br>' +
          labels[fx] + ': <b>' + best.x[fx] + '</b><br>' +
          labels[fy] + ': <b>' + best.x[fy] + '</b>', ev);
      } else hideTip();
    });
    hit.addEventListener('mouseleave', hideTip);
  }

  function drawHist(g, rows, f, range, cell, P) {
    var bins = 14;
    var w = (range[1] - range[0]) / bins;
    var counts = [[], [], []];
    for (var c = 0; c < 3; c++) counts[c] = new Array(bins).fill(0);
    rows.forEach(function (r) {
      var b = Math.min(bins - 1, Math.max(0, Math.floor((r.x[f] - range[0]) / w)));
      counts[r.y][b]++;
    });
    var max = 0;
    for (var b2 = 0; b2 < bins; b2++) {
      for (var c2 = 0; c2 < 3; c2++) max = Math.max(max, counts[c2][b2]);
    }
    var bw = cell / bins;
    for (var c3 = 0; c3 < 3; c3++) {
      for (var b3 = 0; b3 < bins; b3++) {
        var v = counts[c3][b3];
        if (!v) continue;
        var h = (v / max) * (cell - 8);
        el('rect', {
          x: b3 * bw + 1, y: cell - h, width: Math.max(1, bw - 2), height: h,
          fill: P.sp[c3], 'fill-opacity': 0.5, rx: 1
        }, g);
      }
    }
    text(g, cell - 5, 13, '분포', { fill: P.muted, size: 9, anchor: 'end' });
  }

  /* ===================== 2. 상관계수 히트맵 (발산형) =====================
   * sns.heatmap(df.corr(), annot=True, cmap='coolwarm') 에 대응.
   * 파랑(음) <-> 중립 회색(0) <-> 빨강(양)
   */
  function heatmap(container, M, names, labels) {
    var P = palette();
    var n = names.length;
    var cell = 62, left = 128, top = 96, right = 64, bottom = 10;
    var W = left + n * cell + right, H = top + n * cell + bottom;
    var svg = svgRoot(container, W, H);

    for (var i = 0; i < n; i++) {
      text(svg, left - 9, top + i * cell + cell / 2, labels[names[i]], {
        fill: P.ink2, size: 10.5, anchor: 'end', baseline: 'middle'
      });
      text(svg, left + i * cell + cell / 2 + 4, top - 10, labels[names[i]], {
        fill: P.ink2, size: 10.5, anchor: 'start', rotate: -50
      });
    }
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var v = M[r][c];
        var x = left + c * cell, y = top + r * cell;
        var fill = divColor(v, P);
        var rect = el('rect', {
          x: x + 1, y: y + 1, width: cell - 2, height: cell - 2, rx: 3,
          fill: fill
        }, svg);
        rect.style.cursor = 'pointer';
        (function (rr, cc, vv) {
          rect.addEventListener('mousemove', function (ev) {
            tip(labels[names[rr]] + ' &times; ' + labels[names[cc]] +
              '<br>상관계수 <b>' + vv.toFixed(3) + '</b><br>' +
              '<span style="color:var(--ink-muted)">' + corrWord(vv) + '</span>', ev);
          });
          rect.addEventListener('mouseleave', hideTip);
        })(r, c, v);
        text(svg, x + cell / 2, y + cell / 2 + 4, v.toFixed(2), {
          fill: Math.abs(v) > 0.55 ? '#fff' : P.ink,
          size: 11, weight: 600, anchor: 'middle'
        });
      }
    }
    // 색 눈금 범례
    var lgx = left + n * cell + 16, lgh = n * cell;
    var grad = el('linearGradient', { id: 'divgrad', x1: 0, y1: 1, x2: 0, y2: 0 }, el('defs', null, svg));
    el('stop', { offset: '0%', 'stop-color': P.divNeg }, grad);
    el('stop', { offset: '50%', 'stop-color': P.divMid }, grad);
    el('stop', { offset: '100%', 'stop-color': P.divPos }, grad);
    el('rect', { x: lgx, y: top, width: 13, height: lgh, rx: 2, fill: 'url(#divgrad)' }, svg);
    [[1, '+1'], [0.5, '0'], [0, '-1']].forEach(function (p) {
      text(svg, lgx + 18, top + lgh * (1 - p[0]) + 4, p[1], { fill: P.muted, size: 10 });
    });
    return svg;
  }
  function divColor(v, P) {
    var t = Math.max(-1, Math.min(1, v));
    return t >= 0 ? mix(P.divMid, P.divPos, t) : mix(P.divMid, P.divNeg, -t);
  }
  function corrWord(v) {
    var a = Math.abs(v);
    var s = a >= 0.7 ? '매우 강한' : a >= 0.4 ? '뚜렷한' : a >= 0.2 ? '약한' : '거의 없는';
    return s + ' ' + (v >= 0 ? '양의' : '음의') + ' 상관';
  }
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return 'rgb(' + A.map(function (v, i) {
      return Math.round(v + (B[i] - v) * t);
    }).join(',') + ')';
  }

  /* ===================== 3. 혼동행렬 (순차형 램프) ===================== */
  function confusion(container, M, total) {
    var P = palette();
    var n = M.length;
    var max = 0;
    M.forEach(function (row) { row.forEach(function (v) { max = Math.max(max, v); }); });
    var html = '<div class="tbl-wrap"><table class="df"><thead><tr>' +
      '<th class="idx">실제 \\ 예측</th>';
    for (var c = 0; c < n; c++) {
      html += '<th style="text-align:center">' + SPECIES[c] + '</th>';
    }
    html += '<th style="text-align:center">합계</th></tr></thead><tbody>';
    for (var r = 0; r < n; r++) {
      var sum = M[r].reduce(function (a, b) { return a + b; }, 0);
      html += '<tr><td class="idx">' + SPECIES[r] + '</td>';
      for (var c2 = 0; c2 < n; c2++) {
        var v = M[r][c2];
        var t = max ? v / max : 0;
        var bg = v === 0 ? 'transparent' : mix(P.seqLo, P.seqHi, t);
        var fg = t > 0.55 ? (P.surface) : P.ink;
        html += '<td style="text-align:center;background:' + bg + ';color:' +
          (v === 0 ? 'var(--ink-muted)' : fg) + ';font-weight:' + (r === c2 ? 700 : 500) + '">' +
          v + '</td>';
      }
      html += '<td style="text-align:center;color:var(--ink-muted)">' + sum + '</td></tr>';
    }
    html += '</tbody></table></div>';
    if (total) {
      var diag = 0;
      for (var d = 0; d < n; d++) diag += M[d][d];
      html += '<p class="chart-cap">대각선(굵은 칸) = 맞게 분류한 개수 <b>' + diag +
        '</b> / 전체 <b>' + total + '</b>. 대각선을 벗어난 값이 틀린 예측입니다.</p>';
    }
    container.innerHTML = html;
  }

  /* ================== 4. 정확도 비교 (묶음 막대그래프) ================== */
  function groupedBars(container, spec) {
    var P = palette();
    var groups = spec.groups;           // [{label, values:[v1,v2]}]
    var series = spec.series;           // [{name, color}]
    var W = spec.width || 560, barH = 30, gh = series.length * (barH + 6) + 30;
    var left = 112, right = 70, top = 10;
    var H = top + groups.length * gh + 16;
    var svg = svgRoot(container, W, H);
    var plotW = W - left - right;

    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
      el('line', {
        x1: left + plotW * t, y1: top, x2: left + plotW * t, y2: H - 20,
        stroke: P.grid, 'stroke-width': 1
      }, svg);
      text(svg, left + plotW * t, H - 6, Math.round(t * 100) + '%', {
        fill: P.muted, size: 10, anchor: 'middle'
      });
    });

    groups.forEach(function (grp, gi) {
      var gy = top + gi * gh;
      text(svg, left - 12, gy + 16, grp.label, { fill: P.ink, size: 12, weight: 600, anchor: 'end' });
      grp.values.forEach(function (v, si) {
        var y = gy + 6 + si * (barH + 6);
        var w = Math.max(2, plotW * v);
        var bar = el('rect', {
          x: left, y: y, width: w, height: barH, rx: 4,
          fill: series[si].color || P.sp[si]
        }, svg);
        bar.style.cursor = 'pointer';
        (function (nm, lb, vv) {
          bar.addEventListener('mousemove', function (ev) {
            tip('<b>' + nm + '</b> · ' + lb + '<br>정확도 <b>' + (vv * 100).toFixed(2) + '%</b>', ev);
          });
          bar.addEventListener('mouseleave', hideTip);
        })(series[si].name, grp.label, v);
        // 값은 막대 끝에 직접 표기(툴팁에만 의존하지 않는다)
        var inside = w > 74;
        text(svg, inside ? left + w - 8 : left + w + 8, y + barH / 2 + 4,
          (v * 100).toFixed(1) + '%', {
            fill: inside ? '#fff' : P.ink, size: 11.5, weight: 700,
            anchor: inside ? 'end' : 'start'
          });
        text(svg, left + 9, y + barH / 2 + 4, series[si].name, {
          fill: inside ? 'rgba(255,255,255,.88)' : P.ink2, size: 10.5
        });
      });
    });
    return svg;
  }

  /* ============== 5. k 값에 따른 정확도 (꺾은선 2계열) ============== */
  function lineChart(container, spec) {
    var P = palette();
    var W = spec.width || 580, H = spec.height || 240;
    var left = 46, right = 16, top = 14, bottom = 38;
    var svg = svgRoot(container, W, H);
    var pw = W - left - right, ph = H - top - bottom;
    var xs = spec.x;
    var yLo = spec.yMin === undefined ? 0 : spec.yMin, yHi = 1;
    var sx = function (v) { return left + (v - xs[0]) / (xs[xs.length - 1] - xs[0]) * pw; };
    var sy = function (v) { return top + ph - (v - yLo) / (yHi - yLo) * ph; };

    niceTicks(yLo, yHi, 4).forEach(function (v) {
      el('line', { x1: left, y1: sy(v), x2: left + pw, y2: sy(v), stroke: P.grid, 'stroke-width': 1 }, svg);
      text(svg, left - 8, sy(v) + 4, Math.round(v * 100) + '%', { fill: P.muted, size: 10, anchor: 'end' });
    });
    xs.forEach(function (v, i) {
      if (i % Math.ceil(xs.length / 10) !== 0 && i !== xs.length - 1) return;
      text(svg, sx(v), H - 16, String(v), { fill: P.muted, size: 10, anchor: 'middle' });
    });
    text(svg, left + pw / 2, H - 2, spec.xLabel || 'k', { fill: P.ink2, size: 11, anchor: 'middle' });

    spec.series.forEach(function (s, si) {
      var d = s.values.map(function (v, i) { return (i ? 'L' : 'M') + sx(xs[i]) + ' ' + sy(v); }).join(' ');
      el('path', {
        d: d, fill: 'none', stroke: s.color, 'stroke-width': 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': s.dash || 'none'
      }, svg);
      s.values.forEach(function (v, i) {
        var m = marker(svg, SHAPES[si % 3], sx(xs[i]), sy(v), 4.2, s.color, P.surface);
        m.style.cursor = 'pointer';
        (function (kk, vv) {
          m.addEventListener('mousemove', function (ev) {
            tip('<b>' + s.name + '</b><br>k = <b>' + kk + '</b><br>정확도 <b>' +
              (vv * 100).toFixed(2) + '%</b>', ev);
          });
          m.addEventListener('mouseleave', hideTip);
        })(xs[i], v);
      });
      // 마지막 점에만 직접 레이블
      var last = s.values.length - 1;
      text(svg, sx(xs[last]) - 6, sy(s.values[last]) - 11,
        (s.values[last] * 100).toFixed(1) + '%',
        { fill: s.color, size: 10.5, weight: 700, anchor: 'end' });
    });
    el('line', { x1: left, y1: top + ph, x2: left + pw, y2: top + ph, stroke: P.axis, 'stroke-width': 1 }, svg);
    return svg;
  }

  /* ============ 6. k-NN 동작 체험 (이웃 연결 산점도) ============ */
  function knnScatter(container, trainRows, query, neighbors, fx, fy, labels) {
    var P = palette();
    var W = 520, H = 360, left = 56, right = 14, top = 14, bottom = 42;
    var svg = svgRoot(container, W, H);
    var pw = W - left - right, ph = H - top - bottom;
    var all = trainRows.concat([{ x: query.x, y: -1 }]);
    function rng(f) {
      var v = all.map(function (r) { return r.x[f]; });
      var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), p = (hi - lo) * 0.06;
      return [lo - p, hi + p];
    }
    var xr = rng(fx), yr = rng(fy);
    var sx = function (v) { return left + (v - xr[0]) / (xr[1] - xr[0]) * pw; };
    var sy = function (v) { return top + ph - (v - yr[0]) / (yr[1] - yr[0]) * ph; };

    niceTicks(yr[0], yr[1], 4).forEach(function (v) {
      el('line', { x1: left, y1: sy(v), x2: left + pw, y2: sy(v), stroke: P.grid, 'stroke-width': 1 }, svg);
      text(svg, left - 8, sy(v) + 4, fmtTick(v), { fill: P.muted, size: 10, anchor: 'end' });
    });
    niceTicks(xr[0], xr[1], 5).forEach(function (v) {
      text(svg, sx(v), H - 22, fmtTick(v), { fill: P.muted, size: 10, anchor: 'middle' });
    });
    text(svg, left + pw / 2, H - 5, labels[fx], { fill: P.ink2, size: 11, weight: 600, anchor: 'middle' });
    text(svg, 12, top + ph / 2, labels[fy], {
      fill: P.ink2, size: 11, weight: 600, anchor: 'middle', rotate: -90
    });

    var nset = {};
    neighbors.forEach(function (nb) { nset[nb.i] = nb; });
    trainRows.forEach(function (r, i) {
      var m = marker(svg, SHAPES[r.y], sx(r.x[fx]), sy(r.x[fy]), nset[i] ? 5 : 3,
        P.sp[r.y], P.surface);
      m.setAttribute('fill-opacity', nset[i] ? 1 : 0.35);
    });
    // 질의점 -> 선택된 이웃 연결선
    neighbors.forEach(function (nb) {
      var r = trainRows[nb.i];
      el('line', {
        x1: sx(query.x[fx]), y1: sy(query.x[fy]),
        x2: sx(r.x[fx]), y2: sy(r.x[fy]),
        stroke: P.ink2, 'stroke-width': 1.4, 'stroke-opacity': 0.55
      }, svg);
    });
    var q = el('g', null, svg);
    el('circle', {
      cx: sx(query.x[fx]), cy: sy(query.x[fy]), r: 11,
      fill: 'none', stroke: P.ink, 'stroke-width': 1.6, 'stroke-dasharray': '3 3'
    }, q);
    el('circle', {
      cx: sx(query.x[fx]), cy: sy(query.x[fy]), r: 4.5,
      fill: P.ink, stroke: P.surface, 'stroke-width': 1.5
    }, q);
    text(svg, sx(query.x[fx]) + 16, sy(query.x[fy]) + 4, '이 펭귄', {
      fill: P.ink, size: 11, weight: 700
    });
    return svg;
  }

  /* ------------------------------ 범례 ------------------------------ */
  function legendHTML(opts) {
    opts = opts || {};
    var shapes = ['ci', '', 'sq'];
    return '<div class="legend">' + SPECIES.map(function (s, i) {
      var sw = i === 1
        ? '<span class="swatch" style="width:0;height:0;border-left:6px solid transparent;' +
          'border-right:6px solid transparent;border-bottom:11px solid var(--sp-1)"></span>'
        : '<span class="swatch ' + shapes[i] + '" style="background:var(--sp-' + i + ')"></span>';
      return '<span class="item">' + sw + '<span>' + s +
        (opts.codes ? ' <span style="color:var(--ink-muted)">(' + i + ')</span>' : '') +
        '</span></span>';
    }).join('') + '</div>';
  }

  global.Charts = {
    palette: palette, pairplot: pairplot, heatmap: heatmap, confusion: confusion,
    groupedBars: groupedBars, lineChart: lineChart, knnScatter: knnScatter,
    legendHTML: legendHTML, SPECIES: SPECIES, hideTip: hideTip, mix: mix
  };
})(window);

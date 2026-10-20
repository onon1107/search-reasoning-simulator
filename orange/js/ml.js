// ===== 간단한 기계학습 엔진 (브라우저용) =====
// Orange의 동작을 단순화하여 실제로 학습/평가를 수행합니다.

const ML = (() => {
  // ---------- 난수 ----------
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function gauss(r) {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function shuffle(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- 테이블 도우미 ----------
  const featureCols = t => t.columns.map((c, i) => ({ c, i })).filter(o => o.c.role === 'feature' && (o.c.type === 'num' || o.c.type === 'cat'));
  const targetCol = t => { const i = t.columns.findIndex(c => c.role === 'target'); return i < 0 ? null : { c: t.columns[i], i }; };
  const isMissing = v => v === null || v === undefined || (typeof v === 'number' && isNaN(v));

  function subset(t, idx, suffix) {
    return { ...t, id: t.id + ':' + suffix, rows: idx.map(i => t.rows[i]) };
  }

  // 결측치 통계 (Orange Data Table과 같이 target 제외 속성 기준)
  function missingRate(t) {
    const cols = t.columns.map((c, i) => i).filter(i => t.columns[i].role !== 'target' && t.columns[i].role !== 'skip' && t.columns[i].type !== 'image' && t.columns[i].type !== 'str');
    if (!cols.length || !t.rows.length) return 0;
    let m = 0;
    for (const r of t.rows) for (const i of cols) if (isMissing(r[i])) m++;
    return m / (cols.length * t.rows.length);
  }

  // ---------- 인코더: 범주형 → 원-핫, 결측치 대체, 표준화 ----------
  function fitEncoder(t) {
    const fc = featureCols(t);
    const spec = fc.map(({ c, i }) => {
      const vals = t.rows.map(r => r[i]).filter(v => !isMissing(v));
      if (c.type === 'num') {
        const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1)) || 1;
        return { i, type: 'num', mean, sd };
      }
      const values = c.values || [...new Set(vals)];
      const cnt = {}; vals.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
      const mode = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      return { i, type: 'cat', values, mode };
    });
    const dim = spec.reduce((a, s) => a + (s.type === 'num' ? 1 : s.values.length), 0);
    function transform(rows) {
      return rows.map(r => {
        const x = new Float64Array(dim); let k = 0;
        for (const s of spec) {
          let v = r[s.i];
          if (s.type === 'num') { if (isMissing(v)) v = s.mean; x[k++] = (v - s.mean) / s.sd; }
          else { if (isMissing(v)) v = s.mode; const j = s.values.indexOf(v); if (j >= 0) x[k + j] = 1; k += s.values.length; }
        }
        return x;
      });
    }
    return { dim, transform };
  }

  function prepare(t) {
    const tc = targetCol(t);
    if (!tc) throw new Error('데이터에 목표 변수(target)가 없습니다. File 위젯에서 Role을 target으로 지정하세요.');
    if (!featureCols(t).length) throw new Error('학습에 사용할 속성(feature)이 없습니다. 이미지라면 Image Embedding을 먼저 거쳐야 합니다.');
    const classes = tc.c.values || [...new Set(t.rows.map(r => r[tc.i]).filter(v => !isMissing(v)))].sort();
    const rows = t.rows.filter(r => !isMissing(r[tc.i]));
    const enc = fitEncoder({ ...t, rows });
    const X = enc.transform(rows);
    const y = rows.map(r => classes.indexOf(r[tc.i]));
    return { X, y, classes, enc, tc };
  }

  // ---------- 학습 알고리즘 ----------
  function trainKNN(X, y, K, p) {
    const k = p.k || 5, manhattan = p.metric === 'Manhattan', distW = p.weight === 'Distance';
    return xs => xs.map(x => {
      const d = X.map((xi, idx) => {
        let s = 0;
        for (let j = 0; j < x.length; j++) { const t = x[j] - xi[j]; s += manhattan ? Math.abs(t) : t * t; }
        return [manhattan ? s : Math.sqrt(s), idx];
      }).sort((a, b) => a[0] - b[0]).slice(0, k);
      const pr = new Array(K).fill(0);
      d.forEach(([dist, idx]) => pr[y[idx]] += distW ? 1 / (dist + 1e-9) : 1);
      const s = pr.reduce((a, b) => a + b, 0);
      return pr.map(v => v / s);
    });
  }

  function softmax(z) { const m = Math.max(...z); const e = z.map(v => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0); return e.map(v => v / s); }

  function trainLogReg(X, y, K, p) {
    const n = X.length, d = X[0].length, C = p.C || 1, lam = 1 / (C * n);
    const W = Array.from({ length: K }, () => new Float64Array(d + 1));
    const lr = 0.5;
    for (let it = 0; it < 400; it++) {
      const G = Array.from({ length: K }, () => new Float64Array(d + 1));
      for (let i = 0; i < n; i++) {
        const z = W.map(w => { let s = w[d]; for (let j = 0; j < d; j++) s += w[j] * X[i][j]; return s; });
        const pr = softmax(z);
        for (let k = 0; k < K; k++) {
          const g = pr[k] - (y[i] === k ? 1 : 0);
          for (let j = 0; j < d; j++) G[k][j] += g * X[i][j];
          G[k][d] += g;
        }
      }
      for (let k = 0; k < K; k++) for (let j = 0; j <= d; j++)
        W[k][j] -= lr * (G[k][j] / n + (j < d && p.reg !== 'none' ? lam * W[k][j] : 0));
    }
    return xs => xs.map(x => softmax(W.map(w => { let s = w[d]; for (let j = 0; j < d; j++) s += w[j] * x[j]; return s; })));
  }

  function gini(counts, n) { let s = 1; for (const c of counts) s -= (c / n) ** 2; return s; }
  function buildTree(X, y, idx, K, r, depth, maxDepth, mtry, minSplit) {
    const counts = new Array(K).fill(0); idx.forEach(i => counts[y[i]]++);
    const n = idx.length;
    if (depth >= maxDepth || n < minSplit || counts.some(c => c === n)) return { leaf: counts.map(c => c / n) };
    const d = X[0].length;
    const feats = shuffle([...Array(d).keys()], r).slice(0, mtry);
    let best = null;
    for (const f of feats) {
      const sorted = idx.slice().sort((a, b) => X[a][f] - X[b][f]);
      const left = new Array(K).fill(0), right = counts.slice();
      for (let s = 0; s < n - 1; s++) {
        const c = y[sorted[s]]; left[c]++; right[c]--;
        const v1 = X[sorted[s]][f], v2 = X[sorted[s + 1]][f];
        if (v1 === v2) continue;
        const score = (s + 1) / n * gini(left, s + 1) + (n - s - 1) / n * gini(right, n - s - 1);
        if (!best || score < best.score) best = { score, f, thr: (v1 + v2) / 2 };
      }
    }
    if (!best) return { leaf: counts.map(c => c / n) };
    const L = idx.filter(i => X[i][best.f] <= best.thr), R = idx.filter(i => X[i][best.f] > best.thr);
    return { f: best.f, thr: best.thr, l: buildTree(X, y, L, K, r, depth + 1, maxDepth, mtry, minSplit), r: buildTree(X, y, R, K, r, depth + 1, maxDepth, mtry, minSplit) };
  }
  function treePredict(t, x) { while (!t.leaf) t = x[t.f] <= t.thr ? t.l : t.r; return t.leaf; }

  function trainRF(X, y, K, p) {
    const r = rng(p.seed || 7), n = X.length, d = X[0].length;
    const trees = [], nt = p.trees || 10, mtry = Math.max(1, Math.round(Math.sqrt(d)));
    for (let t = 0; t < nt; t++) {
      const idx = Array.from({ length: n }, () => Math.floor(r() * n));
      trees.push(buildTree(X, y, idx, K, r, 0, p.maxDepth || 20, mtry, p.minSplit || 5));
    }
    return xs => xs.map(x => { const pr = new Array(K).fill(0); trees.forEach(t => treePredict(t, x).forEach((v, k) => pr[k] += v / nt)); return pr; });
  }

  function trainMLP(X, y, K, p) {
    const r = rng(p.seed || 11), n = X.length, d = X[0].length, H = p.hidden || 100;
    const act = p.activation || 'ReLu';
    const f = act === 'tanh' ? Math.tanh : act === 'Logistic' ? (v => 1 / (1 + Math.exp(-v))) : (v => v > 0 ? v : 0);
    const df = act === 'tanh' ? (a => 1 - a * a) : act === 'Logistic' ? (a => a * (1 - a)) : (a => a > 0 ? 1 : 0);
    const s1 = Math.sqrt(2 / (d + H)), s2 = Math.sqrt(2 / (H + K));
    const P = { W1: Float64Array.from({ length: H * d }, () => gauss(r) * s1), b1: new Float64Array(H), W2: Float64Array.from({ length: K * H }, () => gauss(r) * s2), b2: new Float64Array(K) };
    const keys = ['W1', 'b1', 'W2', 'b2'];
    const m = {}, v = {}; keys.forEach(k => { m[k] = new Float64Array(P[k].length); v[k] = new Float64Array(P[k].length); });
    const alpha = p.alpha ?? 0.0001, lr = 0.01, b1m = 0.9, b2m = 0.999, bs = Math.min(200, n);
    const iters = p.maxIter || 200;
    let step = 0, bestLoss = Infinity, noImp = 0;
    const hbuf = new Float64Array(H);
    for (let ep = 0; ep < iters; ep++) {
      const order = shuffle([...Array(n).keys()], r);
      let epLoss = 0;
      for (let st = 0; st < n; st += bs) {
        const batch = order.slice(st, st + bs);
        const G = {}; keys.forEach(k => G[k] = new Float64Array(P[k].length));
        for (const i of batch) {
          const x = X[i];
          for (let h = 0; h < H; h++) { let s = P.b1[h]; const o = h * d; for (let j = 0; j < d; j++) s += P.W1[o + j] * x[j]; hbuf[h] = f(s); }
          const z = new Array(K);
          for (let k = 0; k < K; k++) { let s = P.b2[k]; const o = k * H; for (let h = 0; h < H; h++) s += P.W2[o + h] * hbuf[h]; z[k] = s; }
          const pr = softmax(z);
          epLoss -= Math.log(pr[y[i]] + 1e-12);
          const dz = pr.map((pv, k) => pv - (y[i] === k ? 1 : 0));
          for (let h = 0; h < H; h++) {
            let dh = 0;
            for (let k = 0; k < K; k++) { G.W2[k * H + h] += dz[k] * hbuf[h]; dh += dz[k] * P.W2[k * H + h]; }
            dh *= df(hbuf[h]);
            if (dh !== 0) { const o = h * d; for (let j = 0; j < d; j++) G.W1[o + j] += dh * x[j]; G.b1[h] += dh; }
          }
          for (let k = 0; k < K; k++) G.b2[k] += dz[k];
        }
        step++;
        for (const key of keys) {
          const g = G[key], w = P[key], mm = m[key], vv = v[key];
          for (let q = 0; q < w.length; q++) {
            let gq = g[q] / batch.length + (key[0] === 'W' ? alpha * w[q] : 0);
            mm[q] = b1m * mm[q] + (1 - b1m) * gq; vv[q] = b2m * vv[q] + (1 - b2m) * gq * gq;
            w[q] -= lr * (mm[q] / (1 - b1m ** step)) / (Math.sqrt(vv[q] / (1 - b2m ** step)) + 1e-8);
          }
        }
      }
      epLoss /= n;
      if (epLoss > bestLoss - 1e-4) { if (++noImp >= 10) break; } else { noImp = 0; bestLoss = epLoss; }
    }
    return xs => xs.map(x => {
      for (let h = 0; h < H; h++) { let s = P.b1[h]; const o = h * d; for (let j = 0; j < d; j++) s += P.W1[o + j] * x[j]; hbuf[h] = f(s); }
      const z = []; for (let k = 0; k < K; k++) { let s = P.b2[k]; const o = k * H; for (let h = 0; h < H; h++) s += P.W2[o + h] * hbuf[h]; z.push(s); }
      return softmax(z);
    });
  }

  const TRAINERS = { knn: trainKNN, logreg: trainLogReg, rf: trainRF, nn: trainMLP };

  // 모델 학습: table → model 객체
  function fit(learner, t) {
    const { X, y, classes, enc, tc } = prepare(t);
    if (X.length < 2) throw new Error('학습 데이터가 너무 적습니다.');
    const predictFn = TRAINERS[learner.kind](X, y, classes.length, learner.params);
    return {
      learner, classes, trainSize: X.length,
      predictRows(rows) { return predictFn(enc.transform(rows)); },
      targetIndex: tc.i
    };
  }

  // ---------- 평가 ----------
  function aucBinary(scores, labels) {
    const pos = [], neg = [];
    scores.forEach((s, i) => (labels[i] ? pos : neg).push(s));
    if (!pos.length || !neg.length) return NaN;
    const all = scores.map((s, i) => [s, labels[i]]).sort((a, b) => a[0] - b[0]);
    let rankSum = 0, i = 0;
    while (i < all.length) {
      let j = i; while (j < all.length && all[j][0] === all[i][0]) j++;
      const avg = (i + j + 1) / 2;
      for (let q = i; q < j; q++) if (all[q][1]) rankSum += avg;
      i = j;
    }
    return (rankSum - pos.length * (pos.length + 1) / 2) / (pos.length * neg.length);
  }

  function scores(actual, probs, K) {
    const pred = probs.map(p => p.indexOf(Math.max(...p)));
    const n = actual.length;
    const cm = Array.from({ length: K }, () => new Array(K).fill(0));
    actual.forEach((a, i) => cm[a][pred[i]]++);
    let ca = 0; for (let k = 0; k < K; k++) ca += cm[k][k]; ca /= n;
    let P = 0, R = 0, F = 0, A = 0, wsum = 0;
    for (let k = 0; k < K; k++) {
      const sup = cm[k].reduce((a, b) => a + b, 0); if (!sup) continue;
      const tp = cm[k][k], pp = cm.reduce((a, row) => a + row[k], 0);
      const prec = pp ? tp / pp : 0, rec = tp / sup, f1 = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
      const w = sup / n;
      P += w * prec; R += w * rec; F += w * f1;
      const a = aucBinary(probs.map(p => p[k]), actual.map(v => v === k));
      if (!isNaN(a)) { A += w * a; wsum += w; }
    }
    return { AUC: wsum ? A / wsum : NaN, CA: ca, F1: F, Prec: P, Recall: R, cm, pred };
  }

  // Test and Score
  function evaluate(learners, data, testData, method, folds, seed) {
    const { tc } = prepare(data);
    const classes = tc.c.values;
    const rowsAll = data.rows.filter(r => !isMissing(r[tc.i]));
    const out = { classes, method, results: [] };
    if (method === 'test') {
      if (!testData) throw new Error("'Test Data' 입력이 연결되지 않았습니다. Data Sampler의 Remaining Data를 Test Data로 연결하세요.");
      const ttc = targetCol(testData);
      const testRows = testData.rows.filter(r => !isMissing(r[ttc.i]));
      const actual = testRows.map(r => classes.indexOf(r[ttc.i]));
      out.n = testRows.length;
      for (const L of learners) {
        const m = fit(L, { ...data, rows: rowsAll });
        const probs = m.predictRows(testRows);
        out.results.push({ name: L.name, ...scores(actual, probs, classes.length), probs, actual, rows: testRows });
      }
    } else if (method === 'train') {
      const actual = rowsAll.map(r => classes.indexOf(r[tc.i]));
      out.n = rowsAll.length;
      for (const L of learners) {
        const m = fit(L, { ...data, rows: rowsAll });
        const probs = m.predictRows(rowsAll);
        out.results.push({ name: L.name, ...scores(actual, probs, classes.length), probs, actual, rows: rowsAll });
      }
    } else {
      // 층화 교차검증
      const r = rng(seed || 42), k = folds || 5;
      const foldOf = new Array(rowsAll.length);
      classes.forEach((c, ci) => {
        const idx = shuffle(rowsAll.map((row, i) => i).filter(i => rowsAll[i][tc.i] === c), r);
        idx.forEach((i, q) => foldOf[i] = q % k);
      });
      const actual = rowsAll.map(row => classes.indexOf(row[tc.i]));
      out.n = rowsAll.length;
      for (const L of learners) {
        const probs = new Array(rowsAll.length);
        for (let f = 0; f < k; f++) {
          const tr = rowsAll.filter((_, i) => foldOf[i] !== f);
          const teIdx = rowsAll.map((_, i) => i).filter(i => foldOf[i] === f);
          if (!teIdx.length) continue;
          const m = fit(L, { ...data, rows: tr });
          const pr = m.predictRows(teIdx.map(i => rowsAll[i]));
          teIdx.forEach((i, q) => probs[i] = pr[q]);
        }
        out.results.push({ name: L.name, ...scores(actual, probs, classes.length), probs, actual, rows: rowsAll });
      }
    }
    return out;
  }

  return { rng, gauss, shuffle, subset, missingRate, featureCols, targetCol, isMissing, fit, evaluate, scores };
})();

if (typeof module !== 'undefined') module.exports = ML;

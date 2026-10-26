/* =====================================================================
 *  ml.js - 교과서(인공지능 기초 IV단원) 펭귄 분류 실습의 계산 엔진
 *  pandas / scikit-learn 의 핵심 동작을 브라우저에서 그대로 재현한다.
 *  - NumPy MT19937 난수를 구현해 train_test_split(random_state=42) 를
 *    scikit-learn 과 동일한 분할 결과로 만든다.
 * ===================================================================== */
(function (global) {
  'use strict';

  /* ---------------- NumPy MT19937 (legacy RandomState) ---------------- */
  function MT19937(seed) {
    this.mt = new Uint32Array(624);
    this.idx = 624;
    var s = seed >>> 0;
    for (var i = 0; i < 624; i++) {
      this.mt[i] = s;
      // numpy: seed = (1812433253 * (seed ^ (seed >> 30)) + i + 1)
      s = (Math.imul(1812433253, s ^ (s >>> 30)) + i + 1) >>> 0;
    }
  }
  MT19937.prototype._generate = function () {
    var mt = this.mt;
    for (var i = 0; i < 624; i++) {
      var y = ((mt[i] & 0x80000000) | (mt[(i + 1) % 624] & 0x7fffffff)) >>> 0;
      var next = (mt[(i + 397) % 624] ^ (y >>> 1)) >>> 0;
      if (y & 1) next = (next ^ 0x9908b0df) >>> 0;
      mt[i] = next;
    }
    this.idx = 0;
  };
  MT19937.prototype.nextUint32 = function () {
    if (this.idx >= 624) this._generate();
    var y = this.mt[this.idx++];
    y = (y ^ (y >>> 11)) >>> 0;
    y = (y ^ ((y << 7) & 0x9d2c5680)) >>> 0;
    y = (y ^ ((y << 15) & 0xefc60000)) >>> 0;
    y = (y ^ (y >>> 18)) >>> 0;
    return y >>> 0;
  };
  // numpy random_interval: 0 <= 결과 <= max (마스크 + 재추출)
  MT19937.prototype.interval = function (max) {
    if (max === 0) return 0;
    var mask = max;
    mask |= mask >> 1; mask |= mask >> 2; mask |= mask >> 4;
    mask |= mask >> 8; mask |= mask >> 16;
    mask = mask >>> 0;
    var v;
    do { v = (this.nextUint32() & mask) >>> 0; } while (v > max);
    return v;
  };
  // numpy RandomState.permutation(n)
  MT19937.prototype.permutation = function (n) {
    var a = new Array(n);
    for (var i = 0; i < n; i++) a[i] = i;
    for (var k = n - 1; k > 0; k--) {
      var j = this.interval(k);
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  };

  /* ------------------------- 기초 통계 ------------------------- */
  function mean(a) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }
  function std(a, ddof) {
    if (ddof === undefined) ddof = 1;
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - ddof));
  }
  // pandas describe() 의 분위수 (선형 보간)
  function quantile(sorted, q) {
    var pos = (sorted.length - 1) * q;
    var lo = Math.floor(pos), hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function describe(col) {
    var s = col.slice().sort(function (a, b) { return a - b; });
    return {
      count: col.length,
      mean: mean(col),
      std: std(col, 1),
      min: s[0],
      '25%': quantile(s, 0.25),
      '50%': quantile(s, 0.5),
      '75%': quantile(s, 0.75),
      max: s[s.length - 1]
    };
  }
  function pearson(x, y) {
    var mx = mean(x), my = mean(y);
    var sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < x.length; i++) {
      var dx = x[i] - mx, dy = y[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    return sxy / Math.sqrt(sxx * syy);
  }
  function corrMatrix(cols, names) {
    return names.map(function (a) {
      return names.map(function (b) { return pearson(cols[a], cols[b]); });
    });
  }

  /* --------------------- 전처리 / 분할 --------------------- */
  // sklearn.preprocessing.StandardScaler (모표준편차, ddof = 0)
  function standardScaler(X) {
    var n = X.length, p = X[0].length, mu = [], sd = [];
    for (var j = 0; j < p; j++) {
      var col = X.map(function (r) { return r[j]; });
      var m = mean(col), v = 0;
      for (var i = 0; i < n; i++) v += (col[i] - m) * (col[i] - m);
      v = Math.sqrt(v / n);
      mu.push(m); sd.push(v === 0 ? 1 : v);
    }
    return {
      mean_: mu,
      scale_: sd,
      transform: function (M) {
        return M.map(function (r) {
          return r.map(function (val, j) { return (val - mu[j]) / sd[j]; });
        });
      }
    };
  }

  // sklearn.model_selection.train_test_split (shuffle = True)
  function trainTestSplit(X, y, testSize, randomState) {
    var n = X.length;
    var nTest = Math.ceil(testSize * n);
    var nTrain = n - nTest;
    var perm = new MT19937(randomState).permutation(n);
    var idxTest = perm.slice(0, nTest);
    var idxTrain = perm.slice(nTest, nTest + nTrain);
    function pick(arr, idx) { return idx.map(function (i) { return arr[i]; }); }
    return {
      X_train: pick(X, idxTrain), X_test: pick(X, idxTest),
      y_train: pick(y, idxTrain), y_test: pick(y, idxTest),
      idxTrain: idxTrain, idxTest: idxTest
    };
  }

  /* ------------------------ k-NN 분류기 ------------------------ */
  // sklearn KNeighborsClassifier(n_neighbors = k) 의 다수결 규칙
  function KNeighborsClassifier(k) {
    var Xtr = null, ytr = null;
    function sorted(row) {
      var d = new Array(Xtr.length);
      for (var i = 0; i < Xtr.length; i++) {
        var s = 0, tr = Xtr[i];
        for (var j = 0; j < row.length; j++) { var t = row[j] - tr[j]; s += t * t; }
        d[i] = { d2: s, i: i, label: ytr[i] };
      }
      // 거리 오름차순, 동률이면 먼저 입력된 샘플 우선
      d.sort(function (a, b) { return (a.d2 - b.d2) || (a.i - b.i); });
      return d;
    }
    return {
      name: 'k-NN',
      k: k,
      fit: function (X, y) { Xtr = X; ytr = y; return this; },
      predictOne: function (row) {
        var d = sorted(row), votes = {};
        for (var m = 0; m < k; m++) {
          var c = d[m].label;
          votes[c] = (votes[c] || 0) + 1;
        }
        var best = null, bestN = -1;
        Object.keys(votes).map(Number).sort(function (a, b) { return a - b; })
          .forEach(function (c) {
            if (votes[c] > bestN) { bestN = votes[c]; best = c; }
          });
        return best;
      },
      predict: function (X) {
        var self = this;
        return X.map(function (r) { return self.predictOne(r); });
      },
      // 교육용: 특정 샘플의 최근접 이웃 목록
      neighbors: function (row, m) {
        return sorted(row).slice(0, m === undefined ? k : m).map(function (o) {
          return { dist: Math.sqrt(o.d2), i: o.i, label: o.label };
        });
      }
    };
  }

  /* --------------- 로지스틱 회귀 (다항 / 소프트맥스) --------------- */
  // sklearn LogisticRegression(max_iter=2000) 근사: L2(C=1) + Adam 최적화
  function LogisticRegression(opts) {
    opts = opts || {};
    var maxIter = opts.max_iter || 2000;
    var C = opts.C === undefined ? 1.0 : opts.C;
    var W = null, b = null, classes = [];

    function softmaxRows(X) {
      return X.map(function (row) {
        var z = W.map(function (w, c) {
          var s = b[c];
          for (var j = 0; j < row.length; j++) s += w[j] * row[j];
          return s;
        });
        var mx = Math.max.apply(null, z);
        var e = z.map(function (v) { return Math.exp(v - mx); });
        var t = e.reduce(function (s, v) { return s + v; }, 0);
        return e.map(function (v) { return v / t; });
      });
    }

    return {
      name: 'Logistic Regression',
      get coef_() { return W; },
      get intercept_() { return b; },
      fit: function (X, y) {
        var n = X.length, p = X[0].length;
        classes = Array.from(new Set(y)).sort(function (a, b) { return a - b; });
        var K = classes.length, ci = {};
        classes.forEach(function (c, i) { ci[c] = i; });

        // 최적화 안정화를 위해 내부적으로 표준화 후 계수를 원래 축척으로 복원
        var sc = standardScaler(X);
        var Z = sc.transform(X);

        W = []; b = [];
        var mW = [], vW = [], mB = [], vB = [];
        for (var c = 0; c < K; c++) {
          W.push(new Array(p).fill(0)); mW.push(new Array(p).fill(0));
          vW.push(new Array(p).fill(0));
          b.push(0); mB.push(0); vB.push(0);
        }
        var lr = 0.1, beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
        var lambda = 1 / (C * n); // 평균 손실 기준 L2 계수

        for (var it = 1; it <= maxIter; it++) {
          var P = softmaxRows(Z);
          var gW = [], gB = [];
          for (var c2 = 0; c2 < K; c2++) { gW.push(new Array(p).fill(0)); gB.push(0); }
          for (var i = 0; i < n; i++) {
            var yi = ci[y[i]], row = Z[i];
            for (var c3 = 0; c3 < K; c3++) {
              var diff = (P[i][c3] - (c3 === yi ? 1 : 0)) / n;
              gB[c3] += diff;
              for (var j = 0; j < p; j++) gW[c3][j] += diff * row[j];
            }
          }
          var bc1 = 1 - Math.pow(beta1, it), bc2 = 1 - Math.pow(beta2, it);
          for (var c4 = 0; c4 < K; c4++) {
            for (var j2 = 0; j2 < p; j2++) {
              // L2 패널티는 '원래 축척'의 계수에 걸린다(sklearn 과 동일).
              // w_raw = w_z / s 이므로 z 공간에서의 미분은 lambda * w_z / s^2
              var g = gW[c4][j2] + lambda * W[c4][j2] / (sc.scale_[j2] * sc.scale_[j2]);
              mW[c4][j2] = beta1 * mW[c4][j2] + (1 - beta1) * g;
              vW[c4][j2] = beta2 * vW[c4][j2] + (1 - beta2) * g * g;
              W[c4][j2] -= lr * (mW[c4][j2] / bc1) / (Math.sqrt(vW[c4][j2] / bc2) + eps);
            }
            mB[c4] = beta1 * mB[c4] + (1 - beta1) * gB[c4];
            vB[c4] = beta2 * vB[c4] + (1 - beta2) * gB[c4] * gB[c4];
            b[c4] -= lr * (mB[c4] / bc1) / (Math.sqrt(vB[c4] / bc2) + eps);
          }
        }
        // 표준화 공간의 계수를 원래 특성 축척으로 환산
        for (var c5 = 0; c5 < K; c5++) {
          for (var j3 = 0; j3 < p; j3++) {
            var w = W[c5][j3] / sc.scale_[j3];
            b[c5] -= w * sc.mean_[j3];
            W[c5][j3] = w;
          }
        }
        return this;
      },
      predictProba: function (X) { return softmaxRows(X); },
      predict: function (X) {
        return softmaxRows(X).map(function (pr) {
          var bi = 0;
          for (var i = 1; i < pr.length; i++) if (pr[i] > pr[bi]) bi = i;
          return classes[bi];
        });
      }
    };
  }

  /* --------------------------- 평가 지표 --------------------------- */
  function accuracyScore(yTrue, yPred) {
    var ok = 0;
    for (var i = 0; i < yTrue.length; i++) if (yTrue[i] === yPred[i]) ok++;
    return ok / yTrue.length;
  }
  function confusionMatrix(yTrue, yPred, labels) {
    var ls = labels || Array.from(new Set(yTrue.concat(yPred)))
      .sort(function (a, b) { return a - b; });
    var pos = {};
    ls.forEach(function (l, i) { pos[l] = i; });
    var M = ls.map(function () { return ls.map(function () { return 0; }); });
    for (var i = 0; i < yTrue.length; i++) M[pos[yTrue[i]]][pos[yPred[i]]]++;
    return M;
  }

  global.ML = {
    MT19937: MT19937, mean: mean, std: std, describe: describe,
    pearson: pearson, corrMatrix: corrMatrix, quantile: quantile,
    standardScaler: standardScaler, trainTestSplit: trainTestSplit,
    KNeighborsClassifier: KNeighborsClassifier,
    LogisticRegression: LogisticRegression,
    accuracyScore: accuracyScore, confusionMatrix: confusionMatrix
  };
})(typeof window !== 'undefined' ? window : globalThis);

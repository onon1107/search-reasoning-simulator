/* =====================================================================
 *  app.js - 펭귄 분류 프로젝트 시뮬레이터 동작부
 *  빈칸 채우기 채점, 단계 이동, 실제 계산 결과 출력, 실험실
 * ===================================================================== */
(function () {
  'use strict';

  /* ========================= 데이터 파이프라인 ========================= */
  var COLS = window.PENGUIN_COLUMNS;
  var FEATS = ['culmen_length_mm', 'culmen_depth_mm', 'flipper_length_mm', 'body_mass_g'];
  var SHORT = {
    species: '종', island: '섬',
    culmen_length_mm: '부리 길이', culmen_depth_mm: '부리 깊이',
    flipper_length_mm: '지느러미 길이', body_mass_g: '체질량', sex: '성별'
  };
  var UNIT = {
    culmen_length_mm: 'mm', culmen_depth_mm: 'mm',
    flipper_length_mm: 'mm', body_mass_g: 'g'
  };
  var SPECIES = ['Adelie', 'Chinstrap', 'Gentoo'];
  var SP_MAP = { Adelie: 0, Chinstrap: 1, Gentoo: 2 };
  var ISLAND_MAP = { Torgersen: 0, Biscoe: 1, Dream: 2 };

  var DF_RAW = window.PENGUIN_RAW.map(function (r) {
    var o = {};
    COLS.forEach(function (c, i) { o[c] = r[i]; });
    return o;
  });
  var DF_DROPNA = DF_RAW.filter(function (o) {
    return COLS.every(function (c) { return o[c] !== null; });
  });
  var DF_CLEAN = DF_DROPNA.filter(function (o) { return o.sex !== '.'; });
  var CODED = DF_CLEAN.map(function (o) {
    return {
      species: SP_MAP[o.species], island: ISLAND_MAP[o.island],
      culmen_length_mm: o.culmen_length_mm, culmen_depth_mm: o.culmen_depth_mm,
      flipper_length_mm: o.flipper_length_mm, body_mass_g: o.body_mass_g,
      sex: o.sex === 'MALE' ? 1 : 0
    };
  });
  var X_RAW = CODED.map(function (o) { return FEATS.map(function (f) { return o[f]; }); });
  var Y = CODED.map(function (o) { return o.species; });
  // 산점도용: {x: {속성: 값}, y: 종코드}
  var POINTS = CODED.map(function (o) {
    var x = {};
    FEATS.forEach(function (f) { x[f] = o[f]; });
    return { x: x, y: o.species };
  });

  var _xStd = null;
  function Xof(std) {
    if (!std) return X_RAW;
    if (!_xStd) _xStd = ML.standardScaler(X_RAW).transform(X_RAW);
    return _xStd;
  }
  var _splitCache = {};
  function splitOf(std, testSize) {
    var key = (std ? 's' : 'r') + testSize;
    if (!_splitCache[key]) _splitCache[key] = ML.trainTestSplit(Xof(std), Y, testSize, 42);
    return _splitCache[key];
  }
  var _knnCache = {}, _logCache = {};
  function knnOf(std, k, testSize) {
    var key = (std ? 's' : 'r') + k + '_' + testSize;
    if (!_knnCache[key]) {
      var s = splitOf(std, testSize);
      var m = ML.KNeighborsClassifier(k).fit(s.X_train, s.y_train);
      _knnCache[key] = { model: m, pred: m.predict(s.X_test), split: s };
    }
    return _knnCache[key];
  }
  function logOf(std, testSize) {
    var key = (std ? 's' : 'r') + testSize;
    if (!_logCache[key]) {
      var s = splitOf(std, testSize);
      var m = ML.LogisticRegression({ max_iter: 2000 }).fit(s.X_train, s.y_train);
      _logCache[key] = { model: m, pred: m.predict(s.X_test), split: s };
    }
    return _logCache[key];
  }

  /* ============================== 유틸 ============================== */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function f(v, n) {
    if (v === null || v === undefined) return 'NaN';
    return Number(v).toFixed(n === undefined ? 1 : n);
  }
  function pad(s, n, right) {
    s = String(s);
    while (s.length < n) s = right ? s + ' ' : ' ' + s;
    return s;
  }
  function outBox(label, inner) {
    return '<div class="out-label">' + label + '</div>' + inner;
  }
  function pyout(txt) { return '<pre class="pyout">' + esc(txt) + '</pre>'; }
  function note(txt) {
    return '<p class="chart-cap" style="margin-top:10px">' + txt + '</p>';
  }

  /* 데이터프레임 표 만들기 — 실수형 열은 pandas 처럼 .0 을 붙여 표시 */
  function dfTable(rows, cols, opts) {
    opts = opts || {};
    var idx = opts.index;
    var floats = opts.floats || FEATS;
    var h = '<div class="tbl-wrap"><table class="df"><thead><tr><th class="idx"></th>';
    cols.forEach(function (c) { h += '<th>' + esc(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    rows.forEach(function (r, i) {
      h += '<tr><td class="idx">' + (idx ? idx[i] : i) + '</td>';
      cols.forEach(function (c) {
        var v = r[c];
        if (v === null || v === undefined) h += '<td class="na">NaN</td>';
        else if (v === true || v === false) {
          h += '<td class="' + (v ? 'na' : '') + '">' + (v ? 'True' : 'False') + '</td>';
        } else if (typeof v === 'number') {
          var isF = floats.indexOf(c) >= 0;
          h += '<td>' + (isF && Number.isInteger(v) ? v + '.0' : v) + '</td>';
        } else h += '<td class="cat">' + esc(v) + '</td>';
      });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ========================= 진행 상황 저장 ========================= */
  var KEY = 'penguin-sim-v1';
  var state = { solved: {}, checks: {}, step: 0 };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) state = Object.assign(state, saved);
  } catch (e) { /* 저장 기능을 못 쓰는 환경이면 무시 */ }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
  }

  /* ====================== 코드 블록 (빈칸 채점) ====================== */
  var BLOCKS = [];

  function normalize(s) {
    return String(s)
      .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
      .replace(/"/g, "'")
      .replace(/\s+/g, '')
      .replace(/,$/, '');
  }
  function matches(input, answers) {
    var v = normalize(input);
    return answers.some(function (a) { return normalize(a) === v; });
  }
  function matchesLoose(input, answers) {
    var v = normalize(input).toLowerCase();
    return answers.some(function (a) { return normalize(a).toLowerCase() === v; });
  }

  function setupBlock(cb) {
    var id = cb.dataset.id;
    var runner = cb.dataset.run;
    var blanks = $$('.blank', cb).map(function (b) {
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'blank-input';
      inp.spellcheck = false;
      inp.autocapitalize = 'off';
      inp.setAttribute('aria-label', '코드 빈칸');
      inp.style.width = ((parseInt(b.dataset.w, 10) || 10) * 8.2 + 18) + 'px';
      var answers = b.dataset.a.split('|');
      inp.dataset.hint = b.dataset.hint || '';
      b.parentNode.replaceChild(inp, b);
      inp.addEventListener('input', function () {
        inp.classList.remove('ok', 'bad');
        msg.textContent = '';
        msg.className = 'msg';
      });
      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); run(); }
      });
      return { input: inp, answers: answers };
    });
    var msg = $('.msg', cb);
    var out = $('.cb-out', cb);
    var dot = $('.dot', cb);
    var solvedTag = $('.solved', cb);
    var rec = { id: id, cb: cb, blanks: blanks, run: run, hasBlanks: blanks.length > 0 };

    function markSolved() {
      dot.classList.add('ok');
      solvedTag.hidden = false;
      if (!state.solved[id]) { state.solved[id] = true; save(); updateProgress(); }
    }

    function check() {
      var allOk = true, caseOnly = false;
      blanks.forEach(function (b) {
        var val = b.input.value.trim();
        if (matches(val, b.answers)) {
          b.input.classList.add('ok'); b.input.classList.remove('bad');
        } else {
          allOk = false;
          b.input.classList.add('bad'); b.input.classList.remove('ok');
          if (val && matchesLoose(val, b.answers)) caseOnly = true;
        }
      });
      return { ok: allOk, caseOnly: caseOnly };
    }

    function run() {
      var r = check();
      if (!r.ok) {
        msg.className = 'msg err';
        msg.textContent = r.caseOnly
          ? '거의 맞았어요 — 대소문자를 확인하세요. (예: KNeighborsClassifier)'
          : '빈칸을 다시 확인해 보세요. 힌트를 눌러도 좋습니다.';
        out.innerHTML = '';
        return;
      }
      msg.className = 'msg ok';
      msg.textContent = '실행 완료';
      try {
        out.innerHTML = '';
        (RUN[runner] || function () { return '<p>출력 없음</p>'; })(out);
      } catch (e) {
        out.innerHTML = '<div class="feedback no">실행 중 오류: ' + esc(e.message) + '</div>';
      }
      markSolved();
    }

    $$('[data-act]', cb).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.dataset.act;
        if (act === 'run') run();
        if (act === 'hint') {
          var target = blanks.filter(function (b) {
            return !matches(b.input.value.trim(), b.answers);
          })[0] || blanks[0];
          msg.className = 'msg';
          msg.textContent = '💡 ' + (target ? target.input.dataset.hint : '');
          if (target) target.input.focus();
        }
        if (act === 'answer') {
          blanks.forEach(function (b) {
            b.input.value = b.answers[0];
            b.input.classList.add('ok');
            b.input.classList.remove('bad');
          });
          msg.className = 'msg';
          msg.textContent = '정답을 채웠습니다. 실행을 눌러 결과를 확인하세요.';
        }
      });
    });

    if (state.solved[id]) {
      blanks.forEach(function (b) {
        b.input.value = b.answers[0];
        b.input.classList.add('ok');
      });
      dot.classList.add('ok');
      solvedTag.hidden = false;
    }
    BLOCKS.push(rec);
  }

  /* =========================== 실행 결과들 =========================== */
  var RUN = {};

  RUN.runLoad = function (out) {
    out.innerHTML = outBox('실행 결과 — df 에 데이터프레임이 저장되었습니다',
      pyout('>>> df.shape\n(' + DF_RAW.length + ', ' + COLS.length + ')') +
      note('CSV 파일의 <b>344행 × 7열</b>을 모두 읽었습니다. 아직 결측치와 이상치가 섞여 있는 ' +
        '<b>원본 상태</b>입니다.'));
  };

  RUN.runInfo = function (out) {
    var nonNull = {};
    COLS.forEach(function (c) {
      nonNull[c] = DF_RAW.filter(function (o) { return o[c] !== null; }).length;
    });
    var t = "<class 'pandas.core.frame.DataFrame'>\n" +
      'RangeIndex: ' + DF_RAW.length + ' entries, 0 to ' + (DF_RAW.length - 1) + '\n' +
      'Data columns (total ' + COLS.length + ' columns):\n' +
      ' #   Column             Non-Null Count  Dtype  \n' +
      '---  ------             --------------  -----  \n';
    COLS.forEach(function (c, i) {
      var dtype = FEATS.indexOf(c) >= 0 ? 'float64' : 'object';
      t += ' ' + pad(i, 2, true) + '  ' + pad(c, 19, true) +
        pad(nonNull[c] + ' non-null', 15, true) + ' ' + dtype + '\n';
    });
    t += 'dtypes: float64(4), object(3)\nmemory usage: 18.9+ KB';
    out.innerHTML = outBox('실행 결과', pyout(t) +
      note('<b>344 entries</b> 인데 <code>culmen_length_mm</code>은 342개, <code>sex</code>는 ' +
        '334개뿐입니다. 비어 있는 칸, 즉 <b>결측치</b>가 있다는 신호입니다.'));
  };

  RUN.runHead = function (out) {
    out.innerHTML = outBox('실행 결과 — 앞의 5개 행',
      dfTable(DF_RAW.slice(0, 5), COLS) +
      note('3번 행은 측정값이 모두 <span style="color:var(--critical)">NaN</span> 입니다. ' +
        'NaN(Not a Number)이 결측치를 뜻합니다.'));
  };

  RUN.runDescribe = function (out) {
    var stats = ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'];
    var d = {};
    FEATS.forEach(function (c) {
      var vals = DF_RAW.map(function (o) { return o[c]; })
        .filter(function (v) { return v !== null; });
      d[c] = ML.describe(vals);
    });
    var h = '<div class="tbl-wrap"><table class="df"><thead><tr><th class="idx"></th>';
    FEATS.forEach(function (c) { h += '<th>' + c + '</th>'; });
    h += '</tr></thead><tbody>';
    stats.forEach(function (s) {
      h += '<tr><td class="idx">' + s + '</td>';
      FEATS.forEach(function (c) { h += '<td>' + d[c][s].toFixed(6) + '</td>'; });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    out.innerHTML = outBox('실행 결과 — 수치형 속성 요약 통계', h +
      note('<code>count</code>가 342 인 것은 결측치 2개를 제외하고 센 결과입니다. ' +
        '체질량(<b>평균 4201g</b>)과 부리 깊이(<b>평균 17mm</b>)의 <b>숫자 크기 차이</b>를 ' +
        '기억해 두세요 — 뒤에서 표준화가 필요한 이유가 됩니다.'));
  };

  RUN.runIsna = function (out) {
    var rows = DF_RAW.slice(0, 8).map(function (o) {
      var r = {};
      COLS.forEach(function (c) { r[c] = o[c] === null; });
      return r;
    });
    out.innerHTML = outBox('실행 결과 — 앞의 8개 행 (전체 344행 × 7열)',
      dfTable(rows, COLS) +
      note('결측치가 있으면 <span style="color:var(--critical)">True</span>, 없으면 False 로 ' +
        '표시됩니다. 344행을 눈으로 세기는 어렵죠. 그래서 <code>sum()</code>이 필요합니다.'));
  };

  RUN.runIsnaSum = function (out) {
    var t = '';
    COLS.forEach(function (c) {
      var n = DF_RAW.filter(function (o) { return o[c] === null; }).length;
      t += pad(c, 20, true) + pad(n, 3) + '\n';
    });
    t += 'dtype: int64';
    out.innerHTML = outBox('실행 결과 — 속성별 결측치 개수', pyout(t) +
      note('측정값 4개에는 각각 2개, <code>sex</code>에는 10개의 결측치가 있습니다. ' +
        '모두 합쳐 결측치가 있는 행은 <b>' + (DF_RAW.length - DF_DROPNA.length) +
        '개</b>입니다.'));
  };

  RUN.runDropna = function (out) {
    var t = '';
    COLS.forEach(function (c) { t += pad(c, 20, true) + pad(0, 3) + '\n'; });
    t += 'dtype: int64';
    out.innerHTML = outBox('실행 결과 — 결측치 제거 후', pyout(t) +
      note('모든 속성의 결측치가 <b>0</b>이 되었습니다. 행 수는 ' + DF_RAW.length + ' → <b>' +
        DF_DROPNA.length + '행</b>으로 줄었습니다.'));
  };

  RUN.runUnique = function (out) {
    function uniq(c, src) {
      var seen = [], out = [];
      src.forEach(function (o) {
        if (seen.indexOf(o[c]) < 0) { seen.push(o[c]); out.push(o[c]); }
      });
      return out;
    }
    var t =
      ">>> df['species'].unique()\n" +
      arr(uniq('species', DF_DROPNA)) + '\n\n' +
      ">>> df['island'].unique()\n" +
      arr(uniq('island', DF_DROPNA)) + '\n\n' +
      ">>> df['sex'].unique()\n" +
      arr(uniq('sex', DF_DROPNA));
    out.innerHTML = outBox('실행 결과 — 고유한 값', pyout(t) +
      note('<code>sex</code>에 <b style="color:var(--critical)">\'.\'</b> 이라는 값이 ' +
        '섞여 있습니다. 성별이 될 수 없는 값이므로 <b>이상치</b>입니다.'));
  };
  function arr(vals) {
    return 'array([' + vals.map(function (v) { return "'" + v + "'"; }).join(', ') +
      '], dtype=object)';
  }

  RUN.runOutlier = function (out) {
    out.innerHTML = outBox('실행 결과 — 이상치 제거 후',
      pyout(">>> df['sex'].unique()\n" + arr(['MALE', 'FEMALE'])) +
      note('이상치가 사라졌습니다. 행 수는 ' + DF_DROPNA.length + ' → <b>' + DF_CLEAN.length +
        '행</b>. 이제 이 <b>' + DF_CLEAN.length + '행</b>으로 학습을 진행합니다.'));
  };

  RUN.runPairplot = function (out) {
    out.innerHTML = outBox('실행 결과 — sns.pairplot(df, hue=\'species\')',
      '<div class="chart" id="ppChart"></div>' +
      Charts.legendHTML() +
      note('대각선은 속성별 <b>분포</b>, 나머지 칸은 두 속성의 <b>산점도</b>입니다. ' +
        '점 위에 마우스를 올리면 값이 보입니다. ' +
        '<b>부리 길이 × 지느러미 길이</b> 칸을 보면 세 종이 거의 겹치지 않고 갈라집니다 — ' +
        '분류가 잘 될 것이라는 좋은 신호입니다.'));
    draw('ppChart', function (box) {
      Charts.pairplot(box, POINTS, FEATS, SHORT);
    });
  };

  RUN.runCorr = function (out) {
    var names = ['species', 'island', 'culmen_length_mm', 'culmen_depth_mm',
      'flipper_length_mm', 'body_mass_g', 'sex'];
    var cols = {};
    names.forEach(function (n) {
      cols[n] = CODED.map(function (o) { return o[n]; });
    });
    var M = ML.corrMatrix(cols, names);
    out.innerHTML = outBox('실행 결과 — 상관계수 히트맵',
      '<div class="chart" id="hmChart"></div>' +
      note('첫 번째 줄(<b>종</b>)을 보세요. 지느러미 길이 <b>+0.85</b>, 체질량 <b>+0.75</b>, ' +
        '부리 길이 <b>+0.73</b>, 부리 깊이 <b>−0.74</b> 로 모두 관계가 뚜렷합니다. ' +
        '반면 섬(<b>−0.01</b>)과 성별(<b>+0.01</b>)은 종과 거의 상관이 없습니다 — ' +
        '그래서 다음 단계에서 이 두 속성을 빼냅니다.'));
    draw('hmChart', function (box) { Charts.heatmap(box, M, names, SHORT); });
  };

  RUN.runSelect = function (out) {
    var cols = ['species'].concat(FEATS);
    out.innerHTML = outBox('실행 결과 — 선택된 5개 열 (앞 5행)',
      dfTable(CODED.slice(0, 5), cols) +
      note('<code>species</code>는 이미 숫자로 바뀌어 있습니다 (0=Adelie, 1=Chinstrap, ' +
        '2=Gentoo). 남은 데이터는 <b>' + CODED.length + '행 × 5열</b>입니다.'));
  };

  RUN.runXY = function (out) {
    out.innerHTML = outBox('실행 결과 — X 와 y',
      pyout('>>> X.shape\n(' + X_RAW.length + ', 4)\n>>> X.columns\n' +
        "Index(['culmen_length_mm', 'culmen_depth_mm', 'flipper_length_mm',\n" +
        "       'body_mass_g'], dtype='object')\n\n>>> y.shape\n(" + Y.length + ",)\n" +
        '>>> y.value_counts()\n' +
        '0    ' + Y.filter(function (v) { return v === 0; }).length + '\n' +
        '2    ' + Y.filter(function (v) { return v === 2; }).length + '\n' +
        '1    ' + Y.filter(function (v) { return v === 1; }).length + '\n' +
        'Name: species, dtype: int64') +
      note('<b>X</b>는 모델이 보고 판단할 네 개의 측정값, <b>y</b>는 맞혀야 하는 정답(종)입니다.'));
  };

  RUN.runSplit = function (out) {
    var s = splitOf(false, 0.2);
    out.innerHTML = outBox('실행 결과 — 훈련 / 테스트 분리',
      pyout('>>> X_train.shape, X_test.shape\n((' + s.X_train.length + ', 4), (' +
        s.X_test.length + ', 4))\n>>> y_train.shape, y_test.shape\n((' +
        s.y_train.length + ',), (' + s.y_test.length + ',))') +
      '<div class="tiles" style="margin-top:12px">' +
      tile('훈련 데이터', s.X_train.length + '마리', '모델이 공부하는 데이터 (80%)') +
      tile('테스트 데이터', s.X_test.length + '마리', '실력을 시험하는 데이터 (20%)') +
      '</div>' +
      note('333마리를 섞은 뒤 20%인 67마리를 테스트용으로 떼어 냈습니다. ' +
        '<code>random_state=42</code> 덕분에 몇 번을 실행해도 똑같이 나뉩니다.'));
  };
  function tile(k, v, d, cls) {
    return '<div class="tile"><div class="k">' + k + '</div><div class="v">' + v +
      '</div><div class="d ' + (cls || '') + '">' + d + '</div></div>';
  }

  RUN.runKnnInit = function (out) {
    out.innerHTML = outBox('실행 결과 — 모델 준비 완료',
      pyout('>>> knn\nKNeighborsClassifier(n_neighbors=3)') +
      note('아직 <b>학습하지 않은 빈 모델</b>입니다. 상자만 만들어 둔 상태이며, ' +
        'STEP 5에서 <code>fit()</code>으로 데이터를 넣어 줍니다.'));
  };
  RUN.runLogInit = function (out) {
    out.innerHTML = outBox('실행 결과 — 모델 준비 완료',
      pyout('>>> log_reg\nLogisticRegression(max_iter=2000, random_state=42)') +
      note('<code>max_iter=2000</code>은 확률 계산식을 최대 2000번까지 고쳐 가며 ' +
        '가장 잘 맞는 식을 찾겠다는 뜻입니다.'));
  };

  function predTable(pred, yTest, n) {
    var h = '<div class="tbl-wrap"><table class="df"><thead><tr><th class="idx">번호</th>' +
      '<th>실젯값 y_test</th><th>예측값</th><th>판정</th></tr></thead><tbody>';
    for (var i = 0; i < n; i++) {
      var ok = pred[i] === yTest[i];
      h += '<tr><td class="idx">' + i + '</td><td class="cat">' + yTest[i] + ' · ' +
        SPECIES[yTest[i]] + '</td><td class="cat">' + pred[i] + ' · ' + SPECIES[pred[i]] +
        '</td><td style="text-align:center;font-weight:700;color:' +
        (ok ? 'var(--good-ink)' : 'var(--critical)') + '">' + (ok ? '○' : '×') +
        '</td></tr>';
    }
    return h + '</tbody></table></div>';
  }

  RUN.runKnnFit = function (out) {
    var r = knnOf(false, 3, 0.2);
    out.innerHTML = outBox('실행 결과 — 학습 후 테스트 데이터 예측',
      pyout('>>> y_pred_knn[:12]\narray([' + r.pred.slice(0, 12).join(', ') + '])') +
      predTable(r.pred, r.split.y_test, 12) +
      note('예측값 <b>' + r.pred.length + '개</b>가 만들어졌습니다. 아직 몇 개를 맞혔는지는 ' +
        '세어 보지 않았습니다 — 그 일은 STEP 6의 <code>accuracy_score</code>가 합니다.'));
  };
  RUN.runLogFit = function (out) {
    var r = logOf(false, 0.2);
    out.innerHTML = outBox('실행 결과 — 학습 후 테스트 데이터 예측',
      pyout('>>> y_pred_log_reg[:12]\narray([' + r.pred.slice(0, 12).join(', ') + '])') +
      predTable(r.pred, r.split.y_test, 12) +
      note('로지스틱 회귀는 각 종에 속할 <b>확률</b>을 계산해 가장 높은 종을 적어 냅니다.'));
  };

  RUN.runAcc = function (out) {
    var k = knnOf(false, 3, 0.2), l = logOf(false, 0.2);
    var ak = ML.accuracyScore(k.split.y_test, k.pred);
    var al = ML.accuracyScore(l.split.y_test, l.pred);
    var n = k.split.y_test.length;
    out.innerHTML = outBox('실행 결과 — 정확도',
      pyout('kNN Accuracy : ' + ak + '\nlogistic regression Accuracy: ' + al) +
      '<div class="tiles" style="margin-top:12px">' +
      tile('k-NN 정확도', (ak * 100).toFixed(1) + '%',
        Math.round(ak * n) + ' / ' + n + '마리 맞힘') +
      tile('로지스틱 회귀 정확도', (al * 100).toFixed(1) + '%',
        Math.round(al * n) + ' / ' + n + '마리 맞힘') +
      '</div>' +
      note('로지스틱 회귀가 k-NN 보다 <b>' + ((al - ak) * 100).toFixed(1) +
        '%p</b> 높습니다. 왜 k-NN 이 이렇게 낮을까요? ' +
        '힌트는 <b>체질량(g)과 부리 깊이(mm)의 숫자 크기 차이</b>에 있습니다. ' +
        '마지막 단계에서 해결합니다.'));
  };

  RUN.runConf = function (out) {
    var k = knnOf(false, 3, 0.2), l = logOf(false, 0.2);
    var mk = ML.confusionMatrix(k.split.y_test, k.pred, [0, 1, 2]);
    var ml = ML.confusionMatrix(l.split.y_test, l.pred, [0, 1, 2]);
    var n = k.split.y_test.length;
    out.innerHTML = outBox('실행 결과 — 혼동행렬',
      pyout('kNN Confusion Matrix:\n ' + matStr(mk) +
        '\nlogistic regression Confusion Matrix:\n ' + matStr(ml)) +
      '<div class="grid2" style="margin-top:14px">' +
      '<div><h3 style="font-size:13.5px;margin:0 0 8px">k-NN</h3><div id="cmK"></div></div>' +
      '<div><h3 style="font-size:13.5px;margin:0 0 8px">로지스틱 회귀</h3><div id="cmL"></div></div>' +
      '</div>' +
      note('<b>해석</b> — k-NN 은 Chinstrap(1) 을 Adelie(0) 로 자주 착각했습니다(' +
        mk[1][0] + '마리). 로지스틱 회귀는 거의 모든 종을 제대로 분류했습니다. ' +
        '정확도만 보면 알 수 없던 <b>어떤 종을 어떻게 틀렸는지</b>가 드러납니다.'));
    draw('cmK', function (box) { Charts.confusion(box, mk, n); });
    draw('cmL', function (box) { Charts.confusion(box, ml, n); });
  };
  function matStr(M) {
    return '[' + M.map(function (r, i) {
      return (i ? ' ' : '') + '[' + r.map(function (v) { return pad(v, 2); }).join(' ') + ']';
    }).join('\n ') + ']';
  }

  RUN.runScaler = function (out) {
    var before = FEATS.map(function (fe, j) {
      var col = X_RAW.map(function (r) { return r[j]; });
      return { f: fe, m: ML.mean(col), s: ML.std(col, 0) };
    });
    var Z = Xof(true);
    var after = FEATS.map(function (fe, j) {
      var col = Z.map(function (r) { return r[j]; });
      return { f: fe, m: ML.mean(col), s: ML.std(col, 0) };
    });
    var h = '<div class="tbl-wrap"><table class="df"><thead><tr><th class="idx">속성</th>' +
      '<th>표준화 전 평균</th><th>전 표준편차</th><th>표준화 후 평균</th><th>후 표준편차</th>' +
      '</tr></thead><tbody>';
    before.forEach(function (b, i) {
      h += '<tr><td class="idx">' + SHORT[b.f] + ' (' + UNIT[b.f] + ')</td><td>' +
        b.m.toFixed(2) + '</td><td>' + b.s.toFixed(2) + '</td><td>' +
        after[i].m.toFixed(2) + '</td><td>' + after[i].s.toFixed(2) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    out.innerHTML = outBox('실행 결과 — 모든 속성이 평균 0, 표준편차 1 로 바뀜', h +
      note('체질량 4207g 과 부리 깊이 17mm 가 모두 <b>평균 0, 표준편차 1</b> 이 되었습니다. ' +
        '이제 네 속성이 거리 계산에 <b>똑같은 비중</b>으로 참여합니다. ' +
        '아래 실험실에서 <b>표준화</b> 스위치를 켜 보세요.'));
  };

  /* ============================ 차트 그리기 ============================ */
  // id 당 하나씩만 기억한다(슬라이더를 움직여도 목록이 불어나지 않도록)
  var redraws = {};
  function draw(id, fn) {
    var box = document.getElementById(id);
    if (!box) return;
    fn(box);
    redraws[id] = fn;
  }
  function redrawAll() {
    Object.keys(redraws).forEach(function (id) {
      var box = document.getElementById(id);
      if (box) redraws[id](box); else delete redraws[id];
    });
  }

  /* ========================= 단계 이동 / 진행률 ========================= */
  var steps = $$('.step');
  var nav = $('#stepNav');
  steps.forEach(function (s, i) {
    var li = document.createElement('li');
    li.innerHTML = '<button data-i="' + i + '"><span class="no">' + (i + 1) +
      '</span><span>' + s.dataset.title + '</span><span class="tally"></span></button>';
    nav.appendChild(li);
  });
  function goStep(i) {
    steps.forEach(function (s, j) { s.classList.toggle('active', i === j); });
    $$('#stepNav button').forEach(function (b, j) {
      b.setAttribute('aria-current', i === j ? 'true' : 'false');
    });
    state.step = i; save();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    Charts.hideTip();
  }
  nav.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-i]');
    if (b) goStep(parseInt(b.dataset.i, 10));
  });
  $$('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { goStep(parseInt(b.dataset.go, 10)); });
  });

  function updateProgress() {
    var withBlanks = BLOCKS.filter(function (b) { return b.hasBlanks; });
    var done = withBlanks.filter(function (b) { return state.solved[b.id]; }).length;
    var total = withBlanks.length;
    $('#pgNow').textContent = done;
    $('#pgAll').textContent = total;
    var bar = $('#pgBar');
    bar.setAttribute('aria-valuemax', total);
    bar.setAttribute('aria-valuenow', done);
    $('#pgBar > i').style.width = (total ? (done / total) * 100 : 0) + '%';
    // 단계별 완료 표시
    steps.forEach(function (s, i) {
      var ids = $$('.codeblock', s).map(function (c) { return c.dataset.id; });
      var btn = $$('#stepNav button')[i];
      var no = $('.no', btn), tally = $('.tally', btn);
      if (!ids.length) { no.classList.remove('done'); tally.textContent = ''; return; }
      var d = ids.filter(function (id) { return state.solved[id]; }).length;
      tally.textContent = d + '/' + ids.length;
      no.classList.toggle('done', d === ids.length);
    });
  }

  /* ============================ 확인 문제 ============================ */
  $$('[data-quiz]').forEach(function (q) {
    var fb = $('.feedback', q);
    $$('.opt', q).forEach(function (opt) {
      opt.addEventListener('click', function () {
        var ok = opt.dataset.ok === '1';
        $$('.opt', q).forEach(function (o) { o.classList.remove('right', 'wrong'); });
        opt.classList.add(ok ? 'right' : 'wrong');
        fb.hidden = false;
        fb.className = 'feedback ' + (ok ? 'ok' : 'no');
        fb.innerHTML = ok
          ? '정답입니다. 맞혀야 하는 값이 <b>Adelie·Chinstrap·Gentoo</b> 라는 정해진 범주 ' +
            '세 개 중 하나이므로 <b>분류(Classification)</b> 문제입니다. 그래서 k-NN과 ' +
            '로지스틱 회귀 같은 분류 알고리즘을 씁니다.'
          : '다시 생각해 보세요. 예측해야 하는 값이 <b>숫자</b>인가요, 정해진 <b>범주</b> 중 ' +
            '하나인가요? 또 우리에게 정답(species)이 주어져 있나요?';
      });
    });
  });

  /* ======================== k-NN 동작 체험 (STEP 4) ======================== */
  function initKnnDemo() {
    var pick = $('#knnPick'), kIn = $('#knnK'), axis = $('#knnAxis');
    if (!pick) return;
    var s = splitOf(false, 0.2);
    // 표준화한 공간에서 거리를 계산해야 그림과 투표가 자연스럽게 일치한다
    var sc = ML.standardScaler(X_RAW);
    var trZ = sc.transform(s.X_train), teZ = sc.transform(s.X_test);
    var trainRows = s.X_train.map(function (r, i) {
      var x = {}; FEATS.forEach(function (fe, j) { x[fe] = r[j]; });
      return { x: x, y: s.y_train[i] };
    });
    var testRows = s.X_test.map(function (r, i) {
      var x = {}; FEATS.forEach(function (fe, j) { x[fe] = r[j]; });
      return { x: x, y: s.y_test[i], z: teZ[i] };
    });
    testRows.slice(0, 24).forEach(function (r, i) {
      var o = document.createElement('option');
      o.value = i;
      o.textContent = (i + 1) + '번 · 부리 ' + r.x.culmen_length_mm + 'mm / 지느러미 ' +
        r.x.flipper_length_mm + 'mm (실제: ' + SPECIES[r.y] + ')';
      pick.appendChild(o);
    });
    $('#knnLegend').innerHTML = Charts.legendHTML({ codes: true });

    function render() {
      var i = parseInt(pick.value, 10) || 0;
      var k = parseInt(kIn.value, 10);
      var ax = axis.value.split(',').map(Number);
      $('#knnKv').textContent = k;
      var q = testRows[i];
      var model = ML.KNeighborsClassifier(k).fit(trZ, s.y_train);
      var nb = model.neighbors(q.z, k);
      var guess = model.predictOne(q.z);
      draw('knnChart', function (box) {
        Charts.knnScatter(box, trainRows, q, nb, FEATS[ax[0]], FEATS[ax[1]], SHORT);
      });
      var votes = [0, 0, 0];
      nb.forEach(function (n) { votes[n.label]++; });
      var h = '<h3 style="font-size:14px;margin:0 0 8px">가장 가까운 ' + k + '마리의 투표</h3>' +
        '<div class="tbl-wrap"><table class="df"><thead><tr><th class="idx">순위</th>' +
        '<th>거리</th><th style="text-align:left">그 펭귄의 종</th></tr></thead><tbody>';
      nb.forEach(function (n, r) {
        h += '<tr><td class="idx">' + (r + 1) + '</td><td>' + n.dist.toFixed(3) +
          '</td><td class="cat"><span style="display:inline-block;width:9px;height:9px;' +
          'border-radius:2px;background:var(--sp-' + n.label + ');margin-right:6px"></span>' +
          SPECIES[n.label] + '</td></tr>';
      });
      h += '</tbody></table></div><div class="tiles" style="margin-top:12px">';
      votes.forEach(function (v, c) {
        if (v) h += tile(SPECIES[c] + ' 표', v + '표', Math.round(v / k * 100) + '%');
      });
      h += '</div><div class="feedback ' + (guess === q.y ? 'ok' : 'no') +
        '" style="margin-top:12px">가장 표를 많이 받은 <b>' + SPECIES[guess] +
        '</b> 으로 예측했습니다. 실제 종은 <b>' + SPECIES[q.y] + '</b> → ' +
        (guess === q.y ? '맞혔습니다!' : '틀렸습니다. k 를 바꾸면 결과가 달라질 수 있어요.') +
        '</div>' +
        '<p class="chart-cap">거리는 네 속성을 표준화한 값으로 계산했습니다. ' +
        'k 가 짝수가 되면 동점이 생길 수 있어 보통 <b>홀수</b>를 씁니다.</p>';
      $('#knnVote').innerHTML = h;
    }
    pick.addEventListener('change', render);
    kIn.addEventListener('input', render);
    axis.addEventListener('change', render);
    render();
  }

  /* ========================= 실험실 (STEP 7) ========================= */
  function initLab() {
    var kIn = $('#labK'), tIn = $('#labTest'), stdIn = $('#labStd');
    if (!kIn) return;

    // 표준화가 필요한 이유 — 거리 기여도 비교
    (function () {
      var a = X_RAW[0], b = X_RAW[1];
      var parts = FEATS.map(function (fe, j) {
        return { f: fe, d: Math.abs(a[j] - b[j]) };
      });
      var tot = parts.reduce(function (s, p) { return s + p.d * p.d; }, 0);
      var h = '<p class="lead" style="margin-bottom:12px">예를 들어 1번 펭귄과 2번 펭귄의 ' +
        '거리를 계산해 봅시다. 각 속성이 거리에 <b>얼마나 기여</b>하는지 보세요.</p>' +
        '<div class="tbl-wrap"><table class="df"><thead><tr><th class="idx">속성</th>' +
        '<th>1번</th><th>2번</th><th>차이</th><th>거리 기여도</th></tr></thead><tbody>';
      parts.forEach(function (p, j) {
        var share = (p.d * p.d / tot) * 100;
        h += '<tr><td class="idx">' + SHORT[p.f] + ' (' + UNIT[p.f] + ')</td><td>' + a[j] +
          '</td><td>' + b[j] + '</td><td>' + p.d.toFixed(1) + '</td>' +
          '<td style="font-weight:700"><span class="bar"><i style="width:' +
          share.toFixed(2) + '%"></i></span>' + share.toFixed(2) + '%</td></tr>';
      });
      h += '</tbody></table></div>' +
        '<div class="tip warn" style="margin-top:12px"><b>체질량 하나가 거리의 ' +
        ((parts[3].d * parts[3].d / tot) * 100).toFixed(2) + '% 를 차지합니다.</b> ' +
        '부리 깊이의 1mm 차이는 사실상 무시됩니다. k-NN 은 이 거리로만 판단하므로, ' +
        '표준화하지 않으면 <b>체질량만 보는 모델</b>이 되어 버립니다.</div>';
      $('#scaleWhy').innerHTML = h;
    })();

    function render() {
      var k = parseInt(kIn.value, 10);
      var ts = parseInt(tIn.value, 10) / 100;
      var std = stdIn.checked;
      $('#labKv').textContent = k;
      $('#labTestv').textContent = ts.toFixed(2);
      $('#labBarsK').textContent = k;
      $('#labBarsT').textContent = ts.toFixed(2);

      var cur = {
        knn: knnOf(std, k, ts), log: logOf(std, ts)
      };
      var yTest = cur.knn.split.y_test;
      var n = yTest.length;
      var ak = ML.accuracyScore(yTest, cur.knn.pred);
      var al = ML.accuracyScore(yTest, cur.log.pred);
      // 반대 조건(표준화 전/후) 값
      var other = {
        knn: ML.accuracyScore(knnOf(!std, k, ts).split.y_test, knnOf(!std, k, ts).pred),
        log: ML.accuracyScore(logOf(!std, ts).split.y_test, logOf(!std, ts).pred)
      };
      var dk = (ak - other.knn) * (std ? 1 : -1);

      $('#labTiles').innerHTML =
        tile('k-NN 정확도', (ak * 100).toFixed(1) + '%',
          Math.round(ak * n) + '/' + n + '마리' +
          (std ? ' · 표준화 적용' : ' · 표준화 안 함')) +
        tile('로지스틱 회귀 정확도', (al * 100).toFixed(1) + '%',
          Math.round(al * n) + '/' + n + '마리') +
        tile('표준화로 인한 k-NN 변화',
          (dk >= 0 ? '+' : '') + (dk * 100).toFixed(1) + '%p',
          std ? '표준화 안 했을 때보다' : '표준화했을 때와 비교',
          dk > 0 ? 'up' : '') +
        tile('테스트 데이터 수', n + '마리', '전체 333마리 중 ' + (ts * 100).toFixed(0) + '%');

      var stdKnn = std ? ak : other.knn, rawKnn = std ? other.knn : ak;
      var stdLog = std ? al : other.log, rawLog = std ? other.log : al;
      draw('labBars', function (box) {
        Charts.groupedBars(box, {
          width: 560,
          series: [
            { name: 'k-NN', color: Charts.palette().sp[0] },
            { name: '로지스틱 회귀', color: Charts.palette().sp[2] }
          ],
          groups: [
            { label: '표준화 전', values: [rawKnn, rawLog] },
            { label: '표준화 후', values: [stdKnn, stdLog] }
          ]
        });
      });

      var ks = [];
      for (var i = 1; i <= 25; i += 2) ks.push(i);
      draw('labLine', function (box) {
        Charts.lineChart(box, {
          width: 560, height: 230, x: ks, xLabel: 'n_neighbors (k)', yMin: 0.4,
          series: [
            {
              name: 'k-NN 표준화 전', color: Charts.palette().sp[0],
              values: ks.map(function (kk) {
                var r = knnOf(false, kk, ts);
                return ML.accuracyScore(r.split.y_test, r.pred);
              })
            },
            {
              name: 'k-NN 표준화 후', color: Charts.palette().sp[1],
              values: ks.map(function (kk) {
                var r = knnOf(true, kk, ts);
                return ML.accuracyScore(r.split.y_test, r.pred);
              })
            }
          ]
        });
      });

      var mk = ML.confusionMatrix(yTest, cur.knn.pred, [0, 1, 2]);
      var ml = ML.confusionMatrix(yTest, cur.log.pred, [0, 1, 2]);
      draw('labConfKnn', function (box) { Charts.confusion(box, mk, n); });
      draw('labConfLog', function (box) { Charts.confusion(box, ml, n); });

      var worst = 0, worstPair = null;
      for (var r2 = 0; r2 < 3; r2++) {
        for (var c2 = 0; c2 < 3; c2++) {
          if (r2 !== c2 && mk[r2][c2] > worst) { worst = mk[r2][c2]; worstPair = [r2, c2]; }
        }
      }
      $('#labRead').innerHTML = '<b>지금 결과 해석</b> — ' +
        (std
          ? 'k-NN 정확도가 <b>' + (ak * 100).toFixed(1) + '%</b> 입니다. 표준화를 하지 않으면 <b>' +
            (other.knn * 100).toFixed(1) + '%</b> 였으므로 <b>' +
            ((ak - other.knn) * 100).toFixed(1) + '%p</b> 올랐습니다. ' +
            '네 속성이 같은 비중으로 거리에 참여하게 되었기 때문입니다.'
          : 'k-NN 정확도가 <b>' + (ak * 100).toFixed(1) + '%</b> 입니다. 표준화 스위치를 켜면 <b>' +
            (other.knn * 100).toFixed(1) + '%</b> 로 올라갑니다. 지금은 체질량(g)의 큰 숫자가 ' +
            '거리를 지배하고 있습니다.') +
        (worstPair ? ' 혼동행렬에서는 <b>' + SPECIES[worstPair[0]] + '</b> 을 <b>' +
          SPECIES[worstPair[1]] + '</b> 로 ' + worst + '마리 잘못 분류한 것이 가장 큰 오류입니다.' : '') +
        ' 로지스틱 회귀는 <b>' + (rawLog * 100).toFixed(1) + '% → ' +
        (stdLog * 100).toFixed(1) + '%</b> 로, 표준화에 크게 영향을 받지 않습니다 — ' +
        '거리가 아니라 <b>확률 계산식</b>으로 판단하기 때문입니다.';
    }
    kIn.addEventListener('input', render);
    tIn.addEventListener('input', render);
    stdIn.addEventListener('change', render);
    render();
  }

  /* ===================== 전체 코드 / 복습 퀴즈 (STEP 8) ===================== */
  var FULL_CODE = [
    '# ===== [3] 데이터 전처리 =====',
    'import pandas as pd',
    "df = pd.read_csv('penguins_size.csv')",
    '',
    'df.info()                      # 전체 정보 확인',
    'df.head()                      # 앞의 5개 행',
    'df.describe()                  # 수치형 요약 통계',
    '',
    'df.isna().sum()                # 속성별 결측치 개수',
    'df = df.dropna()               # 결측치 행 삭제',
    '',
    "df['sex'].unique()             # 고유한 값 확인 → '.' 이상치 발견",
    "df = df.drop(df[df['sex'] == '.'].index)   # 이상치 제거",
    '',
    'import seaborn as sns',
    "sns.pairplot(df, hue = 'species')",
    '',
    "df['species'] = df['species'].map({'Adelie': 0, 'Chinstrap': 1, 'Gentoo': 2})",
    "df['sex'] = df['sex'].map({'MALE': 1, 'FEMALE': 0})",
    "df['island'] = df['island'].map({'Torgersen': 0, 'Biscoe': 1, 'Dream': 2})",
    'corr_matrix = df.corr()',
    "sns.heatmap(corr_matrix, annot = True, cmap = 'coolwarm')",
    '',
    "df = df[['species', 'culmen_length_mm', 'culmen_depth_mm',",
    "         'flipper_length_mm', 'body_mass_g']]",
    '',
    "X = df.drop('species', axis=1)",
    "y = df['species']",
    '',
    '# ===== 스스로 해결하기: 표준화 (188쪽) =====',
    'from sklearn.preprocessing import StandardScaler',
    'scaler = StandardScaler()',
    'X = scaler.fit_transform(X)',
    '',
    'from sklearn.model_selection import train_test_split',
    'X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2,',
    '                                                    random_state=42)',
    '',
    '# ===== [4] 알고리즘 선정 =====',
    'from sklearn.neighbors import KNeighborsClassifier',
    'knn = KNeighborsClassifier(n_neighbors = 3)',
    '',
    'from sklearn.linear_model import LogisticRegression',
    'log_reg = LogisticRegression(random_state=42, max_iter = 2000)',
    '',
    '# ===== [5] 모델 학습 =====',
    'knn.fit(X_train, y_train)',
    'y_pred_knn = knn.predict(X_test)',
    '',
    'log_reg.fit(X_train, y_train)',
    'y_pred_log_reg = log_reg.predict(X_test)',
    '',
    '# ===== [6] 성능 평가 =====',
    'from sklearn.metrics import accuracy_score',
    'accuracy_knn = accuracy_score(y_test, y_pred_knn)',
    'accuracy_log_reg = accuracy_score(y_test, y_pred_log_reg)',
    "print('kNN Accuracy :', accuracy_knn)",
    "print('logistic regression Accuracy:', accuracy_log_reg)",
    '',
    'from sklearn.metrics import confusion_matrix',
    'conf_mat_knn = confusion_matrix(y_test, y_pred_knn)',
    'conf_mat_log_reg = confusion_matrix(y_test, y_pred_log_reg)',
    "print('kNN Confusion Matrix:\\n', conf_mat_knn)",
    "print('logistic regression Confusion Matrix:\\n', conf_mat_log_reg)"
  ].join('\n');

  var BANK = [
    { q: 'CSV 파일을 읽어 데이터프레임으로 만든다.', a: 'pd.read_csv()', d: ['pd.DataFrame()', 'pd.open_csv()', 'pd.load()'] },
    { q: '행 수·열 이름·결측치가 아닌 개수·자료형을 한 번에 보여 준다.', a: 'df.info()', d: ['df.head()', 'df.describe()', 'df.shape'] },
    { q: '수치형 속성의 개수·평균·표준편차·사분위수를 계산한다.', a: 'df.describe()', d: ['df.info()', 'df.corr()', 'df.sum()'] },
    { q: '속성별로 결측치가 몇 개인지 센다.', a: 'df.isna().sum()', d: ['df.isna()', 'df.dropna()', 'df.count()'] },
    { q: '결측치가 있는 행을 모두 삭제한다.', a: 'df.dropna()', d: ['df.isna()', 'df.drop()', 'df.fillna()'] },
    { q: '그 속성에 들어 있는 고유한 값만 확인한다.', a: "df['sex'].unique()", d: ["df['sex'].count()", "df['sex'].sum()", "df['sex'].head()"] },
    { q: "sex 값이 '.' 인 이상치 행을 제거한다.", a: "df.drop(df[df['sex'] == '.'].index)", d: ["df.dropna(df['sex'])", "df.remove(df['sex'] == '.')", "df.drop('sex', axis=1)"] },
    { q: '모든 속성 쌍의 산점도를 격자로 그린다.', a: "sns.pairplot(df, hue = 'species')", d: ["sns.heatmap(df)", "sns.scatterplot(df)", "sns.boxplot(df)"] },
    { q: '범주형 값을 딕셔너리 규칙대로 숫자로 바꾼다.', a: "df['species'].map({'Adelie': 0, ...})", d: ["df['species'].replace(0)", "df['species'].astype(int)", "df['species'].unique()"] },
    { q: '속성끼리의 상관계수 행렬을 계산한다.', a: 'df.corr()', d: ['df.describe()', 'df.cov()', 'df.mean()'] },
    { q: '종속 변수 species 를 뺀 나머지를 독립 변수 X 로 만든다.', a: "df.drop('species', axis=1)", d: ["df.drop('species', axis=0)", "df['species']", "df.dropna('species')"] },
    { q: '데이터를 훈련용 80%와 테스트용 20%로 나눈다.', a: 'train_test_split(X, y, test_size=0.2, random_state=42)', d: ['train_test_split(X, y, test_size=0.8)', 'split(X, y, 0.2)', 'StandardScaler(X, y)'] },
    { q: '이웃 3마리를 보고 다수결로 분류하는 모델을 만든다.', a: 'KNeighborsClassifier(n_neighbors = 3)', d: ['KNeighborsRegressor(n_neighbors = 3)', 'KNeighborsClassifier(k = 3)', 'LogisticRegression(n_neighbors = 3)'] },
    { q: '각 종에 속할 확률을 계산하는 분류 모델을 만든다.', a: 'LogisticRegression(random_state=42, max_iter = 2000)', d: ['LinearRegression(max_iter = 2000)', 'LogisticClassifier(max_iter = 2000)', 'KNeighborsClassifier(max_iter = 2000)'] },
    { q: '훈련 데이터로 모델을 학습시킨다.', a: 'knn.fit(X_train, y_train)', d: ['knn.predict(X_train, y_train)', 'knn.score(X_train)', 'knn.train(X_train, y_train)'] },
    { q: '학습한 모델로 테스트 데이터의 종을 예측한다.', a: 'knn.predict(X_test)', d: ['knn.fit(X_test)', 'knn.transform(X_test)', 'knn.score(X_test)'] },
    { q: '맞힌 비율(정확도)을 계산한다.', a: 'accuracy_score(y_test, y_pred_knn)', d: ['accuracy_score(y_pred_knn, X_test)', 'confusion_matrix(y_test, y_pred_knn)', 'score(y_test)'] },
    { q: '어떤 종을 어떤 종으로 틀렸는지 표로 펼쳐 본다.', a: 'confusion_matrix(y_test, y_pred_knn)', d: ['accuracy_score(y_test, y_pred_knn)', 'classification_matrix(y_test)', 'df.corr()'] },
    { q: '모든 속성을 평균 0, 표준편차 1 로 맞춘다.', a: 'StandardScaler()', d: ['MinMaxScaler(0, 1)', 'train_test_split()', 'StandardScaler.corr()'] }
  ];

  function initReview() {
    var box = $('#reviewQuiz');
    if (!box) return;
    function build() {
      var pool = BANK.slice();
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      var qs = pool.slice(0, 10);
      var score = 0, answered = 0;
      box.innerHTML = '<div id="rvList"></div>' +
        '<div class="feedback" id="rvScore" style="margin-top:14px">10문항 중 <b>0</b>문항 응답 · ' +
        '정답 <b>0</b>개</div>' +
        '<div style="margin-top:12px"><button class="btn ghost" id="rvAgain">새 문제로 다시 풀기</button></div>';
      var list = $('#rvList');
      qs.forEach(function (item, qi) {
        var opts = [item.a].concat(item.d);
        for (var i2 = opts.length - 1; i2 > 0; i2--) {
          var j2 = Math.floor(Math.random() * (i2 + 1));
          var t2 = opts[i2]; opts[i2] = opts[j2]; opts[j2] = t2;
        }
        var wrap = document.createElement('div');
        wrap.className = 'quiz';
        wrap.style.cssText = 'padding:14px 0;border-top:1px solid var(--line)';
        wrap.innerHTML = '<p class="q">' + (qi + 1) + '. ' + esc(item.q) + '</p>' +
          '<div class="opts">' + opts.map(function (o, oi) {
            return '<button class="opt" data-v="' + esc(o) + '"><span class="mk">' +
              'ABCD'[oi] + '</span><code style="font-size:12.5px">' + esc(o) + '</code></button>';
          }).join('') + '</div><div class="feedback" hidden></div>';
        list.appendChild(wrap);
        var fb = $('.feedback', wrap);
        $$('.opt', wrap).forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (wrap.dataset.done) return;
            wrap.dataset.done = '1';
            answered++;
            var ok = btn.dataset.v === item.a;
            if (ok) score++;
            $$('.opt', wrap).forEach(function (b2) {
              b2.disabled = true;
              if (b2.dataset.v === item.a) b2.classList.add('right');
            });
            if (!ok) btn.classList.add('wrong');
            fb.hidden = false;
            fb.className = 'feedback ' + (ok ? 'ok' : 'no');
            fb.innerHTML = ok ? '정답입니다.'
              : '정답은 <code>' + esc(item.a) + '</code> 입니다.';
            $('#rvScore').innerHTML = '10문항 중 <b>' + answered + '</b>문항 응답 · 정답 <b>' +
              score + '</b>개' + (answered === 10
                ? (score >= 9 ? ' — 훌륭합니다! 핵심 코드를 모두 이해했어요.'
                  : score >= 7 ? ' — 좋습니다. 틀린 문항의 코드를 다시 확인해 보세요.'
                    : ' — 앞 단계로 돌아가 코드를 한 번 더 실행해 보세요.') : '');
            $('#rvScore').className = 'feedback' + (answered === 10
              ? (score >= 7 ? ' ok' : ' no') : '');
          });
        });
      });
      $('#rvAgain').addEventListener('click', build);
    }
    build();
  }

  /* ============================ 체크리스트 ============================ */
  function initChecks() {
    $$('[data-ck]').forEach(function (cb) {
      var k = cb.dataset.ck;
      cb.checked = !!state.checks[k];
      cb.addEventListener('change', function () {
        state.checks[k] = cb.checked;
        save();
      });
    });
  }

  /* ============================== 테마 ============================== */
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    redrawAll();
  }
  $('#themeBtn').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var next = cur === 'dark' ? 'light' : cur === 'light' ? null : (dark ? 'light' : 'dark');
    state.theme = next;
    save();
    applyTheme(next);
  });
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', function () { redrawAll(); });

  $('#resetBtn').addEventListener('click', function () {
    if (!confirm('저장된 진행 상황(완료한 코드, 체크 표시)을 모두 지울까요?')) return;
    try { localStorage.removeItem(KEY); } catch (e) { }
    location.reload();
  });

  /* ============================== 시작 ============================== */
  $$('.codeblock').forEach(setupBlock);
  updateProgress();
  initChecks();
  initKnnDemo();
  initLab();
  initReview();
  $('#fullCode').textContent = FULL_CODE;
  $('#copyCode').addEventListener('click', function () {
    navigator.clipboard.writeText(FULL_CODE).then(function () {
      $('#copyMsg').textContent = '복사했습니다. 코랩에 붙여 넣으세요.';
      setTimeout(function () { $('#copyMsg').textContent = ''; }, 2600);
    }, function () {
      $('#copyMsg').textContent = '복사가 막혀 있습니다. 코드를 직접 선택해 복사하세요.';
    });
  });
  if (state.theme) applyTheme(state.theme);
  goStep(Math.min(state.step || 0, steps.length - 1));
})();

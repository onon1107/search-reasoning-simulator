// ===== 위젯 정의: 입력/출력, 계산, 대화상자 =====

const CATS = {
  Data: { color: '#ffb35c', label: 'Data' },
  Transform: { color: '#ff8d5c', label: 'Transform' },
  Visualize: { color: '#ff9fa5', label: 'Visualize' },
  Model: { color: '#f4a6d7', label: 'Model' },
  Evaluate: { color: '#9fe0e3', label: 'Evaluate' },
  Image: { color: '#9fc6f5', label: 'Image Analytics', addon: true }
};

const PALETTE_COLORS = ['#3a9fe0', '#e5483a', '#4fb33a', '#b65bd1', '#f0a020', '#888'];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v, d = 3) => (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) ? '?' : (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(d)) : (v.name || v));
const pct = v => (v * 100).toFixed(1) + ' %';

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

// ---------- 데이터 생성 ----------
const PENGUIN_TYPES = {
  species: { type: 'cat', values: ['Adelie', 'Chinstrap', 'Gentoo'] },
  island: { type: 'cat', values: ['Biscoe', 'Dream', 'Torgersen'] },
  sex: { type: 'cat', values: ['FEMALE', 'MALE'] }
};
function penguinTable(roles) {
  const cols = PENGUIN_COLUMNS.map(n => ({ name: n, type: PENGUIN_TYPES[n] ? 'cat' : 'num', values: PENGUIN_TYPES[n]?.values, role: roles[n] || 'feature' }));
  const keep = cols.map((c, i) => i).filter(i => cols[i].role !== 'skip');
  return { id: 'file:p:' + hashStr(JSON.stringify(roles)), name: 'penguins_size.csv', columns: keep.map(i => cols[i]), rows: PENGUIN_ROWS.map(r => keep.map(i => r[i])) };
}
function imageTable(folder) {
  const items = XRAY.dataset(folder);
  return {
    id: 'img:' + folder, name: folder, isImage: true,
    columns: [
      { name: 'image name', type: 'str', role: 'meta' },
      { name: 'image', type: 'image', role: 'meta' },
      { name: 'size', type: 'num', role: 'meta' },
      { name: 'category', type: 'cat', role: 'target', values: XRAY.CLASSES }
    ],
    rows: items.map(it => [it.name, it, it.size, it.category])
  };
}

function describe(t) {
  const feats = t.columns.filter(c => c.role === 'feature');
  const tgt = t.columns.find(c => c.role === 'target');
  const metas = t.columns.filter(c => c.role === 'meta');
  const miss = ML.missingRate(t);
  return {
    n: t.rows.length, feats, tgt, metas, miss,
    lines: [
      `${t.rows.length}개 인스턴스 (instances)`,
      `${feats.length}개 속성 (features) ${miss > 0 ? `<b class="warn">(${(miss * 100).toFixed(1)} % 결측치)</b>` : '(결측치 없음)'}`,
      tgt ? `목표 변수(target): <b>${esc(tgt.name)}</b> (범주 ${tgt.values.length}개)` : '<span class="warn">목표 변수(target) 없음</span>',
      metas.length ? `메타 속성 ${metas.length}개` : '메타 속성 없음'
    ]
  };
}

function renderTable(t, limit = 300, opts = {}) {
  const order = [...t.columns.map((c, i) => ({ c, i })).filter(o => o.c.role === 'target'),
  ...t.columns.map((c, i) => ({ c, i })).filter(o => o.c.role === 'meta'),
  ...t.columns.map((c, i) => ({ c, i })).filter(o => o.c.role === 'feature')];
  const head = order.map(o => `<th class="role-${o.c.role}">${esc(o.c.name)}</th>`).join('');
  const rows = t.rows.slice(0, limit).map((r, ri) => '<tr><td class="rn">' + (ri + 1) + '</td>' + order.map(o => {
    const v = r[o.i];
    if (o.c.type === 'image') return `<td>${opts.thumbs ? `<img class="thumb" src="${XRAY.render(v, 64)}">` : esc(v.name + '.jpeg')}</td>`;
    const miss = ML.isMissing(v);
    return `<td class="${miss ? 'miss' : ''} role-${o.c.role}">${miss ? '?' : esc(fmt(v, o.c.name.startsWith('n') ? 3 : 1))}</td>`;
  }).join('') + '</tr>').join('');
  return `<div class="dtable"><table><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>${t.rows.length > limit ? `<div class="more">… 외 ${t.rows.length - limit}행 (화면에는 ${limit}행까지만 표시)</div>` : ''}</div>`;
}

// ---------- 공통 UI 조각 ----------
const box = (title, inner) => `<fieldset class="obox"><legend>${title}</legend>${inner}</fieldset>`;
const sel = (key, val, options) => `<select data-k="${key}">${options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
const radio = (key, val, options) => options.map(([v, l, dis]) => `<label class="rad ${dis ? 'dis' : ''}"><input type="radio" name="${key}" data-k="${key}" value="${v}" ${val === v ? 'checked' : ''} ${dis ? 'disabled' : ''}> ${l}</label>`).join('');
const num = (key, val, min, max, step = 1) => `<input type="number" data-k="${key}" value="${val}" min="${min}" max="${max}" step="${step}">`;
const chk = (key, val, label) => `<label class="rad"><input type="checkbox" data-k="${key}" ${val ? 'checked' : ''}> ${label}</label>`;

// 대화상자 안 입력요소 → 설정값 자동 반영
function bindInputs(root, node, onChange) {
  root.querySelectorAll('[data-k]').forEach(el => {
    const ev = (el.type === 'range') ? 'input' : 'change';
    el.addEventListener(ev, () => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'number' || el.type === 'range' || el.dataset.num) v = Number(v);
      if (el.type === 'radio' && !el.checked) return;
      onChange ? onChange(el.dataset.k, v, el) : App.setSetting(node, { [el.dataset.k]: v });
    });
  });
}

function learnerStatus(node, inputs) {
  const d = inputs.Data;
  if (!d) return `<div class="note">ℹ️ 학습 데이터(Data)가 연결되지 않았습니다. <b>Learner</b>는 Test and Score에 바로 쓸 수 있고, 데이터를 연결하면 학습된 <b>Model</b>도 출력합니다.</div>`;
  if (node.err) return `<div class="note err">⚠️ ${esc(node.err)}</div>`;
  const n = d.rows.length;
  return `<div class="note ok">✅ 학습 데이터 ${n}개를 받아 모델(Model)을 만들었습니다.<br>출력: <b>Learner</b>(학습 방법) · <b>Model</b>(학습된 모델)</div>`;
}

// 모델 위젯 공통 compute
function learnerCompute(kind) {
  return (node, inp) => {
    const learner = { name: node.title, kind, params: { ...node.settings }, nodeId: node.id };
    const out = { Learner: learner, Model: null };
    if (inp.Data) {
      const d = inp.Data;
      if (!ML.targetCol(d)) throw new Error('데이터에 목표 변수(target)가 없습니다.');
      if (!ML.featureCols(d).length) throw new Error('속성(feature)이 없습니다. 이미지는 Image Embedding을 거쳐야 합니다.');
      const key = kind + JSON.stringify(learner.params) + d.id;
      out.Model = { learner, data: d, key, get() { return App.cache('model:' + key, () => ML.fit(learner, d)); } };
    }
    return out;
  };
}

// ======================================================
const WIDGETS = {
  // ---------------- Data ----------------
  File: {
    cat: 'Data', icon: '📁', inputs: [], outputs: [{ name: 'Data', type: 'data' }],
    defaults: () => ({ dataset: '', roles: {} }),
    compute(node) {
      if (!node.settings.dataset) return {};
      return { Data: penguinTable(node.settings.roles) };
    },
    dialog(node, inp, body) {
      const s = node.settings;
      node._pending = node._pending || { ...s.roles };
      let html = box('Source', `<label class="rad"><input type="radio" checked> File:</label> ${sel('dataset', s.dataset, [['', '(파일을 선택하세요)'], ['penguins', 'penguins_size.csv']])}
        <div class="hint">💡 실제 Orange에서는 📂 버튼으로 내려받은 CSV 파일을 선택합니다.</div>`);
      if (s.dataset) {
        const t = penguinTable(s.roles);
        const d = describe(t);
        html += box('Info', `penguins_size.csv<br>${d.lines.join('<br>')}`);
        html += box('Columns (더블 클릭하여 편집)', `<table class="cols"><thead><tr><th></th><th>Name</th><th>Type</th><th>Role</th><th>Values</th></tr></thead><tbody>
          ${PENGUIN_COLUMNS.map((c, i) => {
          const ty = PENGUIN_TYPES[c] ? 'categorical' : 'numeric';
          const role = node._pending[c] || 'feature';
          return `<tr class="${role !== (s.roles[c] || 'feature') ? 'changed' : ''}"><td>${i + 1}</td><td>${c}</td><td><span class="ty ${ty}">${ty === 'numeric' ? 'N' : 'C'}</span> ${ty}</td>
            <td><select data-role="${c}">${['feature', 'target', 'meta', 'skip'].map(r => `<option ${r === role ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
            <td class="vals">${PENGUIN_TYPES[c] ? PENGUIN_TYPES[c].values.join(', ') : ''}</td></tr>`;
        }).join('')}</tbody></table>
          <div class="btnrow"><button data-act="reset">Reset</button><button class="primary" data-act="apply">Apply</button></div>
          ${JSON.stringify(node._pending) !== JSON.stringify(s.roles) ? '<div class="note warn">변경 사항이 아직 적용되지 않았습니다. <b>Apply</b>를 누르세요.</div>' : ''}`);
      }
      body.innerHTML = html;
      bindInputs(body, node, (k, v) => { node._pending = {}; App.setSetting(node, { dataset: v, roles: {} }); });
      body.querySelectorAll('[data-role]').forEach(el => el.addEventListener('change', () => { node._pending[el.dataset.role] = el.value; App.rerenderDialog(); }));
      body.querySelector('[data-act=apply]')?.addEventListener('click', () => {
        const roles = {}; Object.entries(node._pending).forEach(([k, v]) => { if (v !== 'feature') roles[k] = v; });
        if (Object.values(roles).filter(r => r === 'target').length > 1) return App.toast('target은 하나만 지정할 수 있어요.', 'err');
        node._pending = { ...roles }; App.setSetting(node, { roles }); App.toast('적용되었습니다 (Apply)');
      });
      body.querySelector('[data-act=reset]')?.addEventListener('click', () => { node._pending = { ...s.roles }; App.rerenderDialog(); });
    }
  },

  'Data Table': {
    cat: 'Data', icon: '📋', inputs: [{ name: 'Data', type: 'data' }], outputs: [{ name: 'Data', type: 'data' }],
    defaults: () => ({}), wide: true,
    compute(node, inp) { return { Data: inp.Data || null }; },
    dialog(node, inp, body) {
      const t = inp.Data;
      if (!t) { body.innerHTML = '<div class="note">입력 데이터가 없습니다. 다른 위젯의 출력을 Data Table에 연결하세요.</div>'; return; }
      const d = describe(t);
      body.innerHTML = `<div class="split"><div class="side">${box('Info', d.lines.join('<br>'))}
        ${box('Variables', chk('thumbs', node.settings.thumbs, '이미지 미리보기') + '<div class="hint">색상: <span class="role-target">목표</span> · <span class="role-meta">메타</span> · 속성</div>')}</div>
        <div class="main">${renderTable(t, 300, { thumbs: node.settings.thumbs })}</div></div>`;
      bindInputs(body, node);
    }
  },

  // ---------------- Transform ----------------
  Preprocess: {
    cat: 'Transform', icon: '🧹', inputs: [{ name: 'Data', type: 'data' }], outputs: [{ name: 'Preprocessed Data', type: 'data' }],
    defaults: () => ({ steps: [] }),
    compute(node, inp) {
      const t = inp.Data; if (!t) return {};
      let rows = t.rows.slice(), cols = t.columns;
      const fIdx = cols.map((c, i) => i).filter(i => cols[i].role === 'feature');
      for (const st of node.settings.steps) {
        if (st.type === 'impute') {
          if (st.method === 'remove') rows = rows.filter(r => fIdx.every(i => !ML.isMissing(r[i])));
          else {
            const r0 = ML.rng(5);
            const fill = fIdx.map(i => {
              const vals = rows.map(r => r[i]).filter(v => !ML.isMissing(v));
              if (cols[i].type === 'num') return vals.reduce((a, b) => a + b, 0) / vals.length;
              const cnt = {}; vals.forEach(v => cnt[v] = (cnt[v] || 0) + 1); return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
            });
            rows = rows.map(r => { const n = r.slice(); fIdx.forEach((i, q) => { if (ML.isMissing(n[i])) { if (st.method === 'random') { const vals = rows.map(x => x[i]).filter(v => !ML.isMissing(v)); n[i] = vals[Math.floor(r0() * vals.length)]; } else n[i] = cols[i].type === 'num' ? +fill[q].toFixed(2) : fill[q]; } }); return n; });
          }
        } else if (st.type === 'normalize') {
          fIdx.filter(i => cols[i].type === 'num').forEach(i => {
            const vals = rows.map(r => r[i]).filter(v => !ML.isMissing(v));
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length, sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
            const mn = Math.min(...vals), mx = Math.max(...vals);
            rows = rows.map(r => { const n = r.slice(); if (!ML.isMissing(n[i])) n[i] = st.method === 'interval' ? -1 + 2 * (n[i] - mn) / (mx - mn || 1) : (n[i] - mean) / sd; return n; });
          });
        }
      }
      return { 'Preprocessed Data': { ...t, id: t.id + '|pp:' + hashStr(JSON.stringify(node.settings.steps)), rows } };
    },
    dialog(node, inp, body) {
      const steps = node.settings.steps;
      const avail = [['impute', '🩹 Impute Missing Values', '결측치 처리'], ['normalize', '📏 Normalize Features', '정규화'], ['discretize', '📊 Discretize Continuous Variables', ''], ['continuize', '🔢 Continuize Discrete Variables', ''], ['select', '⭐ Select Relevant Features', ''], ['randomize', '🎲 Randomize', '']];
      const panel = st => {
        if (st.type === 'impute') return `<div class="pstep"><div class="ptitle">🩹 Impute Missing Values <button class="x" data-del="${st.type}">✕</button></div>
          ${radio('m_impute', st.method, [['avg', 'Average/Most frequent (평균/최빈값으로 채우기)'], ['random', 'Replace with random value (임의의 값으로 채우기)'], ['remove', 'Remove rows with missing values (결측치가 있는 행 제거)']])}</div>`;
        return `<div class="pstep"><div class="ptitle">📏 Normalize Features <button class="x" data-del="${st.type}">✕</button></div>
          ${radio('m_normalize', st.method, [['std', 'Standardize to μ=0, σ²=1'], ['interval', 'Normalize to interval [-1, 1]']])}</div>`;
      };
      const t = inp.Data, out = node.out['Preprocessed Data'];
      body.innerHTML = `<div class="split"><div class="side">${box('Preprocessors', `<div class="plist">${avail.map(([k, l, d]) =>
        `<button class="pitem" data-add="${k}" ${['impute', 'normalize'].includes(k) ? '' : 'disabled title="이 실습에서는 사용하지 않아요"'}>${l}</button>`).join('')}</div>
        <div class="hint">항목을 클릭(Orange에서는 더블 클릭/드래그)하면 오른쪽에 추가됩니다.</div>`)}</div>
        <div class="main">${steps.length ? steps.map(panel).join('') : '<div class="dropzone">왼쪽 목록에서 전처리 방법을 추가하세요.</div>'}
        ${t ? `<div class="note">입력 ${t.rows.length}행 → 출력 <b>${out ? out.rows.length : '-'}</b>행 ${out && t.rows.length !== out.rows.length ? `(${t.rows.length - out.rows.length}행 제거됨)` : ''}<br>결측치 비율: ${(ML.missingRate(t) * 100).toFixed(1)}% → <b>${out ? (ML.missingRate(out) * 100).toFixed(1) : '-'}%</b></div>` : '<div class="note">입력 데이터가 없습니다.</div>'}</div></div>`;
      body.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.add; if (steps.find(s => s.type === k)) return App.toast('이미 추가되어 있어요.');
        App.setSetting(node, { steps: [...steps, { type: k, method: k === 'impute' ? 'avg' : 'std' }] });
      }));
      body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => App.setSetting(node, { steps: steps.filter(s => s.type !== b.dataset.del) })));
      bindInputs(body, node, (k, v) => App.setSetting(node, { steps: steps.map(s => s.type === k.slice(2) ? { ...s, method: v } : s) }));
    }
  },

  'Data Sampler': {
    cat: 'Transform', icon: '✂️', inputs: [{ name: 'Data', type: 'data' }], outputs: [{ name: 'Data Sample', type: 'data' }, { name: 'Remaining Data', type: 'data' }],
    defaults: () => ({ mode: 'prop', prop: 70, size: 1, replicable: true, stratify: false, seed: 1 }),
    compute(node, inp) {
      const t = inp.Data; if (!t) return {};
      const s = node.settings, r = ML.rng(s.replicable ? 12345 : s.seed);
      const n = t.rows.length;
      const k = s.mode === 'prop' ? Math.round(n * s.prop / 100) : Math.min(n, s.size);
      let chosen;
      const tc = ML.targetCol(t);
      if (s.stratify && tc) {
        chosen = [];
        const groups = {}; t.rows.forEach((row, i) => (groups[row[tc.i]] = groups[row[tc.i]] || []).push(i));
        Object.values(groups).forEach(g => chosen.push(...ML.shuffle(g, r).slice(0, Math.round(g.length * k / n))));
      } else chosen = ML.shuffle([...Array(n).keys()], r).slice(0, k);
      const set = new Set(chosen);
      const rest = [...Array(n).keys()].filter(i => !set.has(i));
      const key = hashStr(JSON.stringify(s));
      return { 'Data Sample': ML.subset(t, chosen.sort((a, b) => a - b), 'S' + key), 'Remaining Data': ML.subset(t, rest, 'R' + key) };
    },
    dialog(node, inp, body) {
      const s = node.settings, t = inp.Data, o = node.out;
      body.innerHTML = box('Sampling Type', `${radio('mode', s.mode, [['prop', 'Fixed proportion of data:'], ['size', 'Fixed sample size']])}
          <div class="slider"><input type="range" min="0" max="100" value="${s.prop}" data-k="prop"><span class="sv">${s.prop} %</span></div>
          ${s.mode === 'size' ? `<div>Instances: ${num('size', s.size, 1, t ? t.rows.length : 999)}</div>` : ''}
          ${radio('dis', '', [['cv', 'Cross validation', 1], ['boot', 'Bootstrap', 1]])}`)
        + box('Options', chk('replicable', s.replicable, 'Replicable (deterministic) sampling (항상 같은 결과)') + chk('stratify', s.stratify, 'Stratify sample (when possible) (클래스 비율 유지)'))
        + `<div class="btnrow"><button class="primary" data-act="sample">Sample Data</button></div>`
        + (t ? `<div class="note">입력 ${t.rows.length}개 →<br>🟢 <b>Data Sample</b>(훈련 데이터): <b>${o['Data Sample']?.rows.length}</b>개<br>🔵 <b>Remaining Data</b>(테스트 데이터): <b>${o['Remaining Data']?.rows.length}</b>개
           <div class="ratio"><div style="width:${s.mode === 'prop' ? s.prop : 100 * (o['Data Sample']?.rows.length || 0) / t.rows.length}%"></div></div></div>` : '<div class="note">입력 데이터가 없습니다.</div>');
      body.querySelector('input[type=range]').addEventListener('input', e => body.querySelector('.sv').textContent = e.target.value + ' %');
      body.querySelector('input[type=range]').addEventListener('change', e => App.setSetting(node, { prop: +e.target.value }));
      body.querySelector('[data-act=sample]').addEventListener('click', () => { App.setSetting(node, { seed: Math.floor(Math.random() * 1e9) }); App.toast('데이터를 다시 샘플링했습니다.'); });
      bindInputs(body, node, (k, v) => { if (k !== 'prop') App.setSetting(node, { [k]: v }); });
    }
  },

  // ---------------- Visualize ----------------
  'Scatter Plot': {
    cat: 'Visualize', icon: '✳️', inputs: [{ name: 'Data', type: 'data' }], outputs: [], wide: true,
    defaults: () => ({ x: '', y: '', color: '', views: [] }),
    compute() { return {}; },
    dialog(node, inp, body) {
      const t = inp.Data;
      if (!t) { body.innerHTML = '<div class="note">입력 데이터가 없습니다.</div>'; return; }
      const numc = t.columns.filter(c => c.type === 'num' && c.role !== 'skip');
      const catc = t.columns.filter(c => c.type === 'cat');
      const s = node.settings;
      if (!numc.find(c => c.name === s.x)) s.x = numc[0]?.name || '';
      if (!numc.find(c => c.name === s.y)) s.y = numc[1]?.name || numc[0]?.name || '';
      App.markView(node);
      body.innerHTML = `<div class="split"><div class="side">${box('Axes', `<div class="frow">Axis x: ${sel('x', s.x, numc.map(c => c.name))}</div><div class="frow">Axis y: ${sel('y', s.y, numc.map(c => c.name))}</div>`)}
        ${box('Attributes', `<div class="frow">Color: ${sel('color', s.color, [['', '(Same color)'], ...catc.map(c => c.name)])}</div>`)}
        <div class="note">본 조합: ${s.views.length}가지<br><small>${s.views.map(v => esc(v.replace('|', ' × '))).join('<br>')}</small></div></div>
        <div class="main"><canvas class="plot" width="640" height="480"></canvas></div></div>`;
      bindInputs(body, node);
      drawScatter(body.querySelector('canvas'), t, s.x, s.y, s.color);
    }
  },

  // ---------------- Model ----------------
  kNN: {
    cat: 'Model', icon: '🎯', inputs: [{ name: 'Data', type: 'data' }], outputs: [{ name: 'Learner', type: 'learner' }, { name: 'Model', type: 'model' }],
    defaults: () => ({ k: 5, metric: 'Euclidean', weight: 'Uniform' }),
    compute: learnerCompute('knn'),
    dialog(node, inp, body) {
      const s = node.settings;
      body.innerHTML = box('Neighbors', `<div class="frow">Number of neighbors (k): ${num('k', s.k, 1, 100)}</div><div class="frow">Metric: ${sel('metric', s.metric, ['Euclidean', 'Manhattan'])}</div><div class="frow">Weight: ${sel('weight', s.weight, [['Uniform', 'Uniform (동일)'], ['Distance', 'By Distances (거리 반비례)']])}</div>`)
        + `<div class="hint">💡 새 데이터와 가장 가까운 k개의 이웃이 가장 많이 속한 클래스로 분류합니다.</div>` + learnerStatus(node, inp);
      bindInputs(body, node);
    }
  },
  'Logistic Regression': {
    cat: 'Model', icon: '📈', inputs: [{ name: 'Data', type: 'data' }], outputs: [{ name: 'Learner', type: 'learner' }, { name: 'Model', type: 'model' }],
    defaults: () => ({ reg: 'L2', C: 1 }),
    compute: learnerCompute('logreg'),
    dialog(node, inp, body) {
      const s = node.settings;
      body.innerHTML = box('Regularization', `<div class="frow">Regularization type: ${sel('reg', s.reg, [['L1', 'Lasso (L1)'], ['L2', 'Ridge (L2)'], ['none', 'None']])}</div><div class="frow">Strength C: ${sel('C', s.C, [0.001, 0.01, 0.1, 1, 10, 100, 1000])}</div>`)
        + `<div class="hint">💡 속성값에 가중치를 곱해 더한 값을 확률(0~1)로 바꿔 각 클래스일 가능성을 계산합니다. C가 작을수록 규제가 강해집니다.<br><small>(시뮬레이션에서는 L1을 L2와 같은 방식으로 계산합니다.)</small></div>` + learnerStatus(node, inp);
      bindInputs(body, node, (k, v) => App.setSetting(node, { [k]: k === 'C' ? Number(v) : v }));
    }
  },
  'Random Forest': {
    cat: 'Model', icon: '🌳', inputs: [{ name: 'Data', type: 'data' }], outputs: [{ name: 'Learner', type: 'learner' }, { name: 'Model', type: 'model' }],
    defaults: () => ({ trees: 10, minSplit: 5, maxDepth: 20 }),
    compute: learnerCompute('rf'),
    dialog(node, inp, body) {
      const s = node.settings;
      body.innerHTML = box('Basic Properties', `<div class="frow">Number of trees: ${num('trees', s.trees, 1, 100)}</div>`)
        + box('Growth Control', `<div class="frow">Limit depth of individual trees: ${num('maxDepth', s.maxDepth, 1, 50)}</div><div class="frow">Do not split subsets smaller than: ${num('minSplit', s.minSplit, 2, 50)}</div>`)
        + `<div class="hint">💡 데이터를 무작위로 뽑아 여러 개의 의사결정나무를 만들고, 나무들의 투표로 분류합니다.</div>` + learnerStatus(node, inp);
      bindInputs(body, node);
    }
  },
  'Neural Network': {
    cat: 'Model', icon: '🧠', inputs: [{ name: 'Data', type: 'data' }], outputs: [{ name: 'Learner', type: 'learner' }, { name: 'Model', type: 'model' }],
    defaults: () => ({ hidden: 100, activation: 'ReLu', solver: 'Adam', alpha: 0.0001, maxIter: 200 }),
    compute: learnerCompute('nn'),
    dialog(node, inp, body) {
      const s = node.settings;
      body.innerHTML = box('Network', `<div class="frow">Neurons in hidden layers: ${num('hidden', s.hidden, 1, 300)}</div><div class="frow">Activation: ${sel('activation', s.activation, ['Logistic', 'tanh', 'ReLu'])}</div><div class="frow">Solver: ${sel('solver', s.solver, ['Adam'])}</div><div class="frow">Regularization α: ${sel('alpha', s.alpha, [0.0001, 0.001, 0.01, 0.1, 1])}</div>`)
        + box('Optimization', `<div class="frow">Maximal number of iterations: ${num('maxIter', s.maxIter, 10, 1000, 10)}</div>`)
        + `<div class="hint">💡 입력층 → 은닉층(뉴런 ${s.hidden}개) → 출력층으로 이루어진 인공신경망(다층 퍼셉트론)입니다.</div>` + learnerStatus(node, inp);
      bindInputs(body, node, (k, v) => App.setSetting(node, { [k]: ['alpha'].includes(k) ? Number(v) : v }));
    }
  },

  // ---------------- Evaluate ----------------
  'Test and Score': {
    cat: 'Evaluate', icon: '🏁', wide: true,
    inputs: [{ name: 'Data', type: 'data' }, { name: 'Test Data', type: 'data' }, { name: 'Learner', type: 'learner', multi: true }],
    outputs: [{ name: 'Evaluation Results', type: 'eval' }],
    defaults: () => ({ method: 'cv', folds: 5 }),
    compute(node, inp) {
      if (!inp.Data) return {};
      if (!inp.Learner.length) return {};
      if (!ML.targetCol(inp.Data)) throw new Error('데이터에 목표 변수(target)가 없습니다.');
      if (node.settings.method === 'test' && !inp['Test Data']) throw new Error("'Test on test data'를 선택했지만 Test Data 입력이 없습니다.");
      const s = { ...node.settings }, key = 'eval:' + hashStr(JSON.stringify([inp.Data.id, s.method === 'test' ? inp['Test Data'].id : '', s, inp.Learner.map(l => [l.name, l.kind, l.params])]));
      const learners = inp.Learner, data = inp.Data, test = inp['Test Data'];
      return { 'Evaluation Results': { key, get: () => App.cache(key, () => ML.evaluate(learners, data, test, s.method, s.folds, 42)), ready: () => App.hasCache(key) } };
    },
    dialog(node, inp, body) {
      const s = node.settings;
      const side = box('Sampling', `${radio('method', s.method, [['cv', 'Cross validation (교차검증)']])}
        <div class="frow sub">Number of folds: ${sel('folds', s.folds, [2, 3, 5, 10])}</div>
        ${radio('method', s.method, [['rs', 'Random sampling', 1], ['loo', 'Leave one out', 1], ['train', 'Test on train data (훈련 데이터로 평가)'], ['test', 'Test on test data (테스트 데이터로 평가)']])}`);
      const warn = [];
      if (!inp.Data) warn.push('Data 입력이 없습니다.');
      if (!inp.Learner.length) warn.push('Learner(모델 위젯) 입력이 없습니다.');
      if (s.method !== 'test' && inp['Test Data']) warn.push("Test Data가 연결되어 있지만 사용되지 않습니다. 'Test on test data'를 선택하세요.");
      if (node.err) warn.push(node.err);
      const ev = node.out['Evaluation Results'];
      body.innerHTML = `<div class="split"><div class="side">${side}</div><div class="main">
        ${warn.map(w => `<div class="note warn">⚠️ ${esc(w)}</div>`).join('')}
        <div class="res">${ev ? '<div class="spin">⏳ 평가 중...</div>' : ''}</div></div></div>`;
      bindInputs(body, node, (k, v) => App.setSetting(node, { [k]: k === 'folds' ? Number(v) : v }));
      if (ev) App.runAsync(() => ev.get(), r => {
        const el = body.querySelector('.res'); if (!el) return;
        const best = Math.max(...r.results.map(x => x.CA));
        el.innerHTML = `<div class="cap">${s.method === 'cv' ? `${s.folds}-겹 층화 교차검증` : s.method === 'test' ? '테스트 데이터로 평가' : '훈련 데이터로 평가'} · 평가 데이터 ${r.n}개 · Target class: (Average over classes)</div>
          <table class="score"><thead><tr><th>Model</th><th title="ROC 곡선 아래 면적">AUC</th><th title="분류 정확도">CA</th><th>F1</th><th title="정밀도">Prec</th><th title="재현율">Recall</th></tr></thead><tbody>
          ${r.results.map(x => `<tr class="${x.CA === best ? 'best' : ''}"><td>${esc(x.name)}</td>${['AUC', 'CA', 'F1', 'Prec', 'Recall'].map(m => `<td>${fmt(x[m])}</td>`).join('')}</tr>`).join('')}</tbody></table>
          <div class="hint">💡 CA(Classification Accuracy)=정확도, Prec=정밀도, Recall=재현율, F1=정밀도와 재현율의 조화평균, AUC=ROC 곡선 아래 면적(1에 가까울수록 좋음). 가장 높은 CA는 굵게 표시됩니다.</div>`;
        App.checkMissions();
      });
    }
  },
  'Confusion Matrix': {
    cat: 'Evaluate', icon: '🔲', inputs: [{ name: 'Evaluation Results', type: 'eval' }], outputs: [], wide: true,
    defaults: () => ({ learner: 0, show: 'n' }),
    compute() { return {}; },
    dialog(node, inp, body) {
      const ev = inp['Evaluation Results'];
      if (!ev) { body.innerHTML = '<div class="note">평가 결과(Evaluation Results)가 없습니다. Test and Score 위젯과 연결하세요.</div>'; return; }
      body.innerHTML = '<div class="spin">⏳ 평가 중...</div>';
      App.runAsync(() => ev.get(), r => {
        const s = node.settings; const li = Math.min(s.learner, r.results.length - 1);
        const R = r.results[li], K = r.classes.length, cm = R.cm;
        const rowS = cm.map(row => row.reduce((a, b) => a + b, 0)), colS = r.classes.map((_, j) => cm.reduce((a, row) => a + row[j], 0));
        const cell = (v, i, j) => s.show === 'n' ? v : s.show === 'pred' ? (colS[j] ? pct(v / colS[j]) : '-') : (rowS[i] ? pct(v / rowS[i]) : '-');
        body.innerHTML = `<div class="split"><div class="side">${box('Learners', r.results.map((x, i) => `<label class="rad"><input type="radio" name="lrn" data-k="learner" data-num="1" value="${i}" ${i === li ? 'checked' : ''}> ${esc(x.name)}</label>`).join(''))}
          ${box('Show', sel('show', s.show, [['n', 'Number of instances'], ['pred', 'Proportion of predicted'], ['act', 'Proportion of actual']]))}</div>
          <div class="main"><div class="cmwrap"><table class="cm"><tr><td></td><td></td><th colspan="${K + 1}">Predicted (예측)</th></tr>
          <tr><td></td><td></td>${r.classes.map(c => `<th>${esc(c)}</th>`).join('')}<th>Σ</th></tr>
          ${cm.map((row, i) => `<tr>${i === 0 ? `<th rowspan="${K + 1}" class="vert">Actual<br>(실제)</th>` : ''}<th>${esc(r.classes[i])}</th>${row.map((v, j) => `<td class="${i === j ? 'diag' : v ? 'off' : ''}" style="--a:${rowS[i] ? v / rowS[i] : 0}">${cell(v, i, j)}</td>`).join('')}<td class="sum">${rowS[i]}</td></tr>`).join('')}
          <tr><th>Σ</th>${colS.map(v => `<td class="sum">${v}</td>`).join('')}<td class="sum">${rowS.reduce((a, b) => a + b, 0)}</td></tr></table></div>
          <div class="hint">💡 대각선(초록)은 맞게 분류한 개수, 나머지(빨강)는 잘못 분류한 개수입니다. 행은 실제 정답, 열은 모델의 예측입니다.<br>👉 <b>${esc(R.name)}</b>: 전체 ${R.actual.length}개 중 ${cm.reduce((a, row, i) => a + row[i], 0)}개 정답 (정확도 ${pct(R.CA)})</div></div></div>`;
        bindInputs(body, node);
        App.checkMissions();
      });
    }
  },
  Predictions: {
    cat: 'Evaluate', icon: '🔮', inputs: [{ name: 'Data', type: 'data' }, { name: 'Predictors', type: 'model', multi: true }], outputs: [], wide: true,
    defaults: () => ({ onlyWrong: false }),
    compute(node, inp) { return {}; },
    dialog(node, inp, body) {
      const d = inp.Data, models = inp.Predictors;
      if (!d || !models.length) { body.innerHTML = `<div class="note">${!d ? '예측할 데이터(Data)' : ''}${!d && !models.length ? '와 ' : ''}${!models.length ? '학습된 모델(Predictors)' : ''}이(가) 연결되지 않았습니다.<br><small>모델 위젯에 훈련 데이터를 연결하면 Model 출력이 생깁니다.</small></div>`; return; }
      body.innerHTML = '<div class="spin">⏳ 예측 중...</div>';
      App.runAsync(() => {
        const tc = ML.targetCol(d);
        return models.map(m => {
          const model = m.get();
          if (tc) { const trc = ML.targetCol(m.data); if (trc.c.name !== tc.c.name) throw new Error('모델과 데이터의 목표 변수가 다릅니다.'); }
          const probs = model.predictRows(d.rows);
          const sc = tc ? ML.scores(d.rows.map(r => model.classes.indexOf(r[tc.i])), probs, model.classes.length) : null;
          return { name: m.learner.name, classes: model.classes, probs, sc };
        });
      }, res => {
        const tc = ML.targetCol(d), imgI = d.columns.findIndex(c => c.type === 'image'), nameI = d.columns.findIndex(c => c.name === 'image name');
        const P = res[0];
        let rows = d.rows.map((r, i) => ({ r, i, wrong: tc && P.classes[P.sc.pred[i]] !== r[tc.i] }));
        if (node.settings.onlyWrong) rows = rows.filter(x => x.wrong);
        body.innerHTML = `<div class="split"><div class="side">${box('Show', chk('onlyWrong', node.settings.onlyWrong, `잘못 분류된 행만 보기 (${res[0].name} 기준)`))}
          ${tc ? box('Info', `데이터 ${d.rows.length}개<br>${res.map(x => `${esc(x.name)}: 오분류 <b>${x.sc.pred.filter((p, i) => x.classes[p] !== d.rows[i][tc.i]).length}</b>개`).join('<br>')}`) : ''}</div>
          <div class="main"><div class="dtable"><table><thead><tr><th></th>${res.map(x => `<th class="pred">${esc(x.name)}</th>`).join('')}${tc ? `<th class="role-target">${esc(tc.c.name)}</th>` : ''}${imgI >= 0 ? '<th>image</th>' : ''}${nameI >= 0 ? '<th>image name</th>' : ''}</tr></thead><tbody>
          ${rows.slice(0, 300).map(({ r, i, wrong }) => `<tr class="${wrong ? 'wrongrow' : ''}"><td class="rn">${i + 1}</td>${res.map(x => { const p = x.probs[i], k = p.indexOf(Math.max(...p)); return `<td class="pred ${tc && x.classes[k] !== r[tc.i] ? 'wrong' : ''}"><b>${esc(x.classes[k])}</b> <small>(${p.map(v => v.toFixed(2)).join(' : ')})</small></td>`; }).join('')}
          ${tc ? `<td class="role-target">${esc(r[tc.i])}</td>` : ''}${imgI >= 0 ? `<td><img class="thumb" src="${XRAY.render(r[imgI], 64)}"></td>` : ''}${nameI >= 0 ? `<td>${esc(r[nameI])}</td>` : ''}</tr>`).join('')}</tbody></table></div>
          ${tc ? `<table class="score"><thead><tr><th>Model</th><th>AUC</th><th>CA</th><th>F1</th><th>Prec</th><th>Recall</th></tr></thead><tbody>${res.map(x => `<tr><td>${esc(x.name)}</td>${['AUC', 'CA', 'F1', 'Prec', 'Recall'].map(m => `<td>${fmt(x.sc[m])}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}
          <div class="hint">💡 괄호 안 숫자는 각 클래스(${esc(P.classes.join(' : '))})일 확률입니다. 빨간색은 실제 정답과 다르게 예측한 경우입니다.</div></div></div>`;
        bindInputs(body, node);
        node._predWrong = tc ? P.sc.pred.filter((p, i) => P.classes[p] !== d.rows[i][tc.i]).length : null;
        App.checkMissions();
      }, err => body.innerHTML = `<div class="note err">⚠️ ${esc(err.message)}</div>`);
    }
  },

  // ---------------- Image Analytics (Add-on) ----------------
  'Import Images': {
    cat: 'Image', icon: '🖼️', inputs: [], outputs: [{ name: 'Data', type: 'data' }],
    defaults: () => ({ folder: '' }),
    compute(node) { return node.settings.folder ? { Data: imageTable(node.settings.folder) } : {}; },
    dialog(node, inp, body) {
      const s = node.settings;
      const counts = s.folder ? XRAY.SPLIT[s.folder] : null;
      body.innerHTML = box('Folder', `📂 ${sel('folder', s.folder, [['', '(폴더를 선택하세요)'], ['train', 'Covid19-dataset/train'], ['test', 'Covid19-dataset/test']])}
        <div class="hint">💡 하위 폴더 이름(Covid, Normal, Viral Pneumonia)이 이미지의 범주(category)가 됩니다.</div>`)
        + (counts ? `<div class="note ok">✅ ${counts.reduce((a, b) => a + b, 0)}개 이미지, ${XRAY.CLASSES.length}개 범주<br>${XRAY.CLASSES.map((c, i) => `📁 ${c}: ${counts[i]}개`).join('<br>')}</div>` : '')
        + `<div class="hint small">⚠️ 이 시뮬레이션의 X-ray 이미지는 실제 환자 영상이 아니라, 학습용으로 컴퓨터가 그린 가상의 그림입니다.</div>`;
      bindInputs(body, node);
    }
  },
  'Image Viewer': {
    cat: 'Image', icon: '👁️', inputs: [{ name: 'Data', type: 'data' }], outputs: [], wide: true,
    defaults: () => ({ size: 110, filter: '' }),
    compute() { return {}; },
    dialog(node, inp, body) {
      const t = inp.Data;
      const ii = t ? t.columns.findIndex(c => c.type === 'image') : -1;
      if (!t || ii < 0) { body.innerHTML = `<div class="note">${t ? '이미지 열이 없는 데이터입니다.' : '입력 데이터가 없습니다. Import Images와 연결하세요.'}</div>`; return; }
      const tc = ML.targetCol(t), s = node.settings;
      const rows = t.rows.filter(r => !s.filter || (tc && r[tc.i] === s.filter));
      body.innerHTML = `<div class="split"><div class="side">${box('Info', `${t.rows.length}개 이미지`)}
        ${box('Filter', `Title attribute: category<br>${sel('filter', s.filter, [['', '전체 보기'], ...XRAY.CLASSES])}`)}
        ${box('Zoom', `<input type="range" min="60" max="200" value="${s.size}" data-k="size">`)}</div>
        <div class="main"><div class="igrid" style="--s:${s.size}px">${rows.map(r => `<figure><img src="${XRAY.render(r[ii], 128)}" loading="lazy"><figcaption>${tc ? esc(r[tc.i]) : ''}<br><small>${esc(r[ii].name)}</small></figcaption></figure>`).join('')}</div></div></div>`;
      bindInputs(body, node, (k, v) => App.setSetting(node, { [k]: v }));
    }
  },
  'Image Embedding': {
    cat: 'Image', icon: '🧬', inputs: [{ name: 'Images', type: 'data' }], outputs: [{ name: 'Embeddings', type: 'data' }],
    defaults: () => ({ embedder: 'Inception v3' }),
    compute(node, inp) {
      const t = inp.Images; if (!t) return {};
      const ii = t.columns.findIndex(c => c.type === 'image');
      if (ii < 0) throw new Error('이미지 데이터가 아닙니다. Import Images와 연결하세요.');
      const key = t.id + '|emb:' + node.settings.embedder;
      if (!App.embedDone(node, key)) return {};
      const feats = Array.from({ length: XRAY.EMB_DIM }, (_, i) => ({ name: 'n' + i, type: 'num', role: 'feature' }));
      return { Embeddings: { ...t, id: key, columns: [...t.columns, ...feats], rows: t.rows.map(r => [...r, ...r[ii].emb]) } };
    },
    dialog(node, inp, body) {
      const t = inp.Images, s = node.settings;
      body.innerHTML = box('Settings', `<div class="frow">Image attribute: image</div><div class="frow">Embedder: ${sel('embedder', s.embedder, ['Inception v3', 'SqueezeNet (local)', 'VGG-16', 'VGG-19', 'Painters', 'DeepLoc'])}</div>`)
        + (t ? (node.busy ? `<div class="note">⏳ 임베딩 중... <div class="ratio"><div style="width:${node.busy}%"></div></div></div>`
          : node.err ? `<div class="note err">⚠️ ${esc(node.err)}</div>` : `<div class="note ok">✅ 이미지 ${t.rows.length}개 임베딩 완료 → 특징 n0 ~ n${XRAY.EMB_DIM - 1} 생성</div>`) : '<div class="note">입력 이미지가 없습니다.</div>')
        + `<div class="hint">💡 이미지 임베딩은 미리 학습된 인공신경망(예: Inception v3)으로 이미지를 숫자 벡터(특징)로 바꾸는 과정입니다. 실제 Orange의 Inception v3는 이미지 1장을 <b>2048개</b>의 숫자(n0~n2047)로 바꾸지만, 이 시뮬레이션에서는 ${XRAY.EMB_DIM}개로 줄였습니다.</div>`;
      bindInputs(body, node);
    }
  }
};

// ---------- 산점도 그리기 ----------
function drawScatter(cv, t, xn, yn, cn) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, m = { l: 60, r: 130, t: 20, b: 50 };
  const xi = t.columns.findIndex(c => c.name === xn), yi = t.columns.findIndex(c => c.name === yn), ci = t.columns.findIndex(c => c.name === cn);
  const pts = t.rows.filter(r => !ML.isMissing(r[xi]) && !ML.isMissing(r[yi]));
  g.clearRect(0, 0, W, H); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  if (!pts.length) return;
  const xs = pts.map(r => r[xi]), ys = pts.map(r => r[yi]);
  const ext = a => { const mn = Math.min(...a), mx = Math.max(...a), p = (mx - mn) * 0.05 || 1; return [mn - p, mx + p]; };
  const [x0, x1] = ext(xs), [y0, y1] = ext(ys);
  const X = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r), Y = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
  g.strokeStyle = '#e6e6e6'; g.fillStyle = '#555'; g.font = '11px sans-serif'; g.lineWidth = 1;
  const ticks = (a, b) => { const st = Math.pow(10, Math.floor(Math.log10((b - a) / 5))); const s2 = [1, 2, 5, 10].map(k => k * st).find(s => (b - a) / s <= 7); const out = []; for (let v = Math.ceil(a / s2) * s2; v <= b; v += s2) out.push(+v.toFixed(6)); return out; };
  ticks(x0, x1).forEach(v => { g.beginPath(); g.moveTo(X(v), m.t); g.lineTo(X(v), H - m.b); g.stroke(); g.textAlign = 'center'; g.fillText(v, X(v), H - m.b + 15); });
  ticks(y0, y1).forEach(v => { g.beginPath(); g.moveTo(m.l, Y(v)); g.lineTo(W - m.r, Y(v)); g.stroke(); g.textAlign = 'right'; g.fillText(v, m.l - 6, Y(v) + 4); });
  g.strokeStyle = '#999'; g.strokeRect(m.l, m.t, W - m.l - m.r, H - m.t - m.b);
  g.fillStyle = '#222'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText(xn, m.l + (W - m.l - m.r) / 2, H - 12);
  g.save(); g.translate(16, m.t + (H - m.t - m.b) / 2); g.rotate(-Math.PI / 2); g.fillText(yn, 0, 0); g.restore();
  const vals = ci >= 0 ? t.columns[ci].values : null;
  pts.forEach(r => {
    const c = vals ? (ML.isMissing(r[ci]) ? '#999' : PALETTE_COLORS[vals.indexOf(r[ci])]) : '#7a7a7a';
    g.fillStyle = c + 'aa'; g.strokeStyle = c; g.beginPath(); g.arc(X(r[xi]), Y(r[yi]), 4.5, 0, Math.PI * 2); g.fill(); g.stroke();
  });
  if (vals) {
    g.textAlign = 'left'; g.font = 'bold 12px sans-serif'; g.fillStyle = '#222'; g.fillText(cn, W - m.r + 15, m.t + 14);
    g.font = '12px sans-serif';
    vals.forEach((v, i) => { g.fillStyle = PALETTE_COLORS[i]; g.beginPath(); g.arc(W - m.r + 22, m.t + 34 + i * 20, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#222'; g.fillText(v, W - m.r + 32, m.t + 38 + i * 20); });
  }
}

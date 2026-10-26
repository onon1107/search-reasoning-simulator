// 실습 엔진 · 복습 퀴즈 · 명령어 카드 · 오답 노트
(function () {
  const { STEPS, QUIZ, CARDS, FEATURES, train } = window.CONTENT;
  const C = window.Charts;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const CIRCLED = '①②③④⑤⑥⑦⑧⑨';
  const KEY = 'le-sim-v1';

  const FEATDESC = {
    'Year': '연도', 'Status': '개발도상국(Developing) / 선진국(Developed)', 'Adult Mortality': '성인 사망률(1,000명당 15~60세 사망 확률)',
    'infant deaths': '1,000명당 유아 사망 수', 'Alcohol': '1인당 알코올 소비량(리터)', 'percentage expenditure': 'GDP 대비 건강 지출(%)',
    'Hepatitis B': 'B형 간염 예방 접종률(%)', 'Measles': '1,000명당 홍역 환자 수', ' BMI': '평균 체질량 지수', 'under-five deaths': '1,000명당 5세 미만 사망 수',
    'Polio': '소아마비 예방 접종률(%)', 'Total expenditure': '정부 총 지출 대비 보건 지출(%)', 'Diphtheria': '디프테리아·백일해 예방 접종률(%)',
    'HIV/AIDS': '1,000명당 HIV/AIDS 사망 수(0~4세)', 'GDP': '1인당 국내 총생산(USD)', 'Population': '국가 총 인구수',
    'thinness  1-19 years': '1~19세 야윔 유병률', 'thinness 5-9 years': '5~9세 야윔 유병률', 'Income composition of resources': '자원 소득 기준 국가 개발 지수(0~1)', 'Schooling': '교육 기간(년)',
  };
  const WEIGHTS = [-1.31023639e-01, 8.05549398e-01, -1.65366217e-02, 9.23302715e-02, -1.26094468e-01, 2.58412695e-04, -5.05864100e-03, -1.25064884e-05, 3.46114488e-02, -6.89182089e-02, 1.01705848e-02, 7.40012348e-02, 1.29221179e-02, -4.31593007e-01, 2.94598705e-05, -6.76973456e-10, 1.49973922e-02, -8.43760109e-02, 1.13449331e+01, 8.60720103e-01];

  // ───────── 저장 ─────────
  const P = { done: {}, answers: {}, revealed: {}, checks: {}, notes: [], quizWrong: [], best: 0, step: 1, uploaded: false };
  try { Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 저장소 사용 불가 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* 무시 */ } };

  // 실행 상태(가상 파이썬 커널)
  let S;
  const resetKernel = () => { S = { vars: new Set(), uploaded: P.uploaded, cleaned: false, encoded: false, exec: 0 }; };
  resetKernel();
  const allCells = STEPS.flatMap((s) => s.cells.map((c) => ({ ...c, stepId: s.id })));
  const definedBy = {};
  allCells.forEach((c) => (c.sets || []).forEach((v) => { definedBy[v] = definedBy[v] || c; }));
  // 새로고침 후 완료한 셀을 순서대로 다시 실행해 상태 복원
  allCells.forEach((c) => { if (P.done[c.id]) { (c.sets || []).forEach((v) => S.vars.add(v)); c.run(S); } });

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function addNote(n) {
    if (P.notes.some((x) => x.key === n.key)) return;
    P.notes.unshift({ ...n, at: Date.now() }); save(); updateBadge();
  }
  function updateBadge() {
    const b = $('#noteCount'); b.textContent = P.notes.length; b.hidden = !P.notes.length;
  }

  // ───────── 코드 하이라이트 ─────────
  const KW = new Set(['import', 'from', 'as', 'for', 'in', 'True', 'False', 'None', 'def', 'return', 'if', 'else']);
  const BUILTIN = new Set(['print', 'range', 'min', 'max', 'object']);
  function hl(src) {
    const re = /(#[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|\b(\d+\.?\d*)\b|([A-Za-z_]\w*)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index)); last = re.lastIndex;
      if (m[1]) out += `<span class="cm">${esc(m[1])}</span>`;
      else if (m[2]) out += `<span class="st">${esc(m[2])}</span>`;
      else if (m[3]) out += `<span class="nu">${m[3]}</span>`;
      else {
        const w = m[4], next = src[re.lastIndex];
        if (KW.has(w)) out += `<span class="kw">${w}</span>`;
        else if (BUILTIN.has(w) || next === '(') out += `<span class="fn">${w}</span>`;
        else out += w;
      }
    }
    return out + esc(src.slice(last));
  }
  function codeWithBlanks(code, blanks, vals = []) {
    return code.split(/\[\[(\d+)\]\]/).map((part, i) => {
      if (i % 2 === 0) return hl(part);
      const k = +part, len = Math.max(...blanks[k].a.map((a) => a.length));
      const v = vals[k] || '';
      return `<input class="blank" data-k="${k}" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="빈칸 ${k + 1}" style="width:${Math.max(len, v.length) + 2}ch" value="${esc(v)}">`;
    }).join('');
  }
  const norm = (s) => s.replace(/\s+/g, '').replace(/"/g, "'");

  // 빈칸 하나 채점 → null(정답) 또는 { err, help }
  function judge(b, raw) {
    const v = norm(raw);
    if (b.a.some((a) => norm(a) === v)) return null;
    const shown = raw.trim();
    const tips = { ...(b.near || {}), ...(b.alt || {}) };
    const tipKey = Object.keys(tips).find((k) => norm(k) === v);
    let help = tipKey ? tips[tipKey] : null;
    if (!v) return { err: b.empty || 'SyntaxError: invalid syntax', help: b.emptyHelp || '빈칸이 비어 있어요. 알맞은 명령어를 입력하세요.' };
    if (!help && b.a.some((a) => norm(a).toLowerCase() === v.toLowerCase())) help = '거의 맞았어요! <b>대소문자</b>를 확인하세요. 파이썬은 대소문자를 구분해요.';
    if (/\(\)$/.test(v) && b.a.some((a) => norm(a) === v.slice(0, -2)) && b.kind === 'attr')
      return { err: "TypeError: object is not callable", help: help || '이 명령어는 괄호 없이 쓰는 <b>속성</b>이에요.' };
    let err;
    const id = (shown.match(/[A-Za-z_]\w*/) || [shown])[0];
    switch (b.kind) {
      case 'attr': err = `AttributeError: ${b.obj} has no attribute '${shown}'`; break;
      case 'kw': err = `TypeError: ${b.fn}() got an unexpected keyword argument '${shown.split('=')[0].trim()}'`; break;
      case 'module': err = `ModuleNotFoundError: No module named '${b.obj}.${shown}'`; break;
      case 'alias': err = `NameError: name '${b.a[0]}' is not defined  ← 다음 셀에서 발생`; help = help || `별칭을 <code>${esc(shown)}</code>(으)로 정하면 아래 셀의 <code>${b.a[0]}.read_csv()</code>를 쓸 수 없어요.`; break;
      default: err = `NameError: name '${id}' is not defined`;
    }
    return { err, help: help || '명령어를 다시 확인해 보세요. 막히면 💡 힌트를 눌러요.' };
  }

  // ───────── 실습 화면 ─────────
  const stepDone = (s) => s.cells.length ? s.cells.every((c) => P.done[c.id]) : s.checks.every((_, i) => P.checks[`${s.id}-${i}`] !== undefined);
  function renderNav() {
    $('#stepNav').innerHTML = '<h3>프로젝트 수행 과정</h3>' + STEPS.map((s) => {
      const n = s.cells.length, d = s.cells.filter((c) => P.done[c.id]).length;
      return `<button class="stepbtn ${s.id === P.step ? 'active' : ''} ${stepDone(s) ? 'done' : ''}" data-step="${s.id}">
        <span class="stepnum">${stepDone(s) ? '✓' : s.id}</span><span>${s.name}<span class="meta">${n ? `${d}/${n} 셀 · ` : ''}${s.page}</span></span></button>`;
    }).join('');
    const units = STEPS.reduce((a, s) => a + (s.cells.length || 1), 0);
    const got = STEPS.reduce((a, s) => a + (s.cells.length ? s.cells.filter((c) => P.done[c.id]).length : stepDone(s) ? 1 : 0), 0);
    $('#progFill').style.width = (got / units) * 100 + '%';
  }

  function renderStep() {
    const s = STEPS.find((x) => x.id === P.step);
    let h = `<div class="step-hero"><div class="kicker">${s.icon} ${s.id}단계 · 교과서 ${s.page}</div><h2>${s.name}</h2><p>${s.lead}</p><div class="goal">${s.goal}</div>`;
    if (s.features) {
      h += `<div class="featgrid"><div class="target"><code>Life expectancy</code> 🎯 목표 변수 — 각 국가의 기대 수명</div>${Object.entries(FEATDESC).map(([k, v]) => `<div><code>${k.trim()}</code> ${v}</div>`).join('')}</div>`;
    }
    h += '</div>';
    s.cells.forEach((c, i) => { h += cellHTML(c, i); });
    if (s.extra) h += `<div class="panel tryit" id="extra"></div>`;
    if (s.checks.length) {
      h += `<div class="panel"><h3><span class="tag">해 보기</span>개념 확인</h3>${s.checks.map((q, i) => checkHTML(s.id, q, i)).join('')}</div>`;
    }
    const prev = STEPS.find((x) => x.id === s.id - 1), next = STEPS.find((x) => x.id === s.id + 1);
    h += `<div class="next-step"><button class="navbtn" data-go="${prev ? prev.id : ''}" ${prev ? '' : 'disabled'}>← ${prev ? prev.name : '처음'}</button>
      ${next ? `<button class="navbtn primary" data-go="${next.id}">${next.name} →</button>` : '<button class="navbtn primary" data-view-go="quiz">📝 복습 퀴즈 풀러 가기 →</button>'}</div>`;
    const nb = $('#notebook'); nb.innerHTML = h;
    s.cells.forEach((c) => {
      bindCell(c);
      if (P.done[c.id]) showOutput(c, c.run({ ...S, vars: S.vars }), true);
    });
    if (s.extra) renderExtra(s.extra);
    $$('[data-check]', nb).forEach(bindCheck);
  }

  function cellHTML(c, i) {
    const vals = P.answers[c.id] || [];
    let files = '';
    if (c.file) {
      const up = P.uploaded;
      files = `<div class="files"><div class="drop" data-src><h4>💻 내 컴퓨터</h4>${up ? '<span>(업로드 완료)</span>' : '<span class="file" draggable="true" data-file>📄 Life Expectancy Data.csv</span>'}</div>
        <div class="arrow">➜</div><div class="drop" data-dst><h4>📁 Colab 파일 <small>(/content)</small></h4>${up ? '<span class="file">📄 Life Expectancy Data.csv</span>' : '<span>여기로 끌어다 놓거나, 왼쪽 파일을 눌러 업로드</span>'}</div></div>`;
    }
    return `<div class="cell ${P.done[c.id] ? 'done' : ''}" id="cell-${c.id}">
      <div class="cell-head"><h3><span class="no">${CIRCLED[i]}</span>${c.title}</h3><p>${c.explain}</p>${c.tip ? `<div class="tip">${c.tip}</div>` : ''}</div>
      ${files}
      <div class="code-row"><div><button class="runbtn" title="실행 (Ctrl+Enter)" aria-label="셀 실행">▶</button><div class="exec">[${P.done[c.id] ? '✓' : ' '}]</div></div>
        <div class="code">${codeWithBlanks(c.code, c.blanks, vals)}</div></div>
      <div class="cell-tools"><button class="chipbtn" data-hint>💡 힌트</button><button class="chipbtn" data-reveal hidden>🔑 정답 보기</button></div>
      <div class="hintbox" hidden></div>
      <div class="output"></div></div>`;
  }

  function bindCell(c) {
    const el = $('#cell-' + c.id), inputs = $$('input.blank', el);
    let fails = 0;
    if (P.done[c.id]) inputs.forEach((x) => x.classList.add(P.revealed[c.id] ? 'revealed' : 'right'));
    inputs.forEach((inp) => {
      inp.addEventListener('input', () => {
        const len = Math.max(...c.blanks[inp.dataset.k].a.map((a) => a.length));
        inp.style.width = Math.max(len, inp.value.length) + 2 + 'ch';
        inp.classList.remove('wrong', 'right');
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const nx = inputs[inputs.indexOf(inp) + 1];
          if (nx && !(e.ctrlKey || e.metaKey || e.shiftKey)) nx.focus(); else run();
        }
      });
    });
    const hintBox = $('.hintbox', el);
    $('[data-hint]', el).onclick = () => {
      const k = Math.max(0, inputs.findIndex((x) => !x.classList.contains('right')));
      hintBox.hidden = false;
      hintBox.innerHTML = c.blanks.map((b, i) => `<div>💡 빈칸 ${i + 1}: ${b.hint}</div>`).join('');
      if (inputs[k]) inputs[k].focus();
    };
    $('[data-reveal]', el).onclick = () => {
      inputs.forEach((x, i) => { x.value = c.blanks[i].a[0]; x.classList.remove('wrong'); x.classList.add('revealed'); x.dispatchEvent(new Event('input')); x.classList.add('revealed'); });
      P.revealed[c.id] = true;
      const st = STEPS.find((s) => s.cells.includes(c));
      addNote({ key: 'cell-' + c.id, src: `실습 ${st.id}단계 · ${c.title}`, q: c.code.replace(/\[\[(\d+)\]\]/g, (_, k) => `[ ${c.blanks[k].a[0]} ]`), a: c.blanks.map((b) => b.a[0]).join(' , '), exp: c.blanks.map((b) => b.hint).join(' / ') });
      toast('정답을 채웠어요. ▶ 실행해 보세요!');
    };
    $('.runbtn', el).onclick = run;
    if (c.file && !P.uploaded) bindUpload(el);

    function run() {
      const vals = inputs.map((x) => x.value);
      P.answers[c.id] = vals;
      let first = null;
      inputs.forEach((x, i) => {
        const r = judge(c.blanks[i], x.value);
        x.classList.toggle('wrong', !!r); x.classList.toggle('right', !r && !x.classList.contains('revealed'));
        if (r && !first) first = r;
      });
      S.exec++;
      $('.exec', el).textContent = `[${S.exec}]`;
      if (first) {
        fails++;
        if (fails >= 2) $('[data-reveal]', el).hidden = false;
        save();
        return showOutput(c, { error: first.err, help: first.help });
      }
      const miss = (c.needs || []).find((v) => !S.vars.has(v));
      if (miss) {
        const src = definedBy[miss];
        const stp = src && STEPS.find((s) => s.cells.includes(src));
        return showOutput(c, { error: `NameError: name '${miss}' is not defined`, help: src ? `<code>${miss}</code> 변수가 아직 없어요. <b>${stp.id}단계 「${src.title}」</b> 셀을 먼저 실행하세요.` : '앞의 셀을 먼저 실행하세요.' });
      }
      const res = c.run(S);
      if (res.error) return showOutput(c, res);
      (c.sets || []).forEach((v) => S.vars.add(v));
      const first_time = !P.done[c.id];
      P.done[c.id] = true; save();
      el.classList.add('done');
      showOutput(c, res);
      renderNav();
      if (first_time) {
        const st = STEPS.find((s) => s.cells.includes(c));
        toast(stepDone(st) ? `🎉 ${st.id}단계 「${st.name}」 완료!` : '✓ 실행 성공!');
      }
    }
  }

  function bindUpload(el) {
    const dst = $('[data-dst]', el), file = $('[data-file]', el);
    const done = () => {
      P.uploaded = S.uploaded = true; save();
      $('[data-src]', el).innerHTML = '<h4>💻 내 컴퓨터</h4><span>(업로드 완료)</span>';
      dst.innerHTML = '<h4>📁 Colab 파일 <small>(/content)</small></h4><span class="file">📄 Life Expectancy Data.csv</span>';
      dst.classList.remove('over'); toast('📁 파일을 코랩에 올렸어요!');
    };
    file.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', 'csv'));
    file.addEventListener('click', done);
    dst.addEventListener('dragover', (e) => { e.preventDefault(); dst.classList.add('over'); });
    dst.addEventListener('dragleave', () => dst.classList.remove('over'));
    dst.addEventListener('drop', (e) => { e.preventDefault(); done(); });
  }

  function showOutput(c, res, quiet) {
    const out = $('#cell-' + c.id + ' .output');
    if (res.error) {
      out.innerHTML = `<div class="err"><b>${esc(res.error)}</b>${res.help ? `<div class="err-help">👉 ${res.help}</div>` : ''}</div>`;
    } else {
      out.innerHTML = res.html + (c.interp ? `<div class="interp"><b>해석</b><ul>${c.interp.map((t) => `<li>${t}</li>`).join('')}</ul></div>` : '');
      if (res.after) AFTER[res.after](out);
    }
    out.classList.add('show');
  }

  const AFTER = {
    heatmap(out) {
      const info = $('[data-hm-info]', out), cols = window.LE_DATA.cols, M = window.LE_DATA.corr;
      const desc = (v) => { const a = Math.abs(v); return (a >= 0.7 ? '강한' : a >= 0.4 ? '뚜렷한' : a >= 0.2 ? '약한' : '거의 없는') + (a < 0.2 ? ' 상관관계' : v > 0 ? ' 양(+)의 상관관계' : ' 음(−)의 상관관계'); };
      const show = (e) => {
        const r = e.target.closest('.hm'); if (!r) return;
        const i = +r.dataset.i, j = +r.dataset.j, v = M[i][j];
        info.innerHTML = i === j ? `<b>${cols[i]}</b> 자기 자신과의 상관계수는 항상 1이에요.` : `<b>${cols[i]}</b> ↔ <b>${cols[j]}</b> : <b>${v.toFixed(2)}</b> → ${desc(v)}`;
      };
      out.addEventListener('mouseover', show); out.addEventListener('click', show);
    },
    coef(out) {
      const rows = FEATURES.map((f, i) => [f, WEIGHTS[i]]);
      out.insertAdjacentHTML('beforeend', `<details style="margin-top:10px"><summary><b>속성별 가중치 표로 보기</b> (X의 열 순서와 같아요)</summary>
        <div class="dftable" style="margin-top:6px"><table><thead><tr><th>#</th><th style="text-align:left">속성</th><th>가중치 w</th></tr></thead><tbody>
        ${rows.map(([f, w], i) => `<tr><th>${i}</th><td style="text-align:left">${f}</td><td>${w.toExponential(3)}</td></tr>`).join('')}
        <tr><th>b</th><td style="text-align:left">편향(intercept_)</td><td>315.682</td></tr></tbody></table></div>
        <div class="simnote">※ 속성마다 단위(인구수, %, 년…)가 달라서 가중치 크기만으로 중요도를 비교하기는 어려워요.</div></details>`);
    },
    r2(out) {
      const v = 0.7935;
      out.insertAdjacentHTML('afterbegin', `<div style="margin-bottom:10px"><div class="splitbar" style="background:var(--border)"><div style="width:${v * 100}%;background:var(--ok)">R² = ${v.toFixed(2)}</div></div>
        <div class="legend"><span>0 (전혀 설명 못 함)</span><span style="margin-left:auto">1 (완벽하게 설명)</span></div></div>`);
    },
  };

  function checkHTML(sid, q, i) {
    const key = `${sid}-${i}`, ans = P.checks[key];
    return `<div class="check" data-check="${key}" data-a="${q.a}"><div class="q">Q${i + 1}. ${q.q}</div><div class="opts">${q.opts.map((o, k) => `<button class="opt ${ans !== undefined && k === q.a ? 'right' : ''} ${ans === k && k !== q.a ? 'wrong' : ''}" data-k="${k}">${o}</button>`).join('')}</div>
      <div class="feedback ${ans === q.a ? 'good' : 'bad'}">${ans !== undefined ? (ans === q.a ? '⭕ 정답! ' : '❌ ') + q.exp : ''}</div></div>`;
  }
  function bindCheck(box) {
    const key = box.dataset.check, a = +box.dataset.a;
    const [sid, i] = key.split('-').map(Number);
    const q = STEPS.find((s) => s.id === sid).checks[i];
    $$('.opt', box).forEach((b) => b.onclick = () => {
      const k = +b.dataset.k;
      if (P.checks[key] === undefined) P.checks[key] = k;
      $$('.opt', box).forEach((x) => x.classList.remove('right', 'wrong'));
      b.classList.add(k === a ? 'right' : 'wrong');
      if (k !== a) addNote({ key: 'check-' + key, src: `실습 ${sid}단계 · 개념 확인`, q: q.q, a: q.opts[a], exp: q.exp });
      const fb = $('.feedback', box);
      fb.className = 'feedback ' + (k === a ? 'good' : 'bad');
      fb.innerHTML = (k === a ? '⭕ 정답! ' : '❌ 다시 생각해 보세요. ') + (k === a ? q.exp : '');
      if (k === a) $$('.opt', box)[a].classList.add('right');
      save(); renderNav();
    });
  }

  // ───────── 해 보기(인터랙티브) ─────────
  function renderExtra(type) {
    const el = $('#extra');
    if (type === 'explorer') {
      const opts = window.LE_DATA.cols.filter((c) => c !== 'Life expectancy');
      el.innerHTML = `<h3><span class="tag">해 보기</span>기대 수명에 영향을 미치는 속성 찾기</h3><p>속성을 바꿔 가며 기대 수명과의 관계를 산점도로 확인하고, 상관계수(r)를 비교해 보세요.</p>
        <div class="ctrl"><label for="exSel"><b>x축 속성</b></label><select id="exSel">${opts.map((c) => `<option ${c === 'Schooling' ? 'selected' : ''}>${c}</option>`).join('')}</select><span id="exR"></span></div><div id="exChart"></div>`;
      const draw = () => {
        const f = $('#exSel').value, x = C.col(f), y = C.col('Life expectancy'), r = C.pearson(x, y);
        const a = Math.abs(r), word = a >= 0.7 ? '강한' : a >= 0.4 ? '뚜렷한' : a >= 0.2 ? '약한' : '거의 없음';
        $('#exR').innerHTML = `r = <span class="big">${r.toFixed(2)}</span> ${word}${a >= 0.2 ? (r > 0 ? ' 양(+)의 관계' : ' 음(−)의 관계') : ''}`;
        $('#exChart').innerHTML = C.scatter(x, y, { xlabel: f, ylabel: 'Life expectancy', r: 2, color: '#3b5bdb' });
      };
      $('#exSel').onchange = draw; draw();
    } else if (type === 'split') {
      el.innerHTML = `<h3><span class="tag">해 보기</span>훈련/테스트 비율을 바꿔 보자</h3><p>test_size 값을 움직이면 1,649개 데이터가 어떻게 나뉘는지 볼 수 있어요.</p>
        <div class="ctrl"><code>test_size =</code><input type="range" id="tsR" min="0.1" max="0.5" step="0.05" value="0.2"><span class="big" id="tsV">0.2</span></div>
        <div class="splitbar" id="tsBar"></div><pre id="tsOut" style="margin-top:10px"></pre>`;
      const draw = () => {
        const t = +$('#tsR').value, n = 1649, te = Math.ceil(n * t), tr = n - te;
        $('#tsV').textContent = t.toFixed(2);
        $('#tsBar').innerHTML = `<div style="width:${(tr / n) * 100}%;background:#3b5bdb">훈련 ${tr}개 (${Math.round((1 - t) * 100)}%)</div><div style="width:${(te / n) * 100}%;background:#f08c00">테스트 ${te}개</div>`;
        $('#tsOut').textContent = `X_train.shape, y_train.shape, X_test.shape, y_test.shape\n((${tr}, 20), (${tr},), (${te}, 20), (${te},))`;
      };
      $('#tsR').oninput = draw; draw();
    } else if (type === 'predictor') {
      const { w, b } = train().fit;
      el.innerHTML = `<h3><span class="tag">해 보기</span>내 수명을 예측해 볼까? (교육 기간만 사용한 모델)</h3><p>lin1 모델에 교육 기간을 넣으면 <code>lin1.predict([[교육 기간]])</code> 결과를 보여 줘요.</p>
        <div class="ctrl"><b>교육 기간</b><input type="range" id="prR" min="0" max="21" step="0.5" value="12"><span id="prV"></span></div>
        <div id="prOut" style="font-size:16px"></div><div class="simnote">※ 교육 기간 하나만 사용한 단순한 모델이에요. 실제 기대 수명은 의료, 소득, 환경 등 많은 요인의 영향을 받아요.</div>`;
      const draw = () => {
        const x = +$('#prR').value, y = w * x + b;
        $('#prV').innerHTML = `<b>${x}년</b>`;
        $('#prOut').innerHTML = `<code>lin1.predict([[${x}]])</code> → 예상 기대 수명 <span class="big">${y.toFixed(1)}세</span>`;
      };
      $('#prR').oninput = draw; draw();
    }
  }

  // ───────── 복습 퀴즈 ─────────
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const stepName = (id) => (id === 0 ? '전체 과정' : STEPS.find((s) => s.id === id).name);
  let Q = null;

  function quizHome() {
    const wrongN = P.quizWrong.length;
    $('#quizRoot').innerHTML = `<div class="view-head"><h2>📝 복습 퀴즈</h2><p>실습에서 배운 중요 명령어를 다시 떠올려 보세요. 최고 기록: <b>${P.best}점</b></p></div>
      <div class="qsetup">
        <button class="mode" data-mode="random"><div class="ic">🎲</div><h3>랜덤 10문제</h3><p>전 단계에서 골고루 출제</p></button>
        <button class="mode" data-mode="fill"><div class="ic">⌨️</div><h3>코드 빈칸 집중</h3><p>명령어를 직접 타이핑하는 10문제</p></button>
        <button class="mode" data-mode="order"><div class="ic">🔢</div><h3>순서 맞추기</h3><p>프로젝트 과정·코드 순서 배열</p></button>
        <button class="mode" data-mode="wrong" ${wrongN ? '' : 'disabled style="opacity:.5"'}><div class="ic">❗</div><h3>틀린 문제 다시</h3><p>${wrongN ? `${wrongN}문제 남음` : '아직 틀린 문제가 없어요'}</p></button>
      </div>
      <div class="panel" style="margin-top:14px"><h3>🎯 단계별 복습</h3><p>원하는 단계를 골라 집중 복습해요.</p>
        <div class="opts">${STEPS.map((s) => `<button class="opt" data-mode="step" data-step="${s.id}">${s.icon} ${s.id}. ${s.name} <small>(${QUIZ.filter((q) => q.step === s.id).length})</small></button>`).join('')}</div></div>`;
    $$('[data-mode]', $('#quizRoot')).forEach((b) => b.onclick = () => startQuiz(b.dataset.mode, +b.dataset.step));
  }

  function startQuiz(mode, step) {
    let pool = QUIZ.map((q, i) => ({ ...q, i }));
    if (mode === 'random') pool = shuffle(pool.filter((q) => q.t !== 'order')).slice(0, 9).concat(shuffle(pool.filter((q) => q.t === 'order')).slice(0, 1));
    else if (mode === 'fill') pool = shuffle(pool.filter((q) => q.t === 'fill')).slice(0, 10);
    else if (mode === 'order') pool = pool.filter((q) => q.t === 'order');
    else if (mode === 'wrong') pool = shuffle(pool.filter((q) => P.quizWrong.includes(q.i)));
    else if (mode === 'step') pool = shuffle(pool.filter((q) => q.step === step || (step === 1 && q.step === 0)));
    if (!pool.length) return toast('문제가 없어요');
    Q = { mode, list: pool, k: 0, res: [] };
    renderQ();
  }

  function renderQ() {
    const q = Q.list[Q.k], root = $('#quizRoot');
    const dots = Q.list.map((_, i) => `<i class="${i === Q.k ? 'cur' : Q.res[i] === true ? 'o' : Q.res[i] === false ? 'x' : ''}"></i>`).join('');
    let body = '';
    if (q.t === 'fill') body = `<div class="qcode">${codeWithBlanks(q.code, [{ a: q.a }])}</div>`;
    else if (q.t === 'choice') body = `<div class="opts">${q.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div>`;
    else if (q.t === 'ox') body = `<div class="opts"><button class="opt" data-k="1" style="font-size:22px;padding:10px 34px">⭕</button><button class="opt" data-k="0" style="font-size:22px;padding:10px 34px">❌</button></div>`;
    else if (q.t === 'order') {
      let order; do { order = shuffle(q.items.map((_, i) => i)); } while (order.every((v, i) => v === i));
      Q.order = order;
      body = `<div class="order-list" id="ordList"></div>`;
    }
    root.innerHTML = `<div class="qcard"><div class="qtop"><span>${Q.k + 1} / ${Q.list.length} · ${stepName(q.step)}</span><div class="qdots">${dots}</div></div>
      <div class="qtext">${q.t === 'ox' ? 'O / X — ' : ''}${q.q}</div>${body}<div id="qfb"></div>
      <div class="qnav"><button class="navbtn" id="qQuit">그만하기</button>${q.t === 'fill' || q.t === 'order' ? '<button class="navbtn primary" id="qSubmit">확인</button>' : ''}</div></div>`;
    $('#qQuit').onclick = quizHome;
    if (q.t === 'fill') {
      const inp = $('input.blank', root); inp.focus();
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#qSubmit') ? $('#qSubmit').click() : $('#qNext') && $('#qNext').click(); } });
      $('#qSubmit').onclick = () => { const ok = q.a.some((a) => norm(a) === norm(inp.value)); inp.classList.add(ok ? 'right' : 'wrong'); inp.disabled = true; answered(ok, q.a[0]); };
    } else if (q.t === 'order') {
      drawOrder(q);
      $('#qSubmit').onclick = () => {
        const ok = Q.order.every((v, i) => v === i);
        $$('.order-item', root).forEach((el, i) => el.classList.add(Q.order[i] === i ? 'right' : 'wrong'));
        $$('.mv button', root).forEach((b) => b.disabled = true);
        answered(ok, q.items.map((t, i) => `${i + 1}. ${t}`).join('<br>'));
      };
    } else {
      $$('.opt', root).forEach((b) => b.onclick = () => {
        const k = +b.dataset.k, correct = q.t === 'ox' ? (q.a ? 1 : 0) : q.a, ok = k === correct;
        $$('.opt', root).forEach((x) => { x.disabled = true; if (+x.dataset.k === correct) x.classList.add('right'); });
        if (!ok) b.classList.add('wrong');
        answered(ok, q.t === 'ox' ? (q.a ? 'O' : 'X') : q.opts[q.a]);
      });
    }
  }
  function drawOrder(q) {
    const list = $('#ordList');
    list.innerHTML = Q.order.map((v, i) => `<div class="order-item"><b>${i + 1}</b>${q.mono ? `<code>${esc(q.items[v])}</code>` : esc(q.items[v])}<span class="mv"><button data-up="${i}" aria-label="위로" ${i ? '' : 'disabled'}>▲</button><button data-dn="${i}" aria-label="아래로" ${i < Q.order.length - 1 ? '' : 'disabled'}>▼</button></span></div>`).join('');
    $$('[data-up]', list).forEach((b) => b.onclick = () => { const i = +b.dataset.up; [Q.order[i - 1], Q.order[i]] = [Q.order[i], Q.order[i - 1]]; drawOrder(q); });
    $$('[data-dn]', list).forEach((b) => b.onclick = () => { const i = +b.dataset.dn; [Q.order[i + 1], Q.order[i]] = [Q.order[i], Q.order[i + 1]]; drawOrder(q); });
  }
  function answered(ok, answerText) {
    const q = Q.list[Q.k];
    Q.res[Q.k] = ok;
    if (ok) P.quizWrong = P.quizWrong.filter((i) => i !== q.i);
    else {
      if (!P.quizWrong.includes(q.i)) P.quizWrong.push(q.i);
      addNote({ key: 'quiz-' + q.i, src: `복습 퀴즈 · ${stepName(q.step)}`, q: q.code ? q.q + '\n' + q.code.replace(/\[\[0\]\]/, '[ ? ]') : q.q, a: answerText.replace(/<br>/g, '\n'), exp: q.exp });
    }
    save();
    $('#qfb').innerHTML = `<div class="explain">${ok ? '⭕ <b>정답!</b>' : `❌ <b>오답</b> — 정답: <span class="mono">${answerText}</span>`}<br>${q.exp}</div>`;
    const sub = $('#qSubmit'); if (sub) sub.remove();
    const last = Q.k === Q.list.length - 1;
    $('.qnav').insertAdjacentHTML('beforeend', `<button class="navbtn primary" id="qNext">${last ? '결과 보기' : '다음 문제 →'}</button>`);
    $('#qNext').onclick = () => { if (last) quizResult(); else { Q.k++; renderQ(); } };
    $('#qNext').focus();
  }
  function quizResult() {
    const n = Q.list.length, ok = Q.res.filter(Boolean).length, score = Math.round((ok / n) * 100);
    if (Q.mode === 'random' || Q.mode === 'fill') P.best = Math.max(P.best, score);
    save();
    const by = {};
    Q.list.forEach((q, i) => { const s = stepName(q.step); by[s] = by[s] || [0, 0]; by[s][1]++; if (Q.res[i]) by[s][0]++; });
    const msg = score === 100 ? '완벽해요! 🏆' : score >= 80 ? '아주 잘했어요! 👏' : score >= 50 ? '조금만 더! 💪' : '실습을 한 번 더 해 볼까요? 📖';
    $('#quizRoot').innerHTML = `<div class="qcard result"><div class="score">${score}점</div><p>${n}문제 중 ${ok}문제 정답 · ${msg}</p>
      <div class="bars">${Object.entries(by).map(([s, [a, b]]) => `<div class="row"><span>${s}</span><div class="track"><div class="fill" style="width:${(a / b) * 100}%;background:${a === b ? 'var(--ok)' : 'var(--accent)'}"></div></div><span>${a}/${b}</span></div>`).join('')}</div>
      <div class="qnav" style="justify-content:center">${Q.res.some((r) => !r) ? '<button class="navbtn" id="rWrong">틀린 문제 다시 풀기</button>' : ''}<button class="navbtn" id="rNotes">오답 노트 보기</button><button class="navbtn primary" id="rHome">처음으로</button></div></div>`;
    $('#rHome').onclick = quizHome;
    $('#rNotes').onclick = () => switchView('notes');
    if ($('#rWrong')) $('#rWrong').onclick = () => { Q = { mode: 'retry', list: Q.list.filter((_, i) => !Q.res[i]), k: 0, res: [] }; renderQ(); };
  }

  // ───────── 명령어 카드 ─────────
  function renderCards() {
    $('#cardRoot').innerHTML = CARDS.map((g) => `<div class="cardgroup"><h3>${STEPS.find((s) => s.id === g.step).icon} ${g.step}단계 · ${stepName(g.step)}</h3><div class="cards">
      ${g.items.map(([c, m, ex]) => `<button class="ccard"><code>${esc(c)}</code><div class="mean">${m}</div>${ex ? `<div class="ex">${esc(ex)}</div>` : ''}</button>`).join('')}</div></div>`).join('');
    $$('.ccard').forEach((b) => b.onclick = () => b.classList.toggle('open'));
  }
  $('#hideMode').onchange = (e) => { $('#cardRoot').classList.toggle('hide', e.target.checked); $$('.ccard').forEach((b) => b.classList.remove('open')); };

  // ───────── 오답 노트 ─────────
  function renderNotes() {
    const root = $('#notesRoot');
    if (!P.notes.length) {
      root.innerHTML = '<div class="view-head"><h2>❗ 오답 노트</h2></div><div class="empty">아직 기록이 없어요.<br>실습에서 <b>정답 보기</b>를 누르거나 퀴즈에서 틀린 문제가 여기에 모여요.</div>';
      return;
    }
    root.innerHTML = `<div class="view-head"><h2>❗ 오답 노트</h2><p>헷갈렸던 명령어를 다시 확인하세요. 이해했다면 <b>✓ 이해했어요</b>를 눌러 지울 수 있어요.</p>
      <div class="qnav" style="justify-content:flex-start">${P.quizWrong.length ? '<button class="navbtn primary" id="nRetry">틀린 퀴즈 다시 풀기</button>' : ''}<button class="navbtn" id="nClear">모두 지우기</button></div></div>
      ${P.notes.map((n, i) => `<div class="note"><div class="src">${esc(n.src)}</div><div style="white-space:pre-wrap;margin:4px 0">${n.q.includes('\n') || /[=(\[]/.test(n.q) ? `<code>${esc(n.q)}</code>` : esc(n.q)}</div>
        <div>정답: <span class="ans" style="white-space:pre-wrap">${esc(n.a)}</span></div><div class="simnote">${n.exp}</div>
        <div style="margin-top:6px"><button class="chipbtn" data-del="${i}">✓ 이해했어요</button></div></div>`).join('')}`;
    $$('[data-del]', root).forEach((b) => b.onclick = () => { P.notes.splice(+b.dataset.del, 1); save(); updateBadge(); renderNotes(); });
    $('#nClear').onclick = () => { P.notes = []; save(); updateBadge(); renderNotes(); };
    if ($('#nRetry')) $('#nRetry').onclick = () => { switchView('quiz'); startQuiz('wrong'); };
  }

  // ───────── 화면 전환 ─────────
  function switchView(v) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === v));
    $$('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
    if (v === 'quiz') quizHome();
    if (v === 'cards') renderCards();
    if (v === 'notes') renderNotes();
    window.scrollTo({ top: 0 });
  }
  $$('.tab').forEach((t) => t.onclick = () => switchView(t.dataset.view));
  function goStep(id) { P.step = id; save(); renderNav(); renderStep(); window.scrollTo({ top: 0 }); }
  document.addEventListener('click', (e) => {
    const sb = e.target.closest('[data-step].stepbtn'); if (sb) return goStep(+sb.dataset.step);
    const g = e.target.closest('[data-go]'); if (g && g.dataset.go) return goStep(+g.dataset.go);
    const vg = e.target.closest('[data-view-go]'); if (vg) return switchView(vg.dataset.viewGo);
  });
  $('#resetAll').onclick = () => {
    if (!window.confirm || !confirm('모든 실습 기록과 오답 노트를 지울까요?')) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
    location.reload();
  };

  renderNav(); renderStep(); updateBadge();
})();

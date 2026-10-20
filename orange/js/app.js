// ===== 시뮬레이터 본체 =====
const App = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('orangeSim:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('orangeSim:' + k, JSON.stringify(v)); } catch (e) { } }
  };

  let S = null;            // 현재 활동의 상태
  let activity = null;
  let addons = store.get('addons', { image: false });
  let selected = null;     // {kind:'node'|'link', id}
  let dlgNode = null;
  const cacheMap = new Map();

  // ---------- 캐시 / 비동기 ----------
  function cache(key, fn) { if (!cacheMap.has(key)) cacheMap.set(key, fn()); return cacheMap.get(key); }
  const hasCache = key => cacheMap.has(key);
  function runAsync(fn, ok, fail) {
    setTimeout(() => {
      let r;
      try { r = fn(); } catch (e) { console.error(e); if (fail) fail(e); else toast(e.message, 'err'); return; }
      ok(r);
    }, 30);
  }

  // ---------- 상태 ----------
  function blank() { return { nodes: [], links: [], nextId: 1, answers: {}, selfEval: {} }; }
  function load(act) {
    activity = act;
    S = store.get('state:' + act, null) || blank();
    S.nodes.forEach(n => { n.out = {}; n.inputs = {}; n.settings = { ...WIDGETS[n.type].defaults(), ...n.settings }; });
    selected = null; closeDialog();
    evaluate();
  }
  function save() {
    if (!S) return;
    store.set('state:' + activity, {
      nodes: S.nodes.map(({ id, type, x, y, title, settings, opened }) => ({ id, type, x, y, title, settings, opened })),
      links: S.links, nextId: S.nextId, answers: S.answers, selfEval: S.selfEval
    });
  }
  const node = id => S.nodes.find(n => n.id === id);

  // ---------- 그래프 평가 ----------
  function topo() {
    const indeg = {}, out = {};
    S.nodes.forEach(n => { indeg[n.id] = 0; out[n.id] = []; });
    S.links.forEach(l => { indeg[l.to]++; out[l.from].push(l.to); });
    const q = S.nodes.filter(n => !indeg[n.id]).map(n => n.id), order = [];
    while (q.length) { const id = q.shift(); order.push(id); out[id].forEach(t => { if (--indeg[t] === 0) q.push(t); }); }
    return order.map(node);
  }
  function evaluate() {
    for (const n of topo()) {
      const W = WIDGETS[n.type], inputs = {};
      W.inputs.forEach(d => {
        const vals = S.links.filter(l => l.to === n.id && l.inp === d.name).map(l => node(l.from).out?.[l.out]).filter(v => v);
        inputs[d.name] = d.multi ? vals : (vals[0] || null);
      });
      n.inputs = inputs;
      try { n.out = W.compute(n, inputs) || {}; n.err = null; }
      catch (e) { n.out = {}; n.err = e.message; }
    }
    renderCanvas();
    save();
    checkMissions();
  }
  function upstream(n) {
    const seen = new Set(), st = [n.id];
    while (st.length) { const id = st.pop(); S.links.filter(l => l.to === id).forEach(l => { if (!seen.has(l.from)) { seen.add(l.from); st.push(l.from); } }); }
    return [...seen].map(node);
  }

  // ---------- 위젯 추가/삭제/연결 ----------
  function available(type) { const c = CATS[WIDGETS[type].cat]; return !c.addon || addons.image; }
  function addNode(type, x, y) {
    const same = S.nodes.filter(n => n.type === type).length;
    const n = { id: 'n' + S.nextId++, type, x: Math.round(x), y: Math.round(y), title: same ? `${type} (${same})` : type, settings: WIDGETS[type].defaults(), out: {}, inputs: {} };
    S.nodes.push(n);
    evaluate();
    return n;
  }
  function removeNode(id) {
    S.nodes = S.nodes.filter(n => n.id !== id); S.links = S.links.filter(l => l.from !== id && l.to !== id);
    if (dlgNode && dlgNode.id === id) closeDialog();
    selected = null; evaluate();
  }
  function candidates(a, b) {
    const A = WIDGETS[a.type], B = WIDGETS[b.type], res = [];
    A.outputs.forEach(o => B.inputs.forEach(i => { if (o.type === i.type) res.push({ out: o.name, inp: i.name, multi: !!i.multi }); }));
    return res;
  }
  function addLink(a, b, out, inp, quiet) {
    const def = WIDGETS[b.type].inputs.find(i => i.name === inp);
    if (!def.multi) {
      const old = S.links.filter(l => l.to === b.id && l.inp === inp && !(l.from === a.id && l.out === out));
      if (old.length) { S.links = S.links.filter(l => !old.includes(l)); if (!quiet) toast(`'${b.title}'의 ${inp} 입력은 하나만 받을 수 있어서 기존 연결을 대체했어요.`); }
    }
    if (!S.links.find(l => l.from === a.id && l.to === b.id && l.out === out && l.inp === inp))
      S.links.push({ id: 'l' + S.nextId++, from: a.id, to: b.id, out, inp });
  }
  function connect(a, b) {
    if (!a || !b || a === b) return;
    if (upstream(a).includes(b)) return toast('순환(되돌아오는) 연결은 만들 수 없어요.', 'err');
    const c = candidates(a, b);
    if (!c.length) return toast(explainNoLink(a, b), 'err');
    if (S.links.some(l => l.from === a.id && l.to === b.id)) return editLinks(a, b);
    const free = c.find(p => p.multi || !S.links.some(l => l.to === b.id && l.inp === p.inp)) || c[0];
    addLink(a, b, free.out, free.inp);
    if (c.length > 1) toast(`연결: ${free.out} → ${free.inp}  (연결선을 클릭하면 신호를 바꿀 수 있어요)`);
    evaluate();
  }
  function explainNoLink(a, b) {
    const A = WIDGETS[a.type], B = WIDGETS[b.type];
    if (!A.outputs.length) return `'${a.title}' 위젯은 출력이 없어서 다른 위젯으로 연결할 수 없어요.`;
    if (!B.inputs.length) return `'${b.title}' 위젯은 입력을 받지 않아요.`;
    return `'${a.title}'의 출력(${A.outputs.map(o => o.name).join(', ')})과 '${b.title}'의 입력(${B.inputs.map(i => i.name).join(', ')})이 맞지 않아요.`;
  }
  function editLinks(a, b) {
    const c = candidates(a, b);
    const cur = S.links.filter(l => l.from === a.id && l.to === b.id);
    modal(`<h3>🔗 연결 편집: ${esc(a.title)} → ${esc(b.title)}</h3>
      <p class="small">어떤 출력 신호를 어떤 입력으로 보낼지 선택하세요. (Orange의 Edit Links)</p>
      <div class="linkopts">${c.map((p, i) => `<label class="lopt"><input type="checkbox" data-i="${i}" ${cur.some(l => l.out === p.out && l.inp === p.inp) ? 'checked' : ''}>
        <span class="lo">${esc(p.out)}</span> <span class="arrow">→</span> <span class="li">${esc(p.inp)}</span></label>`).join('')}</div>
      <div class="btnrow"><button data-act="cancel">취소</button><button class="primary" data-act="ok">확인</button></div>`, root => {
      root.querySelector('[data-act=cancel]').onclick = closeModal;
      root.querySelector('[data-act=ok]').onclick = () => {
        const chosen = $$('input[data-i]', root).filter(x => x.checked).map(x => c[+x.dataset.i]);
        S.links = S.links.filter(l => !(l.from === a.id && l.to === b.id));
        chosen.forEach(p => addLink(a, b, p.out, p.inp));
        closeModal(); selected = null; evaluate();
      };
    });
  }

  // ---------- 캔버스 그리기 ----------
  function renderCanvas() {
    const nodesEl = $('#nodes'); if (!nodesEl) return;
    nodesEl.innerHTML = S.nodes.map(n => {
      const W = WIDGETS[n.type], c = CATS[W.cat].color;
      const status = n.err ? `<span class="badge err" title="${esc(n.err)}">!</span>` : n.busy ? `<span class="badge busy">⏳</span>` : '';
      return `<div class="node ${selected?.kind === 'node' && selected.id === n.id ? 'sel' : ''}" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px">
        <div class="ring">${W.inputs.length ? '<div class="port in" title="입력: ' + W.inputs.map(i => i.name).join(', ') + '"></div>' : ''}
          <div class="circ" style="--c:${c}">${W.icon}</div>
          ${W.outputs.length ? '<div class="port out" title="출력: ' + W.outputs.map(o => o.name).join(', ') + ' (드래그하여 연결)"></div>' : ''}${status}</div>
        <div class="label">${esc(n.title)}</div></div>`;
    }).join('');
    renderLinks();
    renderToolbar();
    const empty = $('#emptyHint'); if (empty) empty.hidden = S.nodes.length > 0;
  }
  function portPos(n, side) { return { x: n.x + (side === 'out' ? 40 : -40), y: n.y }; }
  function curve(p, q) { const dx = Math.max(40, Math.abs(q.x - p.x) / 2); return `M${p.x},${p.y} C${p.x + dx},${p.y} ${q.x - dx},${q.y} ${q.x},${q.y}`; }
  function renderLinks() {
    const svg = $('#links'); if (!svg) return;
    const groups = {};
    S.links.forEach(l => (groups[l.from + '>' + l.to] = groups[l.from + '>' + l.to] || []).push(l));
    svg.innerHTML = Object.values(groups).map(ls => {
      const a = node(ls[0].from), b = node(ls[0].to), p = portPos(a, 'out'), q = portPos(b, 'in');
      const active = ls.some(l => a.out?.[l.out]);
      const sel = selected?.kind === 'link' && ls.some(l => l.id === selected.id);
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
      const label = ls.map(l => {
        const defaultish = WIDGETS[a.type].outputs.length === 1 && WIDGETS[b.type].inputs.filter(i => i.type === WIDGETS[a.type].outputs[0].type).length === 1;
        return defaultish ? '' : `${l.out} → ${l.inp}`;
      }).filter(Boolean);
      return `<g class="link ${active ? 'on' : 'off'} ${sel ? 'sel' : ''}" data-id="${ls[0].id}">
        <path class="hit" d="${curve(p, q)}"/><path class="wire" d="${curve(p, q)}"/>
        ${label.map((t, i) => `<text x="${mx}" y="${my - 8 - (label.length - 1 - i) * 14}">${esc(t)}</text>`).join('')}</g>`;
    }).join('') + '<path id="tmpLink" class="wire tmp" d=""/>';
  }
  function renderToolbar() {
    const tb = $('#seltool'); if (!tb) return;
    if (!selected) { tb.hidden = true; return; }
    if (selected.kind === 'node') {
      const n = node(selected.id); if (!n) { tb.hidden = true; return; }
      tb.style.left = n.x + 'px'; tb.style.top = (n.y - 78) + 'px';
      tb.innerHTML = `<button data-t="open">열기</button><button data-t="rename">이름</button><button data-t="learn">설명</button><button data-t="del" class="danger">삭제</button>`;
    } else {
      const l = S.links.find(x => x.id === selected.id); if (!l) { tb.hidden = true; return; }
      const a = node(l.from), b = node(l.to);
      tb.style.left = (a.x + b.x) / 2 + 'px'; tb.style.top = ((a.y + b.y) / 2 - 50) + 'px';
      tb.innerHTML = `<button data-t="edit">신호 편집</button><button data-t="unlink" class="danger">연결 삭제</button>`;
    }
    tb.hidden = false;
  }

  // ---------- 포인터 상호작용 ----------
  function canvasPoint(e) { const r = $('#canvas').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function bindCanvas() {
    const cv = $('#canvas');
    let drag = null, lastTap = { id: null, t: 0 };
    cv.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      if (e.target.closest('#seltool, #quick')) return;
      const port = e.target.closest('.port'), nd = e.target.closest('.node'), lk = e.target.closest('.link');
      closeQuick();
      if (port && nd) {
        drag = { kind: 'link', from: node(nd.dataset.id), side: port.classList.contains('out') ? 'out' : 'in' };
        cv.setPointerCapture(e.pointerId); e.preventDefault(); return;
      }
      if (nd) {
        const n = node(nd.dataset.id), p = canvasPoint(e);
        drag = { kind: 'node', n, dx: p.x - n.x, dy: p.y - n.y, moved: false, el: nd };
        cv.setPointerCapture(e.pointerId); e.preventDefault(); return;
      }
      if (lk) { selected = { kind: 'link', id: lk.dataset.id }; renderCanvas(); return; }
      if (selected) { selected = null; renderCanvas(); }
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const p = canvasPoint(e);
      if (drag.kind === 'node') {
        const nx = Math.max(50, p.x - drag.dx), ny = Math.max(45, p.y - drag.dy);
        if (Math.abs(nx - drag.n.x) + Math.abs(ny - drag.n.y) > 2) drag.moved = true;
        drag.n.x = nx; drag.n.y = ny;
        drag.el.style.left = nx + 'px'; drag.el.style.top = ny + 'px';
        renderLinks(); if (selected) renderToolbar();
      } else {
        const s = portPos(drag.from, drag.side);
        $('#tmpLink').setAttribute('d', drag.side === 'out' ? curve(s, p) : curve(p, s));
        $$('.node.target').forEach(x => x.classList.remove('target'));
        const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.node');
        if (over && over.dataset.id !== drag.from.id) over.classList.add('target');
      }
    });
    cv.addEventListener('pointerup', e => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.kind === 'node') {
        if (!d.moved) {
          const now = Date.now();
          if (lastTap.id === d.n.id && now - lastTap.t < 400) { openDialog(d.n); lastTap = { id: null, t: 0 }; }
          else { lastTap = { id: d.n.id, t: now }; selected = { kind: 'node', id: d.n.id }; renderCanvas(); }
        } else { save(); }
        return;
      }
      $('#tmpLink').setAttribute('d', '');
      $$('.node.target').forEach(x => x.classList.remove('target'));
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.node');
      if (over) { const t = node(over.dataset.id); d.side === 'out' ? connect(d.from, t) : connect(t, d.from); }
      else if (e.target.closest('#canvas') || document.elementFromPoint(e.clientX, e.clientY)?.closest('#canvas')) quickMenu(d.from, d.side, canvasPoint(e));
    });
    cv.addEventListener('dblclick', e => { const lk = e.target.closest('.link'); if (lk) { const l = S.links.find(x => x.id === lk.dataset.id); editLinks(node(l.from), node(l.to)); } });
    $('#seltool').addEventListener('click', e => {
      const t = e.target.dataset.t; if (!t || !selected) return;
      if (selected.kind === 'node') {
        const n = node(selected.id);
        if (t === 'open') openDialog(n);
        if (t === 'del') removeNode(n.id);
        if (t === 'learn') Learn.open(n.type);
        if (t === 'rename') { const v = prompt('새 위젯 이름', n.title); if (v && v.trim()) { n.title = v.trim(); evaluate(); } }
      } else {
        const l = S.links.find(x => x.id === selected.id);
        if (t === 'edit') editLinks(node(l.from), node(l.to));
        if (t === 'unlink') { S.links = S.links.filter(x => !(x.from === l.from && x.to === l.to)); selected = null; evaluate(); }
      }
    });
    document.addEventListener('keydown', e => {
      if (!selected || $('#view-sim').hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selected.kind === 'node') removeNode(selected.id);
        else { const l = S.links.find(x => x.id === selected.id); S.links = S.links.filter(x => !(x.from === l.from && x.to === l.to)); selected = null; evaluate(); }
      }
    });
  }

  // 점선(포트)을 끌어 빈 곳에 놓으면 연결 가능한 위젯 목록
  function quickMenu(from, side, p) {
    const list = Object.keys(WIDGETS).filter(available).filter(t => {
      const tmp = { type: t };
      return side === 'out' ? candidates(from, tmp).length : candidates(tmp, from).length;
    });
    const qm = $('#quick');
    qm.innerHTML = `<div class="qh">${side === 'out' ? '연결할 위젯 선택' : '입력을 보낼 위젯 선택'}</div>` + list.map(t => `<button data-w="${t}"><span class="mini" style="--c:${CATS[WIDGETS[t].cat].color}">${WIDGETS[t].icon}</span>${t}</button>`).join('');
    qm.style.left = p.x + 'px'; qm.style.top = p.y + 'px'; qm.hidden = false;
    qm.onclick = e => {
      const b = e.target.closest('[data-w]'); if (!b) return;
      closeQuick();
      const n = addNode(b.dataset.w, p.x + (side === 'out' ? 40 : -40), p.y);
      side === 'out' ? connect(from, n) : connect(n, from);
    };
  }
  function closeQuick() { const q = $('#quick'); if (q) q.hidden = true; }

  // ---------- 팔레트 ----------
  function renderPalette() {
    const el = $('#palette');
    el.innerHTML = Object.entries(CATS).filter(([k, c]) => !c.addon || addons.image).map(([k, c]) => `
      <details open class="pcat"><summary style="--c:${c.color}">${c.label}</summary>
      <div class="pitems">${Object.keys(WIDGETS).filter(t => WIDGETS[t].cat === k).map(t =>
      `<button class="pw" data-w="${t}" title="${esc(WIDGET_DOCS[t]?.summary || '')}"><span class="mini" style="--c:${c.color}">${WIDGETS[t].icon}</span><span>${t}</span></button>`).join('')}</div></details>`).join('')
      + (addons.image ? '' : `<div class="addon-tip">🧩 이미지 위젯이 필요하면<br><b>Options → Add-ons</b>에서<br>Image Analytics를 설치하세요.</div>`);
    // 끌어다 놓기 + 클릭으로 추가
    $$('.pw', el).forEach(b => {
      b.addEventListener('pointerdown', e => {
        const t = b.dataset.w, ghost = document.createElement('div');
        ghost.className = 'ghost'; ghost.innerHTML = `<span class="mini" style="--c:${CATS[WIDGETS[t].cat].color}">${WIDGETS[t].icon}</span>`;
        let started = false; const sx = e.clientX, sy = e.clientY;
        const mv = ev => {
          if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { started = true; document.body.appendChild(ghost); }
          if (started) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
        };
        const up = ev => {
          document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
          ghost.remove();
          if (started) {
            const over = document.elementFromPoint(ev.clientX, ev.clientY);
            if (over && over.closest('#canvas')) { const p = canvasPoint(ev); addNode(t, Math.max(60, p.x), Math.max(50, p.y)); }
          } else {
            const wrap = $('#canvasWrap');
            const sp = freeSpot(wrap.scrollLeft + 120, wrap.scrollTop + 90);
            const n = addNode(t, sp.x, sp.y); selected = { kind: 'node', id: n.id }; renderCanvas();
          }
        };
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
        e.preventDefault();
      });
    });
  }
  function freeSpot(x0, y0) {
    for (let r = 0; r < 12; r++) for (let c = 0; c < 6; c++) {
      const x = x0 + c * 150, y = y0 + r * 120;
      if (!S.nodes.some(n => Math.abs(n.x - x) < 110 && Math.abs(n.y - y) < 90)) return { x, y };
    }
    return { x: x0, y: y0 };
  }

  // ---------- 위젯 창 ----------
  function openDialog(n) {
    dlgNode = n; n.opened = true;
    const W = WIDGETS[n.type], d = $('#dlg');
    d.classList.toggle('wide', !!W.wide);
    $('.wtitle .wname', d).innerHTML = `<span class="mini" style="--c:${CATS[W.cat].color}">${W.icon}</span> ${esc(n.title)}`;
    d.hidden = false;
    if (!d.dataset.placed) { d.dataset.placed = 1; }
    rerenderDialog();
    save(); checkMissions();
  }
  function rerenderDialog() {
    if (!dlgNode) return;
    const n = node(dlgNode.id); if (!n) return closeDialog();
    dlgNode = n;
    const body = $('#dlg .wbody'), st = body.scrollTop;
    try { WIDGETS[n.type].dialog(n, n.inputs, body); } catch (e) { console.error(e); body.innerHTML = `<div class="note err">⚠️ ${esc(e.message)}</div>`; }
    body.scrollTop = st;
    const W = WIDGETS[n.type];
    $('#dlg .wstatus').innerHTML = `${W.inputs.length ? '⬅ 입력: ' + W.inputs.map(i => `<span class="${(i.multi ? n.inputs[i.name]?.length : n.inputs[i.name]) ? 'on' : ''}">${i.name}${i.multi && n.inputs[i.name]?.length ? ' ×' + n.inputs[i.name].length : ''}</span>`).join(' ') : ''}
      ${W.outputs.length ? '&nbsp; ➡ 출력: ' + W.outputs.map(o => `<span class="${n.out[o.name] ? 'on' : ''}">${o.name}</span>`).join(' ') : ''}`;
  }
  function closeDialog() { dlgNode = null; const d = $('#dlg'); if (d) d.hidden = true; }
  function setSetting(n, patch) {
    n.settings = { ...n.settings, ...patch };
    evaluate();
    rerenderDialog();
  }
  function markView(n) {
    const s = n.settings;
    if (s.x && s.y && s.x !== s.y && s.color) { const k = s.x + '|' + s.y; if (!s.views.includes(k)) { s.views = [...s.views, k]; save(); setTimeout(checkMissions); } }
  }
  function embedDone(n, key) {
    if (n._embKey === key) return !!n._embDone;
    n._embKey = key; n._embDone = false; n.busy = 1;
    clearInterval(n._timer);
    n._timer = setInterval(() => {
      if (n._embKey !== key) return clearInterval(n._timer);
      n.busy = Math.min(100, n.busy + 7 + Math.random() * 8);
      if (n.busy >= 100) { clearInterval(n._timer); n.busy = 0; n._embDone = true; evaluate(); toast(`🧬 ${n.title}: 이미지 임베딩 완료`); }
      if (dlgNode && dlgNode.id === n.id) rerenderDialog();
    }, 110);
    return false;
  }
  function bindDialog() {
    const d = $('#dlg'), bar = $('.wtitle', d);
    $('[data-act=close]', d).onclick = closeDialog;
    $('[data-act=help]', d).onclick = () => dlgNode && Learn.open(dlgNode.type);
    let off = null;
    bar.addEventListener('pointerdown', e => { if (e.target.closest('button') || innerWidth < 760) return; const r = d.getBoundingClientRect(); off = { x: e.clientX - r.left, y: e.clientY - r.top }; bar.setPointerCapture(e.pointerId); });
    bar.addEventListener('pointermove', e => { if (!off) return; d.style.left = Math.max(0, e.clientX - off.x) + 'px'; d.style.top = Math.max(0, e.clientY - off.y) + 'px'; d.style.transform = 'none'; });
    bar.addEventListener('pointerup', () => off = null);
  }

  // ---------- 모달 / 토스트 ----------
  function modal(html, bind) { const m = $('#modal'); $('.mbox', m).innerHTML = html; m.hidden = false; bind && bind($('.mbox', m)); }
  function closeModal() { $('#modal').hidden = true; }
  let toastT;
  function toast(msg, kind) { const t = $('#toast'); t.textContent = msg; t.className = 'show ' + (kind || ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = '', 3200); }

  function showAddons() {
    modal(`<h3>🧩 Add-ons</h3><p class="small">Orange 메뉴의 [Options] → [Add-ons...]와 같은 기능입니다. 설치할 추가 기능을 선택하세요.</p>
      <table class="addons"><tr><th></th><th>Name</th><th>설명</th></tr>
      <tr><td><input type="checkbox" id="ad-img" ${addons.image ? 'checked' : ''}></td><td><b>Image Analytics</b></td><td>이미지 불러오기, 이미지 임베딩, 이미지 보기 위젯</td></tr>
      <tr class="dis"><td><input type="checkbox" disabled></td><td>Text Mining</td><td>텍스트 데이터 분석 (이 실습에서는 사용하지 않음)</td></tr>
      <tr class="dis"><td><input type="checkbox" disabled></td><td>Timeseries</td><td>시계열 분석 (이 실습에서는 사용하지 않음)</td></tr></table>
      <div class="btnrow"><button data-act="cancel">Cancel</button><button class="primary" data-act="ok">OK</button></div>`, root => {
      root.querySelector('[data-act=cancel]').onclick = closeModal;
      root.querySelector('[data-act=ok]').onclick = () => {
        const v = $('#ad-img').checked;
        if (!v && S.nodes.some(n => WIDGETS[n.type].cat === 'Image')) return toast('캔버스에 이미지 위젯이 있어서 제거할 수 없어요.', 'err');
        const inst = v && !addons.image;
        addons.image = v; store.set('addons', addons); closeModal(); renderPalette(); checkMissions();
        if (inst) toast('✅ Image Analytics가 설치되었습니다. 왼쪽에 Image Analytics 카테고리가 생겼어요!');
      };
    });
  }

  // ---------- 미션 ----------
  const has = t => S.nodes.filter(n => n.type === t);
  const linked = (a, b, out, inp) => S.links.some(l => l.from === a.id && l.to === b.id && (!out || l.out === out) && (!inp || l.inp === inp));
  const inId = (n, ch) => n.inputs?.[ch]?.id || '';
  function evalOf(n) { return n.out['Evaluation Results']; }

  const MISSIONS = {
    penguin: {
      title: '활동 3 · 펭귄 종류 분류',
      goal: '펭귄 데이터를 분석하여 펭귄의 종류를 분류하는 인공지능 모델을 만들 수 있다.',
      stages: ['1. 데이터 수집하기', '2. 데이터 전처리하기', '3. 데이터 시각화하기', '4. 모델 학습하기', '5. 모델 성능 평가하기'],
      steps: [
        { st: 0, t: "Data 카테고리의 <b>File</b> 위젯을 캔버스로 가져오세요.", h: '왼쪽 Data 카테고리에서 File을 캔버스로 끌어다 놓거나 클릭하세요.', w: 'File', ok: () => has('File').length },
        { st: 0, t: "File 위젯을 더블 클릭하고 Source에서 <b>penguins_size.csv</b>를 불러오세요.", h: '위젯을 더블 클릭(또는 선택 후 [열기])하면 설정 창이 열려요. 실제로는 캐글에서 내려받은 파일을 선택합니다.', w: 'File', ok: () => has('File').some(n => n.settings.dataset === 'penguins') },
        { st: 0, t: "분류하려는 속성 <b>species</b>의 Role을 <b>target</b>으로 바꾸고 <b>Apply</b>를 누르세요.", h: 'Columns 표에서 species 행의 Role을 feature → target으로 바꾼 뒤 Apply 버튼을 눌러야 적용돼요.', w: 'File', ok: () => has('File').some(n => n.settings.roles.species === 'target') },
        { st: 1, t: "<b>Data Table</b> 위젯을 File과 연결하고 더블 클릭하여 데이터 개수(344개)와 결측치(0.9%)를 확인하세요.", h: 'File 위젯 오른쪽 점선(출력)을 끌어서 Data Table 위에 놓으면 연결돼요.', w: 'Data Table', ok: () => has('Data Table').some(n => n.opened && inId(n, 'Data').startsWith('file:p:')) },
        { st: 1, t: "Transform의 <b>Preprocess</b> 위젯에서 <b>Impute Missing Values</b> → <b>Remove rows with missing values</b>를 선택해 결측치를 제거하세요. (File → Preprocess → Data Table 순서로 연결)", h: 'File → Preprocess를 연결하고, Preprocess → Data Table을 연결하면 기존 File → Data Table 연결이 자동으로 대체돼요. Data Table에서 333개로 줄었는지 확인!', w: 'Preprocess', ok: () => has('Preprocess').some(p => p.settings.steps.some(s => s.type === 'impute' && s.method === 'remove') && p.inputs.Data && has('Data Table').some(d => upstream(d).includes(p))) },
        { st: 2, t: "Visualize의 <b>Scatter Plot</b>을 Data Table과 연결하고, 속성(Attributes)의 <b>Color</b>를 <b>species</b>로 선택하세요.", h: 'Scatter Plot 창 왼쪽의 Attributes → Color 목록에서 species를 고르면 종류별로 색이 달라져요.', w: 'Scatter Plot', ok: () => has('Scatter Plot').some(n => n.opened && n.inputs.Data && n.settings.color === 'species' && upstream(n).some(u => u.type === 'Data Table')) },
        { st: 2, t: "x축과 y축을 바꿔 가며 속성에 따른 species 분포를 확인하세요. (<b>3가지 이상</b> 조합)", h: 'Axis x, Axis y를 바꿔 보세요. 어떤 두 속성을 고르면 세 종류가 가장 잘 나뉘나요? (예: culmen_length_mm × flipper_length_mm)', w: 'Scatter Plot', ok: () => has('Scatter Plot').some(n => n.settings.color === 'species' && n.settings.views.length >= 3) },
        { st: 3, t: "Transform의 <b>Data Sampler</b>를 Data Table과 연결하고 훈련 데이터:테스트 데이터를 <b>8:2</b>(Fixed proportion 80%)로 나누세요.", h: 'Data Sampler 창에서 Fixed proportion of data 슬라이더를 80%로 맞추세요.', w: 'Data Sampler', ok: () => has('Data Sampler').some(n => n.inputs.Data && n.settings.mode === 'prop' && n.settings.prop === 80 && upstream(n).some(u => u.type === 'Data Table')) },
        { st: 3, t: "Model의 <b>kNN</b>과 <b>Logistic Regression</b>을 Data Sampler의 <b>Data Sample</b>(훈련 데이터)과 연결하세요.", h: 'Data Sampler → kNN을 연결하면 기본으로 Data Sample → Data로 연결돼요. 연결선의 글자를 확인하세요.', w: 'kNN', ok: () => ['kNN', 'Logistic Regression'].every(t => has(t).some(m => has('Data Sampler').some(s => linked(s, m, 'Data Sample', 'Data')))) },
        { st: 4, t: "Evaluate의 <b>Test and Score</b>를 Data Sampler와 연결하고, <b>Data Sample → Data</b>, <b>Remaining Data → Test Data</b>로 연결하세요.", h: '처음 연결하면 Data Sample → Data만 연결돼요. 연결선을 클릭 → [신호 편집]에서 Remaining Data → Test Data도 체크하세요.', w: 'Test and Score', ok: () => has('Test and Score').some(t => has('Data Sampler').some(s => linked(s, t, 'Data Sample', 'Data') && linked(s, t, 'Remaining Data', 'Test Data'))) },
        { st: 4, t: "kNN과 Logistic Regression을 Test and Score와 연결하고, 옵션에서 <b>Test on test data</b>를 선택하세요.", h: '모델 위젯 → Test and Score를 연결하면 Learner 신호가 전달돼요. 그런 다음 Test and Score 창을 열어 Test on test data를 선택하세요.', w: 'Test and Score', ok: () => has('Test and Score').some(t => t.opened && t.settings.method === 'test' && t.inputs['Test Data'] && ['kNN', 'Logistic Regression'].every(k => has(k).some(m => linked(m, t, 'Learner'))) && evalOf(t)?.ready()) },
        {
          st: 4, t: "모델 성능 평가 결과를 해석해 보세요.", q: () => {
            const t = has('Test and Score').find(t => evalOf(t)?.ready()); if (!t) return null;
            const r = evalOf(t).get(); const best = Math.max(...r.results.map(x => x.CA));
            const winners = r.results.filter(x => Math.abs(x.CA - best) < 1e-9).map(x => x.name);
            return {
              id: 'p1', text: 'Test and Score 결과에서 분류 정확도(CA)가 더 높은 모델은 무엇인가요?',
              options: [...r.results.map(x => x.name), '두 모델이 같다'], answer: winners.length > 1 ? '두 모델이 같다' : winners[0],
              explain: `결과: ${r.results.map(x => `${x.name} CA=${x.CA.toFixed(3)}`).join(', ')}. 펭귄 데이터는 종류별 부리·날개 길이 차이가 커서 두 모델 모두 매우 높은 정확도를 보여요. Data Sampler의 [Sample Data]를 눌러 다른 훈련/테스트 데이터로 나누면 결과가 조금씩 달라질 수 있어요.`
            };
          }
        }
      ],
      eval: [['추상화 능력', '문제 해결을 위해 학습 모델을 알맞게 선택하였는가?'], ['자동화 능력', '인공지능 학습 모델을 의도한 대로 구현하였는가?'], ['인공지능 문제 해결력', '두 모델의 성능을 비교해 보고 해석할 수 있는가?']]
    },
    lung: {
      title: '활동 4 · 폐 이미지 분류',
      goal: '이미지 데이터를 분류하는 기계학습 및 인공신경망 모델을 만들 수 있다.',
      stages: ['1. 데이터 수집하기', '2. 데이터 전처리하기', '3. 모델 학습하기', '4. 모델 성능 평가하기'],
      steps: [
        { st: 0, t: "메뉴의 <b>[Options] → [Add-ons...]</b>에서 <b>Image Analytics</b>를 추가하세요.", h: '캔버스 위쪽 메뉴의 Options를 누르세요.', ok: () => addons.image },
        { st: 0, t: "Image Analytics의 <b>Import Images</b>를 캔버스로 가져와 <b>train</b> 폴더를 선택해 훈련 이미지를 불러오세요.", h: '압축을 풀면 훈련 데이터 250개, 테스트 데이터 66개가 있어요. 먼저 train 폴더!', w: 'Import Images', ok: () => has('Import Images').some(n => n.settings.folder === 'train') },
        { st: 0, t: "<b>Image Viewer</b>를 Import Images와 연결하고 더블 클릭하여 이미지를 확인하세요.", h: 'Covid, Normal, Viral Pneumonia 이미지는 어떻게 다른가요? 폐 부분의 흐린 음영을 살펴보세요.', w: 'Image Viewer', ok: () => has('Image Viewer').some(n => n.opened && inId(n, 'Data') === 'img:train') },
        { st: 1, t: "<b>Image Embedding</b>을 Import Images(train)와 연결하여 이미지 특징을 추출(임베딩)하세요.", h: '위젯의 점선 부분을 클릭하고 드래그해서 빈 곳에 놓으면 연결할 위젯을 쉽게 고를 수 있어요.', w: 'Image Embedding', ok: () => has('Image Embedding').some(n => (n.out.Embeddings?.id || '').startsWith('img:train')) },
        { st: 1, t: "Image Embedding과 <b>Data Table</b>을 연결하여 이미지 정보와 특징(n0, n1, …)을 확인하세요.", h: '이미지 1장이 여러 개의 숫자(특징)로 바뀐 것을 확인하세요.', w: 'Data Table', ok: () => has('Data Table').some(n => n.opened && inId(n, 'Data').startsWith('img:train|emb')) },
        { st: 2, t: "Model의 <b>Random Forest</b>를 Image Embedding과 연결하여 학습시키세요.", h: 'Image Embedding → Random Forest', w: 'Random Forest', ok: () => has('Random Forest').some(n => inId(n, 'Data').startsWith('img:train|emb')) },
        { st: 2, t: "<b>kNN</b>, <b>Neural Network</b>도 같은 방법으로 Image Embedding과 연결하세요.", h: '세 모델 모두 같은 임베딩 데이터로 학습해요.', w: 'Neural Network', ok: () => ['kNN', 'Neural Network'].every(t => has(t).some(n => inId(n, 'Data').startsWith('img:train|emb'))) },
        { st: 3, t: "<b>Test and Score</b>에 Image Embedding(Data)과 Random Forest·kNN·Neural Network(Learner)를 연결하고 결과를 확인하세요.", h: 'Image Embedding → Test and Score는 Embeddings → Data로 연결돼야 해요. 기본 평가 방법은 교차검증(Cross validation)이에요.', w: 'Test and Score', ok: () => has('Test and Score').some(t => t.opened && inId(t, 'Data').startsWith('img:train|emb') && ['Random Forest', 'kNN', 'Neural Network'].every(k => has(k).some(m => linked(m, t, 'Learner'))) && evalOf(t)?.ready()) },
        {
          st: 3, t: "가장 좋은 성능을 보인 모델을 선택하세요.", q: () => {
            const t = has('Test and Score').find(t => inId(t, 'Data').startsWith('img:train|emb') && evalOf(t)?.ready()); if (!t) return null;
            const r = evalOf(t).get(), best = Math.max(...r.results.map(x => x.CA));
            return {
              id: 'l1', text: 'Test and Score 결과에서 분류 정확도(CA)가 가장 높은 모델은?', options: r.results.map(x => x.name),
              answer: r.results.find(x => x.CA === best).name, multiOk: r.results.filter(x => Math.abs(x.CA - best) < 1e-9).map(x => x.name),
              explain: `결과: ${r.results.map(x => `${x.name} CA=${x.CA.toFixed(3)}`).join(', ')}. 이 모델을 Predictions에서 사용해 보세요. 모델의 설정(나무 개수, 이웃 수, 뉴런 수)을 바꾸면 결과도 달라져요!`
            };
          }
        },
        { st: 3, t: "<b>Confusion Matrix</b>를 Test and Score와 연결하여 혼동행렬을 확인하세요.", h: '어떤 클래스끼리 가장 많이 헷갈렸나요? 왼쪽 Learners에서 모델을 바꿔 가며 비교하세요.', w: 'Confusion Matrix', ok: () => has('Confusion Matrix').some(n => n.opened && n.inputs['Evaluation Results']) },
        { st: 3, t: "새 <b>Import Images</b>로 <b>test</b> 폴더를 불러와 새 <b>Image Embedding</b>으로 임베딩하세요.", h: '훈련용과 별도로 Import Images (1) → Image Embedding (1)을 만들어요.', w: 'Import Images', ok: () => has('Image Embedding').some(n => (n.out.Embeddings?.id || '').startsWith('img:test')) },
        { st: 3, t: "<b>Predictions</b>에 테스트 임베딩(Data)과 좋은 성능을 보인 모델(Model)을 연결하고 더블 클릭하여 결과를 확인하세요.", h: '모델 위젯 → Predictions를 연결하면 학습된 Model이 전달돼요. 테스트 Image Embedding → Predictions는 Data로 연결돼요.', w: 'Predictions', ok: () => has('Predictions').some(n => n.opened && inId(n, 'Data').startsWith('img:test|emb') && n.inputs.Predictors.length && n._predWrong != null) },
        {
          st: 3, t: "분류한 결과를 해석해 보세요.", q: () => {
            const p = has('Predictions').find(n => inId(n, 'Data').startsWith('img:test|emb') && n._predWrong != null); if (!p) return null;
            return { id: 'l2', text: `Predictions에서 첫 번째 모델(${p.inputs.Predictors[0].learner.name})이 잘못 분류한 테스트 이미지는 몇 개인가요? (빨간 행의 수)`, input: true, answer: String(p._predWrong), explain: `테스트 이미지 66개 중 ${p._predWrong}개를 잘못 분류했어요 (정확도 ${(100 * (66 - p._predWrong) / 66).toFixed(1)}%). 잘못 분류된 이미지는 주로 Covid와 Viral Pneumonia처럼 비슷한 음영을 가진 경우가 많아요. 혼동행렬 결과와 비교해 보세요.` };
          }
        }
      ],
      eval: [['추상화 능력', '다양한 모델 중 가장 좋은 성능을 보이는 모델을 선택할 수 있는가?'], ['자동화 능력', '최적의 모델을 활용하여 코로나 폐 이미지를 분류하였는가?'], ['인공지능 문제 해결력', '학습 모델 성능을 평가하는 방법을 해석할 수 있는가?']]
    }
  };

  let missionTimer;
  function checkMissions() { clearTimeout(missionTimer); missionTimer = setTimeout(renderMission, 60); }
  function renderMission() {
    const el = $('#mission'); if (!el || !S) return;
    const M = MISSIONS[activity];
    if (!M) {
      el.innerHTML = `<h2>🧪 자유 실습</h2><p>원하는 위젯을 자유롭게 연결해 보세요. 펭귄 데이터와 X-ray 이미지 데이터를 모두 사용할 수 있어요.</p>
        <ul class="tips"><li>위젯을 <b>더블 클릭</b>하면 설정 창이 열려요.</li><li>위젯 오른쪽 <b>점선(출력)</b>을 끌어 다른 위젯에 놓으면 연결돼요.</li><li>점선을 빈 곳에 놓으면 연결 가능한 위젯 목록이 나와요.</li><li>연결선을 클릭하면 신호를 편집하거나 삭제할 수 있어요.</li><li>선택 후 <kbd>Delete</kbd> 키로 삭제할 수 있어요.</li></ul>`;
      return;
    }
    let done = 0, firstOpen = -1;
    const rows = M.steps.map((s, i) => {
      let ok = false, q = null;
      if (s.q) { q = s.q(); ok = !!(q && S.answers[q.id]?.correct); }
      else ok = !!s.ok();
      ok = ok && done === i; if (ok) done++;
      if (!ok && firstOpen < 0) firstOpen = i;
      return { s, ok, q, i };
    });
    let html = `<div class="mhead"><h2>${M.title}</h2><div class="goal">🎯 <b>학습 목표</b> ${M.goal}</div>
      <div class="prog"><div style="width:${100 * done / M.steps.length}%"></div></div><div class="progt">${done} / ${M.steps.length} 단계 완료</div></div><ol class="steps">`;
    let lastSt = -1;
    rows.forEach(({ s, ok, q, i }) => {
      if (s.st !== lastSt) { html += `<li class="stage">${M.stages[s.st]}</li>`; lastSt = s.st; }
      const cur = i === firstOpen;
      html += `<li class="step ${ok ? 'done' : ''} ${cur ? 'cur' : ''} ${i > firstOpen && firstOpen >= 0 ? 'later' : ''}"><span class="chk">${ok ? '✔' : i + 1}</span><div><div>${s.t}</div>`;
      if (cur && s.h) html += `<details class="hint"><summary>💡 힌트</summary>${s.h}${s.w ? ` <a href="#learn-${encodeURIComponent(s.w)}" class="lk">📖 ${s.w} 위젯 알아보기</a>` : ''}</details>`;
      if (cur && s.q) {
        if (!q) html += `<div class="small muted">앞 단계를 먼저 완료하고 결과 창을 열어 주세요.</div>`;
        else {
          const a = S.answers[q.id];
          html += `<div class="qbox"><div class="qt">❓ ${q.text}</div>${q.input ? `<input type="number" class="qin" value="${a?.v ?? ''}"> <button class="primary qsub">확인</button>` :
            q.options.map(o => `<button class="qopt ${a?.v === o ? (a.correct ? 'right' : 'wrong') : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}
            ${a && !a.correct ? '<div class="fb wrong">❌ 다시 확인해 보세요. 결과 창의 숫자를 살펴보세요.</div>' : ''}</div>`;
        }
      }
      if (ok && s.q && q) html += `<div class="fb right">✅ 정답! ${q.explain}</div>`;
      html += `</div></li>`;
    });
    html += '</ol>';
    if (done === M.steps.length) {
      html += `<div class="finish">🎉 <b>모든 단계를 완료했어요!</b><br>아래 평가 기준을 스스로 점검해 보세요.</div>`;
    }
    html += `<div class="selfeval"><h3>📝 평가하기 <small>역량과 평가 기준을 스스로 점검해 봅시다.</small></h3>
      ${M.eval.map(([a, b], i) => `<div class="ev"><div><b>${a}</b><br><span>${b}</span></div><div class="stars">${[1, 2, 3].map(k => `<button data-e="${i}" data-s="${k}" class="${(S.selfEval[i] || 0) >= k ? 'on' : ''}" aria-label="${k}점">★</button>`).join('')}</div></div>`).join('')}</div>`;
    el.innerHTML = html;
    // 문제 응답
    $$('.qopt', el).forEach(b => b.onclick = () => {
      const q = rows[firstOpen].q, v = b.dataset.v;
      S.answers[q.id] = { v, correct: v === q.answer || (q.multiOk || []).includes(v) };
      save(); renderMission();
    });
    const qs = $('.qsub', el);
    if (qs) qs.onclick = () => { const q = rows[firstOpen].q, v = $('.qin', el).value.trim(); S.answers[q.id] = { v, correct: v === q.answer }; save(); renderMission(); };
    $$('.stars button', el).forEach(b => b.onclick = () => { S.selfEval[b.dataset.e] = +b.dataset.s; save(); renderMission(); });
    const cur = $('.step.cur', el); if (cur && !el.dataset.scrolled) { }
  }

  // ---------- 정답 워크플로 ----------
  function buildSolution() {
    const L = (a, b, o, i) => addLink(node(a), node(b), o, i, true);
    S.nodes = []; S.links = [];
    const mk = (type, x, y, settings, title) => { const n = { id: 'n' + S.nextId++, type, x, y, title: title || type, settings: { ...WIDGETS[type].defaults(), ...settings }, out: {}, inputs: {} }; S.nodes.push(n); return n.id; };
    if (activity === 'penguin') {
      const f = mk('File', 70, 220, { dataset: 'penguins', roles: { species: 'target' } });
      const p = mk('Preprocess', 190, 220, { steps: [{ type: 'impute', method: 'remove' }] });
      const d = mk('Data Table', 310, 220);
      const sc = mk('Scatter Plot', 440, 90, { color: 'species', x: 'culmen_length_mm', y: 'flipper_length_mm' });
      const ds = mk('Data Sampler', 440, 300, { prop: 80 });
      const k = mk('kNN', 580, 210), lr = mk('Logistic Regression', 580, 390);
      const ts = mk('Test and Score', 730, 300, { method: 'test' });
      L(f, p, 'Data', 'Data'); L(p, d, 'Preprocessed Data', 'Data'); L(d, sc, 'Data', 'Data'); L(d, ds, 'Data', 'Data');
      L(ds, k, 'Data Sample', 'Data'); L(ds, lr, 'Data Sample', 'Data'); L(ds, ts, 'Data Sample', 'Data'); L(ds, ts, 'Remaining Data', 'Test Data');
      L(k, ts, 'Learner', 'Learner'); L(lr, ts, 'Learner', 'Learner');
    } else if (activity === 'lung') {
      addons.image = true; store.set('addons', addons); renderPalette();
      const im = mk('Import Images', 70, 220, { folder: 'train' });
      const iv = mk('Image Viewer', 200, 80);
      const em = mk('Image Embedding', 210, 240);
      const dt = mk('Data Table', 360, 80);
      const rf = mk('Random Forest', 370, 200), kn = mk('kNN', 370, 310), nn = mk('Neural Network', 370, 420);
      const ts = mk('Test and Score', 530, 260), cm = mk('Confusion Matrix', 680, 260);
      const im2 = mk('Import Images', 70, 560, { folder: 'test' }, 'Import Images (1)');
      const em2 = mk('Image Embedding', 210, 560, {}, 'Image Embedding (1)');
      const pr = mk('Predictions', 560, 560);
      L(im, iv, 'Data', 'Data'); L(im, em, 'Data', 'Images'); L(em, dt, 'Embeddings', 'Data');
      [rf, kn, nn].forEach(m => { L(em, m, 'Embeddings', 'Data'); L(m, ts, 'Learner', 'Learner'); });
      L(em, ts, 'Embeddings', 'Data'); L(ts, cm, 'Evaluation Results', 'Evaluation Results');
      L(im2, em2, 'Data', 'Images'); L(em2, pr, 'Embeddings', 'Data'); L(nn, pr, 'Model', 'Predictors');
    }
    selected = null; closeDialog(); evaluate();
    toast('정답 워크플로를 만들었어요. 각 위젯을 더블 클릭해 결과를 확인해 보세요!');
  }

  // ---------- 화면 전환 ----------
  function showSim(act) {
    $$('.view').forEach(v => v.hidden = v.id !== 'view-sim');
    $$('.nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#sim-' + act));
    $('#simTitle').textContent = MISSIONS[act]?.title || '🧪 자유 실습';
    if (activity !== act) load(act);
    renderPalette(); renderCanvas(); renderMission();
  }

  function init() {
    bindCanvas(); bindDialog();
    $('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });
    $('#btnAddons').onclick = showAddons;
    $('#btnReset').onclick = () => modal(`<h3>캔버스 초기화</h3><p>현재 활동의 모든 위젯과 연결, 답안을 지울까요?</p><div class="btnrow"><button data-act="c">취소</button><button class="danger" data-act="ok">초기화</button></div>`, r => {
      r.querySelector('[data-act=c]').onclick = closeModal;
      r.querySelector('[data-act=ok]').onclick = () => { closeModal(); S = blank(); closeDialog(); evaluate(); renderMission(); };
    });
    $('#btnSolution').onclick = () => {
      if (!MISSIONS[activity]) return toast('자유 실습에는 정답 워크플로가 없어요.');
      modal(`<h3>✔ 정답 워크플로 보기</h3><p>현재 캔버스를 지우고 교과서 활동의 완성된 워크플로를 만들까요?<br><small>먼저 스스로 해 본 다음에 확인하는 것을 추천해요!</small></p><div class="btnrow"><button data-act="c">취소</button><button class="primary" data-act="ok">만들기</button></div>`, r => {
        r.querySelector('[data-act=c]').onclick = closeModal;
        r.querySelector('[data-act=ok]').onclick = () => { closeModal(); buildSolution(); };
      });
    };
  }

  return { init, showSim, setSetting, rerenderDialog, toast, cache, hasCache, runAsync, checkMissions, markView, embedDone, closeDialog, MISSIONS };
})();

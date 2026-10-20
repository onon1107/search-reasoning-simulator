// ===== 가상 흉부 X-ray 이미지 데이터셋 =====
// Kaggle 'Covid-19 Image Dataset'(Covid / Normal / Viral Pneumonia)을 흉내 낸 시뮬레이션 데이터입니다.
// 실제 의료 영상이 아니며, 학습용으로 절차적으로 그린 그림입니다.

const XRAY = (() => {
  const CLASSES = ['Covid', 'Normal', 'Viral Pneumonia'];
  const SPLIT = { train: [110, 70, 70], test: [26, 20, 20] };
  const EMB_DIM = 16;

  function clip(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function makeParams(cls, r) {
    const g = () => ML.gauss(r);
    const p = {
      bright: clip(0.5 + 0.12 * g(), 0.2, 0.8),
      scale: clip(1 + 0.06 * g(), 0.85, 1.15),
      shift: 0.04 * g(),
      seed: Math.floor(r() * 1e9)
    };
    if (cls === 'Normal') { p.sev = r() * 0.18; p.periph = r(); p.diffuse = r(); }
    else if (cls === 'Covid') { p.sev = clip(0.62 + 0.2 * g(), 0.1, 1); p.periph = clip(0.75 + 0.15 * g(), 0, 1); p.diffuse = clip(0.35 + 0.15 * g(), 0, 1); }
    else { p.sev = clip(0.58 + 0.2 * g(), 0.1, 1); p.periph = clip(0.35 + 0.15 * g(), 0, 1); p.diffuse = clip(0.7 + 0.15 * g(), 0, 1); }
    return p;
  }

  // 이미지의 시각적 특징을 섞어 만든 '임베딩' 벡터
  const MIX = (() => {
    const r = ML.rng(2024);
    return Array.from({ length: EMB_DIM }, () => Array.from({ length: 6 }, () => ML.gauss(r)));
  })();
  function embed(p, r) {
    const z = [p.sev, p.sev * p.periph, p.sev * p.diffuse, p.bright, p.scale - 1, p.shift];
    return MIX.map(w => {
      let s = 0; for (let j = 0; j < 6; j++) s += w[j] * z[j];
      return +(s + 0.32 * ML.gauss(r)).toFixed(4);
    });
  }

  const cache = {};
  function dataset(split) {
    if (cache[split]) return cache[split];
    const r = ML.rng(split === 'train' ? 101 : 202);
    const items = [];
    CLASSES.forEach((c, ci) => {
      for (let i = 0; i < SPLIT[split][ci]; i++) {
        const prefix = c === 'Covid' ? 'COVID' : c === 'Normal' ? 'NORMAL' : 'VIRAL';
        const params = makeParams(c, r);
        items.push({ name: `${prefix}-${String(i + 1).padStart(3, '0')}`, category: c, params, size: Math.round(40 + r() * 80) * 1000 });
      }
    });
    items.forEach(it => it.emb = embed(it.params, ML.rng(it.params.seed)));
    return cache[split] = items;
  }

  // ---------- 그림 그리기 ----------
  const imgCache = {};
  function render(item, size = 128) {
    const key = item.name + item.category + size;
    if (imgCache[key]) return imgCache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d'), p = item.params, r = ML.rng(p.seed), S = size;
    g.fillStyle = '#050505'; g.fillRect(0, 0, S, S);
    g.save();
    g.translate(S / 2 + p.shift * S, S / 2); g.scale(p.scale, p.scale); g.translate(-S / 2, -S / 2);
    const b = p.bright;
    const gray = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;
    // 몸통
    g.fillStyle = gray(70 + 60 * b);
    g.beginPath(); g.moveTo(S * .12, S); g.quadraticCurveTo(S * .08, S * .3, S * .3, S * .12);
    g.lineTo(S * .7, S * .12); g.quadraticCurveTo(S * .92, S * .3, S * .88, S); g.fill();
    // 폐(어두운 영역)
    const lung = (cx, flip) => {
      const grd = g.createRadialGradient(cx, S * .5, S * .05, cx, S * .52, S * .28);
      grd.addColorStop(0, gray(18 + 20 * b)); grd.addColorStop(1, gray(35 + 30 * b));
      g.fillStyle = grd; g.beginPath();
      g.ellipse(cx, S * .52, S * .155, S * .3, flip * 0.08, 0, Math.PI * 2); g.fill();
    };
    lung(S * .33, 1); lung(S * .67, -1);
    // 갈비뼈
    g.strokeStyle = gray(110 + 70 * b, 0.35); g.lineWidth = S * .018;
    for (let i = 0; i < 7; i++) {
      const y = S * (.27 + i * .085);
      g.beginPath(); g.moveTo(S * .5, y - S * .02); g.quadraticCurveTo(S * .22, y - S * .05, S * .17, y + S * .05); g.stroke();
      g.beginPath(); g.moveTo(S * .5, y - S * .02); g.quadraticCurveTo(S * .78, y - S * .05, S * .83, y + S * .05); g.stroke();
    }
    // 척추, 심장, 쇄골
    g.fillStyle = gray(150 + 70 * b, .9); g.fillRect(S * .47, S * .1, S * .06, S * .9);
    g.fillStyle = gray(130 + 60 * b, .85); g.beginPath(); g.ellipse(S * .54, S * .66, S * .13, S * .12, -.4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = gray(170 + 60 * b, .8); g.lineWidth = S * .025;
    g.beginPath(); g.moveTo(S * .2, S * .2); g.quadraticCurveTo(S * .35, S * .16, S * .47, S * .2); g.stroke();
    g.beginPath(); g.moveTo(S * .8, S * .2); g.quadraticCurveTo(S * .65, S * .16, S * .53, S * .2); g.stroke();
    // 병변 (흐린 음영)
    const n = Math.round(p.sev * 14);
    for (let i = 0; i < n; i++) {
      const side = r() < .5 ? -1 : 1;
      const radial = p.periph * (0.09 + r() * 0.06) + (1 - p.periph) * (0.01 + r() * 0.06);
      const cx = S * (.5 + side * (.12 + radial));
      const cy = S * (.42 + r() * .32 + (p.periph > .5 ? .05 : -.03));
      const rad = S * (0.04 + p.diffuse * 0.09 + r() * 0.03);
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const a = 0.2 + 0.32 * p.sev;
      grd.addColorStop(0, gray(200, a)); grd.addColorStop(1, gray(200, 0));
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // 잡음
    const id = g.getImageData(0, 0, S, S), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const nz = (r() - .5) * 18; d[i] = d[i + 1] = d[i + 2] = clip(d[i] + nz, 0, 255); }
    g.putImageData(id, 0, 0);
    return imgCache[key] = cv.toDataURL('image/jpeg', 0.8);
  }

  return { CLASSES, SPLIT, EMB_DIM, dataset, render };
})();

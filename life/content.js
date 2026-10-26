// 실습 단계·셀·복습 문제 정의
// 코드 안의 [[n]] 은 n번째 빈칸입니다.
(function () {
  const C = window.Charts;

  const TXT = {
    info: `<class 'pandas.core.frame.DataFrame'>
RangeIndex: 2938 entries, 0 to 2937
Data columns (total 22 columns):
 #   Column                           Non-Null Count  Dtype
---  ------                           --------------  -----
 0   Country                          2938 non-null   object
 1   Year                             2938 non-null   int64
 2   Status                           2938 non-null   object
 3   Life expectancy                  2928 non-null   float64
 4   Adult Mortality                  2928 non-null   float64
 5   infant deaths                    2938 non-null   int64
 6   Alcohol                          2744 non-null   float64
 7   percentage expenditure           2938 non-null   float64
 8   Hepatitis B                      2385 non-null   float64
 9   Measles                          2938 non-null   int64
 10   BMI                             2904 non-null   float64
 11  under-five deaths                2938 non-null   int64
 12  Polio                            2919 non-null   float64
 13  Total expenditure                2712 non-null   float64
 14  Diphtheria                       2919 non-null   float64
 15  HIV/AIDS                         2938 non-null   float64
 16  GDP                              2490 non-null   float64
 17  Population                       2286 non-null   float64
 18  thinness  1-19 years             2904 non-null   float64
 19  thinness 5-9 years               2904 non-null   float64
 20  Income composition of resources  2771 non-null   float64
 21  Schooling                        2775 non-null   float64
dtypes: float64(16), int64(4), object(2)
memory usage: 505.1+ KB`,
    coef: `[-1.31023639e-01  8.05549398e-01 -1.65366217e-02  9.23302715e-02
 -1.26094468e-01  2.58412695e-04 -5.05864100e-03 -1.25064884e-05
  3.46114488e-02 -6.89182089e-02  1.01705848e-02  7.40012348e-02
  1.29221179e-02 -4.31593007e-01  2.94598705e-05 -6.76973456e-10
  1.49973922e-02 -8.43760109e-02  1.13449331e+01  8.60720103e-01]
315.68173150825066`,
  };
  const COLS22 = ['Country', 'Year', 'Status', 'Life expectancy', 'Adult Mortality', 'infant deaths', 'Alcohol', 'percentage expenditure', 'Hepatitis B', 'Measles', ' BMI', 'under-five deaths', 'Polio', 'Total expenditure', 'Diphtheria', 'HIV/AIDS', 'GDP', 'Population', 'thinness  1-19 years', 'thinness 5-9 years', 'Income composition of resources', 'Schooling'];
  const NA = [0, 0, 0, 10, 10, 0, 194, 0, 553, 0, 34, 0, 19, 226, 19, 0, 448, 652, 34, 34, 167, 163];
  const seriesText = (vals) => {
    const w = Math.max(...COLS22.map((c) => c.length)) + 2;
    return COLS22.map((c, i) => c.padEnd(w) + String(vals[i]).padStart(5)).join('\n') + '\ndtype: int64';
  };
  const FEATURES = COLS22.filter((c) => c !== 'Country' && c !== 'Life expectancy');
  const TEST6 = { actual: [69.2, 61.1, 74.1, 59.6, 68.9, 65.6], pred: [73.752, 64.036, 77.582, 57.1, 76.178, 71.837] };

  function dfTable(t) {
    const head = '<tr><th></th>' + t.cols.map((c) => `<th>${c}</th>`).join('') + '</tr>';
    const body = t.rows.map((r, k) => `<tr><th>${t.idx[k]}</th>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('');
    return `<div class="dftable"><table><thead>${head}</thead><tbody>${body}</tbody></table></div><div class="shape-note">5 rows × ${t.cols.length} columns</div>`;
  }
  const pre = (s) => `<pre>${s.replace(/</g, '&lt;')}</pre>`;

  // 학생이 시뮬레이터에서 분할하는 훈련 데이터(시드 96 셔플) — 8단계 회귀선용
  function trainIdx() {
    const n = C.col('Schooling').length, idx = Array.from({ length: n }, (_, i) => i);
    let s = 96;
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx.slice(0, n - Math.ceil(n * 0.2));
  }
  let _train = null;
  const train = () => {
    if (_train) return _train;
    const ix = trainIdx(), sc = C.col('Schooling'), le = C.col('Life expectancy');
    const x = ix.map((i) => sc[i]), y = ix.map((i) => le[i]);
    return (_train = { x, y, fit: C.linfit(x, y) });
  };

  const STEPS = [
    {
      id: 1, name: '문제 정의', icon: '🎯', page: '191쪽',
      lead: '지속가능발전목표(SDGs) 3번 <b>“모든 연령층을 위한 건강한 삶 보장과 복지 증진”</b>을 위해, 수명 관련 데이터로 <b>기대 수명을 예측하는 인공지능 모델</b>을 만들어요.',
      goal: '데이터셋: WHO 산하 GHO의 Life Expectancy Dataset — 2000~2015년 193개국의 기대 수명과 건강 요인',
      features: true,
      cells: [],
      checks: [
        { q: '이 프로젝트에서 인공지능이 예측해야 하는 목표 변수(target)는?', opts: ['Country', 'Life expectancy', 'GDP', 'Status'], a: 1, exp: '기대 수명(Life expectancy)을 예측하는 것이 목표예요. 나머지 속성은 예측에 쓰는 입력(feature)이에요.' },
        { q: '이 프로젝트와 관련된 지속가능발전목표(SDGs)는 몇 번일까요?', opts: ['1번 빈곤 퇴치', '3번 건강과 웰빙', '4번 양질의 교육', '13번 기후 변화 대응'], a: 1, exp: 'SDGs 3번 “모든 연령층을 위한 건강한 삶 보장과 복지 증진”의 측정 지표가 기대 수명이에요.' },
      ],
    },
    {
      id: 2, name: '데이터 수집', icon: '📥', page: '192쪽',
      lead: '캐글(kaggle.com)에서 내려받은 <code>Life Expectancy Data.csv</code> 파일을 코랩에 올리고, 판다스로 읽어서 데이터의 생김새를 확인해요.',
      goal: '핵심 명령어: <code>import</code> · <code>pd.read_csv()</code> · <code>df.info()</code> · <code>df.head()</code>',
      cells: [
        {
          id: 'imp', title: '라이브러리 불러오기', explain: '수치 계산(numpy), 데이터프레임(pandas), 그래프(matplotlib) 라이브러리를 짧은 별칭으로 불러와요.',
          code: 'import numpy as np\nimport pandas as [[0]]\nimport matplotlib.[[1]] as plt',
          blanks: [
            { a: ['pd'], kind: 'alias', hint: 'pandas의 관례적인 별칭 두 글자예요. 아래 셀에서 pd.read_csv()로 사용해요.' },
            { a: ['pyplot'], kind: 'module', obj: 'matplotlib', hint: 'matplotlib 안의 그래프 그리기 모듈 이름이에요. (py로 시작)' },
          ],
          sets: ['np', 'pd', 'plt'],
          run: () => ({ html: '<div class="ok-line">✓ 라이브러리를 불러왔어요. (출력 없음)</div>' }),
        },
        {
          id: 'read', title: '데이터셋 내려받기', file: true,
          explain: '① 아래의 CSV 파일을 코랩 <b>파일(📁)</b> 영역으로 끌어다 놓고 ② <code>read_csv()</code> 함수로 읽어 <code>df</code> 변수에 데이터프레임으로 저장해요.',
          code: "df = pd.[[0]]('Life Expectancy Data.csv')",
          blanks: [{ a: ['read_csv'], kind: 'attr', obj: "module 'pandas'", hint: 'CSV 파일을 읽는(read) 함수예요. read_???', near: { readcsv: '단어 사이에 밑줄(_)이 필요해요.', 'read.csv': 'R 언어 표기예요! 파이썬 판다스는 밑줄(_)을 써요.' } }],
          needs: ['pd'], sets: ['df'],
          run: (S) => S.uploaded ? ({ html: '<div class="ok-line">✓ df에 2938행 × 22열 데이터프레임이 저장됐어요.</div>' })
            : ({ error: "FileNotFoundError: [Errno 2] No such file or directory: 'Life Expectancy Data.csv'", help: '코랩에 파일이 없어요! 위의 CSV 파일을 오른쪽 <b>Colab 파일</b> 상자로 끌어다 놓거나 눌러서 업로드하세요.' }),
        },
        {
          id: 'info', title: '데이터셋 정보 확인하기 ① info()',
          explain: '속성명, 속성별 데이터 개수(Non-Null Count), 자료형(Dtype)을 확인해요.',
          tip: '💡 디지털 샘의 Tip: 속성명에 빈칸이 들어가 있는지 확인하세요. (예: “ BMI”, “thinness␣␣1-19 years”)',
          code: 'df.[[0]]()  # 데이터셋의 속성명, 속성별 데이터 개수, 자료형(Type) 확인',
          blanks: [{ a: ['info'], kind: 'attr', obj: "'DataFrame' object", hint: '“정보(information)”를 줄인 4글자 함수예요.' }],
          needs: ['df'],
          run: () => ({ html: pre(TXT.info) }),
          interp: ['전체 2938행, 22개 속성(열)이 있어요.', 'Non-Null Count가 2938보다 작은 속성에는 <b>결측치(빈 값)</b>가 있어요.', 'Country·Status는 문자(object), 나머지는 숫자(int64·float64)예요.'],
        },
        {
          id: 'head', title: '데이터셋 정보 확인하기 ② head()',
          explain: '데이터프레임의 앞부분 5개 행을 출력해서 실제 값을 살펴봐요.',
          code: 'df.[[0]]()  # 앞의 5개 데이터 출력',
          blanks: [{ a: ['head'], kind: 'attr', obj: "'DataFrame' object", hint: '“머리” — 맨 앞부분을 보여 주는 함수예요. (반대는 tail)', alt: { tail: 'tail()은 마지막 5개 행이에요. 앞의 5개 행은?' } }],
          needs: ['df'],
          run: () => ({ html: dfTable(window.LE_DATA.head) }),
        },
      ],
      checks: [
        { q: '데이터셋 정보를 확인하기 위해 사용한 명령어 두 가지는?', opts: ['df.shape / df.dropna()', 'df.info() / df.head()', 'df.hist() / df.corr()', 'pd.read_csv() / df.fit()'], a: 1, exp: 'info()로 속성·개수·자료형을, head()로 앞 5개 행을 확인해요.' },
      ],
    },
    {
      id: 3, name: '데이터 전처리', icon: '🧹', page: '193쪽',
      lead: '빈 값(결측치)이 있으면 학습할 수 없어요. 결측치를 확인·제거하고, 문자로 된 <code>Status</code>를 숫자로 바꿔요.',
      goal: '핵심 명령어: <code>df.shape</code> · <code>df.isna().sum()</code> · <code>df.dropna()</code> · <code>astype()</code> · <code>replace()</code>',
      cells: [
        {
          id: 'shape', title: '결측치 확인하기 ① shape',
          explain: '<code>shape</code>로 (행 개수, 열 개수)를 확인해요. 함수가 아닌 <b>속성</b>이라 괄호가 없어요.',
          code: 'df.[[0]]',
          blanks: [{ a: ['shape'], kind: 'attr', obj: "'DataFrame' object", hint: '“모양”을 뜻하는 영어 단어예요. 괄호 없이 씁니다.', near: { 'shape()': "shape는 괄호 없이 써요! (TypeError: 'tuple' object is not callable)" } }],
          needs: ['df'],
          run: (S) => ({ html: pre(S.cleaned ? '(1649, 22)' : '(2938, 22)') }),
          interp: ['2938 = 데이터(행) 개수, 22 = 속성(열) 개수'],
        },
        {
          id: 'isna', title: '결측치 확인하기 ② isna().sum()',
          explain: '<code>isna()</code>는 빈 칸을 True로 표시하고, <code>sum()</code>은 True의 개수를 속성별로 더해요.',
          tip: '💡 결측치 제거 전과 제거 후를 비교해 보세요.',
          code: 'df.[[0]]().[[1]]()',
          blanks: [
            { a: ['isna', 'isnull'], kind: 'attr', obj: "'DataFrame' object", hint: '“is NA(Not Available)?” — 값이 비었는지 묻는 함수예요.' },
            { a: ['sum'], kind: 'attr', obj: "'DataFrame' object", hint: '개수를 “합계”로 더해 주는 함수예요.', alt: { count: 'count()는 빈 칸이 아닌 값의 개수예요. True를 더하려면?' } },
          ],
          needs: ['df'],
          run: (S) => ({ html: pre(seriesText(S.cleaned ? NA.map(() => 0) : NA)) }),
          interp: ['결측치가 가장 많은 속성은 <b>Population(652개)</b>, 다음은 Hepatitis B(553개)예요.'],
        },
        {
          id: 'dropna', title: '결측치 제거하기 dropna()',
          explain: '결측치가 하나라도 있는 행을 삭제하고, 다시 확인해요.',
          code: 'df = df.[[0]]()  # 결측치 데이터 삭제\ndf.isna().sum()',
          blanks: [{ a: ['dropna'], kind: 'attr', obj: "'DataFrame' object", hint: 'NA를 떨어뜨리는(drop) 함수예요. drop??', alt: { drop: 'drop()은 지정한 행/열을 지워요. 결측치(NA)를 지우는 함수는?' } }],
          needs: ['df'],
          run: (S) => { S.cleaned = true; return { html: pre(seriesText(NA.map(() => 0))) + '<div class="ok-line">✓ 모든 속성의 결측치가 0이 되었어요. 2938행 → 1649행</div>' }; },
        },
        {
          id: 'astype', title: '자료형 바꾸기 astype()',
          explain: '<code>astype()</code>으로 Status 속성을 범주형(object) 데이터로 지정해요.',
          tip: '💡 여기서는 Status의 자료형이 이미 object이므로 이 코드는 생략할 수도 있어요.',
          code: "df['Status'] = df['Status'].[[0]](object)",
          blanks: [{ a: ['astype'], kind: 'attr', obj: "'Series' object", hint: '“as type” — 자료형으로 바꾸는 함수예요.' }],
          needs: ['df'],
          run: () => ({ html: '<div class="ok-line">✓ 실행 완료 (출력 없음)</div>' }),
        },
        {
          id: 'replace', title: '문자를 숫자로 바꾸기 replace()',
          explain: '컴퓨터는 문자 데이터를 학습할 수 없어요. 개발도상국(Developing)은 0, 선진국(Developed)은 1로 바꿔요.',
          code: "# 개발도상국은 '0'으로, 선진국은 '1'로 처리\ndf = df.[[0]]({'Developing':0, 'Developed':1})",
          blanks: [{ a: ['replace'], kind: 'attr', obj: "'DataFrame' object", hint: '“바꾸다, 교체하다”를 뜻하는 영어 단어예요.' }],
          needs: ['df'],
          run: (S) => { S.encoded = true; const st = C.col('Status'); const n1 = st.filter((v) => v === 1).length; return { html: pre(`df['Status'].value_counts()\n0    ${st.length - n1}\n1     ${n1}\nName: Status, dtype: int64`) + '<div class="simnote">※ 이해를 돕기 위해 변환 결과(개수)를 함께 보여 줘요.</div>' }; },
        },
      ],
      checks: [
        { q: '결측치를 확인하는 명령어와 제거하는 명령어를 바르게 짝지은 것은?', opts: ['df.info() / df.drop()', 'df.isna().sum() / df.dropna()', 'df.shape / df.replace()', 'df.head() / df.astype()'], a: 1, exp: 'isna().sum()으로 개수를 세고, dropna()로 결측치가 있는 행을 지워요.' },
        { q: 'replace() 이후 선진국(Developed)은 어떤 값이 될까요?', opts: ['0', '1', "'Developed'", 'NaN'], a: 1, exp: "{'Developing':0, 'Developed':1} 이므로 선진국은 1이에요." },
      ],
    },
    {
      id: 4, name: '데이터 시각화 및 분석', icon: '📊', page: '194~196쪽',
      lead: '기대 수명에 영향을 미치는 속성을 찾기 위해 전처리한 데이터를 여러 그래프로 그려 보고 해석해요.',
      goal: '핵심 명령어: <code>hist()</code> · <code>sns.displot()</code> · <code>plt.figure()</code> · <code>sns.heatmap()</code> · <code>sns.pairplot()</code> · <code>px.violin()</code>',
      cells: [
        {
          id: 'hist', title: '기대 수명 히스토그램 hist()',
          explain: '<code>hist()</code> 함수로 기대 수명(Life expectancy) 속성의 분포를 막대로 나타내요.',
          code: "df['Life expectancy'].[[0]]()  # 종속 변수(y)에 대한 히스토그램",
          blanks: [{ a: ['hist'], kind: 'attr', obj: "'Series' object", hint: 'histogram을 줄인 4글자 함수예요.' }],
          needs: ['df', 'plt'],
          run: () => ({ html: '<pre>&lt;Axes: &gt;</pre>' + C.pandasHist(C.col('Life expectancy'), { xlabel: 'Life expectancy', ylabel: '개수' }).html }),
          interp: ['기대 수명이 약 <b>70~75세</b>인 경우가 가장 많아요.', '약 75세 이후에는 급격히 줄어들어요.'],
        },
        {
          id: 'displot', title: '소아마비 예방 접종률 분포 displot()',
          explain: '시본(seaborn)의 <code>displot()</code>은 히스토그램과 밀도 추정 곡선(kde)을 함께 보여 줘요.',
          code: "import seaborn as sns  # 밀도 추정 곡선과 히스토그램 보여주기\nsns.[[0]](x = df['Polio'], kde = 'True')  # 소아마비 변수로 분포도 표시",
          blanks: [{ a: ['displot'], kind: 'attr', obj: "module 'seaborn'", hint: 'distribution plot을 줄인 이름이에요. dis????', near: { distplot: 'distplot은 예전 이름이라 교과서에서는 displot을 써요. (t가 없어요!)' } }],
          needs: ['df'], sets: ['sns'],
          run: () => ({ html: '<pre>&lt;seaborn.axisgrid.FacetGrid at 0x7c49987cebc0&gt;</pre>' + C.displot(C.col('Polio'), { xlabel: 'Polio' }) }),
          interp: ['대부분 나라의 접종률은 80% 이상이지만, <b>20% 미만</b>인 나라도 존재해요.'],
        },
        {
          id: 'heatmap', title: '히트맵으로 상관관계 파악하기',
          explain: '① <code>plt.figure()</code>로 그래프 크기를 정하고 ② <code>sns.heatmap()</code>으로 속성 간 상관계수를 색으로 나타내요. 숫자 속성만 계산하도록 옵션을 넣어요.',
          tip: '알아두면 쓸모 있는 코딩 — linewidth: 간격 · vmax: 최대치 · cmap: 색상 · annot: 셀 값 표시',
          code: "plt.[[0]](figsize = (15, 12))  # 표 사이즈 설정\nsns.heatmap(df.corr([[1]]), linewidth = 0.1, vmax = 1,\n            cmap = plt.cm.YlOrRd, linecolor = 'white', annot = True)",
          blanks: [
            { a: ['figure'], kind: 'attr', obj: "module 'matplotlib.pyplot'", hint: '그림(그래프) 판을 만드는 함수예요. fig????' },
            { a: ['numeric_only=True', 'numeric_only = True'], kind: 'kw', fn: 'DataFrame.corr', hint: '숫자(numeric) 속성만(only) 계산하라는 옵션이에요. numeric_only = ?', empty: "ValueError: could not convert string to float: 'Afghanistan'", emptyHelp: '문자 속성(Country)까지 상관계수를 계산하려다 오류가 났어요. 숫자 속성만 계산하는 옵션을 넣어 주세요.' },
          ],
          needs: ['df', 'sns', 'plt'],
          run: () => ({ html: '<pre>&lt;Axes: &gt;</pre>' + C.heatmap() + '<div class="hm-info" data-hm-info>칸에 마우스를 올리거나 눌러 보세요.</div>', after: 'heatmap' }),
          interp: ['<b>교육(Schooling 0.73)</b>과 <b>소득(Income composition 0.72)</b>은 기대 수명과 상관관계가 높아요.', '성인 사망률(Adult Mortality −0.70)은 강한 <b>음의</b> 상관관계예요.', '국가 총 인구수(Population)와 정부 보건 지출(Total expenditure)은 상관관계가 낮아요.'],
        },
        {
          id: 'pairplot', title: '산점도로 특정 속성 간 상관관계 파악하기',
          explain: '① <code>pairplot()</code>에 보고 싶은 속성을 data로 넣고 ② 기준 속성을 <code>hue</code>로, 색상을 <code>palette</code>로 정해요.',
          code: "sns.[[0]](data = df[['Measles', 'GDP', 'Status', 'Life expectancy']],\n         [[1]] = 'Status', palette = 'bright');  # 상관관계를 파악하기",
          blanks: [
            { a: ['pairplot'], kind: 'attr', obj: "module 'seaborn'", hint: '속성을 짝(pair)지어 그리는 그래프예요.' },
            { a: ['hue'], kind: 'kw', fn: 'pairplot', hint: '색상(색조)을 뜻하는 3글자 영어 단어예요.' },
          ],
          needs: ['df', 'sns'],
          run: () => ({ html: '<pre>&lt;Figure size 808.875x750 with 12 Axes&gt;</pre>' + C.pairplot() }),
          interp: ['선진국(1, 주황)이 GDP가 높고 기대 수명도 높아요.', '홍역(Measles)은 GDP가 낮은 개발도상국(0, 파랑)에서 주로 발생해요.'],
        },
        {
          id: 'violin', title: '바이올린 그래프 시각화하기',
          explain: '바이올린 그래프는 분포와 밀도를 함께 보여 줘요. 바이올린의 너비가 넓을수록 데이터가 많아요. Plotly 라이브러리를 사용해요.',
          code: "# 상관관계를 파악하기\nimport plotly.express as px\nfig = px.[[0]](df, x = 'Status', y = 'Life expectancy', color = 'Status', box = True)\nfig.[[1]]()",
          blanks: [
            { a: ['violin'], kind: 'attr', obj: "module 'plotly.express'", hint: '악기 이름과 같아요! 🎻' },
            { a: ['show'], kind: 'attr', obj: "'Figure' object", hint: '그래프를 화면에 “보여 주는” 함수예요.' },
          ],
          needs: ['df'],
          run: () => ({ html: C.violin() }),
          interp: ['선진국(1)이 개발도상국(0)보다 평균 기대 수명이 높아요.', '기대 수명이 <b>65세 미만인 선진국(1)은 존재하지 않아요.</b>'],
        },
      ],
      extra: 'explorer',
      checks: [
        { q: '히트맵에서 기대 수명과 가장 강한 “양(+)의” 상관관계를 보인 속성은?', opts: ['Population', 'Schooling', 'Measles', 'Adult Mortality'], a: 1, exp: 'Schooling(0.73)이 가장 높아요. Adult Mortality(−0.70)는 강하지만 음(−)의 상관관계예요.' },
      ],
    },
    {
      id: 5, name: '기계학습 유형·알고리즘 선정', icon: '🧭', page: '197쪽',
      lead: '기대 수명이 “몇 세”인지 숫자를 출력하므로 <b>지도학습의 예측(회귀)</b>이고, 대표 알고리즘은 <b>선형 회귀</b>예요. 이어서 훈련 데이터와 테스트 데이터를 8:2로 나눠요.',
      goal: '핵심 명령어: <code>df.drop()</code> · <code>df.loc[]</code> · <code>train_test_split()</code> · <code>.shape</code>',
      cells: [
        {
          id: 'xy', title: '입력(X)과 정답(y) 나누기',
          explain: "'Life expectancy'와 'Country'를 제외한 속성은 X에, 'Life expectancy'는 y에 저장해요.",
          code: "# 훈련 데이터와 테스트 데이터로 분리\nX = df.[[0]](['Life expectancy', 'Country'], axis=1)\ny = df.[[1]][:, 'Life expectancy']",
          blanks: [
            { a: ['drop'], kind: 'attr', obj: "'DataFrame' object", hint: '지정한 열을 “떨어뜨리는(삭제)” 함수예요. axis=1은 열 방향이에요.', alt: { dropna: 'dropna()는 결측치를 지울 때 써요. 지정한 열을 지우는 함수는?' } },
            { a: ['loc'], kind: 'attr', obj: "'DataFrame' object", hint: '위치(location)를 줄인 3글자, [행, 열]로 데이터를 골라요.', alt: { iloc: "iloc은 번호로 고를 때 써요. 열 이름('Life expectancy')으로 고르려면?" } },
          ],
          needs: ['df'], sets: ['X', 'y'],
          run: (S) => { S.xNaN = !S.cleaned; S.xStr = !S.encoded; return { html: '<div class="ok-line">✓ X: 20개 속성, y: 기대 수명</div>' }; },
        },
        {
          id: 'split', title: '훈련 데이터와 테스트 데이터 분리하기',
          explain: '<code>train_test_split()</code>으로 80%는 학습용, 20%는 테스트용으로 나눠요. <code>random_state</code>를 고정하면 매번 같은 방식으로 섞여요.',
          tip: '💡 디지털 샘의 Tip: 훈련 데이터와 테스트 데이터의 역할을 생각해 보세요.',
          code: 'from sklearn.model_selection import train_test_split\nX_train, X_test, y_train, y_test = [[0]](X, y, [[1]] = 0.2, random_state = 96)',
          blanks: [
            { a: ['train_test_split'], kind: 'name', hint: '바로 윗줄에서 import한 함수 이름이에요.' },
            { a: ['test_size'], kind: 'kw', fn: 'train_test_split', hint: '테스트(test) 데이터의 크기(size) 비율이에요.', alt: { train_size: 'train_size=0.2면 훈련 데이터가 20%가 돼요! 테스트를 20%로 하려면?' } },
          ],
          needs: ['X', 'y'], sets: ['X_train', 'X_test', 'y_train', 'y_test'],
          run: () => ({ html: '<div class="ok-line">✓ 4개의 변수에 나눠 담았어요.</div>' }),
        },
        {
          id: 'xhead', title: '잘 나눠졌는지 확인하기 ① X_train.head()',
          explain: '훈련용 입력 데이터의 앞 5개 행을 봐요. 왼쪽 번호(인덱스)가 섞여 있는 것을 확인하세요.',
          code: 'X_train.[[0]]()',
          blanks: [{ a: ['head'], kind: 'attr', obj: "'DataFrame' object", hint: '앞의 5개 행을 보여 주는 함수, 2단계에서 썼어요.' }],
          needs: ['X_train'],
          run: () => ({ html: dfTable(window.LE_DATA.xhead) }),
          interp: ['인덱스가 627, 279, 2269… 처럼 무작위로 섞여서 나뉘었어요.', 'Status가 0/1 숫자로, Life expectancy·Country는 빠져 있어요.'],
        },
        {
          id: 'shapes', title: '잘 나눠졌는지 확인하기 ② shape',
          explain: '4개 변수의 모양을 한 번에 출력해요.',
          code: 'X_train.shape, y_train.shape, [[0]], [[1]]',
          blanks: [
            { a: ['X_test.shape'], kind: 'expr', hint: '테스트용 입력 데이터의 모양이에요. X_????.shape' },
            { a: ['y_test.shape'], kind: 'expr', hint: '테스트용 정답 데이터의 모양이에요. y_????.shape' },
          ],
          needs: ['X_train'],
          run: () => ({ html: pre('((1319, 20), (1319,), (330, 20), (330,))') }),
          interp: ['1649개 중 <b>1319개(80%)는 훈련</b>, <b>330개(20%)는 테스트</b> 데이터예요.', '20 = 입력 속성의 개수'],
        },
      ],
      extra: 'split',
      checks: [
        { q: '기대 수명 예측에 알맞은 기계학습 유형은?', opts: ['지도학습 – 분류', '지도학습 – 예측(회귀)', '비지도학습 – 군집', '강화학습'], a: 1, exp: '정답(기대 수명)이 있는 데이터로 숫자를 예측하므로 지도학습의 예측(회귀)이에요.' },
        { q: '지도학습 예측의 대표 알고리즘으로 교과서에서 선정한 것은?', opts: ['K-평균', '의사결정나무', '선형 회귀', 'K-최근접 이웃'], a: 2, exp: '선형 회귀(Linear Regression)를 사용해요.' },
      ],
    },
    {
      id: 6, name: '모델 학습', icon: '🏋️', page: '198쪽',
      lead: '사이킷런(scikit-learn)의 선형 회귀 모델을 만들고 훈련 데이터로 학습시킨 뒤, 학습된 <b>가중치(기울기)</b>와 <b>편향(절편)</b>을 확인해요.',
      goal: '핵심 명령어: <code>LinearRegression()</code> · <code>fit()</code> · <code>coef_</code> · <code>intercept_</code>',
      cells: [
        {
          id: 'model', title: '모델 생성하기',
          explain: '선형 회귀 알고리즘을 불러와 <code>linear_reg</code> 변수에 모델(객체)을 만들어 저장해요.',
          code: '# 선형 회귀 알고리즘 불러오기\nfrom sklearn.linear_model import LinearRegression\nlinear_reg = [[0]]',
          blanks: [{ a: ['LinearRegression()'], kind: 'expr', hint: '윗줄에서 import한 클래스 이름 뒤에 괄호를 붙여요.', near: { LinearRegression: '괄호 ()를 붙여야 모델(객체)이 만들어져요!', 'linearregression()': '대소문자를 확인하세요. L과 R은 대문자예요.' } }],
          sets: ['LinearRegression', 'linear_reg'],
          run: () => ({ html: '<div class="ok-line">✓ 선형 회귀 모델을 만들었어요.</div>' }),
        },
        {
          id: 'fit', title: '모델 학습하기',
          explain: '훈련 데이터 <code>X_train</code>, <code>y_train</code>으로 학습하고 결과를 <code>lin_results</code>에 저장해요.',
          code: '# 선형 회귀 모델 학습\nlin_results = [[0]](X_train, y_train)',
          blanks: [{ a: ['linear_reg.fit'], kind: 'expr', hint: '모델 변수 이름 + 점(.) + “맞추다”라는 뜻의 3글자 함수', near: { fit: '어떤 모델을 학습시킬까요? 앞에 모델 변수 이름(linear_reg.)을 붙여요.', 'LinearRegression.fit': '클래스가 아니라 위에서 만든 모델 변수(linear_reg)를 써요.' } }],
          needs: ['linear_reg', 'X_train'], sets: ['lin_results'],
          run: (S) => S.xNaN ? ({ error: 'ValueError: Input X contains NaN.\nLinearRegression does not accept missing values encoded as NaN natively.', help: '결측치가 남아 있어요! 3단계의 <code>dropna()</code>를 실행한 뒤, 5단계의 X·y 나누기부터 다시 실행하세요.' })
            : S.xStr ? ({ error: "ValueError: could not convert string to float: 'Developing'", help: "Status에 문자가 남아 있어요. 3단계의 <code>replace()</code>를 실행한 뒤, 5단계부터 다시 실행하세요." })
            : ({ html: pre('LinearRegression()') }),
        },
        {
          id: 'coef', title: '가중치와 편향 확인하기',
          explain: '선형 회귀식 <code>y = w₁x₁ + w₂x₂ + … + w₂₀x₂₀ + b</code> 에서 가중치 w는 <code>coef_</code>, 편향 b는 <code>intercept_</code>에 저장돼요.',
          tip: '알아두면 쓸모 있는 코딩 — coef_: 가중치(기울기) · intercept_: 편향(절편). 둘 다 끝에 밑줄(_)이 있어요!',
          code: '# 가중치와 편향 확인\nw = lin_results.[[0]]\nb = lin_results.[[1]]\nprint(w)\nprint(b)',
          blanks: [
            { a: ['coef_'], kind: 'attr', obj: "'LinearRegression' object", hint: 'coefficient(계수)를 줄인 말 + 밑줄', near: { coef: '끝에 밑줄(_)을 붙여야 해요. 학습 후에 생기는 값이라는 표시예요.' } },
            { a: ['intercept_'], kind: 'attr', obj: "'LinearRegression' object", hint: '절편(intercept) + 밑줄', near: { intercept: '끝에 밑줄(_)을 붙여야 해요.' } },
          ],
          needs: ['lin_results'],
          run: () => ({ html: pre(TXT.coef), after: 'coef' }),
          interp: ['20개 속성마다 가중치가 하나씩, 편향은 1개(약 315.68)예요.', '가중치가 가장 큰 속성은 Income composition of resources(약 11.34)예요.'],
        },
      ],
      checks: [
        { q: '학습을 시키는 함수는?', opts: ['predict()', 'fit()', 'score()', 'train()'], a: 1, exp: 'fit(X_train, y_train)으로 학습하고, predict()로 예측해요.' },
      ],
    },
    {
      id: 7, name: '성능 평가', icon: '📏', page: '199쪽',
      lead: '학습에 쓰지 않은 <b>테스트 데이터</b>로 예측하고, 결정 계수(R²)로 모델이 얼마나 잘 맞히는지 평가해요.',
      goal: '핵심 명령어: <code>predict()</code> · <code>r2_score(y_test, y_pred)</code>',
      cells: [
        {
          id: 'r2', title: '결정 계수 확인하기',
          explain: '<code>predict()</code>로 테스트 데이터의 기대 수명을 예측하고, <code>r2_score(실제값, 예측값)</code>으로 결정 계수를 구해요. 1에 가까울수록 좋아요.',
          code: "# 결정 계수 확인\nfrom sklearn.metrics import r2_score\ny_pred = lin_results.[[0]](X_test)\nprint('결정 계수(R^2) = ', [[1]](y_test, [[2]]))",
          blanks: [
            { a: ['predict'], kind: 'attr', obj: "'LinearRegression' object", hint: '“예측하다”를 뜻하는 영어 단어예요.' },
            { a: ['r2_score'], kind: 'name', hint: '바로 윗줄에서 import한 함수예요.' },
            { a: ['y_pred'], kind: 'name', hint: '바로 윗줄에서 예측값을 저장한 변수예요.', alt: { y_train: '훈련 데이터가 아니라 “예측값”과 비교해야 해요.', X_test: 'X_test는 입력 데이터예요. 비교할 것은 예측값!' } },
          ],
          needs: ['lin_results', 'X_test'], sets: ['y_pred'],
          run: () => ({ html: pre('결정 계수(R^2) =  0.7935432520879806'), after: 'r2' }),
          interp: ['결정 계수 약 <b>0.79(79%)</b> — 기대 수명 변화의 약 79%를 모델이 설명해요.'],
        },
        {
          id: 'test', title: '테스트 데이터로 평가하기',
          explain: '테스트 데이터 6개의 실제 기대 수명과 예측 기대 수명, 그 차이를 출력해요. <code>range(6)</code>은 0~5까지 6번 반복해요.',
          code: "# 모델 테스트\nY_prediction = y_pred.flatten()\nfor i in [[0]](6):\n  label = y_test.values[i]\n  prediction = Y_prediction[i]\n  print('실제 기대 수명: {:.3f}, 학습후 예측 기대 수명: {:.3f}, 차이: {:.3f}'\n        .format(label, prediction, label-prediction))",
          blanks: [{ a: ['range'], kind: 'name', hint: '0부터 n−1까지 숫자를 만들어 주는 반복용 함수예요.' }],
          needs: ['y_pred'],
          run: () => ({
            html: pre(TEST6.actual.map((a, i) => `실제 기대 수명: ${a.toFixed(3)}, 학습후 예측 기대 수명: ${TEST6.pred[i].toFixed(3)}, 차이: ${(a - TEST6.pred[i]).toFixed(3)}`).join('\n'))
              + C.compareBars(TEST6.actual, TEST6.pred) + '<div class="legend"><span><i style="background:#3b5bdb"></i>실제</span><span><i style="background:#f08c00"></i>예측</span><span>막대 위 숫자 = 실제 − 예측</span></div>',
          }),
          interp: ['6개 나라를 출력하니 대체로 <b>2~5년 내외</b>의 오차를 보였어요.'],
        },
      ],
      checks: [
        { q: 'r2_score(y_test, y_pred)에서 y_test와 y_pred는 각각 무엇일까요?', opts: ['훈련 정답 / 테스트 정답', '테스트 실제값 / 모델 예측값', '입력 데이터 / 출력 데이터', '가중치 / 편향'], a: 1, exp: 'y_test는 테스트 데이터의 실제 기대 수명, y_pred는 모델이 예측한 값이에요.' },
      ],
    },
    {
      id: 8, name: '수정 및 성능 개선', icon: '🔧', page: '200쪽',
      lead: "교육 수준 <code>'Schooling'</code> 하나만으로 선형 회귀를 학습하고 <b>회귀선</b>을 그려서, 모델이 데이터의 경향을 얼마나 잘 학습했는지 눈으로 확인해요.",
      goal: '핵심 명령어: <code>reshape(-1, 1)</code> · <code>np.arange()</code> · <code>plt.scatter()</code> · <code>plt.plot()</code>',
      cells: [
        {
          id: 'lin1', title: '선형 회귀 알고리즘 불러오기',
          explain: '새로운 선형 회귀 모델 <code>lin1</code>을 만들어요.',
          code: 'lin1 = [[0]]',
          blanks: [{ a: ['LinearRegression()'], kind: 'expr', hint: '6단계에서 모델을 만들 때와 같아요. 괄호를 잊지 마세요!', near: { LinearRegression: '괄호 ()를 붙여야 모델(객체)이 만들어져요!' } }],
          needs: ['LinearRegression'], sets: ['lin1'],
          run: () => ({ html: '<div class="ok-line">✓ lin1 모델 생성</div>' }),
        },
        {
          id: 'fit1', title: '선형 회귀 알고리즘으로 학습하기',
          explain: "Schooling 속성 값만 꺼내서 학습해요. <code>reshape(-1, 1)</code>은 1줄짜리 데이터를 <b>열이 1개인 2차원 배열</b>로 바꿔요. (행 수 −1 = 자동)",
          code: "lin1.[[0]](X_train['Schooling'].values.[[1]](-1,1), y_train.values.reshape(-1,1))",
          blanks: [
            { a: ['fit'], kind: 'attr', obj: "'LinearRegression' object", hint: '학습시키는 3글자 함수예요.' },
            { a: ['reshape'], kind: 'attr', obj: "'numpy.ndarray' object", hint: '모양(shape)을 다시(re) 만드는 함수예요.' },
          ],
          needs: ['lin1', 'X_train'],
          run: (S) => { S.fit1 = true; return { html: pre('LinearRegression()') }; },
        },
        {
          id: 'arange', title: '기대 수명 예측값 생성하기',
          explain: '<code>np.arange()</code>로 교육 기간 최솟값~최댓값까지 1씩 증가하는 값을 만들고, <code>predict()</code>로 각 값의 예측 기대 수명을 구해요.',
          code: "x_array = np.[[0]](min(X_train['Schooling']), max(X_train['Schooling'])).\\\n    reshape(-1, 1)\ny_head = lin1.[[1]](x_array)",
          blanks: [
            { a: ['arange'], kind: 'attr', obj: "module 'numpy'", hint: 'a + range — 범위의 숫자 배열을 만들어요. (r이 하나!)', near: { arrange: '철자 주의! numpy는 a + range = arange (r이 하나)예요.' } },
            { a: ['predict'], kind: 'attr', obj: "'LinearRegression' object", hint: '예측하는 함수예요.' },
          ],
          needs: ['lin1', 'np'], sets: ['x_array', 'y_head'],
          run: (S) => S.fit1 ? ({ html: '<div class="ok-line">✓ x_array와 y_head(예측값)를 만들었어요.</div>' })
            : ({ error: "NotFittedError: This LinearRegression instance is not fitted yet. Call 'fit' with appropriate arguments before using this estimator.", help: '아직 학습하지 않은 모델이에요. 위 셀(lin1.fit)을 먼저 실행하세요.' }),
        },
        {
          id: 'plot', title: '기대 수명 회귀선 시각화하기',
          explain: '<code>scatter()</code>로 교육 수준과 기대 수명의 산점도를 그리고, <code>plot()</code>으로 회귀선을 빨간색으로 그려요.',
          tip: '💡 독립 변수(x)에 이상치처럼 아주 큰 값이 있으면 예측이 정확하지 않을 수 있어요.',
          code: "plt.[[0]](X_train['Schooling'], y_train)\nplt.[[1]](x_array, y_head, color = 'red')\nplt.xlabel('Schooling')\nplt.ylabel('Life expectancy')\nplt.show()",
          blanks: [
            { a: ['scatter'], kind: 'attr', obj: "module 'matplotlib.pyplot'", hint: '점을 “흩뿌리는” 산점도 함수예요.' },
            { a: ['plot'], kind: 'attr', obj: "module 'matplotlib.pyplot'", hint: '선을 그리는 기본 함수예요. (4글자)' },
          ],
          needs: ['x_array', 'plt'],
          run: () => {
            const t = train(), sc = t.x;
            const lo = Math.min(...sc), hi = Math.max(...sc), xs = [];
            for (let v = lo; v < hi; v += 1) xs.push(v);
            return { html: C.scatter(t.x, t.y, { xlabel: 'Schooling', ylabel: 'Life expectancy', line: { xs, ys: xs.map((v) => t.fit.w * v + t.fit.b) } }) + `<div class="simnote">※ 시뮬레이터가 데이터를 8:2로 나눠 그린 결과라 실제 코랩 그래프와 점 배치가 조금 다를 수 있어요. 회귀식: y ≈ ${t.fit.w.toFixed(2)} × Schooling + ${t.fit.b.toFixed(2)}</div>` };
          },
          interp: ['교육 수준이 증가함에 따라 기대 수명이 증가하는 <b>회귀선</b>을 확인할 수 있어요.'],
        },
      ],
      extra: 'predictor',
      checks: [
        { q: 'reshape(-1, 1)의 의미로 알맞은 것은?', opts: ['데이터를 1개만 남긴다', '행은 자동, 열은 1개인 2차원 배열로 바꾼다', '데이터 순서를 뒤집는다', '값을 −1에서 1 사이로 바꾼다'], a: 1, exp: '−1은 “알아서 계산”, 1은 열 1개라는 뜻이에요. 사이킷런은 입력으로 2차원 배열을 원해요.' },
      ],
    },
  ];

  // ───────────── 복습 문제 은행 ─────────────
  const QUIZ = [
    { t: 'order', step: 0, q: '인공지능 프로젝트 수행 과정을 순서대로 배열하세요.', items: ['문제 정의', '데이터 수집', '데이터 전처리', '데이터 시각화 및 분석', '기계학습 유형과 알고리즘 선정', '모델 학습', '성능 평가', '수정 및 성능 개선'], exp: '문제 정의 → 데이터 수집 → 전처리 → 시각화·분석 → 유형·알고리즘 선정 → 모델 학습 → 성능 평가 → 수정 및 성능 개선' },
    { t: 'order', step: 6, q: '선형 회귀 모델을 만들고 평가하는 코드를 순서대로 배열하세요.', mono: true, items: ['from sklearn.linear_model import LinearRegression', 'linear_reg = LinearRegression()', 'lin_results = linear_reg.fit(X_train, y_train)', 'y_pred = lin_results.predict(X_test)', 'r2_score(y_test, y_pred)'], exp: '불러오기 → 모델 생성 → 학습(fit) → 예측(predict) → 평가(r2_score)' },
    { t: 'order', step: 3, q: '데이터 전처리 코드를 순서대로 배열하세요.', mono: true, items: ['df.isna().sum()', 'df = df.dropna()', "df['Status'] = df['Status'].astype(object)", "df = df.replace({'Developing':0, 'Developed':1})"], exp: '결측치 확인 → 결측치 제거 → 범주형 지정 → 숫자로 변환' },
    { t: 'fill', step: 2, q: 'CSV 파일을 읽어 데이터프레임으로 저장하세요.', code: "df = pd.[[0]]('Life Expectancy Data.csv')", a: ['read_csv'], exp: 'pd.read_csv()는 CSV 파일을 읽어 데이터프레임으로 만들어요.' },
    { t: 'fill', step: 2, q: '속성명, 데이터 개수, 자료형을 확인하세요.', code: 'df.[[0]]()', a: ['info'], exp: 'info()는 속성별 Non-Null 개수와 Dtype을 보여 줘요.' },
    { t: 'fill', step: 2, q: '데이터의 앞 5개 행을 출력하세요.', code: 'df.[[0]]()', a: ['head'], exp: 'head()는 앞 5개 행, tail()은 뒤 5개 행이에요.' },
    { t: 'fill', step: 3, q: '데이터의 (행 개수, 열 개수)를 확인하세요.', code: 'df.[[0]]', a: ['shape'], exp: 'shape는 괄호 없이 쓰는 속성이에요.' },
    { t: 'fill', step: 3, q: '속성별 결측치 개수를 확인하세요.', code: 'df.[[0]]().sum()', a: ['isna', 'isnull'], exp: 'isna()가 빈 칸을 True로 바꾸고 sum()이 개수를 세요.' },
    { t: 'fill', step: 3, q: '결측치가 있는 행을 삭제하세요.', code: 'df = df.[[0]]()', a: ['dropna'], exp: 'dropna()는 결측치(NA)가 있는 행을 지워요.' },
    { t: 'fill', step: 3, q: "Status를 숫자로 바꾸세요.", code: "df = df.[[0]]({'Developing':0, 'Developed':1})", a: ['replace'], exp: 'replace({바꿀 값: 새 값})' },
    { t: 'fill', step: 4, q: '기대 수명의 히스토그램을 그리세요.', code: "df['Life expectancy'].[[0]]()", a: ['hist'], exp: 'hist()는 판다스에서 바로 히스토그램을 그려요.' },
    { t: 'fill', step: 4, q: '숫자 속성만으로 상관계수를 계산하세요.', code: 'sns.heatmap(df.corr([[0]] = True), annot = True)', a: ['numeric_only'], exp: 'numeric_only=True가 없으면 Country 같은 문자 속성 때문에 오류가 나요.' },
    { t: 'fill', step: 4, q: 'Status별로 색을 나눠 산점도 행렬을 그리세요.', code: "sns.pairplot(data = df[['GDP', 'Status', 'Life expectancy']], [[0]] = 'Status')", a: ['hue'], exp: 'hue는 색을 나누는 기준 속성이에요.' },
    { t: 'fill', step: 4, q: '바이올린 그래프를 그리세요.', code: "fig = px.[[0]](df, x = 'Status', y = 'Life expectancy', box = True)", a: ['violin'], exp: 'plotly.express의 violin() 함수예요.' },
    { t: 'fill', step: 5, q: '두 열을 제외한 나머지를 X에 저장하세요.', code: "X = df.[[0]](['Life expectancy', 'Country'], axis=1)", a: ['drop'], exp: 'drop(열 목록, axis=1)은 해당 열을 삭제한 데이터를 돌려줘요.' },
    { t: 'fill', step: 5, q: '테스트 데이터를 20%로 나누세요.', code: 'X_train, X_test, y_train, y_test = train_test_split(X, y, [[0]] = 0.2, random_state = 96)', a: ['test_size'], exp: 'test_size=0.2 → 테스트 20%, 훈련 80%' },
    { t: 'fill', step: 6, q: '모델을 학습시키세요.', code: 'lin_results = linear_reg.[[0]](X_train, y_train)', a: ['fit'], exp: 'fit(입력, 정답)으로 학습해요.' },
    { t: 'fill', step: 6, q: '학습된 가중치를 확인하세요.', code: 'w = lin_results.[[0]]', a: ['coef_'], exp: 'coef_(가중치) — 끝의 밑줄(_)을 잊지 마세요.' },
    { t: 'fill', step: 6, q: '학습된 편향을 확인하세요.', code: 'b = lin_results.[[0]]', a: ['intercept_'], exp: 'intercept_(편향, 절편)' },
    { t: 'fill', step: 7, q: '테스트 데이터로 예측하세요.', code: 'y_pred = lin_results.[[0]](X_test)', a: ['predict'], exp: 'predict(입력)은 예측값을 돌려줘요.' },
    { t: 'fill', step: 7, q: '결정 계수를 구하세요.', code: 'print(r2_score(y_test, [[0]]))', a: ['y_pred'], exp: 'r2_score(실제값, 예측값)' },
    { t: 'fill', step: 8, q: '열이 1개인 2차원 배열로 바꾸세요.', code: "X_train['Schooling'].values.[[0]](-1, 1)", a: ['reshape'], exp: 'reshape(-1, 1): 행은 자동, 열은 1개' },
    { t: 'fill', step: 8, q: '빨간 회귀선을 그리세요.', code: "plt.[[0]](x_array, y_head, color = 'red')", a: ['plot'], exp: 'plot()은 선 그래프, scatter()는 산점도예요.' },
    { t: 'choice', step: 3, q: 'df.shape의 결과가 (2938, 22)일 때 22가 뜻하는 것은?', opts: ['데이터(행) 개수', '속성(열) 개수', '결측치 개수', '국가 수'], a: 1, exp: '(행, 열) 순서예요. 22개의 속성이 있어요.' },
    { t: 'choice', step: 3, q: 'replace()로 Status를 0과 1로 바꾸는 이유는?', opts: ['데이터를 줄이려고', '문자 데이터는 학습할 수 없어서', '결측치를 없애려고', '그래프 색을 바꾸려고'], a: 1, exp: '기계학습 모델은 숫자만 계산할 수 있어요.' },
    { t: 'choice', step: 4, q: '히스토그램과 밀도 추정 곡선을 함께 보여 주는 seaborn 함수는?', opts: ['sns.heatmap()', 'sns.displot()', 'sns.pairplot()', 'px.violin()'], a: 1, exp: 'displot(x=..., kde=True)' },
    { t: 'choice', step: 4, q: '그래프 크기를 정하는 코드는?', opts: ['plt.figure(figsize=(15,12))', 'plt.size(15,12)', 'sns.figsize(15,12)', 'df.shape(15,12)'], a: 0, exp: 'figsize=(가로, 세로)' },
    { t: 'choice', step: 5, q: 'train_test_split()에서 random_state = 96의 역할은?', opts: ['데이터를 96개만 사용', '96%를 훈련용으로 사용', '실행할 때마다 같은 방식으로 섞이게 고정', '96번 반복 학습'], a: 2, exp: 'random_state를 고정하면 실행할 때마다 똑같이 나뉘어 결과를 비교할 수 있어요.' },
    { t: 'choice', step: 5, q: '1649개 데이터를 test_size=0.2로 나누면 테스트 데이터는 몇 개?', opts: ['165개', '330개', '1319개', '1649개'], a: 1, exp: '1649 × 0.2 = 329.8 → 올림하여 330개, 훈련은 1319개예요.' },
    { t: 'choice', step: 6, q: '선형 회귀에서 coef_와 intercept_는 각각?', opts: ['편향 / 가중치', '가중치(기울기) / 편향(절편)', '예측값 / 실제값', '정확도 / 오차'], a: 1, exp: 'y = w·x + b 에서 w = coef_, b = intercept_' },
    { t: 'choice', step: 7, q: '결정 계수(R²) 0.79의 해석으로 가장 알맞은 것은?', opts: ['79개를 맞혔다', '모델이 기대 수명 변화의 약 79%를 설명한다', '오차가 79년이다', '79세까지 예측할 수 있다'], a: 1, exp: '결정 계수는 1에 가까울수록 모델이 데이터를 잘 설명해요.' },
    { t: 'ox', step: 4, q: '히트맵 해석: 국가 총 인구수(Population)는 기대 수명과 상관관계가 높다.', a: false, exp: 'Population의 상관계수는 약 −0.02로 거의 관계가 없어요.' },
    { t: 'ox', step: 4, q: '바이올린 그래프 해석: 기대 수명이 65세 미만인 선진국(1)은 존재하지 않는다.', a: true, exp: '선진국(1)의 최솟값은 65세 이상이에요.' },
    { t: 'ox', step: 4, q: '산점도 해석: 홍역(Measles)은 주로 GDP가 높은 선진국에서 발생한다.', a: false, exp: '홍역은 GDP가 낮은 개발도상국(0)에서 주로 발생해요.' },
    { t: 'ox', step: 5, q: '기대 수명 예측은 정답이 있는 데이터로 학습하므로 지도학습이다.', a: true, exp: '정답(기대 수명)이 있는 데이터로 숫자를 예측하는 지도학습(회귀)이에요.' },
    { t: 'ox', step: 6, q: 'linear_reg = LinearRegression 처럼 괄호 없이 써도 모델이 만들어진다.', a: false, exp: '괄호 ()를 붙여야 모델 객체가 만들어져요.' },
    { t: 'ox', step: 8, q: 'np.arange()는 철자가 arrange(r 두 개)이다.', a: false, exp: 'a + range = arange, r이 하나예요.' },
  ];

  // ───────────── 명령어 카드 ─────────────
  const CARDS = [
    { step: 2, items: [
      ['import pandas as pd', '라이브러리를 별칭(pd)으로 불러오기', 'import numpy as np'],
      ["pd.read_csv('파일.csv')", 'CSV 파일을 읽어 데이터프레임으로 만들기', "df = pd.read_csv('Life Expectancy Data.csv')"],
      ['df.info()', '속성명, Non-Null 개수, 자료형 확인', ''],
      ['df.head()', '앞의 5개 행 출력 (뒤 5개는 tail())', 'df.head(10)  # 10개'],
    ] },
    { step: 3, items: [
      ['df.shape', '(행 개수, 열 개수) — 괄호 없는 속성', '(2938, 22)'],
      ['df.isna().sum()', '속성별 결측치 개수', ''],
      ['df.dropna()', '결측치가 있는 행 삭제', 'df = df.dropna()'],
      ['.astype(자료형)', '자료형 바꾸기', "df['Status'].astype(object)"],
      ['df.replace({기존:새값})', '값 바꾸기', "{'Developing':0, 'Developed':1}"],
    ] },
    { step: 4, items: [
      ["df['열'].hist()", '판다스 히스토그램 (기본 10구간)', ''],
      ['sns.displot(x=..., kde=True)', '히스토그램 + 밀도 추정 곡선', "sns.displot(x=df['Polio'], kde=True)"],
      ['plt.figure(figsize=(가로,세로))', '그래프 크기 설정', ''],
      ['df.corr(numeric_only=True)', '숫자 속성 간 상관계수 표', ''],
      ['sns.heatmap(표, annot=True)', '상관계수를 색으로 표시 (annot: 값 표시)', 'cmap=plt.cm.YlOrRd'],
      ["sns.pairplot(data=..., hue='열')", '속성 쌍별 산점도 행렬, hue로 색 구분', "palette='bright'"],
      ['px.violin(df, x=, y=, box=True)', 'Plotly 바이올린 그래프 (분포+밀도)', 'fig.show()'],
    ] },
    { step: 5, items: [
      ['df.drop([열들], axis=1)', '지정한 열 삭제 (axis=1 → 열)', "df.drop(['Life expectancy','Country'], axis=1)"],
      ["df.loc[:, '열']", '행 전체(:)에서 지정한 열 선택', ''],
      ['train_test_split(X, y, test_size=0.2, random_state=96)', '훈련/테스트 데이터 분리 (8:2)', 'X_train, X_test, y_train, y_test = ...'],
    ] },
    { step: 6, items: [
      ['LinearRegression()', '선형 회귀 모델 생성', 'from sklearn.linear_model import LinearRegression'],
      ['model.fit(X_train, y_train)', '훈련 데이터로 학습', ''],
      ['model.coef_', '가중치(기울기)', ''],
      ['model.intercept_', '편향(절편)', ''],
    ] },
    { step: 7, items: [
      ['model.predict(X_test)', '입력 데이터로 예측값 구하기', 'y_pred = ...'],
      ['r2_score(y_test, y_pred)', '결정 계수 — 1에 가까울수록 좋음', 'from sklearn.metrics import r2_score'],
      ['for i in range(6):', '0~5까지 6번 반복', ''],
    ] },
    { step: 8, items: [
      ['.reshape(-1, 1)', '행 자동, 열 1개인 2차원 배열로 변환', ''],
      ['np.arange(시작, 끝)', '시작부터 끝 직전까지 1씩 증가하는 배열', ''],
      ['plt.scatter(x, y)', '산점도', ''],
      ["plt.plot(x, y, color='red')", '선 그래프(회귀선)', "plt.xlabel(), plt.ylabel(), plt.show()"],
    ] },
  ];

  window.CONTENT = { STEPS, QUIZ, CARDS, FEATURES, train };
})();

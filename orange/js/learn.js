// ===== 위젯 학습 자료 & 복습 퀴즈 =====

const WIDGET_DOCS = {
  File: {
    summary: '컴퓨터에 저장된 데이터 파일(csv, xlsx 등)을 불러오는 위젯',
    what: '분석할 데이터를 Orange로 가져오는 출발점입니다. 불러온 뒤 각 열(column)의 <b>자료형(Type)</b>과 <b>역할(Role)</b>을 정할 수 있습니다.',
    settings: [['Source', '불러올 파일(File) 또는 인터넷 주소(URL)를 선택합니다.'], ['Type', 'numeric(수치형), categorical(범주형), text(문자), datetime(날짜) 중 하나'], ['Role', '<b>feature</b>(속성: 학습에 쓰는 입력) · <b>target</b>(목표 변수: 맞혀야 할 정답) · <b>meta</b>(참고 정보, 학습에 사용 안 함) · <b>skip</b>(제외)'], ['Apply', 'Role/Type을 바꾼 뒤 반드시 눌러야 적용됩니다.']],
    use: { penguin: 'penguins_size.csv를 불러오고, 분류하려는 <b>species</b>의 Role을 <b>target</b>으로 바꾼 뒤 Apply' },
    tip: '지도학습 모델은 정답(target)이 있어야 학습할 수 있어요. target을 지정하지 않으면 모델 위젯과 Test and Score에 오류가 나요.'
  },
  'Data Table': {
    summary: '데이터를 표(스프레드시트) 형태로 보여 주는 위젯',
    what: '들어온 데이터를 행(인스턴스)과 열(속성)로 보여 줍니다. 왼쪽 Info에서 <b>데이터 개수, 속성 수, 결측치 비율, 목표 변수</b>를 한눈에 확인할 수 있습니다. 비어 있는 값(결측치)은 <code>?</code>로 표시됩니다.',
    settings: [['Info', '인스턴스 수, 속성 수와 결측치 비율(%), target 정보'], ['색상', '목표 변수와 메타 속성은 배경색으로 구분돼요.']],
    use: { penguin: '344개 데이터와 0.9% 결측치 확인 → 전처리 후 333개로 줄어든 것 확인', lung: 'Image Embedding이 만든 특징(n0, n1, …) 확인' },
    tip: '전처리 전·후에 Data Table을 연결해 보면 데이터가 어떻게 바뀌었는지 비교할 수 있어요.'
  },
  Preprocess: {
    summary: '결측치 처리, 정규화 등 데이터를 학습에 알맞게 다듬는 위젯',
    what: '왼쪽 목록의 전처리 방법을 오른쪽으로 추가해서 순서대로 적용합니다. 이 실습에서는 <b>Impute Missing Values</b>(결측치 처리)를 사용합니다.',
    settings: [['Average/Most frequent', '수치형은 평균, 범주형은 가장 많이 나온 값으로 빈칸을 채움'], ['Replace with random value', '임의의 값으로 채움'], ['Remove rows with missing values', '<b>결측치가 하나라도 있는 행을 삭제</b>'], ['Normalize Features', '속성값의 범위를 비슷하게 맞춤 (표준화: 평균 0, 분산 1)']],
    use: { penguin: 'Remove rows with missing values를 선택해 결측치가 있는 11개 행을 제거 (344 → 333개)' },
    tip: '결측치를 지우면 데이터가 줄어들고, 채우면 데이터는 유지되지만 실제와 다른 값이 들어갈 수 있어요. 데이터 양과 상황에 맞게 골라요.'
  },
  'Scatter Plot': {
    summary: '두 수치 속성을 x축·y축으로 하여 점으로 나타내는 시각화 위젯',
    what: '각 데이터를 하나의 점으로 찍어 속성 사이의 관계와 분포를 보여 줍니다. <b>Color</b>를 목표 변수로 정하면 클래스별로 색이 달라져서 어떤 속성이 분류에 도움이 되는지 알 수 있습니다.',
    settings: [['Axis x / Axis y', '가로축·세로축에 놓을 속성'], ['Color', '점의 색을 정할 범주형 속성 (예: species)']],
    use: { penguin: 'Color를 species로 하고 x·y축을 바꿔 가며 종류별 분포 확인' },
    tip: 'culmen_length_mm(부리 길이)와 flipper_length_mm(날개 길이)를 고르면 세 종류가 꽤 잘 나뉘어요. 반면 서로 겹치는 조합도 찾아보세요.'
  },
  'Data Sampler': {
    summary: '데이터를 훈련 데이터와 테스트 데이터로 나누는 위젯',
    what: '데이터 중 일부를 무작위로 뽑아 <b>Data Sample</b>로, 나머지를 <b>Remaining Data</b>로 내보냅니다. 보통 Data Sample을 훈련 데이터, Remaining Data를 테스트 데이터로 사용합니다.',
    settings: [['Fixed proportion of data', '전체 중 몇 %를 뽑을지 (80% → 8:2 분할)'], ['Fixed sample size', '뽑을 개수를 직접 지정'], ['Replicable sampling', '체크하면 매번 같은 방식으로 나눠요(재현 가능)'], ['Stratify sample', '클래스 비율을 원래 데이터와 비슷하게 유지'], ['출력', '<b>Data Sample</b>(선택된 데이터) · <b>Remaining Data</b>(나머지 데이터)']],
    use: { penguin: '80%로 설정 → Data Sample(훈련)은 모델로, Remaining Data(테스트)는 Test and Score의 Test Data로' },
    tip: '테스트 데이터는 학습에 쓰지 않은 “처음 보는 문제”예요. 훈련에 쓴 데이터로만 평가하면 실력을 과대평가할 수 있어요.'
  },
  kNN: {
    summary: '가장 가까운 k개의 이웃을 보고 분류하는 k-최근접 이웃 모델',
    what: '새 데이터가 들어오면 훈련 데이터 중 <b>거리가 가장 가까운 k개</b>를 찾고, 그중 가장 많은 클래스로 분류합니다. 따로 규칙을 만들지 않고 데이터를 기억해 두었다가 비교하는 방식입니다.',
    settings: [['Number of neighbors (k)', '살펴볼 이웃의 수 (기본 5)'], ['Metric', '거리 계산 방법: Euclidean(직선 거리), Manhattan(가로+세로 거리)'], ['Weight', 'Uniform(모든 이웃 동일) / By Distances(가까울수록 큰 영향)']],
    use: { penguin: 'Data Sample(훈련 데이터)로 학습 → Logistic Regression과 성능 비교', lung: '이미지 임베딩 특징으로 학습 → 다른 모델과 비교' },
    tip: 'k가 너무 작으면 잡음에 민감하고, 너무 크면 경계가 흐려져요. 동점을 피하려면 홀수를 많이 써요.',
    demo: true
  },
  'Logistic Regression': {
    summary: '속성의 가중합을 확률로 바꾸어 분류하는 모델',
    what: '각 속성에 가중치를 곱해 더한 값을 시그모이드(또는 소프트맥스) 함수로 <b>0~1 사이의 확률</b>로 바꿉니다. 이름에 “회귀”가 들어가지만 <b>분류</b>에 쓰는 모델입니다.',
    settings: [['Regularization', 'Lasso(L1) / Ridge(L2): 가중치가 너무 커지지 않도록 막아 과대적합을 줄임'], ['Strength C', '값이 작을수록 규제가 강함 (기본 1)']],
    use: { penguin: 'kNN과 같은 훈련 데이터로 학습 → Test and Score에서 비교' },
    tip: '결과를 확률로 알려 주기 때문에 “얼마나 확신하는지”도 알 수 있어요.'
  },
  'Random Forest': {
    summary: '여러 개의 의사결정나무가 투표하여 분류하는 앙상블 모델',
    what: '훈련 데이터에서 무작위로 데이터를 뽑아 여러 그루의 <b>의사결정나무</b>를 만들고, 각 나무의 예측을 <b>다수결(투표)</b>로 합칩니다. 나무 한 그루보다 안정적이고 과대적합이 적습니다.',
    settings: [['Number of trees', '만들 나무의 개수 (기본 10)'], ['Limit depth', '나무가 너무 깊어지지 않게 제한'], ['Do not split subsets smaller than', '데이터가 이 개수보다 적으면 더 나누지 않음']],
    use: { lung: 'Image Embedding의 특징으로 학습 → Test and Score에서 평가' },
    tip: '“숲(Forest)” = 나무(Tree) 여러 그루! 나무 수를 늘리면 보통 결과가 안정되지만 계산 시간이 늘어요.'
  },
  'Neural Network': {
    summary: '사람의 신경망을 본뜬 다층 퍼셉트론(MLP) 모델',
    what: '입력층 → <b>은닉층</b> → 출력층으로 이루어진 인공신경망입니다. 뉴런들이 가중치로 연결되어 있고, 학습을 반복(iteration)하며 오차가 줄어들도록 가중치를 조정합니다.',
    settings: [['Neurons in hidden layers', '은닉층 뉴런 수 (기본 100)'], ['Activation', '활성화 함수: ReLu, tanh, Logistic 등'], ['Solver', '가중치를 조정하는 방법 (Adam 등)'], ['Max iterations', '최대 학습 반복 횟수 (기본 200)']],
    use: { lung: 'Image Embedding의 특징으로 학습 → 다른 모델과 비교, Predictions에 연결' },
    tip: '은닉층이 여러 겹으로 깊어지면 “딥러닝”이라고 불러요. Image Embedding에 쓰이는 Inception v3도 아주 깊은 신경망이에요.'
  },
  'Test and Score': {
    summary: '여러 학습 모델의 성능을 같은 조건에서 평가·비교하는 위젯',
    what: '데이터(Data)와 학습 방법(Learner)을 받아 지정한 방법으로 학습과 평가를 수행하고, 모델별 <b>평가 지표</b>를 표로 보여 줍니다.',
    settings: [['Cross validation', '데이터를 k개로 나눠 돌아가며 평가 (교차검증)'], ['Test on train data', '훈련 데이터로 평가 (실력이 부풀려질 수 있음)'], ['Test on test data', '<b>Test Data 입력으로 들어온 데이터로 평가</b>'], ['입력', 'Data(훈련) · Test Data(테스트) · Learner(모델, 여러 개 가능)'], ['지표', 'AUC, CA(정확도), F1, Prec(정밀도), Recall(재현율)']],
    use: { penguin: 'Data Sample → Data, Remaining Data → Test Data, Test on test data로 kNN과 Logistic Regression 비교', lung: 'Image Embedding과 세 모델을 연결해 교차검증으로 비교' },
    tip: 'CA가 가장 높은 모델이 항상 최고는 아니에요. 클래스 비율이 불균형하면 F1, Recall도 함께 봐요.'
  },
  'Confusion Matrix': {
    summary: '실제 정답과 모델의 예측을 표로 비교하는 혼동행렬 위젯',
    what: '행은 <b>실제(Actual)</b> 클래스, 열은 <b>예측(Predicted)</b> 클래스입니다. 대각선 칸은 맞게 분류한 개수, 나머지 칸은 잘못 분류한 개수입니다. 어떤 클래스끼리 헷갈리는지 알 수 있습니다.',
    settings: [['Learners', '혼동행렬을 볼 모델 선택'], ['Show', '개수 / 예측 대비 비율 / 실제 대비 비율']],
    use: { lung: 'Test and Score와 연결 → Covid·Normal·Viral Pneumonia 중 어떤 것을 헷갈렸는지 확인' },
    tip: '의료 진단에서는 “환자를 정상으로 잘못 판단하는 것(놓침)”이 특히 위험해요. 혼동행렬로 이런 오류를 확인해요.'
  },
  Predictions: {
    summary: '학습된 모델로 새로운 데이터의 클래스를 예측하는 위젯',
    what: '학습이 끝난 <b>Model</b>과 예측할 <b>Data</b>를 받아 각 데이터의 예측 결과와 클래스별 확률을 보여 줍니다. 데이터에 정답이 있으면 성능 지표도 함께 보여 줍니다.',
    settings: [['입력', 'Data(예측할 데이터) · Predictors(학습된 모델, 여러 개 가능)'], ['확률', '괄호 안 숫자는 각 클래스일 확률']],
    use: { lung: '테스트 이미지(test 폴더)를 임베딩한 데이터와 가장 좋은 모델을 연결해 분류 결과 해석' },
    tip: 'Test and Score는 Learner(학습 방법)를, Predictions는 Model(학습된 모델)을 받아요. 모델 위젯에 데이터를 연결해야 Model이 생겨요!'
  },
  'Import Images': {
    summary: '폴더에 있는 이미지들을 불러오는 위젯 (Image Analytics 추가 기능)',
    what: '선택한 폴더 안의 이미지를 모두 불러옵니다. 하위 폴더가 있으면 <b>폴더 이름이 이미지의 범주(category)</b>가 되어 목표 변수로 쓰입니다.',
    settings: [['Folder', '이미지가 있는 폴더 선택 (train / test)'], ['출력', '이미지 이름, 경로, 크기, category가 담긴 데이터']],
    use: { lung: 'train 폴더(250개)와 test 폴더(66개)를 각각 불러옴' },
    tip: 'Image Analytics는 기본으로 설치되어 있지 않아요. [Options] → [Add-ons...]에서 추가해야 해요.'
  },
  'Image Viewer': {
    summary: '불러온 이미지를 썸네일로 보여 주는 위젯',
    what: '데이터 안의 이미지를 격자 형태로 보여 줍니다. 각 이미지 아래에 제목 속성(예: category)을 표시할 수 있습니다.',
    settings: [['Title attribute', '이미지 아래 표시할 속성'], ['Zoom', '이미지 크기 조절']],
    use: { lung: 'Import Images로 불러온 폐 X-ray 이미지를 눈으로 확인' },
    tip: '모델을 만들기 전에 데이터를 직접 눈으로 살펴보는 것은 아주 중요한 습관이에요.'
  },
  'Image Embedding': {
    summary: '이미지를 숫자 벡터(특징)로 바꾸는 위젯',
    what: '미리 학습된 깊은 인공신경망(예: <b>Inception v3</b>)에 이미지를 넣어 <b>특징 벡터</b>를 뽑아냅니다. 컴퓨터는 이미지 자체를 그대로 학습하기 어렵기 때문에, 이렇게 숫자로 바꾼 뒤 kNN·Random Forest 같은 모델로 학습합니다.',
    settings: [['Embedder', 'Inception v3(기본, 서버), SqueezeNet(내 컴퓨터에서 실행), VGG-16/19, Painters 등'], ['출력', '원래 정보 + 특징 n0, n1, … (Inception v3는 2048개)']],
    use: { lung: '훈련 이미지와 테스트 이미지를 각각 임베딩' },
    tip: 'Inception v3 등은 인터넷 서버에서 계산하므로 인터넷 연결이 필요해요. 인터넷이 안 되면 SqueezeNet(local)을 사용해요.'
  }
};

const CONCEPTS = [
  { id: 'supervised', icon: '🏷️', title: '지도학습과 목표 변수(target)', html: `<p>정답(레이블)이 있는 데이터로 학습하는 방법을 <b>지도학습</b>이라고 해요. Orange에서는 정답 열의 Role을 <b>target</b>으로 지정합니다.</p><ul><li>펭귄 활동: 맞혀야 할 정답 = <code>species</code> (Adelie, Chinstrap, Gentoo)</li><li>폐 이미지 활동: 정답 = <code>category</code> (Covid, Normal, Viral Pneumonia) — 폴더 이름에서 자동으로 만들어짐</li></ul><p>정답이 범주(종류)이면 <b>분류</b>, 수치이면 <b>회귀</b> 문제입니다.</p>` },
  { id: 'missing', icon: '🩹', title: '결측치와 전처리', html: `<p><b>결측치</b>는 값이 비어 있는 칸이에요. Data Table에서 <code>?</code>로 보여요. 펭귄 데이터는 344개 중 일부 행의 부리 길이·성별 등이 비어 있어 약 <b>0.9%</b>가 결측치입니다.</p><table class="mini-t"><tr><th>방법</th><th>장점</th><th>단점</th></tr><tr><td>행 제거</td><td>간단, 가짜 값 없음</td><td>데이터 수가 줄어듦 (344→333)</td></tr><tr><td>평균/최빈값 대체</td><td>데이터 수 유지</td><td>실제와 다른 값이 들어감</td></tr></table>` },
  { id: 'split', icon: '✂️', title: '훈련 데이터 · 테스트 데이터 · 교차검증', html: `<p>모델이 처음 보는 데이터도 잘 맞히는지 확인하려면, 학습에 쓰지 않은 데이터로 평가해야 해요.</p>
    <div class="splitbar"><div class="tr">훈련 데이터 80% (Data Sample)</div><div class="te">테스트 20% (Remaining)</div></div>
    <p><b>교차검증(Cross validation)</b>: 데이터를 k개 묶음으로 나눈 뒤, 한 묶음씩 돌아가며 테스트로 쓰고 나머지로 학습해요. 모든 데이터가 한 번씩 테스트에 쓰여서 결과가 더 믿을 만해요.</p>
    <div class="cvgrid">${[0, 1, 2, 3, 4].map(r => `<div class="cvrow"><span>${r + 1}회</span>${[0, 1, 2, 3, 4].map(c => `<i class="${c === r ? 'te' : 'tr'}"></i>`).join('')}</div>`).join('')}<div class="small">5-겹 교차검증 (■ 테스트 ■ 훈련)</div></div>` },
  { id: 'metrics', icon: '📊', title: '평가 지표: CA, Precision, Recall, F1, AUC', html: `<p>Covid를 기준(양성)으로 생각해 볼게요.</p>
    <table class="mini-t"><tr><th></th><th>예측: Covid</th><th>예측: 아님</th></tr><tr><th>실제: Covid</th><td class="g">TP (맞힘)</td><td class="r">FN (놓침)</td></tr><tr><th>실제: 아님</th><td class="r">FP (잘못 경보)</td><td class="g">TN (맞힘)</td></tr></table>
    <ul><li><b>CA (정확도)</b> = 맞힌 개수 ÷ 전체 개수</li><li><b>Precision (정밀도)</b> = TP ÷ (TP + FP) → “Covid라고 예측한 것 중 진짜 Covid 비율”</li><li><b>Recall (재현율)</b> = TP ÷ (TP + FN) → “진짜 Covid 중 찾아낸 비율”</li><li><b>F1</b> = 정밀도와 재현율의 조화평균 = 2 × P × R ÷ (P + R)</li><li><b>AUC</b> = ROC 곡선 아래 면적. 0.5는 찍기 수준, 1에 가까울수록 좋음</li></ul><p class="small">Orange는 클래스가 여러 개일 때 각 클래스의 값을 데이터 비율로 가중 평균해서 보여 줘요.</p>` },
  { id: 'embedding', icon: '🧬', title: '이미지 임베딩', html: `<p>이미지는 수많은 픽셀로 이루어져 있어서 그대로 학습하기 어려워요. <b>이미지 임베딩</b>은 수백만 장의 사진으로 미리 학습된 신경망을 이용해 이미지를 <b>의미 있는 숫자들의 목록(벡터)</b>으로 바꾸는 과정이에요.</p><div class="flow"><span>🖼️ 이미지</span>→<span>🧠 Inception v3</span>→<span>[0.12, 0.85, …, 0.03]<br><small>2048개의 특징</small></span>→<span>🌳 분류 모델</span></div><p>비슷하게 생긴 이미지는 비슷한 숫자 벡터를 갖게 되므로, kNN·Random Forest·Neural Network 같은 모델로 분류할 수 있어요.</p>` },
  { id: 'signals', icon: '🔗', title: 'Learner와 Model의 차이', html: `<p>모델 위젯(kNN, Logistic Regression 등)은 두 가지를 내보내요.</p><ul><li><b>Learner</b> (학습 방법): “이렇게 학습하세요”라는 레시피 → <b>Test and Score</b>가 받아서 직접 학습·평가</li><li><b>Model</b> (학습된 모델): 데이터를 연결해 학습을 마친 결과물 → <b>Predictions</b>가 받아서 새 데이터를 예측</li></ul><p>그래서 Predictions에 쓰려면 모델 위젯에 반드시 <b>훈련 데이터</b>를 연결해야 해요!</p>` }
];

const QUIZ = [
  { q: '펭귄 활동에서 분류하려는 속성인 species의 Role은 무엇으로 바꿔야 할까요?', o: ['feature', 'target', 'meta', 'skip'], a: 1, e: '맞혀야 할 정답(목표 변수)이므로 target으로 지정하고 Apply를 눌러요.' },
  { q: '데이터의 개수와 결측치 비율을 표 형태로 확인할 수 있는 위젯은?', o: ['Scatter Plot', 'Data Table', 'Data Sampler', 'Predictions'], a: 1, e: 'Data Table의 Info에서 인스턴스 수와 결측치(%)를 확인할 수 있어요.' },
  { q: "Preprocess 위젯에서 'Remove rows with missing values'를 선택하면 어떻게 될까요?", o: ['결측치를 평균값으로 채운다', '결측치가 있는 열을 삭제한다', '결측치가 있는 행을 삭제한다', '모든 값을 0~1로 바꾼다'], a: 2, e: '결측치가 하나라도 있는 행(데이터)을 제거해요. 펭귄 데이터는 344개 → 333개가 돼요.' },
  { q: 'Scatter Plot에서 펭귄 종류별로 점의 색을 다르게 하려면 무엇을 바꿔야 할까요?', o: ['Axis x를 species로', 'Color를 species로', 'Data Sampler 비율을 80%로', 'File의 Type을 numeric으로'], a: 1, e: '속성(Attributes)의 Color를 species로 정하면 종류별로 색이 구분돼요.' },
  { q: 'Data Sampler에서 훈련 데이터와 테스트 데이터를 8:2로 나누려면?', o: ['Fixed proportion 20%', 'Fixed proportion 80%', 'Cross validation 8겹', 'Bootstrap'], a: 1, e: '80%를 Data Sample(훈련)로 뽑고 나머지 20%가 Remaining Data(테스트)가 돼요.' },
  { q: 'Data Sampler의 출력 중 테스트 데이터로 사용하여 Test and Score의 Test Data에 연결하는 것은?', o: ['Data Sample', 'Remaining Data', 'Learner', 'Evaluation Results'], a: 1, e: '학습에 쓰이지 않은 나머지 데이터(Remaining Data)를 Test Data로 연결해요.' },
  { q: "Test and Score에서 Data Sampler가 보낸 Test Data로 평가하려면 어떤 옵션을 골라야 할까요?", o: ['Cross validation', 'Test on train data', 'Test on test data', 'Leave one out'], a: 2, e: "'Test on test data'를 선택해야 Test Data 입력으로 평가해요." },
  { q: 'kNN 모델에 대한 설명으로 옳은 것은?', o: ['여러 나무가 투표하여 분류한다', '가장 가까운 k개 이웃의 다수 클래스로 분류한다', '은닉층의 가중치를 반복해서 조정한다', '이미지를 숫자 벡터로 바꾼다'], a: 1, e: 'k-최근접 이웃(k-Nearest Neighbors)은 거리가 가까운 k개를 보고 분류해요.' },
  { q: '여러 개의 의사결정나무를 만들고 투표로 결과를 정하는 모델은?', o: ['kNN', 'Logistic Regression', 'Random Forest', 'Neural Network'], a: 2, e: 'Random Forest = 나무(Tree)들의 숲(Forest)! 다수결로 분류해요.' },
  { q: '폐 이미지 활동에서 Import Images 위젯이 보이지 않을 때 해야 할 일은?', o: ['File 위젯으로 이미지 폴더를 연다', '[Options] → [Add-ons...]에서 Image Analytics를 추가한다', 'Preprocess로 이미지를 변환한다', 'Data Table을 먼저 연결한다'], a: 1, e: 'Image Analytics는 추가 기능(Add-on)이라 따로 설치해야 해요.' },
  { q: '이미지를 미리 학습된 신경망에 넣어 숫자 특징(n0, n1, …)으로 바꾸는 위젯은?', o: ['Image Viewer', 'Image Embedding', 'Import Images', 'Confusion Matrix'], a: 1, e: 'Image Embedding이 이미지를 특징 벡터로 바꿔서 기계학습 모델이 학습할 수 있게 해요.' },
  { q: 'Import Images로 train 폴더를 불러오면 이미지의 범주(category)는 어떻게 정해질까요?', o: ['이미지 파일 크기', '하위 폴더 이름(Covid, Normal, Viral Pneumonia)', '이미지 밝기', '사용자가 하나씩 입력'], a: 1, e: '하위 폴더 이름이 그대로 category(목표 변수)가 돼요.' },
  { q: '혼동행렬(Confusion Matrix)에서 대각선 칸의 숫자가 의미하는 것은?', o: ['잘못 분류한 개수', '올바르게 분류한 개수', '결측치 개수', '테스트 데이터 비율'], a: 1, e: '대각선은 실제 클래스와 예측 클래스가 같은, 즉 맞게 분류한 개수예요.' },
  { q: '학습된 모델로 테스트 이미지 66개의 분류 결과와 확률을 하나씩 확인할 수 있는 위젯은?', o: ['Test and Score', 'Predictions', 'Data Sampler', 'Image Viewer'], a: 1, e: 'Predictions는 Model과 Data를 받아 각 데이터의 예측과 확률을 보여 줘요.' },
  { q: 'Predictions 위젯에 모델을 연결하려면 모델 위젯에 무엇이 반드시 연결되어 있어야 할까요?', o: ['훈련 데이터(Data)', 'Confusion Matrix', 'Scatter Plot', '아무것도 필요 없음'], a: 0, e: '훈련 데이터를 받아 학습해야 Model 출력이 생겨요. Test and Score는 Learner만으로도 평가할 수 있어요.' },
  { q: "실제 Covid 이미지 중 모델이 Covid로 찾아낸 비율을 뜻하는 지표는?", o: ['Precision (정밀도)', 'Recall (재현율)', 'AUC', 'CA'], a: 1, e: 'Recall = TP ÷ (TP + FN). 진짜 양성 중 찾아낸 비율이에요. 의료 진단에서 특히 중요해요.' },
  { type: 'order', q: '활동 3(펭귄) 워크플로의 순서를 완성하세요.', slots: ['File', 'Preprocess', 'Data Table', 'Data Sampler', 'kNN', 'Test and Score'], e: 'File(불러오기) → Preprocess(결측치 제거) → Data Table(확인) → Data Sampler(8:2 분할) → kNN(학습) → Test and Score(평가)' },
  { type: 'order', q: '활동 4(폐 이미지) 워크플로의 순서를 완성하세요.', slots: ['Import Images', 'Image Embedding', 'Random Forest', 'Test and Score', 'Confusion Matrix'], e: 'Import Images(불러오기) → Image Embedding(특징 추출) → Random Forest(학습) → Test and Score(평가) → Confusion Matrix(혼동행렬)' }
];

const Learn = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  function open(type) { location.hash = '#learn-' + encodeURIComponent(type); }

  function card(t) {
    const W = WIDGETS[t], D = WIDGET_DOCS[t], c = CATS[W.cat];
    const io = (arr, empty) => arr.length ? arr.map(x => `<span class="sig s-${x.type}">${x.name}</span>`).join(' ') : `<span class="muted">${empty}</span>`;
    return `<article class="wcard" id="w-${t.replace(/ /g, '_')}"><header style="--c:${c.color}"><span class="bigicon">${W.icon}</span><div><div class="cat">${c.label}</div><h3>${t}</h3><p>${D.summary}</p></div></header>
      <div class="wc-body"><p>${D.what}</p>
      <div class="io"><div><b>⬅ 입력</b> ${io(W.inputs, '없음 (시작 위젯)')}</div><div><b>➡ 출력</b> ${io(W.outputs, '없음 (보기 전용)')}</div></div>
      <h4>주요 설정</h4><dl>${D.settings.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <h4>교과서 활동에서는?</h4><ul class="uses">${D.use.penguin ? `<li><span class="tag p">활동 3 펭귄</span> ${D.use.penguin}</li>` : ''}${D.use.lung ? `<li><span class="tag l">활동 4 폐 이미지</span> ${D.use.lung}</li>` : ''}</ul>
      <div class="tipbox">💡 ${D.tip}</div>${D.demo ? '<div id="knnDemo"></div>' : ''}</div></article>`;
  }

  function renderLearn(focus) {
    const el = $('#view-learn');
    const cats = Object.keys(CATS);
    el.innerHTML = `<div class="page"><h1>📖 위젯 학습 자료</h1><p class="lead">교과서 오렌지 활용 활동 3·4에서 사용하는 위젯 ${Object.keys(WIDGETS).length}개와 핵심 개념을 정리했어요. 시뮬레이터의 위젯 창에서 <b>❓</b>를 누르면 이 페이지로 바로 올 수 있어요.</p>
      <nav class="toc">${cats.map(k => `<div><b style="--c:${CATS[k].color}">${CATS[k].label}</b>${Object.keys(WIDGETS).filter(t => WIDGETS[t].cat === k).map(t => `<a href="#learn-${encodeURIComponent(t)}">${WIDGETS[t].icon} ${t}</a>`).join('')}</div>`).join('')}
      <div><b style="--c:#ccc">핵심 개념</b>${CONCEPTS.map(c => `<a href="#learn-c-${c.id}">${c.icon} ${c.title.split(':')[0]}</a>`).join('')}</div></nav>
      <h2 class="sect">🧭 신호(입력·출력)의 종류</h2>
      <div class="sigs"><span class="sig s-data">Data</span> 데이터 표 <span class="sig s-learner">Learner</span> 학습 방법 <span class="sig s-model">Model</span> 학습된 모델 <span class="sig s-eval">Evaluation Results</span> 평가 결과</div>
      <div class="workflows"><div><h4>활동 3 펭귄 종류 분류</h4>${flow(['File', 'Preprocess', 'Data Table', ['Scatter Plot', 'Data Sampler'], ['kNN', 'Logistic Regression'], 'Test and Score'])}</div>
      <div><h4>활동 4 폐 이미지 분류</h4>${flow(['Import Images', ['Image Viewer', 'Image Embedding'], ['Data Table', 'Random Forest', 'kNN', 'Neural Network'], 'Test and Score', 'Confusion Matrix'])}<div class="small">+ 테스트: Import Images(test) → Image Embedding → Predictions ← 가장 좋은 모델</div></div></div>
      ${cats.map(k => `<h2 class="sect" style="--c:${CATS[k].color}">${CATS[k].label}</h2><div class="cards">${Object.keys(WIDGETS).filter(t => WIDGETS[t].cat === k).map(card).join('')}</div>`).join('')}
      <h2 class="sect">💡 핵심 개념</h2><div class="cards concepts">${CONCEPTS.map(c => `<article class="wcard concept" id="c-${c.id}"><header style="--c:#e8e8e8"><span class="bigicon">${c.icon}</span><div><h3>${c.title}</h3></div></header><div class="wc-body">${c.html}</div></article>`).join('')}</div>
      <div class="cta"><a class="btn primary" href="#quiz">📝 복습 퀴즈 풀러 가기</a></div></div>`;
    knnDemo();
    if (focus) {
      const id = focus.startsWith('c-') ? focus : 'w-' + focus.replace(/ /g, '_');
      const t = document.getElementById(id);
      if (t) { t.scrollIntoView({ block: 'start' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1600); }
    } else window.scrollTo(0, 0);
  }
  function flow(items) {
    const one = t => `<span class="fw"><span class="mini" style="--c:${CATS[WIDGETS[t].cat].color}">${WIDGETS[t].icon}</span>${t}</span>`;
    return `<div class="flowline">${items.map(i => Array.isArray(i) ? `<span class="fgroup">${i.map(one).join('')}</span>` : one(i)).join('<span class="farrow">→</span>')}</div>`;
  }

  // kNN 체험: 펭귄 데이터 위에 점을 찍으면 가까운 이웃 k개를 보여 줌
  function knnDemo() {
    const el = $('#knnDemo'); if (!el) return;
    el.innerHTML = `<h4>🎮 kNN 직접 해 보기</h4><p class="small">그래프를 클릭해 새 펭귄을 놓아 보세요. 가장 가까운 k마리의 종류로 분류해요. (부리 길이 × 날개 길이, 축 단위를 맞추기 위해 표준화하여 거리 계산)</p>
      <div class="frow">k = <input type="range" min="1" max="15" step="2" value="5" id="kk"> <b id="kv">5</b></div><canvas width="520" height="360" id="kcv"></canvas><div id="kres" class="note">그래프를 클릭하세요!</div>`;
    const cv = $('#kcv'), g = cv.getContext('2d');
    const pts = PENGUIN_ROWS.filter(r => r[2] != null && r[4] != null).map(r => ({ x: r[2], y: r[4], s: r[0] }));
    const sp = ['Adelie', 'Chinstrap', 'Gentoo'];
    const mx = { x0: 31, x1: 61, y0: 168, y1: 236 }, m = 40;
    const X = v => m + (v - mx.x0) / (mx.x1 - mx.x0) * (cv.width - m - 10), Y = v => cv.height - m - (v - mx.y0) / (mx.y1 - mx.y0) * (cv.height - m - 10);
    const sd = (a) => { const mu = a.reduce((p, q) => p + q, 0) / a.length; return Math.sqrt(a.reduce((p, q) => p + (q - mu) ** 2, 0) / a.length); };
    const sx = sd(pts.map(p => p.x)), sy = sd(pts.map(p => p.y));
    let probe = null;
    function draw() {
      const k = +$('#kk').value; $('#kv').textContent = k;
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#444'; g.font = '11px sans-serif'; g.textAlign = 'center';
      for (let v = 35; v <= 60; v += 5) g.fillText(v, X(v), cv.height - m + 14);
      g.textAlign = 'right'; for (let v = 170; v <= 230; v += 10) g.fillText(v, m - 4, Y(v) + 4);
      g.textAlign = 'center'; g.fillText('culmen_length_mm (부리 길이)', cv.width / 2, cv.height - 6);
      g.save(); g.translate(10, cv.height / 2); g.rotate(-Math.PI / 2); g.fillText('flipper_length_mm', 0, 0); g.restore();
      let near = [];
      if (probe) near = pts.map(p => ({ p, d: Math.hypot((p.x - probe.x) / sx, (p.y - probe.y) / sy) })).sort((a, b) => a.d - b.d).slice(0, k);
      pts.forEach(p => { g.fillStyle = PALETTE_COLORS[sp.indexOf(p.s)] + '99'; g.beginPath(); g.arc(X(p.x), Y(p.y), 3.5, 0, 7); g.fill(); });
      if (probe) {
        near.forEach(({ p }) => { g.strokeStyle = '#333'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(probe.x), Y(probe.y)); g.lineTo(X(p.x), Y(p.y)); g.stroke(); g.strokeStyle = PALETTE_COLORS[sp.indexOf(p.s)]; g.lineWidth = 2.5; g.beginPath(); g.arc(X(p.x), Y(p.y), 6, 0, 7); g.stroke(); });
        const cnt = sp.map(s => near.filter(n => n.p.s === s).length), win = cnt.indexOf(Math.max(...cnt));
        g.fillStyle = PALETTE_COLORS[win]; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(probe.x), Y(probe.y) - 9); g.lineTo(X(probe.x) + 8, Y(probe.y) + 6); g.lineTo(X(probe.x) - 8, Y(probe.y) + 6); g.closePath(); g.fill(); g.stroke();
        $('#kres').innerHTML = `부리 ${probe.x.toFixed(1)}mm, 날개 ${probe.y.toFixed(0)}mm인 펭귄 → 이웃 ${k}마리: ${sp.map((s, i) => `<span style="color:${PALETTE_COLORS[i]}">●</span> ${s} ${cnt[i]}`).join(' · ')} ⇒ <b>${sp[win]}</b>(으)로 분류!`;
      }
      g.textAlign = 'left'; sp.forEach((s, i) => { g.fillStyle = PALETTE_COLORS[i]; g.beginPath(); g.arc(m + 12 + i * 95, 14, 5, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillText(s, m + 20 + i * 95, 18); });
    }
    cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) * cv.width / r.width, py = (e.clientY - r.top) * cv.height / r.height; probe = { x: mx.x0 + (px - m) / (cv.width - m - 10) * (mx.x1 - mx.x0), y: mx.y0 + (cv.height - m - py) / (cv.height - m - 10) * (mx.y1 - mx.y0) }; draw(); });
    $('#kk').addEventListener('input', draw);
    draw();
  }

  // ---------- 퀴즈 ----------
  let answers = {};
  function renderQuiz() {
    const el = $('#view-quiz');
    const total = QUIZ.length, done = Object.keys(answers).length, right = Object.values(answers).filter(a => a.ok).length;
    el.innerHTML = `<div class="page narrow"><h1>📝 복습 퀴즈</h1><p class="lead">오렌지 실습에서 사용한 위젯과 개념을 복습해요. 문제를 풀면 바로 해설이 나와요.</p>
      <div class="qscore">진행 ${done}/${total} · 정답 <b>${right}</b>개 <div class="prog"><div style="width:${100 * done / total}%"></div></div></div>
      ${QUIZ.map((q, i) => {
      const a = answers[i];
      if (q.type === 'order') {
        const opts = [...q.slots].sort();
        return `<div class="qcard ${a ? (a.ok ? 'ok' : 'no') : ''}"><div class="qn">Q${i + 1}. ${q.q}</div><div class="order">${q.slots.map((s, j) => `<select data-q="${i}" data-j="${j}" ${a ? 'disabled' : ''}><option value="">선택</option>${opts.map(o => `<option ${a && a.v[j] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>${j < q.slots.length - 1 ? '<span class="farrow">→</span>' : ''}`).join('')}</div>
            ${a ? `<div class="fb ${a.ok ? 'right' : 'wrong'}">${a.ok ? '✅ 정답!' : '❌ 아쉬워요.'} ${q.e}</div>` : `<button class="primary" data-check="${i}">확인</button>`}</div>`;
      }
      return `<div class="qcard ${a ? (a.ok ? 'ok' : 'no') : ''}"><div class="qn">Q${i + 1}. ${q.q}</div><div class="qopts">${q.o.map((o, j) => `<button data-q="${i}" data-o="${j}" class="${a ? (j === q.a ? 'right' : a.v === j ? 'wrong' : '') : ''}" ${a ? 'disabled' : ''}>${String.fromCharCode(9312 + j)} ${o}</button>`).join('')}</div>
          ${a ? `<div class="fb ${a.ok ? 'right' : 'wrong'}">${a.ok ? '✅ 정답!' : '❌ 정답은 ' + String.fromCharCode(9312 + q.a) + '번이에요.'} ${q.e}</div>` : ''}</div>`;
    }).join('')}
      ${done === total ? `<div class="finish">🎉 ${total}문제 중 <b>${right}</b>문제를 맞혔어요! ${right === total ? '완벽해요!' : right >= total * 0.7 ? '잘했어요! 틀린 문제의 해설을 다시 읽어 보세요.' : '학습 자료를 다시 읽고 도전해 보세요.'}</div>` : ''}
      <div class="btnrow center"><button data-act="retry">🔄 다시 풀기</button><a class="btn" href="#learn">📖 학습 자료 보기</a></div></div>`;
    el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { const i = +b.dataset.q, j = +b.dataset.o; answers[i] = { v: j, ok: j === QUIZ[i].a }; renderQuiz(); });
    el.querySelectorAll('[data-check]').forEach(b => b.onclick = () => {
      const i = +b.dataset.check, v = [...el.querySelectorAll(`select[data-q="${i}"]`)].map(s => s.value);
      if (v.some(x => !x)) return App.toast('모든 칸을 선택하세요.');
      answers[i] = { v, ok: v.every((x, j) => x === QUIZ[i].slots[j]) }; renderQuiz();
    });
    el.querySelector('[data-act=retry]').onclick = () => { answers = {}; renderQuiz(); window.scrollTo(0, 0); };
  }

  return { open, renderLearn, renderQuiz };
})();

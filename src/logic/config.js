// 게임 균형 숫자를 한곳에 모은 설정 파일.
// 여기 숫자만 바꾸면 난이도·가격·손님 수가 바뀐다. (봇 시뮬레이션으로 조정)
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});

  B.config = {
    days: 7, // 한 판 = 월~일 7일
    startMoney: 100000, // 시작 자금(원)
    weekdays: ['월', '화', '수', '목', '금', '토', '일'],

    // 빵 3종: 가격(price), 개당 재료비(unitCost), 한 판에 나오는 개수(batchSize), 기본 인기(popularity)
    breads: [
      { id: 'loaf', name: '식빵', price: 3000, unitCost: 1800, batchSize: 8, popularity: 0.4 },
      { id: 'croissant', name: '크루아상', price: 4000, unitCost: 2600, batchSize: 6, popularity: 0.35 },
      { id: 'cake', name: '케이크', price: 6000, unitCost: 4200, batchSize: 4, popularity: 0.25 },
    ],
    maxBatchesPerBread: 10, // 화면 조작 편의를 위한 한 빵당 최대 판 수

    premiumRate: 1.2, // 완벽하게 구운 빵: 정가의 120%
    dayOldRate: 0.7, // 하루 지난 빵: 정가의 70% (30% 할인)

    customers: {
      base: 40, // 평범한 날 기본 손님 수
      spread: 0.15, // 조건이 같아도 ±15% 안에서 랜덤
      dayMult: [0.7, 0.8, 0.9, 1.0, 1.3, 1.8, 1.5], // 요일별 배율 (월~일)
      qty2Chance: 0.3, // 한 번에 2개 사는 손님 비율
    },

    // 날씨: 나올 확률(prob), 손님 배율(mult), 빵 선호 배율(pref)
    weather: [
      { id: 'sunny', name: '맑음', prob: 0.5, mult: 1.0, pref: { cake: 1.3 } },
      { id: 'cloudy', name: '흐림', prob: 0.3, mult: 0.85, pref: {} },
      { id: 'rain', name: '비', prob: 0.2, mult: 0.45, pref: { loaf: 1.4 } },
    ],
    forecastAccuracy: 0.8, // 예보가 맞을 확률 (가끔 틀린다)

    // 오늘의 사건: 하루에 생길 확률(chance), 예보에 미리 나올 확률(forecastChance)
    events: {
      chance: 0.2,
      list: [
        { id: 'festival', name: '동네 축제', weight: 1, mult: 1.8, pref: { cake: 1.5 }, forecastChance: 0.9 },
        { id: 'rumor', name: '맛집 소문', weight: 1, mult: 1.5, pref: { croissant: 1.5 }, forecastChance: 0.3 },
        { id: 'picnic', name: '단체 소풍', weight: 1, mult: 1.3, pref: { loaf: 1.8 }, forecastChance: 0.7 },
        { id: 'roadwork', name: '앞길 공사', weight: 1, mult: 0.6, pref: {}, forecastChance: 1.0 },
      ],
    },

    // 손님 성향
    behavior: {
      bargainHunter: 0.3, // 할인존부터 찾는 손님 비율
      premiumSeeker: 0.25, // 프리미엄존부터 찾는 손님 비율 (나머지는 일반 칸)
      switchChance: 0.5, // 원하던 종류(새 빵/할인 빵)가 없을 때 다른 종류를 사는 비율
      substitute: 0.5, // 원하는 빵이 없을 때 다른 빵을 사는 비율 (나머지는 그냥 나감)
    },

    // 등급 기준: 순이익(원) 이상이면 해당 등급 (봇 시뮬레이션 결과로 조정)
    grades: [
      { min: 330000, grade: 'S' },
      { min: 270000, grade: 'A' },
      { min: 215000, grade: 'B' },
      { min: 140000, grade: 'C' },
      { min: -Infinity, grade: 'D' },
    ],
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = B.config;
})();

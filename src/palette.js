// 게임 전체가 쓰는 공용 팔레트(32색). 브라우저(게임 화면)와 Node(도트 생성 도구) 양쪽에서 같은 값을 쓴다.
// 그림자는 색상을 조금 차갑게, 밝은 쪽은 따뜻하게 옮겨서 입체감을 낸다(hue shifting).
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});

  B.pal = {
    ol: '#2b1d2f', // 외곽선(가장 어두운 보라빛 검정)
    white: '#fff7e8',
    // 반죽·빵 속살
    cr1: '#ffe9b8',
    cr2: '#f3c987',
    // 빵 껍질 (밝음 → 어두움)
    cu1: '#e9a955',
    cu2: '#c2743a',
    cu3: '#8a4a2b',
    // 분홍(케이크 크림, 볼)
    pk1: '#ffb3c1',
    pk2: '#f0708f',
    pk3: '#b8456f',
    rd: '#e0525c', // 빨강(딸기, 할인 태그)
    gd: '#ffd34e', // 금색(프리미엄, 동전, 불꽃)
    gd2: '#e39b2f',
    gr: '#79c86b', // 초록(완벽 구간, 딸기 잎)
    gr2: '#3f8f5a',
    // 낮 벽
    wl1: '#f7e6c4',
    wl2: '#e2c79c',
    wl3: '#bf9873',
    // 나무(계산대, 창틀)
    wd1: '#b9824f',
    wd2: '#8a5a3c',
    wd3: '#5f3b30',
    // 바닥
    fl1: '#d3a97c',
    fl2: '#b4865f',
    // 유리
    gl1: '#d9f2f2',
    gl2: '#9fd3dc',
    sk1: '#8fd3f0', // 낮 하늘
    // 밤
    nt1: '#1c1d3b',
    nt2: '#2f3163',
    nt3: '#4a4d88',
    // 손님
    sn1: '#f4c49b', // 피부
    sh1: '#58b5b0', // 셔츠
    sh2: '#357f86',
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = B.pal;
})();

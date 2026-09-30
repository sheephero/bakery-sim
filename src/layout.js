// 화면 좌표와 크기(논리 해상도 320x180 기준). 도트 생성 도구(Node)와 게임 화면(브라우저)이 같은 값을 쓴다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});

  B.layout = {
    width: 320,
    height: 180,

    // 진열장 5구역: 일반 3칸(식빵·크루아상·케이크) | 프리미엄존(섞임) | 할인존(섞임)
    CASE: {
      regular: [{ x: 14, w: 56 }, { x: 70, w: 56 }, { x: 126, w: 56 }],
      premium: { x: 186, w: 58 },
      discount: { x: 248, w: 58 },
      iconY: 137, // 빵 그림의 y
      plateY: 158, // 개수판의 y
    },

    // 오른쪽 위 잔고 표시
    HUD: { x: 246, y: 3, w: 70, h: 17 },

    // 밤 굽기 화면
    BAKE: {
      panel: { x: 114, y: 22, w: 200, h: 96 },
      oven: { x: 124, y: 40 },
      bar: { x: 146, y: 96 }, // 타이밍 바 왼쪽 위 (트랙은 x+2 부터 132px)
    },

    // 타이밍 바 구간(왼쪽부터). 합계 132px. burnt=탐, good=좋음, perfect=완벽
    TIMING: {
      trackWidth: 132,
      zones: [
        { w: 16, color: 'rd', quality: 'burnt' },
        { w: 36, color: 'gd', quality: 'good' },
        { w: 28, color: 'gr', quality: 'perfect' },
        { w: 36, color: 'gd', quality: 'good' },
        { w: 16, color: 'rd', quality: 'burnt' },
      ],
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = B.layout;
})();

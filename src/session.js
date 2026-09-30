// 한 판(7일)의 진행 상태를 담는 보관함. 화면(Scene)이 바뀌어도 이 값은 유지된다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});

  B.newSession = function () {
    const store = B.storage.load();
    const seed = (Math.random() * 4294967296) >>> 0; // 판마다 다른 한 주(날씨·손님)
    return {
      seed,
      game: B.sim.createGame(seed),
      log: store.log, // 지난 판들의 손님 기록(이어서 쌓인다)
      plan: { loaf: 2, croissant: 2, cake: 1 }, // 굽는 판 수 초깃값. 이후에는 어제 계획을 그대로 이어받는다
      baked: null, // 오늘 밤 구운 결과 요약
      report: null, // 오늘 영업 결과(장부)
    };
  };
})();

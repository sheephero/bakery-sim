// 최고 기록과 손님 기록을 브라우저(localStorage)에 저장한다.
// 저장소를 못 쓰는 환경(시크릿 모드, 차단 등)에서도 게임은 멈추지 않고, 그 판 동안만 메모리에 기억한다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  const KEY = 'bakery-sim.v1';
  let memory = { best: null, log: { records: [] } }; // 저장소가 막힌 경우를 위한 임시 보관함

  function read() {
    try {
      const raw = globalThis.localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && data.log && Array.isArray(data.log.records) ? data : null; // 모양이 이상하면 무시
    } catch (e) {
      return null; // 저장소 접근 자체가 막힌 경우
    }
  }
  function write(data) {
    try {
      globalThis.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  B.storage = {
    load() {
      const data = read();
      if (data) memory = data;
      return memory;
    },
    // 최고 기록(순이익)이 갱신되면 true
    saveBest(profit) {
      const cur = B.storage.load();
      if (cur.best !== null && profit <= cur.best) return false;
      memory = { ...cur, best: profit };
      write(memory);
      return true;
    },
    // 기타 값 저장(예: 튜토리얼을 마쳤는지)
    patch(obj) {
      memory = { ...B.storage.load(), ...obj };
      write(memory);
    },
    saveLog(log) {
      const cur = B.storage.load();
      memory = { ...cur, log };
      write(memory);
    },
  };
})();

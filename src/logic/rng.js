// 시드 난수(seeded random): 같은 씨앗(seed) 숫자면 항상 같은 순서의 난수가 나온다.
// → 같은 판을 재현하거나, 봇끼리 같은 조건에서 공정하게 비교할 수 있다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});

  // mulberry32: 짧고 빠른 난수 생성 알고리즘
  function create(seed) {
    let a = seed >>> 0;
    function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // 0 이상 1 미만
    }
    return {
      next,
      range: (lo, hi) => lo + (hi - lo) * next(),
      chance: (p) => next() < p,
      // 가중치(weight)에 비례해 하나를 고른다
      weighted(items, weightOf) {
        const total = items.reduce((s, it) => s + weightOf(it), 0);
        let r = next() * total;
        for (const it of items) {
          r -= weightOf(it);
          if (r < 0) return it;
        }
        return items[items.length - 1];
      },
    };
  }

  // 게임 씨앗 + 용도 번호(stream)를 섞어, 서로 영향을 주지 않는 난수 흐름을 만든다
  // 예: 날씨용(1), 각 날짜 손님용(100+날짜), 봇 타이밍용(999)
  function derive(seed, stream) {
    let h = (seed ^ Math.imul(stream + 1, 0x9e3779b1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return create((h ^ (h >>> 16)) >>> 0);
  }

  B.rng = { create, derive };
  if (typeof module !== 'undefined' && module.exports) module.exports = B.rng;
})();

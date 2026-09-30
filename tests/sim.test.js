// 게임 규칙 테스트. 실행: node tests/sim.test.js  (패키지 설치 없음, Node 내장 assert 사용)
const assert = require('node:assert/strict');
const B = globalThis.Bakery = globalThis.Bakery || {};
require('../src/logic/sim.js');
require('../src/logic/log.js');
require('../src/logic/report.js');
const { sim, config: cfg } = B;

let passed = 0;
let failed = 0;
function t(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '\n      ' + e.message.split('\n')[0]);
  }
}

console.log('가격·굽기');
t('가격: 프리미엄 +20%, 하루 지난 빵 30% 할인', () => {
  const loaf = sim.breadOf('loaf');
  assert.equal(sim.priceOf(loaf, 'fresh'), 3000);
  assert.equal(sim.priceOf(loaf, 'freshP'), 3600);
  assert.equal(sim.priceOf(loaf, 'old'), 2100);
  assert.equal(sim.priceOf(loaf, 'oldP'), 2520);
});
t('첫날은 밤에서 시작하고 시작 자금이 있다', () => {
  const g = sim.createGame(1);
  assert.equal(g.phase, 'night');
  assert.equal(g.day, 0);
  assert.equal(g.money, cfg.startMoney);
});
t('굽기: 재료비가 즉시 나가고 결과별로 재고가 늘어난다', () => {
  const g = sim.createGame(1);
  const loaf = sim.breadOf('loaf');
  sim.bakeBatch(g, 'loaf', 'good');
  sim.bakeBatch(g, 'loaf', 'perfect');
  sim.bakeBatch(g, 'loaf', 'burnt');
  assert.equal(g.money, cfg.startMoney - 3 * sim.batchCost(loaf));
  assert.equal(g.stock.loaf.fresh, loaf.batchSize);
  assert.equal(g.stock.loaf.freshP, loaf.batchSize);
  assert.equal(g.tonight.burntCost, sim.batchCost(loaf));
});
t('굽기: 재료비가 모자라면 구울 수 없다', () => {
  const g = sim.createGame(1);
  g.money = sim.batchCost(sim.breadOf('loaf')) - 1;
  const r = sim.bakeBatch(g, 'loaf', 'good');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'money');
});

console.log('날씨·손님');
t('같은 씨앗이면 같은 한 주, 다른 씨앗이면 다른 한 주', () => {
  const a = sim.createGame(7).week;
  const b = sim.createGame(7).week;
  const c = sim.createGame(8).week;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});
t('무엇을 굽든 그날 오는 손님은 같다 (공정한 비교)', () => {
  const g1 = sim.createGame(3);
  const g2 = sim.createGame(3);
  sim.bakeBatch(g2, 'cake', 'good');
  assert.deepEqual(sim.generateCustomers(g1, 0), sim.generateCustomers(g2, 0));
});
t('예보는 대체로 맞고 가끔 틀린다 (수천 일 표본)', () => {
  let hit = 0;
  let n = 0;
  for (let s = 0; s < 500; s++) {
    for (const d of sim.createGame(s).week) {
      n++;
      if (d.forecast.weather === d.weather) hit++;
    }
  }
  const rate = hit / n;
  assert.ok(rate > cfg.forecastAccuracy - 0.05 && rate < cfg.forecastAccuracy + 0.05, '적중률 ' + rate.toFixed(3));
});

console.log('하루 진행');
t('빵이 하나도 없으면 손님은 전부 빈손으로 나간다', () => {
  const g = sim.createGame(5);
  const r = sim.openShop(g);
  assert.equal(r.revenue, 0);
  assert.equal(r.missedCustomers, r.arrivals);
});
t('장부가 맞는다: 매출 = 빵별 매출 합, 오늘의 순이익 = 매출 − 재료비', () => {
  const g = sim.createGame(5);
  for (const b of cfg.breads) sim.bakeBatch(g, b.id, 'good');
  const r = sim.openShop(g);
  const byBread = Object.values(r.revenueByBread).reduce((s, v) => s + v, 0);
  assert.equal(r.revenue, byBread);
  assert.equal(r.profit, r.revenue - r.bakeCost);
  assert.equal(g.money, cfg.startMoney - r.bakeCost + r.revenue);
});
t('새 빵이 남으면 다음 날 할인 빵이 되고, 그날 못 팔면 버려진다', () => {
  const g = sim.createGame(5);
  for (let i = 0; i < 10; i++) sim.bakeBatch(g, 'loaf', 'good'); // 식빵 80개 (재고 많이)
  const day0 = sim.openShop(g);
  const left = day0.leftover.loaf;
  assert.ok(left > 0, '남은 빵이 있어야 이 테스트가 의미 있다');
  assert.equal(g.stock.loaf.old, left); // 남은 새 빵 → 할인 빵
  assert.equal(g.stock.loaf.fresh, 0);
  sim.nextNight(g);
  const day1 = sim.openShop(g); // 이 날은 아무것도 안 굽는다
  assert.equal(day1.soldUnits.loaf + day1.wasteUnits.loaf, left); // 할인 빵은 팔리거나 버려진다
  assert.equal(g.stock.loaf.old, 0);
  assert.equal(g.stock.loaf.fresh + g.stock.loaf.freshP, 0);
});
t('빵 수 보존: 구운 개수 = 판 개수 + 버린 개수 + 마지막에 남은 개수', () => {
  const g = sim.createGame(11);
  let baked = 0;
  while (!g.over) {
    for (const b of cfg.breads) if (sim.bakeBatch(g, b.id, 'good').ok) baked += b.batchSize;
    sim.openShop(g);
    sim.nextNight(g);
  }
  let sold = 0;
  let waste = 0;
  for (const r of g.reports) {
    for (const b of cfg.breads) {
      sold += r.soldUnits[b.id];
      waste += r.wasteUnits[b.id];
    }
  }
  const finalLeft = sim.stockTotal(g); // 7일째 저녁에 남은 (할인 빵이 될 뻔한) 빵
  assert.equal(baked, sold + waste + finalLeft);
});

console.log('진열장 구역 (일반 / 프리미엄 / 할인)');
// 진열장을 직접 꾸며 놓고 손님 한 명만 응대해 보는 도우미
function serveOne(zone, stock, rSwitch = 0.99) {
  const g = sim.createGame(1);
  g.stock.loaf = { fresh: 0, freshP: 0, old: 0, oldP: 0, ...stock };
  const cust = { want: 'loaf', qty: 1, zone, rSwitch, rSub: 0.99, rSubPick: 0 };
  return sim.serveCustomer(g, cust);
}
t('일반 손님은 일반 칸 빵을 산다 (프리미엄이 있어도)', () => {
  const r = serveOne('regular', { fresh: 1, freshP: 1 });
  assert.equal(r.bought[0].slot, 'fresh');
});
t('프리미엄 손님은 프리미엄존 빵을 먼저 산다', () => {
  const r = serveOne('premium', { fresh: 1, freshP: 1 });
  assert.equal(r.bought[0].slot, 'freshP');
  assert.equal(r.bought[0].price, 3600);
});
t('할인 손님은 할인존 빵을 산다 (새 빵이 있어도)', () => {
  const r = serveOne('discount', { fresh: 1, old: 1 });
  assert.equal(r.bought[0].slot, 'old');
  assert.equal(r.bought[0].price, 2100);
});
t('원하는 구역이 비면: 마음이 안 바뀌는 손님은 그냥 나간다', () => {
  const r = serveOne('regular', { freshP: 1, old: 1 }, 0.99); // 일반 칸이 비었고 rSwitch가 높다
  assert.equal(r.outcome, 'left');
});
t('원하는 구역이 비면: 마음이 바뀌는 일반 손님은 할인존 → 프리미엄존 순으로 산다', () => {
  const r = serveOne('regular', { freshP: 1, old: 1 }, 0.1);
  assert.equal(r.bought[0].slot, 'old');
  const r2 = serveOne('regular', { freshP: 1 }, 0.1);
  assert.equal(r2.bought[0].slot, 'freshP');
});

console.log('게임 종료');
t('7일이 지나면 finished로 끝난다', () => {
  const g = sim.createGame(2);
  for (let d = 0; d < cfg.days; d++) {
    for (const b of cfg.breads) sim.bakeBatch(g, b.id, 'good');
    sim.openShop(g);
    sim.nextNight(g);
  }
  assert.equal(g.over, true);
  assert.equal(g.overReason, 'finished');
  assert.equal(g.reports.length, cfg.days);
});
t('팔 빵도 없고 가장 싼 한 판도 못 구우면 파산(게임 오버)', () => {
  const g = sim.createGame(2);
  g.money = 0;
  sim.openShop(g);
  sim.nextNight(g);
  assert.equal(g.over, true);
  assert.equal(g.overReason, 'bankrupt');
});
t('돈이 조금 남았어도 빵이 있으면 파산이 아니다', () => {
  const g = sim.createGame(2);
  g.money = sim.batchCost(sim.breadOf('loaf'));
  sim.bakeBatch(g, 'loaf', 'good'); // 돈 0, 빵 8개
  sim.openShop(g);
  g.money = 0;
  g.stock.loaf.old = 3; // 내일 팔 빵이 남아 있음
  sim.nextNight(g);
  assert.equal(g.over, false);
});

console.log('\n결과: ' + passed + '개 통과, ' + failed + '개 실패');
process.exit(failed ? 1 : 0);

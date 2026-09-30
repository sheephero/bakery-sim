// "배울수록 점수가 오른다"를 확인하는 테스트. 실행: node tests/learn.test.js
// 같은 씨앗(같은 날씨·손님)에서 봇끼리 직접 비교한다.
const assert = require('node:assert/strict');
const B = globalThis.Bakery = globalThis.Bakery || {};
require('../src/bots/bots.js');
const { bots, log: L } = B;

const N = 400;
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

// 지난 판 기록을 미리 쌓아 둔 log
function warm(priorGames, salt) {
  const log = L.createLog();
  for (let k = 0; k < priorGames; k++) bots.playGame(bots.hunch, 5000000 + salt * 1000 + k, { log });
  return log;
}

// 봇별 점수를 같은 씨앗 N개로 모은다
function scores(makeOpts, bot) {
  const out = [];
  for (let s = 1; s <= N; s++) out.push(bots.playGame(bot, s, makeOpts(s)).report.profit);
  return out;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const winRate = (a, b) => a.filter((v, i) => v > b[i]).length / a.length;

const plain = () => ({});
const reckless = scores(plain, bots.reckless);
const hunch = scores(plain, bots.hunch);
const informed = (k) => scores((s) => ({ log: warm(k, s % 20) }), bots.makeInformed(0));
const inf0 = informed(0);
const inf3 = informed(3);
const inf10 = informed(10);

console.log('점수 순서 (평균)');
t('무작정 < 감으로', () => assert.ok(mean(reckless) < mean(hunch), mean(reckless) + ' vs ' + mean(hunch)));
t('감으로 < 기록 참고(지난 10판)', () => assert.ok(mean(hunch) < mean(inf10), mean(hunch) + ' vs ' + mean(inf10)));

console.log('배울수록 오른다 (기록이 쌓일수록 기록 참고 봇의 점수)');
t('기록 3일치 < 지난 3판 < 지난 10판', () => {
  assert.ok(mean(inf0) < mean(inf3), '0판 ' + mean(inf0) + ' vs 3판 ' + mean(inf3));
  assert.ok(mean(inf3) < mean(inf10), '3판 ' + mean(inf3) + ' vs 10판 ' + mean(inf10));
});

console.log('같은 한 주에서 직접 비교 (운이 아니라 실력 차이인지)');
t('기록 참고(지난 10판)가 무작정보다 70% 이상의 주에서 이긴다', () => {
  const w = winRate(inf10, reckless);
  assert.ok(w >= 0.7, '승률 ' + (w * 100).toFixed(0) + '%');
});
t('기록 참고(지난 10판)가 감으로보다 60% 이상의 주에서 이긴다', () => {
  const w = winRate(inf10, hunch);
  assert.ok(w >= 0.6, '승률 ' + (w * 100).toFixed(0) + '%');
});

console.log('예상 정확도 (기록에서 규칙을 제대로 찾는지)');
t('기록이 많을수록 요일·날씨 계수 예측 오차가 줄어든다', () => {
  const err = (k) => {
    let sum = 0;
    let n = 0;
    for (let s = 1; s <= 100; s++) {
      const log = warm(k, s % 20);
      const g = B.sim.createGame(900000 + s);
      for (let d = 0; d < B.config.days; d++) {
        const p = L.predictCustomers(log, { weekday: d, weather: g.week[d].weather, event: g.week[d].event });
        if (p == null) continue;
        const actual = B.sim.generateCustomers(g, d).length;
        sum += Math.abs(p - actual) / actual;
        n++;
      }
    }
    return sum / n;
  };
  const e1 = err(1);
  const e10 = err(10);
  assert.ok(e10 < e1, '1판 오차 ' + e1.toFixed(3) + ' → 10판 오차 ' + e10.toFixed(3));
});

console.log('\n결과: ' + passed + '개 통과, ' + failed + '개 실패');
process.exit(failed ? 1 : 0);

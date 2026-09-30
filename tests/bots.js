// 봇 시뮬레이션: 봇별로 수천 판을 돌려 게임 균형을 숫자로 확인한다.
// 실행: node tests/bots.js [판 수]   (기본 2000판)
const B = globalThis.Bakery = globalThis.Bakery || {};
require('../src/bots/bots.js');
const { bots, log: L, config: cfg } = B;

const GAMES = Number(process.argv[2]) || 2000;
const won = (n) => Math.round(n / 1000).toLocaleString('ko-KR') + 'k'; // 천 원 단위 표기

function stats(values) {
  const s = [...values].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { mean, sd, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
}

// 지난 판들의 기록을 미리 쌓아 둔 log를 만든다 (판 사이 학습을 흉내)
function warmLog(priorGames, salt) {
  const log = L.createLog();
  for (let k = 0; k < priorGames; k++) bots.playGame(bots.hunch, 5000000 + salt * 1000 + k, { log });
  return log;
}
const cloneLog = (log) => ({ records: log.records.map((r) => ({ ...r })) });

function run(label, bot, priorGames) {
  const profits = [];
  let bankrupt = 0;
  let waste = 0;
  let missed = 0;
  let burnt = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    const opts = priorGames == null ? {} : { log: cloneLog(warmLog(priorGames, seed % 20)) };
    const { report } = bots.playGame(bot, seed, opts);
    profits.push(report.profit);
    if (report.bankrupt) bankrupt++;
    waste += report.totals.wasteCost;
    missed += report.totals.missedRevenue;
    burnt += report.totals.burntCost;
  }
  const s = stats(profits);
  console.log(
    label.padEnd(22) +
      ('평균 ' + won(s.mean)).padEnd(14) +
      ('편차 ' + won(s.sd)).padEnd(13) +
      ('하위10% ' + won(s.p10)).padEnd(17) +
      ('상위10% ' + won(s.p90)).padEnd(17) +
      ('파산 ' + ((bankrupt / GAMES) * 100).toFixed(1) + '%').padEnd(11) +
      ('버림 ' + won(waste / GAMES)).padEnd(11) +
      ('놓침 ' + won(missed / GAMES)).padEnd(11) +
      ('탐 ' + won(burnt / GAMES))
  );
  return s;
}

console.log('봇 시뮬레이션 — ' + GAMES + '판씩, 시작 자금 ' + won(cfg.startMoney) + ', 점수 = 7일 순이익');
console.log('(버림·놓침·탐은 한 판 평균 금액)\n');
run('무작정', bots.reckless);
run('감으로', bots.hunch);
run('기록 참고 (기록 3일치)', bots.makeInformed(0), 0);
run('기록 참고 (지난 1판)', bots.makeInformed(0), 1);
run('기록 참고 (지난 3판)', bots.makeInformed(0), 3);
run('기록 참고 (지난 10판)', bots.makeInformed(0), 10);
run('기준(공식을 아는 봇)', bots.makeOracle(0));

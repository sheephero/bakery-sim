// 결과 분석: 7일이 끝난(또는 파산한) 판을 요약한다. 결과 화면이 이 숫자를 쉬운 말로 보여준다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  if (typeof require === 'function') {
    require('./config.js');
    require('./sim.js');
  }

  function gradeOf(profit) {
    return B.config.grades.find((g) => profit >= g.min).grade;
  }

  function buildReport(game) {
    const days = game.reports;
    const sum = (f) => days.reduce((s, d) => s + f(d), 0);
    const profit = B.sim.profitOf(game);

    const totals = {
      revenue: sum((d) => d.revenue),
      bakeCost: sum((d) => d.bakeCost),
      wasteCost: sum((d) => d.wasteCost), // 하루 지나 버린 빵의 재료비
      burntCost: sum((d) => d.burntCost), // 탄 판의 재료비
      missedRevenue: sum((d) => d.missedRevenue), // 못 팔아서 놓친 매출
      missedCustomers: sum((d) => d.missedCustomers),
      arrivals: sum((d) => d.arrivals),
      perfect: sum((d) => d.perfect),
      good: sum((d) => d.good),
      burnt: sum((d) => d.burnt),
    };

    // 가장 아쉬웠던 날 = 놓친 매출 + 버린 빵 + 탄 빵 손해가 가장 큰 날
    const lossOf = (d) => d.missedRevenue + d.wasteCost + d.burntCost;
    let worstDay = null;
    let bestDay = null;
    for (const d of days) {
      if (!worstDay || lossOf(d) > lossOf(worstDay)) worstDay = d;
      if (!bestDay || d.profit > bestDay.profit) bestDay = d;
    }

    // 가장 많이 번 빵
    const byBread = {};
    for (const b of B.config.breads) byBread[b.id] = sum((d) => d.revenueByBread[b.id]);
    const topBread = Object.keys(byBread).sort((a, b) => byBread[b] - byBread[a])[0];

    return {
      finished: game.overReason === 'finished',
      bankrupt: game.overReason === 'bankrupt',
      daysPlayed: days.length,
      profit,
      finalMoney: game.money,
      grade: gradeOf(profit),
      totals,
      worstDay: worstDay && { day: worstDay.day, loss: lossOf(worstDay), missedRevenue: worstDay.missedRevenue, wasteCost: worstDay.wasteCost, burntCost: worstDay.burntCost },
      bestDay: bestDay && { day: bestDay.day, profit: bestDay.profit },
      topBread,
      byBread,
    };
  }

  B.report = { buildReport, gradeOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = B.report;
})();

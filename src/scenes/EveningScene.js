// 저녁 정산: 오늘의 장부를 한 줄씩 보여 준다. 여기서 손님 기록이 장부실에 쌓인다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  const { ui, strings: S } = B;
  const cfg = B.config;

  B.EveningScene = class EveningScene extends Phaser.Scene {
    constructor() {
      super('Evening');
    }

    create() {
      const s = B.session;
      const game = s.game;
      const r = s.report;
      ui.fadeIn(this);
      B.sfx.music('night');
      B.sfx.play(r.profit >= 0 ? 'good' : 'sad'); // 번 날은 밝은 소리, 잃은 날은 아쉬운 소리

      // 오늘 온 손님 기록을 장부실에 쌓고 저장한다 (다음 판에서도 볼 수 있다)
      B.log.addRecord(s.log, r);
      B.storage.saveLog(s.log);

      this.add.image(0, 0, 'bg_night').setOrigin(0, 0);
      new ui.Case(this).set(ui.viewStock(game)); // 남은 빵은 이제 할인존에 있다
      new ui.Hud(this, game.money);

      const X0 = 54; // 판 안쪽 왼쪽 여백
      const X1 = 266; // 판 안쪽 오른쪽 끝
      ui.panel(this, 40, 22, 240, 138);
      const objs = [];
      objs.push(ui.text(this, X0, 28, S.evening(S.weekday[r.day]), { size: 9 }));

      const money = (y, label, value, color) => {
        objs.push(ui.text(this, X0, y, label, { size: 9 }));
        objs.push(ui.text(this, X1, y, value, { size: 9, color, ox: 1 }));
      };
      money(42, S.revenue, S.sign(r.revenue), 'gr2');
      money(54, S.cost, S.sign(-r.bakeCost), 'pk3');
      const g = this.add.graphics();
      g.fillStyle(ui.num('wl3')).fillRect(X0, 68, X1 - X0, 1);
      objs.push(g);
      objs.push(ui.text(this, X0, 74, S.profit, { size: 9 }));
      objs.push(ui.text(this, X1, 72, S.sign(r.profit), { size: 11, color: r.profit >= 0 ? 'gr2' : 'rd', ox: 1 }));

      // 자세한 내용 (네 줄)
      const wasteUnits = cfg.breads.reduce((n, b) => n + r.wasteUnits[b.id], 0);
      const leftover = cfg.breads.reduce((n, b) => n + r.leftover[b.id], 0);
      const hit = r.forecast.weather === r.weather && (r.forecast.event || null) === (r.event || null);
      const actual = B.weather.getWeather(r.weather).name + (r.event ? ' · ' + B.weather.getEvent(r.event).name : '');
      const lines = [
        [S.customers(r.arrivals, r.missedCustomers) + ' · ' + S.missedRevenue(r.missedRevenue), 'rd'],
        [S.wasted(wasteUnits, r.wasteCost) + ' · ' + S.burnt(r.burnt, r.burntCost), 'pk3'],
        [S.perfectCount(r.perfect) + ' · ' + S.leftover(leftover), 'gr2'],
        [(hit ? S.forecastHit : S.forecastMiss) + ' (' + actual + ')', 'wd2'],
      ];
      lines.forEach(([t, c], i) => objs.push(ui.text(this, X0, 92 + i * 12, t, { size: 7, color: c, wrap: X1 - X0 })));

      // 한 줄씩 나타나는 연출
      objs.forEach((o) => o.setAlpha(0));
      objs.forEach((o, i) => this.tweens.add({ targets: o, alpha: 1, duration: 160, delay: 70 * i }));

      const last = game.day + 1 >= cfg.days;
      ui.text(this, 160, 142, last ? S.showResult : S.nextNight, { size: 9, color: 'ol', ox: 0.5 });

      ui.onKeys(this, ['ENTER', 'SPACE'], () => {
        B.sim.nextNight(game); // 다음 날로 (7일이 끝났거나 파산이면 게임 종료)
        if (!game.over) this.scene.start('Night');
        else if (game.overReason === 'bankrupt') this.scene.start('GameOver');
        else this.scene.start('Result');
      });
    }
  };
})();

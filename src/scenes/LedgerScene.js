// 장부실: 지금까지 쌓인 손님 기록을 그래프와 평균으로 보여준다. 밤 화면 위에 겹쳐서 열린다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  const { ui, strings: S } = B;
  const cfg = B.config;

  const WEATHER_COLOR = { sunny: 'gd', cloudy: 'gl2', rain: 'nt3' };

  B.LedgerScene = class LedgerScene extends Phaser.Scene {
    constructor() {
      super('Ledger');
    }

    create() {
      const s = B.session;
      s.overlay = true;
      const log = s.log;
      const st = B.log.stats(log);

      ui.dim(this, 0.75);
      ui.panel(this, 6, 6, 308, 168);
      ui.text(this, 16, 12, S.ledger, { size: 9 });
      ui.text(this, 304, 14, S.ledgerDays(st.days), { size: 7, color: 'wd2', ox: 1 });

      if (st.days === 0) {
        ui.text(this, 160, 88, S.ledgerEmpty, { color: 'wd2', ox: 0.5, oy: 0.5 });
      } else {
        this.drawChart(log);
        this.drawTables(st);
      }
      this.drawTomorrow(s, log);
      ui.text(this, 160, 162, S.closeKeys, { size: 7, color: 'wd2', ox: 0.5 });

      const close = () => {
        this.scene.stop();
        setTimeout(() => (s.overlay = false), 80); // 같은 키가 아래 화면에 전달되는 동안은 잠가 둔다
      };
      ui.onKeys(this, ['L', 'ESC', 'ENTER', 'SPACE'], close);
    }

    // 최근 손님 수 막대그래프 (날씨별 색). 막대 아래에 요일 글자
    drawChart(log) {
      const recs = log.records.slice(-21);
      const X0 = 16;
      const Y1 = 84; // 그래프 바닥
      const H = 44;
      const slot = 14; // 막대 하나가 차지하는 폭
      const max = Math.max(60, ...recs.map((r) => r.customers));
      const g = this.add.graphics();
      g.fillStyle(ui.num('wl2')).fillRect(X0 - 2, Y1 - H - 2, slot * 21 + 4, H + 4);
      recs.forEach((r, i) => {
        const h = Math.max(1, Math.round((r.customers / max) * H));
        g.fillStyle(ui.num(WEATHER_COLOR[r.weather] || 'gd')).fillRect(X0 + i * slot, Y1 - h, slot - 3, h);
        if (r.event) g.fillStyle(ui.num('rd')).fillRect(X0 + i * slot, Y1 - h - 2, slot - 3, 2); // 소식이 있던 날은 빨간 띠
        ui.text(this, X0 + i * slot + (slot - 3) / 2, Y1 + 2, cfg.weekdays[r.weekday], { size: 7, color: 'wd2', ox: 0.5 });
      });
      // 범례(날씨 색)
      let lx = 16;
      for (const w of cfg.weather) {
        g.fillStyle(ui.num(WEATHER_COLOR[w.id])).fillRect(lx, 28, 6, 6);
        ui.text(this, lx + 9, 27, w.name, { size: 7, color: 'wd2' });
        lx += 44;
      }
      g.fillStyle(ui.num('rd')).fillRect(lx, 28, 6, 2);
      ui.text(this, lx + 9, 27, '소식 있던 날', { size: 7, color: 'wd2' });
    }

    drawTables(st) {
      const row = (y, label, parts) => {
        ui.text(this, 16, y + 1, label, { size: 7, color: 'wd2' });
        ui.text(this, 84, y, parts.join('   '), { size: 7, color: 'ol' });
      };
      row(98, S.byWeather, cfg.weather.filter((w) => st.byWeather[w.id]).map((w) => w.name + ' ' + Math.round(st.byWeather[w.id].avg)));
      row(109, S.byWeekday, cfg.weekdays.map((d, i) => [d, st.byWeekday[String(i)]]).filter(([, v]) => v).map(([d, v]) => d + ' ' + Math.round(v.avg)));
      const ev = [];
      if (st.byEvent.none) ev.push(S.eventNone + ' ' + Math.round(st.byEvent.none.avg));
      for (const e of cfg.events.list) if (st.byEvent[e.id]) ev.push(e.name + ' ' + Math.round(st.byEvent[e.id].avg));
      row(120, S.byEvent, ev);
    }

    // 내일 예상 손님과 인기 빵 비율 (밤 화면에서 열었을 때만 의미가 있다)
    drawTomorrow(s, log) {
      const f = B.sim.getForecast(s.game);
      if (!f || s.game.phase !== 'night') return;
      const cond = { weekday: f.weekday, weather: f.weather, event: f.event };
      const c = B.log.predictCustomers(log, cond);
      if (c === null) return;
      ui.text(this, 16, 134, S.tomorrow(Math.round(c)), { size: 9, color: 'rd' });
      const sh = B.log.predictShares(log, cond);
      const txt = cfg.breads.map((b) => b.name + ' ' + Math.round(sh[b.id] * 100) + '%').join('  ');
      ui.text(this, 16, 148, S.popularity, { size: 7, color: 'wd2' });
      ui.text(this, 84, 147, txt, { size: 7, color: 'ol' });
    }
  };
})();

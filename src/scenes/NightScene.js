// 밤 화면(영업 준비): 예보와 기록을 보고 빵별로 몇 판 구울지 정하고, 타이밍 조작으로 굽는다.
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  const { ui, strings: S, layout: L } = B;
  const cfg = B.config;

  const CURSOR_SPEED = 150; // 타이밍 바 위 커서 속도(px/초)
  const TRACK_X = L.BAKE.bar.x + 2; // 바 트랙의 왼쪽 x
  const TRACK_W = L.TIMING.trackWidth;

  // 커서 위치(트랙 안 오프셋)가 어느 구간인지 → 굽기 결과
  function qualityAt(offset) {
    let x = 0;
    for (const z of L.TIMING.zones) {
      x += z.w;
      if (offset < x) return z.quality;
    }
    return L.TIMING.zones[L.TIMING.zones.length - 1].quality;
  }
  const QUALITY_COLOR = { perfect: 'gd', good: 'white', burnt: 'rd' }; // 어두운 오븐 입구 위에서 잘 보이는 색

  B.NightScene = class NightScene extends Phaser.Scene {
    constructor() {
      super('Night');
    }

    create() {
      const s = (this.s = B.session);
      const game = s.game;
      this.state = 'plan'; // plan(판 수 정하기) → bake(굽는 중) → ready(가게 열기 대기)
      this.row = 0;
      s.overlay = false;
      ui.fadeIn(this);
      B.sfx.music('night');

      this.add.image(0, 0, 'bg_night').setOrigin(0, 0);
      this.case = new ui.Case(this);
      this.case.set(ui.viewStock(game)); // 어제 남은 빵은 할인존에 있다
      this.hud = new ui.Hud(this, game.money);

      this.forecast = B.sim.getForecast(game);
      this.cond = { weekday: this.forecast.weekday, weather: this.forecast.weather, event: this.forecast.event };
      this.expected = B.log.predictUnits(s.log, this.cond); // 기록으로 예상한 빵별 판매량 (기록이 적으면 null)

      this.clampPlan();
      this.buildInfo();
      this.buildPlan();
      this.buildBake();

      ui.onKeys(this, ['UP'], () => this.move(-1));
      ui.onKeys(this, ['DOWN'], () => this.move(1));
      ui.onKeys(this, ['LEFT'], () => this.change(-1));
      ui.onKeys(this, ['RIGHT'], () => this.change(1));
      ui.onKeys(this, ['ENTER'], () => this.confirm());
      ui.onKeys(this, ['SPACE'], () => this.stopCursor());
      ui.onKeys(this, ['A'], () => this.autoBake());
      ui.onKeys(this, ['L'], () => this.openLedger());
      ui.onKeys(this, ['ESC'], () => {
        if (this.blocked()) return;
        if (this.state === 'plan') this.scene.start('Title');
      });
      this.refresh();
      // 첫 판의 첫 이틀 밤에만 튜토리얼
      if (game.day === 0) B.tutorial(this, 'night1');
      else if (game.day === 1) B.tutorial(this, 'night2');
    }

    blocked() {
      return this.s.overlay; // 장부실이 열려 있으면 이 화면의 키는 잠시 무시
    }

    // ── 화면 만들기 ──────────────────────────────────────────
    // 왼쪽 아래: 오늘 밤 정보(요일, 예보, 예상 손님)
    buildInfo() {
      const f = this.forecast;
      ui.panel(this, 4, 63, 106, 55);
      ui.text(this, 10, 67, S.nightHeader(S.weekday[this.s.game.day], this.s.game.day, cfg.days), { size: 7, color: 'wd2' });
      ui.text(this, 10, 79, S.forecast, { size: 7, color: 'wd2' });
      this.add.image(54, 77, 'icon_weather', S.weatherIconFrame[f.weather]).setOrigin(0, 0);
      ui.text(this, 72, 78, B.weather.getWeather(f.weather).name, { size: 9 });
      const ev = B.weather.getEvent(f.event);
      ui.text(this, 10, 92, ev ? S.forecastEvent(ev.name) : S.forecastNone, { size: 7, color: ev ? 'rd' : 'wd2' });
      const c = B.log.predictCustomers(this.s.log, this.cond);
      ui.text(this, 10, 104, c === null ? S.noRecord : S.expectedCustomers(Math.round(c)), { size: 7, color: 'ol' });
    }

    // 오른쪽 큰 판: 굽는 판 수 정하기
    buildPlan() {
      const P = L.BAKE.panel;
      this.panelGfx = ui.panel(this, P.x, P.y, P.w, P.h);
      this.headerText = ui.text(this, P.x + 8, P.y + 5, S.askBatches);
      this.keysText = ui.text(this, P.x + P.w - 7, P.y + 7, S.keysPlan, { size: 7, color: 'wd2', ox: 1 }); // 단축키 안내(모드마다 바뀐다)
      this.highlight = this.add.graphics();

      this.planObjs = [];
      this.rows = cfg.breads.map((b, i) => {
        const y = P.y + 17 + i * 22;
        const o = {
          icon: this.add.image(P.x + 6, y + 2, 'bread_' + b.id).setOrigin(0, 0),
          name: ui.text(this, P.x + 26, y, b.name),
          cost: ui.text(this, P.x + 26, y + 11, S.perBatch(b.unitCost * b.batchSize) + ' · ' + S.unitsPerBatch(b.batchSize), { size: 7, color: 'wd2' }),
          sel: ui.text(this, P.x + 156, y, '', { ox: 0.5 }),
          info: ui.text(this, P.x + 156, y + 11, '', { size: 7, color: 'wd2', ox: 0.5 }),
          y,
        };
        this.planObjs.push(o.icon, o.name, o.cost, o.sel, o.info);
        return o;
      });
      this.summary = ui.text(this, P.x + 8, P.y + P.h - 14, '', { size: 7, color: 'ol' });
      this.ledgerHint = ui.text(this, P.x + P.w - 7, P.y + P.h - 14, S.ledgerKey, { size: 7, color: 'wd2', ox: 1 });
      this.planObjs.push(this.summary, this.ledgerHint);
    }

    // 굽는 중 화면 요소(처음엔 숨김)
    buildBake() {
      const P = L.BAKE.panel;
      const B2 = L.BAKE;
      this.bakeObjs = [];
      this.oven = this.add.image(B2.oven.x, B2.oven.y, 'oven').setOrigin(0, 0);
      this.bar = this.add.image(B2.bar.x, B2.bar.y, 'timing_bar').setOrigin(0, 0);
      this.cursor = this.add.image(TRACK_X, B2.bar.y - 3, 'timing_cursor').setOrigin(0.5, 0);
      // "완벽!" 같은 결과 문구: 오븐 입구(어두운 부분) 위에 띄워서 다른 글자와 겹치지 않게 한다
      this.feedbackTag = ui.tag(this, B2.oven.x + 12, B2.oven.y + 20, 40, 17);
      this.feedback = ui.text(this, B2.oven.x + 32, B2.oven.y + 28, '', { size: 11, ox: 0.5, oy: 0.5 });
      this.resultTexts = cfg.breads.map((b, i) => {
        const y = P.y + 16 + i * 16;
        const icon = this.add.image(P.x + 92, y, 'bread_' + b.id).setOrigin(0, 0);
        const t = ui.text(this, P.x + 112, y + 4, '', { size: 7, color: 'ol' });
        this.bakeObjs.push(icon, t);
        return t;
      });
      this.bakeObjs.push(this.oven, this.bar, this.cursor, this.feedback, this.feedbackTag);
      this.bakeObjs.forEach((o) => o.setVisible(false));
    }

    // ── 판 수 정하기 ──────────────────────────────────────────
    batchCost(i) {
      const b = cfg.breads[i];
      return b.unitCost * b.batchSize;
    }
    planCost() {
      return cfg.breads.reduce((s, b, i) => s + this.s.plan[b.id] * this.batchCost(i), 0);
    }
    // 돈이 모자라면 아래쪽 빵부터 줄여서 계획이 늘 가능한 범위에 있게 한다
    clampPlan() {
      const plan = this.s.plan;
      for (let i = cfg.breads.length - 1; i >= 0 && this.planCost() > this.s.game.money; i--) {
        while (plan[cfg.breads[i].id] > 0 && this.planCost() > this.s.game.money) plan[cfg.breads[i].id]--;
      }
    }
    move(d) {
      if (this.blocked() || this.state !== 'plan') return;
      this.row = (this.row + d + cfg.breads.length) % cfg.breads.length;
      B.sfx.play('tick');
      this.refresh();
    }
    change(d) {
      if (this.blocked() || this.state !== 'plan') return;
      const b = cfg.breads[this.row];
      const plan = this.s.plan;
      if (d > 0 && (plan[b.id] >= cfg.maxBatchesPerBread || this.planCost() + this.batchCost(this.row) > this.s.game.money)) return; // 한도·돈
      if (d < 0 && plan[b.id] <= 0) return;
      plan[b.id] += d;
      B.sfx.play('tick');
      this.refresh();
    }
    refresh() {
      const plan = this.s.plan;
      const P = L.BAKE.panel;
      this.highlight.clear();
      this.rows.forEach((o, i) => {
        const b = cfg.breads[i];
        const n = plan[b.id];
        const selected = i === this.row && this.state === 'plan';
        o.sel.setText('< ' + n + '판 >').setColor(ui.hex(selected ? 'gd2' : 'ol'));
        const units = n * b.batchSize;
        const exp = this.expected ? Math.round(this.expected[b.id]) : null;
        o.info.setText(exp === null ? '계획 ' + units + '개' : '계획 ' + units + '개 · ' + S.expectedUnits(exp));
        if (selected) {
          this.highlight.lineStyle(1, ui.num('gd2')).strokeRect(P.x + 4, o.y - 1, P.w - 8, 22);
        }
      });
      const cost = this.planCost();
      this.summary.setText(S.planTotal(cost, this.s.game.money - cost));
    }

    // ── 굽기 시작 / 가게 열기 ───────────────────────────────────
    confirm() {
      if (this.blocked()) return;
      if (this.state === 'plan') {
        B.sfx.play('click');
        this.startBake();
      } else if (this.state === 'ready') {
        B.sfx.play('click');
        this.scene.start('Day');
      }
    }

    makeQueue() {
      const q = [];
      cfg.breads.forEach((b) => {
        for (let k = 0; k < this.s.plan[b.id]; k++) q.push(b.id);
      });
      return q;
    }
    setMode(mode) {
      const showPlan = mode === 'plan';
      this.planObjs.forEach((o) => o.setVisible(showPlan));
      this.highlight.setVisible(showPlan);
      this.bakeObjs.forEach((o) => o.setVisible(!showPlan));
      this.keysText.setText(showPlan ? S.keysPlan : S.pressSpace); // 단축키 안내를 모드에 맞게 바꾼다
      if (mode !== 'bake') {
        [this.cursor, this.bar, this.feedback, this.feedbackTag].forEach((o) => o.setVisible(false));
      } else {
        this.feedbackTag.setVisible(false); // 결과 문구는 굽기를 멈춘 뒤에만 보인다
      }
    }

    startBake() {
      this.queue = this.makeQueue();
      this.results = {};
      cfg.breads.forEach((b) => (this.results[b.id] = { perfect: 0, good: 0, burnt: 0 }));
      this.qi = 0;
      this.state = 'bake';
      this.setMode('bake');
      this.updateResults();
      if (!this.queue.length) return this.finishBake();
      this.nextBatch();
    }

    autoBake() {
      // 자동 굽기: 조작 없이 전부 "좋음"으로 굽는다 (완벽 보너스 없음)
      if (this.blocked() || this.state !== 'plan') return;
      this.queue = this.makeQueue();
      this.results = {};
      cfg.breads.forEach((b) => (this.results[b.id] = { perfect: 0, good: 0, burnt: 0 }));
      this.state = 'bake';
      this.setMode('bake');
      for (const id of this.queue) {
        if (B.sim.bakeBatch(this.s.game, id, 'good').ok) this.results[id].good++;
      }
      this.updateResults();
      this.finishBake();
    }

    nextBatch() {
      if (this.qi >= this.queue.length) return this.finishBake();
      const id = this.queue[this.qi];
      const b = B.sim.breadOf(id);
      this.headerText.setText(S.baking(b.name, this.qi + 1, this.queue.length));
      this.cursorPos = 0;
      this.dir = 1;
      this.running = true;
      this.feedback.setText('');
      this.feedbackTag.setVisible(false);
      [this.cursor, this.bar].forEach((o) => o.setVisible(true));
    }

    update(time, delta) {
      if (this.state !== 'bake' || !this.running) return;
      this.cursorPos += this.dir * CURSOR_SPEED * (delta / 1000);
      if (this.cursorPos >= TRACK_W - 1) {
        this.cursorPos = TRACK_W - 1;
        this.dir = -1;
      } else if (this.cursorPos <= 0) {
        this.cursorPos = 0;
        this.dir = 1;
      }
      this.cursor.setX(Math.round(TRACK_X + this.cursorPos));
    }

    stopCursor() {
      if (this.blocked() || this.state !== 'bake' || !this.running) return;
      this.running = false;
      const id = this.queue[this.qi];
      const quality = qualityAt(this.cursorPos);
      const r = B.sim.bakeBatch(this.s.game, id, quality);
      if (r.ok) this.results[id][quality]++;
      this.hud.setMoney(this.s.game.money);
      this.case.set(ui.viewStock(this.s.game));
      this.updateResults();
      B.sfx.play(quality); // perfect / good / burnt 마다 다른 소리
      if (quality === 'perfect') ui.burst(this, L.BAKE.oven.x + 32, L.BAKE.oven.y + 28); // 완벽하면 반짝임
      this.feedbackTag.setVisible(true);
      this.feedback.setVisible(true).setText(S.quality[quality]).setColor(ui.hex(QUALITY_COLOR[quality]));
      this.cameras.main.shake(quality === 'burnt' ? 160 : 60, quality === 'burnt' ? 0.006 : 0.002); // 탄 판은 살짝 흔들림
      this.time.delayedCall(550, () => {
        this.qi++;
        this.nextBatch();
      });
    }

    updateResults() {
      cfg.breads.forEach((b, i) => {
        const r = this.results[b.id];
        this.resultTexts[i].setText('완벽' + r.perfect + ' 좋음' + r.good + ' 탐' + r.burnt);
      });
    }

    finishBake() {
      this.state = 'ready';
      this.running = false;
      this.s.baked = this.results;
      this.headerText.setText(this.queue.length ? S.bakeDone : S.noBatches);
      [this.cursor, this.bar, this.feedback, this.feedbackTag].forEach((o) => o.setVisible(false));
      this.keysText.setText('');
      ui.text(this, L.BAKE.panel.x + 100, L.BAKE.panel.y + 82, S.openShop, { size: 9, color: 'ol', ox: 0.5 });
      this.case.set(ui.viewStock(this.s.game));
    }

    openLedger() {
      if (this.blocked() || this.state !== 'plan') return;
      this.s.overlay = true;
      this.scene.launch('Ledger');
    }
  };
})();

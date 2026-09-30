// 끝 화면 두 가지: 결과(7일 완주) / 게임 오버(파산)
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  const { ui, strings: S } = B;
  const cfg = B.config;

  const GRADE_FRAME = { S: 0, A: 1, B: 2, C: 3, D: 4 }; // grade.png 의 프레임 순서

  function restartKeys(scene) {
    ui.onKeys(scene, ['ENTER', 'SPACE'], () => {
      B.session = B.newSession();
      scene.scene.start('Night');
    });
    ui.onKeys(scene, ['ESC'], () => scene.scene.start('Title'));
  }

  B.ResultScene = class ResultScene extends Phaser.Scene {
    constructor() {
      super('Result');
    }
    create() {
      const s = B.session;
      const rep = B.report.buildReport(s.game);
      const isBest = B.storage.saveBest(rep.profit); // 최고 기록이면 저장
      const best = B.storage.load().best;
      const top = rep.grade === 'S' || rep.grade === 'A';
      ui.fadeIn(this);
      B.sfx.music('day');
      B.sfx.play(top ? 'perfect' : 'good');

      this.add.image(0, 0, 'bg_night').setOrigin(0, 0);
      ui.panel(this, 14, 2, 292, 176);
      ui.text(this, 160, 7, S.resultTitle, { size: 9, ox: 0.5 });

      // 등급 메달(직접 그린 도트를 2배로 확대) — 글꼴을 억지로 키우면 번지므로 그림을 쓴다
      this.add.sprite(30, 24, 'grade', GRADE_FRAME[rep.grade]).setOrigin(0, 0).setScale(2);
      ui.text(this, 56, 77, S.grade, { size: 7, color: 'wd2', ox: 0.5 });
      if (top) ui.burst(this, 56, 50, 10); // 높은 등급이면 반짝임

      // 순이익과 최고 기록
      ui.text(this, 100, 22, S.finalProfit, { size: 7, color: 'wd2' });
      ui.text(this, 100, 33, S.sign(rep.profit), { size: 11, color: rep.profit >= 0 ? 'gr2' : 'rd' });
      ui.text(this, 100, 50, isBest ? S.newBest : S.bestIs(best), { size: 9, color: isBest ? 'rd' : 'wd2' });

      // 이번 판 하이라이트 3줄
      const t = rep.totals;
      const highlights = [];
      if (rep.bestDay) highlights.push(S.highlightBest(S.weekday[rep.bestDay.day], rep.bestDay.profit));
      if (rep.worstDay) highlights.push(S.highlightWorst(S.weekday[rep.worstDay.day], rep.worstDay.missedRevenue, rep.worstDay.wasteCost + rep.worstDay.burntCost));
      if (rep.topBread) highlights.push(S.highlightBread(B.sim.breadOf(rep.topBread).name, rep.byBread[rep.topBread]));
      ui.text(this, 26, 90, highlights.join('\n'), { size: 7, color: 'ol', wrap: 268, lineSpacing: 3 });

      // 분석 (쉬운 말로)
      ui.text(this, 26, 126, [S.totalWaste(t.wasteCost + t.burntCost), S.totalMissed(t.missedRevenue), S.perfectTotal(t.perfect)].join('\n'), { size: 7, color: 'wd2', lineSpacing: 3 });

      ui.text(this, 160, 162, S.again + '   ' + S.toTitle, { size: 9, ox: 0.5 });
      restartKeys(this);
    }
  };

  B.GameOverScene = class GameOverScene extends Phaser.Scene {
    constructor() {
      super('GameOver');
    }
    create() {
      const s = B.session;
      const profit = B.sim.profitOf(s.game);
      ui.fadeIn(this);
      B.sfx.music('night');
      B.sfx.play('burnt');
      this.add.image(0, 0, 'bg_night').setOrigin(0, 0);
      ui.panel(this, 40, 24, 240, 124);
      ui.text(this, 160, 36, S.gameOver, { size: 11, color: 'rd', ox: 0.5 });
      ui.text(this, 160, 62, S.gameOverText.join('\n'), { size: 9, ox: 0.5, align: 'center', lineSpacing: 4 });
      ui.text(this, 160, 96, S.dayOf(s.game.day - 1, cfg.days) + ' · ' + S.sign(profit), { size: 9, color: 'wd2', ox: 0.5 });
      ui.text(this, 160, 122, S.again + '   ' + S.toTitle, { size: 9, ox: 0.5 });
      restartKeys(this);
    }
  };
})();

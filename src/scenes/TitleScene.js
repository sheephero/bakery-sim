// 타이틀 화면
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  const { ui, strings: S } = B;

  B.TitleScene = class TitleScene extends Phaser.Scene {
    constructor() {
      super('Title');
    }
    create() {
      ui.fadeIn(this);
      B.sfx.music('day');
      this.add.image(0, 0, 'bg_day').setOrigin(0, 0);
      const view = { regular: [12, 8, 5], premium: [3, 2, 1], discount: [4, 2, 2] }; // 꾸며 놓은 진열장
      new ui.Case(this).set(view);

      ui.panel(this, 60, 18, 200, 92);
      ui.text(this, 160, 30, S.title, { size: 11, ox: 0.5 });
      ui.text(this, 160, 48, S.subtitle, { color: 'wd2', ox: 0.5 });
      const store = B.storage.load();
      ui.text(this, 160, 66, S.best(store.best), { color: 'gd2', ox: 0.5 });
      ui.text(this, 160, 78, S.logDays(store.log.records.length), { size: 7, color: 'wd2', ox: 0.5 });
      const start = ui.text(this, 160, 91, S.pressStart, { color: 'ol', ox: 0.5 });
      this.tweens.add({ targets: start, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 }); // 깜빡임

      // 손님이 하나 서 있는 장식 (패널 왼쪽 바깥)
      this.add.ellipse(20 + 12, 102, 18, 4, ui.num('fl2'));
      this.add.sprite(20, 68, 'customer1', 0).setOrigin(0, 0).play('think1');
      ui.text(this, 160, 112, S.soundKeys, { size: 7, color: 'wd2', ox: 0.5 });

      ui.onKeys(this, ['ENTER', 'SPACE'], () => {
        B.sfx.play('click');
        B.session = B.newSession();
        this.scene.start('Night');
      });
    }
  };
})();

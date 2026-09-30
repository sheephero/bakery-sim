// 다른 화면 위에 겹쳐 뜨는 화면 두 가지: 소리 안내 토스트(항상 떠 있음), 튜토리얼(필요할 때만)
(function () {
  const B = (globalThis.Bakery = globalThis.Bakery || {});
  const { ui, strings: S } = B;

  // 항상 맨 위에 떠 있으면서, toast(글) 를 부르면 잠깐 안내를 보여 준다 (예: "소리 끔")
  B.OverlayScene = class OverlayScene extends Phaser.Scene {
    constructor() {
      super('Overlay');
    }
    toast(msg) {
      this.cur?.forEach((o) => o.destroy());
      const t = ui.text(this, 160, 168, msg, { size: 9, color: 'white', ox: 0.5, depth: 2 });
      const w = Math.ceil(t.displayWidth) + 12;
      const g = ui.tag(this, Math.round(160 - w / 2), 164, w, 15, 1);
      this.cur = [t, g];
      this.time.delayedCall(1400, () => {
        t.destroy();
        g.destroy();
      });
    }
  };

  // 튜토리얼: 여러 쪽짜리 말풍선 판. Enter 다음, Esc 건너뛰기(이후 다시 안 뜬다)
  B.TutorialScene = class TutorialScene extends Phaser.Scene {
    constructor() {
      super('Tutorial');
    }
    create(data) {
      const pages = S.tutorial[data.key];
      let i = 0;
      ui.dim(this, 0.55);
      ui.panel(this, 24, 30, 272, 116);
      ui.text(this, 34, 37, S.tutorialTitle, { size: 7, color: 'wd2' });
      const idx = ui.text(this, 286, 37, '', { size: 7, color: 'wd2', ox: 1 });
      const body = ui.text(this, 34, 52, '', { size: 9, lineSpacing: 5 });
      ui.text(this, 160, 132, S.tutorialKeys, { size: 7, color: 'wd2', ox: 0.5 });
      const show = () => {
        body.setText(pages[i]);
        idx.setText(i + 1 + '/' + pages.length);
      };
      show();

      const close = (skipped) => {
        if (skipped || data.key === 'night2') B.storage.patch({ tutorialDone: true }); // 끝까지 봤거나 건너뛰면 다시 안 보여 준다
        const origin = this.scene.get(data.from);
        this.scene.stop();
        // 같은 키 입력이 아래 화면에도 전달되므로, 잠깐 뒤에 "겹친 화면 열림" 표시를 지운다
        // (바로 지우면 이 Enter 를 아래 화면이 받아서 굽기 시작/하루 건너뛰기가 실행된다)
        setTimeout(() => {
          B.session.overlay = false;
          origin.events.emit('overlayclosed');
        }, 80);
      };
      ui.onKeys(this, ['ENTER', 'SPACE'], () => {
        B.sfx.play('click');
        if (++i >= pages.length) close(false);
        else show();
      });
      ui.onKeys(this, ['ESC'], () => close(true));
    }
  };

  // 튜토리얼을 띄워야 하면 띄우고 true 를 돌려준다 (이미 마쳤거나, 이번 판에서 이미 본 것이면 false)
  B.tutorial = function (scene, key) {
    const s = B.session;
    s.tutorialSeen = s.tutorialSeen || {};
    if (B.storage.load().tutorialDone || s.tutorialSeen[key]) return false;
    s.tutorialSeen[key] = true;
    s.overlay = true;
    scene.scene.launch('Tutorial', { from: scene.scene.key, key });
    return true;
  };
})();

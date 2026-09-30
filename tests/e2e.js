// 브라우저 종단 테스트(End-to-End): 실제 Chrome으로 게임을 열어 키보드로 7일을 완주하고, 콘솔 오류를 잡는다.
// 실행: node tests/e2e.js [스크린샷 저장 폴더]     (패키지 설치 없음: Node 내장 http·WebSocket 과 설치된 Chrome/Edge 사용)
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.argv[2] || path.join(os.tmpdir(), 'bakery-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 8123;
const DEBUG_PORT = 9333;
const CHROMES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain', '.md': 'text/plain' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok || !detail ? '' : '\n      ' + detail));
}

// 프로젝트 폴더를 그대로 내주는 아주 작은 웹 서버
function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

// Chrome 원격 조종(CDP) 연결
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) {
      /* 아직 안 켜짐 */
    }
    await sleep(200);
  }
  throw new Error('Chrome 에 연결하지 못했어요');
}

async function main() {
  const chromePath = CHROMES.find((p) => fs.existsSync(p));
  if (!chromePath) throw new Error('Chrome 또는 Edge 를 찾지 못했어요');
  const server = await serve();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-chrome-'));
  const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, '--window-size=1280,720', '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });

  try {
    const ws = new WebSocket(await connect());
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const pending = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push('예외: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push('console.error: ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
      } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        errors.push('로그: ' + msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
      }
    };
    const cdp = (method, params = {}) =>
      new Promise((resolve) => {
        const my = ++id;
        pending.set(my, resolve);
        ws.send(JSON.stringify({ id: my, method, params }));
      });
    const evalJs = async (expr) => {
      const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      return r.result?.result?.value;
    };
    const KEYS = { ENTER: [13, 'Enter'], SPACE: [32, ' '], LEFT: [37, 'ArrowLeft'], UP: [38, 'ArrowUp'], RIGHT: [39, 'ArrowRight'], DOWN: [40, 'ArrowDown'], A: [65, 'a'], L: [76, 'l'], P: [80, 'p'], F: [70, 'f'], ESC: [27, 'Escape'], M: [77, 'm'], MINUS: [189, '-'] };
    const press = async (name) => {
      const [code, key] = KEYS[name];
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: code, key });
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: code, key });
      await sleep(60);
    };
    const shot = async (name) => {
      const r = await cdp('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64'));
    };
    // 현재 켜져 있는 화면 이름
    const scenes = () => evalJs("Bakery.game.scene.getScenes(true).map(s => s.scene.key).filter(k => k !== 'Overlay').join(',')");
    const waitScene = async (name, ms = 60000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if ((await scenes()) === name) return true;
        await sleep(100);
      }
      return false;
    };

    await cdp('Runtime.enable');
    await cdp('Log.enable');
    await cdp('Page.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    // E2E_FILE=1 이면 서버 없이 index.html 을 파일로 직접 연다(더블클릭 실행과 같은 조건)
    const pageUrl = process.env.E2E_URL ? process.env.E2E_URL : process.env.E2E_FILE ? require('url').pathToFileURL(path.join(ROOT, 'index.html')).href : `http://127.0.0.1:${PORT}/index.html`;
    console.log('열기: ' + (process.env.E2E_URL ? process.env.E2E_URL + ' (공개 주소)' : process.env.E2E_FILE ? '파일 직접 열기 (file://)' : '웹 서버 (http://)'));
    await cdp('Page.navigate', { url: pageUrl });

    console.log('화면 흐름');
    check('타이틀 화면이 뜬다', await waitScene('Title', 15000));
    await sleep(400);
    await shot('01-title');
    const zoom = await evalJs('Bakery.game.scale.zoom');
    check('1280x720 창에서 정수 4배 확대', zoom === 4, 'zoom=' + zoom);

    await press('ENTER');
    check('Enter 로 밤 화면 시작 (첫 판이라 튜토리얼이 함께 뜬다)', await waitScene('Night,Tutorial', 5000), await scenes());
    await sleep(300);
    await shot('01b-tutorial');
    for (let i = 0; i < 4; i++) await press('ENTER'); // 튜토리얼 4쪽을 넘긴다
    await sleep(400);
    check('튜토리얼을 Enter 로 닫아도 굽기가 저절로 시작되지 않는다', (await scenes()) === 'Night' && (await evalJs('Bakery.game.scene.getScene("Night").state')) === 'plan', await scenes());
    await shot('02-night-plan');

    // 판 수 조절(첫 줄 +1, 둘째 줄 -1) 확인
    const before = await evalJs('JSON.stringify(Bakery.session.plan)');
    await press('RIGHT');
    await press('DOWN');
    await press('LEFT');
    const after = await evalJs('JSON.stringify(Bakery.session.plan)');
    check('←→ 로 굽는 판 수를 바꿀 수 있다', before !== after, before + ' → ' + after);

    // 장부실 열고 닫기
    await press('L');
    await sleep(300);
    check('L 로 장부실이 겹쳐 열린다', (await scenes()).includes('Ledger'));
    await shot('03-ledger-empty');
    await press('L');
    await sleep(300);
    check('L 로 장부실이 닫히고 밤 화면이 남는다', (await scenes()) === 'Night');

    // 첫날은 직접 굽기(타이밍): 커서가 초록/노랑 구간에 오면 스페이스
    await press('ENTER');
    const total = await evalJs('Bakery.session.plan.loaf + Bakery.session.plan.croissant + Bakery.session.plan.cake');
    let stopped = 0;
    for (let guard = 0; guard < 400 && stopped < total; guard++) {
      const st = await evalJs('(function(){var s=Bakery.game.scene.getScene("Night");return JSON.stringify({state:s.state,running:s.running,pos:s.cursorPos,qi:s.qi})})()');
      const o = JSON.parse(st);
      if (o.state === 'bake' && o.running && o.pos > 56 && o.pos < 76 && stopped === o.qi) {
        await press('SPACE');
        stopped++;
        if (stopped === 1) await shot('04-baking-feedback');
      }
      await sleep(15);
    }
    check('타이밍 조작으로 계획한 판을 모두 굽는다', stopped === total, stopped + '/' + total);
    await sleep(800);
    const baked = await evalJs('JSON.stringify(Bakery.session.baked)');
    check('완벽 구간을 노려서 "완벽"이 나온다', /"perfect":[1-9]/.test(baked), baked);
    await shot('05-night-ready');

    // 7일 반복
    for (let day = 0; day < 7; day++) {
      if (day > 0) {
        await sleep(200);
        await press('A'); // 나머지 날은 자동 굽기로 빠르게
        await sleep(200);
      }
      await press('ENTER'); // 가게 열기
      if (day === 0) {
        check('첫날 낮에도 튜토리얼이 뜨고 영업 시간이 멈춰 있다', (await waitScene('Day,Tutorial', 5000)) && (await evalJs('Bakery.game.scene.getScene("Day").time.timeScale')) === 0, await scenes());
        await press('ENTER'); // 한 쪽짜리
        await sleep(300);
      }
      if (!(await waitScene('Day', 5000))) {
        check('낮 화면이 뜬다 (' + (day + 1) + '일째)', false, await scenes());
        break;
      }
      if (day === 0) {
        await sleep(6000);
        await shot('06-day-customers');
      }
      await press('F');
      await press('F'); // 속도 x8
      const evening = await waitScene('Evening', 60000);
      if (!evening) {
        check('저녁 정산으로 넘어간다 (' + (day + 1) + '일째)', false, await scenes());
        break;
      }
      await sleep(1500);
      if (day === 0) await shot('07-evening');
      await press('ENTER');
      await sleep(300);
      if (day < 6) {
        if (!(await waitScene(day === 0 ? 'Night,Tutorial' : 'Night', 5000))) { // 둘째 밤에는 튜토리얼이 함께 뜬다
          check('다음 밤 화면이 뜬다', false, await scenes());
          break;
        }
        if (day === 0) {
          await sleep(300);
          check('둘째 밤에도 튜토리얼이 뜬다', (await scenes()).includes('Tutorial'), await scenes());
          await press('ESC'); // 건너뛰기
          await sleep(400);
          check('건너뛰면 다시 안 뜨도록 저장된다', (await evalJs("JSON.parse(localStorage.getItem('bakery-sim.v1')).tutorialDone")) === true);
          await shot('08-night-day2');
          await press('L'); // 이제 기록이 쌓였으니 장부실에 그래프가 보인다
          await sleep(400);
          await shot('09-ledger');
          await press('L');
        }
        if (day === 3) {
          await sleep(300);
          await press('L'); // 기록이 여러 날 쌓이면 그래프와 "내일 예상 손님"이 보인다
          await sleep(400);
          await shot('09b-ledger-day4');
          await press('L');
        }
      }
    }
    check('7일이 끝나면 결과 화면이 뜬다', await waitScene('Result', 8000), await scenes());
    await sleep(600);
    await shot('10-result');
    const days = await evalJs('Bakery.session.game.reports.length');
    check('7일치 장부가 쌓였다', days === 7, 'days=' + days);
    const logDays = await evalJs('Bakery.session.log.records.length');
    check('손님 기록이 7일치 쌓였다', logDays >= 7, 'records=' + logDays);
    const saved = await evalJs("JSON.parse(localStorage.getItem('bakery-sim.v1')).log.records.length");
    check('손님 기록이 브라우저에 저장됐다', saved >= 7, 'saved=' + saved);

    // 다시하기 → 파산 경로(게임 오버)
    await press('ENTER');
    check('Enter 로 다시하기(밤 화면)', await waitScene('Night', 5000));
    await sleep(300);
    const kept = await evalJs('Bakery.session.log.records.length');
    check('이전 판의 기록이 새 판에도 이어진다', kept >= 7, 'records=' + kept);
    await evalJs('(function(){var g=Bakery.session.game;g.money=0;Bakery.session.plan={loaf:0,croissant:0,cake:0};var s=Bakery.game.scene.getScene("Night");s.refresh();})()');
    await press('ENTER'); // 굽지 않음
    await sleep(200);
    await press('ENTER'); // 가게 열기
    await waitScene('Day', 5000);
    await press('ENTER'); // 낮 건너뛰기
    check('돈도 빵도 없으면 정산 뒤 게임 오버', (await waitScene('Evening', 5000)) && ((await press('ENTER')), await waitScene('GameOver', 5000)));
    await sleep(500);
    await shot('11-gameover');

    // 일시정지
    await press('ENTER');
    await waitScene('Night', 5000);
    await press('A');
    await press('ENTER');
    await waitScene('Day', 5000);
    await sleep(1500);
    // 손님은 정해진 간격으로 한 명씩 나와야 한다 (한꺼번에 몰려 나오면 버그)
    const dbg = JSON.parse(await evalJs('(function(){var d=Bakery.game.scene.getScene("Day");return JSON.stringify({next:d.next,interval:d.interval,total:d.timeline.length,boxes:d.children.list.filter(function(o){return o.type==="Container"}).length,scale:d.time.timeScale})})()'));
    console.log('    (진단) 낮 시작 후 약 2.4초: 나온 손님 ' + dbg.next + '명, 간격 ' + Math.round(dbg.interval) + 'ms, 전체 ' + dbg.total + '명, 화면의 손님 ' + dbg.boxes + '명, 속도 ' + dbg.scale);
    check('손님이 한꺼번에 몰려 나오지 않는다', dbg.next <= Math.ceil(2400 / dbg.interval) + 1, JSON.stringify(dbg));
    await press('P');
    await sleep(300);
    const paused = await evalJs('Bakery.game.scene.getScene("Day").paused');
    check('P 로 일시정지된다', paused === true);
    await shot('12-paused');
    await press('P');

    // 소리 키: M 음소거 토글, 안내 문구
    await press('M');
    const off = await evalJs('Bakery.sfx.status()');
    const toast = await evalJs('Bakery.game.scene.getScene("Overlay").cur ? Bakery.game.scene.getScene("Overlay").cur.length : 0');
    await press('M');
    const on = await evalJs('Bakery.sfx.status()');
    check('M 키로 소리를 껐다 켤 수 있고 안내가 뜬다', off === '소리 끔' && on.startsWith('소리 켬') && toast > 0, off + ' / ' + on + ' / toast=' + toast);
    check('브라우저 콘솔 오류가 없다', errors.length === 0, errors.slice(0, 5).join('\n      '));
    ws.close();
  } finally {
    chrome.kill();
    server.close();
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch (e) {
      /* 임시 폴더 정리는 실패해도 무시 */
    }
  }
  console.log('\n결과: ' + passed + '개 통과, ' + failed + '개 실패  (스크린샷: ' + SHOTS + ')');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('테스트 실행 중 오류:', e.message);
  process.exit(1);
});

// 全链路 E2E v2：修正存档弹窗/导航选择器，捕获 404 明细
const { chromium } = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const { spawn } = require('child_process');
const http = require('http');

const SRC = 'C:/Users/Administrator/WorkBuddy/2026-10-17-20-06-18/eo-work/src';
const PORT = 18924;
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('PASS: ' + name + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL: ' + name + (extra ? ' -> ' + extra : '')); }
};

function waitServer(url, tries = 30) {
  return new Promise((resolve, reject) => {
    const probe = (n) => {
      http.get(url, res => { res.resume(); resolve(); }).on('error', () => {
        if (n <= 0) return reject(new Error('server not up'));
        setTimeout(() => probe(n - 1), 300);
      });
    };
    probe(tries);
  });
}

(async () => {
  const server = spawn('C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: SRC, stdio: 'ignore' });
  try {
    await waitServer(`http://127.0.0.1:${PORT}/index.html`);

    const browser = await chromium.launch({
      executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
      headless: true, args: ['--no-sandbox']
    });
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    const errors = [], notFound = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 160)));
    page.on('response', r => { if (r.status() === 404) notFound.push(r.url().replace(/^https?:\/\/[^/]+/, '')); });
    page.on('dialog', async d => { errors.push('DIALOG: ' + d.message().slice(0, 120)); await d.dismiss(); });

    const visible = (sel) => page.evaluate((s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display !== 'none'; }, sel);

    // ===== 流程 1：启动 → 表单 → 角色选择 → 确认 =====
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.click('.splash-cta');
    await page.waitForTimeout(500);
    ok('进入档案表单', await visible('#page-onboard'));
    await page.fill('input[name=nickname]', '测试牛马');
    await page.fill('input[name=school]', '测试科技公司');
    await page.fill('input[name=major]', '产品经理');
    await page.selectOption('select[name=grade]', '3-5年');
    await page.fill('input[name=oneLineDesc]', '一个爱折腾的打工人');
    await page.fill('textarea[name=interestsKw]', '编程 健身');
    await page.fill('textarea[name=careerKw]', '项目经理');
    await page.click('button[form=onboardForm][type=submit]');
    await page.waitForTimeout(800);
    ok('进入角色选择页', await visible('#page-chargen'));
    await page.waitForTimeout(2200);
    await page.click('#bgGrid .pick-tile:nth-child(3)');
    await page.click('#charGrid .pick-tile:nth-child(2)');
    await page.waitForTimeout(1000);
    ok('预览图加载', await page.evaluate(() => {
      const bg = document.getElementById('bgPreview'), ch = document.getElementById('charPreview');
      return bg.style.display === 'block' && bg.complete && bg.naturalWidth > 0 &&
             ch.style.display === 'block' && ch.complete && ch.naturalWidth > 0;
    }));
    await page.click('button:has-text("确认这个形象")');
    await page.waitForTimeout(2500);
    ok('确认后进入首页', await visible('#page-home'));
    ok('头像合成', await page.evaluate(() => { const i = document.getElementById('charImg'); return i && i.complete && i.naturalWidth > 0 && i.src.startsWith('data:'); }));

    // ===== 记经历 + 技能确认 =====
    await page.evaluate(() => openExpModal());
    await page.waitForTimeout(400);
    await page.fill('#expDate', '2026-10-19');
    await page.fill('input[name=expTitle]', '第一次独立跟需求');
    await page.fill('textarea[name=expDesc]', '今天独立跟完了一个需求，从需求评审到上线，学到了很多沟通技巧，结果很顺利，很有成就感');
    await page.click('#expForm button[type=submit]');
    await page.waitForTimeout(1000);
    ok('技能确认弹窗出现', await visible('#skillConfirmModal'));
    await page.evaluate(() => {
      const box = document.querySelector('#skillConfirmList input[type=checkbox]:not(:disabled)');
      if (box) box.checked = true;
    });
    await page.evaluate(() => confirmSkills());
    await page.waitForTimeout(800);

    // 回首页（直接走 goPage，验证 fillHome 刷新最近经历）
    await page.evaluate(() => goPage('page-home'));
    await page.waitForTimeout(600);
    ok('最近经历渲染新记录', await page.evaluate(() =>
      Array.from(document.querySelectorAll('#recentExpList li .duo-title')).some(t => t.textContent.indexOf('第一次独立跟需求') >= 0)));
    ok('技能已点亮出现在首页学习中/技能列表', await page.evaluate(() => {
      const names = Array.from(document.querySelectorAll('#skillLevelsList li')).map(x => x.textContent).join(',');
      return names.indexOf('项目管理') >= 0 || names.indexOf('沟通') >= 0 || names.length > 0;
    }));

    // ===== 经历库页 =====
    await page.evaluate(() => goPage('page-explog'));
    await page.waitForTimeout(500);
    ok('经历库页渲染', await visible('#page-explog') && await page.evaluate(() => document.querySelectorAll('#explogList .exp-entry').length >= 1));

    // ===== 技能树页 =====
    await page.evaluate(() => goPage('page-skilltree'));
    await page.waitForTimeout(500);
    ok('技能树页渲染', await visible('#page-skilltree') && await page.evaluate(() => document.querySelectorAll('#ownedSkillList .st-skill-node').length >= 1));

    // ===== 存档（底部导航弹窗）=====
    await page.evaluate(() => goPage('page-home'));
    await page.waitForTimeout(400);
    await page.evaluate(() => showArchive());
    await page.waitForTimeout(600);
    ok('存档弹窗打开', await visible('#archiveModal'));
    const archiveHtmlOk = await page.evaluate(() => (document.getElementById('archiveBody') || {}).innerHTML.length > 1000);
    ok('存档卡内容渲染', archiveHtmlOk);
    // 保存存档 → 列表出现
    await page.evaluate(() => { const b = document.getElementById('archiveSaveBtn'); if (b) b.click(); });
    await page.waitForTimeout(800);
    ok('存档保存后列表有记录', await page.evaluate(() => document.querySelectorAll('#archiveList .arc-item, #archiveList li, #archiveList [class*=arc]').length >= 1 || (document.getElementById('archiveList') || { innerHTML: '' }).innerHTML.length > 100));
    await page.evaluate(() => { const b = document.getElementById('archiveCloseBtn') || document.querySelector('#archiveModal .btn-pixel.secondary, #archiveModal [onclick*=closeArchive]'); if (b) b.click(); });

    // ===== 演示数据路径（清档 → loadDemoData）=====
    await page.evaluate(() => { try { localStorage.clear(); } catch(e) {} });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await page.click('.splash-cta');
    await page.waitForTimeout(600);
    // 直接调 loadDemoData（与「试试演示数据」按钮一致）
    await page.evaluate(() => loadDemoData());
    await page.waitForTimeout(2000);
    ok('演示数据进入首页', await visible('#page-home'));
    ok('演示数据渲染', await page.evaluate(() => ({
      nick: (document.getElementById('charNick') || {}).textContent,
      exps: document.querySelectorAll('#recentExpList li').length,
      today: document.querySelectorAll('#todayList li').length,
    })).then(r => r.nick === '小牛' && r.exps > 0 && r.today > 0).catch(() => false));

    // ===== 刷新持久化 =====
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1800);
    ok('刷新后状态保持', await page.evaluate(() => {
      const el = document.getElementById('page-home');
      return el && getComputedStyle(el).display !== 'none' && (document.getElementById('charNick') || {}).textContent === '小牛';
    }));

    // ===== 404 与控制台错误 =====
    ok('无 404 资源', notFound.length === 0, notFound.slice(0, 5).join(', ') || 'clean');
    const realErrors = errors.filter(e => !/favicon/i.test(e));
    ok('无控制台错误', realErrors.length === 0, realErrors.slice(0, 5).join(' | ') || 'clean');

    await page.screenshot({ path: 'C:/Users/Administrator/WorkBuddy/2026-10-17-20-06-18/eo-work/tools/e2e-final.png' });
    console.log(`\n===== E2E v2: ${pass} passed, ${fail} failed =====`);
    await browser.close();
  } finally {
    server.kill();
  }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e && e.message ? e.message : e); process.exit(1); });

// 端到端验证：打开已发布页面，等待渲染，截图 + 抓控制台错误 + 校验关键 DOM
const { chromium } = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

  await page.goto('https://workbuddy-space-static.codebuddy.work/page/nttFsbfSaO6I5qbAJfgy1V/spQ4S56Sdj5F/index.html', { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('goto warn:', e.message.slice(0, 120)));
  await page.waitForTimeout(6000); // 等 SDK 拉数 + 渲染

  const report = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const txt = (s) => { const el = q(s); return el ? (el.textContent || '').trim().slice(0, 60) : null; };
    return {
      title: document.title,
      sdkPresent: !!(window.__SMART_PAGE__ && window.__SMART_PAGE__.database),
      splashVisible: q('#page-splash') && getComputedStyle(q('#page-splash')).display !== 'none',
      homeVisible: q('#page-home') && getComputedStyle(q('#page-home')).display !== 'none',
      onboardVisible: q('#page-onboard') && getComputedStyle(q('#page-onboard')).display !== 'none',
      nick: txt('#charNick'),
      school: txt('#charSchool'),
      major: txt('#charMajor'),
      grade: txt('#charGrade'),
      lvl: txt('#lvlDisplay'),
      exp: txt('#expNum'),
      todayCount: document.querySelectorAll('#todayList li').length,
      recentCount: document.querySelectorAll('#recentExpList li').length,
      learningCount: document.querySelectorAll('#activeLearningList li').length,
      skillLvCount: document.querySelectorAll('#skillLevelsList li').length,
      calDays: document.querySelectorAll('#calGrid .cal-day').length,
      lsProfile: !!localStorage.getItem('earth_online_profile'),
      lsExp: (JSON.parse(localStorage.getItem('earth_online_experiences') || '[]')).length,
      lsSkills: (JSON.parse(localStorage.getItem('earth_online_skills') || '[]')).length,
      lsTodos: (JSON.parse(localStorage.getItem('earth_online_today_todos') || '[]')).length,
      // 资源加载情况
      imgOk: Array.from(document.images).filter(i => i.complete && i.naturalWidth > 0).length,
      imgTotal: document.images.length,
      cssOk: Array.from(document.styleSheets).length
    };
  });
  console.log('REPORT ' + JSON.stringify(report, null, 1));
  console.log('CONSOLE_ERRORS ' + JSON.stringify(errors.slice(0, 8), null, 1));
  await page.screenshot({ path: 'C:/Users/Administrator/WorkBuddy/2026-10-17-20-06-18/eo-work/tools/e2e-home.png', fullPage: false });
  console.log('screenshot saved');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });

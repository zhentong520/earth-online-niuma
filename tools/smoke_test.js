/* 冒烟测试：牛马版工作台核心链路 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', 'src');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');

// 云端演示数据（与 4 张数据表一致）
const DATA = {
  profile: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data-profile.json'), 'utf8')),
  experiences: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data-experiences.json'), 'utf8')),
  skills: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data-skills.json'), 'utf8')),
  tasks: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data-tasks.json'), 'utf8')),
};
const DB_IDS = {
  profile: 'J8nQuGrnH1EAcbGmVuHgJH',
  experiences: 'MIOOw92QLJoAtlc5rLRD4y',
  skills: '00jK1bNT44QrvE93VcF8Ep',
  tasks: 'frvt1ZzgNK1U0XfglXZ2qA'
};
// PropertyValue -> 平铺值
function flat(v) {
  if (v && typeof v === 'object') {
    if ('text' in v) return v.text;
    if ('number' in v) return v.number;
    if ('select' in v) return v.select;
    if ('date' in v) return v.date;
    if ('checkbox' in v) return v.checkbox;
  }
  return v;
}
const store = {};
Object.keys(DATA).forEach(k => {
  store[DB_IDS[k]] = DATA[k].map((r, i) => {
    const o = { _id: k + '_' + i };
    Object.keys(r).forEach(f => { o[f] = flat(r[f]); });
    return o;
  });
});

const dom = new JSDOM(html, {
  url: 'https://workbuddy.link/p/test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

// ---- SDK mock ----
let sdkCalls = { query: 0, add: 0, update: 0 };
window.__SMART_PAGE__ = {
  database: {
    async query({ databaseId, startCursor }) {
      sdkCalls.query++;
      const all = store[databaseId] || [];
      const start = startCursor ? parseInt(startCursor, 10) : 0;
      const page = all.slice(start, start + 50);
      const hasMore = start + 50 < all.length;
      return { results: page, hasMore, nextCursor: hasMore ? String(start + 50) : null };
    },
    async addRecord({ databaseId, properties }) {
      sdkCalls.add++;
      const rec = { _id: 'new_' + Date.now() + '_' + sdkCalls.add };
      Object.keys(properties).forEach(k => { rec[k] = flat(properties[k]); });
      (store[databaseId] = store[databaseId] || []).push(rec);
      return rec;
    },
    async updateRecord({ databaseId, recordId, properties }) {
      sdkCalls.update++;
      const arr = store[databaseId] || [];
      const rec = arr.find(r => r._id === recordId);
      if (rec) Object.keys(properties).forEach(k => { rec[k] = flat(properties[k]); });
      return rec || { id: recordId };
    },
    async deleteRecord() { return true; },
    async getSchema() { return { fields: [] }; },
  },
};

// ---- Canvas / 二进制 API stub ----
const ctxStub = () => new Proxy({}, {
  get(t, prop) {
    if (prop === 'measureText') return () => ({ width: 42 });
    if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
    if (prop === 'getImageData') return () => ({ data: [] });
    return typeof t[prop] !== 'undefined' ? t[prop] : (() => {});
  },
  set() { return true; },
});
window.HTMLCanvasElement.prototype.getContext = function () { return ctxStub(); };
window.HTMLCanvasElement.prototype.toBlob = function (cb) { cb({ size: 1024, type: 'image/png' }); };
window.URL.createObjectURL = () => 'blob:mock';
window.URL.revokeObjectURL = () => {};
window.Image = class {
  constructor() { this.naturalWidth = 100; this.naturalHeight = 100; }
  set src(v) { this._src = v; setTimeout(() => this.onload && this.onload(), 0); }
  get src() { return this._src; }
};
window.navigator.share = undefined;
window.alert = (msg) => { console.log('  [alert]', msg); };

// ---- 注入 app.js（末尾暴露内部引用，绕开 Node vm 的 const 跨脚本隔离）----
try {
  window.eval(appJs + '\n;window.__EO = { DOMAIN_LIB, buildUnitDefs, aiGeneratePlan, matchDomain, archiveHtml, drawArchiveCanvas, fillHome, renderTodayTasks, renderSkillLevels, renderRecentExp, renderActiveLearning, getSkills, getExperiences, analyzeExperience };');
  console.log('PASS: app.js evaluated without syntax/runtime error');
} catch (e) {
  console.log('FAIL: app.js eval:', e.message);
  process.exit(1);
}

const results = [];
const check = (name, cond, extra) => {
  results.push([name, !!cond]);
  console.log((cond ? 'PASS' : 'FAIL') + ': ' + name + (extra ? ' -> ' + extra : ''));
};

(async () => {
  await new Promise(r => setTimeout(r, 300)); // 等 init 的 dbPullAll

  const doc = window.document;
  // 1. 首页人物卡
  check('档案拉取：昵称', doc.getElementById('charNick').textContent === '小牛', doc.getElementById('charNick').textContent);
  check('档案拉取：公司', doc.getElementById('charSchool').textContent === '某互联网公司', doc.getElementById('charSchool').textContent);
  check('档案拉取：职位', doc.getElementById('charMajor').textContent === '产品经理', doc.getElementById('charMajor').textContent);
  check('档案拉取：工龄', doc.getElementById('charGrade').textContent === '3-5年', doc.getElementById('charGrade').textContent);

  // 2. 等级经验条
  check('等级渲染 Lv', /Lv\.\d+/.test(doc.getElementById('lvlDisplay').textContent), doc.getElementById('lvlDisplay').textContent + ' ' + doc.getElementById('expNum').textContent);

  // 3. 技能等级（22 分类自动识别）
  const slHtml = doc.getElementById('skillLevelsList').innerHTML;
  check('技能等级列表非空', slHtml.length > 50 && slHtml.includes('Lv.'), slHtml.slice(0, 80).replace(/\s+/g, ' '));

  // 4. 今日清单：昨日顺延项
  const tlHtml = doc.getElementById('todayList').innerHTML;
  check('今日清单含昨日顺延', tlHtml.includes('昨日顺延'), '');
  check('今日清单含自建待办', tlHtml.includes('整理 VLOOKUP'), '');
  check('今日清单含学习任务', tlHtml.includes('Excel') || tlHtml.includes('AI'), '');

  // 5. 最近经历 / 正在学习
  check('最近经历渲染', doc.getElementById('recentExpList').innerHTML.includes('需求顺利上线'), '');
  check('正在学习渲染', doc.getElementById('activeLearningList').innerHTML.length > 30, '');

  // 6. 日历
  check('日历渲染', doc.getElementById('calGrid').innerHTML.includes('cal-day'), '');

  // 7. 答案之书
  check('答案之书抽句', doc.getElementById('answerText').textContent.includes('「'), doc.getElementById('answerText').textContent);

  // 8. 经历四段结构（经 analyzeExperience 重建）
  const exps = JSON.parse(window.localStorage.getItem('earth_online_experiences'));
  const todayExp = exps.find(e => (e.title || '').indexOf('需求顺利上线') >= 0) || exps[0];
  check('经历四段结构完整', todayExp && todayExp.structured && todayExp.structured.happened !== '未记录' && todayExp.structured.whatIDid !== '未记录', todayExp ? JSON.stringify(todayExp.structured).slice(0, 100) : 'no today exp');

  // 9. 技能 plan/breakdown/verifyTask 重建（云端 6 条 = 5 学习 + 1 验证，验证拆出后 plan=5）
  const skills = JSON.parse(window.localStorage.getItem('earth_online_skills'));
  const excel = skills.find(s => s.name === 'Excel数据分析');
  check('学习技能 plan 重建', excel && Array.isArray(excel.plan) && excel.plan.length === 5, excel ? 'plan=' + excel.plan.length : 'missing');
  check('验证任务拆出', excel && excel.verifyTask && excel.verifyTask.includes('季度经营分析'), excel ? excel.verifyTask.slice(0, 30) : 'missing');
  check('breakdown 重建', excel && Array.isArray(excel.breakdown) && excel.breakdown.length >= 2, excel ? 'breakdown=' + excel.breakdown.length : 'missing');
  check('已点亮技能来源反推', (() => { const r = skills.find(s => s.name === '项目管理'); return r && r.sourceExpIds.length > 0; })(), '');

  // 10. 经历表单提交 -> 技能建议
  const form = doc.getElementById('expForm');
  form.querySelector('[name=expDate]').value = '2026-10-17';
  form.querySelector('[name=expTitle]').value = '用 AI 十分钟搞定竞品调研报告';
  form.querySelector('[name=expDesc]').value = '把五个竞品的官网和财报丢给 AI，十分钟出了对比初稿，我补充了数据核查。领导说这份报告可以放进季度复盘。感觉 AI 真的能提效。';
  form.dispatchEvent(new window.Event('submit', { cancelable: true }));
  await new Promise(r => setTimeout(r, 100));
  const confirmList = doc.getElementById('skillConfirmList').innerHTML;
  check('经历提交后弹技能建议', confirmList.includes('AI提效') || confirmList.includes('需求分析'), confirmList.slice(0, 120).replace(/\s+/g, ' '));

  // 11. 学习计划生成（职场领域：Excel）
  const EO = window.__EO;
  const domain = EO.DOMAIN_LIB.find(d => d.key === 'excel');
  const defs = EO.buildUnitDefs(domain, { wantsAdvanced: false, isZero: true });
  const plan = EO.aiGeneratePlan(defs, 21, 40, domain.verifyTask);
  check('Excel 学习计划生成', Array.isArray(plan) && plan.length >= 5 && plan.some(p => p.title.includes('🏆')), 'tasks=' + plan.length);
  check('计划含验证任务', plan[plan.length - 1].title.includes('🏆'), plan[plan.length - 1].title);

  // 12. 职场领域匹配
  const m1 = EO.matchDomain('我想用一个月学会用 Excel 做数据透视表和看板');
  check('matchDomain 命中 Excel', m1 && m1.key === 'excel', m1 ? m1.key : 'null');
  const m2 = EO.matchDomain('我想把 AI 用进日常工作流，写周报更快');
  check('matchDomain 命中 AI提效', m2 && m2.key === 'ai-work', m2 ? m2.key : 'null');
  const m3 = EO.matchDomain('我想提升跨部门沟通和汇报能力');
  check('matchDomain 命中 职场沟通汇报', m3 && m3.key === 'comm-work', m3 ? m3.key : 'null');

  // 13. 存档 HTML + Canvas 长图
  const arcHtml = EO.archiveHtml();
  check('存档卡 HTML 渲染', arcHtml.includes('地球') && arcHtml.includes('当前公司') && arcHtml.includes('工'), 'len=' + arcHtml.length);
  let arcOk = false, arcErr = '';
  try {
    const canvas = await EO.drawArchiveCanvas();
    arcOk = canvas && canvas.width === 750 && canvas.height > 400;
  } catch (e) { arcErr = e.message; }
  check('Canvas 存档长图生成', arcOk, arcErr || '');

  // 14. 顺延勾选 -> 日期更新到今天
  const carried = JSON.parse(window.localStorage.getItem('earth_online_today_todos')).find(t => t.title.includes('评审会'));
  check('昨日未完成项存在', !!carried && carried.date < new Date().toISOString().split('T')[0], carried ? carried.date : 'missing');

  // 15. 空数据不崩（清空 localStorage 再渲染一次）
  try {
    ['earth_online_profile','earth_online_experiences','earth_online_skills','earth_online_player','earth_online_today_todos'].forEach(k => window.localStorage.removeItem(k));
    window.__EO.fillHome({});
    window.__EO.renderTodayTasks();
    window.__EO.renderSkillLevels();
    window.__EO.renderRecentExp();
    window.__EO.renderActiveLearning();
    check('空数据渲染不崩', true);
  } catch (e) {
    check('空数据渲染不崩', false, e.message);
  }

  // 汇总
  const failed = results.filter(r => !r[1]);
  console.log('\\n===== ' + (results.length - failed.length) + '/' + results.length + ' passed =====');
  if (failed.length) { console.log('FAILED:', failed.map(f => f[0]).join(' | ')); process.exit(1); }
  process.exit(0);
})().catch(e => { console.log('FATAL:', e); process.exit(1); });

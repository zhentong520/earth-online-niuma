    /* ============================================================
       0) 工具函数
       ============================================================ */
    function escapeHtml(s) {
      return String(s).replace(/[&<>\u0022\u0027]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
    }
    function parseList(str) {
      if (!str) return [];
      return str.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean).slice(0, 8);
    }
    function genId(seed) {
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
      return String(h % 1000000).padStart(6, '0');
    }
    function today() { return new Date().toISOString().split('T')[0]; }
    function uid() { return Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

    /* ============================================================
       1) 等级系统 (LV.1 ~ LV.30)
       ============================================================ */
    const LEVEL_TABLE = (function() {
      const table = [0];
      let total = 0;
      for (let lv = 1; lv <= 30; lv++) {
        table[lv] = total;
        const base = Math.round(80 + lv * 20 * Math.pow(1.12, lv));
        total += base;
      }
      table[31] = total;
      return table;
    })();

    function getLevel(exp) {
      for (let lv = 30; lv >= 1; lv--) {
        if (exp >= LEVEL_TABLE[lv]) return lv;
      }
      return 1;
    }

    function getExpProgress(exp) {
      const lv = getLevel(exp);
      if (lv >= 30) return { lv, current: exp - LEVEL_TABLE[30], need: 0, pct: 100 };
      const curBase = LEVEL_TABLE[lv];
      const nextBase = LEVEL_TABLE[lv + 1];
      const current = exp - curBase;
      const need = nextBase - curBase;
      const pct = need > 0 ? Math.min(100, Math.round(current / need * 100)) : 100;
      return { lv, current, need, pct };
    }

    function addExp(amount, label) {
      const data = getPlayerData();
      const oldLv = getLevel(data.exp);
      data.exp += amount;
      const newLv = getLevel(data.exp);
      savePlayerData(data);
      renderExpBar(data.exp);
      showExpToast(amount, label || '');
      if (newLv > oldLv) {
        setTimeout(() => showLevelUp(newLv), 800);
      }
    }

    function showExpToast(amount, label) {
      const toast = document.getElementById('expToast');
      const text = document.getElementById('expToastText');
      text.textContent = '+' + amount + ' EXP' + (label ? ' (' + label + ')' : '');
      toast.style.display = 'flex';
      toast.style.animation = 'none';
      void toast.offsetHeight; // reflow
      toast.style.animation = 'expToastIn 0.3s ease, expToastOut 0.3s ease 1.5s forwards';
      setTimeout(() => { toast.style.display = 'none'; }, 2000);
    }

    function showLevelUp(lv) {
      const toast = document.getElementById('levelUpToast');
      document.getElementById('levelUpLvl').textContent = 'Lv.' + lv;
      toast.style.display = 'flex';
      setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }

    function renderExpBar(exp) {
      const p = getExpProgress(exp);
      document.getElementById('lvlDisplay').textContent = 'Lv.' + p.lv;
      document.getElementById('expNum').textContent = p.lv >= 30 ? 'MAX' : (p.current + ' / ' + p.need);
      document.getElementById('expBarFill').style.width = p.pct + '%';
    }

    /* ============================================================
       2) 数据层 (localStorage)
       ============================================================ */
    const LS_PROFILE = 'earth_online_profile';
    const LS_EXPERIENCES = 'earth_online_experiences';
    const LS_SKILLS = 'earth_online_skills';
    const LS_PLAYER = 'earth_online_player';
    const LS_TREES = 'earth_online_trees';
    const LS_CHAR_IMAGE = 'earth_online_char_image';
    const LS_CHAR_PROMPT = 'earth_online_char_pending_prompt';
    const LS_CHAR_SKIPPED = 'earth_online_char_skipped';
    const LS_TODOS = 'earth_online_today_todos';

    /* ============================================================
       2.5) 资料库数据表双向同步（DBSync）
       ============================================================ */
    const DB_IDS = {
      profile: 'J8nQuGrnH1EAcbGmVuHgJH',
      experiences: 'MIOOw92QLJoAtlc5rLRD4y',
      skills: '00jK1bNT44QrvE93VcF8Ep',
      tasks: 'frvt1ZzgNK1U0XfglXZ2qA'
    };
    const dbSdk = () => (window.__SMART_PAGE__ && window.__SMART_PAGE__.database) || null;
    const dbOnline = () => !!dbSdk() && DB_IDS.profile.indexOf('__') !== 0;
    const _dbCache = { profile: null, experiences: [], skills: [], tasks: [] };
    const STATUS_ZH = { 'lit': '已点亮', 'learning': '学习中', 'want': '想学' };
    const STATUS_EN = { '已点亮': 'lit', '学习中': 'learning', '想学': 'want' };

    const DB_SELECT_KEYS = ['工龄', '状态', '类型'];
    // 数据库绑定标注（§1.5.5）：文本直接来自/派生自 database 的生成元素需成对携带
    const SP_PROFILE = ' data-sp-bindable="database" data-sp-database-id="' + DB_IDS.profile + '"';
    const SP_EXP     = ' data-sp-bindable="database" data-sp-database-id="' + DB_IDS.experiences + '"';
    const SP_SKILL   = ' data-sp-bindable="database" data-sp-database-id="' + DB_IDS.skills + '"';
    const SP_TASK    = ' data-sp-bindable="database" data-sp-database-id="' + DB_IDS.tasks + '"';
    const DB_DATE_KEYS = ['日期', '确认日期'];
    const DB_BOOL_KEYS = ['是否完成'];
    const DB_NUM_KEYS = ['总经验'];

    function dbDate(v) {
      if (!v) return null;
      const s = String(v);
      return s.length >= 10 ? s.slice(0, 10) : null;
    }
    function dbVal(rec, name) {
      const v = rec ? rec[name] : undefined;
      return v === undefined ? null : v;
    }
    function dbText(rec, name) {
      const v = dbVal(rec, name);
      return v === null ? '' : String(v);
    }
    // 自然键取值：日期截到天，布尔转标记
    function dbKeyVal(v) {
      if (v === null || v === undefined) return '';
      if (typeof v === 'boolean') return v ? '1' : '0';
      return dbDate(v) || String(v);
    }
    // 平铺 raw 值 -> SDK PropertyValue map（空值跳过，checkbox 始终写）
    function dbProps(raw) {
      const props = {};
      Object.keys(raw || {}).forEach(k => {
        const v = raw[k];
        if (v === null || v === undefined) return;
        if (DB_BOOL_KEYS.indexOf(k) >= 0) { props[k] = { checkbox: !!v }; return; }
        if (DB_NUM_KEYS.indexOf(k) >= 0) { props[k] = { number: Number(v) || 0 }; return; }
        const s = String(v == null ? '' : v);
        if (DB_SELECT_KEYS.indexOf(k) >= 0) { if (s) props[k] = { select: s }; return; }
        if (DB_DATE_KEYS.indexOf(k) >= 0) { const d = dbDate(v); if (d) props[k] = { date: d }; return; }
        if (s) props[k] = { text: s };
      });
      return props;
    }
    // 分页拉全量（query 返回 { results, nextCursor, hasMore }）
    // 分页拉全量（query 单次只回一页，必须 hasMore+nextCursor 续翻拉完再渲染）
    async function _dbPullPages(fetchPage) {
      let out = [], cursor = null;
      do {
        const r = await fetchPage(cursor);
        out = out.concat((r && r.results) || []);
        cursor = (r && r.hasMore) ? r.nextCursor : null;
      } while (cursor);
      return out;
    }

    /* ---- 四张表的 SDK 适配器（databaseId 硬编码字面量，见 database-sdk-contract.md）---- */
    function dbQueryProfile() {
      const db = dbSdk();
      return _dbPullPages(c => db.query({ databaseId: 'J8nQuGrnH1EAcbGmVuHgJH', pageSize: 200, startCursor: c || undefined }));
    }
    function dbQueryExperiences() {
      const db = dbSdk();
      return _dbPullPages(c => db.query({ databaseId: 'MIOOw92QLJoAtlc5rLRD4y', pageSize: 200, startCursor: c || undefined }));
    }
    function dbQuerySkills() {
      const db = dbSdk();
      return _dbPullPages(c => db.query({ databaseId: '00jK1bNT44QrvE93VcF8Ep', pageSize: 200, startCursor: c || undefined }));
    }
    function dbQueryTasks() {
      const db = dbSdk();
      return _dbPullPages(c => db.query({ databaseId: 'frvt1ZzgNK1U0XfglXZ2qA', pageSize: 200, startCursor: c || undefined }));
    }
    function dbAddProfile(raw) {
      const db = dbSdk();
      if (!db || !dbOnline()) return Promise.resolve(null);
      return db.addRecord({ databaseId: 'J8nQuGrnH1EAcbGmVuHgJH', properties: dbProps(raw) }).then(r => r || true).catch(() => null);
    }
    function dbUpdProfile(recordId, raw) {
      const db = dbSdk();
      if (!db || !dbOnline()) return Promise.resolve(null);
      return db.updateRecord({ databaseId: 'J8nQuGrnH1EAcbGmVuHgJH', recordId: recordId, properties: dbProps(raw) }).then(r => (r && r.id) || true).catch(() => null);
    }
    function dbAddExperiences(raw) {
      const db = dbSdk();
      if (!db || !dbOnline()) return Promise.resolve(null);
      return db.addRecord({ databaseId: 'MIOOw92QLJoAtlc5rLRD4y', properties: dbProps(raw) }).then(r => r || true).catch(() => null);
    }
    function dbUpdExperiences(recordId, raw) {
      const db = dbSdk();
      if (!db || !dbOnline()) return Promise.resolve(null);
      return db.updateRecord({ databaseId: 'MIOOw92QLJoAtlc5rLRD4y', recordId: recordId, properties: dbProps(raw) }).then(r => (r && r.id) || true).catch(() => null);
    }
    function dbAddSkills(raw) {
      const db = dbSdk();
      if (!db || !dbOnline()) return Promise.resolve(null);
      return db.addRecord({ databaseId: '00jK1bNT44QrvE93VcF8Ep', properties: dbProps(raw) }).then(r => r || true).catch(() => null);
    }
    function dbUpdSkills(recordId, raw) {
      const db = dbSdk();
      if (!db || !dbOnline()) return Promise.resolve(null);
      return db.updateRecord({ databaseId: '00jK1bNT44QrvE93VcF8Ep', recordId: recordId, properties: dbProps(raw) }).then(r => (r && r.id) || true).catch(() => null);
    }
    function dbAddTasks(raw) {
      const db = dbSdk();
      if (!db || !dbOnline()) return Promise.resolve(null);
      return db.addRecord({ databaseId: 'frvt1ZzgNK1U0XfglXZ2qA', properties: dbProps(raw) }).then(r => r || true).catch(() => null);
    }
    function dbUpdTasks(recordId, raw) {
      const db = dbSdk();
      if (!db || !dbOnline()) return Promise.resolve(null);
      return db.updateRecord({ databaseId: 'frvt1ZzgNK1U0XfglXZ2qA', recordId: recordId, properties: dbProps(raw) }).then(r => (r && r.id) || true).catch(() => null);
    }
    const DB_OPS = {
      profile:     { query: dbQueryProfile,     add: dbAddProfile,     upd: dbUpdProfile },
      experiences: { query: dbQueryExperiences, add: dbAddExperiences, upd: dbUpdExperiences },
      skills:      { query: dbQuerySkills,      add: dbAddSkills,      upd: dbUpdSkills },
      tasks:       { query: dbQueryTasks,       add: dbAddTasks,       upd: dbUpdTasks }
    };

    /* ---------- 拉取：云端 -> localStorage ---------- */
    async function dbPullAll() {
      const sdk = dbSdk();
      if (!sdk || !dbOnline()) return false;
      try {
        const [pr, er, sr, tr] = await Promise.all([
          dbQueryProfile(),
          dbQueryExperiences(),
          dbQuerySkills(),
          dbQueryTasks()
        ]);
        const rows = (r) => Array.isArray(r) ? r : ((r && r.results) || []);

        // --- 玩家档案（单行） ---
        const profRows = rows(pr);
        _dbCache.profile = profRows[0] || null;
        if (profRows[0]) {
          const r = profRows[0];
          const p = getProfile();
          p.nickname = dbText(r, '昵称') || p.nickname;
          p.school = dbText(r, '公司');
          p.major = dbText(r, '职位');
          p.grade = dbText(r, '工龄');
          p.oneLineDesc = dbText(r, '一句话描述');
          p.interests = dbText(r, '兴趣关键词');
          p.futureJobs = dbText(r, '职业关键词');
          saveProfile(p);
          const expNum = Number(dbVal(r, '总经验'));
          if (!isNaN(expNum) && expNum > 0) savePlayerData({ exp: expNum });
        }

        // --- 经历库 ---
        const expRows = rows(er);
        _dbCache.experiences = expRows;
        if (expRows.length) {
          const list = expRows.map((r, i) => {
            const title = dbText(r, '标题');
            const rawDesc = dbText(r, '描述');
            const old = getExperiences().find(e => e.title === title);
            // 用本地规则引擎重建四段结构；云端已存的「结果/感受」优先
            const analysis = analyzeExperience(title, rawDesc);
            const structured = analysis.structured;
            const cloudResult = dbText(r, '结果');
            const cloudFeeling = dbText(r, '感受');
            if (cloudResult) structured.result = cloudResult;
            if (cloudFeeling) structured.feeling = cloudFeeling;
            return {
              id: (old && old.id) || (Date.now() + i),
              date: dbDate(dbVal(r, '日期')) || today(),
              title: title,
              rawDesc: rawDesc,
              structured: structured,
              suggestedSkills: analysis.suggestedSkills,
              confirmedSkills: dbText(r, '确认技能') ? dbText(r, '确认技能').split(/[,，、]/).filter(Boolean) : [],
              skillConfirmed: true
            };
          });
          saveExperiences(list);

          // 由经历的「确认技能」反推已点亮技能的来源经历
          const srcBySkill = {};
          list.forEach(e => (e.confirmedSkills || []).forEach(sk => {
            (srcBySkill[sk] = srcBySkill[sk] || []).push(e.id);
          }));
          window.__EO_SRC_BY_SKILL = srcBySkill;
        }

        // --- 技能 + 任务 ---
        const skillRows = rows(sr);
        const taskRows = rows(tr);
        _dbCache.skills = skillRows;
        _dbCache.tasks = taskRows;
        const srcBySkill = window.__EO_SRC_BY_SKILL || {};
        if (skillRows.length) {
          const learnTasks = taskRows.filter(r => dbText(r, '类型') === '学习任务');
          const skillList = skillRows.map((r, i) => {
            const name = dbText(r, '技能名');
            const status = STATUS_EN[dbText(r, '状态')] || 'lit';
            const myTasks = learnTasks.filter(t => dbText(t, '所属技能') === name);
            const old = getSkills().find(s => s.name === name);
            const s = {
              id: (old && old.id) || (Date.now() + 100 + i),
              name: name,
              status: status,
              sourceExpIds: (old && old.sourceExpIds && old.sourceExpIds.length) ? old.sourceExpIds : (srcBySkill[name] || []),
              confirmedAt: dbDate(dbVal(r, '确认日期')) || (old && old.confirmedAt) || null,
              goalText: dbText(r, '目标') || undefined,
              goalDuration: (old && old.goalDuration) || undefined,
              treeIds: (old && old.treeIds) || []
            };
            if (status === 'learning' && myTasks.length) {
              const planTasks = myTasks.map((t, j) => ({
                unitId: 'u' + j,
                day: j + 1,
                title: dbText(t, '标题'),
                do: dbText(t, '内容'),
                time: dbText(t, '时长'),
                standard: dbText(t, '达标标准'),
                done: !!dbVal(t, '是否完成')
              }));
              // 🏆 验证任务从计划中拆出
              const vIdx = planTasks.findIndex(tk => /\ud83c\udfc6|验证任务/.test(tk.title || ''));
              if (vIdx >= 0) {
                s.verifyTask = planTasks[vIdx].do || (old && old.verifyTask) || '';
                planTasks.splice(vIdx, 1);
              } else {
                s.verifyTask = (old && old.verifyTask) || '';
              }
              s.plan = planTasks;
              // 按 unitId 聚合能力单元，重建 breakdown
              const unitMap = {};
              planTasks.forEach(tk => {
                const uid2 = tk.unitId || 'u0';
                if (!unitMap[uid2]) {
                  unitMap[uid2] = {
                    id: uid2,
                    name: (tk.title || '').replace(/^(Day|Week)\s*\d+\s*[｜|]\s*/, ''),
                    total: 0, done: 0
                  };
                }
                unitMap[uid2].total++;
                if (tk.done) unitMap[uid2].done++;
              });
              s.breakdown = (old && old.breakdown && old.breakdown.length)
                ? old.breakdown
                : Object.keys(unitMap).map((uid2, ui) => ({
                    id: uid2, name: unitMap[uid2].name || ('单元 ' + (ui + 1)), phase: ui + 1,
                    status: unitMap[uid2].done === unitMap[uid2].total ? 'done' : (unitMap[uid2].done > 0 ? 'doing' : 'want'),
                    sourceExpId: null
                  }));
            }
            return s;
          });
          saveSkills(skillList);
        }

        // --- 今日待办 ---
        const todoRows = taskRows.filter(r => dbText(r, '类型') === '今日待办');
        if (todoRows.length) {
          const todos = todoRows.map((r, i) => ({
            id: dbText(r, '标题') + '_' + dbDate(dbVal(r, '日期')),
            title: dbText(r, '标题'),
            date: dbDate(dbVal(r, '日期')) || today(),
            done: !!dbVal(r, '是否完成'),
            doneAt: null,
            createdAt: new Date().toISOString()
          }));
          saveTodayTodos(todos);
        }
        return true;
      } catch(e) {
        return false;
      }
    }

    /* ---------- 写入：localStorage -> 云端（异步 upsert） ---------- */
    // 按自然键 diff 同步集合表
    async function dbSyncCollection(tableKey, zhKeys, localList, mapFn, cacheArr) {
      const ops = DB_OPS[tableKey];
      if (!ops || !dbOnline()) return;
      try {
        const cloudKeys = new Map();
        cacheArr.forEach(r => {
          const k = zhKeys.map(zh => dbKeyVal(dbVal(r, zh))).join('|');
          cloudKeys.set(k, r._id);
        });
        for (const item of localList) {
          const payload = mapFn(item);
          const k = zhKeys.map(zh => dbKeyVal(payload[zh])).join('|');
          const rid = cloudKeys.get(k);
          if (rid) {
            await ops.upd(rid, payload);
          } else {
            const added = await ops.add(payload);
            // 更新缓存
            if (added) {
              try {
                const fresh = await ops.query();
                cacheArr.length = 0;
                cacheArr.push.apply(cacheArr, fresh);
              } catch(e) {}
            }
          }
        }
      } catch(e) {}
    }

    function dbQueueSync(kind) {
      const sdk = dbSdk();
      if (!sdk || !dbOnline()) return;
      // 串行化：避免并发写乱序
      _dbSyncChain = _dbSyncChain.then(() => _doSync(kind)).catch(() => {});
    }
    let _dbSyncChain = Promise.resolve();
    async function _doSync(kind) {
      if (kind === 'profile') {
        const p = getProfile();
        const payload = {
          '昵称': p.nickname || '', '公司': p.school || '', '职位': p.major || '',
          '工龄': p.grade || '', '一句话描述': p.oneLineDesc || '',
          '兴趣关键词': p.interests || '', '职业关键词': p.futureJobs || '',
          '总经验': getPlayerData().exp || 0
        };
        if (_dbCache.profile && _dbCache.profile._id) {
          await dbUpdProfile(_dbCache.profile._id, payload);
        } else {
          await dbAddProfile(payload);
          try {
            const fresh = await dbQueryProfile();
            _dbCache.profile = fresh[0] || null;
          } catch(e) {}
        }
      } else if (kind === 'experiences') {
        await dbSyncCollection(
          'experiences', ['标题'],
          getExperiences(),
          (e) => ({
            '日期': e.date || '', '标题': e.title || '', '描述': e.rawDesc || '',
            '结果': (e.structured && e.structured.result) || '',
            '感受': (e.structured && e.structured.feeling) || '',
            '确认技能': (e.confirmedSkills || []).join(',')
          }),
          _dbCache.experiences
        );
      } else if (kind === 'skills') {
        // 技能表
        await dbSyncCollection(
          'skills', ['技能名'],
          getSkills(),
          (s) => ({
            '技能名': s.name || '',
            '状态': STATUS_ZH[s.status] || '已点亮',
            '目标': s.goalText || '',
            '进度说明': Array.isArray(s.plan)
              ? (s.plan.filter(p => p.done).length + '/' + s.plan.length + ' 已完成')
              : '',
            '确认日期': s.confirmedAt || null
          }),
          _dbCache.skills
        );
        // 学习任务表（技能 plan 展开）
        const taskPayloads = [];
        getSkills().forEach(s => {
          if (s.status !== 'learning' || !Array.isArray(s.plan)) return;
          s.plan.forEach(p => {
            taskPayloads.push({
              skill: s.name, payload: {
                '类型': '学习任务', '所属技能': s.name,
                '标题': p.title || ('Day ' + p.day),
                '内容': p.do || '', '时长': p.time || '',
                '达标标准': p.standard || '', '是否完成': !!p.done
              }
            });
          });
        });
        await dbSyncCollection(
          'tasks', ['所属技能', '标题'],
          taskPayloads.map(t => ({ key: t.skill + '|' + t.payload['标题'], payload: t.payload })),
          (t) => t.payload,
          _dbCache.tasks
        );
      } else if (kind === 'todos') {
        await dbSyncCollection(
          'tasks', ['所属技能', '标题'],
          getTodayTodos().map(t => ({ fake: t, payload: {
            '类型': '今日待办', '所属技能': '',
            '日期': t.date || '', '标题': t.title || '',
            '内容': '', '时长': '', '达标标准': '',
            '是否完成': !!t.done
          }})),
          (t) => t.payload,
          _dbCache.tasks
        );
      }
    }

    function getProfile() {
      try { return JSON.parse(localStorage.getItem(LS_PROFILE)) || {}; } catch(e) { return {}; }
    }
    function saveProfile(p) {
      try { localStorage.setItem(LS_PROFILE, JSON.stringify(p)); } catch(e) {}
      dbQueueSync('profile');
    }
    function getExperiences() {
      try { return JSON.parse(localStorage.getItem(LS_EXPERIENCES)) || []; } catch(e) { return []; }
    }
    function saveExperiences(list) {
      try { localStorage.setItem(LS_EXPERIENCES, JSON.stringify(list)); } catch(e) {}
      dbQueueSync('experiences');
    }
    function getSkills() {
      try { return JSON.parse(localStorage.getItem(LS_SKILLS)) || []; } catch(e) { return []; }
    }
    function saveSkills(list) {
      try { localStorage.setItem(LS_SKILLS, JSON.stringify(list)); } catch(e) {}
      dbQueueSync('skills');
    }
    function getPlayerData() {
      try { return JSON.parse(localStorage.getItem(LS_PLAYER)) || { exp: 0 }; } catch(e) { return { exp: 0 }; }
    }
    function savePlayerData(d) {
      try { localStorage.setItem(LS_PLAYER, JSON.stringify(d)); } catch(e) {}
      dbQueueSync('profile');
    }
    function getTrees() {
      try { return JSON.parse(localStorage.getItem(LS_TREES)) || []; } catch(e) { return []; }
    }
    function saveTrees(list) {
      try { localStorage.setItem(LS_TREES, JSON.stringify(list)); } catch(e) {}
    }

    /* 今日自建 todo：[{ id, title, date: 'YYYY-MM-DD', done, doneAt, createdAt }] */
    function getTodayTodos() {
      try { return JSON.parse(localStorage.getItem(LS_TODOS)) || []; } catch(e) { return []; }
    }
    function saveTodayTodos(list) {
      try { localStorage.setItem(LS_TODOS, JSON.stringify(list)); } catch(e) {}
      dbQueueSync('todos');
    }

    /* ============================================================
       3) 角色图（优先使用AI生成图，全局复用同一张）
       ============================================================ */
    function getCharImage() {
      // 优先使用AI生成的角色图片（base64存在localStorage）
      try {
        const b64 = localStorage.getItem(LS_CHAR_IMAGE);
        if (b64) return b64;
      } catch(e) {}
      // 兜底：旧版固定PNG
      const profile = getProfile();
      let gender = profile.gender || '';
      if (!gender || gender === 'other') {
        const text = ((profile.interests || '') + ' ' + (profile.futureJobs || '')).toLowerCase();
        gender = /(编程|开发|工程|建筑|算法)/.test(text) ? 'male' : 'female';
      }
      return gender === 'male'
        ? './assets/img/char-male-porcelain-blue.jpg'
        : './assets/img/char-female-porcelain-lavender.jpg';
    }

    function pickCharImage(profile) {
      return getCharImage();
    }

    function saveCharImage(b64) {
      try { localStorage.setItem(LS_CHAR_IMAGE, b64); } catch(e) {}
    }

    function hasCharImage() {
      try { return !!localStorage.getItem(LS_CHAR_IMAGE); } catch(e) { return false; }
    }

    /* ============================================================
       3.5) 首页渲染：人物卡 / 日历 / 今日 / 最近 / 学习 / 答案之书
       ============================================================ */

    // 根据经历标题自动匹配统一风格小图标
    const EXP_ICON_RULES = [
      [/旅行|旅游|出行|徒步|city\s*walk|citywalk|户外/, '✈️'],
      [/实习|工作|求职|面试|简历|公司/, '💼'],
      [/演讲|present|分享|上台|汇报|路演|ppt|答辩/, '🎤'],
      [/音乐节|演唱会|演出|音乐会|看展|展览|艺术/, '🎵'],
      [/球|跑|运动|健身|瑜伽|跳|舞|滑雪|游泳|骑行/, '⚽'],
      [/摄影|拍照|拍片|相机/, '📷'],
      [/比赛|竞赛|编程|算法|黑客松|hackathon|解题|数学/, '🏆'],
      [/志愿|公益|志愿|服务|支教/, '🤝'],
      [/社团|学生会|组织|活动|晚会|迎新/, '🎉'],
      [/课|课程|讲座|网课|mooc|培训|学习/, '📚'],
      [/读书|阅读|看书|读完|书评/, '📖'],
      [/写|文章|投稿|稿|博客|日记/, '✍️'],
      [/视频|剪辑|vlog|短片|拍片|导演/, '🎬'],
      [/画|插画|素描|手绘|板绘|设计|海报/, '🎨'],
      [/代码|编程|开发|网站|app|上线|部署|debug/, '💻'],
      [/做饭|烹饪|菜谱|蛋糕|烘焙|煮/, '🍳'],
      [/游戏|通关|上分|steam|联机|电竞/, '🎮'],
      [/追星|演唱会|见面|签售|饭圈/, '⭐'],
      [/猫|狗|宠物|仓鼠|兔子/, '🐾'],
      [/搬家|宿舍|入住|整理/, '📦'],
      [/生日|节日|春节|圣诞|新年/, '🎂'],
      [/emo|心情|情绪|焦虑|难过|开心/, '💭'],
      [/考试|四六|四六级|考研|雅思|托福|期末|中考|高考|分数|模考/, '📝'],
    ];
    function pickExpIcon(title) {
      const t = (title || '').toLowerCase();
      for (const [re, ico] of EXP_ICON_RULES) {
        if (re.test(t)) return ico;
      }
      return '⭐';
    }
    function formatShortDate(d) {
      if (!d) return '';
      const parts = String(d).split('-');
      if (parts.length === 3) return parts[1] + '.' + parts[2];
      return d;
    }

    // 填充人物卡 + 全部首页模块
    function fillHome(profile) {
      const p = profile || {};
      // 头像
      document.getElementById('charImg').src = pickCharImage(p);
      document.getElementById('charNick').textContent = p.nickname || '匿名冒险者';
      document.getElementById('charSchool').textContent = p.school || '—';
      document.getElementById('charMajor').textContent = p.major || '—';
      document.getElementById('charGrade').textContent = p.grade || '—';

      // 一句话描述
      const bubble = p.oneLineDesc
        ? '"' + escapeHtml(p.oneLineDesc) + '"'
        : '"正在长成自己的样子。"';
      document.getElementById('charBubble').textContent = bubble;

      // 关键词（最多 6 个）
      const interests = parseList(p.interests);
      const tags = interests.slice(0, 6);
      const tagHtml = tags.length
        ? tags.map(t => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('')
        : `<span class="tag-chip muted">+ 添加喜好关键词</span>`;
      document.getElementById('charTags').innerHTML = tagHtml;

      // 顶部 pill (工龄)
      const stage = document.getElementById('stagePill');
      if (p.grade) {
        stage.style.display = 'inline-flex';
        document.getElementById('stagePillText').textContent = p.grade;
      }

      // 等级 + 经验条
      renderExpBar(getPlayerData().exp);

      // 渲染各模块
      renderCalendar();
      renderTodayTasks();
      renderRecentExp();
      renderActiveLearning();
      renderSkillLevels();
      drawAnswer(); // 每次进入页面抽一句（基于日期，今天稳定）
    }

    /* ----- 日历 ----- */
    let _calCursor = null; // {year, month: 0-11}
    function renderCalendar() {
      const now = _calCursor || new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      _calCursor = new Date(year, month, 1);

      const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一','十二月'];
      document.getElementById('calMonthLabel').textContent = monthNames[month] + ' ' + year;

      const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
      // 把周日(0)放到末尾，让周一开头
      const offset = (firstWeekday + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // 收集本月标记
      const exps = getExperiences();
      const skills = getSkills();
      const eventMap = {}; // dateStr -> { exp: count, task: count }
      exps.forEach(e => {
        if (!e.date) return;
        const d = String(e.date).slice(0, 10);
        if (!eventMap[d]) eventMap[d] = { exp: 0, task: 0 };
        eventMap[d].exp += 1;
      });
      skills.forEach(s => {
        if (s.status !== 'learning' || !Array.isArray(s.plan)) return;
        s.plan.forEach(p => {
          if (!p.done) return;
          // 没记录具体完成日期的，用计划开始日近似
          const d = (p.completedAt || s.createdAt || '').slice(0, 10);
          if (!d) return;
          if (!eventMap[d]) eventMap[d] = { exp: 0, task: 0 };
          eventMap[d].task += 1;
        });
      });

      const todayStr = today();
      const grid = document.getElementById('calGrid');
      let html = '';
      for (let i = 0; i < offset; i++) {
        html += `<div class="cal-day placeholder"></div>`;
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
        const wd = new Date(year, month, d).getDay();
        const isWeekend = (wd === 0 || wd === 6);
        const isToday = (dateStr === todayStr);
        const ev = eventMap[dateStr];
        let cls = 'cal-day';
        if (isWeekend) cls += ' weekend';
        if (isToday) cls += ' today';
        if (ev && (ev.exp || ev.task)) {
          cls += ' has-event';
          if (ev.task && !ev.exp) cls += ' has-task';
          else if (ev.exp && !ev.task) cls += ' has-exp';
        }
        html += `<div class="${cls}"${ev && (ev.exp || ev.task) ? SP_TASK : ''} data-date="${dateStr}">${d}</div>`;
      }
      grid.innerHTML = html;
    }
    function goToToday() {
      _calCursor = null;
      renderCalendar();
    }

    /* ----- 今日任务列表 ----- */
    function renderTodayTasks() {
      // 顶部日期
      const t = new Date();
      const month = t.getMonth() + 1;
      const day = t.getDate();
      const weekdayNames = ['周日','周一','周二','周三','周四','周五','周六'];
      document.getElementById('todayDate').textContent = month + '月' + day + '日 ' + weekdayNames[t.getDay()];

      const todayStr = today();
      const list = document.getElementById('todayList');
      let html = '';

      // 0) 昨日（含更早）未完成顺延：打工人的「今天要处理」区
      const carried = getTodayTodos().filter(x => x.date < todayStr && !x.done);
      carried.forEach(it => {
        html += `<li class="custom carried"${SP_TASK} data-cid="${escapeHtml(it.id)}">
          <input type="checkbox" onclick="toggleCustomTask(this, '${escapeHtml(it.id)}')" />
          <span class="tl-title">${escapeHtml(it.title)}</span>
          <span class="tl-skill">昨日顺延</span>
        </li>`;
      });

      // 1) 用户自建 todo（今日且未完成排前，已完成排后）
      const custom = getTodayTodos().filter(x => x.date === todayStr);
      const customOpen = custom.filter(x => !x.done);
      const customDone = custom.filter(x => x.done);
      customOpen.forEach(it => {
        html += `<li class="custom"${SP_TASK} data-cid="${escapeHtml(it.id)}">
          <input type="checkbox" onclick="toggleCustomTask(this, '${escapeHtml(it.id)}')" />
          <span class="tl-title">${escapeHtml(it.title)}</span>
          <span class="tl-skill">自建</span>
        </li>`;
      });

      // 2) 学习计划里的"今日第一个未完成"（每个 learning 技能一条）
      const skills = getSkills().filter(s => s.status === 'learning' && Array.isArray(s.plan));
      skills.forEach(s => {
        const todo = s.plan.find(p => !p.done);
        if (todo) {
          html += `<li class="plan"${SP_SKILL} data-skill="${escapeHtml(s.name)}">
            <input type="checkbox" onclick="toggleTodayTask(this)" />
            <span class="tl-title">${escapeHtml(todo.do || todo.title)}</span>
            <span class="tl-skill">${escapeHtml(s.name)}</span>
          </li>`;
        }
      });

      // 3) 今日已完成的自建 todo
      customDone.forEach(it => {
        html += `<li class="custom done"${SP_TASK} data-cid="${escapeHtml(it.id)}">
          <input type="checkbox" checked onclick="toggleCustomTask(this, '${escapeHtml(it.id)}')" />
          <span class="tl-title">${escapeHtml(it.title)}</span>
          <span class="tl-skill">自建</span>
        </li>`;
      });

      // 4) 今天记录过的经历
      const todayExps = getExperiences().filter(e => (e.date || '').slice(0,10) === todayStr);
      todayExps.slice(0, 2).forEach(e => {
        html += `<li class="done"${SP_EXP}>
          <span style="font-size:12px;">✓</span>
          <span class="tl-title">${pickExpIcon(e.title)} ${escapeHtml(e.title)}</span>
          <span class="tl-skill">经历</span>
        </li>`;
      });

      if (!html) {
        list.innerHTML = `<li class="today-empty">今天还没有任务和记录 ✨</li>`;
      } else {
        list.innerHTML = html;
      }
      document.getElementById('todayFooter').textContent = '每一个普通的日子，都是地球Online的主线任务！';
    }

    function addTodayTask(ev) {
      ev.preventDefault();
      const inp = document.getElementById('todayAddInput');
      const v = (inp.value || '').trim();
      if (!v) return false;
      const list = getTodayTodos();
      list.push({ id: uid(), title: v, date: today(), done: false, createdAt: new Date().toISOString() });
      saveTodayTodos(list);
      inp.value = '';
      renderTodayTasks();
      return false;
    }

    function toggleCustomTask(cb, id) {
      const list = getTodayTodos();
      const item = list.find(x => x.id === id);
      if (!item) return;
      // 防误操作：取消勾选不扣经验
      const wasDone = item.done;
      item.done = cb.checked;
      item.doneAt = cb.checked ? new Date().toISOString() : null;
      // 顺延项今天被勾选 -> 日期顺延到今天，日历打点也落在今天
      if (cb.checked && item.date !== today()) item.date = today();
      saveTodayTodos(list);
      const li = cb.closest('li');
      if (cb.checked) {
        li.classList.add('done');
        if (!wasDone) addExp(8, '完成一件自建任务');
        renderExpBar(getPlayerData().exp);
      } else {
        li.classList.remove('done');
      }
    }

    function toggleTodayTask(cb) {
      const li = cb.closest('li');
      const skillName = li.getAttribute('data-skill');
      const skills = getSkills();
      const skill = skills.find(s => s.name === skillName);
      if (!skill || !Array.isArray(skill.plan)) return;
      const todo = skill.plan.find(p => !p.done);
      if (!todo) return;
      todo.done = cb.checked;
      todo.completedAt = today();
      saveSkills(skills);
      if (cb.checked) {
        li.classList.add('done');
        addExp(5, '完成一项学习任务');
        renderExpBar(getPlayerData().exp);
        renderActiveLearning();
        renderTodayTasks(); // 刷新，把刚完成的任务挪走
      }
    }

    /* ----- 最近经历 ----- */
    function renderRecentExp() {
      const exps = getExperiences()
        .filter(e => e.date)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 5);
      const list = document.getElementById('recentExpList');
      if (!exps.length) {
        list.innerHTML = `<li class="duo-empty">还没有记录，点上面按钮开始吧</li>`;
        return;
      }
      list.innerHTML = exps.map(e => `
        <li${SP_EXP}>
          <span class="duo-ico">${pickExpIcon(e.title)}</span>
          <div class="duo-body">
            <div class="duo-title">${escapeHtml(e.title)}</div>
          </div>
          <span class="duo-date">${formatShortDate(e.date)}</span>
        </li>`).join('');
    }

    /* ----- 正在学习 ----- */
    function renderActiveLearning() {
      const skills = getSkills().filter(s => s.status === 'learning' && Array.isArray(s.plan));
      const list = document.getElementById('activeLearningList');
      if (!skills.length) {
        list.innerHTML = `<li class="duo-empty">还没有学习目标</li>`;
        return;
      }
      const top = skills.slice(0, 3);
      list.innerHTML = top.map(s => {
        const total = s.plan.length;
        const done = s.plan.filter(p => p.done).length;
        const pct = total ? Math.round(done / total * 100) : 0;
        const next = s.plan.find(p => !p.done);
        const nextText = next ? (next.do || next.title || '—').slice(0, 18) : '已完成全部任务';
        return `<li>
            <span class="duo-ico">📈</span>
            <div class="duo-body">
              <div class="duo-title">${escapeHtml(s.name)}</div>
              <div class="duo-sub">下一步：${escapeHtml(nextText)}</div>
              <div class="mini-progress" style="margin-top:2px;">
                <div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%;"></div></div>
                <span class="mini-pct">${done}/${total}</span>
              </div>
            </div>
          </li>`;
      }).join('');
    }

    /* ----- 我的技能等级（自动分类） ----- */
    function renderSkillLevels() {
      const list = document.getElementById('skillLevelsList');
      const cats = computeCategoryLevels();
      if (!cats.length) {
        list.innerHTML = `<li class="sl-empty">还没有数据 — 多记几段经历就能看到你的技能等级啦 ✨</li>`;
        return;
      }
      const maxLv = cats[0].level;
      list.innerHTML = cats.slice(0, 6).map(c => {
        const pct = Math.min(100, Math.round(c.level / Math.max(maxLv, 1) * 100));
        return `<li>
            <img class="sl-ico" src="./assets/img/decor/skill/icons/${escapeHtml(c.icon)}.png" alt="" />
            <span class="sl-name">${escapeHtml(c.name)}</span>
            <div class="sl-bar"><div class="sl-bar-fill" style="width:${pct}%;"></div></div>
            <span class="sl-lv">Lv.${c.level}</span>
          </li>`;
      }).join('');
    }

    /* ----- 每日答案之书 ----- */
    const ANSWER_BOOK = [
      '慢慢来，比较比较快。',
      '不是所有的路都要立刻看见结果。',
      '今天的一小步，也是真实的一步。',
      '记录比完美更重要。',
      '你比自己以为的更有趣。',
      '把今天当作主线任务，不必急。',
      '值得做的事，值得慢慢做。',
      '先完成，再完美。',
      '想做的事情，不需要所有人都懂。',
      '下一次再说 ≠ 下一次会做。',
      '经验从来不会说谎。',
      '允许自己还没想清楚。',
      '想不清楚的时候，就去试试。',
      '成长不是一条直线。',
      '先把日子过起来。',
      '你不是没有进步，只是在爬坡。',
      '每天记一句，也是积累。',
      '普通人也有路。',
      '重要的不是开始得多漂亮，是没停下来。',
      '把"想做的事"记下来，它就更容易发生。',
      '今天认真吃饭、睡觉，也是主线任务。',
      '别拿别人的进度表，给自己的生活评分。',
      '走慢一点没关系，重点是还在走。',
      '心情不好也值得被记录。',
      '你不需要很"厉害"才能开始。',
      '想学什么就写下来，写下来就开始了。',
      '未来不靠空想，靠真实过过的每一天。',
      '失败了的事也值得记。',
      '你比想象中更了解自己。',
      '慢慢攒，时间看得见。'
    ];
    function pickAnswerForToday() {
      // 用日期做种子，每天稳定一句
        const d = today();
        let h = 0;
        for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
        return ANSWER_BOOK[h % ANSWER_BOOK.length];
    }
    function drawAnswer() {
      const text = pickAnswerForToday();
      const el = document.getElementById('answerText');
      if (!el) return;
      // 简单切换动画
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = '「' + text + '」';
        el.style.opacity = '1';
      }, 120);
    }

    /* ============================================================
       4) 首页渲染 (新版: 见上方 3.5 节)
       ============================================================ */
    // fillHome / renderCalendar / renderTodayTasks / renderRecentExp /
    // renderActiveLearning / drawAnswer 已在 3.5 节定义。

    function renderSkillGrid() {
      const skills = getSkills().filter(s => s.status === 'lit');
      const grid = document.getElementById('skillGrid');
      if (!grid) return; // 新版首页已用 skillLevelsList 承载，旧容器不存在时静默跳过
      if (!skills.length) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; font-size:12px; color:var(--c-text-soft); padding:10px;">记录经历并确认技能后，这里会逐渐长出来 ✨</div>`;
        return;
      }
      grid.innerHTML = skills.map(s => `
        <div class="skill-item confirmed" onclick="showSkillDetail('${escapeHtml(s.name)}')" style="cursor:pointer;" title="点击查看来源经历">
          <span class="dot"></span>
          <span class="name">${escapeHtml(s.name)}</span>
          <span class="tag">已确认</span>
        </div>`).join('');
    }

    /* ============================================================
       5) 技能详情弹窗（溯源）
       ============================================================ */
    function showSkillDetail(skillName) {
      const skill = getSkills().find(s => s.name === skillName);
      if (!skill) return;
      const exps = getExperiences();

      document.getElementById('skillDetailTitle').textContent = '🌳 ' + skillName;
      let html = '';

      if (skill.status === 'lit') {
        html += `<div style="font-size:12px; color:var(--c-text-soft); margin-bottom:12px;">✅ 这个技能已经通过真实经历确认</div>`;
        if (skill.sourceExpIds && skill.sourceExpIds.length) {
          skill.sourceExpIds.forEach(eid => {
            const exp = exps.find(e => e.id === eid);
            if (exp) {
              html += `
              <div class="skill-source-entry">
                <div class="skill-source-date">${escapeHtml(exp.date)}</div>
                <div class="skill-source-title">${escapeHtml(exp.title)}</div>
                <div class="skill-source-desc">${escapeHtml(exp.rawDesc)}</div>
              </div>`;
            }
          });
        } else {
          html += `<div style="font-size:12px; color:var(--c-text-soft);">（初始自带）</div>`;
        }
      } else {
        // 学习中的技能
        html += `<div style="font-size:12px; color:var(--c-warm-deep); margin-bottom:8px; font-weight:700;">状态：${statusLabel(skill.status)}</div>`;
        if (skill.goalText) {
          html += `<div class="skill-source-entry"><div class="skill-source-title">🎯 目标</div><div class="skill-source-desc">${escapeHtml(skill.goalText)}</div></div>`;
        }
        if (skill.breakdown && skill.breakdown.length) {
          html += `<div style="font-size:12px; font-weight:700; margin:10px 0 6px;">🧩 能力单元</div>`;
          skill.breakdown.forEach((unit, i) => {
            const unitStatus = unit.status || 'want';
            html += `<div class="skill-unit-item ${unitStatus}">
              <span class="skill-unit-status-dot ${unitStatus}"></span>
              <span class="skill-unit-name">${escapeHtml(unit.name)}</span>
              <span class="skill-unit-status-text">${statusLabel(unitStatus)}</span>
              ${unitStatus === 'verified' && unit.sourceExpId ? '<span class="skill-unit-badge">✓ 已验证</span>' : ''}
            </div>`;
          });
        }
        // 学习计划
        if (skill.plan && skill.plan.length) {
          html += `<div class="learn-plan-summary">`;
          html += renderPlanBlock(skill, skillName);
          html += `</div>`;
        }
        // 验证任务
        if (skill.verifyTask) {
          const verified = skill.status === 'verified' || skill.status === 'lit';
          html += `<div style="font-size:12px; font-weight:700; margin:12px 0 6px;">🏆 验证任务</div>`;
          html += `<div class="skill-source-entry" style="border-color:var(--c-warm-deep);">
            <div class="skill-source-desc">${escapeHtml(skill.verifyTask)}</div>
            ${verified ? '<div style="font-size:11px; color:var(--c-green-deep); margin-top:6px; font-weight:700;">✅ 已通过验证</div>' : '<div style="font-size:11px; color:var(--c-text-soft); margin-top:6px;">完成并记录真实经历后，技能将被正式点亮</div>'}
          </div>`;
        }
      }

      document.getElementById('skillDetailBody').innerHTML = html;
      document.getElementById('skillDetailModal').style.display = 'flex';
    }

    function closeSkillDetail() {
      document.getElementById('skillDetailModal').style.display = 'none';
    }
    document.getElementById('skillDetailModal').addEventListener('click', function(e) {
      if (e.target === this) closeSkillDetail();
    });

    function statusLabel(status) {
      const map = {
        'want': '想学习',
        'learning': '学习中',
        'practiced': '完成练习',
        'verified': '真实使用过',
        'lit': '正式点亮',
        'done': '已完成',
        'doing': '进行中'
      };
      return map[status] || status;
    }

    /* ============================================================
       6) 经历记录弹窗
       ============================================================ */
    let pendingExpId = null;

    function openExpModal() {
      document.getElementById('expModal').style.display = 'flex';
      document.getElementById('expDate').value = today();
      document.getElementById('expForm').querySelector('input[name=expTitle]').focus();
    }

    function closeExpModal() {
      document.getElementById('expModal').style.display = 'none';
      document.getElementById('expForm').reset();
    }

    document.getElementById('expModal').addEventListener('click', function(e) {
      if (e.target === this) closeExpModal();
    });

    /* ============================================================
       7) 经历保存 + AI 整理 + 技能提取
       ============================================================ */
    function analyzeExperience(rawTitle, rawDesc) {
      const text = (rawTitle + '。' + rawDesc).toLowerCase();
      const structured = {
        title: rawTitle,
        happened: '未记录',
        whatIDid: '未记录',
        result: '未记录',
        feeling: '未记录'
      };
      const sentences = rawDesc.split(/[。！？；\n]/).filter(s => s.trim());

      if (sentences.length >= 1) {
        structured.happened = sentences.slice(0, 2).join('。');
      }
      const iDid = sentences.filter(s => /我[做负责整理准备写完成参加找想尝试用看学]/.test(s));
      if (iDid.length) {
        structured.whatIDid = iDid.join('。');
      } else if (sentences.length > 2) {
        structured.whatIDid = sentences.slice(1, 3).join('。');
      } else if (sentences.length) {
        // 兜底：短文本整体作为「我做了什么」，避免出现未记录
        structured.whatIDid = sentences.join('。');
      }
      const resultSent = sentences.filter(s => /[结果最后最终终于拿到获得成功通过完成]/.test(s));
      if (resultSent.length) {
        structured.result = resultSent.join('。');
      }
      const feelingSent = sentences.filter(s => /[觉得感觉紧张害怕开心兴奋自豪焦虑轻松但虽然其实]/.test(s));
      if (feelingSent.length) {
        structured.feeling = feelingSent.join('。');
      }
      if (structured.happened === '未记录' && rawDesc) {
        structured.happened = rawDesc;
      }

      const suggestedSkills = [];
      const skillPatterns = [
        { pattern: /英文|english|全英/, skill: '英语表达' },
        { pattern: /汇报|演讲|发言|宣讲|路演|评审|述职|pre\b/, skill: '公开表达' },
        { pattern: /需求|调研|用户|痛点|竞品|访谈/, skill: '需求分析' },
        { pattern: /周报|邮件|纪要|方案|文档|报告|prd|ppt/, skill: '文档写作' },
        { pattern: /写|撰写|写作|文章|文案/, skill: '写作' },
        { pattern: /编程|代码|开发|python|java|程序|脚本/, skill: '编程' },
        { pattern: /设计|海报|原型|ps|figma|排版/, skill: '设计' },
        { pattern: /视频|剪辑|拍摄|摄影|pr|剪映|字幕|调色/, skill: '视频制作' },
        { pattern: /协作|合作|对接|跨部门|拉齐|分工/, skill: '沟通协作' },
        { pattern: /项目|排期|迭代|上线|复盘|推进|管理/, skill: '项目管理' },
        { pattern: /数据|统计|分析|excel|sql|看板|指标/, skill: '数据分析' },
        { pattern: /\bai\b|aigc|chatgpt|gpt|claude|提示词|大模型|copilot|提效/, skill: 'AI提效' },
        { pattern: /培训|分享|教学|讲解|带人/, skill: '培训分享' },
        { pattern: /策划|规划|方案|活动/, skill: '策划' },
        { pattern: /沟通|交流|谈判|协商|扯皮/, skill: '沟通表达' },
        { pattern: /独立|一个人|自己|搞定/, skill: '独立解决问题' },
        { pattern: /适应|融入|新环境|转行/, skill: '适应能力' },
        { pattern: /压力|焦虑|紧张|克服|坚持|加班/, skill: '抗压能力' },
        { pattern: /面试|简历|跳槽|晋升|述职|转正|谈薪/, skill: '求职晋升' },
        { pattern: /工作|上班|入职|实习|兼职|副业/, skill: '职业实践' },
        { pattern: /阅读|读书|课程|教程|网课|学习/, skill: '学习成长' },
      ];

      skillPatterns.forEach(sp => {
        if (sp.pattern.test(text)) {
          if (!suggestedSkills.includes(sp.skill)) {
            suggestedSkills.push(sp.skill);
          }
        }
      });

      return {
        structured,
        suggestedSkills: suggestedSkills.slice(0, 5)
      };
    }

    /* ----- 技能分类（22个职场分类，自动识别 + 等级累计） ----- */
    const SKILL_CATS = [
      { id: 'requirement', name: '需求分析', icon: 'compass',      kws: ['需求','调研','用户','痛点','竞品','原型','访谈','洞察','用户研究','需求文档','prd'] },
      { id: 'project',     name: '项目管理', icon: 'ruler',        kws: ['项目','排期','迭代','上线','复盘','推进','统筹','管理','对齐','里程碑','甘特','敏捷','scrum'] },
      { id: 'comm',        name: '沟通协作', icon: 'briefcase',    kws: ['沟通','协作','对接','同步','拉齐','跨部门','开会','对齐','谈判','协商','甩锅','扯皮'] },
      { id: 'speaking',    name: '公开表达', icon: 'mic',          kws: ['汇报','路演','评审','发言','演讲','答辩','述职','分享','ppt','presentation','pre','宣讲'] },
      { id: 'data',        name: '数据分析', icon: 'pie-chart',    kws: ['数据','分析','excel','sql','报表','看板','指标','统计','表格','pandas','可视化'] },
      { id: 'docwrite',    name: '文档写作', icon: 'file',         kws: ['文档','周报','邮件','纪要','方案','报告','总结','prd','ppt','wiki','材料'] },
      { id: 'coding',      name: '编程开发', icon: 'code',         kws: ['代码','编程','开发','debug','程序','算法','python','java','js','vue','sql','脚本','爬虫','部署'] },
      { id: 'design',      name: '设计',     icon: 'palette',      kws: ['设计','海报','排版','ui','figma','ps','视觉','素材','封面','插画','原型'] },
      { id: 'ai',          name: 'AI提效',   icon: 'laptop',       kws: ['aigc','chatgpt','gpt','claude','提示词','prompt','大模型','copilot','midjourney','deepseek','kimi','文心一言','通义','提效','智能体'] },
      { id: 'english',     name: '英语能力', icon: 'globe',        kws: ['英语','英文','口语','单词','雅思','托福','四六级','六级','四级','邮件','会议'] },
      { id: 'photo',       name: '摄影',     icon: 'camera',       kws: ['摄影','拍照','拍片','相机','photo','camera','shoot','vlog','录像','拍'] },
      { id: 'media',       name: '视频制作', icon: 'star',         kws: ['视频','剪辑','短片','剪映','pr','导演','vlog','后期','字幕','调色'] },
      { id: 'career',      name: '求职晋升', icon: 'school',       kws: ['入职','转正','述职','绩效','离职','跳槽','面试','简历','求职','晋升','谈薪','offer','试用期','秋招','春招'] },
      { id: 'growth',      name: '学习成长', icon: 'diploma',      kws: ['课程','培训','网课','考证','教程','考试','学习','复盘','成长','证书','mooc'] },
      { id: 'reading',     name: '阅读',     icon: 'book',         kws: ['阅读','读书','看书','书评','读完','一本书','听书'] },
      { id: 'writing',     name: '创作写作', icon: 'notebook',     kws: ['写','文章','投稿','稿','博客','日记','公众号','文案','创作','写作'] },
      { id: 'art',         name: '绘画',     icon: 'paintbrush',   kws: ['画','插画','油画','水彩','素描','手绘','板绘'] },
      { id: 'travel',      name: '旅行',     icon: 'plane',        kws: ['旅行','出行','旅游','city walk','citywalk','去看看','度假'] },
      { id: 'sport',       name: '运动',     icon: 'fire',         kws: ['运动','跑步','羽毛球','篮球','足球','瑜伽','健身房','锻炼','打球','游泳','骑行'] },
      { id: 'mount',       name: '户外登山', icon: 'mountain',     kws: ['登山','徒步','露营','爬山','户外'] },
      { id: 'survey',      name: '行业调研', icon: 'map',          kws: ['调研','考察','行业','竞品','探索','发现','田野','市场'] },
      { id: 'idea',        name: '创新思维', icon: 'lightbulb',    kws: ['灵感','想法','创意','突然想到','点子','头脑风暴'] },
    ];
    const SKILL_CAT_BY_ID = Object.fromEntries(SKILL_CATS.map(c => [c.id, c]));

    function autoClassify(text) {
      const t = (text || '').toLowerCase();
      const hits = [];
      SKILL_CATS.forEach(c => {
        for (const k of c.kws) {
          if (t.includes(k.toLowerCase())) {
            hits.push(c.id);
            break;
          }
        }
      });
      return hits;
    }

    // 计算每个分类的等级
    function computeCategoryLevels() {
      const map = {}; // catId -> { count, linked }
      const bump = (id) => { map[id] = (map[id] || 0) + 1; };
      // 1. 经历自动分类
      getExperiences().forEach(e => {
        const txt = (e.title || '') + ' ' + (e.rawDesc || '');
        autoClassify(txt).forEach(bump);
      });
      // 2. 学习计划任务自动分类（完成的）
      getSkills().forEach(s => {
        if (!Array.isArray(s.plan)) return;
        s.plan.forEach(p => {
          if (!p.done) return;
          autoClassify((p.do || '') + ' ' + (p.title || '')).forEach(bump);
        });
      });
      // 转成 [{id, name, icon, level, count}]
      return SKILL_CATS
        .map(c => ({ ...c, count: map[c.id] || 0, level: (map[c.id] || 0) + 1 }))
        .filter(c => c.count > 0)
        .sort((a, b) => b.count - a.count);
    }

    function calcExpForExp(exp) {
      let base = 30;
      if (exp.rawDesc && exp.rawDesc.length > 50) base += 10;
      if (exp.rawDesc && exp.rawDesc.length > 150) base += 10;
      if (exp.suggestedSkills && exp.suggestedSkills.length >= 3) base += 15;
      return base;
    }

    function calcExpForSkill() {
      return 20;
    }

    document.getElementById('expForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const fd = new FormData(this);
      const rawDate = (fd.get('expDate') || '').trim();
      const rawTitle = (fd.get('expTitle') || '').trim();
      const rawDesc = (fd.get('expDesc') || '').trim();

      if (!rawDate || !rawTitle) { alert('日期和标题不能为空哦～'); return; }

      const analysis = analyzeExperience(rawTitle, rawDesc);

      const exp = {
        id: Date.now(),
        date: rawDate,
        title: rawTitle,
        rawDesc: rawDesc,
        structured: analysis.structured,
        suggestedSkills: analysis.suggestedSkills,
        confirmedSkills: [],
        skillConfirmed: false
      };

      const list = getExperiences();
      list.unshift(exp);
      saveExperiences(list);

      closeExpModal();

      const expGain = calcExpForExp(exp);
      addExp(expGain, '记录经历');

      if (analysis.suggestedSkills.length > 0) {
        pendingExpId = exp.id;
        showSkillConfirmModal(analysis.suggestedSkills);
      } else {
        goPage('page-explog');
      }
    });

    /* ============================================================
       8) 技能确认弹窗
       ============================================================ */
    function showSkillConfirmModal(suggestedSkills) {
      const list = document.getElementById('skillConfirmList');
      const existingSkills = getSkills().map(s => s.name);

      list.innerHTML = suggestedSkills.map(sk => {
        const already = existingSkills.includes(sk);
        return `
          <label class="skill-confirm-item ${already ? 'already' : ''}">
            <input type="checkbox" value="${escapeHtml(sk)}" ${already ? 'disabled checked' : ''} />
            <span class="skill-confirm-name">${escapeHtml(sk)}</span>
            ${already ? '<span class="skill-confirm-badge">已有</span>' : ''}
          </label>`;
      }).join('');

      document.getElementById('skillCustomInput').value = '';
      document.getElementById('skillConfirmModal').style.display = 'flex';
    }

    function closeSkillConfirm() {
      document.getElementById('skillConfirmModal').style.display = 'none';
      pendingExpId = null;
      goPage('page-explog');
    }

    function confirmSkills() {
      if (!pendingExpId) { closeSkillConfirm(); return; }

      const checkboxes = document.querySelectorAll('#skillConfirmList input[type=checkbox]:checked:not(:disabled)');
      const customInput = document.getElementById('skillCustomInput').value.trim();
      const selected = [];
      checkboxes.forEach(cb => selected.push(cb.value));
      if (customInput) selected.push(customInput);

      const exps = getExperiences();
      const exp = exps.find(e => e.id === pendingExpId);
      if (exp) {
        exp.confirmedSkills = selected;
        exp.skillConfirmed = true;
        saveExperiences(exps);
      }

      const skills = getSkills();
      let newCount = 0;
      selected.forEach(sk => {
        const existing = skills.find(s => s.name === sk);
        if (existing) {
          if (!existing.sourceExpIds.includes(pendingExpId)) {
            existing.sourceExpIds.push(pendingExpId);
          }
          // 如果这个技能原本是学习中的，现在通过真实经历验证了
          if (existing.status && existing.status !== 'lit') {
            existing.status = 'lit';
            existing.verifiedAt = today();
          }
        } else {
          skills.push({
            name: sk,
            sourceExpIds: [pendingExpId],
            confirmedAt: today(),
            status: 'lit',
            treeIds: []
          });
          newCount++;
        }
      });
      saveSkills(skills);

      if (selected.length > 0) {
        addExp(calcExpForSkill() * selected.length, '确认技能');
      }

      closeSkillConfirm();
    }

    document.getElementById('skillConfirmModal').addEventListener('click', function(e) {
      if (e.target === this) closeSkillConfirm();
    });

    /* ============================================================
       9) 经历库渲染
       ============================================================ */
    function renderExpLog() {
      const list = getExperiences();
      const container = document.getElementById('explogList');
      const empty = document.getElementById('explogEmpty');

      if (!list.length) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
      }

      empty.style.display = 'none';

      list.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.id - a.id;
      });

      container.innerHTML = list.map(exp => {
        const s = exp.structured || {};
        const needsConfirm = exp.suggestedSkills && exp.suggestedSkills.length > 0 && !exp.skillConfirmed;

        return `
          <div class="exp-entry pixel-card"${SP_EXP}>
            <div class="exp-entry-header">
              <span class="exp-date">${escapeHtml(exp.date)}</span>
              <span class="exp-title">${escapeHtml(exp.title)}</span>
              <button class="exp-del" onclick="deleteExp(${exp.id})" title="删除">✕</button>
            </div>

            <div class="exp-structured">
              <div class="exp-field"><span class="exp-field-label">发生了什么</span><span class="exp-field-val">${escapeHtml(s.happened || '未记录')}</span></div>
              <div class="exp-field"><span class="exp-field-label">我做了什么</span><span class="exp-field-val">${escapeHtml(s.whatIDid || '未记录')}</span></div>
              <div class="exp-field"><span class="exp-field-label">结果</span><span class="exp-field-val">${escapeHtml(s.result || '未记录')}</span></div>
              <div class="exp-field"><span class="exp-field-label">我的感受</span><span class="exp-field-val">${escapeHtml(s.feeling || '未记录')}</span></div>
            </div>

            <div class="exp-raw-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'; this.textContent=this.nextElementSibling.style.display==='none'?'▶ 查看原始输入':'▼ 收起原始输入'">
              ▶ 查看原始输入
            </div>
            <div class="exp-raw-text" style="display:none;">${escapeHtml(exp.rawDesc)}</div>

            ${exp.suggestedSkills && exp.suggestedSkills.length ? `
              <div class="exp-skills-section">
                <div class="exp-skills-label">🧐 可能涉及的技能：</div>
                <div class="exp-skills-tags">
                  ${exp.suggestedSkills.map(sk => {
                    const confirmed = exp.confirmedSkills && exp.confirmedSkills.includes(sk);
                    return `<span class="exp-skill-tag ${confirmed ? 'confirmed' : 'suggested'}">${escapeHtml(sk)}${confirmed ? ' ✓' : ''}</span>`;
                  }).join('')}
                </div>
                ${needsConfirm ? `<button class="btn-pixel primary" style="margin-top:8px; font-size:12px; padding:6px 12px;" onclick="reopenSkillConfirm(${exp.id})">确认我的技能</button>` : ''}
              </div>
            ` : ''}
          </div>`;
      }).join('');
    }

    function reopenSkillConfirm(expId) {
      const exp = getExperiences().find(e => e.id === expId);
      if (!exp || !exp.suggestedSkills) return;
      pendingExpId = expId;
      showSkillConfirmModal(exp.suggestedSkills);
    }

    function deleteExp(id) {
      if (!confirm('确定要删除这段经历吗？')) return;
      let list = getExperiences().filter(e => e.id !== id);
      saveExperiences(list);

      const skills = getSkills();
      skills.forEach(s => {
        if (s.sourceExpIds) s.sourceExpIds = s.sourceExpIds.filter(eid => eid !== id);
      });
      const remaining = skills.filter(s => s.sourceExpIds.length > 0 || s.status !== 'lit');
      saveSkills(remaining);

      renderExpLog();
      renderSkillGrid();
    }

    /* ============================================================
       10) 技能树页面
       ============================================================ */
    let currentTreeFilter = 'all';

    function switchTreeTab(treeId) {
      currentTreeFilter = treeId;
      document.querySelectorAll('.tree-tab').forEach(t => t.classList.remove('active'));
      document.querySelector(`.tree-tab[data-tree="${treeId}"]`).classList.add('active');
      renderSkillTree();
    }

    function renderTreeTabs() {
      const trees = getTrees();
      const tabsEl = document.getElementById('treeTabs');
      let html = `<div class="tree-tab ${currentTreeFilter === 'all' ? 'active' : ''}" data-tree="all" onclick="switchTreeTab('all')">全部</div>`;
      trees.forEach(tree => {
        html += `<div class="tree-tab ${currentTreeFilter === tree.id ? 'active' : ''}" data-tree="${escapeHtml(tree.id)}" onclick="switchTreeTab('${escapeHtml(tree.id)}')">${escapeHtml(tree.name)}</div>`;
      });
      tabsEl.innerHTML = html;
    }

    function renderSkillTree() {
      const skills = getSkills();
      const exps = getExperiences();
      const trees = getTrees();

      // 根据当前筛选条件过滤技能
      let filteredSkills = skills;
      if (currentTreeFilter !== 'all') {
        filteredSkills = skills.filter(s => {
          if (s.treeIds && s.treeIds.includes(currentTreeFilter)) return true;
          if (s.goalTreeId === currentTreeFilter) return true;
          return false;
        });
      }

      // 分类
      const owned = filteredSkills.filter(s => s.status === 'lit');
      const learning = filteredSkills.filter(s => s.status && s.status !== 'lit');

      // 渲染左边：已拥有
      const ownedEl = document.getElementById('ownedSkillList');
      if (!owned.length) {
        ownedEl.innerHTML = `<div class="st-empty">记录真实经历并确认技能后，这里会逐渐长出来 ✨</div>`;
      } else {
        ownedEl.innerHTML = owned.map(s => {
          const sourceCount = (s.sourceExpIds || []).length;
          const treeNames = (s.treeIds || []).map(tid => trees.find(t => t.id === tid)).filter(Boolean).map(t => t.name);
          return `<div class="st-skill-node lit"${SP_SKILL} onclick="showSkillDetail('${escapeHtml(s.name)}')">
            <span class="st-node-dot lit"></span>
            <span class="st-node-name">${escapeHtml(s.name)}</span>
            ${sourceCount ? `<span class="st-node-meta">${sourceCount}段经历</span>` : ''}
            ${treeNames.length ? `<span class="st-node-tree">${treeNames.map(n => escapeHtml(n)).join(' · ')}</span>` : ''}
          </div>`;
        }).join('');
      }

      // 渲染右边：学习中
      const learnEl = document.getElementById('learningSkillList');
      if (!learning.length) {
        learnEl.innerHTML = `<div class="st-empty">点击下方按钮，告诉AI你想学什么 🌱</div>`;
      } else {
        learnEl.innerHTML = learning.map(s => {
          const statusClass = s.status || 'want';
          const treeName = s.goalTreeId ? (trees.find(t => t.id === s.goalTreeId) || {}).name : '';
          // 计算学习进度
          let progress = '';
          if (s.plan && s.plan.length) {
            const done = s.plan.filter(t => t.done).length;
            progress = `${done}/${s.plan.length}`;
          }
          return `<div class="st-skill-node ${statusClass}"${SP_SKILL} onclick="showSkillDetail('${escapeHtml(s.name)}')">
            <span class="st-node-dot ${statusClass}"></span>
            <span class="st-node-name">${escapeHtml(s.name)}</span>
            <span class="st-node-status">${statusLabel(s.status)}</span>
            ${progress ? `<span class="st-node-meta">${progress}</span>` : ''}
            ${treeName ? `<span class="st-node-tree">${escapeHtml(treeName)}</span>` : ''}
          </div>`;
        }).join('');
      }
    }

    /* ============================================================
       11) 新建成长方向
       ============================================================ */
    function openNewTreeModal() {
      document.getElementById('newTreeName').value = '';
      document.getElementById('newTreeDesc').value = '';
      // 显示已有技能供勾选
      const skills = getSkills().filter(s => s.status === 'lit');
      const listEl = document.getElementById('newTreeSkillList');
      if (!skills.length) {
        listEl.innerHTML = `<div style="font-size:11px; color:var(--c-text-soft);">还没有已确认的技能</div>`;
      } else {
        listEl.innerHTML = skills.map(s => `
          <label class="skill-confirm-item" style="margin-bottom:4px;">
            <input type="checkbox" value="${escapeHtml(s.name)}" />
            <span class="skill-confirm-name">${escapeHtml(s.name)}</span>
          </label>`).join('');
      }
      document.getElementById('newTreeModal').style.display = 'flex';
    }

    function closeNewTreeModal() {
      document.getElementById('newTreeModal').style.display = 'none';
    }

    document.getElementById('newTreeModal').addEventListener('click', function(e) {
      if (e.target === this) closeNewTreeModal();
    });

    function saveNewTree() {
      const name = document.getElementById('newTreeName').value.trim();
      if (!name) { alert('给方向起个名字吧～'); return; }
      const desc = document.getElementById('newTreeDesc').value.trim();

      // 获取勾选的技能
      const checked = document.querySelectorAll('#newTreeSkillList input[type=checkbox]:checked');
      const skillNames = [];
      checked.forEach(cb => skillNames.push(cb.value));

      const tree = {
        id: uid(),
        name: name,
        desc: desc,
        createdAt: today()
      };

      const trees = getTrees();
      trees.push(tree);
      saveTrees(trees);

      // 把技能关联到这个方向
      if (skillNames.length) {
        const skills = getSkills();
        skillNames.forEach(sn => {
          const s = skills.find(sk => sk.name === sn);
          if (s) {
            if (!s.treeIds) s.treeIds = [];
            if (!s.treeIds.includes(tree.id)) s.treeIds.push(tree.id);
          }
        });
        saveSkills(skills);
      }

      closeNewTreeModal();
      renderTreeTabs();
      renderSkillTree();
    }

    /* ============================================================
       12) 我想学新技能
       ============================================================ */
    function openLearnGoalModal() {
      document.getElementById('learnWhat').value = '';
      document.getElementById('learnDuration').value = '';
      document.getElementById('learnTimePerDay').value = '';

      // 填充成长方向下拉
      const trees = getTrees();
      const sel = document.getElementById('learnTreeId');
      sel.innerHTML = `<option value="">不放入任何方向</option>`;
      trees.forEach(t => {
        sel.innerHTML += `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`;
      });

      document.getElementById('learnGoalModal').style.display = 'flex';
    }

    function closeLearnGoalModal() {
      document.getElementById('learnGoalModal').style.display = 'none';
    }

    document.getElementById('learnGoalModal').addEventListener('click', function(e) {
      if (e.target === this) closeLearnGoalModal();
    });

    function submitLearnGoal() {
      const what = document.getElementById('learnWhat').value.trim();
      if (!what) { alert('说说你想学什么吧～'); return; }

      const duration = document.getElementById('learnDuration').value.trim();
      const timePerDay = document.getElementById('learnTimePerDay').value.trim();
      const treeId = document.getElementById('learnTreeId').value;

      const fullText = what + ' ' + duration + ' ' + timePerDay;
      const assumptions = [];

      // ---- 提取时长（缺省做保守假设并标注） ----
      let days = 0;
      const dayMatch = fullText.match(/(\d+)\s*[天日]/);
      const monthMatch = fullText.match(/(\d+)\s*个?月/);
      const weekMatch = fullText.match(/(\d+)\s*个?星期|(\d+)\s*周/);
      if (dayMatch) days = parseInt(dayMatch[1]);
      else if (monthMatch) days = parseInt(monthMatch[1]) * 30;
      else if (weekMatch) days = parseInt(weekMatch[1] || weekMatch[2]) * 7;
      if (!days && duration) {
        const numMatch = duration.match(/(\d+)/);
        if (numMatch) days = parseInt(numMatch[1]);
      }
      if (!days) {
        days = 30;
        assumptions.push('时长没写，先按 30 天排——想改的话，在目标里写上"3个月 / 两周"重新生成就好');
      }

      // ---- 提取每天时间 ----
      let minutesPerDay = 0;
      const hourMatch = fullText.match(/(\d+(?:\.\d+)?)\s*个?小时/);
      const minMatch = fullText.match(/(\d+)\s*分钟/);
      if (hourMatch) minutesPerDay = Math.round(parseFloat(hourMatch[1]) * 60);
      else if (minMatch) minutesPerDay = parseInt(minMatch[1]);
      if (!minutesPerDay) {
        minutesPerDay = 60;
        assumptions.push('每天投入时间先按 1 小时排');
      }

      // ---- 提取基础 ----
      let isZero = /零基础|完全不会|没接触过|没用过|小白|从零/.test(fullText);
      const hasExperience = !isZero && /有一点|有一些|用过|学过一点|会一点|有点基础|学过/.test(fullText);
      const wantsAdvanced = /精通|专业级|高级|深入|系统/.test(fullText);
      if (!isZero && !hasExperience) {
        // 与"保守假设"标注保持一致：默认按零基础起步
        isZero = true;
        assumptions.push('基础先按零基础起步排（有基础的话进度会更快）');
      }

      // ---- 匹配领域，直接生成 ----
      const domain = matchDomain(fullText);
      const skillName = domain ? domain.name : extractSkillName(what);
      const unitDefs = buildUnitDefs(domain, { isZero, hasExperience, wantsAdvanced, what });
      const verifyTask = domain ? domain.verifyTask : genericVerifyTask(what);
      const plan = aiGeneratePlan(unitDefs, days, minutesPerDay, verifyTask);

      // ---- 保存技能 ----
      const skills = getSkills();
      let finalName = skillName;
      if (skills.find(s => s.name === finalName)) finalName = skillName + '（' + today() + '）';

      skills.push({
        name: finalName,
        status: 'learning',
        sourceExpIds: [],
        confirmedAt: null,
        goalText: what,
        goalDuration: duration || (days + '天'),
        goalTreeId: treeId || null,
        assumptions: assumptions,
        breakdown: unitDefs.map((u, i) => ({
          id: 'u' + i,
          name: u.name,
          phase: u.phase,
          status: 'want',
          sourceExpId: null
        })),
        plan: plan,
        verifyTask: verifyTask,
        treeIds: treeId ? [treeId] : []
      });
      saveSkills(skills);

      closeLearnGoalModal();
      renderTreeTabs();
      renderSkillTree();
      showLearnPlanModal(finalName);
      addExp(15, '设定学习目标');
    }

    /* ============================================================
       13) 领域知识库 + 技能拆解
       质量底线：每个任务必须"具体、能做、有结果"——
       用户看完就知道今天做什么、做到什么程度算完成。
       ============================================================ */
    const PHASE_NAMES = {
      1: '🌱 第一阶段 · 打基础',
      2: '🎯 第二阶段 · 核心练习',
      3: '🚀 第三阶段 · 整合实战'
    };

    const DOMAIN_LIB = [
      /* ---------- 雅思 ---------- */
      {
        key: 'ielts', name: '雅思',
        patterns: [/雅思|ielts/],
        verifyTask: '完整模拟一次雅思考试：听力+阅读+写作+口语同一天完成（口语录音、写作手写），按官方标准给自己估一个总分，并把这次经历记录下来。',
        units: [
          { name: '听力 · 精听与定位', tasks: [
            { do: '做一篇剑桥雅思听力 Section 1：第一遍正常做题；第二遍逐句暂停，把没听出来的词全部写下来，按"不认识 / 认识但没反应过来 / 连读吞音"分类', time: '40分钟', standard: '一页分类清单，至少 10 个词' },
            { do: '练定位法：读题时先圈出关键词（数字/专有名词/转折词），听的时候只盯关键词前后，不追求听懂每个词', time: '30分钟', standard: '能说出每道题自己是靠哪个词定位到的' },
            { do: '精听一段 Section 3 学术对话：逐句听写，一句最多重播 3 遍，然后对照原文用红笔标出听错的地方', time: '40分钟', standard: '听写准确率 70% 以上' },
            { do: '限时完成一个完整 Section 并对答案，把错题原因分成"走神 / 词汇不认识 / 连读没听出 / 语速跟不上"四类，找出今天最主要的一种', time: '35分钟', standard: '失分主因明确，写在笔记里', repeat: true },
          ]},
          { name: '阅读 · 定位与同义替换', tasks: [
            { do: '限时 20 分钟完成一篇雅思阅读真题，做完把错题分成"没定位到 / 没认出同义替换 / 句子没读懂 / 时间不够"，找出今天最主要的失分原因', time: '40分钟', standard: '错题全部归因，主因明确', repeat: true },
            { do: '把今天做过的阅读里"题目↔原文"的同义替换抄成词对卡片（例如 rely on → depend on）', time: '25分钟', standard: '至少 8 组替换词对' },
            { do: '挑一篇剑桥阅读，把其中的长难句逐句翻译成中文写下来，再对照官方译文检查偏差', time: '40分钟', standard: '独立翻出 10 个长难句' },
            { do: '专攻一种你最错的题型（判断题/段落匹配/填空），连做 4 组同题型，总结出自己的三步解题流程', time: '45分钟', standard: '写出自己的解题步骤（3 步以上）' },
          ]},
          { name: '写作 · 大小作文', tasks: [
            { do: '搭 Task 1 框架：开头一句改写题目 + 两个主体段（各写一个最明显的趋势或对比）+ 结尾一句总括；用一套剑桥真题的数据亲手写一遍', time: '30分钟', standard: '能不看范例默写框架' },
            { do: '限时 25 分钟写一篇 Task 1，写完找一篇 7 分范文逐句对照，圈出范文有而你没有的数据表达', time: '50分钟', standard: '一篇完整小作文 + 一张差距清单' },
            { do: '给 5 个 Task 2 高频话题（教育/科技/环境/工作/社会）各列一份提纲：观点 + 2 个支持理由 + 1 个反例，不写全文', time: '35分钟', standard: '5 份提纲，每份 3 分钟内能口头展开' },
            { do: '限时 40 分钟写一篇 Task 2 大作文，写完用三问自查：观点有没有回应题目？每段有没有例子？连接词是不是只会用 however？', time: '50分钟', standard: '一篇完整大作文 + 自查结果', repeat: true },
          ]},
          { name: '口语 · Part 1/2/3', tasks: [
            { do: '把当季口语题库 Part 1 的 20 个话题各回答一遍并录音，回听标出所有卡壳超过 3 秒的地方', time: '40分钟', standard: '20 段录音 + 卡壳清单' },
            { do: '做 Part 2 素材卡：准备 5 张"人物 / 地点 / 经历 / 物品 / 想法"素材卡，尝试用同一张卡覆盖 2 个不同话题', time: '40分钟', standard: '5 张素材卡，每张能讲满 2 分钟' },
            { do: '随机抽一个 Part 2 话题，限时 1 分钟准备，录音说满 2 分钟；回听数一下"emm / 就是说"出现的次数并记下来', time: '20分钟', standard: '一段 2 分钟录音 + 口头禅统计', repeat: true },
            { do: '练 Part 3 思路：抽 5 道抽象题，用"直接回答 → 两个角度 → 举一个例子"的结构口头回答并录音', time: '30分钟', standard: '5 段结构完整的录音' },
          ]},
          { name: '整套真题实战', tasks: [
            { do: '按考试时间完整做一套剑桥真题：听力 40 分钟 + 阅读 60 分钟连做、中间不休息；对答案算分，写三行复盘——哪里掉分最多 / 为什么 / 明天补哪块', time: '约 3 小时（可拆两个半天）', standard: '一套完整成绩 + 三行复盘', repeat: true },
          ]},
        ]
      },
      /* ---------- 托福 / 四六级 / 考研英语 ---------- */
      {
        key: 'eng-exam', name: '英语考试',
        patterns: [/托福|toefl|四六级|四级|六级|cet|考研英语|专四|专八/],
        verifyTask: '按考试时间完整做一套真题并算分，写三行复盘：哪里掉分最多、为什么、接下来补哪块，并记录为一段真实经历。',
        units: [
          { name: '听力 · 精听', tasks: [
            { do: '精听一篇真题听力：第一遍做题，第二遍逐句暂停跟读，把没听出来的词按"不认识 / 没反应过来 / 连读吞音"分类记录', time: '40分钟', standard: '一页分类清单，至少 10 个词' },
            { do: '限时做一套听力真题，对答案后把错题原因分成"走神 / 词汇 / 语速 / 题没读完"四类，找出主要失分原因', time: '35分钟', standard: '失分主因明确', repeat: true },
          ]},
          { name: '阅读 · 定位与替换', tasks: [
            { do: '限时做一篇阅读真题，把错题分成"没定位到 / 没认出同义替换 / 句子没读懂 / 时间不够"，找出今天最主要的失分原因', time: '35分钟', standard: '错题全部归因', repeat: true },
            { do: '把这篇阅读里题目和原文的同义替换抄成词对卡片', time: '25分钟', standard: '至少 8 组替换词对' },
          ]},
          { name: '写作与词汇', tasks: [
            { do: '限时写一篇考试作文，写完对照一篇高分范文逐句圈出差距（哪里没例子 / 哪里连接生硬 / 哪个表达中式）', time: '50分钟', standard: '一篇作文 + 一张差距清单' },
            { do: '背一篇高分范文后合上默写，对照原文标出漏掉的连接词和好表达，抄进自己的本子', time: '30分钟', standard: '默写还原 80% 以上' },
            { do: '记一组真题高频词（50 个）：先全部过一遍，只挑出"完全不认识"的重点背，背完让同学抽 20 个', time: '40分钟', standard: '抽查 20 个对 18 个' },
          ]},
          { name: '整套真题实战', tasks: [
            { do: '按考试时间完整做一套真题（含作文），对答案算分，写三行复盘：哪里掉分最多 / 为什么 / 明天补哪块', time: '约 2.5 小时（可拆两个半天）', standard: '一套完整成绩 + 三行复盘', repeat: true },
          ]},
        ]
      },
      /* ---------- 英语口语（非考试） ---------- */
      {
        key: 'eng-speaking', name: '英语口语',
        patterns: [/英语口语|口语|spoken|英音|美音|英文对话|和外国人/],
        verifyTask: '和真人进行一次 15 分钟以上的全英文对话（语伴/外教/同学均可），结束后写下 3 句当时想说但没说出来的话。',
        units: [
          { name: '发音与语调', tasks: [
            { do: '选一段 1 分钟的英文视频做 shadowing：听一句跟一句，模仿到语调几乎一样，录下来和原音对比', time: '30分钟', standard: '录音和原音听不出明显语调差异' },
          ]},
          { name: '日常表达', tasks: [
            { do: '用英语自言自语描述今天做了什么并录音 3 分钟；回听记下 3 处卡壳，查好说法后再录一遍', time: '20分钟', standard: '两版录音，第二版卡壳明显减少' },
            { do: '随机抽一个话题，用"观点 + 两个理由 + 一个例子"的结构口头说满 2 分钟并录音', time: '20分钟', standard: '一段结构完整的 2 分钟录音', repeat: true },
          ]},
          { name: '真实对话', tasks: [
            { do: '和真人用英语对话 15 分钟（语伴/外教/同学），结束后写下 3 句当时没说出来的句子', time: '15分钟', standard: '对话真的发生了 + 3 句补充', repeat: true },
          ]},
        ]
      },
      /* ---------- 摄影 ---------- */
      {
        key: 'photography', name: '摄影',
        patterns: [/摄影|相机|拍人像|手动模式|单反|微单|拍照/],
        verifyTask: '使用手动模式（M档），独立完成一组 8 张以上的人像作品并做基础后期，发给被拍的人确认满意。',
        units: [
          { name: '曝光三要素', tasks: [
            { do: '用同一个场景拍 9 张照片：3 张只改光圈、3 张只改快门、3 张只改 ISO，每组记下参数；最后不看教程，自己说出三个参数分别控制什么、互相怎么影响', time: '45分钟', standard: '9 张照片 + 能独立讲清三要素' },
            { do: '用 M 档在室内拍一张曝光正常的照片，只允许看直方图判断曝光，不许靠屏幕效果猜', time: '20分钟', standard: '直方图不贴左右两侧', repeat: true },
          ]},
          { name: '对焦与景深', tasks: [
            { do: '拍一组对比照片：同一朵花用最近对焦距离和最远对焦距离各拍一张，再用最大光圈和最小光圈各拍一张，观察背景虚化的变化', time: '30分钟', standard: '4 张对比照，能说清光圈和对焦距离分别怎么影响虚化' },
            { do: '练手动选对焦点：给会动的对象（人/宠物）拍 10 张，要求每张眼睛都清晰', time: '30分钟', standard: '10 张里至少 8 张眼睛清晰', repeat: true },
          ]},
          { name: '构图', tasks: [
            { do: '带着"三分法、对称、引导线、框架"四种构图出门拍一小时，每种至少拍 3 张，回家各标出最好的一张', time: '60分钟', standard: '12 张照片 + 4 张精选' },
            { do: '选一张你最喜欢的照片，分析它的构图、光线和拍摄时机，写 100 字', time: '20分钟', standard: '一段 100 字的照片分析' },
          ]},
          { name: '光线', tasks: [
            { do: '同一个人分别在大中午直射光下、树荫下、傍晚黄金时刻各拍一张半身像，对比皮肤质感和阴影差别', time: '40分钟', standard: '3 张对比照 + 能说出哪种光最适合人像' },
          ]},
          { name: '人像实战', tasks: [
            { do: '给一位朋友拍一组 10 张的人像：拍之前先聊 5 分钟让对方放松，想好 3 个姿势和 2 个机位；拍完挑 3 张做基础后期发给对方', time: '90分钟', standard: '交付一组人像作品', repeat: true },
          ]},
        ]
      },
      /* ---------- 视频剪辑 ---------- */
      {
        key: 'video', name: '视频剪辑',
        patterns: [/premiere|剪映|剪辑|剪视频|final cut|达芬奇|vlog|视频制作/],
        verifyTask: '使用至少 10 段原始素材，独立剪出一条 60 秒以上、带字幕和配乐的完整视频，发布出去或交付给需要的人。',
        units: [
          { name: '素材管理与粗剪', tasks: [
            { do: '新建项目导入 10 段素材，按"废镜头 / 可用 / 精选"分三堆，把精选素材在时间线上粗排一遍，剪出一条 60 秒的无声粗剪', time: '60分钟', standard: '一条 60 秒粗剪时间线' },
            { do: '只用快捷键（剪切 C / 选择 V）完成一条 30 秒视频的全部剪切，全程不碰鼠标', time: '40分钟', standard: '全程快捷键完成' },
          ]},
          { name: '节奏', tasks: [
            { do: '把同一段素材剪两版：一版平均每 3 秒一个镜头、一版平均每 6 秒一个镜头，配同一首音乐播放对比，写下哪版更合适以及为什么', time: '50分钟', standard: '两版对比 + 一段判断理由' },
          ]},
          { name: '音频与字幕', tasks: [
            { do: '给一条视频做声音处理：BGM 音量压到人声以下、人声降噪、在转场处加一个音效；导出后戴耳机检查人声和音乐不打架', time: '40分钟', standard: '戴耳机听，人声清晰、音乐不抢' },
            { do: '给一条 2 分钟的视频上完所有字幕：统一字体字号、在安全区内、每句不超过 15 字，看完只需要改 3 处以内', time: '50分钟', standard: '一条完整字幕视频' },
          ]},
          { name: '调色与导出', tasks: [
            { do: '用调色工具给同一条视频调三种风格（明亮日系 / 电影感冷暖对比 / 黑金），导出三个版本对比', time: '50分钟', standard: '3 个导出版本' },
            { do: '按平台正确规格导出一条 1080p 视频（H.264、码率合理），检查清晰度和文件大小', time: '25分钟', standard: '导出文件规格正确、清晰度无损' },
          ]},
          { name: '完整作品', tasks: [
            { do: '从拍/找素材到剪完发布，独立完成一条 60 秒以上、有明确主题的完整视频（含字幕和配乐）', time: '约 3 小时（可分几天）', standard: '一条发布出去的成片', repeat: true },
          ]},
        ]
      },
      /* ---------- 做饭 ---------- */
      {
        key: 'cooking', name: '做饭',
        patterns: [/做饭|烹饪|烧菜|炒菜|厨艺|家常菜|下厨/],
        verifyTask: '连续 3 天独立完成一荤一素一汤的晚餐，其中至少 2 道菜是第一次做的，家人或室友吃完给出评价。',
        units: [
          { name: '刀工与备菜', tasks: [
            { do: '练切一盘土豆丝：先切片再切丝，切完把第一根和最后一根摆在一起拍照对比', time: '40分钟', standard: '最后 5 根明显比前 5 根均匀' },
            { do: '给一顿两人餐做完整备菜：3 个菜的全部食材洗切配好、调料按菜分小碗装好，然后才开火', time: '40分钟', standard: '开火前所有食材就位' },
          ]},
          { name: '火候与基础炒', tasks: [
            { do: '独立完成一道西红柿炒蛋，重点练习判断下锅顺序和火候；做完记录一次"哪里没做好、下次准备改什么"', time: '30分钟', standard: '一道菜 + 一条复盘', repeat: true },
            { do: '做一道青椒肉丝，练习"热锅凉油"防粘和肉丝滑炒，目标是肉丝不粘锅底、不发柴', time: '40分钟', standard: '锅底干净、肉丝嫩' },
          ]},
          { name: '调味', tasks: [
            { do: '煮三碗同样的清汤面，分别只放盐、盐+糖、盐+糖+一点酱油，尝出层次差别并写下感受', time: '30分钟', standard: '能说出糖和酱油分别起什么作用' },
            { do: '做一次蛋炒饭，盐分三次放（炒蛋前 / 中途 / 出锅前），体会分次调味和均匀咸味', time: '30分钟', standard: '蛋炒饭咸味均匀' },
          ]},
          { name: '家常菜单', tasks: [
            { do: '独立完成一荤一素一汤的三菜晚餐（如可乐鸡翅 + 清炒时蔬 + 紫菜蛋花汤），全程不看视频，卡住了只看文字菜谱', time: '90分钟', standard: '三菜同时上桌、温度都在', repeat: true },
            { do: '自选一道从没做过的家常菜独立完成，餐后写两行复盘：火候或调味哪里翻车了、下次改什么', time: '60分钟', standard: '一道新菜 + 两行复盘', repeat: true },
          ]},
        ]
      },
      /* ---------- 职场沟通与汇报 ---------- */
      {
        key: 'comm-work', name: '职场沟通汇报',
        patterns: [/职场沟通|向上管理|跨部门|汇报|对齐|扯皮|撕逼|沟通技巧|高情商/],
        verifyTask: '在一次真实的困难沟通后（催进度 / 拒绝需求 / 汇报坏消息 / 谈资源），写下三段：当时怎么说的、对方反应、下次会怎么说更好。',
        units: [
          { name: '把事情说清楚', tasks: [
            { do: '练"结论先行"：把一件本周做的事用"结论 → 三个理由 → 一个请求"的结构写成 150 字，发给朋友测试对方 10 秒内能否抓住重点', time: '30分钟', standard: '对方能复述出你的核心结论' },
            { do: '把一次真实的"说了半天没听懂"重新写一遍：先写你想让对方做什么（唯一动作），再补必要信息', time: '25分钟', standard: '重写后信息减半、动作唯一', repeat: true },
          ]},
          { name: '困难对话', tasks: [
            { do: '预演一次困难沟通：对方拖延/拒绝/情绪化三种反应，各准备一句应对话术，写下来', time: '35分钟', standard: '三句应对话术' },
            { do: '真实完成一次"向上同步"：用 3 分钟说清进展、风险、需要什么支持，记录上级的反馈', time: '30分钟', standard: '一次真实同步 + 上级反馈', repeat: true },
          ]},
          { name: '长期关系', tasks: [
            { do: '梳理你的协作地图：列出 5 个关键协作方，各写一句"他关心什么 / 我该怎么跟他协作"', time: '40分钟', standard: '一张协作地图' },
          ]},
        ]
      },
      /* ---------- Presentation / 演讲 ---------- */
      {
        key: 'presentation', name: 'Presentation',
        patterns: [/presentation|汇报|演讲|脱稿|上台|发言|\bpre\b/],
        verifyTask: '独立准备并脱稿完成一次 5 分钟以上的完整 pre，全程不念稿，并留有录音。',
        units: [
          { name: '内容结构', tasks: [
            { do: '把你想讲的主题用"结论先行"写成一页纸：一句话核心观点 + 3 个支撑理由 + 每个理由 1 个例子', time: '30分钟', standard: '一页纸讲稿骨架' },
            { do: '给你的 pre 写开头 30 秒的逐字稿并计时读 5 遍，删到 30 秒以内', time: '25分钟', standard: '开头能在 30 秒内讲完' },
          ]},
          { name: '幻灯片', tasks: [
            { do: '把一页字最多的旧 PPT 改成"一页一个观点 + 一张图 + 不超过 20 字"，改完给同学看，10 秒内能说出这页讲什么', time: '40分钟', standard: '通过 10 秒测试' },
          ]},
          { name: '表达与脱稿', tasks: [
            { do: '对着手机录一遍 3 分钟的 pre，回看并统计三个数据："嗯啊"次数、眼神离开镜头次数、每分钟语速', time: '25分钟', standard: '三个数据都记下来' },
            { do: '用关键词卡片法脱稿讲同一内容：每张卡片只写 3 个词，讲 3 遍，最后一遍录音', time: '30分钟', standard: '能不念稿讲满 3 分钟' },
          ]},
          { name: '实战与问答', tasks: [
            { do: '找一位朋友当面讲一遍，请对方随时在你逻辑跳跃的地方喊停，记下所有被喊停的点', time: '30分钟', standard: '一张"逻辑断点"清单' },
            { do: '请朋友针对你的 pre 提 3 个刁钻问题，练习"停顿 1 秒 → 复述问题 → 分点回答"的应答结构', time: '25分钟', standard: '3 个问题都能结构化回答' },
          ]},
        ]
      },
      /* ---------- 编程 ---------- */
      {
        key: 'programming', name: '编程',
        patterns: [/python|编程|代码|写程序|爬虫|学开发|java|前端/],
        verifyTask: '独立编写一个能实际运行、解决你自己真实问题的小工具（脚本/网页均可），并连续使用一周。',
        units: [
          { name: '环境与第一个程序', tasks: [
            { do: '装好 Python 和编辑器，写第一个程序：让用户输入生日，输出"你活了多少天"', time: '40分钟', standard: '程序跑通、结果正确', beginnerOnly: true },
            { do: '写一个猜数字游戏（1-100，提示大了/小了），写完自己玩一遍验证逻辑', time: '40分钟', standard: '游戏能正常玩' },
          ]},
          { name: '语法与逻辑', tasks: [
            { do: '用循环+条件分别打印：九九乘法表、菱形星号图案、FizzBuzz', time: '50分钟', standard: '三个输出都正确' },
            { do: '写一个脚本读取一个 txt 文件，统计每个词出现的次数，输出前 10 名', time: '60分钟', standard: '前 10 名输出正确' },
          ]},
          { name: '数据与文件', tasks: [
            { do: '用列表+字典做一个你的书单/影单管理器：能添加、删除、按评分排序，数据存成 JSON 文件', time: '90分钟', standard: '重启程序后数据还在' },
          ]},
          { name: '小项目实战', tasks: [
            { do: '写一个爬虫抓取一个公开网页的标题列表，存成 CSV', time: '90分钟', standard: 'CSV 里至少 20 行数据' },
            { do: '做一个你自己真的会用到的小工具（自动整理下载文件夹 / 周报模板生成器 / 生日提醒都行），写到能用为止', time: '2 小时（可分几天）', standard: '真的在用它', repeat: true },
          ]},
        ]
      },
      /* ---------- 设计 ---------- */
      {
        key: 'design', name: '设计',
        patterns: [/photoshop|figma|海报|平面|学设计|做设计|\bps\b|\bui\b/],
        verifyTask: '为一件真实的事（社团招新 / 活动宣传 / 自己的生日会）设计一张完整海报并交付使用。',
        units: [
          { name: '工具基础', tasks: [
            { do: '做一个"公众号封面"尺寸的练习：新建画布、置入图片、打标题、导出，全流程走一遍', time: '40分钟', standard: '导出一张封面图', beginnerOnly: true },
            { do: '临摹一张你觉得好的海报：同样的版式自己重新做一遍（字体和图片可以不同）', time: '90分钟', standard: '两张对比图放一起看' },
          ]},
          { name: '排版', tasks: [
            { do: '做 4 个版本的同一张文字海报：分别只改对齐方式 / 字号对比 / 留白 / 信息层级，感受哪个最清楚', time: '60分钟', standard: '4 个版本 + 能说出最好的那个为什么好' },
          ]},
          { name: '配色', tasks: [
            { do: '从 3 张优秀作品里吸色，各做一套 5 色配色板（主色/辅色/强调色/深/浅），马上用到自己的海报里', time: '40分钟', standard: '3 套配色板 + 一张用上的海报' },
          ]},
          { name: '完整产出', tasks: [
            { do: '为一件真实的事设计一张海报并交付，收集使用者的一条反馈', time: '2 小时（可分几天）', standard: '有人真的用了你的海报', repeat: true },
          ]},
        ]
      },
      /* ---------- 画画 ---------- */
      {
        key: 'drawing', name: '画画',
        patterns: [/画画|素描|插画|手绘|板绘|学画/],
        verifyTask: '完成一张不少于 1 小时的完整作品（临摹或原创均可），和第一天的练习页放在一起对比。',
        units: [
          { name: '线条', tasks: [
            { do: '画满一页：直线、曲线、圆各 20 个，要求手不抖、线条收得住；隔天再来一页，两页放一起对比', time: '30分钟', standard: '第二页明显更稳', repeat: true },
          ]},
          { name: '比例', tasks: [
            { do: '用铅笔测量法临摹 3 张照片：先定大比例，再抠细节；画完和原图叠在一起找比例错的地方', time: '60分钟', standard: '3 张临摹 + 错位标注' },
          ]},
          { name: '明暗', tasks: [
            { do: '画一个球体的明暗：高光、亮面、明暗交界线、反光、投影五个调子都画出来，只用一支铅笔', time: '40分钟', standard: '五个调子都能分辨出来' },
          ]},
          { name: '完整作品', tasks: [
            { do: '完成一张完整的临摹或写生作品（不少于 1 小时），中途不看手机', time: '60分钟以上', standard: '一张成品', repeat: true },
          ]},
        ]
      },
      /* ---------- 写作 ---------- */
      {
        key: 'writing', name: '写作',
        patterns: [/写作|写文章|写公众号|文案|写小说|写故事/],
        verifyTask: '独立写一篇结构完整的文章（800 字以上）并公开发布（公众号/知乎/小红书均可）。',
        units: [
          { name: '素材库', tasks: [
            { do: '建一个素材库（备忘录/笔记本都行），本周每天收集 3 条好素材（金句/故事/数据），周末分类整理', time: '每天 10 分钟', standard: '21 条素材，至少分 3 类' },
          ]},
          { name: '结构', tasks: [
            { do: '拆解 2 篇你喜欢的文章：给每一段标注功能（观点/例子/过渡/金句），然后套这个结构写一篇 500 字短文', time: '90分钟', standard: '一篇有结构的短文' },
          ]},
          { name: '开头与修改', tasks: [
            { do: '给同一个主题写 5 个不同的开头（提问 / 场景 / 金句 / 数据 / 直接冲突），发给朋友选最想读下去的一个', time: '40分钟', standard: '5 个开头 + 一个投票结果' },
            { do: '把一篇旧文章删掉 30% 的字数且不损失信息，再朗读一遍改掉所有拗口的句子', time: '40分钟', standard: '更短的版本读起来更顺' },
          ]},
          { name: '完整产出', tasks: [
            { do: '写一篇完整的短文并公开发布，24 小时后回来看数据和评论', time: '2 小时（可分几天）', standard: '公开发布一篇', repeat: true },
          ]},
        ]
      },
      /* ---------- 吉他 / 乐器 ---------- */
      {
        key: 'guitar', name: '吉他弹唱',
        patterns: [/吉他|尤克里里|ukulele|弹唱/],
        verifyTask: '不看谱边弹边唱完成一首完整的歌，录下来发给朋友听。',
        units: [
          { name: '基础和弦', tasks: [
            { do: '学会 C、G、Am、Em 四个和弦：每个按住后从上到下逐根弦弹，保证每根弦都发声清晰', time: '40分钟', standard: '四个和弦都清晰发声' },
          ]},
          { name: '和弦转换', tasks: [
            { do: '练转换：C→G→Am→Em 循环，开节拍器 60bpm，每小节换一次，连续 3 分钟不断', time: '30分钟', standard: '3 分钟不断', repeat: true },
          ]},
          { name: '节奏与弹唱', tasks: [
            { do: '练 4 种扫弦节奏型，跟着一首慢歌从头扫到尾', time: '40分钟', standard: '完整扫完一首歌' },
            { do: '选一首只用这 4 个和弦的歌：先只唱不弹 → 再只弹不唱 → 最后合起来，录一遍', time: '60分钟', standard: '能边弹边唱完整首' },
          ]},
        ]
      },
      /* ---------- 健身 / 跑步 ---------- */
      {
        key: 'fitness', name: '健身',
        patterns: [/健身|跑步|减脂|增肌|锻炼|运动|引体|马甲线/],
        verifyTask: '按自己定的每周训练表连续执行 2 周，并记录每次的训练内容和一个能对比的数值（配速/个数/重量）。',
        units: [
          { name: '基础动作模式', tasks: [
            { do: '学三个基础动作（深蹲 / 俯卧撑 / 平板支撑），每个 3 组；用手机侧面录像，对照标准动作找出自己的 2 个问题', time: '40分钟', standard: '3 段录像 + 问题清单' },
            { do: '隔天重复：深蹲 3×12、俯卧撑 3×8（跪姿也行）、平板支撑 3×30 秒，和上次的录像对比', time: '30分钟', standard: '动作比上次标准', repeat: true },
          ]},
          { name: '有氧耐力', tasks: [
            { do: '慢跑或快走 30 分钟，记下配速和结束时的心率；每周 2-3 次，目标是比第一次更轻松', time: '30分钟', standard: '配速/心率有记录', repeat: true },
          ]},
          { name: '计划与记录', tasks: [
            { do: '定一张每周训练表（每周几天、每次练什么），贴在显眼的地方，本周按表完成并打勾', time: '20分钟', standard: '一张表 + 本周打卡' },
            { do: '记录三天全部饮食，估算热量，找出最大的一个问题（奶茶/夜宵/不吃早餐），只改这一项', time: '20分钟', standard: '三天记录 + 一个改进' },
          ]},
        ]
      },
      /* ---------- Excel / 数据分析（职场） ---------- */
      {
        key: 'excel', name: 'Excel数据分析',
        patterns: [/excel|数据分析|表格|透视表|函数|数据清洗|vlookup|看板/],
        verifyTask: '用一份真实的工作数据（销售明细 / 运营日志 / 项目工时均可）独立做一份经营分析：清洗、汇总、可视化、结论建议四步齐全，发给需要的人看。',
        units: [
          { name: '数据清洗', tasks: [
            { do: '拿一份乱序的明细表练清洗：去重、统一日期格式、补全缺失值、拆分合并列，每一步说清楚"为什么这么处理"', time: '45分钟', standard: '得到一张干净的数据明细表' },
            { do: '用数据验证 + 条件格式给一张表做"防呆"：日期列只允许选日期、数字列标出异常值（超过均值 3 倍）', time: '30分钟', standard: '表有防呆规则，异常值会自动标色', repeat: true },
          ]},
          { name: '函数与公式', tasks: [
            { do: '把 VLOOKUP / XLOOKUP、SUMIFS、COUNTIFS 各用一个真实场景练一遍：比如按部门汇总销售额、按人名匹配工号', time: '50分钟', standard: '三个场景都跑出正确结果' },
            { do: '练相对引用 vs 绝对引用：做一张"单价 × 数量"的表格，公式能一次性下拉填满 100 行不出错', time: '30分钟', standard: '下拉 100 行结果全部正确' },
            { do: '用 IF + AND/OR 写一列"是否达标"判断（比如"销售额过万且增长率大于 10%"），再改用 IFS 重写一遍', time: '30分钟', standard: '两种写法结果一致' },
          ]},
          { name: '透视表与汇总', tasks: [
            { do: '用一份明细表做透视表：行放部门、列放月份、值放销售额；再插入切片器，做到点一下就能只看某个区域', time: '45分钟', standard: '一张带切片器的交互透视表' },
            { do: '把同一份数据用三种图表表达（柱状看对比 / 折线看趋势 / 饼图看占比），选一种最能说明问题的，写一句"这张图想说明什么"', time: '40分钟', standard: '三张图 + 一句结论', repeat: true },
          ]},
          { name: '分析实战', tasks: [
            { do: '完整做一次分析：从原始数据到结论建议（清洗 → 透视汇总 → 图表 → 三行结论：发生了什么 / 为什么 / 建议做什么）', time: '90分钟', standard: '一份能直接发给同事的分析', repeat: true },
          ]},
        ]
      },
      /* ---------- AI 提效（职场） ---------- */
      {
        key: 'ai-work', name: 'AI提效',
        patterns: [/\bai\b|aigc|chatgpt|gpt|claude|提示词|大模型|copilot|deepseek|kimi|midjourney|提效|智能体|人工智能/],
        verifyTask: '把自己一周里最重复的一件工作用 AI 重做一遍：写下"原来要多久 / 现在要多久 / 省下的时间用来做了什么"，并整理成一份可复用的提示词模板。',
        units: [
          { name: '认识与上手', tasks: [
            { do: '选一个主力 AI 工具，把"你是谁 / 能帮你做什么 / 怎么提问效果更好"三个问题各问一遍，整理成一页自己的使用笔记', time: '40分钟', standard: '一页笔记 + 选定主力工具' },
            { do: '挑一件今天真实的小工作（回一封邮件 / 改一段文案 / 起五个标题），用 AI 做一遍，和人工版本放一起对比', time: '30分钟', standard: '两个版本 + 一条对比结论', repeat: true },
          ]},
          { name: '提示词基本功', tasks: [
            { do: '练"角色 + 任务 + 要求 + 示例"四件套提示词：让 AI 按你给的格式改写一段周报，跑 3 次，记录哪次最好、为什么', time: '40分钟', standard: '3 次结果 + 一条迭代记录' },
            { do: '把自己工作里最常用的一类任务写成提示词模板（比如"把口语化的记录整理成会议纪要"），存到备忘录，实际用一次', time: '45分钟', standard: '一条模板 + 一次真实使用', repeat: true },
          ]},
          { name: '工作流实战', tasks: [
            { do: '用 AI 做一次"资料 → 结构"：把一份长文档 / 一堆零散记录丢给 AI，要求输出"一页纸摘要 + 3 个待办 + 2 个风险"，人工校对后使用', time: '50分钟', standard: '一页纸摘要被真实使用' },
            { do: '找一件每周重复的机械工作（数据整理 / 报表 / 周报模板），用 AI + 工具把它压缩到原来的 1/3 时间，写下新流程', time: '60分钟', standard: '新旧流程时间对比', repeat: true },
          ]},
        ]
      },
      /* ---------- 项目管理（职场） ---------- */
      {
        key: 'pm-work', name: '项目管理',
        patterns: [/项目管理|项目推进|排期|里程碑|敏捷|scrum|迭代|上线|项目复盘|甘特/],
        verifyTask: '独立带一件真实的事从启动到收尾：定目标 → 拆任务 → 排期 → 同步进展 → 复盘，产出一页项目复盘（做对了什么 / 哪里出了问题 / 下次改什么）。',
        units: [
          { name: '目标与拆解', tasks: [
            { do: '把一件模糊的事写成可执行目标："谁、在什么时间前、做到什么程度、怎么算达成"，写完找一个人复述给他听，对方能听懂就算过', time: '40分钟', standard: '一条 SMART 目标 + 一个听懂的人' },
            { do: '把一个目标拆成 5-8 个任务：每个任务有负责人、截止日、交付物；用"能不能一天内完成"检查颗粒度，太粗的继续拆', time: '45分钟', standard: '一张任务清单，颗粒度都 ≤1 天' },
          ]},
          { name: '排期与推进', tasks: [
            { do: '给任务排一条时间线：标出关键路径（哪几个任务延误整个项目就延误）、缓冲时间、依赖关系', time: '40分钟', standard: '一张能看出关键路径的排期表' },
            { do: '写一份 100 字以内的进展同步：当前进度 / 风险 / 需要对方做什么，发给真实的协作方', time: '20分钟', standard: '对方 24 小时内回复了', repeat: true },
          ]},
          { name: '复盘与沉淀', tasks: [
            { do: '完成一件真实事项后写一页复盘：目标是什么 / 实际结果 / 差距在哪 / 根因 / 下次的一个具体改进', time: '40分钟', standard: '一页复盘 + 一条可执行的改进', repeat: true },
          ]},
        ]
      },
    ];

    // 匹配领域
    function matchDomain(text) {
      const t = text.toLowerCase();
      for (const d of DOMAIN_LIB) {
        if (d.patterns.some(p => p.test(t))) return d;
      }
      return null;
    }

    // 根据领域 + 用户情况生成能力单元定义（含任务池）
    function buildUnitDefs(domain, opts) {
      let defs;
      if (domain) {
        defs = domain.units.filter(u =>
          (!u.adv || opts.wantsAdvanced) &&
          (!u.beginnerOnly || opts.isZero)
        ).map(u => ({ name: u.name, tasks: u.tasks }));
      } else {
        defs = genericUnits(opts.what);
      }
      // 分阶段：前 40% 打基础，中间核心练习，最后整合实战
      const n = defs.length;
      defs.forEach((u, i) => {
        u.phase = i < n * 0.4 ? 1 : (i < n * 0.85 ? 2 : 3);
      });
      return defs;
    }

    // 未匹配领域时的通用拆解（仍然要求具体、能做、有结果）
    function genericUnits(what) {
      const name = extractSkillName(what);
      return [
        { name: name + ' · 入门准备', tasks: [
          { do: '找出学「' + name + '」最常用的 3 个工具 / APP / 资源，各花 15 分钟试用，选一个当主力，写一句"为什么选它"', time: '45分钟', standard: '定了主力工具 + 一句理由' },
          { do: '读 2 篇"如何入门' + name + '"的高赞经验帖，各读完后用自己的话写出 3 条共同建议', time: '40分钟', standard: '6 条建议，合并重复后至少 3 条' },
        ]},
        { name: name + ' · 基础操作', tasks: [
          { do: '跟一个入门教程完整做一遍（边看边做、不跳步骤），做的过程记下卡壳的 3 个地方', time: '60分钟', standard: '做出教程的成品 + 卡壳清单' },
          { do: '隔天不看教程，把昨天的成品独立重做一遍，卡住才允许回看', time: '60分钟', standard: '能独立重做 80%' },
        ]},
        { name: name + ' · 核心练习', tasks: [
          { do: '找一件你生活里真实需要用「' + name + '」解决的小事，直接用它解决一次', time: '45分钟', standard: '事情真的被解决了', repeat: true },
          { do: '给「' + name + '」定一个 30 分钟内能做完的小练习，做完立刻检验产出', time: '30分钟', standard: '有一个看得见的产出', repeat: true },
        ]},
        { name: name + ' · 实战产出', tasks: [
          { do: '独立完成一个属于你自己的「' + name + '」小作品，做完拿给一个朋友看，请对方说一句最直观的感受', time: '90分钟', standard: '一个作品 + 一条他人反馈' },
        ]},
      ];
    }

    function genericVerifyTask(what) {
      const name = extractSkillName(what);
      return '独立完成一个「' + name + '」的完整成品（不看教程、不找人代做），并把它记录为一段真实经历。';
    }

    /* ============================================================
       15) 技能名称提取
       ============================================================ */
    function extractSkillName(what) {
      // 从自然语言中提取技能名称（仅用于未匹配到领域库时）
      const text = what.toLowerCase();

      if (/雅思|ielts/.test(text)) return '雅思';
      if (/托福|toefl|四六级|四级|六级|考研英语/.test(text)) return '英语考试';
      if (/premiere|剪映|剪辑|剪视频/.test(text)) return '视频剪辑';
      if (/摄影|相机/.test(text)) return '摄影';
      if (/做饭|烹饪|炒菜|家常菜/.test(text)) return '做饭';
      if (/presentation|汇报|演讲/.test(text)) return 'Presentation';
      if (/excel|透视表|数据清洗|vlookup|数据分析/.test(text)) return 'Excel数据分析';
      if (/\bai\b|aigc|chatgpt|gpt|claude|提示词|大模型|copilot|deepseek|kimi/.test(text)) return 'AI提效';
      if (/项目管理|排期|敏捷|scrum|项目推进|甘特/.test(text)) return '项目管理';
      if (/跨部门|向上管理|职场沟通|沟通汇报/.test(text)) return '职场沟通汇报';
      if (/python/.test(text)) return 'Python编程';
      if (/编程|代码|开发/.test(text)) return '编程';
      if (/英语口语|口语/.test(text)) return '英语口语';
      if (/英语|英文/.test(text)) return '英语';
      if (/健身|跑步|减脂|增肌/.test(text)) return '健身';
      if (/吉他|尤克里里/.test(text)) return '吉他弹唱';
      if (/画画|素描|手绘|板绘/.test(text)) return '画画';
      if (/写作|写文章|文案/.test(text)) return '写作';
      if (/设计|figma|ui/.test(text)) return '设计';
      if (/数据分析/.test(text)) return '数据分析';

      // 冒号后面往往就是技能名："……：手冲咖啡"
      const colonMatch = what.match(/[：:]([^，。,!?！？\s]{1,12})/);
      if (colonMatch) return colonMatch[1].trim();

      // 尝试提取"学会XX / 学个XX / 学一下XX"中的XX
      const match = what.match(/学[会习]?(?:个|一下)?([^，。,!?！？\s]{1,12}?)(?:，|。|,|。|\s|$)/);
      if (match && match[1].trim()) return match[1].trim();

      // 去掉"我想/我想用30天"之类的前缀后截取
      const stripped = what.replace(/^我[想要]+/, '').replace(/用?\d+\s*[天日周月]*/, '').replace(/^[里内的]+/, '');
      return (stripped || what).slice(0, 12).replace(/[，。！？,.!?：:]/, '').trim();
    }

    /* ============================================================
       16) 学习计划生成：先分阶段，再排天/周任务
       ≤45 天 → 按天（Day N）；>45 天 → 按周（Week N，每周 5 个任务）
       任务全部来自领域知识库，保证"具体、能做、有结果"
       ============================================================ */
    function aiGeneratePlan(unitDefs, totalDays, minutesPerDay, verifyTask) {
      const plan = [];
      const defTime = minutesPerDay + '分钟';
      const dailyMode = totalDays <= 45;
      const totalWeight = unitDefs.reduce((s, u) => s + u.tasks.length, 0) || 1;
      const verifyTime = Math.max(minutesPerDay * 2, 120) + '分钟';

      if (dailyMode) {
        const learningDays = Math.max(unitDefs.length, totalDays - 1);
        // 按任务量分配天数，但每个单元最多"独立任务数 + 2"天，
        // 避免同一个练习机械重复太多次；多出/不足的部分按比例再平衡
        const alloc = [];
        let allocated = 0;
        unitDefs.forEach((u, idx) => {
          const unique = u.tasks.filter(t => !t.repeat).length || u.tasks.length;
          const raw = Math.max(1, Math.round(learningDays * u.tasks.length / totalWeight));
          alloc[idx] = Math.min(raw, unique + 2);
          allocated += alloc[idx];
        });
        if (allocated !== learningDays) {
          if (allocated > learningDays) {
            // 超了：按比例缩
            const scale = learningDays / allocated;
            let sum = 0;
            unitDefs.forEach((u, idx) => { alloc[idx] = Math.max(1, Math.round(alloc[idx] * scale)); sum += alloc[idx]; });
            allocated = sum;
          }
          // 补齐或继续削减
          let rest = learningDays - allocated, i = 0, guard = 0;
          while (rest !== 0 && guard < 2000) {
            const k = i % unitDefs.length;
            if (rest > 0) { alloc[k]++; rest--; }
            else if (alloc[k] > 1) { alloc[k]--; rest++; }
            i++; guard++;
          }
        }
        let day = 1;
        unitDefs.forEach((u, idx) => {
          const unitId = 'u' + idx;
          const counts = {};
          expandTasks(u.tasks, alloc[idx], defTime, 0, counts).forEach(t => {
            plan.push({ unitId, day, title: 'Day ' + day + '｜' + u.name, do: t.do, time: t.time, standard: t.standard, done: false });
            day++;
          });
        });
        plan.push({
          unitId: 'verify', day: day, title: 'Day ' + day + '｜🏆 验证任务',
          do: verifyTask, time: verifyTime,
          standard: '完成并记录为一段真实经历（记录后技能正式点亮）', done: false
        });
      } else {
        // 周模式：先分阶段，每周 5 个任务
        const weeks = Math.max(unitDefs.length + 1, Math.round(totalDays / 7));
        let week = 1;
        unitDefs.forEach((u, idx) => {
          const unitId = 'u' + idx;
          let unitWeeks = Math.max(1, Math.round((weeks - 1) * u.tasks.length / totalWeight));
          if (idx === unitDefs.length - 1) unitWeeks = Math.max(1, (weeks - 1) - (week - 1));
          let offset = 0;
          const counts = {}; // 跨周累计使用次数
          for (let w = 0; w < unitWeeks; w++) {
            expandTasks(u.tasks, 5, defTime, offset, counts).forEach(t => {
              plan.push({ unitId, day: week, title: 'Week ' + week + '｜' + u.name, do: t.do, time: t.time, standard: t.standard, done: false });
            });
            offset += 5;
            week++;
          }
        });
        plan.push({
          unitId: 'verify', day: week, title: 'Week ' + week + '｜🏆 验证任务',
          do: verifyTask, time: verifyTime,
          standard: '完成并记录为一段真实经历（记录后技能正式点亮）', done: false
        });
      }

      return plan;
    }

    // 从任务池展开 N 个任务：先消耗一遍全部任务，
    // 耗尽后循环整个池子（可重复练习的任务权重 ×2），并标注"第N次"
    function expandTasks(pool, count, defTime, offset, counts) {
      const out = [];
      if (!pool.length) return out;
      const firstLen = pool.length;
      const cyc = [];
      pool.forEach((t, i) => { cyc.push(i); if (t.repeat) cyc.push(i); });
      const c = counts || {};
      for (let j = 0; j < count; j++) {
        const slot = (offset || 0) + j;
        const idx = slot < firstLen ? slot : cyc[(slot - firstLen) % cyc.length];
        c[idx] = (c[idx] || 0) + 1;
        const t = pool[idx];
        const suffix = c[idx] > 1 ? '（第' + c[idx] + '次）' : '';
        out.push({ do: t.do + suffix, time: t.time || defTime, standard: t.standard });
      }
      return out;
    }

    /* ============================================================
       17) 学习计划弹窗：第一部分技能树 + 第二部分学习计划
       ============================================================ */
    function showLearnPlanModal(skillName) {
      const skill = getSkills().find(s => s.name === skillName);
      if (!skill || !skill.plan) return;

      document.getElementById('learnPlanTitle').textContent = '🪄 ' + skillName + ' · 技能树 & 学习计划';
      let html = '';

      if (skill.goalText) {
        html += `<div class="plan-goal">🎯 ${escapeHtml(skill.goalText)}</div>`;
      }

      // 保守假设标注
      if (skill.assumptions && skill.assumptions.length) {
        html += `<div class="plan-assumptions">
          <div class="pa-title">🧐 我先做了这些假设（都可以推翻）</div>
          ${skill.assumptions.map(a => `<div class="pa-item">· ${escapeHtml(a)}</div>`).join('')}
        </div>`;
      }

      // 第一部分：技能树
      const units = skill.breakdown || [];
      if (units.length) {
        html += `<div class="plan-section-title">🌱 第一部分 · 技能树</div>`;
        html += `<div class="plan-section-desc">我把这个目标拆成了这些核心能力——掌握它们就够了，不多学。完成学习任务后，对应能力会亮起来。</div>`;
        let curPhase = 0;
        units.forEach(u => {
          if (u.phase !== curPhase) {
            curPhase = u.phase;
            html += `<div class="plan-phase-header">${PHASE_NAMES[u.phase] || ''}</div>`;
          }
          html += `<div class="plan-tree-chip"><span class="ptc-dot ${u.status || 'want'}"></span>${escapeHtml(u.name)}</div>`;
        });
      }

      // 第二部分：学习计划
      html += `<div class="plan-section-title">📋 第二部分 · 学习计划</div>`;
      html += renderPlanBlock(skill, skillName);

      document.getElementById('learnPlanBody').innerHTML = html;
      document.getElementById('learnPlanModal').style.display = 'flex';
    }

    // 计划渲染（弹窗和技能详情共用）：阶段头 → 单元头 → 任务
    function renderPlanBlock(skill, skillName) {
      const units = skill.breakdown || [];
      const done = skill.plan.filter(t => t.done).length;
      let html = `<div class="plan-progress">进度：${done} / ${skill.plan.length}　做完一个勾一个</div>`;

      let curPhase = 0, curUnit = null;
      skill.plan.forEach((task, i) => {
        if (task.unitId === 'verify') {
          if (curUnit !== 'verify') {
            curUnit = 'verify';
            html += `<div class="plan-unit-header verify">🏆 验证任务（做完并记录经历，技能正式点亮）</div>`;
          }
        } else {
          const u = units.find(x => x.id === task.unitId);
          if (u && u.phase !== curPhase) {
            curPhase = u.phase;
            html += `<div class="plan-phase-header">${PHASE_NAMES[u.phase] || ''}</div>`;
          }
          if (task.unitId !== curUnit) {
            curUnit = task.unitId;
            html += `<div class="plan-unit-header">${u ? escapeHtml(u.name) : ''}</div>`;
          }
        }
        html += `<div class="plan-task-item ${task.done ? 'done' : ''}">
          <label class="plan-task-check">
            <input type="checkbox" ${task.done ? 'checked' : ''} onchange="togglePlanTask('${escapeHtml(skillName)}',${i},this.checked)" />
            <span class="plan-task-title">${escapeHtml(task.title)}</span>
          </label>
          <div class="plan-task-detail">
            <div class="plan-task-do">${escapeHtml(task.do)}</div>
            <div class="plan-task-meta">⏱ ${escapeHtml(task.time)} · ✅ 完成：${escapeHtml(task.standard)}</div>
          </div>
        </div>`;
      });
      return html;
    }

    function closeLearnPlanModal() {
      document.getElementById('learnPlanModal').style.display = 'none';
    }

    document.getElementById('learnPlanModal').addEventListener('click', function(e) {
      if (e.target === this) closeLearnPlanModal();
    });

    /* ============================================================
       18) 学习计划勾选 + 技能状态联动
       ============================================================ */
    function togglePlanTask(skillName, taskIdx, checked) {
      const skills = getSkills();
      const skill = skills.find(s => s.name === skillName);
      if (!skill || !skill.plan) return;

      skill.plan[taskIdx].done = checked;

      // 计算每个单元的完成情况
      if (skill.breakdown) {
        skill.breakdown.forEach(unit => {
          const unitTasks = skill.plan.filter(t => t.unitId === unit.id);
          const unitDone = unitTasks.filter(t => t.done).length;
          if (unitTasks.length > 0 && unitDone === unitTasks.length) {
            unit.status = 'practiced';
          } else if (unitDone > 0) {
            unit.status = 'learning';
          } else {
            unit.status = 'want';
          }
        });
      }

      // 整体技能状态
      const allDone = skill.plan.filter(t => t.unitId !== 'verify').every(t => t.done);
      const verifyDone = skill.plan.some(t => t.unitId === 'verify' && t.done);

      if (allDone && verifyDone) {
        skill.status = 'verified';
      } else if (allDone) {
        skill.status = 'practiced';
      } else {
        const anyDone = skill.plan.some(t => t.done);
        skill.status = anyDone ? 'learning' : 'learning';
      }

      saveSkills(skills);
      renderSkillTree();

      // 如果验证任务完成，提示用户记录经历
      if (checked && skill.plan[taskIdx].unitId === 'verify') {
        setTimeout(() => {
          if (confirm('🎉 验证任务完成！要记录这段真实经历吗？\n\n记录后技能将被正式点亮。')) {
            // 自动打开经历记录弹窗
            openExpModal();
            document.getElementById('expForm').querySelector('input[name=expTitle]').value = '完成「' + skillName + '」验证任务';
            document.getElementById('expForm').querySelector('textarea[name=expDesc]').value = skill.verifyTask || '完成了' + skillName + '的学习验证。';
          }
        }, 300);
      }

      // 加经验
      if (checked) {
        addExp(5, '完成学习任务');
      }
    }

    /* ============================================================
       19) 页面流转
       ============================================================ */
    const ALL_PAGES = ['page-splash','page-onboard','page-chargen','page-home','page-explog','page-skilltree'];

    function goPage(id) {
      ALL_PAGES.forEach(p => { document.getElementById(p).style.display = 'none'; });
      document.getElementById(id).style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // 离开 chargen 时停止轮询
      if (id !== 'page-chargen' && _chargenPoller) {
        clearInterval(_chargenPoller);
        _chargenPoller = null;
      }
      // 底部导航激活态
      document.querySelectorAll('.bn-tab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-page') === id);
      });
      if (id === 'page-home') {
        fillHome(getProfile());
        document.getElementById('resetBtn').style.display = 'inline-flex';
      } else {
        document.getElementById('resetBtn').style.display = 'none';
      }
      if (id === 'page-explog') renderExpLog();
      if (id === 'page-skilltree') {
        renderTreeTabs();
        renderSkillTree();
      }
    }

    function resetProfile() {
      if (confirm('确定要重新填写个人信息吗？')) {
        localStorage.removeItem(LS_PROFILE);
        localStorage.removeItem(LS_EXPERIENCES);
        localStorage.removeItem(LS_SKILLS);
        localStorage.removeItem(LS_PLAYER);
        localStorage.removeItem(LS_TREES);
        localStorage.removeItem(LS_CHAR_IMAGE);
        localStorage.removeItem(LS_CHAR_PROMPT);
        localStorage.removeItem(LS_CHAR_SKIPPED);
        goPage('page-onboard');
      }
    }

    /* ============================================================
       19.5) 地球Online 存档：读取全部真实数据 → 人物存档页
       数据关系：基本信息 + 经历库 + 已确认技能 + 进行中目标 → 存档
       所有内容来自真实数据，缺的显示"还没有"，绝不虚构
       ============================================================ */
    const LS_ARCHIVES = 'earth_online_archives';

    function getArchives() {
      try { return JSON.parse(localStorage.getItem(LS_ARCHIVES)) || []; } catch(e) { return []; }
    }
    function saveArchives(list) {
      try { localStorage.setItem(LS_ARCHIVES, JSON.stringify(list)); } catch(e) {}
    }

    function showArchive() {
      document.getElementById('archiveBody').innerHTML = archiveHtml();
      document.getElementById('archiveBody').scrollTop = 0;
      document.getElementById('archiveName').value = suggestArchiveName();
      const btn = document.getElementById('archiveSaveBtn');
      btn.textContent = '💾 保存这版存档';
      btn.onclick = function() { saveArchive(); };
      renderArchiveList();
      const modal = document.getElementById('archiveModal');
      modal.style.display = 'flex';
      // 让 hint 在滚动后自动隐藏
      const body = document.getElementById('archiveBody');
      body.onscroll = function() {
        const hint = document.getElementById('arcxScrollHint');
        if (hint) hint.style.display = body.scrollTop > 20 ? 'none' : 'block';
      };
    }

    function closeArchive() {
      document.getElementById('archiveModal').style.display = 'none';
    }

    /* ----- 工龄切换 ----- */
    const GRADE_OPTIONS = ['1年内', '1-3年', '3-5年', '5-10年', '10年以上'];
    function openGradePicker() {
      const cur = getProfile().grade || '';
      const grid = document.getElementById('gradeGrid');
      grid.innerHTML = GRADE_OPTIONS.map(g =>
        `<button type="button" class="grade-opt ${g === cur ? 'current' : ''}" onclick="setGrade('${g}')">${g}</button>`
      ).join('');
      document.getElementById('gradeModal').style.display = 'flex';
    }
    function closeGradePicker() {
      document.getElementById('gradeModal').style.display = 'none';
    }
    function setGrade(g) {
      const p = getProfile();
      p.grade = g;
      saveProfile(p);
      closeGradePicker();
      fillHome(p);
      showExpToast(5, '更新工龄');
    }

    // 生成存档长图 -> 存到相册（Web Share API），不支持时下载 PNG
    async function saveArchiveToAlbum() {
      const btn = document.getElementById('saveToAlbumBtn');
      btn.disabled = true;
      btn.textContent = '\u23f3 正在生成存档图\u2026';
      try {
        const canvas = await drawArchiveCanvas();
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const fname = '\u5730\u7403Online\u725b\u9a6c\u7248\u5b58\u6863_' + today() + '.png';
        const file = new File([blob], fname, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          // 手机：唤起系统分享面板，可选「存入照片/保存图片」
          try {
            await navigator.share({ files: [file], title: '\u5730\u7403Online \u725b\u9a6c\u4eba\u7269\u5b58\u6863' });
          } catch(e) { /* 用户取消 */ }
        } else {
          // 桌面/不支持分享文件：直接下载 PNG
          const a = document.createElement('a');
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 3000);
        }
      } catch(e) {
        alert('\u751f\u6210\u5b58\u6863\u56fe\u5931\u8d25\uff1a' + (e.message || e));
      } finally {
        btn.disabled = false;
        btn.textContent = '\ud83d\udcf7 \u4fdd\u5b58\u5230\u76f8\u518c\uff08\u751f\u6210\u5b58\u6863\u56fe\uff09';
      }
    }

    /* ============================================================
       \u7eaf Canvas 2D \u7ed8\u5236\u5b58\u6863\u957f\u56fe\uff08\u50cf\u7d20\u6e38\u620f\u98ce\uff0c\u96f6\u5916\u90e8\u4f9d\u8d56\uff09
       ============================================================ */
    const ARC_FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
    const ARC_C = {
      bg: '#f3e8d0', card: '#fffaf0', ink: '#2c3e50', soft: '#8a7a63',
      accent: '#e8843c', chip: '#ffe9c4', blue: '#5fb4f2', green: '#4caf7d', greenSoft: '#d8f0e2'
    };
    function _arcRoundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    // \u50cf\u7d20\u98ce\u5361\u7247\uff1a\u5976\u6cb9\u5e95 + \u6df1\u8272\u63cf\u8fb9 + \u786c\u9634\u5f71
    function _arcCard(ctx, x, y, w, h) {
      ctx.fillStyle = 'rgba(44,62,80,0.16)';
      _arcRoundRect(ctx, x + 4, y + 4, w, h, 10); ctx.fill();
      ctx.fillStyle = ARC_C.card;
      _arcRoundRect(ctx, x, y, w, h, 10); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = ARC_C.ink;
      _arcRoundRect(ctx, x, y, w, h, 10); ctx.stroke();
    }
    function _arcWrap(ctx, text, maxW) {
      const lines = [];
      let line = '';
      for (const ch of String(text == null ? '' : text)) {
        if (ch === '\n') { lines.push(line); line = ''; continue; }
        if (line && ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; }
        else line += ch;
      }
      if (line) lines.push(line);
      return lines;
    }

    async function drawArchiveCanvas() {
      const W = 750, M = 26;
      const profile = getProfile();
      const skills = getSkills();
      const exps = getExperiences();
      const totalExp = getPlayerData().exp || 0;
      const curLv = getLevel(totalExp);
      const confirmed = skills.filter(s => s.status === 'lit');
      const learning = skills.filter(s => s.status === 'learning' && Array.isArray(s.plan) && s.plan.length);
      const doneTaskCount = skills.reduce((n, s) => n + (Array.isArray(s.plan) ? s.plan.filter(p => p.done).length : 0), 0);
      const sortedExps = [...exps].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const nick = profile.nickname || '\u533f\u540d\u5192\u9669\u8005';
      const uid = genId(nick + (profile.school || ''));
      const catLevels = computeCategoryLevels().slice(0, 5);
      const stageTitle = ['\u65b0\u624b\u725b\u9a6c', '\u521d\u7ea7\u725b\u9a6c', '\u719f\u7ec3\u725b\u9a6c', '\u8d44\u6df1\u725b\u9a6c', '\u4f20\u5947\u725b\u9a6c'][Math.min(4, Math.floor(curLv / 6))] || '\u4f20\u5947\u725b\u9a6c';
      const dateStr = today();

      // \u89d2\u8272\u56fe\u9884\u52a0\u8f7d\uff08\u5931\u8d25\u5219\u65e0\u5934\u50cf\u51fa\u56fe\uff0c\u4e0d\u5f71\u54cd\u6574\u4f53\uff09
      let portrait = null;
      try {
        portrait = await new Promise(res => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = () => res(null);
          img.src = pickCharImage(profile);
          setTimeout(() => res(null), 2500);
        });
      } catch(e) { portrait = null; }

      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = 4200;
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      const CW = W - M * 2;
      let y = 0;

      // ---- \u80cc\u666f\uff1a\u5976\u6cb9\u5e95 + \u50cf\u7d20\u70b9\u9635 ----
      ctx.fillStyle = ARC_C.bg;
      ctx.fillRect(0, 0, W, 4200);
      ctx.fillStyle = 'rgba(44,62,80,0.05)';
      for (let gy = 14; gy < 4200; gy += 26) {
        for (let gx = ((gy / 26) % 2) ? 26 : 0; gx < W; gx += 52) {
          ctx.fillRect(gx, gy, 3, 3);
        }
      }

      y = 22;
      // ---- 1. Hero \u6a2a\u5e55 ----
      const heroH = 118;
      const grad = ctx.createLinearGradient(M, 0, W - M, 0);
      grad.addColorStop(0, '#2c3e50'); grad.addColorStop(1, '#46617e');
      ctx.fillStyle = grad;
      _arcRoundRect(ctx, M, y, CW, heroH, 12); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = ARC_C.ink;
      _arcRoundRect(ctx, M, y, CW, heroH, 12); ctx.stroke();
      ctx.fillStyle = '#fffaf0';
      ctx.font = '800 30px ' + ARC_FONT;
      ctx.fillText('\u5730\u7403', M + 22, y + 18);
      const earthW = ctx.measureText('\u5730\u7403').width;
      ctx.fillStyle = ARC_C.accent;
      ctx.fillText('Online', M + 22 + earthW, y + 18);
      ctx.fillStyle = 'rgba(255,250,240,.75)';
      ctx.font = '700 14px ' + ARC_FONT;
      ctx.fillText('\u725b\u9a6c\u7248 \u00b7 \u6211\u7684\u804c\u573a\u4eba\u7269\u5b58\u6863', M + 24, y + 60);
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      _arcRoundRect(ctx, W - M - 150, y + 16, 128, 52, 8); ctx.fill();
      ctx.fillStyle = ARC_C.accent;
      ctx.font = '800 13px ' + ARC_FONT;
      ctx.fillText('SAVE', W - M - 138, y + 24);
      ctx.fillStyle = '#fffaf0';
      ctx.font = '700 13px ' + ARC_FONT;
      ctx.fillText(dateStr, W - M - 138, y + 42);
      const pills = ['\ud83e\ude90 \u767b\u5f55\u5730\u7403', '\ud83e\udded \u63a2\u7d22\u4e16\u754c', '\u2694\ufe0f \u5347\u7ea7\u81ea\u5df1'];
      let px = M + 22;
      ctx.font = '700 12px ' + ARC_FONT;
      pills.forEach(pl => {
        const pw = ctx.measureText(pl).width + 20;
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        _arcRoundRect(ctx, px, y + 84, pw, 22, 11); ctx.fill();
        ctx.fillStyle = '#fffaf0';
        ctx.fillText(pl, px + 10, y + 89);
        px += pw + 8;
      });
      y += heroH + 14;

      // ---- 2. PLAYER \u5361 ----
      const pH = 152;
      _arcCard(ctx, M, y, CW, pH);
      ctx.fillStyle = ARC_C.accent;
      ctx.font = '800 12px ' + ARC_FONT;
      ctx.fillText('PLAYER \u00b7 \u5f53\u524d\u5b58\u6863', M + 16, y + 12);
      const avX = M + 16, avY = y + 32, avS = 92;
      ctx.fillStyle = ARC_C.chip;
      _arcRoundRect(ctx, avX, avY, avS, avS, 8); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = ARC_C.ink;
      _arcRoundRect(ctx, avX, avY, avS, avS, 8); ctx.stroke();
      if (portrait) {
        ctx.save();
        _arcRoundRect(ctx, avX + 2, avY + 2, avS - 4, avS - 4, 7); ctx.clip();
        const iw = portrait.naturalWidth || avS, ih = portrait.naturalHeight || avS;
        const sc = Math.max(avS / iw, avS / ih);
        const dw = iw * sc, dh = ih * sc;
        ctx.drawImage(portrait, avX + 2 + (avS - 4 - dw) / 2, avY + 2 + (avS - 4 - dh) / 2, dw, dh);
        ctx.restore();
      } else {
        ctx.fillStyle = ARC_C.soft;
        ctx.font = '700 12px ' + ARC_FONT;
        ctx.fillText('\u6682\u65e0\u5934\u50cf', avX + 22, avY + 40);
      }
      const infoX = avX + avS + 18;
      const rows = [
        ['\u73a9\u5bb6\u540d\u79f0', nick],
        ['\u5f53\u524d\u516c\u53f8', profile.school || '\u2014'],
        ['\u804c　　位', profile.major || '\u2014'],
        ['\u5de5　　龄', profile.grade || '\u2014'],
        ['UID', uid]
      ];
      let ry = y + 32;
      rows.forEach(r => {
        ctx.fillStyle = ARC_C.soft;
        ctx.font = '700 12px ' + ARC_FONT;
        ctx.fillText(r[0], infoX, ry + 2);
        ctx.fillStyle = ARC_C.ink;
        ctx.font = '700 15px ' + ARC_FONT;
        let v = String(r[1] || '\u2014');
        while (ctx.measureText(v).width > CW - (infoX - M) - 90 && v.length > 2) v = v.slice(0, -2) + '\u2026';
        ctx.fillText(v, infoX + 76, ry);
        ry += 22;
      });
      const quote = profile.oneLineDesc ? '\u201c' + profile.oneLineDesc + '\u201d' : '\u201c\u6b63\u5728\u957f\u6210\u81ea\u5df1\u7684\u6837\u5b50\u3002\u201d';
      const qLines = _arcWrap(ctx, quote, CW - 48);
      const qH = 18 + qLines.length * 20;
      ctx.fillStyle = 'rgba(255,233,196,.9)';
      _arcRoundRect(ctx, M + 14, y + pH - qH - 12, CW - 28, qH, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(44,62,80,.25)'; ctx.lineWidth = 1.5;
      _arcRoundRect(ctx, M + 14, y + pH - qH - 12, CW - 28, qH, 8); ctx.stroke();
      ctx.fillStyle = ARC_C.ink;
      ctx.font = 'italic 700 13px ' + ARC_FONT;
      qLines.forEach((ln, i) => ctx.fillText(ln, M + 26, y + pH - qH - 12 + 9 + i * 20));
      y += pH + 14;

      // ---- 3. \u5173\u5361\uff08\u7b49\u7ea7\uff09\u5361 ----
      const lvH = 100;
      _arcCard(ctx, M, y, CW, lvH);
      ctx.fillStyle = ARC_C.accent;
      ctx.font = '800 14px ' + ARC_FONT;
      ctx.fillText('\u2b50 \u6211\u7684\u5173\u5361', M + 16, y + 12);
      const lvBX = M + 16, lvBY = y + 38, lvBS = 48;
      ctx.fillStyle = ARC_C.accent;
      _arcRoundRect(ctx, lvBX, lvBY, lvBS, lvBS, 8); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = ARC_C.ink;
      _arcRoundRect(ctx, lvBX, lvBY, lvBS, lvBS, 8); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '800 22px ' + ARC_FONT;
      ctx.fillText(String(curLv), lvBX + lvBS / 2, lvBY + 12);
      ctx.font = '800 10px ' + ARC_FONT;
      ctx.fillText('Lv', lvBX + lvBS / 2, lvBY + 36);
      ctx.textAlign = 'left';
      const barX = lvBX + lvBS + 16, barW = CW - (barX - M) - 16;
      ctx.fillStyle = ARC_C.ink;
      ctx.font = '800 17px ' + ARC_FONT;
      ctx.fillText(stageTitle, barX, lvBY + 2);
      const p = getExpProgress(totalExp);
      const trackY = lvBY + 30, trackH = 14;
      ctx.fillStyle = 'rgba(44,62,80,.12)';
      _arcRoundRect(ctx, barX, trackY, barW, trackH, 7); ctx.fill();
      ctx.fillStyle = ARC_C.accent;
      _arcRoundRect(ctx, barX, trackY, Math.max(10, barW * (p.lv >= 30 ? 1 : p.pct / 100)), trackH, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(44,62,80,.4)'; ctx.lineWidth = 1.5;
      _arcRoundRect(ctx, barX, trackY, barW, trackH, 7); ctx.stroke();
      ctx.fillStyle = ARC_C.soft;
      ctx.font = '700 12px ' + ARC_FONT;
      ctx.fillText('EXP ' + totalExp + (p.lv >= 30 ? ' \u00b7 \u5df2\u6ee1\u7ea7' : ' \u00b7 \u8ddd\u79bb Lv.' + (p.lv + 1) + ' \u8fd8\u5dee ' + Math.max(0, (LEVEL_TABLE[p.lv + 1] || totalExp) - totalExp)), barX, trackY + 20);
      y += lvH + 14;

      // ---- 4. \u4eba\u7269\u5173\u952e\u8bcd ----
      const kws = [...new Set([...parseList(profile.interests).slice(0, 3), ...confirmed.map(s => s.name).slice(0, 2)])].slice(0, 6);
      ctx.fillStyle = ARC_C.ink;
      ctx.font = '800 14px ' + ARC_FONT;
      ctx.fillText('\ud83c\udff7\ufe0f \u4eba\u7269\u5173\u952e\u8bcd', M + 4, y);
      y += 26;
      if (kws.length) {
        let kx = M + 2;
        ctx.font = '700 13px ' + ARC_FONT;
        kws.forEach(k => {
          const kw = ctx.measureText(k).width + 22;
          if (kx + kw > W - M) { kx = M + 2; y += 30; }
          ctx.fillStyle = ARC_C.chip;
          _arcRoundRect(ctx, kx, y, kw, 24, 12); ctx.fill();
          ctx.strokeStyle = 'rgba(44,62,80,.35)'; ctx.lineWidth = 1.5;
          _arcRoundRect(ctx, kx, y, kw, 24, 12); ctx.stroke();
          ctx.fillStyle = ARC_C.ink;
          ctx.fillText(k, kx + 11, y + 5);
          kx += kw + 8;
        });
        y += 34;
      } else {
        ctx.fillStyle = ARC_C.soft;
        ctx.font = '400 13px ' + ARC_FONT;
        ctx.fillText('\u2014 \u8fd8\u6ca1\u6709\u5173\u952e\u8bcd\uff0c\u53bb\u8bb0\u51e0\u6bb5\u7ecf\u5386\u5427 \u2014', M + 4, y);
        y += 26;
      }
      y += 6;

      // ---- 5. \u5df2\u70b9\u4eae\u6280\u80fd ----
      ctx.fillStyle = ARC_C.ink;
      ctx.font = '800 14px ' + ARC_FONT;
      ctx.fillText('\u2705 \u5df2\u70b9\u4eae\u7684\u6280\u80fd\uff08' + confirmed.length + '\uff09', M + 4, y);
      y += 26;
      if (confirmed.length) {
        confirmed.forEach(s => {
          ctx.font = '700 14px ' + ARC_FONT;
          const rowW = Math.min(ctx.measureText('\u2713 ' + s.name).width + 26, CW);
          ctx.fillStyle = ARC_C.greenSoft;
          _arcRoundRect(ctx, M + 2, y, rowW, 26, 6); ctx.fill();
          ctx.strokeStyle = 'rgba(76,175,125,.5)'; ctx.lineWidth = 1.5;
          _arcRoundRect(ctx, M + 2, y, rowW, 26, 6); ctx.stroke();
          ctx.fillStyle = '#2c6e4f';
          ctx.fillText('\u2713 ' + s.name, M + 13, y + 5);
          y += 32;
        });
      } else {
        ctx.fillStyle = ARC_C.soft;
        ctx.font = '400 13px ' + ARC_FONT;
        ctx.fillText('\u8fd8\u6ca1\u6709\u70b9\u4eae\u7684\u6280\u80fd\uff0c\u4ece\u8bb0\u5f55\u4e00\u6bb5\u7ecf\u5386\u5f00\u59cb', M + 4, y);
        y += 26;
      }
      y += 8;

      // ---- 6. \u5b66\u4e60\u4e2d\u7684\u6280\u80fd\uff08\u8fdb\u5ea6\u6761\uff09 ----
      ctx.fillStyle = ARC_C.ink;
      ctx.font = '800 14px ' + ARC_FONT;
      ctx.fillText('\ud83c\udf31 \u6b63\u5728\u5b66\u4e60\uff08' + learning.length + '\uff09', M + 4, y);
      y += 26;
      if (learning.length) {
        learning.slice(0, 4).forEach(s => {
          const doneN = s.plan.filter(tk => tk.done).length;
          const pct2 = s.plan.length ? Math.round(doneN / s.plan.length * 100) : 0;
          ctx.fillStyle = ARC_C.ink;
          ctx.font = '700 14px ' + ARC_FONT;
          ctx.fillText(s.name, M + 4, y);
          ctx.fillStyle = ARC_C.soft;
          ctx.font = '700 12px ' + ARC_FONT;
          ctx.textAlign = 'right';
          ctx.fillText(doneN + '/' + s.plan.length, W - M - 4, y + 1);
          ctx.textAlign = 'left';
          y += 22;
          const pw = CW - 8;
          ctx.fillStyle = 'rgba(44,62,80,.12)';
          _arcRoundRect(ctx, M + 4, y, pw, 10, 5); ctx.fill();
          ctx.fillStyle = ARC_C.blue;
          _arcRoundRect(ctx, M + 4, y, Math.max(6, pw * pct2 / 100), 10, 5); ctx.fill();
          y += 22;
        });
      } else {
        ctx.fillStyle = ARC_C.soft;
        ctx.font = '400 13px ' + ARC_FONT;
        ctx.fillText('\u8fd8\u6ca1\u6709\u5728\u5b66\u7684\u6280\u80fd\uff0c\u53bb\u6280\u80fd\u6811\u70b9\u4e00\u4e2a\u300c\u6211\u60f3\u5b66\u300d', M + 4, y);
        y += 26;
      }
      y += 8;

      // ---- 7. \u6280\u80fd\u7b49\u7ea7 TOP5 ----
      if (catLevels.length) {
        ctx.fillStyle = ARC_C.ink;
        ctx.font = '800 14px ' + ARC_FONT;
        ctx.fillText('\ud83d\udcca \u6280\u80fd\u7b49\u7ea7 TOP ' + catLevels.length, M + 4, y);
        y += 26;
        const maxLv = catLevels[0].level;
        catLevels.forEach(c => {
          ctx.fillStyle = ARC_C.ink;
          ctx.font = '700 13px ' + ARC_FONT;
          ctx.fillText(c.name, M + 4, y);
          const bx = M + 108, bw = CW - 170;
          ctx.fillStyle = 'rgba(44,62,80,.12)';
          _arcRoundRect(ctx, bx, y + 2, bw, 12, 6); ctx.fill();
          ctx.fillStyle = ARC_C.accent;
          _arcRoundRect(ctx, bx, y + 2, Math.max(8, bw * c.level / Math.max(maxLv, 1)), 12, 6); ctx.fill();
          ctx.fillStyle = ARC_C.ink;
          ctx.font = '800 13px ' + ARC_FONT;
          ctx.textAlign = 'right';
          ctx.fillText('Lv.' + c.level, W - M - 4, y + 1);
          ctx.textAlign = 'left';
          y += 26;
        });
        y += 6;
      }

      // ---- 8. \u725b\u9a6c\u65f6\u95f4\u7ebf\uff08\u6700\u8fd1\u7ecf\u5386\uff09 ----
      ctx.fillStyle = ARC_C.ink;
      ctx.font = '800 14px ' + ARC_FONT;
      ctx.fillText('\ud83d\udcc5 \u6700\u8fd1\u7ecf\u5386\uff08' + exps.length + ' \u6bb5\uff09', M + 4, y);
      y += 26;
      if (sortedExps.length) {
        sortedExps.slice(0, 4).forEach(e => {
          ctx.fillStyle = ARC_C.accent;
          ctx.font = '800 12px ' + ARC_FONT;
          ctx.fillText((e.date || '').slice(5), M + 4, y + 1);
          ctx.fillStyle = ARC_C.ink;
          ctx.font = '400 13px ' + ARC_FONT;
          let tt = e.title || '';
          const maxW = CW - 70;
          while (ctx.measureText(tt).width > maxW && tt.length > 3) tt = tt.slice(0, -2) + '\u2026';
          ctx.fillText(tt, M + 56, y);
          y += 24;
        });
      } else {
        ctx.fillStyle = ARC_C.soft;
        ctx.font = '400 13px ' + ARC_FONT;
        ctx.fillText('\u8fd8\u6ca1\u6709\u7ecf\u5386\u8bb0\u5f55', M + 4, y);
        y += 24;
      }
      y += 10;

      // ---- 9. \u9875\u811a ----
      const footH = 58;
      _arcCard(ctx, M, y, CW, footH);
      ctx.fillStyle = ARC_C.ink;
      ctx.font = '800 13px ' + ARC_FONT;
      ctx.textAlign = 'center';
      ctx.fillText('\u5730\u7403Online\uff08\u725b\u9a6c\u7248\uff09\u00b7 \u771f\u5b9e\u7ecf\u5386 \u00b7 \u81ea\u5df1\u786e\u8ba4 \u00b7 \u957f\u6210\u4f60\u81ea\u5df1', W / 2, y + 14);
      ctx.fillStyle = ARC_C.soft;
      ctx.font = '700 12px ' + ARC_FONT;
      ctx.fillText('\u7d2f\u8ba1\u7ecf\u5386 ' + exps.length + ' \u6bb5 \u00b7 \u5b8c\u6210\u5b66\u4e60\u4efb\u52a1 ' + doneTaskCount + ' \u4e2a \u00b7 \u751f\u6210\u4e8e ' + dateStr, W / 2, y + 32);
      ctx.textAlign = 'left';
      y += footH + 26;

      // ---- \u88c1\u6389\u591a\u4f59\u7a7a\u767d ----
      const finalH = Math.max(y, 400);
      const out = document.createElement('canvas');
      out.width = W; out.height = finalH;
      out.getContext('2d').drawImage(canvas, 0, 0);
      return out;
    }
    document.getElementById('archiveModal').addEventListener('click', function(e) {
      if (e.target === this) closeArchive();
    });

    function suggestArchiveName() {
      const p = getProfile();
      return p.grade ? p.grade + '存档' : '';
    }

    // ---- 存档主体：横向三栏人物资料卡（参考游戏存档卡） ----
    function archiveHtml() {
      const profile = getProfile();
      const skills = getSkills();
      const exps = getExperiences();
      const trees = getTrees();
      const sortedExps = [...exps].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      const confirmed = skills.filter(s => s.status === 'lit');
      const learning = skills.filter(s => s.status !== 'lit' && s.plan && s.plan.length);
      const exploring = skills.filter(s => s.status === 'want' || (!s.plan && s.status !== 'lit'));

      const nick = profile.nickname || '匿名冒险者';
      const date = today();
      const uid = genId(nick + (profile.school || ''));

      const profileKw = [
        ...parseList(profile.interests).slice(0, 3),
        ...parseList(profile.skills).slice(0, 2),
      ];
      const skillKw = confirmed.map(s => s.name).slice(0, 2);
      const allKw = [...new Set([...profileKw, ...skillKw])].slice(0, 6);

      const descKw = parseList(profile.interests)[0]
        || confirmed[0]?.name
        || parseList(profile.futureJobs)[0]
        || '';
      const desc = descKw
        ? '正在长成一个会「' + descKw + '」的人。'
        : '正在写下自己的人物档案。';

      const playerData = getPlayerData();
      const totalExp = playerData.exp || 0;
      const curLv = getLevel(totalExp);
      const nextLvExp = LEVEL_TABLE[curLv + 1] || LEVEL_TABLE[LEVEL_TABLE.length - 1];
      const lvBaseExp = LEVEL_TABLE[curLv] || 0;
      const lvProgress = nextLvExp > lvBaseExp ? Math.min(100, Math.round((totalExp - lvBaseExp) / (nextLvExp - lvBaseExp) * 100)) : 0;
      const expToNext = Math.max(0, nextLvExp - totalExp);
      const stageTitle = ['新手冒险者', '冒险学徒', '经验冒险者', '资深冒险者', '传奇冒险者'][Math.min(4, Math.floor(curLv / 6))] || '传奇冒险者';

      function skillLevel(s) {
        if (s.status === 'lit') {
          const expN = (s.sourceExpIds || []).length;
          return expN + 1;
        }
        if (Array.isArray(s.plan)) {
          const done = s.plan.filter(p => p.done).length;
          return Math.floor(done / 2) + 1;
        }
        return 1;
      }

      const skillByTree = [];
      const usedIds = new Set();
      trees.forEach(t => {
        const grp = confirmed.filter(s => (s.treeIds || []).includes(t.id));
        if (grp.length) {
          grp.forEach(s => usedIds.add(s.id));
          skillByTree.push({ name: t.name, icon: t.icon || '🌳', skills: grp });
        }
      });
      const orphan = confirmed.filter(s => !usedIds.has(s.id));
      if (orphan.length) {
        skillByTree.push({ name: '已点亮', icon: '✨', skills: orphan });
      }

      const catLevels = computeCategoryLevels().slice(0, 8);
      const timelineNodes = pickTimelineNodes([...sortedExps].reverse(), 6);

      const newSkills = confirmed
        .filter(s => s.confirmedAt)
        .sort((a, b) => (b.confirmedAt || '').localeCompare(a.confirmedAt || ''))
        .slice(0, 4);
      const newExps = sortedExps.slice(0, 4);
      const newGoals = learning.slice(0, 3);

      const futureKws = parseList(profile.futureJobs).slice(0, 4);
      const futureItems = [
        ...futureKws.slice(0, 3).map(t => ({ icon: '🎯', text: '更好地完成 ' + t + ' 方向' })),
        ...exploring.slice(0, 2).map(s => ({ icon: '🌱', text: '探索 ' + s.name })),
      ];

      let html = '';
      const skillIcons = './assets/img/decor/skill/icons/';
      const charImg = pickCharImage(profile);

      // 1. Hero（纯 CSS）
      html += '<div class="arcx-v3-hero">';
      html += '  <div class="arcx-hero-logo">';
      html += '    <span class="arcx-logo-text">地球<span class="arcx-logo-accent">Online</span></span>';
      html += '    <span class="arcx-logo-tag">我的牛马人物存档</span>';
      html += '  </div>';
      html += '  <div class="arcx-hero-tags"><span>真实经历</span><span>·</span><span>自己确认</span><span>·</span><span>长成你自己</span></div>';
      html += '  <div class="arcx-hero-actions">';
      html += '    <span class="arcx-hero-btn">🪐 登录地球</span>';
      html += '    <span class="arcx-hero-btn">🧭 探索世界</span>';
      html += '    <span class="arcx-hero-btn">⚔️ 升级自己</span>';
      html += '  </div>';
      html += '  <div class="arcx-hero-save"><div class="arcx-save-ver">v1.0</div><div class="arcx-save-date">SAVE ' + escapeHtml(date) + '</div></div>';
      html += '</div>';

      // 2. PLAYER（保留 card-bg 美术）
      html += '<div class="arcx-player">';
      html += '  <img class="arcx-player-bg" src="./assets/img/decor/arch/card-bg.png" alt="" />';
      html += '  <div class="arcx-player-tag">PLAYER · 当前存档</div>';
      html += '  <div class="arcx-player-portrait"><img src="' + escapeHtml(charImg) + '" alt="角色" /></div>';
      html += '  <div class="arcx-player-info">';
      html += '    <div class="apinfo-row"><span class="apinfo-k">玩家名称</span><span class="apinfo-v">' + escapeHtml(nick) + '</span></div>';
      html += '    <div class="apinfo-row"><span class="apinfo-k">当前公司</span><span class="apinfo-v">' + escapeHtml(profile.school || '—') + '</span></div>';
      html += '    <div class="apinfo-row"><span class="apinfo-k">职 位</span><span class="apinfo-v">' + escapeHtml(profile.major || '—') + '</span></div>';
      html += '    <div class="apinfo-row"><span class="apinfo-k">工 龄</span><span class="apinfo-v">' + escapeHtml(profile.grade || '—') + '</span></div>';
      html += '    <div class="apinfo-row"><span class="apinfo-k">存档日</span><span class="apinfo-v">' + escapeHtml(date) + '</span></div>';
      html += '    <div class="apinfo-row"><span class="apinfo-k">UID</span><span class="apinfo-v">' + escapeHtml(uid) + '</span></div>';
      html += '  </div>';
      html += '</div>';

      // 3. 我的关卡（纯 CSS）
      html += '<div class="arcx-stage-card">';
      html += '  <div class="arcx-stage-card-title">⭐ 我的关卡</div>';
      html += '  <div class="arcx-stage-card-body">';
      html += '    <div class="arcx-stage-lv-box">';
      html += '      <div class="arcx-stage-lv-num">' + curLv + '</div>';
      html += '      <div class="arcx-stage-lv-tag">Lv</div>';
      html += '    </div>';
      html += '    <div class="arcx-stage-info">';
      html += '      <div class="arcx-stage-title">' + escapeHtml(stageTitle) + '</div>';
      html += '      <div class="arcx-stage-bar"><div class="arcx-stage-fill" style="width:' + lvProgress + '%;"></div></div>';
      html += '      <div class="arcx-stage-stats">';
      html += '        <span>EXP ' + totalExp + '</span>';
      html += '        <span>距离 Lv.' + (curLv + 1) + ' 还差 ' + expToNext + '</span>';
      html += '      </div>';
      html += '    </div>';
      html += '  </div>';
      html += '</div>';

      // 4. 关键词 + 一句话（纯 CSS）
      html += '<div class="arcx-tags-block">';
      html += '  <div class="arcx-card-title-row">🏷️ 人物关键词</div>';
      html += '  <div class="arcx-tag-chips">';
      if (allKw.length) {
        allKw.forEach(k => { html += '<span class="arcx-chip">' + escapeHtml(k) + '</span>'; });
      } else {
        html += '<span class="arcx-empty">— 还没有关键词 —</span>';
      }
      html += '  </div>';
      html += '</div>';
      html += '<div class="arcx-quote-block">';
      html += '  <div class="arcx-quote-text">「' + escapeHtml(desc) + '」</div>';
      html += '</div>';

      // 5. 当前能力（简洁卡片 + 技能图标 + Lv + 进度条）
      html += '<div class="arcx-sec arcx-sec-abilities">';
      html += '  <div class="arcx-sec-title"><span class="arcx-tit-icon">⚔️</span><span>当前能力 · 每个技能的等级</span><span class="arcx-tit-count">' + confirmed.length + '</span></div>';
      html += '  <div class="arcx-sec-body">';
      if (skillByTree.length) {
        skillByTree.forEach(grp => {
          html += '<div class="arcx-branch">';
          html += '  <div class="arcx-branch-head">';
          html += '    <span class="arcx-branch-ico">' + escapeHtml(grp.icon || '🌳') + '</span>';
          html += '    <span class="arcx-branch-name">' + escapeHtml(grp.name) + '</span>';
          html += '    <span class="arcx-branch-count">' + grp.skills.length + '</span>';
          html += '  </div>';
          html += '  <div class="arcx-branch-skills">';
          grp.skills.forEach(s => {
            const lv = skillLevel(s);
            const lvColor = lv >= 5 ? '#ff7a45' : lv >= 3 ? '#5fb4f2' : '#7cd992';
            const iconKey = (s.name || '').indexOf('摄影') >= 0 ? 'camera'
                          : (s.name || '').indexOf('模型') >= 0 || (s.name || '').indexOf('SketchUp') >= 0 || (s.name || '').indexOf('SU') >= 0 ? 'ruler'
                          : (s.name || '').indexOf('手绘') >= 0 ? 'paintbrush'
                          : (s.name || '').indexOf('原型') >= 0 || (s.name || '').indexOf('设计') >= 0 ? 'palette'
                          : (s.name || '').indexOf('代码') >= 0 || (s.name || '').indexOf('编程') >= 0 ? 'code'
                          : 'achievement-star';
            html += '<div class="arcx-ab-row">';
            html += '  <img class="arcx-ab-ico" src="' + skillIcons + iconKey + '.png" alt="" />';
            html += '  <span class="arcx-ab-name">' + escapeHtml(s.name) + '</span>';
            html += '  <span class="arcx-ab-bar"><span class="arcx-ab-fill" style="width:' + Math.min(100, lv * 25) + '%; background:' + lvColor + ';"></span></span>';
            html += '  <span class="arcx-ab-lv" style="border-color:' + lvColor + '; color:' + lvColor + ';">Lv.' + lv + '</span>';
            html += '</div>';
          });
          html += '  </div>';
          html += '</div>';
        });
      } else {
        html += '<div class="arcx-empty">⌛ 还没有确认的技能 — 记一段经历 → 提炼技能 → 自己确认后亮起</div>';
      }
      html += '  </div>';
      html += '</div>';

      // 6. 学习进度（简洁卡片 + 进度条）
      html += '<div class="arcx-sec arcx-sec-learning">';
      html += '  <div class="arcx-sec-title"><span class="arcx-tit-icon">🔍</span><span>学习技能进度</span><span class="arcx-tit-sub">' + learning.length + ' 项进行中</span></div>';
      html += '  <div class="arcx-sec-body">';
      if (learning.length) {
        learning.slice(0, 3).forEach((s, idx) => {
          const done = s.plan.filter(p => p.done).length;
          const total = s.plan.length;
          const pct = total ? Math.round(done / total * 100) : 0;
          const iconKey = (s.name || '').indexOf('摄影') >= 0 ? 'camera'
                         : (s.name || '').indexOf('SU') >= 0 || (s.name || '').indexOf('模型') >= 0 ? 'ruler'
                         : 'book';
          html += '<div class="arcx-stage-row">';
          html += '  <span class="arcx-stage-tag">STAGE ' + (idx + 1) + '</span>';
          html += '  <img class="arcx-stage-ico" src="' + skillIcons + iconKey + '.png" alt="" />';
          html += '  <span class="arcx-stage-name">' + escapeHtml(s.name) + '</span>';
          html += '  <span class="arcx-stage-bar"><span class="arcx-stage-fill" style="width:' + pct + '%;"></span></span>';
          html += '  <span class="arcx-stage-pct">' + done + '/' + total + '</span>';
          html += '</div>';
        });
      } else {
        html += '<div class="arcx-empty">🪄 还没有学习目标 — 在技能树里开一条「想学」就有了</div>';
      }
      html += '  </div>';
      html += '</div>';

      // 7. 分类技能等级榜（简洁网格）
      if (catLevels.length) {
        html += '<div class="arcx-sec arcx-sec-cat">';
        html += '  <div class="arcx-sec-title"><span class="arcx-tit-icon">🎯</span><span>分类技能等级 · 自动识别</span><span class="arcx-tit-sub">从所有经历和任务累积</span></div>';
        html += '  <div class="arcx-sec-body">';
        html += '    <div class="arcx-cat-grid">';
        catLevels.forEach(c => {
          html += '<div class="arcx-cat-cell">';
          html += '  <img class="arcx-cat-ico" src="' + skillIcons + escapeHtml(c.icon) + '.png" alt="" />';
          html += '  <span class="arcx-cat-name">' + escapeHtml(c.name) + '</span>';
          html += '  <span class="arcx-cat-lv">Lv.' + c.level + '</span>';
          html += '</div>';
        });
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
      }

      // 8. 重要经历时间线（纯 CSS：圆点 + 连接线）
      html += '<div class="arcx-sec arcx-sec-timeline">';
      html += '  <div class="arcx-sec-title"><span class="arcx-tit-icon">🎓</span><span>重要经历时间线</span><span class="arcx-tit-sub">真实记录 · 关键时刻</span></div>';
      html += '  <div class="arcx-sec-body">';
      if (timelineNodes.length) {
        html += '<div class="arcx-tl-list">';
        timelineNodes.forEach((n, i) => {
          html += '<div class="arcx-tl-item' + (i === timelineNodes.length - 1 ? ' latest' : '') + '">';
          html += '  <div class="arcx-tl-rail"><span class="arcx-tl-dot"></span></div>';
          html += '  <div class="arcx-tl-content">';
          html += '    <div class="arcx-tl-date">' + escapeHtml(formatDateShort(n.date)) + '</div>';
          html += '    <div class="arcx-tl-title">' + escapeHtml(n.title) + '</div>';
          html += '  </div>';
          html += '</div>';
        });
        html += '</div>';
      } else {
        html += '<div class="arcx-empty">还没有记录过经历 — 你做的第一件事会出现在这里</div>';
      }
      html += '  </div>';
      html += '</div>';

      // 9. 本版本新增（三栏简洁卡）
      html += '<div class="arcx-sec arcx-sec-whatsnew">';
      html += '  <div class="arcx-sec-title"><span class="arcx-tit-icon">🆕</span><span>本版本新增</span><span class="arcx-tit-sub">这一版和上一版相比</span></div>';
      html += '  <div class="arcx-sec-body">';
      html += '  <div class="arcx-wn-grid">';
      // 新增技能
      html += '<div class="arcx-wn-col">';
      html += '  <div class="arcx-wn-col-title">⭐ 新增技能</div>';
      html += '  <div class="arcx-wn-items">';
      if (newSkills.length) {
        newSkills.forEach(s => { html += '<div class="arcx-wn-item skill">⭐ ' + escapeHtml(s.name) + '</div>'; });
      } else {
        html += '<div class="arcx-wn-empty">— 暂无 —</div>';
      }
      html += '  </div>';
      html += '</div>';
      // 新增经历
      html += '<div class="arcx-wn-col">';
      html += '  <div class="arcx-wn-col-title">📖 新增经历</div>';
      html += '  <div class="arcx-wn-items">';
      if (newExps.length) {
        newExps.forEach(e => { html += '<div class="arcx-wn-item exp">📖 ' + escapeHtml(e.title) + '</div>'; });
      } else {
        html += '<div class="arcx-wn-empty">— 暂无 —</div>';
      }
      html += '  </div>';
      html += '</div>';
      // 新方向
      html += '<div class="arcx-wn-col">';
      html += '  <div class="arcx-wn-col-title">🧭 新方向</div>';
      html += '  <div class="arcx-wn-items">';
      if (newGoals.length) {
        newGoals.forEach(s => { html += '<div class="arcx-wn-item goal">🧭 ' + escapeHtml(s.name) + '</div>'; });
      } else {
        html += '<div class="arcx-wn-empty">— 暂无 —</div>';
      }
      html += '  </div>';
      html += '</div>';
      html += '  </div>';
      html += '  </div>';
      html += '</div>';

      // 10. 未来方向
      html += '<div class="arcx-sec arcx-sec-future">';
      html += '  <div class="arcx-sec-title"><span class="arcx-tit-icon">🌱</span><span>未来方向 · 我想做什么</span></div>';
      html += '  <div class="arcx-sec-body">';
      if (futureItems.length) {
        futureItems.forEach(f => {
          html += '<div class="arcx-future-item"><span class="arcx-future-ico">' + f.icon + '</span><span>' + escapeHtml(f.text) + '</span></div>';
        });
      } else {
        html += '<div class="arcx-empty">填一下「想做的方向」就会出现在这里</div>';
      }
      html += '  </div>';
      html += '</div>';

      // 11. NEXT LEVEL（简洁）
      html += '<div class="arcx-sec arcx-sec-nextlevel">';
      html += '  <div class="arcx-sec-title"><span class="arcx-tit-icon">🏔️</span><span>NEXT LEVEL</span></div>';
      html += '  <div class="arcx-sec-body arcx-nl-body">';
      html += '    <div class="arcx-nl-line">「仍在探索中… 但我相信, 一切都会有意思」</div>';
      html += '    <div class="arcx-nl-sub">' + (learning.length ? '下一次升级：' + escapeHtml(learning[0].name) : '解锁更多技能之后，开启下一段旅程') + '</div>';
      html += '  </div>';
      html += '</div>';

      // 12. Footer（纯 CSS）
      html += '<div class="arcx-footer">';
      html += '  <div class="arcx-footer-brand">🌍 地球Online · 牛马版</div>';
      html += '  <div class="arcx-footer-tagline">探索世界, 也探索自己</div>';
      html += '  <div class="arcx-footer-meta">存档号 ' + escapeHtml(uid) + ' · ' + escapeHtml(date) + '</div>';
      html += '</div>';

      return html;
    }

    // ---- 时间线挑选：均匀分布到 N 个节点 ----
    function pickTimelineNodes(sortedExps, maxN) {
      if (!sortedExps.length) return [];
      if (sortedExps.length <= maxN) return sortedExps;
      const step = (sortedExps.length - 1) / (maxN - 1);
      const picked = [];
      for (let i = 0; i < maxN; i++) {
        const idx = Math.round(i * step);
        if (!picked.includes(sortedExps[idx])) picked.push(sortedExps[idx]);
      }
      return picked;
    }

    function formatDateShort(d) {
      if (!d) return '—';
      // 把 2024-11-20 变成 2024.11
      const parts = d.split('-');
      if (parts.length >= 2) return parts[0] + '.' + parts[1];
      return d;
    }

    // ---- 保存 / 查看 / 删除存档 ----
    async function saveArchive() {
      const name = document.getElementById('archiveName').value.trim() || (today() + ' 存档');

      // 先缓存当前角色图片为 base64（用于存档冻结）
      const charB64 = await cacheCharImageB64();

      // 生成存档 HTML
      let html = archiveHtml();

      // 冻结角色图片：将所有 char-*.(png|jpg) 引用替换为当时的 base64
      if (charB64 && charB64.startsWith('data:')) {
        const charImgRe = new RegExp('<img\\s+src="\\./assets/img/char-[^"]+\\.(?:png|jpg)[^"]*"', 'g');
        html = html.replace(charImgRe, '<img src="' + charB64 + '"');
      }

      const list = getArchives();
      list.unshift({
        id: Date.now(),
        name: name,
        createdAt: today(),
        html: html
      });
      saveArchives(list);
      renderArchiveList();
      document.getElementById('archiveName').value = '';
      addExp(20, '保存了一版存档');
    }

    function viewArchive(id) {
      const a = getArchives().find(x => x.id === id);
      if (!a) return;
      document.getElementById('archiveBody').innerHTML =
        `<div class="arc-history-banner">📦 ${escapeHtml(a.name)} · 保存于 ${escapeHtml(a.createdAt)} —— 这是你当时的样子</div>` + a.html;
      const btn = document.getElementById('archiveSaveBtn');
      btn.textContent = '↩ 回到当前存档';
      btn.onclick = function() { showArchive(); };
      document.getElementById('archiveModal').style.display = 'flex';
    }

    function deleteArchive(id) {
      if (!confirm('确定删除这版存档吗？删除后无法恢复。')) return;
      saveArchives(getArchives().filter(a => a.id !== id));
      renderArchiveList();
    }

    function renderArchiveList() {
      const list = getArchives();
      const el = document.getElementById('archiveList');
      if (!list.length) {
        el.innerHTML = `<div style="font-size:11px; color:var(--c-text-soft);">还没有保存过存档。学期结束时存一版，以后回看会很有意思。</div>`;
        return;
      }
      el.innerHTML = list.map(a => `
        <div class="arc-list-item">
          <span class="arc-list-name">📦 ${escapeHtml(a.name)}</span>
          <span class="arc-list-date">${escapeHtml(a.createdAt)}</span>
          <button type="button" class="arc-list-btn" onclick="viewArchive(${a.id})">查看</button>
          <button type="button" class="arc-list-btn del" onclick="deleteArchive(${a.id})">删除</button>
        </div>`).join('');
    }

    /* ============================================================
       20) AI角色图片生成：提示词构建 + 生成流程
       ============================================================ */

    // 构建 AI 图片提示词：只把适合视觉表达的内容转成人物元素
    function buildCharPrompt(profile) {
      const baseStyle = 'Q-version chibi pixel art full-body game character, modern college student casual fashion, cute proportions not overly childish, front-facing or slight side pose, clean image, light Japanese RPG character sprite aesthetic, simple clean background, clear character outline suitable for small avatar display, 1:1 square composition';

      const parts = [baseStyle];

      // 1) 一句话描述自己 → 直接作为角色个性描述（最强差异化因子）
      if (profile.oneLineDesc) {
        // 将中文描述简要翻译为英文视觉描述
        const desc = profile.oneLineDesc;
        parts.push('character personality: ' + desc);
      }

      // 2) 兴趣关键词 → 精确匹配已知道具 + 未匹配的直接传递
      const interests = parseList(profile.interests);
      const interestProps = [
        [/摄影|相机|拍照|拍人像/, 'holding a camera'],
        [/音乐|听歌/, 'wearing headphones around neck'],
        [/吉他|尤克里里/, 'holding a guitar'],
        [/画画|素描|插画|手绘|板绘|绘画/, 'holding a sketchbook and pencil'],
        [/编程|代码|开发/, 'holding a laptop'],
        [/读书|阅读|看书/, 'holding a book'],
        [/做饭|烹饪|烧菜|下厨/, 'holding a cooking spatula'],
        [/健身|运动|锻炼/, 'wearing sportswear with a towel around neck'],
        [/跑步|慢跑/, 'wearing running shoes and sportswear'],
        [/设计|ps|figma/, 'holding a drawing tablet'],
        [/写作|写文章|写故事|文案/, 'holding a pen and notebook'],
        [/视频|剪辑|剪映|vlog/, 'holding a video camera'],
        [/旅行|旅游|city\s*walk/, 'wearing a small backpack'],
        [/打球|篮球/, 'holding a basketball'],
        [/羽毛球/, 'holding a badminton racket'],
        [/游泳/, 'with swim goggles on head'],
        [/滑板/, 'standing on a skateboard'],
        [/唱歌|歌唱/, 'holding a microphone'],
        [/跳舞|舞蹈/, 'in a dynamic dance pose'],
        [/电影|看电影/, 'holding a popcorn bucket'],
        [/游戏|打游戏|电竞/, 'holding a game controller'],
        [/咖啡|手冲/, 'holding a coffee cup'],
        [/骑行|骑车/, 'wearing a bicycle helmet'],
      ];

      const visualProps = [];
      const unmatchedInterests = [];
      interests.forEach(interest => {
        const lower = interest.toLowerCase();
        let matched = false;
        for (const [pattern, prop] of interestProps) {
          if (pattern.test(lower)) {
            if (!visualProps.includes(prop)) visualProps.push(prop);
            matched = true;
            break;
          }
        }
        if (!matched) unmatchedInterests.push(interest);
      });

      // 最多2个视觉道具，保持画面干净
      if (visualProps.length > 0) {
        parts.push(visualProps.slice(0, 2).join(', '));
      }
      // 未匹配的兴趣也传给模型，让它自行解读
      if (unmatchedInterests.length > 0) {
        parts.push('likes ' + unmatchedInterests.join(', '));
      }

      // 3) 职业关键词 → 同理
      const careers = parseList(profile.futureJobs);
      const careerProps = [
        [/产品经理|产品/, 'holding a tablet with UI mockup'],
        [/设计师/, 'holding a stylus'],
        [/老师|教师|教育/, 'holding a book and pointer'],
        [/医生|护士/, 'wearing a stethoscope'],
        [/工程师|程序员|开发/, 'holding a laptop'],
        [/律师|法务/, 'holding a briefcase'],
        [/记者|编辑/, 'holding a microphone and notepad'],
        [/摄影师/, 'holding a professional camera'],
        [/创作者|博主|自媒体/, 'holding a phone for vlogging'],
      ];

      const unmatchedCareers = [];
      careers.forEach(career => {
        const lower = career.toLowerCase();
        let matched = false;
        for (const [pattern, prop] of careerProps) {
          if (pattern.test(lower)) {
            if (!visualProps.includes(prop) && visualProps.length < 2) {
              visualProps.push(prop);
              parts.push(prop);
            }
            matched = true;
            break;
          }
        }
        if (!matched) unmatchedCareers.push(career);
      });
      if (unmatchedCareers.length > 0) {
        parts.push('aspiring ' + unmatchedCareers.join(', '));
      }

      return parts.join(', ');
    }

    // 当前等待生成的提示词
    let _pendingCharPrompt = '';
    // 角色图片轮询检测定时器
    let _chargenPoller = null;

    // 预设形象列表（运行时通过 XHR 探测，更稳；失败时回落到硬编码清单）
    const PRESET_BGS   = ['background_01','background_02','background_03','background_04','background_05'];
    const PRESET_CHARS = ['character_01','character_02','character_03','character_04','character_05','character_08','character_09','character_10','character_12','character_14','character_17','character_18','character_19','character_22'];

    let _pickBg = null;   // 'background_03'
    let _pickChar = null; // 'character_08'

    // 显示角色选择页（预设背景 + 预设角色）
    function showCharGenPage() {
      _pickBg = null;
      _pickChar = null;
      renderBgGrid();
      renderCharGrid();
      updatePreview();
      goPage('page-chargen');
    }

    function renderBgGrid() {
      const grid = document.getElementById('bgGrid');
      grid.innerHTML = PRESET_BGS.map(name => `
        <button type="button" class="pick-tile ${_pickBg === name ? 'selected' : ''}" data-name="${name}" onclick="selectBg('${name}')">
          <img src="./assets/img/preset/bg/${name}.jpg" alt="${name}" loading="lazy" />
        </button>`).join('');
    }
    function renderCharGrid() {
      const grid = document.getElementById('charGrid');
      grid.innerHTML = PRESET_CHARS.map(name => `
        <button type="button" class="pick-tile ${_pickChar === name ? 'selected' : ''}" data-name="${name}" onclick="selectChar('${name}')">
          <img src="./assets/img/preset/char/${name}.png" alt="${name}" loading="lazy" />
        </button>`).join('');
    }
    function selectBg(name) {
      _pickBg = name;
      renderBgGrid();
      updatePreview();
    }
    function selectChar(name) {
      _pickChar = name;
      renderCharGrid();
      updatePreview();
    }
    function updatePreview() {
      const bg = document.getElementById('bgPreview');
      const ch = document.getElementById('charPreview');
      const empty = document.getElementById('previewEmpty');
      if (_pickBg) { bg.src = `./assets/img/preset/bg/${_pickBg}.jpg`; bg.style.display = 'block'; }
      else { bg.removeAttribute('src'); bg.style.display = 'none'; }
      if (_pickChar) { ch.src = `./assets/img/preset/char/${_pickChar}.png`; ch.style.display = 'block'; }
      else { ch.removeAttribute('src'); ch.style.display = 'none'; }
      empty.style.display = (_pickBg && _pickChar) ? 'none' : 'flex';
    }

    // 确认：canvas 合成背景+角色 → base64 → localStorage
    function confirmPresetChar() {
      if (!_pickBg || !_pickChar) {
        alert('请先选一个背景和一个角色～');
        return;
      }
      // 统一出口：无论合成成功与否，绝不卡在角色选择页
      const enterHome = (avatarSrc) => {
        if (avatarSrc) saveCharImage(avatarSrc);
        try { localStorage.setItem(LS_CHAR_SKIPPED, '0'); } catch(e) {}
        fillHome(getProfile());
        goPage('page-home');
        addExp(30, '创建角色');
      };
      const bgImg = new Image();
      const chImg = new Image();
      let loaded = 0, failed = false;
      const tryComposite = () => {
        loaded++;
        if (loaded < 2) return;
        if (failed) return; // onerror 已走兜底
        try {
          const W = 480, H = 480;
          const canvas = document.createElement('canvas');
          canvas.width = W; canvas.height = H;
          const ctx = canvas.getContext('2d');
          // 背景：object-fit: cover 效果
          const br = bgImg.naturalWidth / bgImg.naturalHeight;
          const cr = chImg.naturalWidth / chImg.naturalHeight;
          const bgRatio = W / H;
          let bw, bh, bx, by;
          if (br > bgRatio) {
            bh = H; bw = br * bh; bx = (W - bw) / 2; by = 0;
          } else {
            bw = W; bh = bw / br; bx = 0; by = (H - bh) / 2;
          }
          ctx.drawImage(bgImg, bx, by, bw, bh);
          // 角色：底部居中，高度占 60%
          const chH = H * 0.6;
          const chW = chH * cr;
          const chX = (W - chW) / 2;
          const chY = H - chH;
          ctx.drawImage(chImg, chX, chY, chW, chH);
          const b64 = canvas.toDataURL('image/png');
          enterHome(b64);
        } catch(e) {
          // 跨域画布污染等合成失败：直接用角色图路径作头像
          enterHome(chImg.src);
        }
      };
      bgImg.onload = tryComposite;
      chImg.onload = tryComposite;
      // 资源加载失败也放行：头像走 getCharImage 默认兜底链
      bgImg.onerror = chImg.onerror = () => {
        if (failed) return;
        failed = true;
        enterHome(null);
      };
      bgImg.src = `./assets/img/preset/bg/${_pickBg}.jpg`;
      chImg.src = `./assets/img/preset/char/${_pickChar}.png`;
    }

    // 修改描述 → 回到表单，预填数据
    function modifyCharDesc() {
      const profile = getProfile();
      const form = document.getElementById('onboardForm');
      form.querySelector('input[name=nickname]').value = profile.nickname || '';
      form.querySelector('input[name=school]').value = profile.school || '';
      form.querySelector('input[name=major]').value = profile.major || '';
      form.querySelector('select[name=grade]').value = profile.grade || '';
      form.querySelector('input[name=oneLineDesc]').value = profile.oneLineDesc || '';
      form.querySelector('textarea[name=interestsKw]').value = profile.interests || '';
      form.querySelector('textarea[name=careerKw]').value = profile.futureJobs || '';
      goPage('page-onboard');
    }

    // 将当前角色图片转为 base64（用于存档冻结）
    async function cacheCharImageB64() {
      try {
        const b64 = localStorage.getItem(LS_CHAR_IMAGE);
        if (b64) return b64;
      } catch(e) {}

      // 尝试从文件加载
      const imgSrc = getCharImage();
      if (imgSrc.startsWith('data:')) return imgSrc;

      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          try {
            const b64 = canvas.toDataURL('image/png');
            saveCharImage(b64);
            resolve(b64);
          } catch(e) { resolve(imgSrc); }
        };
        img.onerror = function() { resolve(imgSrc); };
        img.src = imgSrc;
      });
    }

    /* ============================================================
       20.5) 演示数据（跳过路径）
       ============================================================ */
    function loadDemoData() {
      // \u6e05\u7a7a\u65e7\u6570\u636e
      [LS_PROFILE, LS_EXPERIENCES, LS_SKILLS, LS_PLAYER, LS_TREES, LS_CHAR_IMAGE, LS_CHAR_PROMPT, LS_CHAR_SKIPPED, LS_TODOS].forEach(k => {
        try { localStorage.removeItem(k); } catch(e) {}
      });

      const t = new Date();
      const d = (offsetDays) => {
        const dd = new Date(t);
        dd.setDate(dd.getDate() - offsetDays);
        return dd.toISOString().split('T')[0];
      };
      const todayStr = d(0);

      // ---- \u8d44\u6599\uff08\u725b\u9a6c\u7248\uff09 ----
      const profile = {
        nickname: '\u5c0f\u725b',
        school: '\u67d0\u4e92\u8054\u7f51\u516c\u53f8',
        major: '\u4ea7\u54c1\u7ecf\u7406',
        grade: '3-5\u5e74',
        oneLineDesc: '\u4e00\u4e2a\u5728\u300c\u60f3\u6da8\u85aa\u300d\u548c\u300c\u60f3\u9003\u8dd1\u300d\u4e4b\u95f4\u53cd\u590d\u6a2a\u8df3\u7684\u4ea7\u54c1\u7ecf\u7406',
        interests: '\u559d\u5496\u5561,City Walk,\u770b\u5c55,\u6444\u5f71,\u505a\u996d',
        futureJobs: '\u4ea7\u54c1\u603b\u76d1,\u72ec\u7acb\u5f00\u53d1\u8005',
        gender: '', skills: '', experiences: '', futureSkills: ''
      };
      saveProfile(profile);

      // ---- \u7ecf\u5386\uff08\u542b\u4eca\u5929\uff0c\u8ba9\u65e5\u5386/\u4eca\u65e5\u6709\u5c55\u793a\uff09----
      const exps = [
        { date: todayStr, title: '\u7b2c\u4e00\u6b21\u72ec\u7acb\u8d1f\u8d23\u7684\u9700\u6c42\u987a\u5229\u4e0a\u7ebf',
          rawDesc: '\u8ddf\u4e86\u4e09\u4e2a\u6708\u7684\u8ba2\u5355\u6539\u7248\u9700\u6c42\u4eca\u5929\u5168\u91cf\u4e0a\u7ebf\uff0c\u7070\u5ea6\u6570\u636e\u4e00\u5207\u6b63\u5e38\uff0c\u8fd0\u7ef4\u7fa4\u91cc\u4e00\u7247\u7965\u548c\u3002\u4e0a\u7ebf\u524d\u4e00\u665a\u628a\u56de\u6eda\u65b9\u6848\u548c\u76d1\u63a7\u62a5\u8b66\u90fd\u786e\u8ba4\u4e86\u4e09\u904d\u3002',
          confirmedSkills: ['\u9879\u76ee\u7ba1\u7406', '\u9700\u6c42\u5206\u6790'] },
        { date: d(2), title: '\u7528 AI \u534a\u5c0f\u65f6\u5199\u5b8c\u4e86\u5468\u62a5',
          rawDesc: '\u628a\u672c\u5468\u7684\u7410\u4e8b\u4e22\u7ed9 AI \u6574\u7406\u6210\u5468\u62a5\u521d\u7a3f\uff0c\u81ea\u5df1\u53ea\u6539\u4e86\u6570\u636e\u548c\u7ed3\u8bba\uff0c\u534a\u5c0f\u65f6\u641e\u5b9a\uff0c\u7b2c\u4e00\u6b21\u611f\u89c9\u5de5\u5177\u7528\u5bf9\u4e86\u771f\u7701\u547d\u3002',
          confirmedSkills: ['AI\u63d0\u6548'] },
        { date: d(5), title: '\u8de8\u90e8\u95e8\u8bc4\u5ba1\u4f1a\u4e0a\u88ab\u8001\u677f\u5938\u4e86\u903b\u8f91',
          rawDesc: '\u8ba2\u5355\u94fe\u8def\u7684\u65b9\u6848\u8bc4\u5ba1\u4f1a\u4e0a\uff0c\u8001\u677f\u8bf4\u300c\u8fd9\u4e2a\u62c6\u6cd5\u633a\u6e05\u695a\u300d\uff0c\u6563\u4f1a\u540e\u540c\u4e8b\u5077\u5077\u95ee\u6211\u662f\u4e0d\u662f\u51c6\u5907\u4e86\u5f88\u4e45\u3002',
          confirmedSkills: ['\u516c\u5f00\u8868\u8fbe'] },
        { date: d(8), title: '\u7b2c\u4e00\u6b21\u5b8c\u6574\u8dd1\u901a\u6570\u636e\u770b\u677f',
          rawDesc: '\u7528 SQL \u628a\u4e0a\u5468\u7684\u590d\u8d2d\u6570\u636e\u62c9\u4e86\u51fa\u6765\uff0c\u914d\u5408 Excel \u505a\u4e86\u5f20\u770b\u677f\uff0c\u5468\u4f1a\u4e0a\u76f4\u63a5\u62ff\u51fa\u6765\u5c55\u793a\uff0c\u81ea\u4fe1\u4e86\u4e00\u70b9\u3002',
          confirmedSkills: ['\u6570\u636e\u5206\u6790'] },
        { date: d(14), title: '\u72ec\u7acb\u641e\u5b9a\u4e86\u4e00\u4e2a\u96be\u8010\u5ba2\u6237',
          rawDesc: '\u5ba2\u6237\u4e34\u65f6\u8981\u6539\u9700\u6c42\uff0c\u6253\u7535\u8bdd\u6c9f\u901a\u4e8640\u5206\u949f\uff0c\u6700\u540e\u53cc\u65b9\u5404\u8ba9\u4e00\u6b65\uff0c\u4fdd\u4f4f\u4e86\u6392\u671f\uff0c\u4e5f\u6ca1\u8ba9\u56e2\u961f\u52a0\u73ed\u3002',
          confirmedSkills: ['\u6c9f\u901a\u8c08\u5224'] },
        { date: d(21), title: '\u53bb\u770b\u4e86\u4e2a\u884c\u4e1a\u5c55',
          rawDesc: '\u53bb\u4e86\u6570\u5b57\u8425\u9500\u5c55\uff0c\u626b\u4e86\u5341\u51e0\u4e2a\u5c55\u4f4d\uff0c\u6536\u96c6\u4e86\u4e00\u5806\u540d\u7247\u548c\u7075\u611f\uff0c\u56de\u5bb6\u6574\u7406\u4e86\u4e09\u9875\u7b14\u8bb0\u3002',
          confirmedSkills: ['\u884c\u4e1a\u6d1e\u5bdf'] },
        { date: d(27), title: '\u5f00\u59cb\u7cfb\u7edf\u5b66 Excel \u9ad8\u9636\u51fd\u6570',
          rawDesc: '\u8ddf\u7740\u6559\u7a0b\u5b66\u4e86\u6570\u636e\u900f\u89c6\u8868\u548c\u51e0\u4e2a\u6570\u7ec4\u51fd\u6570\uff0c\u628a\u6708\u62a5\u7edf\u8ba1\u65f6\u95f4\u4ece2\u5c0f\u65f6\u538b\u523020\u5206\u949f\u3002',
          confirmedSkills: ['\u6570\u636e\u5206\u6790'] },
        { date: d(36), title: '\u5b8c\u6210\u300cExcel\u6570\u636e\u5206\u6790\u300d\u9a8c\u8bc1\u4efb\u52a1',
          rawDesc: '\u72ec\u7acb\u5b8c\u6210\u4e86\u4e00\u4efd\u5b63\u5ea6\u7ecf\u8425\u5206\u6790\u62a5\u544a\uff0c\u4ece\u53d6\u6570\u3001\u6e05\u6d17\u5230\u7ed3\u8bba\u5168\u90e8\u81ea\u5df1\u6765\uff0c\u4f1a\u4e0a\u8001\u677f\u8bf4\u4e0b\u6b21\u7ee7\u7eed\u3002',
          confirmedSkills: ['Excel\u6570\u636e\u5206\u6790'] },
      ].map((e, i) => ({
        id: 900000 + i,
        date: e.date,
        title: e.title,
        rawDesc: e.rawDesc,
        structured: {
          title: e.title,
          happened: e.rawDesc.split(/[\u3002\uff01\uff1f\uff1b\n]/).filter(s => s.trim()).slice(0, 2).join('\u3002'),
          whatIDid: e.rawDesc,
          result: '\u5b8c\u6210\u4e86',
          feeling: '\u5f88\u6709\u6210\u5c31\u611f'
        },
        suggestedSkills: [],
        confirmedSkills: e.confirmedSkills,
        skillConfirmed: true
      }));
      saveExperiences(exps);

      // ---- \u6280\u80fd\uff1a4\u4e2a\u5df2\u70b9\u4eae + 3\u4e2a\u5b66\u4e60\u4e2d ----
      const skills = [
        { name: '\u9700\u6c42\u5206\u6790', sourceExpIds: [900000], confirmedAt: todayStr, status: 'lit', treeIds: [] },
        { name: '\u9879\u76ee\u7ba1\u7406', sourceExpIds: [900000], confirmedAt: todayStr, status: 'lit', treeIds: [] },
        { name: '\u6c9f\u901a\u8c08\u5224', sourceExpIds: [900004], confirmedAt: d(14), status: 'lit', treeIds: [] },
        { name: '\u516c\u5f00\u8868\u8fbe', sourceExpIds: [900002], confirmedAt: d(5), status: 'lit', treeIds: [] },
      ];

      const mkPlan = (skill, defs) => defs.map((x, j) => ({
        unitId: 'u' + Math.min(2, j), day: j + 1, title: x[0], do: x[1], time: x[2], standard: x[3], done: x[4]
      }));

      // \u5b66\u4e60\u4e2d 1\uff1aExcel\u6570\u636e\u5206\u6790\uff086\u4efb\u52a1\uff0c4\u5df2\u5b8c\u6210\uff09
      const excelPlan = mkPlan('Excel\u6570\u636e\u5206\u6790', [
        ['Day 1\uff5cExcel \u00b7 \u6570\u636e\u6e05\u6d17', '\u628a\u4e00\u4efd\u4e71\u5e8f\u7684\u9500\u552e\u660e\u7ec6\u8868\u6309\u89c4\u8303\u6e05\u6d17\uff1a\u53bb\u91cd\u3001\u7edf\u4e00\u65e5\u671f\u683c\u5f0f\u3001\u8865\u5168\u7f3a\u5931\u503c', '45\u5206\u949f', '\u5f97\u5230\u4e00\u5f20\u5e72\u51c0\u7684\u6570\u636e\u660e\u7ec6\u8868', true],
        ['Day 2\uff5cExcel \u00b7 \u51fd\u6570\u8fdb\u9636', '\u5b66\u4f1a VLOOKUP/XLOOKUP\u3001SUMIFS\u3001IFERROR\uff0c\u5404\u7528\u4e00\u4e2a\u771f\u5b9e\u573a\u666f\u7ec3\u4e00\u904d', '40\u5206\u949f', '\u56db\u4e2a\u51fd\u6570\u90fd\u80fd\u72ec\u7acb\u5199\u5bf9', true],
        ['Day 3\uff5cExcel \u00b7 \u6570\u636e\u900f\u89c6\u8868', '\u7528\u900f\u89c6\u8868\u505a\u4e00\u5f20\u6309\u533a\u57df+\u6708\u4efd\u7684\u9500\u552e\u6c47\u603b\uff0c\u62d6\u62fd\u5b57\u6bb5\u4e0d\u770b\u6559\u7a0b', '40\u5206\u949f', '\u4e00\u5f20\u80fd\u770b\u7684\u900f\u89c6\u8868', true],
        ['Day 4\uff5cExcel \u00b7 \u53ef\u89c6\u5316\u56fe\u8868', '\u628a\u6c47\u603b\u6570\u636e\u505a\u62103\u5f20\u56fe\uff1a\u67f1\u72b6/\u6298\u7ebf/\u997c\u56fe\uff0c\u6bcf\u5f20\u6807\u9898\u90fd\u5199\u7ed3\u8bba', '40\u5206\u949f', '3\u5f20\u7ed3\u8bba\u660e\u786e\u7684\u56fe', true],
        ['Day 5\uff5cExcel \u00b7 \u5206\u6790\u5b9e\u6218', '\u72ec\u7acb\u5b8c\u6210\u4e00\u4efd\u6708\u5ea6\u7ecf\u8425\u5206\u6790\uff1a\u53d6\u6570\u2192\u6e05\u6d17\u2192\u56fe\u8868\u2192\u4e09\u6761\u7ed3\u8bba', '90\u5206\u949f', '\u4e00\u4efd\u6709\u7ed3\u8bba\u7684\u5206\u6790\u62a5\u544a', false],
        ['Day 6\uff5c\ud83c\udfc6 \u9a8c\u8bc1\u4efb\u52a1', '\u72ec\u7acb\u5b8c\u6210\u4e00\u4efd\u5b63\u5ea6\u7ecf\u8425\u5206\u6790\u62a5\u544a\u5e76\u4e0a\u53f0\u8bb2\u6e05\u695a', '120\u5206\u949f', '\u5b8c\u6210\u5e76\u8bb0\u5f55\u4e3a\u4e00\u6bb5\u771f\u5b9e\u7ecf\u5386', false],
      ]);
      skills.push({
        name: 'Excel\u6570\u636e\u5206\u6790', status: 'learning', sourceExpIds: [], confirmedAt: null,
        goalText: '\u4e00\u4e2a\u6708\u5185\u80fd\u72ec\u7acb\u5b8c\u6210\u7ecf\u8425\u5206\u6790\u62a5\u544a', goalDuration: '1\u4e2a\u6708', goalTreeId: null,
        assumptions: [], breakdown: [
          { id: 'u0', name: '\u6e05\u6d17\u4e0e\u51fd\u6570', phase: 1, status: 'done', sourceExpId: null },
          { id: 'u1', name: '\u900f\u89c6\u4e0e\u56fe\u8868', phase: 2, status: 'doing', sourceExpId: null },
          { id: 'u2', name: '\u5206\u6790\u5b9e\u6218', phase: 3, status: 'want', sourceExpId: null }
        ],
        plan: excelPlan,
        verifyTask: '\u72ec\u7acb\u5b8c\u6210\u4e00\u4efd\u5b63\u5ea6\u7ecf\u8425\u5206\u6790\u62a5\u544a\u5e76\u4e0a\u53f0\u8bb2\u6e05\u695a', treeIds: []
      });

      // \u5b66\u4e60\u4e2d 2\uff1a\u82f1\u8bed\u53e3\u8bed\uff088\u4efb\u52a1\uff0c2\u5df2\u5b8c\u6210\uff09
      const engPlan = mkPlan('\u82f1\u8bed\u53e3\u8bed', [
        ['Day 1\uff5c\u53e3\u8bed \u00b7 \u53d1\u97f3\u70ed\u8eab', '\u9009\u4e00\u6bb51\u5206\u949f\u82f1\u6587\u89c6\u9891\u505a shadowing\uff1a\u542c\u4e00\u53e5\u8ddf\u4e00\u53e5\uff0c\u5f55\u97f3\u5bf9\u6bd4\u539f\u97f3', '30\u5206\u949f', '\u5f55\u97f3\u8bed\u8c03\u63a5\u8fd1\u539f\u97f3', true],
        ['Day 2\uff5c\u53e3\u8bed \u00b7 \u6bcf\u65e5\u81ea\u8a00\u81ea\u8bed', '\u7528\u82f1\u8bed\u63cf\u8ff0\u4eca\u5929\u7684\u5de5\u4f5c\u5e76\u5f55\u97f33\u5206\u949f\uff0c\u56de\u542c\u8bb0\u4e0b\u5361\u58f3\u5904\u518d\u5f55\u4e00\u904d', '20\u5206\u949f', '\u4e00\u6bb53\u5206\u949f\u5f55\u97f3 + \u5361\u58f3\u6e05\u5355', true],
        ['Day 3\uff5c\u53e3\u8bed \u00b7 \u4f1a\u8bae\u9ad8\u9891\u53e5', '\u6574\u740610\u53e5\u82f1\u6587\u4f1a\u8bae\u5e38\u7528\u53e5\uff08\u8d5e\u540c/\u53cd\u5bf9/\u786e\u8ba4/\u6253\u65ad\uff09\u5e76\u8ddf\u8bfb\u5230\u8131\u53e3\u800c\u51fa', '25\u5206\u949f', '10\u53e5\u80fd\u4e0d\u5047\u601d\u7d22\u8bf4\u51fa', false],
        ['Day 4\uff5c\u53e3\u8bed \u00b7 \u6a21\u62df\u4e3b\u6301', '\u7528\u82f1\u6587\u4e3b\u6301\u4e00\u6b215\u5206\u949f\u7ad9\u4f1a\u5e76\u5f55\u97f3\uff0c\u56de\u542c\u7edf\u8ba1\u53e3\u5934\u7985\u6b21\u6570', '30\u5206\u949f', '\u4e00\u6bb55\u5206\u949f\u4e3b\u6301\u5f55\u97f3', false],
        ['Day 5\uff5c\u53e3\u8bed \u00b7 \u63d0\u95ee\u4e0e\u56de\u5e94', '\u7ec3\u4e09\u7c7b\u56de\u5e94\uff1a\u300c\u6ca1\u542c\u6e05\u8bf7\u91cd\u590d\u300d\u300c\u6211\u540c\u610f\u56e0\u4e3a\u300d\u300c\u6211\u503e\u5411\u53e6\u4e00\u4e2a\u65b9\u6848\u300d', '25\u5206\u949f', '\u4e09\u7c7b\u56de\u5e94\u5404\u7ec33\u904d', false],
        ['Day 6\uff5c\u53e3\u8bed \u00b7 \u8ddf\u8bfb\u7ea0\u97f3', '\u8ddf\u8bfb\u4e00\u6bb5\u5546\u52a1\u5bf9\u8bdd\uff0c\u6807\u51fa\u8fde\u8bfb\u548c\u5f31\u8bfb\u7684\u5730\u65b9', '30\u5206\u949f', '\u6807\u6ce8\u5b8c\u6574\u7684\u8ddf\u8bfb\u7b14\u8bb0', false],
        ['Day 7\uff5c\u53e3\u8bed \u00b7 \u8bdd\u9898\u72ec\u767d', '\u62bd\u4e00\u4e2a\u5de5\u4f5c\u8bdd\u9898\u8bf4\u6ee12\u5206\u949f\uff1a\u89c2\u70b9+\u4e24\u4e2a\u7406\u7531+\u4e00\u4e2a\u4f8b\u5b50', '25\u5206\u949f', '\u4e00\u6bb5\u7ed3\u6784\u5b8c\u6574\u7684\u72ec\u767d', false],
        ['Day 8\uff5c\ud83c\udfc6 \u9a8c\u8bc1\u4efb\u52a1', '\u4e3b\u6301\u4e00\u6b21\u771f\u5b9e\u7684\u82f1\u6587\u4f1a\u8bae\u6216\u505a\u4e00\u6b21\u82f1\u6587\u6c47\u62a5', '60\u5206\u949f', '\u5b8c\u6210\u5e76\u8bb0\u5f55\u4e3a\u4e00\u6bb5\u771f\u5b9e\u7ecf\u5386', false],
      ]);
      skills.push({
        name: '\u82f1\u8bed\u53e3\u8bed', status: 'learning', sourceExpIds: [], confirmedAt: null,
        goalText: '\u4e09\u4e2a\u6708\u5185\u80fd\u4e3b\u6301\u4e00\u6b21\u82f1\u6587\u4f1a\u8bae', goalDuration: '3\u4e2a\u6708', goalTreeId: null,
        assumptions: [], breakdown: [
          { id: 'u0', name: '\u53d1\u97f3\u4e0e\u70ed\u8eab', phase: 1, status: 'done', sourceExpId: null },
          { id: 'u1', name: '\u4f1a\u8bae\u8868\u8fbe', phase: 2, status: 'doing', sourceExpId: null },
          { id: 'u2', name: '\u771f\u5b9e\u4e3b\u6301', phase: 3, status: 'want', sourceExpId: null }
        ],
        plan: engPlan,
        verifyTask: '\u4e3b\u6301\u4e00\u6b21\u771f\u5b9e\u7684\u82f1\u6587\u4f1a\u8bae\u6216\u505a\u4e00\u6b21\u82f1\u6587\u6c47\u62a5', treeIds: []
      });

      // \u5b66\u4e60\u4e2d 3\uff1aAI\u63d0\u6548\uff085\u4efb\u52a1\uff0c3\u5df2\u5b8c\u6210\uff09
      const aiPlan = mkPlan('AI\u63d0\u6548', [
        ['Day 1\uff5cAI \u00b7 \u63d0\u793a\u8bcd\u5165\u95e8', '\u5b66\u4f1a\u300c\u89d2\u8272+\u4efb\u52a1+\u7ea6\u675f+\u683c\u5f0f\u300d\u56db\u4ef6\u5957\uff0c\u5404\u5199\u4e00\u4e2a\u63d0\u793a\u8bcd\u5e76\u5b9e\u6d4b', '30\u5206\u949f', '4\u4e2a\u80fd\u7528\u7684\u63d0\u793a\u8bcd', true],
        ['Day 2\uff5cAI \u00b7 \u5468\u62a5\u81ea\u52a8\u5316', '\u628a\u4e00\u5468\u7410\u4e8b\u4e22\u7ed9 AI \u751f\u6210\u5468\u62a5\u521d\u7a3f\u5e76\u4eba\u5de5\u8ba2\u6b63\u6570\u636e\u548c\u7ed3\u8bba', '30\u5206\u949f', '\u4e00\u4efd\u6539\u5b8c\u5c31\u80fd\u53d1\u7684\u5468\u62a5', true],
        ['Day 3\uff5cAI \u00b7 \u4f1a\u8bae\u7eaa\u8981', '\u7528 AI \u628a\u4f1a\u8bae\u5f55\u97f3\u6574\u7406\u6210\u7eaa\u8981\uff1a\u7ed3\u8bba+\u5f85\u529e+\u8d1f\u8d23\u4eba\u4e09\u8981\u7d20', '40\u5206\u949f', '\u4e00\u4efd\u4e09\u8981\u7d20\u9f50\u5168\u7684\u7eaa\u8981', true],
        ['Day 4\uff5cAI \u00b7 \u6587\u6863\u603b\u7ed3', '\u628a\u4e00\u4efd\u957f\u6587\u6863\u4e22\u7ed9 AI \u51fa\u6458\u8981\uff0c\u4eba\u5de5\u6821\u5bf9\u5173\u952e\u6570\u636e\u96f6\u9519\u8bef', '30\u5206\u949f', '\u6458\u8981\u6570\u636e\u96f6\u9519\u8bef', false],
        ['Day 5\uff5c\ud83c\udfc6 \u9a8c\u8bc1\u4efb\u52a1', '\u7528 AI \u5b8c\u6574\u63d0\u6548\u4e00\u4ef6\u771f\u5b9e\u5de5\u4f5c\uff0c\u8bb0\u5f55\u524d\u540e\u8017\u65f6\u5bf9\u6bd4', '45\u5206\u949f', '\u5b8c\u6210\u5e76\u8bb0\u5f55\u4e3a\u4e00\u6bb5\u771f\u5b9e\u7ecf\u5386', false],
      ]);
      skills.push({
        name: 'AI\u63d0\u6548', status: 'learning', sourceExpIds: [], confirmedAt: null,
        goalText: '\u4e24\u5468\u5185\u628a AI \u7528\u8fdb\u65e5\u5e38\u5de5\u4f5c\u6d41', goalDuration: '2\u5468', goalTreeId: null,
        assumptions: [], breakdown: [
          { id: 'u0', name: '\u63d0\u793a\u8bcd\u5165\u95e8', phase: 1, status: 'done', sourceExpId: null },
          { id: 'u1', name: '\u5de5\u4f5c\u573a\u666f\u5b9e\u6218', phase: 2, status: 'doing', sourceExpId: null },
          { id: 'u2', name: '\u81ea\u52a8\u5316', phase: 3, status: 'want', sourceExpId: null }
        ],
        plan: aiPlan,
        verifyTask: '\u7528 AI \u5b8c\u6574\u63d0\u6548\u4e00\u4ef6\u771f\u5b9e\u5de5\u4f5c\uff0c\u8bb0\u5f55\u524d\u540e\u8017\u65f6\u5bf9\u6bd4', treeIds: []
      });
      saveSkills(skills);

      // ---- \u7b49\u7ea7\uff1a\u4e0e\u4e91\u7aef\u4e00\u81f4\uff085147 EXP\uff09 ----
      savePlayerData({ exp: 5147 });

      // ---- \u4eca\u65e5\u81ea\u5efa todo + 1\u6761\u6628\u65e5\u672a\u5b8c\u6210\uff08\u987a\u5ef6\u6f14\u793a\uff09 ----
      saveTodayTodos([
        { id: 'demo1', title: '\u6574\u7406 VLOOKUP \u901f\u67e5\u8868', date: todayStr, done: false, createdAt: new Date().toISOString() },
        { id: 'demo2', title: '\u7ea6\u5ba2\u6237\u786e\u8ba4\u4e0b\u5468\u6392\u671f', date: todayStr, done: true, doneAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: 'demo3', title: '\u590d\u76d8\u4e0a\u7ebf\u5f53\u5929\u7684\u76d1\u63a7\u6570\u636e', date: todayStr, done: false, createdAt: new Date().toISOString() },
        { id: 'demo4', title: '\u628a\u8bc4\u5ba1\u4f1a\u7684\u7ed3\u8bba\u540c\u6b65\u7ed9\u56e2\u961f', date: d(1), done: false, createdAt: new Date().toISOString() }
      ]);

      // \u5e95\u5e95\uff1a\u5373\u4f7f\u56fe\u7247\u5408\u6210\u5931\u8d25\uff0c\u5237\u65b0\u540e\u4e5f\u76f4\u63a5\u8fdb\u9996\u9875\uff08\u8d70\u9884\u8bbePNG\u5e95\u5e95\uff09
      try { localStorage.setItem(LS_CHAR_SKIPPED, '1'); } catch(e) {}

      // ---- \u793a\u4f8b\u89d2\u8272\u5f62\u8c61\uff1a\u76f4\u63a5\u4f7f\u7528\u9884\u8bbe\u7684 demo-char.jpg ----
      const demoImg = new Image();
      const goDemoHome = () => {
        fillHome(getProfile());
        goPage('page-home');
      };
      demoImg.onload = () => {
        try {
          // \u76f4\u63a5\u8f6c base64 \u5b58\u8fdb localStorage\uff0c\u590d\u7528\u540c\u4e00\u5f20\u56fe
          const W = Math.min(demoImg.naturalWidth, 720);
          const H = Math.round(W * demoImg.naturalHeight / demoImg.naturalWidth);
          const canvas = document.createElement('canvas');
          canvas.width = W; canvas.height = H;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(demoImg, 0, 0, W, H);
          try {
            saveCharImage(canvas.toDataURL('image/png'));
          } catch(e) {
            // canvas tainted \u65f6\u9000\u5316\u4e3a\u76f4\u63a5\u4f7f\u7528\u6587\u4ef6\u8def\u5f84
            saveCharImage('./assets/img/ui/demo-char.jpg');
          }
        } catch(e) {
          try { saveCharImage('./assets/img/ui/demo-char.jpg'); } catch(_) {}
        }
        goDemoHome();
      };
      demoImg.onerror = goDemoHome;
      demoImg.src = './assets/img/ui/demo-char.jpg';
    }


    /* ============================================================
       21) 启动表单
       ============================================================ */
    document.getElementById('onboardForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const fd = new FormData(this);
      const profile = {
        nickname:   (fd.get('nickname')   || '').trim(),
        school:     (fd.get('school')     || '').trim(),
        major:      (fd.get('major')      || '').trim(),
        grade:      (fd.get('grade')      || '').trim(),
        oneLineDesc:(fd.get('oneLineDesc')|| '').trim(),
        interests:  (fd.get('interestsKw')|| '').trim(),
        futureJobs: (fd.get('careerKw')   || '').trim(),
        // 保留旧字段兼容（不再从表单填充）
        gender: '', skills: '', experiences: '', futureSkills: ''
      };
      if (!profile.nickname) { alert('给自己起个昵称再开始吧～'); return; }
      saveProfile(profile);

      // 清除旧的角色图片和提示词，确保重新生成
      try {
        localStorage.removeItem(LS_CHAR_IMAGE);
        localStorage.removeItem(LS_CHAR_PROMPT);
        localStorage.removeItem(LS_CHAR_SKIPPED);
      } catch(e) {}

      // 进入角色生成页
      showCharGenPage();
    });

    document.getElementById('resetBtn').onclick = resetProfile;

    /* ============================================================
       21) 初始化
       ============================================================ */
    (async function init() {
      // 资料库环境：先拉云端数据（表格改动 -> 页面生效）
      await dbPullAll();
      // 兼容旧数据：给旧技能添加 status 和 treeIds
      const skills = getSkills();
      let updated = false;
      skills.forEach(s => {
        if (!s.status) { s.status = 'lit'; updated = true; }
        if (!s.treeIds) { s.treeIds = []; updated = true; }
      });
      if (updated) saveSkills(skills);

      const saved = getProfile();
      if (saved.nickname) {
        let skipped = false;
        try { skipped = localStorage.getItem(LS_CHAR_SKIPPED) === '1'; } catch(e) {}
        if (hasCharImage() || skipped) {
          // 已有角色图片 / 已选择预设形象 → 直接进入首页
          fillHome(saved);
          goPage('page-home');
        } else {
          // 有资料但没有角色图片 → 进入角色生成页
          fillHome(saved);
          goPage('page-chargen');
          // 自动显示等待状态
          showCharGenPage();
        }
      } else {
        // 没有资料 → 先看启动页
        goPage('page-splash');
      }
    })();

    function enterApp() {
      // 从启动页进入：到建立档案页
      goPage('page-onboard');
    }

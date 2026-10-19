#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重构 app.js DBSync 层：SDK 调用改为 db.xxx( 直调 + databaseId 硬编码字面量（符合 database-sdk-contract.md）。"""
import re

PATH = 'C:/Users/Administrator/WorkBuddy/2026-10-17-20-06-18/eo-work/src/assets/js/app.js'
src = open(PATH, encoding='utf-8').read()
orig_len = len(src)

# ---------- 1) dbQueryAll -> _dbPullPages + 4 表 query 适配器 ----------
old_query = """    async function dbQueryAll(dbId) {
      const sdk = dbSdk();
      let out = [], cursor = null;
      do {
        const params = { databaseId: dbId };
        if (cursor) params.startCursor = cursor;
        const r = await sdk.query(params);
        out = out.concat((r && r.results) || []);
        cursor = (r && r.hasMore) ? r.nextCursor : null;
      } while (cursor);
      return out;
    }"""
new_query = """    // 分页拉全量（query 单次只回一页，必须 hasMore+nextCursor 续翻拉完再渲染）
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
    };"""
assert old_query in src, 'block1 not found'
src = src.replace(old_query, new_query, 1)

# ---------- 2) 删除 dbUpsert/dbUpdate（已并入各表适配器） ----------
old_rw = """    function dbUpsert(dbId, raw) {
      const sdk = dbSdk();
      if (!sdk || !dbOnline()) return Promise.resolve(null);
      return sdk.addRecord({ databaseId: dbId, properties: dbProps(raw) }).then(r => r || true).catch(() => null);
    }
    function dbUpdate(dbId, recordId, raw) {
      const sdk = dbSdk();
      if (!sdk || !dbOnline()) return Promise.resolve(null);
      return sdk.updateRecord({ databaseId: dbId, recordId: recordId, properties: dbProps(raw) }).then(r => (r && r.id) || true).catch(() => null);
    }

    // 按自然键 diff 同步集合表"""
new_rw = """    // 按自然键 diff 同步集合表"""
assert old_rw in src, 'block2 not found'
src = src.replace(old_rw, new_rw, 1)

# ---------- 3) dbSyncCollection 改表键派发 ----------
old_sync = """    async function dbSyncCollection(dbId, zhKeys, localList, mapFn, cacheArr) {
      const sdk = dbSdk();
      if (!sdk || !dbOnline()) return;"""
new_sync = """    async function dbSyncCollection(tableKey, zhKeys, localList, mapFn, cacheArr) {
      const ops = DB_OPS[tableKey];
      if (!ops || !dbOnline()) return;"""
assert old_sync in src, 'block3 not found'
src = src.replace(old_sync, new_sync, 1)

old_inner = """          if (rid) {
            await dbUpdate(dbId, rid, payload);
          } else {
            const added = await dbUpsert(dbId, payload);
            // 更新缓存
            if (added) {
              try {
                const fresh = await dbQueryAll(dbId);"""
new_inner = """          if (rid) {
            await ops.upd(rid, payload);
          } else {
            const added = await ops.add(payload);
            // 更新缓存
            if (added) {
              try {
                const fresh = await ops.query();"""
assert old_inner in src, 'block3-inner not found'
src = src.replace(old_inner, new_inner, 1)

# ---------- 4) dbPullAll 调用点 ----------
old_pull = """        const [pr, er, sr, tr] = await Promise.all([
          dbQueryAll(DB_IDS.profile),
          dbQueryAll(DB_IDS.experiences),
          dbQueryAll(DB_IDS.skills),
          dbQueryAll(DB_IDS.tasks)
        ]);"""
new_pull = """        const [pr, er, sr, tr] = await Promise.all([
          dbQueryProfile(),
          dbQueryExperiences(),
          dbQuerySkills(),
          dbQueryTasks()
        ]);"""
assert old_pull in src, 'block4 not found'
src = src.replace(old_pull, new_pull, 1)

# ---------- 5) _doSync profile 分支 ----------
old_dosync = """        if (_dbCache.profile && _dbCache.profile._id) {
          await dbUpdate(DB_IDS.profile, _dbCache.profile._id, payload);
        } else {
          await dbUpsert(DB_IDS.profile, payload);
          try {
            const fresh = await dbQueryAll(DB_IDS.profile);"""
new_dosync = """        if (_dbCache.profile && _dbCache.profile._id) {
          await dbUpdProfile(_dbCache.profile._id, payload);
        } else {
          await dbAddProfile(payload);
          try {
            const fresh = await dbQueryProfile();"""
assert old_dosync in src, 'block5 not found'
src = src.replace(old_dosync, new_dosync, 1)

# ---------- 6) dbSyncCollection 四个调用点改表键 ----------
pairs = [
    ("          DB_IDS.experiences, ['标题'],", "          'experiences', ['标题'],"),
    ("          DB_IDS.skills, ['技能名'],", "          'skills', ['技能名'],"),
]
for old, new in pairs:
    assert old in src, 'block6 not found: ' + old
    src = src.replace(old, new, 1)
# tasks 出现两次
old_tasks = "          DB_IDS.tasks, ['所属技能', '标题'],"
assert src.count(old_tasks) == 2, 'tasks call sites != 2'
src = src.replace(old_tasks, "          'tasks', ['所属技能', '标题'],")

open(PATH, 'w', encoding='utf-8').write(src)
print('OK', orig_len, '->', len(src))

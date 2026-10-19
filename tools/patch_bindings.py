#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按 canonical-schema.md §1.5.5 给渲染 database 数据的元素加 data-sp-bindable 绑定标注。"""
import io

HTML = 'C:/Users/Administrator/WorkBuddy/2026-10-17-20-06-18/eo-work/src/index.html'
JS = 'C:/Users/Administrator/WorkBuddy/2026-10-17-20-06-18/eo-work/src/assets/js/app.js'

html = io.open(HTML, encoding='utf-8').read()
js = io.open(JS, encoding='utf-8').read()

P = 'J8nQuGrnH1EAcbGmVuHgJH'   # profile
E = 'MIOOw92QLJoAtlc5rLRD4y'   # experiences
S = '00jK1bNT44QrvE93VcF8Ep'   # skills
T = 'frvt1ZzgNK1U0XfglXZ2qA'   # tasks

# ---------- index.html：静态最内层元素 ----------
html_pairs = [
    ('<span class="char-name" id="charNick">匿名冒险者</span>',
     f'<span class="char-name" id="charNick" data-sp-bindable="database" data-sp-database-id="{P}">匿名冒险者</span>'),
    ('<span id="charSchool">—</span>',
     f'<span id="charSchool" data-sp-bindable="database" data-sp-database-id="{P}">—</span>'),
    ('<span id="charMajor">—</span>',
     f'<span id="charMajor" data-sp-bindable="database" data-sp-database-id="{P}">—</span>'),
    ('<span id="charGrade">—</span>',
     f'<span id="charGrade" data-sp-bindable="database" data-sp-database-id="{P}">—</span>'),
    ('<div class="char-quote" id="charBubble">"正在长成自己的样子。"</div>',
     f'<div class="char-quote" id="charBubble" data-sp-bindable="database" data-sp-database-id="{P}">"正在长成自己的样子。"</div>'),
    ('<span class="level-tag" id="lvlDisplay">Lv.1</span>',
     f'<span class="level-tag" id="lvlDisplay" data-sp-bindable="database" data-sp-database-id="{P}">Lv.1</span>'),
    ('<span class="level-num" id="expNum">0 / 100</span>',
     f'<span class="level-num" id="expNum" data-sp-bindable="database" data-sp-database-id="{P}">0 / 100</span>'),
]
for old, new in html_pairs:
    assert old in html, 'html not found: ' + old[:50]
    html = html.replace(old, new, 1)

# ---------- app.js：SP 常量 ----------
anchor = "    const DB_SELECT_KEYS = ['工龄', '状态', '类型'];"
assert anchor in js
sp_consts = anchor + """
    // 数据库绑定标注（§1.5.5）：文本直接来自/派生自 database 的生成元素需成对携带
    const SP_PROFILE = ' data-sp-bindable="database" data-sp-database-id="' + DB_IDS.profile + '"';
    const SP_EXP     = ' data-sp-bindable="database" data-sp-database-id="' + DB_IDS.experiences + '"';
    const SP_SKILL   = ' data-sp-bindable="database" data-sp-database-id="' + DB_IDS.skills + '"';
    const SP_TASK    = ' data-sp-bindable="database" data-sp-database-id="' + DB_IDS.tasks + '"';"""
js = js.replace(anchor, sp_consts, 1)

# ---------- app.js：各渲染模板 ----------
js_pairs = [
    # renderTodayTasks
    ('<li class="custom carried" data-cid="${escapeHtml(it.id)}">',
     '<li class="custom carried"${SP_TASK} data-cid="${escapeHtml(it.id)}">'),
    ('<li class="custom" data-cid="${escapeHtml(it.id)}">',
     '<li class="custom"${SP_TASK} data-cid="${escapeHtml(it.id)}">'),
    ('<li class="plan" data-skill="${escapeHtml(s.name)}">',
     '<li class="plan"${SP_SKILL} data-skill="${escapeHtml(s.name)}">'),
    ('<li class="custom done" data-cid="${escapeHtml(it.id)}">',
     '<li class="custom done"${SP_TASK} data-cid="${escapeHtml(it.id)}">'),
    ("""        html += `<li class="done">
          <span style="font-size:12px;">✓</span>""",
     """        html += `<li class="done"${SP_EXP}>
          <span style="font-size:12px;">✓</span>"""),
    # renderCalendar：有事件的日期格（派生自 tasks/experiences）
    ('html += `<div class="${cls}" data-date="${dateStr}">${d}</div>`;',
     'html += `<div class="${cls}"${ev && (ev.exp || ev.task) ? SP_TASK : \'\'} data-date="${dateStr}">${d}</div>`;'),
    # renderRecentExp
    ("""      list.innerHTML = exps.map(e => `
        <li>""",
     """      list.innerHTML = exps.map(e => `
        <li${SP_EXP}>"""),
    # renderActiveLearning
    ("""      list.innerHTML = top.map(s => {""",
     """      list.innerHTML = top.map(s => {"""),
    # renderSkillLevels
    ("""      list.innerHTML = cats.slice(0, 6).map(c => {""",
     """      list.innerHTML = cats.slice(0, 6).map(c => {"""),
    # renderExpLog
    ("""          <div class="exp-entry pixel-card">""",
     """          <div class="exp-entry pixel-card"${SP_EXP}>"""),
    # renderSkillTree：已拥有 / 学习中节点
    ('<div class="st-skill-node lit" onclick="showSkillDetail(\'${escapeHtml(s.name)}\')">',
     '<div class="st-skill-node lit"${SP_SKILL} onclick="showSkillDetail(\'${escapeHtml(s.name)}\')">'),
    ('<div class="st-skill-node ${statusClass}" onclick="showSkillDetail(\'${escapeHtml(s.name)}\')">',
     '<div class="st-skill-node ${statusClass}"${SP_SKILL} onclick="showSkillDetail(\'${escapeHtml(s.name)}\')">'),
]
for old, new in js_pairs:
    assert old in js, 'js not found: ' + old[:60]
    js = js.replace(old, new, 1)

io.open(HTML, 'w', encoding='utf-8').write(html)
io.open(JS, 'w', encoding='utf-8').write(js)
print('markers patched: html=%d, js=%d' % (len(html_pairs), len(js_pairs)))

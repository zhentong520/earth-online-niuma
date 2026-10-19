# -*- coding: utf-8 -*-
"""app.js 大学版 -> 牛马版：机械替换（DB_IDS / 字段名 / 年级->工龄 / 文案）"""
import re, io

SRC = 'src/assets/js/app.js'
with io.open(SRC, encoding='utf-8') as f:
    js = f.read()
orig_len = len(js)

# 1) DB_IDS -> 牛马版 4 张新表
js = js.replace(
    """    const DB_IDS = {
      profile: 'w3WqpOHa9vew86VmAsqUmH',
      experiences: 'jVVy1BOXO8wnn7gxD6KXjJ',
      skills: 'hOhf6dXuhODCGuMlkdUA10',
      tasks: 'nl6Vz5tJ2FKhabWqnnx74w'
    };""",
    """    const DB_IDS = {
      profile: 'J8nQuGrnH1EAcbGmVuHgJH',
      experiences: 'MIOOw92QLJoAtlc5rLRD4y',
      skills: '00jK1bNT44QrvE93VcF8Ep',
      tasks: 'frvt1ZzgNK1U0XfglXZ2qA'
    };""")

# 2) select 字段：年级 -> 工龄
js = js.replace("const DB_SELECT_KEYS = ['年级', '状态', '类型'];",
                "const DB_SELECT_KEYS = ['工龄', '状态', '类型'];")

# 3) dbPullAll 档案字段映射
js = js.replace("""          p.school = dbText(r, '学校');
          p.major = dbText(r, '专业');
          p.grade = dbText(r, '年级');""",
                """          p.school = dbText(r, '公司');
          p.major = dbText(r, '职位');
          p.grade = dbText(r, '工龄');""")

# 4) _doSync profile payload
js = js.replace("""          '昵称': p.nickname || '', '学校': p.school || '', '专业': p.major || '',
          '年级': p.grade || '', '一句话描述': p.oneLineDesc || '',""",
                """          '昵称': p.nickname || '', '公司': p.school || '', '职位': p.major || '',
          '工龄': p.grade || '', '一句话描述': p.oneLineDesc || '',""")

# 5) 年级选项 -> 工龄选项
js = js.replace("const GRADE_OPTIONS = ['大一', '大二', '大三', '大四', '研一', '研二', '研三'];",
                "const GRADE_OPTIONS = ['1年内', '1-3年', '3-5年', '5-10年', '10年以上'];")
js = js.replace("showExpToast(5, '更新年级');", "showExpToast(5, '更新工龄');")

# 6) 存档 hero 文案
js = js.replace("<span class=\"arcx-logo-tag\">我的大学人物存档</span>",
                "<span class=\"arcx-logo-tag\">我的牛马人物存档</span>")
js = js.replace("'地球Online存档_' + today()", "'地球Online牛马版存档_' + today()")

# 7) 档案渲染字段名（archiveHtml PLAYER 卡）
js = js.replace('<span class="apinfo-k">当前学校</span>', '<span class="apinfo-k">当前公司</span>')
js = js.replace('<span class="apinfo-k">专 业</span>', '<span class="apinfo-k">职 位</span>')
js = js.replace('<span class="apinfo-k">年 级</span>', '<span class="apinfo-k">工 龄</span>')

with io.open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(js)
print('app.js mechanical done, %d -> %d chars' % (orig_len, len(js)))

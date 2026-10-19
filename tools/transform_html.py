# -*- coding: utf-8 -*-
"""index.html 大学版 -> 牛马版 机械替换"""
import re, io

SRC = 'src/index.html'
with io.open(SRC, encoding='utf-8') as f:
    html = f.read()
orig_len = len(html)

# 1) 剥离编辑器残留：data-page-node-id / data-pnid-children 属性
html = re.sub(r'\s+data-page-node-id="[^"]*"', '', html)
html = re.sub(r'\s+data-pnid-children="[^"]*"', '', html)
# 2) 剥离 pnid 注释
html = re.sub(r'<!--pnid:[^>]*-->', '', html)

# 3) 移除 html2canvas CDN（存档长图改纯 Canvas 绘制）
html = re.sub(r'\s*<script src="https://cdn\.jsdelivr\.net/npm/html2canvas[^"]*"></script>', '', html)

# 4) 标题 / 品牌
html = html.replace('<title>地球Online｜我的大学人物面板</title>', '<title>地球Online｜牛马人物面板</title>')
html = html.replace('alt="地球Online 大学版"', 'alt="地球Online 牛马版"')

# 5) 表单字段：学校->公司 / 专业->职位 / 年级->工龄
html = html.replace('<label>学校</label>', '<label>公司</label>')
html = html.replace('name="school" placeholder="比如：广州某大学"', 'name="school" placeholder="比如：某互联网公司 / 外企 / 国企"')
html = html.replace('<label>专业</label>', '<label>职位</label>')
html = html.replace('name="major" placeholder="比如：建筑学 / 计算机"', 'name="major" placeholder="比如：产品经理 / 前端开发 / 运营"')
html = html.replace('<label>年级</label>', '<label>工龄</label>')

old_grade_opts = re.search(r'<select name="grade">.*?</select>', html, re.S)
if old_grade_opts:
    new_opts = (
        '<select name="grade">'
        '<option value>请选择</option>'
        '<option>1年内</option><option>1-3年</option><option>3-5年</option>'
        '<option>5-10年</option><option>10年以上</option>'
        '</select>'
    )
    html = html.replace(old_grade_opts.group(0), new_opts)

# 6) 首页人物卡图标：学校->🏢 专业->💼
html = html.replace('<span class="m-ico">🏫</span>', '<span class="m-ico">🏢</span>')
html = html.replace('<span class="m-ico">📚</span><span id="charMajor">', '<span class="m-ico">💼</span><span id="charMajor">')

# 7) 存档相关文案
html = html.replace('我的大学人物存档', '我的牛马人物存档')
html = html.replace('placeholder="给这版存档起个名字：大一上学期存档 / 2026秋季存档 / 大学四年最终存档"',
                    'placeholder="给这版存档起个名字：试用期存档 / 2026秋季存档 / 牛马三年存档"')

# 8) 年级切换弹窗 -> 工龄
html = html.replace('我现在的年级是', '我的工龄是')
html = html.replace('title="点击切换年级"', 'title="点击切换工龄"')

# 9) 表单文案微调（保留游戏感）
html = html.replace('这些经历不会定义你，但会成为角色成长的初始养料。',
                    '这些经历不会定义你，但会成为打工人升级的初始养料。')
html = html.replace('placeholder="比如：小虾"', 'placeholder="比如：小牛"')

with io.open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(html)

print('index.html done, %d -> %d chars' % (orig_len, len(html)))
print('remaining data-page-node-id:', html.count('data-page-node-id'))
print('remaining pnid comment:', html.count('<!--pnid:'))
print('html2canvas refs:', html.count('html2canvas'))

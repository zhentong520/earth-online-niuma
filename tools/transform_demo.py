# -*- coding: utf-8 -*-
"""loadDemoData 牛马化：与云端 4 张表演示数据一致"""
import re, io

SRC = 'src/assets/js/app.js'
with io.open(SRC, encoding='utf-8') as f:
    js = f.read()

NEW_DEMO = '''    function loadDemoData() {
      // \\u6e05\\u7a7a\\u65e7\\u6570\\u636e
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

      // ---- \\u8d44\\u6599\\uff08\\u725b\\u9a6c\\u7248\\uff09 ----
      const profile = {
        nickname: '\\u5c0f\\u725b',
        school: '\\u67d0\\u4e92\\u8054\\u7f51\\u516c\\u53f8',
        major: '\\u4ea7\\u54c1\\u7ecf\\u7406',
        grade: '3-5\\u5e74',
        oneLineDesc: '\\u4e00\\u4e2a\\u5728\\u300c\\u60f3\\u6da8\\u85aa\\u300d\\u548c\\u300c\\u60f3\\u9003\\u8dd1\\u300d\\u4e4b\\u95f4\\u53cd\\u590d\\u6a2a\\u8df3\\u7684\\u4ea7\\u54c1\\u7ecf\\u7406',
        interests: '\\u559d\\u5496\\u5561,City Walk,\\u770b\\u5c55,\\u6444\\u5f71,\\u505a\\u996d',
        futureJobs: '\\u4ea7\\u54c1\\u603b\\u76d1,\\u72ec\\u7acb\\u5f00\\u53d1\\u8005',
        gender: '', skills: '', experiences: '', futureSkills: ''
      };
      saveProfile(profile);

      // ---- \\u7ecf\\u5386\\uff08\\u542b\\u4eca\\u5929\\uff0c\\u8ba9\\u65e5\\u5386/\\u4eca\\u65e5\\u6709\\u5c55\\u793a\\uff09----
      const exps = [
        { date: todayStr, title: '\\u7b2c\\u4e00\\u6b21\\u72ec\\u7acb\\u8d1f\\u8d23\\u7684\\u9700\\u6c42\\u987a\\u5229\\u4e0a\\u7ebf',
          rawDesc: '\\u8ddf\\u4e86\\u4e09\\u4e2a\\u6708\\u7684\\u8ba2\\u5355\\u6539\\u7248\\u9700\\u6c42\\u4eca\\u5929\\u5168\\u91cf\\u4e0a\\u7ebf\\uff0c\\u7070\\u5ea6\\u6570\\u636e\\u4e00\\u5207\\u6b63\\u5e38\\uff0c\\u8fd0\\u7ef4\\u7fa4\\u91cc\\u4e00\\u7247\\u7965\\u548c\\u3002\\u4e0a\\u7ebf\\u524d\\u4e00\\u665a\\u628a\\u56de\\u6eda\\u65b9\\u6848\\u548c\\u76d1\\u63a7\\u62a5\\u8b66\\u90fd\\u786e\\u8ba4\\u4e86\\u4e09\\u904d\\u3002',
          confirmedSkills: ['\\u9879\\u76ee\\u7ba1\\u7406', '\\u9700\\u6c42\\u5206\\u6790'] },
        { date: d(2), title: '\\u7528 AI \\u534a\\u5c0f\\u65f6\\u5199\\u5b8c\\u4e86\\u5468\\u62a5',
          rawDesc: '\\u628a\\u672c\\u5468\\u7684\\u7410\\u4e8b\\u4e22\\u7ed9 AI \\u6574\\u7406\\u6210\\u5468\\u62a5\\u521d\\u7a3f\\uff0c\\u81ea\\u5df1\\u53ea\\u6539\\u4e86\\u6570\\u636e\\u548c\\u7ed3\\u8bba\\uff0c\\u534a\\u5c0f\\u65f6\\u641e\\u5b9a\\uff0c\\u7b2c\\u4e00\\u6b21\\u611f\\u89c9\\u5de5\\u5177\\u7528\\u5bf9\\u4e86\\u771f\\u7701\\u547d\\u3002',
          confirmedSkills: ['AI\\u63d0\\u6548'] },
        { date: d(5), title: '\\u8de8\\u90e8\\u95e8\\u8bc4\\u5ba1\\u4f1a\\u4e0a\\u88ab\\u8001\\u677f\\u5938\\u4e86\\u903b\\u8f91',
          rawDesc: '\\u8ba2\\u5355\\u94fe\\u8def\\u7684\\u65b9\\u6848\\u8bc4\\u5ba1\\u4f1a\\u4e0a\\uff0c\\u8001\\u677f\\u8bf4\\u300c\\u8fd9\\u4e2a\\u62c6\\u6cd5\\u633a\\u6e05\\u695a\\u300d\\uff0c\\u6563\\u4f1a\\u540e\\u540c\\u4e8b\\u5077\\u5077\\u95ee\\u6211\\u662f\\u4e0d\\u662f\\u51c6\\u5907\\u4e86\\u5f88\\u4e45\\u3002',
          confirmedSkills: ['\\u516c\\u5f00\\u8868\\u8fbe'] },
        { date: d(8), title: '\\u7b2c\\u4e00\\u6b21\\u5b8c\\u6574\\u8dd1\\u901a\\u6570\\u636e\\u770b\\u677f',
          rawDesc: '\\u7528 SQL \\u628a\\u4e0a\\u5468\\u7684\\u590d\\u8d2d\\u6570\\u636e\\u62c9\\u4e86\\u51fa\\u6765\\uff0c\\u914d\\u5408 Excel \\u505a\\u4e86\\u5f20\\u770b\\u677f\\uff0c\\u5468\\u4f1a\\u4e0a\\u76f4\\u63a5\\u62ff\\u51fa\\u6765\\u5c55\\u793a\\uff0c\\u81ea\\u4fe1\\u4e86\\u4e00\\u70b9\\u3002',
          confirmedSkills: ['\\u6570\\u636e\\u5206\\u6790'] },
        { date: d(14), title: '\\u72ec\\u7acb\\u641e\\u5b9a\\u4e86\\u4e00\\u4e2a\\u96be\\u8010\\u5ba2\\u6237',
          rawDesc: '\\u5ba2\\u6237\\u4e34\\u65f6\\u8981\\u6539\\u9700\\u6c42\\uff0c\\u6253\\u7535\\u8bdd\\u6c9f\\u901a\\u4e8640\\u5206\\u949f\\uff0c\\u6700\\u540e\\u53cc\\u65b9\\u5404\\u8ba9\\u4e00\\u6b65\\uff0c\\u4fdd\\u4f4f\\u4e86\\u6392\\u671f\\uff0c\\u4e5f\\u6ca1\\u8ba9\\u56e2\\u961f\\u52a0\\u73ed\\u3002',
          confirmedSkills: ['\\u6c9f\\u901a\\u8c08\\u5224'] },
        { date: d(21), title: '\\u53bb\\u770b\\u4e86\\u4e2a\\u884c\\u4e1a\\u5c55',
          rawDesc: '\\u53bb\\u4e86\\u6570\\u5b57\\u8425\\u9500\\u5c55\\uff0c\\u626b\\u4e86\\u5341\\u51e0\\u4e2a\\u5c55\\u4f4d\\uff0c\\u6536\\u96c6\\u4e86\\u4e00\\u5806\\u540d\\u7247\\u548c\\u7075\\u611f\\uff0c\\u56de\\u5bb6\\u6574\\u7406\\u4e86\\u4e09\\u9875\\u7b14\\u8bb0\\u3002',
          confirmedSkills: ['\\u884c\\u4e1a\\u6d1e\\u5bdf'] },
        { date: d(27), title: '\\u5f00\\u59cb\\u7cfb\\u7edf\\u5b66 Excel \\u9ad8\\u9636\\u51fd\\u6570',
          rawDesc: '\\u8ddf\\u7740\\u6559\\u7a0b\\u5b66\\u4e86\\u6570\\u636e\\u900f\\u89c6\\u8868\\u548c\\u51e0\\u4e2a\\u6570\\u7ec4\\u51fd\\u6570\\uff0c\\u628a\\u6708\\u62a5\\u7edf\\u8ba1\\u65f6\\u95f4\\u4ece2\\u5c0f\\u65f6\\u538b\\u523020\\u5206\\u949f\\u3002',
          confirmedSkills: ['\\u6570\\u636e\\u5206\\u6790'] },
        { date: d(36), title: '\\u5b8c\\u6210\\u300cExcel\\u6570\\u636e\\u5206\\u6790\\u300d\\u9a8c\\u8bc1\\u4efb\\u52a1',
          rawDesc: '\\u72ec\\u7acb\\u5b8c\\u6210\\u4e86\\u4e00\\u4efd\\u5b63\\u5ea6\\u7ecf\\u8425\\u5206\\u6790\\u62a5\\u544a\\uff0c\\u4ece\\u53d6\\u6570\\u3001\\u6e05\\u6d17\\u5230\\u7ed3\\u8bba\\u5168\\u90e8\\u81ea\\u5df1\\u6765\\uff0c\\u4f1a\\u4e0a\\u8001\\u677f\\u8bf4\\u4e0b\\u6b21\\u7ee7\\u7eed\\u3002',
          confirmedSkills: ['Excel\\u6570\\u636e\\u5206\\u6790'] },
      ].map((e, i) => ({
        id: 900000 + i,
        date: e.date,
        title: e.title,
        rawDesc: e.rawDesc,
        structured: {
          title: e.title,
          happened: e.rawDesc.split(/[\\u3002\\uff01\\uff1f\\uff1b\\n]/).filter(s => s.trim()).slice(0, 2).join('\\u3002'),
          whatIDid: e.rawDesc,
          result: '\\u5b8c\\u6210\\u4e86',
          feeling: '\\u5f88\\u6709\\u6210\\u5c31\\u611f'
        },
        suggestedSkills: [],
        confirmedSkills: e.confirmedSkills,
        skillConfirmed: true
      }));
      saveExperiences(exps);

      // ---- \\u6280\\u80fd\\uff1a4\\u4e2a\\u5df2\\u70b9\\u4eae + 3\\u4e2a\\u5b66\\u4e60\\u4e2d ----
      const skills = [
        { name: '\\u9700\\u6c42\\u5206\\u6790', sourceExpIds: [900000], confirmedAt: todayStr, status: 'lit', treeIds: [] },
        { name: '\\u9879\\u76ee\\u7ba1\\u7406', sourceExpIds: [900000], confirmedAt: todayStr, status: 'lit', treeIds: [] },
        { name: '\\u6c9f\\u901a\\u8c08\\u5224', sourceExpIds: [900004], confirmedAt: d(14), status: 'lit', treeIds: [] },
        { name: '\\u516c\\u5f00\\u8868\\u8fbe', sourceExpIds: [900002], confirmedAt: d(5), status: 'lit', treeIds: [] },
      ];

      const mkPlan = (skill, defs) => defs.map((x, j) => ({
        unitId: 'u' + Math.min(2, j), day: j + 1, title: x[0], do: x[1], time: x[2], standard: x[3], done: x[4]
      }));

      // \\u5b66\\u4e60\\u4e2d 1\\uff1aExcel\\u6570\\u636e\\u5206\\u6790\\uff086\\u4efb\\u52a1\\uff0c4\\u5df2\\u5b8c\\u6210\\uff09
      const excelPlan = mkPlan('Excel\\u6570\\u636e\\u5206\\u6790', [
        ['Day 1\\uffcExcel \\u00b7 \\u6570\\u636e\\u6e05\\u6d17', '\\u628a\\u4e00\\u4efd\\u4e71\\u5e8f\\u7684\\u9500\\u552e\\u660e\\u7ec6\\u8868\\u6309\\u89c4\\u8303\\u6e05\\u6d17\\uff1a\\u53bb\\u91cd\\u3001\\u7edf\\u4e00\\u65e5\\u671f\\u683c\\u5f0f\\u3001\\u8865\\u5168\\u7f3a\\u5931\\u503c', '45\\u5206\\u949f', '\\u5f97\\u5230\\u4e00\\u5f20\\u5e72\\u51c0\\u7684\\u6570\\u636e\\u660e\\u7ec6\\u8868', true],
        ['Day 2\\uffcExcel \\u00b7 \\u51fd\\u6570\\u8fdb\\u9636', '\\u5b66\\u4f1a VLOOKUP/XLOOKUP\\u3001SUMIFS\\u3001IFERROR\\uff0c\\u5404\\u7528\\u4e00\\u4e2a\\u771f\\u5b9e\\u573a\\u666f\\u7ec3\\u4e00\\u904d', '40\\u5206\\u949f', '\\u56db\\u4e2a\\u51fd\\u6570\\u90fd\\u80fd\\u72ec\\u7acb\\u5199\\u5bf9', true],
        ['Day 3\\uffcExcel \\u00b7 \\u6570\\u636e\\u900f\\u89c6\\u8868', '\\u7528\\u900f\\u89c6\\u8868\\u505a\\u4e00\\u5f20\\u6309\\u533a\\u57df+\\u6708\\u4efd\\u7684\\u9500\\u552e\\u6c47\\u603b\\uff0c\\u62d6\\u62fd\\u5b57\\u6bb5\\u4e0d\\u770b\\u6559\\u7a0b', '40\\u5206\\u949f', '\\u4e00\\u5f20\\u80fd\\u770b\\u7684\\u900f\\u89c6\\u8868', true],
        ['Day 4\\uffcExcel \\u00b7 \\u53ef\\u89c6\\u5316\\u56fe\\u8868', '\\u628a\\u6c47\\u603b\\u6570\\u636e\\u505a\\u62103\\u5f20\\u56fe\\uff1a\\u67f1\\u72b6/\\u6298\\u7ebf/\\u997c\\u56fe\\uff0c\\u6bcf\\u5f20\\u6807\\u9898\\u90fd\\u5199\\u7ed3\\u8bba', '40\\u5206\\u949f', '3\\u5f20\\u7ed3\\u8bba\\u660e\\u786e\\u7684\\u56fe', true],
        ['Day 5\\uffcExcel \\u00b7 \\u5206\\u6790\\u5b9e\\u6218', '\\u72ec\\u7acb\\u5b8c\\u6210\\u4e00\\u4efd\\u6708\\u5ea6\\u7ecf\\u8425\\u5206\\u6790\\uff1a\\u53d6\\u6570\\u2192\\u6e05\\u6d17\\u2192\\u56fe\\u8868\\u2192\\u4e09\\u6761\\u7ed3\\u8bba', '90\\u5206\\u949f', '\\u4e00\\u4efd\\u6709\\u7ed3\\u8bba\\u7684\\u5206\\u6790\\u62a5\\u544a', false],
        ['Day 6\\uffc\\ud83c\\udfc6 \\u9a8c\\u8bc1\\u4efb\\u52a1', '\\u72ec\\u7acb\\u5b8c\\u6210\\u4e00\\u4efd\\u5b63\\u5ea6\\u7ecf\\u8425\\u5206\\u6790\\u62a5\\u544a\\u5e76\\u4e0a\\u53f0\\u8bb2\\u6e05\\u695a', '120\\u5206\\u949f', '\\u5b8c\\u6210\\u5e76\\u8bb0\\u5f55\\u4e3a\\u4e00\\u6bb5\\u771f\\u5b9e\\u7ecf\\u5386', false],
      ]);
      skills.push({
        name: 'Excel\\u6570\\u636e\\u5206\\u6790', status: 'learning', sourceExpIds: [], confirmedAt: null,
        goalText: '\\u4e00\\u4e2a\\u6708\\u5185\\u80fd\\u72ec\\u7acb\\u5b8c\\u6210\\u7ecf\\u8425\\u5206\\u6790\\u62a5\\u544a', goalDuration: '1\\u4e2a\\u6708', goalTreeId: null,
        assumptions: [], breakdown: [
          { id: 'u0', name: '\\u6e05\\u6d17\\u4e0e\\u51fd\\u6570', phase: 1, status: 'done', sourceExpId: null },
          { id: 'u1', name: '\\u900f\\u89c6\\u4e0e\\u56fe\\u8868', phase: 2, status: 'doing', sourceExpId: null },
          { id: 'u2', name: '\\u5206\\u6790\\u5b9e\\u6218', phase: 3, status: 'want', sourceExpId: null }
        ],
        plan: excelPlan,
        verifyTask: '\\u72ec\\u7acb\\u5b8c\\u6210\\u4e00\\u4efd\\u5b63\\u5ea6\\u7ecf\\u8425\\u5206\\u6790\\u62a5\\u544a\\u5e76\\u4e0a\\u53f0\\u8bb2\\u6e05\\u695a', treeIds: []
      });

      // \\u5b66\\u4e60\\u4e2d 2\\uff1a\\u82f1\\u8bed\\u53e3\\u8bed\\uff088\\u4efb\\u52a1\\uff0c2\\u5df2\\u5b8c\\u6210\\uff09
      const engPlan = mkPlan('\\u82f1\\u8bed\\u53e3\\u8bed', [
        ['Day 1\\uffc\\u53e3\\u8bed \\u00b7 \\u53d1\\u97f3\\u70ed\\u8eab', '\\u9009\\u4e00\\u6bb51\\u5206\\u949f\\u82f1\\u6587\\u89c6\\u9891\\u505a shadowing\\uff1a\\u542c\\u4e00\\u53e5\\u8ddf\\u4e00\\u53e5\\uff0c\\u5f55\\u97f3\\u5bf9\\u6bd4\\u539f\\u97f3', '30\\u5206\\u949f', '\\u5f55\\u97f3\\u8bed\\u8c03\\u63a5\\u8fd1\\u539f\\u97f3', true],
        ['Day 2\\uffc\\u53e3\\u8bed \\u00b7 \\u6bcf\\u65e5\\u81ea\\u8a00\\u81ea\\u8bed', '\\u7528\\u82f1\\u8bed\\u63cf\\u8ff0\\u4eca\\u5929\\u7684\\u5de5\\u4f5c\\u5e76\\u5f55\\u97f33\\u5206\\u949f\\uff0c\\u56de\\u542c\\u8bb0\\u4e0b\\u5361\\u58f3\\u5904\\u518d\\u5f55\\u4e00\\u904d', '20\\u5206\\u949f', '\\u4e00\\u6bb53\\u5206\\u949f\\u5f55\\u97f3 + \\u5361\\u58f3\\u6e05\\u5355', true],
        ['Day 3\\uffc\\u53e3\\u8bed \\u00b7 \\u4f1a\\u8bae\\u9ad8\\u9891\\u53e5', '\\u6574\\u740610\\u53e5\\u82f1\\u6587\\u4f1a\\u8bae\\u5e38\\u7528\\u53e5\\uff08\\u8d5e\\u540c/\\u53cd\\u5bf9/\\u786e\\u8ba4/\\u6253\\u65ad\\uff09\\u5e76\\u8ddf\\u8bfb\\u5230\\u8131\\u53e3\\u800c\\u51fa', '25\\u5206\\u949f', '10\\u53e5\\u80fd\\u4e0d\\u5047\\u601d\\u7d22\\u8bf4\\u51fa', false],
        ['Day 4\\uffc\\u53e3\\u8bed \\u00b7 \\u6a21\\u62df\\u4e3b\\u6301', '\\u7528\\u82f1\\u6587\\u4e3b\\u6301\\u4e00\\u6b215\\u5206\\u949f\\u7ad9\\u4f1a\\u5e76\\u5f55\\u97f3\\uff0c\\u56de\\u542c\\u7edf\\u8ba1\\u53e3\\u5934\\u7985\\u6b21\\u6570', '30\\u5206\\u949f', '\\u4e00\\u6bb55\\u5206\\u949f\\u4e3b\\u6301\\u5f55\\u97f3', false],
        ['Day 5\\uffc\\u53e3\\u8bed \\u00b7 \\u63d0\\u95ee\\u4e0e\\u56de\\u5e94', '\\u7ec3\\u4e09\\u7c7b\\u56de\\u5e94\\uff1a\\u300c\\u6ca1\\u542c\\u6e05\\u8bf7\\u91cd\\u590d\\u300d\\u300c\\u6211\\u540c\\u610f\\u56e0\\u4e3a\\u300d\\u300c\\u6211\\u503e\\u5411\\u53e6\\u4e00\\u4e2a\\u65b9\\u6848\\u300d', '25\\u5206\\u949f', '\\u4e09\\u7c7b\\u56de\\u5e94\\u5404\\u7ec33\\u904d', false],
        ['Day 6\\uffc\\u53e3\\u8bed \\u00b7 \\u8ddf\\u8bfb\\u7ea0\\u97f3', '\\u8ddf\\u8bfb\\u4e00\\u6bb5\\u5546\\u52a1\\u5bf9\\u8bdd\\uff0c\\u6807\\u51fa\\u8fde\\u8bfb\\u548c\\u5f31\\u8bfb\\u7684\\u5730\\u65b9', '30\\u5206\\u949f', '\\u6807\\u6ce8\\u5b8c\\u6574\\u7684\\u8ddf\\u8bfb\\u7b14\\u8bb0', false],
        ['Day 7\\uffc\\u53e3\\u8bed \\u00b7 \\u8bdd\\u9898\\u72ec\\u767d', '\\u62bd\\u4e00\\u4e2a\\u5de5\\u4f5c\\u8bdd\\u9898\\u8bf4\\u6ee12\\u5206\\u949f\\uff1a\\u89c2\\u70b9+\\u4e24\\u4e2a\\u7406\\u7531+\\u4e00\\u4e2a\\u4f8b\\u5b50', '25\\u5206\\u949f', '\\u4e00\\u6bb5\\u7ed3\\u6784\\u5b8c\\u6574\\u7684\\u72ec\\u767d', false],
        ['Day 8\\uffc\\ud83c\\udfc6 \\u9a8c\\u8bc1\\u4efb\\u52a1', '\\u4e3b\\u6301\\u4e00\\u6b21\\u771f\\u5b9e\\u7684\\u82f1\\u6587\\u4f1a\\u8bae\\u6216\\u505a\\u4e00\\u6b21\\u82f1\\u6587\\u6c47\\u62a5', '60\\u5206\\u949f', '\\u5b8c\\u6210\\u5e76\\u8bb0\\u5f55\\u4e3a\\u4e00\\u6bb5\\u771f\\u5b9e\\u7ecf\\u5386', false],
      ]);
      skills.push({
        name: '\\u82f1\\u8bed\\u53e3\\u8bed', status: 'learning', sourceExpIds: [], confirmedAt: null,
        goalText: '\\u4e09\\u4e2a\\u6708\\u5185\\u80fd\\u4e3b\\u6301\\u4e00\\u6b21\\u82f1\\u6587\\u4f1a\\u8bae', goalDuration: '3\\u4e2a\\u6708', goalTreeId: null,
        assumptions: [], breakdown: [
          { id: 'u0', name: '\\u53d1\\u97f3\\u4e0e\\u70ed\\u8eab', phase: 1, status: 'done', sourceExpId: null },
          { id: 'u1', name: '\\u4f1a\\u8bae\\u8868\\u8fbe', phase: 2, status: 'doing', sourceExpId: null },
          { id: 'u2', name: '\\u771f\\u5b9e\\u4e3b\\u6301', phase: 3, status: 'want', sourceExpId: null }
        ],
        plan: engPlan,
        verifyTask: '\\u4e3b\\u6301\\u4e00\\u6b21\\u771f\\u5b9e\\u7684\\u82f1\\u6587\\u4f1a\\u8bae\\u6216\\u505a\\u4e00\\u6b21\\u82f1\\u6587\\u6c47\\u62a5', treeIds: []
      });

      // \\u5b66\\u4e60\\u4e2d 3\\uff1aAI\\u63d0\\u6548\\uff085\\u4efb\\u52a1\\uff0c3\\u5df2\\u5b8c\\u6210\\uff09
      const aiPlan = mkPlan('AI\\u63d0\\u6548', [
        ['Day 1\\uffcAI \\u00b7 \\u63d0\\u793a\\u8bcd\\u5165\\u95e8', '\\u5b66\\u4f1a\\u300c\\u89d2\\u8272+\\u4efb\\u52a1+\\u7ea6\\u675f+\\u683c\\u5f0f\\u300d\\u56db\\u4ef6\\u5957\\uff0c\\u5404\\u5199\\u4e00\\u4e2a\\u63d0\\u793a\\u8bcd\\u5e76\\u5b9e\\u6d4b', '30\\u5206\\u949f', '4\\u4e2a\\u80fd\\u7528\\u7684\\u63d0\\u793a\\u8bcd', true],
        ['Day 2\\uffcAI \\u00b7 \\u5468\\u62a5\\u81ea\\u52a8\\u5316', '\\u628a\\u4e00\\u5468\\u7410\\u4e8b\\u4e22\\u7ed9 AI \\u751f\\u6210\\u5468\\u62a5\\u521d\\u7a3f\\u5e76\\u4eba\\u5de5\\u8ba2\\u6b63\\u6570\\u636e\\u548c\\u7ed3\\u8bba', '30\\u5206\\u949f', '\\u4e00\\u4efd\\u6539\\u5b8c\\u5c31\\u80fd\\u53d1\\u7684\\u5468\\u62a5', true],
        ['Day 3\\uffcAI \\u00b7 \\u4f1a\\u8bae\\u7eaa\\u8981', '\\u7528 AI \\u628a\\u4f1a\\u8bae\\u5f55\\u97f3\\u6574\\u7406\\u6210\\u7eaa\\u8981\\uff1a\\u7ed3\\u8bba+\\u5f85\\u529e+\\u8d1f\\u8d23\\u4eba\\u4e09\\u8981\\u7d20', '40\\u5206\\u949f', '\\u4e00\\u4efd\\u4e09\\u8981\\u7d20\\u9f50\\u5168\\u7684\\u7eaa\\u8981', true],
        ['Day 4\\uffcAI \\u00b7 \\u6587\\u6863\\u603b\\u7ed3', '\\u628a\\u4e00\\u4efd\\u957f\\u6587\\u6863\\u4e22\\u7ed9 AI \\u51fa\\u6458\\u8981\\uff0c\\u4eba\\u5de5\\u6821\\u5bf9\\u5173\\u952e\\u6570\\u636e\\u96f6\\u9519\\u8bef', '30\\u5206\\u949f', '\\u6458\\u8981\\u6570\\u636e\\u96f6\\u9519\\u8bef', false],
        ['Day 5\\uffc\\ud83c\\udfc6 \\u9a8c\\u8bc1\\u4efb\\u52a1', '\\u7528 AI \\u5b8c\\u6574\\u63d0\\u6548\\u4e00\\u4ef6\\u771f\\u5b9e\\u5de5\\u4f5c\\uff0c\\u8bb0\\u5f55\\u524d\\u540e\\u8017\\u65f6\\u5bf9\\u6bd4', '45\\u5206\\u949f', '\\u5b8c\\u6210\\u5e76\\u8bb0\\u5f55\\u4e3a\\u4e00\\u6bb5\\u771f\\u5b9e\\u7ecf\\u5386', false],
      ]);
      skills.push({
        name: 'AI\\u63d0\\u6548', status: 'learning', sourceExpIds: [], confirmedAt: null,
        goalText: '\\u4e24\\u5468\\u5185\\u628a AI \\u7528\\u8fdb\\u65e5\\u5e38\\u5de5\\u4f5c\\u6d41', goalDuration: '2\\u5468', goalTreeId: null,
        assumptions: [], breakdown: [
          { id: 'u0', name: '\\u63d0\\u793a\\u8bcd\\u5165\\u95e8', phase: 1, status: 'done', sourceExpId: null },
          { id: 'u1', name: '\\u5de5\\u4f5c\\u573a\\u666f\\u5b9e\\u6218', phase: 2, status: 'doing', sourceExpId: null },
          { id: 'u2', name: '\\u81ea\\u52a8\\u5316', phase: 3, status: 'want', sourceExpId: null }
        ],
        plan: aiPlan,
        verifyTask: '\\u7528 AI \\u5b8c\\u6574\\u63d0\\u6548\\u4e00\\u4ef6\\u771f\\u5b9e\\u5de5\\u4f5c\\uff0c\\u8bb0\\u5f55\\u524d\\u540e\\u8017\\u65f6\\u5bf9\\u6bd4', treeIds: []
      });
      saveSkills(skills);

      // ---- \\u7b49\\u7ea7\\uff1a\\u4e0e\\u4e91\\u7aef\\u4e00\\u81f4\\uff085147 EXP\\uff09 ----
      savePlayerData({ exp: 5147 });

      // ---- \\u4eca\\u65e5\\u81ea\\u5efa todo + 1\\u6761\\u6628\\u65e5\\u672a\\u5b8c\\u6210\\uff08\\u987a\\u5ef6\\u6f14\\u793a\\uff09 ----
      saveTodayTodos([
        { id: 'demo1', title: '\\u6574\\u7406 VLOOKUP \\u901f\\u67e5\\u8868', date: todayStr, done: false, createdAt: new Date().toISOString() },
        { id: 'demo2', title: '\\u7ea6\\u5ba2\\u6237\\u786e\\u8ba4\\u4e0b\\u5468\\u6392\\u671f', date: todayStr, done: true, doneAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: 'demo3', title: '\\u590d\\u76d8\\u4e0a\\u7ebf\\u5f53\\u5929\\u7684\\u76d1\\u63a7\\u6570\\u636e', date: todayStr, done: false, createdAt: new Date().toISOString() },
        { id: 'demo4', title: '\\u628a\\u8bc4\\u5ba1\\u4f1a\\u7684\\u7ed3\\u8bba\\u540c\\u6b65\\u7ed9\\u56e2\\u961f', date: d(1), done: false, createdAt: new Date().toISOString() }
      ]);

      // \\u5e95\\u5e95\\uff1a\\u5373\\u4f7f\\u56fe\\u7247\\u5408\\u6210\\u5931\\u8d25\\uff0c\\u5237\\u65b0\\u540e\\u4e5f\\u76f4\\u63a5\\u8fdb\\u9996\\u9875\\uff08\\u8d70\\u9884\\u8bbePNG\\u5e95\\u5e95\\uff09
      try { localStorage.setItem(LS_CHAR_SKIPPED, '1'); } catch(e) {}

      // ---- \\u793a\\u4f8b\\u89d2\\u8272\\u5f62\\u8c61\\uff1a\\u76f4\\u63a5\\u4f7f\\u7528\\u9884\\u8bbe\\u7684 demo-char.jpg ----
      const demoImg = new Image();
      const goDemoHome = () => {
        fillHome(getProfile());
        goPage('page-home');
      };
      demoImg.onload = () => {
        try {
          // \\u76f4\\u63a5\\u8f6c base64 \\u5b58\\u8fdb localStorage\\uff0c\\u590d\\u7528\\u540c\\u4e00\\u5f20\\u56fe
          const W = Math.min(demoImg.naturalWidth, 720);
          const H = Math.round(W * demoImg.naturalHeight / demoImg.naturalWidth);
          const canvas = document.createElement('canvas');
          canvas.width = W; canvas.height = H;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(demoImg, 0, 0, W, H);
          try {
            saveCharImage(canvas.toDataURL('image/png'));
          } catch(e) {
            // canvas tainted \\u65f6\\u9000\\u5316\\u4e3a\\u76f4\\u63a5\\u4f7f\\u7528\\u6587\\u4ef6\\u8def\\u5f84
            saveCharImage('./assets/img/ui/demo-char.jpg');
          }
        } catch(e) {
          try { saveCharImage('./assets/img/ui/demo-char.jpg'); } catch(_) {}
        }
        goDemoHome();
      };
      demoImg.onerror = goDemoHome;
      demoImg.src = './assets/img/ui/demo-char.jpg';
    }'''

pat = re.compile(r"    function loadDemoData\(\) \{.*?\n    \}\n(?=\n    /\* =+\n       21\) \u542f\u52a8\u8868\u5355)", re.S)
m = pat.search(js)
if not m:
    print('ERROR: loadDemoData not matched')
    raise SystemExit(1)

js = js[:m.start()] + NEW_DEMO + '\n\n' + js[m.end():]
with io.open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(js)
print('loadDemoData replaced OK')

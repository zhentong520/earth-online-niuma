# -*- coding: utf-8 -*-
"""替换 saveArchiveToAlbum：html2canvas -> 纯 Canvas 2D 绘制"""
import re, io

SRC = 'src/assets/js/app.js'
with io.open(SRC, encoding='utf-8') as f:
    js = f.read()

NEW_FUNC = '''    // 生成存档长图 -> 存到相册（Web Share API），不支持时下载 PNG
    async function saveArchiveToAlbum() {
      const btn = document.getElementById('saveToAlbumBtn');
      btn.disabled = true;
      btn.textContent = '\\u23f3 正在生成存档图\\u2026';
      try {
        const canvas = await drawArchiveCanvas();
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const fname = '\\u5730\\u7403Online\\u725b\\u9a6c\\u7248\\u5b58\\u6863_' + today() + '.png';
        const file = new File([blob], fname, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          // 手机：唤起系统分享面板，可选「存入照片/保存图片」
          try {
            await navigator.share({ files: [file], title: '\\u5730\\u7403Online \\u725b\\u9a6c\\u4eba\\u7269\\u5b58\\u6863' });
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
        alert('\\u751f\\u6210\\u5b58\\u6863\\u56fe\\u5931\\u8d25\\uff1a' + (e.message || e));
      } finally {
        btn.disabled = false;
        btn.textContent = '\\ud83d\\udcf7 \\u4fdd\\u5b58\\u5230\\u76f8\\u518c\\uff08\\u751f\\u6210\\u5b58\\u6863\\u56fe\\uff09';
      }
    }

    /* ============================================================
       \\u7eaf Canvas 2D \\u7ed8\\u5236\\u5b58\\u6863\\u957f\\u56fe\\uff08\\u50cf\\u7d20\\u6e38\\u620f\\u98ce\\uff0c\\u96f6\\u5916\\u90e8\\u4f9d\\u8d56\\uff09
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
    // \\u50cf\\u7d20\\u98ce\\u5361\\u7247\\uff1a\\u5976\\u6cb9\\u5e95 + \\u6df1\\u8272\\u63cf\\u8fb9 + \\u786c\\u9634\\u5f71
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
        if (ch === '\\n') { lines.push(line); line = ''; continue; }
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
      const nick = profile.nickname || '\\u533f\\u540d\\u5192\\u9669\\u8005';
      const uid = genId(nick + (profile.school || ''));
      const catLevels = computeCategoryLevels().slice(0, 5);
      const stageTitle = ['\\u65b0\\u624b\\u725b\\u9a6c', '\\u521d\\u7ea7\\u725b\\u9a6c', '\\u719f\\u7ec3\\u725b\\u9a6c', '\\u8d44\\u6df1\\u725b\\u9a6c', '\\u4f20\\u5947\\u725b\\u9a6c'][Math.min(4, Math.floor(curLv / 6))] || '\\u4f20\\u5947\\u725b\\u9a6c';
      const dateStr = today();

      // \\u89d2\\u8272\\u56fe\\u9884\\u52a0\\u8f7d\\uff08\\u5931\\u8d25\\u5219\\u65e0\\u5934\\u50cf\\u51fa\\u56fe\\uff0c\\u4e0d\\u5f71\\u54cd\\u6574\\u4f53\\uff09
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

      // ---- \\u80cc\\u666f\\uff1a\\u5976\\u6cb9\\u5e95 + \\u50cf\\u7d20\\u70b9\\u9635 ----
      ctx.fillStyle = ARC_C.bg;
      ctx.fillRect(0, 0, W, 4200);
      ctx.fillStyle = 'rgba(44,62,80,0.05)';
      for (let gy = 14; gy < 4200; gy += 26) {
        for (let gx = ((gy / 26) % 2) ? 26 : 0; gx < W; gx += 52) {
          ctx.fillRect(gx, gy, 3, 3);
        }
      }

      y = 22;
      // ---- 1. Hero \\u6a2a\\u5e55 ----
      const heroH = 118;
      const grad = ctx.createLinearGradient(M, 0, W - M, 0);
      grad.addColorStop(0, '#2c3e50'); grad.addColorStop(1, '#46617e');
      ctx.fillStyle = grad;
      _arcRoundRect(ctx, M, y, CW, heroH, 12); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = ARC_C.ink;
      _arcRoundRect(ctx, M, y, CW, heroH, 12); ctx.stroke();
      ctx.fillStyle = '#fffaf0';
      ctx.font = '800 30px ' + ARC_FONT;
      ctx.fillText('\\u5730\\u7403', M + 22, y + 18);
      const earthW = ctx.measureText('\\u5730\\u7403').width;
      ctx.fillStyle = ARC_C.accent;
      ctx.fillText('Online', M + 22 + earthW, y + 18);
      ctx.fillStyle = 'rgba(255,250,240,.75)';
      ctx.font = '700 14px ' + ARC_FONT;
      ctx.fillText('\\u725b\\u9a6c\\u7248 \\u00b7 \\u6211\\u7684\\u804c\\u573a\\u4eba\\u7269\\u5b58\\u6863', M + 24, y + 60);
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      _arcRoundRect(ctx, W - M - 150, y + 16, 128, 52, 8); ctx.fill();
      ctx.fillStyle = ARC_C.accent;
      ctx.font = '800 13px ' + ARC_FONT;
      ctx.fillText('SAVE', W - M - 138, y + 24);
      ctx.fillStyle = '#fffaf0';
      ctx.font = '700 13px ' + ARC_FONT;
      ctx.fillText(dateStr, W - M - 138, y + 42);
      const pills = ['\\ud83e\\ude90 \\u767b\\u5f55\\u5730\\u7403', '\\ud83e\\udded \\u63a2\\u7d22\\u4e16\\u754c', '\\u2694\\ufe0f \\u5347\\u7ea7\\u81ea\\u5df1'];
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

      // ---- 2. PLAYER \\u5361 ----
      const pH = 152;
      _arcCard(ctx, M, y, CW, pH);
      ctx.fillStyle = ARC_C.accent;
      ctx.font = '800 12px ' + ARC_FONT;
      ctx.fillText('PLAYER \\u00b7 \\u5f53\\u524d\\u5b58\\u6863', M + 16, y + 12);
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
        ctx.fillText('\\u6682\\u65e0\\u5934\\u50cf', avX + 22, avY + 40);
      }
      const infoX = avX + avS + 18;
      const rows = [
        ['\\u73a9\\u5bb6\\u540d\\u79f0', nick],
        ['\\u5f53\\u524d\\u516c\\u53f8', profile.school || '\\u2014'],
        ['\\u804c　　位', profile.major || '\\u2014'],
        ['\\u5de5　　龄', profile.grade || '\\u2014'],
        ['UID', uid]
      ];
      let ry = y + 32;
      rows.forEach(r => {
        ctx.fillStyle = ARC_C.soft;
        ctx.font = '700 12px ' + ARC_FONT;
        ctx.fillText(r[0], infoX, ry + 2);
        ctx.fillStyle = ARC_C.ink;
        ctx.font = '700 15px ' + ARC_FONT;
        let v = String(r[1] || '\\u2014');
        while (ctx.measureText(v).width > CW - (infoX - M) - 90 && v.length > 2) v = v.slice(0, -2) + '\\u2026';
        ctx.fillText(v, infoX + 76, ry);
        ry += 22;
      });
      const quote = profile.oneLineDesc ? '\\u201c' + profile.oneLineDesc + '\\u201d' : '\\u201c\\u6b63\\u5728\\u957f\\u6210\\u81ea\\u5df1\\u7684\\u6837\\u5b50\\u3002\\u201d';
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

      // ---- 3. \\u5173\\u5361\\uff08\\u7b49\\u7ea7\\uff09\\u5361 ----
      const lvH = 100;
      _arcCard(ctx, M, y, CW, lvH);
      ctx.fillStyle = ARC_C.accent;
      ctx.font = '800 14px ' + ARC_FONT;
      ctx.fillText('\\u2b50 \\u6211\\u7684\\u5173\\u5361', M + 16, y + 12);
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
      ctx.fillText('EXP ' + totalExp + (p.lv >= 30 ? ' \\u00b7 \\u5df2\\u6ee1\\u7ea7' : ' \\u00b7 \\u8ddd\\u79bb Lv.' + (p.lv + 1) + ' \\u8fd8\\u5dee ' + Math.max(0, (LEVEL_TABLE[p.lv + 1] || totalExp) - totalExp)), barX, trackY + 20);
      y += lvH + 14;

      // ---- 4. \\u4eba\\u7269\\u5173\\u952e\\u8bcd ----
      const kws = [...new Set([...parseList(profile.interests).slice(0, 3), ...confirmed.map(s => s.name).slice(0, 2)])].slice(0, 6);
      ctx.fillStyle = ARC_C.ink;
      ctx.font = '800 14px ' + ARC_FONT;
      ctx.fillText('\\ud83c\\udff7\\ufe0f \\u4eba\\u7269\\u5173\\u952e\\u8bcd', M + 4, y);
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
        ctx.fillText('\\u2014 \\u8fd8\\u6ca1\\u6709\\u5173\\u952e\\u8bcd\\uff0c\\u53bb\\u8bb0\\u51e0\\u6bb5\\u7ecf\\u5386\\u5427 \\u2014', M + 4, y);
        y += 26;
      }
      y += 6;

      // ---- 5. \\u5df2\\u70b9\\u4eae\\u6280\\u80fd ----
      ctx.fillStyle = ARC_C.ink;
      ctx.font = '800 14px ' + ARC_FONT;
      ctx.fillText('\\u2705 \\u5df2\\u70b9\\u4eae\\u7684\\u6280\\u80fd\\uff08' + confirmed.length + '\\uff09', M + 4, y);
      y += 26;
      if (confirmed.length) {
        confirmed.forEach(s => {
          ctx.font = '700 14px ' + ARC_FONT;
          const rowW = Math.min(ctx.measureText('\\u2713 ' + s.name).width + 26, CW);
          ctx.fillStyle = ARC_C.greenSoft;
          _arcRoundRect(ctx, M + 2, y, rowW, 26, 6); ctx.fill();
          ctx.strokeStyle = 'rgba(76,175,125,.5)'; ctx.lineWidth = 1.5;
          _arcRoundRect(ctx, M + 2, y, rowW, 26, 6); ctx.stroke();
          ctx.fillStyle = '#2c6e4f';
          ctx.fillText('\\u2713 ' + s.name, M + 13, y + 5);
          y += 32;
        });
      } else {
        ctx.fillStyle = ARC_C.soft;
        ctx.font = '400 13px ' + ARC_FONT;
        ctx.fillText('\\u8fd8\\u6ca1\\u6709\\u70b9\\u4eae\\u7684\\u6280\\u80fd\\uff0c\\u4ece\\u8bb0\\u5f55\\u4e00\\u6bb5\\u7ecf\\u5386\\u5f00\\u59cb', M + 4, y);
        y += 26;
      }
      y += 8;

      // ---- 6. \\u5b66\\u4e60\\u4e2d\\u7684\\u6280\\u80fd\\uff08\\u8fdb\\u5ea6\\u6761\\uff09 ----
      ctx.fillStyle = ARC_C.ink;
      ctx.font = '800 14px ' + ARC_FONT;
      ctx.fillText('\\ud83c\\udf31 \\u6b63\\u5728\\u5b66\\u4e60\\uff08' + learning.length + '\\uff09', M + 4, y);
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
        ctx.fillText('\\u8fd8\\u6ca1\\u6709\\u5728\\u5b66\\u7684\\u6280\\u80fd\\uff0c\\u53bb\\u6280\\u80fd\\u6811\\u70b9\\u4e00\\u4e2a\\u300c\\u6211\\u60f3\\u5b66\\u300d', M + 4, y);
        y += 26;
      }
      y += 8;

      // ---- 7. \\u6280\\u80fd\\u7b49\\u7ea7 TOP5 ----
      if (catLevels.length) {
        ctx.fillStyle = ARC_C.ink;
        ctx.font = '800 14px ' + ARC_FONT;
        ctx.fillText('\\ud83d\\udcca \\u6280\\u80fd\\u7b49\\u7ea7 TOP ' + catLevels.length, M + 4, y);
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

      // ---- 8. \\u725b\\u9a6c\\u65f6\\u95f4\\u7ebf\\uff08\\u6700\\u8fd1\\u7ecf\\u5386\\uff09 ----
      ctx.fillStyle = ARC_C.ink;
      ctx.font = '800 14px ' + ARC_FONT;
      ctx.fillText('\\ud83d\\udcc5 \\u6700\\u8fd1\\u7ecf\\u5386\\uff08' + exps.length + ' \\u6bb5\\uff09', M + 4, y);
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
          while (ctx.measureText(tt).width > maxW && tt.length > 3) tt = tt.slice(0, -2) + '\\u2026';
          ctx.fillText(tt, M + 56, y);
          y += 24;
        });
      } else {
        ctx.fillStyle = ARC_C.soft;
        ctx.font = '400 13px ' + ARC_FONT;
        ctx.fillText('\\u8fd8\\u6ca1\\u6709\\u7ecf\\u5386\\u8bb0\\u5f55', M + 4, y);
        y += 24;
      }
      y += 10;

      // ---- 9. \\u9875\\u811a ----
      const footH = 58;
      _arcCard(ctx, M, y, CW, footH);
      ctx.fillStyle = ARC_C.ink;
      ctx.font = '800 13px ' + ARC_FONT;
      ctx.textAlign = 'center';
      ctx.fillText('\\u5730\\u7403Online\\uff08\\u725b\\u9a6c\\u7248\\uff09\\u00b7 \\u771f\\u5b9e\\u7ecf\\u5386 \\u00b7 \\u81ea\\u5df1\\u786e\\u8ba4 \\u00b7 \\u957f\\u6210\\u4f60\\u81ea\\u5df1', W / 2, y + 14);
      ctx.fillStyle = ARC_C.soft;
      ctx.font = '700 12px ' + ARC_FONT;
      ctx.fillText('\\u7d2f\\u8ba1\\u7ecf\\u5386 ' + exps.length + ' \\u6bb5 \\u00b7 \\u5b8c\\u6210\\u5b66\\u4e60\\u4efb\\u52a1 ' + doneTaskCount + ' \\u4e2a \\u00b7 \\u751f\\u6210\\u4e8e ' + dateStr, W / 2, y + 32);
      ctx.textAlign = 'left';
      y += footH + 26;

      // ---- \\u88c1\\u6389\\u591a\\u4f59\\u7a7a\\u767d ----
      const finalH = Math.max(y, 400);
      const out = document.createElement('canvas');
      out.width = W; out.height = finalH;
      out.getContext('2d').drawImage(canvas, 0, 0);
      return out;
    }'''

# 匹配旧函数：从注释行到函数结束（saveArchiveToAlbum 的闭合大括号）
pat = re.compile(
    r"    // \u751f\u6210\u5b58\u6863\u957f\u56fe \u2192 \u5b58\u5230\u76f8\u518c\uff08Web Share API\uff09\uff0c\u4e0d\u652f\u6301\u65f6\u4e0b\u8f7d PNG\n"
    r"    async function saveArchiveToAlbum\(\) \{.*?\n    \}\n",
    re.S)

m = pat.search(js)
if not m:
    print('ERROR: saveArchiveToAlbum not matched')
    raise SystemExit(1)

js = js[:m.start()] + NEW_FUNC + '\n' + js[m.end():]
with io.open(SRC, 'w', encoding='utf-8', newline='') as f:
    f.write(js)
print('saveArchiveToAlbum replaced. html2canvas refs left:', js.count('html2canvas'))

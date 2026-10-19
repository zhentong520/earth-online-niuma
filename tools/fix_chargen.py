#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复角色选择卡死：bg 预设已转 .jpg 但 3 处仍引用 .png；confirmPresetChar 任何失败都降级进首页。"""
import io

JS = 'C:/Users/Administrator/WorkBuddy/2026-10-17-20-06-18/eo-work/src/assets/js/app.js'
js = io.open(JS, encoding='utf-8').read()

# 1) updatePreview 背景预览扩展名
old = "if (_pickBg) { bg.src = `./assets/img/preset/bg/${_pickBg}.png`; bg.style.display = 'block'; }"
new = "if (_pickBg) { bg.src = `./assets/img/preset/bg/${_pickBg}.jpg`; bg.style.display = 'block'; }"
assert old in js, 'preview not found'
js = js.replace(old, new, 1)

# 2) confirmPresetChar 整体重写：.jpg + 全链路兜底（合成失败/资源失败都不卡死）
old_confirm = """    function confirmPresetChar() {
      if (!_pickBg || !_pickChar) {
        alert('请先选一个背景和一个角色～');
        return;
      }
      const bgImg = new Image();
      const chImg = new Image();
      let loaded = 0;
      const tryComposite = () => {
        loaded++;
        if (loaded < 2) return;
        const W = 480, H = 480;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        // 背景：object-fit: cover 效果
        const br = bgImg.naturalWidth / bgImg.naturalHeight;
        const cr = chImg.naturalWidth / chImg.naturalHeight;
        // 背景按 cover 缩放
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
        try {
          const b64 = canvas.toDataURL('image/png');
          saveCharImage(b64);
          try { localStorage.setItem(LS_CHAR_SKIPPED, '0'); } catch(e) {}
          fillHome(getProfile());
          goPage('page-home');
          addExp(30, '创建角色');
        } catch(e) {
          alert('图片合成失败，请重试。');
        }
      };
      bgImg.onload = tryComposite;
      chImg.onload = tryComposite;
      bgImg.onerror = chImg.onerror = () => alert('资源加载失败，请刷新后重试');
      bgImg.src = `./assets/img/preset/bg/${_pickBg}.png`;
      chImg.src = `./assets/img/preset/char/${_pickChar}.png`;
    }"""
new_confirm = """    function confirmPresetChar() {
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
    }"""
assert old_confirm in js, 'confirmPresetChar not found'
js = js.replace(old_confirm, new_confirm, 1)

io.open(JS, 'w', encoding='utf-8').write(js)
print('patched: updatePreview + confirmPresetChar')

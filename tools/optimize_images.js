// 图片资产优化：限宽 750px；无 alpha 大图转 JPEG(q85)；有 alpha 保留 PNG
const Jimp = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/jimp');
const fs = require('fs');
const path = require('path');

const IMG_ROOT = 'C:/Users/Administrator/WorkBuddy/2026-10-17-20-06-18/eo-work/src/assets/img';
const MAX_W = 750;
const results = [];

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(png|jpe?g)$/i.test(f)) results.push(p);
  }
}
walk(IMG_ROOT);

(async () => {
  const out = [];
  for (const p of results) {
    const img = await Jimp.read(p);
    const ow = img.bitmap.width, oh = img.bitmap.height;
    const ext = path.extname(p).toLowerCase();
    const sizeBefore = fs.statSync(p).size;
    // 判断 alpha 通道：取抽样点看是否有非 255 的 alpha
    let hasAlpha = false;
    if (ext === '.png') {
      img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
        if (this.bitmap.data[idx + 3] !== 255) { hasAlpha = true; }
      });
    }
    // 缩放
    let targetW = ow;
    if (ow > MAX_W) targetW = MAX_W;
    if (targetW !== ow) {
      img.resize(targetW, Math.round(oh * targetW / ow));
    }
    let newPath = p;
    if (!hasAlpha && ext === '.png') {
      // 无 alpha → JPEG
      newPath = p.replace(/\.png$/i, '.jpg');
      img.quality(85);
      await img.writeAsync(newPath);
      fs.unlinkSync(p);
    } else {
      await img.writeAsync(p);
    }
    const sizeAfter = fs.statSync(newPath).size;
    out.push({
      file: path.relative(IMG_ROOT, newPath).replace(/\\/g, '/'),
      from: path.relative(IMG_ROOT, p).replace(/\\/g, '/'),
      dim: `${ow}x${oh} -> ${img.bitmap.width}x${img.bitmap.height}`,
      kb: (sizeBefore / 1024).toFixed(0) + 'KB -> ' + (sizeAfter / 1024).toFixed(0) + 'KB',
      type: hasAlpha ? 'png' : 'jpg',
    });
  }
  fs.writeFileSync('C:/Users/Administrator/WorkBuddy/2026-10-17-20-06-18/eo-work/tools/optimize-log.json', JSON.stringify(out, null, 2));
  let tb = 0, ta = 0;
  out.forEach(r => { tb += parseInt(r.kb.split(' -> ')[0]); ta += parseInt(r.kb.split(' -> ')[1]); });
  console.log(`done: ${out.length} files, ${(tb / 1024).toFixed(1)}MB -> ${(ta / 1024).toFixed(1)}MB`);
})();

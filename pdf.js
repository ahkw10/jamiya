/*
 * Shopping-list PDF builder (no external libraries), laid out for reading on a phone inside the store:
 * store → section → compact product rows (photo, name, pack size, the quantity to buy in large type, price).
 * Each page is drawn on a canvas — the browser does the Arabic shaping and right-to-left layout — then the
 * pages are embedded as JPEG images in a small standard PDF, so the receiver needs nothing else to open it.
 */
(function (global) {
  'use strict';

  var PAGE_W = 1080, PAGE_MAX_H = 1920;     // canvas pixels (9:16 at most; the last page is cut to its content)
  var PT_W = 360;                           // PDF page width in points
  var M = 34;                               // side margin
  var FONT = '"SF Arabic", system-ui, -apple-system, "Segoe UI", "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, "Geeza Pro", Arial, sans-serif';
  var INK = '#141B17', INK2 = '#3D4843', MUTED = '#66726C', LINE = '#E1E6E3';
  var COLORS = { L: '#1D63B8', T: '#E8590C', U: '#5B6670', R: '#9A3412' };
  var SOFT = { L: '#E2EDFA', T: '#FDEBDD', U: '#ECEFF1', R: '#FBE7DC' };
  var AR = '٠١٢٣٤٥٦٧٨٩';
  // sizes of the pieces (px)
  var H_FIRST = 176, H_NEXT = 78, H_STORE = 92, H_CONT = 64, H_SEC = 58, H_ROW = 128, H_NOTE = 46, GAP_STORE = 22, FOOT = 54;

  function ar(n) { return String(n).replace(/[0-9]/g, function (d) { return AR[+d]; }); }
  function arText(s) {
    return String(s).replace(/(^|[^A-Za-z0-9])(\d+(?:[.,]\d+)?)(?![A-Za-z0-9])/g, function (m, pre, num) {
      return pre + num.replace(/[.,]/, '٫').replace(/[0-9]/g, function (d) { return AR[+d]; });
    });
  }
  function money(fils) { return ar((fils / 1000).toFixed(3)).replace('.', '٫') + ' د.ك'; }
  function glue(s) {      // keep a number with its unit when lines wrap
    return String(s).replace(/([\d٠-٩][\d٠-٩.,٫×x]*)\s+(?=(?:كجم|كغم|كغ|كيلو|غ|غم|جم|مل|لتر|قطعة|قطع|حبة|حبات|رول|رولات|كيس|قرص|جالون|شريحة|ورقة)(?:$|[\s)،,]))/g, '$1 ');
  }

  // ------------------------------------------------------------------ images
  var cache = new Map();
  function loadImage(url) {
    if (cache.has(url)) return cache.get(url);
    var p = new Promise(function (resolve) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { resolve(im); };
      im.onerror = function () { cache.delete(url); resolve(null); };
      im.src = url;
    });
    cache.set(url, p);
    return p;
  }

  // ------------------------------------------------------------------ drawing helpers
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function font(weight, size) { return weight + ' ' + size + 'px ' + FONT; }
  function wrap(ctx, text, maxW, maxLines) {
    var words = String(text).split(/ +/).filter(Boolean), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (!cur || ctx.measureText(t).width <= maxW) { cur = t; continue; }
      lines.push(cur); cur = words[i];
      if (lines.length === maxLines) return null;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) return null;
    for (var k = 0; k < lines.length; k++) if (ctx.measureText(lines[k]).width > maxW) return null;
    return lines;
  }
  function fitText(ctx, text, maxW, maxLines, sizes, weight) {
    for (var s = 0; s < sizes.length; s++) { ctx.font = font(weight, sizes[s]); var l = wrap(ctx, text, maxW, maxLines); if (l) return { size: sizes[s], lines: l }; }
    var size = sizes[sizes.length - 1]; ctx.font = font(weight, size);
    var words = String(text).split(/ +/).filter(Boolean), out = [], cur = '';
    for (var i = 0; i < words.length && out.length < maxLines; i++) { var t = cur ? cur + ' ' + words[i] : words[i]; if (!cur || ctx.measureText(t).width <= maxW) cur = t; else { out.push(cur); cur = words[i]; } }
    if (out.length < maxLines && cur) out.push(cur);
    var last = out[out.length - 1] || '';
    while (last && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    out[out.length - 1] = last + '…';
    return { size: size, lines: out };
  }

  // first page: title, date, what is in the list, the price date (once)
  function drawFirstHeader(ctx, meta) {
    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = INK;
    ctx.font = font(800, 54); ctx.fillText('قائمة المشتريات', PAGE_W - M, 70);
    ctx.font = font(500, 29); ctx.fillStyle = MUTED; ctx.fillText(meta.dateText, PAGE_W - M, 112);
    ctx.textAlign = 'left'; ctx.fillStyle = INK2; ctx.font = font(700, 30);
    ctx.fillText(meta.summary, M, 70);
    if (meta.priceNote) { ctx.textAlign = 'right'; ctx.fillStyle = MUTED; ctx.font = font(500, 25); ctx.fillText(meta.priceNote, PAGE_W - M, 152); }
    ctx.fillStyle = LINE; ctx.fillRect(M, H_FIRST - 6, PAGE_W - 2 * M, 3);
    return H_FIRST + 10;
  }
  function drawNextHeader(ctx, pageIndex, pageCount) {
    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = INK2; ctx.font = font(800, 32);
    ctx.fillText('قائمة المشتريات', PAGE_W - M, 50);
    ctx.textAlign = 'left'; ctx.fillStyle = MUTED; ctx.font = font(600, 27);
    ctx.fillText('صفحة ' + ar(pageIndex + 1) + ' من ' + ar(pageCount), M, 50);
    ctx.fillStyle = LINE; ctx.fillRect(M, H_NEXT - 8, PAGE_W - 2 * M, 3);
    return H_NEXT + 6;
  }
  function drawStore(ctx, y, s) {
    ctx.fillStyle = COLORS[s.code] || INK2; rr(ctx, M, y, PAGE_W - 2 * M, H_STORE - 12, 20); ctx.fill();
    ctx.direction = 'rtl'; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'right'; ctx.font = font(800, 42);
    ctx.fillText(s.name, PAGE_W - M - 28, y + 54);
    ctx.textAlign = 'left'; ctx.font = font(700, 29);
    var right = s.countText + (s.total ? ' · ' + money(s.total) : '');
    ctx.fillText(right, M + 26, y + 52);
    return y + H_STORE;
  }
  function drawCont(ctx, y, s, sec) {         // a store (and section) that continues from the previous page
    ctx.fillStyle = SOFT[s.code] || '#EEE'; rr(ctx, M, y, PAGE_W - 2 * M, H_CONT - 12, 16); ctx.fill();
    ctx.fillStyle = COLORS[s.code] || INK2; ctx.fillRect(PAGE_W - M - 10, y, 10, H_CONT - 12);
    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = COLORS[s.code] || INK2; ctx.font = font(800, 31);
    ctx.fillText(s.name + (sec ? ' — ' + sec : '') + ' (تابع)', PAGE_W - M - 28, y + 36);
    return y + H_CONT;
  }
  function drawNote(ctx, y, text) {
    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = INK2; ctx.font = font(600, 26);
    ctx.fillText(text, PAGE_W - M - 8, y + 30);
    return y + H_NOTE;
  }
  function drawSection(ctx, y, name, code) {
    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = COLORS[code] || INK; ctx.font = font(800, 33);
    var w = ctx.measureText(name).width;
    ctx.fillText(name, PAGE_W - M - 6, y + 40);
    ctx.fillStyle = LINE; ctx.fillRect(M, y + 29, PAGE_W - 2 * M - w - 26, 3);
    return y + H_SEC;
  }
  function drawRow(ctx, y, e, last) {
    ctx.direction = 'rtl';
    var S = 106, ix = PAGE_W - M - S, iy = y + (H_ROW - S) / 2;
    ctx.save(); rr(ctx, ix, iy, S, S, 14); ctx.clip();
    ctx.fillStyle = '#F2F2F2'; ctx.fillRect(ix, iy, S, S);
    if (e.img) ctx.drawImage(e.img, ix, iy, S, S);
    ctx.restore();
    ctx.lineWidth = 2; ctx.strokeStyle = LINE; rr(ctx, ix, iy, S, S, 14); ctx.stroke();
    // quantity box on the left: the number to buy, large
    var qW = 168, qX = M, qY = y + 14, qH = H_ROW - 28;
    ctx.fillStyle = '#FFFFFF'; rr(ctx, qX, qY, qW, qH, 16); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = MUTED; ctx.font = font(700, 23); ctx.fillText('المطلوب', qX + qW / 2, qY + 30);
    ctx.fillStyle = INK; ctx.font = font(800, 50); ctx.fillText(ar(e.qty), qX + qW / 2, qY + qH - 14);
    // name (one line large, or two smaller lines), then the pack size and the price on one line
    var tRight = ix - 22, tLeft = qX + qW + 22, tW = tRight - tLeft, name = glue(arText(e.name));
    var nm = null, k;
    for (k = 0; k < 3 && !nm; k++) { ctx.font = font(700, [34, 32, 30][k]); var one = wrap(ctx, name, tW, 1); if (one) nm = { size: [34, 32, 30][k], lines: one }; }
    if (!nm) nm = fitText(ctx, name, tW, 2, [30, 28, 26], 700);
    var two = nm.lines.length > 1, lineH = Math.round(nm.size * 1.2);
    var ty = y + (two ? 14 : 22) + nm.size;
    ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = font(700, nm.size);
    for (var i = 0; i < nm.lines.length; i++) ctx.fillText(nm.lines[i], tRight, ty + i * lineH);
    var sy = two ? y + H_ROW - 14 : ty + 44;
    var ptxt = e.unit ? (e.qty > 1 ? money(e.unit) + ' × ' + ar(e.qty) + ' = ' + money(e.total) : money(e.unit)) : '';
    ctx.font = font(600, 25); var pw = ptxt ? ctx.measureText(ptxt).width + 18 : 0;
    if (e.size) {
      var st = arText(e.size), fs2 = 31;
      ctx.font = font(800, fs2);
      while (fs2 > 23 && ctx.measureText(st).width > tW - pw) { fs2 -= 2; ctx.font = font(800, fs2); }
      while (st.length > 3 && ctx.measureText(st).width > tW - pw) st = st.slice(0, -2) + '…';
      ctx.textAlign = 'right'; ctx.fillStyle = INK2; ctx.fillText(st, tRight, sy);
    }
    if (ptxt) { ctx.font = font(600, 25); ctx.fillStyle = MUTED; ctx.textAlign = e.size ? 'left' : 'right'; ctx.fillText(ptxt, e.size ? tLeft : tRight, sy); }
    if (!last) { ctx.fillStyle = LINE; ctx.fillRect(M + qW + 12, y + H_ROW - 2, PAGE_W - 2 * M - qW - 12, 2); }
    return y + H_ROW;
  }

  // ------------------------------------------------------------------ layout: pieces that never split; a heading never sits alone at a page end
  function layout(doc) {
    var blocks = [];
    doc.blocks.forEach(function (s) {
      blocks.push({ t: 'store', s: s, h: H_STORE + (blocks.length ? GAP_STORE : 0) });
      if (s.note) blocks.push({ t: 'note', s: s, text: s.note, h: H_NOTE });
      s.sections.forEach(function (sec) {
        blocks.push({ t: 'sec', s: s, sec: sec, h: H_SEC });
        sec.items.forEach(function (e, i) { blocks.push({ t: 'row', s: s, sec: sec, e: e, h: H_ROW, last: i === sec.items.length - 1 }); });
      });
    });
    var pages = [], cur = null, y = 0;
    function newPage(first) { cur = { first: first, items: [], h: 0 }; pages.push(cur); y = first ? H_FIRST + 10 : H_NEXT + 6; }
    newPage(true);
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      // keep a heading with what follows it (store band + note + section heading + the first row)
      var need = b.h, j = i;
      while (blocks[j] && blocks[j].t !== 'row' && blocks[j + 1]) { j++; need += blocks[j].h; }
      if (y + need > PAGE_MAX_H - FOOT) {
        newPage(false);
        if (b.t === 'row' || b.t === 'sec') { cur.items.push({ t: 'cont', s: b.s, sec: b.t === 'row' ? b.sec.name : '', y: y }); y += H_CONT; }
      }
      var bh = b.t === 'store' && !cur.items.length ? H_STORE : b.h;
      cur.items.push({ t: b.t, s: b.s, sec: b.sec, e: b.e, text: b.text, last: b.last, y: y + (bh < b.h ? 0 : b.h - (b.t === 'store' ? H_STORE : b.h)) });
      y += bh;
      cur.h = y;
    }
    return pages;
  }

  // ------------------------------------------------------------------ JPEG + PDF writer
  function canvasToJpeg(canvas, quality) {
    var data = canvas.toDataURL('image/jpeg', quality), b64 = data.slice(data.indexOf(',') + 1), bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    if (u[0] !== 0xFF || u[1] !== 0xD8) throw new Error('JPEG encoding not supported');
    return { blob: new Blob([u], { type: 'image/jpeg' }), bytes: u };
  }
  function yieldToUI() {
    return new Promise(function (resolve) {
      if (typeof MessageChannel === 'undefined') return setTimeout(resolve, 0);
      var ch = new MessageChannel(); ch.port1.onmessage = function () { ch.port1.close(); resolve(); }; ch.port2.postMessage(0);
    });
  }
  function latin1(s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; }
  function utf16Hex(s) { var h = 'FEFF'; for (var i = 0; i < s.length; i++) h += ('000' + s.charCodeAt(i).toString(16).toUpperCase()).slice(-4); return '<' + h + '>'; }
  function pdfDate(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    var tz = -d.getTimezoneOffset(), a = Math.abs(tz);
    return 'D:' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + (tz >= 0 ? '+' : '-') + p(Math.floor(a / 60)) + "'" + p(a % 60) + "'";
  }
  function assemblePdf(pages, title, when) {
    var chunks = [], pos = 0, offs = [];
    function put(x) { var b = typeof x === 'string' ? latin1(x) : x; chunks.push(b); pos += b.length; }
    function obj(n, body) { offs[n] = pos; put(n + ' 0 obj\n'); body(); put('\nendobj\n'); }
    var n = pages.length;
    function pageNo(i) { return 4 + i * 3; }
    put('%PDF-1.4\n'); put(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    obj(1, function () { put('<< /Type /Catalog /Pages 2 0 R /Lang (ar) >>'); });
    obj(2, function () { var kids = []; for (var i = 0; i < n; i++) kids.push(pageNo(i) + ' 0 R'); put('<< /Type /Pages /Count ' + n + ' /Kids [' + kids.join(' ') + '] >>'); });
    obj(3, function () { put('<< /Title ' + utf16Hex(title) + ' /Producer (Jamiya shopping list) /CreationDate (' + pdfDate(when) + ') >>'); });
    pages.forEach(function (pg, i) {
      var p = pageNo(i), im = p + 1, ct = p + 2;
      var pw = +(pg.w * PT_W / PAGE_W).toFixed(2), ph = +(pg.h * PT_W / PAGE_W).toFixed(2);
      obj(p, function () { put('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /P' + i + ' ' + im + ' 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ' + ct + ' 0 R >>'); });
      obj(im, function () { put('<< /Type /XObject /Subtype /Image /Width ' + pg.w + ' /Height ' + pg.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + pg.bytes.length + ' >>\nstream\n'); put(pg.bytes); put('\nendstream'); });
      var content = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /P' + i + ' Do Q';
      obj(ct, function () { put('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'); });
    });
    var total = 3 + n * 3, xref = pos, x = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
    for (var k = 1; k <= total; k++) x += ('000000000' + offs[k]).slice(-10) + ' 00000 n \n';
    put(x); put('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R /Info 3 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  // ------------------------------------------------------------------ public API
  function dateText(d) {
    try {
      return new Intl.DateTimeFormat('ar-KW-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d) + ' — ' +
        new Intl.DateTimeFormat('ar-KW-u-nu-arab', { hour: 'numeric', minute: '2-digit' }).format(d);
    } catch (e) { return ar(d.getDate()) + '/' + ar(d.getMonth() + 1) + '/' + ar(d.getFullYear()); }
  }
  function fileName(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return 'قائمة-المشتريات-' + p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear() + '-' + p(d.getHours()) + p(d.getMinutes()) + '.pdf';
  }
  function countItems(n) { return n === 1 ? 'صنف واحد' : n === 2 ? 'صنفان' : n <= 10 ? ar(n) + ' أصناف' : ar(n) + ' صنفًا'; }

  /**
   * doc: { stores: [{code:'L'|'T', name, total (fils), count, sections:[{name, items:[{name, size, qty, img, unit, total}]}]}],
   *        extra: [{code:'U'|'R', name, note, count, sections:[...]}], priceNote }
   * returns Promise<{ file, blob, pages: Blob[], pageCount, name }>
   */
  function build(doc, opts) {
    opts = opts || {};
    var when = opts.date || new Date(), isCancelled = opts.isCancelled || function () { return false; };
    var blocks = (doc.stores || []).concat(doc.extra || []).map(function (s) {
      return { code: s.code, name: s.name, total: s.total || 0, note: s.note || '', countText: countItems(s.count || s.sections.reduce(function (a, x) { return a + x.items.length; }, 0)), sections: s.sections };
    });
    var all = []; blocks.forEach(function (s) { s.sections.forEach(function (sec) { sec.items.forEach(function (e) { all.push(e); }); }); });
    var stores = (doc.stores || []).length;
    var meta = { dateText: dateText(when), priceNote: doc.priceNote || '',
      summary: countItems(all.length) + (stores === 2 ? ' · متجران' : stores === 1 ? ' · ' + doc.stores[0].name : '') };
    var plan = layout({ blocks: blocks });
    var pageCount = plan.length;
    var canvas = document.createElement('canvas'); canvas.width = PAGE_W; canvas.height = PAGE_MAX_H;
    var ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
    var pages = [], previews = [];
    return Promise.all(all.map(function (e) { return loadImage(e.img).then(function (im) { e.img = im; return im && im.decode ? im.decode().catch(function () { }) : null; }); }))
      .then(function () {
        var chain = Promise.resolve();
        plan.forEach(function (pg, p) {
          chain = chain.then(function () {
            if (isCancelled()) throw new Error('cancelled');
            var h = p === pageCount - 1 ? Math.min(PAGE_MAX_H, pg.h + (pageCount > 1 ? FOOT + 10 : 30)) : PAGE_MAX_H;
            if (canvas.height !== h) canvas.height = h;
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, PAGE_W, h);
            if (pg.first) drawFirstHeader(ctx, meta); else drawNextHeader(ctx, p, pageCount);
            pg.items.forEach(function (it) {
              if (it.t === 'store') drawStore(ctx, it.y, it.s);
              else if (it.t === 'cont') drawCont(ctx, it.y, it.s, it.sec);
              else if (it.t === 'note') drawNote(ctx, it.y, it.text);
              else if (it.t === 'sec') drawSection(ctx, it.y, it.sec.name, it.s.code);
              else drawRow(ctx, it.y, it.e, it.last);
            });
            if (pageCount > 1) { ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.fillStyle = MUTED; ctx.font = font(500, 25); ctx.fillText(ar(p + 1) + ' / ' + ar(pageCount), PAGE_W / 2, h - 20); }
            return canvasToJpeg(canvas, 0.85);
          }).then(function (jpg) { pages.push({ bytes: jpg.bytes, w: PAGE_W, h: canvas.height }); previews.push(jpg.blob); return yieldToUI(); });
        });
        return chain;
      })
      .then(function () {
        var blob = assemblePdf(pages, 'قائمة المشتريات', when), name = fileName(when), file;
        try { file = new File([blob], name, { type: 'application/pdf', lastModified: when.getTime() }); } catch (e) { file = blob; file.name = name; }
        return { file: file, blob: blob, pages: previews, pageCount: pageCount, name: name };
      });
  }

  global.ShoppingPdf = { build: build, loadImage: loadImage, layout: layout };
})(window);

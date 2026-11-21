/*
 * Shopping-list PDF builder (no external libraries).
 * Each page is drawn on a canvas — the browser does the Arabic shaping and
 * right-to-left layout — then the pages are embedded as JPEG images inside a
 * small, standard PDF file. Product photos are therefore part of the file and
 * the receiver needs nothing else to open it.
 */
(function (global) {
  'use strict';

  var PAGE_W = 1080, PAGE_H = 1920;   // canvas pixels: 9:16, comfortable on a phone screen
  var PT_W = 360, PT_H = 640;         // PDF page size in points
  var ROWS = 3;                       // products per page (photo + quantity side by side)
  var FONT = 'system-ui, -apple-system, "Segoe UI", Tahoma, "Noto Sans Arabic", "Noto Naskh Arabic", "Geeza Pro", Arial, sans-serif';
  var GREEN = '#0E7C4A', GREEN_DARK = '#0A5A36', INK = '#17201B', MUTED = '#5F6B65';
  var AR = '٠١٢٣٤٥٦٧٨٩';

  function ar(n) { return String(n).replace(/[0-9]/g, function (d) { return AR[+d]; }); }
  // keep a number together with its unit (e.g. «320 غ») when lines wrap
  function glue(s) {
    return String(s).replace(/(\d[\d.,×x]*)\s+(?=(?:كجم|كغم|كغ|كيلو|غ|غم|جم|جرام|غرام|مل|لتر|قطعة|قطع|حبة|حبات|رول|رولات|كيس|قرص|جالون|شريحة|ورقة)(?:$|[\s)،,]))/g, '$1\u00A0');
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
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function font(weight, size) { return weight + ' ' + size + 'px ' + FONT; }

  // Word-wrap (works on logical order, so it is safe for Arabic). Returns lines or null if it does not fit.
  function wrap(ctx, text, maxW, maxLines) {
    var words = String(text).split(/ +/).filter(Boolean);   // plain spaces only: «320 غ» stays together
    var lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (!cur || ctx.measureText(t).width <= maxW) { cur = t; continue; }
      lines.push(cur);
      cur = words[i];
      if (lines.length === maxLines) return null;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) return null;
    for (var k = 0; k < lines.length; k++) if (ctx.measureText(lines[k]).width > maxW) return null;
    return lines;
  }

  function fitName(ctx, text, maxW, maxLines) {
    var sizes = [50, 46, 42, 38, 34];
    for (var s = 0; s < sizes.length; s++) {
      ctx.font = font(700, sizes[s]);
      var lines = wrap(ctx, text, maxW, maxLines);
      if (lines) return { size: sizes[s], lines: lines };
    }
    // still too long: cut with an ellipsis at the smallest size
    ctx.font = font(700, 34);
    var words = String(text).split(/ +/).filter(Boolean), out = [], cur = '';
    for (var i = 0; i < words.length && out.length < maxLines; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (!cur || ctx.measureText(t).width <= maxW) cur = t; else { out.push(cur); cur = words[i]; }
    }
    if (out.length < maxLines && cur) out.push(cur);
    var last = out[out.length - 1] || '';
    while (last && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    out[out.length - 1] = last + '…';
    return { size: 34, lines: out };
  }

  function drawHeader(ctx, meta, first, pageIndex, pageCount) {
    var M = 56;
    ctx.direction = 'rtl';
    if (first) {
      ctx.fillStyle = GREEN;
      rr(ctx, M, 44, PAGE_W - 2 * M, 250, 40);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'right';
      ctx.font = font(800, 86);
      ctx.fillText('قائمة المشتريات', PAGE_W - M - 48, 44 + 112);
      ctx.font = font(500, 36);
      ctx.fillText(meta.dateText, PAGE_W - M - 48, 44 + 170);
      ctx.font = font(700, 38);
      ctx.fillText('عدد الأصناف: ' + ar(meta.itemCount) + '   •   مجموع القطع: ' + ar(meta.totalQty), PAGE_W - M - 48, 44 + 224);
      return 44 + 250 + 34;
    }
    ctx.fillStyle = GREEN_DARK;
    ctx.textAlign = 'right';
    ctx.font = font(800, 48);
    ctx.fillText('قائمة المشتريات', PAGE_W - M, 104);
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'left';
    ctx.font = font(600, 36);
    ctx.fillText('صفحة ' + ar(pageIndex + 1) + ' من ' + ar(pageCount), M, 104);
    ctx.fillStyle = '#DDE5E0';
    ctx.fillRect(M, 136, PAGE_W - 2 * M, 4);
    return 168;
  }

  function drawRow(ctx, e, x, y, w, h) {
    ctx.direction = 'rtl';
    // card
    ctx.fillStyle = '#F5F8F6';
    rr(ctx, x, y, w, h, 30);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#D7E0DA';
    ctx.stroke();

    var pad = 22;
    var S = Math.min(h - 2 * pad, Math.round(w * 0.5));
    var ix = x + w - pad - S, iy = y + (h - S) / 2;

    // product photo (square, keeps package details)
    ctx.save();
    rr(ctx, ix, iy, S, S, 22);
    ctx.clip();
    ctx.fillStyle = '#EFEFEF';
    ctx.fillRect(ix, iy, S, S);
    if (e.img) ctx.drawImage(e.img, ix, iy, S, S);
    else {
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'center';
      ctx.font = font(600, 34);
      ctx.fillText('الصورة غير متاحة', ix + S / 2, iy + S / 2);
    }
    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#D7E0DA';
    rr(ctx, ix, iy, S, S, 22);
    ctx.stroke();

    // list number on the photo corner
    var r = 34, bx = ix + S - r - 12, by = iy + r + 12;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = GREEN;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = font(800, e.index > 99 ? 28 : 36);
    ctx.fillText(ar(e.index), bx, by + 13);

    // text block (to the left of the photo)
    var tRight = ix - 30, tLeft = x + pad + 8, tW = tRight - tLeft;
    var name = e.name ? fitName(ctx, glue(e.name), tW, 3) : null;
    var lineH = name ? Math.round(name.size * 1.32) : 0;
    var nameH = name ? name.lines.length * lineH : 0;

    // quantity pill: «الكمية: ٣» — label + large number
    var label = 'الكمية:', num = ar(e.qty);
    ctx.font = font(700, 50);
    var lw = ctx.measureText(label).width;
    ctx.font = font(800, 104);
    var nw = ctx.measureText(num).width;
    var pillH = 136, pillW = Math.min(tW, 44 + lw + 22 + nw + 44);
    var gap = name ? 34 : 0;
    var blockH = nameH + gap + pillH;
    var top = iy + Math.max(0, (S - blockH) / 2);

    if (name) {
      ctx.fillStyle = INK;
      ctx.textAlign = 'right';
      ctx.font = font(700, name.size);
      for (var i = 0; i < name.lines.length; i++) ctx.fillText(name.lines[i], tRight, top + name.size + i * lineH);
    }
    var py = top + nameH + gap;
    ctx.fillStyle = '#FFFFFF';
    rr(ctx, tRight - pillW, py, pillW, pillH, 30);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = GREEN;
    ctx.stroke();
    ctx.fillStyle = GREEN_DARK;
    ctx.textAlign = 'right';
    ctx.font = font(700, 50);
    ctx.fillText(label, tRight - 44, py + 88);
    ctx.font = font(800, 104);
    ctx.fillText(num, tRight - 44 - lw - 22, py + 104);
  }

  function drawFooter(ctx, pageIndex, pageCount, h) {
    ctx.direction = 'rtl';
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'center';
    ctx.font = font(500, 32);
    ctx.fillText('صفحة ' + ar(pageIndex + 1) + ' من ' + ar(pageCount), PAGE_W / 2, h - 48);
  }

  // Synchronous encoding: unlike toBlob it never waits for the browser to become idle,
  // so the file is ready a fraction of a second after the last change.
  function canvasToJpeg(canvas, quality) {
    var data = canvas.toDataURL('image/jpeg', quality);
    var b64 = data.slice(data.indexOf(',') + 1);
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    if (u[0] !== 0xFF || u[1] !== 0xD8) throw new Error('JPEG encoding not supported');
    return { blob: new Blob([u], { type: 'image/jpeg' }), bytes: u };
  }

  // Let the page handle taps between pages (MessageChannel is not throttled like setTimeout).
  function yieldToUI() {
    return new Promise(function (resolve) {
      if (typeof MessageChannel === 'undefined') return setTimeout(resolve, 0);
      var ch = new MessageChannel();
      ch.port1.onmessage = function () { ch.port1.close(); resolve(); };
      ch.port2.postMessage(0);
    });
  }

  // ------------------------------------------------------------------ PDF writer
  function latin1(s) {
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
    return b;
  }
  function utf16Hex(s) {
    var h = 'FEFF';
    for (var i = 0; i < s.length; i++) h += ('000' + s.charCodeAt(i).toString(16).toUpperCase()).slice(-4);
    return '<' + h + '>';
  }
  function pdfDate(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    var tz = -d.getTimezoneOffset(), a = Math.abs(tz);
    return 'D:' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) +
      (tz >= 0 ? '+' : '-') + p(Math.floor(a / 60)) + "'" + p(a % 60) + "'";
  }

  function assemblePdf(pages, title, when) {
    var chunks = [], pos = 0, offs = [];
    function put(x) { var b = typeof x === 'string' ? latin1(x) : x; chunks.push(b); pos += b.length; }
    function obj(n, body) { offs[n] = pos; put(n + ' 0 obj\n'); body(); put('\nendobj\n'); }
    var n = pages.length;
    function pageNo(i) { return 4 + i * 3; }
    put('%PDF-1.4\n');
    put(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    obj(1, function () { put('<< /Type /Catalog /Pages 2 0 R /Lang (ar) >>'); });
    obj(2, function () {
      var kids = [];
      for (var i = 0; i < n; i++) kids.push(pageNo(i) + ' 0 R');
      put('<< /Type /Pages /Count ' + n + ' /Kids [' + kids.join(' ') + '] >>');
    });
    obj(3, function () { put('<< /Title ' + utf16Hex(title) + ' /Producer (Jamiya shopping list) /CreationDate (' + pdfDate(when) + ') >>'); });
    pages.forEach(function (pg, i) {
      var p = pageNo(i), im = p + 1, ct = p + 2;
      var pw = +(pg.w * PT_W / PAGE_W).toFixed(2), ph = +(pg.h * PT_W / PAGE_W).toFixed(2);
      obj(p, function () {
        put('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /P' + i + ' ' + im +
          ' 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ' + ct + ' 0 R >>');
      });
      obj(im, function () {
        put('<< /Type /XObject /Subtype /Image /Width ' + pg.w + ' /Height ' + pg.h +
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + pg.bytes.length + ' >>\nstream\n');
        put(pg.bytes);
        put('\nendstream');
      });
      var content = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /P' + i + ' Do Q';
      obj(ct, function () { put('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'); });
    });
    var total = 3 + n * 3, xref = pos;
    var x = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
    for (var k = 1; k <= total; k++) x += ('000000000' + offs[k]).slice(-10) + ' 00000 n \n';
    put(x);
    put('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R /Info 3 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  // ------------------------------------------------------------------ public API
  function dateText(d) {
    try {
      var day = new Intl.DateTimeFormat('ar-KW-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
      var time = new Intl.DateTimeFormat('ar-KW-u-nu-arab', { hour: 'numeric', minute: '2-digit' }).format(d);
      return day + ' — ' + time;
    } catch (e) {
      return ar(d.getDate()) + '/' + ar(d.getMonth() + 1) + '/' + ar(d.getFullYear());
    }
  }

  function fileName(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return 'قائمة-المشتريات-' + p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear() + '-' + p(d.getHours()) + p(d.getMinutes()) + '.pdf';
  }

  /**
   * entries: [{ name: string ('' if unknown), qty: number, img: url }]
   * returns Promise<{ file: File|Blob, blob: Blob, pages: Blob[], pageCount, name }>
   */
  function build(entries, opts) {
    opts = opts || {};
    var when = opts.date || new Date();
    var isCancelled = opts.isCancelled || function () { return false; };
    var list = entries.map(function (e, i) { return { index: i + 1, name: e.name || '', qty: e.qty, url: e.img }; });
    var meta = {
      dateText: dateText(when),
      itemCount: list.length,
      totalQty: list.reduce(function (s, e) { return s + e.qty; }, 0)
    };
    var pageCount = Math.max(1, Math.ceil(list.length / ROWS));
    var canvas = document.createElement('canvas');
    canvas.width = PAGE_W; canvas.height = PAGE_H;
    // CPU canvas: encoding does not wait for the GPU, so the file is ready quickly and predictably
    var ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
    var pages = [], previews = [];

    return Promise.all(list.map(function (e) {
      return loadImage(e.url).then(function (im) {
        e.img = im;
        // decode ahead of drawing (keeps page drawing quick); ignore if unsupported
        return im && im.decode ? im.decode().catch(function () { }) : null;
      });
    }))
      .then(function () {
        var chain = Promise.resolve();
        for (var p = 0; p < pageCount; p++) {
          (function (p) {
            chain = chain.then(function () {
              if (isCancelled()) throw new Error('cancelled');
              var slice = list.slice(p * ROWS, p * ROWS + ROWS);
              var first = p === 0, gap = 26;
              var top0 = first ? 328 : 168;                       // header heights (see drawHeader)
              var rowH = Math.floor((PAGE_H - 104 - top0 - gap * (ROWS - 1)) / ROWS);
              var h = slice.length < ROWS ? top0 + slice.length * rowH + (slice.length - 1) * gap + 104 : PAGE_H;
              if (canvas.height !== h) canvas.height = h;
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, PAGE_W, h);
              var top = drawHeader(ctx, meta, first, p, pageCount);
              slice.forEach(function (e, i) { drawRow(ctx, e, 56, top + i * (rowH + gap), PAGE_W - 112, rowH); });
              drawFooter(ctx, p, pageCount, h);
              return canvasToJpeg(canvas, 0.86);
            }).then(function (jpg) {
              pages.push({ bytes: jpg.bytes, w: PAGE_W, h: canvas.height });
              previews.push(jpg.blob);
              return yieldToUI();
            });
          })(p);
        }
        return chain;
      })
      .then(function () {
        var blob = assemblePdf(pages, 'قائمة المشتريات', when);
        var name = fileName(when);
        var file;
        try { file = new File([blob], name, { type: 'application/pdf', lastModified: when.getTime() }); }
        catch (e) { file = blob; file.name = name; }
        return { file: file, blob: blob, pages: previews, pageCount: pageCount, name: name };
      });
  }

  global.ShoppingPdf = { build: build, loadImage: loadImage, ROWS_PER_PAGE: ROWS };
})(window);

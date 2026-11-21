/* قائمة الجمعية — shopping list app logic */
(function () {
  'use strict';

  var CAT = window.CATALOG || { categories: [], items: [] };
  var ITEMS = CAT.items || [];
  var byId = new Map();
  ITEMS.forEach(function (it) { byId.set(it.id, it); });

  var LS_CART = 'jamiya.cart.v1';
  var LS_NAMES = 'jamiya.names.v1';
  var MAX_QTY = 99;
  var AR = '٠١٢٣٤٥٦٧٨٩';
  var TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"/></svg>';

  function $(sel) { return document.querySelector(sel); }
  function ar(n) { return String(n).replace(/[0-9]/g, function (d) { return AR[+d]; }); }
  function thumbUrl(it) { return 'img/t/' + encodeURIComponent(it.id) + '.jpg?v=' + it.v; }
  function medUrl(it) { return 'img/m/' + encodeURIComponent(it.id) + '.jpg?v=' + it.v; }

  // ------------------------------------------------------------ storage (never throws)
  function readJSON(key, def) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return def;
      var v = JSON.parse(raw);
      return v == null ? def : v;
    } catch (e) { return def; }
  }
  function writeJSON(key, val) {
    try { window.localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }

  var cart = new Map();          // id -> qty
  var version = 0;               // bumps on every change of the list
  var ALIASES = CAT.aliases || {}; // merged duplicate card -> kept card
  function canonical(id) {
    var guard = 0;
    while (Object.prototype.hasOwnProperty.call(ALIASES, id) && guard++ < 20) id = ALIASES[id];
    return id;
  }
  var names = readJSON(LS_NAMES, {});
  if (!names || typeof names !== 'object') names = {};
  (function migrateNames() {       // a custom name given to a merged card moves to the kept card
    var moved = false;
    Object.keys(names).forEach(function (id) {
      var c = canonical(id);
      if (c !== id) { if (!names[c]) names[c] = names[id]; delete names[id]; moved = true; }
    });
    if (moved) writeJSON(LS_NAMES, names);
  })();
  var storageWarned = false;

  // Saved quantities of cards that were merged are added together under the kept card
  // (e.g. 2 of the first card + 1 of the second = 3 of the same product).
  function loadCart() {
    cart.clear();
    var data = readJSON(LS_CART, null);
    var items = data && data.items;
    var merged = false;
    if (items && typeof items === 'object') {
      Object.keys(items).forEach(function (id) {
        var q = Math.floor(Number(items[id]));
        var c = canonical(id);
        if (c !== id) merged = true;
        if (byId.has(c) && q > 0) cart.set(c, Math.min((cart.get(c) || 0) + q, MAX_QTY));
      });
    }
    return merged;
  }
  function saveCart() {
    var obj = {};
    cart.forEach(function (q, id) { obj[id] = q; });
    var ok = writeJSON(LS_CART, { v: 1, savedAt: Date.now(), items: obj });
    if (!ok && !storageWarned) {
      storageWarned = true;
      toast('تعذّر حفظ القائمة على هذا الجهاز (التخزين معطّل). ستبقى ما دامت الصفحة مفتوحة.');
    }
  }

  function displayName(it) {
    var n = names[it.id];
    if (typeof n === 'string' && n.trim()) return n.trim();
    return (it.name || '').trim();
  }
  function label(it) { return displayName(it) || ('صنف رقم ' + ar(it.no)); }
  // keep a number together with its unit (e.g. «320 غ») when lines wrap
  function glue(s) {
    return String(s).replace(/(\d[\d.,×x]*)\s+(?=(?:كجم|كغم|كغ|كيلو|غ|غم|جم|جرام|غرام|مل|لتر|قطعة|قطع|حبة|حبات|رول|رولات|كيس|قرص|جالون|شريحة|ورقة)(?:$|[\s)،,]))/g, '$1\u00A0');
  }

  function countItems(n) {
    if (n === 1) return 'صنف واحد';
    if (n === 2) return 'صنفان';
    if (n >= 3 && n <= 10) return ar(n) + ' أصناف';
    return ar(n) + ' صنفًا';
  }
  function countPieces(n) {
    if (n === 1) return 'قطعة واحدة';
    if (n === 2) return 'قطعتان';
    if (n >= 3 && n <= 10) return ar(n) + ' قطع';
    return ar(n) + ' قطعة';
  }
  function countProducts(n) {
    if (n === 1) return 'منتج واحد';
    if (n === 2) return 'منتجان';
    if (n >= 3 && n <= 10) return ar(n) + ' منتجات';
    return ar(n) + ' منتجًا';
  }

  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[ً-ْٰـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(/[×*]/g, 'x')
      .replace(/\s+/g, ' ').trim();
  }

  // ------------------------------------------------------------ elements
  var catalogEl = $('#catalog'), catSel = $('#cat'), qInput = $('#q'), emptyEl = $('#empty');
  var toolsEl = $('#tools'), barEl = $('#bar'), barNote = $('#barNote');
  var shareBtn = $('#shareBtn'), shareLabel = $('#shareLabel'), downloadBtn = $('#downloadBtn');
  var reviewBtn = $('#reviewBtn'), rbCount = $('#rbCount');
  var sheet = $('#sheet'), sheetList = $('#sheetList'), sheetEmpty = $('#sheetEmpty'), sheetSummary = $('#sheetSummary');
  var clearBtn = $('#clearBtn'), previewBtn = $('#previewBtn');
  var viewer = $('#viewer'), vImg = $('#vImg'), vImgBox = $('#vImgBox'), vName = $('#vName'), vNo = $('#vNo');
  var vCtrl = $('#vCtrl'), vRename = $('#vRename'), vOrig = $('#vOrig');
  var previewEl = $('#preview'), pvPages = $('#pvPages'), pvInfo = $('#pvInfo');
  var toastEl = $('#toast');

  // ------------------------------------------------------------ catalog
  var cards = new Map();
  var sections = [];

  function ctrlHTML(q) {
    if (!q) return '<button type="button" class="add" data-act="add">إضافة</button>';
    return '<div class="stepper" role="group" aria-label="الكمية">' +
      '<button type="button" data-act="inc" aria-label="زيادة الكمية">+</button>' +
      '<output aria-live="polite">' + ar(q) + '</output>' +
      '<button type="button" data-act="dec" aria-label="' + (q === 1 ? 'إزالة من القائمة' : 'إنقاص الكمية') + '">' +
      (q === 1 ? TRASH : '−') + '</button></div>';
  }

  function updateStepper(container, q) {
    var step = container.querySelector('.stepper');
    if (q && step) {
      step.querySelector('output').textContent = ar(q);
      var dec = step.querySelector('[data-act="dec"]');
      var wantTrash = q === 1, isTrash = !!dec.querySelector('svg');
      if (wantTrash !== isTrash) {
        dec.innerHTML = wantTrash ? TRASH : '−';
        dec.setAttribute('aria-label', wantTrash ? 'إزالة من القائمة' : 'إنقاص الكمية');
      }
      return false;
    }
    container.innerHTML = ctrlHTML(q);
    return true;
  }

  function makeCard(it) {
    var el = document.createElement('article');
    el.className = 'card';
    el.dataset.id = it.id;
    el.innerHTML =
      '<button class="pic" type="button"><img alt="" loading="lazy" decoding="async" width="480" height="480"></button>' +
      '<span class="qty-badge" aria-hidden="true"></span>' +
      '<h3 class="name"></h3>' +
      '<div class="ctrl"></div>';
    el.querySelector('img').src = thumbUrl(it);
    fillName(el, it);
    renderCard(el, it.id);
    return el;
  }

  function fillName(el, it) {
    var h = el.querySelector('.name');
    h.textContent = glue(label(it));
    h.classList.toggle('unnamed', !displayName(it));
    el.querySelector('.pic').setAttribute('aria-label', 'عرض الصورة مكبرة: ' + label(it));
  }

  function renderCard(el, id) {
    var q = cart.get(id) || 0;
    el.classList.toggle('selected', q > 0);
    el.querySelector('.qty-badge').textContent = q ? ar(q) : '';
    return updateStepper(el.querySelector('.ctrl'), q);
  }

  function buildCatalog() {
    var frag = document.createDocumentFragment();
    var cats = (CAT.categories || []).slice();
    ITEMS.forEach(function (it) { if (cats.indexOf(it.cat) < 0) cats.push(it.cat); });
    cats.forEach(function (c) {
      var its = ITEMS.filter(function (it) { return it.cat === c; });
      if (!its.length) return;
      var sec = document.createElement('section');
      sec.className = 'sec';
      sec.dataset.cat = c;
      var h = document.createElement('h2');
      h.className = 'sec-h';
      var t = document.createElement('span'); t.textContent = c || 'أخرى';
      var small = document.createElement('small');
      h.appendChild(t); h.appendChild(small);
      var grid = document.createElement('div');
      grid.className = 'grid';
      its.forEach(function (it) {
        var card = makeCard(it);
        cards.set(it.id, card);
        grid.appendChild(card);
      });
      sec.appendChild(h);
      sec.appendChild(grid);
      frag.appendChild(sec);
      sections.push({ cat: c, el: sec, countEl: small, ids: its.map(function (i) { return i.id; }) });
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c || 'أخرى';
      catSel.appendChild(opt);
    });
    catalogEl.appendChild(frag);
    $('#subtitle').textContent = countProducts(ITEMS.length) + ' — اختر ما تحتاجه وحدد الكمية ثم اضغط «مشاركة قائمة المشتريات».';
    if (!ITEMS.length) {
      emptyEl.textContent = 'لم يتم العثور على كتالوج المنتجات. شغّل التطبيق من ملف التشغيل على الكمبيوتر.';
      emptyEl.hidden = false;
    }
  }

  function applyFilter() {
    var terms = norm(qInput.value).split(' ').filter(Boolean);
    var cat = catSel.value, total = 0;
    sections.forEach(function (s) {
      if (cat && s.cat !== cat) { s.el.hidden = true; return; }
      var visible = 0;
      s.ids.forEach(function (id) {
        var it = byId.get(id);
        if (!it._hay) it._hay = norm(label(it) + ' ' + it.cat + ' ' + it.no);
        var ok = terms.every(function (t) { return it._hay.indexOf(t) >= 0; });
        cards.get(id).hidden = !ok;
        if (ok) visible++;
      });
      s.el.hidden = visible === 0;
      s.countEl.textContent = ar(visible);
      total += visible;
    });
    emptyEl.hidden = total > 0 || !ITEMS.length;
  }

  // ------------------------------------------------------------ changes
  function setQty(id, q) {
    q = Math.max(0, Math.min(MAX_QTY, Math.floor(q)));
    var prev = cart.get(id) || 0;
    if (q === prev) {
      if (q === MAX_QTY) toast('الحد الأقصى للكمية ' + ar(MAX_QTY));
      return;
    }
    if (q) cart.set(id, q); else cart.delete(id);
    changed([id]);
  }

  function changed(ids) {
    version++;
    saveCart();
    ids.forEach(function (id) { var el = cards.get(id); if (el) renderCard(el, id); });
    if (!sheet.hidden) syncSheet(ids);
    if (!viewer.hidden && viewerId && ids.indexOf(viewerId) >= 0) updateStepper(vCtrl, cart.get(viewerId) || 0);
    updateSummary();
    schedulePdf();
  }

  function focusIn(host, act) {
    var ae = document.activeElement;
    if (ae && ae !== document.body && host.contains(ae)) return;
    var target = host.querySelector('[data-act="' + act + '"]');
    if (target) try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var btn = t.closest('[data-act]');
    if (btn) {
      var host = btn.closest('[data-id]');
      if (!host) return;
      var id = host.dataset.id, q = cart.get(id) || 0, act = btn.dataset.act;
      if (act === 'add') { setQty(id, 1); focusIn(host, 'inc'); }
      else if (act === 'inc') setQty(id, q + 1);
      else if (act === 'dec') { setQty(id, q - 1); if (q - 1 === 0) focusIn(host, 'add'); }
      return;
    }
    var pic = t.closest('.pic, .thumb');
    if (pic) {
      var h = pic.closest('[data-id]');
      if (h) openViewer(h.dataset.id);
      return;
    }
    if (t.closest('[data-close]')) { closeTop(); return; }
  });

  // ------------------------------------------------------------ summary + bar
  function totals() {
    var n = 0, pcs = 0;
    cart.forEach(function (q) { n++; pcs += q; });
    return { n: n, pcs: pcs };
  }

  function updateSummary() {
    var t = totals();
    rbCount.textContent = t.n ? ar(t.n) : '';
    rbCount.hidden = !t.n;
    reviewBtn.setAttribute('aria-label', t.n ? 'مراجعة قائمتي: ' + countItems(t.n) + '، ' + countPieces(t.pcs) : 'مراجعة قائمتي: فارغة');
    sheetSummary.textContent = t.n ? countItems(t.n) + ' — ' + countPieces(t.pcs) : 'لم تختر أي منتج بعد';
    clearBtn.hidden = !t.n;
    previewBtn.disabled = !t.n;
    document.title = t.n ? '(' + ar(t.n) + ') قائمة الجمعية' : 'قائمة الجمعية';
    updateShareUI();
  }

  function setBarHeight() {
    document.documentElement.style.setProperty('--bar-h', barEl.offsetHeight + 'px');
    document.documentElement.style.setProperty('--tools-h', toolsEl.offsetHeight + 'px');
  }

  // ------------------------------------------------------------ PDF (prepared ahead of the tap)
  var pdf = { status: 'empty', version: -1, result: null };
  var buildTimer = 0, building = false, buildAgain = false;

  function schedulePdf(delay) {
    clearTimeout(buildTimer);
    if (!cart.size) {
      pdf = { status: 'empty', version: version, result: null };
      updateShareUI();
      return;
    }
    if (!(pdf.status === 'ready' && pdf.version === version)) pdf.status = 'building';
    updateShareUI();
    buildTimer = setTimeout(runBuild, delay == null ? 250 : delay);
  }

  function entries() {
    var out = [];
    ITEMS.forEach(function (it) {
      var q = cart.get(it.id);
      if (q) out.push({ id: it.id, name: displayName(it), qty: q, img: medUrl(it) });
    });
    return out;
  }

  function runBuild() {
    if (building) { buildAgain = true; return; }
    if (!cart.size) return;
    if (!window.ShoppingPdf) { pdf = { status: 'error', version: version, result: null }; updateShareUI(); return; }
    building = true;
    var v = version;
    window.ShoppingPdf.build(entries(), { isCancelled: function () { return v !== version; } })
      .then(function (res) {
        if (v !== version) return;
        if (pdf.result && pdf.result.previewUrls) pdf.result.previewUrls.forEach(function (u) { URL.revokeObjectURL(u); });
        pdf = { status: 'ready', version: v, result: res };
      }, function (err) {
        if (v !== version || (err && err.message === 'cancelled')) return;
        console.error('PDF build failed', err);
        pdf = { status: 'error', version: v, result: null };
      })
      .then(function () {
        building = false;
        if ((buildAgain || v !== version) && cart.size) { buildAgain = false; runBuild(); }
        updateShareUI();
        if (!previewEl.hidden) renderPreview();
      });
  }

  function shareSupport() {
    if (!window.isSecureContext) return 'insecure';
    if (!navigator.share || !navigator.canShare) return 'no';
    try {
      var f = new File([new Uint8Array([37, 80, 68, 70])], 'test.pdf', { type: 'application/pdf' });
      return navigator.canShare({ files: [f] }) ? 'yes' : 'no';
    } catch (e) { return 'no'; }
  }
  var SHARE = shareSupport();       // re-checked on every UI update
  var shareFailed = false, sharing = false;

  function isReady() { return pdf.status === 'ready' && pdf.version === version && cart.size > 0; }

  function updateShareUI() {
    SHARE = shareSupport();
    var n = cart.size, ready = isReady();
    var error = n > 0 && pdf.status === 'error' && pdf.version === version;
    var busy = n > 0 && !ready && !error;
    var useShare = SHARE === 'yes';

    shareBtn.hidden = !useShare;
    downloadBtn.hidden = useShare && !shareFailed;

    shareBtn.disabled = !(ready || error);
    shareBtn.classList.toggle('busy', busy);
    shareLabel.textContent = busy ? 'جارٍ تجهيز الملف…' : (error ? 'تعذّر تجهيز الملف — إعادة المحاولة' : 'مشاركة قائمة المشتريات');
    shareBtn.setAttribute('aria-label', n === 0 ? 'مشاركة قائمة المشتريات (اختر منتجًا أولًا)' : shareLabel.textContent);

    downloadBtn.disabled = !ready;
    downloadBtn.classList.toggle('busy', busy);
    downloadBtn.textContent = busy ? 'جارٍ تجهيز الملف…' : 'تنزيل القائمة PDF';
    if (useShare && shareFailed) downloadBtn.style.flex = '0 1 auto';
    else downloadBtn.style.flex = '';

    var note = '';
    if (SHARE === 'insecure') note = 'المشاركة المباشرة تحتاج فتح التطبيق برابط يبدأ بـ https (الرابط الظاهر في نافذة التشغيل على الكمبيوتر). يمكنك الآن تنزيل الملف وإرساله يدويًا.';
    else if (SHARE === 'no') note = 'هذا المتصفح لا يدعم مشاركة الملفات مباشرة. نزّل الملف ثم أرسله من واتساب أو أي تطبيق آخر.';
    else if (shareFailed) note = 'تعذّر فتح قائمة المشاركة. جرّب مرة أخرى، أو نزّل الملف وأرسله يدويًا.';
    barNote.textContent = note;
    barNote.hidden = !note;
    barNote.classList.toggle('warn', !!note);
    setBarHeight();
  }

  shareBtn.addEventListener('click', function () {
    if (pdf.status === 'error' && pdf.version === version) { schedulePdf(0); return; }
    if (!isReady() || sharing) return;
    var file = pdf.result.file;
    var data = { files: [file], title: 'قائمة المشتريات' };
    var p;
    try {
      if (navigator.canShare && !navigator.canShare(data)) data = { files: [file] };
      sharing = true;
      p = navigator.share(data);            // called directly inside the tap
    } catch (err) {
      sharing = false;
      onShareError(err);
      return;
    }
    Promise.resolve(p).then(function () {
      if (shareFailed) { shareFailed = false; updateShareUI(); }
    }, function (err) {
      var name = err && err.name;
      if (name === 'AbortError' || name === 'InvalidStateError') return;   // sheet closed without sending: keep everything, no error
      onShareError(err);
    }).then(function () { sharing = false; });
  });

  function onShareError(err) {
    console.warn('share failed', err);
    shareFailed = true;
    updateShareUI();
  }

  downloadBtn.addEventListener('click', function () {
    if (!isReady()) return;
    var res = pdf.result;
    var url = URL.createObjectURL(res.blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = res.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    toast('تم تنزيل الملف: ' + res.name);
  });

  // ------------------------------------------------------------ layers (sheet, viewer, preview) + back button
  var layers = [], skipPop = 0;
  function openLayer(el) {
    if (layers.indexOf(el) >= 0) return;
    layers.push(el);
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    try { history.pushState({ jamiyaLayer: layers.length }, ''); } catch (e) { }
    var f = el.querySelector('[data-close]');
    if (f) try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
  }
  function closeTop(fromPop) {
    var el = layers.pop();
    if (!el) return;
    el.hidden = true;
    if (!layers.length) document.body.style.overflow = '';
    if (el === viewer) { viewerId = null; vImgBox.classList.remove('zoomed'); }
    if (el === previewEl) clearPreview();
    if (el === sheet) reviewBtn.focus({ preventScroll: true });
    if (!fromPop) { skipPop++; try { history.back(); } catch (e) { skipPop--; } }
  }
  window.addEventListener('popstate', function () {
    if (skipPop) { skipPop--; return; }
    if (layers.length) closeTop(true);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && layers.length) closeTop(); });

  // ------------------------------------------------------------ review sheet
  function rowEl(it, q) {
    var row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = it.id;
    row.innerHTML = '<button class="thumb" type="button"><img alt="" decoding="async"></button>' +
      '<div><p class="r-name"></p><div class="r-ctrl"></div></div>';
    row.querySelector('img').src = thumbUrl(it);
    row.querySelector('.thumb').setAttribute('aria-label', 'عرض الصورة مكبرة: ' + label(it));
    var nm = row.querySelector('.r-name');
    nm.textContent = glue(label(it));
    nm.classList.toggle('unnamed', !displayName(it));
    row.querySelector('.r-ctrl').innerHTML = ctrlHTML(q);
    return row;
  }

  function renderSheet() {
    var scroll = sheetList.scrollTop;
    sheetList.innerHTML = '';
    var frag = document.createDocumentFragment(), lastCat = null;
    ITEMS.forEach(function (it) {
      var q = cart.get(it.id);
      if (!q) return;
      if (it.cat !== lastCat) {
        lastCat = it.cat;
        var h = document.createElement('h3');
        h.className = 'sheet-cat';
        h.textContent = it.cat;
        frag.appendChild(h);
      }
      frag.appendChild(rowEl(it, q));
    });
    sheetList.appendChild(frag);
    sheetList.scrollTop = scroll;
    sheetEmpty.hidden = cart.size > 0;
    sheetList.hidden = cart.size === 0;
  }

  function syncSheet(ids) {
    var needFull = false;
    ids.forEach(function (id) {
      var row = sheetList.querySelector('.row[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
      var q = cart.get(id) || 0;
      if (row && q) updateStepper(row.querySelector('.r-ctrl'), q);
      else if (row && !q) {
        var prev = row.previousElementSibling, next = row.nextElementSibling;
        row.remove();
        if (prev && prev.classList.contains('sheet-cat') && (!next || next.classList.contains('sheet-cat'))) prev.remove();
      } else if (!row && q) needFull = true;
    });
    if (needFull) renderSheet();
    sheetEmpty.hidden = cart.size > 0;
    sheetList.hidden = cart.size === 0;
  }

  reviewBtn.addEventListener('click', function () {
    if (!sheet.hidden) { closeTop(); return; }
    renderSheet();
    openLayer(sheet);
  });

  clearBtn.addEventListener('click', function () {
    if (!cart.size) return;
    if (!window.confirm('مسح كل المنتجات من القائمة؟')) return;
    var backup = new Map(cart);
    var ids = Array.from(cart.keys());
    cart.clear();
    changed(ids);
    toast('تم مسح القائمة', 'تراجع', function () {
      backup.forEach(function (q, id) { cart.set(id, q); });
      changed(Array.from(backup.keys()));
      if (!sheet.hidden) renderSheet();
    });
  });

  // ------------------------------------------------------------ file preview
  function clearPreview() {
    pvPages.querySelectorAll('img').forEach(function (im) { URL.revokeObjectURL(im.src); });
    pvPages.innerHTML = '';
  }
  function renderPreview() {
    clearPreview();
    if (!isReady()) {
      pvInfo.textContent = cart.size ? 'جارٍ تجهيز الملف…' : 'القائمة فارغة';
      return;
    }
    var res = pdf.result;
    var kb = Math.max(1, Math.round(res.blob.size / 1024));
    pvInfo.textContent = (res.pageCount === 1 ? 'صفحة واحدة' : res.pageCount === 2 ? 'صفحتان' : ar(res.pageCount) + ' صفحات') +
      ' · ' + (kb >= 1024 ? ar((kb / 1024).toFixed(1)) + ' ميجابايت' : ar(kb) + ' كيلوبايت') + ' — هذا ما سيصل للمستلم';
    res.pages.forEach(function (b, i) {
      var im = document.createElement('img');
      im.alt = 'الصفحة ' + ar(i + 1);
      im.src = URL.createObjectURL(b);
      pvPages.appendChild(im);
    });
  }
  previewBtn.addEventListener('click', function () { renderPreview(); openLayer(previewEl); });

  // ------------------------------------------------------------ photo viewer
  var viewerId = null;
  function openViewer(id) {
    var it = byId.get(id);
    if (!it) return;
    viewerId = id;
    vCtrl.dataset.id = id;
    vImgBox.classList.remove('zoomed');
    vImg.src = medUrl(it);
    vImg.alt = label(it);
    fillViewerName(it);
    vNo.textContent = 'صورة رقم ' + ar(it.no);
    if (it.src) vOrig.href = 'src/' + String(it.src).split('/').map(encodeURIComponent).join('/');
    vOrig.hidden = !it.src;          // the published copy does not contain the original screenshots
    vCtrl.innerHTML = ctrlHTML(cart.get(id) || 0);
    openLayer(viewer);
  }
  function fillViewerName(it) {
    vName.textContent = glue(label(it));
    vName.classList.toggle('unnamed', !displayName(it));
  }
  vImg.addEventListener('click', function () { vImgBox.classList.toggle('zoomed'); });

  vRename.addEventListener('click', function () {
    var it = byId.get(viewerId);
    if (!it) return;
    var v = window.prompt('اسم المنتج (اتركه فارغًا لإرجاع الاسم الأصلي):', displayName(it));
    if (v === null) return;
    v = v.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!v || v === (it.name || '').trim()) delete names[it.id]; else names[it.id] = v;
    writeJSON(LS_NAMES, names);
    refreshName(it);
    if (cart.has(it.id)) { version++; schedulePdf(); }
  });

  function refreshName(it) {
    it._hay = null;
    var card = cards.get(it.id);
    if (card) fillName(card, it);
    if (viewerId === it.id) fillViewerName(it);
    if (!sheet.hidden) renderSheet();
    applyFilter();
  }

  // ------------------------------------------------------------ toast
  var toastTimer = 0;
  function toast(msg, actionLabel, action) {
    toastEl.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = msg;
    toastEl.appendChild(span);
    if (actionLabel) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = actionLabel;
      b.addEventListener('click', function () { hideToast(); action(); });
      toastEl.appendChild(b);
    }
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, actionLabel ? 6000 : 3000);
  }
  function hideToast() { toastEl.hidden = true; }

  // ------------------------------------------------------------ other tabs
  window.addEventListener('storage', function (e) {
    if (e.key === LS_CART) {
      var before = Array.from(cart.keys());
      if (loadCart()) saveCart();
      var ids = before.concat(Array.from(cart.keys()));
      version++;
      ids.forEach(function (id) { var el = cards.get(id); if (el) renderCard(el, id); });
      if (!sheet.hidden) renderSheet();
      updateSummary();
      schedulePdf();
    } else if (e.key === LS_NAMES) {
      names = readJSON(LS_NAMES, {}) || {};
      ITEMS.forEach(function (it) { it._hay = null; var c = cards.get(it.id); if (c) fillName(c, it); });
      applyFilter();
      version++;
      schedulePdf();
    }
  });

  // ------------------------------------------------------------ start
  var searchTimer = 0;
  qInput.addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(applyFilter, 120); });
  catSel.addEventListener('change', function () { applyFilter(); window.scrollTo(0, 0); });
  window.addEventListener('resize', setBarHeight);
  if (window.ResizeObserver) { var ro = new ResizeObserver(setBarHeight); ro.observe(barEl); ro.observe(toolsEl); }

  if (loadCart()) saveCart();        // store the list again if merged cards were combined
  buildCatalog();
  applyFilter();
  updateSummary();
  if (cart.size) schedulePdf(0);

  // small hook used by automated tests
  window.__jamiya = {
    state: function () {
      var o = {}; cart.forEach(function (q, id) { o[id] = q; });
      return { version: version, pdfStatus: pdf.status, pdfVersion: pdf.version, ready: isReady(), share: SHARE, cart: o };
    },
    pdf: function () { return pdf.result; },
    setQty: setQty
  };
})();

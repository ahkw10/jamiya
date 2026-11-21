/* قائمة الجمعية — shopping list app (full catalog: sections → groups → packs) */
(function () {
  'use strict';

  // ------------------------------------------------------------ data
  var CORE = window.CATALOG || {};
  var CATS = CORE.cats || [], HEADS = CORE.heads || [], GROUPS = CORE.groups || [];
  var SV = CORE.sv || '0';
  var ALIASES = CORE.aliases || {};
  var byId = new Map();            // id -> {id, g, name, brand, u, v, i}
  var ITEMS = [];                  // every product in catalog order (after catalog-items.js has loaded)
  var groupItems = [];             // group index -> products
  var itemsLoaded = false, itemsFailed = false, whenLoaded = [];
  function addRow(r, brands) {
    var it = byId.get(r[0]);
    if (!it) { it = { id: r[0] }; byId.set(r[0], it); }
    it.g = r[1]; it.name = r[2]; it.brand = brands && r[3] >= 0 ? brands[r[3]] : (it.brand || ''); it.u = r[4]; it.v = r[5];
    return it;
  }
  (CORE.usual || []).forEach(function (r) { addRow(r, null); });
  GROUPS.forEach(function (g) { if (g[5]) addRow(g[5], null); });     // single-pack groups ship their pack with the core file

  var LS_CART = 'jamiya.cart.v1';
  var LS_NAMES = 'jamiya.names.v1';
  var MAX_QTY = 99;
  var AR = '٠١٢٣٤٥٦٧٨٩';
  var TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"/></svg>';

  function $(sel) { return document.querySelector(sel); }
  function ar(n) { return String(n).replace(/[0-9]/g, function (d) { return AR[+d]; }); }
  function thumbUrl(it) { return it.v ? 'img/t/' + encodeURIComponent(it.id) + '.jpg?v=' + it.v : 'img/s/' + encodeURIComponent(it.id) + '.jpg?v=' + SV; }
  function medUrl(it) { return it.v ? 'img/m/' + encodeURIComponent(it.id) + '.jpg?v=' + it.v : 'img/s/' + encodeURIComponent(it.id) + '.jpg?v=' + SV; }
  function cssId(id) { return window.CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/["\\]/g, '\\$&'); }
  function groupOf(it) { return GROUPS[it.g] || null; }
  function catOfGroup(gi) { var g = GROUPS[gi]; return g ? HEADS[g[1]][0] : -1; }

  function loadItems() {
    if (itemsLoaded || loadItems.started) return;
    loadItems.started = true;
    var s = document.createElement('script');
    s.src = CORE.itemsUrl || 'catalog-items.js';
    s.async = true;
    s.onload = function () {
      var data = window.CATALOG_ITEMS || { items: [], brands: [] };
      groupItems = GROUPS.map(function () { return []; });
      data.items.forEach(function (r, i) { var it = addRow(r, data.brands); it.i = i; ITEMS.push(it); if (groupItems[it.g]) groupItems[it.g].push(it); });
      itemsLoaded = true;
      window.CATALOG_ITEMS = null;
      var cbs = whenLoaded; whenLoaded = [];
      cbs.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
    };
    s.onerror = function () { itemsFailed = true; loadItems.started = false; toast('تعذّر تحميل قائمة المنتجات. تحقّق من الاتصال ثم أعد المحاولة.'); };
    document.head.appendChild(s);
  }
  function afterItems(f) { if (itemsLoaded) f(); else { whenLoaded.push(f); loadItems(); } }

  // ------------------------------------------------------------ storage (never throws)
  function readJSON(key, def) {
    try { var raw = window.localStorage.getItem(key); if (!raw) return def; var v = JSON.parse(raw); return v == null ? def : v; } catch (e) { return def; }
  }
  function writeJSON(key, val) { try { window.localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }

  var cart = new Map();            // id -> qty (ids not yet known stay until the product list has loaded)
  var version = 0;
  function canonical(id) {
    var guard = 0;
    while (Object.prototype.hasOwnProperty.call(ALIASES, id) && guard++ < 20) id = ALIASES[id];
    return id;
  }
  var names = readJSON(LS_NAMES, {});
  if (!names || typeof names !== 'object') names = {};
  (function migrateNames() {
    var moved = false;
    Object.keys(names).forEach(function (id) { var c = canonical(id); if (c !== id) { if (!names[c]) names[c] = names[id]; delete names[id]; moved = true; } });
    if (moved) writeJSON(LS_NAMES, names);
  })();
  var storageWarned = false;

  function loadCart() {
    cart.clear();
    var data = readJSON(LS_CART, null), items = data && data.items, merged = false;
    if (items && typeof items === 'object') {
      Object.keys(items).forEach(function (id) {
        var q = Math.floor(Number(items[id])), c = canonical(id);
        if (c !== id) merged = true;
        if (q > 0) cart.set(c, Math.min((cart.get(c) || 0) + q, MAX_QTY));
      });
    }
    return merged;
  }
  function pruneCart() {        // after the product list has loaded: forget ids that no longer exist
    var gone = [];
    cart.forEach(function (q, id) { if (!byId.has(id) || byId.get(id).g == null) gone.push(id); });
    gone.forEach(function (id) { cart.delete(id); });
    if (gone.length) saveCart();
    return gone.length;
  }
  function saveCart() {
    var obj = {};
    cart.forEach(function (q, id) { obj[id] = q; });
    var ok = writeJSON(LS_CART, { v: 1, savedAt: Date.now(), items: obj });
    if (!ok && !storageWarned) { storageWarned = true; toast('تعذّر حفظ القائمة على هذا الجهاز (التخزين معطّل). ستبقى ما دامت الصفحة مفتوحة.'); }
  }

  function displayName(it) { var n = names[it.id]; if (typeof n === 'string' && n.trim()) return n.trim(); return (it.name || '').trim(); }
  function label(it) { return displayName(it) || 'منتج'; }
  function glue(s) {
    return String(s).replace(/(\d[\d.,×x]*)\s+(?=(?:كجم|كغم|كغ|كيلو|غ|غم|جم|جرام|غرام|مل|لتر|قطعة|قطع|حبة|حبات|رول|رولات|كيس|قرص|جالون|شريحة|ورقة|منديل|فوطة|ظرف|كبسولة)(?:$|[\s)،,]))/g, '$1 ');
  }
  function countItems(n) { return n === 1 ? 'صنف واحد' : n === 2 ? 'صنفان' : n <= 10 ? ar(n) + ' أصناف' : ar(n) + ' صنفًا'; }
  function countPieces(n) { return n === 1 ? 'قطعة واحدة' : n === 2 ? 'قطعتان' : n <= 10 ? ar(n) + ' قطع' : ar(n) + ' قطعة'; }
  function countOptions(n) { return n === 1 ? 'نوع واحد' : n === 2 ? 'نوعان' : n <= 10 ? ar(n) + ' أنواع' : ar(n) + ' نوعًا'; }
  function countGroups(n) { return n === 1 ? 'مجموعة واحدة' : n === 2 ? 'مجموعتان' : n <= 10 ? ar(n) + ' مجموعات' : ar(n) + ' مجموعة'; }
  function countProducts(n) { return n === 1 ? 'منتج واحد' : n === 2 ? 'منتجان' : n <= 10 ? ar(n) + ' منتجات' : ar(n) + ' منتجًا'; }

  // ------------------------------------------------------------ text matching
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[ً-ْٰـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/ظ/g, 'ض')
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(/[×*]/g, 'x')
      .replace(/\s+/g, ' ').trim();
  }
  var SYN = {
    'حفايض': ['حفاض'], 'عيش': ['ارز'], 'رز': ['ارز'], 'روب': ['زبادي'], 'ماي': ['مياه'], 'ماء': ['مياه'],
    'محارم': ['مناديل'], 'طماطه': ['طماطم'], 'بندوره': ['طماطم'], 'كلينيكس': ['كلينكس'], 'كلوركس': ['مبيض'],
    'معكرونه': ['مكرونه'], 'مكرونه': ['معكرونه'], 'كاتشاب': ['كاتشب'], 'مايونيز': ['مايونيز', 'مايونيس'], 'صابونه': ['صابون'],
    'جبس': ['شيبس'], 'شيبسي': ['شيبس'], 'ايسكريم': ['ايس'], 'بوضه': ['ايس'], 'بسكوت': ['بسكويت'], 'عصاير': ['عصير'],
    'شوكلت': ['شوكولاته'], 'تمر': ['تمور'], 'تمور': ['تمر']
  };
  var PROCL = ['وبال', 'وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و', 'ب', 'ل', 'ف', 'ك'];
  function toks(s) { return norm(s).replace(/(\d)x(\d)/g, '$1 x $2').split(/[\s\-–—_()[\]{},،؛:+\/\\|"'«»!?؟]+/).filter(Boolean); }
  function stripP(t) {
    for (var i = 0; i < PROCL.length; i++) { var p = PROCL[i]; if (t.length - p.length >= 2 && t.lastIndexOf(p, 0) === 0) return t.slice(p.length); }
    return t;
  }
  function prep(it) {
    if (it._tok) return;
    var gname = groupOf(it) ? GROUPS[it.g][0] : '';
    it._tok = toks(label(it));
    it._tokS = it._tok.map(stripP);
    it._gtok = toks(gname);
  }
  function termScore(it, alts) {
    var best = 0;
    for (var a = 0; a < alts.length; a++) {
      var q = alts[a], num = /^[\d.]+$/.test(q);
      for (var i = 0; i < it._tok.length; i++) {
        var t = it._tok[i], st = it._tokS[i], s = 0, e;
        if (t === q) return 4;
        if (t.lastIndexOf(q, 0) === 0) { e = t.length - q.length; s = num ? 1 : e <= 1 ? 3 : e === 2 ? 2.6 : 2.2; }
        else if (st !== t && st === q) s = 3.5;
        else if (st !== t && !num && st.lastIndexOf(q, 0) === 0) { e = st.length - q.length; s = e <= 1 ? 2.7 : e === 2 ? 2.3 : 2; }
        else if (t.indexOf(q) >= 0) s = 1;
        if (s > best) best = s;
      }
      for (var j = 0; j < it._gtok.length; j++) if (it._gtok[j] === q || stripP(it._gtok[j]) === q) best = Math.max(best, 3);
    }
    return best;
  }
  function altsOf(terms) { return terms.map(function (t) { var s = SYN[t] || []; return [t].concat(s.filter(function (x) { return x !== t; })); }); }
  // products that match every word; whole words first, look-alikes dropped when the word itself was found
  function searchItems(list, q) {
    var terms = toks(q);
    if (!terms.length) return null;
    var alts = altsOf(terms), rows = [], maxPer = terms.map(function () { return 0; });
    for (var k = 0; k < list.length; k++) {
      var it = list[k];
      prep(it);
      var ss = [], ok = true;
      for (var i = 0; i < alts.length; i++) { var s = termScore(it, alts[i]); if (!s) { ok = false; break; } ss.push(s); if (s > maxPer[i]) maxPer[i] = s; }
      if (ok) rows.push([it, ss]);
    }
    var out = [];
    rows.forEach(function (r) {
      var sum = 0;
      for (var i = 0; i < r[1].length; i++) {
        var limit = maxPer[i] >= 3.5 ? 2.5 : maxPer[i] >= 2.5 ? 2 : 0;
        if (r[1][i] < limit) return;
        sum += r[1][i];
      }
      out.push({ it: r[0], s: sum });
    });
    out.sort(function (a, b) { return b.s - a.s || (b.it.u || 0) - (a.it.u || 0) || (a.it.i || 0) - (b.it.i || 0); });
    return out;
  }

  // ------------------------------------------------------------ elements
  var viewEl = $('#view'), chipsEl = $('#chips'), headsEl = $('#heads'), qInput = $('#q'), qClear = $('#qClear'), emptyEl = $('#empty');
  var toolsEl = $('#tools'), barEl = $('#bar'), barNote = $('#barNote');
  var shareBtn = $('#shareBtn'), shareLabel = $('#shareLabel'), downloadBtn = $('#downloadBtn');
  var reviewBtn = $('#reviewBtn'), rbCount = $('#rbCount');
  var sheet = $('#sheet'), sheetList = $('#sheetList'), sheetEmpty = $('#sheetEmpty'), sheetSummary = $('#sheetSummary');
  var clearBtn = $('#clearBtn'), previewBtn = $('#previewBtn');
  var gsheet = $('#gsheet'), gTitle = $('#gTitle'), gSub = $('#gSub'), gSearchBox = $('#gSearchBox'), gq = $('#gq'), gFacets = $('#gFacets'), gList = $('#gList'), gTools = $('#gTools');
  var viewer = $('#viewer'), vImg = $('#vImg'), vImgBox = $('#vImgBox'), vName = $('#vName'), vNo = $('#vNo'), vCtrl = $('#vCtrl'), vRename = $('#vRename'), vGroup = $('#vGroup');
  var previewEl = $('#preview'), pvPages = $('#pvPages'), pvInfo = $('#pvInfo');
  var toastEl = $('#toast');

  // ------------------------------------------------------------ controls (shared by cards, rows, viewer)
  function ctrlHTML(q) {
    if (!q) return '<button type="button" class="add" data-act="add">إضافة</button>';
    return '<div class="stepper" role="group" aria-label="الكمية">' +
      '<button type="button" data-act="inc" aria-label="زيادة الكمية">+</button>' +
      '<output aria-live="polite">' + ar(q) + '</output>' +
      '<button type="button" data-act="dec" aria-label="' + (q === 1 ? 'إزالة من القائمة' : 'إنقاص الكمية') + '">' + (q === 1 ? TRASH : '−') + '</button></div>';
  }
  function updateStepper(container, q) {
    var step = container.querySelector('.stepper');
    if (q && step) {
      step.querySelector('output').textContent = ar(q);
      var dec = step.querySelector('[data-act="dec"]'), wantTrash = q === 1, isTrash = !!dec.querySelector('svg');
      if (wantTrash !== isTrash) { dec.innerHTML = wantTrash ? TRASH : '−'; dec.setAttribute('aria-label', wantTrash ? 'إزالة من القائمة' : 'إنقاص الكمية'); }
      return;
    }
    container.innerHTML = ctrlHTML(q);
  }
  function refreshItemEls(id) {
    var q = cart.get(id) || 0, sel = '[data-id="' + cssId(id) + '"]';
    document.querySelectorAll(sel).forEach(function (el) {
      el.classList.toggle('selected', q > 0);
      var badge = el.querySelector('.qty-badge'); if (badge) badge.textContent = q ? ar(q) : '';
      var c = el.classList.contains('viewer-ctrl') ? el : el.querySelector('.ctrl, .r-ctrl'); if (c) updateStepper(c, q);
    });
    var it = byId.get(id);
    if (it && it.g != null) refreshGroupCard(it.g);
  }
  function groupSelected(gi) {        // packs of this group in the list
    var n = 0, pcs = 0;
    cart.forEach(function (q, id) { var it = byId.get(id); if (it && it.g === gi) { n++; pcs += q; } });
    return { n: n, pcs: pcs };
  }
  function refreshGroupCard(gi) {
    document.querySelectorAll('.gcard[data-g="' + gi + '"]').forEach(function (el) {
      var s = groupSelected(gi), b = el.querySelector('.gsel');
      el.classList.toggle('selected', s.n > 0);
      if (b) b.textContent = s.n ? (s.n === 1 ? '✓ ' + ar(s.pcs) : '✓ ' + countOptions(s.n)) : '';
    });
  }

  // product card (usual view, single-pack groups)
  function productCard(it) {
    var el = document.createElement('article');
    el.className = 'card';
    el.dataset.id = it.id;
    el.innerHTML = '<button class="pic" type="button"><img alt="" loading="lazy" decoding="async" width="480" height="480"></button>' +
      '<span class="qty-badge" aria-hidden="true"></span><h3 class="name"></h3><div class="ctrl"></div>';
    el.querySelector('img').src = thumbUrl(it);
    el.querySelector('.name').textContent = glue(label(it));
    el.querySelector('.pic').setAttribute('aria-label', 'عرض الصورة مكبرة: ' + label(it));
    var q = cart.get(it.id) || 0;
    el.classList.toggle('selected', q > 0);
    el.querySelector('.qty-badge').textContent = q ? ar(q) : '';
    el.querySelector('.ctrl').innerHTML = ctrlHTML(q);
    return el;
  }
  // row (options sheet, search results, my list); withGroup = link to every pack of the same type (search results)
  function rowEl(it, withGroup) {
    var row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = it.id;
    var g = groupOf(it), link = withGroup && g && g[3] > 1;
    row.innerHTML = '<button class="thumb" type="button"><img alt="" loading="lazy" decoding="async"></button>' +
      '<div><p class="r-name"></p>' + (link ? '<button type="button" class="r-group"></button>' : withGroup && g ? '<p class="r-sub"></p>' : '') +
      '<div class="r-ctrl"></div></div>';
    row.querySelector('img').src = thumbUrl(it);
    row.querySelector('.thumb').setAttribute('aria-label', 'عرض الصورة مكبرة: ' + label(it));
    row.querySelector('.r-name').textContent = glue(label(it));
    if (it.u > 0) { var tag = document.createElement('span'); tag.className = 'u-tag'; tag.textContent = 'معتاد'; row.querySelector('.r-name').appendChild(tag); }
    if (link) { var lb = row.querySelector('.r-group'); lb.dataset.g = it.g; lb.textContent = 'كل أنواع ' + g[0] + ' (' + ar(g[3]) + ') ‹'; }
    else if (withGroup && g) row.querySelector('.r-sub').textContent = CATS[HEADS[g[1]][0]] || '';
    var q = cart.get(it.id) || 0;
    row.classList.toggle('selected', q > 0);
    row.querySelector('.r-ctrl').innerHTML = ctrlHTML(q);
    return row;
  }
  // group card: one per product type; tap = all its packs
  function groupCard(gi) {
    var g = GROUPS[gi];
    if (g[3] === 1 && byId.has(g[2])) { var single = productCard(byId.get(g[2])); single.classList.add('single'); return single; }
    var el = document.createElement('article');
    el.className = 'gcard';
    el.dataset.g = gi;
    el.innerHTML = '<button class="gopen" type="button"><span class="gpic"><img alt="" loading="lazy" decoding="async" width="288" height="288"></span>' +
      '<span class="gname"></span><span class="gcount"></span></button><span class="gsel" aria-hidden="true"></span>';
    var rep = byId.get(g[2]) || { id: g[2], v: '' };
    el.querySelector('img').src = thumbUrl(rep);
    el.querySelector('.gname').textContent = g[0];
    el.querySelector('.gcount').textContent = countOptions(g[3]);
    el.querySelector('.gopen').setAttribute('aria-label', g[0] + '، ' + countOptions(g[3]) + ' — عرض الأنواع');
    var s = groupSelected(gi);
    if (s.n) { el.classList.add('selected'); el.querySelector('.gsel').textContent = s.n === 1 ? '✓ ' + ar(s.pcs) : '✓ ' + countOptions(s.n); }
    return el;
  }

  // ------------------------------------------------------------ views
  var curView = 'usual';          // 'usual' | section index
  var chips = [];
  function buildChips() {
    var all = [['usual', 'المعتاد']].concat(CATS.map(function (c, i) { return [i, c]; }));
    all.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.view = c[0]; b.textContent = c[1];
      chipsEl.appendChild(b); chips.push(b);
    });
  }
  function markChips() {
    chips.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view) === String(curView) ? 'true' : 'false'); });
  }
  function centerChip(bar, chip) {      // scroll a chip row sideways so the chip is visible (works in RTL)
    if (!bar || !chip) return;
    var r = chip.getBoundingClientRect(), p = bar.getBoundingClientRect();
    if (r.left >= p.left + 8 && r.right <= p.right - 8) return;
    var delta = (r.left + r.width / 2) - (p.left + p.width / 2);
    try { bar.scrollBy({ left: delta, behavior: 'smooth' }); } catch (e) { bar.scrollLeft += delta; }
  }
  function showView(v, keepScroll) {
    curView = v;
    markChips();
    centerChip(chipsEl, chips.filter(function (b) { return String(b.dataset.view) === String(v); })[0]);
    if (qInput.value.trim()) { renderSearch(); return; }
    render();
    if (!keepScroll) window.scrollTo(0, 0);
  }
  var DEFAULT_SUB = '';
  function render() {
    viewEl.innerHTML = '';
    headsEl.innerHTML = ''; headsEl.hidden = true;
    emptyEl.hidden = true;
    if (curView === 'usual') renderUsual(); else renderSection(+curView);
    headsEl.hidden = headsEl.children.length < 2;
    spy.last = null;
    setBarHeight();
    spy();
  }
  function sectionTitle(text, count) {
    var h = document.createElement('h2'); h.className = 'sec-h';
    var t = document.createElement('span'); t.textContent = text;
    h.appendChild(t);
    if (count != null) { var s = document.createElement('small'); s.textContent = count; h.appendChild(s); }
    return h;
  }
  function jumpChip(target, text) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.target = target; b.textContent = text;
    headsEl.appendChild(b);
  }
  // usual products: per section the most often bought first (3 per row); the rest of the section one tap away
  var usualOpen = new Set(), USUAL_FIRST = 6;
  function renderUsual() {
    $('#subtitle').textContent = DEFAULT_SUB;
    var list = (CORE.usual || []).map(function (r, i) { var it = byId.get(r[0]); it._uo = i; return it; });
    var intro = document.createElement('p'); intro.className = 'hint';
    intro.textContent = 'منتجاتكم المعتادة من مشترياتكم السابقة، الأكثر شراءً أولًا. لبقية الأنواع اختر قسمًا من الشريط أعلاه أو اكتب في البحث.';
    viewEl.appendChild(intro);
    var byCat = new Map();
    list.forEach(function (it) { var c = catOfGroup(it.g); if (!byCat.has(c)) byCat.set(c, []); byCat.get(c).push(it); });
    var frag = document.createDocumentFragment();
    CATS.forEach(function (c, ci) {
      var its = byCat.get(ci); if (!its || !its.length) return;
      its.sort(function (a, b) { return (b.u || 0) - (a.u || 0) || a._uo - b._uo; });
      var open = usualOpen.has(ci) || its.length <= USUAL_FIRST + 3;
      var sec = document.createElement('section'); sec.className = 'sec'; sec.id = 'u' + ci;
      sec.appendChild(sectionTitle(c, ar(its.length)));
      var grid = document.createElement('div'); grid.className = 'ggrid';
      (open ? its : its.slice(0, USUAL_FIRST)).forEach(function (it) { grid.appendChild(productCard(it)); });
      sec.appendChild(grid);
      if (its.length > USUAL_FIRST + 3) {
        var more = document.createElement('button'); more.type = 'button'; more.className = 'add more'; more.dataset.act = 'umore'; more.dataset.cat = ci;
        more.textContent = open ? 'عرض أقل' : 'بقية المعتاد في ' + c + ' (' + ar(its.length - USUAL_FIRST) + ')';
        sec.appendChild(more);
      }
      frag.appendChild(sec);
    });
    viewEl.appendChild(frag);
  }
  function renderSection(ci) {
    var heads = [];
    HEADS.forEach(function (h, hi) { if (h[0] === ci) heads.push(hi); });
    var byHead = new Map();
    GROUPS.forEach(function (g, gi) { if (heads.indexOf(g[1]) >= 0) { if (!byHead.has(g[1])) byHead.set(g[1], []); byHead.get(g[1]).push(gi); } });
    var frag = document.createDocumentFragment(), total = 0, ngroups = 0;
    heads.forEach(function (hi) {
      var gs = byHead.get(hi) || []; if (!gs.length) return;
      var n = gs.reduce(function (a, gi) { return a + GROUPS[gi][3]; }, 0); total += n; ngroups += gs.length;
      var sec = document.createElement('section'); sec.className = 'sec'; sec.id = 'h' + hi;
      sec.appendChild(sectionTitle(HEADS[hi][1], countProducts(n)));
      var grid = document.createElement('div'); grid.className = 'ggrid';
      gs.forEach(function (gi) { grid.appendChild(groupCard(gi)); });
      sec.appendChild(grid); frag.appendChild(sec);
      jumpChip('h' + hi, HEADS[hi][1]);
    });
    viewEl.appendChild(frag);
    $('#subtitle').textContent = CATS[ci] + ': ' + countProducts(total) + ' في ' + countGroups(ngroups) + '. اضغط على النوع لترى كل عبواته.';
  }
  // the sub-section chip of the part on screen stays highlighted while scrolling
  var spyRaf = 0;
  function spy() {
    spyRaf = 0;
    if (headsEl.hidden) return;
    var limit = toolsEl.getBoundingClientRect().bottom + 24, cur = null, btns = headsEl.children;
    for (var i = 0; i < btns.length; i++) {
      var sec = document.getElementById(btns[i].dataset.target);
      if (sec && sec.getBoundingClientRect().top <= limit) cur = btns[i]; else if (sec) break;
    }
    cur = cur || btns[0];
    for (var j = 0; j < btns.length; j++) btns[j].setAttribute('aria-pressed', btns[j] === cur ? 'true' : 'false');
    if (cur !== spy.last) { spy.last = cur; centerChip(headsEl, cur); }
  }
  window.addEventListener('scroll', function () { if (!spyRaf) spyRaf = requestAnimationFrame(spy); }, { passive: true });

  // ------------------------------------------------------------ search (whole catalog)
  var searchTimer = 0, searchLimit = 60, lastResults = null;
  function renderSearch() {
    var q = qInput.value.trim();
    qClear.hidden = !qInput.value;
    if (!q) { render(); return; }
    headsEl.hidden = true;
    if (!itemsLoaded) {
      var pool = Array.from(byId.values()).filter(function (it) { return it.g != null; });
      showResults(q, searchItems(pool, q), true);
      afterItems(function () { if (qInput.value.trim() === q) renderSearch(); });
      return;
    }
    showResults(q, searchItems(ITEMS, q), false);
  }
  function showResults(q, res, partial) {
    lastResults = res;
    viewEl.innerHTML = '';
    emptyEl.hidden = true;
    var gscore = new Map();
    (res || []).slice(0, 400).forEach(function (r) { gscore.set(r.it.g, (gscore.get(r.it.g) || 0) + r.s); });
    var gs = Array.from(gscore.keys()).sort(function (a, b) { return gscore.get(b) - gscore.get(a); }).slice(0, 8);
    if (gs.length > 1) {
      var box = document.createElement('div'); box.className = 'rgroups';
      var t = document.createElement('p'); t.className = 'hint'; t.textContent = 'الأنواع المطابقة:'; box.appendChild(t);
      gs.forEach(function (gi) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.g = gi;
        b.innerHTML = '<span></span><span class="chip-n"></span>';
        b.firstChild.textContent = GROUPS[gi][0]; b.lastChild.textContent = ar(GROUPS[gi][3]);
        box.appendChild(b);
      });
      viewEl.appendChild(box);
    }
    var n = res ? res.length : 0;
    var head = document.createElement('p'); head.className = 'hint';
    head.textContent = partial ? 'جارٍ تحميل كل المنتجات… النتائج من المنتجات المعتادة حتى الآن.' : (n ? countProducts(n) + ' مطابقة لـ «' + q + '»' : '');
    viewEl.appendChild(head);
    if (!n) {
      emptyEl.innerHTML = '';
      var p = document.createElement('p'); p.textContent = partial ? '' : 'لا توجد منتجات مطابقة لـ «' + q + '». جرّب كلمة أخرى أو اسم العلامة.';
      emptyEl.appendChild(p); emptyEl.hidden = partial;
      return;
    }
    var list = document.createElement('div'); list.className = 'rlist';
    res.slice(0, searchLimit).forEach(function (r) { list.appendChild(rowEl(r.it, true)); });
    viewEl.appendChild(list);
    if (n > searchLimit) {
      var more = document.createElement('button'); more.type = 'button'; more.className = 'add more'; more.dataset.act = 'more';
      more.textContent = 'عرض المزيد (' + ar(n - searchLimit) + ')';
      viewEl.appendChild(more);
    }
  }

  // ------------------------------------------------------------ options sheet (one group)
  var gState = null;               // {gi, items, facets, sel, text, base, shown, focus}
  // words that never become a filter on their own (units, fillers) and words that only make sense inside a phrase
  var STOP = new Set(['من', 'في', 'على', 'او', 'حجم', 'عبوه', 'عبوات', 'قطعه', 'قطع', 'حبه', 'حبات', 'غ', 'غم', 'جم', 'كجم', 'مل', 'لتر', 'كيس', 'اكياس',
    'رول', 'رولات', 'ظرف', 'منديل', 'مناديل', 'فوطه', 'x', 'كبسوله', 'ملغ', 'سم', 'م', 'وزن', 'تقريبا', 'حوالي', 'عرض', 'خاص', 'مجانا', 'جديد', 'علبه',
    'مقاس', 'مرحله', 'المرحله', 'و', 'عدد', 'قطعتين', 'عبوتين', 'حبتين', 'اند', 'ذا', 'دي', 'لا', 'ال', 'او', 'بال']);
  var WEAK = new Set(['مع', 'بدون', 'قليل', 'خالي', 'خال', 'كامل', 'منزوع', 'نكهه', 'بنكهه', 'طعم', 'بطعم', 'نوع', 'لون', 'عالي', 'منخفض', 'غني', 'اكثر', 'اقل', 'ال']);
  var UNIT = 'كجم|كغ|غم|غ|جم|ملغ|مل|لتر|قطعة|قطع|حبة|حبات|رول|رولات|كيس|أكياس|منديل|مناديل|فوطة|فوط|ظرف|ظروف|كبسولة|كبسولات|شريحة|شرائح|ورقة|عبوة|عبوات|علبة|علب|قرص|أقراص|جالون|متر|م|سم|بيضة|بيضات|لوح|أصابع|إصبع';
  var SIZE_RE = new RegExp('(?:\\d+(?:[.,]\\d+)?\\s*[×x]\\s*)?\\d+(?:[.,]\\d+)?\\s*(?:' + UNIT + ')(?![\\u0621-\\u064A])');
  var FIT_RE = /مقاس\s*(\d+\s*\+?|[A-Za-z]{1,4}\b)/;
  var STAGE_RE = /(?:المرحلة|مرحلة)\s*(\d+\s*\+?)/;
  function sizeOf(name) { var m = String(name).match(SIZE_RE); return m ? m[0].replace(/\s+/g, ' ').replace(/\s*[x×]\s*/, '×') : ''; }
  function fitOf(name) { var m = String(name).match(FIT_RE); return m ? 'مقاس ' + m[1].replace(/\s+/g, '') : ''; }
  function stageOf(name) { var m = String(name).match(STAGE_RE); return m ? 'مرحلة ' + m[1].replace(/\s+/g, '') : ''; }
  function featWords(it) {      // [normalized, original] words of the name without its size
    var l = label(it);
    if (it._fw && it._fwl === l) return it._fw;
    it._fwl = l;
    it._fw = l.replace(SIZE_RE, ' ').replace(FIT_RE, ' ').replace(STAGE_RE, ' ').split(/[\s\-–—()[\]،,.+\/]+/).filter(Boolean)
      .map(function (w) { return [norm(w), w]; });
    return it._fw;
  }
  function hasPhrase(ws, phrase) {
    var f = phrase.split(' ');
    for (var i = 0; i + f.length <= ws.length; i++) {
      var ok = true;
      for (var j = 0; j < f.length; j++) if (ws[i + j][0] !== f[j]) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }
  function facetValue(it, key) {
    if (key === 'brand') return it.brand || '';
    if (key === 'size') return sizeOf(label(it));
    if (key === 'fit') return fitOf(label(it));
    if (key === 'stage') return stageOf(label(it));
    return '';
  }
  function itemMatches(it, sel, skip) {
    for (var k in sel) {
      if (!sel[k] || k === skip) continue;
      if (k === 'feat') { if (!hasPhrase(featWords(it), sel[k])) return false; }
      else if (facetValue(it, k) !== sel[k]) return false;
    }
    return true;
  }
  function tally(items, key) {
    var m = new Map();
    items.forEach(function (it) { var v = facetValue(it, key); if (v) m.set(v, (m.get(v) || 0) + 1); });
    return Array.from(m.entries());
  }
  function numOf(s) { var m = String(s).match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : 0; }
  // filters that split this type into what changes the decision: size/stage, brand, kind (words shared by part of the
  // packs, e.g. «أحمر», «بدون بذور», «كامل الدسم»), pack size. Computed from the names, so every section gets its own.
  function facetsFor(items, gname) {
    var out = [], n = items.length;
    if (n < 4) return out;
    var fits = tally(items, 'fit').sort(function (a, b) { return numOf(a[0]) - numOf(b[0]) || a[0].localeCompare(b[0]); });
    if (fits.length >= 2) out.push({ key: 'fit', title: 'المقاس', values: fits.map(function (e) { return [e[0], e[0]]; }) });
    var stages = tally(items, 'stage').sort(function (a, b) { return numOf(a[0]) - numOf(b[0]); });
    if (stages.length >= 2) out.push({ key: 'stage', title: 'المرحلة', values: stages.map(function (e) { return [e[0], e[0]]; }) });
    var brands = tally(items, 'brand').sort(function (a, b) { return b[1] - a[1]; });
    if (brands.length >= 2 && n >= 5) out.push({ key: 'brand', title: 'العلامة', values: brands.slice(0, 24).map(function (e) { return [e[0], e[0]]; }) });
    // kind
    var skip = new Set();
    toks(gname).forEach(function (w) { skip.add(w); skip.add(stripP(w)); });
    items.forEach(function (it) { if (it.brand) toks(it.brand).forEach(function (w) { skip.add(w); }); });
    var cnt = new Map(), orig = new Map();
    items.forEach(function (it) {
      var ws = featWords(it).map(function (p) {
        var t = p[0];
        return !t || t.length < 2 || /\d/.test(t) || STOP.has(t) || skip.has(t) || skip.has(stripP(t)) ? null : p;
      });
      var seen = new Set();
      for (var i = 0; i < ws.length; i++) {
        if (!ws[i]) continue;
        var add = function (k, o) { if (seen.has(k)) return; seen.add(k); cnt.set(k, (cnt.get(k) || 0) + 1); if (!orig.has(k)) orig.set(k, o); };
        if (!WEAK.has(ws[i][0]) && ws[i][0].length >= 3) add(ws[i][0], ws[i][1]);      // a lone 2-letter word is a fragment, not a kind
        if (ws[i + 1]) add(ws[i][0] + ' ' + ws[i + 1][0], ws[i][1] + ' ' + ws[i + 1][1]);
      }
    });
    var cands = Array.from(cnt.entries()).filter(function (e) { return e[1] >= 2 && e[1] >= n * 0.05 && e[1] <= n * 0.85; })
      .sort(function (a, b) { return b[1] - a[1] || b[0].length - a[0].length; });
    var picked = [];
    cands.forEach(function (e) {
      if (picked.length >= 14) return;
      var dup = picked.some(function (p) {        // a phrase and its own word on the same packs: keep the one that says more
        var inside = (' ' + p[0] + ' ').indexOf(' ' + e[0] + ' ') >= 0 || (' ' + e[0] + ' ').indexOf(' ' + p[0] + ' ') >= 0;
        return inside && Math.abs(p[1] - e[1]) <= Math.max(1, Math.round(Math.max(p[1], e[1]) * 0.25));
      });
      if (!dup) picked.push(e);
    });
    if (picked.length >= 2 && n >= 6) out.push({ key: 'feat', title: 'النوع', values: picked.map(function (e) { return [e[0], orig.get(e[0])]; }) });
    var sizes = tally(items, 'size').sort(function (a, b) { return b[1] - a[1]; });
    var covered = sizes.reduce(function (a, e) { return a + e[1]; }, 0);
    if (sizes.length >= 2 && covered >= n * 0.3) out.push({ key: 'size', title: 'الحجم', values: sizes.slice(0, 16).map(function (e) { return [e[0], e[0]]; }) });
    return out.slice(0, 4);
  }
  function openGroup(gi, focusId) {
    var g = GROUPS[gi]; if (!g) return;
    gState = { gi: gi, items: [], facets: [], sel: {}, text: '', base: [], shown: 0, focus: focusId || null };
    gTitle.textContent = g[0];
    gSub.textContent = countOptions(g[3]) + ' · ' + CATS[HEADS[g[1]][0]];
    gFacets.innerHTML = '';
    gq.value = '';
    gSearchBox.hidden = g[3] < 15;
    gTools.hidden = gSearchBox.hidden;
    gList.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
    if (gsheet.hidden) openLayer(gsheet);
    gList.scrollTop = 0;
    afterItems(function () {
      if (!gState || gState.gi !== gi) return;
      gState.items = groupItems[gi] || [];
      gState.facets = facetsFor(gState.items, g[0]);
      gTools.hidden = gSearchBox.hidden && !gState.facets.length;
      renderGroupList(true);
    });
  }
  function renderFacets() {
    gFacets.innerHTML = '';
    var base = gState.base;
    gState.facets.forEach(function (f) {
      var row = document.createElement('div'); row.className = 'chips frow';
      row.setAttribute('role', 'group'); row.setAttribute('aria-label', f.title);
      var t = document.createElement('span'); t.className = 'ftitle'; t.textContent = f.title; row.appendChild(t);
      var others = base.filter(function (it) { return itemMatches(it, gState.sel, f.key); });
      f.values.forEach(function (v) {
        var c = 0;
        for (var i = 0; i < others.length; i++) if (f.key === 'feat' ? hasPhrase(featWords(others[i]), v[0]) : facetValue(others[i], f.key) === v[0]) c++;
        var on = gState.sel[f.key] === v[0];
        var b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (c || on ? '' : ' zero');
        b.dataset.fkey = f.key; b.dataset.fval = v[0];
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.innerHTML = '<span></span><span class="chip-n"></span>';
        b.firstChild.textContent = glue(v[1]); b.lastChild.textContent = ar(c);
        row.appendChild(b);
      });
      gFacets.appendChild(row);
    });
    gFacets.querySelectorAll('.chip[aria-pressed="true"]').forEach(function (b) { var r = b.parentNode, x = b.getBoundingClientRect(), p = r.getBoundingClientRect(); r.scrollLeft += (x.left + x.width / 2) - (p.left + p.width / 2); });
  }
  function filteredGroupItems() {
    var r = gState.text ? searchItems(gState.items, gState.text) : null;
    gState.base = r ? r.map(function (x) { return x.it; }) : gState.items;
    return gState.base.filter(function (it) { return itemMatches(it, gState.sel); });
  }
  function renderGroupList(reset) {
    var list = reset ? (gState.list = filteredGroupItems()) : gState.list;
    var n = list.length;
    if (reset) {
      renderFacets();
      gList.innerHTML = ''; gState.shown = 0; gList.scrollTop = 0;
      var info = document.createElement('p'); info.className = 'hint ginfo';
      var filt = gState.text || Object.keys(gState.sel).some(function (k) { return gState.sel[k]; });
      info.textContent = filt ? (n ? (n === 1 ? 'نوع واحد مطابق' : countOptions(n) + ' مطابقة') : 'لا توجد عبوة بهذا الاختيار — غيّر أحد الفلاتر') :
        'اختر العبوة وحدد كميتها. يمكنك اختيار أكثر من نوع بكميات مختلفة.';
      gList.appendChild(info);
    }
    var end = Math.min(n, gState.shown + 50);
    if (gState.focus) { var fi = list.findIndex(function (it) { return it.id === gState.focus; }); if (fi >= end) end = Math.min(n, fi + 10); }
    var frag = document.createDocumentFragment();
    for (var i = gState.shown; i < end; i++) frag.appendChild(rowEl(list[i]));
    var oldMore = gList.querySelector('.more'); if (oldMore) oldMore.remove();
    gList.appendChild(frag);
    gState.shown = end;
    if (end < n) {
      var more = document.createElement('button'); more.type = 'button'; more.className = 'add more'; more.dataset.act = 'gmore';
      more.textContent = 'عرض المزيد (' + ar(n - end) + ')';
      gList.appendChild(more);
    }
    if (reset && gState.focus) {
      var el = gList.querySelector('.row[data-id="' + cssId(gState.focus) + '"]');
      if (el) { el.classList.add('flash'); try { el.scrollIntoView({ block: 'center' }); } catch (e) { } }
      gState.focus = null;
    }
  }
  gFacets.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b || !gState) return;
    var k = b.dataset.fkey, v = b.dataset.fval;
    gState.sel[k] = gState.sel[k] === v ? '' : v;
    renderGroupList(true);
  });
  var gqTimer = 0;
  gq.addEventListener('input', function () { clearTimeout(gqTimer); gqTimer = setTimeout(function () { if (gState) { gState.text = gq.value.trim(); renderGroupList(true); } }, 150); });
  gq.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); gq.blur(); } });
  gList.addEventListener('scroll', function () {        // load the next packs before the end is reached
    if (!gState) return;
    var more = gList.querySelector('.more');
    if (more && gList.scrollTop + gList.clientHeight > gList.scrollHeight - 600) renderGroupList(false);
  }, { passive: true });

  // ------------------------------------------------------------ changes
  function setQty(id, q) {
    q = Math.max(0, Math.min(MAX_QTY, Math.floor(q)));
    var prev = cart.get(id) || 0;
    if (q === prev) { if (q === MAX_QTY) toast('الحد الأقصى للكمية ' + ar(MAX_QTY)); return; }
    if (q) cart.set(id, q); else cart.delete(id);
    changed([id]);
  }
  function changed(ids) {
    version++;
    saveCart();
    ids.forEach(refreshItemEls);
    if (!sheet.hidden) syncSheet(ids);
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
      var act = btn.dataset.act;
      if (act === 'more') { searchLimit += 60; renderSearch(); return; }
      if (act === 'gmore') { renderGroupList(false); return; }
      if (act === 'umore') { var uc = +btn.dataset.cat, wasOpen = usualOpen.has(uc); if (wasOpen) usualOpen.delete(uc); else usualOpen.add(uc); var keep = document.getElementById('u' + uc); var top0 = keep ? keep.getBoundingClientRect().top : 0; render(); var sec2 = document.getElementById('u' + uc); if (sec2) window.scrollBy(0, sec2.getBoundingClientRect().top - top0); return; }
      var host = btn.closest('[data-id]');
      if (!host) return;
      var id = host.dataset.id, q = cart.get(id) || 0;
      if (act === 'add') { setQty(id, 1); focusIn(host, 'inc'); }
      else if (act === 'inc') setQty(id, q + 1);
      else if (act === 'dec') { setQty(id, q - 1); if (q - 1 === 0) focusIn(host, 'add'); }
      return;
    }
    var gopen = t.closest('.gopen');
    if (gopen) { openGroup(+gopen.closest('.gcard').dataset.g); return; }
    var gchip = t.closest('.rgroups .chip');
    if (gchip) { openGroup(+gchip.dataset.g); return; }
    var rg = t.closest('.r-group');
    if (rg) { var rh = rg.closest('[data-id]'); openGroup(+rg.dataset.g, rh && rh.dataset.id); return; }
    var pic = t.closest('.pic, .thumb');
    if (pic) { var h = pic.closest('[data-id]'); if (h) openViewer(h.dataset.id); return; }
    if (t.closest('[data-close]')) { closeTop(); return; }
  });
  chipsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    var v = b.dataset.view === 'usual' ? 'usual' : +b.dataset.view;
    if (qInput.value) { qInput.value = ''; qClear.hidden = true; }
    showView(v);
  });
  headsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    var sec = document.getElementById(b.dataset.target);
    if (sec) {
      var y = sec.getBoundingClientRect().top + window.pageYOffset - toolsEl.offsetHeight + 2;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  });

  // ------------------------------------------------------------ summary + bar
  function totals() { var n = 0, pcs = 0; cart.forEach(function (q) { n++; pcs += q; }); return { n: n, pcs: pcs }; }
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
  function cartKnown() { var ok = true; cart.forEach(function (q, id) { var it = byId.get(id); if (!it || it.g == null) ok = false; }); return ok; }
  function schedulePdf(delay) {
    clearTimeout(buildTimer);
    if (!cart.size) { pdf = { status: 'empty', version: version, result: null }; updateShareUI(); return; }
    if (!(pdf.status === 'ready' && pdf.version === version)) pdf.status = 'building';
    updateShareUI();
    buildTimer = setTimeout(runBuild, delay == null ? 250 : delay);
  }
  function orderedCart() {
    var list = [];
    cart.forEach(function (q, id) { var it = byId.get(id); if (it && it.g != null) list.push({ it: it, q: q }); });
    list.sort(function (a, b) {
      var ca = catOfGroup(a.it.g), cb = catOfGroup(b.it.g);
      return ca - cb || (a.it.i != null && b.it.i != null ? a.it.i - b.it.i : a.it.g - b.it.g);
    });
    return list;
  }
  function entries() { return orderedCart().map(function (x) { return { id: x.it.id, name: displayName(x.it), qty: x.q, img: medUrl(x.it) }; }); }
  function runBuild() {
    if (building) { buildAgain = true; return; }
    if (!cart.size) return;
    if (!cartKnown()) { afterItems(function () { pruneCart(); schedulePdf(0); }); return; }
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
    try { var f = new File([new Uint8Array([37, 80, 68, 70])], 'test.pdf', { type: 'application/pdf' }); return navigator.canShare({ files: [f] }) ? 'yes' : 'no'; } catch (e) { return 'no'; }
  }
  var SHARE = shareSupport();
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
    downloadBtn.style.flex = useShare && shareFailed ? '0 1 auto' : '';
    var note = '';
    if (SHARE === 'insecure') note = 'المشاركة المباشرة تحتاج فتح التطبيق برابط يبدأ بـ https. يمكنك الآن تنزيل الملف وإرساله يدويًا.';
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
    var file = pdf.result.file, data = { files: [file], title: 'قائمة المشتريات' }, p;
    try {
      if (navigator.canShare && !navigator.canShare(data)) data = { files: [file] };
      sharing = true;
      p = navigator.share(data);
    } catch (err) { sharing = false; onShareError(err); return; }
    Promise.resolve(p).then(function () { if (shareFailed) { shareFailed = false; updateShareUI(); } }, function (err) {
      var name = err && err.name;
      if (name === 'AbortError' || name === 'InvalidStateError') return;
      onShareError(err);
    }).then(function () { sharing = false; });
  });
  function onShareError(err) { console.warn('share failed', err); shareFailed = true; updateShareUI(); }
  downloadBtn.addEventListener('click', function () {
    if (!isReady()) return;
    var res = pdf.result, url = URL.createObjectURL(res.blob), a = document.createElement('a');
    a.href = url; a.download = res.name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    toast('تم تنزيل الملف: ' + res.name);
  });

  // ------------------------------------------------------------ layers + back button (position in the list is kept)
  var layers = [], skipPop = 0;
  function openLayer(el) {
    if (layers.indexOf(el) >= 0) return;
    layers.push(el);
    if (el !== viewer && el !== previewEl) el.style.zIndex = String(30 + layers.length);   // the newest sheet is on top
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
    if (el === gsheet) { var gi = gState && gState.gi; gState = null; gList.innerHTML = ''; if (gi != null) { var card = document.querySelector('.gcard[data-g="' + gi + '"] .gopen'); if (card) try { card.focus({ preventScroll: true }); } catch (e) { } } }
    if (el === sheet) reviewBtn.focus({ preventScroll: true });
    if (!fromPop) { skipPop++; try { history.back(); } catch (e) { skipPop--; } }
  }
  window.addEventListener('popstate', function () { if (skipPop) { skipPop--; return; } if (layers.length) closeTop(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && layers.length) closeTop(); });

  // ------------------------------------------------------------ my list
  function renderSheet() {
    var scroll = sheetList.scrollTop;
    sheetList.innerHTML = '';
    var list = orderedCart(), frag = document.createDocumentFragment(), lastCat = null;
    list.forEach(function (x) {
      var c = catOfGroup(x.it.g);
      if (c !== lastCat) { lastCat = c; var h = document.createElement('h3'); h.className = 'sheet-cat'; h.textContent = CATS[c] || ''; frag.appendChild(h); }
      frag.appendChild(rowEl(x.it));
    });
    sheetList.appendChild(frag);
    if (!cartKnown()) { var p = document.createElement('p'); p.className = 'hint'; p.textContent = 'جارٍ تحميل بقية المنتجات…'; sheetList.appendChild(p); afterItems(function () { pruneCart(); if (!sheet.hidden) renderSheet(); }); }
    sheetList.scrollTop = scroll;
    sheetEmpty.hidden = cart.size > 0;
    sheetList.hidden = cart.size === 0;
  }
  function syncSheet(ids) {
    var needFull = false;
    ids.forEach(function (id) {
      var row = sheetList.querySelector('.row[data-id="' + cssId(id) + '"]'), q = cart.get(id) || 0;
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
  reviewBtn.addEventListener('click', function () { if (!sheet.hidden) { closeTop(); return; } renderSheet(); openLayer(sheet); });
  clearBtn.addEventListener('click', function () {
    if (!cart.size || !window.confirm('مسح كل المنتجات من القائمة؟')) return;
    var backup = new Map(cart), ids = Array.from(cart.keys());
    cart.clear();
    changed(ids);
    toast('تم مسح القائمة', 'تراجع', function () { backup.forEach(function (q, id) { cart.set(id, q); }); changed(Array.from(backup.keys())); if (!sheet.hidden) renderSheet(); });
  });

  // ------------------------------------------------------------ file preview
  function clearPreview() { pvPages.querySelectorAll('img').forEach(function (im) { URL.revokeObjectURL(im.src); }); pvPages.innerHTML = ''; }
  function renderPreview() {
    clearPreview();
    if (!isReady()) { pvInfo.textContent = cart.size ? 'جارٍ تجهيز الملف…' : 'القائمة فارغة'; return; }
    var res = pdf.result, kb = Math.max(1, Math.round(res.blob.size / 1024));
    pvInfo.textContent = (res.pageCount === 1 ? 'صفحة واحدة' : res.pageCount === 2 ? 'صفحتان' : ar(res.pageCount) + ' صفحات') +
      ' · ' + (kb >= 1024 ? ar((kb / 1024).toFixed(1)) + ' ميجابايت' : ar(kb) + ' كيلوبايت') + ' — هذا ما سيصل للمستلم';
    res.pages.forEach(function (b, i) { var im = document.createElement('img'); im.alt = 'الصفحة ' + ar(i + 1); im.src = URL.createObjectURL(b); pvPages.appendChild(im); });
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
    vName.textContent = glue(label(it));
    var g = groupOf(it);
    vNo.textContent = g ? g[0] : '';
    vGroup.hidden = !g || g[3] < 2 || layers.indexOf(gsheet) >= 0;
    vCtrl.innerHTML = ctrlHTML(cart.get(id) || 0);
    openLayer(viewer);
  }
  vImg.addEventListener('click', function () { vImgBox.classList.toggle('zoomed'); });
  // «أنواع أخرى»: the photo is replaced by every pack of its type, in the same back-button step
  vGroup.addEventListener('click', function () {
    var it = byId.get(viewerId); if (!it || layers[layers.length - 1] !== viewer || layers.indexOf(gsheet) >= 0) return;
    layers.pop(); viewer.hidden = true; viewerId = null; vImgBox.classList.remove('zoomed');
    layers.push(gsheet); gsheet.style.zIndex = String(30 + layers.length); gsheet.hidden = false;
    openGroup(it.g, it.id);
  });
  vRename.addEventListener('click', function () {
    var it = byId.get(viewerId);
    if (!it) return;
    var v = window.prompt('اسم المنتج (اتركه فارغًا لإرجاع الاسم الأصلي):', displayName(it));
    if (v === null) return;
    v = v.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!v || v === (it.name || '').trim()) delete names[it.id]; else names[it.id] = v;
    writeJSON(LS_NAMES, names);
    it._tok = null;
    document.querySelectorAll('[data-id="' + cssId(it.id) + '"] .name, [data-id="' + cssId(it.id) + '"] .r-name')
      .forEach(function (n) { n.textContent = glue(label(it)); });
    vName.textContent = glue(label(it));
    if (cart.has(it.id)) { version++; schedulePdf(); }
  });

  // ------------------------------------------------------------ toast
  var toastTimer = 0;
  function toast(msg, actionLabel, action) {
    toastEl.innerHTML = '';
    var span = document.createElement('span'); span.textContent = msg; toastEl.appendChild(span);
    if (actionLabel) { var b = document.createElement('button'); b.type = 'button'; b.textContent = actionLabel; b.addEventListener('click', function () { hideToast(); action(); }); toastEl.appendChild(b); }
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
      version++;
      before.concat(Array.from(cart.keys())).forEach(refreshItemEls);
      if (!sheet.hidden) renderSheet();
      updateSummary(); schedulePdf();
    } else if (e.key === LS_NAMES) {
      names = readJSON(LS_NAMES, {}) || {};
      byId.forEach(function (it) { it._tok = null; });
      render(); version++; schedulePdf();
    }
  });

  // ------------------------------------------------------------ start
  qInput.addEventListener('input', function () {
    qClear.hidden = !qInput.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { searchLimit = 60; renderSearch(); window.scrollTo(0, 0); }, 160);
  });
  qInput.addEventListener('focus', loadItems);
  qInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); qInput.blur(); } });
  qClear.addEventListener('click', function () { qInput.value = ''; qClear.hidden = true; render(); qInput.focus(); });
  window.addEventListener('resize', setBarHeight);
  if (window.ResizeObserver) { var ro = new ResizeObserver(setBarHeight); ro.observe(barEl); ro.observe(toolsEl); }

  if (loadCart()) saveCart();
  var totalProducts = GROUPS.reduce(function (a, g) { return a + g[3]; }, 0);
  DEFAULT_SUB = countProducts(totalProducts) + ' في ' + countGroups(GROUPS.length) + '. اختر ما تحتاجه ثم اضغط «مشاركة قائمة المشتريات».';
  buildChips();
  showView('usual', true);
  updateSummary();
  if (cart.size) schedulePdf(0);
  // the full product list loads right after the first screen (or at once when the saved list needs it)
  setTimeout(loadItems, cartKnown() ? 1200 : 0);
  afterItems(function () { if (pruneCart()) { updateSummary(); } version++; schedulePdf(); if (!sheet.hidden) renderSheet(); warmSearch(); });
  // prepare the search words of every product in idle moments, so the first search is instant
  function warmSearch() {
    var i = 0, later = window.requestIdleCallback ? function (f) { requestIdleCallback(f, { timeout: 800 }); } : function (f) { setTimeout(f, 40); };
    (function step() { var end = Math.min(ITEMS.length, i + 1200); for (; i < end; i++) prep(ITEMS[i]); if (i < ITEMS.length) later(step); })();
  }

  // small hook used by automated tests
  window.__jamiya = {
    state: function () { var o = {}; cart.forEach(function (q, id) { o[id] = q; }); return { version: version, pdfStatus: pdf.status, pdfVersion: pdf.version, ready: isReady(), share: SHARE, cart: o, itemsLoaded: itemsLoaded }; },
    pdf: function () { return pdf.result; },
    setQty: setQty,
    openGroup: function (name) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][0] === name) { openGroup(i); return i; } return -1; },
    groups: function () { return GROUPS.length; },
    items: function () { return ITEMS.length; }
  };
})();

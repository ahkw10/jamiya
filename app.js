/* قائمة الجمعية — browse by product type, pick packs, and get one list split by store (Lulu / talabat mart). */
(function () {
  'use strict';

  // ================================================================== data
  var CORE = window.CATALOG || {};
  var CATS = CORE.cats || [], HEADS = CORE.heads || [], GROUPS = CORE.groups || [];
  var SV = CORE.sv || '0', ALIASES = CORE.aliases || {}, PRICE_DATE = CORE.priceDate || '';
  var PRODUCE = CATS.indexOf('خضار وفواكه');
  var byId = new Map();            // id -> item {id, g, name, brand, u, v, off, hid, cat, i}
  var ITEMS = [];                  // products that can be chosen, in catalog order
  var groupItems = [];             // group index -> products
  var itemsLoaded = false, whenLoaded = [];
  function catOfGroup(gi) { var g = GROUPS[gi]; return g ? HEADS[g[1]][0] : -1; }
  function addRow(r, brands) {
    var it = byId.get(r[0]);
    if (!it) { it = { id: r[0] }; byId.set(r[0], it); }
    it.g = r[1]; it.name = r[2]; it.brand = brands && r[3] >= 0 ? brands[r[3]] : (it.brand || ''); it.u = r[4]; it.v = r[5];
    it.off = Array.isArray(r[6]) ? r[6] : null;
    it.hid = r[1] === -1;                                   // produce not listed in talabat mart (kept for older lists)
    it.cat = it.hid ? r[7] : catOfGroup(r[1]);
    it._ss = null; it._tok = null; it._fv = null; it._w = null;
    return it;
  }
  GROUPS.forEach(function (g) { if (g[6]) addRow(g[6], null); });     // single-pack types ship their pack in the core file

  function loadItems() {
    if (itemsLoaded || loadItems.started) return;
    loadItems.started = true;
    var s = document.createElement('script');
    s.src = CORE.itemsUrl || 'catalog-items.js';
    s.async = true;
    s.onload = function () {
      var data = window.CATALOG_ITEMS || { items: [], brands: [] };
      groupItems = GROUPS.map(function () { return []; });
      data.items.forEach(function (r, i) {
        var it = addRow(r, data.brands); it.i = i;
        if (!it.hid) { ITEMS.push(it); if (groupItems[it.g]) groupItems[it.g].push(it); }
      });
      itemsLoaded = true;
      window.CATALOG_ITEMS = null;
      var cbs = whenLoaded; whenLoaded = [];
      cbs.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
    };
    s.onerror = function () { loadItems.started = false; toast('تعذّر تحميل قائمة المنتجات. تحقّق من الاتصال ثم أعد المحاولة.'); };
    document.head.appendChild(s);
  }
  function afterItems(f) { if (itemsLoaded) f(); else { whenLoaded.push(f); loadItems(); } }

  // ================================================================== text & numbers
  var AR = '٠١٢٣٤٥٦٧٨٩';
  var TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"/></svg>';
  var FILTER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v2H3V5Zm4 6h10v2H7v-2Zm3 6h4v2h-4v-2Z"/></svg>';
  function $(sel) { return document.querySelector(sel); }
  function ar(n) { return String(n).replace(/[0-9]/g, function (d) { return AR[+d]; }); }
  // Arabic-Indic digits in names and sizes (not inside Latin words such as SPF50); «1.5» -> «١٫٥»
  function arText(s) {
    return String(s).replace(/(^|[^A-Za-z0-9])(\d+(?:[.,]\d+)?)(?![A-Za-z0-9])/g, function (m, pre, num) {
      return pre + num.replace(/[.,]/, '٫').replace(/[0-9]/g, function (d) { return AR[+d]; });
    });
  }
  function money(fils) { return ar((fils / 1000).toFixed(3)).replace('.', '٫') + ' د.ك'; }
  function cssId(id) { return window.CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/["\\]/g, '\\$&'); }
  function thumbUrl(it) { return it.v ? 'img/t/' + encodeURIComponent(it.id) + '.jpg?v=' + it.v : 'img/s/' + encodeURIComponent(it.id) + '.jpg?v=' + SV; }
  function medUrl(it) { return it.v ? 'img/m/' + encodeURIComponent(it.id) + '.jpg?v=' + it.v : 'img/s/' + encodeURIComponent(it.id) + '.jpg?v=' + SV; }
  function countOf(n, one, two, few, many) { return n === 1 ? one : n === 2 ? two : n <= 10 ? ar(n) + ' ' + few : ar(n) + ' ' + many; }
  function nKinds(n) { return countOf(n, 'نوع واحد', 'نوعان', 'أنواع', 'نوعًا'); }
  function nItems(n) { return countOf(n, 'صنف واحد', 'صنفان', 'أصناف', 'صنفًا'); }
  function nPacks(n) { return countOf(n, 'عبوة واحدة', 'عبوتان', 'عبوات', 'عبوة'); }
  function nProducts(n) { return countOf(n, 'منتج واحد', 'منتجان', 'منتجات', 'منتجًا'); }
  function priceDateText() {
    if (!PRICE_DATE) return '';
    try {
      var d = new Date(PRICE_DATE);
      return new Intl.DateTimeFormat('ar-KW-u-nu-arab', { day: 'numeric', month: 'long', year: 'numeric' }).format(d) + '، ' +
        new Intl.DateTimeFormat('ar-KW-u-nu-arab', { hour: 'numeric', minute: '2-digit' }).format(d);
    } catch (e) { return PRICE_DATE.slice(0, 10); }
  }

  // ================================================================== storage (never throws)
  function readJSON(key, def) { try { var raw = localStorage.getItem(key); if (!raw) return def; var v = JSON.parse(raw); return v == null ? def : v; } catch (e) { return def; } }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
  var LS_CART = 'jamiya.cart.v1', LS_NAMES = 'jamiya.names.v1', LS_STORE = 'jamiya.store.v1', MAX_QTY = 99;
  var cart = new Map(), version = 0, storageWarned = false;
  var names = readJSON(LS_NAMES, {}); if (!names || typeof names !== 'object') names = {};
  var storeChoice = readJSON(LS_STORE, {}); if (!storeChoice || typeof storeChoice !== 'object') storeChoice = {};
  function canonical(id) { var g = 0; while (Object.prototype.hasOwnProperty.call(ALIASES, id) && g++ < 20) id = ALIASES[id]; return id; }
  (function migrateNames() {
    var moved = false;
    Object.keys(names).forEach(function (id) { var c = canonical(id); if (c !== id) { if (!names[c]) names[c] = names[id]; delete names[id]; moved = true; } });
    if (moved) writeJSON(LS_NAMES, names);
  })();
  function loadCart() {
    cart.clear();
    var data = readJSON(LS_CART, null), items = data && data.items, merged = false;
    if (items && typeof items === 'object') Object.keys(items).forEach(function (id) {
      var q = Math.floor(Number(items[id])), c = canonical(id);
      if (c !== id) merged = true;
      if (q > 0) cart.set(c, Math.min((cart.get(c) || 0) + q, MAX_QTY));
    });
    return merged;
  }
  function saveCart() {
    var obj = {}; cart.forEach(function (q, id) { obj[id] = q; });
    if (!writeJSON(LS_CART, { v: 1, savedAt: Date.now(), items: obj }) && !storageWarned) { storageWarned = true; toast('تعذّر حفظ القائمة على هذا الجهاز. ستبقى ما دامت الصفحة مفتوحة.'); }
  }
  function pruneCart() {        // forget ids that no longer exist at all (after the full product list has loaded)
    var gone = []; cart.forEach(function (q, id) { if (!byId.has(id)) gone.push(id); });
    gone.forEach(function (id) { cart.delete(id); }); if (gone.length) saveCart();
    return gone.length;
  }
  function cartKnown() { var ok = true; cart.forEach(function (q, id) { if (!byId.has(id)) ok = false; }); return ok; }
  function displayName(it) { var n = names[it.id]; return (typeof n === 'string' && n.trim()) ? n.trim() : (it.name || '').trim(); }
  function label(it) { return displayName(it) || 'منتج'; }

  // ================================================================== name parts: the pack size on its own line
  var UNIT = 'كجم|كغ|غم|غ|جم|ملغ|مل|لتر|قطعة|قطع|حبة|حبات|رول|رولات|كيس|أكياس|منديل|مناديل|فوطة|فوط|ظرف|ظروف|كبسولة|كبسولات|شريحة|شرائح|ورقة|عبوة|عبوات|علبة|علب|قرص|أقراص|جالون|متر|م|سم|بيضة|بيضات|لوح|أصابع|إصبع|أونصة|قدم مربع';
  var SIZE_RE = new RegExp('(?:\\d+(?:[.,]\\d+)?\\s*[×x]\\s*)?\\d+(?:[.,]\\d+)?\\s*(?:' + UNIT + ')(?![\\u0621-\\u064A])');
  var FIT_RE = /مقاس\s*(\d+\s*\+?|[A-Za-z]{1,4}\b)/, STAGE_RE = /(?:المرحلة|مرحلة|رقم)\s*(\d+\s*\+?)/;
  // the pack size: the whole tail when it only holds sizes («400 غ + 40 غ»، «6×125 مل»), else just the first size
  var SIZE_TAIL_RE = new RegExp('^(?:[\\s\\d.,×x+\\-–()]|' + UNIT + ')*$');
  function splitSize(it) {            // {base, size}: «نوتيلا كريمة البندق 400 غ» -> «نوتيلا كريمة البندق» + «400 غ»
    var l = label(it);
    if (it._ss && it._ss.l === l) return it._ss;
    var out = { l: l, base: l, size: '' };
    var re = new RegExp(SIZE_RE.source, 'g'), m;
    while ((m = re.exec(l))) {
      if (m.index >= l.length * 0.3) {
        var rest = l.slice(m.index).trim();
        if (SIZE_TAIL_RE.test(rest.replace(/\s+/g, ' '))) { out.size = rest; out.base = l.slice(0, m.index); }
        else { out.size = m[0]; out.base = l.slice(0, m.index) + ' ' + l.slice(m.index + m[0].length); }
        out.base = out.base.replace(/\s+/g, ' ').replace(/[\s\-–—,،:(]+$/, '').trim() || l;
        break;
      }
    }
    it._ss = out;
    return out;
  }

  // ================================================================== search (whole catalog)
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[ً-ْٰـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ظ/g, 'ض')
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(/٫/g, '.').replace(/[×*]/g, 'x').replace(/\s+/g, ' ').trim();
  }
  var SYN = {
    'حفايض': ['حفاض'], 'حفاظات': ['حفاضات'], 'عيش': ['ارز'], 'رز': ['ارز'], 'روب': ['زبادي'], 'ماي': ['مياه'], 'ماء': ['مياه'],
    'محارم': ['مناديل'], 'طماطه': ['طماطم'], 'بندوره': ['طماطم'], 'كلينيكس': ['كلينكس'], 'كلوركس': ['مبيض'], 'معكرونه': ['مكرونه'],
    'مكرونه': ['معكرونه'], 'كاتشاب': ['كاتشب'], 'صابونه': ['صابون'], 'جبس': ['شيبس'], 'شيبسي': ['شيبس'], 'ايسكريم': ['ايس'],
    'بوضه': ['ايس'], 'بوظه': ['ايس'], 'بسكوت': ['بسكويت'], 'عصاير': ['عصير'], 'شوكلت': ['شوكولاته'], 'تمر': ['تمور'], 'تمور': ['تمر'],
    'جرام': ['غ'], 'غرام': ['غ'], 'كيلو': ['كجم'], 'ملي': ['مل']
  };
  var PROCL = ['وبال', 'وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و', 'ب', 'ل', 'ف', 'ك'];
  function toks(s) { return norm(s).replace(/(\d)x(\d)/g, '$1 x $2').replace(/(\d)([^\d\s.x])/g, '$1 $2').split(/[\s\-–—_()[\]{},،؛:+\/\\|"'«»!?؟]+/).filter(Boolean); }
  function stripP(t) { for (var i = 0; i < PROCL.length; i++) { var p = PROCL[i]; if (t.length - p.length >= 2 && t.lastIndexOf(p, 0) === 0) return t.slice(p.length); } return t; }
  function prep(it) {
    if (it._tok) return;
    it._tok = toks(label(it)); it._tokS = it._tok.map(stripP);
    it._gtok = GROUPS[it.g] ? toks(GROUPS[it.g][0]) : [];
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
        else if (!num && t.indexOf(q) >= 0) s = 1;
        if (s > best) best = s;
      }
      for (var j = 0; j < it._gtok.length; j++) if (it._gtok[j] === q || stripP(it._gtok[j]) === q) best = Math.max(best, 3);
    }
    return best;
  }
  // every word must match; exact words beat look-alikes; a number must match the pack's number exactly when one does
  function searchItems(list, q) {
    var terms = toks(q);
    if (!terms.length) return null;
    var alts = terms.map(function (t) { return [t].concat((SYN[t] || []).filter(function (x) { return x !== t; })); });
    var rows = [], maxPer = terms.map(function () { return 0; });
    for (var k = 0; k < list.length; k++) {
      var it = list[k]; prep(it);
      var ss = [], ok = true;
      for (var i = 0; i < alts.length; i++) { var s = termScore(it, alts[i]); if (!s) { ok = false; break; } ss.push(s); if (s > maxPer[i]) maxPer[i] = s; }
      if (ok) rows.push([it, ss]);
    }
    var out = [];
    rows.forEach(function (r) {
      var sum = 0;
      for (var i = 0; i < r[1].length; i++) { var lim = maxPer[i] >= 3.5 ? 2.5 : maxPer[i] >= 2.5 ? 2 : 0; if (r[1][i] < lim) return; sum += r[1][i]; }
      // the type you meant first: «ماي» means water, so packs of the water types beat a brand that happens to be called «ماي»
      var gt = r[0]._gtok, gb = 0;
      for (var a = 0; a < alts.length && !gb; a++) for (var b = 0; b < alts[a].length; b++) {
        var w = alts[a][b];
        if (gt.indexOf(w) >= 0 || gt.some(function (x) { return stripP(x) === w; })) { gb = 1.5; break; }
      }
      out.push({ it: r[0], s: sum + gb });
    });
    // what was asked for first; among equally good matches the usual packs, then the store's order
    out.sort(function (a, b) { return b.s - a.s || (b.it.u || 0) - (a.it.u || 0) || (a.it.i || 0) - (b.it.i || 0); });
    return out;
  }
  function warmSearch() {
    var i = 0, later = window.requestIdleCallback ? function (f) { requestIdleCallback(f, { timeout: 800 }); } : function (f) { setTimeout(f, 40); };
    (function step() { var end = Math.min(ITEMS.length, i + 1200); for (; i < end; i++) prep(ITEMS[i]); if (i < ITEMS.length) later(step); })();
  }

  // ================================================================== which store: produce from talabat mart, the rest at the cheaper store
  var STORES = { L: 'لولو هايبرماركت', T: 'طلبات مارت' }, SHORT = { L: 'لولو', T: 'طلبات مارت' };
  function offer(it, s) { return it.off ? (s === 'L' ? it.off[0] : it.off[1]) : 0; }          // 0 not listed, -1 price unknown, else fils
  function inStock(it, s) { var f = it.off ? it.off[2] : 0; return s === 'L' ? !(f & 1) : !(f & 2); }
  // decision for one line before ties are settled
  function decide(it, q) {
    if (it.cat === PRODUCE) {
      var tp = offer(it, 'T');
      if (!tp) return { kind: 'R' };
      return { kind: 'S', s: 'T', why: 'produce', unit: tp > 0 ? tp : null };
    }
    var l = offer(it, 'L'), t = offer(it, 'T');
    if (!l && !t) return storeChoice[it.id] ? { kind: 'S', s: storeChoice[it.id], why: 'chosen', unit: null, chosen: true } : { kind: 'U', why: 'no-store' };
    if (l && !t) return { kind: 'S', s: 'L', why: 'only', unit: l > 0 ? l : null };
    if (t && !l) return { kind: 'S', s: 'T', why: 'only', unit: t > 0 ? t : null };
    var li = inStock(it, 'L'), ti = inStock(it, 'T');
    if (li !== ti) { var s1 = li ? 'L' : 'T', p1 = s1 === 'L' ? l : t; return { kind: 'S', s: s1, why: 'stock', unit: p1 > 0 ? p1 : null }; }
    if (l < 0 || t < 0) {
      var miss = l < 0 && t < 0 ? 'both' : l < 0 ? 'L' : 'T';
      if (storeChoice[it.id]) { var c = storeChoice[it.id], cp = c === 'L' ? l : t; return { kind: 'S', s: c, why: 'chosen', unit: cp > 0 ? cp : null, chosen: true, miss: miss }; }
      return { kind: 'U', why: 'price-missing', miss: miss };
    }
    var cl = l * q, ct = t * q;                 // the price shown is already after any discount; it applies to every unit
    if (cl < ct) return { kind: 'S', s: 'L', why: 'cheaper', unit: l, other: t };
    if (ct < cl) return { kind: 'S', s: 'T', why: 'cheaper', unit: t, other: l };
    return { kind: 'TIE', unit: l };
  }
  // the whole basket: settles equal prices by joining the store that already has more of the list (talabat mart if level)
  function plan() {
    var lines = [];
    cart.forEach(function (q, id) { var it = byId.get(id); if (it) lines.push({ it: it, q: q, d: decide(it, q) }); });
    var count = { L: 0, T: 0 };
    lines.forEach(function (x) { if (x.d.kind === 'S') count[x.d.s]++; });
    lines.forEach(function (x) {
      if (x.d.kind !== 'TIE') return;
      var s = count.L > count.T ? 'L' : 'T';
      x.d = { kind: 'S', s: s, why: count.L === count.T ? 'tie-default' : 'tie-join', unit: x.d.unit };
    });
    var res = { L: [], T: [], U: [], R: [], total: { L: 0, T: 0 }, missing: { L: 0, T: 0 } };
    lines.forEach(function (x) {
      var k = x.d.kind === 'S' ? x.d.s : x.d.kind;
      res[k].push(x);
      if (x.d.kind === 'S') { if (x.d.unit) res.total[x.d.s] += x.d.unit * x.q; else res.missing[x.d.s]++; }
    });
    var order = function (a, b) { return a.it.cat - b.it.cat || (a.it.i != null && b.it.i != null ? a.it.i - b.it.i : a.it.g - b.it.g); };
    ['L', 'T', 'U', 'R'].forEach(function (k) { res[k].sort(order); });
    return res;
  }
  function reasonText(x) {
    var d = x.d, it = x.it;
    if (d.kind === 'R') return 'الخضار والفواكه تُشترى من طلبات مارت فقط، وهذه العبوة غير مدرجة فيه. راجعيها: احذفيها أو اختاري بديلًا.';
    if (d.kind === 'U') return d.why === 'no-store' ? 'لم يُوثَّق المتجر ولا السعر لهذا المنتج. اختاري المتجر:' :
      (d.miss === 'both' ? 'المنتج في المتجرين لكن السعرين غير متاحين. اختاري المتجر:' : 'المنتج في المتجرين لكن سعر ' + SHORT[d.miss] + ' غير متاح. اختاري المتجر:');
    switch (d.why) {
      case 'produce': return 'الخضار والفواكه من طلبات مارت' + (offer(it, 'L') ? ' (حتى لو كانت في لولو)' : '') + '.';
      case 'only': return 'متوفر في ' + SHORT[d.s] + ' فقط.';
      case 'stock': return 'غير متوفر في ' + SHORT[d.s === 'L' ? 'T' : 'L'] + ' وقت آخر تحديث، فوُضع في ' + SHORT[d.s] + '.';
      case 'cheaper': return 'الأرخص بحسب آخر سعر متاح: ' + SHORT[d.s] + ' ' + money(d.unit) + ' مقابل ' + money(d.other) + ' في ' + SHORT[d.s === 'L' ? 'T' : 'L'] + '.';
      case 'tie-join': return 'السعر نفسه في المتجرين (' + money(d.unit) + ')، فوُضع مع بقية مشترياتك من ' + SHORT[d.s] + '.';
      case 'tie-default': return 'السعر نفسه في المتجرين (' + money(d.unit) + ')؛ عند التساوي وعدد الأصناف نفسه يُوضع في طلبات مارت.';
      case 'chosen': return 'اخترتِ ' + SHORT[d.s] + ' لهذا المنتج.';
    }
    return '';
  }
  // price line under a pack before it is in the basket (quantity 1)
  function priceHint(it) {
    var d = decide(it, 1);
    if (d.kind === 'R') return 'غير متوفر في طلبات مارت';
    if (d.kind === 'U') return d.why === 'no-store' ? 'المتجر غير محدد' : 'السعر غير مكتمل';
    if (d.kind === 'TIE') return '<b>' + money(d.unit) + '</b> · السعر نفسه في المتجرين';
    return d.unit ? '<b>' + money(d.unit) + '</b> · ' + SHORT[d.s] : SHORT[d.s] + ' · السعر غير متاح';
  }

  // ================================================================== elements
  var viewEl = $('#view'), tabsEl = $('#tabs'), headsEl = $('#heads'), topEl = $('#top'), qInput = $('#q'), qClear = $('#qClear');
  var barEl = $('#bar'), cartBtn = $('#cartBtn'), cartCount = $('#cartCount'), cartLine1 = $('#cartLine1'), cartLine2 = $('#cartLine2');
  var gsheet = $('#gsheet'), gTitle = $('#gTitle'), gSub = $('#gSub'), gTools = $('#gTools'), gSearchBox = $('#gSearchBox'), gq = $('#gq'), gFilterBar = $('#gFilterBar'), gList = $('#gList');
  var fpanel = $('#fpanel'), fBody = $('#fBody'), fClear = $('#fClear'), fApply = $('#fApply');
  var cartSheet = $('#cart'), cartSub = $('#cartSub'), cartBody = $('#cartBody'), clearBtn = $('#clearBtn');
  var shareBtn = $('#shareBtn'), shareLabel = $('#shareLabel'), downloadBtn = $('#downloadBtn'), previewBtn = $('#previewBtn'), barNote = $('#barNote');
  var viewer = $('#viewer'), vImg = $('#vImg'), vImgBox = $('#vImgBox'), vName = $('#vName'), vSize = $('#vSize'), vPrice = $('#vPrice'), vGroupName = $('#vGroupName'), vCtrl = $('#vCtrl'), vRename = $('#vRename'), vGroup = $('#vGroup');
  var previewEl = $('#preview'), pvPages = $('#pvPages'), pvInfo = $('#pvInfo'), toastEl = $('#toast');

  // ================================================================== shared pieces
  function ctrlHTML(q) {
    if (!q) return '<button type="button" class="add" data-act="add">إضافة</button>';
    return '<div class="stepper" role="group" aria-label="الكمية"><button type="button" data-act="inc" aria-label="زيادة الكمية">+</button>' +
      '<output aria-live="polite">' + ar(q) + '</output><button type="button" data-act="dec" aria-label="' + (q === 1 ? 'إزالة' : 'إنقاص الكمية') + '">' + (q === 1 ? TRASH : '−') + '</button></div>';
  }
  function updateCtrl(box, q) {
    var st = box.querySelector('.stepper');
    if (q && st) {
      st.querySelector('output').textContent = ar(q);
      var dec = st.querySelector('[data-act="dec"]'), wantTrash = q === 1, isTrash = !!dec.querySelector('svg');
      if (wantTrash !== isTrash) { dec.innerHTML = wantTrash ? TRASH : '−'; dec.setAttribute('aria-label', wantTrash ? 'إزالة' : 'إنقاص الكمية'); }
    } else box.innerHTML = ctrlHTML(q);
  }
  function groupSel(gi) { var n = 0; cart.forEach(function (q, id) { var it = byId.get(id); if (it && it.g === gi && !it.hid) n++; }); return n; }
  function refreshGroupCards(gi) {
    document.querySelectorAll('.gcard[data-g="' + gi + '"]').forEach(function (el) {
      var n = groupSel(gi);
      el.classList.toggle('in-cart', n > 0);
      var b = el.querySelector('.gsel'); if (b) b.textContent = n ? '✓ ' + ar(n) : '';
    });
  }
  function refreshItem(id) {
    var q = cart.get(id) || 0;
    document.querySelectorAll('[data-id="' + cssId(id) + '"]').forEach(function (el) {
      if (el.classList.contains('prow')) el.classList.toggle('in-cart', q > 0);
      var c = el.classList.contains('ctrl') ? el : el.querySelector('.ctrl'); if (c) updateCtrl(c, q);
    });
    var it = byId.get(id); if (it && it.g >= 0) refreshGroupCards(it.g);
  }

  // pack row: photo · name (usual badge) · size · price · quantity
  function packRow(it, withGroup) {
    var row = document.createElement('article');
    row.className = 'prow'; row.dataset.id = it.id;
    var ss = splitSize(it), g = GROUPS[it.g], q = cart.get(it.id) || 0;
    row.innerHTML = '<button class="pic" type="button"><img alt="" loading="lazy" decoding="async"></button><div class="p-info">' +
      '<p class="p-name"></p><div class="p-meta"><span class="p-size"></span><span class="p-price"></span></div>' +
      (withGroup && g && g[3] > 1 ? '<button type="button" class="p-group"></button>' : '') + '<div class="ctrl"></div></div>';
    row.querySelector('img').src = thumbUrl(it);
    row.querySelector('.pic').setAttribute('aria-label', 'عرض الصورة: ' + label(it));
    var nm = row.querySelector('.p-name');
    if (it.u > 0) { var b = document.createElement('span'); b.className = 'badge-usual'; b.textContent = 'معتاد'; nm.appendChild(b); }
    nm.appendChild(document.createTextNode(arText(ss.base)));
    row.querySelector('.p-size').textContent = arText(ss.size);
    row.querySelector('.p-price').innerHTML = priceHint(it);
    if (withGroup && g && g[3] > 1) { var pg = row.querySelector('.p-group'); pg.dataset.g = it.g; pg.textContent = 'كل أنواع ' + arText(g[0]) + ' (' + ar(g[3]) + ') ‹'; }
    row.classList.toggle('in-cart', q > 0);
    var c = row.querySelector('.ctrl'); c.dataset.id = it.id; c.innerHTML = ctrlHTML(q);
    return row;
  }
  // type card: tap = every pack of the type; a type with one pack is added right from the card
  function groupCard(gi) {
    var g = GROUPS[gi], el = document.createElement('article');
    el.className = 'gcard'; el.dataset.g = gi;
    var single = g[3] === 1 && byId.get(g[2]);
    el.innerHTML = '<button class="gopen" type="button"><span class="gpic"><img alt="" loading="lazy" decoding="async"></span><span class="gname"></span><span class="gmeta"></span></button>' +
      (g[4] > 0 ? '<span class="badge-usual">معتاد</span>' : '') + '<span class="gsel" aria-hidden="true"></span>' + (single ? '<div class="ctrl"></div>' : '');
    var rep = byId.get(g[2]) || { id: g[2], v: g[5] || '' };
    el.querySelector('img').src = thumbUrl(rep);
    el.querySelector('.gname').textContent = single ? arText(splitSize(single).base) : arText(g[0]);
    el.querySelector('.gmeta').textContent = single ? arText(splitSize(single).size) || 'عبوة واحدة' : nKinds(g[3]);
    el.querySelector('.gopen').setAttribute('aria-label', g[0] + '، ' + nKinds(g[3]));
    if (single) { var c = el.querySelector('.ctrl'); c.dataset.id = single.id; c.innerHTML = ctrlHTML(cart.get(single.id) || 0); }
    var n = groupSel(gi);
    if (n) { el.classList.add('in-cart'); el.querySelector('.gsel').textContent = '✓ ' + ar(n); }
    return el;
  }
  function sectionGroups(ci) {                // types of a section in the store's order
    var list = [];
    GROUPS.forEach(function (g, gi) { if (HEADS[g[1]][0] === ci) list.push(gi); });
    return list;
  }

  // ================================================================== views: home, section, search
  var curView = 'home', tabs = [], scrollMemo = {};
  function buildTabs() {
    [['home', 'الرئيسية']].concat(CATS.map(function (c, i) { return [i, c]; })).forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.dataset.view = c[0]; b.textContent = c[1];
      tabsEl.appendChild(b); tabs.push(b);
    });
  }
  function centerChip(bar, chip) {
    if (!bar || !chip) return;
    var r = chip.getBoundingClientRect(), p = bar.getBoundingClientRect();
    if (r.left >= p.left + 8 && r.right <= p.right - 8) return;
    var dx = (r.left + r.width / 2) - (p.left + p.width / 2);
    try { bar.scrollBy({ left: dx, behavior: 'smooth' }); } catch (e) { bar.scrollLeft += dx; }
  }
  function showView(v) {
    scrollMemo[curView] = window.scrollY;
    curView = v;
    tabs.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view) === String(v) ? 'true' : 'false'); });
    centerChip(tabsEl, tabs.filter(function (b) { return String(b.dataset.view) === String(v); })[0]);
    if (qInput.value.trim()) { qInput.value = ''; qClear.hidden = true; }
    render();
    window.scrollTo(0, scrollMemo[v] || 0);
  }
  function render() {
    viewEl.innerHTML = ''; headsEl.innerHTML = ''; headsEl.hidden = true;
    if (curView === 'home') renderHome(); else renderSection(+curView);
    headsEl.hidden = headsEl.children.length < 2;
    spy.last = null; setSizes(); spy();
  }
  function secTitle(text, small, moreView) {
    var h = document.createElement('h2'); h.className = 'sec-h';
    var t = document.createElement('span'); t.textContent = text; h.appendChild(t);
    if (small) { var s = document.createElement('small'); s.textContent = small; t.appendChild(document.createTextNode(' ')); t.appendChild(s); }
    if (moreView != null) { var m = document.createElement('button'); m.type = 'button'; m.className = 'more-link'; m.dataset.view = moreView; m.textContent = 'كل الأنواع ‹'; h.appendChild(m); }
    return h;
  }
  // home: every section with its types; types holding your usual purchases lead each row
  function renderHome() {
    var frag = document.createDocumentFragment();
    var p = document.createElement('p'); p.className = 'hint';
    p.textContent = 'اختاري النوع ثم العبوة. الأنواع التي تشترونها عادةً تظهر أولًا وعليها «معتاد». يوزّع التطبيق السلة على لولو وطلبات مارت تلقائيًا.';
    frag.appendChild(p);
    CATS.forEach(function (c, ci) {
      var gs = sectionGroups(ci); if (!gs.length) return;
      var usualFirst = gs.filter(function (gi) { return GROUPS[gi][4] > 0; }).sort(function (a, b) { return GROUPS[b][4] - GROUPS[a][4]; });
      var rest = gs.filter(function (gi) { return !(GROUPS[gi][4] > 0); });
      var show = usualFirst.concat(rest).slice(0, 12);
      var sec = document.createElement('section'); sec.className = 'sec';
      sec.appendChild(secTitle(c, nKinds(gs.length), ci));
      var strip = document.createElement('div'); strip.className = 'strip';
      show.forEach(function (gi) { strip.appendChild(groupCard(gi)); });
      if (gs.length > show.length) { var m = document.createElement('button'); m.type = 'button'; m.className = 'more-card'; m.dataset.view = ci; m.textContent = 'كل ' + c + ' ‹'; strip.appendChild(m); }
      sec.appendChild(strip); frag.appendChild(sec);
    });
    viewEl.appendChild(frag);
  }
  function renderSection(ci) {
    var byHead = new Map(), heads = [];
    sectionGroups(ci).forEach(function (gi) { var h = GROUPS[gi][1]; if (!byHead.has(h)) { byHead.set(h, []); heads.push(h); } byHead.get(h).push(gi); });
    var frag = document.createDocumentFragment();
    heads.forEach(function (hi) {
      var gs = byHead.get(hi).slice().sort(function (a, b) { return (GROUPS[b][4] > 0) - (GROUPS[a][4] > 0) || GROUPS[b][4] - GROUPS[a][4] || a - b; });
      var n = gs.reduce(function (s, gi) { return s + GROUPS[gi][3]; }, 0);
      var sec = document.createElement('section'); sec.className = 'sec'; sec.id = 'h' + hi;
      sec.appendChild(secTitle(HEADS[hi][1], nProducts(n)));
      var grid = document.createElement('div'); grid.className = 'ggrid';
      gs.forEach(function (gi) { grid.appendChild(groupCard(gi)); });
      sec.appendChild(grid); frag.appendChild(sec);
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.target = 'h' + hi; b.textContent = HEADS[hi][1];
      headsEl.appendChild(b);
    });
    viewEl.appendChild(frag);
  }
  var spyRaf = 0;
  function spy() {
    spyRaf = 0;
    if (headsEl.hidden) return;
    var limit = topEl.getBoundingClientRect().bottom + 24, cur = null, btns = headsEl.children;
    for (var i = 0; i < btns.length; i++) { var s = document.getElementById(btns[i].dataset.target); if (s && s.getBoundingClientRect().top <= limit) cur = btns[i]; else if (s) break; }
    cur = cur || btns[0];
    for (var j = 0; j < btns.length; j++) btns[j].setAttribute('aria-pressed', btns[j] === cur ? 'true' : 'false');
    if (cur !== spy.last) { spy.last = cur; centerChip(headsEl, cur); }
  }
  window.addEventListener('scroll', function () { if (!spyRaf) spyRaf = requestAnimationFrame(spy); }, { passive: true });
  headsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    var s = document.getElementById(b.dataset.target);
    if (s) window.scrollTo({ top: s.getBoundingClientRect().top + window.pageYOffset - topEl.offsetHeight + 2, behavior: 'smooth' });
  });
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) showView(b.dataset.view === 'home' ? 'home' : +b.dataset.view); });

  var searchTimer = 0, searchLimit = 40;
  function renderSearch() {
    var q = qInput.value.trim();
    qClear.hidden = !qInput.value;
    if (!q) { render(); window.scrollTo(0, scrollMemo[curView] || 0); return; }
    headsEl.hidden = true;
    if (!itemsLoaded) {
      viewEl.innerHTML = '<p class="hint">جارٍ تحميل المنتجات…</p>';
      afterItems(function () { if (qInput.value.trim() === q) renderSearch(); });
      return;
    }
    var res = searchItems(ITEMS, q) || [];
    viewEl.innerHTML = '';
    var gscore = new Map();
    res.slice(0, 400).forEach(function (r) { gscore.set(r.it.g, (gscore.get(r.it.g) || 0) + r.s); });
    var gs = Array.from(gscore.keys()).sort(function (a, b) { return gscore.get(b) - gscore.get(a); }).slice(0, 10);
    if (gs.length > 1) {
      var t = document.createElement('p'); t.className = 'hint'; t.textContent = 'الأنواع المطابقة'; viewEl.appendChild(t);
      var box = document.createElement('div'); box.className = 'chips'; box.style.padding = '0 16px 8px';
      gs.forEach(function (gi) { var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.g = gi; b.innerHTML = '<span></span><span class="n"></span>'; b.firstChild.textContent = arText(GROUPS[gi][0]); b.lastChild.textContent = ar(GROUPS[gi][3]); box.appendChild(b); });
      viewEl.appendChild(box);
    }
    var head = document.createElement('p'); head.className = 'hint';
    head.textContent = res.length ? nProducts(res.length) + ' مطابقة لـ «' + q + '»' : 'لا توجد منتجات مطابقة لـ «' + q + '». جرّبي كلمة أخرى أو اسم العلامة.';
    viewEl.appendChild(head);
    var list = document.createElement('div'); list.className = 'plist';
    res.slice(0, searchLimit).forEach(function (r) { list.appendChild(packRow(r.it, true)); });
    viewEl.appendChild(list);
    if (res.length > searchLimit) { var m = document.createElement('button'); m.type = 'button'; m.className = 'more'; m.dataset.act = 'more'; m.textContent = 'عرض المزيد (' + ar(res.length - searchLimit) + ')'; viewEl.appendChild(m); }
  }
  qInput.addEventListener('input', function () { qClear.hidden = !qInput.value; clearTimeout(searchTimer); searchTimer = setTimeout(function () { searchLimit = 40; renderSearch(); window.scrollTo(0, 0); }, 160); });
  qInput.addEventListener('focus', function () { loadItems(); if (!qInput.value) scrollMemo[curView] = window.scrollY; });
  qInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); qInput.blur(); } });
  qClear.addEventListener('click', function () { qInput.value = ''; renderSearch(); qInput.focus(); });

  // ================================================================== filters that matter for the open type
  var STOP = new Set(['من', 'في', 'على', 'او', 'حجم', 'عبوه', 'عبوات', 'قطعه', 'قطع', 'حبه', 'حبات', 'غ', 'غم', 'جم', 'كجم', 'مل', 'لتر', 'كيس', 'اكياس',
    'رول', 'رولات', 'ظرف', 'منديل', 'مناديل', 'فوطه', 'x', 'كبسوله', 'ملغ', 'سم', 'م', 'وزن', 'تقريبا', 'حوالي', 'عرض', 'خاص', 'مجانا', 'جديد', 'علبه',
    'مقاس', 'مرحله', 'المرحله', 'رقم', 'و', 'عدد', 'قطعتين', 'عبوتين', 'حبتين', 'اند', 'ذا', 'دي', 'لا', 'ال', 'بال', 'باكيت', 'باكت']);
  var WEAK = new Set(['مع', 'بدون', 'قليل', 'خالي', 'خال', 'كامل', 'منزوع', 'نكهه', 'بنكهه', 'طعم', 'بطعم', 'نوع', 'لون', 'عالي', 'منخفض', 'غني', 'اكثر', 'اقل']);
  var COLORS = { 'احمر': 'أحمر', 'حمراء': 'أحمر', 'ابيض': 'أبيض', 'بيضاء': 'أبيض', 'اسود': 'أسود', 'سوداء': 'أسود', 'اخضر': 'أخضر', 'خضراء': 'أخضر',
    'اصفر': 'أصفر', 'صفراء': 'أصفر', 'بني': 'بني', 'وردي': 'وردي', 'برتقالي': 'برتقالي', 'بنفسجي': 'بنفسجي', 'ذهبي': 'ذهبي' };
  var ORIGINS = ('لبناني مصري اردني سوري يمني كويتي سعودي اماراتي عماني قطري بحريني تركي ايراني هندي باكستاني سريلانكي صيني تايلندي تايلاندي فيتنامي ' +
    'فلبيني ماليزي اندونيسي ياباني كوري استرالي نيوزيلندي امريكي كندي مكسيكي تشيلي بيروفي برازيلي ارجنتيني كولومبي اكوادوري كوستاريكي اسباني ' +
    'ايطالي فرنسي هولندي الماني بلجيكي بولندي يوناني قبرصي بريطاني ايرلندي دنماركي سويسري برتغالي مغربي تونسي كيني اثيوبي اوغندي تنزاني افغاني ' +
    'فلسطيني عراقي اوزبكي محلي بلدي افريقي').split(' ');
  var ORIGIN_SET = new Set(ORIGINS);
  var FAT = [[/كامل(ه)?\s*الدسم/, 'كامل الدسم'], [/قليل(ه)?\s*الدسم/, 'قليل الدسم'], [/(خالي(ه)?|خال|منزوع(ه)?)\s*(من\s*)?الدسم/, 'خالي الدسم']];
  var ORIGIN_CATS = new Set([PRODUCE, CATS.indexOf('لحوم ودواجن')]);
  function words(it) {                   // normalized words of the name without its size, with the original spelling
    var l = label(it);
    if (it._w && it._wl === l) return it._w;
    it._wl = l;
    it._w = l.replace(SIZE_RE, ' ').replace(FIT_RE, ' ').replace(STAGE_RE, ' ').split(/[\s\-–—()[\]،,.+\/]+/).filter(Boolean).map(function (w) { return [norm(w), w]; });
    return it._w;
  }
  function facetVals(it) {               // values of every filter for one pack (cached)
    if (it._fv && it._fv.l === label(it)) return it._fv;
    var l = label(it), n = norm(l), ws = words(it), fv = { l: l, color: [], origin: [] };
    var m = l.match(FIT_RE); fv.fit = m ? 'مقاس ' + m[1].replace(/\s+/g, '') : '';
    m = l.match(STAGE_RE); fv.stage = m ? 'مرحلة ' + m[1].replace(/\s+/g, '') : '';
    m = l.match(SIZE_RE); fv.size = m ? arText(m[0].replace(/\s+/g, ' ').replace(/\s*[x×]\s*/, '×')) : '';
    fv.fat = ''; for (var i = 0; i < FAT.length; i++) if (FAT[i][0].test(n)) { fv.fat = FAT[i][1]; break; }
    if (it.cat === PRODUCE) ws.forEach(function (w) { var c = COLORS[w[0]] || COLORS[w[0].replace(/ه$/, '')]; if (c && fv.color.indexOf(c) < 0) fv.color.push(c); });
    if (ORIGIN_CATS.has(it.cat)) {
      if (/جنوب افريقي/.test(n)) fv.origin.push('جنوب أفريقيا');
      ws.forEach(function (w) { var k = w[0].replace(/ه$/, ''); if (k !== 'افريقي' && ORIGIN_SET.has(k)) { var lab = w[1].replace(/ة$/, ''); if (fv.origin.indexOf(lab) < 0) fv.origin.push(lab); } });
    }
    fv.brand = it.brand || '';
    it._fv = fv;
    return fv;
  }
  var FACET_TITLES = { fit: 'المقاس', stage: 'المرحلة', fat: 'الدسم', color: 'اللون', origin: 'المنشأ', brand: 'العلامة', kind: 'النوع', size: 'الحجم' };
  function numOf(s) { var m = norm(s).match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : 0; }
  var kindLabels = new Map();
  function facetsFor(items, gname) {
    var out = [], n = items.length;
    kindLabels = new Map();
    if (n < 4) return out;
    function tally(key) {
      var m = new Map();
      items.forEach(function (it) { var v = facetVals(it)[key]; (Array.isArray(v) ? v : v ? [v] : []).forEach(function (x) { m.set(x, (m.get(x) || 0) + 1); }); });
      return Array.from(m.entries());
    }
    function add(key, vals) { if (vals.length >= 2) out.push({ key: key, title: FACET_TITLES[key], values: vals.map(function (e) { return e[0]; }) }); }
    add('fit', tally('fit').sort(function (a, b) { return numOf(a[0]) - numOf(b[0]); }));
    add('stage', tally('stage').sort(function (a, b) { return numOf(a[0]) - numOf(b[0]); }));
    add('fat', tally('fat').sort(function (a, b) { return b[1] - a[1]; }));
    add('color', tally('color').sort(function (a, b) { return b[1] - a[1]; }));
    add('origin', tally('origin').sort(function (a, b) { return b[1] - a[1]; }));
    if (n >= 5) add('brand', tally('brand').sort(function (a, b) { return b[1] - a[1]; }));
    // kind: words shared by part of the packs (not the type, brand, colour, origin or fat — those have their own filter)
    var skip = new Set();
    toks(gname).forEach(function (w) { skip.add(w); skip.add(stripP(w)); });
    items.forEach(function (it) { if (it.brand) toks(it.brand).forEach(function (w) { skip.add(w); }); });
    Object.keys(COLORS).forEach(function (w) { skip.add(w); }); ORIGINS.forEach(function (w) { skip.add(w); skip.add(w + 'ه'); });
    ['الدسم', 'دسم', 'جنوب', 'افريقيا'].forEach(function (w) { skip.add(w); });
    var cnt = new Map(), orig = new Map();
    items.forEach(function (it) {
      var ws = words(it).map(function (p) { var t = p[0]; return !t || t.length < 2 || /\d/.test(t) || STOP.has(t) || skip.has(t) || skip.has(stripP(t)) ? null : p; });
      var seen = new Set();
      function put(k, o) { if (seen.has(k)) return; seen.add(k); cnt.set(k, (cnt.get(k) || 0) + 1); if (!orig.has(k)) orig.set(k, o); }
      for (var i = 0; i < ws.length; i++) {
        if (!ws[i]) continue;
        if (!WEAK.has(ws[i][0]) && ws[i][0].length >= 3) put(ws[i][0], ws[i][1]);
        if (ws[i + 1]) put(ws[i][0] + ' ' + ws[i + 1][0], ws[i][1] + ' ' + ws[i + 1][1]);
      }
    });
    var cands = Array.from(cnt.entries()).filter(function (e) { return e[1] >= 2 && e[1] >= n * 0.05 && e[1] <= n * 0.85; })
      .sort(function (a, b) { return b[1] - a[1] || b[0].length - a[0].length; });
    var picked = [];
    cands.forEach(function (e) {
      if (picked.length >= 16) return;
      var dup = picked.some(function (p) {
        var inside = (' ' + p[0] + ' ').indexOf(' ' + e[0] + ' ') >= 0 || (' ' + e[0] + ' ').indexOf(' ' + p[0] + ' ') >= 0;
        return inside && Math.abs(p[1] - e[1]) <= Math.max(1, Math.round(Math.max(p[1], e[1]) * 0.25));
      });
      if (!dup) picked.push(e);
    });
    if (picked.length >= 2 && n >= 6) { picked.forEach(function (e) { kindLabels.set(e[0], orig.get(e[0])); }); out.push({ key: 'kind', title: FACET_TITLES.kind, values: picked.map(function (e) { return e[0]; }) }); }
    var sizes = tally('size').sort(function (a, b) { return numOf(a[0]) - numOf(b[0]); });
    var covered = sizes.reduce(function (a, e) { return a + e[1]; }, 0);
    if (sizes.length >= 2 && covered >= n * 0.3) add('size', sizes);
    return out;
  }
  function hasPhrase(it, phrase) {
    var ws = words(it), f = phrase.split(' ');
    for (var i = 0; i + f.length <= ws.length; i++) { var ok = true; for (var j = 0; j < f.length; j++) if (ws[i + j][0] !== f[j]) { ok = false; break; } if (ok) return true; }
    return false;
  }
  function valueMatch(it, key, val) {
    if (key === 'kind') return hasPhrase(it, val);
    var v = facetVals(it)[key];
    return Array.isArray(v) ? v.indexOf(val) >= 0 : v === val;
  }
  function itemMatches(it, sel, skip) {    // OR inside a filter, AND between filters
    for (var k in sel) {
      if (k === skip || !sel[k] || !sel[k].length) continue;
      var ok = false;
      for (var i = 0; i < sel[k].length && !ok; i++) ok = valueMatch(it, k, sel[k][i]);
      if (!ok) return false;
    }
    return true;
  }
  function valueLabel(key, v) { return key === 'kind' ? arText(kindLabels.get(v) || v) : key === 'fit' || key === 'stage' ? arText(v) : v; }

  // ================================================================== packs of one type (sheet)
  var gState = null;
  function activeCount() { var n = 0; if (gState) for (var k in gState.sel) n += gState.sel[k].length; return n; }
  function openGroup(gi, focusId) {
    var g = GROUPS[gi]; if (!g) return;
    gState = { gi: gi, items: [], facets: [], sel: {}, text: '', shown: 0, focus: focusId || null, before: new Map() };
    cart.forEach(function (q, id) { var it = byId.get(id); if (it && it.g === gi) gState.before.set(id, q); });
    gTitle.textContent = arText(g[0]);
    gSub.textContent = nKinds(g[3]) + ' · ' + CATS[HEADS[g[1]][0]];
    gq.value = ''; gSearchBox.hidden = g[3] < 15; gFilterBar.innerHTML = '';
    gList.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
    if (gsheet.hidden) openLayer(gsheet);
    afterItems(function () {
      if (!gState || gState.gi !== gi) return;
      gState.items = groupItems[gi] || [];
      gState.facets = facetsFor(gState.items, g[0]);
      renderGroup(true);
    });
  }
  function filtered() {
    var base = gState.items;
    if (gState.text) { var r = searchItems(base, gState.text); base = r ? r.map(function (x) { return x.it; }) : base; }
    gState.base = base;
    return base.filter(function (it) { return itemMatches(it, gState.sel); });
  }
  function countFor(f, v) {
    var c = 0, base = gState.base || gState.items;
    for (var i = 0; i < base.length; i++) if (itemMatches(base[i], gState.sel, f.key) && valueMatch(base[i], f.key, v)) c++;
    return c;
  }
  // filter bar: «تصفية» + the chosen filters (each with ×) + «مسح الكل», or one-tap chips of the most useful filter
  function renderFilterBar() {
    gFilterBar.innerHTML = '';
    var fs = gState.facets;
    gTools.hidden = gSearchBox.hidden && !fs.length;
    gFilterBar.hidden = !fs.length;
    if (!fs.length) return;
    var n = activeCount();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'fbtn'; b.dataset.act = 'filters';
    b.innerHTML = FILTER_ICON + '<span>تصفية</span>' + (n ? '<span class="n">' + ar(n) + '</span>' : ''); gFilterBar.appendChild(b);
    if (n) {
      fs.forEach(function (f) { (gState.sel[f.key] || []).forEach(function (v) {
        var c = document.createElement('button'); c.type = 'button'; c.className = 'chip on-x'; c.dataset.fkey = f.key; c.dataset.fval = v; c.dataset.act = 'unsel';
        c.setAttribute('aria-label', 'إزالة الفلتر ' + valueLabel(f.key, v)); c.innerHTML = '<span></span><span class="x" aria-hidden="true">×</span>'; c.firstChild.textContent = valueLabel(f.key, v);
        gFilterBar.appendChild(c);
      }); });
      var cl = document.createElement('button'); cl.type = 'button'; cl.className = 'text-btn'; cl.dataset.act = 'clearf'; cl.textContent = 'مسح الكل'; gFilterBar.appendChild(cl);
      return;
    }
    var f = fs[0], t = document.createElement('span'); t.className = 'ftitle-inline'; t.textContent = f.title; gFilterBar.appendChild(t);
    f.values.forEach(function (v) {
      var c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.dataset.fkey = f.key; c.dataset.fval = v; c.dataset.act = 'sel';
      var k = countFor(f, v); if (!k) c.classList.add('zero');
      c.innerHTML = '<span></span><span class="n"></span>'; c.firstChild.textContent = valueLabel(f.key, v); c.lastChild.textContent = ar(k);
      gFilterBar.appendChild(c);
    });
  }
  function renderPanel() {
    fBody.innerHTML = '';
    gState.facets.forEach(function (f) {
      var box = document.createElement('div'); box.className = 'fgroup';
      var h = document.createElement('h3'); h.textContent = f.title; box.appendChild(h);
      var chips = document.createElement('div'); chips.className = 'chips';
      f.values.forEach(function (v) {
        var on = (gState.sel[f.key] || []).indexOf(v) >= 0, k = countFor(f, v);
        var c = document.createElement('button'); c.type = 'button'; c.className = 'chip' + (k || on ? '' : ' zero'); c.dataset.fkey = f.key; c.dataset.fval = v; c.dataset.act = 'toggle';
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
        c.innerHTML = '<span></span><span class="n"></span>'; c.firstChild.textContent = valueLabel(f.key, v); c.lastChild.textContent = ar(k);
        chips.appendChild(c);
      });
      box.appendChild(chips); fBody.appendChild(box);
    });
    var n = gState.list ? gState.list.length : 0;
    fApply.textContent = n ? 'عرض ' + nPacks(n) : 'لا توجد عبوة بهذا الاختيار';
    fClear.hidden = !activeCount();
  }
  function renderGroup(reset) {
    var list = reset ? (gState.list = filtered()) : gState.list, n = list.length;
    if (reset) {
      renderFilterBar();
      if (!fpanel.hidden) renderPanel();
      gList.innerHTML = ''; gState.shown = 0; gList.scrollTop = 0;
      var info = document.createElement('p'); info.className = 'info';
      var usualN = list.filter(function (it) { return it.u > 0; }).length;
      info.textContent = activeCount() || gState.text ? (n ? (n === 1 ? 'عبوة واحدة مطابقة' : nPacks(n) + ' مطابقة') : 'لا توجد عبوة بهذا الاختيار — امسحي أحد الفلاتر') :
        (usualN ? 'العبوات التي تشترونها عادةً في الأعلى. يمكنك اختيار أكثر من عبوة بكميات مختلفة.' : 'يمكنك اختيار أكثر من عبوة بكميات مختلفة.');
      gList.appendChild(info);
      var wrap = document.createElement('div'); wrap.className = 'plist'; gList.appendChild(wrap);
    }
    var host = gList.querySelector('.plist');
    var end = Math.min(n, gState.shown + 40);
    if (gState.focus) { var fi = list.findIndex(function (it) { return it.id === gState.focus; }); if (fi >= end) end = Math.min(n, fi + 8); }
    var frag = document.createDocumentFragment();
    for (var i = gState.shown; i < end; i++) frag.appendChild(packRow(list[i]));
    var old = gList.querySelector('.more'); if (old) old.remove();
    host.appendChild(frag); gState.shown = end;
    if (end < n) { var m = document.createElement('button'); m.type = 'button'; m.className = 'more'; m.dataset.act = 'gmore'; m.textContent = 'عرض المزيد (' + ar(n - end) + ')'; gList.appendChild(m); }
    if (reset && gState.focus) {
      var el = gList.querySelector('.prow[data-id="' + cssId(gState.focus) + '"]');
      if (el) { el.classList.add('flash'); try { el.scrollIntoView({ block: 'center' }); } catch (e) { } }
      gState.focus = null;
    }
  }
  function toggleSel(key, val, on) {
    var arr = gState.sel[key] || (gState.sel[key] = []), i = arr.indexOf(val);
    if (on === undefined) on = i < 0;
    if (on && i < 0) arr.push(val); if (!on && i >= 0) arr.splice(i, 1);
    renderGroup(true);
  }
  gFilterBar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !gState) return;
    var a = b.dataset.act;
    if (a === 'filters') { renderPanel(); openLayer(fpanel); }
    else if (a === 'sel') toggleSel(b.dataset.fkey, b.dataset.fval, true);
    else if (a === 'unsel') toggleSel(b.dataset.fkey, b.dataset.fval, false);
    else if (a === 'clearf') { gState.sel = {}; renderGroup(true); }
  });
  fBody.addEventListener('click', function (e) { var b = e.target.closest('[data-act="toggle"]'); if (b && gState) toggleSel(b.dataset.fkey, b.dataset.fval); });
  fClear.addEventListener('click', function () { if (gState) { gState.sel = {}; renderGroup(true); } });
  fApply.addEventListener('click', function () { closeTop(); });
  var gqTimer = 0;
  gq.addEventListener('input', function () { clearTimeout(gqTimer); gqTimer = setTimeout(function () { if (gState) { gState.text = gq.value.trim(); renderGroup(true); } }, 150); });
  gq.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); gq.blur(); } });
  gList.addEventListener('scroll', function () { if (gState && gList.querySelector('.more') && gList.scrollTop + gList.clientHeight > gList.scrollHeight - 600) renderGroup(false); }, { passive: true });
  // on closing: say what was added from this type and point at its card
  function groupClosed(st) {
    var added = 0, changed = 0;
    cart.forEach(function (q, id) { var it = byId.get(id); if (it && it.g === st.gi) { var b = st.before.get(id) || 0; if (q !== b) changed++; if (!b) added++; } });
    st.before.forEach(function (q, id) { if (!cart.has(id)) changed++; });
    var card = document.querySelector('.gcard[data-g="' + st.gi + '"]');
    if (card) { card.classList.remove('pulse'); void card.offsetWidth; if (changed) card.classList.add('pulse'); }
    if (changed) { var n = groupSel(st.gi); toast(n ? 'في السلة من «' + arText(GROUPS[st.gi][0]) + '»: ' + nPacks(n) + (added ? ' (أُضيف ' + nPacks(added) + ')' : '') : 'لا شيء من «' + arText(GROUPS[st.gi][0]) + '» في السلة'); }
  }

  // ================================================================== quantity changes
  function setQty(id, q) {
    q = Math.max(0, Math.min(MAX_QTY, Math.floor(q)));
    var prev = cart.get(id) || 0;
    if (q === prev) { if (q === MAX_QTY) toast('الحد الأقصى للكمية ' + ar(MAX_QTY)); return; }
    if (q) cart.set(id, q); else cart.delete(id);
    version++; saveCart(); refreshItem(id);
    if (!cartSheet.hidden) renderCart();
    updateBar(); schedulePdf();
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target, btn = t.closest('[data-act]');
    if (btn) {
      var act = btn.dataset.act;
      if (act === 'more') { searchLimit += 40; renderSearch(); return; }
      if (act === 'gmore') { renderGroup(false); return; }
      if (act === 'hopen') { openHistory(); return; }
      if (act === 'hadd') { var hi = +btn.dataset.h; if (layers[layers.length - 1] === hpanel) closeTop(); addFromHistory(hi); return; }
      if (act === 'bulk') { plan().U.forEach(function (x) { storeChoice[x.it.id] = btn.dataset.s; }); writeJSON(LS_STORE, storeChoice); version++; renderCart(); updateBar(); schedulePdf(); toast('وُضعت الأصناف في ' + SHORT[btn.dataset.s] + '. يمكن تغيير أي صنف منها.'); return; }
      if (act === 'choose') { var cid = btn.closest('[data-id]').dataset.id; if (btn.dataset.s) storeChoice[cid] = btn.dataset.s; else delete storeChoice[cid]; writeJSON(LS_STORE, storeChoice); version++; renderCart(); updateBar(); schedulePdf(); return; }
      if (act === 'add' || act === 'inc' || act === 'dec') {
        var host = btn.closest('[data-id]'); if (!host) return;
        var id = host.dataset.id, q = cart.get(id) || 0;
        setQty(id, act === 'add' ? 1 : act === 'inc' ? q + 1 : q - 1);
        return;
      }
      return;
    }
    var go = t.closest('.gopen'); if (go) { openGroup(+go.closest('.gcard').dataset.g); return; }
    var more = t.closest('.more-link, .more-card'); if (more) { showView(+more.dataset.view); return; }
    var gchip = t.closest('.chips .chip[data-g]'); if (gchip) { openGroup(+gchip.dataset.g); return; }
    var pg = t.closest('.p-group'); if (pg) { var h = pg.closest('[data-id]'); openGroup(+pg.dataset.g, h && h.dataset.id); return; }
    var pic = t.closest('.pic'); if (pic) { var hh = pic.closest('[data-id]'); if (hh) openViewer(hh.dataset.id); return; }
    if (t.closest('[data-close]')) { closeTop(); return; }
    if (t === fpanel || t === hpanel) closeTop();
  });

  // ================================================================== basket review
  function cartRow(x, kind) {
    var it = x.it, ss = splitSize(it), row = document.createElement('div');
    row.className = 'crow'; row.dataset.id = it.id;
    var total = x.d.unit ? money(x.d.unit * x.q) : '';
    row.innerHTML = '<button class="pic" type="button"><img alt="" loading="lazy" decoding="async"></button><div>' +
      '<div class="c-top"><p class="c-name"></p><span class="c-total"></span></div><p class="c-size"></p>' +
      '<div class="c-bottom"><div class="ctrl"></div><span class="c-unit"></span></div><p class="reason"></p></div>';
    row.querySelector('img').src = thumbUrl(it);
    row.querySelector('.pic').setAttribute('aria-label', 'عرض الصورة: ' + label(it));
    row.querySelector('.c-name').textContent = arText(ss.base);
    row.querySelector('.c-total').textContent = total;
    row.querySelector('.c-size').textContent = arText(ss.size);
    var c = row.querySelector('.ctrl'); c.dataset.id = it.id; c.innerHTML = ctrlHTML(x.q);
    row.querySelector('.c-unit').textContent = x.d.unit ? money(x.d.unit) + ' × ' + ar(x.q) : (kind === 'S' ? 'السعر غير متاح' : '');
    var r = row.querySelector('.reason'); r.textContent = reasonText(x);
    if (kind === 'U' || kind === 'R') r.classList.add('warn');
    if (kind === 'U') {
      var d = document.createElement('div'); d.className = 'decide';
      d.innerHTML = '<button type="button" class="L" data-act="choose" data-s="L">لولو</button><button type="button" class="T" data-act="choose" data-s="T">طلبات مارت</button>';
      row.lastChild.appendChild(d);
    } else if (x.d.chosen) {
      var ch = document.createElement('button'); ch.type = 'button'; ch.className = 'text-btn'; ch.dataset.act = 'choose'; ch.textContent = 'تغيير المتجر'; ch.style.minHeight = '32px'; ch.style.padding = '0';
      row.lastChild.appendChild(ch);
    }
    return row;
  }
  function storeBlock(code, title, sub, lines, kind) {
    var box = document.createElement('section'); box.className = 'store-block';
    var head = document.createElement('div'); head.className = 'store-head ' + code;
    var h3 = document.createElement('h3'); h3.appendChild(document.createTextNode(title));
    if (sub) { var s = document.createElement('small'); s.textContent = sub; h3.appendChild(s); }
    head.appendChild(h3); box.appendChild(head);
    var lastCat = null;
    lines.forEach(function (x) {
      if (x.it.cat !== lastCat) { lastCat = x.it.cat; var h = document.createElement('h4'); h.className = 'cat-h'; h.textContent = CATS[lastCat] || ''; box.appendChild(h); }
      box.appendChild(cartRow(x, kind));
    });
    return box;
  }
  function renderCart() {
    var top = cartBody.scrollTop;
    cartBody.innerHTML = '';
    if (!cart.size) {
      cartBody.innerHTML = '<div class="empty"><p>السلة فارغة.</p><button class="secondary" type="button" data-close>تصفح المنتجات</button></div>';
      if (history_().length) { var hh = document.createElement('div'); hh.className = 'hist-inline'; var t = document.createElement('h3'); t.textContent = 'ابدئي من قائمة سابقة'; hh.appendChild(t); var lst = document.createElement('div'); hh.appendChild(lst); cartBody.appendChild(hh); afterItems(function () { renderHistory(lst); }); }
      cartSub.textContent = ''; clearBtn.hidden = true; return;
    }
    if (!cartKnown()) { cartBody.innerHTML = '<p class="hint">جارٍ تحميل المنتجات…</p>'; afterItems(function () { pruneCart(); if (!cartSheet.hidden) renderCart(); }); return; }
    var P = plan(), frag = document.createDocumentFragment();
    var note = document.createElement('p'); note.className = 'cart-note';
    note.textContent = 'وزّع التطبيق السلة تلقائيًا: الخضار والفواكه من طلبات مارت، وبقية العبوات من المتجر الأرخص بحسب آخر سعر متاح' +
      (PRICE_DATE ? ' (' + priceDateText() + ')' : '') + '، دون رسوم التوصيل.';
    frag.appendChild(note);
    ['L', 'T'].forEach(function (s) {
      if (!P[s].length) return;
      var sub = nItems(P[s].length) + (P.total[s] ? ' · ' + money(P.total[s]) : '') + (P.missing[s] ? ' · ' + countOf(P.missing[s], 'صنف', 'صنفان', 'أصناف', 'صنفًا') + ' بلا سعر' : '');
      frag.appendChild(storeBlock(s, STORES[s], sub, P[s], 'S'));
    });
    if (P.U.length) {
      var ub = storeBlock('U', 'بحاجة إلى تحديد المتجر', nItems(P.U.length), P.U, 'U');
      if (P.U.length > 1) {
        var bulk = document.createElement('div'); bulk.className = 'bulk';
        bulk.innerHTML = '<span>للأصناف كلها:</span><button type="button" class="L" data-act="bulk" data-s="L">لولو</button><button type="button" class="T" data-act="bulk" data-s="T">طلبات مارت</button>';
        ub.insertBefore(bulk, ub.children[1]);
      }
      frag.appendChild(ub);
    }
    if (P.R.length) frag.appendChild(storeBlock('R', 'تحتاج مراجعة', nItems(P.R.length), P.R, 'R'));
    var sum = document.createElement('div'), rows = []; sum.className = 'cart-sum';
    if (P.L.length) rows.push(['لولو هايبرماركت', P.total.L ? money(P.total.L) : '—']);
    if (P.T.length) rows.push(['طلبات مارت', P.total.T ? money(P.total.T) : '—']);
    rows.push(['المجموع (العبوات ذات السعر)', money(P.total.L + P.total.T)]);
    sum.innerHTML = rows.map(function (r, i) { return '<div' + (i === rows.length - 1 ? ' style="border-top:1px solid var(--line);margin-top:4px;padding-top:7px"' : '') + '><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('');
    frag.appendChild(sum);
    if (history_().length) { var hl = document.createElement('button'); hl.type = 'button'; hl.className = 'more'; hl.dataset.act = 'hopen'; hl.textContent = 'القوائم السابقة (' + ar(history_().length) + ')'; frag.appendChild(hl); }
    cartBody.appendChild(frag);
    cartBody.scrollTop = top;
    var t = 0; cart.forEach(function (q) { t += q; });
    cartSub.textContent = nItems(cart.size) + ' · ' + countOf(t, 'قطعة', 'قطعتان', 'قطع', 'قطعة');
    clearBtn.hidden = false;
  }

  cartBtn.addEventListener('click', function () { if (!cartSheet.hidden) { closeTop(); return; } renderCart(); openLayer(cartSheet); });
  clearBtn.addEventListener('click', function () {
    if (!cart.size || !window.confirm('مسح كل المنتجات من السلة؟')) return;
    var backup = new Map(cart), ids = Array.from(cart.keys());
    cart.clear(); version++; saveCart(); ids.forEach(refreshItem); renderCart(); updateBar(); schedulePdf();
    toast('تم مسح السلة', 'تراجع', function () { backup.forEach(function (q, id) { cart.set(id, q); }); version++; saveCart(); ids.forEach(refreshItem); renderCart(); updateBar(); schedulePdf(); });
  });
  function updateBar() {
    var n = cart.size;
    cartCount.hidden = !n; cartCount.textContent = ar(n);
    cartBtn.classList.toggle('empty-cart', !n);
    if (!n) { cartLine1.textContent = 'السلة فارغة'; cartLine2.textContent = 'اختاري المنتجات ثم راجعي السلة وشاركيها'; document.title = 'قائمة الجمعية'; return; }
    var P = cartKnown() ? plan() : null;
    cartLine1.textContent = 'السلة · ' + nItems(n) + (P && (P.total.L + P.total.T) ? ' · ' + money(P.total.L + P.total.T) : '');
    cartLine2.textContent = P ? [P.L.length ? 'لولو ' + ar(P.L.length) : '', P.T.length ? 'طلبات مارت ' + ar(P.T.length) : '', P.U.length ? 'بلا متجر ' + ar(P.U.length) : '', P.R.length ? 'للمراجعة ' + ar(P.R.length) : ''].filter(Boolean).join(' · ') + ' — راجعي ثم شاركي' : 'راجعي السلة ثم شاركي';
    document.title = '(' + ar(n) + ') قائمة الجمعية';
  }
  function setSizes() {
    document.documentElement.style.setProperty('--bar-h', barEl.offsetHeight + 'px');
    document.documentElement.style.setProperty('--top-h', topEl.offsetHeight + 'px');
  }

  // ================================================================== PDF (prepared ahead of the tap, same decisions as the basket)
  var pdf = { status: 'empty', version: -1, result: null }, buildTimer = 0, building = false, again = false;
  function pdfDoc() {
    var P = plan();
    function entry(x) { var ss = splitSize(x.it); return { name: ss.base, size: ss.size, qty: x.q, img: medUrl(x.it), unit: x.d.unit || null, total: x.d.unit ? x.d.unit * x.q : null }; }
    function sections(lines) {
      var out = [], cur = null;
      lines.forEach(function (x) { if (!cur || cur.cat !== x.it.cat) { cur = { cat: x.it.cat, name: CATS[x.it.cat] || '', items: [] }; out.push(cur); } cur.items.push(entry(x)); });
      return out;
    }
    var stores = [];
    ['L', 'T'].forEach(function (s) { if (P[s].length) stores.push({ code: s, name: STORES[s], total: P.total[s], missing: P.missing[s], count: P[s].length, sections: sections(P[s]) }); });
    var extra = [];
    if (P.U.length) extra.push({ code: 'U', name: 'بحاجة إلى تحديد المتجر', note: 'لم يُحسم متجرها: السعر غير متاح في أحد المتجرين أو لم يُوثَّق المتجر.', count: P.U.length, sections: sections(P.U) });
    if (P.R.length) extra.push({ code: 'R', name: 'تحتاج مراجعة', note: 'خضار وفواكه غير مدرجة في طلبات مارت.', count: P.R.length, sections: sections(P.R) });
    return { stores: stores, extra: extra, link: listUrl(P), priceNote: PRICE_DATE ? 'الأسعار بحسب آخر تحديث: ' + priceDateText() + ' — دون رسوم التوصيل' : '' };
  }
  function schedulePdf(delay) {
    clearTimeout(buildTimer);
    if (!cart.size) { pdf = { status: 'empty', version: version, result: null }; updateShare(); return; }
    if (!(pdf.status === 'ready' && pdf.version === version)) pdf.status = 'building';
    updateShare();
    buildTimer = setTimeout(runBuild, delay == null ? 300 : delay);
  }
  function runBuild() {
    if (building) { again = true; return; }
    if (!cart.size) return;
    if (!cartKnown()) { afterItems(function () { pruneCart(); schedulePdf(0); }); return; }
    if (!window.ShoppingPdf) { pdf = { status: 'error', version: version, result: null }; updateShare(); return; }
    building = true;
    var v = version;
    window.ShoppingPdf.build(pdfDoc(), { isCancelled: function () { return v !== version; } }).then(function (res) {
      if (v !== version) return;
      pdf = { status: 'ready', version: v, result: res };
    }, function (err) {
      if (v !== version || (err && err.message === 'cancelled')) return;
      console.error('PDF build failed', err); pdf = { status: 'error', version: v, result: null };
    }).then(function () {
      building = false;
      if ((again || v !== version) && cart.size) { again = false; runBuild(); }
      updateShare();
      if (!previewEl.hidden) renderPreview();
    });
  }
  function shareSupport() {
    if (!window.isSecureContext) return 'insecure';
    if (!navigator.share || !navigator.canShare) return 'no';
    try { return navigator.canShare({ files: [new File([new Uint8Array([37, 80, 68, 70])], 't.pdf', { type: 'application/pdf' })] }) ? 'yes' : 'no'; } catch (e) { return 'no'; }
  }
  var SHARE = shareSupport(), shareFailed = false, sharing = false;
  function isReady() { return pdf.status === 'ready' && pdf.version === version && cart.size > 0; }
  function updateShare() {
    SHARE = shareSupport();
    var n = cart.size, ready = isReady(), error = n > 0 && pdf.status === 'error' && pdf.version === version, busy = n > 0 && !ready && !error;
    var useShare = SHARE === 'yes';
    shareBtn.hidden = !useShare; downloadBtn.hidden = useShare && !shareFailed;
    shareBtn.disabled = !(ready || error); shareBtn.classList.toggle('busy', busy);
    shareLabel.textContent = busy ? 'جارٍ تجهيز الملف…' : error ? 'تعذّر تجهيز الملف — أعيدي المحاولة' : 'مشاركة القائمة';
    downloadBtn.disabled = !ready; downloadBtn.textContent = busy ? 'جارٍ تجهيز الملف…' : 'تنزيل PDF';
    previewBtn.disabled = !n;
    var note = SHARE === 'insecure' ? 'المشاركة المباشرة تحتاج رابطًا يبدأ بـ https. نزّلي الملف وأرسليه يدويًا.' :
      SHARE === 'no' ? 'هذا المتصفح لا يدعم مشاركة الملفات. نزّلي الملف ثم أرسليه من واتساب.' :
      shareFailed ? 'تعذّر فتح قائمة المشاركة. جرّبي مرة أخرى أو نزّلي الملف.' : '';
    barNote.textContent = note; barNote.hidden = !note;
  }
  shareBtn.addEventListener('click', function () {
    if (pdf.status === 'error' && pdf.version === version) { schedulePdf(0); return; }
    if (!isReady() || sharing) return;
    var file = pdf.result.file, data = { files: [file], title: 'قائمة المشتريات', text: shareText(plan()) }, p;
    try { if (navigator.canShare && !navigator.canShare(data)) data = { files: [file] }; sharing = true; p = navigator.share(data); }
    catch (err) { sharing = false; shareFailed = true; updateShare(); return; }
    Promise.resolve(p).then(function () { saveHistory(); if (shareFailed) { shareFailed = false; updateShare(); } }, function (err) {
      var nm = err && err.name; if (nm === 'AbortError' || nm === 'InvalidStateError') return; shareFailed = true; updateShare();
    }).then(function () { sharing = false; });
  });
  downloadBtn.addEventListener('click', function () {
    if (!isReady()) return;
    var res = pdf.result, url = URL.createObjectURL(res.blob), a = document.createElement('a');
    a.href = url; a.download = res.name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    saveHistory();
    toast('تم تنزيل الملف: ' + res.name);
  });
  function clearPreview() { pvPages.querySelectorAll('img').forEach(function (im) { URL.revokeObjectURL(im.src); }); pvPages.innerHTML = ''; }
  function renderPreview() {
    clearPreview();
    if (!isReady()) { pvInfo.textContent = cart.size ? 'جارٍ تجهيز الملف…' : 'السلة فارغة'; return; }
    var res = pdf.result, kb = Math.max(1, Math.round(res.blob.size / 1024));
    pvInfo.textContent = countOf(res.pageCount, 'صفحة واحدة', 'صفحتان', 'صفحات', 'صفحة') + ' · ' + (kb >= 1024 ? ar((kb / 1024).toFixed(1)).replace('.', '٫') + ' ميجابايت' : ar(kb) + ' كيلوبايت');
    res.pages.forEach(function (b, i) { var im = document.createElement('img'); im.alt = 'الصفحة ' + ar(i + 1); im.src = URL.createObjectURL(b); pvPages.appendChild(im); });
  }
  previewBtn.addEventListener('click', function () { renderPreview(); openLayer(previewEl); });

  // ================================================================== layers + back button (the page underneath keeps its place)
  var layers = [], skipPop = 0, quiet = new Set();
  // quiet: a layer that is the page itself (the checklist opened from a link) adds no back-button step
  function openLayer(el, isQuiet) {
    if (layers.indexOf(el) >= 0) return;
    layers.push(el);
    // the type view stays under the basket bar (the basket is one tap away); the basket, preview and filters cover it
    if (el !== viewer) el.style.zIndex = String(el === fpanel || el === hpanel ? 47 + layers.length : el === gsheet ? 30 + layers.length : 46 + layers.length);
    el.hidden = false; document.body.style.overflow = 'hidden';
    if (isQuiet) quiet.add(el); else try { history.pushState({ jamiyaLayer: layers.length }, ''); } catch (e) { }
    var f = el.querySelector('[data-close]'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { }
  }
  function closeTop(fromPop) {
    var el = layers.pop(); if (!el) return;
    if (quiet.delete(el)) fromPop = true;
    el.hidden = true;
    if (!layers.length) document.body.style.overflow = '';
    if (el === viewer) { viewerId = null; vImgBox.classList.remove('zoomed'); }
    if (el === previewEl) clearPreview();
    if (el === shopEl) { shopList = null; closeShopLink(); }
    if (el === gsheet) { var st = gState; gState = null; gList.innerHTML = ''; if (st) groupClosed(st); }
    if (!fromPop) { skipPop++; try { history.back(); } catch (e) { skipPop--; } }
  }
  window.addEventListener('popstate', function () { if (skipPop) { skipPop--; return; } if (layers.length) closeTop(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && layers.length) closeTop(); });

  // ================================================================== photo viewer
  var viewerId = null;
  function openViewer(id) {
    var it = byId.get(id); if (!it) return;
    viewerId = id; vCtrl.dataset.id = id; vImgBox.classList.remove('zoomed');
    var ss = splitSize(it), g = GROUPS[it.g];
    vImg.src = medUrl(it); vImg.alt = label(it);
    vName.textContent = arText(ss.base); vSize.textContent = arText(ss.size);
    vPrice.innerHTML = it.hid ? 'غير متوفر في طلبات مارت' : priceHint(it);
    vGroupName.textContent = g ? arText(g[0]) : '';
    vGroup.hidden = !g || g[3] < 2 || layers.indexOf(gsheet) >= 0;
    vCtrl.innerHTML = ctrlHTML(cart.get(id) || 0);
    openLayer(viewer);
  }
  vImg.addEventListener('click', function () { vImgBox.classList.toggle('zoomed'); });
  vGroup.addEventListener('click', function () {      // the photo is replaced by every pack of its type, in the same back-button step
    var it = byId.get(viewerId); if (!it || layers[layers.length - 1] !== viewer) return;
    layers.pop(); viewer.hidden = true; viewerId = null;
    layers.push(gsheet); gsheet.style.zIndex = String(30 + layers.length); gsheet.hidden = false;
    openGroup(it.g, it.id);
  });
  vRename.addEventListener('click', function () {
    var it = byId.get(viewerId); if (!it) return;
    var v = window.prompt('اسم المنتج (اتركيه فارغًا لإرجاع الاسم الأصلي):', displayName(it));
    if (v === null) return;
    v = v.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!v || v === (it.name || '').trim()) delete names[it.id]; else names[it.id] = v;
    writeJSON(LS_NAMES, names); it._tok = null; it._ss = null; it._fv = null; it._w = null;
    var ss = splitSize(it); vName.textContent = arText(ss.base); vSize.textContent = arText(ss.size);
    if (cart.has(it.id)) { version++; schedulePdf(); if (!cartSheet.hidden) renderCart(); }
  });

  // ================================================================== toast
  var toastTimer = 0;
  function toast(msg, actLabel, action) {
    toastEl.innerHTML = ''; var s = document.createElement('span'); s.textContent = msg; toastEl.appendChild(s);
    if (actLabel) { var b = document.createElement('button'); b.type = 'button'; b.textContent = actLabel; b.addEventListener('click', function () { toastEl.hidden = true; action(); }); toastEl.appendChild(b); }
    toastEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.hidden = true; }, actLabel ? 6000 : 3200);
  }

  // ================================================================== other tabs of the same phone
  window.addEventListener('storage', function (e) {
    if (e.key === LS_CART) { var before = Array.from(cart.keys()); if (loadCart()) saveCart(); version++; before.concat(Array.from(cart.keys())).forEach(refreshItem); if (!cartSheet.hidden) renderCart(); updateBar(); schedulePdf(); }
    else if (e.key === LS_STORE) { storeChoice = readJSON(LS_STORE, {}) || {}; version++; if (!cartSheet.hidden) renderCart(); updateBar(); schedulePdf(); }
  });

  // ================================================================== the shared list as a link: a checklist for whoever does the shopping
  // #l=1.<time>.<entries>; entry = product number in base 36 (or ~id~), the store (L, T, U = to decide, R = to review), the quantity
  function keyOf(id) { var m = /^p(\d+)$/.exec(id); return m ? (+m[1]).toString(36) : '~' + encodeURIComponent(id) + '~'; }
  function listUrl(P) {
    var parts = [];
    [['L', P.L], ['T', P.T], ['U', P.U], ['R', P.R]].forEach(function (pr) { pr[1].forEach(function (x) { parts.push(keyOf(x.it.id) + pr[0] + x.q); }); });
    if (!parts.length) return '';
    return location.origin + location.pathname + '#l=1.' + Date.now().toString(36) + '.' + parts.join('.');
  }
  function parseList(hash) {
    var m = /^#l=1\.([0-9a-z]+)\.(.+)$/.exec(hash || '');
    if (!m) return null;
    var lines = [];
    m[2].split('.').forEach(function (e) {
      var x = /^(~[^~]+~|[0-9a-z]+)([LTUR])(\d+)$/.exec(e);
      if (!x) return;
      var id = x[1].charAt(0) === '~' ? decodeURIComponent(x[1].slice(1, -1)) : 'p' + String(parseInt(x[1], 36)).padStart(3, '0');
      lines.push({ id: canonical(id), s: x[2], q: Math.min(MAX_QTY, +x[3] || 1) });
    });
    return lines.length ? { t: parseInt(m[1], 36), lines: lines, key: m[1] + '.' + lines.length } : null;
  }
  function shareText(P) {
    var n = P.L.length + P.T.length + P.U.length + P.R.length, rows = ['قائمة المشتريات — ' + nItems(n)];
    if (P.L.length) rows.push('لولو: ' + nItems(P.L.length) + (P.total.L ? ' · ' + money(P.total.L) : ''));
    if (P.T.length) rows.push('طلبات مارت: ' + nItems(P.T.length) + (P.total.T ? ' · ' + money(P.total.T) : ''));
    if (P.U.length) rows.push('بحاجة إلى تحديد المتجر: ' + nItems(P.U.length));
    if (P.R.length) rows.push('تحتاج مراجعة: ' + nItems(P.R.length));
    var url = listUrl(P);
    if (url) rows.push('للتأشير على المشتريات أثناء التسوق: ' + url);
    return rows.join('\n');
  }

  // ---------------------------------------------------------------- shopping checklist (opened from the link)
  var shopEl = $('#shop'), shopBody = $('#shopBody'), shopSub = $('#shopSub'), shopBar = $('#shopBar'), shopCount = $('#shopCount'), shopHide = $('#shopHide');
  var LS_TICKS = 'jamiya.ticks.v1', shopList = null, ticks = new Set();
  function loadTicks(key) { var all = readJSON(LS_TICKS, {}) || {}; return new Set((all[key] && all[key].done) || []); }
  function saveTicks() {
    if (!shopList) return;
    var all = readJSON(LS_TICKS, {}) || {};
    all[shopList.key] = { t: Date.now(), done: Array.from(ticks) };
    var keys = Object.keys(all).sort(function (a, b) { return (all[b].t || 0) - (all[a].t || 0); });
    keys.slice(8).forEach(function (k) { delete all[k]; });        // keep the last few lists only
    writeJSON(LS_TICKS, all);
  }
  function shopProgress() {
    var total = shopList ? shopList.lines.length : 0, done = 0;
    if (shopList) shopList.lines.forEach(function (l) { if (ticks.has(l.id)) done++; });
    shopCount.textContent = 'تم ' + ar(done) + ' من ' + ar(total);
    shopBar.style.width = total ? Math.round(done * 100 / total) + '%' : '0';
  }
  function openShop(list) {
    shopList = list; ticks = loadTicks(list.key);
    try {
      var d = new Date(list.t);
      shopSub.textContent = 'أُرسلت ' + new Intl.DateTimeFormat('ar-KW-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'long' }).format(d) + '، ' +
        new Intl.DateTimeFormat('ar-KW-u-nu-arab', { hour: 'numeric', minute: '2-digit' }).format(d);
    } catch (e) { shopSub.textContent = ''; }
    shopBody.innerHTML = '<p class="hint">جارٍ تحميل القائمة…</p>';
    shopProgress();
    openLayer(shopEl, true);
    afterItems(renderShop);
  }
  function renderShop() {
    if (!shopList) return;
    shopBody.innerHTML = '';
    var groups = { L: [], T: [], U: [], R: [] }, unknown = 0;
    shopList.lines.forEach(function (l) { var it = byId.get(l.id); if (!it) { unknown++; return; } groups[l.s].push({ it: it, q: l.q }); });
    var titles = { L: STORES.L, T: STORES.T, U: 'بحاجة إلى تحديد المتجر', R: 'تحتاج مراجعة' };
    var frag = document.createDocumentFragment();
    ['L', 'T', 'U', 'R'].forEach(function (s) {
      var lines = groups[s]; if (!lines.length) return;
      lines.sort(function (a, b) { return a.it.cat - b.it.cat || (a.it.i || 0) - (b.it.i || 0); });
      var total = 0, missing = 0;
      if (s === 'L' || s === 'T') lines.forEach(function (x) { var p = offer(x.it, s); if (p > 0) total += p * x.q; else missing++; });
      var box = document.createElement('section'); box.className = 'store-block';
      var head = document.createElement('div'); head.className = 'store-head ' + s;
      var h3 = document.createElement('h3'); h3.appendChild(document.createTextNode(titles[s]));
      var sm = document.createElement('small'); sm.textContent = nItems(lines.length) + (total ? ' · ' + money(total) + (missing ? ' + ' + countOf(missing, 'صنف', 'صنفان', 'أصناف', 'صنفًا') + ' بلا سعر' : '') : ''); h3.appendChild(sm);
      head.appendChild(h3); box.appendChild(head);
      var lastCat = null;
      lines.forEach(function (x) {
        if (x.it.cat !== lastCat) { lastCat = x.it.cat; var h = document.createElement('h4'); h.className = 'cat-h'; h.textContent = CATS[lastCat] || ''; box.appendChild(h); }
        var ss = splitSize(x.it), row = document.createElement('div');
        row.className = 'srow' + (ticks.has(x.it.id) ? ' done' : ''); row.dataset.sid = x.it.id; row.setAttribute('role', 'checkbox');
        row.setAttribute('aria-checked', ticks.has(x.it.id) ? 'true' : 'false'); row.tabIndex = 0;
        row.innerHTML = '<span class="tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4-9.6 9.6Z"/></svg></span>' +
          '<button class="pic" type="button"><img alt="" loading="lazy" decoding="async"></button><div class="s-info"><p class="s-name"></p><p class="s-size"></p></div><b class="s-qty"></b>';
        row.querySelector('img').src = thumbUrl(x.it);
        row.querySelector('.pic').dataset.id = x.it.id;
        row.querySelector('.s-name').textContent = arText(ss.base);
        row.querySelector('.s-size').textContent = arText(ss.size);
        row.querySelector('.s-qty').textContent = '×' + ar(x.q);
        row.setAttribute('aria-label', label(x.it) + '، الكمية ' + ar(x.q));
        box.appendChild(row);
      });
      frag.appendChild(box);
    });
    if (unknown) { var p = document.createElement('p'); p.className = 'cart-note'; p.textContent = countOf(unknown, 'صنف واحد', 'صنفان', 'أصناف', 'صنفًا') + ' من القائمة لم يعد في الكتالوج.'; frag.appendChild(p); }
    var note = document.createElement('p'); note.className = 'cart-note';
    note.textContent = 'اضغط على الصنف بعد شرائه. التأشيرات تُحفظ على هذا الهاتف.' + (PRICE_DATE ? ' الأسعار بحسب آخر تحديث: ' + priceDateText() + '.' : '');
    frag.appendChild(note);
    shopBody.appendChild(frag);
    shopProgress();
  }
  function toggleTick(row) {
    var id = row.dataset.sid, on = !ticks.has(id);
    if (on) ticks.add(id); else ticks.delete(id);
    row.classList.toggle('done', on); row.setAttribute('aria-checked', on ? 'true' : 'false');
    saveTicks(); shopProgress();
    if (on && shopList && shopList.lines.every(function (l) { return ticks.has(l.id) || !byId.has(l.id); })) toast('تم شراء كل القائمة 👏');
  }
  shopBody.addEventListener('click', function (e) {
    var pic = e.target.closest('.pic'); if (pic) return;          // the photo opens the viewer (document handler)
    var row = e.target.closest('.srow'); if (row) toggleTick(row);
  });
  shopBody.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && e.target.classList.contains('srow')) { e.preventDefault(); toggleTick(e.target); } });
  shopHide.addEventListener('click', function () {
    var on = !shopEl.classList.contains('hide-done');
    shopEl.classList.toggle('hide-done', on); shopHide.textContent = on ? 'إظهار ما تم' : 'إخفاء ما تم';
  });
  function closeShopLink() { if (location.hash) try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { } }

  // ---------------------------------------------------------------- earlier lists (saved when a list is shared)
  var LS_HIST = 'jamiya.history.v1', hpanel = $('#hpanel'), hBody = $('#hBody');
  function history_() { var h = readJSON(LS_HIST, []); return Array.isArray(h) ? h : []; }
  function saveHistory() {
    if (!cart.size) return;
    var items = {}; cart.forEach(function (q, id) { items[id] = q; });
    var h = history_().filter(function (x) { return JSON.stringify(x.items) !== JSON.stringify(items); });
    h.unshift({ t: Date.now(), items: items, n: cart.size });
    writeJSON(LS_HIST, h.slice(0, 8));
  }
  function dayText(t) {
    try { return new Intl.DateTimeFormat('ar-KW-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(t)); } catch (e) { return ''; }
  }
  function renderHistory(host) {
    host.innerHTML = '';
    var h = history_();
    if (!h.length) { host.innerHTML = '<p class="hint">لا توجد قوائم سابقة بعد. تُحفظ القائمة هنا تلقائيًا عند مشاركتها.</p>'; return; }
    h.forEach(function (x, i) {
      var ids = Object.keys(x.items), known = ids.filter(function (id) { return byId.has(canonical(id)); });
      var row = document.createElement('div'); row.className = 'hrow';
      var thumbs = known.slice(0, 4).map(function (id) { return '<img alt="" loading="lazy" src="' + thumbUrl(byId.get(canonical(id))) + '">'; }).join('');
      row.innerHTML = '<div class="h-thumbs">' + thumbs + '</div><div class="h-info"><b></b><small></small></div><button type="button" class="secondary" data-act="hadd" data-h="' + i + '">أضيفيها</button>';
      row.querySelector('b').textContent = 'قائمة ' + dayText(x.t);
      row.querySelector('small').textContent = nItems(ids.length) + (known.length < ids.length ? ' (' + ar(ids.length - known.length) + ' لم يعد متوفرًا)' : '');
      host.appendChild(row);
    });
  }
  function addFromHistory(i) {
    var x = history_()[i]; if (!x) return;
    var added = 0, kept = 0;
    Object.keys(x.items).forEach(function (raw) {
      var id = canonical(raw), it = byId.get(id); if (!it) return;
      var q = Math.min(MAX_QTY, Math.floor(x.items[raw]) || 1), cur = cart.get(id) || 0;
      if (cur >= q) { kept++; return; }
      cart.set(id, q); added++;
    });
    version++; saveCart(); cart.forEach(function (q, id) { refreshItem(id); });
    updateBar(); schedulePdf();
    if (!cartSheet.hidden) renderCart();
    toast(added ? 'أُضيف ' + nItems(added) + ' من القائمة السابقة' + (kept ? '، و' + nItems(kept) + ' كان في السلة' : '') : 'كل أصناف القائمة السابقة موجودة في السلة');
  }
  function openHistory() { afterItems(function () { renderHistory(hBody); openLayer(hpanel); }); }

  // ---------------------------------------------------------------- offline: the site keeps working without a connection after a first visit
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }

  // ================================================================== start
  window.addEventListener('resize', setSizes);
  if (window.ResizeObserver) { var ro = new ResizeObserver(setSizes); ro.observe(barEl); ro.observe(topEl); }
  if (loadCart()) saveCart();
  buildTabs();
  showView('home');
  var sharedList = parseList(location.hash);
  if (sharedList) openShop(sharedList);
  window.addEventListener('hashchange', function () { var l = parseList(location.hash); if (l && layers.indexOf(shopEl) < 0) openShop(l); });
  updateBar(); updateShare();
  setTimeout(loadItems, cartKnown() ? 900 : 0);
  afterItems(function () {
    pruneCart(); version++; updateBar(); schedulePdf(); if (!cartSheet.hidden) renderCart(); warmSearch();
    var gs = new Set(); cart.forEach(function (q, id) { var it = byId.get(id); if (it && it.g >= 0) gs.add(it.g); });
    gs.forEach(refreshGroupCards);           // cards drawn before the product list arrived now show what is in the basket
  });

  // small hook used by automated tests
  window.__jamiya = {
    state: function () { var o = {}; cart.forEach(function (q, id) { o[id] = q; }); return { version: version, pdfStatus: pdf.status, ready: isReady(), share: SHARE, cart: o, itemsLoaded: itemsLoaded }; },
    plan: function () { var P = plan(), f = function (x) { return { id: x.it.id, name: label(x.it), q: x.q, kind: x.d.kind, store: x.d.s || null, unit: x.d.unit || null, why: x.d.why || null, reason: reasonText(x) }; };
      return { L: P.L.map(f), T: P.T.map(f), U: P.U.map(f), R: P.R.map(f), total: P.total }; },
    pdf: function () { return pdf.result; }, pdfDoc: pdfDoc, setQty: setQty, openGroup: function (name) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][0] === name) { openGroup(i); return i; } return -1; },
    item: function (id) { return byId.get(id); }, items: function () { return ITEMS.length; }, groups: function () { return GROUPS.length; },
    find: function (pred) { return ITEMS.filter(pred).slice(0, 50).map(function (it) { return { id: it.id, name: it.name, off: it.off, cat: it.cat, u: it.u }; }); },
    listUrl: function () { return listUrl(plan()); }, shareText: function () { return shareText(plan()); }, openList: function (h) { var l = parseList(h); if (l) openShop(l); return !!l; },
    history: history_, saveHistory: saveHistory,
    hidden: function () { var o = []; byId.forEach(function (it) { if (it.hid) o.push({ id: it.id, name: it.name }); }); return o.slice(0, 50); }
  };
})();

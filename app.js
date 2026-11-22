/* قائمة الجمعية — the home's usual products with a + on each, search for anything else, and one button that sends the list
   (a PDF split by store: produce from talabat mart, everything else at the cheaper store). */
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
    if (!it.hid && typeof r[7] === 'number') it.i = r[7];   // the usual products carry their catalog position
    it._ss = null; it._tok = null; it._fv = null; it._w = null;
    return it;
  }
  GROUPS.forEach(function (g) { if (g[6]) addRow(g[6], null); });     // single-pack types ship their pack in the core file
  (CORE.usual || []).forEach(function (r) { addRow(r, null); });      // the home's usual products: shown before the full list arrives

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
    s.onerror = function () { loadItems.started = false; toast('تعذّر تحميل المنتجات. تحقّقي من الاتصال ثم أعيدي المحاولة.'); };
    document.head.appendChild(s);
  }
  function afterItems(f) { if (itemsLoaded) f(); else { whenLoaded.push(f); loadItems(); } }

  // ================================================================== text & numbers
  var AR = '٠١٢٣٤٥٦٧٨٩';
  var TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"/></svg>';
  var PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4.5h2V11h6.5v2H13v6.5h-2V13H4.5v-2H11V4.5Z"/></svg>';
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
  function nItems(n) { return countOf(n, 'صنف واحد', 'صنفان', 'أصناف', 'صنفًا'); }
  function nProducts(n) { return countOf(n, 'منتج واحد', 'منتجان', 'منتجات', 'منتجًا'); }
  function nPieces(n) { return countOf(n, 'قطعة واحدة', 'قطعتان', 'قطع', 'قطعة'); }
  function priceDateText(withTime) {
    if (!PRICE_DATE) return '';
    try {
      var d = new Date(PRICE_DATE);
      var day = new Intl.DateTimeFormat('ar-KW-u-nu-arab', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
      return withTime ? day + '، ' + new Intl.DateTimeFormat('ar-KW-u-nu-arab', { hour: 'numeric', minute: '2-digit' }).format(d) : day;
    } catch (e) { return PRICE_DATE.slice(0, 10); }
  }
  function dayText(t) {
    try { return new Intl.DateTimeFormat('ar-KW-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(t)); } catch (e) { return ''; }
  }

  // ================================================================== storage (never throws)
  function readJSON(key, def) { try { var raw = localStorage.getItem(key); if (!raw) return def; var v = JSON.parse(raw); return v == null ? def : v; } catch (e) { return def; } }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
  var LS_CART = 'jamiya.cart.v1', LS_NAMES = 'jamiya.names.v1', LS_STORE = 'jamiya.store.v1', LS_HIST = 'jamiya.history.v1', LS_TICKS = 'jamiya.ticks.v1', MAX_QTY = 99;
  var cart = new Map(), version = 0, storageWarned = false, cartSavedAt = 0;
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
    cartSavedAt = (data && +data.savedAt) || 0;
    if (items && typeof items === 'object') Object.keys(items).forEach(function (id) {
      var q = Math.floor(Number(items[id])), c = canonical(id);
      if (c !== id) merged = true;
      if (q > 0) cart.set(c, Math.min((cart.get(c) || 0) + q, MAX_QTY));
    });
    return merged;
  }
  function saveCart() {
    var obj = {}; cart.forEach(function (q, id) { obj[id] = q; });
    cartSavedAt = Date.now();
    if (!writeJSON(LS_CART, { v: 1, savedAt: cartSavedAt, items: obj }) && !storageWarned) { storageWarned = true; toast('تعذّر حفظ القائمة على هذا الجهاز. ستبقى ما دامت الصفحة مفتوحة.'); }
  }
  function pruneCart() {        // forget ids that no longer exist at all (after the full product list has loaded)
    var gone = []; cart.forEach(function (q, id) { if (!byId.has(id)) gone.push(id); });
    gone.forEach(function (id) { cart.delete(id); }); if (gone.length) saveCart();
    return gone.length;
  }
  function cartKnown() { var ok = true; cart.forEach(function (q, id) { if (!byId.has(id)) ok = false; }); return ok; }
  function displayName(it) { var n = names[it.id]; return (typeof n === 'string' && n.trim()) ? n.trim() : (it.name || '').trim(); }
  function label(it) { return displayName(it) || 'منتج'; }
  function history_() { var h = readJSON(LS_HIST, []); return Array.isArray(h) ? h : []; }

  // what this home buys: the purchase history in the catalog, plus every list sent from this phone
  var sentCount = new Map();
  function computeSent() {
    sentCount = new Map();
    history_().forEach(function (x) { Object.keys((x && x.items) || {}).forEach(function (raw) { var id = canonical(raw); sentCount.set(id, (sentCount.get(id) || 0) + 1); }); });
  }
  function uscore(it) { return (it.u || 0) + 2 * (sentCount.get(it.id) || 0); }

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
    'حفايض': ['حفاض'], 'حفاظات': ['حفاضات'], 'عيش': ['ارز'], 'رز': ['ارز'], 'روب': ['زبادي'], 'ماي': ['مياه'], 'ماء': ['مياه'], 'مويه': ['مياه'],
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
      // when the word names the type, the main type of that name leads (drinking water before rose water for «ماء»)
      out.push({ it: r[0], s: sum + gb, gs: gb && GROUPS[r[0].g] ? GROUPS[r[0].g][3] : 0 });
    });
    out.sort(function (a, b) { return b.s - a.s || uscore(b.it) - uscore(a.it) || b.gs - a.gs || (a.it.i || 0) - (b.it.i || 0); });
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
    ['L', 'T', 'U', 'R'].forEach(function (k) { res[k].sort(lineOrder); });
    return res;
  }
  function lineOrder(a, b) { return a.it.cat - b.it.cat || (a.it.i != null && b.it.i != null ? a.it.i - b.it.i : a.it.g - b.it.g); }
  function reasonText(x) {
    var d = x.d, it = x.it;
    if (d.kind === 'R') return 'الخضار والفواكه تُشترى من طلبات مارت فقط، وهذه العبوة غير مدرجة فيه. راجعيها: احذفيها أو اختاري بديلًا.';
    if (d.kind === 'U') return d.why === 'no-store' ? 'لم يُوثَّق المتجر ولا السعر لهذا المنتج.' :
      (d.miss === 'both' ? 'المنتج في المتجرين لكن السعرين غير متاحين.' : 'المنتج في المتجرين لكن سعر ' + SHORT[d.miss] + ' غير متاح.');
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
  function lineFor(it) {                       // the decision as the list would make it (ties settled with the rest of the list)
    if (cart.has(it.id) && cartKnown()) { var P = plan(), all = P.L.concat(P.T, P.U, P.R); for (var i = 0; i < all.length; i++) if (all[i].it === it) return all[i]; }
    var d = decide(it, 1);
    if (d.kind === 'TIE') d = { kind: 'S', s: 'T', why: 'tie-default', unit: d.unit };
    return { it: it, q: cart.get(it.id) || 1, d: d };
  }
  function shownPrice(it) {                    // one quiet number on a product row; nothing when the store is not settled
    var d = decide(it, 1);
    return (d.kind === 'S' || d.kind === 'TIE') && d.unit ? money(d.unit) : '';
  }

  // ================================================================== elements
  var topEl = $('#top'), qInput = $('#q'), qClear = $('#qClear'), jumpEl = $('#jump'), homeEl = $('#home'), resultsEl = $('#results');
  var barEl = $('#bar'), listBtn = $('#listBtn'), lbCount = $('#lbCount'), lbTitle = $('#lbTitle'), lbSub = $('#lbSub');
  var pList = $('#pList'), listSub = $('#listSub'), listBody = $('#listBody'), clearBtn = $('#clearBtn');
  var sendBtn = $('#sendBtn'), sendLabel = $('#sendLabel'), sendNote = $('#sendNote');
  var pSec = $('#pSec'), secTitle = $('#secTitle'), secSub = $('#secSub'), secBody = $('#secBody');
  var pType = $('#pType'), typeTitle = $('#typeTitle'), typeSub = $('#typeSub'), typeTools = $('#typeTools'), tSearch = $('#tSearch'), tq = $('#tq'), tFacets = $('#tFacets'), typeBody = $('#typeBody');
  var pHist = $('#pHist'), histBody = $('#histBody');
  var previewEl = $('#preview'), pvPages = $('#pvPages'), pvInfo = $('#pvInfo');
  var viewer = $('#viewer'), vImg = $('#vImg'), vName = $('#vName'), vSize = $('#vSize'), vStore = $('#vStore'), vCtrl = $('#vCtrl'), vMore = $('#vMore');
  var toastEl = $('#toast');

  // ================================================================== one product row: photo · name · size · + (or the quantity)
  function ctrlHTML(q, wide) {
    if (!q) return '<button type="button" class="add" data-act="add" aria-label="إضافة">' + PLUS + (wide ? '<span>أضيفي إلى القائمة</span>' : '') + '</button>';
    return '<div class="stepper" role="group" aria-label="الكمية"><button type="button" data-act="inc" aria-label="زيادة الكمية">+</button>' +
      '<output aria-live="polite">' + ar(q) + '</output><button type="button" data-act="dec" aria-label="' + (q === 1 ? 'إزالة من القائمة' : 'إنقاص الكمية') + '">' + (q === 1 ? TRASH : '−') + '</button></div>';
  }
  function updateCtrl(box, q) {
    var st = box.querySelector('.stepper');
    if (q && st) {
      st.querySelector('output').textContent = ar(q);
      var dec = st.querySelector('[data-act="dec"]'), wantTrash = q === 1, isTrash = !!dec.querySelector('svg');
      if (wantTrash !== isTrash) { dec.innerHTML = wantTrash ? TRASH : '−'; dec.setAttribute('aria-label', wantTrash ? 'إزالة من القائمة' : 'إنقاص الكمية'); }
    } else box.innerHTML = ctrlHTML(q, box === vCtrl);
  }
  function pickRow(it, opt) {
    opt = opt || {};
    var row = document.createElement('div');
    row.className = 'pick'; row.dataset.id = it.id;
    var ss = splitSize(it), q = cart.get(it.id) || 0;
    row.innerHTML = '<button class="pic" type="button"><img alt="" loading="lazy" decoding="async"></button>' +
      '<div class="pk-text"><p class="pk-name"></p><p class="pk-meta"><span class="pk-size"></span><span class="pk-price"></span></p></div><div class="ctrl"></div>';
    row.querySelector('img').src = thumbUrl(it);
    row.querySelector('.pic').setAttribute('aria-label', 'صورة ' + label(it));
    row.querySelector('.pk-name').textContent = arText(ss.base);
    row.querySelector('.pk-size').textContent = arText(ss.size);
    row.querySelector('.pk-price').textContent = opt.noPrice ? '' : shownPrice(it);
    if (opt.tag && it.u > 0) { var tg = document.createElement('span'); tg.className = 'pk-tag'; tg.textContent = 'معتاد'; row.querySelector('.pk-meta').appendChild(tg); }
    row.classList.toggle('on', q > 0);
    var c = row.querySelector('.ctrl'); c.innerHTML = ctrlHTML(q);
    if (!q) c.querySelector('button').setAttribute('aria-label', 'إضافة ' + label(it));
    return row;
  }
  function refreshItem(id) {
    var q = cart.get(id) || 0;
    document.querySelectorAll('.pick[data-id="' + cssId(id) + '"]').forEach(function (row) {
      row.classList.toggle('on', q > 0);
      updateCtrl(row.querySelector('.ctrl'), q);
    });
    if (viewerId === id) updateCtrl(vCtrl, q);
  }

  // ================================================================== main screen: the home's usual products, section by section
  var expanded = new Set(), homeKey = '';
  function usualList() {
    var out = [];
    byId.forEach(function (it) { if (!it.hid && it.g >= 0 && GROUPS[it.g] && uscore(it) > 0) out.push(it); });
    return out;
  }
  function sectionSplit(items) {               // [shown first, the rest]: what is bought again and again, then what was bought once
    var best = new Map();
    items.forEach(function (it) { var s = uscore(it); if (s > (best.get(it.g) || 0)) best.set(it.g, s); });
    var cmp = function (a, b) {               // products of one kind stay together; the kinds bought most often first
      return best.get(b.g) - best.get(a.g) || a.g - b.g || uscore(b) - uscore(a) || (a.i != null && b.i != null ? a.i - b.i : 0) || (a.id < b.id ? -1 : 1);
    };
    var main = items.filter(function (it) { return uscore(it) >= 2; }).sort(cmp);
    var rest = items.filter(function (it) { return uscore(it) < 2; }).sort(cmp);
    while (main.length < 4 && rest.length) main.push(rest.shift());
    return [main, rest];
  }
  function secProducts(ci) { var n = 0; GROUPS.forEach(function (g) { if (HEADS[g[1]][0] === ci) n += g[3]; }); return n; }
  function secPhoto(ci) {
    var best = -1, gi = -1;
    GROUPS.forEach(function (g, i) { if (HEADS[g[1]][0] === ci && (g[4] || 0) > best) { best = g[4] || 0; gi = i; } });
    if (gi < 0) return '';
    var g = GROUPS[gi], rep = byId.get(g[2]) || { id: g[2], v: g[5] || '' };
    return thumbUrl(rep);
  }
  function renderHome() {
    var list = usualList();
    homeKey = list.map(function (it) { return it.id; }).sort().join(',');
    var bySec = new Map();
    list.forEach(function (it) { if (!bySec.has(it.cat)) bySec.set(it.cat, []); bySec.get(it.cat).push(it); });
    var frag = document.createDocumentFragment();
    var intro = document.createElement('div'); intro.id = 'intro'; frag.appendChild(intro);
    jumpEl.innerHTML = '';
    CATS.forEach(function (name, ci) {
      var items = bySec.get(ci); if (!items || !items.length) return;
      var parts = sectionSplit(items);
      var sec = document.createElement('section'); sec.className = 'sec'; sec.id = 's' + ci;
      var h = document.createElement('h2'); h.className = 'sec-h'; h.textContent = name; sec.appendChild(h);
      parts[0].forEach(function (it) { sec.appendChild(pickRow(it)); });
      if (parts[1].length) {
        if (expanded.has(ci)) parts[1].forEach(function (it) { sec.appendChild(pickRow(it)); });
        else { var mb = document.createElement('button'); mb.type = 'button'; mb.className = 'more-btn'; mb.dataset.act = 'expand'; mb.dataset.c = ci; mb.textContent = 'المزيد مما اشتريتموه من قبل (' + ar(parts[1].length) + ')'; sec.appendChild(mb); }
      }
      var link = document.createElement('button'); link.type = 'button'; link.className = 'sec-link'; link.dataset.sec = ci; link.textContent = 'كل منتجات ' + name; sec.appendChild(link);
      frag.appendChild(sec);
      var chip = document.createElement('button'); chip.type = 'button'; chip.dataset.target = 's' + ci; chip.textContent = name; jumpEl.appendChild(chip);
    });
    // every section, for what this home does not usually buy
    var all = document.createElement('section'); all.className = 'all'; all.id = 'sAll';
    all.innerHTML = '<h2 class="sec-h">كل الأقسام</h2><p class="hint">لمنتج لا تشترونه عادةً: ابحثي باسمه في الأعلى، أو افتحي قسمه.</p>';
    CATS.forEach(function (name, ci) {
      var n = secProducts(ci); if (!n) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'row-link'; b.dataset.sec = ci;
      b.innerHTML = '<span class="rl-img"><img alt="" loading="lazy" decoding="async"></span><span class="rl-text"><b></b><small></small></span>';
      b.querySelector('img').src = secPhoto(ci); b.querySelector('b').textContent = name; b.querySelector('small').textContent = nProducts(n);
      all.appendChild(b);
    });
    frag.appendChild(all);
    var chipAll = document.createElement('button'); chipAll.type = 'button'; chipAll.dataset.target = 'sAll'; chipAll.textContent = 'كل الأقسام'; jumpEl.appendChild(chipAll);
    homeEl.innerHTML = ''; homeEl.appendChild(frag);
    renderIntro(); spy.last = null; spy();
  }
  function sameAsCart(items) {                // is this saved list exactly what is in the list now?
    var o = {}, n = 0;
    Object.keys(items || {}).forEach(function (raw) { o[canonical(raw)] = Math.floor(items[raw]); });
    for (var k in o) { n++; if (cart.get(k) !== o[k]) return false; }
    return n === cart.size;
  }
  function renderIntro() {
    var el = document.getElementById('intro'); if (!el) return;
    el.innerHTML = ''; el.className = '';
    var h = history_();
    if (cart.size) {
      // the list on screen was already sent: offer a fresh one for the next shopping
      if (h.length && cartSavedAt <= (h[0].t || 0) && sameAsCart(h[0].items)) {     // untouched since it was sent
        el.className = 'intro';
        el.innerHTML = '<b></b>لقائمة جديدة ابدئي من الصفر، أو أضيفي إليها ما تحتاجينه وأرسليها مرة أخرى.<div class="row"><button type="button" class="btn primary" data-act="newlist">ابدئي قائمة جديدة</button></div>';
        el.querySelector('b').textContent = 'أرسلتِ هذه القائمة ' + (new Date(h[0].t).toDateString() === new Date().toDateString() ? 'اليوم' : dayText(h[0].t));
      }
      return;
    }
    el.className = 'intro';
    if (h.length) {
      el.innerHTML = '<b>ابدئي من قائمتك السابقة؟</b><span></span><div class="row"><button type="button" class="btn primary" data-act="hadd" data-h="0">أضيفيها ثم عدّليها</button>' +
        (h.length > 1 ? '<button type="button" class="btn secondary" data-act="hopen">قوائم أخرى</button>' : '') + '</div>';
      el.querySelector('span').textContent = 'قائمة ' + dayText(h[0].t) + ' · ' + nItems(Object.keys(h[0].items || {}).length) + '. أو اضغطي + على ما تحتاجينه أدناه.';
    } else {
      el.innerHTML = '<b>هذه مشترياتكم المعتادة</b>اضغطي + بجانب ما تحتاجينه، ثم «قائمتي» في الأسفل لإرسالها. وأي منتج آخر ابحثي عنه في الأعلى.';
    }
  }
  function expandSection(btn) {
    var ci = +btn.dataset.c, items = usualList().filter(function (it) { return it.cat === ci; });
    expanded.add(ci);
    var frag = document.createDocumentFragment();
    sectionSplit(items)[1].forEach(function (it) { frag.appendChild(pickRow(it)); });
    btn.replaceWith(frag);
  }
  // the section chips follow the scroll; a tap jumps to the section
  var spyRaf = 0;
  function spy() {
    spyRaf = 0;
    if (homeEl.hidden || pagesOpen()) return;
    var limit = topEl.getBoundingClientRect().bottom + 12, cur = null, btns = jumpEl.children;
    for (var i = 0; i < btns.length; i++) { var s = document.getElementById(btns[i].dataset.target); if (s && s.getBoundingClientRect().top <= limit) cur = btns[i]; else if (s) break; }
    for (var j = 0; j < btns.length; j++) btns[j].setAttribute('aria-current', btns[j] === cur ? 'true' : 'false');
    if (cur && cur !== spy.last) {
      spy.last = cur;
      var r = cur.getBoundingClientRect(), p = jumpEl.getBoundingClientRect();
      if (r.left < p.left + 8 || r.right > p.right - 8) { var dx = (r.left + r.width / 2) - (p.left + p.width / 2); try { jumpEl.scrollBy({ left: dx, behavior: 'smooth' }); } catch (e) { jumpEl.scrollLeft += dx; } }
    }
  }
  window.addEventListener('scroll', function () { if (!spyRaf) spyRaf = requestAnimationFrame(spy); }, { passive: true });
  jumpEl.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-target]'); if (!b) return;
    var s = document.getElementById(b.dataset.target); if (!s) return;
    var dy = s.getBoundingClientRect().top - topEl.offsetHeight + 1;
    window.scrollTo({ top: window.pageYOffset + dy, behavior: Math.abs(dy) > window.innerHeight * 2 ? 'auto' : 'smooth' });   // far sections: straight there
  });

  // ================================================================== search: products straight away, each with its +
  var searchTimer = 0, searchLimit = 30, homeScroll = 0;
  function setSearching(on) {
    if (on === !homeEl.hidden) {
      if (on) homeScroll = window.scrollY;
      homeEl.hidden = on; resultsEl.hidden = !on; topEl.classList.toggle('searching', on);
      if (!on) { resultsEl.innerHTML = ''; window.scrollTo(0, homeScroll); spy.last = null; spy(); }
    }
  }
  function renderResults() {
    var q = qInput.value.trim();
    qClear.hidden = !qInput.value;
    if (!q) { setSearching(false); return; }
    setSearching(true);
    if (!itemsLoaded) {
      resultsEl.innerHTML = '<p class="hint">جارٍ تحميل المنتجات…</p>';
      afterItems(function () { if (qInput.value.trim() === q) renderResults(); });
      return;
    }
    var res = searchItems(ITEMS, q) || [];
    resultsEl.innerHTML = '';
    if (!res.length) {
      resultsEl.innerHTML = '<div class="empty-box"><b></b>جرّبي كلمة أخرى، أو اسم العلامة التجارية، أو افتحي القسم من «كل الأقسام».</div>';
      resultsEl.querySelector('b').textContent = 'لا توجد منتجات باسم «' + q + '»';
      return;
    }
    var frag = document.createDocumentFragment();
    res.slice(0, searchLimit).forEach(function (r) { frag.appendChild(pickRow(r.it, { tag: true })); });
    resultsEl.appendChild(frag);
    if (res.length > searchLimit) { var m = document.createElement('button'); m.type = 'button'; m.className = 'more-btn'; m.dataset.act = 'more'; m.textContent = 'عرض المزيد (' + ar(res.length - searchLimit) + ')'; resultsEl.appendChild(m); }
    // the kinds behind the results, for seeing every size and brand of one kind
    var gscore = new Map();
    res.slice(0, 300).forEach(function (r) { gscore.set(r.it.g, (gscore.get(r.it.g) || 0) + r.s); });
    var gs = Array.from(gscore.keys()).filter(function (gi) { return GROUPS[gi] && GROUPS[gi][3] > 1; })
      .sort(function (a, b) { return gscore.get(b) - gscore.get(a); }).slice(0, 6);
    if (gs.length) {
      var box = document.createElement('div'); box.className = 'res-types';
      box.innerHTML = '<h3>كل المنتجات من نوع:</h3><div class="chips"></div>';
      gs.forEach(function (gi) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.g = gi;
        b.innerHTML = '<span></span><small></small>'; b.firstChild.textContent = arText(GROUPS[gi][0]); b.lastChild.textContent = ar(GROUPS[gi][3]);
        box.lastChild.appendChild(b);
      });
      resultsEl.appendChild(box);
    }
  }
  qInput.addEventListener('input', function () { qClear.hidden = !qInput.value; clearTimeout(searchTimer); searchTimer = setTimeout(function () { searchLimit = 30; renderResults(); if (!homeEl.hidden) return; window.scrollTo(0, 0); }, 160); });
  qInput.addEventListener('focus', function () { loadItems(); });
  qInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); qInput.blur(); } });
  qClear.addEventListener('click', function () { qInput.value = ''; renderResults(); qInput.focus(); });

  // ================================================================== browsing: a section, then the products of one kind
  function openSection(ci) {
    secTitle.textContent = CATS[ci] || '';
    secSub.textContent = nProducts(secProducts(ci));
    secBody.innerHTML = '';
    var byHead = new Map(), heads = [];
    GROUPS.forEach(function (g, gi) { if (HEADS[g[1]][0] !== ci) return; if (!byHead.has(g[1])) { byHead.set(g[1], []); heads.push(g[1]); } byHead.get(g[1]).push(gi); });
    var frag = document.createDocumentFragment();
    heads.forEach(function (hi) {
      var h = document.createElement('h3'); h.className = 'head-h'; h.textContent = HEADS[hi][1]; frag.appendChild(h);
      byHead.get(hi).slice().sort(function (a, b) { return (GROUPS[b][4] || 0) - (GROUPS[a][4] || 0) || a - b; }).forEach(function (gi) {
        var g = GROUPS[gi], b = document.createElement('button'); b.type = 'button'; b.className = 'row-link'; b.dataset.g = gi;
        b.innerHTML = '<span class="rl-img"><img alt="" loading="lazy" decoding="async"></span><span class="rl-text"><b></b><small></small></span>';
        var rep = byId.get(g[2]) || { id: g[2], v: g[5] || '' };
        b.querySelector('img').src = thumbUrl(rep);
        b.querySelector('b').textContent = arText(g[0]);
        b.querySelector('small').textContent = nProducts(g[3]) + (g[4] > 0 ? ' · تشترونه عادةً' : '');
        frag.appendChild(b);
      });
    });
    secBody.appendChild(frag); secBody.scrollTop = 0;
    openPage(pSec);
  }

  // ---------------------------------------------------------------- filters for one kind (sizes of diapers, colours of grapes, brands …)
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
    if (n < 6) return out;
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
    add('brand', tally('brand').filter(function (e) { return e[1] >= 2; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 14));
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
      if (picked.length >= 12) return;
      var dup = picked.some(function (p) {
        var inside = (' ' + p[0] + ' ').indexOf(' ' + e[0] + ' ') >= 0 || (' ' + e[0] + ' ').indexOf(' ' + p[0] + ' ') >= 0;
        return inside && Math.abs(p[1] - e[1]) <= Math.max(1, Math.round(Math.max(p[1], e[1]) * 0.25));
      });
      if (!dup) picked.push(e);
    });
    if (picked.length >= 2 && n >= 8) { picked.forEach(function (e) { kindLabels.set(e[0], orig.get(e[0])); }); out.push({ key: 'kind', title: FACET_TITLES.kind, values: picked.map(function (e) { return e[0]; }) }); }
    var sizes = tally('size').sort(function (a, b) { return numOf(a[0]) - numOf(b[0]); });
    var covered = sizes.reduce(function (a, e) { return a + e[1]; }, 0);
    if (sizes.length >= 2 && sizes.length <= 14 && covered >= n * 0.3) add('size', sizes);
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
  function itemMatches(it, sel) { for (var k in sel) if (sel[k] != null && !valueMatch(it, k, sel[k])) return false; return true; }
  function valueLabel(key, v) { return key === 'kind' ? arText(kindLabels.get(v) || v) : key === 'fit' || key === 'stage' ? arText(v) : v; }

  // ---------------------------------------------------------------- the products of one kind
  var tState = null;
  function openType(gi, focusId) {
    var g = GROUPS[gi]; if (!g) return;
    tState = { gi: gi, items: [], facets: [], sel: {}, text: '', shown: 0, list: [], focus: focusId || null };
    typeTitle.textContent = arText(g[0]);
    typeSub.textContent = nProducts(g[3]) + ' · ' + (CATS[catOfGroup(gi)] || '');
    typeTools.hidden = true; tq.value = ''; tFacets.innerHTML = '';
    typeBody.innerHTML = '<p class="hint" style="padding:16px">جارٍ التحميل…</p>';
    if (pType.hidden) openPage(pType);
    afterItems(function () {
      if (!tState || tState.gi !== gi) return;
      tState.items = (groupItems[gi] || []).slice().sort(function (a, b) { return uscore(b) - uscore(a) || a.i - b.i; });
      tState.facets = facetsFor(tState.items, g[0]).slice(0, 2);
      tSearch.hidden = tState.items.length <= 15;
      renderFacets(); renderType(true);
    });
  }
  function typeFiltered() {
    var base = tState.items;
    if (tState.text) { var r = searchItems(base, tState.text); base = r ? r.map(function (x) { return x.it; }) : base; }
    return base.filter(function (it) { return itemMatches(it, tState.sel); });
  }
  function renderFacets() {
    tFacets.innerHTML = '';
    tState.facets.forEach(function (f) {
      var row = document.createElement('div'); row.className = 'frow';
      var t = document.createElement('span'); t.className = 'f-t'; t.textContent = f.title + ':'; row.appendChild(t);
      [null].concat(f.values).forEach(function (v) {
        var c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.dataset.fk = f.key; if (v != null) c.dataset.fv = v;
        c.textContent = v == null ? 'الكل' : valueLabel(f.key, v);
        c.setAttribute('aria-pressed', (tState.sel[f.key] == null ? v == null : tState.sel[f.key] === v) ? 'true' : 'false');
        row.appendChild(c);
      });
      tFacets.appendChild(row);
    });
    typeTools.hidden = tSearch.hidden && !tState.facets.length;
  }
  function renderType(reset) {
    if (reset) {
      tState.list = typeFiltered(); tState.shown = 0; typeBody.innerHTML = ''; typeBody.scrollTop = 0;
      if (!tState.list.length) {
        typeBody.innerHTML = '<div class="empty-box"><b>لا توجد منتجات بهذا الاختيار</b><div class="row"><button type="button" class="btn secondary" data-act="tclear">عرض الكل</button></div></div>';
        return;
      }
    }
    var list = tState.list, end = Math.min(list.length, tState.shown + 50);
    if (tState.focus) { var fi = list.findIndex(function (it) { return it.id === tState.focus; }); if (fi >= end) end = Math.min(list.length, fi + 8); }
    var frag = document.createDocumentFragment();
    for (var i = tState.shown; i < end; i++) frag.appendChild(pickRow(list[i], { tag: true }));
    var old = typeBody.querySelector('.more-btn'); if (old) old.remove();
    typeBody.appendChild(frag); tState.shown = end;
    if (end < list.length) { var m = document.createElement('button'); m.type = 'button'; m.className = 'more-btn'; m.dataset.act = 'tmore'; m.textContent = 'عرض المزيد (' + ar(list.length - end) + ')'; typeBody.appendChild(m); }
    if (reset && tState.focus) {
      var el = typeBody.querySelector('.pick[data-id="' + cssId(tState.focus) + '"]');
      if (el) try { el.scrollIntoView({ block: 'center' }); } catch (e) { }
      tState.focus = null;
    }
  }
  tFacets.addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c || !tState) return;
    var k = c.dataset.fk, v = c.dataset.fv;
    if (v == null || tState.sel[k] === v) delete tState.sel[k]; else tState.sel[k] = v;
    renderFacets(); renderType(true);
  });
  var tqTimer = 0;
  tq.addEventListener('input', function () { clearTimeout(tqTimer); tqTimer = setTimeout(function () { if (tState) { tState.text = tq.value.trim(); renderType(true); } }, 150); });
  tq.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); tq.blur(); } });
  typeBody.addEventListener('scroll', function () { if (tState && typeBody.querySelector('.more-btn') && typeBody.scrollTop + typeBody.clientHeight > typeBody.scrollHeight - 500) renderType(false); }, { passive: true });

  // ================================================================== quantities
  function setQty(id, q) {
    q = Math.max(0, Math.min(MAX_QTY, Math.floor(q)));
    var prev = cart.get(id) || 0;
    if (q === prev) { if (q === MAX_QTY) toast('الحد الأقصى للكمية ' + ar(MAX_QTY)); return; }
    if (q) cart.set(id, q); else cart.delete(id);
    version++; saveCart(); refreshItem(id);
    if (!pList.hidden) renderList();
    // the card at the top keeps its place while she picks (a row must never jump under her finger)
    updateBar(!prev && q > 0); schedulePdf();
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target, btn = t.closest('[data-act]');
    if (btn) {
      var act = btn.dataset.act;
      if (act === 'add' || act === 'inc' || act === 'dec') {
        var host = btn.closest('[data-id]'); if (!host) return;
        var id = host.dataset.id, q = cart.get(id) || 0;
        setQty(id, act === 'add' ? 1 : act === 'inc' ? q + 1 : q - 1);
        return;
      }
      if (act === 'expand') { expandSection(btn); return; }
      if (act === 'more') { searchLimit += 30; renderResults(); return; }
      if (act === 'tmore') { renderType(false); return; }
      if (act === 'tclear') { tState.sel = {}; tState.text = ''; tq.value = ''; renderFacets(); renderType(true); return; }
      if (act === 'hopen') { openHistory(); return; }
      if (act === 'hadd') { var hi = +btn.dataset.h; if (topPage() === pHist) closeTop(); afterItems(function () { addFromHistory(hi); }); return; }
      if (act === 'bulk') { plan().U.forEach(function (x) { storeChoice[x.it.id] = btn.dataset.s; }); storeChanged(); toast('وُضعت في ' + SHORT[btn.dataset.s] + '. يمكن تغيير أي صنف منها.'); return; }
      if (act === 'choose') { var cid = btn.closest('[data-id]').dataset.id; if (storeChoice[cid] === btn.dataset.s) delete storeChoice[cid]; else storeChoice[cid] = btn.dataset.s; storeChanged(); return; }
      if (act === 'preview') { renderPreview(); openPage(previewEl); return; }
      if (act === 'peritem') { perItem = !perItem; renderList(); return; }
      if (act === 'newlist') { newList(); return; }
      return;
    }
    var sec = t.closest('[data-sec]'); if (sec) { openSection(+sec.dataset.sec); return; }
    var gl = t.closest('[data-g]'); if (gl) { openType(+gl.dataset.g); return; }
    var pic = t.closest('.pic'); if (pic) { var hh = pic.closest('[data-id]'); if (hh) openViewer(hh.dataset.id); return; }
    if (t.closest('[data-close]')) { closeTop(); return; }
    if (t === viewer) closeTop();
  });
  function storeChanged() { writeJSON(LS_STORE, storeChoice); version++; if (!pList.hidden) renderList(); schedulePdf(); }

  // ================================================================== my list
  var perItem = false;                         // the per-item store choice is shown only when she asks for it
  function renderList() {
    var top = listBody.scrollTop, n = cart.size;
    listBody.innerHTML = '';
    clearBtn.hidden = !n;
    if (!n) {
      listSub.textContent = '';
      listBody.innerHTML = '<div class="empty-box"><b>قائمتك فارغة</b>اضغطي + بجانب أي منتج لإضافته.<div class="row"><button type="button" class="btn primary" data-close>ابدئي الاختيار</button></div></div>';
      if (history_().length) {
        var hh = document.createElement('div'); hh.innerHTML = '<h3 class="head-h">أو ابدئي من قائمة سابقة</h3><div></div>'; listBody.appendChild(hh);
        afterItems(function () { renderHistory(hh.lastChild); });
      }
      updateSend(); return;
    }
    if (!cartKnown()) { listBody.innerHTML = '<p class="hint" style="padding:16px">جارٍ تحميل القائمة…</p>'; afterItems(function () { pruneCart(); if (!pList.hidden) renderList(); }); return; }
    var P = plan(), pieces = 0, frag = document.createDocumentFragment();
    cart.forEach(function (q) { pieces += q; });
    listSub.textContent = nItems(n) + ' · ' + nPieces(pieces);
    var ask = null;
    if (P.U.length) {
      ask = document.createElement('div'); ask.className = 'ask';
      ask.innerHTML = '<b></b><p>سعرها غير متوفر في أحد المتجرين. اختاري لها متجرًا، أو اتركيها ليُحدَّد أثناء التسوق.</p>' +
        '<div class="row"><button type="button" class="btn L" data-act="bulk" data-s="L">كلها من لولو</button><button type="button" class="btn T" data-act="bulk" data-s="T">كلها من طلبات مارت</button></div>' +
        (perItem ? '' : '<button type="button" class="link" data-act="peritem">أو اختاري لكل صنف وحده</button>');
      ask.querySelector('b').textContent = (P.U.length === 1 ? 'صنف واحد بلا متجر محدد' : P.U.length === 2 ? 'صنفان بلا متجر محدد' : nItems(P.U.length) + ' بلا متجر محدد') + ' — اختياري';
    }
    var lines = P.L.concat(P.T, P.U, P.R).sort(lineOrder), lastCat = null;
    lines.forEach(function (x) {
      if (x.it.cat !== lastCat) { lastCat = x.it.cat; var h = document.createElement('h3'); h.className = 'l-cat'; h.textContent = CATS[lastCat] || ''; frag.appendChild(h); }
      var row = pickRow(x.it), meta = row.querySelector('.pk-meta');
      if (x.d.kind === 'U' || x.d.chosen) {
        // a quiet note on the row; the choice itself only when she asks for it
        var wb = document.createElement('button'); wb.type = 'button'; wb.className = 'where-btn'; wb.dataset.act = 'peritem';
        wb.textContent = x.d.chosen ? 'من ' + SHORT[x.d.s] + ' (اختيارك)' : 'المتجر غير محدد';
        meta.appendChild(wb);
        if (perItem) {
          var w = document.createElement('div'); w.className = 'where';
          w.innerHTML = '<span>المتجر:</span><span class="seg"><button type="button" class="L" data-act="choose" data-s="L">لولو</button><button type="button" class="T" data-act="choose" data-s="T">طلبات مارت</button></span>';
          w.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', x.d.chosen && x.d.s === b.dataset.s ? 'true' : 'false'); });
          row.appendChild(w);
        }
      } else if (x.d.kind === 'R') {
        var wr = document.createElement('p'); wr.className = 'warn'; wr.textContent = 'غير متوفر في طلبات مارت — احذفيه أو اختاري بديلًا'; row.appendChild(wr);
      }
      frag.appendChild(row);
    });
    if (ask) frag.appendChild(ask);            // optional, so after the list rather than in front of it
    // where the list goes, and what it costs
    var sum = document.createElement('div'), rows = []; sum.className = 'summary';
    if (P.L.length) rows.push(['L', 'من لولو', nItems(P.L.length) + (P.total.L ? ' · ' + money(P.total.L) : '')]);
    if (P.T.length) rows.push(['T', 'من طلبات مارت', nItems(P.T.length) + (P.total.T ? ' · ' + money(P.total.T) : '')]);
    if (P.U.length) rows.push(['U', 'متجر غير محدد', nItems(P.U.length)]);
    if (P.R.length) rows.push(['U', 'تحتاج مراجعة', nItems(P.R.length)]);
    sum.innerHTML = rows.map(function (r) { return '<div class="line"><span><i class="dot ' + r[0] + '"></i>' + r[1] + '</span><b>' + r[2] + '</b></div>'; }).join('') +
      ((P.total.L + P.total.T) ? '<div class="line total"><span>المجموع التقريبي</span><b>' + money(P.total.L + P.total.T) + '</b></div>' : '') +
      '<small>يصل الملف مقسّمًا حسب المتجر: الخضار والفواكه من طلبات مارت، والباقي من الأرخص' + (PRICE_DATE ? ' بحسب أسعار ' + priceDateText() : '') + '، دون التوصيل.</small>';
    frag.appendChild(sum);
    var links = document.createElement('div'); links.className = 'l-links';
    links.innerHTML = '<button type="button" class="link" data-act="preview">معاينة الملف</button>' + (history_().length ? '<button type="button" class="link" data-act="hopen">القوائم السابقة</button>' : '');
    frag.appendChild(links);
    listBody.appendChild(frag);
    listBody.scrollTop = top;
    updateSend();
  }
  listBtn.addEventListener('click', function () { renderList(); openPage(pList); schedulePdf(0); });
  function clearList(msg) {
    var backup = new Map(cart), ids = Array.from(cart.keys());
    cart.clear(); version++; saveCart(); ids.forEach(refreshItem); if (!pList.hidden) renderList(); renderIntro(); updateBar(); schedulePdf();
    toast(msg, 'تراجع', function () { backup.forEach(function (q, id) { cart.set(id, q); }); version++; saveCart(); ids.forEach(refreshItem); if (!pList.hidden) renderList(); renderIntro(); updateBar(); schedulePdf(); });
  }
  clearBtn.addEventListener('click', function () { if (cart.size && window.confirm('مسح كل المنتجات من القائمة؟')) clearList('مُسحت القائمة'); });
  function newList() { if (cart.size) { clearList('بدأتِ قائمة جديدة. القائمة السابقة محفوظة في «القوائم السابقة».'); window.scrollTo(0, 0); } }
  function updateBar(bump) {
    var n = cart.size;
    listBtn.classList.toggle('empty', !n);
    lbCount.textContent = ar(n);
    if (!n) { lbTitle.textContent = 'قائمتي فارغة'; lbSub.textContent = 'اضغطي + بجانب ما تحتاجينه'; document.title = 'قائمة الجمعية'; }
    else { lbTitle.textContent = 'قائمتي · ' + nItems(n); lbSub.textContent = 'راجعيها ثم أرسليها'; document.title = '(' + ar(n) + ') قائمة الجمعية'; }
    listBtn.setAttribute('aria-label', n ? 'قائمتي، ' + nItems(n) + '. عرض وإرسال' : 'قائمتي فارغة');
    if (bump) { listBtn.classList.remove('bump'); void listBtn.offsetWidth; listBtn.classList.add('bump'); }
  }
  function setSizes() {
    document.documentElement.style.setProperty('--bar-h', barEl.offsetHeight + 'px');
    document.documentElement.style.setProperty('--top-h', topEl.offsetHeight + 'px');
  }

  // ================================================================== the PDF (prepared ahead of the tap, same decisions as the list)
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
    return { stores: stores, extra: extra, link: listUrl(P), priceNote: PRICE_DATE ? 'الأسعار بحسب آخر تحديث: ' + priceDateText(true) + ' — دون رسوم التوصيل' : '' };
  }
  function schedulePdf(delay) {
    clearTimeout(buildTimer);
    if (!cart.size) { pdf = { status: 'empty', version: version, result: null }; updateSend(); return; }
    if (!(pdf.status === 'ready' && pdf.version === version)) pdf.status = 'building';
    updateSend();
    buildTimer = setTimeout(runBuild, delay != null ? delay : pList.hidden ? 1500 : 250);     // while choosing, wait for a pause
  }
  function runBuild() {
    if (building) { again = true; return; }
    if (!cart.size) return;
    if (!cartKnown()) { afterItems(function () { pruneCart(); schedulePdf(0); }); return; }
    if (!window.ShoppingPdf) { pdf = { status: 'error', version: version, result: null }; updateSend(); return; }
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
      updateSend();
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
  function updateSend() {
    SHARE = shareSupport();
    var n = cart.size, ready = isReady(), error = n > 0 && pdf.status === 'error' && pdf.version === version, busy = n > 0 && !ready && !error;
    var useShare = SHARE === 'yes' && !shareFailed;
    sendBtn.hidden = !n;
    sendBtn.disabled = !(ready || error); sendBtn.classList.toggle('busy', busy);
    sendLabel.textContent = busy ? 'جارٍ تجهيز القائمة…' : error ? 'تعذّر التجهيز — اضغطي للمحاولة' : useShare ? 'إرسال القائمة' : 'تنزيل القائمة (PDF)';
    sendBtn.classList.toggle('download', !useShare);
    var note = !n ? '' : SHARE === 'insecure' ? 'الإرسال المباشر يحتاج رابطًا يبدأ بـ https. نزّلي الملف ثم أرسليه من واتساب.' :
      SHARE === 'no' ? 'هذا المتصفح لا يرسل الملفات مباشرة: نزّلي الملف ثم أرسليه من واتساب.' :
      shareFailed ? 'تعذّر فتح الإرسال. نزّلي الملف ثم أرسليه من واتساب.' : '';
    sendNote.textContent = note; sendNote.hidden = !note;
  }
  sendBtn.addEventListener('click', function () {
    if (pdf.status === 'error' && pdf.version === version) { schedulePdf(0); return; }
    if (!isReady() || sharing) return;
    if (SHARE !== 'yes' || shareFailed) { downloadPdf(); return; }
    var file = pdf.result.file, data = { files: [file], title: 'قائمة المشتريات', text: shareText(plan()) }, p;
    try { if (navigator.canShare && !navigator.canShare(data)) data = { files: [file] }; sharing = true; p = navigator.share(data); }
    catch (err) { sharing = false; shareFailed = true; updateSend(); return; }
    Promise.resolve(p).then(function () { saveHistory(); renderIntro(); toast('أُرسلت القائمة ✓'); }, function (err) {
      var nm = err && err.name; if (nm === 'AbortError' || nm === 'InvalidStateError') return; shareFailed = true; updateSend();
    }).then(function () { sharing = false; });
  });
  function downloadPdf() {
    var res = pdf.result, url = URL.createObjectURL(res.blob), a = document.createElement('a');
    a.href = url; a.download = res.name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    saveHistory(); renderIntro();
    toast('نُزّل الملف: ' + res.name);
  }
  function clearPreview() { pvPages.querySelectorAll('img').forEach(function (im) { URL.revokeObjectURL(im.src); }); pvPages.innerHTML = ''; }
  function renderPreview() {
    clearPreview();
    if (!isReady()) { pvInfo.textContent = cart.size ? 'جارٍ تجهيز الملف…' : 'القائمة فارغة'; if (cart.size) schedulePdf(0); return; }
    var res = pdf.result, kb = Math.max(1, Math.round(res.blob.size / 1024));
    pvInfo.textContent = countOf(res.pageCount, 'صفحة واحدة', 'صفحتان', 'صفحات', 'صفحة') + ' · ' + (kb >= 1024 ? ar((kb / 1024).toFixed(1)).replace('.', '٫') + ' ميجابايت' : ar(kb) + ' كيلوبايت');
    res.pages.forEach(function (b, i) { var im = document.createElement('img'); im.alt = 'الصفحة ' + ar(i + 1); im.src = URL.createObjectURL(b); pvPages.appendChild(im); });
  }

  // ================================================================== pages + the back button (the main screen keeps its place underneath)
  var pages = [], skipPop = 0, quiet = new Set();
  function pagesOpen() { return pages.length > 0; }
  function topPage() { return pages[pages.length - 1] || null; }
  function syncBar() {                         // «قائمتي» stays at hand while browsing; the list, photo and file pages have their own buttons
    var t = topPage(), browse = t === pSec || t === pType;
    barEl.hidden = !!t && !browse;
    barEl.classList.toggle('over', browse);
  }
  // quiet: a page that is the site itself (the checklist opened from a link) adds no back-button step
  function openPage(el, isQuiet) {
    if (pages.indexOf(el) >= 0) return;
    pages.push(el);
    el.style.zIndex = String(el === viewer ? 60 : 40 + pages.length);
    el.hidden = false; document.body.style.overflow = 'hidden'; document.body.classList.add('paged');
    if (isQuiet) quiet.add(el); else try { history.pushState({ jamiya: pages.length }, ''); } catch (e) { }
    var f = el.querySelector('[data-close]'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { }
    syncBar();
  }
  function closeTop(fromPop) {
    var el = pages.pop(); if (!el) return;
    if (quiet.delete(el)) fromPop = true;
    el.hidden = true;
    if (!pages.length) { document.body.style.overflow = ''; document.body.classList.remove('paged'); }
    if (el === viewer) viewerId = null;
    if (el === previewEl) clearPreview();
    if (el === shopEl) { shopList = null; closeShopLink(); }
    if (el === pType) { tState = null; typeBody.innerHTML = ''; }
    syncBar();
    if (!fromPop) { skipPop++; try { history.back(); } catch (e) { skipPop--; } }
  }
  window.addEventListener('popstate', function () { if (skipPop) { skipPop--; return; } if (pages.length) closeTop(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pages.length) closeTop(); });

  // ================================================================== one product's photo, with where it will be bought
  var viewerId = null;
  function openViewer(id) {
    var it = byId.get(id); if (!it) return;
    viewerId = id; vCtrl.dataset.id = id;
    var ss = splitSize(it), g = GROUPS[it.g], x = lineFor(it);
    vImg.src = medUrl(it); vImg.alt = label(it);
    vName.textContent = arText(ss.base); vSize.textContent = arText(ss.size);
    vStore.textContent = (x.d.kind === 'S' ? 'يُشترى من ' + SHORT[x.d.s] + (x.d.unit ? ' · ' + money(x.d.unit) : '') + '. ' : x.d.kind === 'U' ? 'المتجر غير محدد. ' : '') + reasonText(x);
    vCtrl.innerHTML = ctrlHTML(cart.get(id) || 0, true);
    var inType = topPage() === pType && tState && tState.gi === it.g;
    vMore.hidden = !g || g[3] < 2 || inType || it.hid;
    if (!vMore.hidden) { vMore.textContent = 'كل منتجات «' + arText(g[0]) + '» (' + ar(g[3]) + ')'; vMore.dataset.gi = it.g; vMore.dataset.focus = id; }
    openPage(viewer);
  }
  vMore.addEventListener('click', function (e) {
    e.stopPropagation();
    var gi = +vMore.dataset.gi, focus = vMore.dataset.focus;
    closeTop();
    setTimeout(function () { openType(gi, focus); }, 0);
  });

  // ================================================================== toast
  var toastTimer = 0;
  function toast(msg, actLabel, action) {
    toastEl.innerHTML = ''; var s = document.createElement('span'); s.textContent = msg; toastEl.appendChild(s);
    if (actLabel) { var b = document.createElement('button'); b.type = 'button'; b.textContent = actLabel; b.addEventListener('click', function () { toastEl.hidden = true; action(); }); toastEl.appendChild(b); }
    toastEl.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.hidden = true; }, actLabel ? 6000 : 3000);
  }

  // ================================================================== other tabs of the same phone
  window.addEventListener('storage', function (e) {
    if (e.key === LS_CART) { var before = Array.from(cart.keys()); if (loadCart()) saveCart(); version++; before.concat(Array.from(cart.keys())).forEach(refreshItem); if (!pList.hidden) renderList(); renderIntro(); updateBar(); schedulePdf(); }
    else if (e.key === LS_STORE) { storeChoice = readJSON(LS_STORE, {}) || {}; version++; if (!pList.hidden) renderList(); schedulePdf(); }
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
  var shopList = null, ticks = new Set();
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
      shopSub.textContent = 'أُرسلت ' + dayText(d) + '، ' + new Intl.DateTimeFormat('ar-KW-u-nu-arab', { hour: 'numeric', minute: '2-digit' }).format(d);
    } catch (e) { shopSub.textContent = ''; }
    shopBody.innerHTML = '<p class="hint" style="padding:16px">جارٍ تحميل القائمة…</p>';
    shopProgress();
    openPage(shopEl, true);
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
      var head = document.createElement('div'); head.className = 'store-h ' + s;
      head.innerHTML = '<span></span><small></small>';
      head.firstChild.textContent = titles[s];
      head.lastChild.textContent = nItems(lines.length) + (total ? ' · ' + money(total) + (missing ? ' + ' + countOf(missing, 'صنف', 'صنفان', 'أصناف', 'صنفًا') + ' بلا سعر' : '') : '');
      frag.appendChild(head);
      var lastCat = null;
      lines.forEach(function (x) {
        if (x.it.cat !== lastCat) { lastCat = x.it.cat; var h = document.createElement('h3'); h.className = 'l-cat'; h.textContent = CATS[lastCat] || ''; frag.appendChild(h); }
        var ss = splitSize(x.it), row = document.createElement('div');
        row.className = 'srow' + (ticks.has(x.it.id) ? ' done' : ''); row.dataset.sid = x.it.id; row.setAttribute('role', 'checkbox');
        row.setAttribute('aria-checked', ticks.has(x.it.id) ? 'true' : 'false'); row.tabIndex = 0;
        row.innerHTML = '<span class="tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4-9.6 9.6Z"/></svg></span>' +
          '<span class="pic"><img alt="" loading="lazy" decoding="async"></span><div class="s-info"><p class="s-name"></p><p class="s-size"></p></div><b class="s-qty"></b>';
        row.querySelector('img').src = thumbUrl(x.it);
        row.querySelector('.s-name').textContent = arText(ss.base);
        row.querySelector('.s-size').textContent = arText(ss.size);
        row.querySelector('.s-qty').textContent = '×' + ar(x.q);
        row.setAttribute('aria-label', label(x.it) + '، الكمية ' + ar(x.q));
        frag.appendChild(row);
      });
    });
    if (unknown) { var p = document.createElement('p'); p.className = 'note'; p.textContent = countOf(unknown, 'صنف واحد', 'صنفان', 'أصناف', 'صنفًا') + ' من القائمة لم يعد في الكتالوج.'; frag.appendChild(p); }
    var note = document.createElement('p'); note.className = 'note';
    note.textContent = 'اضغط على الصنف بعد شرائه. التأشيرات تُحفظ على هذا الهاتف.' + (PRICE_DATE ? ' الأسعار بحسب آخر تحديث: ' + priceDateText(true) + '.' : '');
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
  shopBody.addEventListener('click', function (e) { var row = e.target.closest('.srow'); if (row) toggleTick(row); });
  shopBody.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && e.target.classList.contains('srow')) { e.preventDefault(); toggleTick(e.target); } });
  shopHide.addEventListener('click', function () {
    var on = !shopEl.classList.contains('hide-done');
    shopEl.classList.toggle('hide-done', on); shopHide.textContent = on ? 'إظهار ما تم' : 'إخفاء ما تم';
  });
  function closeShopLink() { if (location.hash) try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { } }

  // ---------------------------------------------------------------- earlier lists (saved when a list is sent)
  function saveHistory() {
    if (!cart.size) return;
    var items = {}; cart.forEach(function (q, id) { items[id] = q; });
    var h = history_().filter(function (x) { return JSON.stringify(x.items) !== JSON.stringify(items); });
    h.unshift({ t: Date.now(), items: items, n: cart.size });
    writeJSON(LS_HIST, h.slice(0, 8));
  }
  function renderHistory(host) {
    host.innerHTML = '';
    var h = history_();
    if (!h.length) { host.innerHTML = '<p class="hint" style="padding:16px">لا توجد قوائم سابقة بعد. تُحفظ القائمة هنا تلقائيًا عند إرسالها.</p>'; return; }
    h.forEach(function (x, i) {
      var ids = Object.keys(x.items || {}), known = ids.filter(function (id) { return byId.has(canonical(id)); });
      var row = document.createElement('div'); row.className = 'hrow';
      var thumbs = known.slice(0, 4).map(function (id) { return '<img alt="" loading="lazy" src="' + thumbUrl(byId.get(canonical(id))) + '">'; }).join('');
      row.innerHTML = '<div class="h-thumbs">' + thumbs + '</div><div class="h-info"><b></b><small></small></div><button type="button" class="btn secondary" data-act="hadd" data-h="' + i + '">أضيفيها</button>';
      row.querySelector('b').textContent = 'قائمة ' + dayText(x.t);
      row.querySelector('small').textContent = nItems(ids.length) + (known.length < ids.length ? ' (' + ar(ids.length - known.length) + ' لم يعد متوفرًا)' : '');
      host.appendChild(row);
    });
  }
  function addFromHistory(i) {
    var x = history_()[i]; if (!x) return;
    var added = 0, kept = 0;
    Object.keys(x.items || {}).forEach(function (raw) {
      var id = canonical(raw), it = byId.get(id); if (!it) return;
      var q = Math.min(MAX_QTY, Math.floor(x.items[raw]) || 1), cur = cart.get(id) || 0;
      if (cur >= q) { kept++; return; }
      cart.set(id, q); added++;
    });
    version++; saveCart(); cart.forEach(function (q, id) { refreshItem(id); });
    renderIntro(); updateBar(added > 0); schedulePdf();
    if (!pList.hidden) renderList();
    toast(added ? 'أُضيف ' + nItems(added) + ' من القائمة السابقة' + (kept ? '، و' + nItems(kept) + ' كان في قائمتك' : '') : 'كل أصناف القائمة السابقة موجودة في قائمتك');
  }
  function openHistory() { afterItems(function () { renderHistory(histBody); openPage(pHist); }); }

  // ---------------------------------------------------------------- offline: the site keeps working without a connection after a first visit
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }

  // ================================================================== start
  window.addEventListener('resize', setSizes);
  if (window.ResizeObserver) { var ro = new ResizeObserver(setSizes); ro.observe(barEl); ro.observe(topEl); }
  if (loadCart()) saveCart();
  computeSent();
  renderHome();
  updateBar(); updateSend(); setSizes();
  var sharedList = parseList(location.hash);
  if (sharedList) openShop(sharedList);
  window.addEventListener('hashchange', function () { var l = parseList(location.hash); if (l && pages.indexOf(shopEl) < 0) openShop(l); });
  setTimeout(loadItems, 300);
  afterItems(function () {
    pruneCart(); version++; computeSent();
    var key = usualList().map(function (it) { return it.id; }).sort().join(',');
    if (key !== homeKey && !qInput.value.trim()) { var y = window.scrollY; renderHome(); window.scrollTo(0, y); }   // products added from lists sent on this phone
    updateBar(); schedulePdf(); if (!pList.hidden) renderList(); warmSearch();
  });

  // small hook used by automated tests
  window.__jamiya = {
    state: function () { var o = {}; cart.forEach(function (q, id) { o[id] = q; }); return { version: version, pdfStatus: pdf.status, ready: isReady(), share: SHARE, cart: o, itemsLoaded: itemsLoaded }; },
    plan: function () { var P = plan(), f = function (x) { return { id: x.it.id, name: label(x.it), q: x.q, kind: x.d.kind, store: x.d.s || null, unit: x.d.unit || null, why: x.d.why || null, reason: reasonText(x) }; };
      return { L: P.L.map(f), T: P.T.map(f), U: P.U.map(f), R: P.R.map(f), total: P.total }; },
    pdf: function () { return pdf.result; }, pdfDoc: pdfDoc, setQty: setQty,
    openGroup: function (name) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][0] === name) { openType(i); return i; } return -1; },
    item: function (id) { return byId.get(id); }, items: function () { return ITEMS.length; }, groups: function () { return GROUPS.length; },
    find: function (pred) { return ITEMS.filter(pred).slice(0, 50).map(function (it) { return { id: it.id, name: it.name, off: it.off, cat: it.cat, u: it.u }; }); },
    listUrl: function () { return listUrl(plan()); }, shareText: function () { return shareText(plan()); }, openList: function (h) { var l = parseList(h); if (l) openShop(l); return !!l; },
    history: history_, saveHistory: saveHistory, usual: function () { return usualList().length; },
    search: function (q) { return (searchItems(ITEMS, q) || []).slice(0, 10).map(function (r) { return label(r.it); }); },
    hidden: function () { var o = []; byId.forEach(function (it) { if (it.hid) o.push({ id: it.id, name: it.name }); }); return o.slice(0, 50); }
  };
})();

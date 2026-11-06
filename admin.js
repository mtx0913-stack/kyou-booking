/* 預約後台 */
(function () {
  var K = window.Kyou, esc = K.esc;
  var root = document.getElementById('admin');
  var today = K.todayTW();
  var ST = { pending: '待確認', confirmed: '已確認', completed: '已完成', noshow: '放鳥', cancelled: '已取消' };
  var BASE_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

  var A = {
    screen: 'loading', tab: 'slots', me: null, error: '',
    month: today.slice(0, 7), monthData: null, monthLoading: false,
    sel: null, selTimes: [], extraMode: false, extras: [], sameWeekday: false, saving: false,
    bookings: null, autoHours: 24, sheetUrl: '', bTab: ST.pending,
    customers: null, cFilter: 'all', q: ''
  };

  /* ---------- 啟動 ---------- */
  async function boot() {
    try {
      await K.start();
      var who = await K.call('admin.whoami');
      A.me = who;
      if (!who.isAdmin) { A.screen = 'notAdmin'; render(); return; }
      A.screen = 'main';
      render();
      await Promise.all([loadMonth(), loadBookings()]);
    } catch (e) {
      A.screen = 'fatal';
      A.error = K.errText(e);
      render();
    }
  }

  async function loadMonth() {
    A.monthLoading = true; render();
    try { A.monthData = await K.call('admin.month', { month: A.month }); }
    catch (e) { K.toast(K.errText(e)); }
    A.monthLoading = false; render();
  }
  async function loadBookings() {
    try {
      var r = await K.call('admin.bookings');
      A.bookings = r.bookings; A.autoHours = r.autoCompleteHours || 24; A.sheetUrl = r.sheetUrl || '';
    } catch (e) { K.toast(K.errText(e)); }
    render();
  }
  async function loadCustomers() {
    try { A.customers = (await K.call('admin.customers')).customers; }
    catch (e) { K.toast(K.errText(e)); }
    render();
  }

  /* ---------- 小工具 ---------- */
  function isActive(b) { return b.status === ST.pending || b.status === ST.confirmed; }
  function dayBookings(date) {
    return ((A.monthData && A.monthData.bookings) || []).filter(function (b) { return b.date === date && isActive(b); })
      .sort(function (a, b) { return a.start.localeCompare(b.start); });
  }
  function lockedTimes(date) { return dayBookings(date).map(function (b) { return b.start; }); }
  function pendingCount() { return (A.bookings || []).filter(function (b) { return b.status === ST.pending; }).length; }
  function visitBadge(b) {
    var out = b.completedCount > 0 ? '<span class="badge badge-pending">第 ' + (b.completedCount + 1) + ' 次</span>' : '<span class="badge badge-confirmed">新客</span>';
    if (b.streak > 0) out += ' <span class="badge badge-warn">放鳥 ' + b.streak + ' 次</span>';
    return out;
  }
  function sameWeekdayDates(date) {
    var w = K.weekday(date), out = [], n = K.daysIn(A.month);
    for (var d = 1; d <= n; d++) {
      var x = A.month + '-' + K.pad(d);
      if (x !== date && x >= today && K.weekday(x) === w) out.push(x);
    }
    return out;
  }
  function fmtPhone(p) { p = String(p || ''); return p.length === 10 ? p.slice(0, 4) + ' ' + p.slice(4, 7) + ' ' + p.slice(7) : p; }
  function remainText(b) {
    var left = K.toMs(b.date, b.end) + A.autoHours * 3600000 - K.nowMs();
    if (left <= 0) return { t: '即將自動完成', urgent: true };
    var h = Math.floor(left / 3600000);
    if (h >= 1) return { t: '剩 ' + h + ' 小時自動完成', urgent: false };
    return { t: '剩 ' + Math.max(1, Math.ceil(left / 60000)) + ' 分鐘自動完成', urgent: true };
  }
  function copyText(b) {
    return K.md(b.date) + ' ' + b.start + '–' + b.end + '\n' + b.serviceName +
      (b.productsText ? '\n加購：' + b.productsText : '') +
      '\n稱呼：' + b.nickname + '\n電話：' + fmtPhone(b.phone) + '\n合計：' + K.money(b.total) + '（到店付款）';
  }

  /* ---------- 畫面 ---------- */
  function nav() {
    var n = pendingCount();
    var tab = function (id, label, extra) {
      return '<button type="button" class="tab' + (A.tab === id ? ' on' : '') + '" data-act="tab" data-tab="' + id + '"' + (A.tab === id ? ' aria-current="page"' : '') + '>' + label + (extra || '') + '</button>';
    };
    return '<header class="anav"><div class="brand">' + K.LOGO + '<b>預約後台</b></div>' +
      '<nav aria-label="後台功能">' + tab('slots', '開放時段') + tab('bookings', '預約管理', n ? '<span class="n">' + n + '</span>' : '') + tab('customers', '顧客名單') + '</nav>' +
      '<div class="spacer"></div><div class="tools">' +
      (A.sheetUrl ? '<a class="btn btn-line btn-sm" href="' + esc(A.sheetUrl) + '" target="_blank" rel="noopener">開啟 Google 試算表</a>' : '') + '</div></header>';
  }

  function viewSlots() {
    var md = A.monthData;
    var first = A.month + '-01', offset = K.weekday(first), n = K.daysIn(A.month);
    var cells = '';
    for (var i = 0; i < offset; i++) cells += '<div class="acell blank" aria-hidden="true"></div>';
    for (var d = 1; d <= n; d++) {
      var date = A.month + '-' + K.pad(d);
      var times = (md && md.slots[date]) || [];
      var bmap = {};
      dayBookings(date).forEach(function (b) { bmap[b.start] = b.status; });
      var all = times.slice();
      Object.keys(bmap).forEach(function (t) { if (all.indexOf(t) < 0) all.push(t); });
      all.sort();
      var chips = all.map(function (t) {
        var c = bmap[t] === ST.pending ? ' p' : bmap[t] === ST.confirmed ? ' c' : '';
        return '<span class="tchip' + c + '">' + t + '</span>';
      }).join('');
      var past = date < today;
      var cls = 'acell' + (past ? ' past' : '') + (date === A.sel ? ' sel' : '') + (A.extras.indexOf(date) >= 0 ? ' extra' : '');
      var label = d + '日' + (times.length ? '，開放 ' + times.join('、') : '，未開放');
      cells += '<button type="button" class="' + cls + '" data-act="day" data-date="' + date + '"' + (past ? ' disabled' : '') + ' aria-label="' + label + '"><span class="d">' + d + '</span><span class="cs">' + chips + '</span></button>';
    }
    var cal = '<div class="slots-cal"><div class="toolbar">' +
      '<button type="button" class="round" data-act="month" data-n="-1" aria-label="上個月">' + K.ICON.prev + '</button>' +
      '<h2>' + K.monthTitle(A.month) + '</h2>' +
      '<button type="button" class="round" data-act="month" data-n="1" aria-label="下個月">' + K.ICON.next + '</button>' +
      '<div style="flex:1"></div>' +
      '<div class="legend-a"><span><i></i>開放中</span><span><i class="p"></i>待確認</span><span><i class="c"></i>已確認</span></div>' +
      '<button type="button" class="btn btn-line btn-sm" data-act="copyPrev">複製上個月的設定</button></div>' +
      '<div class="acal-week" aria-hidden="true">' + K.WD.map(function (w) { return '<div>' + w + '</div>'; }).join('') + '</div>' +
      (A.monthLoading && !md ? '<div class="loading"><div class="spinner"></div></div>' : '<div class="acal-grid">' + cells + '</div>') + '</div>';
    return '<div class="slots-layout">' + cal + editor() + '</div>';
  }

  function editor() {
    if (!A.sel) {
      return '<aside class="card slots-edit"><div class="bold" style="font-size:18px">編輯開放時段</div><div class="muted small">點月曆上的日期開始設定。<br>「複製上個月的設定」會依星期幾，把上個月的時段套到這個月還沒設定的日子。</div></aside>';
    }
    var locked = lockedTimes(A.sel);
    var all = BASE_TIMES.slice();
    A.selTimes.concat(locked).forEach(function (t) { if (all.indexOf(t) < 0) all.push(t); });
    all.sort();
    var grid = all.map(function (t) {
      var lock = locked.indexOf(t) >= 0, on = A.selTimes.indexOf(t) >= 0;
      return '<button type="button" class="tbtn' + (lock ? ' lock' : on ? ' on' : '') + '" data-act="toggleTime" data-time="' + t + '"' +
        (lock ? ' aria-disabled="true" title="已有預約"' : '') + ' aria-pressed="' + (on || lock) + '">' + t + '</button>';
    }).join('');
    var bk = dayBookings(A.sel).map(function (b) {
      return '<div><b>' + b.start + ' 已有預約（' + esc(b.status) + '）</b><div class="muted">' + esc(b.nickname) + '・' + esc(b.serviceName) + '・到 ' + b.end + '</div></div>';
    }).join('');
    var wd = K.WD[K.weekday(A.sel)];
    return '<aside class="card slots-edit"><div><div class="small muted">編輯開放時段</div><div class="bold" style="font-size:22px">' + K.md(A.sel) + '</div></div>' +
      '<div class="small muted">勾選這天客人可以「開始」的時間</div>' +
      '<div class="tgrid">' + grid + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center"><label class="sr-only" for="customTime">其他時間</label>' +
      '<input id="customTime" class="input" type="time" step="900" style="height:42px;flex:1">' +
      '<button type="button" class="btn btn-line btn-sm" data-act="addTime">加入其他時間</button></div>' +
      (bk ? '<div class="soft" style="display:flex;flex-direction:column;gap:8px">' + bk + '</div>' : '') +
      '<div><div class="bold small">也套用到</div>' +
      '<label class="check"><input type="checkbox" id="sameWd"' + (A.sameWeekday ? ' checked' : '') + '>這個月之後每個星期' + wd + '</label>' +
      '<label class="check"><input type="checkbox" id="extraMode"' + (A.extraMode ? ' checked' : '') + '>月曆上另外選的日期' + (A.extras.length ? '（已選 ' + A.extras.length + ' 天）' : '') + '</label>' +
      (A.extraMode ? '<div class="tiny muted">現在點月曆會加選日期（虛線框），再點一次取消</div>' : '') + '</div>' +
      '<div style="display:flex;gap:10px;margin-top:4px">' +
      '<button type="button" class="btn btn-line" style="flex:1;min-height:48px" data-act="closeDay"' + (A.saving ? ' disabled' : '') + '>這天不開放</button>' +
      '<button type="button" class="btn" style="flex:1;min-height:48px" data-act="saveDay"' + (A.saving ? ' disabled' : '') + '>' + (A.saving ? '儲存中…' : '儲存') + '</button></div></aside>';
  }

  function viewBookings() {
    if (!A.bookings) return '<div class="loading"><div class="spinner"></div></div>';
    var now = K.nowMs();
    var list = A.bookings;
    var toMark = list.filter(function (b) { return b.status === ST.confirmed && K.toMs(b.date, b.start) <= now; })
      .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
    var counts = {};
    list.forEach(function (b) { counts[b.status] = (counts[b.status] || 0) + 1; });
    var pills = [ST.pending, ST.confirmed, ST.completed, ST.noshow, ST.cancelled].map(function (s) {
      var label = s + (s === ST.pending && counts[s] ? ' ' + counts[s] : '');
      return '<button type="button" class="pill' + (A.bTab === s ? ' on' : '') + '" data-act="bTab" data-s="' + s + '" aria-pressed="' + (A.bTab === s) + '">' + label + '</button>';
    }).join('');
    var head = '<div class="pills">' + pills + '<div style="flex:1"></div><div class="small muted">在 LINE 回覆客人後，再按「確認預約」</div></div>';

    var mark = '';
    if (toMark.length) {
      mark = '<div style="display:flex;flex-direction:column;gap:10px"><div class="section-title"><h3>已過時段，請標記結果</h3><div class="tiny muted">超過 ' + A.autoHours + ' 小時沒標記，會自動變成「已完成」・放鳥紀錄只有後台看得到</div></div>' +
        '<div class="card table"><div class="trow h mark-row"><div>時間</div><div>稱呼</div><div>項目</div><div>電話</div><div>紀錄</div><div>結果</div></div>' +
        toMark.map(function (b) {
          var r = remainText(b);
          return '<div class="trow mark-row"><div><div class="bold">' + K.md(b.date) + ' ' + b.start + '</div><div class="tiny" style="color:' + (r.urgent ? 'var(--warn);font-weight:700' : 'var(--muted)') + '">' + r.t + '</div></div>' +
            '<div>' + esc(b.nickname) + '</div><div>' + esc(b.serviceName) + '</div><div>' + fmtPhone(b.phone) + '</div><div>' + visitBadge(b) + '</div>' +
            '<div class="actions"><button type="button" class="btn btn-xs" data-act="status" data-id="' + esc(b.id) + '" data-s="' + ST.completed + '">已完成</button>' +
            '<button type="button" class="btn btn-xs btn-warn" data-act="status" data-id="' + esc(b.id) + '" data-s="' + ST.noshow + '">放鳥</button></div></div>';
        }).join('') + '</div></div>';
    }

    var body;
    if (A.bTab === ST.pending || A.bTab === ST.confirmed) {
      var items = list.filter(function (b) { return b.status === A.bTab && (A.bTab === ST.pending || K.toMs(b.date, b.start) > now); })
        .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
      body = items.length ? '<div class="bgrid">' + items.map(card).join('') + '</div>'
        : '<div class="card empty">' + (A.bTab === ST.pending ? '目前沒有待確認的預約' : '目前沒有即將到來的預約') + '</div>';
    } else {
      var items2 = list.filter(function (b) { return b.status === A.bTab; })
        .sort(function (a, b) { return (b.date + b.start).localeCompare(a.date + a.start); });
      body = items2.length ? '<div class="card table"><div class="trow h hist-row"><div>時間</div><div>稱呼</div><div>項目</div><div>電話</div><div>加購</div><div></div></div>' +
        items2.map(function (b) {
          var other = b.status === ST.completed ? ST.noshow : b.status === ST.noshow ? ST.completed : '';
          return '<div class="trow hist-row"><div class="bold">' + K.md(b.date) + ' ' + b.start + '</div><div>' + esc(b.nickname) + '</div><div>' + esc(b.serviceName) + '</div>' +
            '<div>' + fmtPhone(b.phone) + '</div><div class="' + (b.productsText ? '' : 'muted') + '">' + (esc(b.productsText) || '無') + '</div>' +
            '<div>' + (other ? '<button type="button" class="btn btn-xs btn-line" data-act="status" data-id="' + esc(b.id) + '" data-s="' + other + '">改成' + other + '</button>' : '') + '</div></div>';
        }).join('') + '</div>' : '<div class="card empty">沒有資料</div>';
    }
    return head + mark + body;
  }

  function card(b) {
    var act = b.status === ST.pending
      ? '<button type="button" class="btn btn-sm btn-line" data-act="cancel" data-id="' + esc(b.id) + '">取消</button><button type="button" class="btn btn-sm" data-act="status" data-id="' + esc(b.id) + '" data-s="' + ST.confirmed + '">確認預約</button>'
      : '<button type="button" class="btn btn-sm btn-line" data-act="cancel" data-id="' + esc(b.id) + '">取消</button>';
    return '<article class="card bcard"><div class="head">' + K.avatar(b.lineName, b.picture) +
      '<div class="who"><b>' + esc(b.nickname) + '</b><div class="small muted">LINE：' + esc(b.lineName) + '</div></div><div>' + visitBadge(b) + '</div></div>' +
      '<div class="kv"><div class="k">時間</div><div class="bold">' + K.md(b.date) + ' ' + b.start + '–' + b.end + '</div>' +
      '<div class="k">項目</div><div>' + esc(b.serviceName) + '</div>' +
      '<div class="k">加購</div><div class="' + (b.productsText ? '' : 'muted') + '">' + (esc(b.productsText) || '無') + '</div>' +
      '<div class="k">電話</div><div><a href="tel:' + esc(b.phone) + '">' + fmtPhone(b.phone) + '</a></div>' +
      '<div class="k">合計</div><div class="bold">' + K.money(b.total) + '（到店付款）</div></div>' +
      '<div class="tiny muted">' + esc(b.created) + ' 送出</div>' +
      '<div class="actions"><button type="button" class="btn btn-sm btn-line" data-act="copy" data-id="' + esc(b.id) + '">複製預約資訊</button><div class="sp"></div>' + act + '</div></article>';
  }

  function viewCustomers() {
    if (!A.customers) return '<div class="loading"><div class="spinner"></div></div>';
    var cs = A.customers;
    var banners = cs.filter(function (c) { return c.needsPrompt; }).map(function (c) {
      return '<div class="banner">' + K.ICON.warn + '<div class="t"><b>' + esc(c.nickname || c.lineName) + ' 已連續放鳥 ' + c.streak + ' 次</b>' +
        '<div class="small">要加入黑名單嗎？加入後就無法再線上預約。</div></div>' +
        '<button type="button" class="btn btn-sm btn-line" data-act="dismiss" data-uid="' + esc(c.uid) + '">先不要</button>' +
        '<button type="button" class="btn btn-sm btn-danger" data-act="block" data-uid="' + esc(c.uid) + '">加入黑名單</button></div>';
    }).join('');
    var nNo = cs.filter(function (c) { return c.streak > 0 && !c.blocked; }).length;
    var nBl = cs.filter(function (c) { return c.blocked; }).length;
    var pill = function (id, label) { return '<button type="button" class="pill' + (A.cFilter === id ? ' on' : '') + '" data-act="cFilter" data-f="' + id + '" aria-pressed="' + (A.cFilter === id) + '">' + label + '</button>'; };
    return banners + '<div class="pills">' + pill('all', '全部 ' + cs.length) + pill('noshow', '有放鳥紀錄 ' + nNo) + pill('blocked', '黑名單 ' + nBl) +
      '<div style="flex:1"></div><label class="sr-only" for="cq">搜尋顧客</label><input id="cq" class="input" type="search" placeholder="搜尋名字或電話" value="' + esc(A.q) + '" style="height:40px;width:240px;border-radius:999px">' +
      '</div><div id="custList">' + custList() + '</div>' +
      '<div class="tiny muted">放鳥紀錄和黑名單只有後台看得到。客人只要完成一次預約，「連續放鳥」就會歸零。黑名單也會擋下用同一支電話的新 LINE 帳號。</div>';
  }

  function custList() {
    var q = A.q.trim().toLowerCase().replace(/\s/g, '');
    var cs = A.customers.filter(function (c) {
      if (A.cFilter === 'noshow' && !(c.streak > 0 && !c.blocked)) return false;
      if (A.cFilter === 'blocked' && !c.blocked) return false;
      if (q && (c.nickname + c.lineName + c.phone).toLowerCase().replace(/\s/g, '').indexOf(q) < 0) return false;
      return true;
    });
    if (!cs.length) return '<div class="card empty">沒有符合的顧客</div>';
    return '<div class="card table"><div class="trow h cust-row"><div>顧客</div><div>電話</div><div>完成次數</div><div>連續放鳥</div><div>最近一次</div><div>狀態</div><div></div></div>' +
      cs.map(function (c) {
        var status = c.blocked ? '<span class="badge badge-black">黑名單</span>' : c.streak > 0 ? '<span class="badge badge-warn">放鳥 ' + c.streak + ' 次</span>' : '<span class="small muted">正常</span>';
        var act = c.blocked ? '<button type="button" class="btn btn-xs btn-line" data-act="unblock" data-uid="' + esc(c.uid) + '">解除</button>'
          : c.streak >= 2 ? '<button type="button" class="btn btn-xs btn-warn" data-act="block" data-uid="' + esc(c.uid) + '">加入黑名單</button>' : '';
        return '<div class="trow cust-row"><div class="who-cell">' + K.avatar(c.lineName, c.picture, 'sm') + '<div style="min-width:0"><div class="bold">' + esc(c.nickname || c.lineName) + '</div><div class="tiny muted">LINE：' + esc(c.lineName) + '</div></div></div>' +
          '<div>' + fmtPhone(c.phone) + '</div><div>' + c.completedCount + '</div><div style="' + (c.streak ? 'color:var(--warn);font-weight:700' : '') + '">' + c.streak + '</div>' +
          '<div>' + (c.lastDate ? c.lastDate.slice(5).replace('-', '/') : '—') + '</div><div>' + status + '</div><div>' + act + '</div></div>';
      }).join('') + '</div>';
  }

  function render() {
    if (A.screen === 'loading') return;
    if (A.screen === 'fatal') {
      root.innerHTML = '<div class="loading"><div class="bold">' + esc(A.error) + '</div><button type="button" class="btn btn-line btn-sm" data-act="reload">重新整理</button></div>';
      return;
    }
    if (A.screen === 'notAdmin') {
      root.innerHTML = '<div class="loading" style="max-width:520px;margin:0 auto"><div class="bold" style="font-size:18px">這個 LINE 帳號還不是管理者</div>' +
        '<div class="small muted" style="line-height:1.8">請把下面這串「LINE ID」貼到 Google 試算表「設定」分頁的 ADMIN_LINE_IDS，再重新整理這一頁。</div>' +
        '<div class="card" style="padding:14px 16px;font-family:monospace;word-break:break-all;width:100%">' + esc(A.me.userId) + '</div>' +
        '<button type="button" class="btn btn-sm" data-act="copyId">複製 LINE ID</button></div>';
      return;
    }
    var view = A.tab === 'slots' ? viewSlots() : A.tab === 'bookings' ? viewBookings() : viewCustomers();
    var active = document.activeElement && document.activeElement.id;
    root.innerHTML = nav() + '<main class="amain">' + view + '</main>';
    if (active === 'cq') { var el = document.getElementById('cq'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
  }

  /* ---------- 互動 ---------- */
  root.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var act = el.getAttribute('data-act');

    if (act === 'tab') {
      A.tab = el.getAttribute('data-tab');
      render();
      if (A.tab === 'bookings') loadBookings();
      if (A.tab === 'customers') loadCustomers();
      if (A.tab === 'slots') loadMonth();
    } else if (act === 'month') {
      A.month = K.shiftMonth(A.month, +el.getAttribute('data-n'));
      A.monthData = null; A.sel = null; A.extras = []; A.extraMode = false; A.sameWeekday = false;
      loadMonth();
    } else if (act === 'day') {
      var date = el.getAttribute('data-date');
      if (A.extraMode && A.sel && date !== A.sel) {
        var i = A.extras.indexOf(date);
        if (i >= 0) A.extras.splice(i, 1); else A.extras.push(date);
      } else {
        A.sel = date;
        A.selTimes = ((A.monthData && A.monthData.slots[date]) || []).slice();
        A.extras = []; A.extraMode = false; A.sameWeekday = false;
      }
      render();
    } else if (act === 'toggleTime') {
      var t = el.getAttribute('data-time');
      if (lockedTimes(A.sel).indexOf(t) >= 0) { K.toast('這個時段已有預約，不能取消開放'); return; }
      var j = A.selTimes.indexOf(t);
      if (j >= 0) A.selTimes.splice(j, 1); else A.selTimes.push(t);
      render();
    } else if (act === 'addTime') {
      var v = (document.getElementById('customTime') || {}).value;
      if (!/^\d{2}:\d{2}$/.test(v || '')) { K.toast('請先選一個時間'); return; }
      if (A.selTimes.indexOf(v) < 0) A.selTimes.push(v);
      render();
    } else if (act === 'saveDay' || act === 'closeDay') {
      saveDays(act === 'closeDay');
    } else if (act === 'copyPrev') {
      if (!confirm('依「星期幾」把上個月的時段，套用到 ' + K.monthTitle(A.month) + ' 還沒設定的日子？已經設定好的日子不會被改。')) return;
      try {
        var r = await K.call('admin.copyPrevMonth', { month: A.month });
        K.toast(r.added ? '已加入 ' + r.added + ' 個時段' : '上個月沒有可以複製的時段，或這個月都設定好了');
        loadMonth();
      } catch (err) { K.toast(K.errText(err)); }
    } else if (act === 'bTab') {
      A.bTab = el.getAttribute('data-s'); render();
    } else if (act === 'status') {
      await setStatus(el.getAttribute('data-id'), el.getAttribute('data-s'));
    } else if (act === 'cancel') {
      var b = A.bookings.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      if (!b || !confirm('取消 ' + b.nickname + ' ' + K.md(b.date) + ' ' + b.start + ' 的預約？時段會重新開放。')) return;
      await setStatus(b.id, ST.cancelled);
    } else if (act === 'copy') {
      var bb = A.bookings.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      copy(copyText(bb), '已複製預約資訊');
    } else if (act === 'cFilter') {
      A.cFilter = el.getAttribute('data-f'); render();
    } else if (act === 'block' || act === 'unblock') {
      var uid = el.getAttribute('data-uid');
      var c = A.customers.filter(function (x) { return x.uid === uid; })[0];
      var msg = act === 'block' ? '把 ' + (c.nickname || c.lineName) + ' 加入黑名單？她之後打開預約頁會看到「請直接傳訊息給我們」。' : '解除 ' + (c.nickname || c.lineName) + ' 的黑名單？';
      if (!confirm(msg)) return;
      try { await K.call('admin.block', { uid: uid, blocked: act === 'block' }); K.toast(act === 'block' ? '已加入黑名單' : '已解除黑名單'); loadCustomers(); }
      catch (err) { K.toast(K.errText(err)); }
    } else if (act === 'dismiss') {
      try { await K.call('admin.dismiss', { uid: el.getAttribute('data-uid') }); loadCustomers(); }
      catch (err) { K.toast(K.errText(err)); }
    } else if (act === 'copyId') {
      copy(A.me.userId, '已複製 LINE ID');
    } else if (act === 'reload') {
      location.reload();
    }
  });

  root.addEventListener('change', function (e) {
    if (e.target.id === 'sameWd') { A.sameWeekday = e.target.checked; render(); }
    if (e.target.id === 'extraMode') { A.extraMode = e.target.checked; if (!A.extraMode) A.extras = []; render(); }
  });
  root.addEventListener('input', function (e) {
    if (e.target.id === 'cq') { A.q = e.target.value; var box = document.getElementById('custList'); if (box) box.innerHTML = custList(); }
  });

  async function saveDays(close) {
    var locked = lockedTimes(A.sel);
    var times = close ? locked.slice() : A.selTimes.concat(locked.filter(function (t) { return A.selTimes.indexOf(t) < 0; }));
    var dates = [A.sel];
    if (A.sameWeekday) sameWeekdayDates(A.sel).forEach(function (d) { if (dates.indexOf(d) < 0) dates.push(d); });
    A.extras.forEach(function (d) { if (dates.indexOf(d) < 0) dates.push(d); });
    A.saving = true; render();
    try {
      await K.call('admin.saveDays', { dates: dates, times: times });
      K.toast(close && locked.length ? '已關閉，已有預約的時段會保留' : '已儲存 ' + dates.length + ' 天');
      A.extras = []; A.extraMode = false; A.sameWeekday = false;
      A.selTimes = times.slice();
      await loadMonth();
    } catch (err) { K.toast(K.errText(err)); }
    A.saving = false; render();
  }

  async function setStatus(id, s) {
    try {
      await K.call('admin.setStatus', { id: id, status: s });
      K.toast('已改成「' + s + '」');
      await loadBookings();
      if (A.monthData) loadMonth();
    } catch (err) { K.toast(K.errText(err)); }
  }

  function copy(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { K.toast(okMsg); }, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); K.toast(okMsg); } catch (e) { K.toast('複製失敗'); }
      ta.remove();
    }
  }

  boot();
})();

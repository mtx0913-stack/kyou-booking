/* 客人預約頁 */
(function () {
  var K = window.Kyou, esc = K.esc;
  var root = document.getElementById('app');
  var thisMonth = K.todayTW().slice(0, 7);

  var S = {
    screen: 'loading', data: null, serviceId: null, month: thisMonth, avail: {}, availLoading: false,
    date: null, time: null, qty: {}, nickname: '', same: true, phone: '', error: '', booking: null,
    showAllHist: false, busy: false, from: 'service'
  };

  function set(p, keepScroll) {
    var prev = S.screen;
    Object.assign(S, p);
    render();
    if (!keepScroll && S.screen !== prev) window.scrollTo(0, 0);
  }

  /* ---------- 啟動 ---------- */
  async function boot() {
    try {
      await K.start();
      await loadInit();
      set({ screen: S.data.blocked ? 'blocked' : 'service' });
    } catch (e) {
      set({ screen: 'fatal', error: K.errText(e) });
    }
  }

  async function loadInit() {
    var d = await K.call('init');
    S.data = d;
    var c = d.customer;
    if (!S.phone && c) S.phone = c.phone || '';
    if (!S.nickname) {
      S.nickname = (c && c.nickname) || d.user.name || '';
      S.same = !c || !c.nickname || c.nickname === d.user.name;
    }
  }

  function svc() { return (S.data.services || []).filter(function (s) { return s.id === S.serviceId; })[0]; }
  function hours(min) { var h = min / 60; return (Math.round(h * 10) / 10) + ' 小時'; }

  async function loadAvail() {
    var key = S.serviceId + '|' + S.month;
    if (S.avail[key]) return;
    S.availLoading = true;
    render();
    try {
      var r = await K.call('availability', { serviceId: S.serviceId, month: S.month });
      S.avail[key] = r.days || {};
    } catch (e) {
      K.toast(K.errText(e));
    }
    S.availLoading = false;
    render();
  }

  /* ---------- 共用片段 ---------- */
  function barBrand() {
    return '<header class="topbar"><div class="brand">' + K.LOGO + '<b>KYOU LASH</b></div></header>';
  }
  function barBack(title, to) {
    return '<header class="topbar"><button type="button" class="icon-btn" data-act="go" data-to="' + to + '" aria-label="上一步">' + K.ICON.back +
      '</button><div class="title">' + esc(title) + '</div><div style="width:44px"></div></header>';
  }
  function step(n, title, sub) {
    var bars = '';
    for (var i = 1; i <= 4; i++) bars += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return '<div class="step"><div class="num">步驟 ' + n + ' / 4</div><h1>' + esc(title) + '</h1><div class="bars" aria-hidden="true">' + bars + '</div>' +
      (sub ? '<div class="small muted">' + sub + '</div>' : '') + '</div>';
  }
  function footer(inner) { return '<div class="footer">' + inner + '</div>'; }
  function rulesNotice() {
    return '<div class="notice">' + K.ICON.info + '<div><div class="dash">送出後需等待<b>官方 LINE 回覆</b>，才算預約成功。</div>' +
      '<div>保留 15 分鐘緩衝時間，逾時視為取消。</div><div>連續無故未到兩次，恕無法再為你提供服務。</div></div></div>';
  }

  /* ---------- 畫面 ---------- */
  var screens = {
    loading: function () {
      return '<div class="loading"><div class="spinner" aria-hidden="true"></div><div>載入中…</div></div>';
    },

    fatal: function () {
      return barBrand() + '<div class="loading"><div class="round-icon">' + K.ICON.chat + '</div><div class="bold">' + esc(S.error) +
        '</div><button type="button" class="btn btn-line btn-sm" data-act="reload">重新整理</button></div>';
    },

    blocked: function () {
      var d = S.data;
      return barBrand() + '<main class="main"><div class="loading"><div class="round-icon">' + K.ICON.chat + '</div>' +
        '<div style="font-size:20px" class="bold">嗨，' + esc(d.user.name) + '</div>' +
        '<div class="muted" style="font-size:15px;line-height:1.8">目前無法使用線上預約<br>如需預約，請直接傳訊息給我們</div></div></main>' +
        footer('<button type="button" class="btn" data-act="chat">傳訊息給官方 LINE</button>');
    },

    service: function () {
      var d = S.data;
      var hello = d.completedCount > 0 ? '你已在日子預約 ' + d.completedCount + ' 次' : '歡迎來到日子';
      var list = d.services.map(function (s) {
        return '<label class="choice"><input type="radio" name="svc" value="' + esc(s.id) + '" data-act="svc"' + (S.serviceId === s.id ? ' checked' : '') + '>' +
          '<div class="body"><div class="row"><span>' + esc(s.name) + '</span><span>' + esc(s.priceText) + '</span></div>' +
          '<div class="small muted">' + esc(s.note) + (s.note ? '・' : '') + '約 ' + hours(s.minutes) + '</div></div></label>';
      }).join('');
      var up = d.upcoming.length
        ? '<div class="soft">你有 ' + d.upcoming.length + ' 筆預約：' + d.upcoming.map(function (b) { return K.md(b.date) + ' ' + b.start + '（' + esc(b.status) + '）'; }).join('、') + '</div>'
        : '';
      return barBrand() + '<main class="main">' +
        '<div class="card hello">' + K.avatar(d.user.name, d.user.picture) +
        '<div class="who"><b>嗨，' + esc(d.user.name) + '</b><div class="small muted">' + hello + '</div></div>' +
        '<a href="#" data-act="go" data-to="mine">我的預約 ›</a></div>' + up +
        step(1, '想做什麼項目？') + '<div class="choices" role="radiogroup" aria-label="服務項目">' + list + '</div></main>' +
        footer('<button type="button" class="btn" data-act="go" data-to="datetime"' + (S.serviceId ? '' : ' disabled') + '>下一步：選時間</button>');
    },

    datetime: function () {
      var s = svc();
      var key = S.serviceId + '|' + S.month;
      var days = S.avail[key];
      var today = K.todayTW();
      var first = S.month + '-01';
      var offset = K.weekday(first);
      var n = K.daysIn(S.month);
      var cells = '';
      for (var i = 0; i < offset; i++) cells += '<div class="day" aria-hidden="true"></div>';
      for (var dd = 1; dd <= n; dd++) {
        var date = S.month + '-' + K.pad(dd);
        var times = days && days[date];
        var cls = 'day', dis = true, label = (+S.month.slice(5)) + '月' + dd + '日';
        if (date >= today && times && times.length) { cls += ' open'; dis = false; label += '，可預約'; }
        else if (date >= today && times) { cls += ' full'; label += '，已額滿'; }
        if (date === S.date) cls += ' sel';
        cells += '<button type="button" class="' + cls + '" data-act="date" data-date="' + date + '"' + (dis ? ' disabled' : '') + ' aria-label="' + label + '"' +
          (date === S.date ? ' aria-pressed="true"' : '') + '><b>' + dd + '</b><i></i></button>';
      }
      var canPrev = S.month > thisMonth, canNext = S.month < K.shiftMonth(thisMonth, 2);
      var cal = '<div class="card cal"><div class="cal-head">' +
        '<button type="button" class="icon-btn" data-act="month" data-n="-1" aria-label="上個月"' + (canPrev ? '' : ' disabled') + '>' + K.ICON.prev + '</button>' +
        '<b>' + K.monthTitle(S.month) + '</b>' +
        '<button type="button" class="icon-btn" data-act="month" data-n="1" aria-label="下個月"' + (canNext ? '' : ' disabled') + '>' + K.ICON.next + '</button></div>' +
        '<div class="cal-week" aria-hidden="true">' + K.WD.map(function (w) { return '<div>' + w + '</div>'; }).join('') + '</div>' +
        (S.availLoading && !days ? '<div class="loading" style="padding:30px 0"><div class="spinner"></div></div>' : '<div class="cal-grid">' + cells + '</div>') +
        '<div class="legend"><span><i style="background:#A8805E"></i>有空檔</span><span><i style="background:#D9C7B0"></i>灰色＝已額滿或未開放</span></div></div>';

      var timesHtml = '';
      if (S.date && days) {
        var list = days[S.date] || [];
        timesHtml = '<div style="display:flex;flex-direction:column;gap:10px"><div class="bold">' + K.md(S.date) + ' 可預約時段</div>' +
          (list.length
            ? '<div class="times">' + list.map(function (t) {
                return '<button type="button" class="time' + (S.time === t ? ' sel' : '') + '" data-act="time" data-time="' + t + '" aria-pressed="' + (S.time === t) + '">' + t + '</button>';
              }).join('') + '</div><div class="tiny muted">已被預約、或接在後面做不完的時段不會顯示</div>'
            : '<div class="small muted">這天已經額滿，請選其他日期</div>') + '</div>';
      } else if (days && !Object.keys(days).some(function (k) { return k >= today && days[k].length; })) {
        timesHtml = '<div class="small muted">這個月目前沒有空檔，可以看看下個月</div>';
      }
      return barBack('日子 kyou 預約', 'service') + '<main class="main">' + step(2, '選擇日期與時段') +
        '<div class="chip">' + esc(s.name) + '・約 ' + hours(s.minutes) + '</div>' + cal + timesHtml + '</main>' +
        footer('<button type="button" class="btn" data-act="go" data-to="products"' + (S.time ? '' : ' disabled') + '>下一步</button>');
    },

    products: function () {
      var rows = S.data.products.map(function (p) {
        var q = S.qty[p.id] || 0;
        return '<div class="prod"><div class="body"><div class="name">' + esc(p.name) + '</div><div class="small muted">' + esc(p.note) + '</div></div>' +
          '<div class="stepper"><button type="button" class="minus" data-act="qty" data-id="' + esc(p.id) + '" data-d="-1" aria-label="減少 ' + esc(p.name) + '"' + (q ? '' : ' disabled') + '>−</button>' +
          '<output aria-live="polite">' + q + '</output>' +
          '<button type="button" data-act="qty" data-id="' + esc(p.id) + '" data-d="1" aria-label="增加 ' + esc(p.name) + '">＋</button></div></div>';
      }).join('');
      return barBack('日子 kyou 預約', 'datetime') + '<main class="main">' + step(3, '要順便帶保養品嗎？', '可略過。選了之後我們會先幫你備貨，到店再付款。') +
        '<div class="card list"><div class="label">MRR 居家保養</div>' + rows + '</div></main>' +
        footer('<button type="button" class="btn" data-act="go" data-to="info">下一步</button>' +
          '<button type="button" class="btn btn-ghost" data-act="skip">不用了，略過</button>');
    },

    info: function () {
      var d = S.data;
      return barBack('日子 kyou 預約', 'products') + '<main class="main">' + step(4, '留下聯絡資料') +
        '<div class="field"><div class="label">LINE 名稱</div><div class="linebox">' + K.avatar(d.user.name, d.user.picture, 'sm') +
        '<div style="flex:1">' + esc(d.user.name) + '</div><div class="tiny muted">自動帶入</div></div></div>' +
        '<div class="field"><label for="nick">希望怎麼稱呼你？</label>' +
        '<input id="nick" class="input" type="text" maxlength="30" autocomplete="nickname" value="' + esc(S.same ? d.user.name : S.nickname) + '"' + (S.same ? ' disabled' : '') + '>' +
        '<label class="check"><input type="checkbox" id="same"' + (S.same ? ' checked' : '') + '><span>同 LINE 名稱</span></label></div>' +
        '<div class="field"><label for="phone">聯絡電話</label>' +
        '<input id="phone" class="input" type="tel" inputmode="tel" autocomplete="tel" maxlength="14" placeholder="0912 345 678" value="' + esc(S.phone) + '">' +
        '<div class="tiny muted">只用於聯繫這次預約，不會公開</div></div>' +
        (S.error ? '<div class="err" role="alert">' + esc(S.error) + '</div>' : '') +
        (d.customer ? '' : '<div class="tiny muted">第二次之後，稱呼和電話會自動帶入這次填的內容。</div>') + '</main>' +
        footer('<button type="button" class="btn" data-act="toConfirm">確認預約內容</button>');
    },

    confirm: function () {
      var s = svc();
      var pp = K.priceProducts(S.data.products, S.qty);
      var nick = S.same ? S.data.user.name : S.nickname;
      var r = function (k, v, price) {
        return '<div class="r"><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (price != null ? '<div>' + K.money(price) + '</div>' : '') + '</div>';
      };
      return barBack('日子 kyou 預約', 'info') + '<main class="main"><div class="step"><h1>確認預約內容</h1></div>' +
        '<div class="card summary">' +
        r('項目', esc(s.name), s.price) +
        r('時間', K.md(S.date) + ' ' + S.time + '–' + endTime(S.time, s.minutes)) +
        (pp.text ? r('加購', esc(pp.text), pp.total) : '') +
        r('稱呼', esc(nick)) + r('電話', esc(fmtPhone(S.phone))) +
        '<div class="r"><div class="v">合計（到店付款）</div><div>' + K.money(s.price + pp.total) + '</div></div></div>' +
        '<div class="soft"><div>・僅接受現金及現場轉帳</div><div>・地址：臺中西區五權路（預約成功後提供詳細地址）</div></div>' +
        rulesNotice() + (S.error ? '<div class="err" role="alert">' + esc(S.error) + '</div>' : '') + '</main>' +
        footer('<button type="button" class="btn" data-act="book"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? '送出中…' : '送出預約申請') + '</button>');
    },

    submitted: function () {
      var b = S.booking;
      return '<header class="topbar"><div class="title" style="margin:0 auto">日子 kyou 預約</div></header>' +
        '<main class="main" style="align-items:center;gap:22px;padding-top:32px">' +
        '<div class="round-icon">' + K.ICON.clock + '</div>' +
        '<div class="center"><h1 style="margin:0;font-size:22px">預約申請已送出</h1><div class="muted" style="font-size:15px">還沒有預約成功喔！<br>請留意官方 LINE 的回覆</div></div>' +
        '<div class="card track" style="width:100%">' +
        '<div class="s"><div class="dot" style="background:#7A5C42">' + K.ICON.check + '</div><b>已送出申請</b></div>' +
        '<div class="s"><div class="dot" style="border:2px solid #A8805E;color:#7A5C42">2</div><b>等待官方 LINE 回覆確認</b></div>' +
        '<div class="s"><div class="dot" style="border:2px solid #D9C7B0;color:#6E5B4A">3</div><span class="muted">預約成功，收到詳細地址</span></div></div>' +
        '<div class="soft" style="width:100%;font-size:14px"><div class="bold">' + K.md(b.date) + ' ' + b.start + '　' + esc(b.serviceName) + '</div><div class="muted">這個時段已先為你保留</div></div>' +
        '<div class="notice" style="width:100%;font-size:13px">' + K.ICON.info + '<div><div>保留 15 分鐘緩衝時間，逾時視為取消</div><div>連續無故未到兩次，恕無法再為你提供服務</div></div></div>' +
        '</main>' +
        footer('<button type="button" class="btn" data-act="chat">回到 LINE 聊天室</button><button type="button" class="btn btn-ghost" data-act="go" data-to="mine">查看我的預約</button>');
    },

    mine: function () {
      var d = S.data;
      var up = d.upcoming.slice().sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); }).map(function (b) {
        var cls = b.status === '已確認' ? 'badge-confirmed' : 'badge-pending';
        return '<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
          '<b style="font-size:16px">' + K.md(b.date) + ' ' + b.start + '</b><span class="badge ' + cls + '">' + esc(b.status) + '</span></div>' +
          '<div class="small muted">' + esc(b.serviceName) + (b.productsText ? '・加購 ' + esc(b.productsText) : '') + '</div></div>';
      }).join('');
      var hist = d.history.slice(0, S.showAllHist ? 999 : 3).map(function (b) {
        return '<div class="r"><div><div class="bold">' + K.md(b.date) + '</div><div class="small muted">' + esc(b.serviceName) + '</div></div><div class="tiny muted">已完成</div></div>';
      }).join('');
      var more = !S.showAllHist && d.history.length > 3
        ? '<button type="button" class="btn btn-ghost" data-act="moreHist">顯示更早的 ' + (d.history.length - 3) + ' 筆</button>' : '';
      return barBack('我的預約', S.from === 'submitted' ? 'service' : S.from) + '<main class="main">' +
        '<div class="count"><div><div class="bold" style="font-size:14px">' + esc(d.user.name) + (d.completedCount ? '，謝謝你常來' : '') + '</div><div class="small">在日子完成的預約</div></div>' +
        '<div><big>' + d.completedCount + '</big> <b>次</b></div></div>' +
        '<div style="display:flex;flex-direction:column;gap:10px"><div class="bold">即將到來</div>' + (up || '<div class="small muted">目前沒有預約</div>') + '</div>' +
        (hist ? '<div style="display:flex;flex-direction:column;gap:10px"><div class="bold">過去的預約</div><div class="card rows">' + hist + '</div>' + more + '</div>' : '') +
        '<div class="tiny muted" style="text-align:center">要改時間或取消，請直接傳官方 LINE 給我們</div>' +
        '<button type="button" class="btn btn-line" data-act="go" data-to="service">預約新的時間</button></main>';
    }
  };

  function endTime(t, min) { var x = +t.slice(0, 2) * 60 + +t.slice(3, 5) + min; return K.pad(Math.floor(x / 60)) + ':' + K.pad(x % 60); }
  function fmtPhone(p) { p = String(p).replace(/\D/g, ''); return p.length === 10 ? p.slice(0, 4) + ' ' + p.slice(4, 7) + ' ' + p.slice(7) : p; }

  function render() {
    var fn = screens[S.screen] || screens.loading;
    root.innerHTML = fn();
  }

  /* ---------- 互動 ---------- */
  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var act = el.getAttribute('data-act');
    if (act === 'svc') return;
    if (el.tagName === 'A') e.preventDefault();

    if (act === 'go') {
      var to = el.getAttribute('data-to');
      if (to === 'mine') {
        S.from = S.screen === 'mine' ? 'service' : S.screen; S.showAllHist = false;
        loadInit().then(function () { if (S.screen === 'mine') render(); }, function () {});
      }
      if (to === 'datetime' && S.screen === 'service') { set({ screen: 'datetime', error: '' }); loadAvail(); return; }
      if (to === 'service' && S.screen === 'mine') { S.from = 'service'; }
      set({ screen: to, error: '' });
    } else if (act === 'month') {
      S.month = K.shiftMonth(S.month, +el.getAttribute('data-n'));
      S.date = null; S.time = null;
      render();
      loadAvail();
    } else if (act === 'date') {
      set({ date: el.getAttribute('data-date'), time: null }, true);
    } else if (act === 'time') {
      set({ time: el.getAttribute('data-time') }, true);
    } else if (act === 'qty') {
      var id = el.getAttribute('data-id');
      var q = Math.max(0, Math.min(10, (S.qty[id] || 0) + +el.getAttribute('data-d')));
      S.qty[id] = q;
      render();
    } else if (act === 'skip') {
      set({ qty: {}, screen: 'info' });
    } else if (act === 'toConfirm') {
      var nick = S.same ? S.data.user.name : S.nickname.trim();
      var ph = S.phone.replace(/\D/g, '');
      if (!nick) return set({ error: '請填寫希望的稱呼' }, true);
      if (!/^0\d{8,9}$/.test(ph)) return set({ error: '電話格式不正確，請輸入 09 開頭的手機或市話' }, true);
      set({ screen: 'confirm', error: '' });
    } else if (act === 'book') {
      book();
    } else if (act === 'chat') {
      K.closeOrChat(S.data && S.data.lineOaId);
    } else if (act === 'moreHist') {
      set({ showAllHist: true }, true);
    } else if (act === 'reload') {
      location.reload();
    }
  });

  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'svc') {
      if (S.serviceId !== t.value) { S.serviceId = t.value; S.date = null; S.time = null; }
      render();
    } else if (t.id === 'same') {
      S.same = t.checked;
      if (!S.same && S.nickname === S.data.user.name) S.nickname = '';
      render();
      if (!S.same) { var n = document.getElementById('nick'); if (n) n.focus(); }
    }
  });

  root.addEventListener('input', function (e) {
    if (e.target.id === 'nick') S.nickname = e.target.value;
    if (e.target.id === 'phone') S.phone = e.target.value;
  });

  async function book() {
    if (S.busy) return;
    set({ busy: true, error: '' }, true);
    try {
      var r = await K.call('book', {
        serviceId: S.serviceId, date: S.date, time: S.time, products: S.qty,
        nickname: S.same ? S.data.user.name : S.nickname.trim(), phone: S.phone
      });
      S.booking = r.booking;
      S.busy = false;
      set({ screen: 'submitted', qty: {}, time: null, date: null });
      S.avail = {};
      loadInit().then(render, function () {});
    } catch (e) {
      S.busy = false;
      var code = e.code;
      if (code === 'slot_taken') {
        S.avail = {};
        K.toast(K.errText(e));
        set({ screen: 'datetime', time: null });
        loadAvail();
      } else if (code === 'blocked') {
        S.data.blocked = true;
        set({ screen: 'blocked' });
      } else if (code === 'bad_phone' || code === 'need_nickname') {
        set({ screen: 'info', error: K.errText(e) });
      } else {
        set({ error: K.errText(e) }, true);
      }
    }
  }

  boot();
})();

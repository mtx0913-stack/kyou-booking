/* 共用：LINE 登入、呼叫後端、日期小工具 */
(function () {
  var C = window.KYOU_CONFIG || {};
  var demo = !C.LIFF_ID || !C.API_URL || /[?&]demo=1\b/.test(location.search);
  var idToken = null;
  var relogging = false;

  function hasLiff() { return typeof window.liff !== 'undefined'; }

  async function start() {
    if (demo) return { demo: true };
    if (!hasLiff()) throw codeErr('liff_missing');
    await liff.init({ liffId: C.LIFF_ID });
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: location.href });
      return new Promise(function () {});
    }
    idToken = liff.getIDToken();
    if (!idToken) throw codeErr('no_id_token');
    return { demo: false };
  }

  /** 只讀取資料的動作，失敗時可以安全地自動再試 */
  var SAFE = { init: 1, availability: 1, 'admin.whoami': 1, 'admin.month': 1, 'admin.bookings': 1, 'admin.customers': 1 };

  async function call(action, data) {
    if (demo) {
      await new Promise(function (r) { setTimeout(r, 250); });
      return window.KyouMock(action, data || {});
    }
    var tries = SAFE[action] ? 3 : 1;
    for (var i = 1; ; i++) {
      try { return await callOnce(action, data); }
      catch (e) {
        var retry = e.code === 'network' || e.code === 'bad_response';
        if (!retry || i >= tries) throw e;
        await new Promise(function (r) { setTimeout(r, 600 * i); });
      }
    }
  }

  async function callOnce(action, data) {
    var res;
    try {
      res = await fetch(C.API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: action, data: data || {}, idToken: idToken })
      });
    } catch (e) {
      throw codeErr('network');
    }
    var j;
    try { j = await res.json(); } catch (e) { throw codeErr('network'); }
    // 偶爾 Google 會把請求轉成 GET，拿到的不是這次動作的結果
    if (j && j.name === 'kyou booking api') throw codeErr('bad_response');
    if (!j.ok) {
      if ((j.error === 'invalid_token' || j.error === 'not_logged_in') && !relogging && hasLiff()) {
        relogging = true;
        liff.logout();
        liff.login({ redirectUri: location.href });
        return new Promise(function () {});
      }
      throw codeErr(j.error || 'server_error');
    }
    return j;
  }

  function codeErr(code) { var e = new Error(code); e.code = code; return e; }

  function closeOrChat(oaId) {
    if (!demo && hasLiff() && liff.isInClient()) {
      liff.closeWindow();
      return;
    }
    location.href = 'https://line.me/R/ti/p/' + encodeURIComponent(oaId || '');
  }

  /* ---------- 小工具 ---------- */
  var WD = ['日', '一', '二', '三', '四', '五', '六'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayTW() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
  function nowMs() { return Date.now(); }
  function toMs(date, time) {
    return Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +time.slice(0, 2) - 8, +time.slice(3, 5));
  }
  function weekday(date) { return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))).getUTCDay(); }
  function daysIn(month) { return new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate(); }
  function shiftMonth(month, n) {
    var y = +month.slice(0, 4), m = +month.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function md(date) { return date.slice(5, 7) + '/' + date.slice(8, 10) + '（' + WD[weekday(date)] + '）'; }
  function monthTitle(month) { return month.slice(0, 4) + ' 年 ' + (+month.slice(5, 7)) + ' 月'; }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-US'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeImg(url) { return /^https:\/\/[^\s"'<>]+$/.test(String(url || '')) ? url : ''; }
  function avatar(name, picture, cls) {
    var u = safeImg(picture);
    var ch = Array.from(String(name || '').trim())[0] || '?';
    return '<div class="avatar ' + (cls || '') + '" aria-hidden="true">' + (u ? '<img src="' + esc(u) + '" alt="">' : esc(ch.toUpperCase())) + '</div>';
  }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function priceProducts(products, qty) {
    var total = 0, parts = [];
    products.forEach(function (p) {
      var q = qty[p.id] || 0;
      if (!q) return;
      total += p.pairPrice ? Math.floor(q / 2) * p.pairPrice + (q % 2) * p.price : q * p.price;
      parts.push(p.name + ' × ' + q);
    });
    return { total: total, text: parts.join('、') };
  }

  var LOGO = '<div class="logo" aria-hidden="true"><svg width="52" height="37" viewBox="10 20 206 146"><path d="M40 90 C30 50 70 28 110 36 C150 22 196 50 186 92 C200 136 150 160 110 150 C70 162 26 136 40 90 Z" fill="#C9A27E"/><path d="M190 42 L196 28" stroke="#6E5B4A" stroke-width="9" stroke-linecap="round"/><path d="M202 52 L214 44" stroke="#6E5B4A" stroke-width="9" stroke-linecap="round"/></svg><span>日子</span></div>';

  var ICON = {
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    next: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    prev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7A5C42" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5v.01"/></svg>',
    clock: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#7A5C42" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    chat: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#7A5C42" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16v10H9l-5 4z"/><path d="M8 10h8"/><path d="M8 13h5"/></svg>',
    warn: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9E3A2E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5v.01"/></svg>'
  };

  var ERR = {
    network: '連線不穩，請稍後再試',
    not_configured: '系統還沒設定完成，請先私訊官方 LINE',
    not_logged_in: '登入逾時，請重新開啟',
    invalid_token: '登入逾時，請重新開啟',
    slot_taken: '這個時段剛被預約走了，請選別的時間',
    too_many: '你已經有尚未完成的預約，想再約請直接傳 LINE 給我們',
    bad_phone: '電話格式不正確，請輸入 09 開頭的手機或市話',
    need_nickname: '請填寫希望的稱呼',
    not_admin: '這個 LINE 帳號不是管理者',
    liff_missing: 'LINE 元件載入失敗，請重新開啟',
    not_yet: '預約時間還沒到，不能標記結果',
    bad_status: '這筆預約的狀態已經變了，請重新整理',
    bad_response: '連線不穩，請重新整理確認結果',
    need_reason: '請填寫取消原因',
    need_cancel_by: '請選擇是客人要求還是店家調動'
  };
  function errText(e) {
    var code = (e && e.code) || '';
    if (ERR[code]) return ERR[code];
    var why = code || (e && e.name) || '';
    return '發生錯誤，請稍後再試' + (why ? '（' + why + '）' : '');
  }

  window.Kyou = {
    start: start, call: call, isDemo: function () { return demo; }, closeOrChat: closeOrChat,
    todayTW: todayTW, nowMs: nowMs, toMs: toMs, weekday: weekday, daysIn: daysIn, shiftMonth: shiftMonth,
    md: md, monthTitle: monthTitle, money: money, esc: esc, avatar: avatar, toast: toast, pad: pad,
    priceProducts: priceProducts, errText: errText, LOGO: LOGO, ICON: ICON, WD: WD
  };
})();

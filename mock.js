/* 示範模式用的假後端（只在還沒設定 config.js 時使用，不會存檔） */
(function () {
  var K = window.Kyou;
  var P = { pending: '待確認', confirmed: '已確認', completed: '已完成', noshow: '放鳥', cancelled: '已取消' };
  var today = K.todayTW();
  function addDays(date, n) {
    var d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n));
    return d.toISOString().slice(0, 10);
  }
  function addMin(t, m) { var x = +t.slice(0, 2) * 60 + +t.slice(3, 5) + m; return K.pad(Math.floor(x / 60)) + ':' + K.pad(x % 60); }

  var me = { id: 'Udemo', name: '小美 Mei', picture: '' };
  var db = {
    services: [
      { id: 'upper', name: '上睫毛＋增黑', price: 799, minutes: 120, note: '上睫毛管理及深層保養', priceText: '$799' },
      { id: 'lower', name: '下睫毛＋增黑', price: 499, minutes: 60, note: '下睫毛管理及深層保養', priceText: '$499' },
      { id: 'both', name: '上＋下睫毛', price: 1298, minutes: 180, note: '上下一起做', priceText: '$799＋$499' }
    ],
    addons: [
      { id: 'remove', name: '嫁接卸除', price: 400, minutes: 10, note: '卸除原本的嫁接睫毛' }
    ],
    products: [
      { id: 'b5', name: 'B5 睫毛修護液（強韌液）', price: 680, pairPrice: 1300, note: '一瓶 $680・兩瓶 $1,300' },
      { id: 'peptide', name: '睫毛多肽纖長液', price: 1200, pairPrice: 2300, note: '一瓶 $1,200・兩瓶 $2,300' },
      { id: 'combo', name: 'A 纖長液＋B 強韌液 組合', price: 1850, pairPrice: 0, note: '組合價 $1,850' }
    ],
    slots: [],
    bookings: [],
    customers: [
      { uid: 'Udemo', lineName: '小美 Mei', picture: '', nickname: '小美 Mei', phone: '0912345678', blocked: false, dismissed: 0 },
      { uid: 'Uivy', lineName: 'Ivy Chen', picture: '', nickname: 'Ivy', phone: '0928765432', blocked: false, dismissed: 0 },
      { uid: 'Ukiki', lineName: 'Kiki', picture: '', nickname: 'Kiki', phone: '0920246810', blocked: false, dismissed: 0 },
      { uid: 'Unana', lineName: 'Nana', picture: '', nickname: 'Nana', phone: '0977888999', blocked: false, dismissed: 0 },
      { uid: 'Ucoco', lineName: 'Coco', picture: '', nickname: 'Coco', phone: '0910135790', blocked: true, dismissed: 0 },
      { uid: 'Uamber', lineName: 'Amber', picture: '', nickname: 'Amber', phone: '0966555666', blocked: false, dismissed: 0 }
    ]
  };
  // 未來 40 天：二、四、五、六開 10:00 / 13:00 / 16:00
  for (var i = 1; i <= 40; i++) {
    var d = addDays(today, i), w = K.weekday(d);
    if (w === 2 || w === 4 || w === 5 || w === 6) ['10:00', '13:00', '16:00'].forEach(function (t) { db.slots.push({ date: d, time: t }); });
  }
  var seq = 1;
  function bk(uid, svcId, date, start, status, products) {
    var c = db.customers.filter(function (x) { return x.uid === uid; })[0];
    var s = db.services.filter(function (x) { return x.id === svcId; })[0];
    var pp = K.priceProducts(db.products, products || {});
    db.bookings.push({
      id: 'D' + (seq++), created: today + ' 12:00', uid: uid, lineName: c.lineName, picture: '', nickname: c.nickname, phone: c.phone,
      serviceName: s.name, date: date, start: start, end: addMin(start, s.minutes), productsText: pp.text, total: s.price + pp.total, status: status
    });
  }
  var firstOpen = db.slots[0].date;
  bk('Uivy', 'both', firstOpen, '13:00', P.pending);
  bk('Udemo', 'upper', db.slots[6].date, '10:00', P.pending, { b5: 1 });
  bk('Uamber', 'lower', db.slots[3].date, '10:00', P.confirmed);
  db.bookings[db.bookings.length - 1].reminded = today + ' 10:00';
  db.bookings[db.bookings.length - 1].attended = today + ' 12:30';
  bk('Ukiki', 'upper', addDays(today, -1), '16:00', P.confirmed);
  bk('Uamber', 'lower', addDays(today, -3), '10:00', P.completed);
  [35, 63, 91, 119, 147].forEach(function (n) { bk('Udemo', 'upper', addDays(today, -n), '10:00', P.completed); });
  bk('Ukiki', 'upper', addDays(today, -20), '13:00', P.completed);
  bk('Ukiki', 'upper', addDays(today, -10), '13:00', P.noshow);
  bk('Unana', 'lower', addDays(today, -40), '13:00', P.completed);
  bk('Unana', 'lower', addDays(today, -25), '13:00', P.noshow);
  bk('Unana', 'lower', addDays(today, -6), '13:00', P.noshow);
  bk('Ucoco', 'upper', addDays(today, -60), '10:00', P.noshow);
  bk('Ucoco', 'upper', addDays(today, -50), '10:00', P.noshow);

  function stats(uid) {
    var done = db.bookings.filter(function (b) { return b.uid === uid && (b.status === P.completed || b.status === P.noshow); })
      .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
    var streak = 0;
    for (var i = done.length - 1; i >= 0 && done[i].status === P.noshow; i--) streak++;
    return { completed: done.filter(function (b) { return b.status === P.completed; }).length, streak: streak, lastDate: done.length ? done[done.length - 1].date : '' };
  }
  function avail(date, minutes) {
    var now = Date.now() + 2 * 3600000;
    var busy = db.bookings.filter(function (b) { return b.date === date && (b.status === P.pending || b.status === P.confirmed); })
      .map(function (b) { return [K.toMs(date, b.start), K.toMs(date, b.end)]; });
    return db.slots.filter(function (s) { return s.date === date; }).map(function (s) { return s.time; }).filter(function (t) {
      var s = K.toMs(date, t), e = s + minutes * 60000;
      return s >= now && !busy.some(function (r) { return s < r[1] && r[0] < e; });
    }).sort();
  }
  function err(code) { var e = new Error(code); e.code = code; throw e; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  var asCoco = /[?&]as=coco\b/.test(location.search);

  window.KyouMock = function (action, d) {
    var user = asCoco ? { id: 'Ucoco', name: 'Coco', picture: '' } : me;
    var cust = db.customers.filter(function (c) { return c.uid === user.id; })[0];
    switch (action) {
      case 'init': {
        var blocked = !!(cust && cust.blocked);
        var mine = db.bookings.filter(function (b) { return b.uid === user.id; });
        return clone({
          ok: true, user: { name: user.name, picture: user.picture }, blocked: blocked, lineOaId: '@052grnjm',
          customer: cust ? { nickname: cust.nickname, phone: cust.phone } : null,
          completedCount: stats(user.id).completed, services: db.services, addons: db.addons, products: db.products,
          cal: (function () {
            var slots = {}, busy = {};
            db.slots.forEach(function (s) { if (s.date >= today) (slots[s.date] = slots[s.date] || []).push(s.time); });
            db.bookings.forEach(function (b) {
              if ((b.status === P.pending || b.status === P.confirmed) && slots[b.date]) (busy[b.date] = busy[b.date] || []).push([K.toMs(b.date, b.start), K.toMs(b.date, b.end)]);
            });
            return { slots: slots, busy: busy, earliest: Date.now() + 2 * 3600000 };
          })(),
          upcoming: mine.filter(function (b) { return (b.status === P.pending || b.status === P.confirmed) && K.toMs(b.date, b.end) > Date.now(); }),
          history: mine.filter(function (b) { return b.status === P.completed; }).sort(function (a, b) { return b.date.localeCompare(a.date); })
        });
      }
      case 'availability': {
        var svc = db.services.filter(function (s) { return s.id === d.serviceId; })[0];
        var days = {};
        db.slots.forEach(function (s) { if (s.date.indexOf(d.month) === 0) days[s.date] = true; });
        Object.keys(days).forEach(function (k) { days[k] = avail(k, svc.minutes); });
        return { ok: true, days: days };
      }
      case 'book': {
        var svc2 = db.services.filter(function (s) { return s.id === d.serviceId; })[0];
        var ad = db.addons.filter(function (a) { return (d.addons || []).indexOf(a.id) >= 0; });
        var mins = svc2.minutes + ad.reduce(function (t, a) { return t + a.minutes; }, 0);
        if (avail(d.date, mins).indexOf(d.time) < 0) err('slot_taken');
        var phone = String(d.phone || '').replace(/\D/g, '');
        if (!/^0\d{8,9}$/.test(phone)) err('bad_phone');
        cust.nickname = d.nickname; cust.phone = phone;
        var pp = K.priceProducts(db.products, d.products || {});
        var b = { id: 'D' + (seq++), created: today, uid: user.id, lineName: user.name, picture: '', nickname: d.nickname, phone: phone,
          serviceName: svc2.name + ad.map(function (a) { return '＋' + a.name; }).join(''), date: d.date, start: d.time, end: addMin(d.time, mins), productsText: pp.text,
          total: svc2.price + ad.reduce(function (t, a) { return t + a.price; }, 0) + pp.total, status: P.pending };
        db.bookings.push(b);
        return { ok: true, booking: clone(b) };
      }
      case 'attend': {
        var ab = db.bookings.filter(function (b) { return b.id === d.id && b.uid === user.id && b.status === P.confirmed; })[0];
        if (!ab) err('attend_closed');
        ab.attended = true;
        return { ok: true, booking: clone(ab) };
      }
      case 'admin.whoami': return { ok: true, userId: user.id, name: user.name, isAdmin: true };
      case 'admin.month': {
        var slots = {};
        db.slots.forEach(function (s) { if (s.date.indexOf(d.month) === 0) (slots[s.date] = slots[s.date] || []).push(s.time); });
        Object.keys(slots).forEach(function (k) { slots[k].sort(); });
        return { ok: true, slots: slots, bookings: clone(db.bookings.filter(function (b) { return b.date.indexOf(d.month) === 0 && b.status !== P.cancelled; })) };
      }
      case 'admin.saveDays': {
        db.slots = db.slots.filter(function (s) { return d.dates.indexOf(s.date) < 0; });
        d.dates.forEach(function (date) { d.times.forEach(function (t) { db.slots.push({ date: date, time: t }); }); });
        return { ok: true };
      }
      case 'admin.copyPrevMonth': return { ok: true, added: 0 };
      case 'admin.bookings': {
        return { ok: true, autoCompleteHours: 24, sheetUrl: 'https://docs.google.com/spreadsheets/', bookings: clone(db.bookings.map(function (b) {
          var st = stats(b.uid); return Object.assign({}, b, { completedCount: st.completed, streak: st.streak });
        })) };
      }
      case 'admin.setStatus': {
        var x = db.bookings.filter(function (b) { return b.id === d.id; })[0];
        x.status = d.status;
        return { ok: true };
      }
      case 'admin.customers': {
        return { ok: true, customers: clone(db.customers.map(function (c) {
          var st = stats(c.uid);
          var cc = db.bookings.filter(function (b) { return b.uid === c.uid && b.status === '已取消'; }).length;
          return Object.assign({}, c, { note: c.note || '', cancelCount: cc, completedCount: st.completed, streak: st.streak, lastDate: st.lastDate, needsPrompt: !c.blocked && st.streak >= 2 && st.streak > c.dismissed });
        }).sort(function (a, b) { return b.lastDate.localeCompare(a.lastDate); })) };
      }
      case 'admin.block': {
        db.customers.filter(function (c) { return c.uid === d.uid; })[0].blocked = !!d.blocked;
        return { ok: true };
      }
      case 'admin.note': {
        db.customers.filter(function (c) { return c.uid === d.uid; })[0].note = String(d.note || '');
        return { ok: true, note: String(d.note || '') };
      }
      case 'admin.dismiss': {
        var c = db.customers.filter(function (c) { return c.uid === d.uid; })[0];
        c.dismissed = stats(c.uid).streak;
        return { ok: true };
      }
    }
    err('unknown_action');
  };
})();

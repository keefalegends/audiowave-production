// ===== KONFIGURASI =====
// Ganti API_BASE_URL dengan Invoke URL dari API Gateway AWS yang nanti Anda deploy
const API_BASE_URL = 'https://icn5mfbylg.execute-api.us-west-2.amazonaws.com/prod';

/* ===================================================
   STATE
=================================================== */
const state = {
  events: [],
  orders: [],
  tickets: [],
  tokens: {},
  sqsOrder: [],
  sqsPayment: [],
  dlqOrder: [],
  dlqPayment: [],
  payments: [],
  logs: [],
  wsConnected: false,
  wsConnectionId: null,
  wsConnections: [],
  wsMessages: [],
  logFilter: 'all',
  selectedEvent: null,
  lambdaInvocations: {},
};

const lambdaFunctions = [
  { name: 'lks-read-event', handler: 'readEvent.handler', trigger: 'API Gateway GET /event' },
  { name: 'lks-write-event', handler: 'writeEvent.handler', trigger: 'API Gateway POST,PUT,DELETE /event' },
  { name: 'lks-read-order', handler: 'readOrder.handler', trigger: 'API Gateway GET /order' },
  { name: 'lks-queue-order', handler: 'queueOrder.handler', trigger: 'API Gateway POST /order' },
  { name: 'lks-write-order', handler: 'writeOrder.handler', trigger: 'SQS lks-queue-order' },
  { name: 'lks-ticket', handler: 'ticket.handler', trigger: 'API Gateway POST,DELETE /ticket' },
  { name: 'lks-auth', handler: 'auth.handler', trigger: 'API Gateway Authorizer' },
  { name: 'lks-token', handler: 'token.handler', trigger: 'API Gateway POST /token' },
  { name: 'lks-payment', handler: 'payment.handler', trigger: 'SQS lks-queue-payment' },
  { name: 'lks-websocket', handler: 'websocket.handler', trigger: 'WebSocket API (6 routes)' },
];

const eventColors = ['#1a1a3e', '#1a2a1a', '#2a1a1a', '#1a2a2a', '#2a1a2a'];
const eventEmojis = ['🎸', '🎺', '🥁', '🎹', '🎻', '🎤', '🎧', '🎵'];

/* ===================================================
   UTILITIES
=================================================== */
function nowTs() { return new Date().toLocaleTimeString('id-ID', { hour12: false }); }
function nowFull() { return new Date().toLocaleString('id-ID'); }
function uid() { return Math.random().toString(36).substr(2, 9).toUpperCase(); }
function fmtRp(n) {
  if (n === undefined || n === null) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function toast(title, msg, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', ws: '🔌' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-icon">${icons[type] || '•'}</div><div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.animation = 'toast-out 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }, 3500);
}

function addLog(fn, msg, type = 'ok') {
  const colors = {
    'lks-read-event': '#6de8fa', 'lks-write-event': '#e8c96d', 'lks-queue-order': '#a594ff',
    'lks-write-order': '#6dfaaa', 'lks-auth': '#fa6d7c', 'lks-token': '#faaa6d',
    'lks-ticket': '#6d9efa', 'lks-payment': '#fa9d6d', 'lks-websocket': '#c86dfa', 'system': '#555'
  };
  const entry = { fn, msg, type, ts: nowTs(), color: colors[fn] || '#888' };
  state.logs.push(entry);
  state.lambdaInvocations[fn] = (state.lambdaInvocations[fn] || 0) + 1;
  renderTerminal();
}

function renderTerminal() {
  const t = document.getElementById('lambda-terminal');
  if (!t) return;
  const filtered = state.logFilter === 'all' ? state.logs : state.logs.filter(l => l.fn === state.logFilter);
  t.innerHTML = filtered.map(l => {
    const cls = l.type === 'err' ? 'msg-err' : l.type === 'warn' ? 'msg-warn' : l.type === 'info' ? 'msg-info' : l.type === 'dim' ? 'msg-dim' : 'msg-ok';
    return `<div class="log-line"><span class="ts">${l.ts}</span><span class="fn-tag" style="background:${l.color}22;color:${l.color}">${l.fn}</span><span class="${cls}">${l.msg}</span></div>`;
  }).join('');
  t.scrollTop = t.scrollHeight;
}

function filterLog(fn, btn) {
  state.logFilter = fn;
  document.querySelectorAll('.page#page-lambda-page .btn-sm').forEach(b => b.style.borderColor = '');
  if (btn) btn.style.borderColor = 'var(--accent)';
  renderTerminal();
}

function clearAllLogs() { state.logs = []; renderTerminal(); }

/* ===================================================
   NAVIGATION
=================================================== */
const pageTitles = {
  dashboard: 'Dashboard', events: 'Events', orders: 'Orders', tickets: 'Tiket Saya',
  payment: 'Pembayaran', 'auth-page': 'Auth & Token', 'sqs-page': 'SQS Queue',
  'websocket-page': 'WebSocket API', 'lambda-page': 'Lambda Logs', 'arch-page': 'Architecture'
};

function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  document.getElementById('topbar-title').textContent = pageTitles[name] || name;

  if (name === 'events') renderEvents();
  if (name === 'orders') renderOrders();
  if (name === 'tickets') renderTickets();
  if (name === 'sqs-page') renderSQS();
  if (name === 'lambda-page') { renderTerminal(); renderLambdaRegistry(); }
  if (name === 'dashboard') renderDashboard();
  if (name === 'auth-page') renderDynamoTable();
  if (name === 'payment') renderPaymentQueue();
}

/* ===================================================
   MODAL
=================================================== */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
});

/* ===================================================
   EVENTS
=================================================== */
async function renderEvents() {
  const grid = document.getElementById('events-grid');
  if (!grid) return;

  // Real API Call
  if (state.events.length === 0) {
    try {
      addLog('lks-read-event', `GET /events → Memanggil API...`, 'info');
      const res = await fetch(`${API_BASE_URL}/events`);
      const rawEvents = await res.json();

      // Mapping nama kolom RDS ke properti Frontend
      state.events = rawEvents.map(ev => ({
        id: ev.id,
        name: ev.name,
        venue: ev.venue,
        location: ev.venue, // Karena di DB cuma ada venue
        date: ev.date ? ev.date.split('T')[0] : '-',
        time: ev.date ? ev.date.split('T')[1]?.substring(0, 5) : '19:00',
        price: ev.ticket_price || 0,
        tickets: ev.available_quota || 0,
        desc: ev.description || '-'
      }));

      addLog('lks-read-event', `GET /events → Success (${state.events.length} items)`, 'ok');
    } catch (err) {
      addLog('lks-read-event', `GET /events → Error: ${err.message}`, 'err');
    }
  }

  const search = (document.getElementById('event-search')?.value || '').toLowerCase();
  const evs = state.events.filter(e => !search || e.name.toLowerCase().includes(search) || e.location.toLowerCase().includes(search));

  addLog('lks-read-event', `GET /event → SELECT * FROM events WHERE... (${evs.length} rows)`, 'ok');

  grid.innerHTML = evs.map((ev, i) => `
    <div class="event-card">
      <div class="event-card-hero" style="background:${eventColors[i % eventColors.length]};">
        <span style="font-size:64px;">${eventEmojis[i % eventEmojis.length]}</span>
        <div class="ticket-badge">${ev.tickets} tiket tersisa</div>
      </div>
      <div class="event-card-body">
        <div class="event-name">${ev.name}</div>
        <div class="event-meta">
          <div class="event-meta-item">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="7" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M8 2C5.2 2 3 4.2 3 7c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5z" stroke="currentColor" stroke-width="1.3"/></svg>
            ${ev.venue}, ${ev.location}
          </div>
          <div class="event-meta-item">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M2 7h12M5 2v2M11 2v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            ${ev.date} · ${ev.time}
          </div>
          <div class="event-meta-item" style="color:var(--text3);font-size:11px;">${ev.desc}</div>
        </div>
        <div class="event-footer">
          <div>
            <div class="event-price">${fmtRp(ev.price)}</div>
            <div class="event-tickets">per tiket</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-danger" onclick="deleteEvent('${ev.id}')">Hapus</button>
            <button class="btn btn-sm btn-primary" onclick="openBuyModal('${ev.id}')">Beli Tiket</button>
          </div>
        </div>
      </div>
    </div>
  `).join('') || '<div style="color:var(--text3);padding:40px;text-align:center;">Tidak ada event ditemukan.</div>';
}

function submitAddEvent() {
  const name = document.getElementById('ev-name').value.trim();
  const dateStr = document.getElementById('ev-date').value;
  const timeStr = document.getElementById('ev-time').value;
  const venue = document.getElementById('ev-venue').value.trim();
  const price = parseInt(document.getElementById('ev-price').value) || 0;
  const quota = parseInt(document.getElementById('ev-tickets').value) || 500;

  if (!name || !dateStr || !price) { toast('Validasi Gagal', 'Harap isi semua field wajib!', 'error'); return; }

  const id = 'EVT-' + uid();
  const date = `${dateStr}T${timeStr}:00Z`;

  addLog('lks-write-event', `POST /events → Menyimpan "${name}" ke Cloud...`, 'warn');

  const token = document.getElementById('val-token').value;
  const deviceId = document.getElementById('val-device').value;

  fetch(`${API_BASE_URL}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
      'Deviceid': deviceId
    },
    body: JSON.stringify({ id, name, date, venue, price, quota })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      addLog('lks-write-event', `RDS Success: Event "${name}" Saved (201)`, 'ok');
      toast('Event Tersimpan!', `"${name}" berhasil masuk ke RDS.`, 'success');
      closeModal('modal-add-event');
      state.events = []; // Reset agar renderEvents() memicu fetch ulang
      renderEvents();
    })
    .catch(err => {
      addLog('lks-write-event', `Error: ${err.message}`, 'err');
      toast('Gagal Simpan', err.message, 'error');
    });
}

function deleteEvent(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  if (!confirm(`Hapus event "${ev.name}"?`)) return;

  addLog('lks-write-event', `DELETE /events → Menghapus "${ev.name}"...`, 'warn');
  
  const token = document.getElementById('val-token').value;
  const deviceId = document.getElementById('val-device').value;

  fetch(`${API_BASE_URL}/events?id=${id}`, {
    method: 'DELETE',
    headers: { 
      'Authorization': token,
      'Deviceid': deviceId
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) throw new Error(data.error);
    addLog('lks-write-event', `RDS Success: Event "${id}" Deleted`, 'ok');
    toast('Event Dihapus', `"${ev.name}" telah dihapus secara permanen.`, 'success');
    state.events = state.events.filter(e => e.id !== id);
    renderEvents(); renderDashboard(); updateBadges();
  })
  .catch(err => {
    addLog('lks-write-event', `Error: ${err.message}`, 'err');
    toast('Gagal Hapus', err.message, 'error');
  });
}

/* ===================================================
   ORDERS
=================================================== */
function openBuyModal(evId) {
  if (!state.wsConnected && Object.keys(state.tokens).length === 0) {
    toast('Perlu Login', 'Generate token dulu di halaman Auth!', 'error');
  }
  state.selectedEvent = state.events.find(e => e.id === evId);
  const ev = state.selectedEvent;
  document.getElementById('buy-event-info').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="font-size:32px;">${eventEmojis[state.events.indexOf(ev) % eventEmojis.length]}</div>
      <div>
        <div style="font-weight:600;font-size:15px;">${ev.name}</div>
        <div style="font-size:12px;color:var(--text2);">${ev.venue}, ${ev.location} · ${ev.date}</div>
        <div style="font-size:13px;color:var(--gold);font-weight:600;margin-top:4px;">${fmtRp(ev.price)} / tiket</div>
      </div>
    </div>`;
  openModal('modal-buy');
}

function submitOrder() {
  const name = document.getElementById('buy-name').value.trim();
  const email = document.getElementById('buy-email').value.trim();
  const phone = document.getElementById('buy-phone').value.trim();
  const qty = parseInt(document.getElementById('buy-qty').value) || 1;
  const cat = document.getElementById('buy-category').value;
  if (!name || !email) { toast('Validasi Gagal', 'Nama dan email wajib diisi!', 'error'); return; }

  const ev = state.selectedEvent;
  const multiplier = cat === 'vip' ? 1.5 : cat === 'vvip' ? 2 : 1;
  const total = Math.round(ev.price * qty * multiplier);

  addLog('lks-queue-order', `POST /order — ${name} · ${ev.name} × ${qty}`, 'warn');

  // Ambil token dari state
  const token = document.getElementById('val-token').value;
  const deviceId = document.getElementById('val-device').value;

  fetch(`${API_BASE_URL}/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
      'Deviceid': deviceId
    },
    body: JSON.stringify({ eventId: ev.id, eventName: ev.name, name, email, phone, qty, category: cat, total })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      const orderId = data.orderId;
      addLog('lks-queue-order', `SQS SendMessage Success: ${orderId}`, 'ok');
      state.sqsOrder.push({ id: orderId, eventName: ev.name, name, qty, category: cat, total, status: 'queued' });
      updateBadges(); renderSQS();
      closeModal('modal-buy');
      toast('Order Masuk!', `ID: ${orderId} sedang diproses.`, 'success');
    })
    .catch(err => {
      addLog('lks-queue-order', `Error: ${err.message}`, 'err');
      toast('Gagal Order', err.message, 'error');
    });
}

function renderOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  addLog('lks-read-order', `GET /order → SELECT * FROM orders (${state.orders.length} rows)`, 'ok');
  tbody.innerHTML = state.orders.map(o => `
    <tr>
      <td><div class="order-id">${o.id}</div></td>
      <td>${o.eventName}</td>
      <td>
        <div style="font-weight:500;">${o.name}</div>
        <div style="font-size:11px;color:var(--text3);">${o.email}</div>
      </td>
      <td>${o.qty}</td>
      <td><span class="badge ${o.category === 'vvip' ? 'badge-gold' : o.category === 'vip' ? 'badge-accent' : 'badge-gray'}">${o.category.toUpperCase()}</span></td>
      <td style="color:var(--gold);font-weight:500;">${fmtRp(o.total)}</td>
      <td><span class="badge badge-green">✓ Selesai</span></td>
      <td><button class="btn btn-xs btn-danger" onclick="cancelOrder('${o.id}')">Batal</button></td>
    </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:24px;">Belum ada order selesai.</td></tr>';

  const total = state.orders.reduce((s, o) => s + o.total, 0);
  const inq = document.getElementById('ord-queue'); if (inq) inq.textContent = state.sqsOrder.length;
  const ot = document.getElementById('ord-total'); if (ot) ot.textContent = state.orders.length;
  const or = document.getElementById('ord-revenue'); if (or) or.textContent = fmtRp(total);
}

function cancelOrder(id) {
  state.orders = state.orders.filter(o => o.id !== id);
  renderOrders(); updateBadges();
  toast('Order Dibatalkan', 'DELETE /order → lks-write-order', 'info');
}

/* ===================================================
   TICKETS
=================================================== */
async function renderTickets() {
  const c = document.getElementById('tickets-container');
  if (!c) return;

  const email = state.tokens[Object.keys(state.tokens)[0]]?.user || '';
  if (!email) {
    c.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);"><div style="font-size:48px;margin-bottom:12px;">👤</div><div>Gak ada data login. Silakan login dulu bradah!</div></div>`;
    return;
  }

  const token = document.getElementById('val-token').value;
  const deviceId = document.getElementById('val-device').value;

  try {
    addLog('lks-ticket', `GET /ticket?email=${email} → Memanggil API...`, 'info');
    const res = await fetch(`${API_BASE_URL}/ticket?email=${email}`, {
      headers: { 'Authorization': token, 'Deviceid': deviceId }
    });
    const tickets = await res.json();
    state.tickets = tickets.map(t => {
      const rawDate = t.event_date || '';
      return {
        id: t.ticket_id || t.id,
        eventName: t.event_name || 'Event',
        name: t.user_email || t.email,
        date: rawDate.includes('T') ? rawDate.split('T')[0] : rawDate,
        venue: t.venue || '-',
        category: t.category || 'regular',
        qty: t.qty || 1,
        total: 0
      };
    });
    addLog('lks-ticket', `GET /ticket → Success (${state.tickets.length} tickets)`, 'ok');
  } catch (err) {
    addLog('lks-ticket', `GET /ticket → Error: ${err.message}`, 'err');
  }

  if (!state.tickets.length) {
    c.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);"><div style="font-size:48px;margin-bottom:12px;">🎫</div><div>Belum ada tiket. Beli tiket di halaman Events!</div></div>`;
    return;
  }
  c.innerHTML = state.tickets.map(t => `
    <div class="ticket-card">
      <div class="ticket-left"></div>
      <div class="ticket-body">
        <div class="ticket-id">TICKET #${t.id}</div>
        <div class="ticket-event">${t.eventName}</div>
        <div class="ticket-details">
          <div class="ticket-detail"><span class="label">Pemesan</span><span class="value">${t.name}</span></div>
          <div class="ticket-detail"><span class="label">Tanggal</span><span class="value">${t.date}</span></div>
          <div class="ticket-detail"><span class="label">Venue</span><span class="value">${t.venue}</span></div>
          <div class="ticket-detail"><span class="label">Kategori</span><span class="value">${t.category.toUpperCase()}</span></div>
          <div class="ticket-detail"><span class="label">Qty</span><span class="value">${t.qty} tiket</span></div>
        </div>
      </div>
      <div class="ticket-right">
        <span class="badge badge-green">✓ Valid</span>
      </div>
    </div>`).join('');
}

function deleteTicket(id) {
  addLog('lks-ticket', `DELETE /ticket/${id}`, 'warn');
  state.tickets = state.tickets.filter(t => t.id !== id);
  renderTickets(); updateBadges();
}

/* ===================================================
   SQS
=================================================== */
function renderSQS() {
  const orderBox = document.getElementById('order-queue-msgs');
  const payBox = document.getElementById('payment-queue-msgs');

  if (orderBox) {
    orderBox.innerHTML = state.sqsOrder.length
      ? state.sqsOrder.map(m => `
        <div class="queue-msg ${m.status === 'processing' ? 'processing' : ''}">
          <div>
            <span style="font-family:monospace;font-size:11px;color:var(--text3);">${m.id}</span>
            <div style="font-size:13px;margin-top:2px;">${m.name} · ${m.eventName} × ${m.qty} [${m.category.toUpperCase()}] · ${fmtRp(m.total)}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span class="badge ${m.status === 'processing' ? 'badge-gold' : 'badge-accent'}">${m.status}</span>
            <button class="btn btn-xs btn-danger" onclick="failMsg('${m.id}')">Fail</button>
          </div>
        </div>`)
        .join('')
      : '<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px;">Queue kosong</div>';
  }

  if (payBox) {
    payBox.innerHTML = state.sqsPayment.length
      ? state.sqsPayment.map(m => `
        <div class="queue-msg">
          <div>
            <span style="font-family:monospace;font-size:11px;color:var(--text3);">${m.id}</span>
            <div style="font-size:13px;margin-top:2px;">S3: proofOfPayment/${m.filename}</div>
          </div>
          <span class="badge badge-gold">${m.status}</span>
        </div>`).join('')
      : '<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px;">Queue kosong</div>';
  }

  const qc = document.getElementById('qs-count'); if (qc) qc.textContent = state.sqsOrder.length + ' msg';
  const qp = document.getElementById('qs-pay-count'); if (qp) qp.textContent = state.sqsPayment.length + ' msg';
  const sc = document.getElementById('sqs-order-cnt'); if (sc) sc.textContent = state.sqsOrder.length + ' pesan';
  const sp = document.getElementById('sqs-pay-cnt'); if (sp) sp.textContent = state.sqsPayment.length + ' pesan';

  const dlqOrder = document.getElementById('dlq-order-msgs');
  if (dlqOrder) dlqOrder.innerHTML = state.dlqOrder.map(m => `
    <div class="queue-msg failed"><div style="font-size:12px;">${m.id} — ${m.reason}</div><span class="badge badge-red">DLQ</span></div>`).join('');
  const dlqPay = document.getElementById('dlq-pay-msgs');
  if (dlqPay) dlqPay.innerHTML = state.dlqPayment.map(m => `
    <div class="queue-msg failed"><div style="font-size:12px;">${m.id} — ${m.reason}</div><span class="badge badge-red">DLQ</span></div>`).join('');

  const doc = document.getElementById('dlq-order-cnt'); if (doc) doc.textContent = state.dlqOrder.length;
  const dpc = document.getElementById('dlq-pay-cnt'); if (dpc) dpc.textContent = state.dlqPayment.length;
}

function processNextOrder() {
  if (!state.sqsOrder.length) { toast('Queue Kosong', 'Tidak ada pesan untuk diproses.', 'info'); return; }
  const msg = state.sqsOrder[0];
  msg.status = 'processing';
  renderSQS();

  addLog('lks-write-order', `SQS ReceiveMessage: ${msg.id}`, 'info');
  setTimeout(() => {
    addLog('lks-write-order', `SSM: GetParameters /lks/database/* (4 params)`, 'dim');
    setTimeout(() => {
      addLog('lks-write-order', `RDS: INSERT INTO orders (id,event,name,email,qty,total) VALUES ('${msg.id}','${msg.eventName}','${msg.name}','${msg.email}',${msg.qty},${msg.total})`, 'ok');
      setTimeout(() => {
        state.sqsOrder.shift();
        state.orders.push(msg);
        // Create ticket
        const ticket = { id: 'TIX-' + uid(), orderId: msg.id, eventName: msg.eventName, name: msg.name, date: state.events.find(e => e.id === msg.eventId)?.date || '-', venue: state.events.find(e => e.id === msg.eventId)?.venue || '-', category: msg.category, qty: msg.qty, total: msg.total };
        state.tickets.push(ticket);
        addLog('lks-write-order', `SQS DeleteMessage: ${msg.id} → order & ticket saved`, 'ok');
        addLog('lks-ticket', `POST /ticket → INSERT INTO tickets (${ticket.id}) → 201`, 'ok');
        updateBadges(); renderSQS(); renderOrders();
        toast('Order Diproses!', `${msg.id} berhasil disimpan ke RDS PostgreSQL.`, 'success');
        // WebSocket broadcast
        if (state.wsConnected) {
          setTimeout(() => {
            addLog('lks-websocket', `broadcastMessage: order ${msg.id} selesai → ${state.wsConnections.length} connections`, 'ok');
            wsReceive('broadcast', `✅ Order ${msg.id} selesai! ${msg.name} · ${msg.eventName} × ${msg.qty}`);
          }, 600);
        }
      }, 500);
    }, 300);
  }, 300);
}

function processAllOrders() {
  if (!state.sqsOrder.length) { toast('Queue Kosong', 'Tidak ada pesan.', 'info'); return; }
  let delay = 0;
  const count = state.sqsOrder.length;
  for (let i = 0; i < count; i++) {
    setTimeout(() => processNextOrder(), delay);
    delay += 800;
  }
}

function failMsg(id) {
  const msg = state.sqsOrder.find(m => m.id === id);
  if (!msg) return;
  state.sqsOrder = state.sqsOrder.filter(m => m.id !== id);
  state.dlqOrder.push({ ...msg, reason: 'Max retries exceeded' });
  addLog('lks-write-order', `Message ${id} failed → moved to DLQ`, 'err');
  renderSQS(); updateBadges();
  toast('Pesan Gagal', `${id} dipindah ke Dead Letter Queue.`, 'error');
}

function simulateS3Upload() {
  const filename = 'bukti-' + Date.now() + '.jpg';
  const msgId = 'PAY-' + uid();
  addLog('lks-payment', `S3 PutObject: lks-app/proofOfPayment/${filename}`, 'warn');
  setTimeout(() => {
    state.sqsPayment.push({ id: msgId, filename, status: 'queued' });
    addLog('lks-payment', `S3 notification → SQS SendMessage: ${msgId} → lks-queue-payment`, 'ok');
    renderSQS();
    setTimeout(() => {
      addLog('lks-payment', `Lambda trigger: SQS ${msgId} → lks-payment processing...`, 'info');
      setTimeout(() => {
        state.sqsPayment = state.sqsPayment.filter(m => m.id !== msgId);
        addLog('lks-payment', `Payment ${msgId} processed → RDS UPDATE orders SET status='paid'`, 'ok');
        renderSQS();
        toast('Pembayaran Diproses', `${filename} berhasil diproses oleh lks-payment.`, 'success');
        if (state.wsConnected) wsReceive('broadcast', `💳 Payment confirmed: ${filename}`);
      }, 1500);
    }, 800);
  }, 400);
}

function simulateDLQ(type) {
  const id = (type === 'order' ? 'ORD' : 'PAY') + '-FAIL-' + uid();
  const reason = 'RDS connection timeout after 3 retries';
  if (type === 'order') state.dlqOrder.push({ id, reason });
  else state.dlqPayment.push({ id, reason });
  addLog('lks-write-order', `Message ${id} → DLQ: ${reason}`, 'err');
  renderSQS();
  toast('DLQ', `${id} masuk Dead Letter Queue.`, 'error');
}

/* ===================================================
   AUTH & TOKEN
=================================================== */
function generateToken() {
  const username = document.getElementById('auth-user').value.trim() || 'lks';
  const password = 'juara1'; // Sesuai hardcode di token.js kita
  const deviceId = document.getElementById('auth-device').value.trim() || 'device-001';

  addLog('lks-token', `POST /login — Memproses auth untuk ${username}...`, 'warn');

  fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, deviceId })
  })
    .then(res => res.json())
    .then(data => {
      if (data.token) {
        const token = data.token;
        state.tokens[token] = { user: username, device: deviceId, created: nowFull() };
        document.getElementById('token-val').textContent = token + '\n\nHeader Example:\nAuthorization: ' + token + '\nDeviceid: ' + deviceId;
        document.getElementById('token-result').style.display = 'block';
        document.getElementById('val-token').value = token;
        document.getElementById('val-device').value = deviceId;

        const bar = document.getElementById('auth-status-bar');
        bar.className = 'auth-status authed';
        bar.innerHTML = `<span>●</span> ${username}`;

        addLog('lks-token', `Login Berhasil! Token disimpan ke DynamoDB`, 'ok');
        toast('Login Sukses', 'Token berhasil di-generate.', 'success');
      } else {
        throw new Error(data.message || 'Login Gagal');
      }
    })
    .catch(err => {
      addLog('lks-token', `Error: ${err.message}`, 'err');
      toast('Login Gagal', err.message, 'error');
    });
}

function validateToken() {
  const token = document.getElementById('val-token').value.trim();
  const device = document.getElementById('val-device').value.trim();
  const res = document.getElementById('val-result');
  if (!token) { res.innerHTML = '<span style="color:var(--red);">Token kosong!</span>'; return; }

  addLog('lks-auth', `Authorizer invoked: Authorization header received · deviceid: ${device}`, 'info');
  setTimeout(() => {
    addLog('lks-auth', `DynamoDB GetItem: tokens pk="${token.substring(0, 24)}..." sk="${device}"`, 'dim');
    setTimeout(() => {
      const valid = !!state.tokens[token] && (!device || state.tokens[token].device === device);
      if (valid) {
        res.innerHTML = `<div class="badge badge-green" style="font-size:13px;padding:6px 12px;">✓ ALLOW — Token valid · user: ${state.tokens[token].user}</div>`;
        addLog('lks-auth', `IAM Policy Effect=Allow · Principal=${state.tokens[token].user} → 200`, 'ok');
        toast('Token Valid', 'Akses diizinkan oleh lks-auth.', 'success');
      } else {
        res.innerHTML = `<div class="badge badge-red" style="font-size:13px;padding:6px 12px;">✗ DENY — Token tidak ditemukan di DynamoDB</div>`;
        addLog('lks-auth', `IAM Policy Effect=Deny → 403 Forbidden`, 'err');
        toast('Token Invalid', 'Akses ditolak oleh lks-auth.', 'error');
      }
    }, 400);
  }, 400);
}

function renderDynamoTable() {
  const t = document.getElementById('dynamo-table');
  if (!t) return;
  const tokens = Object.entries(state.tokens);
  if (!tokens.length) { t.innerHTML = ''; return; }
  t.innerHTML = `<div style="font-size:11px;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em;">Data di DynamoDB (${tokens.length} items)</div>` +
    tokens.map(([tok, d]) => `
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;margin-bottom:6px;font-size:11px;">
        <div style="font-family:monospace;color:var(--accent2);word-break:break-all;">${tok.substring(0, 36)}...</div>
        <div style="color:var(--text3);margin-top:4px;">user: ${d.user} · device: ${d.device}</div>
      </div>`).join('');
}

/* ===================================================
   PAYMENT
=================================================== */
let uploadCounter = 0;
function simulateUpload() {
  uploadCounter++;
  const filename = `bukti-transfer-${uploadCounter}-${Date.now()}.jpg`;
  const payId = 'PAY-' + uid();

  const list = document.getElementById('upload-list');
  const item = document.createElement('div');
  item.className = 'payment-status';
  item.id = 'pay-' + payId;
  item.innerHTML = `
    <div class="payment-icon">📄</div>
    <div class="payment-info" style="flex:1;">
      <div class="payment-name">${filename}</div>
      <div class="payment-sub">Mengupload ke S3...</div>
      <div class="progress-bar-wrap"><div class="progress-bar" id="pb-${payId}" style="width:0%"></div></div>
    </div>
    <div class="payment-status-badge"><span class="badge badge-gold" id="ps-${payId}">Uploading</span></div>`;
  list.prepend(item);

  addLog('lks-payment', `PUT /payment/${filename} → S3 PutObject started`, 'warn');

  // Progress bar animation
  let pct = 0;
  const iv = setInterval(() => {
    pct += Math.random() * 25;
    if (pct > 100) pct = 100;
    const pb = document.getElementById('pb-' + payId);
    if (pb) pb.style.width = pct + '%';
    if (pct >= 100) {
      clearInterval(iv);
      const ps = document.getElementById('ps-' + payId);
      if (ps) { ps.className = 'badge badge-green'; ps.textContent = '✓ Uploaded'; }
      const sub = item.querySelector('.payment-sub');
      if (sub) sub.textContent = `S3: lks-YourName-YourProvince/proofOfPayment/${filename}`;
      addLog('lks-payment', `S3 Upload OK: proofOfPayment/${filename} → SQS notification`, 'ok');

      // Trigger SQS
      state.sqsPayment.push({ id: payId, filename, status: 'queued' });
      state.payments.push({ id: payId, filename });
      renderSQS(); renderPaymentQueue();
      addLog('lks-payment', `SQS SendMessage: ${payId} → lks-queue-payment`, 'ok');
      toast('Upload Berhasil!', `${filename} → S3 → SQS`, 'success');

      // Auto process
      setTimeout(() => {
        state.sqsPayment = state.sqsPayment.filter(m => m.id !== payId);
        addLog('lks-payment', `lks-payment Lambda: processing ${payId}... RDS UPDATE orders SET status='paid' WHERE paymentRef='${payId}'`, 'ok');
        renderSQS(); renderPaymentQueue();
        if (state.wsConnected) wsReceive('broadcast', `💳 Payment confirmed: ${filename}`);
      }, 2500);
    }
  }, 120);
}

function renderPaymentQueue() {
  const el = document.getElementById('payment-queue-list');
  if (!el) return;
  el.innerHTML = state.payments.length
    ? state.payments.map(p => `
      <div class="payment-status">
        <div class="payment-icon">💳</div>
        <div class="payment-info">
          <div class="payment-name">${p.filename}</div>
          <div class="payment-sub" style="font-family:monospace;font-size:11px;">${p.id}</div>
        </div>
        <span class="badge badge-green">Processed</span>
      </div>`).join('')
    : '<div style="font-size:13px;color:var(--text3);text-align:center;padding:20px;">Belum ada upload</div>';
}

/* ===================================================
   WEBSOCKET SIMULATOR
=================================================== */
function wsAddMessage(type, content, meta = '') {
  const container = document.getElementById('ws-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `ws-msg ${type}`;
  const ts = nowTs();
  if (type === 'sent') {
    div.innerHTML = `<div style="flex:1;display:flex;flex-direction:column;align-items:flex-end;"><div class="ws-msg-bubble">${content}</div><div class="ws-msg-meta">${meta || 'Sent'} · ${ts}</div></div>`;
  } else {
    div.innerHTML = `<div><div class="ws-msg-bubble">${content}</div><div class="ws-msg-meta">${meta || 'Server'} · ${ts}</div></div>`;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function wsReceive(type, content, meta) { wsAddMessage(type, content, meta); }

function wsConnect() {
  if (state.wsConnected) return;
  const dot = document.getElementById('ws-sidebar-dot');
  const lbl = document.getElementById('ws-sidebar-label');
  dot.className = 'ws-dot connecting';
  lbl.textContent = 'Connecting...';

  document.getElementById('ws-status-text').textContent = 'Connecting...';
  addLog('lks-websocket', `$connect route invoked`, 'warn');

  setTimeout(() => {
    state.wsConnected = true;
    state.wsConnectionId = 'conn-' + uid();
    state.wsConnections.push(state.wsConnectionId);

    dot.className = 'ws-dot connected';
    lbl.textContent = 'WebSocket: connected';
    document.getElementById('ws-status-text').textContent = 'Connected';
    document.getElementById('ws-conn-id').textContent = state.wsConnectionId;
    document.getElementById('ws-total-conn').textContent = state.wsConnections.length;
    document.getElementById('dash-ws').textContent = state.wsConnections.length;

    addLog('lks-websocket', `$connect: connectionId=${state.wsConnectionId} saved to DynamoDB`, 'ok');
    wsReceive('system', `Connected. connectionId: ${state.wsConnectionId}`);
    toast('WebSocket Connected!', `connectionId: ${state.wsConnectionId}`, 'ws');
  }, 800);
}

function wsDisconnect() {
  if (!state.wsConnected) return;
  addLog('lks-websocket', `$disconnect: connectionId=${state.wsConnectionId} removed from DynamoDB`, 'warn');
  state.wsConnected = false;
  state.wsConnections = state.wsConnections.filter(c => c !== state.wsConnectionId);
  state.wsConnectionId = null;

  const dot = document.getElementById('ws-sidebar-dot');
  const lbl = document.getElementById('ws-sidebar-label');
  dot.className = 'ws-dot';
  lbl.textContent = 'WebSocket: offline';
  document.getElementById('ws-status-text').textContent = 'Disconnected';
  document.getElementById('ws-conn-id').textContent = '—';
  document.getElementById('ws-total-conn').textContent = state.wsConnections.length;
  document.getElementById('dash-ws').textContent = state.wsConnections.length;

  wsReceive('system', 'Disconnected from WebSocket API.');
  toast('WebSocket Disconnected', 'Koneksi ditutup.', 'info');
}

function wsSend(route) {
  if (!state.wsConnected) { toast('Tidak Terkoneksi', 'Connect dulu ke WebSocket!', 'error'); return; }
  const payload = JSON.stringify({ action: route, connectionId: state.wsConnectionId });
  wsAddMessage('sent', `action: ${route}`, 'Client');
  addLog('lks-websocket', `Route: ${route} → lks-websocket Lambda invoked`, 'info');

  setTimeout(() => {
    if (route === 'getConnectionId') {
      wsReceive('received', `{ "connectionId": "${state.wsConnectionId}" }`, 'Server');
      addLog('lks-websocket', `getConnectionId: returned ${state.wsConnectionId}`, 'ok');
    } else if (route === 'sendMessage') {
      wsReceive('received', 'Message received by server.', 'Server');
      addLog('lks-websocket', `sendMessage: delivered to ${state.wsConnectionId}`, 'ok');
    } else if (route === '$default') {
      wsReceive('system', 'Default route handler invoked.', 'Server');
    } else if (route === '$connect' || route === '$disconnect') {
      wsReceive('system', `${route} handler processed.`, 'Server');
    }
  }, 300);
}

function broadcastMessage() {
  if (!state.wsConnected) { toast('Tidak Terkoneksi', 'Connect dulu!', 'error'); return; }
  const msg = document.getElementById('ws-msg-input')?.value || 'Broadcast test!';
  wsAddMessage('sent', `[BROADCAST] ${msg}`, 'Client');
  addLog('lks-websocket', `broadcastMessage: sending to ${state.wsConnections.length} connection(s)`, 'info');
  setTimeout(() => {
    wsReceive('broadcast', `📢 Broadcast: ${msg}`, 'Server → All Clients');
    addLog('lks-websocket', `broadcastMessage: delivered to all connections`, 'ok');
  }, 400);
}

function wsSendText() {
  if (!state.wsConnected) { toast('Tidak Terkoneksi', 'Connect dulu!', 'error'); return; }
  const input = document.getElementById('ws-msg-input');
  const text = input.value.trim();
  if (!text) return;
  wsAddMessage('sent', text, 'Client');
  addLog('lks-websocket', `sendMessage: "${text.substring(0, 40)}"`, 'info');
  input.value = '';
  setTimeout(() => wsReceive('received', `Echo: ${text}`, 'lks-websocket'), 300);
}

function wsSendCustom() {
  if (!state.wsConnected) { toast('Tidak Terkoneksi', 'Connect dulu!', 'error'); return; }
  const raw = document.getElementById('ws-custom-msg').value.trim();
  try {
    const parsed = JSON.parse(raw);
    wsAddMessage('sent', raw, 'Client (custom)');
    addLog('lks-websocket', `Custom message: action=${parsed.action}`, 'info');
    setTimeout(() => wsReceive('received', `Processed action: ${parsed.action}`, 'Server'), 300);
  } catch (e) {
    toast('JSON Invalid', 'Format pesan harus JSON valid!', 'error');
  }
}

function clearWsMessages() {
  document.getElementById('ws-messages').innerHTML = '<div class="ws-msg system"><div><div class="ws-msg-bubble">Messages cleared.</div></div></div>';
}

function simulateOrderComplete() {
  if (!state.wsConnected) { wsConnect(); setTimeout(simulateOrderComplete, 1000); return; }
  const ordId = 'ORD-' + uid();
  addLog('lks-write-order', `SQS consumer processed ${ordId} → WebSocket broadcast`, 'ok');
  addLog('lks-websocket', `broadcastMessage from SQS consumer: order ${ordId} complete`, 'ok');
  wsReceive('broadcast', `✅ Order ${ordId} berhasil diproses!\nEvent: Coldplay World Tour\nStatus: Confirmed`, 'SQS Consumer → WebSocket');
  toast('WS Broadcast!', `Order ${ordId} notification dikirim via WebSocket.`, 'ws');
}

function simulatePaymentComplete() {
  if (!state.wsConnected) { wsConnect(); setTimeout(simulatePaymentComplete, 1000); return; }
  const payId = 'PAY-' + uid();
  addLog('lks-payment', `Payment ${payId} verified → WebSocket notify`, 'ok');
  addLog('lks-websocket', `sendMessage: payment confirmed to connectionId=${state.wsConnectionId}`, 'ok');
  wsReceive('broadcast', `💳 Pembayaran Dikonfirmasi!\nRef: ${payId}\nStatus: PAID\nUpdate order ke database selesai.`, 'lks-payment → WebSocket');
  toast('Payment Confirmed!', `Notifikasi dikirim via WebSocket.`, 'ws');
}

/* ===================================================
   DASHBOARD
=================================================== */
function renderDashboard() {
  document.getElementById('dash-events').textContent = state.events.length;
  document.getElementById('dash-orders').textContent = state.orders.length;
  document.getElementById('dash-queue').textContent = state.sqsOrder.length + state.sqsPayment.length;
  document.getElementById('dash-ws').textContent = state.wsConnections.length;

  const el = document.getElementById('dash-event-list');
  if (el) {
    el.innerHTML = state.events.slice(0, 3).map((ev, i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:10px;">
        <div style="font-size:28px;">${eventEmojis[i % eventEmojis.length]}</div>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:14px;">${ev.name}</div>
          <div style="font-size:12px;color:var(--text2);">${ev.location} · ${ev.date}</div>
        </div>
        <div style="text-align:right;">
          <div style="color:var(--gold);font-weight:600;font-size:14px;">${fmtRp(ev.price)}</div>
          <button class="btn btn-xs btn-primary" onclick="openBuyModal('${ev.id}')" style="margin-top:4px;">Beli</button>
        </div>
      </div>`).join('');
  }

  const awsEl = document.getElementById('aws-status-list');
  const services = [
    { name: 'VPC (us-west-2)', status: 'running', detail: '15.32.0.0/16' },
    { name: 'API Gateway REST', status: 'running', detail: 'production stage' },
    { name: 'API Gateway WS', status: state.wsConnected ? 'running' : 'idle', detail: 'prod stage · 6 routes' },
    { name: 'RDS PostgreSQL', status: 'running', detail: 'Multi-AZ · Private' },
    { name: 'DynamoDB tokens', status: 'running', detail: `${Object.keys(state.tokens).length} items` },
    { name: 'SQS Queue Order', status: state.sqsOrder.length > 0 ? 'busy' : 'idle', detail: `${state.sqsOrder.length} messages` },
    { name: 'SQS Queue Payment', status: state.sqsPayment.length > 0 ? 'busy' : 'idle', detail: `${state.sqsPayment.length} messages` },
    { name: 'Lambda Functions', status: 'running', detail: '10 functions · NodeJS 16' },
  ];
  if (awsEl) awsEl.innerHTML = services.map(s => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);">
      <div style="width:8px;height:8px;border-radius:50%;background:${s.status === 'running' ? 'var(--green)' : s.status === 'busy' ? 'var(--gold)' : 'var(--text3)'};flex-shrink:0;${s.status === 'running' ? 'box-shadow:0 0 6px var(--green)' : ''}"></div>
      <div style="flex:1;font-size:13px;">${s.name}</div>
      <div style="font-size:11px;color:var(--text3);">${s.detail}</div>
    </div>`).join('');
}

/* ===================================================
   LAMBDA REGISTRY
=================================================== */
function renderLambdaRegistry() {
  const tbody = document.getElementById('lambda-registry');
  if (!tbody) return;
  tbody.innerHTML = lambdaFunctions.map(f => `
    <tr>
      <td style="font-family:monospace;font-size:12px;color:var(--accent2);">${f.name}</td>
      <td style="font-family:monospace;font-size:12px;">${f.handler}</td>
      <td><span class="badge badge-green">NodeJS 16</span></td>
      <td style="font-size:12px;color:var(--text2);">${f.trigger}</td>
      <td><span class="badge badge-accent">${state.lambdaInvocations[f.name] || 0}</span></td>
    </tr>`).join('');
}

/* ===================================================
   BADGES & UPDATES
=================================================== */
function updateBadges() {
  document.getElementById('nb-events').textContent = state.events.length;
  document.getElementById('nb-orders').textContent = state.orders.length;
  document.getElementById('nb-tickets').textContent = state.tickets.length;
  document.getElementById('nb-sqs').textContent = state.sqsOrder.length + state.sqsPayment.length;
}

/* ===================================================
   INIT
=================================================== */
addLog('system', 'Application initialized · Region: us-west-2 · Runtime: NodeJS 16', 'dim');
addLog('lks-read-event', 'GET /event → Lambda cold start...', 'dim');
addLog('lks-read-event', 'RDS: SELECT * FROM events (3 rows) → 200 OK', 'ok');

renderDashboard();
updateBadges();
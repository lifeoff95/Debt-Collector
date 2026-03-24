// ── Debt Collector PWA — Main App ──

let currentPage = 'pageDashboard';
let settings = { currency: '$', defaultInterest: 0 };
let currentDebtorId = null;
let currentDebtId = null;

// ── Init ──
(async function init() {
  loadSettings();
  await db.open();
  renderDashboard();
  renderDebtorsList();
  renderDebtsList();

  document.getElementById('searchDebtors').addEventListener('input', renderDebtorsList);
  document.getElementById('searchDebts').addEventListener('input', renderDebtsList);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

// ── Settings ──
function loadSettings() {
  const s = localStorage.getItem('dc_settings');
  if (s) settings = JSON.parse(s);
  document.getElementById('settingCurrency').value = settings.currency;
  document.getElementById('settingInterest').value = settings.defaultInterest;
}

function saveSettings() {
  settings.currency = document.getElementById('settingCurrency').value || '$';
  settings.defaultInterest = parseFloat(document.getElementById('settingInterest').value) || 0;
  localStorage.setItem('dc_settings', JSON.stringify(settings));
  toast('Settings saved', 'success');
  renderDashboard();
}

function fmt(n) {
  return settings.currency + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Navigation ──
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  document.querySelectorAll('.bottom-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.page === pageId);
  });
  currentPage = pageId;

  const fab = document.getElementById('fabBtn');
  const topLeft = document.getElementById('topLeft');
  const topActions = document.getElementById('topActions');
  topActions.innerHTML = '';

  if (pageId === 'pageDashboard') {
    topLeft.innerHTML = '<h1>Debt Collector</h1>';
    fab.classList.remove('hidden');
  } else if (pageId === 'pageDebtors') {
    topLeft.innerHTML = '<h1>Debtors</h1>';
    fab.classList.remove('hidden');
  } else if (pageId === 'pageDebts') {
    topLeft.innerHTML = '<h1>All Debts</h1>';
    fab.classList.remove('hidden');
  } else if (pageId === 'pageSettings') {
    topLeft.innerHTML = '<h1>Settings</h1>';
    fab.classList.add('hidden');
  } else if (pageId === 'pageDebtorDetail' || pageId === 'pageDebtDetail') {
    fab.classList.add('hidden');
    topLeft.innerHTML = `<button class="back-btn" onclick="goBack()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Back</button>`;
  }

  if (pageId === 'pageDashboard') renderDashboard();
  if (pageId === 'pageDebtors') renderDebtorsList();
  if (pageId === 'pageDebts') renderDebtsList();
}

function goBack() {
  if (currentPage === 'pageDebtDetail') {
    if (currentDebtorId) {
      showPage('pageDebtorDetail');
      renderDebtorDetail(currentDebtorId);
    } else {
      showPage('pageDebts');
    }
  } else {
    showPage('pageDebtors');
  }
}

function onFabClick() {
  if (currentPage === 'pageDebtors' || currentPage === 'pageDashboard') {
    showDebtorModal();
  } else if (currentPage === 'pageDebts') {
    showDebtModal();
  }
}

// ── Toast ──
function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ── Confirm ──
function confirm(msg) {
  return new Promise(resolve => {
    document.getElementById('confirmContainer').innerHTML = `
      <div class="confirm-overlay" onclick="this.remove()">
        <div class="confirm-box" onclick="event.stopPropagation()">
          <p>${msg}</p>
          <div class="confirm-actions">
            <button class="btn btn-outline" id="confirmNo">Cancel</button>
            <button class="btn btn-danger" id="confirmYes">Delete</button>
          </div>
        </div>
      </div>`;
    document.getElementById('confirmNo').onclick = () => {
      document.getElementById('confirmContainer').innerHTML = '';
      resolve(false);
    };
    document.getElementById('confirmYes').onclick = () => {
      document.getElementById('confirmContainer').innerHTML = '';
      resolve(true);
    };
  });
}

// ── Modal ──
function showModal(title, bodyHtml, footerHtml = '') {
  document.getElementById('modalContainer').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        ${bodyHtml}
        ${footerHtml}
      </div>
    </div>`;
}

function closeModal() {
  document.getElementById('modalContainer').innerHTML = '';
}

// ══════════════════════════════════════════
// ═══ DASHBOARD ═══
// ══════════════════════════════════════════
async function renderDashboard() {
  const stats = await db.getStats();
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card highlight">
      <div class="stat-value">${fmt(stats.outstanding)}</div>
      <div class="stat-label">Outstanding</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.totalDebtors}</div>
      <div class="stat-label">Debtors</div>
    </div>
    <div class="stat-card green">
      <div class="stat-value">${fmt(stats.totalPaid)}</div>
      <div class="stat-label">Collected</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-value">${stats.unpaidDebts}</div>
      <div class="stat-label">Unpaid</div>
    </div>
    <div class="stat-card red">
      <div class="stat-value">${stats.overdueDebts}</div>
      <div class="stat-label">Overdue</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${fmt(stats.totalLent)}</div>
      <div class="stat-label">Total Lent</div>
    </div>`;

  // Recent payments
  const payments = await db.getAllPayments();
  const debts = await db.getAllDebts();
  const debtors = await db.getAllDebtors();
  const debtMap = {};
  debts.forEach(d => debtMap[d.id] = d);
  const debtorMap = {};
  debtors.forEach(d => debtorMap[d.id] = d);

  const recent = payments.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)).slice(0, 10);

  if (recent.length === 0) {
    document.getElementById('recentActivity').innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 9h20"/><path d="M9 21V9"/></svg>
        <p>No activity yet.<br>Add a debtor to get started.</p>
      </div>`;
    return;
  }

  document.getElementById('recentActivity').innerHTML = recent.map(p => {
    const debt = debtMap[p.debt_id];
    const debtor = debt ? debtorMap[debt.debtor_id] : null;
    const name = debtor ? debtor.name : 'Unknown';
    const initial = name.charAt(0).toUpperCase();
    return `<div class="list-item" onclick="viewDebt(${p.debt_id})">
      <div class="avatar">${initial}</div>
      <div class="info">
        <div class="name">${esc(name)}</div>
        <div class="sub">${fmtDate(p.paid_at)}${p.method ? ' · ' + esc(p.method) : ''}</div>
      </div>
      <div class="amount positive">+${fmt(p.amount)}</div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════
// ═══ DEBTORS ═══
// ══════════════════════════════════════════
async function renderDebtorsList() {
  const debtors = await db.getAllDebtors();
  const debts = await db.getAllDebts();
  const payments = await db.getAllPayments();
  const query = document.getElementById('searchDebtors').value.toLowerCase();

  const filtered = debtors.filter(d => d.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    document.getElementById('debtorsList').innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <p>${query ? 'No debtors found.' : 'No debtors yet.<br>Tap + to add one.'}</p>
      </div>`;
    return;
  }

  // Compute outstanding per debtor
  const debtsByDebtor = {};
  debts.forEach(d => {
    if (!debtsByDebtor[d.debtor_id]) debtsByDebtor[d.debtor_id] = [];
    debtsByDebtor[d.debtor_id].push(d);
  });
  const paymentsByDebt = {};
  payments.forEach(p => {
    if (!paymentsByDebt[p.debt_id]) paymentsByDebt[p.debt_id] = 0;
    paymentsByDebt[p.debt_id] += p.amount;
  });

  document.getElementById('debtorsList').innerHTML = filtered.map(debtor => {
    const dDebts = debtsByDebtor[debtor.id] || [];
    const totalOwed = dDebts.reduce((s, d) => s + d.amount, 0);
    const totalPaid = dDebts.reduce((s, d) => s + (paymentsByDebt[d.id] || 0), 0);
    const outstanding = totalOwed - totalPaid;
    const initial = debtor.name.charAt(0).toUpperCase();
    const avatarContent = debtor.id_picture
      ? `<img src="${debtor.id_picture}" alt="">`
      : initial;

    return `<div class="list-item" onclick="viewDebtor(${debtor.id})">
      <div class="avatar">${avatarContent}</div>
      <div class="info">
        <div class="name">${esc(debtor.name)}</div>
        <div class="sub">${debtor.phone || debtor.email || dDebts.length + ' debt(s)'}</div>
      </div>
      <div class="amount ${outstanding > 0 ? 'negative' : 'positive'}">${fmt(outstanding)}</div>
    </div>`;
  }).join('');
}

// ── Debtor Modal ──
function showDebtorModal(editId) {
  const isEdit = !!editId;
  const title = isEdit ? 'Edit Debtor' : 'Add Debtor';

  const body = `
    <div class="photo-upload" onclick="document.getElementById('photoInput').click()" id="photoPreview">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
    </div>
    <input type="file" id="photoInput" accept="image/*" style="display:none" onchange="previewPhoto(event)">
    <input type="hidden" id="debtorPhoto" value="">
    <div class="form-group">
      <label>Full Name *</label>
      <input type="text" id="debtorName" placeholder="John Doe" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Phone</label>
        <input type="tel" id="debtorPhone" placeholder="+1234567890">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="debtorEmail" placeholder="email@example.com">
      </div>
    </div>
    <div class="form-group">
      <label>Address</label>
      <input type="text" id="debtorAddress" placeholder="123 Main St">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Occupation</label>
        <input type="text" id="debtorOccupation">
      </div>
      <div class="form-group">
        <label>Date of Birth</label>
        <input type="date" id="debtorBirth">
      </div>
    </div>
    <div class="form-group">
      <label>Default Interest Rate (%)</label>
      <input type="number" id="debtorInterest" value="${settings.defaultInterest}" step="0.1" min="0">
    </div>
    <div class="form-group">
      <label>Notes</label>
      <textarea id="debtorNotes" rows="2"></textarea>
    </div>
    <button class="btn btn-primary btn-block mt-8" onclick="saveDebtor(${editId || 'null'})">${isEdit ? 'Update' : 'Add'} Debtor</button>`;

  showModal(title, body);

  if (isEdit) {
    db.getDebtor(editId).then(d => {
      if (!d) return;
      document.getElementById('debtorName').value = d.name;
      document.getElementById('debtorPhone').value = d.phone || '';
      document.getElementById('debtorEmail').value = d.email || '';
      document.getElementById('debtorAddress').value = d.address || '';
      document.getElementById('debtorOccupation').value = d.occupation || '';
      document.getElementById('debtorBirth').value = d.birth_date || '';
      document.getElementById('debtorInterest').value = d.interest_rate || 0;
      document.getElementById('debtorNotes').value = d.notes || '';
      document.getElementById('debtorPhoto').value = d.id_picture || '';
      if (d.id_picture) {
        document.getElementById('photoPreview').innerHTML = `<img src="${d.id_picture}" alt="">`;
      }
    });
  }
}

function previewPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('debtorPhoto').value = ev.target.result;
    document.getElementById('photoPreview').innerHTML = `<img src="${ev.target.result}" alt="">`;
  };
  reader.readAsDataURL(file);
}

async function saveDebtor(editId) {
  const name = document.getElementById('debtorName').value.trim();
  if (!name) { toast('Name is required', 'error'); return; }

  const data = {
    name,
    phone: document.getElementById('debtorPhone').value.trim(),
    email: document.getElementById('debtorEmail').value.trim(),
    address: document.getElementById('debtorAddress').value.trim(),
    occupation: document.getElementById('debtorOccupation').value.trim(),
    birth_date: document.getElementById('debtorBirth').value,
    interest_rate: parseFloat(document.getElementById('debtorInterest').value) || 0,
    notes: document.getElementById('debtorNotes').value.trim(),
    id_picture: document.getElementById('debtorPhoto').value
  };

  if (editId) {
    data.id = editId;
    const existing = await db.getDebtor(editId);
    data.created_at = existing.created_at;
    await db.updateDebtor(data);
    toast('Debtor updated', 'success');
    renderDebtorDetail(editId);
  } else {
    const id = await db.addDebtor(data);
    toast('Debtor added', 'success');
  }

  closeModal();
  renderDebtorsList();
  renderDashboard();
}

async function viewDebtor(id) {
  currentDebtorId = id;
  showPage('pageDebtorDetail');
  await renderDebtorDetail(id);
}

async function renderDebtorDetail(id) {
  const debtor = await db.getDebtor(id);
  if (!debtor) return;

  const debts = await db.getDebtsByDebtor(id);
  const allPayments = await db.getAllPayments();
  const paymentsByDebt = {};
  allPayments.forEach(p => {
    if (!paymentsByDebt[p.debt_id]) paymentsByDebt[p.debt_id] = 0;
    paymentsByDebt[p.debt_id] += p.amount;
  });

  const totalOwed = debts.reduce((s, d) => s + d.amount, 0);
  const totalPaid = debts.reduce((s, d) => s + (paymentsByDebt[d.id] || 0), 0);
  const outstanding = totalOwed - totalPaid;

  const initial = debtor.name.charAt(0).toUpperCase();
  const avatarContent = debtor.id_picture
    ? `<img src="${debtor.id_picture}" alt="">`
    : initial;

  let html = `
    <div class="detail-header">
      <div class="avatar-lg">${avatarContent}</div>
      <h2>${esc(debtor.name)}</h2>
      <div class="sub-info">${debtor.phone || ''}${debtor.phone && debtor.email ? ' · ' : ''}${debtor.email || ''}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value" style="font-size:1.2rem;color:var(--red)">${fmt(outstanding)}</div>
        <div class="stat-label">Outstanding</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="font-size:1.2rem;color:var(--green)">${fmt(totalPaid)}</div>
        <div class="stat-label">Paid</div>
      </div>
    </div>

    <div class="action-bar">
      <button class="btn btn-primary btn-sm" onclick="showDebtorModal(${id})">Edit</button>
      <button class="btn btn-success btn-sm" onclick="showDebtModal(${id})">+ Debt</button>
      <button class="btn btn-danger btn-sm" onclick="deleteDebtor(${id})">Delete</button>
    </div>`;

  // Debtor info
  if (debtor.address || debtor.occupation || debtor.birth_date || debtor.notes) {
    html += `<div class="detail-section"><h3>Details</h3>`;
    if (debtor.address) html += `<div class="detail-row"><span class="label">Address</span><span>${esc(debtor.address)}</span></div>`;
    if (debtor.occupation) html += `<div class="detail-row"><span class="label">Occupation</span><span>${esc(debtor.occupation)}</span></div>`;
    if (debtor.birth_date) html += `<div class="detail-row"><span class="label">Birthday</span><span>${fmtDate(debtor.birth_date)}</span></div>`;
    if (debtor.interest_rate) html += `<div class="detail-row"><span class="label">Interest Rate</span><span>${debtor.interest_rate}%</span></div>`;
    if (debtor.notes) html += `<div class="detail-row"><span class="label">Notes</span><span>${esc(debtor.notes)}</span></div>`;
    html += `</div>`;
  }

  // Debts list
  html += `<div class="detail-section"><h3>Debts (${debts.length})</h3>`;
  if (debts.length === 0) {
    html += `<p style="color:var(--text2);font-size:.85rem;">No debts recorded.</p>`;
  } else {
    debts.forEach(debt => {
      const paid = paymentsByDebt[debt.id] || 0;
      const remaining = debt.amount - paid;
      const isOverdue = debt.status === 'Unpaid' && debt.due_date && new Date(debt.due_date) < new Date();
      const statusClass = debt.status === 'Paid' ? 'paid' : (isOverdue ? 'overdue' : 'unpaid');
      const statusLabel = debt.status === 'Paid' ? 'Paid' : (isOverdue ? 'Overdue' : 'Unpaid');

      html += `<div class="list-item" onclick="viewDebt(${debt.id})">
        <div class="info">
          <div class="name">${esc(debt.description)}</div>
          <div class="sub">Due: ${fmtDate(debt.due_date)} · <span class="badge ${statusClass}">${statusLabel}</span></div>
        </div>
        <div class="amount ${remaining > 0 ? 'negative' : 'positive'}">${fmt(remaining)}</div>
      </div>`;
    });
  }
  html += `</div>`;

  document.getElementById('debtorDetailContent').innerHTML = html;
}

async function deleteDebtor(id) {
  const ok = await confirm('Delete this debtor and all their debts?');
  if (!ok) return;
  await db.deleteDebtor(id);
  toast('Debtor deleted', 'success');
  showPage('pageDebtors');
  renderDebtorsList();
  renderDashboard();
}

// ══════════════════════════════════════════
// ═══ DEBTS ═══
// ══════════════════════════════════════════
async function renderDebtsList() {
  const debts = await db.getAllDebts();
  const debtors = await db.getAllDebtors();
  const payments = await db.getAllPayments();
  const query = document.getElementById('searchDebts').value.toLowerCase();

  const debtorMap = {};
  debtors.forEach(d => debtorMap[d.id] = d);
  const paymentsByDebt = {};
  payments.forEach(p => {
    if (!paymentsByDebt[p.debt_id]) paymentsByDebt[p.debt_id] = 0;
    paymentsByDebt[p.debt_id] += p.amount;
  });

  const filtered = debts.filter(d => {
    const debtor = debtorMap[d.debtor_id];
    const name = debtor ? debtor.name.toLowerCase() : '';
    return d.description.toLowerCase().includes(query) || name.includes(query);
  });

  if (filtered.length === 0) {
    document.getElementById('debtsList').innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 9h20"/></svg>
        <p>${query ? 'No debts found.' : 'No debts yet.'}</p>
      </div>`;
    return;
  }

  document.getElementById('debtsList').innerHTML = filtered.map(debt => {
    const debtor = debtorMap[debt.debtor_id];
    const name = debtor ? debtor.name : 'Unknown';
    const paid = paymentsByDebt[debt.id] || 0;
    const remaining = debt.amount - paid;
    const isOverdue = debt.status === 'Unpaid' && debt.due_date && new Date(debt.due_date) < new Date();
    const statusClass = debt.status === 'Paid' ? 'paid' : (isOverdue ? 'overdue' : 'unpaid');
    const statusLabel = debt.status === 'Paid' ? 'Paid' : (isOverdue ? 'Overdue' : 'Unpaid');
    const initial = name.charAt(0).toUpperCase();

    return `<div class="list-item" onclick="viewDebt(${debt.id})">
      <div class="avatar">${initial}</div>
      <div class="info">
        <div class="name">${esc(debt.description)}</div>
        <div class="sub">${esc(name)} · ${fmtDate(debt.due_date)} · <span class="badge ${statusClass}">${statusLabel}</span></div>
      </div>
      <div class="amount ${remaining > 0 ? 'negative' : 'positive'}">${fmt(remaining)}</div>
    </div>`;
  }).join('');
}

// ── Debt Modal ──
async function showDebtModal(preselectedDebtorId, editId) {
  const isEdit = !!editId;
  const title = isEdit ? 'Edit Debt' : 'New Debt';
  const debtors = await db.getAllDebtors();

  if (debtors.length === 0 && !isEdit) {
    toast('Add a debtor first', 'error');
    return;
  }

  const debtorOptions = debtors.map(d =>
    `<option value="${d.id}" ${d.id === preselectedDebtorId ? 'selected' : ''}>${esc(d.name)}</option>`
  ).join('');

  const body = `
    <div class="form-group">
      <label>Debtor *</label>
      <select id="debtDebtor">${debtorOptions}</select>
    </div>
    <div class="form-group">
      <label>Description *</label>
      <input type="text" id="debtDescription" placeholder="e.g. Personal loan">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Amount *</label>
        <input type="number" id="debtAmount" step="0.01" min="0" placeholder="0.00">
      </div>
      <div class="form-group">
        <label>Interest Rate (%)</label>
        <input type="number" id="debtInterest" value="${settings.defaultInterest}" step="0.1" min="0">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Start Date</label>
        <input type="date" id="debtStart" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Due Date</label>
        <input type="date" id="debtDue">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Loan Type</label>
        <select id="debtLoanType">
          <option value="Monthly">Monthly</option>
          <option value="Weekly">Weekly</option>
          <option value="One-time">One-time</option>
          <option value="Custom">Custom</option>
        </select>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="debtStatus">
          <option value="Unpaid">Unpaid</option>
          <option value="Paid">Paid</option>
        </select>
      </div>
    </div>
    <button class="btn btn-primary btn-block mt-8" onclick="saveDebt(${editId || 'null'})">${isEdit ? 'Update' : 'Add'} Debt</button>`;

  showModal(title, body);

  if (isEdit) {
    const d = await db.getDebt(editId);
    if (d) {
      document.getElementById('debtDebtor').value = d.debtor_id;
      document.getElementById('debtDescription').value = d.description;
      document.getElementById('debtAmount').value = d.amount;
      document.getElementById('debtInterest').value = d.interest_rate || 0;
      document.getElementById('debtStart').value = d.start_date || '';
      document.getElementById('debtDue').value = d.due_date || '';
      document.getElementById('debtLoanType').value = d.loan_type || 'Monthly';
      document.getElementById('debtStatus').value = d.status;
    }
  }
}

async function saveDebt(editId) {
  const desc = document.getElementById('debtDescription').value.trim();
  const amount = parseFloat(document.getElementById('debtAmount').value);
  if (!desc || !amount) { toast('Description and amount required', 'error'); return; }

  const data = {
    debtor_id: parseInt(document.getElementById('debtDebtor').value),
    description: desc,
    amount,
    interest_rate: parseFloat(document.getElementById('debtInterest').value) || 0,
    start_date: document.getElementById('debtStart').value,
    due_date: document.getElementById('debtDue').value,
    loan_type: document.getElementById('debtLoanType').value,
    status: document.getElementById('debtStatus').value
  };

  if (editId) {
    data.id = editId;
    const existing = await db.getDebt(editId);
    data.created_at = existing.created_at;
    await db.updateDebt(data);
    toast('Debt updated', 'success');
    renderDebtDetail(editId);
  } else {
    const newId = await db.addDebt(data);
    toast('Debt added', 'success');
  }

  closeModal();
  renderDebtsList();
  renderDebtorsList();
  renderDashboard();
}

// ── Debt Detail ──
async function viewDebt(id) {
  const debt = await db.getDebt(id);
  if (!debt) return;
  currentDebtId = id;
  currentDebtorId = debt.debtor_id;
  showPage('pageDebtDetail');
  await renderDebtDetail(id);
}

async function renderDebtDetail(id) {
  const debt = await db.getDebt(id);
  if (!debt) return;
  const debtor = await db.getDebtor(debt.debtor_id);
  const payments = await db.getPaymentsByDebt(id);
  const instalments = await db.getInstalmentsByDebt(id);

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = debt.amount - totalPaid;
  const isOverdue = debt.status === 'Unpaid' && debt.due_date && new Date(debt.due_date) < new Date();
  const statusClass = debt.status === 'Paid' ? 'paid' : (isOverdue ? 'overdue' : 'unpaid');
  const statusLabel = debt.status === 'Paid' ? 'Paid' : (isOverdue ? 'Overdue' : 'Unpaid');
  const pct = debt.amount > 0 ? Math.min(100, (totalPaid / debt.amount) * 100) : 0;

  let html = `
    <div class="detail-header">
      <h2>${esc(debt.description)}</h2>
      <div class="sub-info">${debtor ? esc(debtor.name) : 'Unknown'} · <span class="badge ${statusClass}">${statusLabel}</span></div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:.85rem;color:var(--text2)">Progress</span>
        <span style="font-size:.85rem;font-weight:600">${pct.toFixed(0)}%</span>
      </div>
      <div style="background:var(--bg);border-radius:10px;height:10px;overflow:hidden;">
        <div style="background:var(--green);height:100%;width:${pct}%;border-radius:10px;transition:width .3s;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:10px;">
        <div><span style="color:var(--text2);font-size:.75rem;">Lent</span><br><strong>${fmt(debt.amount)}</strong></div>
        <div style="text-align:center;"><span style="color:var(--text2);font-size:.75rem;">Paid</span><br><strong style="color:var(--green)">${fmt(totalPaid)}</strong></div>
        <div style="text-align:right;"><span style="color:var(--text2);font-size:.75rem;">Remaining</span><br><strong style="color:var(--red)">${fmt(remaining)}</strong></div>
      </div>
    </div>

    <div class="action-bar">
      <button class="btn btn-success btn-sm" onclick="showPaymentModal(${id})">+ Payment</button>
      <button class="btn btn-primary btn-sm" onclick="showDebtModal(${debt.debtor_id}, ${id})">Edit</button>
      <button class="btn btn-outline btn-sm" onclick="showInstalmentModal(${id})">+ Instalment</button>
      <button class="btn btn-danger btn-sm" onclick="deleteDebt(${id})">Delete</button>
    </div>`;

  // Debt details
  html += `<div class="detail-section"><h3>Details</h3>
    <div class="detail-row"><span class="label">Amount</span><span>${fmt(debt.amount)}</span></div>
    <div class="detail-row"><span class="label">Interest</span><span>${debt.interest_rate || 0}%</span></div>
    <div class="detail-row"><span class="label">Loan Type</span><span>${debt.loan_type || 'Monthly'}</span></div>
    <div class="detail-row"><span class="label">Start</span><span>${fmtDate(debt.start_date)}</span></div>
    <div class="detail-row"><span class="label">Due</span><span>${fmtDate(debt.due_date)}</span></div>
  </div>`;

  // Instalments
  html += `<div class="detail-section"><h3>Instalments (${instalments.length})</h3>`;
  if (instalments.length > 0) {
    html += `<div class="inst-list">`;
    instalments.sort((a, b) => a.inst_number - b.inst_number).forEach(inst => {
      const instClass = inst.status === 'Paid' ? 'paid' : (inst.due_date && new Date(inst.due_date) < new Date() && inst.status !== 'Paid' ? 'overdue' : 'pending');
      html += `<div class="inst-item">
        <div class="inst-num">#${inst.inst_number}</div>
        <div class="inst-info">
          <div><strong>${fmt(inst.amount)}</strong> <span class="badge ${instClass}">${inst.status}</span></div>
          <div class="inst-date">Due: ${fmtDate(inst.due_date)}</div>
        </div>
        <div class="inst-actions">
          ${inst.status !== 'Paid' ? `<button class="btn btn-success btn-sm" onclick="payInstalment(${id}, ${inst.id})" style="padding:6px 10px;font-size:.7rem;">Pay</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteInstalment(${inst.id}, ${id})" style="padding:6px 10px;font-size:.7rem;">X</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<p style="color:var(--text2);font-size:.85rem;">No instalments. Tap + Instalment to generate.</p>`;
  }
  html += `</div>`;

  // Payments
  html += `<div class="detail-section"><h3>Payments (${payments.length})</h3>`;
  if (payments.length > 0) {
    payments.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)).forEach(p => {
      html += `<div class="list-item">
        <div class="info">
          <div class="name">${fmt(p.amount)}${p.method ? ' · ' + esc(p.method) : ''}</div>
          <div class="sub">${fmtDate(p.paid_at)}${p.note ? ' · ' + esc(p.note) : ''}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deletePayment(${p.id}, ${id})" style="padding:6px 10px;font-size:.7rem;">X</button>
      </div>`;
    });
  } else {
    html += `<p style="color:var(--text2);font-size:.85rem;">No payments recorded.</p>`;
  }
  html += `</div>`;

  document.getElementById('debtDetailContent').innerHTML = html;
}

async function deleteDebt(id) {
  const ok = await confirm('Delete this debt and all its records?');
  if (!ok) return;
  await db.deleteDebt(id);
  toast('Debt deleted', 'success');
  goBack();
  renderDebtsList();
  renderDashboard();
}

// ══════════════════════════════════════════
// ═══ PAYMENTS ═══
// ══════════════════════════════════════════
function showPaymentModal(debtId, instalmentId) {
  const body = `
    <div class="form-group">
      <label>Amount *</label>
      <input type="number" id="payAmount" step="0.01" min="0" placeholder="0.00">
    </div>
    <div class="form-group">
      <label>Method</label>
      <select id="payMethod">
        <option value="">Select</option>
        <option value="Cash">Cash</option>
        <option value="Bank Transfer">Bank Transfer</option>
        <option value="Mobile Money">Mobile Money</option>
        <option value="Check">Check</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div class="form-group">
      <label>Note</label>
      <input type="text" id="payNote" placeholder="Optional note">
    </div>
    <button class="btn btn-success btn-block mt-8" onclick="savePayment(${debtId}, ${instalmentId || 'null'})">Record Payment</button>`;

  showModal('Record Payment', body);
}

async function savePayment(debtId, instalmentId) {
  const amount = parseFloat(document.getElementById('payAmount').value);
  if (!amount) { toast('Enter an amount', 'error'); return; }

  await db.addPayment({
    debt_id: debtId,
    instalment_id: instalmentId,
    amount,
    method: document.getElementById('payMethod').value,
    note: document.getElementById('payNote').value.trim()
  });

  // Check if fully paid
  const debt = await db.getDebt(debtId);
  const payments = await db.getPaymentsByDebt(debtId);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  if (totalPaid >= debt.amount && debt.status !== 'Paid') {
    debt.status = 'Paid';
    await db.updateDebt(debt);
  }

  // Mark instalment as paid
  if (instalmentId) {
    const inst = await db.getInstalmentsByDebt(debtId);
    const target = inst.find(i => i.id === instalmentId);
    if (target) {
      target.status = 'Paid';
      target.paid_at = new Date().toISOString();
      await db.updateInstalment(target);
    }
  }

  closeModal();
  toast('Payment recorded', 'success');
  renderDebtDetail(debtId);
  renderDebtsList();
  renderDashboard();
}

async function deletePayment(payId, debtId) {
  const ok = await confirm('Delete this payment?');
  if (!ok) return;
  await db.deletePayment(payId);

  // Re-check debt status
  const debt = await db.getDebt(debtId);
  const payments = await db.getPaymentsByDebt(debtId);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  if (totalPaid < debt.amount && debt.status === 'Paid') {
    debt.status = 'Unpaid';
    await db.updateDebt(debt);
  }

  toast('Payment deleted', 'success');
  renderDebtDetail(debtId);
  renderDashboard();
}

// ══════════════════════════════════════════
// ═══ INSTALMENTS ═══
// ══════════════════════════════════════════
async function showInstalmentModal(debtId) {
  const debt = await db.getDebt(debtId);
  const existingInst = await db.getInstalmentsByDebt(debtId);
  const maxBatch = existingInst.length > 0 ? Math.max(...existingInst.map(i => i.batch || 1)) + 1 : 1;
  const nextNum = existingInst.length > 0 ? Math.max(...existingInst.map(i => i.inst_number)) + 1 : 1;

  const body = `
    <div class="form-group">
      <label>Number of Instalments</label>
      <input type="number" id="instCount" value="3" min="1" max="120">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Amount per Instalment</label>
        <input type="number" id="instAmount" step="0.01" value="${(debt.amount / 3).toFixed(2)}">
      </div>
      <div class="form-group">
        <label>Frequency</label>
        <select id="instFreq">
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Bi-weekly</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Start Date</label>
      <input type="date" id="instStart" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <button class="btn btn-primary btn-block mt-8" onclick="generateInstalments(${debtId}, ${nextNum}, ${maxBatch})">Generate Instalments</button>`;

  showModal('Generate Instalments', body);

  document.getElementById('instCount').addEventListener('input', () => {
    const count = parseInt(document.getElementById('instCount').value) || 1;
    document.getElementById('instAmount').value = (debt.amount / count).toFixed(2);
  });
}

async function generateInstalments(debtId, startNum, batch) {
  const count = parseInt(document.getElementById('instCount').value) || 1;
  const amount = parseFloat(document.getElementById('instAmount').value);
  const freq = document.getElementById('instFreq').value;
  const startDate = new Date(document.getElementById('instStart').value);

  if (!amount) { toast('Enter an amount', 'error'); return; }

  for (let i = 0; i < count; i++) {
    const dueDate = new Date(startDate);
    if (freq === 'monthly') dueDate.setMonth(dueDate.getMonth() + i);
    else if (freq === 'weekly') dueDate.setDate(dueDate.getDate() + i * 7);
    else if (freq === 'biweekly') dueDate.setDate(dueDate.getDate() + i * 14);

    await db.addInstalment({
      debt_id: debtId,
      inst_number: startNum + i,
      amount,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'Pending',
      batch
    });
  }

  closeModal();
  toast(`${count} instalments generated`, 'success');
  renderDebtDetail(debtId);
}

async function payInstalment(debtId, instId) {
  const inst = (await db.getInstalmentsByDebt(debtId)).find(i => i.id === instId);
  if (!inst) return;
  showPaymentModal(debtId, instId);
  setTimeout(() => {
    const el = document.getElementById('payAmount');
    if (el) el.value = inst.amount;
  }, 100);
}

async function deleteInstalment(instId, debtId) {
  await db.deleteInstalment(instId);
  toast('Instalment removed', 'success');
  renderDebtDetail(debtId);
}

// ══════════════════════════════════════════
// ═══ DATA IMPORT/EXPORT ═══
// ══════════════════════════════════════════
async function exportData() {
  const data = {
    debtors: await db.getAllDebtors(),
    debts: await db.getAllDebts(),
    payments: await db.getAllPayments(),
    instalments: await db.getAllInstalments(),
    settings,
    exported_at: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `debt_collector_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Data exported', 'success');
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();

  try {
    const data = JSON.parse(text);
    if (!data.debtors || !data.debts) throw new Error('Invalid format');

    const ok = await confirm('This will replace all current data. Continue?');
    if (!ok) return;

    // Clear existing
    await clearStores();

    // Import
    for (const d of data.debtors) {
      const id = d.id;
      delete d.id;
      await db.addDebtor(d);
    }
    for (const d of data.debts) {
      delete d.id;
      await db.addDebt(d);
    }
    for (const p of data.payments) {
      delete p.id;
      await db.addPayment(p);
    }
    if (data.instalments) {
      for (const i of data.instalments) {
        delete i.id;
        await db.addInstalment(i);
      }
    }
    if (data.settings) {
      settings = data.settings;
      localStorage.setItem('dc_settings', JSON.stringify(settings));
      loadSettings();
    }

    toast('Data imported', 'success');
    renderDashboard();
    renderDebtorsList();
    renderDebtsList();
  } catch (err) {
    toast('Import failed: ' + err.message, 'error');
  }

  e.target.value = '';
}

async function clearStores() {
  const stores = ['debtors', 'debts', 'payments', 'instalments'];
  for (const name of stores) {
    const tx = db.db.transaction(name, 'readwrite');
    tx.objectStore(name).clear();
    await new Promise(r => { tx.oncomplete = r; });
  }
}

async function clearAllData() {
  const ok = await confirm('Delete ALL data? This cannot be undone.');
  if (!ok) return;
  await clearStores();
  toast('All data cleared', 'success');
  renderDashboard();
  renderDebtorsList();
  renderDebtsList();
}

// ── Helpers ──
function esc(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

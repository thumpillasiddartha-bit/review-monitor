// ============================================================
// REVIEW MONITOR — FRONTEND MAIN JS
// ============================================================
 
const API = 'http://localhost:3000/api';
 
// ── STATE ────────────────────────────────────────────────────
const state = {
  user: null,
  token: null,
  currentPage: 'dashboard',
  products: [],
  adminQueueCount: 0,
  charts: {}
};
 
// ── UTILS ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
 
function toast(msg, type = 'info') {
  const wrap = $('toast-container');
  const el = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
 
async function api(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
 
function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Loading…';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.orig;
    btn.disabled = false;
  }
}
 
function starHtml(rating, max = 5) {
  return Array.from({ length: max }, (_, i) =>
    `<span class="star ${i < rating ? 'filled' : ''}">★</span>`
  ).join('');
}
 
function scoreClass(score) {
  if (score < 20) return 'low';
  if (score < 40) return 'mid';
  if (score < 70) return 'high';
  return 'danger';
}
 
function verdictBadge(verdict) {
  const map = {
    LEGITIMATE:       ['badge-green', '✓ Legitimate'],
    MILDLY_SUSPICIOUS:['badge-yellow','⚠ Mild'],
    SUSPICIOUS:       ['badge-orange','⚠ Suspicious'],
    HIGHLY_SUSPICIOUS:['badge-red',   '🚨 Fake'],
  };
  const [cls, label] = map[verdict] || ['badge-gray', verdict || '—'];
  return `<span class="badge ${cls}">${label}</span>`;
}
 
function statusBadge(status) {
  const map = {
    approved:     ['badge-green',  '✓ Approved'],
    admin_review: ['badge-orange', '👁 Admin Review'],
    flagged:      ['badge-yellow', '⚑ Flagged'],
    auto_deleted: ['badge-red',    '🗑 Auto-Deleted'],
    deleted:      ['badge-red',    '🗑 Deleted'],
    pending:      ['badge-gray',   '… Pending'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}
 
function timeAgo(dateStr) {
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60)  return 'just now';
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
  return `${Math.floor(secs/86400)}d ago`;
}
 
function categoryEmoji(cat = '') {
  const map = { electronics:'🔌', furniture:'🪑', kitchen:'🍳', sports:'🏃', food:'🍵', clothing:'👗', books:'📚' };
  return map[cat.toLowerCase()] || '📦';
}
 
// ── AUTH ──────────────────────────────────────────────────────
function saveAuth(data) {
  state.user  = data;
  state.token = data.token;
  localStorage.setItem('rm_user',  JSON.stringify(data));
  localStorage.setItem('rm_token', data.token);
}
 
function loadAuth() {
  const saved = localStorage.getItem('rm_user');
  if (saved) {
    state.user  = JSON.parse(saved);
    state.token = localStorage.getItem('rm_token');
    return true;
  }
  return false;
}
 
function logout() {
  state.user = null; state.token = null;
  localStorage.removeItem('rm_user');
  localStorage.removeItem('rm_token');
  showAuthPage();
}
 
// ── PAGE ROUTING ──────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });
  const el = $(`page-${page}`);
  if (el) el.classList.add('active');
  state.currentPage = page;
 
  const titles = {
    dashboard: 'Dashboard', products: 'Products',
    submit: 'Submit Review', 'my-reviews': 'My Reviews',
    'admin-queue': 'Admin Queue', 'admin-all': 'All Reviews',
    'admin-users': 'Users', 'admin-products': 'Products Mgmt',
    'admin-activity': 'Activity Log'
  };
  const topbarTitle = qs('.topbar-title');
  if (topbarTitle) topbarTitle.textContent = titles[page] || page;
 
  // Load page data
  switch (page) {
    case 'dashboard':     loadDashboard(); break;
    case 'products':      loadProducts(); break;
    case 'my-reviews':    loadMyReviews(); break;
    case 'admin-queue':   loadAdminQueue(); break;
    case 'admin-all':     loadAdminAll(); break;
    case 'admin-users':   loadAdminUsers(); break;
    case 'admin-products':loadAdminProducts(); break;
    case 'admin-activity':loadActivity(); break;
  }
}
 
// ── AUTH PAGE ─────────────────────────────────────────────────
function showAuthPage() {
  $('auth-page').classList.remove('hidden');
  $('app-shell').classList.add('hidden');
}
 
function showApp() {
  $('auth-page').classList.add('hidden');
  $('app-shell').classList.remove('hidden');
  buildNav();
  navigate('dashboard');
  pollAdminQueue();
}
 
function buildNav() {
  const isAdmin = state.user?.role === 'admin';
  const nav = $('sidebar-nav');
  nav.innerHTML = '';
 
  const userNav = [
    { id: 'dashboard',  icon: '📊', label: 'Dashboard' },
    { id: 'products',   icon: '🛍️', label: 'Products' },
    { id: 'submit',     icon: '✍️',  label: 'Write Review' },
    { id: 'my-reviews', icon: '📝', label: 'My Reviews' },
  ];
 
  const adminNav = [
    { id: 'admin-queue',    icon: '🔍', label: 'Review Queue', badge: true },
    { id: 'admin-all',      icon: '📋', label: 'All Reviews' },
    { id: 'admin-users',    icon: '👥', label: 'Users' },
    { id: 'admin-products', icon: '📦', label: 'Products Mgmt' },
    { id: 'admin-activity', icon: '🕐', label: 'Activity Log' },
  ];
 
  function renderSection(label, items) {
    const sec = document.createElement('div');
    sec.innerHTML = `<div class="nav-section-label">${label}</div>`;
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.dataset.page = item.id;
      btn.innerHTML = `
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
        ${item.badge ? `<span class="nav-badge hidden" id="queue-badge">0</span>` : ''}
      `;
      btn.onclick = () => navigate(item.id);
      sec.appendChild(btn);
    });
    nav.appendChild(sec);
  }
 
  renderSection('Menu', userNav);
  if (isAdmin) renderSection('Admin', adminNav);
 
  // User card
  $('sidebar-user-name').textContent = state.user?.name || 'User';
  $('sidebar-user-role').textContent = state.user?.role || 'user';
  $('sidebar-user-avatar').textContent = (state.user?.name || 'U')[0].toUpperCase();
}
 
async function pollAdminQueue() {
  if (state.user?.role !== 'admin') return;
  try {
    const data = await api('GET', '/admin/queue?limit=1');
    const badge = $('queue-badge');
    if (badge) {
      badge.textContent = data.total;
      badge.classList.toggle('hidden', data.total === 0);
    }
    state.adminQueueCount = data.total;
  } catch {}
  setTimeout(pollAdminQueue, 30000);
}
 
// ── DASHBOARD ─────────────────────────────────────────────────
async function loadDashboard() {
  const container = $('dashboard-content');
  container.innerHTML = `<div class="empty-state"><div class="spinner" style="width:32px;height:32px"></div></div>`;
  try {
    const stats = await api('GET', '/reviews/stats');
    renderDashboard(stats);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
  }
}
 
function renderDashboard(s) {
  const fakeRate = s.total ? ((s.autoDeleted / s.total) * 100).toFixed(1) : 0;
 
  $('dashboard-content').innerHTML = `
    <div class="stat-grid">
      <div class="stat-card purple">
        <div class="stat-label">Total Reviews</div>
        <div class="stat-value">${s.total.toLocaleString()}</div>
        <div class="stat-sub">All time</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Approved</div>
        <div class="stat-value">${s.approved.toLocaleString()}</div>
        <div class="stat-sub">Legitimate reviews</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Auto-Deleted</div>
        <div class="stat-value">${s.autoDeleted.toLocaleString()}</div>
        <div class="stat-sub">Score ≥ 70</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-label">Admin Queue</div>
        <div class="stat-value">${s.adminQueue.toLocaleString()}</div>
        <div class="stat-sub">Pending review</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Fake Rate</div>
        <div class="stat-value">${fakeRate}%</div>
        <div class="stat-sub">Of total submissions</div>
      </div>
    </div>
 
    <div class="chart-grid">
      <div class="chart-wrap">
        <div class="chart-title">📈 Daily Submissions (Last 7 Days)</div>
        <canvas id="chart-daily" height="200"></canvas>
      </div>
      <div class="chart-wrap">
        <div class="chart-title">🎯 Verdict Distribution</div>
        <canvas id="chart-verdicts" height="200"></canvas>
      </div>
    </div>
 
    <div class="chart-wrap mb-20">
      <div class="chart-title">📊 Score Distribution</div>
      <canvas id="chart-scores" height="120"></canvas>
    </div>
  `;
 
  // Daily chart
  const labels = s.daily.map(d => d._id);
  const totals = s.daily.map(d => d.total);
  const fakes  = s.daily.map(d => d.fakes);
  const legits = s.daily.map(d => d.legit);
 
  renderLineChart('chart-daily', labels, [
    { label: 'Total',     data: totals, color: '#6c63ff' },
    { label: 'Fake',      data: fakes,  color: '#ef4444' },
    { label: 'Legitimate',data: legits, color: '#22c55e' },
  ]);
 
  // Verdict pie
  const vLabels = s.verdicts.map(v => v._id || 'Unknown');
  const vData   = s.verdicts.map(v => v.count);
  const vColors = vLabels.map(l => ({
    LEGITIMATE:        '#22c55e',
    MILDLY_SUSPICIOUS: '#f59e0b',
    SUSPICIOUS:        '#f97316',
    HIGHLY_SUSPICIOUS: '#ef4444',
  }[l] || '#6c63ff'));
 
  renderDoughnutChart('chart-verdicts', vLabels, vData, vColors);
 
  // Score histogram
  const scLabels = ['0-20','20-40','40-60','60-80','80-100'];
  const scData   = s.scoreRanges.filter(r => r._id !== 'other').map(r => r.count);
  renderBarChart('chart-scores', scLabels, scData, ['#22c55e','#84cc16','#f59e0b','#f97316','#ef4444']);
}
 
function renderLineChart(id, labels, datasets) {
  const ctx = $(id).getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(ds => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.color,
        backgroundColor: ds.color + '22',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: ds.color,
      }))
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#9aa0b4', font: { family: 'DM Sans' } } } },
      scales: {
        x: { ticks: { color: '#5c6278' }, grid: { color: '#252830' } },
        y: { ticks: { color: '#5c6278' }, grid: { color: '#252830' }, beginAtZero: true }
      }
    }
  });
}
 
function renderDoughnutChart(id, labels, data, colors) {
  const ctx = $(id).getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }]
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { color: '#9aa0b4', padding: 12, font: { family: 'DM Sans', size: 11 } } } }
    }
  });
}
 
function renderBarChart(id, labels, data, colors) {
  const ctx = $(id).getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Reviews',
        data,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#5c6278' }, grid: { color: '#252830' } },
        y: { ticks: { color: '#5c6278' }, grid: { color: '#252830' }, beginAtZero: true }
      }
    }
  });
}
 
// ── PRODUCTS PAGE ─────────────────────────────────────────────
async function loadProducts() {
  const container = $('products-grid');
  container.innerHTML = `<div class="empty-state"><div class="spinner" style="width:28px;height:28px"></div></div>`;
  try {
    // Public endpoint — works for all users, no admin auth needed
    state.products = await api('GET', '/reviews/products', null, false);
    renderProducts(state.products);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
  }
}
 
function renderProducts(products) {
  const container = $('products-grid');
  if (!products.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No products yet</div><p>Seed the database first.</p></div>`;
    return;
  }
  container.innerHTML = products.map(p => `
    <div class="product-card" onclick="openProductReviews('${p._id}','${p.name}')">
      <div class="product-emoji">${categoryEmoji(p.category)}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-cat">${p.category}</div>
      <div class="product-rating">
        <div class="stars">${starHtml(Math.round(p.avgRating || 0))}</div>
        <span class="text-muted">${(p.avgRating || 0).toFixed(1)} · ${p.totalReviews} reviews</span>
      </div>
    </div>
  `).join('');
 
  // Also populate submit dropdown
  const sel = $('review-product-select');
  if (sel) {
    sel.innerHTML = '<option value="">Select a product…</option>' +
      products.map(p => `<option value="${p._id}">${p.name}</option>`).join('');
  }
}
 
async function openProductReviews(productId, productName) {
  $('product-reviews-title').textContent = productName;
  $('product-reviews-list').innerHTML = `<div class="empty-state"><div class="spinner" style="width:24px;height:24px"></div></div>`;
  openModal('modal-product-reviews');
  try {
    const reviews = await api('GET', `/reviews/product/${productId}`, null, false);
    if (!reviews.length) {
      $('product-reviews-list').innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-title">No reviews yet</div></div>`;
      return;
    }
    $('product-reviews-list').innerHTML = reviews.map(r => `
      <div class="review-card">
        <div class="review-card-header">
          <div>
            <div class="review-user">${r.user?.name || 'Anonymous'}</div>
            <div class="stars">${starHtml(r.rating)}</div>
          </div>
          <div class="review-date">${timeAgo(r.createdAt)}</div>
        </div>
        <div class="review-text">${r.text}</div>
      </div>
    `).join('');
  } catch (e) {
    $('product-reviews-list').innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}
 
// ── SUBMIT REVIEW ─────────────────────────────────────────────
let selectedRating = 0;
 
function initStarInput() {
  const container = $('star-input');
  if (!container) return;
  container.innerHTML = Array.from({ length: 5 }, (_, i) =>
    `<span class="star" data-val="${i+1}" onclick="setRating(${i+1})">★</span>`
  ).join('');
}
 
function setRating(val) {
  selectedRating = val;
  document.querySelectorAll('#star-input .star').forEach((s, i) => {
    s.classList.toggle('filled', i < val);
  });
  $('selected-rating').textContent = val + ' star' + (val > 1 ? 's' : '');
}
 
async function submitReview() {
  const productId = $('review-product-select').value;
  const text = $('review-text').value.trim();
  const btn = $('submit-review-btn');
 
  if (!productId) return toast('Please select a product', 'warn');
  if (!selectedRating) return toast('Please select a star rating', 'warn');
  if (text.length < 10) return toast('Review must be at least 10 characters', 'warn');
 
  setLoading(btn, true);
  try {
    const result = await api('POST', '/reviews', { productId, text, rating: selectedRating });
    renderAnalysisResult(result.analysis, result.review);
    $('review-text').value = '';
    setRating(0);
    selectedRating = 0;
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}
 
function renderAnalysisResult(analysis, review) {
  const container = $('analysis-output');
  const sc = analysis.score;
  const ring = sc < 20 ? 'safe' : sc < 40 ? 'mild' : sc < 70 ? 'danger' : 'hot';
 
  const actionMsg = {
    AUTO_DELETE:   { color: 'var(--red)',    msg: '🗑 Your review was automatically deleted — it scored too high on our fake-detection system.' },
    SEND_TO_ADMIN: { color: 'var(--orange)', msg: '👁 Your review has been sent to our admin team for manual review.' },
    FLAG:          { color: 'var(--yellow)', msg: '⚑ Your review was flagged for minor issues but is visible.' },
    APPROVE:       { color: 'var(--green)',  msg: '✅ Your review passed all checks and is now live!' },
  }[analysis.action] || { color: 'var(--text)', msg: '' };
 
  // Collect all hit keywords
  const allKeywords = Object.values(analysis.details.keywordHits || {}).flat();
 
  container.innerHTML = `
    <div class="analysis-result">
      <div class="flex gap-20 items-center mb-16">
        <div class="analysis-score-ring ${ring}">${sc}</div>
        <div>
          <div style="font-size:0.85rem;color:var(--text3);margin-bottom:4px">Suspicion Score</div>
          ${verdictBadge(analysis.verdict)}
          <div style="margin-top:10px;font-size:0.88rem;color:${actionMsg.color}">${actionMsg.msg}</div>
        </div>
      </div>
 
      <div class="detail-panel mb-12">
        <div class="detail-panel-header">Detection Details</div>
        <div class="detail-row"><span class="detail-key">Tokens</span><span class="detail-val">${analysis.details.tokenCount}</span></div>
        <div class="detail-row"><span class="detail-key">Filtered tokens</span><span class="detail-val">${analysis.details.filteredTokens}</span></div>
        <div class="detail-row"><span class="detail-key">Sentiment</span><span class="detail-val">${analysis.details.sentiment.label} (${analysis.details.sentiment.comparative.toFixed(2)})</span></div>
        <div class="detail-row"><span class="detail-key">Keyword hits</span><span class="detail-val">${analysis.details.keywordHitCount}</span></div>
        <div class="detail-row"><span class="detail-key">Repetition ratio</span><span class="detail-val">${analysis.details.repetitionRatio}</span></div>
        <div class="detail-row"><span class="detail-key">Duplicate similarity</span><span class="detail-val">${(analysis.details.duplicateSimilarity * 100).toFixed(1)}%</span></div>
        <div class="detail-row"><span class="detail-key">Structural flags</span><span class="detail-val">${analysis.details.structuralFlags.join(', ') || '—'}</span></div>
        <div class="detail-row"><span class="detail-key">Action taken</span><span class="detail-val">${analysis.action.replace(/_/g,' ')}</span></div>
      </div>
 
      ${allKeywords.length ? `
        <div style="margin-top:8px">
          <div style="font-size:0.78rem;color:var(--text3);margin-bottom:6px">TRIGGERED KEYWORDS</div>
          <div class="keyword-tags">
            ${allKeywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
          </div>
        </div>` : ''}
    </div>
  `;
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
 
// ── MY REVIEWS ────────────────────────────────────────────────
async function loadMyReviews() {
  const container = $('my-reviews-list');
  container.innerHTML = `<div class="empty-state"><div class="spinner" style="width:24px;height:24px"></div></div>`;
  try {
    const data = await api('GET', '/users/profile');
    const reviews = data.reviews;
    if (!reviews.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">No reviews yet</div><p>Write your first review!</p></div>`;
      return;
    }
    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th><th>Rating</th><th>Review</th>
              <th>Score</th><th>Status</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${reviews.map(r => `
              <tr>
                <td><strong>${r.product?.name || '—'}</strong><br><span class="text-muted text-sm">${r.product?.category || ''}</span></td>
                <td><div class="stars">${starHtml(r.rating)}</div></td>
                <td style="max-width:260px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">${r.text}</div></td>
                <td>
                  <div class="score-bar-wrap">
                    <div class="score-bar-track">
                      <div class="score-bar-fill" style="width:${r.analysisScore}%;background:${r.analysisScore<40?'var(--green)':r.analysisScore<70?'var(--yellow)':'var(--red)'}"></div>
                    </div>
                    <span style="font-size:0.8rem;font-weight:700;min-width:28px">${r.analysisScore}</span>
                  </div>
                </td>
                <td>${statusBadge(r.status)}</td>
                <td class="text-muted text-sm">${timeAgo(r.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}
 
// ── ADMIN QUEUE ───────────────────────────────────────────────
async function loadAdminQueue(status = 'admin_review') {
  const container = $('admin-queue-list');
  container.innerHTML = `<div class="empty-state"><div class="spinner" style="width:24px;height:24px"></div></div>`;
  try {
    const data = await api('GET', `/admin/queue?status=${status}`);
    renderAdminQueue(data.reviews, data.total);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}
 
function renderAdminQueue(reviews, total) {
  $('queue-total').textContent = total;
  if (!reviews.length) {
    $('admin-queue-list').innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">Queue is empty!</div><p>No reviews pending manual review.</p></div>`;
    return;
  }
  $('admin-queue-list').innerHTML = reviews.map(r => `
    <div class="review-card" id="queue-item-${r._id}">
      <div class="review-card-header">
        <div class="flex gap-12 items-center">
          <div class="analysis-score-ring ${r.analysisScore>=70?'hot':r.analysisScore>=40?'danger':'mild'}" style="width:54px;height:54px;font-size:1rem">
            ${r.analysisScore}
          </div>
          <div>
            <div class="review-user">${r.user?.name || 'Unknown'} <span class="text-muted text-sm">(${r.user?.email || ''})</span></div>
            <div style="font-size:0.82rem;color:var(--text3)">${r.product?.name || '—'} · ${r.product?.category || ''}</div>
            <div class="flex gap-8 items-center" style="margin-top:4px">
              <div class="stars" style="font-size:0.85rem">${starHtml(r.rating)}</div>
              ${verdictBadge(r.verdict)}
              <span class="text-muted text-sm">${timeAgo(r.createdAt)}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-success btn-sm" onclick="adminApprove('${r._id}')">✓ Approve</button>
          <button class="btn btn-danger btn-sm" onclick="adminDelete('${r._id}')">🗑 Delete</button>
          <button class="btn btn-ghost btn-sm" onclick="showDetail('${r._id}')">Details</button>
        </div>
      </div>
      <div class="review-text" style="margin:12px 0">"${r.text}"</div>
 
      <div class="detail-panel" id="detail-${r._id}" style="display:none">
        <div class="detail-panel-header">Analysis Details</div>
        <div class="detail-row"><span class="detail-key">Sentiment</span><span class="detail-val">${r.analysisDetails?.sentiment?.label || '—'} (${(r.analysisDetails?.sentiment?.comparative || 0).toFixed(2)})</span></div>
        <div class="detail-row"><span class="detail-key">Keyword hits</span><span class="detail-val">${r.analysisDetails?.keywordHitCount || 0}</span></div>
        <div class="detail-row"><span class="detail-key">Duplicate similarity</span><span class="detail-val">${((r.analysisDetails?.duplicateSimilarity || 0)*100).toFixed(1)}%</span></div>
        <div class="detail-row"><span class="detail-key">Structural flags</span><span class="detail-val">${(r.analysisDetails?.structuralFlags || []).join(', ') || '—'}</span></div>
        <div class="detail-row"><span class="detail-key">User total reviews</span><span class="detail-val">${r.user?.reviewCount || 0}</span></div>
        <div class="detail-row"><span class="detail-key">User flagged count</span><span class="detail-val" style="color:var(--red)">${r.user?.flaggedCount || 0}</span></div>
        ${Object.keys(r.analysisDetails?.keywordHits||{}).length ? `
          <div class="detail-row flex-col" style="align-items:flex-start;gap:8px">
            <div class="detail-key">Triggered keywords</div>
            <div class="keyword-tags">
              ${Object.values(r.analysisDetails.keywordHits).flat().map(k=>`<span class="keyword-tag">${k}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}
 
function showDetail(id) {
  const panel = $(`detail-${id}`);
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}
 
async function adminApprove(id) {
  try {
    await api('PATCH', `/admin/reviews/${id}/approve`, {});
    $(`queue-item-${id}`)?.remove();
    toast('Review approved ✓', 'success');
    pollAdminQueue();
  } catch (e) { toast(e.message, 'error'); }
}
 
async function adminDelete(id) {
  const note = prompt('Reason for deletion (optional):') ?? '';
  try {
    await api('DELETE', `/admin/reviews/${id}`, { note });
    $(`queue-item-${id}`)?.remove();
    toast('Review deleted', 'info');
    pollAdminQueue();
  } catch (e) { toast(e.message, 'error'); }
}
 
// ── ADMIN ALL REVIEWS ─────────────────────────────────────────
async function loadAdminAll(status = '') {
  const container = $('admin-all-list');
  container.innerHTML = `<div class="empty-state"><div class="spinner" style="width:24px;height:24px"></div></div>`;
  try {
    const data = await api('GET', `/admin/reviews/all${status ? `?status=${status}` : ''}`);
    if (!data.reviews.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No reviews found</div></div>`;
      return;
    }
    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>User</th><th>Product</th><th>Review</th><th>Rating</th><th>Score</th><th>Status</th><th>Date</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${data.reviews.map(r => `
              <tr id="all-row-${r._id}">
                <td><strong>${r.user?.name || '—'}</strong></td>
                <td>${r.product?.name || '—'}</td>
                <td style="max-width:200px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)" title="${r.text}">${r.text}</div></td>
                <td><div class="stars" style="font-size:0.8rem">${starHtml(r.rating)}</div></td>
                <td><span style="font-weight:700;color:${r.analysisScore>=70?'var(--red)':r.analysisScore>=40?'var(--orange)':'var(--green)'}">${r.analysisScore}</span></td>
                <td>${statusBadge(r.status)}</td>
                <td class="text-muted text-sm">${timeAgo(r.createdAt)}</td>
                <td>
                  <div class="flex gap-8">
                    ${r.status !== 'approved' ? `<button class="btn btn-success btn-sm" onclick="adminApproveAll('${r._id}')">✓</button>` : ''}
                    ${r.status !== 'deleted' ? `<button class="btn btn-danger btn-sm" onclick="adminDeleteAll('${r._id}')">🗑</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}
 
async function adminApproveAll(id) {
  try {
    await api('PATCH', `/admin/reviews/${id}/approve`, {});
    loadAdminAll();
    toast('Approved ✓', 'success');
  } catch (e) { toast(e.message, 'error'); }
}
 
async function adminDeleteAll(id) {
  try {
    await api('DELETE', `/admin/reviews/${id}`, {});
    loadAdminAll();
    toast('Deleted', 'info');
  } catch (e) { toast(e.message, 'error'); }
}
 
// ── ADMIN USERS ───────────────────────────────────────────────
async function loadAdminUsers() {
  const container = $('admin-users-list');
  container.innerHTML = `<div class="empty-state"><div class="spinner" style="width:24px;height:24px"></div></div>`;
  try {
    const users = await api('GET', '/admin/users');
    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Reviews</th><th>Flagged</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr id="user-row-${u._id}">
                <td><div class="flex gap-8 items-center">
                  <div class="user-avatar" style="width:28px;height:28px;font-size:0.75rem">${u.name[0].toUpperCase()}</div>
                  <strong>${u.name}</strong>
                </div></td>
                <td class="text-muted">${u.email}</td>
                <td><span class="badge ${u.role==='admin'?'badge-purple':'badge-gray'}">${u.role}</span></td>
                <td>${u.reviewCount || 0}</td>
                <td style="color:${(u.flaggedCount||0)>0?'var(--red)':'var(--text)'}">${u.flaggedCount || 0}</td>
                <td>${u.banned ? '<span class="badge badge-red">Banned</span>' : '<span class="badge badge-green">Active</span>'}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick="toggleBan('${u._id}',${!u.banned})">
                    ${u.banned ? 'Unban' : 'Ban'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}
 
async function toggleBan(userId, ban) {
  try {
    await api('PATCH', `/admin/users/${userId}/ban`, { banned: ban });
    loadAdminUsers();
    toast(ban ? 'User banned' : 'User unbanned', 'info');
  } catch (e) { toast(e.message, 'error'); }
}
 
// ── ADMIN PRODUCTS ────────────────────────────────────────────
async function loadAdminProducts() {
  const container = $('admin-products-list');
  container.innerHTML = `<div class="empty-state"><div class="spinner" style="width:24px;height:24px"></div></div>`;
  try {
    const products = await api('GET', '/admin/products');
    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Category</th><th>Avg Rating</th><th>Reviews</th></tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td><span class="badge badge-blue">${p.category}</span></td>
                <td><div class="flex gap-8 items-center"><div class="stars" style="font-size:0.8rem">${starHtml(Math.round(p.avgRating||0))}</div>${(p.avgRating||0).toFixed(1)}</div></td>
                <td>${p.totalReviews || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}
 
async function addProduct() {
  const name = $('new-product-name').value.trim();
  const category = $('new-product-cat').value.trim();
  const description = $('new-product-desc').value.trim();
  if (!name || !category) return toast('Name and category required', 'warn');
  try {
    await api('POST', '/admin/products', { name, category, description });
    $('new-product-name').value = '';
    $('new-product-cat').value = '';
    $('new-product-desc').value = '';
    loadAdminProducts();
    toast('Product added ✓', 'success');
  } catch (e) { toast(e.message, 'error'); }
}
 
// ── ACTIVITY LOG ──────────────────────────────────────────────
async function loadActivity() {
  const container = $('activity-list');
  container.innerHTML = `<div class="empty-state"><div class="spinner" style="width:24px;height:24px"></div></div>`;
  try {
    const activity = await api('GET', '/admin/activity');
    if (!activity.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🕐</div><div class="empty-title">No activity yet</div></div>`;
      return;
    }
    const icons = { auto_delete:'🗑', admin_delete:'🗑', approve:'✅', flag:'⚑' };
    const colors = { auto_delete:'var(--red)', admin_delete:'var(--orange)', approve:'var(--green)', flag:'var(--yellow)' };
    container.innerHTML = activity.map(a => `
      <div class="flex gap-12 items-center" style="padding:14px 0;border-bottom:1px solid var(--border)">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">${icons[a.type]||'•'}</div>
        <div style="flex:1">
          <div style="font-size:0.88rem;color:${colors[a.type]||'var(--text2)'}"><strong>${a.message || a.type}</strong></div>
          <div class="text-muted text-sm">
            ${a.admin ? `Admin: ${a.admin.name} · ` : ''}
            ${a.user ? `User: ${a.user.name} · ` : ''}
            Score: ${a.score ?? '—'}
          </div>
        </div>
        <div class="text-muted text-sm">${timeAgo(a.createdAt)}</div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}
 
// ── MODAL ─────────────────────────────────────────────────────
function openModal(id) { $(id)?.classList.add('open'); }
function closeModal(id) { $(id)?.classList.remove('open'); }
 
// ── SEED DB ───────────────────────────────────────────────────
async function seedDB() {
  try {
    const res = await fetch(`${API}/seed`, { method: 'POST' });
    const data = await res.json();
    toast(data.message, 'success');
  } catch (e) { toast(e.message, 'error'); }
}
 
// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Auth form handlers
  $('btn-login')?.addEventListener('click', async () => {
    const email = $('login-email').value.trim();
    const pwd   = $('login-pwd').value;
    const btn   = $('btn-login');
    if (!email || !pwd) return toast('Fill all fields', 'warn');
    setLoading(btn, true);
    try {
      const data = await api('POST', '/users/login', { email, password: pwd }, false);
      saveAuth(data);
      showApp();
      toast(`Welcome back, ${data.name}! 👋`, 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(btn, false); }
  });
 
  $('btn-register')?.addEventListener('click', async () => {
    const name  = $('reg-name').value.trim();
    const email = $('reg-email').value.trim();
    const pwd   = $('reg-pwd').value;
    const btn   = $('btn-register');
    if (!name || !email || !pwd) return toast('Fill all fields', 'warn');
    setLoading(btn, true);
    try {
      const data = await api('POST', '/users/register', { name, email, password: pwd }, false);
      saveAuth(data);
      showApp();
      toast(`Account created! Welcome, ${data.name} 🎉`, 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(btn, false); }
  });
 
  // Auth tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      $('login-form').classList.toggle('hidden', tab.dataset.tab !== 'login');
      $('register-form').classList.toggle('hidden', tab.dataset.tab !== 'register');
    });
  });
 
  // Submit review
  $('submit-review-btn')?.addEventListener('click', submitReview);
 
  // Admin queue filter tabs
  document.querySelectorAll('.queue-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.queue-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadAdminQueue(btn.dataset.status);
    });
  });
 
  // Admin all reviews filter
  $('all-status-filter')?.addEventListener('change', e => loadAdminAll(e.target.value));
 
  initStarInput();
 
  // Check existing auth
  if (loadAuth()) {
    showApp();
  } else {
    showAuthPage();
  }
});
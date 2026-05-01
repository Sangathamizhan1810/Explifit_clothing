import './style.css';
import { post, get, put, del, uploadFile, imageUrl } from './api.js';

const app = document.getElementById('app');
let state = { customerId: null, designs: [], idx: 0, likes: 0, dislikes: 0, notifies: 0, contactShown: false };

// --- Router ---
function route() {
  const h = location.hash || '#/';
  if (h.startsWith('#/admin/dashboard')) renderAdminDash();
  else if (h.startsWith('#/admin')) renderAdminLogin();
  else if (h === '#/instructions') renderInstructions();
  else if (h === '#/survey') renderSurvey();
  else if (h === '#/contact') renderContact();
  else if (h === '#/done') renderDone();
  else renderEntry();
}
window.addEventListener('hashchange', route);

// --- Entry Screen ---
function renderEntry() {
  app.innerHTML = `<div class="screen entry-screen">
    <div class="entry-logo">👕</div>
    <h1>ExpliFit Clothing</h1>
    <p class="subtitle">Help us pick the best T-shirt designs!</p>
    <div class="form-group"><label>Your Name</label>
      <input class="form-input" id="inp-name" placeholder="Enter your name" /></div>
    <div class="form-group"><label>Age Group</label>
      <select class="form-select" id="inp-age">
        <option value="">Select age group</option>
        <option>Under 18</option><option>18-24</option><option>25-34</option>
        <option>35-44</option><option>45-54</option><option>55+</option>
      </select></div>
    <button class="btn-primary" id="btn-start">Get Started</button>
    <button class="skip-link" onclick="location.hash='#/admin'" style="margin-top:32px">Admin Panel →</button>
  </div>`;
  document.getElementById('btn-start').onclick = async () => {
    const name = document.getElementById('inp-name').value.trim();
    const age = document.getElementById('inp-age').value;
    if (!name || !age) return alert('Please fill in all fields');
    const r = await post('/api/customers', { name, ageGroup: age });
    state.customerId = r.customerId;
    state.idx = 0; state.likes = 0; state.dislikes = 0; state.notifies = 0; state.contactShown = false;
    location.hash = '#/instructions';
  };
}

// --- Instructions (Interactive Guided Tutorial) ---
function renderInstructions() {
  const steps = [
    { direction: 'right', label: 'LIKED',    color: '#22c55e', instruction: 'Swipe Right →', hint: 'Drag the card to the right' },
    { direction: 'left',  label: 'DISLIKED', color: '#ef4444', instruction: '← Swipe Left',  hint: 'Drag the card to the left' },
    { direction: 'up',    label: 'NOTIFY',   color: '#eab308', instruction: 'Swipe Up ↑',    hint: 'Drag the card upward' },
  ];
  let currentStep = 0;

  app.innerHTML = `<div class="screen instructions-screen">
    <h2>Learn the Gestures</h2>
    <p class="inst-sub" id="tut-instruction">${steps[0].instruction}</p>
    <div class="tut-stage" id="tut-stage">
      <div class="tut-card" id="tut-card">
        <div class="tut-card-emoji">👕</div>
        <div class="tut-card-text">Practice Card</div>
      </div>
      <div class="tut-flash" id="tut-flash"></div>
      <div class="tut-float" id="tut-float"></div>
    </div>
    <div class="tut-hint" id="tut-hint"></div>
    <div class="demo-dots">
      <span class="demo-dot active" data-step="0"></span>
      <span class="demo-dot" data-step="1"></span>
      <span class="demo-dot" data-step="2"></span>
    </div>
    <div class="tut-step-label" id="tut-step-label">Step 1 of 3</div>
    <button class="btn-primary" id="btn-start-survey">Start Survey</button>
  </div>`;

  const card = document.getElementById('tut-card');
  const instruction = document.getElementById('tut-instruction');
  const hint = document.getElementById('tut-hint');
  const dots = document.querySelectorAll('.demo-dot');
  const stepLabel = document.getElementById('tut-step-label');
  const btn = document.getElementById('btn-start-survey');
  const flash = document.getElementById('tut-flash');
  const floatEl = document.getElementById('tut-float');

  let dragging = false, startX = 0, startY = 0, dx = 0, dy = 0;
  let locked = false; // prevent interaction during animations

  function updateUI() {
    const s = steps[currentStep];
    instruction.textContent = s.instruction;
    hint.textContent = '';
    hint.className = 'tut-hint';
    stepLabel.textContent = `Step ${currentStep + 1} of 3`;
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === currentStep);
      d.classList.toggle('done', i < currentStep);
    });
  }

  function showSuccess(s) {
    // Flash
    flash.style.background = s.color;
    flash.style.opacity = '0.35';
    setTimeout(() => { flash.style.opacity = '0'; }, 500);

    // Float text
    floatEl.textContent = s.label;
    floatEl.style.color = s.color;
    floatEl.className = 'tut-float tut-float-show';
    setTimeout(() => { floatEl.className = 'tut-float'; }, 900);
  }

  function showWrongHint() {
    const s = steps[currentStep];
    hint.textContent = `✋ Not quite — ${s.hint}`;
    hint.className = 'tut-hint tut-hint-show';
    setTimeout(() => { hint.className = 'tut-hint'; }, 2000);
  }

  function resetCard() {
    card.style.transition = 'transform 0.3s ease';
    card.style.transform = '';
    flash.style.opacity = '0';
  }

  function animateCardOut(dir, callback) {
    locked = true;
    card.style.transition = 'transform 0.4s ease-in, opacity 0.4s ease-in';
    if (dir === 'right') card.style.transform = 'translateX(200px) rotate(20deg)';
    else if (dir === 'left') card.style.transform = 'translateX(-200px) rotate(-20deg)';
    else card.style.transform = 'translateY(-200px)';
    card.style.opacity = '0';

    setTimeout(() => {
      // Reset card position instantly
      card.style.transition = 'none';
      card.style.transform = 'scale(0.8)';
      card.style.opacity = '0';
      
      // Small delay then animate card back in
      requestAnimationFrame(() => {
        card.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        card.style.transform = '';
        card.style.opacity = '1';
        locked = false;
        if (callback) callback();
      });
    }, 450);
  }

  function checkSwipe() {
    const s = steps[currentStep];
    let correct = false;

    if (s.direction === 'right' && dx > 80) correct = true;
    else if (s.direction === 'left' && dx < -80) correct = true;
    else if (s.direction === 'up' && dy < -80 && Math.abs(dx) < 60) correct = true;

    if (correct) {
      showSuccess(s);
      animateCardOut(s.direction, () => {
        currentStep++;
        if (currentStep < 3) {
          updateUI();
        } else {
          // All 3 done!
          instruction.textContent = '🎉 You\'re ready!';
          stepLabel.textContent = 'All gestures learned';
          dots.forEach(d => d.classList.add('done'));
          btn.classList.add('show-btn');
        }
      });
    } else {
      showWrongHint();
      resetCard();
    }
  }

  // --- Touch/Mouse drag ---
  card.addEventListener('pointerdown', e => {
    if (locked) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY; dx = 0; dy = 0;
    card.setPointerCapture(e.pointerId);
    card.style.transition = 'none';
  });

  card.addEventListener('pointermove', e => {
    if (!dragging || locked) return;
    dx = e.clientX - startX;
    dy = e.clientY - startY;
    const rot = dx * 0.08;
    card.style.transform = `translateX(${dx}px) translateY(${Math.min(dy, 0)}px) rotate(${rot}deg)`;

    // Live color hint on the stage
    const t = 30;
    if (dx > t) {
      flash.style.background = '#22c55e';
      flash.style.opacity = String(Math.min((dx - t) / 150, 0.4));
    } else if (dx < -t) {
      flash.style.background = '#ef4444';
      flash.style.opacity = String(Math.min((-dx - t) / 150, 0.4));
    } else if (dy < -t && Math.abs(dx) < 60) {
      flash.style.background = '#eab308';
      flash.style.opacity = String(Math.min((-dy - t) / 150, 0.4));
    } else {
      flash.style.opacity = '0';
    }
  });

  card.addEventListener('pointerup', () => {
    if (!dragging || locked) return;
    dragging = false;
    checkSwipe();
    dx = 0; dy = 0;
  });

  btn.onclick = () => { location.hash = '#/survey'; };
}


// --- Survey ---
let undoHistory = [];

async function renderSurvey() {
  app.innerHTML = `<div class="screen"><div class="loading-center"><div class="spinner"></div><p>Loading designs…</p></div></div>`;
  const data = await get('/api/designs/active');
  state.designs = data.designs;
  undoHistory = [];
  if (!state.designs.length) { app.innerHTML = `<div class="screen done-screen"><h2>No designs available</h2></div>`; return; }
  buildSurveyUI();
}

function buildSurveyUI() {
  const total = state.designs.length;
  app.innerHTML = `<div class="screen survey-screen-wrap" style="width:100%">
    <div class="survey-header"><h2>Pick Your Favorites</h2>
      <div class="progress-info"><span id="p-text">${state.idx}/${total}</span><span class="progress-pct" id="p-pct">0%</span></div>
      <div class="progress-track"><div class="progress-fill" id="p-fill"></div></div>
    </div>
    <div class="card-area"><div class="card-stack" id="card-stack"></div></div>
    <div class="survey-bottom">
      <button class="undo-btn" id="undo-btn" disabled>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        Undo
      </button>
    </div>
    <div class="flash-overlay" id="flash-overlay"></div>
    <div class="float-text" id="float-text"></div>
  </div>`;
  renderCards();
  document.getElementById('undo-btn').onclick = undoLast;

  document.addEventListener('keydown', onKey);
}

function onKey(e) {
  if (state.idx >= state.designs.length) return;
  if (e.key === 'ArrowLeft') vote('dislike');
  else if (e.key === 'ArrowRight') vote('like');
  else if (e.key === 'ArrowUp') { e.preventDefault(); vote('notify'); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoLast(); }
}

function renderCards() {
  const stack = document.getElementById('card-stack');
  if (!stack) return;
  stack.innerHTML = '';
  if (state.idx >= state.designs.length) { finishSurvey(); return; }
  const n = Math.min(3, state.designs.length - state.idx);
  for (let i = n - 1; i >= 0; i--) {
    const d = state.designs[state.idx + i];
    const el = document.createElement('div');
    el.className = 'survey-card' + (i === 1 ? ' card-behind-1' : i === 2 ? ' card-behind-2' : ' card-enter');
    el.innerHTML = `
      <div class="card-img-wrap"><img src="${imageUrl(d.url)}" alt="${d.name}" /></div>
      <div class="card-info"><span class="card-name">${d.name}</span><span class="card-badge">T-Shirt</span></div>`;
    stack.appendChild(el);
    if (i === 0) setupDrag(el);
  }
}

// --- Drag/Swipe ---
let dragging = false, sx = 0, sy = 0, cx = 0, cy = 0;
function setupDrag(card) {
  const flash = document.getElementById('flash-overlay');

  card.addEventListener('pointerdown', e => {
    dragging = true; sx = e.clientX; sy = e.clientY; cx = 0; cy = 0;
    card.setPointerCapture(e.pointerId);
    card.style.transition = 'none';
    card.classList.remove('card-enter');
  });

  card.addEventListener('pointermove', e => {
    if (!dragging) return;
    cx = e.clientX - sx; cy = e.clientY - sy;
    const r = cx * 0.06;
    card.style.transform = `translateX(${cx}px) translateY(${Math.min(cy, 0)}px) rotate(${r}deg)`;

    // Live color feedback on the page
    if (flash) {
      const t = 40;
      if (cx > t) {
        const intensity = Math.min((cx - t) / 120, 0.5);
        flash.style.background = `rgba(34, 197, 94, ${intensity})`;
        flash.style.opacity = '1';
      } else if (cx < -t) {
        const intensity = Math.min((-cx - t) / 120, 0.5);
        flash.style.background = `rgba(239, 68, 68, ${intensity})`;
        flash.style.opacity = '1';
      } else if (cy < -t && Math.abs(cx) < 80) {
        const intensity = Math.min((-cy - t) / 120, 0.5);
        flash.style.background = `rgba(234, 179, 8, ${intensity})`;
        flash.style.opacity = '1';
      } else {
        flash.style.opacity = '0';
      }
    }
  });

  card.addEventListener('pointerup', () => {
    if (!dragging) return; dragging = false;
    if (cx > 90) vote('like');
    else if (cx < -90) vote('dislike');
    else if (cy < -90 && Math.abs(cx) < 80) vote('notify');
    else {
      card.style.transition = 'transform .3s ease';
      card.style.transform = '';
      if (flash) { flash.style.opacity = '0'; }
    }
    cx = 0; cy = 0;
  });
}

function showFlashFeedback(action) {
  const flash = document.getElementById('flash-overlay');
  const floatEl = document.getElementById('float-text');
  if (!flash || !floatEl) return;

  const config = {
    like:    { color: 'rgba(34, 197, 94, 0.35)', text: 'LIKED',    textColor: '#22c55e' },
    dislike: { color: 'rgba(239, 68, 68, 0.35)',  text: 'DISLIKED', textColor: '#ef4444' },
    notify:  { color: 'rgba(234, 179, 8, 0.35)',  text: 'NOTIFY',   textColor: '#eab308' },
  };
  const c = config[action];

  // Flash
  flash.style.background = c.color;
  flash.style.opacity = '1';
  clearTimeout(showFlashFeedback._flashTimer);
  showFlashFeedback._flashTimer = setTimeout(() => { flash.style.opacity = '0'; }, 500);

  // Float text — force restart animation even on rapid swipes
  clearTimeout(showFlashFeedback._floatTimer);
  floatEl.className = 'float-text';
  void floatEl.offsetWidth; // force reflow to restart animation
  floatEl.textContent = c.text;
  floatEl.style.color = c.textColor;
  floatEl.className = 'float-text float-text-show';
  showFlashFeedback._floatTimer = setTimeout(() => { floatEl.className = 'float-text'; }, 900);
}

async function vote(action) {
  if (state.idx >= state.designs.length) return;
  const card = document.querySelector('.survey-card:not(.card-behind-1):not(.card-behind-2)');
  if (!card) return;

  // Animate card out
  card.classList.add(action === 'like' ? 'swipe-right' : action === 'dislike' ? 'swipe-left' : 'swipe-up');

  // Show vibrant flash + floating text
  showFlashFeedback(action);

  const d = state.designs[state.idx];

  // Track undo history
  undoHistory.push({ designIndex: state.idx, action, designId: d.id });
  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) undoBtn.disabled = false;

  if (action === 'like') state.likes++; else if (action === 'dislike') state.dislikes++; else state.notifies++;
  state.idx++;
  updateProgress();

  post('/api/interactions', { customerId: state.customerId, designId: d.id, action }).then(r => {
    if (!state.contactShown && (r.interactionCount >= 5 || r.hasNotified)) {
      state.contactShown = true;
    }
  }).catch(() => {});

  state.renderTimer = setTimeout(() => renderCards(), 350);
}

async function undoLast() {
  if (!undoHistory.length) return;
  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) undoBtn.disabled = true;
  const last = undoHistory.pop();

  // Revert local state immediately (Optimistic UI)
  state.idx = last.designIndex;
  if (last.action === 'like') state.likes--;
  else if (last.action === 'dislike') state.dislikes--;
  else state.notifies--;

  updateProgress();
  if (state.renderTimer) clearTimeout(state.renderTimer);
  renderCards();

  // Undo in API in the background
  try {
    await del(`/api/interactions/undo/${state.customerId}`);
  } catch (e) {
    console.error('Failed to undo on server:', e);
  }

  if (undoBtn) undoBtn.disabled = undoHistory.length === 0;
}

function updateProgress() {
  const total = state.designs.length, done = state.idx, pct = Math.round((done / total) * 100);
  const pt = document.getElementById('p-text'), pp = document.getElementById('p-pct'), pf = document.getElementById('p-fill');
  if (pt) pt.textContent = `${done} / ${total}`;
  if (pp) pp.textContent = `${pct}%`;
  if (pf) pf.style.width = `${pct}%`;
}

function finishSurvey() {
  document.removeEventListener('keydown', onKey);
  if (state.contactShown || state.notifies > 0) location.hash = '#/contact';
  else location.hash = '#/done';
}


// --- Contact ---
function renderContact() {
  let type = 'phone';
  app.innerHTML = `<div class="screen contact-screen">
    <h2>Stay in Touch! 📱</h2>
    <p class="contact-sub">Leave your contact so we can notify you when your favorite designs are available.</p>
    <div class="contact-toggle"><button class="active" id="ct-phone">📱 Phone</button><button id="ct-email">📧 Email</button></div>
    <div class="form-group" style="max-width:320px;width:100%">
      <input class="form-input" id="inp-contact" placeholder="Your phone number" /></div>
    <button class="btn-primary" id="btn-contact-save">Submit</button>
  </div>`;
  const ph = document.getElementById('ct-phone'), em = document.getElementById('ct-email'), inp = document.getElementById('inp-contact');
  inp.type = 'tel'; inp.maxLength = 10; inp.inputMode = 'numeric';
  inp.oninput = () => { if (type === 'phone') inp.value = inp.value.replace(/\D/g, ''); };
  ph.onclick = () => { type = 'phone'; ph.classList.add('active'); em.classList.remove('active'); inp.placeholder = 'Your phone number'; inp.type = 'tel'; inp.maxLength = 10; inp.inputMode = 'numeric'; inp.value = ''; };
  em.onclick = () => { type = 'email'; em.classList.add('active'); ph.classList.remove('active'); inp.placeholder = 'Your email address'; inp.type = 'email'; inp.maxLength = 100; inp.inputMode = 'email'; inp.value = ''; };
  document.getElementById('btn-contact-save').onclick = async () => {
    const v = inp.value.trim();
    if (!v) return alert('Please enter your contact');
    if (type === 'phone') {
      if (!/^\d{10}$/.test(v)) return alert('Please enter a valid 10-digit phone number');
    } else {
      if (!v.endsWith('@gmail.com') || v.split('@')[0].length === 0) return alert('Please enter a valid Gmail address (e.g. name@gmail.com)');
    }
    await put(`/api/customers/${state.customerId}/contact`, { contactType: type, contactValue: v });
    location.hash = '#/done';
  };
}

// --- Done ---
async function renderDone() {
  const r = await post(`/api/customers/${state.customerId}/complete`);
  const s = r.stats || { likes: state.likes, dislikes: state.dislikes, notifies: state.notifies, total: state.idx };
  app.innerHTML = `<div class="screen done-screen">
    <div class="done-icon">🎉</div><h2>Thank You!</h2>
    <p>You reviewed ${s.total} designs. Your feedback helps us decide what to make!</p>
    <div class="stats-row">
      <div class="stat-card s-like"><span class="stat-num">${s.likes}</span><span class="stat-lbl">Liked</span></div>
      <div class="stat-card s-dislike"><span class="stat-num">${s.dislikes}</span><span class="stat-lbl">Disliked</span></div>
      <div class="stat-card s-notify"><span class="stat-num">${s.notifies}</span><span class="stat-lbl">Notify</span></div>
    </div>
    <button class="btn-primary" onclick="location.hash='#/'">Back to Home</button>
  </div>`;
}

// --- Admin Login ---
function renderAdminLogin() {
  app.innerHTML = `<div class="screen admin-login">
    <h2>🔐 Admin Login</h2>
    <div class="form-group" style="max-width:300px;width:100%"><label>Username</label><input class="form-input" id="adm-user" placeholder="Username" /></div>
    <div class="form-group" style="max-width:300px;width:100%"><label>Password</label><input class="form-input" id="adm-pass" type="password" placeholder="Password" /></div>
    <button class="btn-primary" id="adm-login-btn">Login</button>
    <div class="login-error" id="adm-err"></div>
    <button class="skip-link" onclick="location.hash='#/'" style="margin-top:20px">← Back to Survey</button>
  </div>`;
  document.getElementById('adm-login-btn').onclick = async () => {
    const u = document.getElementById('adm-user').value, p = document.getElementById('adm-pass').value;
    console.log('Attempting login with:', u);
    const r = await post('/api/admin/login', { username: u, password: p });
    console.log('Login response:', r);
    if (r.success) location.hash = '#/admin/dashboard';
    else document.getElementById('adm-err').textContent = 'Invalid credentials';
  };
}

// --- Admin Dashboard ---
let adminTab = 'designs';
let adminDesigns = [];
async function renderAdminDash() {
  app.innerHTML = `<div class="screen admin-screen admin-dash"><div class="loading-center"><div class="spinner"></div></div></div>`;
  const [analytics, designsData, responsesData] = await Promise.all([get('/api/admin/analytics'), get('/api/admin/designs'), get('/api/admin/responses')]);
  const a = analytics, designs = designsData.designs, customers = responsesData.customers;
  adminDesigns = designs;

  app.innerHTML = `<div class="screen admin-screen admin-dash">
    <div class="admin-topbar"><h2>📊 Dashboard</h2>
      <button class="btn-logout" onclick="location.hash='#/'">Logout</button>
    </div>
    <div class="admin-toolbar">
      <div class="admin-tabs">
        <button class="${adminTab==='designs'?'active':''}" data-tab="designs">Designs</button>
        <button class="${adminTab==='responses'?'active':''}" data-tab="responses">Responses</button>
      </div>
      <div class="admin-actions">
        <button class="btn-upload" id="upload-btn">+ Upload</button>
      </div>
    </div>
    <div class="stats-grid">
      <div class="overview-stat"><span class="ov-num">${a.totalCustomers}</span><span class="ov-lbl">Customers</span></div>
      <div class="overview-stat"><span class="ov-num" style="color:var(--like)">${a.totalLikes}</span><span class="ov-lbl">Likes</span></div>
      <div class="overview-stat"><span class="ov-num" style="color:var(--skip)">${a.totalDislikes}</span><span class="ov-lbl">Dislikes</span></div>
      <div class="overview-stat"><span class="ov-num" style="color:var(--notify)">${a.totalNotifies}</span><span class="ov-lbl">Notifies</span></div>
    </div>
    <div id="tab-content"></div>
  </div>`;

  const tabContent = document.getElementById('tab-content');
  function showTab(t) {
    adminTab = t;
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    if (t === 'designs') renderDesignsTab(tabContent, designs);
    else renderResponsesTab(tabContent, customers);
  }
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  document.getElementById('upload-btn').onclick = () => showUploadModal();
  showTab(adminTab);
}

function renderDesignsTab(el, designs) {
  el.innerHTML = `<div class="designs-grid">${designs.map(d => `
    <div class="design-card ${d.active ? '' : 'inactive'}" data-id="${d.id}">
      <img src="${imageUrl(d.url)}" alt="${d.name}" />
      <div class="design-card-body">
        <h4>${d.name}</h4>
        <div class="design-stats">
          <span class="ds-like">❤ ${d.likes}</span>
          <span class="ds-dislike">✕ ${d.dislikes}</span>
          <span class="ds-notify">🔔 ${d.notifies}</span>
        </div>
        <div class="design-actions">
          <div class="order-row">
            <label>Order</label>
            <input type="number" class="order-input" value="${d.priority}" min="1" onchange="window._updatePriority('${d.id}', this.value, ${d.priority})" />
          </div>
          <div class="action-btns">
            <button class="action-btn" onclick="window._editDesignName('${d.id}','${d.name.replace(/'/g, "\\'")}')">✏️ Edit</button>
            <button class="action-btn ${d.active ? 'btn-danger' : 'btn-activate'}" onclick="window._toggleDesign('${d.id}',${d.active})">${d.active ? '🚫 Deactivate' : '✅ Activate'}</button>
          </div>
        </div>
      </div>
    </div>`).join('')}</div>`;
}

window._toggleDesign = async (id, current) => {
  await put(`/api/admin/designs/${id}`, { active: !current });
  renderAdminDash();
};
window._editDesignName = async (id, oldName) => {
  const newName = prompt('Enter new design name:', oldName);
  if (newName && newName !== oldName) {
    await put(`/api/admin/designs/${id}`, { name: newName });
    renderAdminDash();
  }
};
window._updatePriority = async (id, newPriority, oldPriority) => {
  newPriority = parseInt(newPriority);
  if (isNaN(newPriority) || newPriority < 1) return;
  const conflict = adminDesigns.find(d => d.priority === newPriority && d.id !== id);
  if (conflict) {
    await put(`/api/admin/designs/${conflict.id}`, { priority: oldPriority });
  }
  await put(`/api/admin/designs/${id}`, { priority: newPriority });
  renderAdminDash();
};

function renderResponsesTab(el, customers) {
  el.innerHTML = `<div class="table-wrap"><table class="resp-table">
    <thead><tr><th>Name</th><th>Age</th><th>Contact</th><th>Likes</th><th>Dislikes</th><th>Notifies</th><th>Done</th></tr></thead>
    <tbody>${customers.map(c => `<tr>
      <td>${c.name}</td><td>${c.age_group}</td>
      <td>${c.contact_value ? `${c.contact_type}: ${c.contact_value}` : '—'}</td>
      <td style="color:var(--like)">${c.likes}</td><td style="color:var(--skip)">${c.dislikes}</td>
      <td style="color:var(--notify)">${c.notifies}</td><td>${c.completed ? '✅' : '—'}</td>
    </tr>`).join('')}</tbody></table></div>`;
  if (!customers.length) el.innerHTML = '<p style="text-align:center;color:var(--text2);padding:40px">No responses yet</p>';
}

function showUploadModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">
    <h3>Upload New Design</h3>
    <div class="form-group"><label>Design Name</label><input class="form-input" id="upl-name" placeholder="e.g. Funny Cat Meme" /></div>
    <div class="form-group"><label>Image</label><div class="file-input-wrap"><input type="file" id="upl-file" accept="image/*" /></div></div>
    <div class="modal-btns">
      <button class="btn-sm" id="upl-cancel">Cancel</button>
      <button class="btn-primary" id="upl-save" style="padding:10px 24px;font-size:.85rem">Upload</button>
    </div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#upl-cancel').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.querySelector('#upl-save').onclick = async () => {
    const file = document.getElementById('upl-file').files[0];
    if (!file) return alert('Select an image');
    const fd = new FormData();
    fd.append('image', file);
    fd.append('name', document.getElementById('upl-name').value || file.name);
    await uploadFile('/api/admin/designs', fd);
    overlay.remove();
    renderAdminDash();
  };
}

// --- Init ---
route();

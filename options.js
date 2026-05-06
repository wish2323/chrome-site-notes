// promisified chrome.storage helpers — reject on chrome.runtime.lastError
function storageOp(fn) {
  return new Promise((resolve, reject) => {
    fn((result) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(result);
    });
  });
}
const getLocal    = (keys) => storageOp(r => chrome.storage.local.get(keys, r));
const setLocal    = (obj)  => storageOp(r => chrome.storage.local.set(obj, r));
const removeLocal = (keys) => storageOp(r => chrome.storage.local.remove(keys, r));
const getSync     = (keys) => storageOp(r => chrome.storage.sync.get(keys, r));
const setSync     = (obj)  => storageOp(r => chrome.storage.sync.set(obj, r));
const removeSync  = (keys) => storageOp(r => chrome.storage.sync.remove(keys, r));

function maskKey(key) {
  if (!key || key.length < 8) return key;
  return key.slice(0, 4) + '-····-····-' + key.slice(-4);
}

async function validateKey(key) {
  const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      license_key: key.trim(),
      instance_name: 'site-notes-' + chrome.runtime.id,
    }),
  });
  if (!res.ok) throw new Error('Network error. Please try again.');
  const data = await res.json();
  if (!data.valid) throw new Error(data.error || 'Invalid license key.');
}

async function migrateLocalToSync() {
  const all = await getLocal(null);
  const notes = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('pn:')));
  if (Object.keys(notes).length > 0) {
    await setSync(notes);
    await removeLocal(Object.keys(notes));
  }
}

async function migrateSyncToLocal() {
  const all = await getSync(null);
  const notes = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('pn:')));
  if (Object.keys(notes).length > 0) {
    await setLocal(notes);
    await removeSync(Object.keys(notes));
  }
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

const planCard      = document.getElementById('plan-card');
const planName      = document.getElementById('plan-name');
const planDesc      = document.getElementById('plan-desc');
const keyDisplay    = document.getElementById('key-display');
const sectionAct    = document.getElementById('section-activate');
const sectionDeact  = document.getElementById('section-deactivate');
const keyInput      = document.getElementById('key-input');
const activateBtn   = document.getElementById('activate-btn');
const activateMsg   = document.getElementById('activate-msg');
const deactivateBtn = document.getElementById('deactivate-btn');
const deactivateMsg = document.getElementById('deactivate-msg');

function renderFree() {
  planCard.classList.remove('premium');
  planName.className = 'plan-name';
  planName.textContent = 'Free';
  planDesc.textContent = 'Notes saved locally on this device.';
  keyDisplay.classList.remove('visible');
  keyDisplay.textContent = '';

  const featureList = planCard.querySelector('.feature-list');
  featureList.innerHTML = `
    <li><span class="check">✓</span> Notes per page</li>
    <li><span class="check">✓</span> Unlimited notes</li>
    <li><span class="dim">–</span> <span class="dim">Sync across devices</span></li>
  `;

  sectionAct.style.display = '';
  sectionDeact.style.display = 'none';
  activateMsg.textContent = '';
  keyInput.value = '';
  keyInput.classList.remove('error');
  setBtnLoading(activateBtn, false, 'Activate');
}

function renderPremium(key) {
  planCard.classList.add('premium');
  planName.className = 'plan-name premium-name';
  planName.textContent = 'Premium';
  planDesc.textContent = 'Notes synced across all your devices via Google account.';
  keyDisplay.textContent = 'License: ' + maskKey(key);
  keyDisplay.classList.add('visible');

  const featureList = planCard.querySelector('.feature-list');
  featureList.innerHTML = `
    <li><span class="check">✓</span> Notes per page</li>
    <li><span class="check">✓</span> Unlimited notes</li>
    <li><span class="check">✓</span> Sync across devices</li>
  `;

  sectionAct.style.display = 'none';
  sectionDeact.style.display = '';
  deactivateMsg.textContent = '';
  setBtnLoading(deactivateBtn, false, 'Deactivate');
}

function setMsg(el, text, type) {
  el.textContent = text;
  el.className = 'msg ' + type;
}

function setBtnLoading(btn, loading, label) {
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>' + (label || 'Working…');
  } else {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

activateBtn.addEventListener('click', async () => {
  const key = keyInput.value.trim();
  if (!key) {
    keyInput.classList.add('error');
    setMsg(activateMsg, 'Please enter a license key.', 'err');
    return;
  }
  keyInput.classList.remove('error');
  setBtnLoading(activateBtn, true, 'Activating…');
  setMsg(activateMsg, '', '');

  try {
    await validateKey(key);
    await migrateLocalToSync();
    await setLocal({ pn_premium: key });
    renderPremium(key);
  } catch (e) {
    keyInput.classList.add('error');
    setMsg(activateMsg, e.message, 'err');
    setBtnLoading(activateBtn, false, 'Activate');
  }
});

deactivateBtn.addEventListener('click', async () => {
  setBtnLoading(deactivateBtn, true, 'Deactivating…');
  setMsg(deactivateMsg, '', '');

  try {
    await migrateSyncToLocal();
    await removeLocal('pn_premium');
    renderFree();
  } catch (e) {
    setMsg(deactivateMsg, e.message, 'err');
    setBtnLoading(deactivateBtn, false, 'Deactivate');
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  const r = await getLocal('pn_premium');
  if (r.pn_premium) {
    renderPremium(r.pn_premium);
  } else {
    renderFree();
  }
})();

const getLocal = (keys) => new Promise(r => chrome.storage.local.get(keys, r));

function maskKey(key) {
  if (!key || key.length < 8) return key;
  return key.slice(0, 4) + '-····-····-' + key.slice(-4);
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

const planCard  = document.getElementById('plan-card');
const planName  = document.getElementById('plan-name');
const planDesc  = document.getElementById('plan-desc');
const keyDisplay = document.getElementById('key-display');

function renderFree() {
  planCard.classList.remove('premium');
  planName.className = 'plan-name';
  planName.textContent = 'Free';
  planDesc.textContent = 'Notes saved locally on this device.';
  keyDisplay.classList.remove('visible');
  keyDisplay.textContent = '';

  planCard.querySelector('.feature-list').innerHTML = `
    <li><span class="check">✓</span> Notes per page</li>
    <li><span class="check">✓</span> Unlimited notes</li>
    <li><span class="dim">–</span> <span class="dim">Sync across devices</span></li>
  `;
}

function renderPremium(key) {
  planCard.classList.add('premium');
  planName.className = 'plan-name premium-name';
  planName.textContent = 'Premium';
  planDesc.textContent = 'Notes synced across all your devices via Google account.';
  keyDisplay.textContent = 'License: ' + maskKey(key);
  keyDisplay.classList.add('visible');

  planCard.querySelector('.feature-list').innerHTML = `
    <li><span class="check">✓</span> Notes per page</li>
    <li><span class="check">✓</span> Unlimited notes</li>
    <li><span class="check">✓</span> Sync across devices</li>
  `;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  const r = await getLocal('pn_premium');
  if (r.pn_premium) {
    renderPremium(r.pn_premium);
  } else {
    renderFree();
  }
})();

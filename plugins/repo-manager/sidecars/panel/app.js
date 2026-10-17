const getSidecar = () => window.sidecar;
const $ = (id) => document.getElementById(id);

let allRepos = [];
let workspaceUris = [];
let conversationId = null;
let searchQuery = '';
let filterModifiedOnly = false;
let autoRefreshTimer = null;
let isSaving = false;

// ---------------------------------------------------------------------------
// Helpers & API
// ---------------------------------------------------------------------------

async function api(path, { method = 'GET', body } = {}) {
  const sidecar = getSidecar();
  const options = { method };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const res = await (sidecar ? sidecar.fetch(path, options) : fetch(path, options));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return data;
}

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2000);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Core Data & Rendering
// ---------------------------------------------------------------------------

async function loadRepos(showSpinner = true) {
  if (isSaving) return; // don't clobber in-flight save
  try {
    const sidecar = getSidecar();
    if (sidecar && typeof sidecar.getWorkspaceUris === 'function') {
      const uris = await sidecar.getWorkspaceUris().catch(() => []);
      if (uris) {
        workspaceUris = uris;
      }
    }
    if (sidecar) {
      if (typeof sidecar.getConversationId === 'function') {
        conversationId = await sidecar.getConversationId().catch(() => null) || sidecar.conversationId || null;
      } else {
        conversationId = sidecar.conversationId || null;
      }
    }

    const params = new URLSearchParams();
    if (workspaceUris.length) params.set('workspaceUris', workspaceUris.join(','));
    if (conversationId) params.set('conversationId', conversationId);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await api(`/api/repos${query}`);

    allRepos = res.repos || [];
    renderList();
  } catch (err) {
    if (showSpinner) {
      toast(`Failed to load repos: ${err.message}`);
    }
  }
}

async function saveSelection() {
  if (!conversationId) return;
  isSaving = true;
  try {
    const selectedPaths = allRepos.filter(r => r.selected).map(r => r.path);
    await api('/api/repos/select', {
      method: 'POST',
      body: {
        workspaceUris,
        conversationId,
        selectedPaths,
      },
    });
    toast(`Active repositories updated (${selectedPaths.length} selected)`);
  } catch (err) {
    toast(`Failed to save: ${err.message}`);
  } finally {
    isSaving = false;
  }
}

function renderList() {
  const container = $('repo-list');
  const empty = $('empty-state');
  const noWsState = $('no-workspace-state');
  const badge = $('selection-badge');
  const btnSelectAll = $('btn-select-all');
  const btnClearAll = $('btn-clear-all');

  // Check if workspace is open
  if (workspaceUris.length === 0) {
    container.innerHTML = '';
    empty.hidden = true;
    if (noWsState) noWsState.hidden = false;
    badge.textContent = 'No workspace open';
    badge.className = 'badge';
    if (btnSelectAll) btnSelectAll.disabled = true;
    if (btnClearAll) btnClearAll.disabled = true;
    return;
  }
  if (noWsState) noWsState.hidden = true;

  const isInteractive = Boolean(conversationId);
  const selectedCount = allRepos.filter(r => r.selected).length;

  if (isInteractive) {
    badge.textContent = `${selectedCount} of ${allRepos.length} selected`;
    badge.className = 'badge badge-info';
    if (btnSelectAll) btnSelectAll.disabled = false;
    if (btnClearAll) btnClearAll.disabled = false;
  } else {
    badge.textContent = 'Viewing workspace baseline';
    badge.className = 'badge';
    if (btnSelectAll) btnSelectAll.disabled = true;
    if (btnClearAll) btnClearAll.disabled = true;
  }

  const q = searchQuery.toLowerCase().trim();
  const filtered = allRepos.filter(r => {
    if (filterModifiedOnly && r.isClean) return false;
    if (q) {
      const matchName = r.name.toLowerCase().includes(q);
      const matchPath = (r.relativePath || '').toLowerCase().includes(q);
      const matchBranch = (r.branch || '').toLowerCase().includes(q);
      return matchName || matchPath || matchBranch;
    }
    return true;
  });

  if (allRepos.length === 0) {
    container.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  container.innerHTML = filtered.map(r => {
    const isProtected = r.isProtected;
    const branchBadgeClass = isProtected ? 'branch-badge protected' : 'branch-badge';
    const statusPillClass = r.isClean ? 'status-pill clean' : 'status-pill dirty';
    const statusText = r.isClean ? 'Clean' : `+${r.dirtyCount} modified`;
    const disabledAttr = isInteractive ? '' : 'disabled';
    const titleAttr = isInteractive ? '' : 'title="Open an active conversation to select repositories"';

    return `
      <div class="repo-card ${r.selected ? 'selected' : ''}" data-path="${escapeHtml(r.path)}" ${titleAttr}>
        <div class="repo-checkbox-wrap">
          <input type="checkbox" class="repo-checkbox" ${r.selected ? 'checked' : ''} ${disabledAttr} data-path="${escapeHtml(r.path)}" />
        </div>
        <div class="repo-info">
          <div class="repo-title-row">
            <span class="repo-name" title="${escapeHtml(r.path)}">${escapeHtml(r.name)}</span>
            <span class="${branchBadgeClass}">${escapeHtml(r.branch)}${isProtected ? ' (protected)' : ''}</span>
          </div>
          <div class="repo-path">${escapeHtml(r.relativePath)}</div>
          <div class="repo-meta-row">
            <span class="${statusPillClass}">${statusText}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach event handlers
  container.querySelectorAll('.repo-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!isInteractive) return;
      if (e.target.classList.contains('repo-checkbox')) return;
      const chk = card.querySelector('.repo-checkbox');
      chk.checked = !chk.checked;
      toggleRepo(chk.dataset.path, chk.checked);
    });
  });

  container.querySelectorAll('.repo-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      if (!isInteractive) return;
      toggleRepo(e.target.dataset.path, e.target.checked);
    });
  });
}

function toggleRepo(path, selected) {
  if (!conversationId) {
    toast('Open an active chat to select repositories');
    return;
  }
  const repo = allRepos.find(r => r.path === path);
  if (repo) {
    repo.selected = selected;
    renderList();
    saveSelection();
  }
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------

function setupEvents() {
  $('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  $('btn-select-all').addEventListener('click', () => {
    allRepos.forEach(r => { r.selected = true; });
    renderList();
    saveSelection();
  });

  $('btn-clear-all').addEventListener('click', () => {
    allRepos.forEach(r => { r.selected = false; });
    renderList();
    saveSelection();
  });

  $('btn-modified-only').addEventListener('click', () => {
    filterModifiedOnly = !filterModifiedOnly;
    $('btn-modified-only').classList.toggle('btn-primary', filterModifiedOnly);
    renderList();
  });

  // Subscribe to host workspace changes
  const sidecar = getSidecar();
  if (sidecar && typeof sidecar.onWorkspaceChange === 'function') {
    sidecar.onWorkspaceChange((uris) => {
      if (Array.isArray(uris)) {
        workspaceUris = uris;
        loadRepos(false);
      }
    });
  }

  // Auto-refresh when window regains focus
  window.addEventListener('focus', () => {
    loadRepos(false);
  });

  // Auto-refresh every 5 seconds
  autoRefreshTimer = setInterval(() => {
    loadRepos(false);
  }, 5000);
}

// Initialize
setupEvents();
loadRepos();

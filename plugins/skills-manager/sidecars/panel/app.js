const sidecar = window.sidecar;
const $ = (id) => document.getElementById(id);

let allSkills = [];
let activeScope = 'all';
let searchQuery = '';
let currentSkill = null; // null when creating new
let workspaceUris = [];

// ---------------------------------------------------------------------------
// Helpers & API
// ---------------------------------------------------------------------------

async function api(path, { method = 'GET', body } = {}) {
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
function toast(message, isError = false) {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function checkFrontmatter(text) {
  const sanitized = text.replace(/^\uFEFF/, '').trim();
  if (!sanitized.startsWith('---')) {
    return "Frontmatter missing: SKILL.md must begin with '---'";
  }
  const match = sanitized.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return "Frontmatter closing delimiter ('---') missing or malformed.";
  }
  const yaml = match[1];
  if (!/^\s*name\s*:\s*[^\s]/m.test(yaml)) {
    return "Required field 'name:' is missing in YAML frontmatter.";
  }
  if (!/^\s*description\s*:\s*[^\s]/m.test(yaml)) {
    return "Required field 'description:' is missing in YAML frontmatter.";
  }
  return null;
}

function updateValidationBanner() {
  const text = $('editor-content').value;
  const banner = $('validation-banner');
  const error = checkFrontmatter(text);
  if (error) {
    banner.textContent = error;
    banner.className = 'validation-banner error';
    banner.hidden = false;
  } else {
    banner.textContent = "Valid SKILL.md frontmatter";
    banner.className = 'validation-banner ok';
    banner.hidden = false;
  }
}

// ---------------------------------------------------------------------------
// Skills List & Filtering
// ---------------------------------------------------------------------------

async function loadSkills() {
  try {
    if (sidecar && typeof sidecar.getWorkspaceUris === 'function') {
      workspaceUris = await sidecar.getWorkspaceUris().catch(() => []);
    }
    const query = workspaceUris.length ? `?workspaceUris=${encodeURIComponent(workspaceUris.join(','))}` : '';
    const res = await api(`/api/skills${query}`);
    allSkills = res.skills || [];
    renderList();
  } catch (err) {
    toast(`Failed to load skills: ${err.message}`, true);
  }
}

function renderList() {
  const container = $('skills-list');
  const empty = $('empty-state');
  container.innerHTML = '';

  const q = searchQuery.toLowerCase().trim();
  const filtered = allSkills.filter(s => {
    // Scope filter
    if (activeScope === 'disabled') {
      if (s.enabled) return false;
    } else if (activeScope !== 'all') {
      if (s.scope !== activeScope) return false;
    }

    // Search query
    if (q) {
      const matchName = s.name.toLowerCase().includes(q);
      const matchDesc = (s.description || '').toLowerCase().includes(q);
      return matchName || matchDesc;
    }
    return true;
  });

  $('skill-count').textContent = filtered.length;

  if (filtered.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  filtered.forEach(skill => {
    const card = document.createElement('div');
    card.className = `skill-card ${skill.enabled ? 'active' : 'disabled'}`;

    const badgeLabel = skill.scope === 'builtin' ? 'Built-in (System)' : skill.scope;
    const badgeClass = `badge-${skill.scope}`;

    card.innerHTML = `
      <div class="card-body">
        <div class="card-title-row">
          <button type="button" class="skill-name-btn" title="Click to view/edit">${escapeHtml(skill.name)}</button>
          <span class="badge ${badgeClass}">${escapeHtml(badgeLabel)}</span>
        </div>
        <p class="card-desc">${escapeHtml(skill.description)}</p>
      </div>
      <div class="card-toggle">
        <label class="switch" title="${skill.enabled ? 'Click to disable from / slash menu' : 'Click to enable in / slash menu'}">
          <input type="checkbox" ${skill.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
    `;

    // Click on name to edit
    card.querySelector('.skill-name-btn').addEventListener('click', () => openEditor(skill));

    // Toggle switch
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', async () => {
      await toggleSkill(skill, checkbox);
    });

    container.appendChild(card);
  });
}

async function toggleSkill(skill, checkbox) {
  try {
    const res = await api('/api/skill/toggle', {
      method: 'POST',
      body: {
        path: skill.path,
        workspaceUris,
      }
    });

    skill.path = res.newPath;
    skill.file = res.file;
    skill.enabled = res.enabled;

    const actionText = res.enabled ? "enabled in / menu" : "disabled from / menu";
    toast(`"${skill.name}" ${actionText}`);
    renderList();
  } catch (err) {
    checkbox.checked = !checkbox.checked; // Revert checkbox
    toast(`Toggle failed: ${err.message}`, true);
  }
}

// ---------------------------------------------------------------------------
// Editor Modal
// ---------------------------------------------------------------------------

async function openEditor(skill = null) {
  currentSkill = skill;
  const modal = $('editor-modal');
  const title = $('modal-title');
  const newMeta = $('new-skill-meta');
  const textarea = $('editor-content');

  if (skill) {
    title.textContent = `Edit Skill: ${skill.name}`;
    newMeta.hidden = true;
    textarea.value = "Loading content...";
    modal.hidden = false;

    try {
      const query = `?path=${encodeURIComponent(skill.file)}&workspaceUris=${encodeURIComponent(workspaceUris.join(','))}`;
      const res = await api(`/api/skill/content${query}`);
      textarea.value = res.content || '';
      updateValidationBanner();
    } catch (err) {
      toast(`Could not load SKILL.md: ${err.message}`, true);
      modal.hidden = true;
    }
  } else {
    // New Skill
    title.textContent = "New Skill";
    newMeta.hidden = false;
    $('new-skill-name').value = '';
    $('new-skill-scope').value = workspaceUris.length ? 'workspace' : 'global';

    textarea.value = [
      '---',
      'name: my-new-skill',
      'description: Describe what this skill accomplishes and when the agent should trigger it.',
      '---',
      '',
      '# My New Skill',
      '',
      'Instructions for the agent...',
    ].join('\n');

    modal.hidden = false;
    updateValidationBanner();
    $('new-skill-name').focus();
  }
}

function closeEditor() {
  $('editor-modal').hidden = true;
  currentSkill = null;
}

async function saveSkill() {
  const content = $('editor-content').value;
  const frontmatterError = checkFrontmatter(content);
  if (frontmatterError) {
    toast(frontmatterError, true);
    return;
  }

  const payload = {
    content,
    workspaceUris,
  };

  if (currentSkill) {
    payload.path = currentSkill.file;
  } else {
    const name = $('new-skill-name').value.trim();
    if (!name) {
      toast("Please enter a skill folder name.", true);
      $('new-skill-name').focus();
      return;
    }
    payload.name = name;
    payload.scope = $('new-skill-scope').value;
  }

  try {
    const res = await api('/api/skill/save', {
      method: 'POST',
      body: payload,
    });
    toast("Skill saved successfully!");
    closeEditor();
    await loadSkills();
  } catch (err) {
    toast(`Save failed: ${err.message}`, true);
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function init() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeScope = btn.dataset.scope;
      renderList();
    });
  });

  // Search
  $('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  // Actions
  $('btn-new').addEventListener('click', () => openEditor(null));
  $('btn-refresh').addEventListener('click', loadSkills);
  $('btn-save').addEventListener('click', saveSkill);
  $('btn-cancel').addEventListener('click', closeEditor);
  $('modal-close').addEventListener('click', closeEditor);
  $('editor-content').addEventListener('input', updateValidationBanner);

  // Sync workspace change
  if (sidecar && typeof sidecar.onWorkspaceChange === 'function') {
    sidecar.onWorkspaceChange((uris) => {
      workspaceUris = uris || [];
      loadSkills();
    });
  }

  loadSkills();
}

init();

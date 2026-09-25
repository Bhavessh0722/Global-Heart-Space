/* =========================================================
   Global Heart Space — Client Logic
   Uses Netlify Function /api/share for posts.
   Falls back to localStorage if the function is unavailable
   (great for local preview or if you skip Netlify Functions).
   ========================================================= */

const STORAGE_KEY = 'ghs_posts_v1';
const REACT_KEY = 'ghs_reacted_v1';
const AGE_KEY = 'ghs_age_ok_v1';
const PAGE_SIZE = 6;

let allPosts = [];
let visibleCount = PAGE_SIZE;
let currentFilter = 'all';
let selectedMood = '';

const MOOD_EMOJI = {
  sad: '😔', angry: '😠', hopeful: '🌱', lost: '🌀', grateful: '🙏', '': '💭'
};

/* ---------- Element refs ---------- */
const ageGate = document.getElementById('ageGate');
const ageYes = document.getElementById('ageYes');
const ageNo = document.getElementById('ageNo');
const ageDenied = document.getElementById('ageDenied');
const app = document.getElementById('app');

const shareForm = document.getElementById('shareForm');
const messageInput = document.getElementById('message');
const charCount = document.getElementById('charCount');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const moodButtons = document.querySelectorAll('.mood');

const wallContainer = document.getElementById('wallContainer');
const filterBar = document.querySelector('.filter-bar');
const loadMoreBtn = document.getElementById('loadMore');
const toast = document.getElementById('toast');

/* ---------- Age Gate ---------- */
function initAgeGate() {
  const ok = localStorage.getItem(AGE_KEY);
  if (ok === 'true') {
    ageGate.hidden = true;
    app.hidden = false;
    return;
  }
  ageGate.hidden = false;
  app.hidden = true;
}

ageYes.addEventListener('click', () => {
  localStorage.setItem(AGE_KEY, 'true');
  ageGate.hidden = true;
  app.hidden = false;
});

ageNo.addEventListener('click', () => {
  ageDenied.hidden = false;
});

/* ---------- Toast ---------- */
let toastTimer;
function showToast(msg, ms = 3000) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), ms);
}

/* ---------- Char counter ---------- */
messageInput.addEventListener('input', () => {
  charCount.textContent = `${messageInput.value.length} / 1500`;
});

/* ---------- Mood picker ---------- */
moodButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const mood = btn.dataset.mood;
    if (selectedMood === mood) {
      selectedMood = '';
      btn.classList.remove('selected');
    } else {
      selectedMood = mood;
      moodButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    }
  });
});

/* ---------- Submit ---------- */
shareForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();

  if (message.length < 20) {
    showToast('Please write at least 20 characters.');
    return;
  }
  if (message.length > 1500) {
    showToast('Please keep it under 1500 characters.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  const payload = { message, mood: selectedMood };

  try {
    // Try Netlify Function first
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      prependPost(data.post);
      resetForm();
      showToast('Thank you for sharing. You are heard. 💗');
    } else {
      throw new Error('Server rejected');
    }
  } catch (err) {
    // Fallback: save locally
    const post = createLocalPost(payload);
    saveLocalPost(post);
    prependPost(post);
    resetForm();
    showToast('Saved locally. You are heard. 💗');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Release & Be Heard';
  }
});

clearBtn.addEventListener('click', resetForm);

function resetForm() {
  messageInput.value = '';
  charCount.textContent = '0 / 1500';
  selectedMood = '';
  moodButtons.forEach(b => b.classList.remove('selected'));
}

/* ---------- Local storage helpers ---------- */
function createLocalPost({ message, mood }) {
  return {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    message,
    mood: mood || '',
    timestamp: new Date().toISOString(),
    hearts: 0,
  };
}

function getLocalPosts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveLocalPost(post) {
  const posts = getLocalPosts();
  posts.unshift(post);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts.slice(0, 200)));
}

function getReactedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(REACT_KEY)) || []); }
  catch { return new Set(); }
}

function setReactedIds(set) {
  localStorage.setItem(REACT_KEY, JSON.stringify([...set]));
}

/* ---------- Load posts ---------- */
async function loadPosts() {
  try {
    const res = await fetch('/api/share');
    if (res.ok) {
      const data = await res.json();
      allPosts = (data.posts || []).concat(getLocalPosts());
    } else {
      throw new Error('no function');
    }
  } catch {
    allPosts = getLocalPosts();
  }

  // Show a gentle welcome post if the wall is empty
  if (!allPosts.length) {
    allPosts = [{
      id: 'seed',
      message:
        "You've found a space that asks nothing of you except honesty. Whatever you're carrying — say it here. No one will know it's you, and no one will judge you. You are not alone.",
      mood: 'hopeful',
      timestamp: new Date().toISOString(),
      hearts: 0,
      seed: true,
    }];
  }

  renderWall();
}

/* ---------- Render ---------- */
function renderWall() {
  const filtered = currentFilter === 'all'
    ? allPosts
    : allPosts.filter(p => p.mood === currentFilter);

  const visible = filtered.slice(0, visibleCount);
  const reacted = getReactedIds();

  if (!visible.length) {
    wallContainer.innerHTML = `<div class="wall-empty">No truths shared in this mood yet. Be the first. 💗</div>`;
    loadMoreBtn.hidden = true;
    return;
  }

  wallContainer.innerHTML = visible.map(post => {
    const emoji = MOOD_EMOJI[post.mood] || '💭';
    const time = formatTime(post.timestamp);
    const isReacted = reacted.has(post.id);
    return `
      <article class="post" data-id="${post.id}">
        <div class="post-meta">
          <span class="post-mood">${emoji}</span>
          <span>${time}</span>
        </div>
        <p class="post-text">${escapeHtml(post.message)}</p>
        <div class="post-actions">
          <button class="react-btn ${isReacted ? 'reacted' : ''}" data-react="${post.id}">
            💗 <span class="heart-count">${post.hearts || 0}</span>
          </button>
        </div>
      </article>
    `;
  }).join('');

  loadMoreBtn.hidden = filtered.length <= visibleCount;
}

function prependPost(post) {
  allPosts.unshift(post);
  visibleCount = Math.max(visibleCount, PAGE_SIZE);
  if (currentFilter !== 'all' && currentFilter !== post.mood) {
    currentFilter = 'all';
    syncFilterButtons();
  }
  renderWall();
  document.getElementById('wall')?.scrollIntoView({ behavior: 'smooth' });
}

/* ---------- Reactions ---------- */
wallContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-react]');
  if (!btn) return;

  const id = btn.dataset.react;
  const reacted = getReactedIds();
  const post = allPosts.find(p => p.id === id);
  if (!post) return;

  if (reacted.has(id)) {
    reacted.delete(id);
    post.hearts = Math.max(0, (post.hearts || 0) - 1);
  } else {
    reacted.add(id);
    post.hearts = (post.hearts || 0) + 1;
  }
  setReactedIds(reacted);

  // Persist to local storage mirror
  if (post.id.startsWith('p_')) {
    const posts = getLocalPosts().map(p => p.id === id ? { ...p, hearts: post.hearts } : p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }

  renderWall();
});

/* ---------- Filters ---------- */
filterBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter');
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  visibleCount = PAGE_SIZE;
  syncFilterButtons();
  renderWall();
});

function syncFilterButtons() {
  document.querySelectorAll('.filter').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === currentFilter);
  });
}

/* ---------- Load more ---------- */
loadMoreBtn.addEventListener('click', () => {
  visibleCount += PAGE_SIZE;
  renderWall();
});

/* ---------- Utils ---------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

/* ---------- Init ---------- */
initAgeGate();
if (!app.hidden) loadPosts();
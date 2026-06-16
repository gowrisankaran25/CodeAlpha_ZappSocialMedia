// ════════════════════════════════════════════════════
//  ZAPP — Enhanced App.js (Instagram-level features)
// ════════════════════════════════════════════════════

// ── State ──
let currentUser = null;
let currentPostId = null;
let feedPage = 1, explorePage = 1;
let feedLoading = false, exploreLoading = false;
let exploreGridMode = false;
let stories = []; // local story state (client-side simulation)
let notifications = []; // local notification state
let conversations = {}; // local DM state
let savedPosts = new Set(JSON.parse(localStorage.getItem('zapp_saved') || '[]'));
let storyTimer = null;
let currentStoryIndex = 0;
let currentStoryUser = null;
let currentChatUser = null;
let selectedStoryBg = 'linear-gradient(135deg,#7c5cfc,#fc5c7d)';
let currentSharePostId = null;
let currentReportPostId = null;

// ── DOM Helpers ──
const $ = id => document.getElementById(id);
const show = id => { const el=$(id); if(el) el.classList.remove('hidden'); };
const hide = id => { const el=$(id); if(el) el.classList.add('hidden'); };
const q = (sel, el=document) => el.querySelector(sel);
const qa = (sel, el=document) => [...el.querySelectorAll(sel)];

// ── Utils ──
function toast(msg, type='') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.add('hidden'), 3000);
}

function timeAgo(date) {
  const d = new Date(date), now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d`;
  return d.toLocaleDateString();
}

function getInitials(name='') {
  return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?';
}

function escHtml(s='') {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function avatarHTML(user, size='post') {
  const cls = {
    sidebar:'sidebar-avatar', compose:'compose-avatar', suggestion:'suggestion-avatar',
    comment:'comment-avatar', profile:'profile-avatar', search:'suggestion-avatar',
    story:'story-viewer-avatar', notif:'notif-avatar', conv:'conv-avatar',
    'follow-list':'follow-list-avatar', chat:'chat-bubble-avatar'
  }[size] || 'post-avatar';
  if (user?.avatar) return `<div class="${cls}"><img src="${escHtml(user.avatar)}" alt="" /></div>`;
  return `<div class="${cls}">${getInitials(user?.displayName || user?.username)}</div>`;
}

function formatContent(text) {
  return escHtml(text)
    .replace(/#(\w+)/g, '<span class="hashtag" data-tag="$1">#$1</span>')
    .replace(/@(\w+)/g, '<span class="mention" data-user="$1">@$1</span>');
}

// ── Persist saved posts ──
function persistSaved() {
  localStorage.setItem('zapp_saved', JSON.stringify([...savedPosts]));
}

// ── Dark / Light Mode ──
function initTheme() {
  const saved = localStorage.getItem('zapp_theme');
  if (saved === 'light') document.body.classList.add('light-mode');
}
initTheme();

// ── Auth UI ──
qa('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    qa('.auth-tab').forEach(t => t.classList.remove('active'));
    qa('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    $(`${tab.dataset.tab}-form`).classList.add('active');
  });
});

// Animated particle/network background on the auth canvas
function initAuthCanvas() {
  const canvas = $('auth-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let raf = null;

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function makeParticles() {
    const count = Math.max(28, Math.floor((canvas.width * canvas.height) / 32000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.6
    }));
  }

  function step() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    }
    ctx.fillStyle = 'rgba(124, 92, 252, 0.55)';
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(124, 92, 252, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.globalAlpha = 1 - dist / 120;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(step);
  }

  resize();
  makeParticles();
  step();

  window.addEventListener('resize', () => {
    resize();
    makeParticles();
  });

  // Pause animation when auth screen isn't visible (saves CPU)
  const observer = new MutationObserver(() => {
    const visible = $('auth-screen').classList.contains('active');
    if (visible && !raf) step();
    if (!visible && raf) { cancelAnimationFrame(raf); raf = null; }
  });
  observer.observe($('auth-screen'), { attributes: true, attributeFilter: ['class'] });
}
initAuthCanvas();

// Rotating feature highlight list on the auth preview panel
function initAuthFeatureCarousel() {
  const items = qa('.pf-item');
  if (!items.length) return;
  let idx = 0;
  setInterval(() => {
    items[idx].classList.remove('pf-active');
    idx = (idx + 1) % items.length;
    items[idx].classList.add('pf-active');
  }, 2200);
}
initAuthFeatureCarousel();

// Password show/hide toggles
qa('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.target);
    if (!input) return;
    const isPw = input.type === 'password';
    input.type = isPw ? 'text' : 'password';
    btn.textContent = isPw ? '🙈' : '👁';
  });
});

// Password strength meter (register form)
function scorePassword(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0-5
}

const regPasswordInput = $('reg-password');
if (regPasswordInput) {
  regPasswordInput.addEventListener('input', () => {
    const pw = regPasswordInput.value;
    const fill = $('pw-strength-fill');
    const label = $('pw-strength-label');
    if (!pw) { fill.style.width = '0%'; label.textContent = ''; return; }
    const score = scorePassword(pw);
    const pct = Math.min(100, (score / 5) * 100);
    fill.style.width = `${pct}%`;
    if (score <= 1) { fill.style.background = 'var(--red)'; label.textContent = 'Weak'; }
    else if (score <= 3) { fill.style.background = '#f59e0b'; label.textContent = 'Okay'; }
    else { fill.style.background = 'var(--green)'; label.textContent = 'Strong'; }
  });
}

function setBtnLoading(btn, loading, idleText) {
  const textEl = q('.btn-text', btn);
  const loaderEl = q('.btn-loader', btn);
  btn.disabled = loading;
  if (textEl && loaderEl) {
    loaderEl.classList.toggle('hidden', !loading);
    if (!loading && idleText) textEl.textContent = idleText;
  } else {
    btn.textContent = loading ? btn.textContent : idleText;
  }
}

// ── Helper: Show User Details on Login Page ──
function showLoginDetails(user, provider = 'Email') {
  // Hide the login/register forms
  document.querySelector('.auth-card').classList.add('hidden');
  
  // Populate and show the details panel
  const detailsDiv = $('login-details-display');
  const infoContainer = $('logged-user-info');
  
  infoContainer.innerHTML = `
    <strong>Provider:</strong> ${provider}<br>
    <strong>Name:</strong> ${user.displayName || user.username || 'N/A'}<br>
    <strong>Username:</strong> @${user.username || 'unknown'}<br>
    <strong>Email:</strong> ${user.email || 'N/A'}
  `;
  
  detailsDiv.classList.remove('hidden');
}

// ── Enable Social Auth (Shadow Registration) ──
['google-auth-btn', 'github-auth-btn'].forEach(id => {
  const btn = $(id);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const provider = id.includes('google') ? 'Google' : 'GitHub';
    
    // UI Loading state
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Connecting...';
    btn.disabled = true;

    try {
      // Generate a random user to act as our "Social" account
      const randId = Math.floor(Math.random() * 10000);
      const username = `${provider.toLowerCase()}_user_${randId}`;
      const email = `${username}@example.com`;
      const password = 'SocialLoginTest123!';

      // Use the REAL backend to register this user invisibly.
      // This ensures we get a real, valid JWT back for comments/likes!
      const { token, user } = await api.register({
        username: username,
        displayName: `${provider} User`,
        email: email,
        password: password
      });
      
      // Store the real token and user data
      api.setToken(token);
      currentUser = user;
      
      // Show the success panel
      showLoginDetails(currentUser, provider);

    } catch (e) {
      toast(`Simulation failed: ${e.message}`, 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
});

// ── Update Standard Email Login ──
$('login-btn').addEventListener('click', async () => {
  const btn = $('login-btn');
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  hide('login-error');
  if (!email || !password) { $('login-error').textContent = 'Please fill all fields'; show('login-error'); return; }
  setBtnLoading(btn, true);
  try {
    const { token, user } = await api.login(email, password);
    api.setToken(token); 
    currentUser = user; 
    
    // Show details instead of initApp()
    showLoginDetails(user, 'Email');
  } catch (e) { 
    $('login-error').textContent = e.message; 
    show('login-error'); 
  } finally { 
    setBtnLoading(btn, false, 'Sign In'); 
  }
});

// ── Update Registration ──
$('register-btn').addEventListener('click', async () => {
  const btn = $('register-btn');
  const username = $('reg-username').value.trim();
  const displayName = $('reg-displayname').value.trim();
  const email = $('reg-email').value.trim();
  const password = $('reg-password').value;
  hide('reg-error');
  if (!username || !email || !password) { $('reg-error').textContent = 'Please fill all required fields'; show('reg-error'); return; }
  setBtnLoading(btn, true);
  try {
    const { token, user } = await api.register({ username, displayName, email, password });
    api.setToken(token); 
    currentUser = user; 
    
    // Show details instead of initApp()
    showLoginDetails(user, 'New Registration');
  } catch (e) { 
    $('reg-error').textContent = e.message; 
    show('reg-error'); 
  } finally { 
    setBtnLoading(btn, false, 'Create Account'); 
  }
});

// ── Proceed to App Button ──
const proceedBtn = $('proceed-to-app-btn');
if (proceedBtn) {
  proceedBtn.addEventListener('click', () => {
    // Hide details panel and restore auth card for the next time they log out
    $('login-details-display').classList.add('hidden');
    document.querySelector('.auth-card').classList.remove('hidden');
    
    // Boot up the main application
    initApp();
  });
}

['login-email','login-password'].forEach(id => {
  $(id).addEventListener('keydown', e => { if(e.key==='Enter') $('login-btn').click(); });
});

// ── App Init ──
async function initApp() {
  $('auth-screen').classList.remove('active');
    $('auth-screen').style.display = 'none';
  $('app-screen').classList.add('active');
  updateSidebarUser();
  setAvatar('compose-avatar', currentUser, 'compose');
  setAvatar('comment-compose-avatar', currentUser, 'comment');
  loadFeed(true);
  loadSuggestions();
  loadTrendingTopics();
  loadStories();
  setupComposer();
  setupEmojiPicker();
  setupExploreToggle();
  simulateNotifications();
}

function updateSidebarUser() {
  $('sidebar-name').textContent = currentUser.displayName || currentUser.username;
  $('sidebar-username').textContent = '@' + currentUser.username;
  setAvatar('sidebar-avatar', currentUser, 'sidebar');
}

function setAvatar(containerId, user, size) {
  const el = $(containerId);
  if (!el) return;
  if (user?.avatar) { el.innerHTML = `<img src="${escHtml(user.avatar)}" alt="" />`; }
  else { el.textContent = getInitials(user?.displayName || user?.username); }
}

// ── Navigation ──
qa('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    qa('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    qa('.view').forEach(v => v.classList.remove('active'));
    $(`${view}-view`).classList.add('active');

    if (view === 'explore' && explorePage === 1) loadExplore(true);
    if (view === 'profile') loadOwnProfile();
    if (view === 'notifications') renderNotifications();
    if (view === 'messages') loadConversations();
    if (view === 'saved') renderSavedPosts();
    if (view === 'reels') loadReels();
  });
});

$('logout-btn').addEventListener('click', () => {
  api.clearToken(); currentUser = null;
  $('app-screen').classList.remove('active');
  $('auth-screen').classList.add('active');
  $('auth-screen').style.display = '';
  $('login-email').value = ''; $('login-password').value = '';
  $('feed-posts').innerHTML = '<div class="loading">Loading your feed...</div>';
  feedPage = 1; explorePage = 1; stories = []; notifications = []; conversations = {};
  qa('.nav-item').forEach((n,i) => n.classList.toggle('active', i===0));
  qa('.view').forEach((v,i) => v.classList.toggle('active', i===0));
});

$('refresh-feed-btn').addEventListener('click', () => loadFeed(true));

// ── Composer ──
function setupComposer() {
  const ta = $('post-content');
  const cc = $('char-count');
  const ring = $('char-ring-fill');
  const CIRC = 94;

  ta.addEventListener('input', () => {
    const used = ta.value.length;
    const left = 500 - used;
    cc.textContent = left;
    cc.classList.toggle('warn', left < 50);
    const pct = used / 500;
    ring.setAttribute('stroke-dasharray', `${pct * CIRC} ${CIRC}`);
    ring.setAttribute('stroke', left < 50 ? '#fc5c7d' : '#7c5cfc');
  });

  // Image file picker
  $('post-image-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      $('compose-preview-img').src = ev.target.result;
      show('compose-image-preview');
    };
    reader.readAsDataURL(file);
  });
  $('remove-img-btn').addEventListener('click', () => {
    hide('compose-image-preview');
    $('compose-preview-img').src = '';
    $('post-image-input').value = '';
  });

  // Poll toggle
  let pollOpen = false;
  $('post-poll-btn').addEventListener('click', () => {
    pollOpen = !pollOpen;
    if (pollOpen) { show('poll-composer'); } else { hide('poll-composer'); }
  });

  // Location (simulated)
  $('post-location-btn').addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => toast('Location attached 📍', 'success'),
        () => toast('Could not get location', 'error')
      );
    }
  });

  // GIF btn (placeholder)
  $('post-gif-btn').addEventListener('click', () => toast('GIF picker coming soon!'));

  // Emoji toggle
  $('post-emoji-btn').addEventListener('click', () => {
    const ep = $('emoji-picker');
    ep.classList.contains('hidden') ? show('emoji-picker') : hide('emoji-picker');
  });

  $('post-btn').addEventListener('click', async () => {
    const content = ta.value.trim();
    const imgSrc = $('compose-preview-img').src;
    const hasPoll = !$('poll-composer').classList.contains('hidden');

    if (!content && !imgSrc) return;

    const postData = { content };

    // Attach image as URL (base64 or pasted URL)
    if (imgSrc && imgSrc !== window.location.href) postData.image = imgSrc;

    // Attach poll
    if (hasPoll) {
      const opt1 = $('poll-opt-1').value.trim();
      const opt2 = $('poll-opt-2').value.trim();
      const opt3 = $('poll-opt-3').value.trim();
      const duration = parseInt($('poll-duration').value);
      if (opt1 && opt2) {
        postData.poll = { options: [opt1, opt2, ...(opt3 ? [opt3] : [])], duration };
      }
    }

    const btn = $('post-btn');
    btn.disabled = true; btn.textContent = 'Posting…';
    try {
      const post = await api.createPost(postData);
      ta.value = ''; cc.textContent = '500';
      ring.setAttribute('stroke-dasharray', `0 ${CIRC}`);
      hide('compose-image-preview'); $('compose-preview-img').src = ''; $('post-image-input').value = '';
      hide('poll-composer'); hide('emoji-picker'); pollOpen = false;
      $('poll-opt-1').value = ''; $('poll-opt-2').value = ''; $('poll-opt-3').value = '';
      prependPost('feed-posts', post);
      toast('Posted! ⚡', 'success');
      addNotificationLocal({ type: 'post', text: `Your post was shared` });
    } catch (e) { toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Post'; }
  });

  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('post-btn').click();
  });
}

// ── Emoji Picker ──
function setupEmojiPicker() {
  const emojis = ['😀','😂','🥰','😍','🤩','😎','🥳','😊','👏','🔥','❤️','💜','✨','🎉','🙌','👀','💡','🚀','🎯','💯','😭','🤔','👋','🫶','💪','🎊','🌟','🤣','😅','🥲'];
  const grid = $('emoji-grid');
  grid.innerHTML = emojis.map(e => `<button class="emoji-btn" data-emoji="${e}">${e}</button>`).join('');
  grid.addEventListener('click', ev => {
    const btn = ev.target.closest('.emoji-btn');
    if (!btn) return;
    const ta = $('post-content');
    ta.value += btn.dataset.emoji;
    ta.dispatchEvent(new Event('input'));
  });
}

// ── Explore Toggle (List/Grid) ──
function setupExploreToggle() {
  $('explore-list-btn').addEventListener('click', () => {
    exploreGridMode = false;
    $('explore-posts').classList.remove('posts-grid');
    $('explore-list-btn').classList.add('active');
    $('explore-grid-btn').classList.remove('active');
  });
  $('explore-grid-btn').addEventListener('click', () => {
    exploreGridMode = true;
    $('explore-posts').classList.add('posts-grid');
    $('explore-list-btn').classList.remove('active');
    $('explore-grid-btn').classList.add('active');
  });
}

// ── Feed ──
async function loadFeed(reset=false) {
  if (reset) { feedPage = 1; $('feed-posts').innerHTML = '<div class="loading">Loading…</div>'; }
  if (feedLoading) return;
  feedLoading = true;
  try {
    const posts = await api.getFeed(feedPage);
    if (reset) $('feed-posts').innerHTML = '';
    if (posts.length === 0 && feedPage === 1) {
      $('feed-posts').innerHTML = `<div class="empty-state"><div class="empty-state-icon">🌊</div><h3>Your feed is empty</h3><p>Follow people to see their posts here</p></div>`;
      return;
    }
    posts.forEach(p => appendPost('feed-posts', p));
    feedPage++;
  } catch (e) {
    if (feedPage === 1) $('feed-posts').innerHTML = '<div class="empty-state"><p>Failed to load feed</p></div>';
  } finally { feedLoading = false; }
}

// ── Explore ──
async function loadExplore(reset=false) {
  if (reset) { explorePage = 1; $('explore-posts').innerHTML = '<div class="loading">Loading…</div>'; }
  if (exploreLoading) return;
  exploreLoading = true;
  try {
    const posts = await api.getExplore(explorePage);
    if (reset) $('explore-posts').innerHTML = '';
    if (exploreGridMode) $('explore-posts').classList.add('posts-grid');
    if (posts.length === 0 && explorePage === 1) {
      $('explore-posts').innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔭</div><h3>Nothing here yet</h3></div>`;
      return;
    }
    posts.forEach(p => appendPost('explore-posts', p));
    explorePage++;
  } catch (e) {
    if (explorePage === 1) $('explore-posts').innerHTML = '<div class="empty-state"><p>Failed to load posts</p></div>';
  } finally { exploreLoading = false; }
}

// ── Infinite scroll ──
window.addEventListener('scroll', () => {
  const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
  if (!nearBottom) return;
  if ($('feed-view').classList.contains('active') && !feedLoading) loadFeed();
  if ($('explore-view').classList.contains('active') && !exploreLoading) loadExplore();
});

// ── Trending Tags ──
function loadTrendingTopics() {
  const tags = ['#zapp','#photography','#vibes','#mood','#tech','#art','#music','#travel','#food','#fitness'];
  // Trending bar (explore header)
  $('trending-bar').innerHTML = tags.map(t => `<div class="trending-tag" data-tag="${t}">${t}</div>`).join('');
  qa('.trending-tag').forEach(el => {
    el.addEventListener('click', () => {
      $('search-input').value = el.dataset.tag;
      doSearch();
    });
  });
  // Sidebar trending topics
  const counts = tags.map(t => ({ tag: t, count: Math.floor(Math.random() * 9000) + 500 }));
  $('trending-topics-list').innerHTML = counts.map(({ tag, count }) => `
    <div class="trending-topic-item" data-tag="${tag}">
      <div class="trending-topic-tag">${tag}</div>
      <div class="trending-topic-count">${count.toLocaleString()} posts</div>
    </div>
  `).join('');
  qa('.trending-topic-item').forEach(el => {
    el.addEventListener('click', () => {
      qa('.nav-item').forEach((n,i) => n.classList.toggle('active', i===1));
      qa('.view').forEach((v,i) => v.classList.toggle('active', i===1));
      $('search-input').value = el.dataset.tag;
      if (explorePage === 1) loadExplore(true); else doSearch();
    });
  });
}

// ── Render Posts ──
function buildPostHTML(post) {
  const isOwn = post.author._id === currentUser._id;
  const authorName = escHtml(post.author.displayName || post.author.username);
  const authorUser = escHtml(post.author.username);
  const likeClass = post.isLiked ? 'liked' : '';
  const likeIcon = post.isLiked ? '❤️' : '🤍';
  const isSaved = savedPosts.has(post._id);
  const verified = post.author.verified ? '<span class="post-verified">✅</span>' : '';

  let mediaHTML = '';
  if (post.image) {
    // Check if it's a video URL
    if (/\.(mp4|webm|ogg)$/i.test(post.image)) {
      mediaHTML = `<video class="post-video" src="${escHtml(post.image)}" controls playsinline muted></video>`;
    } else {
      mediaHTML = `<img class="post-image" src="${escHtml(post.image)}" alt="" loading="lazy" data-post-id="${post._id}" />`;
    }
  }

  let pollHTML = '';
  if (post.poll) {
    const total = post.poll.votes ? post.poll.votes.reduce((a,b) => a+b, 0) : 0;
    const maxVotes = total ? Math.max(...post.poll.votes) : 0;
    pollHTML = `<div class="poll-options">` +
      post.poll.options.map((opt, i) => {
        const votes = post.poll.votes?.[i] || 0;
        const pct = total ? Math.round((votes/total)*100) : 0;
        const isWinner = votes === maxVotes && total > 0;
        return `<div class="poll-bar-wrap ${isWinner?'winner':''}" data-poll-idx="${i}" data-post-id="${post._id}">
          <div class="poll-bar" style="width:${pct}%"></div>
          <span class="poll-bar-label">${escHtml(opt)}</span>
          <span class="poll-bar-pct">${pct}%</span>
        </div>`;
      }).join('') +
      `<div class="poll-meta">${total} vote${total!==1?'s':''} · ${post.poll.duration||3}d left</div>
    </div>`;
  }

  const locationHTML = post.location ? `<div class="post-location">📍 ${escHtml(post.location)}</div>` : '';

  return `
    <div class="post-card" data-post-id="${post._id}">
      <div class="post-header">
        ${avatarHTML(post.author)}
        <div class="post-author">
          <div class="post-display-name" data-username="${authorUser}">${authorName}${verified}</div>
          <div class="post-username-time">@${authorUser} · ${timeAgo(post.createdAt)}</div>
        </div>
        <button class="post-menu-btn" data-post-id="${post._id}" title="More options">•••</button>
      </div>
      ${locationHTML}
      <div class="post-content">${formatContent(post.content)}</div>
      ${mediaHTML}
      ${pollHTML}
      <div class="post-actions">
        <button class="action-btn like-btn ${likeClass}" data-post-id="${post._id}">
          <span class="action-icon">${likeIcon}</span>
          <span class="like-count">${post.likesCount || 0}</span>
        </button>
        <button class="action-btn comment-btn" data-post-id="${post._id}">
          <span class="action-icon">💬</span>
          <span>${post.commentsCount || 0}</span>
        </button>
        <button class="action-btn share-btn" data-post-id="${post._id}">
          <span class="action-icon">↗️</span>
        </button>
        <button class="action-btn save-btn ${isSaved?'saved':''}" data-post-id="${post._id}" title="${isSaved?'Unsave':'Save'}">
          <span class="action-icon">${isSaved?'🔖':'🏷️'}</span>
        </button>
      </div>
      <div class="post-grid-overlay">
        <span>❤️ ${post.likesCount||0}</span>
        <span>💬 ${post.commentsCount||0}</span>
      </div>
    </div>
  `;
}

function appendPost(containerId, post) {
  const el = document.createElement('div');
  el.innerHTML = buildPostHTML(post);
  const card = el.firstElementChild;
  bindPostEvents(card);
  $(containerId).appendChild(card);
}

function prependPost(containerId, post) {
  const container = $(containerId);
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) emptyState.remove();
  const el = document.createElement('div');
  el.innerHTML = buildPostHTML(post);
  const card = el.firstElementChild;
  bindPostEvents(card);
  container.prepend(card);
}

function bindPostEvents(card) {
  const postId = card.dataset.postId;

  // Profile navigation
  qa('.post-display-name', card).forEach(el => el.addEventListener('click', () => loadProfile(el.dataset.username)));
  qa('.post-avatar', card).forEach(el => el.addEventListener('click', () => {
    const dn = q('.post-display-name', card);
    if (dn) loadProfile(dn.dataset.username);
  }));

  // Like
  const likeBtn = q('.like-btn', card);
  if (likeBtn) {
    likeBtn.addEventListener('click', async () => {
      try {
        const { liked, likesCount } = await api.likePost(postId);
        likeBtn.classList.toggle('liked', liked);
        q('.action-icon', likeBtn).textContent = liked ? '❤️' : '🤍';
        q('.like-count', likeBtn).textContent = likesCount;
        if (liked) addNotificationLocal({ type: 'like', text: 'You liked a post' });
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  // Comment
  const commentBtn = q('.comment-btn', card);
  if (commentBtn) commentBtn.addEventListener('click', () => openComments(postId));

  // Image expand to detail modal
  const postImg = q('.post-image', card);
  if (postImg) postImg.addEventListener('click', () => openPostDetail(postId, card));

  // Grid click
  const gridOverlay = q('.post-grid-overlay', card);
  if (gridOverlay) gridOverlay.addEventListener('click', () => openPostDetail(postId, card));

  // Save / Bookmark
  const saveBtn = q('.save-btn', card);
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (savedPosts.has(postId)) {
        savedPosts.delete(postId);
        saveBtn.classList.remove('saved');
        q('.action-icon', saveBtn).textContent = '🏷️';
        toast('Removed from saved');
      } else {
        savedPosts.add(postId);
        saveBtn.classList.add('saved');
        q('.action-icon', saveBtn).textContent = '🔖';
        toast('Post saved 🔖', 'success');
        // Store post HTML for offline saved view
        localStorage.setItem('zapp_saved_post_' + postId, card.outerHTML);
      }
      persistSaved();
    });
  }

  // Share
  const shareBtn = q('.share-btn', card);
  if (shareBtn) shareBtn.addEventListener('click', () => openShareModal(postId));

  // Post menu (three-dot)
  const menuBtn = q('.post-menu-btn', card);
  if (menuBtn) menuBtn.addEventListener('click', e => { e.stopPropagation(); openPostMenu(postId, card, menuBtn); });

  // Hashtag / mention click
  qa('.hashtag', card).forEach(el => el.addEventListener('click', () => {
    $('search-input').value = el.dataset.tag;
    qa('.nav-item').forEach((n,i) => n.classList.toggle('active', i===1));
    qa('.view').forEach((v,i) => v.classList.toggle('active', i===1));
    doSearch();
  }));
  qa('.mention', card).forEach(el => el.addEventListener('click', () => loadProfile(el.dataset.user)));

  // Poll vote
  qa('.poll-bar-wrap', card).forEach(bar => {
    bar.addEventListener('click', () => {
      const allBars = qa('.poll-bar-wrap', card);
      const idx = parseInt(bar.dataset.pollIdx);
      allBars.forEach((b, i) => {
        const pct = i === idx ? 100 : 0;
        q('.poll-bar', b).style.width = pct + '%';
        q('.poll-bar-pct', b).textContent = pct + '%';
      });
      card.querySelector('.poll-meta').textContent = '1 vote · voted';
      toast('Vote recorded!', 'success');
    });
  });
}

// ── Post Menu (three-dot dropdown) ──
function openPostMenu(postId, card, menuBtn) {
  // Remove existing
  const existing = document.querySelector('.post-dropdown');
  if (existing) { existing.remove(); return; }

  const isOwn = card.querySelector('.post-display-name')?.dataset.username === currentUser.username;
  const menu = document.createElement('div');
  menu.className = 'post-dropdown';

  const items = isOwn
    ? [
        { icon: '🗑️', label: 'Delete post', cls: 'danger', action: async () => {
            if (!confirm('Delete this post?')) return;
            try { await api.deletePost(postId); card.remove(); toast('Post deleted'); }
            catch (e) { toast(e.message, 'error'); }
          }},
        { icon: '✏️', label: 'Edit post', action: () => toast('Edit coming soon!') },
        { icon: '📌', label: 'Pin post', action: () => toast('Pinned! 📌', 'success') },
      ]
    : [
        { icon: '🚫', label: 'Report post', cls: 'danger', action: () => openReportModal(postId) },
        { icon: '🔇', label: 'Mute user', action: () => toast('User muted') },
        { icon: '🚷', label: 'Block user', action: () => toast('User blocked') },
        { icon: '🔗', label: 'Copy link', action: () => { navigator.clipboard?.writeText(location.href + '?post=' + postId); toast('Link copied!'); } },
      ];

  menu.innerHTML = items.map((item, i) => `
    <div class="post-dropdown-item ${item.cls||''}" data-idx="${i}">
      <span>${item.icon}</span><span>${item.label}</span>
    </div>
  `).join('');
  card.style.position = 'relative';
  card.appendChild(menu);

  items.forEach((item, i) => {
    menu.querySelector(`[data-idx="${i}"]`).addEventListener('click', () => { menu.remove(); item.action(); });
  });

  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

// ── Comments Modal ──
async function openComments(postId) {
  currentPostId = postId;
  $('comments-modal').classList.remove('hidden');
  $('comments-list').innerHTML = '<div class="loading">Loading comments…</div>';
  $('comment-input').value = '';
  try {
    const comments = await api.getComments(postId);
    renderComments(comments);
  } catch (e) { $('comments-list').innerHTML = '<div class="loading">Failed to load</div>'; }
}

function renderComments(comments) {
  if (comments.length === 0) {
    $('comments-list').innerHTML = '<div class="empty-state" style="padding:30px"><p>No comments yet. Be first!</p></div>';
    return;
  }
  $('comments-list').innerHTML = comments.map(c => buildCommentHTML(c)).join('');
  bindCommentEvents();
}

function buildCommentHTML(c) {
  const isOwn = c.author._id === currentUser._id;
  const name = escHtml(c.author.displayName || c.author.username);
  const likeClass = c.isLiked ? 'liked' : '';
  const likeIcon = c.isLiked ? '❤️' : '🤍';
  return `
    <div class="comment-item" data-comment-id="${c._id}">
      ${avatarHTML(c.author, 'comment')}
      <div class="comment-body">
        <div><span class="comment-author">${name}</span><span class="comment-time">· ${timeAgo(c.createdAt)}</span></div>
        <div class="comment-text">${escHtml(c.content)}</div>
        <div class="comment-actions">
          <button class="comment-like-btn ${likeClass}" data-comment-id="${c._id}">${likeIcon} <span class="comment-like-count">${c.likesCount||0}</span></button>
          ${isOwn ? `<button class="comment-delete-btn" data-comment-id="${c._id}">Delete</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

function bindCommentEvents() {
  qa('.comment-like-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const { liked, likesCount } = await api.likeComment(currentPostId, btn.dataset.commentId);
        btn.classList.toggle('liked', liked);
        btn.innerHTML = `${liked?'❤️':'🤍'} <span class="comment-like-count">${likesCount}</span>`;
      } catch (e) { toast(e.message, 'error'); }
    });
  });
  qa('.comment-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete comment?')) return;
      try {
        await api.deleteComment(currentPostId, btn.dataset.commentId);
        btn.closest('.comment-item').remove();
        if (!$('comments-list').querySelector('.comment-item')) {
          $('comments-list').innerHTML = '<div class="empty-state" style="padding:30px"><p>No comments yet.</p></div>';
        }
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

$('comment-submit').addEventListener('click', submitComment);
$('comment-input').addEventListener('keydown', e => { if(e.key==='Enter') submitComment(); });

async function submitComment(targetPostId, targetListId, targetInput) {
  const pid = targetPostId || currentPostId;
  const listId = targetListId || 'comments-list';
  const input = $(targetInput || 'comment-input');
  const content = input.value.trim();
  if (!content || !pid) return;
  const submitBtn = targetPostId ? $('post-detail-comment-submit') : $('comment-submit');
  if (submitBtn) submitBtn.disabled = true;
  try {
    const comment = await api.addComment(pid, content);
    input.value = '';
    const emptyState = $(listId).querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    const el = document.createElement('div');
    el.innerHTML = buildCommentHTML(comment);
    $(listId).appendChild(el.firstElementChild);
    bindCommentEvents();
    // Update comment count in all matching post cards
    document.querySelectorAll(`[data-post-id="${pid}"] .comment-btn span:not(.action-icon)`).forEach(span => {
      span.textContent = parseInt(span.textContent||'0') + 1;
    });
    addNotificationLocal({ type: 'comment', text: 'You commented on a post' });
  } catch (e) { toast(e.message, 'error'); }
  finally { if (submitBtn) submitBtn.disabled = false; }
}

$('modal-close').addEventListener('click', closeModal);
$('modal-overlay').addEventListener('click', closeModal);
function closeModal() { $('comments-modal').classList.add('hidden'); currentPostId = null; }

// ── Post Detail Modal ──
async function openPostDetail(postId, card) {
  const modal = $('post-detail-modal');
  modal.classList.remove('hidden');

  // Image
  const imgEl = card?.querySelector('.post-image');
  const imgWrap = $('post-detail-img-wrap');
  if (imgEl) {
    imgWrap.innerHTML = `<img src="${imgEl.src}" alt="" />`;
  } else {
    imgWrap.innerHTML = `<div class="post-detail-img-placeholder">📄</div>`;
  }

  // Header & content
  const header = card?.querySelector('.post-header');
  const content = card?.querySelector('.post-content');
  $('post-detail-header').innerHTML = header ? header.outerHTML : '';
  $('post-detail-content-text').innerHTML = content ? content.innerHTML : '';

  // Actions bar
  const actions = card?.querySelector('.post-actions');
  $('post-detail-actions').innerHTML = actions ? actions.outerHTML : '';

  // Comments
  $('post-detail-comments').innerHTML = '<div class="loading-sm">Loading comments…</div>';
  $('post-detail-comment-input').value = '';
  try {
    const comments = await api.getComments(postId);
    if (comments.length === 0) {
      $('post-detail-comments').innerHTML = '<div class="empty-state" style="padding:20px"><p>No comments yet</p></div>';
    } else {
      $('post-detail-comments').innerHTML = comments.map(c => buildCommentHTML(c)).join('');
    }
  } catch { $('post-detail-comments').innerHTML = ''; }

  // Post submit
  $('post-detail-comment-submit').onclick = () => submitComment(postId, 'post-detail-comments', 'post-detail-comment-input');
  $('post-detail-comment-input').onkeydown = e => { if(e.key==='Enter') submitComment(postId, 'post-detail-comments', 'post-detail-comment-input'); };
}

$('post-detail-close').addEventListener('click', () => $('post-detail-modal').classList.add('hidden'));
$('post-detail-overlay').addEventListener('click', () => $('post-detail-modal').classList.add('hidden'));

// ── Share Modal ──
function openShareModal(postId) {
  currentSharePostId = postId;
  const url = `${location.origin}?post=${postId}`;
  $('share-options').innerHTML = `
    <button class="share-opt-btn" id="share-copy"><span class="share-opt-icon">🔗</span> Copy Link</button>
    <button class="share-opt-btn" id="share-twitter"><span class="share-opt-icon">🐦</span> Share on X (Twitter)</button>
    <button class="share-opt-btn" id="share-wa"><span class="share-opt-icon">💬</span> Share via WhatsApp</button>
    <button class="share-opt-btn" id="share-dm"><span class="share-opt-icon">✉️</span> Send as Message</button>
  `;
  $('share-modal').classList.remove('hidden');
  $('share-copy').onclick = () => { navigator.clipboard?.writeText(url); toast('Link copied! 🔗', 'success'); closeShareModal(); };
  $('share-twitter').onclick = () => { window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,'_blank'); closeShareModal(); };
  $('share-wa').onclick = () => { window.open(`https://wa.me/?text=${encodeURIComponent(url)}`,'_blank'); closeShareModal(); };
  $('share-dm').onclick = () => { closeShareModal(); openMessagesWithPost(postId); };
}
function closeShareModal() { $('share-modal').classList.add('hidden'); currentSharePostId = null; }
$('share-modal-close').addEventListener('click', closeShareModal);
$('share-modal-overlay').addEventListener('click', closeShareModal);

// ── Report Modal ──
function openReportModal(postId) {
  currentReportPostId = postId;
  $('report-modal').classList.remove('hidden');
  qa('.report-opt-btn').forEach(btn => {
    btn.onclick = () => {
      toast(`Reported for: ${btn.textContent}`, 'success');
      $('report-modal').classList.add('hidden');
      currentReportPostId = null;
    };
  });
}
$('report-modal-close').addEventListener('click', () => $('report-modal').classList.add('hidden'));
$('report-modal-overlay').addEventListener('click', () => $('report-modal').classList.add('hidden'));

// ── Saved Posts ──
function renderSavedPosts() {
  const container = $('saved-posts');
  if (savedPosts.size === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔖</div><h3>No saved posts yet</h3><p>Tap 🏷️ on any post to save it</p></div>`;
    return;
  }
  container.innerHTML = '';
  savedPosts.forEach(postId => {
    const savedHTML = localStorage.getItem('zapp_saved_post_' + postId);
    if (savedHTML) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = savedHTML;
      const card = wrapper.firstElementChild;
      bindPostEvents(card);
      container.appendChild(card);
    }
  });
  if (container.childElementCount === 0) {
    container.innerHTML = `<div class="empty-state"><p>Saved posts will appear here</p></div>`;
  }
}

// ── Stories ──
function loadStories() {
  // Simulate stories (client-side demo — replace with real API)
  stories = JSON.parse(localStorage.getItem('zapp_stories') || '[]');
  renderStoriesBar();
}

function renderStoriesBar() {
  const list = $('stories-list');
  // Group by user
  const byUser = {};
  stories.forEach(s => {
    if (!byUser[s.userId]) byUser[s.userId] = { user: s.user, stories: [] };
    byUser[s.userId].stories.push(s);
  });
  list.innerHTML = Object.values(byUser).map(({ user, stories: userStories }) => {
    const seen = userStories.every(s => s.seen);
    const initials = getInitials(user.displayName || user.username);
    const avatarInner = user.avatar
      ? `<img src="${escHtml(user.avatar)}" alt="" />`
      : initials;
    return `
      <div class="story-item" data-user-id="${user._id}">
        <div class="story-avatar-ring ${seen?'seen':''}">
          <div class="story-avatar-inner">${avatarInner}</div>
        </div>
        <div class="story-label">${escHtml(user.displayName || user.username)}</div>
      </div>
    `;
  }).join('');

  qa('.story-item').forEach(el => {
    el.addEventListener('click', () => openStoryViewer(el.dataset.userId));
  });
}

// Story add
const storyAddBtn = $('story-add-btn');
if (storyAddBtn) {
  storyAddBtn.addEventListener('click', openStoryCreator);
  setAvatar('story-add-avatar', { displayName: '+' }, 'sidebar');
}

function openStoryCreator() {
  $('story-creator-modal').classList.remove('hidden');
}
$('story-creator-close').addEventListener('click', () => $('story-creator-modal').classList.add('hidden'));

// Story type tabs
qa('.story-type-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    qa('.story-type-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const type = tab.dataset.type;
    if (type === 'text') { show('story-text-input-wrap'); hide('story-image-input-wrap'); }
    else { hide('story-text-input-wrap'); show('story-image-input-wrap'); }
  });
});

// Story background picker
qa('.story-bg-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    qa('.story-bg-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedStoryBg = btn.dataset.bg;
  });
});

$('post-story-btn').addEventListener('click', () => {
  const activeType = q('.story-type-tab.active')?.dataset.type;
  let storyData;
  if (activeType === 'text') {
    const text = $('story-text-input').value.trim();
    if (!text) { toast('Enter some text for your story', 'error'); return; }
    storyData = { type: 'text', content: text, bg: selectedStoryBg };
  } else {
    const url = $('story-image-url').value.trim();
    if (!url) { toast('Enter an image URL', 'error'); return; }
    storyData = { type: 'image', content: url };
  }
  const story = {
    id: Date.now().toString(),
    userId: currentUser._id,
    user: currentUser,
    ...storyData,
    createdAt: new Date().toISOString(),
    seen: false,
  };
  stories.unshift(story);
  localStorage.setItem('zapp_stories', JSON.stringify(stories));
  renderStoriesBar();
  $('story-creator-modal').classList.add('hidden');
  $('story-text-input').value = '';
  $('story-image-url').value = '';
  toast('Story posted! ✨', 'success');
});

// Story Viewer
function openStoryViewer(userId) {
  const userStories = stories.filter(s => s.userId === userId);
  if (!userStories.length) return;
  currentStoryUser = userId;
  currentStoryIndex = 0;
  $('story-modal').classList.remove('hidden');
  showStory(userStories, 0);
}

function showStory(userStories, idx) {
  clearTimeout(storyTimer);
  const story = userStories[idx];
  if (!story) { closeStoryViewer(); return; }

  // Mark seen
  story.seen = true;
  localStorage.setItem('zapp_stories', JSON.stringify(stories));
  renderStoriesBar();

  // Progress bars
  const bars = $('story-progress-bars');
  bars.innerHTML = userStories.map((_, i) => `
    <div class="story-progress-segment">
      <div class="story-progress-fill" id="spf-${i}" style="width:${i<idx?'100%':'0%'}"></div>
    </div>
  `).join('');

  // Fill current bar
  const fill = $(`spf-${idx}`);
  if (fill) {
    fill.style.transition = 'width 5s linear';
    requestAnimationFrame(() => { fill.style.width = '100%'; });
  }

  // User info
  setAvatar('story-viewer-avatar', story.user, 'story');
  $('story-viewer-name').textContent = story.user.displayName || story.user.username;
  $('story-viewer-time').textContent = timeAgo(story.createdAt);

  // Content
  const area = $('story-content-area');
  if (story.type === 'image') {
    area.innerHTML = `<img class="story-image-content" src="${escHtml(story.content)}" alt="" />`;
  } else {
    area.innerHTML = `<div class="story-text-content" style="background:${story.bg||'linear-gradient(135deg,#7c5cfc,#fc5c7d)'}">${escHtml(story.content)}</div>`;
  }

  // Nav visibility
  $('story-prev-btn').style.display = idx === 0 ? 'none' : '';
  $('story-next-btn').style.display = idx === userStories.length - 1 ? 'none' : '';

  // Auto-advance
  storyTimer = setTimeout(() => {
    if (idx + 1 < userStories.length) showStory(userStories, idx + 1);
    else closeStoryViewer();
  }, 5000);

  currentStoryIndex = idx;
}

$('story-prev-btn').addEventListener('click', () => {
  const userStories = stories.filter(s => s.userId === currentStoryUser);
  if (currentStoryIndex > 0) showStory(userStories, currentStoryIndex - 1);
});
$('story-next-btn').addEventListener('click', () => {
  const userStories = stories.filter(s => s.userId === currentStoryUser);
  if (currentStoryIndex < userStories.length - 1) showStory(userStories, currentStoryIndex + 1);
  else closeStoryViewer();
});
$('story-close-btn').addEventListener('click', closeStoryViewer);
$('story-modal-overlay').addEventListener('click', closeStoryViewer);
function closeStoryViewer() {
  clearTimeout(storyTimer);
  $('story-modal').classList.add('hidden');
  currentStoryUser = null; currentStoryIndex = 0;
}

// ── Notifications (local simulation) ──
function addNotificationLocal({ type, text, icon }) {
  const icons = { like:'❤️', comment:'💬', follow:'👤', post:'⚡', mention:'@' };
  notifications.unshift({
    id: Date.now(),
    type,
    text,
    icon: icon || icons[type] || '🔔',
    time: new Date().toISOString(),
    read: false,
  });
  updateNotifBadge();
}

function updateNotifBadge() {
  const unread = notifications.filter(n => !n.read).length;
  const badge = $('notif-badge');
  if (unread > 0) { badge.textContent = unread > 9 ? '9+' : unread; show('notif-badge'); }
  else { hide('notif-badge'); }
}

function renderNotifications() {
  notifications.forEach(n => n.read = true);
  updateNotifBadge();
  const list = $('notifications-list');
  if (notifications.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔔</div><h3>No notifications yet</h3><p>Likes, follows and comments will appear here</p></div>`;
    return;
  }
  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.read?'':'unread'}">
      <span class="notif-icon">${n.icon}</span>
      <div class="notif-body">
        <div class="notif-text">${escHtml(n.text)}</div>
        <div class="notif-time">${timeAgo(n.time)}</div>
      </div>
    </div>
  `).join('');
}

$('mark-all-read-btn').addEventListener('click', () => {
  notifications.forEach(n => n.read = true);
  updateNotifBadge();
  renderNotifications();
});

function simulateNotifications() {
  // Add some demo notifications so the tab isn't empty
  const demos = [
    { type: 'like', text: '🔥 Someone liked your post', icon: '❤️' },
    { type: 'follow', text: '👋 A new user started following you', icon: '👤' },
    { type: 'comment', text: '💬 Someone commented on your post', icon: '💬' },
  ];
  demos.forEach(n => addNotificationLocal(n));
}

// ── Messages (local simulation) ──
function loadConversations() {
  const container = $('conversations-list');
  const convList = Object.values(conversations);
  if (convList.length === 0) {
    container.innerHTML = `<div class="loading-sm">No conversations yet.<br>Start by clicking ✏️ New</div>`;
    return;
  }
  container.innerHTML = convList.map(c => {
    const lastMsg = c.messages[c.messages.length - 1];
    return `
      <div class="conv-item" data-user-id="${c.user._id}">
        ${avatarHTML(c.user, 'conv')}
        <div class="conv-info">
          <div class="conv-name">${escHtml(c.user.displayName || c.user.username)}</div>
          <div class="conv-preview">${lastMsg ? escHtml(lastMsg.text) : 'Say hi!'}</div>
        </div>
        <div class="conv-time">${lastMsg ? timeAgo(lastMsg.time) : ''}</div>
        ${c.unread ? '<div class="conv-unread-dot"></div>' : ''}
      </div>
    `;
  }).join('');
  qa('.conv-item').forEach(el => {
    el.addEventListener('click', () => {
      const userId = el.dataset.userId;
      const conv = conversations[userId];
      if (conv) openChat(conv.user);
      qa('.conv-item').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
    });
  });
}

function openChat(user) {
  currentChatUser = user;
  const panel = $('chat-panel');
  if (!conversations[user._id]) {
    conversations[user._id] = { user, messages: [], unread: false };
  }
  const conv = conversations[user._id];
  conv.unread = false;

  panel.innerHTML = `
    <div class="chat-header">
      ${avatarHTML(user, 'conv')}
      <div>
        <div class="chat-header-name">${escHtml(user.displayName || user.username)}</div>
        <div class="chat-header-status">Active now</div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages">
      ${conv.messages.length === 0 ? '<div class="loading-sm">Send a message to start chatting!</div>' : conv.messages.map(m => buildBubble(m)).join('')}
    </div>
    <div class="chat-compose">
      <span class="chat-compose-emoji" id="chat-emoji-btn">😊</span>
      <input type="text" id="chat-input" placeholder="Message ${escHtml(user.displayName || user.username)}…" />
      <button class="btn btn-primary btn-sm" id="chat-send-btn">Send</button>
    </div>
  `;

  $('chat-send-btn').addEventListener('click', sendChatMessage);
  $('chat-input').addEventListener('keydown', e => { if(e.key==='Enter') sendChatMessage(); });
  $('chat-emoji-btn').addEventListener('click', () => {
    const quickEmojis = ['😀','❤️','🔥','👋','😂','🙌','💯','🎉'];
    const input = $('chat-input');
    const picker = document.createElement('div');
    picker.style.cssText = 'position:absolute;bottom:70px;left:20px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:8px;display:flex;gap:6px;z-index:50';
    picker.innerHTML = quickEmojis.map(e => `<span style="font-size:20px;cursor:pointer">${e}</span>`).join('');
    picker.querySelectorAll('span').forEach(s => s.addEventListener('click', () => { input.value += s.textContent; picker.remove(); }));
    $('chat-panel').style.position = 'relative';
    $('chat-panel').appendChild(picker);
    setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 50);
  });
  scrollChatToBottom();
}

function buildBubble(msg) {
  const isOwn = msg.senderId === currentUser._id;
  const userObj = isOwn ? currentUser : (currentChatUser || {});
  return `
    <div class="chat-bubble-wrap ${isOwn?'own':''}">
      ${!isOwn ? avatarHTML(userObj, 'chat') : ''}
      <div>
        <div class="chat-bubble">${escHtml(msg.text)}</div>
        <div class="chat-bubble-time">${timeAgo(msg.time)}</div>
      </div>
    </div>
  `;
}

function sendChatMessage() {
  const input = $('chat-input');
  const text = input?.value.trim();
  if (!text || !currentChatUser) return;
  input.value = '';
  const msg = { senderId: currentUser._id, text, time: new Date().toISOString() };
  conversations[currentChatUser._id].messages.push(msg);

  const messagesEl = $('chat-messages');
  if (messagesEl) {
    const el = document.createElement('div');
    el.innerHTML = buildBubble(msg);
    const placeholder = messagesEl.querySelector('.loading-sm');
    if (placeholder) placeholder.remove();
    messagesEl.appendChild(el.firstElementChild);
    scrollChatToBottom();
  }
  loadConversations();

  // Simulate reply after 1.5s
  setTimeout(() => {
    const replies = ['Nice! 😊', 'Thanks!', '🔥🔥', 'Got it!', 'lol 😂', 'For sure!', '👍'];
    const reply = { senderId: currentChatUser._id, text: replies[Math.floor(Math.random()*replies.length)], time: new Date().toISOString() };
    conversations[currentChatUser._id].messages.push(reply);
    const el2 = document.createElement('div');
    el2.innerHTML = buildBubble(reply);
    const mEl = $('chat-messages');
    if (mEl) { mEl.appendChild(el2.firstElementChild); scrollChatToBottom(); }
    conversations[currentChatUser._id].unread = true;
    loadConversations();
    addNotificationLocal({ type: 'comment', text: `${currentChatUser.displayName || currentChatUser.username} replied to you`, icon: '✉️' });
  }, 1500);
}

function scrollChatToBottom() {
  const el = $('chat-messages');
  if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
}

$('new-msg-btn').addEventListener('click', async () => {
  try {
    const users = await api.getSuggestions();
    if (!users.length) { toast('No users to message yet'); return; }
    const user = users[0];
    if (!conversations[user._id]) conversations[user._id] = { user, messages: [], unread: false };
    loadConversations();
    openChat(user);
  } catch { toast('Could not load users', 'error'); }
});

$('conv-search').addEventListener('input', e => {
  const q2 = e.target.value.toLowerCase();
  qa('.conv-item').forEach(el => {
    const name = el.querySelector('.conv-name')?.textContent.toLowerCase() || '';
    el.style.display = name.includes(q2) ? '' : 'none';
  });
});

function openMessagesWithPost(postId) {
  qa('.nav-item').forEach((n,i) => n.classList.toggle('active', n.dataset.view === 'messages'));
  qa('.view').forEach(v => v.classList.toggle('active', v.id === 'messages-view'));
  loadConversations();
  toast('Select a conversation to share the post', 'success');
}

// ── Reels (video posts) ──
async function loadReels() {
  const container = $('reels-container');
  container.innerHTML = '<div class="loading">Looking for videos…</div>';
  try {
    const posts = await api.getExplore(1);
    const videoPosts = posts.filter(p => p.image && /\.(mp4|webm|ogg)$/i.test(p.image));
    if (videoPosts.length === 0) {
      container.innerHTML = `<div class="reels-empty"><div style="font-size:48px">🎬</div><h3>No video reels yet</h3><p>Share posts with <code>.mp4</code> video URLs to see them here</p></div>`;
      return;
    }
    container.innerHTML = videoPosts.map(p => `
      <div class="reel-card">
        <video src="${escHtml(p.image)}" controls playsinline style="width:100%;max-height:500px"></video>
        <div class="reel-info">
          <div class="reel-author">${escHtml(p.author.displayName || p.author.username)}</div>
          <div class="reel-caption">${escHtml(p.content)}</div>
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = `<div class="reels-empty"><div style="font-size:48px">🎬</div><h3>No video reels yet</h3></div>`;
  }
}

// ── Profile ──
async function loadProfile(username) {
  qa('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === 'profile'));
  qa('.view').forEach(v => v.classList.toggle('active', v.id === 'profile-view'));
  $('profile-content').innerHTML = '<div class="loading">Loading profile…</div>';
  try {
    const [user, posts] = await Promise.all([api.getProfile(username), api.getUserPosts(username)]);
    renderProfile(user, posts);
  } catch (e) {
    $('profile-content').innerHTML = `<div class="empty-state"><p>${e.message}</p></div>`;
  }
}

function renderProfile(user, posts) {
  const isOwn = user._id === currentUser._id;
  const name = escHtml(user.displayName || user.username);
  const username = escHtml(user.username);
  const verified = user.verified ? '✅' : '';

  const actionButtons = isOwn
    ? `<button class="btn btn-outline btn-sm" id="edit-profile-btn">Edit Profile</button>
       <button class="btn btn-ghost btn-sm" id="theme-toggle-btn">${document.body.classList.contains('light-mode')?'🌙':'☀️'}</button>`
    : (user.isFollowing
        ? `<button class="btn btn-ghost btn-sm" id="follow-btn" data-user-id="${user._id}" data-following="true">Following ✓</button>
           <button class="btn btn-outline btn-sm" id="message-user-btn" data-user="${user._id}">Message</button>`
        : `<button class="btn btn-primary btn-sm" id="follow-btn" data-user-id="${user._id}" data-following="false">Follow</button>
           <button class="btn btn-outline btn-sm" id="message-user-btn" data-user="${user._id}">Message</button>`);

  const avatarEl = user.avatar
    ? `<div class="profile-avatar"><img src="${escHtml(user.avatar)}" alt="" />${isOwn?'<div class="profile-avatar-edit">📷</div>':''}</div>`
    : `<div class="profile-avatar">${getInitials(name)}${isOwn?'<div class="profile-avatar-edit">📷</div>':''}</div>`;

  $('profile-content').innerHTML = `
    <div class="profile-header">
      <div class="profile-cover">
        ${user.coverImage ? `<img src="${escHtml(user.coverImage)}" alt="" />` : ''}
        ${isOwn ? '<div class="profile-cover-edit">📷 Change Cover</div>' : ''}
      </div>
      <div class="profile-info">
        ${avatarEl}
        <div class="profile-actions">${actionButtons}</div>
        <div class="profile-name">${name} <span style="font-size:16px">${verified}</span></div>
        <div class="profile-handle">@${username}</div>
        ${user.bio ? `<div class="profile-bio">${escHtml(user.bio)}</div>` : ''}
        ${user.website ? `<div class="profile-links"><a class="profile-link" href="${escHtml(user.website)}" target="_blank" rel="noopener">🔗 ${escHtml(user.website)}</a></div>` : ''}
        <div class="profile-stats">
          <div class="stat"><div class="stat-value">${user.postsCount||0}</div><div class="stat-label">Posts</div></div>
          <div class="stat" id="followers-stat" style="cursor:pointer"><div class="stat-value">${user.followers?.length||0}</div><div class="stat-label">Followers</div></div>
          <div class="stat" id="following-stat" style="cursor:pointer"><div class="stat-value">${user.following?.length||0}</div><div class="stat-label">Following</div></div>
        </div>
      </div>
    </div>
    <div class="profile-posts-header">
      <div class="profile-tab active" data-tab="posts">📷 Posts</div>
      <div class="profile-tab" data-tab="liked">❤️ Liked</div>
      ${isOwn ? '<div class="profile-tab" data-tab="saved">🔖 Saved</div>' : ''}
    </div>
    <div id="profile-posts" class="posts-list"></div>
  `;

  // Render posts
  if (posts.length === 0) {
    $('profile-posts').innerHTML = `<div class="empty-state"><div class="empty-state-icon">✍️</div><h3>No posts yet</h3></div>`;
  } else {
    posts.forEach(p => appendPost('profile-posts', p));
  }

  // Profile tabs
  qa('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      qa('.profile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const t = tab.dataset.tab;
      if (t === 'posts') { $('profile-posts').innerHTML = ''; posts.forEach(p => appendPost('profile-posts', p)); }
      else if (t === 'liked') { $('profile-posts').innerHTML = '<div class="empty-state"><p>Liked posts feature coming soon</p></div>'; }
      else if (t === 'saved') { $('profile-posts').innerHTML = ''; renderSavedPosts(); }
    });
  });

  // Followers / Following click
  $('followers-stat')?.addEventListener('click', () => openFollowList(user._id, 'followers'));
  $('following-stat')?.addEventListener('click', () => openFollowList(user._id, 'following'));

  // Follow / unfollow
  const followBtn = $('follow-btn');
  if (followBtn) {
    followBtn.addEventListener('click', async () => {
      const userId = followBtn.dataset.userId;
      const isFollowing = followBtn.dataset.following === 'true';
      try {
        if (isFollowing) {
          await api.unfollowUser(userId);
          followBtn.textContent = 'Follow';
          followBtn.className = 'btn btn-primary btn-sm';
          followBtn.dataset.following = 'false';
          const fv = $('followers-stat')?.querySelector('.stat-value');
          if (fv) fv.textContent = Math.max(0, parseInt(fv.textContent)-1);
        } else {
          await api.followUser(userId);
          followBtn.textContent = 'Following ✓';
          followBtn.className = 'btn btn-ghost btn-sm';
          followBtn.dataset.following = 'true';
          const fv = $('followers-stat')?.querySelector('.stat-value');
          if (fv) fv.textContent = parseInt(fv.textContent)+1;
          addNotificationLocal({ type: 'follow', text: `You followed @${user.username}`, icon: '👤' });
        }
        loadSuggestions();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  // Message user
  $('message-user-btn')?.addEventListener('click', () => {
    conversations[user._id] = conversations[user._id] || { user, messages: [], unread: false };
    qa('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === 'messages'));
    qa('.view').forEach(v => v.classList.toggle('active', v.id === 'messages-view'));
    loadConversations();
    openChat(user);
  });

  // Edit profile
  $('edit-profile-btn')?.addEventListener('click', () => showEditProfile(user));

  // Theme toggle
  $('theme-toggle-btn')?.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('zapp_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    $('theme-toggle-btn').textContent = document.body.classList.contains('light-mode') ? '🌙' : '☀️';
  });

  // Profile avatar click (edit own)
  if (isOwn) {
    q('.profile-avatar')?.addEventListener('click', () => showEditProfile(user));
    q('.profile-cover')?.addEventListener('click', () => showEditProfile(user));
  }
}

// ── Followers / Following List Modal ──
async function openFollowList(userId, type) {
  $('follow-list-title').textContent = type === 'followers' ? 'Followers' : 'Following';
  $('follow-list-modal').classList.remove('hidden');
  $('follow-list-content').innerHTML = '<div class="loading">Loading…</div>';
  try {
    const users = type === 'followers' ? await api.getFollowers(userId) : await api.getFollowing(userId);
    if (!users.length) { $('follow-list-content').innerHTML = '<div class="empty-state" style="padding:20px"><p>No one yet</p></div>'; return; }
    $('follow-list-content').innerHTML = users.map(u => `
      <div class="follow-list-item" data-username="${escHtml(u.username)}">
        ${avatarHTML(u, 'follow-list')}
        <div>
          <div class="follow-list-name">${escHtml(u.displayName || u.username)}</div>
          <div class="follow-list-username">@${escHtml(u.username)}</div>
        </div>
      </div>
    `).join('');
    qa('.follow-list-item').forEach(el => {
      el.addEventListener('click', () => {
        $('follow-list-modal').classList.add('hidden');
        loadProfile(el.dataset.username);
      });
    });
  } catch { $('follow-list-content').innerHTML = '<div class="empty-state" style="padding:20px"><p>Failed to load</p></div>'; }
}
$('follow-list-close').addEventListener('click', () => $('follow-list-modal').classList.add('hidden'));
$('follow-list-overlay').addEventListener('click', () => $('follow-list-modal').classList.add('hidden'));

async function loadOwnProfile() { loadProfile(currentUser.username); }

// ── Edit Profile ──
function showEditProfile(user) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-box" style="max-width:480px">
      <div class="modal-header">
        <h3>Edit Profile</h3>
        <button class="modal-close" id="ep-close">✕</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;max-height:70vh">
        <div class="form-group"><label>Display Name</label><input type="text" id="ep-name" value="${escHtml(user.displayName||'')}" /></div>
        <div class="form-group"><label>Bio</label><textarea id="ep-bio" placeholder="Tell us about yourself…" style="width:100%;height:80px;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-family:var(--font-body);font-size:14px;resize:none;outline:none">${escHtml(user.bio||'')}</textarea></div>
        <div class="form-group"><label>Avatar URL</label><input type="text" id="ep-avatar" value="${escHtml(user.avatar||'')}" placeholder="https://…" /></div>
        <div class="form-group"><label>Cover Image URL</label><input type="text" id="ep-cover" value="${escHtml(user.coverImage||'')}" placeholder="https://…" /></div>
        <div class="form-group"><label>Website</label><input type="text" id="ep-website" value="${escHtml(user.website||'')}" placeholder="https://yoursite.com" /></div>
        <div class="form-group"><label>Email (read-only)</label><input type="text" value="${escHtml(user.email||'')}" disabled style="opacity:0.5" /></div>
        <div id="ep-error" class="form-error hidden"></div>
        <button class="btn btn-primary" id="ep-save">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
  modal.querySelector('#ep-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#ep-save').addEventListener('click', async () => {
    const displayName = modal.querySelector('#ep-name').value.trim();
    const bio = modal.querySelector('#ep-bio').value.trim();
    const avatar = modal.querySelector('#ep-avatar').value.trim();
    const coverImage = modal.querySelector('#ep-cover').value.trim();
    const website = modal.querySelector('#ep-website').value.trim();
    try {
      const updated = await api.updateProfile({ displayName, bio, avatar, coverImage, website });
      currentUser = { ...currentUser, ...updated };
      updateSidebarUser();
      setAvatar('compose-avatar', currentUser, 'compose');
      modal.remove();
      loadOwnProfile();
      toast('Profile updated! ✨', 'success');
    } catch (e) {
      modal.querySelector('#ep-error').textContent = e.message;
      show('ep-error');
    }
  });
}

// ── Search ──
$('search-btn').addEventListener('click', doSearch);
$('search-input').addEventListener('keydown', e => { if(e.key==='Enter') doSearch(); });

async function doSearch() {
  const q2 = $('search-input').value.trim();
  if (!q2) { hide('search-results'); return; }
  try {
    const users = await api.searchUsers(q2);
    const el = $('search-results');
    el.classList.remove('hidden');
    if (users.length === 0) { el.innerHTML = '<div class="loading-sm">No users found</div>'; return; }
    el.innerHTML = users.map(u => `
      <div class="search-result-item" data-username="${escHtml(u.username)}">
        ${avatarHTML(u, 'search')}
        <div>
          <div class="search-result-name">${escHtml(u.displayName||u.username)}</div>
          <div class="search-result-username">@${escHtml(u.username)}</div>
        </div>
      </div>
    `).join('');
    qa('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        loadProfile(item.dataset.username);
        $('search-results').classList.add('hidden');
        $('search-input').value = '';
      });
    });
  } catch (e) { toast(e.message, 'error'); }
}

// ── Suggestions ──
async function loadSuggestions() {
  try {
    const users = await api.getSuggestions();
    const el = $('suggestions-list');
    if (users.length === 0) { el.innerHTML = '<div class="loading-sm">No suggestions</div>'; return; }
    el.innerHTML = users.map(u => `
      <div class="suggestion-item">
        ${avatarHTML(u, 'suggestion')}
        <div class="suggestion-info">
          <div class="suggestion-name" data-username="${escHtml(u.username)}">${escHtml(u.displayName||u.username)}</div>
          <div class="suggestion-username">@${escHtml(u.username)}</div>
        </div>
        <button class="btn btn-outline btn-sm sug-follow-btn" data-user-id="${u._id}">Follow</button>
      </div>
    `).join('');
    qa('.suggestion-name').forEach(el2 => el2.addEventListener('click', () => loadProfile(el2.dataset.username)));
    qa('.sug-follow-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.followUser(btn.dataset.userId);
          btn.textContent = '✓'; btn.disabled = true; btn.className = 'btn btn-ghost btn-sm';
          loadFeed(true);
          addNotificationLocal({ type: 'follow', text: 'You followed a new user', icon: '👤' });
        } catch (e) { toast(e.message, 'error'); }
      });
    });
  } catch { /* silently fail */ }
}

// ── Auto Login ──
(async () => {
  const token = api.getToken();
  if (!token) return;
  try {
    currentUser = await api.getMe();
    initApp();
  } catch {
    api.clearToken();
  }
})();
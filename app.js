/* ═══════════════════════════════════════════════════════════════
   TIP Student Marketplace — app.js
   Fully migrated to Supabase
   ═══════════════════════════════════════════════════════════════ */

import { supabase } from './supabaseClient.js';

'use strict';

/* ════════════════════════════════════════════════════════════════
   1. CONSTANTS
   ════════════════════════════════════════════════════════════════ */

const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };

/* ── Bot Response Map ─────────────────────────────────────────── */
const BOT_RESPONSES = {
  'Maria Santos': [
    'Hi! Yes, I can meet you at the TIP Canteen at 3 PM today. 😊',
    'Sure! The item is still available. Can we meet tomorrow after class?',
    'Of course! I\'ll bring it to the Library lobby at 1 PM. Is that okay?',
    'Great! It\'s in perfect condition. Let\'s meet at the Engineering building entrance.',
  ],
  'Juan Dela Cruz': [
    'Hey! Yeah it\'s still available. I\'m usually near the CS lab after 2 PM.',
    'Sure! We can meet at the TIP parking area. I\'m free on Friday afternoon.',
    'Hi! I can drop the price a little if you\'re buying today. 😄',
    'Yes! Come find me at Room 404 after my last class around 5 PM.',
  ],
  'Ana Reyes': [
    'Hello! Yes it\'s still for sale. Can we meet at the TIP Oval?',
    'Hi! I\'m available on weekdays after 3 PM near the Admin building.',
    'Sure thing! The condition is exactly as described, almost brand new!',
    'Of course! You can inspect it first before paying. See you at the canteen!',
  ],
  default: [
    'Hi there! Yes, the item is still available. 😊',
    'Thanks for your interest! I\'m free on campus most weekdays.',
    'Sure! We can meet at the TIP Canteen. What time works for you?',
    'Hello! Let me know a convenient time and place to meet on campus.',
  ],
};

/* ════════════════════════════════════════════════════════════════
   2. SESSION (localStorage for session only — Supabase for all data)
   ════════════════════════════════════════════════════════════════ */

function getSession() { return JSON.parse(localStorage.getItem('tip_session') || 'null'); }
function saveSession(data) { localStorage.setItem('tip_session', JSON.stringify(data)); }
function getWishlist() { return JSON.parse(localStorage.getItem('tip_wishlist') || '[]'); }
function saveWishlist(data) { localStorage.setItem('tip_wishlist', JSON.stringify(data)); }

/* ════════════════════════════════════════════════════════════════
   3. STATE
   ════════════════════════════════════════════════════════════════ */

let currentPage = 'home';
let activeCategory = 'All';
let activeSort = 'newest';
let searchQuery = '';
let activeChatId = null;
let activeChatName = null;
let isAdmin = false;
let botTypingTimer = null;
let allProducts = []; // in-memory cache

/* ════════════════════════════════════════════════════════════════
   4. HELPERS
   ════════════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const fmt = n => '₱' + parseFloat(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const timeAgo = iso => {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function showToast(msg, type = 'info', duration = 3000) {
  const icons = { info: '✦', success: '✓', error: '✕' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${esc(msg)}</span>`;
  $('toast-container').appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 350); }, duration);
}

function updateCharCount(countId, textarea, max) {
  const el = $(countId);
  if (el) el.textContent = `${textarea.value.length} / ${max}`;
}
window.updateCharCount = updateCharCount;

function categoryEmoji(cat) {
  const map = { Books: '📚', Electronics: '💻', Notes: '📝', Supplies: '🖊', Clothing: '👕', Other: '📦' };
  return map[cat] || '📦';
}

/* ════════════════════════════════════════════════════════════════
   5. AUTH
   ════════════════════════════════════════════════════════════════ */

function isLoggedIn() { return !!getSession() || isAdmin; }

function loginAsAdmin() {
  isAdmin = true;
  saveSession({ id: '__admin__', name: 'Administrator', email: 'admin', isAdmin: true, avatar: 'A' });
  closeModal('auth-modal');
  updateAuthUI();
  navigateTo('admin');
  showToast('Welcome, Administrator!', 'success');
}

async function login(emailOrUser, password) {
  if (emailOrUser.trim().toLowerCase() === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    loginAsAdmin();
    return;
  }
  // Look up user in Supabase
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', emailOrUser.trim().toLowerCase())
    .limit(1);

  if (error || !users || users.length === 0) {
    showToast('Invalid email or password.', 'error');
    return;
  }

  const user = users[0];
  // Compare password (stored as btoa)
  if (user.password_hash !== btoa(password)) {
    showToast('Invalid email or password.', 'error');
    return;
  }

  isAdmin = false;
  const sessionUser = {
    id: user.user_id,
    name: user.full_name,
    email: user.email,
    course: user.course || '',
    bio: user.bio || '',
    avatar: user.full_name.charAt(0).toUpperCase(),
  };
  saveSession(sessionUser);
  closeModal('auth-modal');
  updateAuthUI();
  navigateTo('home');
  showToast(`Welcome back, ${user.full_name.split(' ')[0]}! 👋`, 'success');
}

async function register(name, email, password, course) {
  if (password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }

  // Check if email already exists
  const { data: existing } = await supabase
    .from('users')
    .select('user_id')
    .eq('email', email.trim().toLowerCase())
    .limit(1);

  if (existing && existing.length > 0) {
    showToast('Email already registered.', 'error');
    return;
  }

  const newUser = {
    full_name: name,
    email: email.trim().toLowerCase(),
    password_hash: btoa(password),
    course: course || '',
    bio: '',
  };

  const { data, error } = await supabase
    .from('users')
    .insert([newUser])
    .select()
    .single();

  if (error) {
    showToast('Registration failed. Try again.', 'error');
    console.error(error);
    return;
  }

  isAdmin = false;
  const sessionUser = {
    id: data.user_id,
    name: data.full_name,
    email: data.email,
    course: data.course || '',
    bio: data.bio || '',
    avatar: data.full_name.charAt(0).toUpperCase(),
  };
  saveSession(sessionUser);
  closeModal('auth-modal');
  updateAuthUI();
  navigateTo('home');
  showToast(`Account created! Welcome, ${name.split(' ')[0]}! 🎉`, 'success');
}

function logout() {
  isAdmin = false;
  saveSession(null);
  updateAuthUI();
  navigateTo('home');
  showToast('Signed out successfully.', 'info');
}

async function updateAuthUI() {
  const session = getSession();
  const loggedIn = !!session;

  document.querySelectorAll('.guest-only').forEach(el => el.classList.toggle('hidden', loggedIn));
  document.querySelectorAll('.auth-only').forEach(el => el.classList.toggle('hidden', !loggedIn));

  const avatar = $('nav-avatar');
  if (avatar && session) {
    avatar.textContent = session.avatar || session.name?.charAt(0).toUpperCase() || '?';
  }

  document.querySelectorAll('.mobile-avatar-icon').forEach(el => {
    el.textContent = session?.avatar || '◉';
  });

  // Fetch stats from Supabase
  const { count: listingCount } = await supabase.from('listings').select('*', { count: 'exact', head: true });
  const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });

  const sL = $('stat-listings'); if (sL) sL.textContent = listingCount || 0;
  const sU = $('stat-users'); if (sU) sU.textContent = userCount || 0;
}

/* ════════════════════════════════════════════════════════════════
   6. NAVIGATION
   ════════════════════════════════════════════════════════════════ */

function navigateTo(page) {
  const session = getSession();

  if (['upload', 'profile'].includes(page) && !session) {
    openModal('auth-modal');
    showToast('Please sign in to continue.', 'info');
    return;
  }
  if (page === 'admin' && (!session || !session.isAdmin)) {
    showToast('Access denied.', 'error');
    return;
  }
  if (page === 'home' && session?.isAdmin) page = 'admin';

  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const target = $(`page-${page}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));

  currentPage = page;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (page === 'home') renderProducts();
  if (page === 'chat') renderChat();
  if (page === 'profile') renderProfilePage();
  if (page === 'admin') renderAdminDashboard();
}

/* ════════════════════════════════════════════════════════════════
   7. PRODUCTS — FETCH & RENDER
   ════════════════════════════════════════════════════════════════ */

async function fetchProducts() {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('fetchProducts error:', error); return []; }

  // Normalize column names and fetch seller info
  const productsWithSellers = await Promise.all((data || []).map(async p => {
    let sellerName = 'Seller';
    if (p.seller_id) {
      const { data: seller } = await supabase.from('users').select('full_name').eq('user_id', p.seller_id).single();
      sellerName = seller?.full_name || 'Seller';
    }
    return {
      id: p.listing_id || p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      category: p.category,
      image: p.image || '',
      itemCondition: p.item_condition || 'Good',
      sellerId: p.seller_id,
      sellerName: sellerName,
      createdAt: p.created_at,
      views: p.views || 0,
    };
  }));
  return productsWithSellers;
}

function getFilteredProducts() {
  let products = [...allProducts];
  if (activeCategory !== 'All') products = products.filter(p => p.category === activeCategory);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    products = products.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.sellerName.toLowerCase().includes(q)
    );
  }
  const sorts = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
  };
  return products.sort(sorts[activeSort] || sorts.newest);
}

function productCardHTML(p, delay = 0) {
  const session = getSession();
  const wishlist = getWishlist();
  const saved = wishlist.includes(p.id);
  const isOwner = session && session.id === p.sellerId;

  const imageHTML = p.image
    ? `<img class="card-image" src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">`
    : `<div class="card-image-placeholder">${categoryEmoji(p.category)}</div>`;

  return `
    <div class="product-card" data-id="${esc(p.id)}" style="animation-delay:${delay}ms" onclick="openProductModal('${esc(p.id)}')">
      <div class="card-condition-badge">${esc(p.condition)}</div>
      ${imageHTML}
      <div class="card-body">
        <div class="card-category">${categoryEmoji(p.category)} ${esc(p.category)}</div>
        <div class="card-title">${esc(p.title)}</div>
        <div class="card-desc">${esc(p.description)}</div>
        <div class="card-footer">
          <div class="card-price">${fmt(p.price)}</div>
          <div class="card-seller">
            <div class="seller-avatar">${esc(p.sellerName?.charAt(0) || '?')}</div>
            ${esc(p.sellerName?.split(' ')[0] || 'Seller')}
          </div>
        </div>
      </div>
      <div class="card-actions" onclick="event.stopPropagation()">
        ${isOwner
      ? `<button class="btn-chat" onclick="openEditProductModal('${esc(p.id)}')">✏ Edit</button>
             <button class="btn-save" onclick="deleteOwnProduct('${esc(p.id)}')" title="Delete">🗑</button>`
      : `<button class="btn-chat" onclick="startChatWithSeller('${esc(p.sellerId)}','${esc(p.sellerName)}','${esc(p.id)}')">💬 Chat Seller</button>
             <button class="btn-save ${saved ? 'saved' : ''}" onclick="toggleWishlist('${esc(p.id)}',this)" title="${saved ? 'Saved' : 'Save'}">${saved ? '★' : '☆'}</button>`
    }
      </div>
    </div>`;
}

async function renderProducts() {
  const grid = $('products-grid');
  if (!grid) return;
  grid.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted)">Loading listings...</div>`;

  allProducts = await fetchProducts();
  const products = getFilteredProducts();

  if (!products.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3>No listings found</h3><p style="color:var(--text-muted);margin-top:8px;font-size:0.85rem">Try a different filter or search term</p></div>`;
    return;
  }
  grid.innerHTML = products.map((p, i) => productCardHTML(p, i * 40)).join('');
  updateAuthUI();
}

/* ════════════════════════════════════════════════════════════════
   8. PRODUCT MODAL
   ════════════════════════════════════════════════════════════════ */

async function openProductModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;

  // Increment views in Supabase
  await supabase.from('listings').update({ views: (p.views || 0) + 1 }).eq('listing_id', id);

  const session = getSession();
  const isOwner = session && session.id === p.sellerId;
  const imageHTML = p.image
    ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" style="width:100%;height:100%;object-fit:cover">`
    : `<span>${categoryEmoji(p.category)}</span>`;

  $('product-modal-body').innerHTML = `
    <div class="product-detail">
      <div class="product-detail-image">${imageHTML}</div>
      <div class="product-detail-info">
        <div>
          <div class="card-category">${categoryEmoji(p.category)} ${esc(p.category)}</div>
          <h2 style="font-size:1.3rem;margin:8px 0 4px">${esc(p.title)}</h2>
        </div>
        <div class="product-detail-price">${fmt(p.price)}</div>
        <p style="color:var(--text-secondary);font-size:0.88rem;line-height:1.6">${esc(p.description)}</p>
        <div class="product-detail-meta">
          <span>🏷 Condition: <strong>${esc(p.itemCondition)}</strong></span>
          <span>👤 Seller: <strong>${esc(p.sellerName)}</strong></span>
          <span>📅 Posted: <strong>${timeAgo(p.createdAt)}</strong></span>
          <span>👁 Views: <strong>${(p.views || 0) + 1}</strong></span>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${isOwner
      ? `<button class="btn btn-gold" onclick="openEditProductModal('${esc(id)}');closeModal('product-modal')">✏ Edit Listing</button>
               <button class="btn btn-danger" onclick="deleteOwnProduct('${esc(id)}');closeModal('product-modal')">🗑 Delete</button>`
      : `<button class="btn btn-gold" onclick="startChatWithSeller('${esc(p.sellerId)}','${esc(p.sellerName)}','${esc(id)}');closeModal('product-modal')">💬 Message Seller</button>
               <button class="btn btn-ghost" onclick="toggleWishlistById('${esc(id)}')">☆ Save</button>`
    }
        </div>
      </div>
    </div>`;
  openModal('product-modal');
}
window.openProductModal = openProductModal;

/* ════════════════════════════════════════════════════════════════
   9. UPLOAD / EDIT PRODUCT
   ════════════════════════════════════════════════════════════════ */

function setupUploadForm() {
  const zone = $('img-upload-zone');
  const fileInput = $('product-image');
  const preview = $('img-preview');
  if (zone && fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { showToast('Image too large (max 5MB).', 'error'); return; }
      const reader = new FileReader();
      reader.onload = e => {
        preview.src = e.target.result;
        preview.classList.add('visible');
        zone.querySelector('.upload-icon').style.display = 'none';
        zone.querySelector('.upload-text').textContent = file.name;
      };
      reader.readAsDataURL(file);
    });
    ['dragover', 'dragleave', 'drop'].forEach(evt => zone.addEventListener(evt, e => {
      e.preventDefault();
      if (evt === 'dragover') zone.style.borderColor = 'var(--gold)';
      if (evt === 'dragleave') zone.style.borderColor = '';
      if (evt === 'drop') {
        zone.style.borderColor = '';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) { fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event('change')); }
      }
    }));
  }

  const form = $('upload-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const session = getSession();
      if (!session || session.isAdmin) { showToast('Only students can list items.', 'error'); return; }

      const newListing = {
        title: $('product-title').value.trim(),
        description: $('product-desc').value.trim(),
        price: parseFloat($('product-price').value),
        category: $('product-category').value,
        item_condition: $('product-condition').value,
        image: $('img-preview')?.src?.startsWith('data:') ? $('img-preview').src : '',
        seller_id: session.id,
      };

      const { error } = await supabase.from('listings').insert([newListing]);
      if (error) { showToast('Failed to post listing.', 'error'); console.error(error); return; }

      form.reset();
      if (preview) { preview.classList.remove('visible'); preview.src = ''; }
      if (zone) {
        zone.querySelector('.upload-icon').style.display = '';
        zone.querySelector('.upload-text').textContent = 'Click to upload or drag & drop';
      }
      if ($('desc-count')) $('desc-count').textContent = '0 / 500';
      showToast('Listing posted! 🚀', 'success');
      navigateTo('home');
      updateAuthUI();
    });
  }
}

function openEditProductModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  $('edit-product-id').value = id;
  $('edit-product-title').value = p.title;
  $('edit-product-category').value = p.category;
  $('edit-product-condition').value = p.itemCondition;
  $('edit-product-desc').value = p.description;
  $('edit-product-price').value = p.price;
  openModal('edit-product-modal');
}
window.openEditProductModal = openEditProductModal;

async function deleteOwnProduct(id) {
  showConfirm('Delete Listing', 'Are you sure you want to delete this listing? This cannot be undone.', async () => {
    const { error } = await supabase.from('listings').delete().eq('listing_id', id);
    if (error) { showToast('Failed to delete listing.', 'error'); console.error(error); return; }
    await renderProducts();
    if (currentPage === 'profile') renderProfilePage();
    if (currentPage === 'admin') renderAdminDashboard();
    showToast('Listing deleted.', 'info');
  });
}
window.deleteOwnProduct = deleteOwnProduct;

/* ════════════════════════════════════════════════════════════════
   10. WISHLIST (still localStorage — it's per-user/device)
   ════════════════════════════════════════════════════════════════ */

function toggleWishlist(id, btn) {
  const session = getSession();
  if (!session || session.isAdmin) { showToast('Sign in to save items.', 'info'); return; }
  let list = getWishlist();
  const idx = list.indexOf(id);
  if (idx > -1) { list.splice(idx, 1); showToast('Removed from saved items.', 'info'); if (btn) { btn.textContent = '☆'; btn.classList.remove('saved'); } }
  else { list.push(id); showToast('Item saved! ★', 'success'); if (btn) { btn.textContent = '★'; btn.classList.add('saved'); } }
  saveWishlist(list);
}
window.toggleWishlist = toggleWishlist;

function toggleWishlistById(id) {
  const session = getSession();
  if (!session || session.isAdmin) { showToast('Sign in to save items.', 'info'); return; }
  let list = getWishlist();
  const idx = list.indexOf(id);
  if (idx > -1) { list.splice(idx, 1); showToast('Removed from saved items.', 'info'); }
  else { list.push(id); showToast('Item saved! ★', 'success'); }
  saveWishlist(list);
}
window.toggleWishlistById = toggleWishlistById;

/* ════════════════════════════════════════════════════════════════
   11. CHAT
   ════════════════════════════════════════════════════════════════ */

function startChatWithSeller(sellerId, sellerName, productId) {
  const session = getSession();
  if (!session || session.isAdmin) { openModal('auth-modal'); showToast('Sign in to message sellers.', 'info'); return; }
  if (session.id === sellerId) { showToast('That\'s your own listing!', 'info'); return; }
  activeChatId = sellerId;
  activeChatName = sellerName;
  navigateTo('chat');
  setTimeout(() => openThread(sellerId, sellerName), 100);
}
window.startChatWithSeller = startChatWithSeller;

async function renderChat() {
  const session = getSession();
  if (!session || session.isAdmin) {
    const chatSection = $('page-chat');
    if (chatSection) chatSection.innerHTML = `
      <div style="text-align:center;padding:80px 24px;color:var(--text-muted)">
        <div style="font-size:3rem;margin-bottom:16px">◎</div>
        <p>Please sign in to access messages.</p>
        <button class="btn btn-gold open-auth" style="margin-top:16px">Sign In</button>
      </div>`;
    return;
  }

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*, sender_id(*), receiver_id(*)')
    .or(`sender_id.eq.${session.id},receiver_id.eq.${session.id}`)
    .order('sent_at', { ascending: false });

  if (error) { console.error(error); return; }

  const list = $('chat-list');
  if (!list) return;

  if (!messages || messages.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:40px 16px;color:var(--text-muted);font-size:0.85rem">No conversations yet.<br>Browse listings and message a seller!</div>`;
    return;
  }

  // Build conversation map
  const convMap = {};
  messages.forEach(async msg => {
    const otherId = msg.sender_id === session.id ? msg.receiver_id : msg.sender_id;
    // Fetch seller/user info for the other person
    let otherName = 'Seller';
    if (otherId) {
      const { data: otherUser } = await supabase.from('users').select('full_name').eq('user_id', otherId).single();
      otherName = otherUser?.full_name || 'Seller';
    }
    if (!convMap[otherId]) convMap[otherId] = { userId: otherId, name: otherName, lastMsg: msg.content, lastAt: msg.sent_at };
  });

  const convos = Object.values(convMap).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  list.innerHTML = convos.map(c => `
    <div class="chat-list-item ${activeChatId === c.userId ? 'active' : ''}" onclick="openThread('${esc(c.userId)}','${esc(c.name)}')">
      <div class="chat-avatar">${esc(c.name.charAt(0))}</div>
      <div class="chat-list-info">
        <div class="chat-list-name">${esc(c.name)}</div>
        <div class="chat-list-preview">${esc(c.lastMsg || '')}</div>
      </div>
    </div>`).join('');
}

async function openThread(userId, userName) {
  const session = getSession();
  if (!session) return;
  activeChatId = userId;
  activeChatName = userName;

  const header = $('chat-header-content');
  if (header) {
    header.innerHTML = `
      <div class="chat-avatar">${esc(userName.charAt(0))}</div>
      <div>
        <div style="font-weight:700;font-family:var(--font-display)">${esc(userName)}</div>
        <div style="font-size:0.72rem;color:var(--success)">● Online</div>
      </div>`;
  }

  const { data: thread, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${session.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${session.id})`)
    .order('sent_at', { ascending: true });

  if (error) { console.error(error); return; }

  const messagesEl = $('chat-messages');
  if (!thread || thread.length === 0) {
    messagesEl.innerHTML = `<div class="chat-empty" id="chat-empty">
      <div class="chat-empty-icon">💬</div>
      <p>Start the conversation with ${esc(userName)}!</p>
    </div>`;
  } else {
    messagesEl.innerHTML = thread.map(m => {
      const sent = m.sender_id === session.id;
      return `<div class="chat-bubble ${sent ? 'sent' : 'received'}">
        ${esc(m.content)}
        <span class="bubble-time">${new Date(m.sent_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>`;
    }).join('');
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
  const inputArea = $('chat-input-area');
  if (inputArea) inputArea.style.display = 'flex';
  $('chat-input')?.focus();
  renderChatSidebar(userId);
}

async function renderChatSidebar(activeId) {
  const session = getSession();
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${session.id},receiver_id.eq.${session.id}`)
    .order('sent_at', { ascending: false });

  if (!messages) return;
  const convMap = {};
  for (const msg of messages) {
    const otherId = msg.sender_id === session.id ? msg.receiver_id : msg.sender_id;
    // Fetch user info to get the name
    const { data: otherUser } = await supabase.from('users').select('full_name').eq('user_id', otherId).single();
    const otherName = otherUser?.full_name || 'Seller';
    if (!convMap[otherId]) convMap[otherId] = { userId: otherId, name: otherName, lastMsg: msg.content };
  }

  const list = $('chat-list');
  if (!list) return;
  const convos = Object.values(convMap);
  list.innerHTML = convos.map(c => `
    <div class="chat-list-item ${activeId === c.userId ? 'active' : ''}" onclick="openThread('${esc(c.userId)}','${esc(c.name)}')">
      <div class="chat-avatar">${esc(c.name.charAt(0))}</div>
      <div class="chat-list-info">
        <div class="chat-list-name">${esc(c.name)}</div>
        <div class="chat-list-preview">${esc(c.lastMsg || '')}</div>
      </div>
    </div>`).join('');
}

async function sendMessage() {
  const session = getSession();
  if (!session || !activeChatId) return;
  const input = $('chat-input');
  const text = input?.value?.trim();
  if (!text) return;

  const msg = {
    sender_id: session.id,
    receiver_id: activeChatId,
    content: text,
    is_read: false,
  };

  const { error } = await supabase.from('messages').insert([msg]);
  if (error) { showToast('Failed to send message.', 'error'); console.error(error); return; }

  input.value = '';
  await openThread(activeChatId, activeChatName || 'Seller');
  triggerBotResponse(activeChatId, activeChatName || 'Seller', session);
}

function triggerBotResponse(sellerId, sellerName, session) {
  if (botTypingTimer) { clearTimeout(botTypingTimer); botTypingTimer = null; }
  const messagesEl = $('chat-messages');
  const typingEl = document.createElement('div');
  typingEl.className = 'typing-indicator';
  typingEl.id = 'typing-indicator';
  typingEl.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  messagesEl.appendChild(typingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  const delay = 2500 + Math.random() * 1500;
  botTypingTimer = setTimeout(async () => {
    document.getElementById('typing-indicator')?.remove();
    const responses = BOT_RESPONSES[sellerName] || BOT_RESPONSES.default;
    const reply = responses[Math.floor(Math.random() * responses.length)];
    await supabase.from('messages').insert([{
      sender_id: sellerId,
      receiver_id: session.id,
      content: reply,
      is_read: false,
    }]);
    await openThread(sellerId, sellerName);
    botTypingTimer = null;
  }, delay);
}

window.openThread = openThread;

/* ════════════════════════════════════════════════════════════════
   12. PROFILE PAGE
   ════════════════════════════════════════════════════════════════ */

async function renderProfilePage() {
  const session = getSession();
  if (!session || session.isAdmin) return;
  const header = $('profile-header-info');
  if (header) {
    header.innerHTML = `
      <div class="profile-avatar">${esc(session.avatar || session.name?.charAt(0) || '?')}</div>
      <div class="profile-info">
        <h3>${esc(session.name)}</h3>
        <p>${esc(session.email)}</p>
        ${session.course ? `<p>${esc(session.course)}</p>` : ''}
        <div class="profile-badges">
          <span class="profile-badge">TIPian</span>
          ${session.course ? `<span class="profile-badge">${esc(session.course.split(' ')[0])}</span>` : ''}
        </div>
      </div>`;
  }

  // My listings from Supabase
  const { data: myProducts } = await supabase
    .from('listings')
    .select('*')
    .eq('seller_id', session.id)
    .order('created_at', { ascending: false });

  const myMapped = (myProducts || []).map(p => ({
    id: p.listing_id || p.id, title: p.title, description: p.description,
    price: p.price, category: p.category, image: p.image || '',
    itemCondition: p.item_condition || 'Good', sellerId: p.seller_id,
    sellerName: p.seller_name, createdAt: p.created_at, views: p.views || 0,
  }));

  const listingsEl = $('my-listings-content');
  if (listingsEl) {
    if (!myMapped.length) {
      listingsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><h3>No listings yet</h3><p style="color:var(--text-muted);margin-top:8px;font-size:0.85rem">Post your first item for sale!</p></div>`;
    } else {
      listingsEl.innerHTML = `<div class="products-grid" style="padding:0">${myMapped.map(p => productCardHTML(p)).join('')}</div>`;
    }
  }

  // Saved/wishlist (still localStorage)
  const wishlist = getWishlist();
  const savedItems = allProducts.filter(p => wishlist.includes(p.id));
  const savedEl = $('saved-content');
  if (savedEl) {
    if (!savedItems.length) {
      savedEl.innerHTML = `<div class="empty-state"><div class="empty-icon">★</div><h3>No saved items</h3><p style="color:var(--text-muted);margin-top:8px;font-size:0.85rem">Save items you like by clicking the ☆ button.</p></div>`;
    } else {
      savedEl.innerHTML = `<div class="products-grid" style="padding:0">${savedItems.map(p => productCardHTML(p)).join('')}</div>`;
    }
  }

  const nameInput = $('edit-name');
  const emailInput = $('edit-email');
  const courseInput = $('edit-course');
  const bioInput = $('edit-bio');
  if (nameInput) nameInput.value = session.name || '';
  if (emailInput) emailInput.value = session.email || '';
  if (courseInput) courseInput.value = session.course || '';
  if (bioInput) bioInput.value = session.bio || '';
}

/* ════════════════════════════════════════════════════════════════
   13. ADMIN DASHBOARD
   ════════════════════════════════════════════════════════════════ */

async function renderAdminDashboard() {
  const { data: products } = await supabase.from('listings').select('*').order('created_at', { ascending: false });
  const { data: users } = await supabase.from('users').select('*').order('joined_at', { ascending: false });
  const { count: msgCount } = await supabase.from('messages').select('*', { count: 'exact', head: true });

  const mappedProducts = (products || []).map(p => ({
    id: p.listing_id || p.id, title: p.title, description: p.description,
    price: p.price, category: p.category, image: p.image || '',
    itemCondition: p.item_condition || 'Good', sellerId: p.seller_id,
    sellerName: p.seller_name, createdAt: p.created_at, views: p.views || 0,
  }));

  const el = id => $(id);
  if (el('admin-total-listings')) el('admin-total-listings').textContent = mappedProducts.length;
  if (el('admin-total-users')) el('admin-total-users').textContent = (users || []).length;
  if (el('admin-total-messages')) el('admin-total-messages').textContent = msgCount || 0;

  const catCounts = {};
  mappedProducts.forEach(p => { catCounts[p.category] = (catCounts[p.category] || 0) + 1; });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  if (el('admin-top-category')) el('admin-top-category').textContent = topCat;

  renderAdminTable(mappedProducts);

  const usersBody = $('admin-users-body');
  if (usersBody) {
    if (!users || !users.length) {
      usersBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No users yet</td></tr>`;
      return;
    }
    usersBody.innerHTML = users.map(u => {
      const userListings = mappedProducts.filter(p => p.sellerId === u.user_id).length;
      return `<tr>
        <td><strong>${esc(u.full_name)}</strong></td>
        <td style="color:var(--text-secondary)">${esc(u.email)}</td>
        <td style="color:var(--text-secondary)">${esc(u.course || '—')}</td>
        <td style="color:var(--text-muted)">${timeAgo(u.joined_at || u.joinedAt)}</td>
        <td><span class="badge badge-category">${userListings}</span></td>
        <td>
          <button class="btn btn-danger" style="padding:5px 12px;font-size:0.75rem;cursor:pointer" onclick="adminDeleteUser('${esc(u.user_id)}')">🗑 Delete</button>
        </td>
      </tr>`;
    }).join('');
  }
}

function renderAdminTable(products) {
  const tbody = $('admin-table-body');
  if (!tbody) return;
  const query = ($('admin-search')?.value || '').toLowerCase();
  const filtered = query
    ? products.filter(p => p.title.toLowerCase().includes(query) || p.sellerName.toLowerCase().includes(query) || p.category.toLowerCase().includes(query))
    : products;
  tbody.innerHTML = filtered.map(p => {
    const imgHTML = p.image
      ? `<img class="admin-item-img" src="${esc(p.image)}" alt="">`
      : `<div class="admin-item-img" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;background:var(--bg-input)">${categoryEmoji(p.category)}</div>`;
    return `<tr>
      <td><div class="admin-item-cell">${imgHTML}<span style="font-weight:600;font-size:0.85rem">${esc(p.title)}</span></div></td>
      <td><span class="badge badge-category">${esc(p.category)}</span></td>
      <td style="color:var(--gold);font-weight:700;font-family:var(--font-display)">${fmt(p.price)}</td>
      <td style="color:var(--text-secondary)">${esc(p.sellerName)}</td>
      <td style="color:var(--text-muted)">${timeAgo(p.createdAt)}</td>
      <td>
        <button class="btn btn-gold" style="padding:6px 12px;font-size:0.75rem;margin-right:8px" onclick="adminEditProduct('${esc(p.id)}')">Edit</button>
        <button class="btn btn-danger" style="padding:6px 12px;font-size:0.75rem" onclick="adminDeleteProduct('${esc(p.id)}')">Delete</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">No listings found</td></tr>`;
}

async function adminDeleteProduct(id) {
  showConfirm('Remove Listing', 'Remove this listing from the marketplace? This action cannot be undone.', async () => {
    await supabase.from('listings').delete().eq('listing_id', id);
    await renderAdminDashboard();
    showToast('Listing removed.', 'success');
  });
}
window.adminDeleteProduct = adminDeleteProduct;

function adminEditProduct(id) {
  openEditProductModal(id);
}
window.adminEditProduct = adminEditProduct;

async function adminDeleteUser(userId) {
  const session = getSession();
  if (!session || !session.isAdmin) { showToast('Access denied.', 'error'); return; }

  const { data: users } = await supabase.from('users').select('*').eq('user_id', userId).limit(1);
  const user = users?.[0];
  if (!user) { showToast('User not found.', 'error'); return; }

  showConfirm(
    '🗑 Delete User',
    `Delete "${user.full_name}" (${user.email})? This will also remove all their listings and messages.`,
    async () => {
      await supabase.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
      await supabase.from('listings').delete().eq('seller_id', userId);
      await supabase.from('users').delete().eq('user_id', userId);
      await renderAdminDashboard();
      showToast(`User "${user.full_name}" deleted successfully.`, 'success');
    }
  );
}
window.adminDeleteUser = adminDeleteUser;

/* ════════════════════════════════════════════════════════════════
   14. MODALS
   ════════════════════════════════════════════════════════════════ */

function openModal(id) {
  const el = $(id);
  if (el) el.classList.add('active');
}
function closeModal(id) {
  const el = $(id);
  if (el) el.classList.remove('active');
}
window.openModal = openModal;
window.closeModal = closeModal;

function showConfirm(title, message, onConfirm) {
  $('confirm-title').textContent = title;
  $('confirm-message').textContent = message;
  const btn = $('confirm-action-btn');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => { closeModal('confirm-modal'); onConfirm(); });
  openModal('confirm-modal');
}

/* ════════════════════════════════════════════════════════════════
   15. EVENT LISTENERS
   ════════════════════════════════════════════════════════════════ */

function setupEventListeners() {

  document.addEventListener('click', e => {
    const target = e.target.closest('[data-page]');
    if (target && !target.closest('.modal-overlay')) {
      e.preventDefault();
      navigateTo(target.dataset.page);
    }
  });

  document.addEventListener('click', e => {
    if (e.target.closest('.open-auth')) openModal('auth-modal');
    if (e.target.closest('.logout-btn')) logout();
  });

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      const form = document.getElementById(`${tab.dataset.tab}-form`);
      if (form) form.classList.add('active');
    });
  });

  $('login-form')?.addEventListener('submit', e => {
    e.preventDefault();
    login($('login-email').value.trim(), $('login-password').value);
  });

  $('register-form')?.addEventListener('submit', e => {
    e.preventDefault();
    register($('reg-name').value.trim(), $('reg-email').value.trim(), $('reg-password').value, $('reg-course')?.value.trim() || '');
  });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.category;
      renderProducts();
    });
  });

  $('sort-select')?.addEventListener('change', e => {
    activeSort = e.target.value;
    renderProducts();
  });

  let searchTimer;
  $('nav-search')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value.trim();
      if (currentPage !== 'home' && !getSession()?.isAdmin) navigateTo('home');
      renderProducts();
    }, 280);
  });

  $('chat-send-btn')?.addEventListener('click', sendMessage);
  $('chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

  $('chat-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.chat-list-item').forEach(item => {
      const name = item.querySelector('.chat-list-name')?.textContent.toLowerCase() || '';
      item.style.display = name.includes(q) ? '' : 'none';
    });
  });

  $('edit-product-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('edit-product-id').value;
    const { error } = await supabase.from('listings').update({
      title: $('edit-product-title').value.trim(),
      category: $('edit-product-category').value,
      item_condition: $('edit-product-condition').value,
      description: $('edit-product-desc').value.trim(),
      price: parseFloat($('edit-product-price').value),
    }).eq('listing_id', id);
    if (error) { showToast('Failed to update listing.', 'error'); console.error(error); return; }
    closeModal('edit-product-modal');
    await renderProducts();
    if (currentPage === 'profile') renderProfilePage();
    showToast('Listing updated! ✓', 'success');
  });

  $('edit-profile-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const session = getSession();
    if (!session) return;
    const updates = {
      full_name: $('edit-name').value.trim(),
      course: $('edit-course')?.value.trim() || '',
      bio: $('edit-bio')?.value.trim() || '',
    };
    const { error } = await supabase.from('users').update(updates).eq('user_id', session.id);
    if (error) { showToast('Failed to update profile.', 'error'); console.error(error); return; }
    // Update local session
    const updatedSession = {
      ...session,
      name: updates.full_name,
      course: updates.course,
      bio: updates.bio,
      avatar: updates.full_name.charAt(0).toUpperCase(),
    };
    saveSession(updatedSession);
    updateAuthUI();
    renderProfilePage();
    showToast('Profile updated! ✓', 'success');
  });

  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const content = $(`profile-tab-${tab.dataset.tab}`);
      if (content) content.classList.add('active');
    });
  });

  $('admin-search')?.addEventListener('input', async () => {
    const { data: products } = await supabase.from('listings').select('*');
    const mapped = (products || []).map(p => ({
      id: p.listing_id || p.id, title: p.title, description: p.description,
      price: p.price, category: p.category, image: p.image || '',
      itemCondition: p.item_condition || 'Good', sellerId: p.seller_id,
      sellerName: p.seller_name, createdAt: p.created_at, views: p.views || 0,
    }));
    renderAdminTable(mapped);
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
    }
  });

  window.addEventListener('scroll', () => {
    $('main-navbar')?.classList.toggle('scrolled', window.scrollY > 20);
  });
}

/* ════════════════════════════════════════════════════════════════
   16. INIT
   ════════════════════════════════════════════════════════════════ */

async function init() {
  setupEventListeners();
  setupUploadForm();

  const session = getSession();
  if (session?.isAdmin) { isAdmin = true; navigateTo('admin'); }
  else { navigateTo('home'); }

  updateAuthUI();

  const badge = $('msg-badge');
  if (badge) badge.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);
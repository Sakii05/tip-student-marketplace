/* ═══════════════════════════════════════════════════════════════
   TIP Student Marketplace — app.js
   LocalStorage "database" + Admin Dashboard + Chat Bot Logic
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════════════════════════════
   1. CONSTANTS & DB KEYS
   ════════════════════════════════════════════════════════════════ */

const DB_KEYS = {
  users:    'tip_users',
  products: 'tip_products',
  messages: 'tip_messages',
  session:  'tip_session',
  wishlist: 'tip_wishlist',
  seeded:   'tip_seeded_v3',
};

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
   2. DB — localStorage CRUD Layer
   ════════════════════════════════════════════════════════════════ */

const DB = {
  getUsers()    { return JSON.parse(localStorage.getItem(DB_KEYS.users)    || '[]'); },
  getProducts() { return JSON.parse(localStorage.getItem(DB_KEYS.products) || '[]'); },
  getMessages() { return JSON.parse(localStorage.getItem(DB_KEYS.messages) || '[]'); },
  getWishlist() { return JSON.parse(localStorage.getItem(DB_KEYS.wishlist) || '[]'); },
  getSession()  { return JSON.parse(localStorage.getItem(DB_KEYS.session)  || 'null'); },

  saveUsers(data)    { localStorage.setItem(DB_KEYS.users,    JSON.stringify(data)); },
  saveProducts(data) { localStorage.setItem(DB_KEYS.products, JSON.stringify(data)); },
  saveMessages(data) { localStorage.setItem(DB_KEYS.messages, JSON.stringify(data)); },
  saveWishlist(data) { localStorage.setItem(DB_KEYS.wishlist, JSON.stringify(data)); },
  saveSession(data)  { localStorage.setItem(DB_KEYS.session,  JSON.stringify(data)); },

  createUser(name, email, password, course = '') {
    const users = this.getUsers();
    if (users.find(u => u.email === email)) return { error: 'Email already registered.' };
    const user = {
      id: 'u_' + Date.now(),
      name, email,
      password: btoa(password),
      course, bio: '',
      avatar: name.charAt(0).toUpperCase(),
      joinedAt: new Date().toISOString(),
    };
    users.push(user);
    this.saveUsers(users);
    return { user };
  },

  findUser(email, password) {
    const users = this.getUsers();
    return users.find(u => u.email === email && u.password === btoa(password)) || null;
  },

  updateUser(id, updates) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates };
    this.saveUsers(users);
    const session = this.getSession();
    if (session && session.id === id) this.saveSession(users[idx]);
    return users[idx];
  },

  getUserById(id) { return this.getUsers().find(u => u.id === id) || null; },

  createProduct({ title, description, price, category, image, condition, sellerId, sellerName }) {
    const products = this.getProducts();
    const product = {
      id: 'p_' + Date.now(),
      title, description,
      price: parseFloat(price),
      category, image: image || '',
      condition: condition || 'Good',
      sellerId, sellerName,
      createdAt: new Date().toISOString(),
      views: 0,
    };
    products.unshift(product);
    this.saveProducts(products);
    return product;
  },

  updateProduct(id, updates) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    products[idx] = { ...products[idx], ...updates };
    this.saveProducts(products);
    return products[idx];
  },

  deleteProduct(id) {
    const products = this.getProducts().filter(p => p.id !== id);
    this.saveProducts(products);
  },

  getProductById(id) { return this.getProducts().find(p => p.id === id) || null; },

  getConversations(userId) {
    const messages = this.getMessages();
    const convMap = {};
    messages.forEach(msg => {
      if (msg.senderId !== userId && msg.receiverId !== userId) return;
      const otherId   = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const otherName = msg.senderId === userId ? msg.receiverName : msg.senderName;
      if (!convMap[otherId]) convMap[otherId] = { userId: otherId, name: otherName, messages: [], lastAt: msg.createdAt };
      convMap[otherId].messages.push(msg);
      if (msg.createdAt > convMap[otherId].lastAt) convMap[otherId].lastAt = msg.createdAt;
    });
    return Object.values(convMap).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  },

  getThread(userAId, userBId) {
    return this.getMessages().filter(m =>
      (m.senderId === userAId && m.receiverId === userBId) ||
      (m.senderId === userBId && m.receiverId === userAId)
    ).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  sendMessage({ senderId, senderName, receiverId, receiverName, text }) {
    const messages = this.getMessages();
    const msg = {
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      senderId, senderName, receiverId, receiverName,
      text, createdAt: new Date().toISOString(), read: false,
    };
    messages.push(msg);
    this.saveMessages(messages);
    return msg;
  },
};

/* ════════════════════════════════════════════════════════════════
   3. MOCK DATA SEEDER
   ════════════════════════════════════════════════════════════════ */

function seedMockData() {
  if (localStorage.getItem(DB_KEYS.seeded)) return;

  const mockUsers = [
    { id: 'u_maria', name: 'Maria Santos',   email: 'maria@tip.edu.ph', password: btoa('password123'), course: 'BS Computer Science', bio: 'CS junior, selling old textbooks and gadgets!', avatar: 'M', joinedAt: '2024-06-01T08:00:00.000Z' },
    { id: 'u_juan',  name: 'Juan Dela Cruz', email: 'juan@tip.edu.ph',  password: btoa('password123'), course: 'BS Electronics Engineering', bio: 'EE student. Clean seller, fast replies!', avatar: 'J', joinedAt: '2024-06-02T09:00:00.000Z' },
    { id: 'u_ana',   name: 'Ana Reyes',      email: 'ana@tip.edu.ph',   password: btoa('password123'), course: 'BS Information Technology', bio: 'IT sophomore. I sell notes and used supplies.', avatar: 'A', joinedAt: '2024-06-03T10:00:00.000Z' },
  ];
  DB.saveUsers(mockUsers);

  const now = Date.now();
  const mockProducts = [
    { id: 'p_mock1', title: 'Calculus Early Transcendentals (8th Ed.)', description: 'Lightly used Stewart Calculus textbook. Some highlighting on chapters 1–3 only. Complete with all pages. Perfect for Math majors.', price: 450, category: 'Books', image: '', condition: 'Good', sellerId: 'u_maria', sellerName: 'Maria Santos', createdAt: new Date(now - 86400000 * 1).toISOString(), views: 14 },
    { id: 'p_mock2', title: 'Casio fx-991EX Classwiz Scientific Calculator', description: 'Barely used Casio calculator. All functions work perfectly. Comes with original case and manual. No scratches.', price: 650, category: 'Electronics', image: '', condition: 'Like New', sellerId: 'u_juan', sellerName: 'Juan Dela Cruz', createdAt: new Date(now - 86400000 * 2).toISOString(), views: 22 },
    { id: 'p_mock3', title: 'TIP PE Uniform (Medium)', description: 'Official TIP PE uniform set — shirt and shorts. Worn only twice. Size medium. In great condition, no stains.', price: 280, category: 'Clothing', image: '', condition: 'Like New', sellerId: 'u_ana', sellerName: 'Ana Reyes', createdAt: new Date(now - 86400000 * 3).toISOString(), views: 8 },
    { id: 'p_mock4', title: 'Data Structures & Algorithms Notes (Complete)', description: 'Handwritten and typed notes for the entire DSA course. Includes sample problems with solutions. Ideal for review.', price: 120, category: 'Notes', image: '', condition: 'Like New', sellerId: 'u_maria', sellerName: 'Maria Santos', createdAt: new Date(now - 86400000 * 4).toISOString(), views: 31 },
    { id: 'p_mock5', title: 'Arduino Uno Starter Kit', description: 'Complete Arduino Uno R3 kit with breadboard, jumper wires, LEDs, resistors, and sensors. Used for one semester project.', price: 900, category: 'Electronics', image: '', condition: 'Good', sellerId: 'u_juan', sellerName: 'Juan Dela Cruz', createdAt: new Date(now - 86400000 * 5).toISOString(), views: 19 },
    { id: 'p_mock6', title: 'Engineering Drawing Set', description: 'Complete drafting set — T-square, triangles, compass, protractor, drafting pencils. Used for one term only.', price: 350, category: 'Supplies', image: '', condition: 'Good', sellerId: 'u_ana', sellerName: 'Ana Reyes', createdAt: new Date(now - 86400000 * 6).toISOString(), views: 7 },
    { id: 'p_mock7', title: 'Introduction to Programming (C++) Textbook', description: 'Good condition C++ programming book. Covers all basics to OOP. A few pencil marks but nothing distracting.', price: 300, category: 'Books', image: '', condition: 'Good', sellerId: 'u_juan', sellerName: 'Juan Dela Cruz', createdAt: new Date(now - 86400000 * 7).toISOString(), views: 11 },
    { id: 'p_mock8', title: 'Laptop Stand + USB Hub Combo', description: 'Adjustable aluminum laptop stand paired with a 4-port USB 3.0 hub. Improves ergonomics during long study sessions.', price: 550, category: 'Electronics', image: '', condition: 'Like New', sellerId: 'u_maria', sellerName: 'Maria Santos', createdAt: new Date(now - 86400000 * 8).toISOString(), views: 25 },
  ];
  DB.saveProducts(mockProducts);

  const mockMessages = [
    { id: 'm_mock1', senderId: 'u_maria', senderName: 'Maria Santos', receiverId: 'u_juan', receiverName: 'Juan Dela Cruz', text: 'Hi Juan, is your calculator still available?', createdAt: new Date(now - 86400000 * 2).toISOString(), read: true },
    { id: 'm_mock2', senderId: 'u_juan', senderName: 'Juan Dela Cruz', receiverId: 'u_maria', receiverName: 'Maria Santos', text: 'Yes, it is! Want to meet at the library?', createdAt: new Date(now - 86400000 * 2 + 60000).toISOString(), read: true },
    { id: 'm_mock3', senderId: 'u_maria', senderName: 'Maria Santos', receiverId: 'u_juan', receiverName: 'Juan Dela Cruz', text: 'Sure, tomorrow at 2 PM?', createdAt: new Date(now - 86400000 * 2 + 120000).toISOString(), read: true },
    { id: 'm_mock4', senderId: 'u_juan', senderName: 'Juan Dela Cruz', receiverId: 'u_ana', receiverName: 'Ana Reyes', text: 'Hey Ana, your PE uniform looks great!', createdAt: new Date(now - 86400000 * 1).toISOString(), read: true },
    { id: 'm_mock5', senderId: 'u_ana', senderName: 'Ana Reyes', receiverId: 'u_juan', receiverName: 'Juan Dela Cruz', text: 'Thanks! It\'s still available. Meet at the oval?', createdAt: new Date(now - 86400000 * 1 + 60000).toISOString(), read: true },
    { id: 'm_mock6', senderId: 'u_ana', senderName: 'Ana Reyes', receiverId: 'u_maria', receiverName: 'Maria Santos', text: 'Maria, are your DSA notes still for sale?', createdAt: new Date(now - 86400000 * 3).toISOString(), read: true },
    { id: 'm_mock7', senderId: 'u_maria', senderName: 'Maria Santos', receiverId: 'u_ana', receiverName: 'Ana Reyes', text: 'Yes! They\'re in perfect condition.', createdAt: new Date(now - 86400000 * 3 + 60000).toISOString(), read: true },
  ];
  DB.saveMessages(mockMessages);

  localStorage.setItem(DB_KEYS.seeded, '1');
}

/* ════════════════════════════════════════════════════════════════
   4. STATE
   ════════════════════════════════════════════════════════════════ */

let currentPage    = 'home';
let activeCategory = 'All';
let activeSort     = 'newest';
let searchQuery    = '';
let activeChatId   = null;
let isAdmin        = false;
let botTypingTimer = null;

/* ════════════════════════════════════════════════════════════════
   5. HELPERS
   ════════════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const fmt = n => '₱' + parseFloat(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const timeAgo = iso => {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
};
const now = () => new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
  const map = { Books:'📚', Electronics:'💻', Notes:'📝', Supplies:'🖊', Clothing:'👕', Other:'📦' };
  return map[cat] || '📦';
}

/* ════════════════════════════════════════════════════════════════
   6. SESSION / AUTH
   ════════════════════════════════════════════════════════════════ */

function getSession() { return DB.getSession(); }
function isLoggedIn() { return !!getSession() || isAdmin; }

function loginAsAdmin() {
  isAdmin = true;
  DB.saveSession({ id: '__admin__', name: 'Administrator', email: 'admin', isAdmin: true, avatar: 'A' });
  closeModal('auth-modal');
  updateAuthUI();
  navigateTo('admin');
  showToast('Welcome, Administrator!', 'success');
}

function login(emailOrUser, password) {
  if (emailOrUser.trim().toLowerCase() === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    loginAsAdmin();
    return;
  }
  const user = DB.findUser(emailOrUser, password);
  if (!user) { showToast('Invalid email or password.', 'error'); return; }
  isAdmin = false;
  DB.saveSession(user);
  closeModal('auth-modal');
  updateAuthUI();
  navigateTo('home');
  showToast(`Welcome back, ${user.name.split(' ')[0]}! 👋`, 'success');
}

function register(name, email, password, course) {
  if (password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
  const result = DB.createUser(name, email, password, course);
  if (result.error) { showToast(result.error, 'error'); return; }
  isAdmin = false;
  DB.saveSession(result.user);
  closeModal('auth-modal');
  updateAuthUI();
  navigateTo('home');
  showToast(`Account created! Welcome, ${name.split(' ')[0]}! 🎉`, 'success');
}

function logout() {
  isAdmin = false;
  DB.saveSession(null);
  updateAuthUI();
  navigateTo('home');
  showToast('Signed out successfully.', 'info');
}

function updateAuthUI() {
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

  const products = DB.getProducts();
  const users    = DB.getUsers();
  const sL = $('stat-listings'); if (sL) sL.textContent = products.length;
  const sU = $('stat-users');    if (sU) sU.textContent = users.length;
}

/* ════════════════════════════════════════════════════════════════
   7. NAVIGATION
   ════════════════════════════════════════════════════════════════ */

function navigateTo(page) {
  const session = getSession();

  if (['upload','profile'].includes(page) && !session) {
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

  if (page === 'home')    renderProducts();
  if (page === 'chat')    renderChat();
  if (page === 'profile') renderProfilePage();
  if (page === 'admin')   renderAdminDashboard();
}

/* ════════════════════════════════════════════════════════════════
   8. PRODUCTS — RENDER
   ════════════════════════════════════════════════════════════════ */

function getFilteredProducts() {
  let products = DB.getProducts();
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
    newest:      (a,b) => b.createdAt.localeCompare(a.createdAt),
    oldest:      (a,b) => a.createdAt.localeCompare(b.createdAt),
    'price-asc': (a,b) => a.price - b.price,
    'price-desc':(a,b) => b.price - a.price,
  };
  return products.sort(sorts[activeSort] || sorts.newest);
}

function productCardHTML(p, delay = 0) {
  const session = getSession();
  const wishlist = DB.getWishlist();
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

function renderProducts() {
  const grid = $('products-grid');
  if (!grid) return;
  const products = getFilteredProducts();
  if (!products.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3>No listings found</h3><p style="color:var(--text-muted);margin-top:8px;font-size:0.85rem">Try a different filter or search term</p></div>`;
    return;
  }
  grid.innerHTML = products.map((p, i) => productCardHTML(p, i * 40)).join('');
  updateAuthUI();
}

/* ════════════════════════════════════════════════════════════════
   9. PRODUCT MODAL
   ════════════════════════════════════════════════════════════════ */

function openProductModal(id) {
  const p = DB.getProductById(id);
  if (!p) return;
  DB.updateProduct(id, { views: (p.views || 0) + 1 });
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
          <span>🏷 Condition: <strong>${esc(p.condition)}</strong></span>
          <span>👤 Seller: <strong>${esc(p.sellerName)}</strong></span>
          <span>📅 Posted: <strong>${timeAgo(p.createdAt)}</strong></span>
          <span>👁 Views: <strong>${(p.views||0)+1}</strong></span>
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
   10. UPLOAD / EDIT PRODUCT
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
    ['dragover','dragleave','drop'].forEach(evt => zone.addEventListener(evt, e => {
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
    form.addEventListener('submit', e => {
      e.preventDefault();
      const session = getSession();
      if (!session || session.isAdmin) { showToast('Only students can list items.', 'error'); return; }
      DB.createProduct({
        title:       $('product-title').value.trim(),
        description: $('product-desc').value.trim(),
        price:       $('product-price').value,
        category:    $('product-category').value,
        condition:   $('product-condition').value,
        image:       $('img-preview')?.src?.startsWith('data:') ? $('img-preview').src : '',
        sellerId:    session.id,
        sellerName:  session.name,
      });
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
  const p = DB.getProductById(id);
  if (!p) return;
  $('edit-product-id').value = id;
  $('edit-product-title').value = p.title;
  $('edit-product-category').value = p.category;
  $('edit-product-condition').value = p.condition;
  $('edit-product-desc').value = p.description;
  $('edit-product-price').value = p.price;
  openModal('edit-product-modal');
}
window.openEditProductModal = openEditProductModal;

function deleteOwnProduct(id) {
  showConfirm('Delete Listing', 'Are you sure you want to delete this listing? This cannot be undone.', () => {
    DB.deleteProduct(id);
    renderProducts();
    if (currentPage === 'profile') renderProfilePage();
    if (currentPage === 'admin') renderAdminDashboard();
    showToast('Listing deleted.', 'info');
  });
}
window.deleteOwnProduct = deleteOwnProduct;

/* ════════════════════════════════════════════════════════════════
   11. WISHLIST
   ════════════════════════════════════════════════════════════════ */

function toggleWishlist(id, btn) {
  const session = getSession();
  if (!session || session.isAdmin) { showToast('Sign in to save items.', 'info'); return; }
  let list = DB.getWishlist();
  const idx = list.indexOf(id);
  if (idx > -1) { list.splice(idx, 1); showToast('Removed from saved items.', 'info'); if (btn) { btn.textContent = '☆'; btn.classList.remove('saved'); } }
  else           { list.push(id);      showToast('Item saved! ★', 'success');      if (btn) { btn.textContent = '★'; btn.classList.add('saved'); } }
  DB.saveWishlist(list);
}
window.toggleWishlist = toggleWishlist;

function toggleWishlistById(id) {
  const session = getSession();
  if (!session || session.isAdmin) { showToast('Sign in to save items.', 'info'); return; }
  let list = DB.getWishlist();
  const idx = list.indexOf(id);
  if (idx > -1) { list.splice(idx, 1); showToast('Removed from saved items.', 'info'); }
  else           { list.push(id);      showToast('Item saved! ★', 'success'); }
  DB.saveWishlist(list);
}
window.toggleWishlistById = toggleWishlistById;

/* ════════════════════════════════════════════════════════════════
   12. CHAT
   ════════════════════════════════════════════════════════════════ */

function startChatWithSeller(sellerId, sellerName, productId) {
  const session = getSession();
  if (!session || session.isAdmin) { openModal('auth-modal'); showToast('Sign in to message sellers.', 'info'); return; }
  if (session.id === sellerId) { showToast('That\'s your own listing!', 'info'); return; }
  activeChatId = sellerId;
  navigateTo('chat');
  setTimeout(() => openThread(sellerId, sellerName), 100);
}
window.startChatWithSeller = startChatWithSeller;

function renderChat() {
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
  const convos = DB.getConversations(session.id);
  const list = $('chat-list');
  if (!list) return;
  if (!convos.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px 16px;color:var(--text-muted);font-size:0.85rem">No conversations yet.<br>Browse listings and message a seller!</div>`;
    return;
  }
  list.innerHTML = convos.map(c => {
    const lastMsg = c.messages[c.messages.length - 1];
    return `
      <div class="chat-list-item ${activeChatId === c.userId ? 'active' : ''}" onclick="openThread('${esc(c.userId)}','${esc(c.name)}')">
        <div class="chat-avatar">${esc(c.name.charAt(0))}</div>
        <div class="chat-list-info">
          <div class="chat-list-name">${esc(c.name)}</div>
          <div class="chat-list-preview">${esc(lastMsg?.text || 'Start a conversation')}</div>
        </div>
      </div>`;
  }).join('');
}

function openThread(userId, userName) {
  const session = getSession();
  if (!session) return;
  activeChatId = userId;
  const header = $('chat-header-content');
  if (header) {
    header.innerHTML = `
      <div class="chat-avatar">${esc(userName.charAt(0))}</div>
      <div>
        <div style="font-weight:700;font-family:var(--font-display)">${esc(userName)}</div>
        <div style="font-size:0.72rem;color:var(--success)">● Online</div>
      </div>`;
  }
  const messagesEl = $('chat-messages');
  const thread = DB.getThread(session.id, userId);
  if (thread.length === 0) {
    messagesEl.innerHTML = `<div class="chat-empty" id="chat-empty">
      <div class="chat-empty-icon">💬</div>
      <p>Start the conversation with ${esc(userName)}!</p>
    </div>`;
  } else {
    messagesEl.innerHTML = thread.map(m => {
      const sent = m.senderId === session.id;
      return `<div class="chat-bubble ${sent ? 'sent' : 'received'}">
        ${esc(m.text)}
        <span class="bubble-time">${new Date(m.createdAt).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}</span>
      </div>`;
    }).join('');
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
  const inputArea = $('chat-input-area');
  if (inputArea) inputArea.style.display = 'flex';
  $('chat-input')?.focus();
  renderChatSidebar(userId);
}

function renderChatSidebar(activeId) {
  const session = getSession();
  const convos = DB.getConversations(session.id);
  const list = $('chat-list');
  if (!list || !convos.length) return;
  list.innerHTML = convos.map(c => `
    <div class="chat-list-item ${activeId === c.userId ? 'active' : ''}" onclick="openThread('${esc(c.userId)}','${esc(c.name)}')">
      <div class="chat-avatar">${esc(c.name.charAt(0))}</div>
      <div class="chat-list-info">
        <div class="chat-list-name">${esc(c.name)}</div>
        <div class="chat-list-preview">${esc(c.messages[c.messages.length-1]?.text || '')}</div>
      </div>
    </div>`).join('');
}

function sendMessage() {
  const session = getSession();
  if (!session || !activeChatId) return;
  const input = $('chat-input');
  const text  = input?.value?.trim();
  if (!text) return;
  const convos = DB.getConversations(session.id);
  const convo  = convos.find(c => c.userId === activeChatId);
  const receiverName = convo?.name || 'Seller';
  DB.sendMessage({ senderId: session.id, senderName: session.name, receiverId: activeChatId, receiverName, text });
  input.value = '';
  openThread(activeChatId, receiverName);
  triggerBotResponse(activeChatId, receiverName, session);
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
  botTypingTimer = setTimeout(() => {
    document.getElementById('typing-indicator')?.remove();
    const responses = BOT_RESPONSES[sellerName] || BOT_RESPONSES.default;
    const reply = responses[Math.floor(Math.random() * responses.length)];
    DB.sendMessage({ senderId: sellerId, senderName: sellerName, receiverId: session.id, receiverName: session.name, text: reply });
    openThread(sellerId, sellerName);
    botTypingTimer = null;
  }, delay);
}

/* ════════════════════════════════════════════════════════════════
   13. PROFILE PAGE
   ════════════════════════════════════════════════════════════════ */

function renderProfilePage() {
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
  const myProducts = DB.getProducts().filter(p => p.sellerId === session.id);
  const listingsEl = $('my-listings-content');
  if (listingsEl) {
    if (!myProducts.length) {
      listingsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><h3>No listings yet</h3><p style="color:var(--text-muted);margin-top:8px;font-size:0.85rem">Post your first item for sale!</p></div>`;
    } else {
      listingsEl.innerHTML = `<div class="products-grid" style="padding:0">${myProducts.map(p => productCardHTML(p)).join('')}</div>`;
    }
  }
  const wishlist   = DB.getWishlist();
  const savedItems = DB.getProducts().filter(p => wishlist.includes(p.id));
  const savedEl    = $('saved-content');
  if (savedEl) {
    if (!savedItems.length) {
      savedEl.innerHTML = `<div class="empty-state"><div class="empty-icon">★</div><h3>No saved items</h3><p style="color:var(--text-muted);margin-top:8px;font-size:0.85rem">Save items you like by clicking the ☆ button.</p></div>`;
    } else {
      savedEl.innerHTML = `<div class="products-grid" style="padding:0">${savedItems.map(p => productCardHTML(p)).join('')}</div>`;
    }
  }
  const nameInput   = $('edit-name');
  const emailInput  = $('edit-email');
  const courseInput = $('edit-course');
  const bioInput    = $('edit-bio');
  if (nameInput)   nameInput.value   = session.name || '';
  if (emailInput)  emailInput.value  = session.email || '';
  if (courseInput) courseInput.value = session.course || '';
  if (bioInput)    bioInput.value    = session.bio || '';
}

/* ════════════════════════════════════════════════════════════════
   14. ADMIN DASHBOARD
   ════════════════════════════════════════════════════════════════ */

function renderAdminDashboard() {
  const products = DB.getProducts();
  const users    = DB.getUsers();
  const messages = DB.getMessages();

  const el = id => $(id);
  if (el('admin-total-listings')) el('admin-total-listings').textContent = products.length;
  if (el('admin-total-users'))    el('admin-total-users').textContent    = users.length;
  if (el('admin-total-messages')) el('admin-total-messages').textContent = messages.length;

  const catCounts = {};
  products.forEach(p => { catCounts[p.category] = (catCounts[p.category]||0)+1; });
  const topCat = Object.entries(catCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';
  if (el('admin-top-category')) el('admin-top-category').textContent = topCat;

  renderAdminTable(products);

  /* ── Users Table ── */
  const usersBody = $('admin-users-body');
  if (usersBody) {
    if (!users.length) {
      usersBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No users yet</td></tr>`;
      return;
    }
    usersBody.innerHTML = users.map(u => {
      const userListings = products.filter(p => p.sellerId === u.id).length;
      const isMockUser = ['u_maria', 'u_juan', 'u_ana'].includes(u.id);
      return `<tr>
        <td><strong>${esc(u.name)}</strong></td>
        <td style="color:var(--text-secondary)">${esc(u.email)}</td>
        <td style="color:var(--text-secondary)">${esc(u.course || '—')}</td>
        <td style="color:var(--text-muted)">${timeAgo(u.joinedAt)}</td>
        <td><span class="badge badge-category">${userListings}</span></td>
        <td>
          ${isMockUser
            ? `<span style="font-size:0.72rem;color:var(--text-muted)">Demo</span>`
            : `<button class="btn btn-danger" style="padding:5px 12px;font-size:0.75rem;cursor:pointer" onclick="adminDeleteUser('${esc(u.id)}')">🗑 Delete</button>`
          }
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

function adminDeleteProduct(id) {
  showConfirm('Remove Listing', 'Remove this listing from the marketplace? This action cannot be undone.', () => {
    DB.deleteProduct(id);
    renderAdminDashboard();
    showToast('Listing removed.', 'success');
  });
}
window.adminDeleteProduct = adminDeleteProduct;

function adminEditProduct(id) {
  openEditProductModal(id);
}
window.adminEditProduct = adminEditProduct;

/* ── Delete User ────────────────────────────────────────────── */
function adminDeleteUser(userId) {
  const session = getSession();
  if (!session || !session.isAdmin) { showToast('Access denied.', 'error'); return; }

  const users = DB.getUsers();
  const user  = users.find(u => u.id === userId);
  if (!user) { showToast('User not found.', 'error'); return; }

  showConfirm(
    '🗑 Delete User',
    `Delete "${user.name}" (${user.email})? This will also remove all their listings and messages. This cannot be undone.`,
    () => {
      DB.saveUsers(DB.getUsers().filter(u => u.id !== userId));
      DB.saveProducts(DB.getProducts().filter(p => p.sellerId !== userId));
      DB.saveMessages(DB.getMessages().filter(m => m.senderId !== userId && m.receiverId !== userId));
      renderAdminDashboard();
      showToast(`User "${user.name}" deleted successfully.`, 'success');
    }
  );
}
window.adminDeleteUser = adminDeleteUser;

/* ════════════════════════════════════════════════════════════════
   15. MODALS
   ════════════════════════════════════════════════════════════════ */

function openModal(id) {
  const el = $(id);
  if (el) el.classList.add('active');
}
function closeModal(id) {
  const el = $(id);
  if (el) el.classList.remove('active');
}
window.openModal  = openModal;
window.closeModal = closeModal;

function showConfirm(title, message, onConfirm) {
  $('confirm-title').textContent   = title;
  $('confirm-message').textContent = message;
  const btn = $('confirm-action-btn');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => { closeModal('confirm-modal'); onConfirm(); });
  openModal('confirm-modal');
}

/* ════════════════════════════════════════════════════════════════
   16. EVENT LISTENERS
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

  $('edit-product-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = $('edit-product-id').value;
    DB.updateProduct(id, {
      title:       $('edit-product-title').value.trim(),
      category:    $('edit-product-category').value,
      condition:   $('edit-product-condition').value,
      description: $('edit-product-desc').value.trim(),
      price:       parseFloat($('edit-product-price').value),
    });
    closeModal('edit-product-modal');
    renderProducts();
    if (currentPage === 'profile') renderProfilePage();
    showToast('Listing updated! ✓', 'success');
  });

  $('edit-profile-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const session = getSession();
    if (!session) return;
    DB.updateUser(session.id, {
      name:   $('edit-name').value.trim(),
      course: $('edit-course')?.value.trim() || '',
      bio:    $('edit-bio')?.value.trim() || '',
      avatar: $('edit-name').value.trim().charAt(0).toUpperCase(),
    });
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

  $('admin-search')?.addEventListener('input', () => renderAdminTable(DB.getProducts()));

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
   17. INIT
   ════════════════════════════════════════════════════════════════ */

function init() {
  seedMockData();
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
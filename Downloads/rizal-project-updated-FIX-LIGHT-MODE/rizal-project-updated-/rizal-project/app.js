/**
 * ============================================================
 * RIZAL WEBSITE — Group 5, IT22S2, GEM 001
 * app.js — Main Application Script
 * ============================================================
 */

'use strict';

let DATA = null;

// ============================================================
// FETCH DATA
// ============================================================
async function fetchData() {
  try {
    const response = await fetch('./data.json');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    DATA = await response.json();
    initApp();
  } catch (err) {
    console.error('Failed to load data.json:', err);
    document.body.innerHTML = `
      <div style="display:grid;place-items:center;min-height:100vh;font-family:monospace;color:#C9A84C;background:#0D0A06;padding:2rem;text-align:center;">
        <div>
          <p style="font-size:2rem;margin-bottom:1rem;">⚠</p>
          <p>Could not load <code>data.json</code>.</p>
          <p style="color:#6B5B42;margin-top:0.5rem;font-size:0.85rem;">Make sure you're running this through a local server (e.g., Live Server in VS Code).</p>
        </div>
      </div>
    `;
  }
}

// ============================================================
// INIT APP
// ============================================================
function initApp() {
  renderHero();
  renderBiography();
  renderWorks();
  renderTravels();
  renderGroup();
  renderGallery();
  initTheme();
  initSearch();
  initFactToast();
  initScrollAnimations();
  initNavHighlight();
  initNavScroll();
  initHamburger();
}

// ============================================================
// RENDER: HERO
// ============================================================
function renderHero() {
  const { hero } = DATA;
  document.getElementById('heroTagline').textContent = hero.tagline;
  document.getElementById('heroAttribution').textContent = hero.attribution;
}

// ============================================================
// RENDER: BIOGRAPHY
// ============================================================
function renderBiography() {
  const { biography } = DATA;

  document.getElementById('bioOverview').textContent = biography.overview;

  const metaItems = [
    { label: 'Born', value: biography.born },
    { label: 'Birthplace', value: biography.birthplace },
    { label: 'Died', value: biography.died },
    { label: 'Place of Death', value: biography.deathplace },
  ];

  const metaGrid = document.getElementById('bioMeta');
  metaGrid.innerHTML = metaItems.map(item => `
    <div class="bio-meta-item reveal">
      <div class="bio-meta-label">${item.label}</div>
      <div class="bio-meta-value">${item.value}</div>
    </div>
  `).join('');

  const timeline = document.getElementById('timeline');
  timeline.innerHTML = biography.timeline.map((item, i) => `
    <div class="timeline-item reveal" style="transition-delay:${i * 0.05}s">
      <div class="timeline-year">${item.year}</div>
      ${item.imageURL ? `<img src="${item.imageURL}" alt="${item.event}" class="timeline-img" />` : ''}
      <div class="timeline-event">${item.event}</div>
      <div class="timeline-detail">${item.detail}</div>
    </div>
  `).join('');

  const langContainer = document.getElementById('languagesTags');
  const allTags = [
    ...biography.languages.map(l => ({ text: l })),
    ...biography.fields.map(f => ({ text: f }))
  ];
  langContainer.innerHTML = allTags.map(t => `
    <span class="tag">${t.text}</span>
  `).join('');
}

// ============================================================
// RENDER: WORKS
// ============================================================
function renderWorks() {
  const { works } = DATA;
  const container = document.getElementById('worksContainer');

  container.innerHTML = works.map(work => `
    <div class="work-block reveal" id="work-${work.id}" style="--work-color:${work.accentColor}">
      <div class="work-header">
        <div class="work-header-left">
          <div class="work-genre-badge">${work.genre} · ${work.language}</div>
          <h3 class="work-title">${work.title}</h3>
          <p class="work-subtitle">"${work.subtitle}"</p>
          <div class="work-meta">
            <div class="work-meta-item">
              <span class="work-meta-label">Published</span>
              <span class="work-meta-value">${work.year} · ${work.publishedIn}</span>
            </div>
            <div class="work-meta-item">
              <span class="work-meta-label">Dedicated To</span>
              <span class="work-meta-value">${work.dedication}</span>
            </div>
          </div>
        </div>
        <div class="work-year-display">${work.year}</div>
      </div>
      <div class="work-body">
        <p class="work-summary">${work.summary}</p>
        <div class="work-themes">
          ${work.themes.map(t => `<span class="work-theme-tag">${t}</span>`).join('')}
        </div>
        <blockquote class="work-significance">${work.significance}</blockquote>
        <div class="characters-title">Major Characters</div>
        <div class="characters-grid">
          ${work.characters.map(char => `
            <div class="character-card">
              <div class="char-archetype">${char.archetype}</div>
              <div class="char-name">${char.name}</div>
              <div class="char-role">${char.role}</div>
              <div class="char-desc">${char.description}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// RENDER: TRAVELS
// ============================================================
function renderTravels() {
  const { travels } = DATA;
  const grid = document.getElementById('travelsGrid');

  grid.innerHTML = travels.map((place, i) => `
    <div class="travel-card reveal" style="--travel-color:${place.color}; transition-delay:${(i % 4) * 0.07}s">
      <div class="travel-flag">${place.flag}</div>
      <div class="travel-location">
        <div class="travel-city">${place.city}</div>
        <div class="travel-country">${place.country}</div>
      </div>
      <div class="travel-years">${place.years}</div>
      <div class="travel-purpose">${place.purpose}</div>
      <div class="travel-detail">${place.detail}</div>
    </div>
  `).join('');
}

// ============================================================
// RENDER: GROUP
// ============================================================
function renderGroup() {
  const { group } = DATA;

  const banner = document.getElementById('groupBanner');
  banner.innerHTML = `
    <div class="group-number">Section ${group.section} · GEM 001</div>
    <div class="group-name">Group ${group.groupNumber} — The Devs</div>
    <div class="group-section">${group.courseName} · ${group.semester}</div>
    <div class="group-motto">"${group.motto}"</div>
  `;

  const teamGrid = document.getElementById('teamGrid');
  teamGrid.innerHTML = group.members.map((member, i) => `
    <div class="member-card reveal" style="--member-color:${member.color}; transition-delay:${i * 0.08}s">
      <span class="member-emoji">${member.emoji}</span>
      <div class="member-role">${member.role}</div>
      <div class="member-name">${member.name}</div>
      <div class="member-desc">${member.description}</div>
      <div class="member-skills">
        ${member.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

// ============================================================
// RENDER: GALLERY
// ============================================================
function renderGallery() {
  const { gallery } = DATA.biography;
  const container = document.getElementById('galleryGrid');
  if (!container || !gallery) return;

  container.innerHTML = gallery.map((item, i) => `
    <div class="gallery-card reveal" style="transition-delay:${i * 0.1}s">
      <div class="gallery-image-wrapper">
        <img src="${item.imageURL}" alt="${item.title}" class="gallery-image" />
      </div>
      <div class="gallery-content">
        <h4 class="gallery-title">${item.title}</h4>
        <p class="gallery-description">${item.description}</p>
        <div class="gallery-year">${item.year}</div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// FEATURE 1: DARK / LIGHT THEME TOGGLE
// ============================================================
function initTheme() {
  const toggle = document.getElementById('themeToggle');
  const icon = toggle.querySelector('.theme-icon');
  const saved = localStorage.getItem('rizal-theme') || 'dark';

  document.documentElement.setAttribute('data-theme', saved);
  icon.textContent = saved === 'dark' ? '🌙' : '☀️';

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    icon.textContent = next === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('rizal-theme', next);
  });
}

// ============================================================
// FEATURE 2: REAL-TIME SEARCH WITH ACCURATE SCROLL
// ============================================================
function buildSearchIndex() {
  const index = [];
  const { biography, works, travels, group } = DATA;

  biography.timeline.forEach(item => {
    index.push({
      title: item.event,
      meta: `Biography · ${item.year}`,
      scrollTo: 'biography',
      keywords: (item.event + ' ' + item.detail).toLowerCase()
    });
  });

  works.forEach(work => {
    index.push({
      title: work.title,
      meta: `Literary Work · ${work.year}`,
      scrollTo: `work-${work.id}`,
      keywords: (work.title + ' ' + work.subtitle + ' ' + work.summary + ' ' + work.themes.join(' ')).toLowerCase()
    });
    work.characters.forEach(char => {
      index.push({
        title: char.name,
        meta: `Character in ${work.title} · ${char.role}`,
        scrollTo: `work-${work.id}`,
        keywords: (char.name + ' ' + char.role + ' ' + char.description + ' ' + char.archetype).toLowerCase()
      });
    });
  });

  travels.forEach(place => {
    index.push({
      title: `${place.city}, ${place.country}`,
      meta: `Travel · ${place.years} · ${place.purpose}`,
      scrollTo: 'travels',
      keywords: (place.city + ' ' + place.country + ' ' + place.purpose + ' ' + place.detail).toLowerCase()
    });
  });

  group.members.forEach(m => {
    index.push({
      title: m.name,
      meta: `Group 5 · ${m.role}`,
      scrollTo: 'group',
      keywords: (m.name + ' ' + m.role + ' ' + m.skills.join(' ')).toLowerCase()
    });
  });

  return index;
}

// ============================================================
// SCROLL TO ELEMENT — forces reveal then scrolls
// ============================================================
function scrollToId(id) {
  const target = document.getElementById(id);
  if (!target) return;

  // Force reveal the element and all .reveal children
  // so it's fully visible before we scroll to it
  target.classList.add('visible');
  target.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));

  // Wait one frame for layout to settle, then scroll
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const navHeight = 72 + 60;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: 'smooth' });

      // Gold highlight flash
      target.style.outline = '2px solid var(--gold)';
      target.style.borderRadius = '4px';
      setTimeout(() => {
        target.style.outline = '';
        target.style.borderRadius = '';
      }, 2500);
    });
  });
}

function initSearch() {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  const clear = document.getElementById('searchClear');
  let index = null;

  input.addEventListener('focus', () => {
    if (!index) index = buildSearchIndex();
  });

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();

    if (!query) {
      results.classList.remove('show');
      clear.classList.remove('visible');
      return;
    }

    clear.classList.add('visible');

    const matches = index
      .filter(item => item.keywords.includes(query))
      .slice(0, 7);

    if (matches.length === 0) {
      results.innerHTML = `<div class="no-results">No results for "<em>${escapeHtml(input.value)}</em>"</div>`;
    } else {
      results.innerHTML = matches.map(m => `
        <div class="search-result-item" data-scrollto="${m.scrollTo}">
          <div class="search-result-title">${m.title}</div>
          <div class="search-result-meta">${m.meta}</div>
        </div>
      `).join('');

      results.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.scrollto;
          results.classList.remove('show');
          input.value = '';
          clear.classList.remove('visible');
          scrollToId(id);
        });
      });
    }

    results.classList.add('show');
  });

  clear.addEventListener('click', () => {
    input.value = '';
    results.classList.remove('show');
    clear.classList.remove('visible');
    input.focus();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
      results.classList.remove('show');
    }
  });
}

// ============================================================
// FEATURE 3: RANDOM FACT GENERATOR
// ============================================================
function initFactToast() {
  const btn = document.getElementById('factBtn');
  const toast = document.getElementById('factToast');
  const textEl = document.getElementById('factText');
  const closeBtn = document.getElementById('factClose');
  const facts = DATA.biography.funFacts;
  let lastIndex = -1;
  let autoHide = null;

  function showFact() {
    let idx;
    do { idx = Math.floor(Math.random() * facts.length); } while (idx === lastIndex);
    lastIndex = idx;
    textEl.textContent = facts[idx];
    toast.classList.remove('fade-out');
    toast.classList.add('show');
    clearTimeout(autoHide);
    autoHide = setTimeout(hideFact, 5000);
  }

  function hideFact() {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.remove('fade-out');
    }, 500);
  }

  btn.addEventListener('click', showFact);
  closeBtn.addEventListener('click', hideFact);
}

// ============================================================
// SCROLL ANIMATIONS
// ============================================================
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  setTimeout(() => {
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }, 100);
}

// ============================================================
// ACTIVE NAV HIGHLIGHT
// ============================================================
function initNavHighlight() {
  const sections = document.querySelectorAll('.section');
  const navLinks = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(s => observer.observe(s));
}

// ============================================================
// NAVBAR SCROLL
// ============================================================
function initNavScroll() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });
}

// ============================================================
// MOBILE HAMBURGER
// ============================================================
function initHamburger() {
  const btn = document.getElementById('hamburger');
  const links = document.getElementById('navLinks');

  btn.addEventListener('click', () => {
    links.classList.toggle('open');
  });

  links.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => links.classList.remove('open'));
  });
}

// ============================================================
// UTILITY
// ============================================================
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', fetchData);
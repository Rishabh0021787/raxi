/**
 * Yaar Win - Authentication System Logic
 * Supports Login, Register, and Forgot Password
 * Roboto font family, Telegram Customer Support integration
 */

// Initial LocalStorage Setup with demo accounts
const STORAGE_KEYS = {
  USERS: 'yaarwin_registered_users',
  CURRENT_USER: 'yaarwin_logged_in_user',
  TELEGRAM_LINK: 'yaarwin_telegram_support_link',
  REMEMBERED_PHONE: 'yaarwin_remembered_phone'
};

// Default Telegram Link
const DEFAULT_TELEGRAM = 'https://t.me/yaarwinsupport';

// Countries List for Country Code Picker
const COUNTRIES = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'Pakistan', code: '+92', flag: '🇵🇰' },
  { name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { name: 'Indonesia', code: '+62', flag: '🇮🇩' },
  { name: 'Vietnam', code: '+84', flag: '🇻🇳' },
  { name: 'Philippines', code: '+63', flag: '🇵🇭' },
  { name: 'Malaysia', code: '+60', flag: '🇲🇾' },
  { name: 'Brazil', code: '+55', flag: '🇧🇷' },
  { name: 'Nigeria', code: '+234', flag: '🇳🇬' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Nepal', code: '+977', flag: '🇳🇵' },
  { name: 'Sri Lanka', code: '+94', flag: '🇱🇰' }
];

// App State
const state = {
  currentScreen: 'login', // 'login' | 'register' | 'forgot'
  currentCountry: { name: 'India', code: '+91', flag: '🇮🇳' },
  loginTab: 'phone', // 'phone' | 'email'
  registerTab: 'phone', // 'phone' | 'email'
  forgotTab: 'phone', // 'phone' | 'email'
  otpCode: null,
  otpCountdown: 0,
  otpTimer: null,
  telegramLink: localStorage.getItem(STORAGE_KEYS.TELEGRAM_LINK) || DEFAULT_TELEGRAM
};

// Seed default demo user if not present
function initializeDatabase() {
  const existing = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!existing) {
    const demoUsers = [
      {
        identifier: '9876543210',
        type: 'phone',
        countryCode: '+91',
        password: 'password123',
        inviteCode: '287520774542',
        createdAt: new Date().toISOString()
      },
      {
        identifier: 'demo@raxi.win',
        type: 'email',
        countryCode: '',
        password: 'password123',
        inviteCode: '287520774542',
        createdAt: new Date().toISOString()
      }
    ];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(demoUsers));
  }
}

// User Storage Helpers
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
  } catch (e) {
    return [];
  }
}

function saveUser(user) {
  const users = getUsers();
  const index = users.findIndex(u => u.identifier === user.identifier);
  if (index >= 0) {
    users[index] = { ...users[index], ...user };
  } else {
    users.push(user);
  }
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function findUser(identifier) {
  const users = getUsers();
  return users.find(u => u.identifier.trim() === identifier.trim());
}

// Toast System
function showToast(message, type = 'info', action = null) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  toast.appendChild(textSpan);

  if (action && action.text) {
    const actionBtn = document.createElement('button');
    actionBtn.textContent = action.text;
    actionBtn.style.cssText = `
      background: var(--text-primary);
      color: var(--bg-primary);
      border: none;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
      cursor: pointer;
    `;
    actionBtn.onclick = (e) => {
      e.stopPropagation();
      action.callback();
      toast.remove();
    };
    toast.appendChild(actionBtn);
  }

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Screen Navigation
function navigateToScreen(screen) {
  state.currentScreen = screen;
  window.location.hash = screen;

  // Toggle Screen Views
  const screens = ['login', 'register', 'forgot'];
  screens.forEach(s => {
    const el = document.getElementById(`${s}Screen`);
    if (el) {
      if (s === screen) {
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    }
  });

  // Pre-fill invite code if switching to register screen
  if (screen === 'register') {
    const presetCode = localStorage.getItem('raxi_referral_preset_code');
    if (presetCode) {
      const inviteInput = document.getElementById('registerInviteCode');
      if (inviteInput) inviteInput.value = presetCode;
    }
  }

  // Auto-scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Password Visibility Toggle
function togglePasswordVisibility(inputId, btnElement) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';

  // Toggle icon between eye and eye-off
  btnElement.innerHTML = isPassword ? getEyeSvg() : getEyeOffSvg();
}

// Eye Icons SVG
function getEyeOffSvg() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  `;
}

function getEyeSvg() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;
}

// Country Code Picker Modal
function openCountryModal() {
  const modal = document.getElementById('countryModal');
  if (modal) {
    modal.classList.add('active');
    renderCountryList('');
    const searchInput = document.getElementById('countrySearchInput');
    if (searchInput) {
      searchInput.value = '';
      setTimeout(() => searchInput.focus(), 100);
    }
  }
}

function closeCountryModal() {
  const modal = document.getElementById('countryModal');
  if (modal) modal.classList.remove('active');
}

function renderCountryList(filter = '') {
  const listEl = document.getElementById('countryList');
  if (!listEl) return;

  const query = filter.toLowerCase().trim();
  const filtered = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(query) || c.code.includes(query)
  );

  listEl.innerHTML = filtered.map(c => `
    <div class="country-item ${c.code === state.currentCountry.code && c.name === state.currentCountry.name ? 'selected' : ''}" onclick="selectCountry('${c.code}', '${c.name}', '${c.flag}')">
      <div class="country-item-left">
        <span class="country-flag">${c.flag}</span>
        <span class="country-name">${c.name}</span>
      </div>
      <span class="country-code-val">${c.code}</span>
    </div>
  `).join('');
}

function selectCountry(code, name, flag) {
  state.currentCountry = { code, name, flag };
  document.querySelectorAll('.current-country-code').forEach(el => {
    el.textContent = code;
  });
  closeCountryModal();
}

// Telegram Customer Support Modal & Redirect
function openSupportModal() {
  const modal = document.getElementById('supportModal');
  const input = document.getElementById('supportLinkInput');
  if (input) input.value = state.telegramLink;
  if (modal) modal.classList.add('active');
}

function closeSupportModal() {
  const modal = document.getElementById('supportModal');
  if (modal) modal.classList.remove('active');
}

function openTelegramDirect() {
  const url = state.telegramLink || DEFAULT_TELEGRAM;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function saveCustomTelegramLink() {
  const input = document.getElementById('supportLinkInput');
  if (!input) return;
  let val = input.value.trim();
  if (!val) {
    val = DEFAULT_TELEGRAM;
  }
  if (!val.startsWith('http://') && !val.startsWith('https://')) {
    val = 'https://t.me/' + val.replace('@', '');
  }
  state.telegramLink = val;
  localStorage.setItem(STORAGE_KEYS.TELEGRAM_LINK, val);
  showToast('Telegram customer support link updated!', 'success');
  closeSupportModal();
}

// Privacy Agreement Modal
function openPrivacyModal(e) {
  if (e) e.stopPropagation();
  const modal = document.getElementById('privacyModal');
  if (modal) modal.classList.add('active');
}

function closePrivacyModal() {
  const modal = document.getElementById('privacyModal');
  if (modal) modal.classList.remove('active');
}

// Verification OTP simulation (for Forgot Password)
function sendVerificationCode() {
  if (state.otpCountdown > 0) return;

  const phoneInput = document.getElementById('forgotIdentifier');
  const identifier = phoneInput ? phoneInput.value.trim() : '';

  if (!identifier) {
    showToast('Please enter your phone number or email first', 'error');
    if (phoneInput) phoneInput.focus();
    return;
  }

  // Generate random 6-digit OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  state.otpCode = code;

  // Start countdown
  state.otpCountdown = 60;
  updateOtpButtonUI();

  if (state.otpTimer) clearInterval(state.otpTimer);
  state.otpTimer = setInterval(() => {
    state.otpCountdown--;
    if (state.otpCountdown <= 0) {
      clearInterval(state.otpTimer);
      state.otpTimer = null;
    }
    updateOtpButtonUI();
  }, 1000);

  // Show Toast with the OTP Code and Quick Auto-fill Action
  showToast(`Verification code: ${code}`, 'success', {
    text: 'Auto-fill',
    callback: () => {
      const codeInput = document.getElementById('forgotVerifyCode');
      if (codeInput) {
        codeInput.value = code;
        showToast('Code auto-filled!', 'success');
      }
    }
  });
}

function updateOtpButtonUI() {
  const btn = document.getElementById('sendOtpBtn');
  if (!btn) return;

  if (state.otpCountdown > 0) {
    btn.disabled = true;
    btn.textContent = `${state.otpCountdown}s`;
  } else {
    btn.disabled = false;
    btn.textContent = 'Send';
  }
}

// Form Handlers
function handleLogin(e) {
  e.preventDefault();
  const identifierInput = document.getElementById('loginIdentifier');
  const passwordInput = document.getElementById('loginPassword');
  const rememberCheckbox = document.getElementById('rememberCheckbox');

  const identifier = identifierInput ? identifierInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  const remember = rememberCheckbox ? rememberCheckbox.classList.contains('checked') : false;

  if (!identifier) {
    showToast('Please enter your phone number or email', 'error');
    if (identifierInput) identifierInput.focus();
    return;
  }

  if (!password) {
    showToast('Please enter your password', 'error');
    if (passwordInput) passwordInput.focus();
    return;
  }

  // Check user database
  const user = findUser(identifier);
  if (!user || user.password !== password) {
    // If entered identifier is valid format, offer quick registration or error
    showToast('Incorrect account or password. Please try again or register.', 'error');
    return;
  }

  // Remember login
  if (remember) {
    localStorage.setItem(STORAGE_KEYS.REMEMBERED_PHONE, identifier);
  } else {
    localStorage.removeItem(STORAGE_KEYS.REMEMBERED_PHONE);
  }

  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  showToast(`Welcome back, ${user.identifier}! Login successful.`, 'success');

  // Trigger logged in view: immediately opens Home Page
  setTimeout(() => {
    if (typeof switchMainTab === 'function') {
      switchMainTab('home');
    } else if (typeof openWelcomeModal === 'function') {
      openWelcomeModal(user);
    }
  }, 400);
}

async function handleRegister(e) {
  e.preventDefault();
  const identifierInput = document.getElementById('registerIdentifier');
  const passwordInput = document.getElementById('registerPassword');
  const confirmPasswordInput = document.getElementById('registerConfirmPassword');
  const inviteCodeInput = document.getElementById('registerInviteCode');
  const agreementCheckbox = document.getElementById('registerAgreementCheckbox');

  const identifier = identifierInput ? identifierInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : '';
  const inviteCode = inviteCodeInput ? inviteCodeInput.value.trim() : '';
  const isAgreed = agreementCheckbox ? agreementCheckbox.classList.contains('checked') : false;

  if (!identifier) {
    showToast('Please enter your phone number', 'error');
    if (identifierInput) identifierInput.focus();
    return;
  }

  if (!password) {
    showToast('Please set your password', 'error');
    if (passwordInput) passwordInput.focus();
    return;
  }

  if (password.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showToast('Passwords do not match. Please re-enter.', 'error');
    if (confirmPasswordInput) confirmPasswordInput.focus();
    return;
  }

  if (!isAgreed) {
    showToast('Please read and agree to the Privacy Agreement', 'error');
    return;
  }

  // Check if already registered
  const existing = findUser(identifier);
  if (existing) {
    showToast('This account is already registered! Please log in.', 'error');
    navigateToScreen('login');
    const loginIdentifier = document.getElementById('loginIdentifier');
    if (loginIdentifier) loginIdentifier.value = identifier;
    return;
  }

  // Generate random welcome bonus above ₹80 (between ₹81 and ₹99)
  const expectedBonus = Math.floor(Math.random() * (99 - 81 + 1)) + 81;
  const newUid = String(Math.floor(100000 + Math.random() * 900000));
  const effectiveInviteCode = inviteCode || localStorage.getItem('raxi_referral_preset_code') || '';

  let awardedBonus = expectedBonus;

  try {
    const regRes = await fetch('/api/user/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: newUid,
        identifier,
        password,
        inviteCode: effectiveInviteCode,
        bonusAmount: expectedBonus
      })
    });
    const regData = await regRes.json();
    if (regData.success && regData.data && regData.data.bonusAmount) {
      awardedBonus = regData.data.bonusAmount;
    }
  } catch (err) {
    console.warn('Server registration offline/fallback:', err);
  }

  // Create new user with awarded bonus
  const newUser = {
    uid: newUid,
    identifier,
    type: state.registerTab,
    countryCode: state.currentCountry.code,
    password,
    balance: awardedBonus,
    welcomeBonus: awardedBonus,
    inviteCode: effectiveInviteCode || '287520774542',
    createdAt: new Date().toISOString()
  };

  saveUser(newUser);
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
  localStorage.setItem('raxi_active_uid', newUid);

  // Set flag to trigger congratulations bonus popup for fresh new user only
  localStorage.setItem('raxi_show_welcome_bonus_amount', String(awardedBonus));

  showToast(`Registration successful! Welcome bonus ₹${awardedBonus} unlocked!`, 'success');

  // Immediately take user to home page and trigger bonus popup
  setTimeout(() => {
    if (typeof switchMainTab === 'function') {
      switchMainTab('home');
      if (typeof checkAndShowWelcomeBonusModal === 'function') {
        checkAndShowWelcomeBonusModal();
      }
    } else {
      window.location.href = 'index.html#home';
    }
  }, 400);
}

function handleResetPassword(e) {
  e.preventDefault();
  const identifierInput = document.getElementById('forgotIdentifier');
  const newPasswordInput = document.getElementById('forgotNewPassword');
  const confirmPasswordInput = document.getElementById('forgotConfirmPassword');
  const verifyCodeInput = document.getElementById('forgotVerifyCode');
  const agreementCheckbox = document.getElementById('forgotAgreementCheckbox');

  const identifier = identifierInput ? identifierInput.value.trim() : '';
  const newPassword = newPasswordInput ? newPasswordInput.value.trim() : '';
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : '';
  const verifyCode = verifyCodeInput ? verifyCodeInput.value.trim() : '';
  const isAgreed = agreementCheckbox ? agreementCheckbox.classList.contains('checked') : false;

  if (!identifier) {
    showToast('Please enter your phone number or email', 'error');
    if (identifierInput) identifierInput.focus();
    return;
  }

  if (!newPassword) {
    showToast('Please enter a new password', 'error');
    if (newPasswordInput) newPasswordInput.focus();
    return;
  }

  if (newPassword.length < 6) {
    showToast('New password must be at least 6 characters', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('Passwords do not match. Please verify.', 'error');
    if (confirmPasswordInput) confirmPasswordInput.focus();
    return;
  }

  if (!verifyCode) {
    showToast('Please enter the verification code', 'error');
    if (verifyCodeInput) verifyCodeInput.focus();
    return;
  }

  // Validate OTP code (either matches generated code or testing code '123456')
  if (state.otpCode && verifyCode !== state.otpCode && verifyCode !== '123456') {
    showToast('Invalid verification code. Please check again.', 'error');
    return;
  }

  if (!isAgreed) {
    showToast('Please agree to the Privacy Agreement', 'error');
    return;
  }

  // Check if user exists; if not, create account with new password
  let user = findUser(identifier);
  if (!user) {
    user = {
      identifier,
      type: state.forgotTab,
      countryCode: state.currentCountry.code,
      password: newPassword,
      createdAt: new Date().toISOString()
    };
  } else {
    user.password = newPassword;
  }

  saveUser(user);
  showToast('Password reset successful! Please log in.', 'success');

  // Navigate to login with credentials filled
  setTimeout(() => {
    navigateToScreen('login');
    const loginId = document.getElementById('loginIdentifier');
    const loginPass = document.getElementById('loginPassword');
    if (loginId) loginId.value = identifier;
    if (loginPass) loginPass.value = newPassword;
  }, 900);
}

// Logged In Modal Simulation
function openWelcomeModal(user) {
  let modal = document.getElementById('welcomeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'welcomeModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title">Account Logged In</div>
          <button class="modal-close-btn" onclick="closeWelcomeModal()">✕</button>
        </div>
        <div class="support-card-content">
          <div style="width: 58px; height: 58px; border-radius: 50%; background: var(--bg-panel); color: var(--accent-red); border: 1.5px solid var(--accent-red); display: flex; align-items: center; justify-content: center; font-size: 26px;">
            ✓
          </div>
          <div class="support-title">Welcome to RAXI .WIN!</div>
          <div class="support-desc" id="welcomeUserDetail">User: ${user.identifier}</div>
          <button class="btn-primary" onclick="closeWelcomeModal()" style="margin-top: 10px;">Continue to Games</button>
          <button class="btn-outline" onclick="logoutUser()" style="margin-top: -4px;">Log Out</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    const detail = document.getElementById('welcomeUserDetail');
    if (detail) detail.textContent = `User: ${user.identifier}`;
  }
  modal.classList.add('active');
}

function closeWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  if (modal) modal.classList.remove('active');
}

function logoutUser() {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  closeWelcomeModal();
  showToast('Logged out successfully', 'info');
}

// ==========================================================================
// AUTOMATIC SLIDING HERO BANNER CAROUSEL
// ==========================================================================
let heroBannerTimer = null;

function initHeroBannerSlider() {
  const container = document.getElementById('heroBannerSlider');
  const track = document.getElementById('bannerSliderTrack');
  const dotsContainer = document.getElementById('bannerPaginationDots');
  if (!container || !track || !dotsContainer) return;

  const slides = track.querySelectorAll('.banner-slide-item');
  const totalSlides = slides.length;
  if (totalSlides === 0) return;

  let currentIndex = 0;
  const slideDuration = 3200; // 3.2s per slide

  // Render pagination dots
  dotsContainer.innerHTML = '';
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement('span');
    dot.className = `banner-dot ${i === 0 ? 'active' : ''}`;
    dot.dataset.index = i;
    dot.onclick = (e) => {
      e.stopPropagation();
      goToSlide(i);
      resetAutoSlide();
    };
    dotsContainer.appendChild(dot);
  }

  function updateDots() {
    const dots = dotsContainer.querySelectorAll('.banner-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentIndex);
    });
  }

  function goToSlide(index) {
    currentIndex = (index + totalSlides) % totalSlides;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    updateDots();
  }

  function nextSlide() {
    goToSlide(currentIndex + 1);
  }

  function prevSlide() {
    goToSlide(currentIndex - 1);
  }

  function startAutoSlide() {
    stopAutoSlide();
    heroBannerTimer = setInterval(nextSlide, slideDuration);
  }

  function stopAutoSlide() {
    if (heroBannerTimer) {
      clearInterval(heroBannerTimer);
      heroBannerTimer = null;
    }
  }

  function resetAutoSlide() {
    stopAutoSlide();
    startAutoSlide();
  }

  // Touch and drag swipe gestures
  let startX = 0;
  let isDragging = false;

  container.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
    stopAutoSlide();
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const endX = e.changedTouches[0].clientX;
    const diffX = endX - startX;
    if (diffX < -40) {
      nextSlide();
    } else if (diffX > 40) {
      prevSlide();
    }
    startAutoSlide();
  });

  // Mouse drag support for desktop
  container.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    isDragging = true;
    stopAutoSlide();
  });

  container.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diffX = e.clientX - startX;
    if (diffX < -40) {
      nextSlide();
    } else if (diffX > 40) {
      prevSlide();
    }
    startAutoSlide();
  });

  container.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
    }
    startAutoSlide();
  });

  container.addEventListener('mouseenter', stopAutoSlide);

  // Start auto slide
  startAutoSlide();
}

// Game Category Section Scroll & Active State
function scrollToGameSection(sectionId, btnElement) {
  if (btnElement) {
    document.querySelectorAll('.cat-logo-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    const bar = document.querySelector('.game-category-bar');
    if (bar) {
      const btnLeft = btnElement.offsetLeft;
      const btnWidth = btnElement.offsetWidth;
      const barWidth = bar.offsetWidth;
      bar.scrollTo({
        left: btnLeft - (barWidth / 2) + (btnWidth / 2),
        behavior: 'smooth'
      });
    }
  }
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Category ScrollSpy so sticky bar reflects currently viewed section
function initCategoryScrollSpy() {
  const sections = [
    { id: 'sec-popular', btnIndex: 0 },
    { id: 'sec-lottery', btnIndex: 1 },
    { id: 'sec-minigames', btnIndex: 2 },
    { id: 'sec-slots', btnIndex: 3 },
    { id: 'sec-sports', btnIndex: 4 },
    { id: 'sec-casino', btnIndex: 5 },
    { id: 'sec-pvc', btnIndex: 6 },
    { id: 'sec-fishing', btnIndex: 7 }
  ];

  const buttons = document.querySelectorAll('.cat-logo-btn');
  if (!buttons.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const match = sections.find(s => s.id === entry.target.id);
        if (match && buttons[match.btnIndex]) {
          buttons.forEach(b => b.classList.remove('active'));
          const activeBtn = buttons[match.btnIndex];
          activeBtn.classList.add('active');
          const bar = document.querySelector('.game-category-bar');
          if (bar) {
            bar.scrollTo({
              left: activeBtn.offsetLeft - (bar.offsetWidth / 2) + (activeBtn.offsetWidth / 2),
              behavior: 'smooth'
            });
          }
        }
      }
    });
  }, {
    rootMargin: '-100px 0px -50% 0px',
    threshold: 0.1
  });

  sections.forEach(s => {
    const el = document.getElementById(s.id);
    if (el) observer.observe(el);
  });
}

// Winning Information Live Feed Ticker
function initWinningInfoTicker() {
  const container = document.getElementById('winningInfoContainer');
  if (!container) return;

  const sampleUsers = ['Mem***KYU', 'Mem***POW', 'Mem***TRX', 'Mem***KNG', 'Mem***LIV', 'Mem***X78'];
  const sampleAmounts = ['₹420.00', '₹1,250.00', '₹350.50', '₹2,840.00', '₹630.00', '₹890.00'];
  const sampleColors = ['var(--accent-red)', 'var(--accent-gold)', 'var(--accent-blue)', 'var(--accent-green)'];

  setInterval(() => {
    const homeView = document.getElementById('homeView');
    if (!homeView || !homeView.classList.contains('active-view')) return;

    const items = container.querySelectorAll('.winner-row-card');
    if (items.length > 5) {
      items[items.length - 1].remove();
    }

    const u = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
    const amt = sampleAmounts[Math.floor(Math.random() * sampleAmounts.length)];
    const col = sampleColors[Math.floor(Math.random() * sampleColors.length)];
    const av = Math.random() > 0.5 ? 'avatar.png' : 'assets/avatar2.png';

    const newCard = document.createElement('div');
    newCard.className = 'winner-row-card';
    newCard.style.animation = 'fadeIn 0.35s ease-out';
    newCard.innerHTML = `
      <div class="winner-avatar-col">
        <div class="winner-avatar-wrap">
          <img src="${av}" alt="User Avatar">
          <span class="winner-vip-tag">V1</span>
        </div>
      </div>
      <div class="winner-card-body">
        <div class="winner-user-col">
          <span class="winner-user-name">${u}</span>
        </div>
        <div class="winner-game-badge">
          <svg viewBox="0 0 24 24" fill="${col}"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="#ffffff"/></svg>
        </div>
        <div class="winner-amount-col">
          <span class="winner-amount-val">${amt}</span>
          <span class="winner-amount-label">Winning amount</span>
        </div>
      </div>
    `;
    container.insertBefore(newCard, container.firstChild);
  }, 4500);
}

// Generic Modal Helpers
function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('active');
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('active');
}

// Start Loading Screen & Popup Orchestrator
function runStartLoadingScreen() {
  const splash = document.getElementById('startLoadingScreen');
  const bar = document.getElementById('splashProgressBar');
  const txt = document.getElementById('splashProgressText');
  if (!splash) return;

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 8) + 6;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      if (bar) bar.style.width = '100%';
      if (txt) txt.textContent = 'Loading... 100%';

      setTimeout(() => {
        splash.classList.add('fade-out');
        setTimeout(() => {
          splash.style.display = 'none';
          triggerMainPopupsSequence();
        }, 450);
      }, 350);
    } else {
      if (bar) bar.style.width = progress + '%';
      if (txt) txt.textContent = `Loading... ${progress}%`;
    }
  }, 40);
}

function triggerMainPopupsSequence() {
  // All intro promotional popups removed — no action needed
}

function nextFromWelcomeBonus() {
  // welcomeBonusModal removed — legacy function kept for safety
  closeModal('welcomeBonusModal');
  closeModal('extraDepositModal');
}

function nextFromRaxiAgent() {
  // raxiAgentModal removed — legacy function kept for safety
  closeModal('raxiAgentModal');
  closeModal('extraDepositModal');
}

function toggleNoMoreReminders() {
  const radio = document.getElementById('noMoreReminderRadio');
  if (!radio) return;
  radio.classList.toggle('checked');
  if (radio.classList.contains('checked')) {
    localStorage.setItem('no_reminder_date', new Date().toDateString());
  } else {
    localStorage.removeItem('no_reminder_date');
  }
}

function goToFirstDepositActivity() {
  closeModal('extraDepositModal');
  openFirstDepositBonusPage();
}

function openFirstDepositBonusPage() {
  if (typeof switchMainTab === 'function') {
    switchMainTab('first_deposit');
  } else {
    document.querySelectorAll('.main-view-page').forEach(v => v.classList.remove('active-view'));
    const page = document.getElementById('firstDepositBonusView');
    if (page) {
      page.classList.add('active-view');
    }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeFirstDepositBonusPage() {
  if (typeof switchMainTab === 'function') {
    switchMainTab('home');
  } else {
    document.querySelectorAll('.main-view-page').forEach(v => v.classList.remove('active-view'));
    const page = document.getElementById('homeView');
    if (page) page.classList.add('active-view');
  }
}

// Initial Bootstrapping
document.addEventListener('DOMContentLoaded', () => {
  initializeDatabase();
  initHeroBannerSlider();
  initWinningInfoTicker();
  initCategoryScrollSpy();
  runStartLoadingScreen();

  // Authentication check
  const isAuth = (function() {
    try {
      const u = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!u) return false;
      const parsed = JSON.parse(u);
      return !!(parsed && (parsed.uid || parsed.identifier));
    } catch (e) {
      return false;
    }
  })();

  // 1. Process Referral / Invitation parameters from URL
  checkAndApplyReferralParams();

  // Read URL Hash for initial screen
  const rawHash = (window.location.hash || '').toLowerCase();
  const rawSearch = (window.location.search || '').toLowerCase();
  const isRegister = rawHash.includes('register') || rawSearch.includes('register') || rawSearch.includes('invitationcode');
  const isForgot = rawHash.includes('forgot');

  if (!isAuth) {
    // Unauthenticated: always start on Login or Register screen
    const targetAuth = isRegister ? 'register' : (isForgot ? 'forgot' : 'login');
    if (typeof navigateToAuthScreen === 'function') {
      navigateToAuthScreen(targetAuth);
    } else {
      navigateToScreen(targetAuth);
    }
  } else {
    // Authenticated: route to requested tab or default to home
    const hash = window.location.hash.replace('#', '');
    if (['activity', 'wallet', 'account'].includes(hash)) {
      if (typeof switchMainTab === 'function') {
        switchMainTab(hash);
      }
    } else {
      if (typeof switchMainTab === 'function') {
        switchMainTab('home');
      } else {
        navigateToScreen('login');
      }
    }
  }

  // Restore remembered phone if exists (NEVER restore admin-like entries)
  const remembered = localStorage.getItem(STORAGE_KEYS.REMEMBERED_PHONE);
  // Security: clear any admin credentials that may have been accidentally saved
  const suspiciousPatterns = ['admin', 'administrator', 'root', 'superuser'];
  if (remembered && suspiciousPatterns.some(p => remembered.toLowerCase() === p)) {
    localStorage.removeItem(STORAGE_KEYS.REMEMBERED_PHONE);
  } else if (remembered) {
    const loginIdentifier = document.getElementById('loginIdentifier');
    const rememberCheckbox = document.getElementById('rememberCheckbox');
    if (loginIdentifier) loginIdentifier.value = remembered;
    if (rememberCheckbox) rememberCheckbox.classList.add('checked');
  }

  // Search filter for country list
  const searchInput = document.getElementById('countrySearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderCountryList(e.target.value);
    });
  }

  // Close modals on outside click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // Watch for input changes in Login to dynamically style the "Log in" button
  const loginId = document.getElementById('loginIdentifier');
  const loginPass = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginSubmitBtn');
  function checkLoginInputs() {
    if (loginBtn && loginId && loginPass) {
      if (loginId.value.trim() && loginPass.value.trim()) {
        loginBtn.classList.remove('is-inactive');
      } else {
        loginBtn.classList.add('is-inactive');
      }
    }
  }
  if (loginId && loginPass) {
    loginId.addEventListener('input', checkLoginInputs);
    loginPass.addEventListener('input', checkLoginInputs);
    checkLoginInputs();
  }
});

// Auto Pre-fill Invitation Code from URL or Hash in app.js
function checkAndApplyReferralParams() {
  try {
    let inviteCode = '';
    const fullHref = window.location.href;

    // 1. Check window.location.search (?invitationCode=...)
    if (window.location.search) {
      const sp = new URLSearchParams(window.location.search);
      inviteCode = sp.get('invitationCode') || sp.get('inviteCode') || sp.get('code') || sp.get('ref') || '';
    }

    // 2. Check window.location.hash (#/register?invitationCode=...)
    if (!inviteCode && window.location.hash) {
      const hashStr = window.location.hash;
      const qIdx = hashStr.indexOf('?');
      if (qIdx !== -1) {
        const hp = new URLSearchParams(hashStr.substring(qIdx + 1));
        inviteCode = hp.get('invitationCode') || hp.get('inviteCode') || hp.get('code') || hp.get('ref') || '';
      }
    }

    // 3. Fallback regex
    if (!inviteCode) {
      const m = fullHref.match(/[?&#](?:invitationCode|inviteCode|code|ref)=([A-Za-z0-9_-]+)/i);
      if (m && m[1]) inviteCode = m[1];
    }

    if (inviteCode) {
      localStorage.setItem('raxi_referral_preset_code', inviteCode);
    } else {
      inviteCode = localStorage.getItem('raxi_referral_preset_code') || '';
    }

    if (inviteCode) {
      const inputs = document.querySelectorAll('#registerInviteCode');
      inputs.forEach(inp => {
        if (inp) inp.value = inviteCode;
      });
    }

    const rawHash = (window.location.hash || '').toLowerCase();
    const rawSearch = (window.location.search || '').toLowerCase();
    const isRegisterRoute = rawHash.includes('register') || rawSearch.includes('register');

    if (isRegisterRoute) {
      if (typeof navigateToAuthScreen === 'function') {
        navigateToAuthScreen('register');
      } else if (typeof navigateToScreen === 'function') {
        navigateToScreen('register');
      }
      setTimeout(() => {
        const regInp = document.getElementById('registerInviteCode');
        if (regInp && inviteCode) regInp.value = inviteCode;
      }, 80);
    }
  } catch (e) {
    console.error('checkAndApplyReferralParams error in app.js:', e);
  }
}

window.addEventListener('hashchange', checkAndApplyReferralParams);

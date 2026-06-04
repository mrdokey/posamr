/**
 * MODUL 1: CONFIG & KEYPAD SESSION
 */
lucide.createIcons();

// Kunci Memori Lokal & URL API Terkunci (SaaS Model)
const GAS_URL = "https://script.google.com/macros/s/AKfycbxUP-K2iIaP8qF8ZBjeOI3h0OG7du_wcJQE2qM507YTb7magRRZejs6DZmqzy-Dulgy/exec";
const STORAGE_USER = "MRD_CASHIER";
const OFFLINE_QUEUE_KEY = "MRD_OFFLINE_QUEUE";
const LOCAL_OPEN_BILLS_KEY = "MRD_LOCAL_OPEN_BILLS";

let cashierInfo = null;
try { 
  cashierInfo = JSON.parse(localStorage.getItem(STORAGE_USER)); 
} catch(e) { 
  localStorage.removeItem(STORAGE_USER); 
}

// Inisialisasi State Aplikasi
let configData = {};
let menuData = [];
let discountData = []; 
let filteredData = []; 
let cart = [];
let currentCategory = 'Semua';
let activeOrderId = null; 
let historyDataRaw = [];
let voidTargetId = null;
let pollInterval = null; 

// --- SISTEM AUTO-ENTER PIN KASIR (TOUCH & KEYBOARD) ---
let loginPinValue = "";

function pressNum(num) {
    if(loginPinValue.length < 4) {
        loginPinValue += num;
        document.getElementById('login-pin').value = loginPinValue;
        updateLoginDots();
        if(loginPinValue.length === 4) setTimeout(loginKasir, 300);
    }
}

function backspacePin() {
    if(loginPinValue.length > 0) {
        loginPinValue = loginPinValue.slice(0, -1);
        document.getElementById('login-pin').value = loginPinValue;
        updateLoginDots();
    }
}

function clearPin() { 
    loginPinValue = ""; 
    const pinEl = document.getElementById('login-pin');
    if (pinEl) pinEl.value = ""; 
    updateLoginDots(); 
}

function updateLoginDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, idx) => {
        if(idx < loginPinValue.length) { 
            dot.classList.add('bg-amber-500', 'border-amber-500'); 
            dot.classList.remove('bg-transparent', 'border-slate-600'); 
        } else { 
            dot.classList.remove('bg-amber-500', 'border-amber-500'); 
            dot.classList.add('bg-transparent', 'border-slate-600'); 
        }
    });
}

function handlePhysicalKeyboard(e) {
    let val = this.value.replace(/[^0-9]/g, ''); 
    if (val.length > 4) val = val.substring(0, 4);
    
    loginPinValue = val;
    this.value = val;
    updateLoginDots();
    
    if (loginPinValue.length === 4) setTimeout(loginKasir, 300);
}

// --- STARTUP ROUTING ---
window.onload = () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.classList.add('hidden-screen');
                checkState();
            }, 500);
        }
    }, 1000); 
};

function checkState() {
    if (!cashierInfo) {
        showScreen('login-screen');
        fetchConfigBg();
        clearPin();
        const pinInput = document.getElementById('login-pin');
        if (pinInput) {
            pinInput.value = ""; 
            pinInput.focus();
            pinInput.removeEventListener('input', handlePhysicalKeyboard);
            pinInput.addEventListener('input', handlePhysicalKeyboard);
        }
    } else {
        showScreen('main-app');
        document.getElementById('kasir-name').innerText = cashierInfo.name;
        initApp();
        updateOfflineBadge();
        applyJobdeskRules(); 
        
        window.removeEventListener('resize', updateMobileCartButtonVisibility);
        window.addEventListener('resize', updateMobileCartButtonVisibility);
    }
}

function showScreen(id) {
    ['login-screen', 'main-app'].forEach(el => {
        const screen = document.getElementById(el);
        if (screen) screen.classList.add('hidden-screen');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden-screen');
}

function openModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden-screen'); 
}

function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden-screen'); 
    updateMobileCartButtonVisibility();
}

function resetLicense() {
    if(confirm("Yakin ingin menghapus semua data dan reset cache?")) {
        localStorage.clear();
        window.location.reload();
    }
}
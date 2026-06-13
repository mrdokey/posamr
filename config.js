/**
 * MODUL 1: CONFIG & KEYPAD SESSION
 * UPDATE: Dynamic SaaS License Check (No Hardcoded GAS URL)
 */
lucide.createIcons();

// KUNCI AMAN SAAS: Mengambil URL API Lisensi secara dinamis dari memori perangkat
const STORAGE_API = "MRD_API_URL";
let GAS_URL = localStorage.getItem(STORAGE_API);

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
let voucherData = []; 
let appliedVoucher = null; 

let filteredData = []; 
let cart = [];
let currentCategory = 'Semua';
let activeOrderId = null; 
let historyDataRaw = [];
let voidTargetId = null;
let pollInterval = null; 

// Global State Tambahan untuk Pembayaran Gabungan & Pembulatan Kasir
window.lastCashReceived = 0;
window.lastNonCashReceived = 0;
window.lastNonCashMethod = "";
window.lastRoundingAdjustment = 0;

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
    // PROTEKSI UTAMA SAAS: Jika Lisensi Kosong, paksa alihkan perangkat ke halaman Aktivasi Absensi
    if (!GAS_URL) {
        alert("Aplikasi Kasir Belum Diaktivasi!\n\nAnda akan dialihkan ke halaman utama Absensi untuk memasukkan URL API Lisensi.");
        window.location.href = "index.html";
        return;
    }

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
        const allowedRoles = ["admin", "hrd", "manager", "owner"];
        const jobdeskClean = cashierInfo.jobdesk ? cashierInfo.jobdesk.toLowerCase().trim() : "";
        const roleClean = cashierInfo.role ? cashierInfo.role.toLowerCase().trim() : "";

        if (jobdeskClean !== "kasir" && !allowedRoles.includes(roleClean)) {
            localStorage.removeItem(STORAGE_USER);
            window.location.reload();
            return;
        }

        showScreen('main-app');
        document.getElementById('kasir-name').innerText = cashierInfo.name;
        initApp();
        updateOfflineBadge();
        
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
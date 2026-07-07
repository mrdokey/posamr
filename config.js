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
    // 1. PROTEKSI UTAMA SAAS: Jika Lisensi Kosong, tampilkan layar aktivasi lokal
    if (!GAS_URL) {
        showScreen('activation-screen');
        return;
    }

    // 2. SAFETY LOCKDOWN: Blokir keras jika perangkat ini bukan Terminal Kasir Resmi
    if (localStorage.getItem("MRD_POS_TERMINAL") !== "true") {
        alert("Akses Ditolak!\n\nPerangkat ini belum didaftarkan sebagai Terminal Kasir Resmi. Modul kasir hanya boleh diakses melalui tablet kasir resmi outlet!");
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
        const allowedRoles = ["administrator", "admin", "hrd", "manager", "owner"];
        const jobdeskClean = cashierInfo.jobdesk ? cashierInfo.jobdesk.toLowerCase().trim() : "";
        const roleClean = cashierInfo.role ? cashierInfo.role.toLowerCase().trim() : "";

        let isCashier = jobdeskClean.includes("cashier");
        let isAdmin = allowedRoles.includes(roleClean) || roleClean.includes("admin");

        if (!isCashier && !isAdmin) {
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

// =========================================================================
// SAAS WHITE-LABEL: GLOBAL WINDOW.ALERT INTERCEPTOR (THE ARIA THEME)
// Mengganti alert bawaan browser menjadi modal AMR tanpa merusak logika JS lain
// =========================================================================
(function() {
    // Simpan fungsi alert asli bawaan browser sebagai cadangan keselamatan
    const nativeBrowserAlert = window.alert;

    window.alert = function(message) {
        // Jika dokumen bodi belum siap sepenuhnya, gunakan alert asli browser
        if (!document.body) {
            nativeBrowserAlert(message);
            return;
        }

        // Cari apakah kontainer modal kustom AMR sudah ada di halaman
        let amrModal = document.getElementById('amr-custom-alert');
        
        if (!amrModal) {
            // Buat kontainer modal kustom secara dinamis (bebas dari sentuhan edit HTML)
            amrModal = document.createElement('div');
            amrModal.id = 'amr-custom-alert';
            amrModal.className = 'fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center p-6 smooth-transition hidden-screen';
            
            // Render struktur modal dengan gaya gelap premium berlogo AMR
            amrModal.innerHTML = `
                <div class="bg-slate-900 border-2 border-amber-500/20 rounded-3xl w-full max-w-xs p-6 shadow-2xl text-center scale-95 transition-all duration-300">
                    <div class="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <img src="https://lh3.googleusercontent.com/d/1ZXs1pIaPk7EjfcGIu5rew4qO9kQXoNlF" class="w-8 h-8 rounded object-cover" onerror="this.style.display='none';">
                    </div>
                    <h3 class="text-xs font-black text-amber-500 uppercase tracking-widest mb-2">Pemberitahuan</h3>
                    <p id="amr-alert-text" class="text-xs text-slate-300 leading-relaxed mb-6 whitespace-pre-line"></p>
                    <button id="amr-alert-ok-btn" class="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition active:scale-95 shadow-lg shadow-amber-500/10">OKE</button>
                </div>
            `;
            document.body.appendChild(amrModal);

            // Pasang event listener pada tombol OKE untuk menutup modal
            document.getElementById('amr-alert-ok-btn').addEventListener('click', function() {
                const modalElement = document.getElementById('amr-custom-alert');
                modalElement.classList.add('hidden-screen');
                modalElement.firstElementChild.classList.add('scale-95');
            });
        }

        // Masukkan isi pesan teks ke dalam modal
        document.getElementById('amr-alert-text').innerText = message;

        // Tampilkan modal kustom AMR ke layar kasir dengan efek scale-up yang sangat halus
        amrModal.classList.remove('hidden-screen');
        setTimeout(() => {
            amrModal.firstElementChild.classList.remove('scale-95');
        }, 10);
    };
})();

// ==========================================
// AKTIVASI MANDIRI MESIN KASIR (PORTABLE)
// ==========================================
async function activateSystem() { 
    const input = document.getElementById('api-input').value.trim(); 
    if(!input) return alert("Masukkan URL API Deploy Anda!"); 
    const btn = document.getElementById('btn-activate');
    if (btn) btn.innerHTML = "Memeriksa..."; 

    try {
        const res = await fetch(input, { method: 'POST', body: JSON.stringify({ action: 'getConfig' }) });
        const json = await res.json();
        if(json.success) {
            localStorage.setItem(STORAGE_API, input);
            
            // SUNTIKAN TOKEN OTORISASI: Daftarkan perangkat fisik ini sebagai Terminal Kasir Resmi
            localStorage.setItem("MRD_POS_TERMINAL", "true"); 
            
            GAS_URL = input;
            window.location.reload(); 
        } else {
            throw new Error("Gagal melakukan verifikasi konfigurasi.");
        }
    } catch (e) {
        alert("URL API tidak valid atau tidak merespon!");
        if (btn) btn.innerHTML = "Aktifkan Kasir";
    }
}
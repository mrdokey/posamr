/**
 * MODUL: PORTAL KARYAWAN (ABSENSI, UBAH PIN, OTP, & SSO ROUTING)
 */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.error(err));
    });
}

lucide.createIcons();

const STORAGE_API = "MRD_API_URL";
let GAS_URL = localStorage.getItem(STORAGE_API);

let currentPin = "";
let verifiedUser = {};
let currentActionType = ""; 
let currentLatLong = "";
let streamObject = null;
let countdownInterval = null;
let otpInterval = null;

let isBypassRequest = false;
let bypassReason = "";
let bypassManagerPin = "";

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

// FILE: absen.js (Cari dan ganti fungsi checkState)

function checkState() {
    if (!GAS_URL) {
        showScreen('activation-screen');
    } else {
        // Cek apakah ada session aktif Kasir atau Pelayan di perangkat ini
        const hasCashierSession = localStorage.getItem("MRD_CASHIER");
        const hasWaiterSession = localStorage.getItem("MRD_WAITER_SESSION");
        
        // Tampilkan layar PIN, tapi biarkan tombol "Aplikasi" muncul jika ada session
        showScreen('pin-screen');
        
        // Tombol Aplikasi Manual di layar PIN akan langsung mengarah ke session aktif
        const appShortcutBtn = document.getElementById('btn-manual-app-shortcut');
        if (appShortcutBtn) {
            if (hasCashierSession || hasWaiterSession) {
                appShortcutBtn.classList.remove('hidden'); // Munculkan ikon kotak-kotak di pojok
            } else {
                appShortcutBtn.classList.add('hidden'); // Sembunyikan jika belum login
            }
        }

        fetchConfigBg();
    }
}

// Menampilkan layar utama, sembunyikan yang lain
function showScreen(id) {
    const screens = ['activation-screen', 'pin-screen', 'dashboard-screen', 'sub-absen-screen', 'sub-otp-screen', 'sub-pin-screen', 'capture-screen', 'success-screen'];
    screens.forEach(el => {
        const screen = document.getElementById(el);
        if (screen) screen.classList.add('hidden-screen');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden-screen');
    lucide.createIcons();
}

async function activateSystem() {
    const input = document.getElementById('api-input').value.trim();
    if(!input) return alert("Masukkan URL!");
    const btn = document.getElementById('btn-activate');
    btn.innerHTML = `Loading...`;
    
    try {
        const res = await fetch(input, { method: 'POST', body: JSON.stringify({ action: 'getConfig' }) });
        const json = await res.json();
        if(json.success) {
            localStorage.setItem(STORAGE_API, input);
            GAS_URL = input;
            window.location.reload();
        } else throw new Error("Gagal");
    } catch (e) {
        alert("URL API tidak valid!");
        btn.innerHTML = "Aktifkan Kiosk";
    }
}

async function fetchConfigBg() {
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getConfig' }) });
        const json = await res.json();
        if(json.success) document.getElementById('absen-resto-name').innerText = json.data["NAMA_PERUSAAN"] || "LABARAC BAR";
    } catch(e) {}
}

function resetLicense() {
    if(confirm("Yakin ingin menghapus Lisensi API dari perangkat ini?")) {
        localStorage.removeItem(STORAGE_API);
        window.location.reload();
    }
}

// --- FUNGSI NUMPAD PIN (LAYAR AWAL) ---
function updatePinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, idx) => {
        if (idx < currentPin.length) {
            dot.classList.remove('border-slate-600', 'bg-transparent');
            dot.classList.add('border-amber-500', 'bg-amber-500');
        } else {
            dot.classList.remove('border-amber-500', 'bg-amber-500');
            dot.classList.add('border-slate-600', 'bg-transparent');
        }
    });
}

function pressNum(num) {
    if (currentPin.length < 4) {
        currentPin += num;
        updatePinDots();
        if (currentPin.length === 4) {
            setTimeout(verifyPin, 300);
        }
    }
}

function backspacePin() {
    if (currentPin.length > 0) {
        currentPin = currentPin.slice(0, -1);
        updatePinDots();
    }
}

function clearPin() {
    currentPin = "";
    updatePinDots();
}

// --- VERIFIKASI PIN & MASUK DASHBOARD ---
async function verifyPin() {
    if(currentPin.length < 4) return;
    
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach(dot => dot.classList.add('animate-pulse'));

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "checkUserStatus", data: { pin: currentPin } })
        });
        const json = await res.json();
        
        if (json.success) {
            verifiedUser = json;
            openDashboard();
        } else {
            alert(json.message);
            clearPin();
        }
    } catch (e) {
        alert("Koneksi gagal ke database!");
        clearPin();
    } finally {
        dots.forEach(dot => dot.classList.remove('animate-pulse'));
    }
}

// --- PUSAT NAVIGASI (DASHBOARD HUB) ---
function openDashboard() {
    showScreen('dashboard-screen');
    document.getElementById('emp-name').innerText = verifiedUser.name;
    document.getElementById('emp-area').innerText = verifiedUser.area || "PUSAT";
}

function logoutDashboard() {
    clearInterval(countdownInterval);
    clearInterval(otpInterval);
    currentPin = "";
    verifiedUser = {};
    clearPin();
    showScreen('pin-screen');
}

function backToDashboard() {
    clearInterval(otpInterval);
    showScreen('dashboard-screen');
}

// --- ROUTER MENU DASHBOARD ---
function openSubScreen(menu) {
    if (menu === 'absen') {
        setupAbsensiMenu();
    } else if (menu === 'otp') {
        showScreen('sub-otp-screen');
        startOtpGenerator();
    } else if (menu === 'pin') {
        showScreen('sub-pin-screen');
        document.getElementById('pin-old').value = "";
        document.getElementById('pin-new').value = "";
    }
}

// --- 1. LOGIKA MENU ABSENSI ---
function setupAbsensiMenu() {
    showScreen('sub-absen-screen');
    
    const msg = document.getElementById('status-msg');
    const sub = document.getElementById('status-sub');
    const timerContainer = document.getElementById('timer-container');
    
    clearInterval(countdownInterval);
    timerContainer.classList.add('hidden-screen');
    sub.innerHTML = "";

    document.getElementById('btn-clock-in').classList.add('hidden-screen');
    document.getElementById('btn-clock-out').classList.add('hidden-screen');
    document.getElementById('btn-bypass').classList.add('hidden-screen');

    if (verifiedUser.status === "OUT") {
        msg.innerText = "Status: BELUM ABSEN (OUT)";
        sub.innerText = "Silakan tekan Absen Masuk untuk mulai bekerja.";
        document.getElementById('btn-clock-in').classList.remove('hidden-screen');
    } else {
        msg.innerText = verifiedUser.message; 
        if (verifiedUser.canClockOut) {
            sub.innerText = "Shift Selesai. Anda diizinkan Absen Pulang.";
            document.getElementById('btn-clock-out').classList.remove('hidden-screen');
        } else {
            if (verifiedUser.remainingMs) {
                startLiveTimer(verifiedUser.remainingMs);
            } else {
                sub.innerText = verifiedUser.remaining;
            }
            document.getElementById('btn-bypass').classList.remove('hidden-screen'); 
        }
    }
}

function startLiveTimer(durationMs) {
    clearInterval(countdownInterval); 
    let msRemaining = durationMs;
    const timerText = document.getElementById('status-timer');
    document.getElementById('timer-container').classList.remove('hidden-screen');

    function updateTimerVisual() {
        if (msRemaining <= 0) {
            clearInterval(countdownInterval);
            verifyPin(); // Segarkan data jika waktu habis
            return;
        }
        let hours = Math.floor(msRemaining / (1000 * 60 * 60));
        let minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.floor((msRemaining % (1000 * 60)) / 1000);
        timerText.innerText = [hours, minutes, seconds].map(v => v < 10 ? "0" + v : v).join(":");
        msRemaining -= 1000; 
    }
    updateTimerVisual(); 
    countdownInterval = setInterval(updateTimerVisual, 1000);
}

function triggerIzinCepat() {
    clearInterval(countdownInterval);
    let reason = prompt("Masukkan alasan izin pulang cepat (misal: Sakit):");
    if (!reason || reason.trim() === "") {
        if(verifiedUser.remainingMs) startLiveTimer(verifiedUser.remainingMs);
        return; 
    }
    isBypassRequest = true;
    bypassReason = reason;
    startCapture('OUT');
}

// --- FUNGSI KAMERA & GPS (ABSEN) ---
function startCapture(type) {
    currentActionType = type;
    showScreen('capture-screen');
    initCamera();
    initGPS();
}

async function initCamera() {
    try {
        streamObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        document.getElementById('webcam').srcObject = streamObject;
    } catch (e) {
        alert("Gagal mengakses kamera! Izinkan kamera di browser.");
    }
}

function initGPS() {
    const gpsText = document.getElementById('gps-status');
    const snapBtn = document.getElementById('btn-snap');
    snapBtn.disabled = true;

    if (!navigator.geolocation) {
        gpsText.innerText = "GPS tidak didukung perangkat ini!";
        return;
    }

    navigator.geolocation.getCurrentPosition(pos => {
        currentLatLong = `${pos.coords.latitude},${pos.coords.longitude}`;
        gpsText.innerText = "Lokasi Terkunci (Aman)";
        snapBtn.disabled = false;
    }, err => {
        gpsText.innerText = "Gagal mengunci lokasi. Berikan izin GPS!";
    }, { enableHighAccuracy: true });
}

function capture() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Photo = canvas.toDataURL('image/jpeg', 0.8);
    
    if (streamObject) streamObject.getTracks().forEach(track => track.stop());
    submitAttendanceData(base64Photo);
}

async function submitAttendanceData(photoBase64) {
    const snapBtn = document.getElementById('btn-snap');
    snapBtn.innerText = "Mengirim...";
    snapBtn.disabled = true;

    const payload = {
        action: "submitAttendance",
        data: {
            pin: currentPin,
            type: currentActionType,
            latLong: currentLatLong,
            photoBase64: photoBase64,
            isBypassRequest: isBypassRequest,
            keterangan: bypassReason,
            managerPin: ""
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        
        if (json.success) {
            document.getElementById('success-msg').innerText = json.message;
            showScreen('success-screen');
            
            // JIKA MASUK (IN) -> LEMPAR KE APLIKASI KASIR/PELAYAN (SSO)
            if (currentActionType === "IN") {
                document.getElementById('success-routing-msg').innerText = "Mengalihkan ke Aplikasi Kerja...";
                setTimeout(() => { autoLoginApp(); }, 2000); 
            } else {
                // JIKA PULANG (OUT) -> KEMBALI KE LAYAR PIN AWAL
                document.getElementById('success-routing-msg').innerText = "Sampai Jumpa Besok...";
                setTimeout(() => { logoutDashboard(); }, 3000); 
            }
        } else {
            alert("Absen Ditolak: " + (json.message || "Gagal menyimpan."));
            setupAbsensiMenu();
        }
    } catch (e) {
        alert("Koneksi gagal mengirim data absen!");
        setupAbsensiMenu();
    } finally {
        isBypassRequest = false;
        bypassReason = "";
    }
}

// --- SINGLE SIGN-ON (SSO ROUTING) ---
async function autoLoginApp() {
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'loginPOS', data: { pin: currentPin } }) });
        const json = await res.json();
        
        if (json.success) {
            const allowedRoles = ["admin", "hrd", "manager", "owner"];
            const jobdeskClean = json.jobdesk ? json.jobdesk.toLowerCase().trim() : "";
            const roleClean = json.role ? json.role.toLowerCase().trim() : "";

            if (jobdeskClean === "kasir" || allowedRoles.includes(roleClean)) {
                localStorage.setItem("MRD_CASHIER", JSON.stringify(json));
                window.location.href = "pos.html"; // Routing ke Kasir
            } else if (jobdeskClean === "pelayan") {
                localStorage.setItem("MRD_WAITER_SESSION", JSON.stringify(json));
                window.location.href = "order.html"; // Routing ke Pelayan
            } else {
                alert("Akses Aplikasi Ditolak.");
                logoutDashboard();
            }
        } else {
            alert("Gagal masuk ke sistem POS.");
            logoutDashboard();
        }
    } catch (e) {
        alert("Koneksi gagal saat mencoba masuk ke aplikasi.");
        logoutDashboard();
    }
}

// --- 2. LOGIKA UBAH PIN ---
async function submitNewPin() {
    const oldPin = document.getElementById('pin-old').value.trim();
    const newPin = document.getElementById('pin-new').value.trim();

    if (!oldPin || !newPin) return alert("Lengkapi PIN lama dan PIN baru!");
    if (oldPin !== currentPin) return alert("Konfirmasi PIN lama salah!");
    if (newPin.length !== 4 || isNaN(newPin)) return alert("PIN baru harus berupa 4 angka!");
    if (oldPin === newPin) return alert("PIN baru tidak boleh sama!");

    const btn = document.getElementById('btn-save-pin');
    btn.innerText = "Memproses...";
    btn.disabled = true;

    try {
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: "changeUserPin", 
                data: { userId: verifiedUser.userId, oldPin: oldPin, newPin: newPin } 
            }) 
        });
        const json = await res.json();

        if (json.success) {
            alert("Sukses! PIN berhasil diperbarui. Silakan login kembali dengan PIN baru Anda.");
            logoutDashboard();
        } else {
            alert("Gagal: " + json.message);
        }
    } catch (e) {
        alert("Koneksi bermasalah.");
    } finally {
        btn.innerText = "SIMPAN PIN BARU";
        btn.disabled = false;
    }
}

// --- 3. LOGIKA OTP GENERATOR (1 JAM) ---
function startOtpGenerator() {
    updateOtp();
    otpInterval = setInterval(updateOtp, 1000);
}

function updateOtp() {
    const nowMs = Date.now();
    const interval = Math.floor(nowMs / 3600000); 
    const minutesRemaining = 60 - new Date(nowMs).getMinutes();
    const secondsRemaining = 60 - new Date(nowMs).getSeconds();

    const hash = (interval * 31 + parseInt(currentPin) * 17) % 10000;
    const otpCode = String(hash).padStart(4, '0');

    document.getElementById('otp-text').innerText = otpCode;

    const totalSecondsLeft = (minutesRemaining * 60) + secondsRemaining;
    const progress = (totalSecondsLeft / 3600) * 264; // Dasharray 264
    
    document.getElementById('progress-bar').style.strokeDashoffset = 264 - progress;
    document.getElementById('countdown-text').innerText = minutesRemaining + "m";
}

// FILE: absen.js (Cari dan ganti fungsi openManualLogin)

function openManualLogin() {
    const isCashier = localStorage.getItem("MRD_CASHIER");
    const isWaiter = localStorage.getItem("MRD_WAITER_SESSION");

    if (isCashier) {
        window.location.href = "pos.html";
    } else if (isWaiter) {
        window.location.href = "order.html";
    } else {
        alert("Sesi Anda telah berakhir. Silakan Absen Masuk atau Login ulang.");
    }
}

// FILE: absen.js (Cari dan ganti fungsi openActionScreen)

function openActionScreen() {
    showScreen('action-screen');
    toggleSubSection('main'); 
    
    document.getElementById('emp-name').innerText = verifiedUser.name;
    document.getElementById('emp-area').innerText = verifiedUser.area || "PUSAT"; 
    
    const msg = document.getElementById('status-msg');
    const sub = document.getElementById('status-sub');
    const timerContainer = document.getElementById('timer-container');
    
    clearInterval(countdownInterval);
    clearInterval(otpInterval);
    timerContainer.classList.add('hidden-screen');
    sub.innerHTML = "";

    document.getElementById('btn-clock-in').classList.add('hidden-screen');
    document.getElementById('btn-clock-out').classList.add('hidden-screen');
    document.getElementById('btn-bypass').classList.add('hidden-screen');
    document.getElementById('btn-goto-app').classList.add('hidden-screen');
    document.getElementById('action-otp-container').classList.add('hidden-screen');

    if (verifiedUser.status === "OUT") {
        msg.innerText = "Status Anda: BELUM ABSEN (OUT)";
        sub.innerText = "Silakan tekan Absen Masuk untuk mulai bekerja.";
        document.getElementById('btn-clock-in').classList.remove('hidden-screen');
    } else {
        msg.innerText = verifiedUser.message; 
        
        // PERBAIKAN: Selalu tampilkan tombol "Buka Aplikasi Kerja" asalkan statusnya sudah IN
        document.getElementById('btn-goto-app').classList.remove('hidden-screen');

        const allowedVoidRoles = ["admin", "hrd", "manager", "owner"];
        const roleClean = verifiedUser.role ? verifiedUser.role.toLowerCase().trim() : "";
        if (allowedVoidRoles.includes(roleClean)) {
            document.getElementById('action-otp-container').classList.remove('hidden-screen');
            startOtpGenerator();
        }

        if (verifiedUser.canClockOut) {
            sub.innerText = "Shift Selesai. Anda diizinkan Absen Pulang.";
            document.getElementById('btn-clock-out').classList.remove('hidden-screen');
        } else {
            if (verifiedUser.remainingMs) {
                startLiveTimer(verifiedUser.remainingMs);
            } else {
                sub.innerText = verifiedUser.remaining;
            }
            document.getElementById('btn-bypass').classList.remove('hidden-screen'); 
        }
    }
    lucide.createIcons();
}
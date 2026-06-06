/**
 * MODUL: KIOSK ABSENSI & AUTO-ROUTING SSO
 */

lucide.createIcons();

const STORAGE_API = "MRD_API_URL";
let GAS_URL = localStorage.getItem(STORAGE_API);

let currentPin = "";
let verifiedUser = {};
let currentActionType = ""; 
let currentLatLong = "";
let streamObject = null;
let countdownInterval;

let isBypassRequest = false;
let bypassReason = "";
let bypassManagerPin = "";
let deferredPrompt;

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
    if (!GAS_URL) {
        showScreen('activation-screen');
    } else {
        showScreen('pin-screen');
        fetchConfigBg();
    }
}

function showScreen(id) {
    ['activation-screen', 'pin-screen', 'action-screen', 'capture-screen', 'success-screen'].forEach(el => {
        const screen = document.getElementById(el);
        if (screen) screen.classList.add('hidden-screen');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden-screen');
}

// --- FUNGSI AKTIVASI API ---
async function activateSystem() {
    const input = document.getElementById('api-input').value.trim();
    if(!input) return alert("Masukkan URL!");
    const btn = document.getElementById('btn-activate');
    btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto"></i>`;
    lucide.createIcons();
    
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
        if(json.success) document.getElementById('absen-resto-name').innerText = json.data["NAMA_PERUSAAN"] || "AMR SYSTEM";
    } catch(e) {}
}

function resetLicense() {
    if(confirm("Yakin ingin menghapus Lisensi API dari perangkat ini?")) {
        localStorage.removeItem(STORAGE_API);
        window.location.reload();
    }
}

// --- FUNGSI NUMPAD PIN ---
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

// --- LOGIKA UTAMA ABSENSI ---
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
            openActionScreen();
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

function openActionScreen() {
    showScreen('action-screen');
    document.getElementById('emp-name').innerText = verifiedUser.name;
    document.getElementById('emp-area').innerText = verifiedUser.area || "PUSAT"; // MENAMPILKAN AREA
    
    const msg = document.getElementById('status-msg');
    const sub = document.getElementById('status-sub');
    const timerContainer = document.getElementById('timer-container');
    
    clearInterval(countdownInterval);
    timerContainer.classList.add('hidden-screen');
    sub.innerHTML = "";

    document.getElementById('btn-clock-in').classList.add('hidden-screen');
    document.getElementById('btn-clock-out').classList.add('hidden-screen');
    document.getElementById('btn-bypass').classList.add('hidden-screen');
    document.getElementById('btn-goto-app').classList.add('hidden-screen');

    if (verifiedUser.status === "OUT") {
        msg.innerText = "Status Anda: BELUM ABSEN (OUT)";
        sub.innerText = "Silakan tekan Absen Masuk untuk mulai bekerja.";
        document.getElementById('btn-clock-in').classList.remove('hidden-screen');
    } else {
        msg.innerText = verifiedUser.message; 
        
        // MUNCULKAN TOMBOL BUKA APLIKASI KARENA SUDAH MASUK SHIFT
        document.getElementById('btn-goto-app').classList.remove('hidden-screen');

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
    const timerContainer = document.getElementById('timer-container');
    const timerText = document.getElementById('status-timer');
    timerContainer.classList.remove('hidden-screen');

    function updateTimerVisual() {
        if (msRemaining <= 0) {
            clearInterval(countdownInterval);
            verifyPin(); 
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

function cancelAction() {
    clearInterval(countdownInterval);
    if (streamObject) streamObject.getTracks().forEach(track => track.stop());
    clearPin();
    showScreen('pin-screen');
}

// --- FUNGSI KAMERA & GPS ---
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
        gpsText.innerText = "Gagal mengunci lokasi. Berikan izin!";
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
            managerPin: bypassManagerPin
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        
        if (json.success) {
            document.getElementById('success-msg').innerText = json.message;
            showScreen('success-screen');
            
            // LOGIKA ROUTING SETELAH ABSEN SUKSES
            if (currentActionType === "IN") {
                document.getElementById('success-routing-msg').innerText = "Mengalihkan ke Aplikasi Kerja...";
                setTimeout(() => { autoLoginApp(); }, 2000); // Lanjut SSO
            } else {
                document.getElementById('success-routing-msg').innerText = "Kiosk reset otomatis dalam 3 detik...";
                setTimeout(() => { resetKiosk(); }, 3000); // Pulang -> Reset
            }

        } else {
            alert("Absen Ditolak: " + (json.message || "Gagal menyimpan."));
            showScreen('action-screen');
            openActionScreen();
        }
    } catch (e) {
        alert("Koneksi gagal mengirim data absen!");
        showScreen('action-screen');
    } finally {
        isBypassRequest = false;
        bypassReason = "";
        bypassManagerPin = "";
        snapBtn.innerText = "AMBIL FOTO";
    }
}

// --- SINGLE SIGN-ON (SSO) AUTO ROUTING ---
async function autoLoginApp() {
    const btn = document.getElementById('btn-goto-app');
    if (btn) btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Menyiapkan Aplikasi...`;
    
    try {
        // Tarik data role & jobdesk dengan API loginPOS
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'loginPOS', data: { pin: currentPin } }) });
        const json = await res.json();
        
        if (json.success) {
            const allowedRoles = ["admin", "hrd", "manager", "owner"];
            const jobdeskClean = json.jobdesk ? json.jobdesk.toLowerCase().trim() : "";
            const roleClean = json.role ? json.role.toLowerCase().trim() : "";

            // Routing Cerdas berdasarkan Jobdesk
            if (jobdeskClean === "kasir" || allowedRoles.includes(roleClean)) {
                localStorage.setItem("MRD_CASHIER", JSON.stringify(json));
                window.location.href = "pos.html"; // Lompat ke Kasir
            } else if (jobdeskClean === "pelayan") {
                localStorage.setItem("MRD_WAITER_SESSION", JSON.stringify(json));
                window.location.href = "order.html"; // Lompat ke Pelayan
            } else {
                alert("Akses Aplikasi Ditolak. Hubungi Admin.");
                if (btn) btn.innerHTML = `<i data-lucide="rocket" class="w-5 h-5"></i> BUKA APLIKASI KERJA`;
            }
        } else {
            alert("Sistem POS terkunci: " + json.message);
            if (btn) btn.innerHTML = `<i data-lucide="rocket" class="w-5 h-5"></i> BUKA APLIKASI KERJA`;
        }
    } catch (e) {
        alert("Koneksi gagal saat mencoba masuk ke aplikasi.");
        if (btn) btn.innerHTML = `<i data-lucide="rocket" class="w-5 h-5"></i> BUKA APLIKASI KERJA`;
    }
}

function triggerIzinCepat() {
    clearInterval(countdownInterval);
    let reason = prompt("Masukkan alasan izin pulang cepat (misal: Sakit, Urgensi):");
    if (reason === null) {
        if(verifiedUser.remainingMs) startLiveTimer(verifiedUser.remainingMs);
        return; 
    }
    if (reason.trim() === "") {
        alert("Alasan izin tidak boleh kosong!");
        if(verifiedUser.remainingMs) startLiveTimer(verifiedUser.remainingMs);
        return;
    }
    isBypassRequest = true;
    bypassReason = reason;
    bypassManagerPin = ""; 
    startCapture('OUT');
}

function resetKiosk() {
    clearInterval(countdownInterval);
    currentPin = "";
    verifiedUser = {};
    currentActionType = "";
    currentLatLong = "";
    updatePinDots();
    showScreen('pin-screen');
}

// Buka Aplikasi Manual (Jika layar mati/refresh tanpa absen)
function openManualLogin() {
    let type = prompt("Ketik 'KASIR' untuk mesin POS, atau 'PELAYAN' untuk buku Order:");
    if (type) {
        if (type.toUpperCase() === "KASIR") window.location.href = "pos.html";
        else if (type.toUpperCase() === "PELAYAN") window.location.href = "order.html";
    }
}
NAMA_PERUSAHAAN/**
 * MODUL: KIOSK ABSENSI, SINGLE SIGN-ON (SSO), OTP GENERATOR, & PIN CHANGER
 * UPDATE: Integrasi Penuh AI Face Recognition (TensorFlow Add-on)
 */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error(err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
});

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
        const hasCashierSession = localStorage.getItem("MRD_CASHIER"); 
        const hasWaiterSession = localStorage.getItem("MRD_WAITER_SESSION");
        showScreen('pin-screen');
        
        const appShortcutBtn = document.getElementById('btn-manual-app-shortcut');
        if (appShortcutBtn) {
            if (hasCashierSession || hasWaiterSession) {
                appShortcutBtn.classList.remove('hidden'); 
            } else {
                appShortcutBtn.classList.add('hidden'); 
            }
        }
        fetchConfigBg();
    }
}

function openManualLogin() { 
    const isCashier = localStorage.getItem("MRD_CASHIER"); 
    const isWaiter = localStorage.getItem("MRD_WAITER_SESSION");

    if (isCashier) window.location.href = "pos.html";
    else if (isWaiter) window.location.href = "order.html";
    else alert("Sesi Anda telah berakhir. Silakan masukkan PIN untuk lanjut.");
}

function showScreen(id) { 
    const screens = ['activation-screen', 'pin-screen', 'dashboard-screen', 'sub-absen-screen', 'sub-otp-screen', 'sub-pin-screen', 'capture-screen', 'success-screen']; 
    screens.forEach(el => { 
        const screen = document.getElementById(el); 
        if (screen) screen.classList.add('hidden-screen');
    }); 
    const target = document.getElementById(id); 
    if (target) target.classList.remove('hidden-screen'); 
    if (typeof lucide !== 'undefined') lucide.createIcons(); 
}

async function activateSystem() { 
    const input = document.getElementById('api-input').value.trim(); 
    if(!input) return alert("Masukkan URL!"); 
    const btn = document.getElementById('btn-activate');
    btn.innerHTML = "Loading..."; 

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
        if(json.success) {
            document.getElementById('absen-resto-name').innerText = json.data["NAMA_PERUSAHAAN"] || "LABARAC BAR"; 
            
            // CEK CONFIGURASI AI FACE RECOGNITION DARI GOOGLE SHEETS
            if (json.data["FITUR_FACE_RECOGNITION"] === "ON" || json.data["FITUR_FACE_RECOGNITION"] === "TRUE") {
                isFaceRecogEnabled = true;
                loadAiModels(); // Inisiasi mesin AI di latar belakang
            }
        }
    } catch(e) {} 
}

function resetLicense() { 
    if(confirm("Yakin ingin menghapus Lisensi API dari perangkat ini?")) { 
        localStorage.removeItem(STORAGE_API);
        window.location.reload(); 
    } 
}

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
        if (currentPin.length === 4) setTimeout(verifyPin, 300); 
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

function openDashboard() {
    showScreen('dashboard-screen'); 
    document.getElementById('emp-name').innerText = verifiedUser.name || verifiedUser.Name || ""; 
    document.getElementById('emp-area').innerText = verifiedUser.area || verifiedUser.Area || "PUSAT"; 
    
    const userRole = (verifiedUser.role || verifiedUser.Role || "").toString().toLowerCase().trim();
    const otpNavBtn = document.getElementById('btn-otp-nav');
    if (otpNavBtn) {
        if (userRole === "manager") otpNavBtn.classList.remove('hidden-screen');
        else otpNavBtn.classList.add('hidden-screen');
    }

    // TARIK RUMUS WAJAH REFERENSI SAAT KARYAWAN BERHASIL LOGIN KIOSK
    const userFoto = verifiedUser.fotoUrl || verifiedUser.FotoUrl || verifiedUser.foto || verifiedUser.Foto || "";
    if (userFoto) {
        extractReferenceFace(userFoto);
    }
}

function logoutDashboard() { 
    clearInterval(countdownInterval);
    clearInterval(otpInterval); 
    currentPin = ""; 
    verifiedUser = {}; 
    clearPin();
    checkState(); 
}

function backToDashboard() { 
    clearInterval(otpInterval);
    showScreen('dashboard-screen'); 
}

function openSubScreen(menu) { 
    if (menu === 'absen') { 
        setupAbsensiMenu(); 
    } else if (menu === 'otp') { 
        const userRole = (verifiedUser.role || verifiedUser.Role || "").toString().toLowerCase().trim();
        const userStatus = (verifiedUser.status || verifiedUser.Status || "").toString().toUpperCase().trim();
        
        if (userRole !== "manager") {
            alert("Akses Ditolak!\n\nMenu OTP Otorisasi hanya boleh diakses oleh akun tingkat Manager.");
            return;
        }
        if (userStatus === "OUT") { 
            alert("Akses Ditolak!\n\nAnda harus melakukan Absen Masuk terlebih dahulu sebelum bisa membuahkan OTP Komplimen."); 
            return; 
        }
        showScreen('sub-otp-screen'); 
        startOtpGenerator(); 
    } else if (menu === 'pin') {
        showScreen('sub-pin-screen'); 
        document.getElementById('pin-old').value = "";
        document.getElementById('pin-new').value = ""; 
    } 
}

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
    
    const gotoAppBtn = document.getElementById('btn-goto-app');
    if (gotoAppBtn) gotoAppBtn.classList.add('hidden-screen');

    const userStatus = (verifiedUser.status || verifiedUser.Status || "").toString().toUpperCase().trim();
    const userRole = (verifiedUser.role || verifiedUser.Role || "").toString().toLowerCase().trim();
    const userJobdesk = (verifiedUser.jobdesk || verifiedUser.Jobdesk || "").toString().toLowerCase().trim();

    if (userStatus === "OUT") {
        msg.innerText = "Status Anda: BELUM ABSEN (OUT)";
        sub.innerText = "Silakan tekan Absen Masuk untuk mulai bekerja.";
        document.getElementById('btn-clock-in').classList.remove('hidden-screen');
    } else {
        msg.innerText = verifiedUser.message || verifiedUser.Message || "Status Kerja Aktif"; 

        if (userRole === "staff" && userJobdesk === "waiter") {
            if (gotoAppBtn) gotoAppBtn.classList.remove('hidden-screen');
        } else {
            if (gotoAppBtn) gotoAppBtn.classList.add('hidden-screen');
        }

        if (verifiedUser.canClockOut || verifiedUser.CanClockOut) {
            sub.innerText = "Shift Selesai. Anda diizinkan Absen Pulang.";
            document.getElementById('btn-clock-out').classList.remove('hidden-screen');
        } else {
            const remainingMs = verifiedUser.remainingMs || verifiedUser.RemainingMs;
            if (remainingMs) startLiveTimer(remainingMs);
            else sub.innerText = verifiedUser.remaining || verifiedUser.Remaining || "";
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

function startCapture(type) {
    currentActionType = type; 
    showScreen('capture-screen'); 
    
    const aiCont = document.getElementById('ai-status-container');
    if (isFaceRecogEnabled && isAiModelsLoaded) {
        if (aiCont) aiCont.classList.remove('hidden');
        if (aiCont) aiCont.classList.add('flex');
    } else {
        if (aiCont) aiCont.classList.add('hidden');
        if (aiCont) aiCont.classList.remove('flex');
    }

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

// ============================================================================
// ENGINE AI: TENSORFLOW FACE MATCHING & OVERRIDE CAPTURE
// ============================================================================
let isFaceRecogEnabled = false; 
let isAiModelsLoaded = false;
let referenceFaceDescriptor = null; 

async function loadAiModels() {
    if (isAiModelsLoaded) return;
    const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), 
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), 
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL) 
        ]);
        isAiModelsLoaded = true;
        console.log("Model AI Face Recognition siap!");
    } catch (e) {
        console.log("Gagal memuat model AI.");
    }
}

async function extractReferenceFace(imageUrl) {
    if (!isFaceRecogEnabled || !isAiModelsLoaded || !imageUrl) return;
    referenceFaceDescriptor = null; 
    
    try {
        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        img.src = imageUrl; 

        img.onload = async () => {
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            if (detection) {
                referenceFaceDescriptor = detection.descriptor;
            }
        };
    } catch (err) {
        console.log("Gagal memproses foto acuan dari database.");
    }
}

// Override Capture Function untuk Inject Validasi AI Wajah
async function capture() { 
    const video = document.getElementById('webcam'); 
    const canvas = document.getElementById('canvas'); 
    const ctx = canvas.getContext('2d');
    const snapBtn = document.getElementById('btn-snap');

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Photo = canvas.toDataURL('image/jpeg', 0.8);

    // BLOK ADD-ON AI
    if (isFaceRecogEnabled && isAiModelsLoaded) {
        snapBtn.innerText = "Memindai Wajah...";
        snapBtn.disabled = true;
        document.getElementById('ai-status-text').innerText = "AI sedang mencocokkan...";

        try {
            const detection = await faceapi.detectSingleFace(canvas).withFaceLandmarks().withFaceDescriptor();
            
            if (!detection) {
                alert("Wajah tidak terdeteksi oleh kamera! Harap lepas masker dan hadap lurus ke kamera.");
                snapBtn.innerText = "AMBIL FOTO";
                snapBtn.disabled = false;
                document.getElementById('ai-status-text').innerText = "Wajah tidak ditemukan!";
                return; // GAGALKAN
            }

            if (referenceFaceDescriptor) {
                const distance = faceapi.euclideanDistance(referenceFaceDescriptor, detection.descriptor);
                if (distance > 0.6) {
                    alert(`ABSEN DITOLAK! (Skor: ${distance.toFixed(2)})\n\nWajah Anda tidak cocok dengan foto profil di database. Dilarang titip absen!`);
                    snapBtn.innerText = "AMBIL FOTO";
                    snapBtn.disabled = false;
                    document.getElementById('ai-status-text').innerText = "Wajah Tidak Cocok!";
                    return; // GAGALKAN
                }
            } else {
                console.log("Foto rujukan gagal diurai (CORS/Kosong), Bypass Face API.");
            }
        } catch (e) {
            console.log("Kesalahan eksekusi Face API. Lanjut ke proses server normal.");
        }
    }

    if (streamObject) streamObject.getTracks().forEach(track => track.stop());
    submitAttendanceData(base64Photo);
}

// Lanjutan Proses Submit setelah Kamera/AI selesai
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
            
            if (currentActionType === "IN") {
                document.getElementById('success-routing-msg').innerText = "Absen Masuk Berhasil! Memuat Dashboard Kiosk...";
                setTimeout(() => { verifyPin(); }, 3000); 
            } else {
                localStorage.removeItem("MRD_CASHIER");
                localStorage.removeItem("MRD_WAITER_SESSION");
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
        snapBtn.innerText = "AMBIL FOTO";
    }
}

// --- SINGLE SIGN-ON (SSO ROUTING KHUSUS WAITER) --- 
async function autoLoginApp() { 
    try { 
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'loginPOS', data: { pin: currentPin } }) 
        }); 
        const json = await res.json();

        if (json.success) {
            const userJobdesk = (json.jobdesk || json.Jobdesk || "").toString().toLowerCase().trim();
            if (userJobdesk === "waiter") {
                localStorage.setItem("MRD_WAITER_SESSION", JSON.stringify(json));
                window.location.href = "order.html"; 
            } else {
                alert("Akses Kiosk Terkunci. Kasir & Manager wajib menggunakan aplikasi terinstal!");
                logoutDashboard();
            }
        } else {
            alert("Sistem POS terkunci: " + json.message);
            logoutDashboard();
        }
    } catch (e) {
        alert("Koneksi gagal saat mencoba masuk ke aplikasi.");
        logoutDashboard();
    }
}

// --- LOGIKA UBAH PIN --- 
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

    const userId = verifiedUser.userId || verifiedUser.UserId || "";

    try {
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ 
                action: "changeUserPin", 
                data: { userId: userId, oldPin: oldPin, newPin: newPin } 
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

// --- LOGIKA OTP GENERATOR (1 JAM) --- 
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
    const progress = (totalSecondsLeft / 3600) * 264;

    document.getElementById('progress-bar').style.strokeDashoffset = 264 - progress;
    document.getElementById('countdown-text').innerText = minutesRemaining + "m";
}
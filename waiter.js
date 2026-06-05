/**
 * MODUL 4: WAITER/PELAYAN ENGINE (FULL RESPONSIVE & DRAFT ORDER)
 * UPDATE: Proteksi Ketat Kasir, Multi-Branch Area, & UI Card Fix
 */

lucide.createIcons();

// URL GAS (Hardcoded)
const GAS_URL = "https://script.google.com/macros/s/AKfycbxUP-K2iIaP8qF8ZBjeOI3h0OG7du_wcJQE2qM507YTb7magRRZejs6DZmqzy-Dulgy/exec";
const STORAGE_USER = "MRD_WAITER_SESSION";
const OFFLINE_QUEUE_KEY = "MRD_OFFLINE_WAITER_QUEUE";

let cashierInfo = null;
try { 
  cashierInfo = JSON.parse(localStorage.getItem(STORAGE_USER)); 
} catch(e) { 
  localStorage.removeItem(STORAGE_USER); 
}

let configData = {};
let menuData = [];
let filteredData = []; 
let cart = [];
let currentCategory = 'Semua';

// --- AUTO-ENTER PIN LOGIN WAITER ---
let loginPinValue = "";

function pressNum(num) {
    if(loginPinValue.length < 4) {
        loginPinValue += num;
        document.getElementById('login-pin').value = loginPinValue;
        updateLoginDots();
        if(loginPinValue.length === 4) setTimeout(loginWaiter, 300);
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

// --- STARTUP ---
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
    
    window.addEventListener('resize', updateMobileCartButtonVisibility);
};

function checkState() {
    if (!cashierInfo) {
        showScreen('login-screen');
        fetchConfigBg();
        clearPin();
    } else {
        // FILTER KEAMANAN STARTUP: Tendang keluar jika dia adalah Kasir
        const allowedRoles = ["admin", "hrd", "manager", "owner"];
        const jobdeskClean = cashierInfo.jobdesk ? cashierInfo.jobdesk.toLowerCase().trim() : "";
        const roleClean = cashierInfo.role ? cashierInfo.role.toLowerCase().trim() : "";

        // Jika dia Kasir ATAU (bukan pelayan dan bukan manajemen), HAPUS SESI!
        if (jobdeskClean === "kasir" || (jobdeskClean !== "pelayan" && !allowedRoles.includes(roleClean))) {
            localStorage.removeItem(STORAGE_USER);
            window.location.reload();
            return;
        }

        showScreen('main-app');
        document.getElementById('kasir-name').innerText = cashierInfo.name;
        initApp();
    }
}

function showScreen(id) {
    ['login-screen', 'main-app', 'success-screen'].forEach(el => {
        const screen = document.getElementById(el);
        if (screen) screen.classList.add('hidden-screen');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden-screen');
}

function resetLicense() {
    if(confirm("Yakin reset cache dan data login pelayan?")) {
        localStorage.clear();
        window.location.reload();
    }
}

// --- API ACTIONS ---
async function fetchConfigBg() {
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getConfig' }) });
        const json = await res.json();
        if(json.success) {
            const nameEl = document.getElementById('login-resto-name');
            if (nameEl) nameEl.innerText = json.data["NAMA_PERUSAAN"] || "RESTO";
        }
    } catch(e) {}
}

async function loginWaiter() {
    if(loginPinValue.length < 4) return;
    const statusText = document.getElementById('login-status');
    statusText.innerText = "Memeriksa Akses Pelayan...";
    
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'loginPOS', data: { pin: loginPinValue } }) });
        const json = await res.json();
        
        if(json.success) {
            const allowedRoles = ["admin", "hrd", "manager", "owner"];
            const jobdeskClean = json.jobdesk ? json.jobdesk.toLowerCase().trim() : "";
            const roleClean = json.role ? json.role.toLowerCase().trim() : "";

            // BLOKIR KERAS JIKA JOBDESK = KASIR
            if (jobdeskClean === "kasir") {
                alert("Akses Ditolak! Anda adalah Kasir. Silakan login di Mesin POS Utama.");
                clearPin();
                statusText.innerText = "";
            } 
            // LOLOSKAN JIKA PELAYAN ATAU MANAJEMEN
            else if (jobdeskClean === "pelayan" || allowedRoles.includes(roleClean)) {
                localStorage.setItem(STORAGE_USER, JSON.stringify(json));
                window.location.reload();
            } 
            // SELAIN ITU TOLAK
            else {
                alert("Akses Ditolak! Aplikasi ini khusus Pelayan.");
                clearPin();
                statusText.innerText = "";
            }
        } else {
            alert(json.message);
            clearPin();
            statusText.innerText = "";
        }
    } catch (e) {
        alert("Koneksi gagal!");
        clearPin();
        statusText.innerText = "";
    }
}

function logoutKasir() {
    if(confirm("Keluar dari sesi pelayan?")) {
        localStorage.removeItem(STORAGE_USER);
        window.location.reload();
    }
}

async function initApp() {
    const localMenu = localStorage.getItem('localMenu');
    const localConfig = localStorage.getItem('localConfig');
    
    if(localConfig) { configData = JSON.parse(localConfig); applyConfig(); }
    if(localMenu) { 
        menuData = JSON.parse(localMenu); 
        filteredData = menuData;
        renderMenuHTML(filteredData); 
    }

    let userArea = cashierInfo ? cashierInfo.area : "";

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getMenu', data: { area: userArea } }) });
        const json = await res.json();
        if(json.success) {
            menuData = json.data;
            localStorage.setItem('localMenu', JSON.stringify(menuData));
            filterMenu(currentCategory, document.getElementById(`btn-cat-${currentCategory}`)); 
        }
        const resConf = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getConfig', data: { area: userArea } }) });
        const jsonConf = await resConf.json();
        if(jsonConf.success) {
            configData = jsonConf.data;
            localStorage.setItem('localConfig', JSON.stringify(configData));
            applyConfig();
        }
    } catch (e) { console.log("Sedang Offline"); }
}

function applyConfig() {
    const titleEl = document.getElementById('pos-title');
    if(configData["NAMA_PERUSAAN"] && titleEl) titleEl.innerText = configData["NAMA_PERUSAAN"] + " ORDER";
}

// --- RENDER MENU & SEARCH ---
function filterMenu(cat, btnElement = null) {
    currentCategory = cat;
    if (btnElement) {
        document.querySelectorAll('.cat-btn').forEach(b => {
            b.classList.remove('bg-amber-500', 'text-slate-900', 'shadow-md');
            b.classList.add('bg-slate-800', 'text-slate-300');
        });
        btnElement.classList.remove('bg-slate-800', 'text-slate-300', 'hover:bg-slate-700');
        btnElement.classList.add('bg-amber-500', 'text-slate-900', 'shadow-md');
    }
    applyFilters();
}

function searchMenu(val) { applyFilters(val.toLowerCase()); }

function applyFilters(searchStr = "") {
    const keyword = searchStr || document.getElementById('search-menu').value.toLowerCase();
    filteredData = menuData;
    if(currentCategory !== 'Semua') { filteredData = filteredData.filter(m => m.category === currentCategory); }
    if(keyword !== "") {
        filteredData = filteredData.filter(m => 
            m.name.toLowerCase().includes(keyword) || 
            (m.description && m.description.toLowerCase().includes(keyword))
        );
    }
    const container = document.getElementById('menu-container');
    if (container) {
        container.style.opacity = '0';
        setTimeout(() => {
            renderMenuHTML(filteredData);
            container.style.opacity = '1';
        }, 150);
    }
}

// PERBAIKAN UI CARD MENU (h-full & z-10)
function renderMenuHTML(items) {
    const container = document.getElementById('menu-container');
    if (!container) return;
    
    if (items.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-500"><i data-lucide="search-x" class="w-16 h-16 mx-auto mb-3 opacity-30"></i>Menu tidak ditemukan</div>`;
        if(typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = items.map(item => {
        const fallbackImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=1e293b&color=f59e0b&size=200&font-size=0.33`;
        const isHot = (parseInt(item.totalSold) || 0) > 10;
        const badgeHtml = isHot ? `<div class="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-black px-2 py-1 rounded-md shadow-md animate-pulse">🔥 HOT</div>` : ``;
        
        // KUNCI: Amankan tanda kutip agar tidak merusak tag div HTML
        const safeName = item.name.replace(/'/g, "\\'"); 

        // KUNCI: h-32 mutlak untuk gambar, min-h-[90px] mutlak untuk teks
        return `
        <div onclick="addToCart('${item.id}', '${safeName}', ${item.price}, '${item.route}')" class="bg-slate-800 border border-slate-700 rounded-2xl flex flex-col overflow-hidden cursor-pointer active:scale-95 transition-transform">
            <div class="h-32 w-full relative shrink-0 bg-slate-900 border-b border-slate-700">
                <img src="${item.image || fallbackImg}" onerror="this.onerror=null; this.src='${fallbackImg}';" class="w-full h-full object-cover">
                ${badgeHtml}
                <div class="absolute top-2 right-2 bg-slate-900/90 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-700 text-slate-300">${item.category}</div>
            </div>
            <div class="p-3 flex flex-col flex-1 justify-between min-h-[90px] bg-slate-800">
                <div>
                    <h3 class="text-xs font-bold text-white line-clamp-2 leading-tight">${item.name}</h3>
                    <p class="text-[9px] text-slate-400 mt-1 line-clamp-2">${item.description || ''}</p>
                </div>
                <p class="text-xs font-black text-amber-500 mt-2">Rp ${(item.price || 0).toLocaleString('id-ID')}</p>
            </div>
        </div>
    `}).join('');
    
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// --- KERANJANG BELANJA (CART SYSTEM) ---
function addToCart(id, name, price, route) {
    const exist = cart.find(i => i.menuId === id);
    if(exist) { exist.qty++; exist.subtotal = exist.qty * price; }
    else { cart.push({ menuId: id, name: name, price: price, qty: 1, subtotal: price, notes: '', route: route || 'Kitchen' }); }
    renderCart();
}

function updateQty(index, delta) {
    cart[index].qty += delta;
    if(cart[index].qty <= 0) cart.splice(index, 1);
    else cart[index].subtotal = cart[index].qty * cart[index].price;
    renderCart();
}

function addNote(index) {
    const note = prompt("Catatan Koki/Bar (misal: Pedas):", cart[index].notes);
    if(note !== null) { cart[index].notes = note; renderCart(); }
}

function clearCart() {
    if(confirm("Kosongkan keranjang pelayan?")) { 
        cart = []; 
        document.getElementById('order-table').value = ""; 
        renderCart(); 
        toggleMobileCart(); 
    }
}

function renderCart() {
    const container = document.getElementById('cart-container');
    if (!container) return;

    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

    // Update Grand Total di Laci
    document.getElementById('cart-grandtotal').innerText = "Rp " + subtotal.toLocaleString('id-ID');

    // Update di Tombol Melayang Mobile
    const mobCount = document.getElementById('mobile-cart-count');
    const mobTotal = document.getElementById('mobile-cart-total');
    if (mobCount) mobCount.innerText = cart.reduce((sum, item) => sum + item.qty, 0);
    if (mobTotal) mobTotal.innerText = "Rp " + subtotal.toLocaleString('id-ID');

    updateMobileCartButtonVisibility();

    if(cart.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-600 smooth-transition py-10"><i data-lucide="shopping-basket" class="w-16 h-16 mb-3 opacity-20"></i><p class="text-sm font-medium">Keranjang Kosong</p></div>`;
        lucide.createIcons();
        return;
    }

    container.innerHTML = cart.map((item, idx) => `
        <div class="bg-slate-800 p-3 rounded-2xl border border-slate-700 shadow-sm relative text-slate-100">
            <div class="flex justify-between items-start mb-2">
                <div class="pr-2">
                    <h4 class="text-xs font-bold leading-tight">${item.name}</h4>
                    <p class="text-xs text-amber-500 font-black mt-1">Rp ${item.subtotal.toLocaleString('id-ID')}</p>
                </div>
                <div class="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-0.5 shrink-0">
                    <button onclick="updateQty(${idx}, -1)" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 font-bold"><i data-lucide="minus" class="w-3 h-3"></i></button>
                    <span class="w-6 text-center text-xs font-bold text-white">${item.qty}</span>
                    <button onclick="updateQty(${idx}, 1)" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-green-500 font-bold"><i data-lucide="plus" class="w-3 h-3"></i></button>
                </div>
            </div>
            <button onclick="addNote(${idx})" class="text-[10px] bg-slate-900 text-slate-400 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-700 hover:text-white transition"><i data-lucide="pen-line" class="w-3 h-3"></i> ${item.notes ? item.notes : "Tambah Catatan"}</button>
        </div>
    `).join('');
    lucide.createIcons();
}

// --- PORTRAIT SENSORS & FLOATING BUTTON ---
function toggleMobileCart() {
    const panel = document.getElementById('cart-panel');
    const trigger = document.getElementById('mobile-cart-trigger');
    if (!panel || !trigger) return;
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        trigger.classList.add('hidden-screen'); 
    } else {
        panel.classList.add('hidden');
        updateMobileCartButtonVisibility();
    }
}

function updateMobileCartButtonVisibility() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    const trigger = document.getElementById('mobile-cart-trigger');
    if (!trigger) return;

    if (count > 0 && cashierInfo) {
        trigger.classList.remove('hidden-screen');
    } else {
        trigger.classList.add('hidden-screen');
    }
}

// --- SEND ORDER TO CASHIER (STATUS: DRAFT) ---
async function sendOrderToCashier() {
    if(cart.length === 0) return alert("Keranjang kosong!");
    const tableNo = document.getElementById('order-table').value.trim();
    if(!tableNo) return alert("Mohon isi Nomor Meja!");

    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    let userArea = cashierInfo ? cashierInfo.area : "";

    const payload = {
        action: "placeOrder", 
        data: {
            orderId: "", // ID Baru
            tableNo: tableNo,
            kasirId: cashierInfo.userId, 
            area: userArea, // DATA AREA DIKIRIM
            discount: "DISC-00", 
            voucherCode: "",
            tax: 0, 
            serviceCharge: 0, 
            totalAmount: subtotal, 
            paymentMethod: "-",
            orderStatus: "Draft", // KIRIM SEBAGAI DRAFT
            items: cart
        }
    };

    const btn = document.getElementById('btn-send');
    if (!navigator.onLine) {
        let queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
        queue.push(payload);
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

        alert(`⚠️ Koneksi terputus! Draft disimpan di antrean HP Anda. Klik Sync nanti saat sinyal bagus.`);
        cart = []; document.getElementById('order-table').value = "";
        renderCart(); toggleMobileCart();
        return;
    }

    btn.innerText = "Mengirim...";
    btn.disabled = true;

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        
        if(json.success) {
            showScreen('success-screen');
            
            setTimeout(() => {
                cart = [];
                document.getElementById('order-table').value = "";
                renderCart();
                btn.innerHTML = `<i data-lucide="send" class="w-5 h-5"></i> <span>KIRIM KE KASIR (DRAFT)</span>`;
                btn.disabled = false;
                showScreen('main-app');
                toggleMobileCart(); 
            }, 3000);
        } else {
            alert("Error Server: " + json.message);
            btn.innerHTML = `<i data-lucide="send" class="w-5 h-5"></i> <span>KIRIM KE KASIR (DRAFT)</span>`;
            btn.disabled = false;
        }
    } catch (e) {
        alert("Gagal koneksi ke server pusat.");
        btn.innerHTML = `<i data-lucide="send" class="w-5 h-5"></i> <span>KIRIM KE KASIR (DRAFT)</span>`;
        btn.disabled = false;
    }
}

// Auto-Sync Event saat HP pelayan kembali online
window.addEventListener('online', async () => {
    let queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
    if (queue.length > 0) {
        for (let i = 0; i < queue.length; i++) {
            try {
                let res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(queue[i]) });
                let json = await res.json();
                if (json.success) { queue.splice(i, 1); i--; localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); }
            } catch (e) { break; }
        }
        if (queue.length === 0) alert("Semua draft tertunda berhasil dikirim ke Kasir!");
    }
});
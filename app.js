/**
 * =================================================================
 * MODUL: POS CONTROLLER FRONT-END LOGIC "LABARAC"
 * Fitur: 100% Responsive Portrait, Waiter & Cashier Dual System,
 * Auto-Polling Draft, Safe JSON Session, Auto-Enter PIN.
 * =================================================================
 */

lucide.createIcons();

// Variabel Storage & API (URL GAS DINAMIS TERKUNCI)
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

let configData = {};
let menuData = [];
let discountData = []; 
let filteredData = []; 
let cart = [];
let currentCategory = 'Semua';

// Mode State
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

// Dukungan Ketik pakai Keyboard Fisik (Anti-Crash)
function handlePhysicalKeyboard(e) {
    let val = this.value.replace(/[^0-9]/g, ''); 
    if (val.length > 4) val = val.substring(0, 4);
    
    loginPinValue = val;
    this.value = val;
    updateLoginDots();
    
    if (loginPinValue.length === 4) setTimeout(loginKasir, 300);
}

// --- STARTUP & ROUTING ---
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
        
        // Sensor otomatis untuk merapikan tombol melayang jika layar diputar secara fisik
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

// Override closeModal agar menyalakan kembali visibilitas tombol mobile cart setelah modal ditutup
function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden-screen'); 
    updateMobileCartButtonVisibility();
}

function resetLicense() {
    if(confirm("Yakin ingin menghapus semua data dan lisensi browser?")) {
        localStorage.clear();
        window.location.reload();
    }
}

// --- PEMBATASAN HAK AKSES JOBDESK (RULES) ---
function applyJobdeskRules() {
    const jobdesk = cashierInfo.jobdesk;
    clearInterval(pollInterval);

    if (jobdesk === "Pelayan") { 
        document.getElementById('discount-section').classList.add('hidden-screen');
        document.getElementById('btn-cashier-print').classList.add('hidden-screen');
        document.getElementById('btn-save-draft').classList.remove('hidden-screen');
        document.getElementById('btn-draft-text').innerText = "KIRIM ORDER (DRAFT)";
        document.getElementById('btn-history-trigger').classList.add('hidden-screen');
    } else { 
        document.getElementById('discount-section').classList.remove('hidden-screen');
        document.getElementById('btn-cashier-print').classList.remove('hidden-screen');
        document.getElementById('btn-save-draft').classList.add('hidden-screen'); 
        document.getElementById('btn-history-trigger').classList.remove('hidden-screen');
        checkNewDraftNotifications(); 
        pollInterval = setInterval(checkNewDraftNotifications, 15000); 
    }
}

// --- POLLING DRAFT NOTIFIKASI KASIR ---
async function checkNewDraftNotifications() {
    if (!navigator.onLine) return;
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "getHistoryOrders" }) });
        const json = await res.json();
        if (json.success) {
            historyDataRaw = json.data;
            const draftCount = historyDataRaw.filter(d => d.status === "Draft").length;
            const alertDot = document.getElementById('draft-alert-dot');
            
            if (draftCount > 0) {
                alertDot.classList.remove('hidden'); 
            } else {
                alertDot.classList.add('hidden');
            }
        }
    } catch(e) {}
}

// --- RESPONSIVE MOBILE PORTRAIT CART PANEL ---
function toggleMobileCart() {
    const panel = document.getElementById('cart-panel');
    const trigger = document.getElementById('mobile-cart-trigger');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden', 'md:flex');
        panel.classList.add('fixed', 'inset-0', 'z-[45]', 'flex');
        trigger.classList.add('hidden-screen'); 
    } else {
        panel.classList.add('hidden', 'md:flex');
        panel.classList.remove('fixed', 'inset-0', 'z-[45]', 'flex');
        updateMobileCartButtonVisibility();
    }
}

function updateMobileCartButtonVisibility() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    const trigger = document.getElementById('mobile-cart-trigger');
    if (!trigger) return;

    // Tombol melayang hanya muncul jika ada item di keranjang, lebar layar dibawah 768px (mode HP/Portrait), dan bukan di layar modal
    const isModalOpen = !document.getElementById('modal-history').classList.contains('hidden-screen') || 
                        !document.getElementById('modal-print').classList.contains('hidden-screen');

    if (count > 0 && window.innerWidth < 768 && cashierInfo && !isModalOpen) {
        trigger.classList.remove('hidden-screen');
    } else {
        trigger.classList.add('hidden-screen');
    }
}

// --- API CALLS ---
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

async function syncData() {
    const btn = document.getElementById('btn-sync');
    btn.classList.add('animate-spin');
    
    // Auto-Sync Offline Queue
    let queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
    if (queue.length > 0) {
        for (let i = 0; i < queue.length; i++) {
            try {
                let res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(queue[i]) });
                let json = await res.json();
                if (json.success) { queue.splice(i, 1); i--; localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); }
            } catch (e) { break; }
        }
    }
    updateOfflineBadge();

    localStorage.removeItem('localMenu');
    localStorage.removeItem('localDiscounts');
    await initApp();
    btn.classList.remove('animate-spin');
}

function updateOfflineBadge() {
    let queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
    const badge = document.getElementById('offline-badge');
    const count = document.getElementById('offline-queue-count');
    if (queue.length > 0) { badge.classList.remove('hidden'); count.innerText = queue.length; } 
    else { badge.classList.add('hidden'); }
}

async function initApp() {
    const localMenu = localStorage.getItem('localMenu');
    const localConfig = localStorage.getItem('localConfig');
    const localDisc = localStorage.getItem('localDiscounts');
    
    if(localConfig) { configData = JSON.parse(localConfig); applyConfig(); }
    if(localMenu) { 
        menuData = JSON.parse(localMenu); 
        filteredData = menuData;
        renderMenuHTML(filteredData); 
    }
    if(localDisc) { discountData = JSON.parse(localDisc); renderDiscounts(); }

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getMenu' }) });
        const json = await res.json();
        if(json.success) {
            menuData = json.data;
            localStorage.setItem('localMenu', JSON.stringify(menuData));
            if(document.getElementById('search-menu').value === "") {
                filterMenu(currentCategory, document.getElementById(`btn-cat-${currentCategory}`)); 
            }
        }
        const resConf = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getConfig' }) });
        const jsonConf = await resConf.json();
        if(jsonConf.success) {
            configData = jsonConf.data;
            localStorage.setItem('localConfig', JSON.stringify(configData));
            applyConfig();
        }
        const resDisc = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getDiscounts' }) });
        const jsonDisc = await resDisc.json();
        if(jsonDisc.success) {
            discountData = jsonDisc.data;
            localStorage.setItem('localDiscounts', JSON.stringify(discountData));
            renderDiscounts();
        }
    } catch (e) { document.getElementById('offline-badge').classList.remove('hidden'); }
}

function applyConfig() {
    const titleEl = document.getElementById('pos-title');
    if(configData["NAMA_PERUSAAN"] && titleEl) titleEl.innerText = configData["NAMA_PERUSAAN"];
}

function renderDiscounts() {
    const select = document.getElementById('cart-discount-select');
    if (select) {
        select.innerHTML = discountData.map(d => {
            let displayPerc = d.percentage < 1 ? (d.percentage * 100) : d.percentage;
            return `<option value="${d.percentage}" data-id="${d.id}">${d.name} (${displayPerc}%)</option>`;
        }).join('');
    }
}

// --- FILTER & RENDER MENU ---
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

function renderMenuHTML(items) {
    const container = document.getElementById('menu-container');
    if (!container) return;
    
    if (items.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-slate-500"><i data-lucide="search-x" class="w-16 h-16 mx-auto mb-3 opacity-30"></i>Menu tidak ditemukan</div>`;
        lucide.createIcons();
        return;
    }

    container.innerHTML = items.map(item => {
        const fallbackImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=1e293b&color=f59e0b&size=200&font-size=0.33`;
        const totalSoldData = parseInt(item.totalSold) || 0; 
        const isHot = totalSoldData > 10;
        const badgeHtml = isHot ? `<div class="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-black px-2 py-1 rounded-md shadow-md animate-pulse">🔥 HOT 7 DAYS</div>` : ``;

        return `
        <div onclick="addToCart('${item.id}', '${item.name}', ${item.price}, '${item.route}')" class="menu-card bg-slate-800 rounded-2xl border border-slate-700 flex flex-col overflow-hidden cursor-pointer hover:border-amber-500 relative">
            <div class="h-32 relative shrink-0 overflow-hidden bg-slate-900">
                <img src="${item.image || fallbackImg}" onerror="this.onerror=null; this.src='${fallbackImg}';" class="w-full h-full object-cover transition-transform duration-700 hover:scale-110">
                ${badgeHtml}
                <div class="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-md text-slate-300 text-[10px] font-bold px-2 py-1 rounded-md border border-slate-700">${item.category}</div>
            </div>
            <div class="p-4 flex flex-col justify-between flex-1">
                <div>
                    <h3 class="text-sm font-bold text-white line-clamp-2 leading-snug">${item.name}</h3>
                    <p class="text-[10px] text-slate-400 mt-1 line-clamp-2">${item.description || ''}</p>
                </div>
                <div class="flex justify-between items-end mt-3">
                    <p class="text-[15px] font-black text-amber-500 tracking-tight">Rp ${item.price.toLocaleString()}</p>
                    ${totalSoldData > 0 ? `<p class="text-[9px] text-slate-500 font-bold bg-slate-900 px-2 py-1 rounded">Terjual: ${totalSoldData}</p>` : ''}
                </div>
            </div>
        </div>
    `}).join('');
    lucide.createIcons();
}

// --- CART SYSTEM ---
function addToCart(id, name, price, route) {
    if (activeOrderId) {
        if(!confirm("Anda sedang memproses pelunasan. Tambah menu baru ke bill ini?")) return;
        activeOrderId = null;
        document.getElementById('btn-save-bill').classList.remove('hidden-screen');
    }

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
    if(confirm("Kosongkan keranjang & buang draft ini?")) { 
        cart = []; 
        document.getElementById('order-table').value = ""; 
        activeOrderId = null; 
        const ind = document.getElementById('draft-indicator');
        if (ind) ind.classList.add('hidden-screen');
        renderCart(); 
    }
}

function renderCart() {
    const container = document.getElementById('cart-container');
    if (!container) return;

    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    
    const selectDisc = document.getElementById('cart-discount-select');
    let discVal = parseFloat(selectDisc ? selectDisc.value : 0 || 0);
    let discountAmount = discVal < 1 ? subtotal * discVal : subtotal * (discVal / 100); 
    const netSubtotal = subtotal - discountAmount;

    const servicePerc = parseFloat(configData["SERVICE_CHARGE"] || 0);
    const serviceCharge = netSubtotal * (servicePerc / 100);
    const taxPerc = parseFloat(configData["PAJAK_PB1"] || 0); 
    const tax = (netSubtotal + serviceCharge) * (taxPerc / 100);
    const grandTotal = netSubtotal + serviceCharge + tax;

    document.getElementById('cart-count').innerText = cart.reduce((sum, item) => sum + item.qty, 0);
    document.getElementById('cart-subtotal').innerText = "Rp " + subtotal.toLocaleString();
    document.getElementById('cart-tax').innerText = "Rp " + (tax + serviceCharge).toLocaleString();
    document.getElementById('cart-grandtotal').innerText = "Rp " + grandTotal.toLocaleString();

    // UPDATE NILAI DI TOMBOL MELAYANG MOBILE PORTRAIT
    const mobCount = document.getElementById('mobile-cart-count');
    const mobTotal = document.getElementById('mobile-cart-total');
    if (mobCount) mobCount.innerText = cart.reduce((sum, item) => sum + item.qty, 0);
    if (mobTotal) mobTotal.innerText = "Rp " + grandTotal.toLocaleString();

    updateMobileCartButtonVisibility();

    if(cart.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-600 smooth-transition"><i data-lucide="shopping-basket" class="w-16 h-16 mb-3 opacity-20"></i><p class="text-sm">Keranjang Kosong</p></div>`;
        lucide.createIcons();
        return;
    }

    container.innerHTML = cart.map((item, idx) => `
        <div class="bg-slate-800 p-3.5 rounded-2xl border border-slate-700 shadow-sm relative">
            <div class="flex justify-between items-start mb-2">
                <div class="pr-2">
                    <h4 class="text-xs font-bold text-white leading-tight">${item.name}</h4>
                    <p class="text-[13px] text-amber-500 font-black mt-1">Rp ${item.subtotal.toLocaleString()}</p>
                </div>
                <div class="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-0.5 shrink-0">
                    <button onclick="updateQty(${idx}, -1)" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 font-bold"><i data-lucide="minus" class="w-3 h-3"></i></button>
                    <span class="w-6 text-center text-xs font-bold text-white">${item.qty}</span>
                    <button onclick="updateQty(${idx}, 1)" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-green-500 font-bold"><i data-lucide="plus" class="w-3 h-3"></i></button>
                </div>
            </div>
            <button onclick="addNote(${idx})" class="text-[10px] bg-slate-900 text-slate-400 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-700 hover:text-white transition"><i data-lucide="pen-line" class="w-3 h-3"></i> ${item.notes ? item.notes : "Catatan"}</button>
        </div>
    `).join('');
    lucide.createIcons();
}

// --- DRAFT & HISTORY ---
async function openHistoryModal() {
    openModal('modal-history');
    switchTab('Draft'); 
}

async function switchTab(tabName) {
    ['Draft', 'Open', 'Paid'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if(btn) {
            if(t === tabName) {
                btn.classList.add('bg-slate-800', 'text-white');
                btn.classList.remove('bg-slate-950', 'text-slate-500');
            } else {
                btn.classList.remove('bg-slate-800', 'text-white');
                btn.classList.add('bg-slate-950', 'text-slate-500');
            }
        }
    });

    const container = document.getElementById('history-container');
    if (container) container.innerHTML = `<div class="py-20 text-center text-slate-500 animate-pulse">Menarik data dari database...</div>`;

    if(!navigator.onLine) {
        if (container) container.innerHTML = `<div class="py-20 text-center text-rose-500 font-bold">Koneksi Offline. Riwayat tidak bisa dimuat.</div>`;
        return;
    }

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "getHistoryOrders" }) });
        const json = await res.json();
        
        if (json.success) {
            historyDataRaw = json.data;
            const filteredData = historyDataRaw.filter(d => d.status === tabName);
            
            if (filteredData.length > 0) {
                container.innerHTML = filteredData.map(bill => {
                    let actionButtons = "";
                    if (tabName === "Draft") {
                        actionButtons = `
                            <button onclick="editDraft('${bill.orderId}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition">Edit Draft</button>
                            <button onclick="reqVoid('${bill.orderId}', 'Draft Bebas')" class="bg-red-500/10 text-red-500 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-500/20 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        `;
                    } else if (tabName === "Open") {
                        actionButtons = `
                            <button onclick="editDraft('${bill.orderId}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition">Pelunasan</button>
                            <button onclick="reprintOrder('${bill.orderId}')" class="bg-slate-700 text-white px-3 py-2 rounded-xl text-xs hover:bg-slate-600 transition" title="Reprint"><i data-lucide="printer" class="w-4 h-4"></i></button>
                            <button onclick="reqVoid('${bill.orderId}', 'Batal Meja Open')" class="bg-red-500/10 text-red-500 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-500/20 transition"><i data-lucide="ban" class="w-4 h-4"></i></button>
                        `;
                    } else {
                        actionButtons = `
                            <button onclick="reprintOrder('${bill.orderId}')" class="bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-600 transition flex items-center gap-2"><i data-lucide="printer" class="w-4 h-4"></i> Reprint Struk</button>
                            <button onclick="reqVoid('${bill.orderId}', 'Void Kasir')" class="bg-red-500/10 text-red-500 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-500/20 transition"><i data-lucide="ban" class="w-4 h-4"></i></button>
                        `;
                    }

                    return `
                    <div class="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
                        <div>
                            <h4 class="font-black text-white text-lg flex items-center gap-2">${bill.tableNo} <span class="bg-slate-800 text-[10px] px-2 py-0.5 rounded-full font-normal text-slate-400">${bill.time}</span></h4>
                            <p class="text-xs text-slate-500 mt-1">ID: ${bill.orderId} | Total: <span class="text-amber-500 font-bold">Rp ${bill.totalAmount.toLocaleString()}</span></p>
                        </div>
                        <div class="flex items-center gap-2">
                            ${actionButtons}
                        </div>
                    </div>
                `}).join('');
            } else {
                container.innerHTML = `<div class="py-20 text-center text-slate-600"><i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>Tidak ada data ${tabName}</div>`;
            }
        } else {
            container.innerHTML = `<div class="py-12 text-center text-rose-500">Error: ${json.message}</div>`;
        }
        lucide.createIcons();
    } catch (e) {
        if (container) container.innerHTML = `<div class="py-12 text-center text-rose-500">Koneksi putus.</div>`;
    }
}

function editDraft(orderId) {
    const bill = historyDataRaw.find(b => b.orderId === orderId);
    if(!bill) return;

    activeOrderId = bill.orderId; 
    document.getElementById('order-table').value = bill.tableNo;
    
    cart = bill.items.map(item => ({
        menuId: item.menuId, name: item.name, price: item.price, 
        qty: item.qty, subtotal: item.subtotal, notes: item.notes, route: item.route
    }));

    const selectDisc = document.getElementById('cart-discount-select');
    if (selectDisc) {
        for (let i = 0; i < selectDisc.options.length; i++) {
            if (selectDisc.options[i].getAttribute('data-id') === bill.discountId) {
                selectDisc.selectedIndex = i; break;
            }
        }
    }

    const ind = document.getElementById('draft-indicator');
    if (ind) ind.classList.remove('hidden-screen');
    renderCart();
    closeModal('modal-history');
    
    if (window.innerWidth < 768) {
        toggleMobileCart();
    }
}

// --- SISTEM VOID / PEMBATALAN PESANAN ---
function reqVoid(orderId, type) {
    voidTargetId = orderId;
    const bill = historyDataRaw.find(b => b.orderId === orderId);

    if (bill.status === "Draft") {
        if(confirm("Yakin hapus draft pesanan meja " + bill.tableNo + "?")) {
            executeVoidVerified("Dihapus Kasir");
        }
        return;
    }

    document.getElementById('void-reason').value = "";
    document.getElementById('void-pin').value = "";
    openModal('modal-void');
}

async function executeVoid() {
    const reason = document.getElementById('void-reason').value.trim();
    const pin = document.getElementById('void-pin').value;
    if(!reason || !pin) return alert("Isi Alasan dan PIN Atasan!");

    const btn = document.getElementById('btn-exec-void');
    btn.innerText = "Mengecek...";
    btn.disabled = true;

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "verifyVoidManager", data: { managerPin: pin } }) });
        const json = await res.json();
        
        if(json.success) {
            const finalReason = `[VOID oleh ${json.managerName}] ${reason}`;
            executeVoidVerified(finalReason);
            closeModal('modal-void');
        } else {
            alert(json.message);
        }
    } catch (e) { alert("Gagal verifikasi."); } 
    finally { btn.innerText = "BATALKAN"; btn.disabled = false; }
}

async function executeVoidVerified(reasonText) {
    const bill = historyDataRaw.find(b => b.orderId === voidTargetId);
    if(!bill) return;

    const payload = {
        action: "placeOrder",
        data: {
            orderId: voidTargetId,
            tableNo: bill.tableNo,
            discount: bill.discountId,
            tax: bill.tax,
            serviceCharge: bill.serviceCharge,
            totalAmount: 0, 
            paymentMethod: "-",
            orderStatus: "Void",
            voidReason: reasonText,
            items: [] 
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        if(json.success) {
            alert("Pesanan DIBATALKAN!");
            switchTab(bill.status); 
        } else { alert("Error: " + json.message); }
    } catch(e) { alert("Gagal koneksi server."); }
}

// --- SISTEM PEMROSESAN UTAMA ---
function saveDraft() {
    if(cart.length === 0) return alert("Keranjang kosong!");
    if(!document.getElementById('order-table').value.trim()) return alert("Isi Nomor Meja!");
    submitOrderPayload("Draft", false);
}

function openPrintModal() {
    if(cart.length === 0) return alert("Keranjang kosong!");
    if(!document.getElementById('order-table').value.trim()) return alert("Isi Nomor Meja!");
    openModal('modal-print');
}

function processOrder(status, printTarget) {
    closeModal('modal-print');
    submitOrderPayload(status, printTarget);
}

async function submitOrderPayload(statusTarget, printTarget) {
    const tableNo = document.getElementById('order-table').value.trim();
    const selectDisc = document.getElementById('cart-discount-select');
    const discountId = selectDisc ? selectDisc.options[selectDisc.selectedIndex].getAttribute('data-id') : "";
    const discPerc = parseFloat(selectDisc ? selectDisc.value : 0 || 0);

    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    let discountAmount = discPerc < 1 ? subtotal * discPerc : subtotal * (discPerc / 100); 
    const netSubtotal = subtotal - discountAmount;
    
    const servicePerc = parseFloat(configData["SERVICE_CHARGE"] || 0);
    const serviceCharge = netSubtotal * (servicePerc / 100);

    const taxPerc = parseFloat(configData["PAJAK_PB1"] || 0); 
    const tax = (netSubtotal + serviceCharge) * (taxPerc / 100);
    
    const grandTotal = netSubtotal + serviceCharge + tax;

    let paymentMethod = "-";
    let orderStatus = "Open";

    if (cashierInfo.jobdesk === "Pelayan") {
        statusTarget = "Draft";
    }

    if (statusTarget === "Draft") {
        orderStatus = "Draft";
    } else if (statusTarget === "Open") {
        orderStatus = "Open";
    } else {
        paymentMethod = statusTarget; 
        orderStatus = "Paid";
    }

    const payload = {
        action: "placeOrder", 
        data: {
            orderId: activeOrderId || "", 
            tableNo: tableNo,
            kasirId: cashierInfo.userId, 
            discount: discountId,
            tax: tax, 
            serviceCharge: serviceCharge, 
            totalAmount: grandTotal, 
            paymentMethod: paymentMethod,
            orderStatus: orderStatus, 
            items: cart
        }
    };

    // JALUR OFFLINE
    if (!navigator.onLine) {
        let queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
        queue.push(payload);
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

        if (printTarget !== false && printTarget !== "None") {
            executeRoutingPrint(payload.data.orderId || "OFFLINE-"+Date.now(), tableNo, orderStatus, paymentMethod, subtotal, discountAmount, serviceCharge, tax, grandTotal, printTarget);
        }

        alert(`⚠️ Offline! Transaksi disimpan di antrean tablet & struk dicetak.`);
        updateOfflineBadge();
        resetCartState();
        return;
    }

    // JALUR ONLINE
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        
        if(json.success) {
            let finalOrderId = activeOrderId || json.orderId;

            if (printTarget !== false && printTarget !== "None") {
                executeRoutingPrint(finalOrderId, tableNo, orderStatus, paymentMethod, subtotal, discountAmount, serviceCharge, tax, grandTotal, printTarget);
            }
            
            alert(`Pesanan sukses dikirim ke sistem pusat!`);
            resetCartState();
            
            if (window.innerWidth < 768) {
                toggleMobileCart();
            }
        } else { alert("Error Server: " + json.message); }
    } catch (e) {
        alert("Server bermasalah. Transaksi dialihkan ke offline queue.");
        navigator.onLine = false;
        processOrder(statusTarget, printTarget);
    }
}

function resetCartState() {
    cart = [];
    document.getElementById('order-table').value = "";
    activeOrderId = null;
    const ind = document.getElementById('draft-indicator');
    if (ind) ind.classList.add('hidden-screen');
    renderCart();
    updateMobileCartButtonVisibility();
}

async function syncOfflineQueue() {
    let queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
    if (queue.length === 0) return;

    console.log(`Mengirim ${queue.length} antrean transaksi offline ke server...`);
    
    for (let i = 0; i < queue.length; i++) {
        try {
            let res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(queue[i]) });
            let json = await res.json();
            if (json.success) { queue.splice(i, 1); i--; localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); }
        } catch (e) { break; }
    }
    updateOfflineBadge();
    if (queue.length === 0) {
        alert("🎉 Semua transaksi offline berhasil di-upload ke database Google Sheets!");
    }
}

// --- PORTRAIT MODE SENSORS ---
function toggleMobileCart() {
    const panel = document.getElementById('cart-panel');
    const trigger = document.getElementById('mobile-cart-trigger');
    if (!panel || !trigger) return;
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden', 'md:flex');
        panel.classList.add('fixed', 'inset-0', 'z-[45]', 'flex');
        trigger.classList.add('hidden-screen'); 
    } else {
        panel.classList.add('hidden', 'md:flex');
        panel.classList.remove('fixed', 'inset-0', 'z-[45]', 'flex');
        updateMobileCartButtonVisibility();
    }
}

function updateMobileCartButtonVisibility() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    const trigger = document.getElementById('mobile-cart-trigger');
    if (!trigger) return;

    const isModalOpen = !document.getElementById('modal-history').classList.contains('hidden-screen') || 
                        !document.getElementById('modal-print').classList.contains('hidden-screen');

    if (count > 0 && window.innerWidth < 768 && cashierInfo && !isModalOpen) {
        trigger.classList.remove('hidden-screen');
    } else {
        trigger.classList.add('hidden-screen');
    }
}

// --- PRINTER ROUTING CERDAS ---
function reprintOrder(orderId) {
    const bill = historyDataRaw.find(b => b.orderId === orderId);
    if(!bill) return;

    const subtotal = bill.items.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = (subtotal + bill.tax + bill.serviceCharge) - bill.totalAmount; 

    executeRoutingPrint(bill.orderId, bill.tableNo, bill.status, bill.paymentMethod, subtotal, discountAmount, bill.serviceCharge, bill.tax, bill.totalAmount, "All", true);
}

function executeRoutingPrint(orderId, table, status, payMethod, subtotal, discountAmount, serviceCharge, tax, grandTotal, target, isReprint = false) {
    const namaResto = configData["NAMA_PERUSAAN"] || "RESTO";
    const alamat = configData["ALAMAT"] || "";
    const footerStruk = configData["FOOTER_STRUK"] || "Terima Kasih Atas Kunjungannya!";
    
    const currentDateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let finalReceipt = "";
    let reprintTag = isReprint ? "[C]<b>*** REPRINT / SALINAN ***</b>\n" : "";

    if (target === "All" && status === "Paid") {
        finalReceipt += reprintTag;
        finalReceipt += `[C]<b>${namaResto}</b>\n[C]${alamat}\n[C]--------------------------------\n[L]ID   : ${orderId}\n[L]Meja : ${table}\n[L]Kasir: ${cashierInfo.name}\n[L]Tgl  : ${currentDateStr} [R]${currentTimeStr}\n[C]--------------------------------\n`;
        cart.forEach(item => {
            finalReceipt += `[L]<b>${item.name}</b>\n`;
            if(item.notes) finalReceipt += `[L]  *${item.notes}\n`;
            finalReceipt += `[L]${item.qty}x ${item.price} [R]${item.subtotal}\n`;
        });
        finalReceipt += `[C]--------------------------------\n[L]Subtotal [R]${subtotal}\n`;
        if(discountAmount > 0) finalReceipt += `[L]Diskon [R]-${discountAmount}\n`;
        if(serviceCharge > 0) finalReceipt += `[L]Layanan/Service [R]${serviceCharge}\n`;
        if(tax > 0) finalReceipt += `[L]Pajak/Tax [R]${tax}\n`;
        finalReceipt += `[L]<b>TOTAL</b> [R]<b>${grandTotal}</b>\n[C]--------------------------------\n`;
        finalReceipt += `[C]Status : LUNAS (${payMethod})\n[C]${footerStruk}\n\n\n`;
        finalReceipt += `[C]- - - - - POTONG DI SINI - - - - -\n\n\n`;
    }

    if (target === "All" || target === "Kitchen") {
        const kitchenItems = cart.filter(item => item.route === "Kitchen");
        if (kitchenItems.length > 0) {
            finalReceipt += reprintTag;
            finalReceipt += `[C]<b>KITCHEN ORDER (DAPUR)</b>\n[L]Meja : <b><font size="big">${table}</font></b>\n[L]ID   : ${orderId}\n[L]Jam  : <b>${currentTimeStr} WITA</b>\n[C]--------------------------------\n`;
            kitchenItems.forEach(item => {
                finalReceipt += `[L]<b>[ ] ${item.qty}x  ${item.name}</b>\n`;
                if(item.notes) finalReceipt += `[L]   *Catatan: ${item.notes}\n`;
                finalReceipt += `[L]--------------------------------\n`;
            });
            finalReceipt += `\n\n\n[C]- - - - - POTONG DI SINI - - - - -\n\n\n`;
        }
    }

    if (target === "All" || target === "Bar") {
        const barItems = cart.filter(item => item.route === "Bar");
        if (barItems.length > 0) {
            finalReceipt += reprintTag;
            finalReceipt += `[C]<b>BAR ORDER (MINUMAN)</b>\n[L]Meja : <b><font size="big">${table}</font></b>\n[L]ID   : ${orderId}\n[L]Jam  : <b>${currentTimeStr} WITA</b>\n[C]--------------------------------\n`;
            barItems.forEach(item => {
                finalReceipt += `[L]<b>[ ] ${item.qty}x  ${item.name}</b>\n`;
                if(item.notes) finalReceipt += `[L]   *Catatan: ${item.notes}\n`;
                finalReceipt += `[L]--------------------------------\n`;
            });
            finalReceipt += `\n\n\n`;
        }
    }

    if (finalReceipt !== "") {
        const base64Data = btoa(unescape(encodeURIComponent(finalReceipt)));
        const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        window.location.href = intentUrl;
    }
}
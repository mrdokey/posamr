/**
 * MODUL 2: CORE POS, VOUCHER DROPDOWN, ROUNDING, CART LOGIC, & CASCADING SUB-CATEGORY
 * UPDATE: Responsive Row-Align Card Layout (No Clipping & Safe Auto-Height)
 */

function getRoundedAmount(amount) {
    const arah = (configData["PEMBULATAN_ARAH"] || "NONE").toUpperCase().trim(); 
    const nominal = parseInt(configData["PEMBULAN_NOMINAL"] || "1000") || 1000;
    
    if (arah === "UP") {
        return Math.ceil(amount / nominal) * nominal;
    } else if (arah === "DOWN") {
        return Math.floor(amount / nominal) * nominal;
    } else if (arah === "NEAREST") {
        return Math.round(amount / nominal) * nominal;
    }
    return amount; 
}

async function fetchConfigBg() {
    let area = cashierInfo ? cashierInfo.area : "";
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getConfig', data: { area: area } }) });
        const json = await res.json();
        if(json.success) {
            const nameEl = document.getElementById('login-resto-name');
            if (nameEl) nameEl.innerText = json.data["NAMA_PERUSAHAAN"] || "RESTO";
        }
    } catch(e) {}
}

async function loginKasir() {
    if(loginPinValue.length < 4) return;
    const btn = document.getElementById('btn-login');
    if (btn) btn.innerText = "Memeriksa...";
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'loginPOS', data: { pin: loginPinValue } }) });
        const json = await res.json();
        
        if(json.success) {
            const jobdeskClean = (json.jobdesk || "").toLowerCase().trim();
            const roleClean = (json.role || "").toLowerCase().trim();

            let isCashier = jobdeskClean.includes("cashier");
            let isAdmin = roleClean.includes("admin") || roleClean.includes("manager") || roleClean.includes("owner") || roleClean.includes("hrd");

            if (isCashier || isAdmin) { 
                localStorage.setItem(STORAGE_USER, JSON.stringify(json));
                window.location.reload();
            } else {
                // DIALOG INFORMATIF UNTUK DEBUGGING RIIL DI TABLET
                alert("Akses Ditolak!\n\nSistem mendeteksi data Anda:\n- Role: " + json.role + "\n- Jobdesk: " + json.jobdesk + "\n\nAnda wajib memiliki Jobdesk 'Cashier' atau Role Manajemen (Admin/Manager/Owner/HRD) untuk masuk ke mesin kasir.");
                clearPin();
                if (btn) btn.innerText = "Buka Mesin POS";
            }
        } else {
            alert("Gagal Login:\n\n" + json.message);
            clearPin();
            if (btn) btn.innerText = "Buka Mesin POS";
        }
    } catch (e) {
        alert("Koneksi gagal atau terjadi gangguan server!\n\nDetail: " + e.message);
        clearPin();
        if (btn) btn.innerText = "Buka Mesin POS";
    }
}

function logoutKasir() {
    if(confirm("Keluar dari sesi aplikasi saat ini?")) {
        localStorage.removeItem(STORAGE_USER);
        window.location.href = "index.html"; 
    }
}

async function initApp() {
    const localMenu = localStorage.getItem('localMenu');
    const localConfig = localStorage.getItem('localConfig');
    const localDisc = localStorage.getItem('localDiscounts');
    const localVouchers = localStorage.getItem('localVouchers');
    
    if(localConfig) { configData = JSON.parse(localConfig); applyConfig(); }
    if(localMenu) { 
        menuData = JSON.parse(localMenu); 
        filteredData = menuData;
        renderCategoryButtons(); // <--- INJEKSI DINAMIS KATEGORI LOKAL
        renderMenuHTML(filteredData); 
    }
    if(localDisc) { discountData = JSON.parse(localDisc); renderDiscounts(); }
    if(localVouchers) { 
        voucherData = JSON.parse(localVouchers); 
        renderVouchers(); 
    }

    let userArea = cashierInfo ? cashierInfo.area : "";

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getMenu', data: { area: userArea } }) });
        const json = await res.json();
        if(json.success) {
            menuData = json.data;
            localStorage.setItem('localMenu', JSON.stringify(menuData));
            renderCategoryButtons(); // <--- INJEKSI DINAMIS KATEGORI CLOUD
            if(document.getElementById('search-menu').value === "") {
                const safeId = currentCategory.replace(/\s+/g, '_');
                filterMenu(currentCategory, document.getElementById('btn-cat-' + safeId)); 
            }
        }
        const resConf = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getConfig', data: { area: userArea } }) });
        const jsonConf = await resConf.json();
        if(jsonConf.success) {
            configData = jsonConf.data;
            localStorage.setItem('localConfig', JSON.stringify(configData));
            applyConfig();
        }
        const resDisc = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getDiscounts', data: { area: userArea } }) });
        const jsonDisc = await resDisc.json();
        if(jsonDisc.success) {
            discountData = jsonDisc.data;
            localStorage.setItem('localDiscounts', JSON.stringify(discountData));
            renderDiscounts();
        }
        const resVoucher = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getVouchers', data: { area: userArea } }) });
        const jsonVoucher = await resVoucher.json();
        if(jsonVoucher.success) {
            voucherData = jsonVoucher.data;
            localStorage.setItem('localVouchers', JSON.stringify(voucherData));
            renderVouchers(); 
        }
    } catch (e) { 
        document.getElementById('offline-badge').classList.remove('hidden'); 
        renderVouchers(); 
    }
}

function applyConfig() {
    const titleEl = document.getElementById('pos-title');
    if(configData["NAMA_PERUSAHAAN"] && titleEl) titleEl.innerText = configData["NAMA_PERUSAHAAN"];
}

function renderDiscounts() {
    const select = document.getElementById('cart-discount-select');
    if (select) {
        select.innerHTML = `<option value="0" data-id="DISC-00">Tanpa Discount (0%)</option>` + 
        discountData.map(d => {
            let displayPerc = d.percentage < 1 ? (d.percentage * 100) : d.percentage;
            return `<option value="${d.percentage}" data-id="${d.id}">${d.name} (${displayPerc}%)</option>`;
        }).join('');
    }
}

// ==========================================
// GENERATOR FILTER KATEGORI UTAMA DINAMIS (LANDSCAPE)
// ==========================================
function renderCategoryButtons() {
    const container = document.getElementById('filter-buttons');
    if (!container) return;

    // Ambil semua kategori unik yang aktif dari menuData
    let uniqueCategories = new Set();
    menuData.forEach(item => {
        if (item.category && item.category.trim() !== "") {
            uniqueCategories.add(item.category.trim());
        }
    });

    let sortedCategories = Array.from(uniqueCategories).sort();

    // Render HTML diawali dengan tombol "Semua"
    let buttonsHtml = `
        <button id="btn-cat-Semua" onclick="filterMenu('Semua', this)" class="cat-btn bg-amber-500 text-slate-900 px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap smooth-transition shadow-md">Semua</button>
    `;

    // Render tombol dinamis lainnya (mengganti spasi dengan underscore untuk selector ID)
    sortedCategories.forEach(cat => {
        const safeId = cat.replace(/\s+/g, '_');
        buttonsHtml += `
            <button id="btn-cat-${safeId}" onclick="filterMenu('${cat}', this)" class="cat-btn bg-slate-800 text-slate-300 hover:bg-slate-700 px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap smooth-transition">${cat}</button>
        `;
    });

    container.innerHTML = buttonsHtml;
}

// ==========================================
// CASCADING FILTER KATEGORI UTAMA & SUB-KATEGORI (LANDSCAPE)
// ==========================================
function filterMenu(cat, btnElement = null) {
    currentCategory = cat;
    currentSubCategory = 'Semua'; // Reset sub-kategori saat kategori utama berganti

    if (btnElement) {
        document.querySelectorAll('.cat-btn').forEach(b => {
            b.classList.remove('bg-amber-500', 'text-slate-900', 'shadow-md');
            b.classList.add('bg-slate-800', 'text-slate-300');
        });
        btnElement.classList.remove('bg-slate-800', 'text-slate-300', 'hover:bg-slate-700');
        btnElement.classList.add('bg-amber-500', 'text-slate-900', 'shadow-md');
    }

    renderSubCategoryChips();
    applyFilters();
}

function renderSubCategoryChips() {
    const bar = document.getElementById('sub-category-bar');
    if (!bar) return;

    if (currentCategory === 'Semua') {
        bar.classList.add('hidden');
        bar.innerHTML = "";
        return;
    }

    // Cari sub-kategori unik dari menu yang masuk kategori utama terpilih
    let uniqueSubs = new Set();
    menuData.forEach(item => {
        if (item.category === currentCategory && item.subCategory && item.subCategory.trim() !== "") {
            uniqueSubs.add(item.subCategory.trim());
        }
    });

    if (uniqueSubs.size === 0) {
        bar.classList.add('hidden');
        bar.innerHTML = "";
        return;
    }

    bar.classList.remove('hidden');

    let chipsHtml = `
        <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-2">Sub-Menu:</span>
        <button onclick="filterSubMenu('Semua', this)" id="btn-sub-Semua" class="sub-chip bg-amber-500 text-slate-950 px-4 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all">
            SEMUA
        </button>
    `;

    Array.from(uniqueSubs).sort().forEach(sub => {
        chipsHtml += `
            <button onclick="filterSubMenu('${sub}', this)" id="btn-sub-${sub.replace(/\s+/g, '_')}" class="sub-chip bg-slate-800 text-slate-400 px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all hover:text-white">
                ${sub.toUpperCase()}
            </button>
        `;
    });

    bar.innerHTML = chipsHtml;
}

function filterSubMenu(subCat, btnElement) {
    currentSubCategory = subCat;

    document.querySelectorAll('.sub-chip').forEach(b => {
        b.className = "sub-chip bg-slate-800 text-slate-400 px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all hover:text-white";
    });

    if (btnElement) {
        btnElement.className = "sub-chip bg-amber-500 text-slate-950 px-4 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all";
    }

    applyFilters();
}

function searchMenu(val) { applyFilters(val.toLowerCase()); }

function applyFilters(searchStr = "") {
    const keyword = searchStr || document.getElementById('search-menu').value.toLowerCase();
    filteredData = menuData;
    
    if (currentCategory !== 'Semua') { 
        filteredData = filteredData.filter(m => (m.category || "").trim() === currentCategory); 
    }

    if (currentSubCategory !== 'Semua') {
        filteredData = filteredData.filter(m => (m.subCategory || "").trim() === currentSubCategory);
    }
    
    if (keyword !== "") {
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
        const safeId = String(item.id || '').replace(/'/g, "\\'").replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const safeName = String(item.name || 'Menu').replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const safeRoute = String(item.route || 'Kitchen').replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const safeDesc = String(item.description || '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeCat = String(item.category || '-').trim();
        const safePrice = Number(item.price) || 0;

        const fallbackImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=1e293b&color=f59e0b&size=200&font-size=0.33`;
        const totalSoldData = parseInt(item.totalSold) || 0; 
        const isHot = totalSoldData > 10;
        
        const badgeHtml = isHot ? `<div class="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-black px-2.5 py-1 rounded-md shadow-md animate-pulse">🔥 HOT</div>` : ``;

        return `
        <div onclick="addToCart('${safeId}', '${safeName}', ${safePrice}, '${safeRoute}')" class="menu-card bg-slate-800 rounded-2xl border border-slate-700 flex flex-col overflow-hidden cursor-pointer hover:border-amber-500 relative transition-all duration-300 h-full active:scale-95 text-slate-100">
            <div class="h-[110px] w-full relative shrink-0 overflow-hidden bg-slate-900">
                <img src="${item.image || fallbackImg}" onerror="this.onerror=null; this.src='${fallbackImg}';" class="w-full h-full object-cover transition-transform duration-700 hover:scale-110">
                ${badgeHtml}
                <div class="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-md text-slate-300 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-700">${safeCat}</div>
            </div>
            <div class="p-3 flex flex-col justify-between flex-1 bg-slate-800 w-full">
                <div class="text-left mb-2 w-full">
                    <h3 class="text-xs font-bold text-white break-words whitespace-normal leading-snug w-full">${safeName}</h3>
                    <p class="text-[9px] text-slate-400 mt-1 break-words whitespace-normal leading-relaxed w-full">${safeDesc}</p>
                </div>
                <p class="text-xs font-black text-amber-500 mt-auto tracking-tight text-left">Rp ${safePrice.toLocaleString('id-ID')}</p>
            </div>
        </div>
    `}).join('');
    lucide.createIcons();
}

function renderVouchers() {
    const select = document.getElementById('cart-voucher-select');
    if (select) {
        select.innerHTML = `<option value="NONE">Tanpa Voucher</option>` + 
            voucherData.map(v => {
                let displayVal = v.type.toLowerCase() === 'percent' ? `${v.value}%` : `Rp ${v.value.toLocaleString('id-ID')}`;
                return `<option value="${v.code}">${v.code} - Potongan ${displayVal} (Min. Rp ${v.minPurchase.toLocaleString('id-ID')})</option>`;
            }).join('');
    }
}

function applyVoucherSelect(code) {
    if (code === "NONE") {
        appliedVoucher = null;
    } else {
        const voucher = voucherData.find(v => v.code === code);
        const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
        
        if (voucher) {
            if (subtotal >= voucher.minPurchase) {
                appliedVoucher = voucher;
            } else {
                alert(`Syarat minimal belanja Rp ${voucher.minPurchase.toLocaleString('id-ID')} tidak terpenuhi!`);
                const selectVoucher = document.getElementById('cart-voucher-select');
                if (selectVoucher) selectVoucher.value = "NONE";
                appliedVoucher = null;
            }
        }
    }
    renderCart();
}

function removeVoucher() {
    appliedVoucher = null;
    const selectVoucher = document.getElementById('cart-voucher-select');
    if (selectVoucher) selectVoucher.value = "NONE";
    renderCart();
}

function addToCart(id, name, price, route) {
    if (activeOrderId) {
        if(!confirm("Anda sedang memproses pelunasan. Tambah menu baru ke bill ini?")) return;
        activeOrderId = null;
    }

    const exist = cart.find(i => i.menuId === id);
    if(exist) { 
        exist.qty++; 
        exist.subtotal = exist.qty * price; 
    } else { 
        cart.push({ 
            menuId: id, 
            name: name, 
            price: price, 
            qty: 1, 
            subtotal: price, 
            notes: '', 
            route: route || 'Kitchen' 
        }); 
    }
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
    if(confirm("Kosongkan keranjang kasir?")) {
        cart = [];
        document.getElementById('order-table').value = "";
        activeOrderId = null;
        appliedVoucher = null; 
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
    
    let voucherAmount = 0;
    if (appliedVoucher) {
        if (subtotal < appliedVoucher.minPurchase) {
            appliedVoucher = null; 
            const selectVoucher = document.getElementById('cart-voucher-select');
            if (selectVoucher) selectVoucher.value = "NONE";
            alert("Voucher otomatis dilepas karena minimal belanja tidak terpenuhi.");
        } else {
            if (appliedVoucher.type.toLowerCase() === 'percent') {
                voucherAmount = subtotal * (appliedVoucher.value / 100);
            } else {
                voucherAmount = appliedVoucher.value;
            }
        }
    }
    
    const btnSplit = document.getElementById('btn-split-trigger');
    if (btnSplit) {
        if (activeOrderId && cart.length > 0) {
            btnSplit.classList.remove('hidden'); 
        } else {
            btnSplit.classList.add('hidden'); 
        }
    }

    const vInfo = document.getElementById('active-voucher-info');
    const vInputCont = document.getElementById('voucher-input-container');
    if (appliedVoucher) {
        if (vInfo) {
            vInfo.classList.remove('hidden');
            vInfo.classList.add('flex');
        }
        if (vInputCont) vInputCont.classList.add('hidden');
        
        const codeEl = document.getElementById('active-voucher-code');
        const valEl = document.getElementById('active-voucher-value');
        if (codeEl) codeEl.innerText = appliedVoucher.code;
        if (valEl) valEl.innerText = "- Rp " + voucherAmount.toLocaleString('id-ID');
    } else {
        if (vInfo) {
            vInfo.classList.add('hidden');
            vInfo.classList.remove('flex');
        }
        if (vInputCont) vInputCont.classList.remove('hidden');
    }

    const totalDiscounts = discountAmount + voucherAmount;
    const netSubtotal = Math.max(0, subtotal - totalDiscounts); 

    const servicePerc = parseFloat(configData["SERVICE_CHARGE"] || 0);
    const serviceCharge = netSubtotal * (servicePerc / 100);
    const taxPerc = parseFloat(configData["PAJAK_PB1"] || 0); 
    const tax = (netSubtotal + serviceCharge) * (taxPerc / 100);
    
    const rawTotal = netSubtotal + serviceCharge + tax;

    const roundedTotal = getRoundedAmount(rawTotal);
    window.lastRoundingAdjustment = roundedTotal - rawTotal;

    document.getElementById('cart-count').innerText = cart.reduce((sum, item) => sum + item.qty, 0);
    document.getElementById('cart-subtotal').innerText = "Rp " + subtotal.toLocaleString('id-ID');
    document.getElementById('cart-tax').innerText = "Rp " + (tax + serviceCharge).toLocaleString('id-ID');
    document.getElementById('cart-grandtotal').innerText = "Rp " + roundedTotal.toLocaleString('id-ID'); 

    const mobCount = document.getElementById('mobile-cart-count');
    const mobTotal = document.getElementById('mobile-cart-total');
    if (mobCount) mobCount.innerText = cart.reduce((sum, item) => sum + item.qty, 0);
    if (mobTotal) mobTotal.innerText = "Rp " + roundedTotal.toLocaleString('id-ID');

    updateMobileCartButtonVisibility();

    if(cart.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-600 smooth-transition"><i data-lucide="shopping-basket" class="w-16 h-16 mb-3 opacity-20"></i><p class="text-sm">Keranjang Kosong</p></div>`;
        lucide.createIcons();
        return;
    }

    container.innerHTML = cart.map((item, idx) => `
        <div class="bg-slate-800 p-3.5 rounded-2xl border border-slate-700 shadow-sm relative animate-slide-up text-slate-100">
            <div class="flex justify-between items-start mb-2">
                <div class="pr-2 text-left">
                    <h4 class="text-xs font-bold text-white leading-tight">${item.name}</h4>
                    <p class="text-[13px] text-amber-500 font-black mt-1">Rp ${item.subtotal.toLocaleString('id-ID')}</p>
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
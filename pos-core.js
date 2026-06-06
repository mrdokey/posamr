/**
 * MODUL 2: CORE POS & CART LOGIC
 */

async function fetchConfigBg() {
    let area = cashierInfo ? cashierInfo.area : "";
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getConfig', data: { area: area } }) });
        const json = await res.json();
        if(json.success) {
            const nameEl = document.getElementById('login-resto-name');
            if (nameEl) nameEl.innerText = json.data["NAMA_PERUSAAN"] || "RESTO";
        }
    } catch(e) {}
}

// FILE: pos-core.js (Bagian loginKasir)

async function loginKasir() {
    if(loginPinValue.length < 4) return;
    const btn = document.getElementById('btn-login');
    if (btn) btn.innerText = "Memeriksa...";
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'loginPOS', data: { pin: loginPinValue } }) });
        const json = await res.json();
        if(json.success) {
            const allowedRoles = ["admin", "hrd", "manager", "owner"];
            const jobdeskClean = json.jobdesk ? json.jobdesk.toLowerCase().trim() : "";
            const roleClean = json.role ? json.role.toLowerCase().trim() : "";

            // VALIDASI PERAN POS KASIR (Strict Role Validation)
            if (jobdeskClean === "kasir" || allowedRoles.includes(roleClean)) {
                localStorage.setItem(STORAGE_USER, JSON.stringify(json));
                window.location.reload();
            } else {
                alert(`Akses Ditolak! Pelayan/Staff tidak diizinkan masuk ke aplikasi POS Utama.`);
                clearPin();
                if (btn) btn.innerText = "Buka Mesin POS";
            }
        } else {
            alert(json.message);
            clearPin();
            if (btn) btn.innerText = "Buka Mesin POS";
        }
    } catch (e) {
        alert("Koneksi gagal!");
        clearPin();
        if (btn) btn.innerText = "Buka Mesin POS";
    }
}

function logoutKasir() {
    if(confirm("Keluar dari sesi aplikasi saat ini?")) {
        localStorage.removeItem(STORAGE_USER);
        // Mengalihkan pengguna kembali ke Pintu Utama (Kiosk Absensi)
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
        renderMenuHTML(filteredData); 
    }
    if(localDisc) { discountData = JSON.parse(localDisc); renderDiscounts(); }
    if(localVouchers) { voucherData = JSON.parse(localVouchers); }

    let userArea = cashierInfo ? cashierInfo.area : "";

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getMenu', data: { area: userArea } }) });
        const json = await res.json();
        if(json.success) {
            menuData = json.data;
            localStorage.setItem('localMenu', JSON.stringify(menuData));
            if(document.getElementById('search-menu').value === "") {
                filterMenu(currentCategory, document.getElementById(`btn-cat-${currentCategory}`)); 
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
        // FETCH VOUCHERS PER AREA
        const resVoucher = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: 'getVouchers', data: { area: userArea } }) });
        const jsonVoucher = await resVoucher.json();
        if(jsonVoucher.success) {
            voucherData = jsonVoucher.data;
            localStorage.setItem('localVouchers', JSON.stringify(voucherData));
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
        
        const badgeHtml = isHot ? `<div class="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-black px-2.5 py-1 rounded-md shadow-md animate-pulse">🔥 HOT</div>` : ``;

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
                <p class="text-[15px] font-black text-amber-500 mt-3 tracking-tight">Rp ${item.price.toLocaleString()}</p>
            </div>
        </div>
    `}).join('');
    lucide.createIcons();
}

// --- FUNGSI VOUCHER ---
function applyVoucher() {
    const inputEl = document.getElementById('voucher-input');
    const input = inputEl.value.trim().toUpperCase();
    if (!input) return alert("Masukkan kode voucher terlebih dahulu!");
    
    const voucher = voucherData.find(v => v.code.toUpperCase() === input);
    if (!voucher) {
        alert("Voucher tidak ditemukan atau tidak berlaku untuk cabang ini!");
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    if (subtotal < voucher.minPurchase) {
        alert(`Minimal belanja Rp ${voucher.minPurchase.toLocaleString()} untuk menggunakan voucher ini!`);
        return;
    }
    
    appliedVoucher = voucher;
    inputEl.value = "";
    renderCart();
}

function removeVoucher() {
    appliedVoucher = null;
    renderCart();
}

// FILE: pos-core.js (Bagian addToCart)

function addToCart(id, name, price, route) {
    if (activeOrderId) {
        if(!confirm("Anda sedang memproses pelunasan. Tambah menu baru ke bill ini?")) return;
        activeOrderId = null;
        // Penyesuaian: Menghapus manipulasi kelas hidden-screen pada tombol yang sudah tidak digunakan
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
        appliedVoucher = null; // Reset voucher
        renderCart();
    }
}

function renderCart() {
    const container = document.getElementById('cart-container');
    if (!container) return;

    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    
    // Diskon Promo (Member/Loyalty)
    const selectDisc = document.getElementById('cart-discount-select');
    let discVal = parseFloat(selectDisc ? selectDisc.value : 0 || 0);
    let discountAmount = discVal < 1 ? subtotal * discVal : subtotal * (discVal / 100); 
    
    // Diskon Voucher
    let voucherAmount = 0;
    if (appliedVoucher) {
        if (subtotal < appliedVoucher.minPurchase) {
            appliedVoucher = null; // Auto hapus jika syarat gugur
            alert("Voucher otomatis dilepas karena minimal belanja tidak terpenuhi.");
        } else {
            if (appliedVoucher.type.toLowerCase() === 'percent') {
                voucherAmount = subtotal * (appliedVoucher.value / 100);
            } else {
                voucherAmount = appliedVoucher.value;
            }
        }
    }
    
    // FILE: pos-core.js (Tambahkan baris ini di dalam fungsi renderCart paling bawah)

    // Sembunyikan atau Tampilkan Tombol Split Bill
    const btnSplit = document.getElementById('btn-split-trigger');
    if (btnSplit) {
        if (activeOrderId && cart.length > 0) {
            btnSplit.classList.remove('hidden'); // Muncul jika sedang edit meja aktif
        } else {
            btnSplit.classList.add('hidden'); // Sembunyikan jika transaksi baru
        }
    }

    // UI Voucher Toggler
    const vInfo = document.getElementById('active-voucher-info');
    const vInputCont = document.getElementById('voucher-input-container');
    if (appliedVoucher) {
        vInfo.classList.remove('hidden');
        vInfo.classList.add('flex');
        vInputCont.classList.add('hidden');
        document.getElementById('active-voucher-code').innerText = appliedVoucher.code;
        document.getElementById('active-voucher-value').innerText = "- Rp " + voucherAmount.toLocaleString();
    } else {
        vInfo.classList.add('hidden');
        vInfo.classList.remove('flex');
        vInputCont.classList.remove('hidden');
    }

    const totalDiscounts = discountAmount + voucherAmount;
    const netSubtotal = Math.max(0, subtotal - totalDiscounts); // Cegah minus

    const servicePerc = parseFloat(configData["SERVICE_CHARGE"] || 0);
    const serviceCharge = netSubtotal * (servicePerc / 100);
    const taxPerc = parseFloat(configData["PAJAK_PB1"] || 0); 
    const tax = (netSubtotal + serviceCharge) * (taxPerc / 100);
    
    const grandTotal = netSubtotal + serviceCharge + tax;

    document.getElementById('cart-count').innerText = cart.reduce((sum, item) => sum + item.qty, 0);
    document.getElementById('cart-subtotal').innerText = "Rp " + subtotal.toLocaleString();
    document.getElementById('cart-tax').innerText = "Rp " + (tax + serviceCharge).toLocaleString();
    document.getElementById('cart-grandtotal').innerText = "Rp " + grandTotal.toLocaleString();

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
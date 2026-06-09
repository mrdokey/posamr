/**
 * MODUL 3: CHECKOUT, HISTORY, VOID, SPLIT BILL, & TWO-STAGE PRINT ENGINE
 * STRUKTUR: Conceptual Modular Sections (Clean & High Performance)
 */

// ==========================================
// SEKSI 1: STATE & DRAFT NOTIFICATION POLLING
// ==========================================
let currentTransactionTotal = 0; 
let splitOriginalItems = []; 
let splitTargetItems = [];   

async function checkNewDraftNotifications() {
    if (!navigator.onLine) return;
    let userArea = cashierInfo ? cashierInfo.area : "";
    try {
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "getHistoryOrders", data: { area: userArea } }) 
        });
        const json = await res.json();
        if (json.success) {
            historyDataRaw = json.data;
            const draftCount = historyDataRaw.filter(d => d.status === "Draft").length;
            const alertDot = document.getElementById('draft-alert-dot');
            if (alertDot) {
                if (draftCount > 0) alertDot.classList.remove('hidden'); 
                else alertDot.classList.add('hidden');
            }
        }
    } catch(e) {}
}

if (pollInterval === null) {
    checkNewDraftNotifications(); 
    pollInterval = setInterval(checkNewDraftNotifications, 10000);
}

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

    const modalHistory = document.getElementById('modal-history');
    const modalPrint = document.getElementById('modal-print');
    const isModalOpen = (modalHistory && !modalHistory.classList.contains('hidden-screen')) || 
                        (modalPrint && !modalPrint.classList.contains('hidden-screen'));

    if (count > 0 && window.innerWidth < 768 && cashierInfo && !isModalOpen) {
        trigger.classList.remove('hidden-screen');
    } else {
        trigger.classList.add('hidden-screen');
    }
}

// ==========================================
// SEKSI 2: RIWAYAT & MANAJEMEN TAB DRAFT (HISTORY)
// ==========================================
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
    if (container) container.innerHTML = `<div class="py-20 text-center text-slate-500 animate-pulse">Menarik data...</div>`;

    if(!navigator.onLine) {
        if (container) container.innerHTML = `<div class="py-20 text-center text-rose-500 font-bold">Koneksi Offline. Riwayat tidak bisa dimuat.</div>`;
        return;
    }

    let userArea = cashierInfo ? cashierInfo.area : "";

    try {
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "getHistoryOrders", data: { area: userArea } }) 
        });
        const json = await res.json();
        
        if (json.success) {
            historyDataRaw = json.data;
            const filteredData = historyDataRaw.filter(d => d.status === tabName);
            
            if (filteredData.length > 0) {
                container.innerHTML = filteredData.map(bill => {
                    let actionButtons = "";
                    if (tabName === "Draft") {
                        actionButtons = `
                            <button onclick="activateAndPrintDraft('${bill.orderId}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md">
                                <i data-lucide="printer" class="w-3.5 h-3.5"></i> Cetak & Aktifkan
                            </button>
                            <button onclick="editDraft('${bill.orderId}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition">Edit</button>
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
                    <div class="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex justify-between items-center shadow-md animate-slide-up">
                        <div>
                            <h4 class="font-black text-white text-lg flex items-center gap-2">${bill.tableNo} <span class="bg-slate-800 text-[10px] px-2 py-0.5 rounded-full font-normal text-slate-400">${bill.time}</span></h4>
                            <p class="text-xs text-slate-500 mt-1">ID: ${bill.orderId} | Total: <span class="text-amber-500 font-bold">Rp ${bill.totalAmount.toLocaleString('id-ID')}</span></p>
                        </div>
                        <div class="flex items-center gap-2">
                            ${actionButtons}
                        </div>
                    </div>
                `}).join('');
            } else {
                if (container) container.innerHTML = `<div class="py-20 text-center text-slate-600"><i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>Tidak ada data ${tabName}</div>`;
            }
        } else {
            if (container) container.innerHTML = `<div class="py-12 text-center text-rose-500">Error: ${json.message}</div>`;
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

    if (bill.voucherCode) {
        const v = voucherData.find(vx => vx.code === bill.voucherCode);
        if (v) appliedVoucher = v;
        else appliedVoucher = null;
    } else {
        appliedVoucher = null;
    }

    const ind = document.getElementById('draft-indicator');
    if (ind) ind.classList.remove('hidden-screen');
    renderCart();
    closeModal('modal-history');
    
    if (window.innerWidth < 768) {
        toggleMobileCart();
    }
}

async function activateAndPrintDraft(orderId) {
    const bill = historyDataRaw.find(b => b.orderId === orderId);
    if (!bill) {
        alert("Gagal: Data pesanan tidak ditemukan di memori lokal tablet!");
        return;
    }

    if (!bill.items || bill.items.length === 0) {
        alert(`Gagal Aktifkan Meja ${bill.tableNo}!\n\nDraft ini kosong (tidak ada item pesanan di sheet 'OrderDetails'). Silakan buat draft pesanan baru.`);
        return;
    }

    if (!confirm(`Cetak pesanan ke Dapur & Bar, lalu aktifkan Meja ${bill.tableNo}?`)) {
        return;
    }

    const subtotal = bill.items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalDiscountAmount = (subtotal + bill.tax + bill.serviceCharge) - bill.totalAmount;

    // Cetak dapur/bar langsung
    executeRoutingPrintDirect(bill, subtotal, totalDiscountAmount);

    let userArea = cashierInfo ? cashierInfo.area : "";
    const payload = {
        action: "placeOrder",
        data: {
            orderId: bill.orderId,
            tableNo: bill.tableNo,
            kasirId: cashierInfo.userId,
            area: userArea,
            discount: bill.discountId || "DISC-00",
            voucherCode: bill.voucherCode || "",
            tax: bill.tax,
            serviceCharge: bill.serviceCharge,
            totalAmount: bill.totalAmount,
            paymentMethod: "-",
            orderStatus: "Open", 
            items: bill.items.map(i => ({
                menuId: i.menuId,
                qty: i.qty,
                price: i.price,
                subtotal: i.subtotal,
                notes: i.notes || "",
                route: i.route || "Kitchen"
            }))
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) {
            alert(`Meja ${bill.tableNo} berhasil diaktifkan & dikirim ke printer Dapur/Bar!`);
            switchTab('Open'); 
            checkNewDraftNotifications(); 
        } else {
            alert("Gagal mengaktifkan meja: " + json.message);
        }
    } catch (e) {
        alert("Gagal menghubungi server utama untuk sinkronisasi database.");
    }
}

// ==========================================
// SEKSI 3: KONTROL PEMBATALAN (VOID ENGINE)
// ==========================================
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
    if(!reason || !pin) return alert("Isi Alasan dan PIN/OTP Atasan!");

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

    let userArea = cashierInfo ? cashierInfo.area : "";

    const payload = {
        action: "placeOrder",
        data: {
            orderId: voidTargetId, tableNo: bill.tableNo, area: userArea, 
            discount: bill.discountId, voucherCode: bill.voucherCode || "",
            tax: bill.tax, serviceCharge: bill.serviceCharge, totalAmount: 0, 
            paymentMethod: "-", orderStatus: "Void", voidReason: reasonText, items: [] 
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

// ==========================================
// SEKSI 4: PEMISAHAN TAGIHAN (SPLIT BILL ENGINE)
// ==========================================
function openSplitModal() {
    if (!activeOrderId) return alert("Pilih meja aktif terlebih dahulu dari riwayat!");
    splitOriginalItems = JSON.parse(JSON.stringify(cart));
    splitTargetItems = [];
    renderSplitUI();
    openModal('modal-split-bill');
}

function renderSplitUI() {
    const origContainer = document.getElementById('split-original-container');
    const targetContainer = document.getElementById('split-target-container');
    
    origContainer.innerHTML = splitOriginalItems.map((item, idx) => `
        <div class="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center">
            <div class="pr-2">
                <p class="text-xs font-bold text-white line-clamp-1">${item.name}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">Rp ${item.price.toLocaleString('id-ID')} x ${item.qty}</p>
            </div>
            <button onclick="moveItemToSplit(${idx})" class="w-7 h-7 bg-slate-800 rounded-lg text-amber-500 hover:bg-amber-500 hover:text-slate-950 flex items-center justify-center font-bold text-sm smooth-transition">
                <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');

    targetContainer.innerHTML = splitTargetItems.map((item, idx) => `
        <div class="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center">
            <button onclick="moveItemToOriginal(${idx})" class="w-7 h-7 bg-slate-800 rounded-lg text-slate-400 hover:bg-red-500 hover:text-white flex items-center justify-center font-bold text-sm smooth-transition">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
            <div class="text-right pl-2">
                <p class="text-xs font-bold text-white line-clamp-1">${item.name}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">Rp ${item.price.toLocaleString('id-ID')} x ${item.qty}</p>
            </div>
        </div>
    `).join('');

    const splitTotal = splitTargetItems.reduce((sum, item) => sum + item.subtotal, 0);
    document.getElementById('split-total-amount').innerText = "Rp " + splitTotal.toLocaleString('id-ID');
    lucide.createIcons();
}

function moveItemToSplit(index) {
    const item = splitOriginalItems[index];
    if (item.qty <= 0) return;

    item.qty--;
    item.subtotal = item.qty * item.price;

    const exist = splitTargetItems.find(i => i.menuId === item.menuId);
    if (exist) {
        exist.qty++;
        exist.subtotal = exist.qty * exist.price;
    } else {
        splitTargetItems.push({ ...item, qty: 1, subtotal: item.price, notes: '' });
    }

    if (item.qty === 0) {
        splitOriginalItems.splice(index, 1);
    }
    renderSplitUI();
}

function moveItemToOriginal(index) {
    const item = splitTargetItems[index];
    if (item.qty <= 0) return;

    item.qty--;
    item.subtotal = item.qty * item.price;

    const exist = splitOriginalItems.find(i => i.menuId === item.menuId);
    if (exist) {
        exist.qty++;
        exist.subtotal = exist.qty * exist.price;
    } else {
        splitOriginalItems.push({ ...item, qty: 1, subtotal: item.price, notes: '' });
    }

    if (item.qty === 0) {
        splitTargetItems.splice(index, 1);
    }
    renderSplitUI();
}

async function confirmSplit() {
    if (splitTargetItems.length === 0) return alert("Pindahkan minimal 1 item ke Bill Baru!");
    const origTableNo = document.getElementById('order-table').value.trim();
    
    if (!confirm(`Sistem akan memperbarui tagihan meja asli ${origTableNo} dan memuat tagihan baru ke keranjang untuk dilunasi.`)) {
        return;
    }

    const subtotalOrig = splitOriginalItems.reduce((sum, item) => sum + item.subtotal, 0);
    const servicePerc = parseFloat(configData["SERVICE_CHARGE"] || 0);
    const serviceChargeOrig = subtotalOrig * (servicePerc / 100);
    const taxPerc = parseFloat(configData["PAJAK_PB1"] || 0); 
    const taxOrig = (subtotalOrig + serviceChargeOrig) * (taxPerc / 100);
    const grandTotalOrig = subtotalOrig + serviceChargeOrig + taxOrig;

    let userArea = cashierInfo ? cashierInfo.area : "";

    const payloadOrigUpdate = {
        action: "placeOrder",
        data: {
            orderId: activeOrderId, 
            tableNo: origTableNo,
            kasirId: cashierInfo.userId,
            area: userArea,
            discount: "DISC-00", 
            voucherCode: "",
            tax: taxOrig,
            serviceCharge: serviceChargeOrig,
            totalAmount: grandTotalOrig,
            paymentMethod: "-",
            orderStatus: "Open", 
            items: splitOriginalItems
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payloadOrigUpdate) });
        const json = await res.json();
        
        if (json.success) {
            activeOrderId = null; 
            document.getElementById('order-table').value = origTableNo + " (Split)"; 
            cart = splitTargetItems; 
            
            const ind = document.getElementById('draft-indicator');
            if (ind) ind.classList.add('hidden-screen'); 
            
            renderCart(); 
            closeModal('modal-split-bill');
            alert("Bill berhasil dipisah! Keranjang sekarang berisi Bill Baru yang siap dilunasi.");
        } else {
            alert("Gagal memperbarui bill asli: " + json.message);
        }
    } catch (e) {
        alert("Gagal koneksi ke server untuk memproses split bill.");
    }
}

// ==========================================
// SEKSI 5: PEMBAYARAN (CHECKOUT) & DUA TAHAP PRINT ENGINE
// ==========================================
function saveDraft() {
    if(cart.length === 0) return alert("Keranjang kosong!");
    if(!document.getElementById('order-table').value.trim()) return alert("Isi Nomor Meja!");
    submitOrderPayload("Draft", false);
}

function openPrintModal() {
    if(cart.length === 0) return alert("Keranjang kosong!");
    if(!document.getElementById('order-table').value.trim()) return alert("Isi Nomor Meja!");
    
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const selectDisc = document.getElementById('cart-discount-select');
    const discPerc = parseFloat(selectDisc ? selectDisc.value : 0 || 0);
    let discountAmount = discPerc < 1 ? subtotal * discPerc : subtotal * (discPerc / 100); 
    
    let voucherAmount = 0;
    if (appliedVoucher) {
        voucherAmount = appliedVoucher.type.toLowerCase() === 'percent' 
            ? subtotal * (appliedVoucher.value / 100) 
            : appliedVoucher.value;
    }
    
    const totalDiscount = discountAmount + voucherAmount;
    const netSubtotal = Math.max(0, subtotal - totalDiscount);
    
    const servicePerc = parseFloat(configData["SERVICE_CHARGE"] || 0);
    const serviceCharge = netSubtotal * (servicePerc / 100);

    const taxPerc = parseFloat(configData["PAJAK_PB1"] || 0); 
    const tax = (netSubtotal + serviceCharge) * (taxPerc / 100);
    
    currentTransactionTotal = netSubtotal + serviceCharge + tax;

    document.getElementById('modal-order-id').innerText = activeOrderId || "BARU";
    document.getElementById('modal-grand-total').innerText = "Rp " + currentTransactionTotal.toLocaleString('id-ID');
    
    document.getElementById('cash-received-input').value = "";
    document.getElementById('cash-change-display').innerText = "Rp 0";
    document.getElementById('cash-change-display').className = "font-black text-emerald-400 text-sm";

    openModal('modal-print');
}

function calculateChange() {
    const inputVal = parseFloat(document.getElementById('cash-received-input').value) || 0;
    const change = inputVal - currentTransactionTotal;
    const display = document.getElementById('cash-change-display');

    if (change >= 0) {
        display.innerText = "Rp " + change.toLocaleString('id-ID');
        display.className = "font-black text-emerald-400 text-sm";
    } else {
        display.innerText = "Kurang Rp " + Math.abs(change).toLocaleString('id-ID');
        display.className = "font-black text-rose-500 text-sm";
    }
}

function setQuickCash(val) {
    const input = document.getElementById('cash-received-input');
    if (val === 'pas') {
        input.value = currentTransactionTotal;
    } else {
        input.value = val;
    }
    calculateChange();
}

function processCashPayment() {
    const inputVal = parseFloat(document.getElementById('cash-received-input').value) || 0;
    if (inputVal < currentTransactionTotal) {
        alert("Pembayaran Gagal! Uang tunai yang diterima kurang.");
        return;
    }
    
    window.lastCashReceived = inputVal;
    window.lastCashChange = inputVal - currentTransactionTotal;
    
    closeModal('modal-print');
    submitOrderPayload("Cash", "All"); 
}

function processNonCashPayment(method) {
    closeModal('modal-print');
    
    window.lastCashReceived = currentTransactionTotal;
    window.lastCashChange = 0;

    if (method === 'Open') {
        submitOrderPayload("Open", "All"); 
    } else {
        submitOrderPayload(method, "All"); 
    }
}

async function submitOrderPayload(statusTarget, printTarget) {
    const tableNo = document.getElementById('order-table').value.trim();
    const selectDisc = document.getElementById('cart-discount-select');
    const discountId = selectDisc ? selectDisc.options[selectDisc.selectedIndex].getAttribute('data-id') : "";
    const discPerc = parseFloat(selectDisc ? selectDisc.value : 0 || 0);

    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    let discountAmount = discPerc < 1 ? subtotal * discPerc : subtotal * (discPerc / 100); 
    
    let voucherAmount = 0;
    if (appliedVoucher) {
        voucherAmount = appliedVoucher.type.toLowerCase() === 'percent' 
            ? subtotal * (appliedVoucher.value / 100) 
            : appliedVoucher.value;
    }
    
    const totalDiscount = discountAmount + voucherAmount;
    const netSubtotal = Math.max(0, subtotal - totalDiscount);
    
    const servicePerc = parseFloat(configData["SERVICE_CHARGE"] || 0);
    const serviceCharge = netSubtotal * (servicePerc / 100);

    const taxPerc = parseFloat(configData["PAJAK_PB1"] || 0); 
    const tax = (netSubtotal + serviceCharge) * (taxPerc / 100);
    
    const grandTotal = netSubtotal + serviceCharge + tax;

    let paymentMethod = "-";
    let orderStatus = "Open";

    if (statusTarget === "Draft") {
        orderStatus = "Draft";
    } else if (statusTarget === "Open") {
        orderStatus = "Open";
    } else {
        paymentMethod = statusTarget; 
        orderStatus = "Paid";
    }

    let userArea = cashierInfo ? cashierInfo.area : "";

    const payload = {
        action: "placeOrder", 
        data: {
            orderId: activeOrderId || "", 
            tableNo: tableNo,
            kasirId: cashierInfo.userId, 
            area: userArea, 
            discount: discountId,
            voucherCode: appliedVoucher ? appliedVoucher.code : "", 
            tax: tax, 
            serviceCharge: serviceCharge, 
            totalAmount: grandTotal, 
            paymentMethod: paymentMethod,
            orderStatus: orderStatus, 
            items: cart
        }
    };

    if (!navigator.onLine) {
        let queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
        queue.push(payload);
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

        if (printTarget !== false && printTarget !== "None") {
            if (orderStatus === "Paid") {
                // Offline Mode: Tetap gunakan split print agar kasir manual bisa merobek
                executeRoutingPrint(payload.data.orderId || "OFF-ST-" + Date.now(), tableNo, orderStatus, paymentMethod, subtotal, totalDiscount, serviceCharge, tax, grandTotal, "CustomerCopy");
            } else {
                executeRoutingPrint(payload.data.orderId || "OFF-" + Date.now(), tableNo, orderStatus, paymentMethod, subtotal, totalDiscount, serviceCharge, tax, grandTotal, printTarget);
            }
        }

        if (orderStatus === "Paid") {
            showSuccessChangeModal(grandTotal, window.lastCashReceived, window.lastCashChange);
        } else {
            alert(`⚠️ Offline! Transaksi ${orderStatus} disimpan di antrean lokal.`);
            resetCartState();
            checkNewDraftNotifications(); 
        }
        updateOfflineBadge();
        return;
    }

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        
        if(json.success) {
            let finalOrderId = activeOrderId || json.orderId;

            if (orderStatus === "Paid") {
                // TAHAP 1: SIMPAN TRANSAKSI SECARA GLOBAL UNTUK KEBUTUHAN CETAK ARSIP (TAHAP 2)
                window.lastTransactionData = {
                    orderId: finalOrderId,
                    tableNo: tableNo,
                    paymentMethod: paymentMethod,
                    subtotal: subtotal,
                    totalDiscount: totalDiscount,
                    serviceCharge: serviceCharge,
                    tax: tax,
                    grandTotal: grandTotal,
                    items: JSON.parse(JSON.stringify(cart))
                };

                // TAHAP 1: Hanya mencetak Struk Pelanggan, Order Dapur, dan Order Bar secara instan
                if (printTarget !== false && printTarget !== "None") {
                    executeRoutingPrint(finalOrderId, tableNo, orderStatus, paymentMethod, subtotal, totalDiscount, serviceCharge, tax, grandTotal, "CustomerCopy");
                    executeRoutingPrint(finalOrderId, tableNo, orderStatus, paymentMethod, subtotal, totalDiscount, serviceCharge, tax, grandTotal, "Kitchen", false, window.lastTransactionData.items);
                    executeRoutingPrint(finalOrderId, tableNo, orderStatus, paymentMethod, subtotal, totalDiscount, serviceCharge, tax, grandTotal, "Bar", false, window.lastTransactionData.items);
                }
                
                showSuccessChangeModal(grandTotal, window.lastCashReceived, window.lastCashChange);
            } else {
                // Pengecekan Cetak untuk Non-Lunas (Draft / Open Bill)
                if (printTarget !== false && printTarget !== "None") {
                    executeRoutingPrint(finalOrderId, tableNo, orderStatus, paymentMethod, subtotal, totalDiscount, serviceCharge, tax, grandTotal, printTarget);
                }
                alert(`Pesanan berhasil disimpan sebagai ${orderStatus}!`);
                resetCartState();
                checkNewDraftNotifications(); 
            }

            if (window.innerWidth < 768) {
                toggleMobileCart();
            }
        } else { alert("Error Server: " + json.message); }
    } catch (e) {
        alert("Server bermasalah. Transaksi dialihkan ke offline queue.");
        navigator.onLine = false;
        submitOrderPayload(statusTarget, printTarget);
    }
}

// === ALUR KONTROL DUA TAHAP (ECO PAPER INTERAKTIF) ===
function printArsipAndComplete() {
    if (window.lastTransactionData) {
        const t = window.lastTransactionData;
        // TAHAP 2: Cetak khusus Arsip Toko saja ke printer Kasir
        executeRoutingPrint(t.orderId, t.tableNo, "Paid", t.paymentMethod, t.subtotal, t.totalDiscount, t.serviceCharge, t.tax, t.grandTotal, "ArsipCopy", false, t.items);
    }
    skipArsipAndComplete(); // Selesaikan transaksi langsung
}

function skipArsipAndComplete() {
    window.lastTransactionData = null;
    closeSuccessChangeModal();
}

function showSuccessChangeModal(total, received, change) {
    document.getElementById('success-total').innerText = "Rp " + total.toLocaleString('id-ID');
    document.getElementById('success-received').innerText = "Rp " + received.toLocaleString('id-ID');
    document.getElementById('success-change').innerText = "Rp " + change.toLocaleString('id-ID');
    openModal('modal-success-change');
    lucide.createIcons();
}

function closeSuccessChangeModal() {
    closeModal('modal-success-change');
    resetCartState(); 
    checkNewDraftNotifications(); 
}

function resetCartState() {
    cart = [];
    document.getElementById('order-table').value = "";
    activeOrderId = null;
    appliedVoucher = null; 

    const ind = document.getElementById('draft-indicator');
    if (ind) ind.classList.add('hidden-screen');
    
    const selectDisc = document.getElementById('cart-discount-select');
    if (selectDisc) selectDisc.selectedIndex = 0;
    
    renderCart();
    updateMobileCartButtonVisibility();
}

async function syncOfflineQueue() {
    let queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
    if (queue.length === 0) return;

    for (let i = 0; i < queue.length; i++) {
        try {
            let res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(queue[i]) });
            let json = await res.json();
            if (json.success) { queue.splice(i, 1); i--; localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); }
        } catch (e) { break; }
    }
    updateOfflineBadge();
}

// ==========================================
// SEKSI 6: REPRINT ENGINE (SASARAN MODEL SPESIFIK)
// ==========================================
function reprintOrder(orderId) {
    // Membuka modal khusus reprint di pos.html
    document.getElementById('reprint-order-id').value = orderId;
    openModal('modal-reprint');
}

function triggerReprintTarget(targetType) {
    const orderId = document.getElementById('reprint-order-id').value;
    if (!orderId) return;

    const bill = historyDataRaw.find(b => b.orderId === orderId);
    if (!bill) {
        alert("Gagal: Data transaksi tidak ditemukan!");
        return;
    }

    const subtotal = bill.items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalDiscountAmount = (subtotal + bill.tax + bill.serviceCharge) - bill.totalAmount;

    // Trigger cetak ulang spesifik sesuai sasaran yang diinginkan kasir
    executeRoutingPrint(
        bill.orderId, 
        bill.tableNo, 
        bill.status, 
        bill.paymentMethod || "Cash", 
        subtotal, 
        totalDiscountAmount, 
        bill.serviceCharge, 
        bill.tax, 
        bill.totalAmount, 
        targetType, 
        true, // isReprint = true
        bill.items
    );

    closeModal('modal-reprint');
}

// ==========================================
// SEKSI 7: SISTEM PEMBAYARAN KOMPLIMEN (FOC) DENGAN OTP
// ==========================================
function processComplimentPayment() {
    const type = prompt("PILIH JENIS KOMPLIMEN:\nKetik 1 : VIP / Owner Treat (Butuh OTP Manager)\nKetik 2 : Kesalahan Staff / Potong Gaji (Butuh OTP Staff)");
    if (!type) return;

    if (type === "1") {
        const otp = prompt("Masukkan 4-Digit OTP Manager:");
        if (!otp) return;
        verifyComplimentCode(otp, "VIP");
    } else if (type === "2") {
        const otp = prompt("PENGAKUAN SALAH:\nMasukkan 4-Digit OTP Staff yang bersangkutan:");
        if (!otp) return;
        verifyComplimentCode(otp, "Staff-Error");
    } else {
        alert("Pilihan tidak valid!");
    }
}

function verifyComplimentCode(inputCode, mode) {
    fetch(GAS_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "verifyVoidManager", data: { managerPin: inputCode } }) 
    })
    .then(res => res.json())
    .then(json => {
        if (json.success) {
            window.lastCashReceived = 0;
            window.lastCashChange = 0;
            closeModal('modal-print');

            if (mode === "VIP") {
                if (json.type !== "VIP") {
                    alert("Akses Ditolak! Harus menggunakan OTP Manager/Owner.");
                    return;
                }
                alert(`Komplimen VIP Disetujui oleh: ${json.managerName}`);
                submitComplimentPayload(`ACC: ${json.managerName}`, "Compliment", json.managerName);
            } else {
                alert(`Kesalahan dicatat atas nama: ${json.managerName} (Beban Potong Gaji)`);
                submitComplimentPayload(`POTONG GAJI: ${json.managerName}`, "Staff-Error", json.managerName);
            }
        } else {
            alert(json.message || "Verifikasi Gagal!");
        }
    })
    .catch(err => alert("Gagal verifikasi keamanan. Periksa koneksi internet."));
}

async function submitComplimentPayload(logAuditText, paymentMethodTarget, employeeName) {
    const tableNo = document.getElementById('order-table').value.trim();
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    let userArea = cashierInfo ? cashierInfo.area : "";

    const payload = {
        action: "placeOrder", 
        data: {
            orderId: activeOrderId || "", 
            tableNo: tableNo,
            kasirId: cashierInfo.userId, 
            area: userArea, 
            discount: "COMP-100", 
            voucherCode: logAuditText, 
            tax: 0,              
            serviceCharge: 0,    
            totalAmount: 0,      
            paymentMethod: paymentMethodTarget, 
            orderStatus: "Paid", 
            items: cart.map(item => ({
                menuId: item.menuId,
                qty: item.qty,
                price: item.price,
                subtotal: item.subtotal, 
                notes: `${item.notes || ""} (${logAuditText})` 
            }))
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        if(json.success) {
            // Cetak satu struk pelanggan 0 rupiah untuk bukti (Eco-friendly)
            executeRoutingPrint(activeOrderId || json.orderId, tableNo, "Paid", paymentMethodTarget.toUpperCase(), subtotal, subtotal, 0, 0, 0, "CustomerCopy");
            alert(`Transaksi Berhasil Dicatat! (${logAuditText})`);
            resetCartState();
            checkNewDraftNotifications();
        }
    } catch (e) {
        alert("Gagal memproses data ke server pusat.");
    }
}
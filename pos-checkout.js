/**
 * MODUL 3: CHECKOUT, HISTORY, VOID, PRINTER & RESPONSIVE PORTRAIT
 * UPDATE: Fix Auto-Sync History & Cashier Checkout Flow
 */

let currentTransactionTotal = 0; // State Penyimpan Tagihan Aktif

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
    if (!bill) return;

    if (!confirm(`Cetak pesanan ke Dapur & Bar, lalu aktifkan Meja ${bill.tableNo}?`)) {
        return;
    }

    const subtotal = bill.items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalDiscountAmount = (subtotal + bill.tax + bill.serviceCharge) - bill.totalAmount;

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
            alert(`Meja ${bill.tableNo} berhasil diaktifkan & pesanan dikirim ke printer!`);
            switchTab('Open');
            checkNewDraftNotifications(); // Auto-sync
        } else {
            alert("Gagal mengaktifkan meja: " + json.message);
        }
    } catch (e) {
        alert("Gagal menghubungi server utama untuk sinkronisasi database.");
    }
}

function executeRoutingPrintDirect(bill, subtotal, discountAmount) {
    const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    let finalReceipt = "";

    const kitchenItems = bill.items.filter(item => item.route === "Kitchen");
    if (kitchenItems.length > 0) {
        finalReceipt += `[C]<b>KITCHEN ORDER (DAPUR)</b>\n[L]Meja : <b><font size="big">${bill.tableNo}</font></b>\n[L]ID   : ${bill.orderId}\n[L]Jam  : <b>${currentTimeStr} WITA</b>\n[C]--------------------------------\n`;
        kitchenItems.forEach(item => {
            finalReceipt += `[L]<b>[ ] ${item.qty}x  ${item.name}</b>\n`;
            if(item.notes) finalReceipt += `[L]   *Catatan: ${item.notes}\n`;
            finalReceipt += `[L]--------------------------------\n`;
        });
        finalReceipt += `\n\n\n[C]- - - - - POTONG DI SINI - - - - -\n\n\n`;
    }

    const barItems = bill.items.filter(item => item.route === "Bar");
    if (barItems.length > 0) {
        finalReceipt += `[C]<b>BAR ORDER (MINUMAN)</b>\n[L]Meja : <b><font size="big">${bill.tableNo}</font></b>\n[L]ID   : ${bill.orderId}\n[L]Jam  : <b>${currentTimeStr} WITA</b>\n[C]--------------------------------\n`;
        barItems.forEach(item => {
            finalReceipt += `[L]<b>[ ] ${item.qty}x  ${item.name}</b>\n`;
            if(item.notes) finalReceipt += `[L]   *Catatan: ${item.notes}\n`;
            finalReceipt += `[L]--------------------------------\n`;
        });
        finalReceipt += `\n\n\n`;
    }

    if (finalReceipt !== "") {
        const base64Data = btoa(unescape(encodeURIComponent(finalReceipt)));
        const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        window.location.href = intentUrl;
    }
}

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
            executeRoutingPrint(payload.data.orderId || "OFFLINE-"+Date.now(), tableNo, orderStatus, paymentMethod, subtotal, totalDiscount, serviceCharge, tax, grandTotal, printTarget);
        }

        if (orderStatus === "Paid") {
            showSuccessChangeModal(grandTotal, window.lastCashReceived, window.lastCashChange);
        } else {
            alert(`⚠️ Offline! Transaksi ${orderStatus} disimpan di antrean lokal.`);
            resetCartState();
            checkNewDraftNotifications(); // Auto-Sync Manual
        }
        updateOfflineBadge();
        return;
    }

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const json = await res.json();
        
        if(json.success) {
            let finalOrderId = activeOrderId || json.orderId;

            if (printTarget !== false && printTarget !== "None") {
                executeRoutingPrint(finalOrderId, tableNo, orderStatus, paymentMethod, subtotal, totalDiscount, serviceCharge, tax, grandTotal, printTarget);
            }
            
            if (orderStatus === "Paid") {
                showSuccessChangeModal(grandTotal, window.lastCashReceived, window.lastCashChange);
            } else {
                alert(`Pesanan berhasil disimpan sebagai ${orderStatus}!`);
                resetCartState();
                checkNewDraftNotifications(); // Auto-sync History pasca simpan draft/open
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
    checkNewDraftNotifications(); // Auto-sync History pasca LUNAS
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

function reprintOrder(orderId) {
    const bill = historyDataRaw.find(b => b.orderId === orderId);
    if(!bill) return;

    const subtotal = bill.items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalDiscountAmount = (subtotal + bill.tax + bill.serviceCharge) - bill.totalAmount; 

    executeRoutingPrint(bill.orderId, bill.tableNo, bill.status, bill.paymentMethod, subtotal, totalDiscountAmount, bill.serviceCharge, bill.tax, bill.totalAmount, "All", true);
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
            finalReceipt += `[L]${item.qty}x ${item.price.toLocaleString('id-ID')} [R]${item.subtotal.toLocaleString('id-ID')}\n`;
        });
        finalReceipt += `[C]--------------------------------\n[L]Subtotal [R]${subtotal.toLocaleString('id-ID')}\n`;
        if(discountAmount > 0) finalReceipt += `[L]Diskon/Voucher [R]-${discountAmount.toLocaleString('id-ID')}\n`;
        if(serviceCharge > 0) finalReceipt += `[L]Layanan/Service [R]${serviceCharge.toLocaleString('id-ID')}\n`;
        if(tax > 0) finalReceipt += `[L]Pajak/Tax [R]${tax.toLocaleString('id-ID')}\n`;
        finalReceipt += `[L]<b>TOTAL</b> [R]<b>${grandTotal.toLocaleString('id-ID')}</b>\n[C]--------------------------------\n`;
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
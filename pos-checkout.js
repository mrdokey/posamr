/**
 * MODUL 3: CHECKOUT, HISTORY, VOID, PRINTER & RESPONSIVE PORTRAIT
 * UPDATE: PURE JOBDESK FILTERING (Kasir = Proses Pesanan, Pelayan = Draft)
 */

// --- PEMBATASAN AKSES HAK JOBDESK ---
function applyJobdeskRules() {
    // Normalisasi teks agar kebal huruf besar/kecil
    const jobdesk = (cashierInfo.jobdesk || "").toLowerCase().trim();
    
    clearInterval(pollInterval);

    const btnHistory = document.getElementById('btn-history-trigger');
    const btnResetLicense = document.querySelector('button[onclick="resetLicense()"]');

    // JIKA MURNI PELAYAN (Hanya Kirim Draft)
    if (jobdesk === "pelayan") {
        document.getElementById('discount-section').classList.add('hidden-screen');
        document.getElementById('btn-cashier-print').classList.add('hidden-screen');
        document.getElementById('btn-save-draft').classList.remove('hidden-screen');
        document.getElementById('btn-draft-text').innerText = "KIRIM ORDER (DRAFT)";
        
        if (btnHistory) btnHistory.remove();
        if (btnResetLicense) btnResetLicense.remove();
    } 
    // JIKA KASIR / ADMIN / MANAGER / OWNER (Akses Penuh Pembayaran)
    else {
        document.getElementById('discount-section').classList.remove('hidden-screen');
        document.getElementById('btn-cashier-print').classList.remove('hidden-screen'); // TOMBOL PROSES PESANAN MUNCUL!
        document.getElementById('btn-save-draft').classList.add('hidden-screen'); 
        
        if (btnHistory) btnHistory.classList.remove('hidden-screen');
        
        checkNewDraftNotifications(); 
        pollInterval = setInterval(checkNewDraftNotifications, 10000); 
    }
}

// --- POLLING DRAFT UNTUK KASIR ---
async function checkNewDraftNotifications() {
    if (!navigator.onLine) return;
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "getHistoryOrders" }) });
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

// --- PORTRAIT SENSORS & FLOATING CART ---
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

    // Tampilkan tombol melayang jika di HP dan layar tidak tertutup pop-up
    if (count > 0 && window.innerWidth < 768 && cashierInfo && !isModalOpen) {
        trigger.classList.remove('hidden-screen');
    } else {
        trigger.classList.add('hidden-screen');
    }
}

// --- RIWAYAT & DRAFT ---
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
                            <button onclick="editDraft('${bill.orderId}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition">Proses Draft</button>
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
            orderId: voidTargetId, tableNo: bill.tableNo, discount: bill.discountId,
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

    // JIKA PELAYAN: Otomatis kunci status hanya boleh "Draft" [FIX BUG]
    const jobdeskCheck = (cashierInfo.jobdesk || "").toLowerCase().trim();
    if (jobdeskCheck === "pelayan") {
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
    
    // Kembalikan dropdown diskon ke 0% jika ada
    const selectDisc = document.getElementById('cart-discount-select');
    if (selectDisc) selectDisc.selectedIndex = 0;
    
    renderCart();
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
}

// --- PRINTER ROUTING ---
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
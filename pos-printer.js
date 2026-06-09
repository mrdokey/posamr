/**
 * MODUL PRINTER: ENGINE RAWBT & TEMPLATE STRUK
 * Menangani Multi-Printer Routing (Kasir, Dapur, Bar)
 */

// --- HELPER 1: ENKODE TEKS KE BASE64 SECARA AMAN (Mencegah Crash UTF-8 / Simbol Rupiah) ---
function safeStringToBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}

// --- HELPER 2: KIRIM INTENT PRINTER RAWBT SPESIFIK ---
function sendIntentToRawBT(plainTextReceipt, printerProfileName) {
    // 1. Konversi teks struk biasa ke Base64 secara otomatis
    const base64Data = safeStringToBase64(plainTextReceipt);
    
    // 2. Masukkan base64Data ke jalur URI utama (intent:base64,...) agar tinta teks terbaca oleh RawBT
    const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.printer=${printerProfileName};end;`;
    
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = intentUrl;
    document.body.appendChild(iframe);
    
    setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    }, 1000);
}

// --- ENGINE 1: DRAFT TO OPEN (KITCHEN & BAR BYPASS) ---
function executeRoutingPrintDirect(bill, subtotal, discountAmount) {
    const printerKitchenProfile = configData["PRINTER_KITCHEN"] || "Kitchen";
    const printerBarProfile = configData["PRINTER_BAR"] || "Bar";
    const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // 1. KITCHEN PRINT
    const kitchenItems = bill.items.filter(item => item.route === "Kitchen");
    if (kitchenItems.length > 0) {
        let kitchenReceipt = "";
        kitchenReceipt += `[C]<b>KITCHEN ORDER (DAPUR)</b>\n`;
        kitchenReceipt += `[C]--------------------------------\n`;
        kitchenReceipt += `[L]Meja : <b>${bill.tableNo}</b>\n`;
        kitchenReceipt += `[L]ID   : ${bill.orderId}\n`;
        kitchenReceipt += `[L]Jam  : ${currentTimeStr} WITA\n`;
        kitchenReceipt += `[C]--------------------------------\n`;
        kitchenItems.forEach(item => {
            kitchenReceipt += `[L]<b>[ ] ${item.qty}x  ${item.name}</b>\n`;
            if(item.notes) kitchenReceipt += `[L]   *Catatan: ${item.notes}\n`;
            kitchenReceipt += `[L]--------------------------------\n`;
        });
        kitchenReceipt += `\n\n\n[C]- - - - - POTONG DI SINI - - - - -\n\n\n`;
        
        sendIntentToRawBT(kitchenReceipt, printerKitchenProfile);
    }

    // 2. BAR PRINT (DELAYED SECONDS TO PREVENT COLLISION)
    const barItems = bill.items.filter(item => item.route === "Bar");
    if (barItems.length > 0) {
        let barReceipt = "";
        barReceipt += `[C]<b>BAR ORDER (MINUMAN)</b>\n`;
        barReceipt += `[C]--------------------------------\n`;
        barReceipt += `[L]Meja : <b>${bill.tableNo}</b>\n`;
        barReceipt += `[L]ID   : ${bill.orderId}\n`;
        barReceipt += `[L]Jam  : ${currentTimeStr} WITA\n`;
        barReceipt += `[C]--------------------------------\n`;
        barItems.forEach(item => {
            barReceipt += `[L]<b>[ ] ${item.qty}x  ${item.name}</b>\n`;
            if(item.notes) barReceipt += `[L]   *Catatan: ${item.notes}\n`;
            barReceipt += `[L]--------------------------------\n`;
        });
        barReceipt += `\n\n\n`;
        
        setTimeout(() => {
            sendIntentToRawBT(barReceipt, printerBarProfile);
        }, 1200); 
    }
}

// --- ENGINE 2: CHASE OUT & INTERFACE ROUTING (Paid, Open, & Reprint) ---
function executeRoutingPrint(orderId, table, status, payMethod, subtotal, discountAmount, serviceCharge, tax, grandTotal, target, isReprint = false, itemsToPrint = null) {
    const printerKasirProfile = configData["PRINTER_KASIR"] || "Bloetooth";
    const printerKitchenProfile = configData["PRINTER_KITCHEN"] || "Kitchen";
    const printerBarProfile = configData["PRINTER_BAR"] || "Bar";
    
    const namaResto = configData["NAMA_PERUSAAN"] || "LABARAC BAR";
    const alamat = configData["ALAMAT"] || "Denpasar, Bali";
    const footerStruk = configData["FOOTER_STRUK"] || "Terima Kasih Atas Kunjungannya!";
    
    const currentDateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const items = itemsToPrint || cart; 
    let delayMultiplier = 0; 

    // 1. BILL UTAMA / STRUK LUNAS (KASIR PRINTER)
    if (target === "All" && (status === "Paid" || status === "Open")) {
        const generateInvoiceBody = (copyLabel) => {
            let body = "";
            if (isReprint) body += `[C]<b>*** REPRINT / SALINAN ***</b>\n`;
            body += `[C]<b>${namaResto}</b>\n`;
            body += `[C]${alamat}\n`;
            body += `[C]--------------------------------\n`;
            body += `[C]<b>${copyLabel}</b>\n`;
            body += `[C]--------------------------------\n`;
            body += `[L]ID   : ${orderId}\n`;
            body += `[L]Meja : <b>${table}</b>\n`;
            body += `[L]Kasir: ${cashierInfo.name}\n`;
            body += `[L]Tgl  : ${currentDateStr} [R]${currentTimeStr}\n`;
            body += `[C]--------------------------------\n`;
            
            items.forEach(item => {
                body += `[L]<b>${item.name}</b>\n`;
                if(item.notes) body += `[L]  *${item.notes}\n`;
                body += `[L]${item.qty}x ${item.price.toLocaleString('id-ID')} [R]${item.subtotal.toLocaleString('id-ID')}\n`;
            });
            
            body += `[C]--------------------------------\n`;
            body += `[L]Subtotal [R]${subtotal.toLocaleString('id-ID')}\n`;
            if(discountAmount > 0) body += `[L]Total Diskon [R]-${discountAmount.toLocaleString('id-ID')}\n`;
            if(serviceCharge > 0) body += `[L]Service Charge [R]${serviceCharge.toLocaleString('id-ID')}\n`;
            if(tax > 0) body += `[L]Pajak PB1 [R]${tax.toLocaleString('id-ID')}\n`;
            body += `[C]--------------------------------\n`;
            body += `[L]<b>GRAND TOTAL</b> [R]<b>${grandTotal.toLocaleString('id-ID')}</b>\n`;
            
            if (status === "Paid") {
                const tunai = window.lastCashReceived || grandTotal;
                const kembalian = window.lastCashChange || 0;
                body += `[L]Bayar (${payMethod}) [R]${tunai.toLocaleString('id-ID')}\n`;
                body += `[L]Kembalian [R]${kembalian.toLocaleString('id-ID')}\n`;
                body += `[C]--------------------------------\n`;
                body += `[C]<b>STATUS : LUNAS</b>\n`;
                body += `[C]${footerStruk}\n`;
            } else {
                body += `[C]--------------------------------\n`;
                body += `[C]<b>STATUS : TAGIHAN SEMENTARA</b>\n`;
                body += `[C]Harap lakukan pembayaran di kasir\n`;
            }
            body += `\n\n\n`;
            return body;
        };

        let cashierReceipt = "";
        if (status === "Paid") {
            cashierReceipt += generateInvoiceBody("STRUK PELANGGAN");
            cashierReceipt += `[C]- - - - - POTONG DI SINI - - - - -\n\n\n`;
            cashierReceipt += generateInvoiceBody("ARSIP TOKO / DAPUR");
            cashierReceipt += `[C]- - - - - POTONG DI SINI - - - - -\n\n\n`;
        } else {
            cashierReceipt += generateInvoiceBody("BILL TAGIHAN MEJA");
            cashierReceipt += `[C]- - - - - POTONG DI SINI - - - - -\n\n\n`;
        }

        sendIntentToRawBT(cashierReceipt, printerKasirProfile);
        delayMultiplier++;
    }

    // 2. KITCHEN ORDER (DAPUR)
    if (target === "All" || target === "Kitchen") {
        const kitchenItems = items.filter(item => item.route === "Kitchen");
        if (kitchenItems.length > 0) {
            let kitchenReceipt = "";
            if (isReprint) kitchenReceipt += `[C]<b>*** REPRINT / SALINAN ***</b>\n`;
            kitchenReceipt += `[C]<b>KITCHEN ORDER (DAPUR)</b>\n`;
            kitchenReceipt += `[C]--------------------------------\n`;
            kitchenReceipt += `[L]Meja : <b>${table}</b>\n`;
            kitchenReceipt += `[L]ID   : ${orderId}\n`;
            kitchenReceipt += `[L]Jam  : ${currentTimeStr} WITA\n`;
            kitchenReceipt += `[C]--------------------------------\n`;
            kitchenItems.forEach(item => {
                kitchenReceipt += `[L]<b>[ ] ${item.qty}x  ${item.name}</b>\n`;
                if(item.notes) kitchenReceipt += `[L]   *Catatan: ${item.notes}\n`;
                kitchenReceipt += `[L]--------------------------------\n`;
            });
            kitchenReceipt += `\n\n\n[C]- - - - - POTONG DI SINI - - - - -\n\n\n`;

            setTimeout(() => {
                sendIntentToRawBT(kitchenReceipt, printerKitchenProfile);
            }, delayMultiplier * 1200);
            delayMultiplier++;
        }
    }

    // 3. BAR ORDER (MINUMAN)
    if (target === "All" || target === "Bar") {
        const barItems = items.filter(item => item.route === "Bar");
        if (barItems.length > 0) {
            let barReceipt = "";
            if (isReprint) barReceipt += `[C]<b>*** REPRINT / SALINAN ***</b>\n`;
            barReceipt += `[C]<b>BAR ORDER (MINUMAN)</b>\n`;
            barReceipt += `[C]--------------------------------\n`;
            barReceipt += `[L]Meja : <b>${table}</b>\n`;
            barReceipt += `[L]ID   : ${orderId}\n`;
            barReceipt += `[L]Jam  : ${currentTimeStr} WITA\n`;
            barReceipt += `[C]--------------------------------\n`;
            barItems.forEach(item => {
                barReceipt += `[L]<b>[ ] ${item.qty}x  ${item.name}</b>\n`;
                if(item.notes) barReceipt += `[L]   *Catatan: ${item.notes}\n`;
                barReceipt += `[L]--------------------------------\n`;
            });
            barReceipt += `\n\n\n`;

            setTimeout(() => {
                sendIntentToRawBT(barReceipt, printerBarProfile);
            }, delayMultiplier * 1200);
        }
    }
}
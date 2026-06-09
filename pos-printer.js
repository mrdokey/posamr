/**
 * MODUL PRINTER: ENGINE RAWBT & TEMPLATE STRUK PREMIUM
 * Menangani Multi-Printer Routing Tanpa Karakter China (Safe ASCII)
 * UPDATE: Split Target Support & Label Struk "ARSIP"
 */

const LINE_WIDTH = 32; // Standar lebar karakter kertas thermal 58mm

// --- HELPER 1: PERATA TENGAH (CENTER ALIGN) ---
function centerText(text) {
    if (text.length >= LINE_WIDTH) return text.substring(0, LINE_WIDTH);
    const padding = Math.floor((LINE_WIDTH - text.length) / 2);
    return " ".repeat(padding) + text;
}

// --- HELPER 2: PERATA KANAN-KIRI (LEFT-RIGHT FLUSH) ---
function formatLeftRight(leftText, rightText) {
    const spacesNeeded = LINE_WIDTH - leftText.length - rightText.length;
    if (spacesNeeded > 0) {
        return leftText + " ".repeat(spacesNeeded) + rightText;
    }
    return leftText + "\n" + " ".repeat(LINE_WIDTH - rightText.length) + rightText;
}

// --- HELPER 3: ENKODE TEKS KE BASE64 SECARA AMAN ---
function safeStringToBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}

// --- HELPER 4: KIRIM INTENT PRINTER RAWBT SPESIFIK ---
function sendIntentToRawBT(plainTextReceipt, printerProfileName) {
    const base64Data = safeStringToBase64(plainTextReceipt);
    const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.printer=${printerProfileName};end;`;
    window.location.href = intentUrl;
}

// --- ENGINE 1: DRAFT TO OPEN (KITCHEN & BAR ORDER) ---
function executeRoutingPrintDirect(bill, subtotal, discountAmount) {
    const printerKitchenProfile = configData["PRINTER_KITCHEN"] || "Kitchen";
    const printerBarProfile = configData["PRINTER_BAR"] || "Bar";
    const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // 1. KITCHEN PRINT
    const kitchenItems = bill.items.filter(item => item.route === "Kitchen");
    if (kitchenItems.length > 0) {
        let kitchenReceipt = "";
        kitchenReceipt += centerText("ORDERAN DAPUR") + "\n";
        kitchenReceipt += "=".repeat(LINE_WIDTH) + "\n";
        kitchenReceipt += `Meja : Meja ${bill.tableNo}\n`;
        kitchenReceipt += `ID   : ${bill.orderId.substring(0, 15)}\n`;
        kitchenReceipt += `Jam  : ${currentTimeStr} WITA\n`;
        kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
        
        kitchenItems.forEach(item => {
            kitchenReceipt += `${item.qty}x ${item.name}\n`;
            if(item.notes) kitchenReceipt += `  *Catatan: ${item.notes}\n`;
            kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
        });
        kitchenReceipt += "\n\n\n\n";
        
        sendIntentToRawBT(kitchenReceipt, printerKitchenProfile);
    }

    // 2. BAR PRINT (DELAYED)
    const barItems = bill.items.filter(item => item.route === "Bar");
    if (barItems.length > 0) {
        let barReceipt = "";
        barReceipt += centerText("ORDERAN MINUMAN") + "\n";
        barReceipt += "=".repeat(LINE_WIDTH) + "\n";
        barReceipt += `Meja : Meja ${bill.tableNo}\n`;
        barReceipt += `ID   : ${bill.orderId.substring(0, 15)}\n`;
        barReceipt += `Jam  : ${currentTimeStr} WITA\n`;
        barReceipt += "-".repeat(LINE_WIDTH) + "\n";
        
        barItems.forEach(item => {
            barReceipt += `${item.qty}x ${item.name}\n`;
            if(item.notes) barReceipt += `  *Catatan: ${item.notes}\n`;
            barReceipt += "-".repeat(LINE_WIDTH) + "\n";
        });
        barReceipt += "\n\n\n\n";
        
        setTimeout(() => {
            sendIntentToRawBT(barReceipt, printerBarProfile);
        }, 1200); 
    }
}

// --- ENGINE 2: CHASE OUT & INTERFACE ROUTING ---
function executeRoutingPrint(orderId, table, status, payMethod, subtotal, discountAmount, serviceCharge, tax, grandTotal, target, isReprint = false, itemsToPrint = null) {
    const printerKasirProfile = configData["PRINTER_KASIR"] || "Kasir";
    const printerKitchenProfile = configData["PRINTER_KITCHEN"] || "Kitchen";
    const printerBarProfile = configData["PRINTER_BAR"] || "Bar";
    
    const namaResto = configData["NAMA_PERUSAAN"] || "LABARAC BAR";
    const alamat = configData["ALAMAT"] || "Denpasar, Bali";
    const footerStruk = configData["FOOTER_STRUK"] || "Terima Kasih Atas Kunjungannya!";
    
    const currentDateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const items = itemsToPrint || cart; 
    let delayMultiplier = 0; 

    // 1. BILL UTAMA / STRUK LUNAS (KASIR PRINTER)
    if (target === "All" || target === "CustomerCopy" || target === "ArsipCopy" || target === "Kasir") {
        const generateInvoiceBody = (copyLabel) => {
            let body = "";
            if (isReprint) body += centerText("*** REPRINT / SALINAN ***") + "\n";
            body += centerText(namaResto) + "\n";
            body += centerText(alamat) + "\n";
            body += "=".repeat(LINE_WIDTH) + "\n";
            body += centerText(copyLabel) + "\n";
            body += "=".repeat(LINE_WIDTH) + "\n";
            body += `ID   : ${orderId.substring(0, 18)}\n`;
            body += `Meja : Meja ${table}\n`;
            body += `Kasir: ${cashierInfo.name}\n`;
            body += `Waktu: ${currentDateStr}  ${currentTimeStr}\n`;
            body += "-".repeat(LINE_WIDTH) + "\n";
            
            items.forEach(item => {
                body += `${item.name}\n`;
                const qtyPrice = `  ${item.qty}x ${item.price.toLocaleString('id-ID')}`;
                const totalHarga = item.subtotal.toLocaleString('id-ID');
                body += formatLeftRight(qtyPrice, totalHarga) + "\n";
                if(item.notes) body += `  *${item.notes}\n`;
            });
            
            body += "-".repeat(LINE_WIDTH) + "\n";
            body += formatLeftRight("Subtotal", subtotal.toLocaleString('id-ID')) + "\n";
            if(discountAmount > 0) {
                body += formatLeftRight("Total Diskon", `-${discountAmount.toLocaleString('id-ID')}`) + "\n";
            }
            if(serviceCharge > 0) {
                body += formatLeftRight("Service Charge", serviceCharge.toLocaleString('id-ID')) + "\n";
            }
            if(tax > 0) {
                body += formatLeftRight("Pajak PB1", tax.toLocaleString('id-ID')) + "\n";
            }
            body += "-".repeat(LINE_WIDTH) + "\n";
            body += formatLeftRight("GRAND TOTAL", grandTotal.toLocaleString('id-ID')) + "\n";
            
            if (status === "Paid") {
                const tunai = window.lastCashReceived || grandTotal;
                const kembalian = window.lastCashChange || 0;
                body += formatLeftRight(`Bayar (${payMethod})`, tunai.toLocaleString('id-ID')) + "\n";
                body += formatLeftRight("Kembalian", kembalian.toLocaleString('id-ID')) + "\n";
                body += "=".repeat(LINE_WIDTH) + "\n";
                body += centerText("STATUS : LUNAS") + "\n";
                body += centerText(footerStruk) + "\n";
            } else {
                body += "=".repeat(LINE_WIDTH) + "\n";
                body += centerText("STATUS : TAGIHAN SEMENTARA") + "\n";
                body += centerText("Harap lakukan pembayaran di kasir") + "\n";
            }
            body += "\n\n\n\n";
            return body;
        };

        let cashierReceipt = "";
        if (target === "CustomerCopy") {
            cashierReceipt += generateInvoiceBody("STRUK PELANGGAN");
        } else if (target === "ArsipCopy") {
            cashierReceipt += generateInvoiceBody("ARSIP"); // FIX: Mengubah ARSIP TOKO menjadi ARSIP
        } else if (target === "Kasir") {
            cashierReceipt += generateInvoiceBody(status === "Paid" ? "STRUK PELANGGAN" : "BILL TAGIHAN MEJA");
        } else {
            if (status === "Paid") {
                cashierReceipt += generateInvoiceBody("STRUK PELANGGAN");
                cashierReceipt += "- ".repeat(LINE_WIDTH/2) + "\n\n";
                cashierReceipt += generateInvoiceBody("ARSIP"); // FIX: Mengubah ARSIP TOKO menjadi ARSIP
            } else {
                cashierReceipt += generateInvoiceBody("BILL TAGIHAN MEJA");
            }
        }

        sendIntentToRawBT(cashierReceipt, printerKasirProfile);
        delayMultiplier++;
    }

    // 2. KITCHEN ORDER (DAPUR)
    if (target === "All" || target === "Kitchen") {
        const kitchenItems = items.filter(item => item.route === "Kitchen");
        if (kitchenItems.length > 0) {
            let kitchenReceipt = "";
            if (isReprint) kitchenReceipt += centerText("*** REPRINT / SALINAN ***") + "\n";
            kitchenReceipt += centerText("ORDERAN DAPUR") + "\n";
            kitchenReceipt += "=".repeat(LINE_WIDTH) + "\n";
            kitchenReceipt += `Meja : Meja ${table}\n`;
            kitchenReceipt += `ID   : ${orderId.substring(0, 15)}\n`;
            kitchenReceipt += `Jam  : ${currentTimeStr} WITA\n`;
            kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
            
            kitchenItems.forEach(item => {
                kitchenReceipt += `${item.qty}x ${item.name}\n`;
                if(item.notes) kitchenReceipt += `  *Catatan: ${item.notes}\n`;
                kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
            });
            kitchenReceipt += "\n\n\n\n";

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
            if (isReprint) barReceipt += centerText("*** REPRINT / SALINAN ***") + "\n";
            barReceipt += centerText("ORDERAN MINUMAN") + "\n";
            barReceipt += "=".repeat(LINE_WIDTH) + "\n";
            barReceipt += `Meja : Meja ${table}\n`;
            barReceipt += `ID   : ${orderId.substring(0, 15)}\n`;
            barReceipt += `Jam  : ${currentTimeStr} WITA\n`;
            barReceipt += "-".repeat(LINE_WIDTH) + "\n";
            
            barItems.forEach(item => {
                barReceipt += `${item.qty}x ${item.name}\n`;
                if(item.notes) barReceipt += `  *Catatan: ${item.notes}\n`;
                barReceipt += "-".repeat(LINE_WIDTH) + "\n";
            });
            barReceipt += "\n\n\n\n";

            setTimeout(() => {
                sendIntentToRawBT(barReceipt, printerBarProfile);
            }, delayMultiplier * 1200);
        }
    }
}
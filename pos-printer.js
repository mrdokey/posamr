/**
 * MODUL PRINTER: ENGINE QUICK PRINTER (DIEGOVELOPER SDK) & TEMPLATE STRUK PREMIUM
 * Menangani Multi-Printer Routing Tanpa Karakter China (Safe ASCII)
 * UPDATE: Integrasi Skema SDK pe.diegoveloper.printing & Multi-Branch Area
 */

let LINE_WIDTH = 32; // Default fallback ke kertas 58mm

// --- HELPER: SETEL LEBAR KERTAS DINAMIS DARI DATABASE CONFIG SPREADSHEET ---
function updateLineWidth() {
    const lebar = configData["LEBAR_KERTAS_PRINTER"] ? configData["LEBAR_KERTAS_PRINTER"].toString().trim() : "58";
    if (lebar === "80") {
        LINE_WIDTH = 48; // Standar jumlah karakter rata kanan-kiri untuk kertas 80mm (Font A)
    } else {
        LINE_WIDTH = 32; // Standar jumlah karakter rata kanan-kiri untuk kertas 58mm (Font A)
    }
}

// --- HELPER 1: PERATA TENGAH (CENTER ALIGN) ---
function centerText(text) {
    updateLineWidth();
    if (text.length >= LINE_WIDTH) return text.substring(0, LINE_WIDTH);
    const padding = Math.floor((LINE_WIDTH - text.length) / 2);
    return " ".repeat(padding) + text;
}

// --- HELPER 2: PERATA KANAN-KIRI (LEFT-RIGHT FLUSH) ---
function formatLeftRight(leftText, rightText) {
    updateLineWidth();
    const spacesNeeded = LINE_WIDTH - leftText.length - rightText.length;
    if (spacesNeeded > 0) {
        return leftText + " ".repeat(spacesNeeded) + rightText;
    }
    return leftText + "\n" + " ".repeat(LINE_WIDTH - rightText.length) + rightText;
}

// --- HELPER 3: ENKODE TEKS KE BASE64 SECARA AMAN (Dipertahankan sebagai cadangan) ---
function safeStringToBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}

// --- HELPER 4: KIRIM INTENT SPESIFIK KE DIEGOVELOPER QUICK PRINTER ---
function sendIntentToQuickPrinter(plainTextReceipt, printerProfileName) {
    // 1. URL Encode teks struk agar aman dikirim lewat Intent URI (Tanpa perlu Base64!)
    const safeText = encodeURIComponent(plainTextReceipt);
    
    // 2. Gunakan struktur Intent Resmi sesuai dokumentasi SDK Quick Printer (diegoveloper)
    // - Action: pe.diegoveloper.printing
    // - Package: pe.diegoveloper.printing
    // - Type: text/plain
    // - Extra: S.android.intent.extra.TEXT (Menampung teks struk)
    // - Extra: S.printer_name (Rute nama printer tujuan)
    const intentUrl = `intent:#Intent;action=pe.diegoveloper.printing;type=text/plain;S.android.intent.extra.TEXT=${safeText};S.printer_name=${printerProfileName};package=pe.diegoveloper.printing;end;`;
    
    window.location.href = intentUrl;
}

// --- ENGINE 1: DRAFT TO OPEN (KITCHEN & BAR ORDER) ---
function executeRoutingPrintDirect(bill, subtotal, discountAmount) {
    updateLineWidth(); // Pemicu lebar kertas
    
    const printerKitchenProfile = configData["PRINTER_KITCHEN"] || "Kitchen";
    const printerBarProfile = configData["PRINTER_BAR"] || "Bar";
    const currentTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // 1. KITCHEN PRINT
    const kitchenItems = bill.items.filter(item => item.route === "Kitchen");
    if (kitchenItems.length > 0) {
        let kitchenReceipt = "";
        kitchenReceipt += centerText("ORDERAN DAPUR") + "\n";
        kitchenReceipt += "=".repeat(LINE_WIDTH) + "\n";
        kitchenReceipt += `Meja : Meja ${bill.tableNo}\n`;
        kitchenReceipt += `ID   : ${bill.orderId.substring(0, 15)}\n`;
        kitchenReceipt += `Jam  : ${currentTimeStr}\n`;
        kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
        
        kitchenItems.forEach(item => {
            kitchenReceipt += `${item.qty}x ${item.name}\n`;
            if(item.notes) kitchenReceipt += `  *Catatan: ${item.notes}\n`;
            kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
        });
        kitchenReceipt += "\n\n\n\n";
        
        sendIntentToQuickPrinter(kitchenReceipt, printerKitchenProfile);
    }

    // 2. BAR PRINT (DELAYED)
    const barItems = bill.items.filter(item => item.route === "Bar");
    if (barItems.length > 0) {
        let barReceipt = "";
        barReceipt += centerText("ORDERAN MINUMAN") + "\n";
        barReceipt += "=".repeat(LINE_WIDTH) + "\n";
        barReceipt += `Meja : Meja ${bill.tableNo}\n`;
        barReceipt += `ID   : ${bill.orderId.substring(0, 15)}\n`;
        barReceipt += `Jam  : ${currentTimeStr}\n`;
        barReceipt += "-".repeat(LINE_WIDTH) + "\n";
        
        barItems.forEach(item => {
            barReceipt += `${item.qty}x ${item.name}\n`;
            if(item.notes) barReceipt += `  *Catatan: ${item.notes}\n`;
            barReceipt += "-".repeat(LINE_WIDTH) + "\n";
        });
        barReceipt += "\n\n\n\n";
        
        setTimeout(() => {
            sendIntentToQuickPrinter(barReceipt, printerBarProfile);
        }, 1200); 
    }
}

// --- ENGINE 2: CHASE OUT & INTERFACE ROUTING ---
function executeRoutingPrint(orderId, table, status, payMethod, subtotal, discountAmount, serviceCharge, tax, grandTotal, target, isReprint = false, itemsToPrint = null) {
    updateLineWidth(); // Pemicu lebar kertas
    
    const printerKasirProfile = configData["PRINTER_KASIR"] || "Kasir";
    const printerKitchenProfile = configData["PRINTER_KITCHEN"] || "Kitchen";
    const printerBarProfile = configData["PRINTER_BAR"] || "Bar";
    
    const namaResto = configData["NAMA_PERUSAAN"] || "THE ARIA";
    const alamat = configData["ALAMAT"] || "Jl. Pantai Berawa No. 99, Canggu";
    const footerStruk = configData["FOOTER_STRUK"] || "Terima Kasih Atas Kunjungannya!";
    
    const currentDateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: '2-digit' });
    const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

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
            body += formatLeftRight("POS: Cashier", `Cashier: ${cashierInfo.name}`) + "\n";
            body += "-".repeat(LINE_WIDTH) + "\n";
            body += centerText(copyLabel) + "\n";
            body += "=".repeat(LINE_WIDTH) + "\n";
            
            body += formatLeftRight(`ID: ${orderId.substring(0, 11)}...`, `TBL  ${table.toUpperCase()}`) + "\n";
            body += formatLeftRight(`${currentDateStr}`, currentTimeStr) + "\n";
            body += "=".repeat(LINE_WIDTH) + "\n";
            
            items.forEach(item => {
                const itemLeft = `${item.qty} ${item.name.toUpperCase()}`;
                const itemRight = item.subtotal.toLocaleString('id-ID');
                body += formatLeftRight(itemLeft, itemRight) + "\n";
                if(item.notes) body += `  *Note: ${item.notes}\n`;
            });
            
            body += "-".repeat(LINE_WIDTH) + "\n";
            
            const totalItemsCount = items.length;
            const totalQtyCount = items.reduce((sum, item) => sum + item.qty, 0);
            body += formatLeftRight(`Total Item : ${totalItemsCount}`, `Total Qty : ${totalQtyCount}`) + "\n";
            
            body += "-".repeat(LINE_WIDTH) + "\n";
            body += formatLeftRight("Subtotal", subtotal.toLocaleString('id-ID')) + "\n";
            if(discountAmount > 0) {
                body += formatLeftRight("DISCOUNT", `-${discountAmount.toLocaleString('id-ID')}`) + "\n";
            }
            if(serviceCharge > 0) {
                body += formatLeftRight("SERVICE CHARGE", serviceCharge.toLocaleString('id-ID')) + "\n";
            }
            if(tax > 0) {
                body += formatLeftRight("TAX", tax.toLocaleString('id-ID')) + "\n";
            }
            
            const rounding = window.lastRoundingAdjustment || 0;
            if (rounding !== 0) {
                body += formatLeftRight("PEMBULATAN", (rounding > 0 ? "+" : "") + rounding.toLocaleString('id-ID')) + "\n";
            }

            body += "-".repeat(LINE_WIDTH) + "\n";
            body += formatLeftRight("Total", grandTotal.toLocaleString('id-ID')) + "\n";
            
            if (status === "Paid") {
                if (payMethod.startsWith("Mixed")) {
                    body += formatLeftRight("CASH", window.lastCashReceived.toLocaleString('id-ID')) + "\n";
                    body += formatLeftRight(window.lastNonCashMethod.toUpperCase(), window.lastNonCashReceived.toLocaleString('id-ID')) + "\n";
                } else {
                    const tunai = window.lastCashReceived || grandTotal;
                    body += formatLeftRight(payMethod.toUpperCase(), tunai.toLocaleString('id-ID')) + "\n";
                }
                const kembalian = window.lastCashChange || 0;
                body += formatLeftRight("CHANGE", kembalian.toLocaleString('id-ID')) + "\n";
                body += "=".repeat(LINE_WIDTH) + "\n";
                body += centerText("STATUS : LUNAS") + "\n";
            } else if (status === "Debt") {
                body += "=".repeat(LINE_WIDTH) + "\n";
                body += centerText("STATUS : CITY LEDGER (DEBT)") + "\n";
                body += centerText("Nota gantung piutang Owner") + "\n";
            } else {
                body += "=".repeat(LINE_WIDTH) + "\n";
                body += centerText("STATUS : TAGIHAN SEMENTARA") + "\n";
            }
            body += "=".repeat(LINE_WIDTH) + "\n";
            
            body += centerText(`Closed ${currentDateStr} ${currentTimeStr}`) + "\n";
            body += "-".repeat(LINE_WIDTH) + "\n";
            body += centerText(footerStruk) + "\n";
            body += "\n\n\n\n";
            return body;
        };

        let cashierReceipt = "";
        if (target === "CustomerCopy") {
            cashierReceipt += generateInvoiceBody("STRUK PELANGGAN");
        } else if (target === "ArsipCopy") {
            cashierReceipt += generateInvoiceBody("ARSIP");
        } else if (target === "Kasir") {
            cashierReceipt += generateInvoiceBody(status === "Paid" ? "STRUK PELANGGAN" : "BILL TAGIHAN MEJA");
        } else {
            if (status === "Paid" || status === "Debt") {
                cashierReceipt += generateInvoiceBody(status === "Debt" ? "CITY LEDGER" : "STRUK PELANGGAN");
                cashierReceipt += "- ".repeat(LINE_WIDTH/2) + "\n\n";
                cashierReceipt += generateInvoiceBody("ARSIP");
            } else {
                cashierReceipt += generateInvoiceBody("BILL TAGIHAN MEJA");
            }
        }

        sendIntentToQuickPrinter(cashierReceipt, printerKasirProfile);
        delayMultiplier++;
    }

    // 2. KITCHEN ORDER
    if (target === "All" || target === "Kitchen") {
        const kitchenItems = items.filter(item => item.route === "Kitchen");
        if (kitchenItems.length > 0) {
            let kitchenReceipt = "";
            if (isReprint) kitchenReceipt += centerText("*** REPRINT / SALINAN ***") + "\n";
            kitchenReceipt += centerText("ORDERAN DAPUR") + "\n";
            kitchenReceipt += "═".repeat(LINE_WIDTH) + "\n";
            kitchenReceipt += `Meja : Meja ${table}\n`;
            kitchenReceipt += `ID   : ${orderId.substring(0, 15)}\n`;
            kitchenReceipt += `Jam  : ${currentTimeStr}\n`;
            kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
            
            kitchenItems.forEach(item => {
                kitchenReceipt += `${item.qty}x ${item.name}\n`;
                if(item.notes) kitchenReceipt += `  *Catatan: ${item.notes}\n`;
                kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
            });
            kitchenReceipt += "\n\n\n\n";

            setTimeout(() => {
                sendIntentToQuickPrinter(kitchenReceipt, printerKitchenProfile);
            }, delayMultiplier * 1200);
            delayMultiplier++;
        }
    }

    // 3. BAR ORDER
    if (target === "All" || target === "Bar") {
        const barItems = items.filter(item => item.route === "Bar");
        if (barItems.length > 0) {
            let barReceipt = "";
            if (isReprint) barReceipt += centerText("*** REPRINT / SALINAN ***") + "\n";
            barReceipt += centerText("ORDERAN MINUMAN") + "\n";
            barReceipt += "═".repeat(LINE_WIDTH) + "\n";
            barReceipt += `Meja : Meja ${table}\n`;
            barReceipt += `ID   : ${orderId.substring(0, 15)}\n`;
            barReceipt += `Jam  : ${currentTimeStr}\n`;
            barReceipt += "-".repeat(LINE_WIDTH) + "\n";
            
            barItems.forEach(item => {
                barReceipt += `${item.qty}x ${item.name}\n`;
                if(item.notes) barReceipt += `  *Catatan: ${item.notes}\n`;
                barReceipt += "-".repeat(LINE_WIDTH) + "\n";
            });
            barReceipt += "\n\n\n\n";

            setTimeout(() => {
                sendIntentToQuickPrinter(barReceipt, printerBarProfile);
            }, delayMultiplier * 1200);
        }
    }
}
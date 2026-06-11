/**
 * MODUL PRINTER: ENGINE RAWBT & TEMPLATE STRUK PREMIUM
 * UPDATE: Cetak Data Pembayaran Gabungan, Pembulatan, & Struk Piutang "Debt"
 */

const LINE_WIDTH = 32; // Standar lebar karakter kertas thermal 58mm

function centerText(text) {
    if (text.length >= LINE_WIDTH) return text.substring(0, LINE_WIDTH);
    const padding = Math.floor((LINE_WIDTH - text.length) / 2);
    return " ".repeat(padding) + text;
}

function formatLeftRight(leftText, rightText) {
    const spacesNeeded = LINE_WIDTH - leftText.length - rightText.length;
    if (spacesNeeded > 0) {
        return leftText + " ".repeat(spacesNeeded) + rightText;
    }
    return leftText + "\n" + " ".repeat(LINE_WIDTH - rightText.length) + rightText;
}

function safeStringToBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}

function sendIntentToRawBT(plainTextReceipt, printerProfileName) {
    const base64Data = safeStringToBase64(plainTextReceipt);
    const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.printer=${printerProfileName};end;`;
    window.location.href = intentUrl;
}

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

    // 2. BAR PRINT
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
            
            // CETAK INFO PEMBULATAN KASIR (Jika ada penyesuaian nominal pembulatan)
            const rounding = window.lastRoundingAdjustment || 0;
            if (rounding !== 0) {
                body += formatLeftRight("Pembulatan", (rounding > 0 ? "+" : "") + rounding.toLocaleString('id-ID')) + "\n";
            }

            body += "-".repeat(LINE_WIDTH) + "\n";
            body += formatLeftRight("GRAND TOTAL", grandTotal.toLocaleString('id-ID')) + "\n";
            
            if (status === "Paid") {
                // DETEKSI & CETAK INFO PEMBAYARAN GABUNGAN (MIXED PAYMENTS)
                if (payMethod.startsWith("Mixed")) {
                    body += formatLeftRight("Bayar (Cash)", window.lastCashReceived.toLocaleString('id-ID')) + "\n";
                    body += formatLeftRight(`Bayar (${window.lastNonCashMethod})`, window.lastNonCashReceived.toLocaleString('id-ID')) + "\n";
                } else {
                    const tunai = window.lastCashReceived || grandTotal;
                    body += formatLeftRight(`Bayar (${payMethod})`, tunai.toLocaleString('id-ID')) + "\n";
                }
                const kembalian = window.lastCashChange || 0;
                body += formatLeftRight("Kembalian", kembalian.toLocaleString('id-ID')) + "\n";
                body += "=".repeat(LINE_WIDTH) + "\n";
                body += centerText("STATUS : LUNAS") + "\n";
                body += centerText(footerStruk) + "\n";
            } else if (status === "Debt") {
                body += "=".repeat(LINE_WIDTH) + "\n";
                body += centerText("STATUS : CITY LEDGER (DEBT)") + "\n";
                body += centerText("Nota gantung piutang Owner") + "\n";
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

        sendIntentToRawBT(cashierReceipt, printerKasirProfile);
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
/**
 * MODUL PRINTER: ENGINE RAWBT WEB INTENT & TEMPLATE STRUK PREMIUM (THE ARIA)
 * Menangani Multi-Printer Routing Tanpa Karakter China (Safe ASCII)
 * UPDATE: Perbaikan Scope Variable "lang" untuk Deteksi Bahasa Struk Dinamis
 */

let LINE_WIDTH = 32; // Default fallback ke kertas 58mm

// --- HELPER: SETEL LEBAR KERTAS DINAMIS DARI DATABASE CONFIG SPREADSHEET ---
function updateLineWidth() {
    const lebar = configData["LEBAR_KERTAS_PRINTER"] ? configData["LEBAR_KERTAS_PRINTER"].toString().trim() : "58";
    if (lebar === "80") {
        LINE_WIDTH = 48; // Standar jumlah karakter rata kanan-kiri untuk kertas 80mm
    } else {
        LINE_WIDTH = 32; // Standar jumlah karakter rata kanan-kiri untuk kertas 58mm
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

// --- HELPER 3: ENKODE TEKS KE BASE64 SECARA AMAN ---
function safeStringToBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}

// --- HELPER 4: KIRIM VIA SKEMA KUSTOM RAWBT (ANTI BLOKIR CHROME & ANTI PLAYSTORE) ---
function sendIntentToQuickPrinter(plainTextReceipt, printerProfileName) {
    try {
        const base64Data = safeStringToBase64(plainTextReceipt);
        
        // Menggunakan Protokol Kustom Resmi RawBT "rawbt:base64," (tanpa double slash //)
        const intentUrl = `rawbt:base64,${base64Data}`;
        
        window.location.href = intentUrl;
    } catch (error) {
        console.error("Gagal memproses ke RawBT:", error);
        alert("Gagal mengirim data ke printer.");
    }
}

// --- HELPER 5: KAMUS PENERJEMAH STRUK DINAMIS ---
function getTranslationDictionary() {
    const lang = configData["BAHASA_STRUK"] ? configData["BAHASA_STRUK"].toString().toUpperCase().trim() : "ID";
    
    return {
        kitchen: lang === "EN" ? "KITCHEN ORDER" : "ORDERAN DAPUR",
        bar: lang === "EN" ? "BAR ORDER" : "ORDERAN MINUMAN",
        table: lang === "EN" ? "Table" : "Meja",
        time: lang === "EN" ? "Time" : "Jam",
        cashier: lang === "EN" ? "Cashier" : "Kasir",
        items: lang === "EN" ? "Total Items" : "Total Item",
        qty: lang === "EN" ? "Total Qty" : "Total Qty",
        subtotal: lang === "EN" ? "Subtotal" : "Subtotal",
        discount: lang === "EN" ? "DISCOUNT" : "DISKON",
        rounding: lang === "EN" ? "ROUNDING" : "PEMBULATAN",
        change: lang === "EN" ? "CHANGE" : "KEMBALIAN",
        paidStatus: lang === "EN" ? "STATUS : PAID" : "STATUS : LUNAS",
        unpaidStatus: lang === "EN" ? "STATUS : BILL" : "STATUS : TAGIHAN SEMENTARA",
        reprint: lang === "EN" ? "*** REPRINT / COPY ***" : "*** REPRINT / SALINAN ***",
        debtStatus: lang === "EN" ? "STATUS : CITY LEDGER (DEBT)" : "STATUS : CITY LEDGER (DEBT)"
    };
}

// --- ENGINE 1: DRAFT TO OPEN (KITCHEN & BAR ORDER) ---
function executeRoutingPrintDirect(bill, subtotal, discountAmount) {
    try {
        updateLineWidth(); 
        
        const printerKitchenProfile = configData["PRINTER_KITCHEN"] || "Kitchen";
        const printerBarProfile = configData["PRINTER_BAR"] || "Bar";
        const currentTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        
        // Ambil Kamus Bahasa Aktif
        const t = getTranslationDictionary();

        // 1. KITCHEN PRINT
        const kitchenItems = bill.items.filter(item => item.route === "Kitchen");
        let kitchenPrinted = false;

        if (kitchenItems.length > 0) {
            let kitchenReceipt = "";
            kitchenReceipt += centerText(t.kitchen) + "\n";
            kitchenReceipt += "=".repeat(LINE_WIDTH) + "\n";
            kitchenReceipt += `${t.table} : ${bill.tableNo}\n`;
            kitchenReceipt += `ID   : ${bill.orderId.substring(0, 15)}\n`;
            kitchenReceipt += `${t.time} : ${currentTimeStr}\n`;
            kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
            
            kitchenItems.forEach(item => {
                kitchenReceipt += `${item.qty}x ${item.name}\n`;
                if(item.notes) kitchenReceipt += `  *Catatan: ${item.notes}\n`;
                kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
            });
            kitchenReceipt += "\n\n\n\n";
            
            sendIntentToQuickPrinter(kitchenReceipt, printerKitchenProfile);
            kitchenPrinted = true;
        }

        // 2. BAR PRINT (DELAYED DENGAN INTERAKSI KASIR)
        const barItems = bill.items.filter(item => item.route === "Bar");
        if (barItems.length > 0) {
            let barReceipt = "";
            barReceipt += centerText(t.bar) + "\n";
            barReceipt += "=".repeat(LINE_WIDTH) + "\n";
            barReceipt += `${t.table} : ${bill.tableNo}\n`;
            barReceipt += `ID   : ${bill.orderId.substring(0, 15)}\n`;
            barReceipt += `${t.time} : ${currentTimeStr}\n`;
            barReceipt += "-".repeat(LINE_WIDTH) + "\n";
            
            barItems.forEach(item => {
                barReceipt += `${item.qty}x ${item.name}\n`;
                if(item.notes) barReceipt += `  *Catatan: ${item.notes}\n`;
                barReceipt += "-".repeat(LINE_WIDTH) + "\n";
            });
            barReceipt += "\n\n\n\n";
            
            // Jika dapur juga dicetak, berikan dialog konfirmasi agar tidak diblokir Chrome
            if (kitchenPrinted) {
                setTimeout(() => {
                    if (confirm(`Cetak ${t.bar}?`)) {
                        sendIntentToQuickPrinter(barReceipt, printerBarProfile);
                    }
                }, 1000);
            } else {
                sendIntentToQuickPrinter(barReceipt, printerBarProfile);
            }
        }
    } catch (err) {
        alert("CRASH DI ENGINE DIRECT:\n\n" + err.message + "\n\nStack:\n" + err.stack);
    }
}

// --- ENGINE 2: CHASE OUT & INTERFACE ROUTING (Paid, Open, & Reprint) ---
function executeRoutingPrint(orderId, table, status, payMethod, subtotal, discountAmount, serviceCharge, tax, grandTotal, target, isReprint = false, itemsToPrint = null) {
    try {
        updateLineWidth(); 
        
        const printerKasirProfile = configData["PRINTER_KASIR"] || "Kasir";
        const printerKitchenProfile = configData["PRINTER_KITCHEN"] || "Kitchen";
        const printerBarProfile = configData["PRINTER_BAR"] || "Bar";
        
        const namaResto = configData["NAMA_PERUSAHAAN"] || "THE ARIA";
        const alamat = configData["ALAMAT"] || "Jl. Pantai Berawa No. 99, Canggu";
        const footerStruk = configData["FOOTER_STRUK"] || "Terima Kasih Atas Kunjungannya!";
        
        const currentDateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: '2-digit' });
        const currentTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

        const items = itemsToPrint || cart; 
        let cashierPrinted = false;
        
        // Ambil Kamus Bahasa Aktif & Variabel Penunjuk Bahasa Struk
        const t = getTranslationDictionary();
        const lang = configData["BAHASA_STRUK"] ? configData["BAHASA_STRUK"].toString().toUpperCase().trim() : "ID";

        // 1. BILL UTAMA / STRUK LUNAS (KASIR PRINTER)
        if (target === "All" || target === "CustomerCopy" || target === "ArsipCopy" || target === "Kasir" || target === "Cashier") {
            const generateInvoiceBody = (copyLabel) => {
                let body = "";
                if (isReprint) body += centerText(t.reprint) + "\n";
                body += centerText(namaResto) + "\n";
                body += centerText(alamat) + "\n";
                body += "=".repeat(LINE_WIDTH) + "\n";
                body += formatLeftRight(`POS: ${t.cashier}`, `${t.cashier}: ${cashierInfo.name}`) + "\n";
                body += "-".repeat(LINE_WIDTH) + "\n";
                body += centerText(copyLabel) + "\n";
                body += "=".repeat(LINE_WIDTH) + "\n";
                
                body += formatLeftRight(`ID: ${orderId.substring(0, 11)}...`, `${t.table.toUpperCase()}  ${table.toUpperCase()}`) + "\n";
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
                body += formatLeftRight(`${t.items} : ${totalItemsCount}`, `${t.qty} : ${totalQtyCount}`) + "\n";
                
                body += "-".repeat(LINE_WIDTH) + "\n";
                body += formatLeftRight(t.subtotal, subtotal.toLocaleString('id-ID')) + "\n";
                if(discountAmount > 0) {
                    body += formatLeftRight(t.discount, `-${discountAmount.toLocaleString('id-ID')}`) + "\n";
                }
                if(serviceCharge > 0) {
                    body += formatLeftRight("SERVICE CHARGE", serviceCharge.toLocaleString('id-ID')) + "\n";
                }
                if(tax > 0) {
                    body += formatLeftRight("TAX", tax.toLocaleString('id-ID')) + "\n";
                }
                
                const rounding = window.lastRoundingAdjustment || 0;
                if (rounding !== 0) {
                    body += formatLeftRight(t.rounding, (rounding > 0 ? "+" : "") + rounding.toLocaleString('id-ID')) + "\n";
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
                    body += formatLeftRight(t.change, kembalian.toLocaleString('id-ID')) + "\n";
                    body += "=".repeat(LINE_WIDTH) + "\n";
                    body += centerText(t.paidStatus) + "\n";
                } else if (status === "Debt") {
                    body += "=".repeat(LINE_WIDTH) + "\n";
                    body += centerText(t.debtStatus) + "\n";
                    body += centerText("Nota gantung piutang Owner") + "\n";
                } else {
                    body += "=".repeat(LINE_WIDTH) + "\n";
                    body += centerText(t.unpaidStatus) + "\n";
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
                cashierReceipt += generateInvoiceBody(lang === "EN" ? "CUSTOMER RECEIPT" : "STRUK PELANGGAN");
            } else if (target === "ArsipCopy") {
                cashierReceipt += generateInvoiceBody(lang === "EN" ? "ARCHIVE COPY" : "ARSIP");
            } else if (target === "Kasir") {
                cashierReceipt += generateInvoiceBody(status === "Paid" ? (lang === "EN" ? "CUSTOMER RECEIPT" : "STRUK PELANGGAN") : (lang === "EN" ? "UNPAID BILL" : "BILL TAGIHAN MEJA"));
            } else {
                if (status === "Paid" || status === "Debt") {
                    cashierReceipt += generateInvoiceBody(status === "Debt" ? "CITY LEDGER" : (lang === "EN" ? "CUSTOMER RECEIPT" : "STRUK PELANGGAN"));
                    cashierReceipt += "- ".repeat(LINE_WIDTH/2) + "\n\n";
                    cashierReceipt += generateInvoiceBody(lang === "EN" ? "ARCHIVE COPY" : "ARSIP");
                } else {
                    cashierReceipt += generateInvoiceBody(lang === "EN" ? "UNPAID BILL" : "BILL TAGIHAN MEJA");
                }
            }

            sendIntentToQuickPrinter(cashierReceipt, printerKasirProfile);
            cashierPrinted = true;
        }

        // 2. KITCHEN ORDER (DENGAN JEJALAN KONFIRMASI)
        let kitchenPrinted = false;
        if (target === "All" || target === "Kitchen") {
            const kitchenItems = items.filter(item => item.route === "Kitchen");
            if (kitchenItems.length > 0) {
                let kitchenReceipt = "";
                if (isReprint) kitchenReceipt += centerText(t.reprint) + "\n";
                kitchenReceipt += centerText(t.kitchen) + "\n";
                kitchenReceipt += "=".repeat(LINE_WIDTH) + "\n";
                kitchenReceipt += `${t.table} : ${table}\n`;
                kitchenReceipt += `ID   : ${orderId.substring(0, 15)}\n`;
                kitchenReceipt += `${t.time} : ${currentTimeStr}\n`;
                kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
                
                kitchenItems.forEach(item => {
                    kitchenReceipt += `${item.qty}x ${item.name}\n`;
                    if(item.notes) kitchenReceipt += `  *Catatan: ${item.notes}\n`;
                    kitchenReceipt += "-".repeat(LINE_WIDTH) + "\n";
                });
                kitchenReceipt += "\n\n\n\n";

                // Jika sebelumnya cetak kasir sudah dipicu, berikan popup konfirmasi
                if (cashierPrinted) {
                    setTimeout(() => {
                        if (confirm(`Kirim orderan ke ${t.kitchen}?`)) {
                            sendIntentToQuickPrinter(kitchenReceipt, printerKitchenProfile);
                        }
                    }, 1000);
                } else {
                    sendIntentToQuickPrinter(kitchenReceipt, printerKitchenProfile);
                }
                kitchenPrinted = true;
            }
        }

        // 3. BAR ORDER (DENGAN JEJARAN DELAY PROSES & KONFIRMASI)
        if (target === "All" || target === "Bar") {
            const barItems = items.filter(item => item.route === "Bar");
            if (barItems.length > 0) {
                let barReceipt = "";
                if (isReprint) barReceipt += centerText(t.reprint) + "\n";
                barReceipt += centerText(t.bar) + "\n";
                barReceipt += "=".repeat(LINE_WIDTH) + "\n";
                barReceipt += `${t.table} : ${table}\n`;
                barReceipt += `ID   : ${orderId.substring(0, 15)}\n`;
                barReceipt += `${t.time} : ${currentTimeStr}\n`;
                barReceipt += "-".repeat(LINE_WIDTH) + "\n";
                
                barItems.forEach(item => {
                    barReceipt += `${item.qty}x ${item.name}\n`;
                    if(item.notes) barReceipt += `  *Catatan: ${item.notes}\n`;
                    barReceipt += "-".repeat(LINE_WIDTH) + "\n";
                });
                barReceipt += "\n\n\n\n";

                // Menggunakan sistem konfirmasi jika kasir atau dapur sebelumnya sudah dicetak
                if (cashierPrinted || kitchenPrinted) {
                    setTimeout(() => {
                        if (confirm(`Cetak ${t.bar}?`)) {
                            sendIntentToQuickPrinter(barReceipt, printerBarProfile);
                        }
                    }, 2000);
                } else {
                    sendIntentToQuickPrinter(barReceipt, printerBarProfile);
                }
            }
        }
    } catch (err) {
        alert("CRASH DI ENGINE REPRINT/PAYMENT:\n\n" + err.message + "\n\nStack:\n" + err.stack);
    }
}
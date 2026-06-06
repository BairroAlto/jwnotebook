import { BookState } from './book-state.js';
import { getVisibleBookBoxes } from './book-renderer.js';
import { textoDaNota } from './book-utils.js';

export async function baixarPdfNota() {
    try {
        await carregarJsPdf();
    } catch (_) {
        window.print();
        return;
    }
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) {
        window.print();
        return;
    }
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const title = BookState.dadosNota?.nome || "Nota";
    const texto = textoDaNota(BookState.dadosNota, getVisibleBookBoxes());
    const margin = 42;
    let y = 52;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, margin, y);
    y += 28;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(texto, 510);
    lines.forEach(line => {
        if (y > 780) {
            doc.addPage();
            y = 48;
        }
        doc.text(line, margin, y);
        y += 15;
    });
    doc.save(`${sanitize(title)}.pdf`);
}

function carregarJsPdf() {
    if (window.jspdf?.jsPDF) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function sanitize(value) {
    return String(value || "nota").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
}

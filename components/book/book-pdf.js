import { BookState } from './book-state.js';

export async function baixarPdfNota() {
    const printWindow = window.open('', '_blank', 'width=1100,height=860');
    if (!printWindow) {
        window.print();
        return;
    }

    const title = BookState.dadosNota?.nome || 'Nota';
    const container = document.getElementById('book-container');
    const bodyClasses = Array.from(document.body.classList).join(' ');
    const baseHref = window.location.href;
    const html = `
        <!DOCTYPE html>
        <html lang="pt">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${escapeHtml(title)}</title>
            <base href="${escapeHtml(baseHref)}">
            <link rel="stylesheet" href="styles/global.css">
            <link rel="stylesheet" href="styles/typography.css">
            <link rel="stylesheet" href="components/book/book.css">
            <link rel="stylesheet" href="components/book/book-mobile.css">
            <style>
                body {
                    background: white !important;
                    color: #111827 !important;
                    overflow: visible !important;
                }
                .book-container {
                    max-width: 1000px;
                    padding: 24px 28px 40px;
                }
                .book-toolbar,
                .book-view-tabs,
                .book-note-mode-badge {
                    display: none !important;
                }
                .book-note-head {
                    border-bottom: 1px solid #d1d5db;
                    margin-bottom: 20px;
                }
                .book-note-head h1,
                #book-info,
                .book-box-content,
                .book-box-content a,
                .book-webcard-copy strong,
                .book-webcard-copy span,
                .book-business-copy strong,
                .book-business-copy p,
                .book-bible-line strong {
                    color: #111827 !important;
                }
                .book-box,
                .book-webcard,
                .book-gallery-card,
                .book-business-media,
                .book-elevator-parent,
                .book-elevator-child {
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .book-box-media-only .book-box-title {
                    display: none !important;
                }
                .book-box-media-only .book-box-content {
                    padding-top: 0 !important;
                }
                .book-sequence-mode .book-feed {
                    border-color: #d1d5db !important;
                    background: transparent !important;
                }
                .book-sequence-mode .book-box-title {
                    border-bottom-color: #cbd5e1 !important;
                }
                @page {
                    size: A4;
                    margin: 14mm;
                }
            </style>
        </head>
        <body class="${escapeHtml(bodyClasses)}">
            ${container?.outerHTML || ''}
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    const images = Array.from(printWindow.document.images || []);
    await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
        });
    }));

    setTimeout(() => {
        printWindow.print();
    }, 150);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

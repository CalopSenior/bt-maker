/**
 * Módulo de Exportação de PDF (PdfExport)
 *
 * Gera o PDF por API (html2canvas + jsPDF) em vez de usar a caixa de diálogo
 * de impressão do navegador. Cada elemento `.page` é rasterizado exatamente
 * como está renderizado na tela e inserido numa folha A4 do PDF, de modo que
 * o resultado é idêntico ao que o utilizador vê nas divs — sem depender das
 * regras `@media print` nem das margens do diálogo de impressão.
 */

const LIBS = {
    html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
};

const A4 = { width: 210, height: 297 }; // mm

/**
 * Overrides aplicados apenas no clone usado para a rasterização.
 * Servem para neutralizar efeitos que o html2canvas não reproduz fielmente
 * (bordas em gradiente via background-clip, contornos de edição, sombras de
 * foco) sem alterar nada do documento real na tela.
 */
const CLONE_STYLE = `
    .controls, .no-print, .modal-overlay { display: none !important; }

    /* Contornos do modo de edição não fazem parte do documento final */
    .editable, .editable:hover, .editable:focus {
        border-color: transparent !important;
        outline: none !important;
        background-color: transparent !important;
        box-shadow: none !important;
    }

    /* A borda em gradiente da ficha de emergência usa background-clip,
       que o html2canvas não suporta: troca pela variante sólida de 4 cores. */
    .page-emergency {
        background: #ffffff !important;
        border: 5px solid transparent !important;
        border-color: #003df5 #7030d6 #ff5e00 #7030d6 !important;
    }

    /* Sem sombra de folha: no PDF a página é a própria folha */
    .page, .page-emergency { box-shadow: none !important; margin: 0 !important; }
`;

let overlayEl = null;

export const PdfExport = {
    /**
     * Gera e descarrega o PDF com todas as páginas do documento.
     *
     * @param {Object}  [options]
     * @param {string}  [options.selector='.page']  Selector das folhas a exportar.
     * @param {string}  [options.filename]          Nome do ficheiro (sem extensão).
     * @param {number}  [options.scale=2.5]         Fator de resolução da rasterização.
     */
    async generate(options = {}) {
        const selector = options.selector || '.page';
        const scale = options.scale || 2.5;

        const pages = Array.from(document.querySelectorAll(selector));
        if (pages.length === 0) {
            alert('Não há páginas para exportar.');
            return;
        }

        PdfExport.showOverlay('A preparar a exportação...');

        try {
            await PdfExport.ensureLibs();

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });

            for (let i = 0; i < pages.length; i++) {
                PdfExport.showOverlay(`A renderizar página ${i + 1} de ${pages.length}...`);

                const canvas = await window.html2canvas(pages[i], {
                    scale,
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: '#ffffff',
                    logging: false,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: document.documentElement.scrollWidth,
                    onclone: clonedDoc => {
                        const style = clonedDoc.createElement('style');
                        style.textContent = CLONE_STYLE;
                        clonedDoc.head.appendChild(style);
                    }
                });

                if (i > 0) pdf.addPage('a4', 'portrait');

                // Encaixe SEMPRE proporcional: o .page tem exatamente 210mm de
                // largura (border-box) e os seus próprios paddings internos, por
                // isso normalmente ocupa a folha inteira. Se o conteúdo tiver
                // ultrapassado os 297mm, reduz-se a escala uniformemente em vez
                // de esticar a imagem — nunca há deformação.
                const { width: imgW, height: imgH } = PdfExport.fitToPage(canvas);

                pdf.addImage(
                    canvas.toDataURL('image/jpeg', 0.95),
                    'JPEG',
                    (A4.width - imgW) / 2, 0, imgW, imgH,
                    undefined,
                    'FAST'
                );
            }

            PdfExport.showOverlay('A gravar o ficheiro...');
            pdf.save(`${PdfExport.resolveFilename(options.filename)}.pdf`);
        } catch (err) {
            console.error('Falha na exportação do PDF:', err);
            alert(
                'Não foi possível gerar o PDF pela API.\n\n' +
                'Detalhe: ' + err.message + '\n\n' +
                'A abrir a impressão do navegador como alternativa.'
            );
            window.print();
        } finally {
            PdfExport.hideOverlay();
        }
    },

    /**
     * Calcula as dimensões em mm para encaixar o canvas na folha A4
     * mantendo a proporção original (sem esticar em nenhum eixo).
     */
    fitToPage(canvas) {
        const ratio = canvas.height / canvas.width;
        let width = A4.width;
        let height = width * ratio;

        if (height > A4.height) {
            height = A4.height;
            width = height / ratio;
        }

        return { width, height };
    },

    /**
     * Carrega html2canvas e jsPDF sob demanda (uma única vez).
     */
    async ensureLibs() {
        if (!window.html2canvas) await PdfExport.loadScript(LIBS.html2canvas);
        if (!window.jspdf) await PdfExport.loadScript(LIBS.jspdf);

        if (!window.html2canvas || !window.jspdf) {
            throw new Error('Bibliotecas de exportação indisponíveis (verifique a ligação à internet).');
        }
    },

    loadScript: src => new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            existing.addEventListener('load', resolve);
            existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)));
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
        document.head.appendChild(script);
    }),

    /**
     * Deriva o nome do ficheiro do nome do produto presente no documento.
     */
    resolveFilename(explicit) {
        if (explicit) return PdfExport.slugify(explicit);

        const source =
            document.querySelector('.product-bar')?.innerText ||
            document.querySelector('[data-ai-field="emergency_product_name"]')?.innerText ||
            document.title ||
            'documento';

        return PdfExport.slugify(source) || 'documento';
    },

    slugify: text =>
        String(text)
            .trim()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80),

    showOverlay(message) {
        if (!overlayEl) {
            overlayEl = document.createElement('div');
            overlayEl.className = 'no-print';
            overlayEl.style.cssText = [
                'position:fixed', 'inset:0', 'z-index:99999',
                'background:rgba(0,0,0,.65)', 'display:flex',
                'align-items:center', 'justify-content:center',
                'color:#fff', 'font-family:Nunito,Arial,sans-serif',
                'font-size:16px', 'font-weight:700', 'text-align:center',
                'padding:20px'
            ].join(';');
            document.body.appendChild(overlayEl);
        }
        overlayEl.textContent = message;
    },

    hideOverlay() {
        overlayEl?.remove();
        overlayEl = null;
    }
};

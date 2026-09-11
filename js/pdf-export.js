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
const MM_TO_PT = 72 / 25.4; // jsPDF mede fontes em pontos, mesmo em documentos em mm

/**
 * Overrides aplicados apenas no clone usado para a rasterização.
 * Servem para neutralizar efeitos que o html2canvas não reproduz fielmente,
 * sem alterar nada do documento real na tela.
 */
const CLONE_STYLE = `
    .controls, .no-print, .modal-overlay { display: none !important; }

    /* Nada é forçado sobre .editable de propósito.
       Os realces de edição vivem em :hover e :focus, que nunca se aplicam no
       documento clonado que o html2canvas rasteriza, por isso não há nada a
       neutralizar. Já as regras genéricas que aqui existiam apagavam estilo
       real: a .product-bar (fundo azul, texto branco) e os .section-title
       (moldura em pílula) também têm a classe .editable e desapareciam. */

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
    MM_TO_PT,

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

                const offsetX = (A4.width - imgW) / 2;

                pdf.addImage(
                    canvas.toDataURL('image/jpeg', 0.95),
                    'JPEG',
                    offsetX, 0, imgW, imgH,
                    undefined,
                    'FAST'
                );

                PdfExport.addTextLayer(pdf, pages[i], imgW, offsetX);
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
     * Sobrepõe à imagem uma camada de texto invisível, posicionada sobre as
     * palavras correspondentes. A aparência do PDF continua a ser exactamente
     * a da imagem rasterizada; esta camada existe só para que o texto possa
     * ser seleccionado, copiado e pesquisado.
     *
     * Nunca deve impedir a geração do PDF: qualquer falha aqui é registada e
     * ignorada, ficando apenas o PDF sem camada de texto.
     */
    addTextLayer(pdf, pageEl, imgWidthMm, offsetXMm) {
        try {
            const pageRect = pageEl.getBoundingClientRect();
            if (!pageRect.width) return;

            const mmPerPx = imgWidthMm / pageRect.width;

            pdf.setTextColor(0, 0, 0);

            PdfExport.textLines(pageEl).forEach(line => {
                const sizePt = line.fontSizePx * mmPerPx * PdfExport.MM_TO_PT;
                if (sizePt < 1) return;

                pdf.setFontSize(sizePt);
                pdf.text(
                    line.text,
                    offsetXMm + (line.left - pageRect.left) * mmPerPx,
                    (line.baseline - pageRect.top) * mmPerPx,
                    { renderingMode: 'invisible', baseline: 'alphabetic' }
                );
            });
        } catch (err) {
            console.warn('Camada de texto do PDF não pôde ser gerada:', err);
        }
    },

    /**
     * Percorre os nós de texto do elemento e devolve-os já partidos por linha
     * visual, com a posição e o tamanho de fonte de cada uma.
     *
     * A quebra por linha é detectada carácter a carácter, comparando o topo do
     * rectângulo de cada um: é a única forma fiável de saber onde o navegador
     * quebrou um parágrafo. São apenas leituras de layout, sem escritas, por
     * isso não forçam reflow.
     */
    textLines(pageEl) {
        const lines = [];
        const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;

                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                // Controlos de ecrã (barras de ferramentas, botões) não são documento
                if (parent.closest('.no-print, .controls, .modal-overlay')) {
                    return NodeFilter.FILTER_REJECT;
                }

                const style = getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        });

        // Marcadores de lista vêm do ::marker do CSS, que não é conteúdo do DOM
        // e por isso não apareceria na camada de texto. Sem eles, copiar uma
        // lista — ou reimportar o PDF — perde a sua estrutura.
        const markedItems = new Set();

        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const fontSizePx = parseFloat(getComputedStyle(node.parentElement).fontSize) || 0;
            const chars = node.textContent;
            const range = document.createRange();
            let line = null;

            const item = node.parentElement.closest('li');
            let prefix = '';
            if (item && !markedItems.has(item)) {
                markedItems.add(item);
                prefix = '• ';
            }

            for (let i = 0; i < chars.length; i++) {
                range.setStart(node, i);
                range.setEnd(node, i + 1);
                const rect = range.getBoundingClientRect();

                // Espaços no início ou fim de linha não têm rectângulo útil
                if (!rect.width && !rect.height) {
                    if (line) line.text += chars[i];
                    continue;
                }

                const isNewLine = !line || Math.abs(rect.top - line.top) > 1;
                if (isNewLine) {
                    line = {
                        // Só a primeira linha do item leva o marcador
                        text: line ? '' : prefix,
                        top: rect.top,
                        left: rect.left,
                        // Aproximação da linha de base dentro da caixa de linha
                        baseline: rect.top + rect.height * 0.8,
                        fontSizePx
                    };
                    lines.push(line);
                }

                line.text += chars[i];
            }
        }

        return lines
            .map(line => ({ ...line, text: line.text.trim() }))
            .filter(line => line.text);
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
            .replace(/\p{Diacritic}/gu, '')
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

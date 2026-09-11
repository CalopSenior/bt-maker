/**
 * Importação de Boletins Técnicos em PDF (BtImporter)
 *
 * Lê um PDF de boletim técnico, reconhece as secções pelos seus títulos e
 * devolve o documento montado com os campos preenchidos. Não usa IA: toda a
 * interpretação é feita por extracção de texto (pdf.js) e correspondência por
 * expressões regulares sobre os títulos que o PageBuilder já conhece.
 *
 * Títulos que não constam da lista mestre passam a campos personalizados, de
 * modo que o modelo é criado a partir do próprio PDF quando necessário.
 *
 * Funciona melhor com PDFs gerados por esta aplicação — que levam uma camada
 * de texto — mas serve qualquer PDF com texto extraível e títulos em maiúsculas.
 */

import { PageBuilder } from './page-builder.js';

/** Cabeçalho, rodapé e outras linhas que não pertencem a nenhum campo. */
const NOISE = [
    /^FICHA\s+T[EÉ]CNICA$/i,
    /^BOLETIM\s+T[EÉ]CNICO$/i,
    /^KROMO\b/i,
    /^RUA[:\s]/i,
    /^CEP[:\s]/i,
    /^TELEFONE[:\s]/i,
    /^P[AÁ]G(INA)?\.?\s*\d+/i,
    /^\d+\s*\/\s*\d+$/,
    /^www\./i,
    /@/,
    /^\(Informa[çc][ãa]o n[ãa]o encontrada/i
];

/** Marcadores de lista usados nos nossos documentos e em PDFs de terceiros. */
const BULLET = /^[••●▪·*\-–—]\s+(.*)$/;

/** Rótulo no início de linha, como "Limpeza:" ou "Comportamento:". */
const LABEL = /^[A-ZÀ-Ý][\wÀ-ÿ\s/()]{0,40}:\s/;

/** Diferença vertical, em pontos, abaixo da qual dois fragmentos são a mesma linha. */
const LINE_TOLERANCE = 2.5;

/** Folga, em pontos, para considerar que uma linha chegou à margem direita. */
const WRAP_TOLERANCE = 8;

const normalize = text =>
    String(text)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toUpperCase()
        .replace(/[^A-Z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const escapeHtml = text =>
    String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

export const BtImporter = {
    init() {
        const button = document.getElementById('btn-import-bt');
        const input = document.getElementById('file-input-import-bt');
        if (!button || !input) return;

        button.addEventListener('click', () => input.click());

        input.addEventListener('change', async event => {
            const file = event.target.files[0];
            input.value = '';
            if (!file) return;

            const originalHtml = button.innerHTML;
            button.disabled = true;
            button.textContent = 'A ler PDF...';

            try {
                const resumo = await BtImporter.importFile(file);
                alert(
                    `Boletim importado.\n\n` +
                    `Campos reconhecidos: ${resumo.conhecidos}\n` +
                    `Campos criados a partir do PDF: ${resumo.criados}`
                );
            } catch (err) {
                console.error('Falha ao importar o boletim:', err);
                alert('Não foi possível importar este PDF.\n\n' + err.message);
            } finally {
                button.disabled = false;
                button.innerHTML = originalHtml;
            }
        });
    },

    /**
     * Lê o ficheiro, interpreta-o e monta o documento.
     * @returns {{conhecidos:number, criados:number}} contagem por origem do campo
     */
    async importFile(file) {
        const lines = await BtImporter.extractLines(file);
        if (lines.length === 0) {
            throw new Error(
                'Este PDF não tem texto extraível (parece ser só imagem digitalizada).'
            );
        }

        const { schema, data } = BtImporter.parse(lines);
        if (schema.length === 0) {
            throw new Error('Não foi reconhecida nenhuma secção de boletim técnico neste PDF.');
        }

        PageBuilder.build(data, schema);

        return {
            conhecidos: schema.filter(s => !s.custom).length,
            criados: schema.filter(s => s.custom).length
        };
    },

    /**
     * Extrai as linhas de texto do PDF, na ordem de leitura.
     *
     * O pdf.js devolve fragmentos soltos com coordenadas; agrupam-se os que
     * partilham a mesma linha de base e ordenam-se da esquerda para a direita.
     * Guarda-se também onde cada linha começa e acaba, para depois reconstituir
     * os parágrafos (ver toHtml).
     */
    async extractLines(file) {
        const pdfjsLib = window.pdfjsLib;
        if (!pdfjsLib) {
            throw new Error('A biblioteca de leitura de PDF não está disponível.');
        }

        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const lines = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();

            const fragments = content.items
                .filter(item => item.str && item.str.trim())
                .map(item => ({
                    text: item.str,
                    x: item.transform[4],
                    y: item.transform[5],
                    width: item.width || 0
                }))
                .sort((a, b) => (b.y - a.y) || (a.x - b.x));

            let current = null;
            fragments.forEach(fragment => {
                if (!current || Math.abs(current.y - fragment.y) > LINE_TOLERANCE) {
                    current = { y: fragment.y, parts: [fragment] };
                    lines.push(current);
                } else {
                    current.parts.push(fragment);
                }
            });
        }

        return lines
            .map(line => {
                const parts = line.parts.slice().sort((a, b) => a.x - b.x);
                const last = parts[parts.length - 1];

                return {
                    text: BtImporter.joinParts(parts),
                    left: parts[0].x,
                    right: last.x + last.width
                };
            })
            .filter(line => line.text);
    },

    /**
     * Junta os fragmentos de uma linha, repondo os espaços que o PDF perdeu
     * entre blocos afastados.
     */
    joinParts(parts) {
        return parts
            .sort((a, b) => a.x - b.x)
            .reduce((text, fragment, index, all) => {
                if (index === 0) return fragment.text;

                const previous = all[index - 1];
                const gap = fragment.x - (previous.x + previous.width);
                const separator = gap > 1 && !/\s$/.test(text) ? ' ' : '';

                return text + separator + fragment.text;
            }, '')
            .trim();
    },

    /**
     * Percorre as linhas e reparte-as por secções.
     *
     * Uma linha vira secção quando o seu texto normalizado bate certo com um
     * título conhecido; se for um cabeçalho por aparência (maiúsculas, curto,
     * sem pontuação final) mas desconhecido, gera um campo personalizado.
     */
    parse(lines) {
        const known = PageBuilder.ALL_FIELDS.map(field => ({
            key: normalize(field.title),
            field
        }));

        const schema = [];
        const data = {};

        let current = null;
        let created = 0;

        const flush = () => {
            if (!current) return;
            const html = BtImporter.toHtml(current.buffer);
            if (html) data[current.section.field] = html;
            current = null;
        };

        const open = section => {
            flush();
            schema.push(section);
            current = { section, buffer: [] };
        };

        for (const line of lines) {
            const text = line.text;
            if (BtImporter.isNoise(text)) continue;

            const match = known.find(entry => entry.key === normalize(text));
            if (match) {
                open(BtImporter.sectionFrom(match.field));
                continue;
            }

            if (BtImporter.isHeading(text)) {
                // O primeiro cabeçalho antes de qualquer secção é o nome do produto
                if (!current && !data.product_title) {
                    data.product_title = text;
                    continue;
                }

                // A faixa do produto repete-se no topo de cada página: ignorar
                if (data.product_title && normalize(text) === normalize(data.product_title)) {
                    continue;
                }

                open({
                    field: `imported_${++created}`,
                    type: 'text',
                    title: text.toUpperCase(),
                    custom: true
                });
                continue;
            }

            if (current) current.buffer.push(line);
        }

        flush();
        return { schema, data };
    },

    /** Copia a definição de um campo conhecido, sem o que só serve à IA. */
    sectionFrom(field) {
        const { promptDesc, ...section } = field;
        return { ...section };
    },

    isNoise: line => NOISE.some(pattern => pattern.test(line)),

    /**
     * Reconhece um cabeçalho pela aparência: curto, poucas palavras, todo em
     * maiúsculas e sem pontuação de fim de frase.
     */
    isHeading(line) {
        const text = line.trim();

        if (text.length < 3 || text.length > 60) return false;
        if (/[.;,:]$/.test(text)) return false;
        if (text.split(/\s+/).length > 6) return false;

        const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '');
        if (letters.length < 3) return false;

        return letters === letters.toUpperCase();
    },

    /**
     * Converte as linhas recolhidas em HTML.
     *
     * O PDF não guarda parágrafos, só linhas, por isso a reconstituição usa a
     * geometria: uma linha que termina junto à margem direita da secção foi
     * quebrada por falta de espaço e continua na seguinte; uma linha que
     * termina antes disso fecha o parágrafo. Assim um parágrafo partido em
     * quatro linhas volta a ser um só, e itens curtos ficam separados.
     *
     * Marcadores de lista só existem no texto quando o PDF os traz — é o caso
     * dos gerados por esta aplicação. Sem eles, os itens ficam como linhas
     * próprias em vez de se inventar uma lista que pode não existir.
     */
    toHtml(buffer) {
        if (buffer.length === 0) return '';

        const margin = Math.max(...buffer.map(line => line.right));
        const blocks = [];
        let paragraph = [];
        let list = null;

        const flushParagraph = () => {
            if (paragraph.length) blocks.push(`<p>${paragraph.join(' ')}</p>`);
            paragraph = [];
        };
        const flushList = () => {
            if (list) blocks.push(`<ul>${list.map(item => `<li>${item}</li>`).join('')}</ul>`);
            list = null;
        };

        buffer.forEach(entry => {
            const line = escapeHtml(entry.text.trim());
            if (!line) return;

            const bullet = line.match(BULLET);
            if (bullet) {
                flushParagraph();
                (list = list || []).push(bullet[1]);
                return;
            }

            flushList();

            // Um novo rótulo ("Limpeza:", "Comportamento:") começa parágrafo
            if (LABEL.test(line) && paragraph.length) flushParagraph();

            paragraph.push(line);

            // Terminou antes da margem: a frase acabou aqui
            if (entry.right < margin - WRAP_TOLERANCE) flushParagraph();
        });

        flushList();
        flushParagraph();

        return blocks.join('');
    }
};

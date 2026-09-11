/**
 * Importação de Fichas de Dados de Segurança em PDF (FdsImporter)
 *
 * Lê uma FDS em PDF, reconhece as 16 secções pelos seus títulos numerados e
 * monta a ficha com os campos preenchidos. Não usa IA: a leitura do PDF é feita
 * com o pdf.js e a interpretação por expressões regulares, tal como no
 * importador de boletins técnicos — de onde reaproveita a extracção de linhas e
 * a reconstituição de parágrafos.
 *
 * Funciona com qualquer FDS cujo PDF tenha texto extraível, incluindo as que
 * esta própria aplicação gera (que levam camada de texto).
 */

import { BtImporter } from "./bt-importer.js";
import { FdsBuilder, hoje } from "./fds-builder.js";
import { FDS_SECTIONS, APPENDIX_FIELD, withAppendix } from "./fds-schema.js";

/** Cabeçalho, rodapé e outras linhas que não pertencem a nenhuma secção. */
const NOISE = [
    /^FDS$/i,
    /^FICHA\s+DE\s+DADOS\s+DE\s+SEGURAN/i,
    /^FISPQ$/i,
    /^P[AÁ]G(INA)?\.?\s*\d+/i,
    /^\d+\s*\/\s*\d+$/,
    /EM\s+CONFORMIDADE\s+COM\s+A?\s*ABNT/i,
    /^DATA\s+(DA\s+)?REVIS[ÃA]O/i,
    /^NOX\s*COR$/i,
    /^www\./i,
    /@/
];

/** Subtítulo numerado dentro de uma secção, como "4.1. Inalação". */
const SUBHEADING = /^\s*(\d{1,2})\.(\d{1,2})\.?\s+(\S.*)$/;

/** Data de revisão declarada no documento. */
const REVISION = /data\s+(?:da\s+)?revis[ãa]o\s*[:\-]?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i;

/** Nome do produto declarado no documento. */
const PRODUCT = /nome\s+(?:comercial\s+|do\s+)?(?:do\s+)?produto\s*[:\-]\s*(.+)$/i;

const normalize = text =>
    String(text)
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toUpperCase()
        .replace(/[^A-Z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const escapeHtml = text =>
    String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Títulos conhecidos, já normalizados, na ordem oficial (sem o anexo). */
const KNOWN = FDS_SECTIONS.filter(section => section.field !== APPENDIX_FIELD).map(
    (section, index) => ({
        number: index + 1,
        key: normalize(section.title),
        section
    })
);

/** O PDF de origem já traz a sua própria tabela de legendas? */
const LEGENDAS = /legendas?\s+e\s+abreviaturas/i;

/**
 * Compara dois títulos tolerando variações de redacção entre fabricantes:
 * basta que comecem pelas mesmas três palavras. Títulos mais curtos do que
 * isso só valem quando são exactamente iguais — de outro modo
 * "IDENTIFICAÇÃO" arrastaria consigo "IDENTIFICAÇÃO DE PERIGOS".
 */
function sameTitle(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;

    const palavrasA = a.split(" ");
    const palavrasB = b.split(" ");
    if (Math.min(palavrasA.length, palavrasB.length) < 3) return false;

    return palavrasA.slice(0, 3).join(" ") === palavrasB.slice(0, 3).join(" ");
}

export const FdsImporter = {
    init() {
        const button = document.getElementById("btn-fds-import");
        const input = document.getElementById("file-input-fds-pdf");
        if (!button || !input) return;

        button.addEventListener("click", () => input.click());

        input.addEventListener("change", async event => {
            const file = event.target.files[0];
            input.value = "";
            if (!file) return;

            const originalHtml = button.innerHTML;
            button.disabled = true;
            button.textContent = "A ler PDF...";

            try {
                const resumo = await FdsImporter.importFile(file);
                document.dispatchEvent(new CustomEvent("fds:imported", { detail: resumo }));
                alert(
                    "Ficha importada.\n\n" +
                    `Secções reconhecidas: ${resumo.seccoes} de 16\n` +
                    (resumo.produto ? `Produto: ${resumo.produto}` : "Nome do produto não detectado")
                );
            } catch (err) {
                console.error("Falha ao importar a FDS:", err);
                alert("Não foi possível importar este PDF.\n\n" + err.message);
            } finally {
                button.disabled = false;
                button.innerHTML = originalHtml;
            }
        });
    },

    /**
     * Lê o ficheiro, interpreta-o e monta o documento.
     * @returns {{seccoes:number, produto:string}}
     */
    async importFile(file) {
        const lines = await BtImporter.extractLines(file);
        if (lines.length === 0) {
            throw new Error(
                "Este PDF não tem texto extraível (parece ser só imagem digitalizada)."
            );
        }

        const { schema, data } = FdsImporter.parse(lines);
        if (schema.length === 0) {
            throw new Error("Não foi reconhecida nenhuma secção de FDS neste PDF.");
        }

        // A tabela de legendas fecha sempre a ficha, mesmo quando o PDF de
        // origem não a traz — a menos que ele já a tenha trazido no texto.
        const jaTemLegendas = Object.values(data).some(
            valor => typeof valor === "string" && LEGENDAS.test(valor)
        );
        FdsBuilder.build(data, jaTemLegendas ? schema : withAppendix(schema));

        return {
            seccoes: schema.length,
            produto: data._doc.product || "",
            revisao: data._doc.revision_date
        };
    },

    /**
     * Percorre as linhas e reparte-as pelas secções.
     *
     * Uma linha abre secção quando traz o número e o título de uma das 16
     * secções da norma — ou só o título, quando o PDF não os numera.
     */
    parse(lines) {
        const schema = [];
        const data = { _doc: { revision_date: "", product: "" } };

        let current = null;

        const flush = () => {
            if (!current) return;
            const html = FdsImporter.buildHtml(current.buffer);
            if (html) data[current.section.field] = html;
            current = null;
        };

        for (const line of lines) {
            const text = line.text.trim();
            if (!text) continue;

            FdsImporter.readDocFields(text, data._doc);
            if (FdsImporter.isNoise(text)) continue;

            const match = FdsImporter.matchSection(text, schema);
            if (match) {
                flush();
                schema.push(match);
                current = { section: match, buffer: [] };
                continue;
            }

            if (current) current.buffer.push(line);
        }

        flush();

        if (!data._doc.revision_date) data._doc.revision_date = hoje();
        return { schema, data };
    },

    /** Guarda a data de revisão e o nome do produto quando aparecem. */
    readDocFields(text, doc) {
        if (!doc.revision_date) {
            const revisao = text.match(REVISION);
            if (revisao) doc.revision_date = revisao[1].replace(/[-.]/g, "/");
        }

        if (!doc.product) {
            const produto = text.match(PRODUCT);
            if (produto) doc.product = produto[1].trim();
        }
    },

    /**
     * Devolve a definição da secção que esta linha abre, ou null.
     * Uma secção já aberta nunca é aberta duas vezes: o título repete-se no
     * topo das páginas seguintes de muitas fichas.
     */
    matchSection(text, schema) {
        const norm = normalize(text).replace(/^(SECAO|SESSAO|SECTION|ITEM)\s+/, "");
        const numerada = norm.match(/^(\d{1,2})\s+(.*)$/);

        let encontrada = null;

        if (numerada) {
            const numero = parseInt(numerada[1], 10);
            const titulo = numerada[2];

            // "4.1 Inalação" é subtítulo, não secção
            if (SUBHEADING.test(text)) return null;

            const exacta = KNOWN.find(known => known.key === titulo);
            const porNumero = KNOWN.find(known => known.number === numero);

            // O número da secção é a pista mais fiável; o título só decide
            // quando o PDF numera de outra maneira (ou não numera de todo).
            if (exacta) encontrada = exacta;
            else if (porNumero && titulo.length >= 3 && text.length <= 90) encontrada = porNumero;
            else encontrada = KNOWN.find(known => sameTitle(known.key, titulo)) || null;
        } else {
            encontrada = KNOWN.find(known => known.key === norm) || null;
        }

        if (!encontrada) return null;
        if (schema.some(section => section.field === encontrada.section.field)) return null;

        const { promptDesc, subsections, ...section } = encontrada.section;
        return section;
    },

    isNoise: text => NOISE.some(pattern => pattern.test(text)),

    /**
     * Converte as linhas de uma secção em HTML, transformando os subtítulos
     * numerados em <h4> e deixando o resto ao reconstrutor de parágrafos do
     * importador de boletins.
     */
    buildHtml(buffer) {
        const blocos = [];
        let chunk = [];

        const flushChunk = () => {
            if (chunk.length === 0) return;
            const html = BtImporter.toHtml(chunk);
            if (html) blocos.push(html);
            chunk = [];
        };

        buffer.forEach(line => {
            const sub = line.text.trim().match(SUBHEADING);
            if (sub) {
                flushChunk();
                blocos.push(
                    `<h4 class="fds-subtitle">${sub[1]}.${sub[2]}. ${escapeHtml(sub[3].trim())}</h4>`
                );
                return;
            }
            chunk.push(line);
        });

        flushChunk();
        return blocos.join("");
    }
};

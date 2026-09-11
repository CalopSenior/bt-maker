/**
 * Construção Dinâmica das Folhas da FDS (FdsBuilder)
 *
 * Faz para a Ficha de Dados de Segurança o que o PageBuilder faz para o
 * boletim técnico: monta folhas A4 a partir de um esquema de secções, pagina
 * automaticamente e deixa tudo editável directamente nas divs.
 *
 * O desenho da folha — cabeçalho azul "FDS", faixa da norma e rodapé com
 * "PÁGINA x/y" — é o mesmo do fds-maker; o que muda é a forma de trabalhar,
 * que passa a ser a do bt-maker.
 */

import {
    FDS_SECTIONS,
    FDS_PRESETS,
    findSection,
    skeletonFor,
    sectionHtmlFromValue
} from "./fds-schema.js";

/** Valores de cabeçalho usados quando o documento ainda não tem nenhum. */
const DEFAULT_DOC = {
    brand: "NOX COR",
    norm: "(Em conformidade com ABNT NBR 14725:2023)",
    revision_date: ""
};

export const hoje = () => new Date().toLocaleDateString("pt-BR");

export const FdsBuilder = {
    ALL_FIELDS: FDS_SECTIONS,
    PRESETS: FDS_PRESETS,

    /**
     * Monta o documento inteiro.
     *
     * @param {Object} data            conteúdo por campo (HTML) e `_doc` com o cabeçalho
     * @param {string|Array} schema    nome de uma predefinição ou lista de secções
     */
    build(data = {}, customSchema = "completa") {
        const container = document.getElementById("pages-container");
        if (!container) return;

        const schema = FdsBuilder.resolveSchema(customSchema);
        const doc = { ...DEFAULT_DOC, revision_date: hoje(), ...(data._doc || {}) };

        container.innerHTML = "";

        const pages = [];
        let page = FdsBuilder.createPage(doc);
        let content = page.querySelector(".fds-content");
        container.appendChild(page);
        pages.push(page);

        const novaPagina = () => {
            page = FdsBuilder.createPage(doc);
            content = page.querySelector(".fds-content");
            container.appendChild(page);
            pages.push(page);
        };

        // Os anexos (a tabela de legendas) ficam fora da numeração das secções
        let numero = 0;

        schema.forEach(section => {
            const block = FdsBuilder.createBlock(
                section,
                data,
                section.type === "appendix" ? null : ++numero
            );

            if (section.pageBreak && content.children.length > 0) novaPagina();

            content.appendChild(block);

            // Uma secção que não caiba no espaço restante desce inteira para a
            // folha seguinte; se já estiver sozinha numa folha, fica onde está.
            if (FdsBuilder.overflows(content) && content.children.length > 1) {
                content.removeChild(block);
                novaPagina();
                content.appendChild(block);
            }
        });

        FdsBuilder.numberPages(pages);
        FdsBuilder.updateTitle(data);
        return pages.length;
    },

    /** Aceita o nome de uma predefinição ou uma lista já pronta de secções. */
    resolveSchema(customSchema) {
        if (Array.isArray(customSchema)) return customSchema.filter(Boolean);

        const preset = FDS_PRESETS[customSchema] || FDS_PRESETS.completa;
        return preset.map(field => findSection(field)).filter(Boolean);
    },

    overflows: content => content.scrollHeight > content.clientHeight + 1,

    createPage(doc) {
        const fragment = document.getElementById("tpl-fds-page").content.cloneNode(true);
        const pageDiv = fragment.querySelector(".page-fds");

        Object.entries(doc).forEach(([name, value]) => {
            const el = pageDiv.querySelector(`[data-fds-doc="${name}"]`);
            if (el && value) el.innerHTML = value;
        });

        return pageDiv;
    },

    /**
     * Cria o bloco de uma secção. O corpo leva o conteúdo já existente ou, se
     * não houver, o esqueleto da secção (subtítulos numerados e tabelas).
     *
     * @param {number|null} numero posição da secção no documento; `null` nos
     *                             anexos, que trazem o seu próprio número.
     */
    createBlock(section, data, numero) {
        const fragment = document.getElementById("tpl-fds-block").content.cloneNode(true);
        const block = fragment.querySelector(".section-block");
        const anexo = section.type === "appendix";

        block.dataset.fdsField = section.field;
        block.dataset.blockType = section.type || "text";
        if (section.custom) block.dataset.blockCustom = "1";
        if (section.pageBreak) block.dataset.pageBreak = "1";

        const titleEl = block.querySelector(".fds-section-title");
        const titulo = FdsBuilder.baseTitle(section);
        titleEl.innerHTML = anexo ? titulo : `${numero}. ${titulo}`;
        if (anexo) titleEl.classList.add("fds-appendix-title");

        const body = block.querySelector(".fds-section-body");
        body.setAttribute("data-fds-field", section.field);

        const conteudo = data && data[section.field];
        body.innerHTML = conteudo
            ? sectionHtmlFromValue(conteudo)
            : skeletonFor(section, numero);

        if (!anexo) FdsBuilder.renumberBody(body, numero);
        return block;
    },

    /**
     * Título da secção sem a numeração, venha ele do esquema ou da página.
     * O número dos anexos faz parte do título (16.1) e não é removido.
     */
    baseTitle(section) {
        const master = findSection(section.field);
        const titulo = section.title || master?.title || "NOVA SECÇÃO";
        if (section.type === "appendix") return String(titulo);
        return String(titulo).replace(/^\s*\d+\s*[.)-]\s*/, "");
    },

    /**
     * Acerta o número da secção nos subtítulos ("4.2." passa a "5.2." quando a
     * secção muda de posição). O número do subtítulo em si nunca é mexido, para
     * não alterar referências que o utilizador tenha escrito de propósito.
     */
    renumberBody(body, numero) {
        body.querySelectorAll("h4").forEach(h4 => {
            h4.innerHTML = h4.innerHTML.replace(/^(\s*)\d+\.(\d+)\./, `$1${numero}.$2.`);
        });
    },

    /** Escreve "PÁGINA x/y" em todas as folhas. */
    numberPages(pages) {
        pages.forEach((page, index) => {
            const num = page.querySelector(".page-num");
            const total = page.querySelector(".page-total");
            if (num) num.textContent = index + 1;
            if (total) total.textContent = pages.length;
            page.id = `fds-page${index + 1}`;
        });
    },

    /**
     * Lê as folhas montadas e devolve o esquema (ordem e definição das secções)
     * com o conteúdo já editado. É o que permite acrescentar, remover ou
     * reordenar secções sem perder uma linha do que foi escrito.
     */
    captureState() {
        const schema = [];
        const data = {};

        document.querySelectorAll("#pages-container .section-block").forEach(block => {
            const body = block.querySelector(".fds-section-body");
            const title = block.querySelector(".fds-section-title");
            const field = block.dataset.fdsField;
            if (!body || !title || !field) return;

            const tipo = block.dataset.blockType || "text";
            const texto = title.innerHTML.trim();

            const section = {
                field,
                type: tipo,
                // O "16.1." do anexo faz parte do título; o "4." de uma secção
                // é numeração e é reposto na montagem seguinte.
                title: tipo === "appendix" ? texto : texto.replace(/^\s*\d+\s*[.)-]\s*/, "")
            };
            if (block.dataset.blockCustom) section.custom = true;
            if (block.dataset.pageBreak) section.pageBreak = true;

            schema.push(section);
            data[field] = body.innerHTML.trim();
        });

        data._doc = FdsBuilder.captureDoc();
        return { schema, data };
    },

    /** Lê os campos de cabeçalho da primeira folha. */
    captureDoc() {
        const page = document.querySelector("#pages-container .page-fds");
        const doc = { ...DEFAULT_DOC };
        if (!page) return doc;

        page.querySelectorAll("[data-fds-doc]").forEach(el => {
            doc[el.getAttribute("data-fds-doc")] = el.innerHTML.trim();
        });
        return doc;
    },

    /** Propaga um campo de cabeçalho por todas as folhas. */
    setDocField(name, html) {
        document
            .querySelectorAll(`#pages-container [data-fds-doc="${name}"]`)
            .forEach(el => {
                if (el.innerHTML.trim() !== html) el.innerHTML = html;
            });
    },

    /** Nome do produto tal como está escrito na secção 1 (usado no PDF). */
    productName() {
        const body = document.querySelector(
            '#pages-container [data-fds-field="section1_identificacao"]'
        );
        if (!body) return "";

        // O nome do produto é o primeiro parágrafo depois do subtítulo 1.1
        const primeiro = body.querySelector("h4")?.nextElementSibling;
        const texto = primeiro?.classList.contains("fds-placeholder")
            ? ""
            : primeiro?.textContent.trim() || "";

        return texto.length > 80 ? texto.slice(0, 80) : texto;
    },

    /** Mantém o título da janela alinhado com o produto (nome do PDF). */
    updateTitle(data) {
        const nome = (data && data._doc && data._doc.product) || FdsBuilder.productName();
        document.title = nome ? `FDS - ${nome}` : "Gerador de FDS - NOX Cor";
    }
};

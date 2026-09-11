/**
 * Ficheiro Principal do Gerador de FDS
 *
 * Liga os módulos da ficha de dados de segurança: montagem das folhas,
 * edição manual das secções, importação de PDF, exportação e (opcionalmente,
 * ver ia-toggle.js) a extração por IA.
 */

import { FdsBuilder, hoje } from "./fds-builder.js";
import { FdsFieldManager } from "./fds-fields.js";
import { FdsImporter } from "./fds-importer.js";
import { FdsAI } from "./fds-ai.js";
import { GHS_PICTOGRAMS, ghsImage, withAppendix } from "./fds-schema.js";
import { PdfExport } from "./pdf-export.js";
import { IaToggle } from "./ia-toggle.js";

const PAGE_SELECTOR = ".page-fds";

/** Nome do produto tal como o utilizador o escreveu na barra de controlos. */
let productName = "";

// --- EDITOR DE TEXTO ---------------------------------------------

const Editor = {
    /** Última posição do cursor dentro do documento, para inserções. */
    lastRange: null,

    init() {
        document.querySelectorAll(".toolbar button[data-command]").forEach(btn => {
            // Sem isto o clique no botão tirava o foco (e a selecção) ao texto
            // que se quer formatar, e o comando não teria sobre o que actuar.
            btn.addEventListener("mousedown", event => event.preventDefault());

            btn.addEventListener("click", event => {
                event.preventDefault();
                document.execCommand(btn.dataset.command, false, null);
                Editor.updateToolbar();
            });
        });

        document.addEventListener("selectionchange", () => {
            Editor.rememberCaret();
            Editor.updateToolbar();
        });

        // Colar como texto puro: mantém o documento com a formatação da casa
        document.addEventListener("paste", event => {
            if (!event.target.closest?.("[contenteditable='true']")) return;
            event.preventDefault();
            const texto = (event.clipboardData || window.clipboardData).getData("text/plain");
            document.execCommand("insertText", false, texto);
        });

        Editor.initPlaceholders();
    },

    updateToolbar() {
        document.querySelectorAll(".toolbar button[data-command]").forEach(btn => {
            try {
                btn.classList.toggle("active", !!document.queryCommandState(btn.dataset.command));
            } catch {
                btn.classList.remove("active");
            }
        });
    },

    rememberCaret() {
        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const node = range.commonAncestorContainer;
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;

        if (element?.closest("#pages-container [contenteditable='true']")) {
            Editor.lastRange = range.cloneRange();
        }
    },

    restoreCaret() {
        if (!Editor.lastRange || !document.contains(Editor.lastRange.commonAncestorContainer)) {
            return false;
        }
        const selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(Editor.lastRange);
        return true;
    },

    /** Insere HTML no ponto onde o cursor estava antes de abrir um modal. */
    insertHtml(html) {
        if (!Editor.restoreCaret()) {
            alert("Clique primeiro no ponto do documento onde quer inserir.");
            return false;
        }
        document.execCommand("insertHTML", false, html);
        Editor.rememberCaret();
        return true;
    },

    /** Acrescenta uma linha à tabela onde o cursor está. */
    addTableRow() {
        const node = Editor.lastRange?.commonAncestorContainer;
        const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
        const row = element?.closest("tr");
        const table = element?.closest("table");

        if (!table) {
            alert("Coloque o cursor dentro de uma tabela para acrescentar uma linha.");
            return;
        }

        const modelo = row && row.parentElement.tagName === "TBODY"
            ? row
            : table.querySelector("tbody tr");
        const colunas = modelo?.children.length || table.querySelector("tr")?.children.length || 3;

        const nova = document.createElement("tr");
        nova.innerHTML = Array.from({ length: colunas }, () => "<td>—</td>").join("");

        if (modelo) modelo.after(nova);
        else (table.querySelector("tbody") || table).appendChild(nova);
    },

    /**
     * Os textos de exemplo ("(preencher)") desaparecem assim que o utilizador
     * escreve por cima deles, em vez de terem de ser apagados à mão.
     */
    initPlaceholders() {
        const container = document.getElementById("pages-container");
        if (!container) return;

        // O texto é seleccionado em vez de apagado: a primeira tecla substitui-o
        // e o cursor fica sempre dentro do parágrafo (um bloco vazio não é
        // posição válida para o cursor em todos os navegadores).
        const armar = element => {
            element.classList.remove("fds-placeholder");
            if (element.classList.length === 0) element.removeAttribute("class");

            const range = document.createRange();
            range.selectNodeContents(element);
            const selection = document.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            Editor.lastRange = range.cloneRange();
        };

        container.addEventListener("click", event => {
            const placeholder = event.target.closest(".fds-placeholder");
            if (placeholder) armar(placeholder);
        });

        container.addEventListener("keydown", event => {
            if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;

            const node = document.getSelection()?.anchorNode;
            const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
            const placeholder = element?.closest(".fds-placeholder");
            if (placeholder) armar(placeholder);
        });
    }
};

// --- LEGENDA GHS -------------------------------------------------

const GhsPicker = {
    init() {
        const modal = document.getElementById("ghs-modal");
        const grid = document.getElementById("ghs-grid");
        if (!modal || !grid) return;

        grid.innerHTML = "";
        GHS_PICTOGRAMS.forEach(({ code, name }) => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "ghs-item";
            item.title = `Inserir ${name}`;
            item.innerHTML = `<img src="assets/ghs/${code}.png" alt="${code}"><span>${name}</span>`;
            item.addEventListener("click", () => {
                if (Editor.insertHtml(ghsImage(code))) modal.classList.remove("active");
            });
            grid.appendChild(item);
        });

        document.getElementById("btn-ghs")?.addEventListener("click", () =>
            modal.classList.add("active")
        );
        document.getElementById("btn-ghs-close")?.addEventListener("click", () =>
            modal.classList.remove("active")
        );
        modal.addEventListener("click", event => {
            if (event.target === modal) modal.classList.remove("active");
        });
    }
};

// --- MODELOS DE DOCUMENTO ----------------------------------------

const TemplateManager = {
    init() {
        document.getElementById("btn-fds-apply-template")?.addEventListener("click", () => {
            const tipo = document.getElementById("fds-template-type").value;
            const aviso =
                "Montar uma ficha nova a partir desta predefinição? " +
                "O conteúdo actual será perdido.";
            if (!confirm(aviso)) return;

            FdsBuilder.build({ _doc: FdsBuilder.captureDoc() }, tipo);
        });
    }
};

// --- ARMAZENAMENTO (JSON local) ----------------------------------

const StorageManager = {
    save() {
        const { schema, data } = FdsBuilder.captureState();
        if (productName) data._doc.product = productName;

        const projecto = { type: "fds", version: 1, schema, data };
        const blob = new Blob([JSON.stringify(projecto, null, 2)], {
            type: "application/json"
        });

        const link = Object.assign(document.createElement("a"), {
            href: URL.createObjectURL(blob),
            download: `fds_${PdfExport.slugify(productName || "produto")}_${Date.now()}.json`
        });
        link.click();
        URL.revokeObjectURL(link.href);
    },

    load(file) {
        const reader = new FileReader();
        reader.onload = event => {
            try {
                StorageManager.apply(JSON.parse(event.target.result));
            } catch (err) {
                console.error(err);
                alert("Não foi possível ler este ficheiro.\n\n" + err.message);
            }
        };
        reader.readAsText(file);
    },

    /**
     * Aceita três formatos: os projectos guardados aqui (esquema + conteúdo),
     * as páginas em HTML de versões anteriores e os dados de uma FDS gerada no
     * fds-maker (objecto com as chaves "sectionN_...").
     */
    apply(json) {
        if (json.schema && json.data) {
            FdsBuilder.build(json.data, json.schema);
            UI.syncFromDocument(json.data._doc);
            alert("Projecto carregado com sucesso!");
            return;
        }

        const dados = json.data && typeof json.data === "object" ? json.data : json;
        const seccoes = Object.keys(dados).filter(chave => /^section\d+_/.test(chave));

        if (seccoes.length > 0) {
            const schema = withAppendix(
                FdsBuilder.ALL_FIELDS.filter(section => seccoes.includes(section.field))
            );

            dados._doc = {
                ...(dados._doc || {}),
                revision_date: StorageManager.formatDate(dados.data_revisao) || hoje(),
                product: json.name || dados._doc?.product || ""
            };

            FdsBuilder.build(dados, schema);
            UI.syncFromDocument(dados._doc);
            alert(`Ficha carregada com ${seccoes.length} secção(ões).`);
            return;
        }

        if (json.pages) {
            document.getElementById("pages-container").innerHTML = json.pages;
            document
                .querySelectorAll("#pages-container .editable")
                .forEach(el => el.setAttribute("contenteditable", "true"));
            alert("Projecto carregado com sucesso!");
            return;
        }

        throw new Error("Este ficheiro não contém uma ficha de dados de segurança.");
    },

    /** "2024-05-30" (formato do fds-maker) passa a "30/05/2024". */
    formatDate(value) {
        if (typeof value !== "string") return "";
        const partes = value.split("-");
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : value;
    }
};

// --- BARRA DE CONTROLOS ------------------------------------------

const UI = {
    init() {
        const produto = document.getElementById("fds-product-name");
        const revisao = document.getElementById("fds-revision-date");

        produto?.addEventListener("input", () => {
            productName = produto.value.trim();
            document.title = productName ? `FDS - ${productName}` : "Gerador de FDS - NOX Cor";
        });

        if (revisao && !revisao.value) revisao.valueAsDate = new Date();
        revisao?.addEventListener("change", () => {
            const partes = revisao.value.split("-");
            if (partes.length === 3) {
                FdsBuilder.setDocField("revision_date", `${partes[2]}/${partes[1]}/${partes[0]}`);
            }
        });

        // O cabeçalho é igual em todas as folhas: editar numa reflecte-se nas outras
        document.getElementById("pages-container")?.addEventListener("input", event => {
            const campo = event.target.closest("[data-fds-doc]");
            if (!campo) return;
            FdsBuilder.setDocField(campo.getAttribute("data-fds-doc"), campo.innerHTML.trim());
        });

        document.addEventListener("fds:imported", event => {
            UI.syncFromDocument({
                product: event.detail.produto,
                revision_date: event.detail.revisao
            });
        });
    },

    /** Repõe na barra de controlos o que veio do documento carregado. */
    syncFromDocument(doc = {}) {
        const produto = document.getElementById("fds-product-name");
        const revisao = document.getElementById("fds-revision-date");

        if (produto && doc.product) {
            produto.value = doc.product;
            productName = doc.product;
            document.title = `FDS - ${doc.product}`;
        }

        if (revisao && doc.revision_date) {
            const partes = doc.revision_date.split("/");
            if (partes.length === 3) revisao.value = `${partes[2]}-${partes[1]}-${partes[0]}`;
        }
    }
};

// --- ARRANQUE ----------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    FdsBuilder.build({}, "completa");

    Editor.init();
    GhsPicker.init();
    TemplateManager.init();
    UI.init();

    FdsFieldManager.init();
    FdsImporter.init();

    // A IA continua disponível, mas oculta: activa-se com __USE_IA__ = true
    FdsAI.init();
    IaToggle.install(["#btn-fds-ai"]);

    document.getElementById("btn-add-row")?.addEventListener("click", () => Editor.addTableRow());

    document.getElementById("btn-save-project")?.addEventListener("click", StorageManager.save);

    document.getElementById("btn-load-project")?.addEventListener("click", () =>
        document.getElementById("file-input").click()
    );

    document.getElementById("file-input")?.addEventListener("change", event => {
        const file = event.target.files[0];
        event.target.value = "";
        if (file) StorageManager.load(file);
    });

    document.getElementById("btn-export-pdf")?.addEventListener("click", () =>
        PdfExport.generate({ selector: PAGE_SELECTOR, filename: productName || undefined })
    );
});

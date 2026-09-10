/**
 * Módulo de Edição Manual de Campos (FieldManager)
 *
 * Dá ao utilizador o mesmo poder que a extração por IA tinha sobre a estrutura
 * do documento, mas de forma totalmente manual e directa nas divs:
 *
 *   - montar o modelo escolhendo quais campos existem (e em que ordem);
 *   - adicionar campos avulsos, incluindo campos personalizados;
 *   - remover, subir e descer cada bloco através dos controlos que aparecem
 *     ao passar o rato por cima dele;
 *   - editar o título de cada campo directamente na página.
 *
 * Todas as operações passam por captureState() + PageBuilder.build(), por isso
 * o conteúdo já escrito é preservado e a paginação é sempre recalculada.
 */

import { PageBuilder } from "./page-builder.js";

export const FieldManager = {
    init() {
        document
            .getElementById("btn-fields-template")
            ?.addEventListener("click", () => FieldManager.openPicker());

        document
            .getElementById("btn-add-field")
            ?.addEventListener("click", () => FieldManager.openPicker({ focusCustom: true }));

        document
            .getElementById("btn-picker-cancel")
            ?.addEventListener("click", () => FieldManager.closePicker());

        document
            .getElementById("btn-picker-apply")
            ?.addEventListener("click", () => FieldManager.applyPicker());

        document
            .getElementById("btn-picker-add-custom")
            ?.addEventListener("click", () => FieldManager.addCustomField());

        document
            .getElementById("picker-preset-tinta")
            ?.addEventListener("click", () => FieldManager.applyPreset("tinta"));

        document
            .getElementById("picker-preset-thinner")
            ?.addEventListener("click", () => FieldManager.applyPreset("thinner"));

        document
            .getElementById("picker-preset-clear")
            ?.addEventListener("click", () => FieldManager.applyPreset("clear"));

        // Os controlos por bloco são reaplicados sempre que a página é remontada
        FieldManager.decorate();
        FieldManager.observeRebuilds();
    },

    /**
     * O PageBuilder recria o #pages-container inteiro a cada montagem, por isso
     * observamos o container em vez de ligar eventos a blocos individuais.
     */
    observeRebuilds() {
        const container = document.getElementById("pages-container");
        if (!container) return;

        new MutationObserver(() => FieldManager.decorate()).observe(container, {
            childList: true,
            subtree: true
        });
    },

    /**
     * Injecta a barra de ferramentas (subir / descer / remover) em cada bloco
     * que ainda não a tenha.
     */
    decorate() {
        document
            .querySelectorAll("#pages-container .section-block")
            .forEach(block => {
                if (block.querySelector(".block-tools")) return;

                const tools = document.createElement("div");
                tools.className = "block-tools no-print";
                tools.innerHTML = `
                    <button type="button" data-act="up"     title="Mover campo para cima">&#9650;</button>
                    <button type="button" data-act="down"   title="Mover campo para baixo">&#9660;</button>
                    <button type="button" data-act="remove" title="Remover campo">&#10005;</button>
                `;

                tools.addEventListener("click", e => {
                    const act = e.target.closest("button")?.dataset.act;
                    if (!act) return;
                    e.preventDefault();

                    const field =
                        block.querySelector(".section-body")?.getAttribute("data-ai-field");
                    if (!field) return;

                    if (act === "remove") FieldManager.removeField(field);
                    else FieldManager.moveField(field, act === "up" ? -1 : 1);
                });

                block.appendChild(tools);
            });
    },

    // ── Operações sobre o esquema ───────────────────────────────

    removeField(field) {
        const { schema, data } = PageBuilder.captureState();
        const section = schema.find(s => s.field === field);

        if (!confirm(`Remover o campo "${FieldManager.plainTitle(section)}"?`)) return;

        PageBuilder.build(
            data,
            schema.filter(s => s.field !== field)
        );
    },

    moveField(field, delta) {
        const { schema, data } = PageBuilder.captureState();
        const from = schema.findIndex(s => s.field === field);
        const to = from + delta;

        if (from < 0 || to < 0 || to >= schema.length) return;

        const [moved] = schema.splice(from, 1);
        schema.splice(to, 0, moved);

        PageBuilder.build(data, schema);
    },

    // ── Selector de campos ──────────────────────────────────────

    openPicker({ focusCustom = false } = {}) {
        const modal = document.getElementById("fields-picker-modal");
        if (!modal) return;

        const { schema } = PageBuilder.captureState();
        FieldManager.customFields = schema.filter(s => s.custom);

        FieldManager.renderPicker(schema.map(s => s.field));
        modal.classList.add("active");

        if (focusCustom) document.getElementById("custom-field-title")?.focus();
    },

    closePicker() {
        document.getElementById("fields-picker-modal")?.classList.remove("active");
    },

    /**
     * Desenha a lista de checkboxes: campos conhecidos do PageBuilder mais os
     * campos personalizados que já existam no documento.
     */
    renderPicker(activeFields) {
        const container = document.getElementById("picker-fields-container");
        if (!container) return;

        const all = [...PageBuilder.ALL_FIELDS, ...(FieldManager.customFields || [])];

        container.innerHTML = "";
        all.forEach(section => {
            const label = document.createElement("label");
            label.className = "picker-field";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = section.field;
            input.checked = activeFields.includes(section.field);

            const text = document.createElement("span");
            text.innerHTML = FieldManager.plainTitle(section);
            if (section.custom) text.classList.add("is-custom");

            label.append(input, text);
            container.appendChild(label);
        });
    },

    checkedFields() {
        return Array.from(
            document.querySelectorAll("#picker-fields-container input:checked")
        ).map(i => i.value);
    },

    applyPreset(name) {
        const preset = name === "clear" ? [] : PageBuilder.PRESETS[name] || [];

        document
            .querySelectorAll("#picker-fields-container input")
            .forEach(input => {
                input.checked = preset.includes(input.value);
            });
    },

    /**
     * Cria um campo que não existe na lista mestre, definido pelo utilizador.
     */
    addCustomField() {
        const titleInput = document.getElementById("custom-field-title");
        const typeSelect = document.getElementById("custom-field-type");

        const title = titleInput?.value.trim();
        if (!title) {
            alert("Dê um nome ao campo personalizado.");
            titleInput?.focus();
            return;
        }

        const section = {
            field: `custom_${Date.now()}`,
            type: typeSelect?.value || "text",
            title: title.toUpperCase(),
            custom: true
        };
        if (section.type === "icon") section.icon = "assets/brush.svg";

        FieldManager.customFields = [...(FieldManager.customFields || []), section];

        // Redesenha mantendo o que já estava marcado e marcando o campo novo
        FieldManager.renderPicker([...FieldManager.checkedFields(), section.field]);
        titleInput.value = "";
    },

    /**
     * Reconstrói o documento com os campos marcados, preservando a ordem
     * actual para os que já existiam e acrescentando os novos no fim.
     */
    applyPicker() {
        const checked = FieldManager.checkedFields();

        if (checked.length === 0) {
            alert("Selecione ao menos um campo para montar o documento.");
            return;
        }

        const { schema, data } = PageBuilder.captureState();
        const known = [...PageBuilder.ALL_FIELDS, ...(FieldManager.customFields || [])];

        const kept = schema.filter(s => checked.includes(s.field));
        const added = checked
            .filter(f => !schema.some(s => s.field === f))
            .map(f => known.find(s => s.field === f))
            .filter(Boolean);

        PageBuilder.build(data, [...kept, ...added]);
        FieldManager.closePicker();
    },

    plainTitle: section =>
        (section?.title || section?.field || "campo").replace(/<[^>]*>/g, "")
};

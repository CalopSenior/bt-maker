/**
 * Edição Manual das Secções da FDS (FdsFieldManager)
 *
 * Traz para a ficha de dados de segurança os mesmos poderes que o boletim
 * técnico tem sobre a estrutura do documento:
 *
 *   - montar a ficha escolhendo quais secções existem (e em que ordem);
 *   - acrescentar secções avulsas, incluindo secções personalizadas;
 *   - remover, subir e descer cada secção pelos controlos que aparecem ao
 *     passar o rato por cima dela;
 *   - forçar uma quebra de página antes de qualquer secção (botão ✂);
 *   - editar o título de cada secção directamente na página;
 *   - guardar a estrutura como modelo reutilizável (ver template-store.js).
 *
 * Todas as operações passam por captureState() + FdsBuilder.build(), por isso o
 * conteúdo já escrito é preservado e a paginação é sempre recalculada.
 */

import { FdsBuilder } from "./fds-builder.js";
import { FdsTemplateStore } from "./template-store.js";

export const FdsFieldManager = {
    customFields: [],

    init() {
        const on = (id, handler) =>
            document.getElementById(id)?.addEventListener("click", handler);

        on("btn-fds-fields", () => FdsFieldManager.openPicker());
        on("btn-fds-add-field", () => FdsFieldManager.openPicker({ focusCustom: true }));
        on("btn-fds-picker-cancel", () => FdsFieldManager.closePicker());
        on("btn-fds-picker-apply", () => FdsFieldManager.applyPicker());
        on("btn-fds-picker-add-custom", () => FdsFieldManager.addCustomField());
        on("btn-fds-preset-completa", () => FdsFieldManager.applyPreset("completa"));
        on("btn-fds-preset-resumida", () => FdsFieldManager.applyPreset("resumida"));
        on("btn-fds-preset-clear", () => FdsFieldManager.applyPreset("clear"));
        on("btn-fds-save-template", () => FdsFieldManager.saveTemplate());
        on("btn-fds-load-template", () => FdsFieldManager.loadTemplate());
        on("btn-fds-delete-template", () => FdsFieldManager.deleteTemplate());

        FdsFieldManager.decorate();
        FdsFieldManager.observeRebuilds();
    },

    /**
     * O FdsBuilder recria o #pages-container inteiro a cada montagem, por isso
     * observamos o container em vez de ligar eventos a blocos individuais.
     */
    observeRebuilds() {
        const container = document.getElementById("pages-container");
        if (!container) return;

        new MutationObserver(() => FdsFieldManager.decorate()).observe(container, {
            childList: true,
            subtree: true
        });
    },

    /** Injecta a barra de ferramentas em cada secção que ainda não a tenha. */
    decorate() {
        document.querySelectorAll("#pages-container .section-block").forEach(block => {
            if (block.querySelector(".block-tools")) return;

            const quebra = block.dataset.pageBreak === "1";
            const tools = document.createElement("div");
            tools.className = "block-tools no-print";
            tools.innerHTML = `
                <button type="button" data-act="break" class="${quebra ? "active" : ""}"
                        title="${quebra ? "Remover a quebra de página antes desta secção" : "Começar esta secção numa nova página"}">&#9986;</button>
                <button type="button" data-act="up"     title="Mover secção para cima">&#9650;</button>
                <button type="button" data-act="down"   title="Mover secção para baixo">&#9660;</button>
                <button type="button" data-act="remove" title="Remover secção">&#10005;</button>
            `;

            tools.addEventListener("click", event => {
                const act = event.target.closest("button")?.dataset.act;
                if (!act) return;
                event.preventDefault();

                const field = block.dataset.fdsField;
                if (!field) return;

                if (act === "remove") FdsFieldManager.removeField(field);
                else if (act === "break") FdsFieldManager.togglePageBreak(field);
                else FdsFieldManager.moveField(field, act === "up" ? -1 : 1);
            });

            block.appendChild(tools);
        });
    },

    // ── Operações sobre o esquema ───────────────────────────────

    removeField(field) {
        const { schema, data } = FdsBuilder.captureState();
        const section = schema.find(s => s.field === field);

        if (!confirm(`Remover a secção "${FdsFieldManager.plainTitle(section)}"?`)) return;

        FdsBuilder.build(data, schema.filter(s => s.field !== field));
    },

    moveField(field, delta) {
        const { schema, data } = FdsBuilder.captureState();
        const from = schema.findIndex(s => s.field === field);
        const to = from + delta;

        if (from < 0 || to < 0 || to >= schema.length) return;

        const [moved] = schema.splice(from, 1);
        schema.splice(to, 0, moved);

        FdsBuilder.build(data, schema);
    },

    togglePageBreak(field) {
        const { schema, data } = FdsBuilder.captureState();
        const section = schema.find(s => s.field === field);
        if (!section) return;

        section.pageBreak = !section.pageBreak;
        FdsBuilder.build(data, schema);
    },

    // ── Selector de secções ─────────────────────────────────────

    openPicker({ focusCustom = false } = {}) {
        const modal = document.getElementById("fds-fields-modal");
        if (!modal) return;

        const { schema } = FdsBuilder.captureState();
        FdsFieldManager.customFields = schema.filter(s => s.custom);

        FdsFieldManager.renderPicker(schema.map(s => s.field));
        FdsFieldManager.refreshTemplateList();
        modal.classList.add("active");

        if (focusCustom) document.getElementById("fds-custom-field-title")?.focus();
    },

    closePicker() {
        document.getElementById("fds-fields-modal")?.classList.remove("active");
    },

    renderPicker(activeFields) {
        const container = document.getElementById("fds-picker-fields");
        if (!container) return;

        const all = [...FdsBuilder.ALL_FIELDS, ...FdsFieldManager.customFields];

        container.innerHTML = "";
        all.forEach(section => {
            const label = document.createElement("label");
            label.className = "picker-field";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = section.field;
            input.checked = activeFields.includes(section.field);

            const text = document.createElement("span");
            text.textContent = FdsFieldManager.plainTitle(section);
            if (section.custom) text.classList.add("is-custom");

            label.append(input, text);
            container.appendChild(label);
        });
    },

    checkedFields() {
        return Array.from(
            document.querySelectorAll("#fds-picker-fields input:checked")
        ).map(input => input.value);
    },

    applyPreset(name) {
        const preset = name === "clear" ? [] : FdsBuilder.PRESETS[name] || [];

        document.querySelectorAll("#fds-picker-fields input").forEach(input => {
            input.checked = preset.includes(input.value);
        });
    },

    addCustomField() {
        const titleInput = document.getElementById("fds-custom-field-title");
        const title = titleInput?.value.trim();

        if (!title) {
            alert("Dê um nome à secção personalizada.");
            titleInput?.focus();
            return;
        }

        const section = {
            field: `custom_${Date.now()}`,
            type: "text",
            title: title.toUpperCase(),
            custom: true
        };

        FdsFieldManager.customFields = [...FdsFieldManager.customFields, section];
        FdsFieldManager.renderPicker([...FdsFieldManager.checkedFields(), section.field]);
        titleInput.value = "";
    },

    /**
     * Junta as secções marcadas numa única lista ordenada: primeiro as que já
     * existem no documento (mantendo a ordem actual), depois as novas.
     */
    orderedSelection() {
        const checked = FdsFieldManager.checkedFields();
        const { schema } = FdsBuilder.captureState();
        const known = [...FdsBuilder.ALL_FIELDS, ...FdsFieldManager.customFields];

        return [
            ...schema.filter(s => checked.includes(s.field)),
            ...checked
                .filter(field => !schema.some(s => s.field === field))
                .map(field => known.find(s => s.field === field))
                .filter(Boolean)
        ];
    },

    applyPicker() {
        if (FdsFieldManager.checkedFields().length === 0) {
            alert("Selecione ao menos uma secção para montar a ficha.");
            return;
        }

        const { data } = FdsBuilder.captureState();
        FdsBuilder.build(data, FdsFieldManager.orderedSelection());
        FdsFieldManager.closePicker();
    },

    // ── Modelos guardados (IndexedDB) ────────────────────────────

    async refreshTemplateList(selecionar) {
        const select = document.getElementById("fds-saved-templates");
        if (!select) return;

        const setState = (texto, activo) => {
            select.innerHTML = `<option value="">${texto}</option>`;
            select.disabled = !activo;
            ["btn-fds-load-template", "btn-fds-delete-template"].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.disabled = !activo;
            });
        };

        try {
            const templates = await FdsTemplateStore.list();

            if (templates.length === 0) {
                setState("(nenhum modelo guardado)", false);
                return;
            }

            setState("Escolha um modelo…", true);
            templates.forEach(tpl => {
                const option = document.createElement("option");
                option.value = tpl.name;
                option.textContent = `${tpl.name} — ${tpl.fields.length} secção(ões)`;
                select.appendChild(option);
            });

            if (selecionar) select.value = selecionar;
        } catch (err) {
            console.warn("Modelos guardados indisponíveis:", err);
            setState("(armazenamento local indisponível)", false);
        }
    },

    async saveTemplate() {
        const input = document.getElementById("fds-template-name");
        const name = input?.value.trim();

        if (!name) {
            alert("Dê um nome ao modelo antes de o guardar.");
            input?.focus();
            return;
        }

        if (FdsFieldManager.checkedFields().length === 0) {
            alert("Marque ao menos uma secção para guardar como modelo.");
            return;
        }

        const fields = FdsFieldManager.orderedSelection();

        try {
            const existente = await FdsTemplateStore.get(name);
            if (existente && !confirm(`Já existe um modelo "${name}". Substituir?`)) return;

            await FdsTemplateStore.save(name, fields);
            input.value = "";
            await FdsFieldManager.refreshTemplateList(name);
            alert(`Modelo "${name}" guardado com ${fields.length} secção(ões).`);
        } catch (err) {
            alert("Não foi possível guardar o modelo.\n\n" + err.message);
        }
    },

    async loadTemplate() {
        const name = document.getElementById("fds-saved-templates")?.value;
        if (!name) {
            alert("Escolha um modelo para carregar.");
            return;
        }

        try {
            const tpl = await FdsTemplateStore.get(name);
            if (!tpl) {
                alert(`O modelo "${name}" já não existe.`);
                await FdsFieldManager.refreshTemplateList();
                return;
            }

            const aviso =
                `Carregar o modelo "${name}" monta uma ficha em branco com ` +
                `${tpl.fields.length} secção(ões). O conteúdo actual será perdido. Continuar?`;
            if (!confirm(aviso)) return;

            const { data } = FdsBuilder.captureState();
            FdsBuilder.build({ _doc: data._doc }, tpl.fields);
            FdsFieldManager.closePicker();
        } catch (err) {
            alert("Não foi possível carregar o modelo.\n\n" + err.message);
        }
    },

    async deleteTemplate() {
        const name = document.getElementById("fds-saved-templates")?.value;
        if (!name) {
            alert("Escolha um modelo para apagar.");
            return;
        }
        if (!confirm(`Apagar definitivamente o modelo "${name}"?`)) return;

        try {
            await FdsTemplateStore.remove(name);
            await FdsFieldManager.refreshTemplateList();
        } catch (err) {
            alert("Não foi possível apagar o modelo.\n\n" + err.message);
        }
    },

    plainTitle: section =>
        (section?.title || section?.field || "secção").replace(/<[^>]*>/g, "")
};

/**
 * Extração da FDS por IA (FdsAI)
 *
 * Opcional e oculta por omissão (ver ia-toggle.js): o editor apresenta-se como
 * manual e a IA só aparece a quem escrever `__USE_IA__ = true` na consola.
 *
 * Lê uma FDS concorrente em PDF e devolve, para cada secção escolhida, o HTML
 * já pronto a entrar nas divs editáveis — o mesmo formato que o importador sem
 * IA produz, de modo que tudo o resto do editor funciona da mesma maneira.
 */

import { FdsBuilder } from "./fds-builder.js";
import { withAppendix } from "./fds-schema.js";
import { GeminiClient } from "./gemini-client.js";

export const FdsAI = {
    apiKey: null,
    selectedFile: null,

    init() {
        const button = document.getElementById("btn-fds-ai");
        const fileInput = document.getElementById("file-input-fds-ai");
        const modal = document.getElementById("fds-ai-modal");
        if (!button || !fileInput || !modal) return;

        FdsAI.renderFieldCheckboxes();

        button.addEventListener("click", () => {
            FdsAI.apiKey = localStorage.getItem("gemini_api_key");
            if (!FdsAI.apiKey) {
                const key = prompt("Insira a sua chave de API do Google Gemini:");
                if (!key) return;
                FdsAI.apiKey = key;
                localStorage.setItem("gemini_api_key", key);
            }
            fileInput.click();
        });

        fileInput.addEventListener("change", event => {
            const file = event.target.files[0];
            if (!file) return;
            FdsAI.selectedFile = file;
            modal.classList.add("active");
        });

        document.getElementById("btn-fds-ai-cancel")?.addEventListener("click", () => {
            modal.classList.remove("active");
            fileInput.value = "";
            FdsAI.selectedFile = null;
        });

        document.getElementById("btn-fds-ai-preset-completa")?.addEventListener("click", () =>
            FdsAI.applyPreset("completa")
        );
        document.getElementById("btn-fds-ai-preset-resumida")?.addEventListener("click", () =>
            FdsAI.applyPreset("resumida")
        );
        document.getElementById("btn-fds-ai-preset-clear")?.addEventListener("click", () =>
            FdsAI.applyPreset("clear")
        );

        document.getElementById("btn-fds-ai-confirm")?.addEventListener("click", async () => {
            if (!FdsAI.selectedFile) return;
            modal.classList.remove("active");

            const schema = FdsAI.selectedSchema();
            if (schema.length === 0) {
                alert("Escolha ao menos uma secção para a IA preencher.");
                return;
            }

            const options = {
                productName: document.getElementById("fds-ai-product")?.value.trim() || "",
                extraInstructions: document.getElementById("fds-ai-extra")?.value.trim() || "",
                modelName: document.getElementById("fds-ai-model")?.value,
                schema
            };

            const originalHtml = button.innerHTML;
            try {
                button.disabled = true;
                button.textContent = "⏳ A ler o PDF...";
                const base64 = await FdsAI.fileToBase64(FdsAI.selectedFile);

                button.textContent = "🤖 A gerar a ficha...";
                const data = await FdsAI.process(base64, options);

                data._doc = {
                    ...FdsBuilder.captureDoc(),
                    ...(options.productName ? { product: options.productName } : {})
                };

                button.textContent = "🏗️ A montar o documento...";
                FdsBuilder.build(data, withAppendix(schema));

                // Um JSON válido mas vazio montava a ficha em branco e ainda
                // anunciava sucesso: é preciso dizer o que veio mesmo.
                const preenchidas = schema.filter(
                    section => data[section.field] && String(data[section.field]).trim()
                ).length;

                alert(
                    preenchidas === 0
                        ? "A IA não encontrou nenhuma das secções pedidas neste PDF. " +
                          "Tente outro modelo ou preencha manualmente."
                        : `Ficha gerada: ${preenchidas} de ${schema.length} secção(ões) preenchida(s). ` +
                          "Reveja tudo antes de publicar — uma FDS é um documento legal."
                );
            } catch (err) {
                console.error(err);
                alert("Erro na IA: " + err.message);
            } finally {
                button.disabled = false;
                button.innerHTML = originalHtml;
                fileInput.value = "";
                FdsAI.selectedFile = null;
            }
        });
    },

    renderFieldCheckboxes() {
        const container = document.getElementById("fds-ai-fields");
        if (!container) return;

        container.innerHTML = "";
        // O anexo de legendas é texto fixo da norma: não há nada a extrair
        FdsAI.sections().forEach(section => {
            const label = document.createElement("label");
            label.className = "picker-field";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = section.field;
            checkbox.className = "fds-ai-checkbox";
            checkbox.checked = true;

            const text = document.createElement("span");
            text.textContent = section.title;

            label.append(checkbox, text);
            container.appendChild(label);
        });
    },

    /** Secções que a IA pode preencher (tudo menos os anexos fixos). */
    sections: () => FdsBuilder.ALL_FIELDS.filter(section => section.type !== "appendix"),

    applyPreset(name) {
        const preset = name === "clear" ? [] : FdsBuilder.PRESETS[name] || [];
        document.querySelectorAll(".fds-ai-checkbox").forEach(checkbox => {
            checkbox.checked = preset.includes(checkbox.value);
        });
    },

    selectedSchema() {
        const checked = Array.from(document.querySelectorAll(".fds-ai-checkbox:checked")).map(
            checkbox => checkbox.value
        );
        return FdsAI.sections().filter(section => checked.includes(section.field));
    },

    fileToBase64: file =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        }),

    /**
     * Chama a IA através do GeminiClient, que trata das tentativas, dos modelos
     * pensantes e das respostas embrulhadas em ```json.
     */
    async process(base64Data, options) {
        return GeminiClient.generateJson({
            apiKey: FdsAI.apiKey || localStorage.getItem("gemini_api_key") || "",
            models: FdsAI.modelsToTry(options.modelName),
            prompt: FdsAI.buildPrompt(options),
            pdfBase64: base64Data,
            onProgress: mensagem => {
                console.info(mensagem);
                const btn = document.getElementById("btn-fds-ai");
                if (btn) btn.textContent = `\u{1F916} ${mensagem}`;
            }
        });
    },

    /**
     * O modelo escolhido primeiro e, a seguir, os restantes da lista: os
     * modelos "preview" são retirados sem aviso, e sem isto a extração deixava
     * de funcionar de um dia para o outro.
     */
    modelsToTry(escolhido) {
        const todos = Array.from(
            document.querySelectorAll("#fds-ai-model option")
        ).map(option => option.value);

        return [escolhido, ...todos.filter(model => model !== escolhido)].filter(Boolean);
    },

    buildPrompt(options) {
        const campos = options.schema
            .map(section => `- ${section.field}: ${section.title}. ${section.promptDesc || ""}`)
            .join("\n        ");

        return `Você é um especialista em segurança química e na norma ABNT NBR 14725:2023.
        Leia a Ficha de Dados de Segurança em PDF anexada e devolva um JSON cujas chaves são exactamente
        os campos pedidos abaixo e cujos valores são HTML pronto a publicar.

        REGRAS DE FORMATAÇÃO DO HTML:
        - Use <h4 class="fds-subtitle"> para os subtítulos numerados da norma (ex.: "4.1. Inalação").
        - Use <p>, <strong>, <ul><li> para o texto corrido e as listas.
        - Para dados tabulares (composição, propriedades) gere <table class="chemical-table"> completa,
          com <thead> e <tbody>.
        - Para pictogramas GHS escreva o marcador {alt+N}, em que N é o número do pictograma
          (1 explosivo, 2 inflamável, 3 oxidante, 4 gás sob pressão, 5 corrosivo, 6 tóxico,
          7 nocivo, 8 perigo à saúde, 9 perigo ao meio ambiente).
        - Mantenha as frases de perigo (H) e de precaução (P) exactamente como estão no original.
        - Quando a informação não existir no documento, escreva "Não disponível" em vez de inventar.

        NOME DO PRODUTO: ${options.productName || "detectar no PDF"}
        ${options.productName ? "Substitua o nome do produto concorrente por este nome em todos os textos." : ""}

        INSTRUÇÕES EXTRAS DO UTILIZADOR (seguir rigorosamente):
        ${options.extraInstructions || "Nenhuma."}

        CAMPOS PEDIDOS (chaves do JSON):
        ${campos}`;
    }
};

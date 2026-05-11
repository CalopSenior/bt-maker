import { PageBuilder } from "./page-builder.js";

export const AIManager = {
  apiKey: null,
  selectedFile: null,

  init: () => {
    const btnAiFill = document.getElementById("btn-ai-fill");
    const fileInput = document.getElementById("file-input-pdf");
    const modal = document.getElementById("ai-modal");
    const btnCancel = document.getElementById("btn-cancel-ai");
    const btnConfirm = document.getElementById("btn-confirm-ai");

    // Renderiza os checkboxes de seleção de campos dinamicamente
    AIManager.renderFieldCheckboxes();

    if (btnAiFill && fileInput) {
      btnAiFill.addEventListener("click", () => {
        AIManager.apiKey = localStorage.getItem("gemini_api_key");
        if (!AIManager.apiKey) {
          const key = prompt(
            "Por favor, insira sua chave de API do Google Gemini:",
          );
          if (key) {
            AIManager.apiKey = key;
            localStorage.setItem("gemini_api_key", key);
          } else return;
        }
        fileInput.click();
      });

      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        AIManager.selectedFile = file;
        modal.classList.add("active");
      });

      btnCancel.addEventListener("click", () => {
        modal.classList.remove("active");
        fileInput.value = "";
        AIManager.selectedFile = null;
      });

      // Configuração dos botões de predefinição rápida
      document.getElementById("preset-tinta").onclick = () =>
        AIManager.applyPreset("tinta");
      document.getElementById("preset-thinner").onclick = () =>
        AIManager.applyPreset("thinner");
      document.getElementById("preset-clear").onclick = () =>
        AIManager.applyPreset("clear");

      btnConfirm.addEventListener("click", async () => {
        if (!AIManager.selectedFile) return;
        modal.classList.remove("active");

        const productName = document.getElementById("ai-product-name").value;
        const extraInstructions = document.getElementById(
          "ai-extra-instructions",
        ).value;
        const modelName = document.getElementById("ai-model-select").value;

        // Captura apenas os campos que o usuário marcou
        const selectedSchema = AIManager.getSelectedSchema();

        if (selectedSchema.length === 0) {
          alert(
            "Você precisa selecionar ao menos um campo para construir a página!",
          );
          return;
        }

        const options = {
          productName,
          extraInstructions,
          modelName,
          selectedSchema,
        };

        try {
          btnAiFill.textContent = "⏳ Lendo PDF...";
          btnAiFill.disabled = true;

          const base64Data = await AIManager.fileToBase64(
            AIManager.selectedFile,
          );

          btnAiFill.textContent = "🤖 Processando Prompt Dinâmico...";
          const data = await AIManager.processWithGemini(base64Data, options);

          btnAiFill.textContent = "🏗️ Construindo Documento...";

          // Passa o esquema customizado que o usuário escolheu para montar as folhas A4
          PageBuilder.build(data, selectedSchema);

          alert("Extração e reconstrução finalizadas com sucesso!");
        } catch (error) {
          console.error(error);
          alert("Erro na IA: " + error.message);
        } finally {
          btnAiFill.textContent = "✨ Extração IA Profunda";
          btnAiFill.disabled = false;
          fileInput.value = "";
          AIManager.selectedFile = null;
        }
      });
    }
  },

  // Renderiza a lista de todos os campos possíveis na tela do Modal
  renderFieldCheckboxes: () => {
    const container = document.getElementById("ai-fields-container");
    if (!container) return;

    container.innerHTML = "";
    PageBuilder.ALL_FIELDS.forEach((field) => {
      const label = document.createElement("label");
      label.style.display = "flex";
      label.style.alignItems = "center";
      label.style.gap = "8px";
      label.style.fontSize = "12px";
      label.style.cursor = "pointer";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = field.field;
      checkbox.className = "field-checkbox";
      checkbox.checked = true; // Vem marcado por padrão

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(field.title));
      container.appendChild(label);
    });
  },

  // Aplica predefinições (marca/desmarca caixinhas)
  applyPreset: (type) => {
    const checkboxes = document.querySelectorAll(".field-checkbox");
    if (type === "clear") {
      checkboxes.forEach((cb) => (cb.checked = false));
      return;
    }

    const presetFields = PageBuilder.PRESETS[type] || [];
    checkboxes.forEach((cb) => {
      cb.checked = presetFields.includes(cb.value);
    });
  },

  // Retorna a "Receita" de blocos baseada no que o usuário ticou
  getSelectedSchema: () => {
    const checkedValues = Array.from(
      document.querySelectorAll(".field-checkbox:checked"),
    ).map((cb) => cb.value);
    return PageBuilder.ALL_FIELDS.filter((field) =>
      checkedValues.includes(field.field),
    );
  },

  fileToBase64: (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }),

  processWithGemini: async (base64Data, options) => {
    const retries = 5;
    const delays = [1000, 2000, 4000, 8000, 16000];
    let lastError;

    for (let i = 0; i < retries; i++) {
      try {
        return await AIManager.callGeminiFetch(base64Data, options);
      } catch (err) {
        lastError = err;
        if (i < retries - 1) await new Promise((r) => setTimeout(r, delays[i]));
      }
    }
    throw new Error(
      `Falha após ${retries} tentativas. Último erro: ${lastError.message}`,
    );
  },

  callGeminiFetch: async (base64Data, options) => {
    const apiKey =
      AIManager.apiKey || localStorage.getItem("gemini_api_key") || "";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${options.modelName}:generateContent?key=${apiKey}`;

    // Construção Dinâmica do Prompt baseada APENAS nos campos selecionados
    const fieldsPromptList = options.selectedSchema
      .map((f) => `- ${f.field}: ${f.promptDesc}`)
      .join("\n        ");

    let systemInstruction = `Você é um especialista em documentação técnica e processamento de dados. 
        Sua missão é extrair informações do PDF estritamente no formato JSON, focando APENAS nos campos solicitados.
        Mantenha tags de formatação HTML (<b>, <br>, <ul>, <li>). Se houver dados tabulares, gere o HTML de uma <table> completa.
        
        INSTRUÇÕES EXTRAS DO USUÁRIO (Siga rigorosamente):
        ${options.extraInstructions || "Nenhuma instrução extra."}
        
        Nome do Produto Obrigatório: ${options.productName || "Detectar do PDF"}

        CAMPOS SOLICITADOS (JSON Keys):
        ${fieldsPromptList}

        Se a informação não existir no documento para algum dos campos solicitados, devolva uma string vazia "".`;

    const payload = {
      contents: [
        {
          parts: [
            { text: systemInstruction },
            { inlineData: { mimeType: "application/pdf", data: base64Data } },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || `Erro HTTP ${response.status}`,
      );
    }

    const result = await response.json();
    return JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text);
  },
};

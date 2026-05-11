/**
 * Arquivo Principal
 * Agora importa os módulos separadamente, evitando código duplicado da IA.
 */

import { AIManager } from "./ai-manager.js";
import { PageBuilder } from "./page-builder.js";

// --- SISTEMA DE LOGO GLOBAL ---
document
  .getElementById("global-logo-upload")
  ?.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (event) {
        const dataUrl = event.target.result;
        const activeLogos = document.querySelectorAll(
          "#pages-container .doc-logo-img",
        );
        activeLogos.forEach((img) => {
          img.src = dataUrl;
          img.classList.add("loaded");
        });

        const templateLogos = document.querySelectorAll(
          "#templates-repository .doc-logo-img",
        );
        templateLogos.forEach((img) => {
          img.src = dataUrl;
          img.classList.add("loaded");
        });
      };
      reader.readAsDataURL(file);
    }
  });

const LogoManager = {
  defaultSrc: "assets/logo.svg",
  applyToAll: () => {
    const allLogos = document.querySelectorAll(".doc-logo-img");
    allLogos.forEach((img) => {
      if (!img.getAttribute("src") || img.getAttribute("src") === "") {
        img.src = LogoManager.defaultSrc;
      }
      img.classList.add("loaded");
    });
  },
  applyToContainer: (container) => {
    container.querySelectorAll(".doc-logo-img").forEach((img) => {
      if (!img.getAttribute("src") || img.getAttribute("src") === "") {
        img.src = LogoManager.defaultSrc;
      }
      img.classList.add("loaded");
    });
  },
};

// --- SISTEMA DE TEMPLATES ---
const TemplateManager = {
  init: () => {
    const btnApply = document.getElementById("btn-generate-template");
    btnApply.addEventListener("click", () => {
      const type = document.getElementById("template-type").value;
      if (
        confirm(
          `Gerar novo modelo vazio de ${type.toUpperCase()}? Você perderá as alterações não salvas.`,
        )
      ) {
        TemplateManager.loadTemplate(type);
      }
    });
    // Inicia gerando uma página vazia seguindo o esquema
    TemplateManager.loadTemplate("tinta");
  },
  loadTemplate: (type) => {
    // Agora, ao invés de buscar um HTML gigante fixo, pedimos para o Builder
    // construir a estrutura dinamicamente com dados vazios ({}) para edição manual
    PageBuilder.build({}, type);
    LogoManager.applyToAll();
  },
};

// --- EDITOR DE TEXTO ---
const Editor = {
  init: () => {
    const toolbarButtons = document.querySelectorAll(".toolbar button");
    toolbarButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const command = btn.dataset.command;
        document.execCommand(command, false, null);
        Editor.updateToolbarState();
      });
    });
    document.addEventListener("selectionchange", Editor.updateToolbarState);
  },
  updateToolbarState: () => {
    const buttons = document.querySelectorAll(".toolbar button");
    buttons.forEach((btn) => {
      if (document.queryCommandState(btn.dataset.command)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  },
};

// --- ARMAZENAMENTO (JSON Local) ---
const StorageManager = {
  save: () => {
    const htmlContent = document.getElementById("pages-container").innerHTML;
    const blob = new Blob([JSON.stringify({ pages: htmlContent })], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ficha_tecnica_${Date.now()}.json`;
    a.click();
  },
  load: (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.pages) {
          document.getElementById("pages-container").innerHTML = data.pages;
          alert("Projeto carregado com sucesso!");
        }
      } catch (err) {
        alert("Erro ao carregar o arquivo.");
      }
    };
    reader.readAsText(file);
  },
};

// INICIAR EVENTOS AO CARREGAR A PÁGINA
document.addEventListener("DOMContentLoaded", () => {
  TemplateManager.init();
  LogoManager.applyToAll();
  Editor.init();

  // Inicializa a IA carregada do módulo externo
  AIManager.init();

  document
    .getElementById("btn-save-project")
    .addEventListener("click", StorageManager.save);

  document
    .getElementById("btn-load-project")
    .addEventListener("click", () =>
      document.getElementById("file-input").click(),
    );

  document.getElementById("file-input").addEventListener("change", (e) => {
    if (e.target.files[0]) StorageManager.load(e.target.files[0]);
  });

  // Atualização em Tempo Real do Title do Documento (Para o nome do PDF)
  document.addEventListener("input", (e) => {
    if (e.target.classList.contains("product-bar")) {
      const newTitle = e.target.innerText.trim();
      document.title =
        newTitle && newTitle !== "NOME DO PRODUTO"
          ? `BT - ${newTitle}`
          : "Boletim Técnico - NOX Cor";
    }
  });
});

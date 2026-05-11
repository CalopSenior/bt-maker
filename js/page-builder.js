/**
 * Módulo de Construção Dinâmica de Páginas
 * Contém todos os blocos possíveis. Constrói a página com base no que o usuário pedir.
 */

export const PageBuilder = {
  // LISTA MESTRE: Todos os campos que o sistema conhece e sabe renderizar
  ALL_FIELDS: [
    {
      field: "description",
      type: "text",
      title: "DESCRIÇÃO DO PRODUTO",
      promptDesc: "Descrição geral completa do produto.",
    },
    {
      field: "composition",
      type: "text",
      title: "COMPOSIÇÃO BÁSICA",
      promptDesc: "Composição básica química do material.",
    },
    {
      field: "uses",
      type: "text",
      title: "INDICAÇÃO DE USO",
      promptDesc: "Usos recomendados (use listas <ul><li>).",
    },
    {
      field: "characteristics",
      type: "text",
      title: "CARACTERÍSTICAS",
      promptDesc: "Tabela das características físicas/químicas.",
    },
    {
      field: "surface_preparation",
      type: "icon",
      title: "PREPARO DA SUPERFÍCIE",
      icon: "assets/prepare.svg",
      promptDesc: "Instruções completas de preparação de superfície.",
    },
    {
      field: "yield",
      type: "icon", // Alterado de text para icon
      title: "RENDIMENTO TEÓRICO",
      icon: "assets/rend.svg", // Ícone associado
      promptDesc: "Rendimento teórico (ex: m²/litro).",
    },
    {
      field: "heat_resistance",
      type: "icon",
      title: "RESISTÊNCIA AO CALOR",
      icon: "assets/fire.svg",
      promptDesc: "Resistência a temperaturas máximas e contínuas.",
    },
    {
      field: "packaging",
      type: "icon", // Alterado de text para icon
      title: "EMBALAGENS",
      icon: "assets/pots.svg", // Ícone associado
      promptDesc: "Tabelas detalhando as embalagens e volumes.",
    },
    {
      field: "drying",
      type: "icon",
      title: "SECAGEM",
      icon: "assets/clock.svg",
      promptDesc: "Tabela HTML completa com tempos de secagem.",
    },
    {
      field: "repainting",
      type: "icon",
      title: "SECAGEM REPINTURA",
      icon: "assets/cure.svg",
      bg: "var(--nox-orange)",
      border: "1px solid #e65500",
      promptDesc: "Tabela HTML completa de intervalos de repintura.",
    },
    {
      field: "mixture",
      type: "icon",
      title: "RELAÇÃO DA MISTURA",
      icon: "assets/cat.svg",
      bg: "linear-gradient(135deg, #ff7e33 0%, #e65500 100%)",
      promptDesc: "Relação e proporção exata da mistura.",
    },
    {
      field: "dilution",
      type: "icon", // Alterado de text para icon
      title: "DILUIÇÃO",
      icon: "assets/dilu.svg", // Ícone associado
      promptDesc: "Diluição recomendada (tipo de solvente e %).",
    },
    {
      field: "pot_life",
      type: "icon", // Alterado de text para icon
      title: "VIDA ÚTIL DA MISTURA",
      icon: "assets/pot-life.svg", // Ícone associado
      promptDesc: "Vida útil da mistura (pot life) após catalisada.",
    },
    {
      field: "coats",
      type: "icon", // Alterado de text para icon
      title: "DEMÃO RECOMENDADA",
      icon: "assets/layers.svg", // Ícone associado
      promptDesc: "Número de demãos recomendadas.",
    },
    {
      field: "induction",
      type: "text",
      title: "TEMPO DE INDUÇÃO (25°C)",
      promptDesc: "Tempo de indução antes da aplicação.",
    },
    {
      field: "application",
      type: "application",
      title: "APLICAÇÃO",
      promptDesc:
        "Instruções detalhadas de aplicação. Gere as tabelas para pistola Airless e Convencional. Inclua rolo/trincha.",
    },
    {
      field: "safety_full",
      type: "icon",
      title: "SEGURANÇA",
      icon: "assets/mask.svg",
      promptDesc: "Precauções de segurança integrais e EPIs.",
    },
    {
      field: "important_recommendation",
      type: "text",
      title: "RECOMENDAÇÃO IMPORTANTE",
      promptDesc: "Avisos cruciais de manuseio e estocagem.",
    },
    {
      field: "notes",
      type: "text",
      title: "NOTAS",
      promptDesc: "Notas gerais e isenções de responsabilidade.",
    },
  ],

  // Predefinições para facilitar a seleção rápida
  PRESETS: {
    tinta: [
      "description",
      "composition",
      "uses",
      "surface_preparation",
      "yield",
      "heat_resistance",
      "packaging",
      "drying",
      "repainting",
      "mixture",
      "dilution",
      "pot_life",
      "coats",
      "induction",
      "application",
      "safety_full",
      "notes",
    ],
    thinner: [
      "description",
      "uses",
      "characteristics",
      "important_recommendation",
      "safety_full",
      "notes",
    ],
  },

  // Constrói a página com base no esquema (schema) selecionado
  build: (data, customSchema) => {
    const container = document.getElementById("pages-container");
    container.innerHTML = "";

    let schema = [];

    // VERIFICAÇÃO ADICIONADA: Checa se é uma string ("tinta") ou um array (vários campos)
    if (typeof customSchema === "string") {
      const presetFields = PageBuilder.PRESETS[customSchema] || [];
      // Filtra os campos completos da lista mestre para usar
      schema = PageBuilder.ALL_FIELDS.filter((field) =>
        presetFields.includes(field.field),
      );
    } else if (Array.isArray(customSchema)) {
      // Se já for o array que a IA mandou com os checkboxes, usa direto
      schema = customSchema;
    }

    const productTitle = data.product_title || "NOME DO PRODUTO";

    // ATUALIZAÇÃO DO TÍTULO DA PÁGINA (Para o Metadado/Nome de arquivo do PDF)
    document.title =
      productTitle !== "NOME DO PRODUTO"
        ? `BT - ${productTitle}`
        : "Boletim Técnico - NOX Cor";

    let currentPageIndex = 1;
    let currentPage = PageBuilder.createPage(currentPageIndex, productTitle);
    container.appendChild(currentPage);

    let contentArea = currentPage.querySelector(".page-content");
    const MAX_SAFE_HEIGHT = 980;

    schema.forEach((section) => {
      const block = PageBuilder.createBlock(section, data);
      contentArea.appendChild(block);

      // Medir altura da página com o novo bloco
      const headerH = currentPage.querySelector(".header").offsetHeight;
      const barH = currentPage.querySelector(".product-bar").offsetHeight;
      const contentH = contentArea.offsetHeight;

      const totalUsedHeight = headerH + barH + contentH;

      // Quebra de página automática
      if (totalUsedHeight > MAX_SAFE_HEIGHT) {
        contentArea.removeChild(block);
        currentPageIndex++;
        currentPage = PageBuilder.createPage(currentPageIndex, productTitle);
        container.appendChild(currentPage);
        contentArea = currentPage.querySelector(".page-content");
        contentArea.appendChild(block);
      }
    });
  },

  createPage: (pageNum, title) => {
    const tpl = document
      .getElementById("tpl-page-base")
      .content.cloneNode(true);
    const pageDiv = tpl.querySelector(".page");
    pageDiv.id = `page${pageNum}`;
    pageDiv.querySelector(".product-bar").innerHTML = title;

    const activeLogo = document.querySelector(
      "#pages-container .doc-logo-img.loaded",
    );
    if (activeLogo) {
      const newLogo = pageDiv.querySelector(".doc-logo-img");
      newLogo.src = activeLogo.src;
      newLogo.classList.add("loaded");
    }

    return pageDiv;
  },

  createBlock: (section, data) => {
    let tpl;
    if (section.type === "text") {
      tpl = document.getElementById("tpl-block-text").content.cloneNode(true);
    } else if (section.type === "icon") {
      tpl = document.getElementById("tpl-block-icon").content.cloneNode(true);
      const iconBox = tpl.querySelector(".icon-box");
      tpl.querySelector("img").src = section.icon;
      if (section.bg) iconBox.style.background = section.bg;
      if (section.border) iconBox.style.border = section.border;
    } else if (section.type === "application") {
      tpl = document
        .getElementById("tpl-block-application")
        .content.cloneNode(true);
    }

    const block = tpl.querySelector(".section-block");
    tpl.querySelector(".section-title").innerHTML = section.title;

    const editableArea = tpl.querySelector(".section-body");
    editableArea.setAttribute("data-ai-field", section.field);

    if (data && data[section.field]) {
      editableArea.innerHTML = data[section.field];
    } else {
      editableArea.innerHTML =
        "<em>(Informação não encontrada ou aguardando preenchimento)</em>";
      editableArea.style.color = "#888";

      editableArea.addEventListener(
        "focus",
        function () {
          if (this.innerHTML.includes("Informação não encontrada")) {
            this.innerHTML = "";
            this.style.color = "#000";
          }
        },
        { once: true },
      );
    }

    return block;
  },
};

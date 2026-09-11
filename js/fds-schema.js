/**
 * Esquema da Ficha de Dados de Segurança (FdsSchema)
 *
 * Descreve as 16 secções da FDS tal como saem no documento do fds-maker
 * (ABNT NBR 14725:2023): mesmos títulos, mesma numeração e mesma ordem.
 * Cada secção traz também o seu "esqueleto" — os subtítulos numerados e as
 * tabelas que o documento deve ter — para que um documento novo já nasça com
 * a estrutura certa e o utilizador só tenha de escrever por cima.
 *
 * O conteúdo de cada secção é sempre HTML editável: é isso que permite usar
 * aqui a mesma edição directa nas divs que o boletim técnico usa.
 */

/** Pictogramas do Sistema Globalmente Harmonizado (GHS). */
export const GHS_PICTOGRAMS = [
    { code: "GHS01", name: "Explosivo" },
    { code: "GHS02", name: "Inflamável" },
    { code: "GHS03", name: "Oxidante" },
    { code: "GHS04", name: "Gás sob pressão" },
    { code: "GHS05", name: "Corrosivo" },
    { code: "GHS06", name: "Tóxico" },
    { code: "GHS07", name: "Nocivo / Irritante" },
    { code: "GHS08", name: "Perigo à saúde" },
    { code: "GHS09", name: "Perigo ao meio ambiente" }
];

/** Texto normalizado do sistema de classificação, fixo por norma. */
const SISTEMA_CLASSIFICACAO =
    "Norma ABNT NBR 14725:2023. Sistema Globalmente Harmonizado para a " +
    "Classificação e Rotulagem de Produtos Químicos (GHS), ONU.";

/** Legendas e abreviaturas que fecham a secção 16. */
const ABREVIATURAS = [
    ["CAS", "Chemical Abstract Service/Serviço de Registro de Produtos Químicos"],
    ["VO", "Vapores Orgânicos"],
    ["NEC", "National Eletrical code/Código Nacional de Eletricidade"],
    ["IEC", "International Eletrical Commision/Comissão Internacional de Eletricidade"],
    ["ABNT", "Associação Brasileira de Normas Técnicas"],
    ["ACGIH", "American Conference of Governmental Industrial Hygienists/ Conferência Americana de Higienistas Industriais Governamentais"],
    ["TLV", "Threshold Limit Values/Valores Limites de Tolerância"],
    ["TLV/TWA", "Time Weighted Average/Limite de Tolerância – Média Ponderada pelo Tempo"],
    ["TLV/STEL", "Short Term Exposure Limit/Limite de Tolerância – Exposição de Curta Duração"],
    ["TLC/C", "Limite de Tolerância – Valor Teto"],
    ["EPI", "Equipamento de Proteção Individual"],
    ["CA", "Certificado de Aprovação"],
    ["PPRA", "Programa de Prevenção de Riscos Ambientais"],
    ["NR", "Norma Regulamentadora"],
    ["NFPA", "National Fire Protection Agency"],
    ["mmHg", "Milímetros de mercúrio – unidade de pressão"],
    ["DL50", "Dose Letal média"],
    ["CL50", "Concentração Letal média"],
    ["ppm", "Partes por milhão"],
    ["N.d", "Não disponível"],
    ["A+B", "Viscosidade da mistura entre componente A + componente B."]
];

const abreviaturasTable = () =>
    '<table class="chemical-table abbreviations-table"><tbody>' +
    ABREVIATURAS.map(
        ([sigla, texto]) => `<tr><td class="abbr-key">${sigla}</td><td>${texto}</td></tr>`
    ).join("") +
    "</tbody></table>";

const composicaoTable = () =>
    '<table class="chemical-table">' +
    "<thead><tr><th>Nome Químico</th><th>CAS</th><th>Concentração</th></tr></thead>" +
    "<tbody>" +
    Array.from({ length: 3 }, () => "<tr><td>—</td><td>—</td><td>—</td></tr>").join("") +
    "</tbody></table>";

/** Lista de propriedades da secção 9, no formato "rótulo: valor". */
const PROPRIEDADES = [
    "Estado físico",
    "Cor",
    "Odor",
    "pH",
    "Ponto de fusão",
    "Ponto de ebulição",
    "Ponto de fulgor",
    "Inflamabilidade",
    "Densidade",
    "Solubilidade"
];

const labelList = (labels) =>
    labels
        .map(label => `<p><strong>${label}:</strong> <span class="fds-placeholder">Não disponível</span></p>`)
        .join("");

/**
 * LISTA MESTRE — as 16 secções da FDS.
 *
 * `field`  chave usada no JSON (a mesma do fds-maker, para interoperar);
 * `title`  título sem número: a numeração é aplicada na montagem, para que
 *          reordenar ou remover secções nunca deixe números errados;
 * `subsections` esqueleto do corpo (subtítulos, tabelas e texto fixo).
 */
export const FDS_SECTIONS = [
    {
        field: "section1_identificacao",
        type: "text",
        title: "IDENTIFICAÇÃO",
        promptDesc: "Nome do produto, uso recomendado, fornecedor e telefone de emergência.",
        subsections: [
            { num: 1, title: "Identificação do produto" },
            { num: null, title: "Uso recomendado" },
            { num: 2, title: "Identificação do fornecedor da ficha de dados de segurança" },
            { num: 3, title: "Informações em caso de emergência" }
        ]
    },
    {
        field: "section2_identificacao_perigos",
        type: "text",
        title: "IDENTIFICAÇÃO DE PERIGOS",
        promptDesc:
            "Classificação de perigo, elementos do rótulo GHS (pictogramas, palavra de advertência, frases H e P) e outros perigos.",
        subsections: [
            { num: 1, title: "Classificação de perigo do produto químico" },
            { num: 2, title: "Sistema de classificação utilizado", html: `<p>${SISTEMA_CLASSIFICACAO}</p>` },
            {
                num: null,
                title: "Elementos do rótulo GHS",
                html:
                    '<p class="ghs-row fds-placeholder">Insira aqui os pictogramas (botão GHS na barra).</p>' +
                    "<p><strong>Palavra de advertência:</strong> <span class=\"fds-placeholder\">Perigo / Atenção</span></p>" +
                    "<p><strong>Frases de perigo:</strong></p><ul><li>H___ – ____</li></ul>" +
                    "<p><strong>Frases de precaução:</strong></p><ul><li>P___ – ____</li></ul>"
            },
            { num: 3, title: "Outros perigos que não resultam em uma classificação" }
        ]
    },
    {
        field: "section3_composicao",
        type: "text",
        title: "COMPOSIÇÃO E INFORMAÇÕES SOBRE OS INGREDIENTES",
        promptDesc: "Tipo (substância ou mistura) e tabela de ingredientes com nome químico, CAS e concentração.",
        subsections: [
            {
                num: null,
                title: null,
                html: '<p><strong>Tipo de produto:</strong> <span class="fds-placeholder">Mistura</span></p>' + composicaoTable()
            }
        ]
    },
    {
        field: "section4_primeiros_socorros",
        type: "text",
        title: "MEDIDAS DE PRIMEIROS-SOCORROS",
        promptDesc: "Medidas por via de exposição, sintomas mais importantes e notas para o médico.",
        subsections: [
            { num: 1, title: "Inalação" },
            { num: 2, title: "Contato com a pele" },
            { num: 3, title: "Contato com os olhos" },
            { num: 4, title: "Ingestão" },
            { num: 5, title: "Sintomas e efeitos mais importantes" },
            { num: 6, title: "Notas para o médico" }
        ]
    },
    {
        field: "section5_combate_incendio",
        type: "text",
        title: "MEDIDAS DE COMBATE A INCÊNDIO",
        promptDesc: "Meios de extinção, perigos específicos e medidas de proteção da equipe.",
        subsections: [
            { num: 1, title: "Meios de extinção apropriados" },
            { num: 2, title: "Perigos específicos da mistura" },
            { num: 3, title: "Medidas de proteção da equipe de combate a incêndio" }
        ]
    },
    {
        field: "section6_controle_derramamento",
        type: "text",
        title: "MEDIDAS DE CONTROLE PARA DERRAMAMENTO OU VAZAMENTO",
        promptDesc: "Precauções pessoais, ao meio ambiente e métodos de limpeza.",
        subsections: [
            { num: 1, title: "Precauções pessoais, equipamento de proteção e procedimentos de emergência" },
            { num: 2, title: "Precauções ao meio ambiente" },
            { num: 3, title: "Métodos e materiais para a contenção e limpeza" }
        ]
    },
    {
        field: "section7_manuseio_armazenamento",
        type: "text",
        title: "MANUSEIO E ARMAZENAMENTO",
        promptDesc: "Precauções para manuseio seguro e condições de armazenamento.",
        subsections: [
            { num: 1, title: "Precauções para manuseio seguro" },
            { num: 2, title: "Condições de armazenamento seguro, incluindo incompatibilidades" }
        ]
    },
    {
        field: "section8_controle_exposicao",
        type: "text",
        title: "CONTROLE DE EXPOSIÇÃO E PROTEÇÃO INDIVIDUAL",
        promptDesc: "Parâmetros de controle, medidas de engenharia e EPIs (olhos, pele, respiratória).",
        subsections: [
            { num: 1, title: "Parâmetros de controle" },
            { num: 2, title: "Medidas de controle de engenharia" },
            {
                num: 3,
                title: "Medidas de proteção individual",
                html:
                    '<p><strong>Proteção dos olhos/face:</strong> <span class="fds-placeholder">(preencher)</span></p>' +
                    '<p><strong>Proteção da pele e do corpo:</strong> <span class="fds-placeholder">(preencher)</span></p>' +
                    '<p><strong>Proteção respiratória:</strong> <span class="fds-placeholder">(preencher)</span></p>'
            }
        ]
    },
    {
        field: "section9_propriedades_fisico_quimicas",
        type: "text",
        title: "PROPRIEDADES FÍSICO-QUÍMICAS",
        promptDesc: "Estado físico, cor, odor, pH, pontos de fusão/ebulição/fulgor, densidade e solubilidade.",
        subsections: [{ num: null, title: null, html: labelList(PROPRIEDADES) }]
    },
    {
        field: "section10_estabilidade_reatividade",
        type: "text",
        title: "ESTABILIDADE E REATIVIDADE",
        promptDesc: "Reatividade, estabilidade, condições e materiais a evitar, produtos perigosos da decomposição.",
        subsections: [
            { num: 1, title: "Reatividade" },
            { num: 2, title: "Estabilidade química" },
            { num: 3, title: "Condições a serem evitadas" },
            { num: 4, title: "Materiais incompatíveis" },
            { num: 5, title: "Produtos perigosos da decomposição" }
        ]
    },
    {
        field: "section11_informacoes_toxicologicas",
        type: "text",
        title: "INFORMAÇÕES TOXICOLÓGICAS",
        promptDesc: "Toxicidade aguda, irritação, sensibilização, mutagenicidade, carcinogenicidade e reprodução.",
        subsections: [
            { num: 1, title: "Toxicidade aguda" },
            { num: 2, title: "Corrosão/irritação da pele" },
            { num: 3, title: "Lesões oculares graves/irritação ocular" },
            { num: 4, title: "Sensibilização respiratória ou à pele" },
            { num: 5, title: "Mutagenicidade em células germinativas" },
            { num: 6, title: "Carcinogenicidade" },
            { num: 7, title: "Toxicidade à reprodução" }
        ]
    },
    {
        field: "section12_informacoes_ecologicas",
        type: "text",
        title: "INFORMAÇÕES ECOLÓGICAS",
        promptDesc: "Ecotoxicidade, persistência, bioacumulação e mobilidade no solo.",
        subsections: [
            { num: 1, title: "Ecotoxicidade" },
            { num: 2, title: "Persistência e degradabilidade" },
            { num: 3, title: "Potencial bioacumulativo" },
            { num: 4, title: "Mobilidade no solo" }
        ]
    },
    {
        field: "section13_destinacao_final",
        type: "text",
        title: "CONSIDERAÇÕES SOBRE DESTINAÇÃO FINAL",
        promptDesc: "Métodos de destinação do produto e da embalagem usada.",
        subsections: [
            { num: 1, title: "Métodos recomendados para destinação final" },
            { num: 2, title: "Embalagem usada" }
        ]
    },
    {
        field: "section14_transporte",
        type: "text",
        title: "INFORMAÇÕES SOBRE TRANSPORTE",
        promptDesc: "Número ONU, nome apropriado para embarque, classe de risco, grupo de embalagem e perigo ambiental.",
        subsections: [
            {
                num: null,
                title: null,
                html: labelList([
                    "Número ONU",
                    "Nome apropriado para embarque",
                    "Classe de risco",
                    "Grupo de embalagem",
                    "Perigo ao meio ambiente"
                ])
            }
        ]
    },
    {
        field: "section15_regulamentacoes",
        type: "text",
        title: "INFORMAÇÕES SOBRE REGULAMENTAÇÕES",
        promptDesc: "Regulamentações específicas para o produto químico.",
        subsections: [{ num: null, title: "Regulamentações específicas" }]
    },
    {
        field: "section16_outras_informacoes",
        type: "text",
        title: "OUTRAS INFORMAÇÕES",
        promptDesc: "Observações finais, referências e legendas.",
        subsections: [
            { num: null, title: null },
            { num: 1, title: "Legendas e abreviaturas", html: abreviaturasTable() }
        ]
    }
];

/** Predefinições de montagem rápida. */
export const FDS_PRESETS = {
    completa: FDS_SECTIONS.map(section => section.field),
    resumida: [
        "section1_identificacao",
        "section2_identificacao_perigos",
        "section3_composicao",
        "section4_primeiros_socorros",
        "section5_combate_incendio",
        "section7_manuseio_armazenamento",
        "section8_controle_exposicao",
        "section16_outras_informacoes"
    ]
};

/** Devolve a definição mestre de um campo, ou null se for personalizado. */
export const findSection = field =>
    FDS_SECTIONS.find(section => section.field === field) || null;

/**
 * Monta o esqueleto de uma secção: subtítulos numerados a partir da posição
 * que a secção ocupa no documento (`index` começa em 0).
 */
export function skeletonFor(section, index) {
    const master = findSection(section.field) || section;
    const subsections = master.subsections || [];
    const numero = index + 1;

    if (subsections.length === 0) {
        return '<p class="fds-placeholder">(preencher)</p>';
    }

    return subsections
        .map(sub => {
            const titulo = sub.title
                ? `<h4 class="fds-subtitle">${sub.num ? `${numero}.${sub.num}. ` : ""}${sub.title}</h4>`
                : "";
            const corpo = sub.html || '<p class="fds-placeholder">(preencher)</p>';
            return titulo + corpo;
        })
        .join("");
}

// ── Conversão de dados em HTML ──────────────────────────────────

const escapeHtml = text =>
    String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

/** Rótulos mais legíveis do que a simples conversão da chave. */
const LABELS = {
    tipo: "Tipo de produto",
    nome_produto: "Nome do produto",
    uso_recomendado: "Uso recomendado",
    empresa: "Fornecedor",
    telefone_emergencia: "Telefone de emergência",
    classificacao_substancia: "Classificação de perigo",
    palavra_advertencia: "Palavra de advertência",
    frases_perigo: "Frases de perigo",
    frases_precaucao: "Frases de precaução",
    outros_perigos: "Outros perigos",
    contato_pele: "Contato com a pele",
    contato_olhos: "Contato com os olhos",
    ph: "pH"
};

const labelFor = key =>
    LABELS[key] || String(key).replace(/_/g, " ").replace(/\b\w/g, letra => letra.toUpperCase());

/**
 * Expande a notação curta que o fds-maker usa nos textos:
 *   {alt+2} pictograma GHS   {*negrito*}   {_itálico_}   {~sublinhado~}   {\n}
 */
export function expandPlaceholders(text) {
    if (typeof text !== "string") return text;

    return text
        .replace(/[{[]\s*alt\s*\+\s*([1-9])\s*[}\]]/gi, (match, numero) => ghsImage(`GHS0${numero}`))
        .replace(/{\s*\\n\s*}/g, "<br>")
        .replace(/{\*(.*?)\*}/gs, "<strong>$1</strong>")
        .replace(/{_(.*?)_}/gs, "<em>$1</em>")
        .replace(/{~(.*?)~}/gs, "<u>$1</u>");
}

/** HTML de um pictograma GHS, no tamanho usado no documento. */
export const ghsImage = code =>
    `<img class="ghs-picto" src="assets/ghs/${String(code).toUpperCase()}.png" alt="${String(code).toUpperCase()}">`;

const looksLikeHtml = text => /<\/?[a-z][\s\S]*>/i.test(text);

const textToHtml = text =>
    expandPlaceholders(escapeHtml(text))
        .split(/\n{2,}/)
        .map(bloco => `<p>${bloco.replace(/\n/g, "<br>")}</p>`)
        .join("");

function ingredientsTable(lista) {
    const linhas = lista
        .map(
            item =>
                `<tr><td>${escapeHtml(item.nome_quimico || "—")}</td>` +
                `<td>${escapeHtml(item.cas || "—")}</td>` +
                `<td>${escapeHtml(item.concentracao || "—")}</td></tr>`
        )
        .join("");

    return (
        '<table class="chemical-table">' +
        "<thead><tr><th>Nome Químico</th><th>CAS</th><th>Concentração</th></tr></thead>" +
        `<tbody>${linhas}</tbody></table>`
    );
}

/**
 * Converte o valor de uma secção em HTML pronto a editar.
 *
 * Aceita tanto uma string (texto simples ou já HTML, como vem da IA e do
 * importador) como o objecto encaixado que o fds-maker guarda nos seus
 * projectos — é o que permite reaproveitar aqui dados criados lá.
 */
export function sectionHtmlFromValue(value, depth = 0) {
    if (value === null || value === undefined || value === "") return "";

    if (typeof value === "string") {
        return looksLikeHtml(value) ? expandPlaceholders(value) : textToHtml(value);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return "";
        if (value.every(item => item && typeof item === "object")) {
            const ingrediente = value[0].nome_quimico || value[0].cas || value[0].concentracao;
            if (ingrediente) return ingredientsTable(value);
            return value.map(item => sectionHtmlFromValue(item, depth + 1)).join("");
        }
        return `<ul>${value.map(item => `<li>${expandPlaceholders(escapeHtml(item))}</li>`).join("")}</ul>`;
    }

    if (typeof value !== "object") return textToHtml(String(value));

    return Object.entries(value)
        .filter(([, valor]) => valor !== null && valor !== undefined && valor !== "")
        .map(([chave, valor]) => {
            if (chave === "pictogramas" && Array.isArray(valor)) {
                return `<p class="ghs-row">${valor.map(code => ghsImage(code)).join("")}</p>`;
            }
            if (chave === "ingredientes" && Array.isArray(valor)) {
                return ingredientsTable(valor);
            }
            if (Array.isArray(valor)) {
                return `<p><strong>${labelFor(chave)}:</strong></p>` + sectionHtmlFromValue(valor, depth + 1);
            }
            if (typeof valor === "object") {
                return (
                    `<h4 class="fds-subtitle">${labelFor(chave)}</h4>` +
                    sectionHtmlFromValue(valor, depth + 1)
                );
            }
            return `<p><strong>${labelFor(chave)}:</strong> ${expandPlaceholders(escapeHtml(valor))}</p>`;
        })
        .join("");
}

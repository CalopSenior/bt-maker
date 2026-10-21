/**
 * Cliente da API Gemini (GeminiClient)
 *
 * Camada única usada pela extração por IA do boletim técnico e da ficha de
 * dados de segurança. Existe porque falar com a API em cru tem três
 * armadilhas que davam erros sem sentido ao utilizador:
 *
 *   - os modelos pensantes (Gemini 3) podem devolver partes de raciocínio
 *     antes do texto, por isso ler `parts[0].text` apanha o raciocínio;
 *   - mesmo a pedir JSON, os modelos embrulham a resposta em ```json;
 *   - uma resposta sem texto (cortada, bloqueada) dava
 *     «"undefined" is not valid JSON» em vez de dizer o que aconteceu.
 *
 * Trata ainda das tentativas: só repete o que vale a pena repetir (falhas de
 * rede e erros temporários do servidor) e desiste de imediato quando a chave
 * está errada ou o pedido é inválido — repetir isso cinco vezes só faz o
 * utilizador esperar meio minuto por uma mensagem que já se sabia.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Erros do servidor que costumam passar se tentarmos outra vez. */
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

const DELAYS = [1000, 2000, 4000];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export class GeminiError extends Error {
    constructor(message, { status = 0, retryable = false, modelMissing = false } = {}) {
        super(message);
        this.name = "GeminiError";
        this.status = status;
        this.retryable = retryable;
        this.modelMissing = modelMissing;
    }
}

export const GeminiClient = {
    /**
     * Gera uma resposta em JSON a partir de um PDF.
     *
     * @param {Object}   opts
     * @param {string}   opts.apiKey
     * @param {string[]} opts.models      modelos a tentar, por ordem: se o
     *                                    primeiro já não existir (os modelos
     *                                    "preview" são retirados), passa ao
     *                                    seguinte em vez de falhar.
     * @param {string}   opts.prompt
     * @param {string}   opts.pdfBase64
     * @param {number}   [opts.temperature]
     * @param {Function} [opts.onProgress] recebe uma mensagem de estado.
     * @returns {Promise<Object>} o JSON já analisado.
     */
    async generateJson({ apiKey, models, prompt, pdfBase64, temperature = 0.2, onProgress }) {
        if (!apiKey) throw new GeminiError("Falta a chave de API do Google Gemini.");

        const lista = (Array.isArray(models) ? models : [models]).filter(Boolean);
        if (lista.length === 0) throw new GeminiError("Nenhum modelo indicado.");

        let ultimoErro = null;
        const semModelo = [];

        for (const model of lista) {
            try {
                return await GeminiClient.requestWithRetry({
                    apiKey,
                    model,
                    prompt,
                    pdfBase64,
                    temperature,
                    onProgress
                });
            } catch (err) {
                ultimoErro = err;

                // Modelo retirado ou inexistente: vale a pena tentar o seguinte
                if (err instanceof GeminiError && err.modelMissing) {
                    semModelo.push(model);
                    console.warn(`Modelo "${model}" indisponível; a tentar o seguinte.`);
                    onProgress?.(`Modelo ${model} indisponível. A tentar outro...`);
                    continue;
                }
                throw err;
            }
        }

        if (semModelo.length === lista.length) {
            throw new GeminiError(
                "Nenhum dos modelos está disponível nesta chave de API " +
                `(tentados: ${semModelo.join(", ")}). Os modelos "preview" são ` +
                "retirados com o tempo: confirme os nomes na documentação do Gemini.",
                { status: 404, modelMissing: true }
            );
        }

        throw ultimoErro;
    },

    /** Uma chamada, repetida só enquanto o erro for temporário. */
    async requestWithRetry({ apiKey, model, prompt, pdfBase64, temperature, onProgress }) {
        let ultimoErro = null;

        for (let tentativa = 0; tentativa <= DELAYS.length; tentativa++) {
            try {
                return await GeminiClient.request({ apiKey, model, prompt, pdfBase64, temperature });
            } catch (err) {
                ultimoErro = err;

                const podeRepetir = !(err instanceof GeminiError) || err.retryable;
                if (!podeRepetir || tentativa === DELAYS.length) throw err;

                const espera = DELAYS[tentativa];
                onProgress?.(`Falhou (${err.message}). Nova tentativa em ${espera / 1000}s...`);
                await wait(espera);
            }
        }

        throw ultimoErro;
    },

    /** Uma única chamada à API. */
    async request({ apiKey, model, prompt, pdfBase64, temperature }) {
        let response;
        try {
            response = await fetch(
                `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: prompt },
                                    ...(pdfBase64
                                        ? [{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }]
                                        : [])
                                ]
                            }
                        ],
                        generationConfig: { responseMimeType: "application/json", temperature }
                    })
                }
            );
        } catch (err) {
            // Falha de rede: não houve resposta nenhuma
            throw new GeminiError(
                `Não foi possível contactar a API do Gemini (${err.message}).`,
                { retryable: true }
            );
        }

        if (!response.ok) throw await GeminiClient.errorFrom(response, model);

        const resultado = await response.json();
        const texto = GeminiClient.extractText(resultado);

        if (!texto) {
            console.error("Resposta da IA sem texto:", resultado);
            throw new GeminiError(GeminiClient.explainEmpty(resultado));
        }

        return GeminiClient.parseJson(texto);
    },

    /**
     * Constrói o erro a partir da resposta, mesmo que o corpo não seja JSON.
     * Nunca pode rebentar: um erro ao ler um erro esconderia a causa real.
     */
    async errorFrom(response, model) {
        let mensagem = "";
        try {
            const corpo = await response.json();
            mensagem = corpo?.error?.message || "";
        } catch {
            try {
                mensagem = (await response.text?.()) || "";
            } catch {
                mensagem = "";
            }
        }
        mensagem = String(mensagem).slice(0, 300);

        const status = response.status;
        const modelMissing = status === 404 && /model/i.test(mensagem);

        if (status === 400 && /api[\s_-]?key/i.test(mensagem)) {
            return new GeminiError(
                "A chave de API foi recusada. Confirme a chave do Google Gemini " +
                "(apaga-se com localStorage.removeItem('gemini_api_key') na consola).",
                { status }
            );
        }
        if (status === 403) {
            return new GeminiError(
                "A chave de API não tem acesso a este modelo ou a API não está activada no projecto Google.",
                { status }
            );
        }
        if (modelMissing) {
            return new GeminiError(
                `O modelo "${model}" não está disponível nesta chave de API.`,
                { status, modelMissing: true }
            );
        }
        if (status === 429) {
            return new GeminiError(
                "Limite de pedidos atingido (quota). Aguarde um pouco e tente de novo.",
                { status, retryable: true }
            );
        }

        return new GeminiError(
            mensagem.trim() || `Erro HTTP ${status} na API do Gemini.`,
            { status, retryable: RETRYABLE.has(status) }
        );
    },

    /**
     * Junta o texto da resposta.
     *
     * Os modelos pensantes podem intercalar partes de raciocínio (`thought`),
     * que não são conteúdo: lê-las como se fossem a resposta era o que fazia
     * a extração falhar com os modelos Gemini 3.
     */
    extractText(resultado) {
        const partes = resultado?.candidates?.[0]?.content?.parts || [];
        return partes
            .filter(parte => !parte.thought && typeof parte.text === "string")
            .map(parte => parte.text)
            .join("")
            .trim();
    },

    /** Diz, em português, por que motivo não veio texto nenhum. */
    explainEmpty(resultado) {
        const bloqueio = resultado?.promptFeedback?.blockReason;
        if (bloqueio) {
            return `O pedido foi bloqueado pelos filtros do Gemini (${bloqueio}). ` +
                "Tente outro PDF ou reformule as instruções extras.";
        }

        const fim = resultado?.candidates?.[0]?.finishReason;
        if (fim === "MAX_TOKENS") {
            return "A resposta foi cortada por ser demasiado longa. " +
                "Seleccione menos campos de cada vez.";
        }
        if (fim === "SAFETY" || fim === "PROHIBITED_CONTENT") {
            return `A resposta foi bloqueada pelos filtros de segurança (${fim}).`;
        }
        if (fim === "RECITATION") {
            return "A resposta foi bloqueada por reproduzir texto protegido (RECITATION).";
        }

        return "A IA devolveu uma resposta vazia. Tente novamente ou escolha outro modelo.";
    },

    /**
     * Analisa o JSON da resposta.
     *
     * Mesmo com `responseMimeType: application/json`, os modelos embrulham o
     * JSON em ```json ... ``` com frequência suficiente para valer a pena
     * limpar antes de analisar.
     */
    parseJson(texto) {
        const limpo = texto
            .replace(/^\s*```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/, "")
            .trim();

        let dados;
        try {
            dados = JSON.parse(limpo);
        } catch (err) {
            console.error("Resposta da IA que não é JSON:", texto);
            throw new GeminiError(
                "A IA não devolveu JSON válido. Tente novamente ou escolha outro modelo."
            );
        }

        if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
            console.error("Resposta da IA com formato inesperado:", dados);
            throw new GeminiError("A IA devolveu um formato inesperado (não é um objecto).");
        }

        return dados;
    }
};

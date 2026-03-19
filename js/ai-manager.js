/**
 * Módulo de Integração com IA (Gemini)
 * Responsável por ler PDF via Base64 e preencher os campos automaticamente.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export const AIManager = {
    apiKey: null,
    selectedFile: null,

    init: () => {
        const btnAiFill = document.getElementById('btn-ai-fill');
        const fileInput = document.getElementById('file-input-pdf');
        
        // Elementos do Modal
        const modal = document.getElementById('ai-modal');
        const btnCancel = document.getElementById('btn-cancel-ai');
        const btnConfirm = document.getElementById('btn-confirm-ai');

        if (btnAiFill && fileInput) {
            btnAiFill.addEventListener('click', () => {
                // Verificar se já temos a chave
                AIManager.apiKey = localStorage.getItem('gemini_api_key');
                
                if (!AIManager.apiKey) {
                    const key = prompt('Por favor, insira sua chave de API do Google Gemini:');
                    if (key) {
                        AIManager.apiKey = key;
                        localStorage.setItem('gemini_api_key', key);
                    } else {
                        return;
                    }
                }
                
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                // Guardar arquivo selecionado e abrir modal
                AIManager.selectedFile = file;
                modal.classList.add('active');
            });
            
            // Cancelar Modal
            btnCancel.addEventListener('click', () => {
                modal.classList.remove('active');
                fileInput.value = '';
                AIManager.selectedFile = null;
            });

            // Confirmar Processamento
            btnConfirm.addEventListener('click', async () => {
                if (!AIManager.selectedFile) return;
                
                modal.classList.remove('active');
                
                // Coletar dados do formulário
                const options = {
                    productName: document.getElementById('ai-product-name').value,
                    proportion: document.getElementById('ai-proportion').value,
                    related: document.getElementById('ai-related').value,
                    extra: document.getElementById('ai-extra').value
                };

                try {
                    btnAiFill.textContent = '⏳ Lendo PDF...';
                    btnAiFill.disabled = true;

                    // 1. Converter PDF para Base64
                    const base64Data = await AIManager.fileToBase64(AIManager.selectedFile);
                    
                    btnAiFill.textContent = '🤖 Consultando Gemini...';
                    
                    // 2. Processar com IA (Roteamento e Fallback)
                    const data = await AIManager.processWithGemini(base64Data, options);
                    
                    btnAiFill.textContent = '📝 Preenchendo...';
                    
                    // 3. Preencher Front-end
                    AIManager.fillFields(data);
                    
                    alert('Preenchimento automático concluído com sucesso!');
                } catch (error) {
                    console.error(error);
                    alert('Erro: ' + error.message);
                    
                    // Se o erro for de autenticação, limpar a chave
                    if (error.message.includes('API key') || error.message.includes('403')) {
                        localStorage.removeItem('gemini_api_key');
                    }
                } finally {
                    btnAiFill.textContent = '✨ Preencher c/ IA';
                    btnAiFill.disabled = false;
                    fileInput.value = '';
                    AIManager.selectedFile = null;
                }
            });
        }
    },

    /**
     * Converte Arquivo para Base64 limpo (sem prefixo data URL)
     */
    fileToBase64: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remover o prefixo "data:application/pdf;base64," para enviar apenas os dados
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    },

    /**
     * Extrai texto puro de um arquivo PDF usando PDF.js (Legado/Fallback manual)
     * Mantido para compatibilidade com o editor de PDF manual
     */
    extractTextFromPDF: async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `--- PÁGINA ${i} ---\n${pageText}\n`;
        }

        return fullText;
    },

    /**
     * Envia o PDF (Base64) para o Gemini e pede um JSON estruturado
     */
    processWithGemini: async (base64Data, options = {}) => {
        const genAI = new GoogleGenerativeAI(AIManager.apiKey);
        
        // Construir instruções personalizadas
        let customInstructions = "";
        if (options.productName) customInstructions += `- Nome do Produto (Usar este): ${options.productName}\n`;
        if (options.proportion) customInstructions += `- Proporção de Mistura (Usar esta): ${options.proportion}\n`;
        if (options.related) customInstructions += `- Produtos Relacionados (Incluir estes): ${options.related}\n`;
        if (options.extra) customInstructions += `- Instruções Extras: ${options.extra}\n`;

        const systemInstruction = `
            Você é um analista técnico documentando produtos químicos. Leia o PDF de referência e gere os dados do novo produto estritamente no formato JSON solicitado.
            
            INSTRUÇÕES PRIORITÁRIAS DO USUÁRIO:
            ${customInstructions}
            
            Mapeamento de Campos (JSON Keys):
            - product_title: Apenas o nome do produto.
            - description: Descrição geral.
            - uses: Usos recomendados.
            - certifications: Certificações.
            - packaging: Tabela HTML com colunas: Componente, Conteúdo, Embalagem, Unidade.
            - characteristics: Lista de características formato "<strong>Chave:</strong> Valor<br>".
            - drying_repainting: Tabelas HTML de secagem e repintura.
            - surface_preparation: Instruções de preparação.
            - application_preparation: Instruções de mistura/diluição.
            - application_methods: Instruções de aplicação.
            - safety: Precauções de segurança.
            - notes: Notas gerais.

            Se não encontrar info, retorne string vazia.
        `;

        // Configuração de Saída JSON Estrito
        const generationConfig = {
            responseMimeType: "application/json"
        };

        // Lista de modelos para roteamento e fallback
        // Tentativa 1: Modelo rápido e barato (1.5 Flash)
        // Tentativa 2: Modelo mais capaz (2.0 Flash/Pro)
        const modelsToTry = [
            "gemini-1.5-flash", 
            "gemini-2.5-flash", 
            "gemini-1.5-pro"
        ];
        
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                console.log(`Tentando modelo: ${modelName}...`);
                const model = genAI.getGenerativeModel({ 
                    model: modelName,
                    generationConfig: generationConfig
                });
                
                // Se não for a primeira tentativa, esperar um pouco (Backoff)
                if (modelName !== modelsToTry[0]) {
                    console.log("Aguardando 2 segundos antes da próxima tentativa...");
                    await new Promise(r => setTimeout(r, 2000));
                }

                const result = await model.generateContent([
                    systemInstruction,
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: "application/pdf"
                        }
                    }
                ]);

                const response = await result.response;
                const textResponse = response.text();
                
                console.log(`Sucesso com modelo: ${modelName}`);
                return JSON.parse(textResponse);

            } catch (error) {
                console.warn(`Erro com modelo ${modelName}:`, error);
                lastError = error;
                // Continua para o próximo modelo no loop
            }
        }

        // Se chegou aqui, todos falharam
        throw new Error(`Falha ao processar PDF com todos os modelos. Último erro: ${lastError ? lastError.message : 'Desconhecido'}`);
    },

    /**
     * Preenche os campos no DOM com base no JSON retornado
     */
    fillFields: (data) => {
        Object.keys(data).forEach(key => {
            const elements = document.querySelectorAll(`[data-ai-field="${key}"]`);
            
            if (elements.length > 0) {
                const element = elements[0];
                
                if (data[key]) {
                    if (key === 'product_title') {
                        element.innerText = data[key];
                    } else {
                        element.innerHTML = data[key];
                    }
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });
    }
};

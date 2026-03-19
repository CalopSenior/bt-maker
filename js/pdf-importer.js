import { AIManager } from './ai-manager.js';

export const PDFImporter = {
    init: () => {
        // Criar botão na toolbar se não existir
        const actionsDiv = document.querySelector('.actions');
        
        // Verifica se já não foi criado manualmente ou automaticamente
        if (actionsDiv && !document.getElementById('btn-pdf-edit')) {
            const btn = document.createElement('button');
            btn.id = 'btn-pdf-edit';
            btn.className = 'secondary';
            btn.title = 'Importar PDF para Nova Guia e Editar';
            btn.style.backgroundColor = '#ff9800'; // Laranja para destacar
            btn.style.color = 'white';
            btn.innerHTML = '📄 PDF Editor';
            
            // Inserir antes do botão de exportar Word (que é geralmente o último ou penúltimo)
            const btnExport = document.getElementById('btn-export-word');
            if (btnExport) {
                actionsDiv.insertBefore(btn, btnExport);
            } else {
                actionsDiv.appendChild(btn);
            }

            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'file-input-pdf-edit';
            input.style.display = 'none';
            input.accept = '.pdf';
            actionsDiv.appendChild(input);

            btn.addEventListener('click', () => {
                // Tentar usar IA se disponível, mas não bloquear
                if (!localStorage.getItem('gemini_api_key')) {
                    const proceed = confirm('A IA não está configurada. O modo "PDF Editor" funcionará melhor com a IA para estruturar os dados.\n\nDeseja continuar no modo manual (apenas texto corrido)?');
                    if (!proceed) return;
                }
                input.click();
            });

            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                btn.textContent = '⏳ Processando...';
                btn.disabled = true;

                try {
                    let data = {};

                    // Tentar processar com IA se houver chave
                    if (localStorage.getItem('gemini_api_key')) {
                        try {
                            // Usar Base64 para a IA (nova engine mais robusta)
                            const base64 = await AIManager.fileToBase64(file);
                            data = await AIManager.processWithGemini(base64, { 
                                extra: "Reconstrua fielmente todos os dados deste PDF para edição." 
                            });
                        } catch (aiError) {
                            console.warn("Falha na IA, usando fallback manual:", aiError);
                            alert("A IA falhou ou está indisponível. Usando modo de recuperação manual (texto simples).");
                            
                            // Extrair texto puro para o fallback manual
                            const text = await AIManager.extractTextFromPDF(file);
                            data = PDFImporter.manualFallback(text);
                        }
                    } else {
                        // Modo manual direto (sem chave)
                        const text = await AIManager.extractTextFromPDF(file);
                        data = PDFImporter.manualFallback(text);
                    }

                    // Salvar dados temporariamente
                    const sessionId = 'pdf_edit_' + Date.now();
                    sessionStorage.setItem(sessionId, JSON.stringify(data));

                    // Abrir nova janela
                    const url = new URL(window.location.href);
                    url.searchParams.set('load_session', sessionId);
                    window.open(url.toString(), '_blank');

                } catch (err) {
                    console.error(err);
                    alert('Erro crítico ao processar PDF: ' + err.message);
                } finally {
                    btn.textContent = '📄 PDF Editor';
                    btn.disabled = false;
                    input.value = '';
                }
            });
        }
        
        // Verificar se esta janela foi aberta para edição
        PDFImporter.checkForPendingLoad();
    },

    /**
     * Fallback manual: Tenta mapear o texto para os campos usando regex simples ou joga tudo na descrição
     */
    manualFallback: (text) => {
        const data = {
            product_title: "Produto Importado (Manual)",
            description: "",
            uses: "",
            certifications: "",
            packaging: "",
            characteristics: "",
            drying_repainting: "",
            surface_preparation: "",
            application_preparation: "",
            application_methods: "",
            safety: "",
            notes: ""
        };

        // Tentar encontrar o título (primeira linha ou linha com caixa alta)
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length > 0) {
            data.product_title = lines[0].substring(0, 100); // Limite de segurança
        }

        // Jogar o resto do texto na descrição para não perder nada
        // Substituir quebras de linha por <br> para manter formato visual
        data.description = text.replace(/\n/g, '<br>');
        
        return data;
    },

    checkForPendingLoad: () => {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('load_session');

        if (sessionId) {
            const dataString = sessionStorage.getItem(sessionId);
            if (dataString) {
                try {
                    const data = JSON.parse(dataString);
                    console.log('Carregando dados da sessão:', sessionId);
                    
                    // Pequeno delay para garantir que o DOM e outros módulos estejam prontos
                    setTimeout(() => {
                        AIManager.fillFields(data);
                        
                        // Limpar URL
                        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                        window.history.replaceState({path: newUrl}, '', newUrl);
                        
                        // Notificar usuário
                        const notification = document.createElement('div');
                        notification.style.cssText = `
                            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                            background: #4caf50; color: white; padding: 15px 30px;
                            border-radius: 50px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                            z-index: 2000; font-weight: bold; animation: fadeInOut 4s forwards;
                        `;
                        notification.textContent = '✅ PDF Importado para Edição!';
                        document.body.appendChild(notification);
                        
                        // Adicionar style de animação se não existir
                        if (!document.getElementById('anim-style')) {
                            const style = document.createElement('style');
                            style.id = 'anim-style';
                            style.textContent = `
                                @keyframes fadeInOut {
                                    0% { opacity: 0; transform: translate(-50%, -20px); }
                                    10% { opacity: 1; transform: translate(-50%, 0); }
                                    80% { opacity: 1; transform: translate(-50%, 0); }
                                    100% { opacity: 0; transform: translate(-50%, -20px); }
                                }
                            `;
                            document.head.appendChild(style);
                        }
                        
                    }, 500);
                } catch (e) {
                    console.error('Erro ao carregar sessão:', e);
                }
            }
        }
    }
};

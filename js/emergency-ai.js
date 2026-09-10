import { IaToggle } from './ia-toggle.js';

export const EmergencyAI = {
    apiKey: null,
    selectedFiles: [],

    init() {
        // A ficha apresenta-se como preenchimento manual: o botão de IA só
        // aparece depois de __USE_IA__ = true ser escrito na consola.
        IaToggle.install(['#btn-emergency-ai']);

        const btnAI = document.getElementById('btn-emergency-ai');
        const fileInput = document.getElementById('file-input-emergency-pdf');
        const modal = document.getElementById('ai-modal-emergency');
        const btnAddFiles = document.getElementById('btn-add-emergency-files');
        const btnCancel = document.getElementById('btn-cancel-emergency-ai');
        const btnConfirm = document.getElementById('btn-confirm-emergency-ai');

        if (!btnAI) return;

        btnAI.addEventListener('click', () => {
            EmergencyAI.apiKey = localStorage.getItem('gemini_api_key');
            if (!EmergencyAI.apiKey) {
                const key = prompt('Por favor, insira sua chave de API do Google Gemini:');
                if (key) {
                    EmergencyAI.apiKey = key;
                    localStorage.setItem('gemini_api_key', key);
                } else return;
            }
            EmergencyAI.selectedFiles = [];
            EmergencyAI.renderFileList();
            modal.classList.add('active');
        });

        btnAddFiles?.addEventListener('click', () => fileInput.click());

        fileInput?.addEventListener('change', e => {
            const files = Array.from(e.target.files);
            const remaining = 5 - EmergencyAI.selectedFiles.length;
            EmergencyAI.selectedFiles.push(...files.slice(0, remaining));
            EmergencyAI.renderFileList();
            e.target.value = '';
        });

        btnCancel?.addEventListener('click', () => {
            modal.classList.remove('active');
            EmergencyAI.selectedFiles = [];
            EmergencyAI.renderFileList();
        });

        btnConfirm?.addEventListener('click', async () => {
            if (EmergencyAI.selectedFiles.length === 0) {
                alert('Adicione pelo menos um arquivo PDF.');
                return;
            }

            modal.classList.remove('active');

            const modelName = document.getElementById('em-ai-model-select')?.value
                || 'gemini-2.5-flash-preview-09-2025';
            const productName = document.getElementById('em-ai-product-name')?.value || '';
            const extraInstructions = document.getElementById('em-ai-extra-instructions')?.value || '';

            const btn = document.getElementById('btn-emergency-ai');
            btn.disabled = true;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<img src="assets/icon-ai.svg" class="btn-icon-svg btn-icon-invert" alt=""> A processar...';

            try {
                const base64List = await Promise.all(
                    EmergencyAI.selectedFiles.map(f => EmergencyAI.fileToBase64(f))
                );
                const data = await EmergencyAI.processWithGemini(base64List, { modelName, productName, extraInstructions });
                EmergencyAI.fillForm(data);
                alert('Preenchimento concluído com sucesso!');
            } catch (err) {
                console.error(err);
                alert('Erro na IA: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
                EmergencyAI.selectedFiles = [];
                EmergencyAI.renderFileList();
            }
        });
    },

    renderFileList() {
        const list = document.getElementById('em-file-list');
        if (!list) return;

        list.innerHTML = '';
        EmergencyAI.selectedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'em-file-item';

            const name = document.createElement('span');
            name.className = 'em-file-name';
            name.textContent = file.name;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'em-file-remove';
            removeBtn.title = 'Remover';
            removeBtn.innerHTML = '<img src="assets/icon-close.svg" class="btn-icon-svg" alt="×">';
            removeBtn.addEventListener('click', () => {
                EmergencyAI.selectedFiles.splice(index, 1);
                EmergencyAI.renderFileList();
            });

            item.appendChild(name);
            item.appendChild(removeBtn);
            list.appendChild(item);
        });

        const counter = document.getElementById('em-file-counter');
        if (counter) counter.textContent = `${EmergencyAI.selectedFiles.length}/5 arquivo(s)`;

        const btnAdd = document.getElementById('btn-add-emergency-files');
        if (btnAdd) btnAdd.disabled = EmergencyAI.selectedFiles.length >= 5;
    },

    fileToBase64: file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    }),

    processWithGemini: async (base64List, options) => {
        const delays = [1000, 2000, 4000, 8000, 16000];
        let lastError;
        for (let i = 0; i < 5; i++) {
            try {
                return await EmergencyAI.callGemini(base64List, options);
            } catch (err) {
                lastError = err;
                if (i < 4) await new Promise(r => setTimeout(r, delays[i]));
            }
        }
        throw new Error(`Falha após 5 tentativas. Último erro: ${lastError.message}`);
    },

    callGemini: async (base64List, options) => {
        const apiKey = EmergencyAI.apiKey || localStorage.getItem('gemini_api_key') || '';
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${options.modelName}:generateContent?key=${apiKey}`;

        const systemInstruction = `Você é especialista em segurança química e transporte de produtos perigosos.
Analise os PDFs fornecidos (FISPQ, fichas técnicas, laudos) e extraia informações para uma Ficha de Emergência de Transporte brasileira (ABNT NBR 7503).

Retorne SOMENTE um JSON válido com os campos abaixo. Use string vazia "" se a informação não existir.
Campos com "(HTML)" aceitam tags <strong> e <br>.

emergency_product_name: Nome comercial completo do produto
un_number: Número ONU (ex: "UN 1263")
risk_class: Classe de risco principal (ex: "3")
subsidiary_risk: Risco subsidiário (ex: "6.1" ou "")
packing_group: Grupo de embalagem (ex: "II" ou "III")
shipping_name: Nome de expedição ONU em português
manufacturer: Razão social e endereço completo do fabricante
manufacturer_emergency_phone: Telefone(s) de emergência 24h do fabricante
physical_state: Estado físico (Líquido / Sólido / Gasoso / Aerossol)
color_appearance: Cor e aspecto visual
odor: Descrição do odor
ph: Valor do pH ou "N/A"
flash_point: Ponto de inflamação com unidade (ex: "23 °C")
autoignition_temp: Temperatura de autoignição com unidade (ex: "400 °C")
vapor_pressure: Pressão de vapor com unidade (ex: "1,3 kPa a 20 °C")
density: Densidade com unidade (ex: "0,88 g/cm³")
lel: Limite inferior de explosividade (ex: "0,9 % v/v")
uel: Limite superior de explosividade (ex: "12,8 % v/v")
water_solubility: Solubilidade em água (Insolúvel / Parcial / Solúvel)
boiling_point: Ponto de ebulição com unidade (ex: "110–180 °C")
hazard_health: Nível de perigo à saúde GHS/NFPA (ex: "Nível 2" ou "H302")
hazard_fire: Nível de inflamabilidade GHS/NFPA (ex: "Nível 3")
hazard_reactivity: Nível de reatividade GHS/NFPA (ex: "Nível 0")
hazard_env: Perigo ambiental (ex: "Categoria 2" ou "N/A")
health_inhalation: Efeitos e sintomas por inalação
health_skin: Efeitos e sintomas por contato com pele
health_eyes: Efeitos e sintomas por contato com olhos
health_ingestion: Efeitos e sintomas por ingestão
fire_risks: (HTML) Riscos de incêndio e explosão com comportamento, produtos de combustão e risco de explosão
env_risks: (HTML) Riscos ao meio ambiente com toxicidade aquática, persistência e impacto em vazamento
firstaid_inhalation: Primeiros socorros para inalação
firstaid_skin: Primeiros socorros para pele
firstaid_eyes: Primeiros socorros para olhos
firstaid_ingestion: Primeiros socorros para ingestão
fire_fighting: (HTML) Procedimentos de combate a incêndio com agentes adequados, inadequados e EPI necessário
spill_response: (HTML) Procedimentos em caso de derramamento ou vazamento
ppe_gloves: Especificação das luvas de proteção com norma
ppe_respiratory: Especificação do protetor respiratório com norma
ppe_eye: Especificação da proteção ocular com norma
ppe_body: Especificação da proteção corporal com norma
ppe_footwear: Especificação do calçado de proteção
transport_road_un: UN e classe para rodoviário (ex: "UN 1263 — Cl. 3")
transport_road_pg: Grupo de embalagem rodoviário
transport_sea_un: UN e classe para marítimo
transport_sea_pg: Grupo de embalagem marítimo
transport_air_un: UN e classe para aéreo
transport_air_pg: Grupo de embalagem aéreo
transport_rail_un: UN e classe para ferroviário
transport_rail_pg: Grupo de embalagem ferroviário
storage_handling: (HTML) Condições de armazenamento, temperatura, incompatíveis e validade
emergency_notes: (HTML) Notas adicionais e referência à FISPQ
responsible_role: Cargo do responsável técnico

${options.extraInstructions ? `INSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${options.extraInstructions}\n` : ''}${options.productName ? `NOME DO PRODUTO DEFINIDO PELO USUÁRIO: ${options.productName}\n` : ''}`;

        const parts = [
            { text: systemInstruction },
            ...base64List.map(data => ({ inlineData: { mimeType: 'application/pdf', data } }))
        ];

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { responseMimeType: 'application/json' }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || `HTTP ${response.status}`);
        }

        const result = await response.json();
        return JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text);
    },

    fillForm(data) {
        if (!data) return;

        Object.entries(data).forEach(([field, value]) => {
            if (value === '' || value == null) return;

            const el = document.querySelector(`[data-ai-field="${field}"]`);
            if (!el) return;

            if (field.startsWith('hazard_')) {
                const levelEl = el.querySelector('.hazard-level');
                if (levelEl) levelEl.textContent = String(value);
                return;
            }

            el.innerHTML = String(value);
        });
    }
};

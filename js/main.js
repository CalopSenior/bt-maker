import { Editor } from './editor.js';
import { Exporter } from './exporter.js';
import { Storage } from './storage.js';
import { LogoManager } from './logo-manager.js';
import { AIManager } from './ai-manager.js';
import { PDFImporter } from './pdf-importer.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // Inicializar o Editor (toolbar, eventos)
    Editor.init();
    
    // Inicializar gerenciamento de logos
    LogoManager.init();
    
    // Inicializar integração com IA (Gemini)
    AIManager.init();
    
    // Inicializar importação avançada de PDF para nova guia
    PDFImporter.init();

    // Botão Exportar Word
    const btnExport = document.getElementById('btn-export-word');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            Exporter.exportToWord();
        });
    }

    // Botão Salvar Projeto (JSON)
    const btnSave = document.getElementById('btn-save-project');
    if (btnSave) {
        btnSave.addEventListener('click', () => {
            Storage.saveProject();
        });
    }

    // Botão Carregar Projeto
    const btnLoad = document.getElementById('btn-load-project');
    const fileInput = document.getElementById('file-input');
    
    if (btnLoad && fileInput) {
        btnLoad.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.name.endsWith('.json')) {
                Storage.loadProject(file)
                    .then(() => alert('Projeto carregado com sucesso!'))
                    .catch(err => alert('Erro ao carregar projeto: ' + err.message));
            } else if (file.name.endsWith('.doc') || file.name.endsWith('.html')) {
                Storage.importDoc(file)
                    .then(() => alert('Arquivo importado com sucesso!'))
                    .catch(err => alert('Erro ao importar arquivo: ' + err.message));
            } else {
                alert('Formato de arquivo não suportado. Use .json ou .doc');
            }
            
            // Limpar o input
            e.target.value = '';
        });
    }

    // Botão Importar Apenas Texto
    const btnImportText = document.getElementById('btn-import-text');
    const fileInputText = document.getElementById('file-input-text');
    
    if (btnImportText && fileInputText) {
        btnImportText.addEventListener('click', () => {
            fileInputText.click();
        });

        fileInputText.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.name.endsWith('.doc') || file.name.endsWith('.html')) {
                Storage.importTextOnly(file)
                    .then(() => alert('Texto importado com sucesso!'))
                    .catch(err => alert('Erro ao importar texto: ' + err.message));
            } else {
                alert('Formato de arquivo não suportado. Use .doc ou .html');
            }
            
            // Limpar o input
            e.target.value = '';
        });
    }

    // Botão Adicionar Página
    const btnAddPage = document.getElementById('btn-add-page');
    if (btnAddPage) {
        btnAddPage.addEventListener('click', () => {
            Editor.addPage();
        });
    }

    // Botão Remover Página
    const btnRemovePage = document.getElementById('btn-remove-page');
    if (btnRemovePage) {
        btnRemovePage.addEventListener('click', () => {
            Editor.removeLastPage();
        });
    }
});

/**
 * Módulo de Edição (Editor)
 * Responsável pelas funcionalidades de edição de texto e manipulação de páginas.
 */

export const Editor = {
    init: () => {
        // Inicializar listeners para a toolbar
        const toolbarButtons = document.querySelectorAll('.toolbar button');
        toolbarButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const command = btn.dataset.command;
                const value = btn.dataset.value || null;
                
                if (command === 'createLink') {
                    const url = prompt('Insira a URL:', 'http://');
                    if (url) document.execCommand(command, false, url);
                } else if (command === 'formatBlock') {
                    document.execCommand(command, false, value);
                } else {
                    document.execCommand(command, false, value);
                }
                
                // Atualizar estado visual do botão
                Editor.updateToolbarState();
            });
        });

        // Listener para o seletor de tamanho de fonte
        const fontSizeSelector = document.getElementById('font-size-selector');
        if (fontSizeSelector) {
            fontSizeSelector.addEventListener('change', (e) => {
                e.preventDefault();
                const size = e.target.value;
                if (size) {
                    document.execCommand('fontSize', false, size);
                    // Voltar para a opção padrão visualmente para permitir selecionar o mesmo tamanho novamente se necessário em outro texto
                    e.target.value = "";
                }
            });
        }

        // Listener Global de Paste (Colar)
        document.addEventListener('paste', (e) => {
            // Verificar se o alvo é editável
            if (e.target.isContentEditable || e.target.closest('[contenteditable]')) {
                e.preventDefault();
                
                // Obter texto puro
                const text = (e.clipboardData || window.clipboardData).getData('text/plain');
                
                // Inserir texto puro (remove formatação original)
                // O navegador usará o estilo atual do ponto de inserção
                if (document.queryCommandSupported('insertText')) {
                    document.execCommand('insertText', false, text);
                } else {
                    // Fallback para navegadores antigos
                    const selection = window.getSelection();
                    if (!selection.rangeCount) return;
                    selection.deleteFromDocument();
                    selection.getRangeAt(0).insertNode(document.createTextNode(text));
                    selection.collapseToEnd();
                }
            }
        });

        // Atualizar estado da toolbar ao selecionar texto
        document.addEventListener('selectionchange', Editor.updateToolbarState);
    },

    updateToolbarState: () => {
        const buttons = document.querySelectorAll('.toolbar button');
        buttons.forEach(btn => {
            const command = btn.dataset.command;
            if (document.queryCommandState(command)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    },

    addPage: () => {
        const pages = document.querySelectorAll('.page');
        const lastPage = pages[pages.length - 1];
        
        const newPage = document.createElement('div');
        newPage.className = 'page';
        newPage.id = `page${pages.length + 1}`;
        
        // Copiar header da página 1 (agora inclui o logo absoluto)
        const header = document.querySelector('#page1 .header').cloneNode(true);
        newPage.appendChild(header);

        // Importante: O logo está dentro do header ou fora?
        // Se estiver dentro, ele foi clonado. Mas precisamos garantir que ele seja interativo.
        // O MutationObserver no LogoManager vai cuidar disso.
        
        // Clonar o logo também se ele estiver fora do header (na raiz da page)
        // No HTML atual ele está dentro do header.
        // Se estiver fora:
        const logo = document.querySelector('#page1 > .logo');
        if (logo) {
            const newLogo = logo.cloneNode(true);
            newPage.appendChild(newLogo);
        } else {
             // Se estiver dentro do header, precisamos encontrá-lo lá
             // e talvez movê-lo se decidirmos que logo é filho direto da page
             // Por enquanto, o CSS logo.css assume position absolute, 
             // então mesmo dentro do header ele se comporta como filho da page (se header não for relative)
             // O header NÃO tem position: relative no style.css, então ok.
        }
        
        const content = document.createElement('div');
        content.className = 'editable';
        content.contentEditable = true;
        content.innerHTML = '<div class="section-title">NOVA SEÇÃO</div><p>Comece a digitar aqui...</p>';
        newPage.appendChild(content);

        document.getElementById('pages-container').appendChild(newPage);
        
        newPage.scrollIntoView({ behavior: 'smooth' });
    },

    removeLastPage: () => {
        const pages = document.querySelectorAll('.page');
        if (pages.length > 1) {
            if (confirm('Tem certeza que deseja remover a última página?')) {
                pages[pages.length - 1].remove();
            }
        } else {
            alert('Não é possível remover a única página.');
        }
    }
};

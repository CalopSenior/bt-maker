/**
 * Módulo de Armazenamento e Recuperação (Storage)
 * Responsável por salvar/carregar projetos e importar arquivos legados.
 */

export const Storage = {
    /**
     * Salva o estado atual do projeto em um arquivo JSON.
     */
    saveProject: () => {
        const pages = document.querySelectorAll('.page');
        const pageData = Array.from(pages).map(page => page.innerHTML);
        
        const projectData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            pages: pageData
        };

        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `projeto_bt_maker_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Carrega um projeto a partir de um arquivo JSON.
     * @param {File} file - O arquivo JSON selecionado pelo usuário.
     */
    loadProject: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.pages && Array.isArray(data.pages)) {
                        Storage.renderPages(data.pages);
                        resolve(true);
                    } else {
                        reject(new Error('Formato de arquivo inválido.'));
                    }
                } catch (err) {
                    reject(new Error('Erro ao ler o arquivo JSON.'));
                }
            };
            
            reader.onerror = () => reject(new Error('Erro na leitura do arquivo.'));
            reader.readAsText(file);
        });
    },

    /**
     * Importa um arquivo .doc (HTML) gerado anteriormente por este sistema.
     * @param {File} file - O arquivo .doc selecionado.
     */
    importDoc: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(e.target.result, 'text/html');
                    
                    // O arquivo .doc gerado anteriormente contém divs com a classe .page
                    // No entanto, o Word pode ter alterado a estrutura.
                    // Vamos tentar encontrar elementos que pareçam páginas.
                    
                    // Estratégia 1: Buscar pela classe .page (se o arquivo não foi muito alterado pelo Word)
                    let pages = doc.querySelectorAll('.page');
                    
                    // Estratégia 2: Se não achar .page, tentar inferir pelo conteúdo ou estrutura
                    if (pages.length === 0) {
                        // Se o Word converteu, pode ser que as divs .page tenham perdido a classe
                        // ou sido transformadas. Esta é uma tentativa de "best effort".
                        // Por enquanto, vamos assumir que o arquivo é um HTML salvo diretamente ou pouco modificado.
                        
                        // Tentar pegar o body direto se não houver pages
                        if (doc.body.innerHTML.trim().length > 0) {
                             // Se não tem estrutura de página definida, criamos uma página única com o conteúdo
                             Storage.renderPages([doc.body.innerHTML]);
                             resolve(true);
                             return;
                        }
                    }

                    if (pages.length > 0) {
                        const pageData = Array.from(pages).map(p => p.innerHTML);
                        Storage.renderPages(pageData);
                        resolve(true);
                    } else {
                        reject(new Error('Não foi possível identificar as páginas no arquivo.'));
                    }
                } catch (err) {
                    console.error(err);
                    reject(new Error('Erro ao processar o arquivo.'));
                }
            };
            
            reader.onerror = () => reject(new Error('Erro na leitura do arquivo.'));
            reader.readAsText(file); // Ler como texto, pois o .doc gerado é HTML falso
        });
    },

    /**
     * Renderiza as páginas na tela.
     * @param {Array} pagesContent - Array de strings HTML.
     */
    renderPages: (pagesContent) => {
        // Encontrar o container das páginas
        const container = document.getElementById('pages-container');
        if (!container) {
            console.error('Container de páginas não encontrado!');
            return;
        }
        
        // Limpar container
        container.innerHTML = '';

        pagesContent.forEach((content, index) => {
            const div = document.createElement('div');
            div.className = 'page';
            div.id = `page${index + 1}`;
            div.innerHTML = content;
            
            // Garantir que áreas editáveis continuem editáveis
            div.querySelectorAll('.editable').forEach(el => {
                el.setAttribute('contenteditable', 'true');
            });

            container.appendChild(div);
        });

        console.log(`${pagesContent.length} páginas renderizadas.`);
    },

    /**
     * Importa apenas o conteúdo (texto/tabelas) de um arquivo .doc, mantendo o cabeçalho original das páginas atuais.
     * Tenta identificar quebras de página do Word para distribuir o conteúdo corretamente.
     * @param {File} file - O arquivo .doc selecionado.
     */
    importTextOnly: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const parser = new DOMParser();
                    // O arquivo do Word é HTML, mas cheio de lixo. Vamos limpar.
                    const doc = parser.parseFromString(e.target.result, 'text/html');
                    
                    // Remover scripts, estilos e metadados do Word
                    doc.querySelectorAll('script, style, meta, link, title, xml').forEach(el => el.remove());
                    
                    // Identificar o corpo do conteúdo
                    // O Word geralmente coloca tudo em div.WordSection1
                    let contentContainer = doc.querySelector('div[class*="WordSection"]');
                    if (!contentContainer) {
                        contentContainer = doc.body;
                    }

                    if (!contentContainer || contentContainer.innerHTML.trim().length === 0) {
                        reject(new Error('Nenhum conteúdo encontrado no arquivo.'));
                        return;
                    }

                    // Identificar quebras de página do Word
                    // O Word usa <br clear=all style='page-break-before:always'>
                    // ou <span style='...page-break-before:always...'>
                    
                    const children = Array.from(contentContainer.children);
                    const pagesContent = [];
                    let currentPageContent = [];

                    children.forEach(child => {
                        // Verificar se é uma quebra de página
                        let isPageBreak = false;
                        
                        // Check style attribute for page-break-before: always
                        const style = child.getAttribute('style');
                        if (style && style.includes('page-break-before') && style.includes('always')) {
                            isPageBreak = true;
                        }
                        
                        // Check for <br> with page break inside the element if it's not the element itself
                        if (!isPageBreak && child.querySelector('[style*="page-break-before"][style*="always"]')) {
                             // Se a quebra está dentro, talvez devêssemos dividir o conteúdo?
                             // Por simplicidade, vamos considerar que a quebra inicia uma nova página
                             isPageBreak = true; 
                        }

                        if (isPageBreak) {
                            if (currentPageContent.length > 0) {
                                pagesContent.push(currentPageContent);
                            }
                            currentPageContent = [];
                            // Se o elemento for apenas a quebra, não adicionamos. Se tiver conteúdo, adicionamos.
                            if (child.textContent.trim().length > 0 && child.tagName !== 'BR') {
                                currentPageContent.push(child);
                            }
                        } else {
                            // Ignorar elementos vazios irrelevantes
                            if (child.tagName !== 'META' && child.tagName !== 'LINK') {
                                currentPageContent.push(child);
                            }
                        }
                    });
                    
                    // Adicionar o último lote
                    if (currentPageContent.length > 0) {
                        pagesContent.push(currentPageContent);
                    }

                    // Se não detectou quebras de página explícitas, mas temos conteúdo,
                    // talvez o arquivo não tenha quebras ou seja uma única página.
                    // Vamos tentar ver se existem divs com classe .page (do nosso sistema antigo)
                    if (pagesContent.length <= 1) {
                         const legacyPages = doc.querySelectorAll('.page');
                         if (legacyPages.length > 0) {
                             // Resetar e usar as páginas legadas
                             pagesContent.length = 0;
                             legacyPages.forEach(p => {
                                 // Extrair filhos da página, ignorando header se existir
                                 const pageChildren = Array.from(p.children).filter(c => !c.classList.contains('header'));
                                 pagesContent.push(pageChildren);
                             });
                         }
                    }

                    // Agora distribuir nas páginas atuais
                    const currentContainer = document.getElementById('pages-container');
                    let currentPages = Array.from(currentContainer.querySelectorAll('.page'));
                    
                    if (currentPages.length === 0) {
                        reject(new Error('Não há páginas no projeto atual.'));
                        return;
                    }

                    pagesContent.forEach((contentNodes, index) => {
                        let targetPage = currentPages[index];
                        
                        // Criar nova página se necessário
                        if (!targetPage) {
                            const template = currentPages[0].cloneNode(true);
                            template.id = `page${index + 1}`;
                            
                            // Manter apenas o header
                            const header = template.querySelector('.header');
                            template.innerHTML = '';
                            if (header) template.appendChild(header);
                            
                            currentContainer.appendChild(template);
                            targetPage = template;
                            currentPages.push(targetPage);
                        }

                        // Limpar miolo da página alvo (preservando header)
                        Array.from(targetPage.children).forEach(child => {
                            if (!child.classList.contains('header')) {
                                child.remove();
                            }
                        });

                        // Inserir conteúdo limpo
                        contentNodes.forEach(node => {
                            const importedNode = node.cloneNode(true);
                            
                            // Limpeza profunda de atributos do Word
                            cleanWordAttributes(importedNode);
                            
                            // Tornar editável e adicionar classe para estilo
                            // Aplicar recursivamente para garantir
                            makeEditable(importedNode);

                            targetPage.appendChild(importedNode);
                        });
                    });

                    resolve(true);

                } catch (err) {
                    console.error(err);
                    reject(new Error('Erro ao processar a importação: ' + err.message));
                }
            };
            
            reader.onerror = () => reject(new Error('Erro na leitura do arquivo.'));
            reader.readAsText(file);
        });
    }
};

/**
 * Remove atributos e classes específicos do Word que quebram o layout.
 */
function cleanWordAttributes(element) {
    if (element.removeAttribute) {
        element.removeAttribute('lang');
        // Remover classes Mso...
        if (element.className && typeof element.className === 'string') {
             const classes = element.className.split(' ').filter(c => !c.startsWith('Mso') && !c.startsWith('WordSection'));
             if (classes.length > 0) element.className = classes.join(' ');
             else element.removeAttribute('class');
        }
        // Remover estilos inline que fixam largura ou fontes estranhas
        // Mas manter negrito/cor se possível? O Word usa estilos complexos.
        // Vamos ser agressivos: remover style para usar o CSS da página, 
        // a menos que seja text-align ou font-weight.
        const style = element.getAttribute('style');
        if (style) {
            let newStyle = '';
            if (style.includes('text-align')) {
                const match = style.match(/text-align:\s*([a-z]+)/);
                if (match) newStyle += `text-align: ${match[1]}; `;
            }
            if (style.includes('font-weight: bold') || style.includes('font-weight: 700')) {
                newStyle += 'font-weight: bold; ';
            }
            // Manter cores?
            // if (style.includes('color')) ...
            
            if (newStyle) element.setAttribute('style', newStyle);
            else element.removeAttribute('style');
        }
    }
    
    if (element.childNodes) {
        element.childNodes.forEach(child => cleanWordAttributes(child));
    }
}

/**
 * Adiciona contenteditable e classe editable.
 */
function makeEditable(element) {
    if (element.setAttribute) {
        // Não aplicar em imagens ou elementos de estrutura pura se não quisermos
        // Mas para edição livre, quase tudo deve ser editável.
        // Exceto tabelas: a tabela em si não é editável, as células sim?
        // O navegador lida bem com table contenteditable.
        
        // Evitar aninhamento desnecessário de contenteditable
        // Se o pai já é editável, o filho não precisa ser explicitamente, mas ajuda na UI.
        
        // Se for um elemento de bloco (div, p, table, h1...), marcamos como editável
        const tagName = element.tagName.toLowerCase();
        if (['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'span'].includes(tagName)) {
             element.setAttribute('contenteditable', 'true');
             element.classList.add('editable');
        }
    }
    
    // Se tiver filhos, verificar se precisa aplicar neles ou se o pai basta.
    // Para tabelas, é importante que as células sejam editáveis.
    if (element.children) {
        Array.from(element.children).forEach(child => makeEditable(child));
    }
}

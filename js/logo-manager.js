/**
 * Módulo de Gerenciamento do Logo (LogoManager)
 * Responsável por permitir arrastar e redimensionar o logo,
 * sincronizando as alterações entre todas as páginas.
 */

export const LogoManager = {
    init: () => {
        // Inicializar logos existentes
        const logos = document.querySelectorAll('.logo');
        logos.forEach(logo => LogoManager.makeInteractive(logo));

        // Observer para novos logos (quando adicionar página)
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach(node => {
                        if (node.classList && node.classList.contains('page')) {
                            const newLogo = node.querySelector('.logo');
                            if (newLogo) LogoManager.makeInteractive(newLogo);
                            
                            // Sincronizar o novo logo com o estado atual (do primeiro logo)
                            const firstLogo = document.querySelector('.logo');
                            if (firstLogo && newLogo !== firstLogo) {
                                LogoManager.syncStyles(firstLogo, newLogo);
                            }
                        }
                    });
                }
            });
        });

        const container = document.getElementById('pages-container');
        if (container) {
            observer.observe(container, { childList: true });
        }
    },

    makeInteractive: (logoElement) => {
        let isDragging = false;
        let startX, startY, startTop, startLeft;

        // --- ARRASTAR (DRAG) ---
        logoElement.addEventListener('mousedown', (e) => {
            // Se clicar no canto inferior direito (resize handle), não iniciar drag
            // O handle nativo do browser tem cerca de 15x15px
            const rect = logoElement.getBoundingClientRect();
            if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) {
                return; // Deixar o browser lidar com o resize
            }

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // Obter posição atual relativa ao pai (.page)
            // .page deve ter position: relative
            startTop = logoElement.offsetTop;
            startLeft = logoElement.offsetLeft;

            logoElement.style.cursor = 'grabbing';
            e.preventDefault(); // Evitar seleção de texto
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            logoElement.style.top = `${startTop + dy}px`;
            logoElement.style.left = `${startLeft + dx}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                logoElement.style.cursor = 'move';
                // Sincronizar ao soltar
                LogoManager.syncAllLogos(logoElement);
            }
        });

        // --- REDIMENSIONAR (RESIZE) ---
        // Usamos ResizeObserver para detectar mudanças de tamanho (via CSS resize handle)
        const resizeObserver = new ResizeObserver(() => {
            // Debounce ou check se é o elemento ativo
            // Para evitar loop infinito de sincronização, verificamos se este elemento está sendo manipulado
            // Mas como ResizeObserver dispara sempre, vamos apenas sincronizar se houver mudança real
            // E evitar que A atualize B e B atualize A infinitamente.
            
            // Estratégia simples: Sincronizar apenas se o mouse estiver sobre este elemento (usuário interagindo)
            if (logoElement.matches(':hover') || logoElement.matches(':active')) {
                LogoManager.syncAllLogos(logoElement);
            }
        });
        
        resizeObserver.observe(logoElement);
    },

    /**
     * Aplica o estilo de um logo fonte para todos os outros logos.
     */
    syncAllLogos: (sourceLogo) => {
        const allLogos = document.querySelectorAll('.logo');
        
        // Obter propriedades computadas ou inline
        const width = sourceLogo.style.width;
        const height = sourceLogo.style.height;
        const top = sourceLogo.style.top;
        const left = sourceLogo.style.left;

        allLogos.forEach(targetLogo => {
            if (targetLogo !== sourceLogo) {
                // Copiar estilos
                if (width) targetLogo.style.width = width;
                if (height) targetLogo.style.height = height;
                if (top) targetLogo.style.top = top;
                if (left) targetLogo.style.left = left;
            }
        });
    },

    /**
     * Copia estilos de um logo para outro específico (útil ao criar nova página)
     */
    syncStyles: (source, target) => {
        target.style.width = source.style.width;
        target.style.height = source.style.height;
        target.style.top = source.style.top;
        target.style.left = source.style.left;
    }
};

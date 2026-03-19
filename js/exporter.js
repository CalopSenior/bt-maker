/**
 * Módulo de Exportação (Exporter)
 * Responsável por gerar o arquivo .doc (Word) a partir das páginas atuais.
 */

export const Exporter = {
    exportToWord: () => {
        // Obter todas as páginas
        const pages = document.querySelectorAll('.page');
        let content = '';

        pages.forEach((page, index) => {
            // Clonar a página para não alterar a tela original
            let clone = page.cloneNode(true);
            
            // Remover atributos que não são necessários no Word
            let editables = clone.querySelectorAll('[contenteditable]');
            editables.forEach(el => el.removeAttribute('contenteditable'));

            // Remover classes e estilos que podem atrapalhar no Word
            // Mas manter classes de estrutura
            
            content += clone.innerHTML;
            
            // Adicionar quebra de página se não for a última página
            if (index < pages.length - 1) {
                content += '<br clear="all" style="page-break-before:always" />';
            }
        });

        // Preparar o HTML com estilos baseados em tags para melhor compatibilidade com o MS Word
        // Nota: O Word usa XML namespaces.
        const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Boletim Técnico</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; }
                th, td { border: 1px solid #ccc; padding: 6px; text-align: left; font-size: 12px; }
                th { background-color: #f9f9f9; font-weight: bold; }
                .section-title { background-color: #f0f0f0; padding: 5px 10px; font-weight: bold; text-transform: uppercase; font-size: 13px; border-left: 5px solid #f26522; margin-top: 20px; margin-bottom: 10px; color: #333; }
                .product-title { text-align: center; font-size: 22px; font-weight: bold; margin: 20px 0; }
                .company-info { text-align: right; font-size: 10px; color: #555; line-height: 1.3; }
                .header { border-bottom: 2px solid #2b579a; padding-bottom: 15px; margin-bottom: 20px; }
                .logo img { height: 50px; }
            </style>
        </head><body>`;
        
        const postHtml = "</body></html>";
        const html = preHtml + content + postHtml;

        // Criar um Blob com o conteúdo da página com o tipo mime para word
        const blob = new Blob(['\ufeff', html], {
            type: 'application/msword'
        });
        
        // Nome do arquivo
        const filename = `BT_NOXSEAL_${new Date().toISOString().slice(0,10)}.doc`;
        
        // Criar link de download
        const url = URL.createObjectURL(blob); // Usar URL.createObjectURL é mais moderno e limpo
        const downloadLink = document.createElement("a");
        
        document.body.appendChild(downloadLink);
        
        // Navegadores modernos
        if(navigator.msSaveOrOpenBlob){
            navigator.msSaveOrOpenBlob(blob, filename);
        } else {
            downloadLink.href = url;
            downloadLink.download = filename;
            downloadLink.click();
        }
        
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    }
};

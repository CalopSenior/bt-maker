# Gerador de Boletim Técnico - NOX Cor

Este projeto é uma ferramenta web para criar, editar e exportar Boletins Técnicos.

## Funcionalidades

- **Edição Rica**: Formatação de texto (negrito, itálico, listas, alinhamento).
- **Gerenciamento de Páginas**: Adicionar e remover páginas dinamicamente.
- **Salvar/Carregar Projeto**: Salve seu trabalho em um arquivo `.json` para continuar depois.
- **Importar Legado**: Importe arquivos `.doc` (HTML) gerados anteriormente.
- **Exportar**:
  - **PDF**: Use a função de impressão do navegador.
  - **Word**: Exporte para `.doc` compatível com Microsoft Word.

## Estrutura do Projeto

- `index.html`: Estrutura principal.
- `css/style.css`: Estilos da aplicação e da folha A4.
- `js/`:
  - `main.js`: Ponto de entrada e gerenciamento de eventos.
  - `editor.js`: Lógica de edição de texto e manipulação de páginas.
  - `storage.js`: Lógica de salvar/carregar arquivos.
  - `exporter.js`: Lógica de exportação para Word.

## Como Usar

Como o projeto utiliza Módulos ES6 (`import`/`export`), **você precisa rodar um servidor local** para evitar erros de CORS (Cross-Origin Resource Sharing) ao abrir o arquivo diretamente no navegador.

### Opções para rodar:

1. **VS Code (Recomendado)**:
   - Instale a extensão "Live Server".
   - Clique com o botão direito no `index.html` e selecione "Open with Live Server".

2. **Python**:
   - Abra o terminal na pasta do projeto.
   - Execute: `python -m http.server`
   - Acesse `http://localhost:8000` no navegador.

3. **Node.js**:
   - Execute: `npx serve .`

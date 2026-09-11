# Gerador de Documentos Técnicos - NOX Cor

Este projeto é uma ferramenta web para criar, editar e exportar os documentos
técnicos da NOX Cor. São três documentos, com a mesma forma de trabalhar:

| Documento | Página | Descrição |
| --- | --- | --- |
| Boletim Técnico | `index.html` | Ficha técnica do produto (tinta, thinner, etc.). |
| Ficha de Emergência | `ficha-emergencia.html` | Ficha de emergência de transporte. |
| **FDS** | `fds.html` | Ficha de Dados de Segurança (ABNT NBR 14725:2023). |

## Funcionalidades

- **Edição Rica**: Formatação de texto (negrito, itálico, sublinhado, listas).
- **Edição Directa nas Divs**: Todo o documento é editável na própria folha A4.
- **Montagem do Modelo**: Escolha quais campos/seções existem, em que ordem,
  crie campos personalizados e guarde a estrutura como modelo reutilizável.
- **Paginação Automática**: As folhas A4 são recalculadas a cada alteração.
- **Salvar/Carregar Projeto**: Salve seu trabalho em um arquivo `.json`.
- **Importar PDF sem IA**: Leia um documento em PDF e preencha os campos por
  reconhecimento de títulos (pdf.js + regex).
- **Extração por IA (opcional e oculta)**: escreva `__USE_IA__ = true` na consola
  do navegador para revelar os botões de IA.
- **Exportar PDF**: Gerado por API (html2canvas + jsPDF), idêntico ao que está na
  tela e com camada de texto pesquisável.

## Gerador de FDS (`fds.html`)

A FDS segue o mesmo layout de arquivo do projeto `fds-maker` — cabeçalho azul
"FDS / FICHA DE DADOS DE SEGURANÇA", faixa da norma, as 16 seções da ABNT NBR
14725:2023 e rodapé "PÁGINA x/y" — com a usabilidade do bt-maker:

- Documento novo já nasce com o esqueleto das 16 seções (subtítulos numerados e
  tabela de composição).
- A tabela **16.1. Legendas e abreviaturas** fecha sempre o documento, como no
  `fds-maker`. É um bloco próprio — fica fora da numeração das seções, mas pode
  ser editado, movido ou removido como qualquer outro; e é reposto ao importar
  um PDF, gerar por IA ou abrir dados vindos do `fds-maker`.
- Cada seção tem controlos ao passar o rato: **✂** força uma quebra de página
  antes dela, **▲ ▼** reordenam e **✕** remove. A numeração das seções e dos
  subtítulos é recalculada sozinha.
- **Seções do Modelo** monta a ficha à medida (predefinições, seções
  personalizadas e modelos guardados no navegador).
- **GHS** insere pictogramas no ponto do cursor; nos textos importados ou gerados
  por IA também funciona a notação curta `{alt+2}`, `{*negrito*}`, `{_itálico_}`,
  `{~sublinhado~}` e `{\n}`.
- **+ Linha** acrescenta uma linha à tabela onde está o cursor.
- **Importar PDF** reconhece as 16 seções por número e título, mesmo quando o
  fornecedor as escreve de outra maneira.
- **Abrir** aceita os projectos guardados aqui e também os dados de uma FDS
  gerada no `fds-maker` (objecto com as chaves `section1_identificacao`, ...).

## Estrutura do Projeto

- `index.html`, `ficha-emergencia.html`, `fds.html`: as três páginas.
- `css/`:
  - `style.css`: estilos da aplicação e da folha A4.
  - `editor.css`: controlos de edição manual dos campos.
  - `modal.css`, `logo.css`, `ficha-emergencia.css`, `fds.css`: estilos por documento.
- `js/` (boletim técnico):
  - `main.js`: ponto de entrada e gestão de eventos.
  - `page-builder.js`: montagem e paginação das folhas.
  - `field-manager.js`: edição manual dos campos.
  - `bt-importer.js`: importação de boletins em PDF, sem IA.
  - `ai-manager.js`: extração por IA (oculta).
- `js/` (FDS):
  - `fds-main.js`: ponto de entrada da ficha de dados de segurança.
  - `fds-schema.js`: as 16 seções, os seus esqueletos e a notação GHS.
  - `fds-builder.js`: montagem, paginação e numeração das folhas.
  - `fds-fields.js`: seções do documento, reordenação e modelos guardados.
  - `fds-importer.js`: importação de FDS em PDF, sem IA.
  - `fds-ai.js`: extração por IA (oculta).
- `js/` (comum):
  - `pdf-export.js`: exportação para PDF por API.
  - `template-store.js`: modelos guardados no IndexedDB.
  - `ia-toggle.js`: interruptor oculto dos recursos de IA.

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

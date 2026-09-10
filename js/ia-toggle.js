/**
 * Interruptor oculto da extração por IA.
 *
 * Por omissão o editor apresenta-se como 100% manual: os controlos de IA ficam
 * escondidos e nada na interface os anuncia. Quem souber do recurso activa-o
 * escrevendo na consola do navegador:
 *
 *     __USE_IA__ = true
 *
 * A activação é feita por um setter em `window`, por isso tem efeito imediato,
 * sem sondagens nem necessidade de recarregar. É deliberadamente válida apenas
 * para a sessão actual: ao recarregar a página, o editor volta a parecer
 * inteiramente manual.
 */

const hidden = [];
let enabled = false;

export const IaToggle = {
    /**
     * Regista os elementos a esconder e instala o interruptor global.
     * @param {string[]} selectors Selectores dos controlos de IA.
     */
    install(selectors) {
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.hidden = true;
                hidden.push(el);
            });
        });

        if (Object.getOwnPropertyDescriptor(window, "__USE_IA__")) return;

        Object.defineProperty(window, "__USE_IA__", {
            configurable: true,
            get: () => enabled,
            set: value => {
                enabled = !!value;
                hidden.forEach(el => {
                    el.hidden = !enabled;
                });
                console.info(
                    enabled
                        ? "Extração por IA activada nesta sessão."
                        : "Extração por IA desactivada."
                );
            }
        });
    },

    get enabled() {
        return enabled;
    }
};

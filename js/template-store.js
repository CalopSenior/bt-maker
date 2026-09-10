/**
 * Armazenamento de Modelos (TemplateStore)
 *
 * Guarda modelos de documento no IndexedDB do navegador. Um modelo é apenas a
 * lista de campos — quais existem, em que ordem, com que título e tipo. Nunca
 * inclui o conteúdo preenchido: carregar um modelo dá sempre um documento em
 * branco com a estrutura desejada.
 *
 * O IndexedDB pode estar indisponível (navegação privada, permissões), por isso
 * todas as operações devolvem promessas que rejeitam com uma mensagem legível
 * em vez de falharem em silêncio.
 */

const DB_NAME = 'noxcor-bt-maker';
const DB_VERSION = 1;
const STORE = 'templates';

/** Únicas propriedades de um campo que fazem parte de um modelo. */
const FIELD_KEYS = ['field', 'type', 'title', 'icon', 'bg', 'border', 'custom'];

let dbPromise = null;

function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('Este navegador não disponibiliza IndexedDB.'));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: 'name' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
            reject(new Error('Não foi possível abrir a base de dados local.'));
    }).catch(err => {
        dbPromise = null; // permite nova tentativa numa acção seguinte
        throw err;
    });

    return dbPromise;
}

async function transact(mode, run) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = run(tx.objectStore(STORE));

        tx.onabort = () => reject(tx.error || new Error('Operação cancelada.'));
        tx.onerror = () => reject(tx.error || new Error('Erro na base de dados local.'));
        tx.oncomplete = () => resolve(request ? request.result : undefined);
    });
}

export const TemplateStore = {
    /**
     * Reduz um esquema ao essencial de um modelo, descartando qualquer
     * conteúdo que porventura venha agarrado às definições dos campos.
     */
    stripContent(schema) {
        return (schema || []).map(section =>
            FIELD_KEYS.reduce((clean, key) => {
                if (section[key] !== undefined) clean[key] = section[key];
                return clean;
            }, {})
        );
    },

    /**
     * Grava (ou substitui) um modelo com o nome dado.
     */
    async save(name, schema) {
        const trimmed = String(name || '').trim();
        if (!trimmed) throw new Error('Dê um nome ao modelo.');

        const fields = TemplateStore.stripContent(schema);
        if (fields.length === 0) throw new Error('O modelo não tem campos.');

        await transact('readwrite', store =>
            store.put({ name: trimmed, fields, updatedAt: Date.now() })
        );

        return trimmed;
    },

    /** Devolve todos os modelos, do mais recente para o mais antigo. */
    async list() {
        const all = await transact('readonly', store => store.getAll());
        return (all || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },

    /** Devolve um modelo pelo nome, ou null se não existir. */
    async get(name) {
        const found = await transact('readonly', store => store.get(String(name)));
        return found || null;
    },

    /** Remove um modelo. */
    async remove(name) {
        await transact('readwrite', store => store.delete(String(name)));
    }
};

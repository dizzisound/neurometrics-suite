/**
 * Configurazione di un singolo trial per il test di Stroop
 * Contiene la parola target, il colore visualizzato, la congruenza e il tasto corretto
 * Utilizzata per generare sequenze bilanciate di trial durante gli esperimenti
 * Fornisce anche una funzione per mescolare casualmente i trial usando l'algoritmo di Fisher-Yates
 * 
 */

export interface TrialConfig {
    word: string;
    color: string;
    isCongruent: boolean;
    correctKey: 'r' | 'v';
}

/**
 * Genera una lista perfettamente bilanciata di trial per il test di Stroop
 * @param totalTrials Numero totale di trial richiesti (deve essere multiplo di 4 per un perfetto bilanciamento)
 */
export function generateBalancedTrials(totalTrials: number): TrialConfig[] {
    const trials: TrialConfig[] = [];
    const half = totalTrials / 2;

    // 1. Definiamo le combinazioni base
    // Condizioni Congruenti (Parola e Colore coincidono)
    const congruentPool: TrialConfig[] = [
        { word: 'ROSSO', color: 'red', isCongruent: true, correctKey: 'r' },
        { word: 'VERDE', color: 'green', isCongruent: true, correctKey: 'v' }
    ];

    // Condizioni Incongruenti (Parola e Colore NON coincidono)
    const incongruentPool: TrialConfig[] = [
        { word: 'ROSSO', color: 'green', isCongruent: false, correctKey: 'v' },
        { word: 'VERDE', color: 'red', isCongruent: false, correctKey: 'r' }
    ];

    // 2. Riempiamo l'array rispettando il bilanciamento 50/50
    for (let i = 0; i < half; i++) {
        // Alterniamo o inseriamo equamente attingendo dai due pool
        const congTemplate = congruentPool[i % congruentPool.length];
        const incongTemplate = incongruentPool[i % incongruentPool.length];

        trials.push({ ...congTemplate });
        trials.push({ ...incongTemplate });
    }

    // 3. Mescoliamo l'array usando l'algoritmo di Fisher-Yates per eliminare la regolarità
    return fisherYatesShuffle(trials);
}

/**
 * Algoritmo di Fisher-Yates per una permutazione casuale uniforme O(n)
 */
function fisherYatesShuffle(array: TrialConfig[]): TrialConfig[] {
    let currentIndex = array.length;
    let randomIndex;

    while (currentIndex !== 0) {
        // Scegli un elemento rimanente
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // Scambialo con l'elemento corrente
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
}
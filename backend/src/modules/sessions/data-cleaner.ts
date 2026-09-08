/*
 * Classe per la pulizia e l'analisi dei dati neuropsicologici delle sessioni
 * Include metodi per il filtraggio dei tempi di reazione e il calcolo dell'effetto fatica
 * Pipeline statistica avanzata (Filtro MAD)
 * 
 */

import * as ss from 'simple-statistics';

export class NeuroDataCleaner {

    /**
     * Pulisce i tempi di reazione applicando il filtro robusto basato su Mediana e MAD (Leys et al., 2013).
     * Risolve il problema dell'asimmetria positiva tipica delle distribuzioni neuropsicologiche.
     * 
     * @param rtArray Vettore dei tempi di reazione grezzi (solo trial corretti)
     * @param threshold Moltiplicatore del MAD (standard clinico = 2.5 o 3.0)
     */
    static cleanByRobustMAD(rtArray: number[], threshold: number = 2.5): number[] {
        if (rtArray.length < 5) return rtArray; // Campione troppo piccolo per calcolare il MAD

        // 1. Filtro fisiologico preliminare (Anticipazioni motorie)
        const physiologicallyValid = rtArray.filter(time => time >= 150);
        if (physiologicallyValid.length === 0) return []; // Nessun dato sopravvissuto al filtro fisiologico

        // 2. Calcolo della Mediana
        const median = ss.median(physiologicallyValid);

        // 3. Calcolo del MAD (Median Absolute Deviation)
        // Formula: MAD = median( |x_i - median(X)| )
        const absoluteDeviations = physiologicallyValid.map(time => Math.abs(time - median));
        const mad = ss.median(absoluteDeviations);

        // Nota statistica: Se il MAD è 0 (paziente robotico o troppi tempi identici), 
        // usiamo un MAD minimo per evitare divisioni per zero o eliminazioni totali.
        const finalMad = mad === 0 ? 10 : mad;

        // 4. Filtraggio finale basato sul punteggio Z robusto
        // Un dato è outlier se: |x_i - mediana| / (MAD * 1.4826) > soglia
        // Il fattore 1.4826 scala il MAD per renderlo comparabile alla Deviazione Standard di una normale
        const bConstant = 1.4826;

        return physiologicallyValid.filter(time => {
            const robustZScore = Math.abs(time - median) / (finalMad * bConstant);
            return robustZScore <= threshold; // Mantiene solo i trial entro la soglia
        });
    }

    /**
     * Rileva la presenza di "Fatigue Effect" (Effetto Fatica) confrontando la prima metà
     * del test con la seconda metà. Un aumento significativo indica un crollo della tenuta attentiva.
     */
    static calculateFatigueIndex(rtArray: number[]): number {
        if (rtArray.length < 6) return 0;

        const half = Math.floor(rtArray.length / 2);
        const firstHalf = rtArray.slice(0, half);
        const secondHalf = rtArray.slice(half);

        const meanFirst = ss.mean(firstHalf);
        const meanSecond = ss.mean(secondHalf);

        // Restituisce la differenza in millisecondi (es. +80ms nella seconda metà)
        return parseFloat((meanSecond - meanFirst).toFixed(2));
    }
}
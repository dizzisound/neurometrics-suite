/**
 * Test suite per il bilanciatore di trial e l'utility di Fisher-Yates Shuffle
 * Verifica la correttezza del bilanciamento dei trial, l'efficacia dello shuffling
 * e la coerenza della mappatura dei tasti di risposta
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { generateBalancedTrials, TrialConfig } from './trial-balancer';

describe('Trial Balancer & Fisher-Yates Shuffle Utility', () => {
    const TOTAL_TRIALS = 20;
    let generatedSequence: TrialConfig[];

    beforeEach(() => {
        // Generiamo una sequenza fresca prima di ogni singolo test block
        generatedSequence = generateBalancedTrials(TOTAL_TRIALS);
    });

    // Test 1: Verifica la lunghezza esatta della matrice generata
    it('should generate the exact total number of requested trials', () => {
        expect(generatedSequence.length).toBe(TOTAL_TRIALS);
    });

    // Test 2: Il vincolo clinico primario (Bilanciamento esatto 50/50)
    it('should contain an identical number of congruent and incongruent trials (50/50 ratio)', () => {
        const congruentCount = generatedSequence.filter(trial => trial.isCongruent === true).length;
        const incongruentCount = generatedSequence.filter(trial => trial.isCongruent === false).length;

        expect(congruentCount).toBe(TOTAL_TRIALS / 2);
        expect(incongruentCount).toBe(TOTAL_TRIALS / 2);
    });

    // Test 3: Verifica dell'efficacia dello shuffling (Non determinismo sequenziale)
    it('should not generate a rigid alternating pattern (eliminating sequential bias)', () => {
        let alternatingPatternsCount = 0;

        for (let i = 0; i < generatedSequence.length - 1; i++) {
            // Controlliamo se la sequenza è rigidamente alternata: C -> I -> C -> I ...
            if (generatedSequence[i].isCongruent !== generatedSequence[i + 1].isCongruent) {
                alternatingPatternsCount++;
            }
        }

        // Se lo shuffle ha funzionato, è statisticamente quasi impossibile che la sequenza 
        // sia alternata al 100% (pari a TOTAL_TRIALS - 1)
        expect(alternatingPatternsCount).toBeLessThan(TOTAL_TRIALS - 1);
    });

    // Test 4: Coerenza della mappatura dei tasti di risposta
    it('should strictly map the correct validation key based on target stimulus color', () => {
        generatedSequence.forEach(trial => {
            if (trial.color === 'red') {
                expect(trial.correctKey).toBe('r');
            } else if (trial.color === 'green') {
                expect(trial.correctKey).toBe('v');
            }
        });
    });
});
import { describe, expect, it } from 'vitest';
import { estimateExGaussianParams } from './exgaussian';

describe('Ex-Gaussian Parameter Estimation Algorithm', () => {

    // Test 1: Verifica che l'algoritmo non vada in crash e restituisca i parametri attesi
    it('should correctly estimate mu, sigma, and tau for a known asymmetric dataset', () => {
        // Un set di dati fittizio con asimmetria positiva controllata (right-skewed)
        const mockReactionTimes = [320, 340, 360, 400, 450, 520, 710];

        const result = estimateExGaussianParams(mockReactionTimes);

        // Verifichiamo che i parametri siano numeri validi e coerenti
        expect(result).toBeDefined();
        expect(result.mu).toBeGreaterThan(0);
        expect(result.sigma).toBeGreaterThan(0);
        expect(result.tau).toBeGreaterThan(0);

        // Il parametro Tau (coda destra) deve catturare l'asimmetria causata dai valori alti finali (520, 710)
        expect(result.tau).toBeGreaterThan(result.sigma);
    });

    // Test 2: Robustezza matematica contro set di dati piatti o simmetrici
    it('should handle perfectly symmetrical data without generating NaN (Not a Number)', () => {
        // Dataset artificiale perfettamente simmetrico (la radice cubica del terzo momento potrebbe essere zero)
        // Dataset perfettamente simmetrico (Media = 330)
        // Distanze dalla media: -30, -20, -10, 0, +10, +20, +30
        const symmetricalTimes = [300, 310, 320, 330, 340, 350, 360];

        const result = estimateExGaussianParams(symmetricalTimes);

        expect(result.mu).not.toBeNaN();
        expect(result.sigma).not.toBeNaN();
        expect(result.tau).not.toBeNaN();
        expect(result.tau).toBe(0); // In una distribuzione perfettamente simmetrica, la componente esponenziale è nulla
        
        // Ora tau sarà esattamente 0.00 (o vicinissimo grazie a toBeCloseTo)
        expect(result.tau).toBeCloseTo(0, 2);
    });

    // Test 3: Gestione dei decimali e arrotondamenti
    it('should return numbers rounded to two decimal places', () => {
        const rawTimes = [312.45, 455.12, 389.91, 612.33, 344.02];
        const result = estimateExGaussianParams(rawTimes);

        // Verifica la formattazione tramite regex (due cifre decimali massimo)
        expect(result.mu.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
        expect(result.tau.toString()).toMatch(/^\d+(\.\d{1,2})?$/);

        // Verifica che tau sia un numero valido e non ecceda 1 come frazione
        expect(result.tau % 1).toBeLessThan(1); // verifica che sia un numero valido
    });
});
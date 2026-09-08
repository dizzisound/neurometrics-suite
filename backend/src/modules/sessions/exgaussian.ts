/*
 * Algoritmo calcolo dei momenti(μ, σ, τ) dell'Ex-Gaussian scritto da zero
 * Stima i parametri Ex-Gaussiani (Mu, Sigma, Tau) partendo dai Tempi di Reazione.
 * Utilizza il Metodo dei Momenti basandosi su Media, Varianza e Skewness.
 * Implementazione didattica per comprendere la logica dei momenti statistici.
 * Utilizza solo metodi di base di JavaScript senza librerie esterne.
 * Non richiede librerie esterne, utile per scopi didattici e sperimentali.
 * 
 */
export function estimateExGaussianParams(rt: number[]) {
    // Calcoliamo i "Momenti" della distribuzione da zero per capire la logica
    const n = rt.length;

    // 1. Media (M1)
    const mean = rt.reduce((sum, val) => sum + val, 0) / n;

    // 2. Varianza (M2)
    const variance = rt.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);

    // 3. Terzo Momento Centrale (legato alla Skewness/Asimmetria)
    const thirdCentralMoment = rt.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0) / n;

    /* 
      Formule del Metodo dei Momenti per Ex-Gaussiana:
      Tau = (ThirdCentralMoment / 2) ^ (1/3)
      Mu = Mean - Tau
      Sigma = Sqrt(Variance - Tau^2)
    */

    // Evitiamo radici cubiche di numeri negativi se i dati fossero perfettamente simmetrici
    const tau = Math.cbrt(Math.max(0, thirdCentralMoment / 2));
    const mu = mean - tau;

    // Evitiamo radici quadrate di numeri negativi per la varianza residuale
    const sigmaSquared = variance - Math.pow(tau, 2);
    const sigma = sigmaSquared > 0 ? Math.sqrt(sigmaSquared) : 0;

    return {
        mu: parseFloat(mu.toFixed(2)),
        sigma: parseFloat(sigma.toFixed(2)),
        tau: parseFloat(tau.toFixed(2))
    };
}
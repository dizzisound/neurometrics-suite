/**
 * Router per la generazione dinamica di report clinici in formato PDF
 * Utilizza PDFKit per creare documenti PDF al volo senza salvare file sul server
 */

import { Response, Router } from 'express';
// pdfkit does not ship TypeScript declarations in this project.
// @ts-expect-error — the package is available at runtime, but has no declarations.
import PDFDocument from 'pdfkit';
import { TestSession } from '../database/models/session.schema';
import { AuthenticatedRequest, verifyJwt } from '../middleware/auth.middleware';
import { authorizePatientAccess } from '../modules/sessions/sessions.routes';

const reportRouter = Router();

/**
 * GET /api/patients/:patientId/report-pdf
 * Genera dinamicamente al volo un report clinico formattato in PDF
 */
reportRouter.get('/patients/:patientId/report-pdf', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { patientId } = req.params;

        // Stesso controllo di ownership/ruolo usato dagli altri endpoint clinici. Nessuna opzione
        // "allowDeidentifiedResearch": il PDF contiene dati identificabili (codice paziente, narrativa
        // clinica completa), quindi il ruolo RESEARCHER (pensato per dati de-identificati) resta escluso.
        const patient = await authorizePatientAccess(req, res, patientId);
        if (!patient) return;

        // Recuperiamo lo storico delle sessioni ordinato
        const sessions = await TestSession.find().where('patientId').equals(patientId).sort({ sessionDate: 1 });

        if (sessions.length === 0) {
            return res.status(404).json({ error: 'Dati insufficienti per generare il report.' });
        }

        // Inizializziamo il documento PDFKit
        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        // Configurazione degli Header HTTP per il trasferimento binario in streaming
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report_clinico_${patientId}.pdf`);

        // Indirizziamo il flusso di scrittura direttamente sulla risposta HTTP (Zero spreco di RAM sul server)
        doc.pipe(res);

        // --- COSTRUZIONE DEL DOCUMENTO ---

        // 1. Intestazione Ospedaliera / Clinica
        doc.fillColor('#2c3e50').fontSize(22).text('REPORT CLINICO NEUROPSICOLOGICO', { align: 'center' });
        doc.fontSize(10).fillColor('#7f8c8d').text('Piattaforma di Calcolo Avanzato NeuroMetrics', { align: 'center' });
        doc.moveDown(2);

        // 2. Tabella Anagrafica Pseudonimizzata
        doc.fillColor('#2980b9').fontSize(14).text('1. Informazioni sul Paziente (Conforme GDPR)', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#2c3e50');
        doc.text(`Codice Identificativo: ${patient.patientCode}`);
        doc.text(`Anni di Scolarità: ${patient.educationYears} (Fascia di correzione psicometrica)`);
        doc.text(`Genere: ${patient.gender}`);
        doc.moveDown(2);

        // 3. Sintesi Longitudinali dei Parametri Statistici
        doc.fillColor('#2980b9').fontSize(14).text('2. Sintesi delle Prestazioni Longitudinali', { underline: true });
        doc.moveDown(1);

        // Struttura di una tabella semplificata disegnata via coordinate in PDFKit
        let currentY = doc.y;
        doc.fontSize(10).fillColor('#ffffff');

        // Intestazioni di Colonna (Sfondo Blu)
        doc.rect(40, currentY, 515, 20).fill('#2980b9');
        doc.fillColor('#ffffff').text('Data', 45, currentY + 5);
        doc.text('Test', 130, currentY + 5);
        doc.text('Accuratezza', 210, currentY + 5);
        doc.text('Interferenza', 300, currentY + 5);
        doc.text('Parametro Tau', 410, currentY + 5);

        currentY += 20;

        // Righe della tabella dei dati
        sessions.forEach((session, index) => {
            doc.fontSize(10);
            // Alternanza dei colori di sfondo per massima leggibilità visiva (Zebra striping)
            if (index % 2 === 0) {
                doc.rect(40, currentY, 515, 20).fill('#f8f9fa');
            }

            const dateStr = new Date(session.sessionDate).toLocaleDateString('it-IT');
            doc.fillColor('#2c3e50')
                .text(dateStr, 45, currentY + 5)
                .text(session.testType, 130, currentY + 5)
                .text(`${session.summaryStats?.accuracyRate}%`, 210, currentY + 5)
                .text(`${session.summaryStats?.interferenceEffect} ms`, 300, currentY + 5)
                .text(`${session.summaryStats?.exGaussian?.tau} ms`, 410, currentY + 5);

            currentY += 20;
        });

        doc.y = currentY + 30; // Riposizioniamo il cursore verticale di scrittura


        // Inseriamo una linea di separazione prima di passare alla nuova pagina
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(2); // Aggiungiamo un po' di spazio verticale dopo la linea di separazione


        // Aggiungiamo una nuova pagina per i grafici e le conclusioni
        doc.addPage(); // Spostiamo i grafici e le conclusioni su una seconda pagina pulita
        doc.fillColor('#2980b9').fontSize(14).text('3. Profilo Neuropsicologico Comparativo (Z-Scores)', { underline: true });
        doc.moveDown(1.5);

        // Z-Score primario (interferenza per Stroop/Flanker, falsi allarmi per Go/No-Go) dell'ultima
        // sessione registrata per ciascun paradigma, già calcolato in POST /sessions rispetto alla
        // popolazione di controllo (NormativeData). null = nessuna sessione o nessuna fascia normativa corrispondente.
        const testTypeLabels: { type: 'STROOP' | 'GO_NO_GO' | 'FLANKER'; label: string }[] = [
            { type: 'STROOP', label: 'Stroop (Inibizione Verbale)' },
            { type: 'GO_NO_GO', label: 'Go/No-Go (Inibizione Motoria)' },
            { type: 'FLANKER', label: 'Flanker (Inibizione Spaziale)' }
        ];

        const zScoresConfronto = testTypeLabels.map(({ type, label }) => {
            const lastSessionOfType = [...sessions].reverse().find(s => s.testType === type);
            const value = lastSessionOfType?.summaryStats?.zScorePrimary;
            return { test: label, value: typeof value === 'number' ? value : null };
        });

        let graphY = doc.y;
        const chartLeftMargin = 220;
        const maxBarWidth = 200; // Equivalente a uno Z-Score di +3.0 o -3.0

        // Disegniamo la linea dell'asse centrale (Z-Score = 0)
        doc.strokeColor('#bdc3c7').lineWidth(1).moveTo(chartLeftMargin + maxBarWidth / 2, graphY - 10).lineTo(chartLeftMargin + maxBarWidth / 2, graphY + 120).stroke();
        // Etichetta dell'asse centrale
        doc.fillColor('#7f8c8d').fontSize(8).text('Media Popolazione (Z=0)', chartLeftMargin + maxBarWidth / 2 - 45, graphY - 22);

        zScoresConfronto.forEach((item) => {
            doc.fontSize(10).fillColor('#2c3e50');

            // 1. Scrittura del nome del test a sinistra
            doc.text(item.test, 40, graphY + 8, { width: 170 });

            // Nessuna sessione di questo paradigma, o nessuna fascia normativa corrispondente:
            // non disegniamo una barra a Z=0 (sarebbe un dato falso), segnaliamo solo l'assenza
            if (item.value === null) {
                doc.fillColor('#95a5a6').fontSize(9).text(
                    'Dato non disponibile',
                    chartLeftMargin + maxBarWidth / 2 - 40,
                    graphY + 8
                );
                graphY += 40;
                return;
            }

            // 2. Calcolo della larghezza e della direzione della barra
            // Mappiamo lo Z-Score: 0 è al centro, i valori negativi vanno a sinistra, i positivi a destra
            const barScale = maxBarWidth / 6; // Estensione massima da -3 a +3 (finestra totale di 6 unità di deviazione standard)
            const barWidth = Math.abs(item.value) * barScale;

            let barX = chartLeftMargin + maxBarWidth / 2;
            if (item.value < 0) {
                barX = barX - barWidth; // Se negativo, la barra si sposta a sinistra dell'asse centrale
            }

            // 3. Scelta del colore della barra in base alla gravità clinica (standard visivi)
            // Tutte le metriche qui confrontate (interferenza, falsi allarmi, tau) sono "più alto
            // = peggio": un paziente compromesso ha un valore SUPERIORE alla media di popolazione,
            // quindi uno Z-Score positivo. La direzione preoccupante è quindi Z >= soglia, non <=.
            let barColor = '#2ecc71'; // Verde (Norma)
            if (item.value >= 2.0) {
                barColor = '#e74c3c'; // Rosso (Deficit Critico)
            } else if (item.value >= 1.5) {
                barColor = '#f39c12'; // Arancione (Borderline)
            }

            // 4. Disegno effettivo della barra geometrica nel PDF
            doc.rect(barX, graphY, barWidth, 25).fill(barColor);

            // 5. Scrittura del valore numerico dello Z-Score a fianco della barra
            doc.font('Helvetica-Bold').fillColor('#2c3e50').fontSize(10);
            const textX = item.value < 0 ? barX - 35 : barX + barWidth + 10;
            doc.text(`Z: ${item.value}`, textX, graphY + 8);
            doc.font('Helvetica'); // Torniamo al peso normale per la riga successiva

            graphY += 40; // Spostamento verticale per il test successivo
        });

        // Riposizioniamo il cursore di PDFKit sotto il grafico appena disegnato
        doc.y = graphY + 20;

        
        // 4. Sezione Interpretativa che legge il profilo comparativo reale (Z-Score per paradigma)
        doc.fillColor('#2980b9').fontSize(14).text('4. Conclusioni Cliniche Integrate', { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10).fillColor('#2c3e50');

        // Costruiamo il paragrafo dinamicamente dai soli Z-Score realmente disponibili: non
        // formuliamo un'ipotesi diagnostica, elenchiamo il dato misurato e la sua fascia di gravità.
        // Stessa direzione "più alto = peggio" usata per il colore della barra sopra
        const severityLabel = (z: number): string => {
            if (z >= 2.0) return 'deficit critico';
            if (z >= 1.5) return 'prestazione borderline';
            return 'prestazione nella norma';
        };

        const zScoreFindings = zScoresConfronto
            .filter((item): item is { test: string; value: number } => item.value !== null)
            .map((item) => `${item.test}: Z = ${item.value} (${severityLabel(item.value)})`);

        const conclusioniTesto = zScoreFindings.length > 0
            ? `Il confronto con la popolazione di controllo attualmente disponibile nel sistema evidenzia, per i paradigmi con dato disponibile: ${zScoreFindings.join('; ')}. Il confronto è calcolato per età e scolarità del paziente e va letto insieme al quadro clinico complessivo, non come diagnosi automatica.`
            : "Non è disponibile un confronto con la popolazione di controllo per i paradigmi somministrati: manca una sessione registrata o una fascia normativa (età/scolarità) corrispondente a questo paziente.";

        doc.text(conclusioniTesto, { align: 'justify', lineGap: 4 });

        // 5. Sezione Interpretativa Finale automatizzata
        doc.fillColor('#2980b9').fontSize(14).text('5. Interpretazione Clinica Automatizzata', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#2c3e50');

        // Ricaviamo l'ultima sessione registrata per l'interpretazione
        const lastSession = sessions[sessions.length - 1];
        const tauValue = lastSession.summaryStats?.exGaussian?.tau || 0;

        let interpretazioneTesto = "Il profilo longitudinale mostra prestazioni stabili entro i limiti di norma per l'età e la scolarità del soggetto.";
        if (tauValue > 150) {
            interpretazioneTesto = `Si rileva un incremento critico del parametro Ex-Gaussiano Tau (pari a ${tauValue} ms) nell'ultima sessione di test. In neuropsicologia clinica, questo indica la comparsa di frequenti fallimenti di attenzione focalizzata (attentional lapses). Si raccomanda un approfondimento clinico mirato per valutare l'esordio di un potenziale decadimento cognitivo lieve (MCI).`;
        }

        doc.text(interpretazioneTesto, { align: 'justify', lineGap: 4 });

        // 6. Più di pagina con Nota Legale Obbligatoria (Footnote)
        doc.moveDown(4);
        doc.fontSize(8).fillColor('#7f8c8d').text(
            'This is for informational purposes only. For medical advice or diagnosis, consult a professional. AI responses may include mistakes.',
            { align: 'center', italic: true }
        );

        // Chiudiamo il file PDF decretando la fine della trasmissione dati
        doc.end();

    } catch (error) {
        console.error('Errore generazione report PDF:', error);
        return res.status(500).json({ error: 'Impossibile generare il file PDF.' });
    }
});

export default reportRouter;
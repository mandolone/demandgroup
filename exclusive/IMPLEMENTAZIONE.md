# Catalogo Exclusive — consegna e configurazione

## Audit

Repository: `mandolone/demandgroup`. Configurazione GitHub Pages verificata tramite API: ramo `main`, cartella `/docs`, dominio `https://demandgroup.smokeandthink.com/`, build legacy. La directory originale R4StarWatchFaces non era un checkout Git del sito: il repository aggiornato è stato clonato nella sottocartella `exclusive-site-work`.

Il repository mantiene anche sorgenti React 19 / Vinext 1 beta, Vite 8 e uno scheletro Drizzle/D1 privo di tabelle applicative. Nessun progetto Sites è registrato in `.openai/hosting.json`; nessun database campagne esistente è stato trovato. Il sito pubblico usa gli HTML in `docs/`, non il server Vinext. Tipografia Barlow Condensed/Manrope, palette scura verde/ottone e immagini reali sono riutilizzate.

## Implementazione

- `/exclusive/`: catalogo di 14 prodotti già documentati nel repository, immagini dei quadranti reali, stato partner e disponibilità dal server, istruzioni Wear OS/Google Play.
- `/exclusive/admin/`: accesso email OTP più allowlist UUID lato server; partner modificabili/disattivabili, limite globale configurabile, date campagna, disponibilità quadranti, CSV privati con quantità attesa iniziale 25, batch tracciati, gestione codici inutilizzati, QR PNG/SVG, esportazione delle sole statistiche aggregate.
- `/exclusive/privacy/`: informativa **da completare prima dell’attivazione** con identità legale e indirizzo del titolare, basi giuridiche confermate, regione/processori e conservazione effettiva.
- Supabase: autenticazione passwordless, PostgreSQL privato, RLS su tutte le tabelle, RPC invocabili solo dal service role. L’Edge Function ricava l’utente dal JWT verificato mediante `auth.getUser()`. Il parametro partner è solo provenienza/selezione stock, non autorizzazione.
- Assegnazione atomica: lock transazionale per identità/campagna, lock riga `FOR UPDATE SKIP LOCKED`, codice globalmente unico, assegnazione con `code_id` unico, slot utente/campagna unici e legame composito codice/partner/quadrante/campagna. Stesso quadrante idempotente anche quando il limite è maggiore di uno. Nessun codice passa fra partner.
- L’identità è un HMAC dell’email verificata normalizzata, con pepper privato al database: ricreare l’account con la stessa email non azzera il limite. Alias o email diverse possono appartenere alla stessa persona: non è una garanzia di identificazione fisica della persona.
- Stati `AVAILABLE`, `RESERVED`, `ASSIGNED`, `EXPIRED`, `DISABLED`. L’assegnazione immediata non necessita di una prenotazione persistente `RESERVED`. `ASSIGNED` non significa riscatto o installazione.
- Anti-bot Turnstile su autenticazione (configurazione Supabase obbligatoria) e richiesta codice (verificato server-side anche per hostname/action); contatori atomici per identità e contatori IP ampi come segnale ausiliario: in caso di flood vengono scartate le sole metriche di visita, senza consumare la quota di altri account verificati. Nessun limite di una persona per IP.
- Nessun codice/CSV nel frontend, storage locale o repository. Sessioni Auth conservate solo nel tab; codici recuperati dal server. CSV analizzato e validato sul backend; errori sanitizzati e nessun log applicativo con payload, codici o email.
- Visite approssimative della pagina, deduplicate per identificatore casuale della richiesta/partner/giorno, non persone. Nessun identificatore visite è memorizzato nel browser. Utenti verificati unici per campagna attribuiti al partner del primo tentativo di assegnazione. Distribuzione e classifica conteggiano assegnazioni. Le visite sono su finestra di 30 giorni.

## Configurazione esterna, nell’ordine

1. Creare o selezionare un progetto **Supabase dedicato alla promozione**, preferibilmente nella regione scelta dal titolare. I suoi account non devono essere usati da servizi estranei: il cleanup elimina gli account di promozione scaduti, esclusi gli amministratori.
2. Con Supabase CLI autenticata e collegata al progetto, applicare `supabase db push`. Sono presenti due migrazioni ordinate in `supabase/migrations/`. Non applicare `setup/bootstrap.sql` come migrazione: contiene segnaposto deliberati.
3. In Authentication abilitare provider Email; usare OTP senza password, disabilitare anonymous sign-in e altri provider non necessari. Modificare il template Magic Link per includere **`{{ .Token }}`**, non un link; usare un codice di 6–10 cifre. Configurare SMTP reale, sender verificato, scadenza OTP e limiti di invio/validazione. Prima del lancio controllare la consegna sia a nuovi utenti sia agli utenti già registrati.
4. Creare widget Cloudflare Turnstile per `demandgroup.smokeandthink.com`. Abilitare CAPTCHA nelle impostazioni Supabase Auth con la relativa chiave segreta. Impostare anche le variabili server elencate in `supabase/secrets.example` con `supabase secrets set --env-file <file-privato.env>`. Per staging aggiungere esplicitamente il suo origin/hostname; non usare wildcard. Non inserire mai service-role key o chiavi segrete nei file pubblici.
5. Distribuire **solo dopo autorizzazione** `supabase functions deploy exclusive-api` e `supabase functions deploy exclusive-cleanup`. Le funzioni hanno `verify_jwt=false` perché la prima include azioni pubbliche e verifica i JWT per ogni azione protetta; la seconda richiede un segreto indipendente. Le RPC DB restano invocabili solo dal service role. CORS non è la barriera di autenticazione.
6. Prima dell’apertura amministrativa, autenticare l’email dell’amministratore via OTP usando Supabase, quindi copiare il suo UUID verificato da Authentication Users. In `supabase/setup/bootstrap.sql` sostituire tutti i segnaposto con UUID, slug/nome e date effettive. Eseguire manualmente nel SQL editor. La campagna iniziale rimane inattiva.
7. Completare l’informativa in `exclusive/templates/privacy.html`; confermare conservazione e processori. La configurazione frontend è pubblica: impostare URL Supabase reale, **publishable key o vecchia anon key**, site key Turnstile e slug campagna in `exclusive/config.json`. Il gate `privacyReady` deve restare `false` fino alla conclusione di questi passaggi. Esempio dello script: `node scripts/configure-exclusive.mjs --supabase-url <URL> --publishable-key <CHIAVE-PUBBLICA> --turnstile-site-key <SITE-KEY> --campaign <SLUG> --privacy-ready`.
8. Abilitare pg_cron, pg_net e Vault; salvare URL/secret di cleanup in Vault ed eseguire una sola volta `supabase/setup/schedule-cleanup.sql`. Default: rimozione quotidiana di collegamenti identità/assegnazioni dopo 90 giorni dalla fine, configurabili dal pannello. Conservare i codici già assegnati come tombstone anonime per impedirne riuso/importazione. Le campagne ripulite non possono essere riattivate; crearne una nuova. Verificare esiti HTTP oltre agli esiti cron. Account che non completano mai l’OTP sono soggetti alla politica Auth del progetto e vanno inclusi nelle procedure operative di conservazione.
9. Eseguire `npm ci`, `npm run build:exclusive`, `npm test` e `python3 -m unittest discover -s tests -p 'test_catalog.py' -v`. `npm run build` verifica anche le route Vinext; Pages usa direttamente i file generati in `docs/exclusive/`. I sorgenti HTML/CSS/JS sono sotto `exclusive/`, le funzioni e SQL sotto `supabase/`. Non modificare manualmente i bundle generati.
10. Nel pannello caricare **CSV reali**, uno per coppia quadrante/partner, default 25 codici ciascuno. Header facoltativo `code`, una sola colonna, righe UTF-8/BOM supportate. Indicare quantità e scadenza effettiva di Google Play. Non inventare codici mancanti. Ripetere il caricamento dopo un problema di rete con lo stesso batch: è idempotente. Non aggiornare o chiudere la pagina durante il caricamento; dopo un’interruzione completa controllare prima la lista importazioni, poiché il batch ID vive solo in memoria.
11. Provare la matrice completa in un progetto di staging: email nuove/esistenti, CAPTCHA reale, browser mobile/desktop, logout/recupero, CSV reali non produttivi e accesso amministrativo negato. Solo dopo questi controlli e autorizzazione esplicita, attivare la campagna e pubblicare/mergiare su `main`. Un push su `main` pubblica GitHub Pages.

## QR già preparati

Gli URL sono il dominio reale verificato più `/exclusive/?partner=valentina` e `?partner=sara`. Il percorso sarà disponibile soltanto dopo il rilascio autorizzato. Il pannello genera i QR per ogni partner futuro senza modificare codice. Lo script `scripts/generate-exclusive-qr.mjs` permette anche generazione offline, con origine esplicita e margine bianco per stampa. Le immagini non includono né email né codici.

## Verifiche e limiti della consegna

Test PostgreSQL reali con connessioni concorrenti, dati sintetici e database temporaneo: isolamento partner, 20 utenti simultanei con codici distinti, richieste concorrenti della stessa identità, recupero/refresh/cambio partner, stock scaduto/esaurito, anonimi/non-verificati, autorizzazioni admin, unicità/RLS, importazioni idempotenti e rollback duplicati, limite configurabile, ricreazione account con stessa email e rate limiting. I controlli statici verificano che asset e pacchetti esistano, che le copie pubbliche coincidano e che file privati/segreti non siano pubblicati.

L’invio OTP reale, Turnstile e le funzioni su Supabase **non sono testati end-to-end**: account/chiavi/configurazione non sono stati forniti. Il catalogo resta volutamente inattivo. Nessuna migrazione remota, assegnazione reale o pubblicazione in produzione eseguita.

Il precedente test `rendered-html.test.mjs` verificava ancora lo scheletro iniziale del template e non il sito esistente. È stato sostituito con controlli di rendering delle pagine reali. I 9 test Python del catalogo esistente sono conservati e passano. L’audit npm delle dipendenze di produzione riporta zero vulnerabilità; le dipendenze di sviluppo del template hanno avvisi preesistenti da rivalutare prima di un futuro deployment del server Vinext (GitHub Pages serve soltanto asset statici).

## Riferimenti tecnici

- [Supabase: funzioni e privilegi](https://supabase.com/docs/guides/database/functions)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: OTP](https://supabase.com/docs/reference/javascript/auth-signinwithotp)
- [Supabase: CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)

## Esito finale dei controlli (30 ottobre 2026)

- `npm test`: **22 controlli Exclusive + 5 rendering route**, tutti superati; build Vinext completata.
- `python3 -m unittest discover -s tests -p 'test_catalog.py' -v`: **9 test**, tutti superati.
- Deno `check` delle due Edge Functions: superato, importazioni risolte e lockfile conservato.
- Anteprima via browser: verificati impaginazione mobile e desktop, schede reali, dialogo di recupero e accesso al pannello bloccato fino alla configurazione.
- `npm audit --omit=dev`: nessuna vulnerabilità. Audit completo del template: 27 avvisi nelle dipendenze di sviluppo (18 high, 8 moderate, 1 low); nessun aggiornamento generale del framework eseguito in questa modifica.
- QR PNG e SVG distinti, PNG 1600×1600, verificati presenti nel volume Deposito montato: `/Volumes/Deposito/OROLOGI SAMSUNG/materiale per SOCIAL/2026-10-30-exclusive-partner-qr-v01`. La stessa cartella contiene anteprima e testi EN/IT, esplicitamente di pre-lancio.

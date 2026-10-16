# Demand Group: shared companion catalog

Canonical endpoint:

https://demandgroup.smokeandthink.com/catalog/watchfaces.json

Developer: Demand Group, Google Play developer ID `6965957154471594542`.

## Catalog contract

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-10-16T12:00:00Z",
  "apps": [
    {
      "packageName": "com.watchfacestudio.steely",
      "title": "Outfit: Wear OS Watch Face",
      "shortDescription": "Elegant analog watch face for Wear OS with 10 colours and useful daily details.",
      "imageUrl": "https://play-lh.googleusercontent.com/EXAMPLE=s512-rw"
    }
  ]
}
```

The snippet illustrates the schema; its timestamp and image URL are examples. For a bundled fallback, download the actual endpoint, validate it, and include that complete JSON. Do not use this example as the catalog.

Each `packageName` is the actual watch-face listing ID on Google Play, including case. It is not necessarily the phone companion's application ID. `updatedAt` is the UTC time of the last content change, not the last successful check. This is a discovery catalog; it does not provide APK downloads, entitlement, purchases, prices, or installation status.

Unknown JSON fields must be ignored for forward compatibility. Support schema version 1; an unsupported schema must leave the last valid catalog intact. Titles/descriptions are currently English. Google Play determines availability, compatibility and price for the user's account and country.

## Instructions to give Codex for EVERY companion (Italian)

Aggiorna questa companion Demand Group affinché usi il catalogo condiviso seguente:

`https://demandgroup.smokeandthink.com/catalog/watchfaces.json`

Lavora sul progetto sorgente Android Studio. Conserva identità, grafica, immagini/video, scheda del quadrante, istruzioni e funzioni di installazione già esistenti. Non cambiare dominio del sito. Non usare `mandolone.github.io/demandgroup/` come endpoint del catalogo e non ricostruire un AAB modificando un bundle già compilato.

1. Aggiungi/verifica `android.permission.INTERNET`. Usa HTTPS senza abilitare globalmente il traffico HTTP in chiaro. Mantieni la normale verifica dei certificati TLS.
2. Implementa un repository del catalogo separato dall'interfaccia, con download e parsing fuori dal thread principale e operazioni annullabili. Usa il client HTTP già presente nel progetto, oppure le API Android adatte al progetto. Imposta timeout finiti, per esempio connessione 15 secondi e lettura 20 secondi.
3. Gestisci i redirect 301, 302, 303, 307 e 308, inclusi i valori relativi di `Location`, per un massimo di 5 passaggi. Segui solo destinazioni HTTPS, blocca cicli e downgrade verso HTTP. Puoi delegare i redirect al client se garantisce questi requisiti. Non disabilitare i controlli TLS per far funzionare una richiesta.
4. Una risposta finale 200 deve contenere un JSON valido: `schemaVersion` numerico uguale a 1, `updatedAt` ISO 8601 UTC e array `apps` non vuoto. Per ogni app richiedi `packageName`, `title`, `shortDescription`, `imageUrl` non vuoti; verifica package validi e univoci e immagini HTTPS. Ignora campi aggiuntivi. Non salvare HTML di errore, JSON incompleto o uno schema non supportato.
5. All'apertura mostra subito l'ultimo catalogo valido salvato localmente; se manca, usa `assets/catalog.json`, ottenuto dall'endpoint attuale al momento della build. Non lasciare che il catalogo incorporato sovrascriva una copia remota valida dopo ogni riavvio.
6. All'apertura avvia un controllo remoto in background; al ritorno in primo piano ripetilo se sono trascorsi almeno 15 minuti dall'ultimo controllo riuscito. Aggiungi un comando visibile di aggiornamento manuale che ignori questo intervallo. Evita richieste concorrenti duplicate e loop di retry. Non serve un servizio permanente in background.
7. Evita cache HTTP obsolete (`Cache-Control: no-cache`, e `useCaches=false` se usi HttpURLConnection). Puoi usare ETag/If-None-Match: tratta 304 come conferma della copia locale solo se esiste una copia valida, altrimenti ripeti la richiesta senza condizione. Non trattare ogni risposta diversa da 200 come un nuovo catalogo.
8. Solo dopo la validazione completa sostituisci atomicamente cache persistente e stato UI. In caso di rete assente, timeout, 404, 5xx, redirect non valido o JSON errato, mantieni l'ultimo catalogo valido e consenti di riprovare. Mostra uno stato discreto e corretto; non indicare che l'aggiornamento è riuscito quando stai mostrando il fallback.
9. La sezione degli altri quadranti deve essere costruita da TUTTI gli elementi del JSON, senza limiti fissi o array statici di 8 prodotti. Per escludere il quadrante di questa companion confronta con un valore esplicito `CURRENT_WATCH_FACE_PACKAGE`, non necessariamente con `BuildConfig.APPLICATION_ID`. Non escludere il prodotto solo perché l'app companion ha un nome simile.
10. Carica `imageUrl` con cache e placeholder. Un'immagine non disponibile non deve eliminare l'intero catalogo. Al tocco apri `https://play.google.com/store/apps/details?id=<packageName>`; conserva la distinzione tra scoprire un altro prodotto e installare il quadrante corrente sull'orologio. Non inventare compatibilità, prezzi o disponibilità.
11. Conserva applicationId e firma delle app esistenti, non esporre password/chiavi, e incrementa versionCode rispetto alla versione effettivamente pubblicata su Google Play. Conserva la struttura dei moduli e le impostazioni richieste per la pubblicazione. Genera un AAB release con la firma autorizzata se disponibile; se manca, consegna i sorgenti e indica esattamente cosa serve, senza generare una nuova chiave sostitutiva.
12. Verifica almeno: risposta 200 reale; redirect HTTPS; aggiunta di una nuova voce al feed senza ricompilare l'app; riavvio e uso offline dopo un aggiornamento riuscito; 404/timeout/JSON errato senza perdita della cache; immagine non disponibile; esclusione del solo quadrante corrente. Controlla che l'app non blocchi il thread principale e genera il bundle release.

Il risultato atteso è che un nuovo quadrante pubblicato nel feed compaia nella sezione catalogo delle companion già installate al successivo aggiornamento riuscito, senza una nuova release delle companion.

## How the website maintains the JSON

`python3 scripts/sync_catalog.py` discovers public apps from Demand Group's Google Play developer page in US and IT, checks the individual listings, and extracts the official title, description and icon. It also rechecks known catalog items and Google Play links in the website's `docs/index.html`. An app returning 404 in both markets is excluded. New apps appear after Google exposes them in the public developer listing; private/testing/pre-release apps are not inferred from local build files. Regional availability can differ beyond these two markets.

All requests must complete and validation must pass before replacing the published copies. Failed requests or unexpected page formats fail the run and retain the published catalog. Metadata comes from public Google Play HTML, so a future Google page change may require adapting the parser. GitHub Actions logs expose failures to repository administrators.

The output schema stays compatible with the catalog found in the Grunge companion: `schemaVersion`, `updatedAt`, `apps`, and four string fields per app. Copies are written to `docs/catalog/watchfaces.json` (GitHub Pages) and `public/catalog/watchfaces.json` (framework builds).

The `Sync companion catalog` GitHub Actions workflow runs at minute 23 every six hours UTC, on relevant website/source changes, and manually via workflow_dispatch. GitHub scheduling can be delayed and is not a real-time Google Play notification. For inactive public repositories GitHub may disable scheduled workflows after 60 days; check Actions if updates stop. When content changes, the workflow commits the JSON and explicitly requests a Pages build, since a push using GITHUB_TOKEN alone does not trigger legacy Pages builds.

Checks:

```sh
python3 -m unittest discover -s tests -p 'test_catalog.py' -v
python3 scripts/sync_catalog.py --check
```

The old github.io endpoint still redirects while the custom domain is configured. Newly rebuilt companions must use the canonical HTTPS domain above. Publishing this JSON fixes the custom-domain 404; it does not remove the legacy redirect for older companions.

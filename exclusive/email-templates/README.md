# Email di verifica Demand Group

In Supabase → Authentication → Email Templates → Magic link / OTP:

- Oggetto: `Your Demand Group verification code`
- Body: copiare l’intero contenuto di `verification.html`.
- Conservare esattamente `{{ .Token }}`: Supabase inserisce il codice reale.
- Non usare il codice sintetico della preview locale come template.

Layout scuro verde/ottone coerente con Demand Group, tabelle presentazionali, CSS inline, font di sistema, nessuna immagine o font esterno, nessun pixel di tracciamento. I collegamenti del marchio nel footer sono sito ufficiale, Instagram e YouTube forniti dall’utente, assistenza e informativa. La visualizzazione effettiva può variare fra client email: verificare un invio reale prima dell’apertura della campagna.

Il corpo è dedicato alla verifica. Gli inviti ad acquistare altri quadranti e “Follow Demand Group” sono collocati nella pagina dopo la consegna del codice. Le newsletter promozionali sono riservate agli iscritti consenzienti e devono includere la disiscrizione del provider. Questo template OTP non costituisce iscrizione alla newsletter e non contiene un invito commerciale nel corpo.

Non è stata modificata automaticamente la configurazione remota Supabase né inviata alcuna email. Il template va salvato manualmente nel pannello; il codice del sito resta nella bozza della pull request.

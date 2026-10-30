# Avvio con piani gratuiti — Demand Group Exclusive

Verifica dei piani: 30 ottobre 2026. Obiettivo: **zero canoni aggiuntivi**, mantenendo sito e dominio esistenti, nei limiti dei piani Free. Nessun piano a pagamento o servizio con addebito a consumo va attivato automaticamente. Le quote possono cambiare: controllare il riepilogo del piano in fase di registrazione.

## Cosa serve e quanto costa

| Servizio | Scopo | Piano gratuito verificato e limite rilevante |
|---|---|---|
| GitHub Pages esistente | Catalogo e pannello | Nessun nuovo hosting |
| Supabase Free | Database privato, OTP, funzioni server | 500 MB DB, 50.000 utenti attivi/mese, 500.000 chiamate Edge/mese; 2 progetti attivi; possibile sospensione dopo una settimana di inattività |
| Cloudflare Turnstile Free | Anti-bot | Verifiche illimitate, fino a 20 widget |
| Resend Free | Email con codice OTP tramite SMTP | 3.000 invii/mese, massimo 100/giorno; reinvii e recuperi consumano la quota |
| Mailchimp Free | Newsletter mensile manuale | 250 contatti totali, 500 invii/mese, massimo 250/giorno |
| Brevo Free, alternativa a Mailchimp | Newsletter per una lista più grande | Fino a 100.000 contatti, 300 invii/giorno; le spedizioni più grandi vanno gestite su più giorni secondo le opzioni disponibili |

Esempio: 200 iscritti e una newsletter mensile = 200 invii, nei limiti Mailchimp Free. 700 iscritti non rientrano nel limite contatti Mailchimp Free, anche se scrivi una sola volta al mese. Con un tetto di 300 invii giornalieri, 700 destinatari richiedono almeno tre giornate, considerando anche eventuali altri invii dello stesso servizio.

Le email OTP e la newsletter sono due flussi distinti. Mailchimp Marketing Free non è il servizio SMTP per l’accesso. Il server SMTP predefinito di Supabase è limitato ai destinatari del team e non va usato per i clienti reali: serve un SMTP esterno, che può essere gratuito.

Supabase Free può sospendere progetti inattivi: monitorare gli avvisi, e se necessario riattivare dal pannello prima di distribuire i QR. Non considerare un cron di manutenzione una garanzia contro la sospensione. Non c’è una promessa di disponibilità continua o capacità illimitata sul piano gratuito.

## Passi dell’utente

1. **Supabase** — Accedi a https://supabase.com/dashboard, crea una nuova organizzazione/progetto sul piano **Free**, scegli una regione UE e conserva la password database nel tuo gestore password. Non acquistare Pro o il dominio API personalizzato: non servono per iniziare. Dopo la creazione si possono applicare le tre migrazioni presenti nel repository e creare la campagna reale, inizialmente inattiva.
2. **Email OTP** — Crea un account Resend Free e aggiungi un sottodominio mittente sotto `smokeandthink.com` (ad esempio `notify.smokeandthink.com`, se libero). Hai confermato di avere accesso ai DNS: copia i record indicati da Resend nel pannello del tuo provider e aspetta la conferma “Verified”. Non inventare record TXT/DKIM/SPF: i valori devono provenire dal tuo account Resend. Non occorre acquistare un altro dominio. In Supabase Auth configura Custom SMTP: host `smtp.resend.com`, porta `465`, utente `resend`, password = API key Resend; mittente sul dominio verificato. La chiave va inserita solo nelle impostazioni segrete del servizio, mai nel sito o in chat. Il template email deve contenere `{{ .Token }}` per inviare un codice OTP senza password. Controllare anche il limite orario di Supabase Auth e la consegna reale.
3. **Turnstile** — Crea un account Cloudflare gratuito, apri Turnstile e aggiungi un widget per `demandgroup.smokeandthink.com`. Non serve spostare il sito o i DNS del dominio su Cloudflare. La site key è pubblica; la secret key va solo in Supabase Auth e nei segreti delle Edge Functions. Non incollarla nel repository.
4. **Privacy e campagna** — Fornisci nome/ragione sociale e indirizzo del titolare, email per privacy, date effettive e periodo di conservazione. Sono dati informativi, non un servizio da acquistare. L’informativa preparata deve essere completata e verificata rispetto al titolare e ai fornitori realmente scelti. Per la newsletter il testo indica Mailchimp: se scegli Brevo, aggiorniamo il riferimento prima dell’attivazione. L’iscrizione resta una spunta facoltativa e non preselezionata; il consenso viene registrato solo dopo la verifica email.
5. **Codici veri** — In Google Play Console crea la promozione per ciascuna app a pagamento idonea e scarica i codici monouso con scadenza reale. Prepara gruppi disgiunti, inizialmente 25 Valentina e 25 Sara per quadrante. L’importatore accetta una sola colonna, senza intestazione oppure con intestazione `code`; rimuovere altre colonne dall’export di Play Console se presenti. Conserva i file fuori dal repository e caricali dal pannello privato. Per quadranti già gratuiti basta il link Google Play: non inventare codici.
6. **Amministratore e rilascio** — Verifica l’email amministrativa e abilita il relativo UUID nell’allowlist. Configura chiavi, campagna, funzioni e cleanup secondo `IMPLEMENTAZIONE.md`. Prima prova tutto su un progetto di test. Il merge su `main` pubblica Pages: produzione solo dopo autorizzazione esplicita.

## Come usare la lista newsletter

- Il visitatore può spuntare: “Yes, email me up to once a month about new Demand Group watch faces. I can unsubscribe at any time. Signing up is optional and does not affect my complimentary code.”
- La selezione non è obbligatoria; nessun consenso marketing viene dedotto dalla sola richiesta del codice.
- Dopo OTP il backend registra email verificata, data/ora, testo/versione del consenso e provenienza. Non raccoglie nome, telefono o indirizzo.
- Nel pannello: **Export opted-in emails CSV** esporta solo gli aderenti attivi. Il file include le prove del consenso e la colonna `Email Address`, mappabile in Mailchimp o Brevo. Non caricarlo nel sito pubblico o nel repository.
- **Prima di ogni invio**, esporta anche **Export site withdrawals CSV** e applica quelle disiscrizioni nel servizio email. Conserva e rispetta la suppression list interna del provider: importare il CSV non è una nuova autorizzazione di chi si era già disiscritto lì. Non usare opzioni di riscrizione forzata.
- Nelle newsletter lascia il link di disiscrizione del provider. Dal sito il cliente può ritirare il consenso dopo aver verificato la stessa email. Il ritiro non elimina e non cambia il codice promozionale.
- Non esiste un’integrazione API Mailchimp/Brevo né un invio automatico in questa consegna: esportazione/importazione e invio mensile sono manuali, come richiesto. Le disiscrizioni dei due sistemi vanno allineate prima di spedire.
- Consenso con scadenza a 24 mesi; prima scadenza il cliente può ritirarlo. Gli indirizzi ritirati restano al massimo 30 giorni per l’allineamento delle disiscrizioni; poi il cleanup rimuove email e legame account, conservando una prova pseudonima limitata. La lista marketing è distinta dai dati della campagna e non sparisce dopo i 90 giorni della promozione.

## Recensioni

Dopo l’assegnazione compare un invito a lasciare una **recensione sincera e facoltativa** dopo aver provato il quadrante. Il codice viene consegnato senza chiedere recensioni, voti o prove di recensione, e non dipende dalla loro pubblicazione. Il link apre la scheda corretta su Google Play.

## Fonti ufficiali

- Supabase Free e quote: https://supabase.com/pricing
- Supabase SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Turnstile: https://developers.cloudflare.com/turnstile/plans/
- Resend Free: https://resend.com/pricing
- Resend SMTP: https://resend.com/docs/send-with-smtp
- Verifica dominio mittente: https://resend.com/docs/dashboard/domains/introduction
- Mailchimp Free: https://mailchimp.com/help/about-mailchimp-pricing-plans/
- Brevo Free: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
- Google Play promozioni: https://support.google.com/googleplay/android-developer/answer/6321495
- Google Play recensioni: https://support.google.com/googleplay/android-developer/answer/9898684

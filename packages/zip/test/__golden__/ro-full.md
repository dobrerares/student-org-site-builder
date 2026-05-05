# Publicarea site-ului Asociația Studențească HISTORIPOL pe Cloudflare Pages

Acest document este ghidul de publicare pentru site-ul tău, generat din editor. Sunt documentate două căi: una pentru utilizatori non-tehnici (încărcare directă în panoul Cloudflare) și una pentru utilizatori cu cont GitHub (conectare prin Git).

Site-ul tău a fost construit pentru `https://historipol.ro`. Asigură-te că adresa publică finală (fie `*.pages.dev`, fie domeniul personalizat) corespunde cu această valoare. Dacă decizi altă adresă, re-exportă din editor cu noul `siteUrl` pentru ca link-urile canonice și sitemap-ul să fie corecte.

## Ce îți trebuie

- Un cont gratuit pe [Cloudflare](https://dash.cloudflare.com/sign-up) (la momentul scrierii, planul Free este suficient pentru un site de organizație studențească).
- Folderul `dist/` din zip-ul exportat — acesta este site-ul tău complet, gata de publicat.
- (Opțional) Un domeniu personalizat (ex. `historipol.ro`) dacă vrei o adresă proprie.

## Calea 1: Încărcare directă (recomandată dacă nu ai cont GitHub)

Această cale folosește panoul Cloudflare pentru a încărca site-ul construit. Nu ai nevoie de Git, GitHub sau de linia de comandă.

1. Autentifică-te în [panoul Cloudflare](https://dash.cloudflare.com/) și deschide secțiunea **Workers & Pages** din meniul lateral.
2. Apasă **Create application** → fila **Pages** → **Upload assets**.
3. Dă un nume proiectului (ex. `historipol-site`). Acesta devine subdomeniul implicit, de forma `historipol-site.pages.dev`.
4. Trage și plasează folderul `dist/` (sau apasă **Select from computer** și alege-l). Așteaptă ca toate fișierele să fie încărcate.
5. Apasă **Deploy site**. În câteva secunde, site-ul va fi accesibil la `https://<numele-tău>.pages.dev`.
6. Pentru actualizări, repetă pașii 4–5 în același proiect: încarcă noul folder `dist/` și Cloudflare va publica versiunea nouă.

![Panoul Cloudflare cu butonul Create application evidențiat](docs/deploy/screenshots/01-direct-upload-create-application.png)

![Zona de drag-and-drop pentru folderul dist](docs/deploy/screenshots/02-direct-upload-drop-dist.png)

![Confirmarea publicării cu URL-ul *.pages.dev](docs/deploy/screenshots/03-direct-upload-deployed.png)

## Calea 2: Conectat prin Git (recomandată dacă ai deja un repository GitHub)

Această cale conectează un repository GitHub la Cloudflare Pages. La fiecare commit pe ramura principală, Cloudflare publică automat versiunea actualizată. Nu există un pas separat de construire — site-ul tău este deja static; Cloudflare îl servește direct din `dist/`.

1. Creează un repository GitHub și încarcă conținutul folderului `dist/` la rădăcina repository-ului. (Alternativ: încarcă întregul zip exportat și marchează `dist/` ca folder de output mai jos.)
2. În [panoul Cloudflare](https://dash.cloudflare.com/), deschide **Workers & Pages** → **Create application** → fila **Pages** → **Connect to Git**.
3. Autorizează Cloudflare să acceseze repository-urile tale GitHub (o singură dată per cont) și selectează repository-ul site-ului.
4. La pasul **Set up builds and deployments**, lasă **Build command** gol (site-ul este deja construit) și setează **Build output directory** la `/` dacă ai încărcat doar `dist/`, sau la `dist` dacă ai încărcat tot zip-ul.
5. Apasă **Save and Deploy**. Cloudflare va clona repository-ul și va publica site-ul la `https://<numele-tău>.pages.dev`.
6. La fiecare push pe ramura principală, Cloudflare publică automat versiunea nouă. Branch-urile non-principale primesc deploy-uri de previzualizare la URL-uri unice — utile pentru a vedea modificările înainte de a le îmbina.

![Ecranul de autorizare GitHub pentru Cloudflare Pages](docs/deploy/screenshots/04-git-connect-authorize.png)

![Setările de build cu Build output directory completat](docs/deploy/screenshots/05-git-connect-build-settings.png)

![Lista de deploy-uri cu commit-uri și URL-uri unice](docs/deploy/screenshots/06-git-connect-deployed.png)

## Domeniu personalizat (opțional)

Subdomeniul `*.pages.dev` funcționează imediat, dar majoritatea organizațiilor preferă un domeniu propriu, de tip `historipol.ro`. Conectarea se face în două etape: configurarea DNS și activarea HTTPS.

### Pasul 1: configurarea DNS (CNAME)

În proiectul Pages, deschide fila **Custom domains** → **Set up a custom domain** și introdu `historipol.ro`. Cloudflare îți va arăta o înregistrare CNAME de adăugat la furnizorul tău DNS — de regulă `<domeniul-tău>` cu valoare `<numele-proiectului>.pages.dev`. Adăugarea se face în panoul registrarului tău (GoDaddy, Namecheap, RoTLD etc.). Propagarea DNS poate dura între câteva minute și câteva ore.

Dacă domeniul tău este deja gestionat în Cloudflare (transferat ca nameserver), pașii sunt automatizați: bifezi domeniul în lista din panou și înregistrarea CNAME se adaugă singură.

### Pasul 2: activarea HTTPS (TLS)

După ce CNAME-ul propagă, Cloudflare emite automat un certificat TLS gratuit (Let's Encrypt sau Cloudflare Origin CA, în funcție de configurație). HTTPS devine activ în câteva minute după ce domeniul apare ca **Active** în panou. Nu este nevoie să copiezi sau să încarci vreun certificat manual.

Verifică că `https://<domeniul-tău>` se deschide fără avertismente de securitate înainte de a anunța public adresa.

## Ce urmează după publicare

- Trimite adresa publică membrilor și verifică că totul se vede corect pe telefon și pe desktop.
- Salvează zip-ul exportat într-un loc sigur (Drive, e-mail) — este sursa unică de adevăr a site-ului tău.
- La predarea către conducerea următoare, dă-le zip-ul plus acest fișier — au tot ce le trebuie pentru a continua.

---

Generat automat de editor. Dacă pașii din panoul Cloudflare arată diferit, consultă [documentația oficială Cloudflare Pages](https://developers.cloudflare.com/pages/) — este mai actualizată decât acest fișier.

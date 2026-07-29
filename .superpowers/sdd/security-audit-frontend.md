# Security Audit Report: NetViren Frontend

**Date:** 2026-07-29  
**Scope:** `packages/frontend/` and `packages/api/` (auth-relevant parts)  
**Severity Scale:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## 1. Auth-Flow (`packages/frontend/src/app/(auth)/login/page.tsx`)

### 1.1 JWT-Speicherung: localStorage (CRITICAL)

```typescript
localStorage.setItem('token', data.token);       // Zeile 39
localStorage.setItem('user', JSON.stringify(data.user)); // Zeile 40
```

**Problem:** Das JWT-Token wird im Klartext in `localStorage` gespeichert.
- `localStorage` ist fuer jede JavaScript-Ausfuehrung im selben Origin zugaenglich.
- Bei einem XSS-Angriff kann ein Angreifer `localStorage.getItem('token')` auslesen und das Token stehlen.
- Ein httpOnly-Cookie waere resistent gegen XSS, da es vom Browser gesperrt ist.

**Empfehlung:**
- Der Server sollte das JWT in einem httpOnly, Secure, SameSite=Strict Cookie setzen (via `Set-Cookie` Header).
- Alternativ: Der Server schreibt das Cookie bei erfolgreichem Login, sodass der Client es nie in JS-Haenden sieht.
- Der API-Client liest das Token dann aus dem Cookie (automatisch vom Browser gesendet).

### 1.2 User-Objekt im localStorage (MEDIUM)

```typescript
localStorage.setItem('user', JSON.stringify(data.user));
```

Neben dem Token wird auch das gesamte User-Objekt in localStorage abgelegt. Dies enthaelt `id`, `username`, `email`, `role`, `avatarUrl`. Auch dies ist durch XSS gefaehrdet. Das User-Objekt sollte nachgeladen werden (`GET /api/me`) und nicht dauerhaft gespeichert werden, um Inkonsistenzen mit dem Backend zu vermeiden.

### 1.3 Fehlgeschlagener Login: Timing Attack (INFO)

```typescript
if (!res.ok) {
  setError(t('auth.error_invalid'));
  return;
}
```

Bei Fehlschlag wird eine generische Fehlermeldung angezeigt (`error_invalid`), die sowohl bei falschem Benutzernamen als auch bei falschem Passwort erscheint. **Das ist gut** -- es verhindert User-Enumeration.

**Allerdings:** Eine Timing-Attacke waere theoretisch moeglich, da der Server bei existierendem User einen bcrypt-Vergleich durchfuehrt (laenger), bei nicht-existierendem User sofort zurueckgibt. In der Praxis ist dies bei einem lokalen Netzwerk-Setup vernachlaessigbar.

### 1.4 API-Proxy Umgehung (MEDIUM)

Der Login-Request geht an `/api/auth/login`, was via Next.js Rewrite an `http://localhost:4000/api/auth/login` weitergeleitet wird. Der Server ist per CORS auf `FRONTEND_URL` beschraenkt, aber da der Rewrite serverseitig erfolgt, gibt es keine CORS-Beschraenkung. Dies ist korrekt.

### 1.5 OAuth-Buttons: Non-Functional (HIGH)

```typescript
onClick={() => window.open('/api/auth/google', '_self')}  // Zeile 134
onClick={() => window.open('/api/auth/github', '_self')}  // Zeile 162
```

Beide OAuth-Buttons navigieren zu Endpunkten (`/api/auth/google`, `/api/auth/github`), die **nicht implementiert** sind. Es existieren weder Route-Handler auf dem Fastify-Server noch NextAuth-API-Routen. Die Navigation fuehrt zu 404-Fehlern. Das gaengelt den Benutzer lediglich, ist aber kein Sicherheitsproblem an sich.

---

## 2. API-Proxy Rewrites (`packages/frontend/next.config.ts`)

```typescript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:4000/api/:path*',
    },
  ];
},
```

### 2.1 Offene Redirects (KEINE)

Die Destination ist hartkodiert auf `http://localhost:4000/api/:path*`. Es werden keine Query-Parameter oder Header zur Zielbestimmung verwendet. Kein offener Redirect moeglich.

### 2.2 Keine Sicherheits-Header-Konfiguration (MEDIUM)

`next.config.ts` hat **keine** `async headers()`-Konfiguration. Es werden keine Security-Header gesetzt:
- **Kein `Content-Security-Policy`** (ermoeglicht XSS-Ausfuehrung)
- **Kein `X-Content-Type-Options: nosniff`** (ermoeglicht MIME-Sniffing)
- **Kein `X-Frame-Options`** (ermoeglicht Clickjacking)
- **Kein `Strict-Transport-Security`** (HSTS)

**Empfehlung:** `headers()` in `next.config.ts` ergaenzen:

```typescript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ];
}
```

Eine CSP sollte ebenfalls ergaenzt werden, ist aber stark von der konkreten Anwendung abhaengig.

### 2.3 Server Actions Body Size Limit (INFO)

```typescript
experimental: { serverActions: { bodySizeLimit: '50mb' } }
```

50 MB ist sehr gross fuer Server Actions. Falls Datei-Uploads ueber Server Actions geplant sind, sollte geprueft werden, ob ein anderer Mechanismus (API-Route, direkter Fetch) sinnvoller ist.

---

## 3. Middleware (`packages/frontend/src/middleware.ts`)

### 3.1 Auth-Check prüft falsche Cookies (CRITICAL)

```typescript
const token = req.cookies.get('next-auth.session-token')?.value
  || req.cookies.get('__Secure-next-auth.session-token')?.value;
```

**Die Middleware ist defekt.** Sie prueft auf zwei Cookie-Namen aus NextAuth (`next-auth.session-token` und `__Secure-next-auth.session-token`), aber:

1. **Die Login-Seite verwendet kein NextAuth.** Sie macht einen manuellen `fetch()` und speichert das Token in `localStorage`.
2. **Es existiert keine NextAuth-Konfiguration** (`auth.ts`, `authOptions`, `[...nextauth]` Route Handler) im gesamten Projekt.
3. **`SessionProvider` in `providers.tsx` ist nutzlos** ohne eine NextAuth-Konfiguration -- es wird nie eine Session bereitstellen.
4. **Die Middleware kann nicht auf `localStorage` zugreifen** -- es laeuft serverseitig.

**Konsequenz:** Der Token-Check der Middleware schlaegt IMMER fehl, weil die Cookies nie gesetzt werden. Der Redirect zu `/login` bei geschuetzten Routen ist also das Standardverhalten. Allerdings:

```typescript
if (!token && !path.startsWith('/login')) {
  return NextResponse.redirect(new URL('/login', req.url));
}
```

**Dies erzeugt eine unendliche Redirect-Schleife fuer /de/login etc.** wegen des i18n-Locale-Prefixes (die Middleware checkt `path.startsWith('/login')` aber die tatsaechliche URL ist `/de/login`).

### 3.2 Matcher schliesst API-Routen aus (HIGH)

```typescript
matcher: ['/((?!api|_next|_next/static|_next/image|favicon.ico).*)'],
```

API-Routen (`/api/*`) sind vom Matcher ausgeschlossen. Da die Middleware aber eh keine Token-Pruefung durchfuehrt (siehe 3.1), ist dies aktuell nicht kritisch. Wenn die Middleware repariert wird, MUSS `/api` ebenfalls vom Matcher ausgeschlossen bleiben, da API-Routen server-seitig via `authMiddleware` geschuetzt sind.

### 3.3 Empfehlung: Auth-Flow komplett ueberarbeiten

Entweder:
1. **NextAuth komplett einbinden** (auth.ts, Route Handler, signIn/signOut) und Cookies nutzen, ODER
2. **Benutzerdefiniertes Session-Cookie** vom Server setzen lassen und Middleware auf dieses Cookie pruefen, ODER
3. **JWT in httpOnly Cookie** speichern (auf API-Seite via Fastify `Set-Cookie` Header).

---

## 4. API-Client (`packages/frontend/src/lib/api-client.ts`)

### 4.1 Fehlende 401/401-Behandlung (HIGH)

```typescript
if (!res.ok) {
  const err = await res.json().catch(() => ({ message: res.statusText }));
  throw new Error(err.message || 'API Error');
}
```

**Probleme:**
- Bei 401 (Unauthorized) oder 403 (Forbidden) wirft der Client einen generischen Fehler.
- **Es erfolgt keine Weiterleitung zur Login-Seite.**
- Bei abgelaufenem Token bleibt der Benutzer auf der Dashboard-Seite mit toten Daten haengen.
- Es gibt keinen zentralen Error-Handler.

**Empfehlung:** Eine `fetchApi`-Wrapper-Funktion, die bei 401 automatisch auf `/login` weiterleitet:

```typescript
if (res.status === 401) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
  throw new Error('Session expired');
}
```

### 4.2 Kein Token-Refresh-Mechanismus (HIGH)

Der Server stellt JWT-Tokens mit **7 Tagen Ablaufzeit** aus. Es gibt keinen Refresh-Mechanismus:
- Kein `refresh_token` Endpunkt auf dem Server.
- Keine automatische Erneuerung im Client.
- Nach 7 Tagen Ablauf muessen sich Benutzer erneut einloggen.
- **Kein Token-Rotation** (dasselbe Token gilt bis zum Ablauf).

**Empfehlung:** Einen Refresh-Token-Mechanismus implementieren:
- `POST /api/auth/refresh` Endpunkt auf dem Server.
- Kurzlebiges Access-Token (z.B. 15 Minuten).
- Langlebiges Refresh-Token (z.B. 30 Tage) als httpOnly Cookie.
- Interceptor im API-Client, der bei 401 automatisch refresh versucht.

### 4.3 Upload-Endpunkt: Keine clientseitige Validierung (MEDIUM)

```typescript
upload: async (path: string, formData: FormData) => {
  const token = localStorage.getItem('token');
  const res = await fetch(path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}
```

- **Keine Dateigroessenbeschraenkung** auf Client-Seite.
- **Kein Dateityp-Check** auf Client-Seite.
- Der Server ist via `@fastify/multipart` auf 500 MB begrenzt -- akzeptabel.
- Es fehlen konkrete Dateigroessen- und Typpruefungen im Server (`fileSize: 500 * 1024 * 1024` ist sehr grosszuegig).

### 4.4 Token-Header bei Upload (MEDIUM)

Bei `upload()` wird der `Content-Type` nicht explizit gesetzt (der Browser setzt `multipart/form-data` mit Boundary). Das ist korrekt fuer Datei-Uploads. Allerdings ueberschreiben die `headers` in `fetch(path, { headers })` nicht den automatisch gesetzten `Content-Type`, da `fetch()` in HTML-Standard `multipart/form-data` requests den Content-Type automatisch mit Boundary setzt, und manuelles Setzen wuerde die Boundary entfernen.

### 4.5 Optionale Headers-Override fuer 401-Umgehung (INFO)

```typescript
headers: {
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...options?.headers,
},
```

Die Spread-Notation (`...options?.headers`) erlaubt es Aufrufern, den Authorization-Header zu ueberschreiben. Das ist zwar beabsichtigt, aber ein Token-Jacking-Szenario ueber manipulierte Aufrufe ist kaum relevant, da die Aufrufe nur aus dem eigenen Code kommen.

---

## 5. UI-Sicherheit

### 5.1 XSS: User-Input wird korrekt escaped (OK)

- **Kein `dangerouslySetInnerHTML`** im gesamten Frontend-Code.
- **Kein `eval` oder `new Function`**.
- **Keine direkten DOM-Manipulationen** (`document.write`).
- React escapt per Default alle String-Outputs.
- Alle Daten werden via JSX-Variablen gerendert: `{alert.title}`, `{device.ip}`, etc.

**Bewertung:** Das XSS-Risiko durch Frontend-Code ist aktuell gering.

### 5.2 Aktuell nur Mock-Daten (INFO)

Saemtliche Dashboard-Seiten verwenden hartkodierte Mock-Daten (`mockDevices`, `mockAlerts`, etc.). Es gibt keine Verbindung zur API ueber den `api-client.ts`. Sobald echte API-Responses verwendet werden, muss die gleiche Sorgfalt bei der Darstellung gelten: Kein HTML-Rendering von API-Werten.

### 5.3 Kein CSRF-Schutz (HIGH)

- **Kein CSRF-Token** auf der Login-Seite.
- **Kein `SameSite`** Cookie (da keine Cookies verwendet werden -- aber Saetze fuer zukuenftige Cookie-basierte Auth).
- **Kein `Origin`/`Referer`-Check** auf dem Server.
- **`credentials: true`** in CORS bedeutet, dass Cookies gesendet werden duerfen -- aktuell irrelevant, aber bei zukuenftiger Cookie-Auth zu beachten.

**Empfehlung:** Wenn zukuenftig Cookies verwendet werden, `SameSite=Strict` setzen und auf CSRF-Tokens verzichten (SameSite=Strict verhindert CSRF ausreichend).

### 5.4 Fehlende Sicherheits-Header (MEDIUM)

Siehe Punkt 2.2. Die Frontend-Applikation setzt keinerlei Security-Header. Bei einer spaeteren Proxy-Konfiguration (Nginx) sollten diese Header dort gesetzt werden.

---

## 6. Server-Side Auth (Backend Findings mit Frontend-Relevanz)

### 6.1 JWT-Konfiguration (MEDIUM)

```typescript
return jwt.sign(payload, getEnv().AUTH_SECRET, { expiresIn: '7d' });
```

- HS256 (Default) -- bei 7d Exipration akzeptabel fuer lokale Netzwerke.
- **Kein Token-Rotation**, kein Refresh-Token.
- Entwicklungsumgebung (`packages/api/.env`): `AUTH_SECRET=super-secret-key-that-is-at-least-32-chars-long!!`
- Dieser Key ist in der Versionskontrolle (committed in `packages/api/.env`) -- ein Leak eines Development-Secrets.

### 6.2 Rate Limiting (MEDIUM)

```typescript
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
```

Eine pauschale Rate-Limite von 100 Requests/Minute fuer die gesamte API. Das ist kein spezifischer Brute-Force-Schutz fuer den Login-Endpunkt. Ein Angreifer koennte ca. 1-2 Login-Versuche pro Sekunde durchfuehren.

**Empfehlung:** Spezifisches Rate-Limiting fuer `/api/auth/login` (z.B. 5 Versuche/Minute/IP).

### 6.3 SSRF-Risiko via VirusTotal API (MEDIUM)

```typescript
const url = type === 'hash'
  ? `${env.VT_API_URL}/files/${value}`         // value ist User-Input
  : type === 'url'
    ? `${env.VT_API_URL}/urls/${Buffer.from(value).toString('base64url')}`
```

Der `value` Parameter ist User-Input und wird direkt in eine URL interpoliert. Der `type` Parameter ist auf bekannte Werte beschraenkt, aber der `value`-Parameter hat keine Validierung. Bei einem SSRF-Angriff koennte `value` auf einen lokalen Dienst zeigen (z.B. `../../../../internal/service`).

---

## 7. Gesamtbewertung

| Kategorie | Rating | Kritische Funde |
|-----------|--------|----------------|
| Token Storage | CRITICAL | JWT in localStorage statt httpOnly Cookie |
| Auth Middleware | CRITICAL | Middleware prueft falsche Cookies, funktioniert nicht |
| Session Management | HIGH | Kein Refresh/Invalidation-Mechanismus |
| 401 Handling | HIGH | API-Client leitet nicht bei abgelaufenen Sessions weiter |
| CSRF-Schutz | HIGH | Nicht vorhanden |
| Sicherheits-Header | MEDIUM | Fehlen vollstaendig |
| OAuth Integration | HIGH | Buttons vorhanden, Backend nicht implementiert |
| Rate Limiting | MEDIUM | Kein Login-spezifischer Brute-Force-Schutz |
| XSS | LOW | React Default-Sicherheit ausreichend, keine dangerouslySetInnerHTML |

### Zusammenfassung der kritischsten Massnahmen:

1. **Auth-Flow reparieren:** Entweder NextAuth vollstaendig integrieren oder auf eine konsistente Cookie-basierte Auth umstellen. Der aktuelle Dual-Ansatz (NextAuth-Cookies in Middleware + localStorage-Token in Login) ist gebrochen.

2. **JWT in httpOnly Cookie speichern:** Keine sensiblen Tokens im localStorage, der per XSS auslesbar ist.

3. **401-Interceptor implementieren:** API-Client muss bei 401 automatisch auf Login weiterleiten.

4. **Security-Header in next.config.ts:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` setzen.

5. **Login-spezifisches Rate-Limiting** auf dem API-Server implementieren.

6. **Middleware-Logik korrigieren:** Entweder i18n-Praefix beachten (`path.startsWith('/de/login')`) oder auf das korrekte Authentifizierungs-Cookie prufen.

7. **Development-Environment aus der Versionierung nehmen:** `packages/api/.env` sollte in `.gitignore` aufgenommen werden.

---

*Audit durchgefuehrt am 2026-07-29. Grundlage: Code-Analyse von `packages/frontend/` und `packages/api/`.*

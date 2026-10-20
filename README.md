# RGS Property Management System — MERN edition

The same RGS system (lands, malls, sections, rooms, **halls**, apartments, tenants, monthly rent, payments, receipts, expenses, **HR / salaries**, reports, monthly statements, roles) rebuilt with the **MERN stack**:

| Part | Technology | Folder |
|---|---|---|
| **M**ongoDB | Database (MongoDB Atlas or your own server), via **Mongoose** | `server/src/models.js` |
| **E**xpress | REST API (`/api/...`) | `server/src/routes/` |
| **R**eact | The screens (single-page app, built with **Vite**) | `client/src/` |
| **N**ode.js | Runs the server (Node 20 or newer) | `server/` |

Same business rules as the PHP version: Paid / Partial / Unpaid, remaining balance, a month's rent is kept from its first payment, automatic month closing with statements, arrears, mall income, sections, expenses and net income, and the Admin / Editor / Cashier roles. Same RGS logo and colours (navy `#1B2C4E`, green `#36B753`).

---

## 1. What you need

- **Node.js 20 or newer** — https://nodejs.org (LTS)
- **A MongoDB database** — on your laptop install **MongoDB Community Server** (https://www.mongodb.com/try/download/community, tick *Install as a Service*) and use `MONGODB_URI=mongodb://127.0.0.1:27017/rgs`; for the live server the easiest is **MongoDB Atlas** (free tier): https://www.mongodb.com/atlas
  1. Create a free cluster.
  2. *Database Access*: add a user + password.
  3. *Network Access*: allow your server's IP (or `0.0.0.0/0` while testing).
  4. *Connect › Drivers*: copy the connection string, e.g. `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/rgs`



## 2. Run it on your computer

```bash
# 1. install packages (server + client)
npm run install-all

# 2. settings
cp server/.env.example server/.env      # Windows: copy server\.env.example server\.env
#    edit server/.env: MONGODB_URI and JWT_SECRET (any long random text)

# 3. demo data (DELETES everything in that database first)
npm run seed

# 4. start (two terminals)
npm run dev:server      # API on http://localhost:5000
npm run dev:client      # app on http://localhost:5173  <- open this
```

Demo logins (change them after the first login):

| Role | Username | Password | Can do |
|---|---|---|---|
| Admin | `admin` | `Admin@123` | Everything, including deleting and managing users |
| Editor | `editor` | `Editor@123` | Everything (incl. HR and salaries) except deleting, undoing payments and managing users |
| Cashier | `cashier1`, `cashier2` | `Cashier@123` | Record payments, receipts, add expenses, monthly report (no HR) |

**Start with an empty system instead of demo data:**
```bash
npm run create-admin --prefix server -- --username admin --password "YourStrongPassword" --name "Office Admin"
```

### Test accounts on the login page

With `SHOW_DEMO_LOGINS=true` in `server/.env` (the default in `.env.example`), the login page lists the demo accounts — click one to fill in the username and password:

| Username | Password | Role | Can |
|---|---|---|---|
| admin | Admin@123 | Administrator | Everything, including users, settings and deleting |
| editor | Editor@123 | Editor | Add and edit everything, HR and reports — cannot delete or manage users |
| cashier1 / cashier2 | Cashier@123 | Cashier | Record payments, receipts, expenses and the monthly report |

These accounts exist only after `npm run seed`. **On the live server set `SHOW_DEMO_LOGINS=false` and change every password.**

## 3. Run it in production (one server)

```bash
npm run install-all
npm run build          # builds the React app into client/dist
npm start              # Express serves the API AND the React app on PORT
```
In `server/.env` set `NODE_ENV=production`, a strong `JWT_SECRET` (32+ characters) and your `MONGODB_URI`.

## 4. Deploy

### Option A — Render + MongoDB Atlas (recommended, has a free tier)
1. Put this folder in a GitHub repository (private).
2. render.com › **New + › Blueprint** › choose the repository (uses `render.yaml`), **or** New + › Web Service with
   - Build command: `npm run install-all && npm run build`
   - Start command: `npm start`
3. Environment: `MONGODB_URI` = your Atlas string, `JWT_SECRET` = long random text, `NODE_ENV=production`, `TZ=Africa/Mogadishu`.
4. Open the URL Render gives you. Add your own domain in Render › Settings › Custom Domains (point the domain's DNS at Render from Namecheap › Advanced DNS).
5. Load data once from your computer: set the same `MONGODB_URI` in `server/.env` and run `npm run seed` (demo) or `create-admin` (empty).

Every push to GitHub redeploys automatically.

### Option B — VPS (Namecheap VPS, DigitalOcean, …)
Install Node 20, clone the repo, `npm run install-all && npm run build`, create `server/.env`, keep it running with **pm2** (`npm i -g pm2 && pm2 start "npm start" --name rgs`), and put **nginx** in front with HTTPS (Let's Encrypt).

### Option C — Namecheap shared hosting
Only works if your plan has **cPanel › Setup Node.js App**. Create an app (Node 20, application root = this folder, startup file `server/src/index.js`), add the environment variables there, run `npm run install-all && npm run build` from the cPanel terminal, then restart the app. If your plan has no Node.js support, use Option A — or keep using the PHP version, which runs on any shared hosting.

## 5. Halls and HR

**Halls (Mumtaaz Mall: Hall A and Hall B).** A hall is rented every month like a room: assign a tenant, record payments, print receipts. Hall rent counts as the mall's income. On the mall page the **Halls** card lists the halls with their tenant and this month's status; **Add hall** adds another (type `C` → *Hall C*). Halls have no section and are counted separately from rooms (dashboard: *Halls: x occupied, y vacant*). The demo data gives each hall an example rent of **$500 / month** — open the hall › **Edit** to set the real rent.

**HR (menu › HR (Staff)).** Like the HRM sheet: one block per department (MANAGEMENT, SECURITY, CLEANING, + any you add) with **Name, Title, Phone, Salary**, a **TOTAL** for each department and the **ALL TOTAL** at the bottom. Choose a month to see that month's payroll; Print and Excel / CSV are on the page.
- Salaries are a monthly cost: the dashboard, Expenses page, Monthly report and monthly statements show **Net income = rent collected − expenses − salaries**.
- When someone leaves, set **Left on** (instead of deleting) so past months keep the right total. A new person counts from the month in **Started on**.
- Admin and Editor can open HR and add / edit staff; only the Admin can delete. Cashiers cannot see HR.
- The demo staff names are examples — replace them with your real staff.

**Database installed before halls and HR?** Run once: `npm run upgrade --prefix server` (adds Hall A and Hall B to Mumtaaz Mall and the three HR departments). Add `-- --hall-rent 800` to set the halls' rent.

**Profit / loss.** Every month: *rent collected − all expenses dated in that month − salaries of all staff on the payroll that month* (`server/src/lib/finance.js`, used by the dashboard, Expenses page and reports). A profit is shown in green, a loss in red.

## 6. Project structure

```
server/
  src/index.js            start: connect MongoDB, listen
  src/app.js              Express app: security headers, CSRF check, routes, serves client/dist
  src/models.js           MongoDB collections (Mongoose)
  src/lib/rent.js         RENT ENGINE — all rent rules (pure functions, unit-tested)
  src/lib/closings.js     automatic month closing + statements
  src/lib/auth.js         passwords (scrypt), login token (JWT in httpOnly cookie), roles
  src/routes/             auth, meta+dashboard, rent+payments, properties (malls, sections, rooms, halls), tenants, expenses, hr, reports, admin
  src/lib/hr.js           monthly salary total (who is on the payroll in a month)
  src/seed/               demo data, create-admin, upgrade (adds halls + HR departments to an existing database)
  test/rent.test.js       unit tests:  npm test
client/
  index.html, vite.config.js
  public/img/             RGS logo, favicon
  src/App.jsx             routes
  src/components/         Layout (sidebar, top bar), UI kit, charts, unit panel, tenant picker
  src/pages/              Dashboard, Rent (collection, record payment, payments, receipt, history),
                          Malls (+ sections, halls), Rooms, Units (apartments, lands), Tenants, Expenses, HR, Reports, Admin
render.yaml               optional Render blueprint
```

## 7. Security

- Passwords hashed with **scrypt** (Node built-in), never stored in plain text.
- Login token is a signed **JWT** in an **httpOnly, SameSite=Lax** cookie (Secure in production), valid 12 hours.
- **CSRF protection**: every change must be a JSON request with the `X-Requested-With: RGS` header (other websites cannot send it).
- 5 wrong passwords from one IP → locked for 15 minutes.
- Every API route checks the user's role on the server (the screens only hide buttons).
- Database queries use Mongoose with fixed field names (no string-built queries).

## 8. Notes

- **Month closing** happens automatically on the first request of a new month (no cron job). Late payments for a closed month are allowed; admins/editors can press **Update statement**.
- **Moving data from the PHP version**: the two versions use different databases (MySQL vs MongoDB). A one-time import script can be written when you are ready to switch.
- `server/.env` holds your secrets — it is in `.gitignore`, never commit it.

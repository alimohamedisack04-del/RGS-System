# RGS (MERN) — Local → GitHub → Live

```
1. LOCAL    your laptop  : Node + MongoDB on your PC        → http://localhost:5173
2. GITHUB   private repo : stores the code (never .env)
3. LIVE     Render + MongoDB Atlas (free) → https://rgs-property-management.onrender.com
            optional: your Namecheap domain, e.g. https://rgs.yourdomain.com
```

---

## 1. Test on your laptop

**Install once**
- Node.js 20 LTS — https://nodejs.org
- MongoDB Community Server — https://www.mongodb.com/try/download/community (tick *Install MongoDB as a Service*)
- Git — https://git-scm.com/downloads

**Run**
1. Unzip `rgs-mern.zip` (e.g. to `Documents\rgs-mern`). Open a terminal in that folder (in Explorer: right-click the folder › *Open in Terminal*).
2. Install packages:
   ```
   npm run install-all
   ```
3. In `server`, copy `.env.example` to `.env` (already set for your laptop: local MongoDB, `SHOW_DEMO_LOGINS=true`).
4. Load the demo data (creates admin, editor, cashier1, cashier2):
   ```
   npm run seed
   ```
5. Start — two terminals, both in the `rgs-mern` folder:
   ```
   npm run dev:server
   ```
   ```
   npm run dev:client
   ```
6. Open **http://localhost:5173**, click a test account, sign in.

**Check before going further:** log in as admin, editor and cashier1; record a payment; add an expense and a staff member and see the dashboard profit/loss change.

**Optional — test exactly like the live site (one server):**
```
npm run build
npm start
```
Open **http://localhost:5000**.

| Problem | Fix |
|---|---|
| `Could not start the server: connect ECONNREFUSED 127.0.0.1:27017` | MongoDB is not running: Windows › Services › *MongoDB Server* › Start |
| `'npm' is not recognized` | Install Node.js, then close and reopen the terminal |
| Login says *Wrong username or password* | Run `npm run seed` first |
| *Too many failed attempts* | Wait 15 minutes, or restart `npm run dev:server` |

---

## 2. Put the code on GitHub

1. https://github.com › **New repository** › name `rgs-mern` › **Private** › do *not* add a README › **Create**.
2. In the `rgs-mern` folder (the zip already contains the Git history):
   ```
   git remote add origin https://github.com/YOUR-USERNAME/rgs-mern.git
   git branch -M main
   git push -u origin main
   ```
   The first push opens a GitHub sign-in window.
3. Refresh the repo page — you should see `client`, `server`, `render.yaml`, `README.md`. **`server/.env` must NOT be there** (`.gitignore` keeps it out).

**Every change after that:**
```
git add -A
git commit -m "what you changed"
git push
```
Render (step 3) redeploys automatically on every push.

---

## 3. Go live

### 3a. Database — MongoDB Atlas (free)
1. https://www.mongodb.com/atlas › sign up › create a **free M0** cluster (region close to you, e.g. Frankfurt or Mumbai).
2. **Database Access** › Add user, e.g. `rgsapp` with a strong password (letters and numbers only is easiest).
3. **Network Access** › Add IP › **Allow access from anywhere** (`0.0.0.0/0`) — Render has changing IPs.
4. **Connect › Drivers** › copy the string and put the password and database name in it:
   ```
   mongodb+srv://rgsapp:PASSWORD@cluster0.xxxxx.mongodb.net/rgs?retryWrites=true&w=majority
   ```

### 3b. App — Render (free)
1. https://render.com › sign up **with GitHub** › allow access to the `rgs-mern` repo.
2. **New + › Blueprint** › pick `rgs-mern` › Render reads `render.yaml`.
3. When asked for `MONGODB_URI`, paste the Atlas string from 3a › **Apply**.
4. Wait for *Deploy live* (5–10 min the first time). Your site: `https://rgs-property-management.onrender.com`.

### 3c. Create the users on the live database (once)
**Easiest:** when Render asks for `ADMIN_PASSWORD`, type your admin password (8+ characters). On the first start the server creates the administrator `admin` automatically (only when the database has no users). Then log in and add the editor and cashier users in *Users*. You can skip the laptop method below.

**Laptop method:**
On your laptop, temporarily point `server/.env` at Atlas:
```
MONGODB_URI=mongodb+srv://rgsapp:PASSWORD@cluster0.xxxxx.mongodb.net/rgs?retryWrites=true&w=majority
```
Then choose one:
- **Real start (recommended):** empty system + one admin with your own password
  ```
  npm run create-admin --prefix server -- --username admin --password "YourStrongPassword" --name "Office Admin"
  ```
  Then in the live site add the malls, sections, rooms, tenants and the editor/cashier users (*Users* menu).
- **Demo first:** `npm run seed` loads the demo data; change every password afterwards (*Users › Edit*).

Switch `server/.env` back to `mongodb://127.0.0.1:27017/rgs` so laptop tests never touch live data.

### 3d. Your Namecheap domain (optional)
1. Render › your service › **Settings › Custom Domains** › add `rgs.yourdomain.com`.
2. Namecheap › Domain List › **Manage › Advanced DNS** › **Add record**: type `CNAME`, host `rgs`, value `rgs-property-management.onrender.com`.
3. Wait 10–60 minutes; Render issues the HTTPS certificate automatically.

### Live checklist
- [ ] `SHOW_DEMO_LOGINS` is `false` on Render (already set in `render.yaml`) — the login page shows no test accounts
- [ ] Every demo password changed, or demo users removed
- [ ] Atlas user password is strong; `server/.env` is not on GitHub
- [ ] Logged in as each role on the live site

**Note:** Render's free plan sleeps after 15 minutes without visitors; the first visit then takes about a minute. The *Starter* plan (about $7/month) stays awake — recommended once RGS staff use it daily.

---

## Alternative: Namecheap cPanel instead of Render
Only if your Namecheap plan has **cPanel › Setup Node.js App** (Node 20+):
1. Upload the code (or *Git Version Control* › clone from GitHub).
2. Setup Node.js App › Node 20, application root = the `rgs-mern` folder, startup file `server/src/index.js`.
3. Add the variables: `NODE_ENV=production`, `MONGODB_URI` (Atlas), `JWT_SECRET` (40+ random characters), `TZ=Africa/Mogadishu`, `SHOW_DEMO_LOGINS=false`.
4. *Run NPM Install*, then in the cPanel terminal: `npm run install-all && npm run build` › **Restart**.
Updates here are manual (pull + build + restart). If your plan has no Node.js, use Render.

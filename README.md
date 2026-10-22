# Apex Auto Logistics & Dispatch (`apex-dispatch`)

A stealth private media gallery disguised as an **Auto Transport & Vehicle Logistics** commercial portal.

---

## 🔒 Stealth & Security Architecture

1. **Decoy Car Transport Landing Page**:
   - Commercial front for "Apex Auto Logistics" with quote estimator, freight service specs, and shipper reviews.
   - Title, favicon, and SEO meta tags look 100% authentic.

2. **Hidden Gateway**:
   - In the footer's protection clause:
     > *"All shipments are safeguarded by our comprehensive damage-free **guarantee** pledge and bonded escrow protection."*
   - Clicking the word **"guarantee"** reveals the authorization prompt.

3. **Camouflage Lockout (Realistic HTTP 503)**:
   - Entering an incorrect PIN/password triggers an authentic **HTTP 503 Service Temporarily Unavailable (nginx/Ubuntu)** error screen.
   - The client IP is locked out and secret triggers are purged.
   - **Emergency Reset**: Visit `https://<domain>/?reset_vault_token=unlock123` to restore access.

4. **Session Termination & Inactivity Shield**:
   - **Browser/Tab Close**: Session cookie discarded immediately; `sendBeacon` logout fires on tab exit.
   - **Inactivity Timer**: Configurable auto-lock (1m to 30m, default 5m) that snaps back to the decoy upon idle.
   - **Background Tab Shield**: Auto-locks if user leaves the tab for longer than 45 seconds.
   - **Panic Key**: Double-pressing `Escape` or clicking **Panic Exit** instantly locks the system.

---

## 🖼️ Private Gallery & Album Management

- **Dual-Mode Dashboard**:
  - **Gallery View**: Modern minimalist visual grid of albums and borderless photo tiles.
  - **Album Manager**: Dedicated administration view displaying raw disk usage per album, total vault capacity, photo/video breakdown, direct full-size upload target, whole album `.zip` download, and album CRUD.
- **Full-Size Original Quality**:
  - All uploads are stored **uncompressed at 100% full original resolution and exact byte size** (no downscaling or lossy compression).
  - Viewer includes a **100% (1:1)** scale toggle for pixel-perfect inspection.
  - One-click raw download button to retrieve original full-size files.
- **Interactive Lightbox & Slideshow**:
  - Fullscreen mode (`F` key).
  - Mouse wheel zoom (up to 500%) and drag-to-pan.
  - Configurable rotation time (1s to 30s) with real-time countdown progress bar.
  - Configurable **"Skip Videos in Slideshow"** toggle.
  - Cinema minimalist HUD that auto-hides during inactivity.
- **Batch Operations**:
  - Multi-select media cards with checkboxes.
  - Batch Move, Copy, Delete, and `.zip` Download.

---

## ⚙️ Configuration & PIN Setup

Configured via `/home/raf/apps/apex-dispatch/.env` (and can also be edited live from inside the app Settings):

```dotenv
# Master Security PIN or Passphrase
VAULT_PIN=482910

# Secret word in the footer that activates the prompt
TRIGGER_WORD=guarantee

# Emergency Lockout Recovery Token
ADMIN_RESET_TOKEN=apex-recovery-7719

# Port
PORT=3000

# Inactivity Auto-Lock duration (minutes)
AUTO_LOCK_MINUTES=5
```

---

## 🚀 Deployment (Modeled after `ticketi.premium`)

```bash
# 1. Edit deployment profile
nano deploy/clients/production/app.env

# 2. First-time server preparation (Node 22, PM2, Nginx reverse proxy with 500MB upload limit)
./deploy.sh production --bootstrap

# 3. Deploy updates with zero downtime
./deploy.sh production

# 4. Sync configuration only without rebuild
./deploy.sh production --no-deploy
```

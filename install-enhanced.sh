#!/usr/bin/env bash
set -e

echo "========================================"
echo "  JTG Panel + Blueprint Installer"
echo "========================================"

INSTALL_DIR="${INSTALL_DIR:-/project/workspace/Jtg}"
REPO_URL="https://github.com/kiragamingofficial95-cmd/JTG-PANEL-UPGRADATION-CREDITS-TO-KIRA-GAMING.git"
REPO_BRANCH="main"
PORT="${PORT:-6767}"
ADMIN_USERNAME="${ADMIN_USERNAME:-newuser}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-password123}"

echo "[*] Installation directory: $INSTALL_DIR"
echo "[*] Port: $PORT"
echo "[*] Username: $ADMIN_USERNAME"

# 1. Check/Install Node.js 20
echo "[*] Checking Node.js..."
if command -v node &>/dev/null; then
    CURRENT_NODE=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$CURRENT_NODE" -ge 20 ]; then
        echo "[OK] Node.js $(node -v) already installed"
    else
        echo "[*] Node.js version too old, upgrading..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
        apt-get install -y nodejs >/dev/null 2>&1
        echo "[OK] Node.js $(node -v) installed"
    fi
else
    echo "[*] Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y nodejs >/dev/null 2>&1
    echo "[OK] Node.js $(node -v) installed"
fi

echo "[OK] npm $(npm -v)"

# 2. Setup directory
echo "[*] Setting up directory..."
mkdir -p /project/workspace || true
mkdir -p "$INSTALL_DIR" || true
ls -la /project/workspace/ 2>/dev/null || echo "[!] /project/workspace does not exist"
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "[*] Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull origin $REPO_BRANCH 2>/dev/null || true
else
    git clone --branch $REPO_BRANCH --depth 1 $REPO_URL "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi
echo "[OK] Directory ready: $(pwd)"

# 3. Create .env
echo "[*] Creating .env..."
if [ ! -f ".env" ]; then
    cat > .env << ENVEOF
PORT=$PORT
BLUEPRINT_REGISTRY_URL=https://blue-print-jtg-panel.vercel.app
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "jtg-panel-secret-$(date +%s)")
DEFAULT_RUNTIME=local
ENVEOF
    echo "[OK] .env created"
else
    echo "[OK] .env exists, skipping"
fi

# 4. Install dependencies
echo "[*] Installing dependencies..."
cd "$INSTALL_DIR"
rm -rf node_modules package-lock.json 2>/dev/null || true
npm install --legacy-peer-deps 2>&1 | tail -5
echo "[OK] Dependencies installed"

# 5. Build
echo "[*] Building panel..."
cd "$INSTALL_DIR"
npm run build 2>&1 | tail -20
if [ -f "dist/server.cjs" ]; then
    echo "[OK] Build complete - dist/server.cjs created"
else
    echo "[!] Build may have failed. Retrying with full output..."
    npm run build
fi

# 6. Blueprint
echo "[*] Blueprint installer..."
if [ -f "install-blueprint.sh" ]; then
    bash install-blueprint.sh 2>&1 | tail -3 || true
    echo "[OK] Blueprint initialized"
fi

# 7. Create owner user
echo "[*] Setting up owner user..."
mkdir -p .data

OWNER_EXISTS="false"
if [ -f ".data/users.json" ]; then
    OWNER_EXISTS=$(node -e "const fs=require('fs'); const users=JSON.parse(fs.readFileSync('.data/users.json','utf8')); console.log(users.some(u=>u.role==='owner'));" 2>/dev/null || echo "false")
fi

if [ "$OWNER_EXISTS" == "true" ]; then
    echo "[OK] Owner user already exists"
else
    export JTG_OWNER_USER="$ADMIN_USERNAME"
    export JTG_OWNER_PASS="$ADMIN_PASSWORD"
    npx tsx scripts/createuser.ts 2>&1 || true
    echo "[OK] Owner user created"
    echo "     Username: $ADMIN_USERNAME"
    echo "     Password: $ADMIN_PASSWORD"
fi

# 8. Kill any existing panel process
echo "[*] Cleaning up old processes..."
pkill -f "node dist/server.cjs" 2>/dev/null || true
sleep 1

# 9. Start panel
echo "[*] Starting JTG Panel on port $PORT..."
cd "$INSTALL_DIR"
NODE_ENV=production PORT=$PORT nohup node dist/server.cjs > panel.log 2>&1 &
PANEL_PID=$!
sleep 3

if kill -0 $PANEL_PID 2>/dev/null; then
    echo "[OK] JTG Panel is running (PID: $PANEL_PID)"
    echo $PANEL_PID > panel.pid
else
    echo "[!] Panel failed to start. Check logs:"
    echo "    cat $INSTALL_DIR/panel.log"
fi

# 10. Done
echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo "Panel URL: http://<YOUR_IP>:$PORT"
echo "Username:  $ADMIN_USERNAME"
echo "Password:  $ADMIN_PASSWORD"
echo ""
echo "Panel Commands:"
echo "  Start:   cd $INSTALL_DIR && NODE_ENV=production PORT=$PORT nohup node dist/server.cjs > panel.log 2>&1 &"
echo "  Stop:    pkill -f 'node dist/server.cjs'"
echo "  Logs:    tail -f $INSTALL_DIR/panel.log"
echo "  Status:  cat $INSTALL_DIR/panel.pid && kill -0 \$(cat $INSTALL_DIR/panel.pid)"
echo ""
echo "Create New Users:"
echo "  cd $INSTALL_DIR && JTG_OWNER_USER=name JTG_OWNER_PASS=pass npx tsx scripts/createuser.ts"
echo ""
echo "========================================"

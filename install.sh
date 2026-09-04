#!/usr/bin/env bash
set -e

# JTG Panel + Blueprint One-Command Installer
# Usage: bash <(curl -s https://raw.githubusercontent.com/kiragamingofficial95-cmd/JTG-PANEL-UPGRADATION-CREDITS-TO-KIRA-GAMING/main/install.sh)

echo "========================================"
echo "  JTG Panel + Blueprint Installer"
echo "========================================"

# 1. Install nvm and Node.js 20
if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20 2>/dev/null || true
nvm use 20

# 2. Clone/update repo
if [ -d "/opt/Jtg" ]; then
    echo "Updating existing installation..."
    cd /opt/Jtg && git pull https://github.com/kiragamingofficial95-cmd/JTG-PANEL-UPGRADATION-CREDITS-TO-KIRA-GAMING.git main
else
    echo "Cloning JTG Panel..."
    cd /opt && git clone https://github.com/kiragamingofficial95-cmd/JTG-PANEL-UPGRADATION-CREDITS-TO-KIRA-GAMING.git Jtg
fi

# 3. Setup environment
cd /opt/Jtg
echo 'BLUEPRINT_REGISTRY_URL=https://blue-print-jtg-panel.vercel.app' >> .env
echo 'PORT=6767' >> .env

# 4. Install dependencies and build
echo "Installing dependencies..."
npm install >/dev/null 2>&1

echo "Building panel..."
npm run build >/dev/null 2>&1

# 5. Run Blueprint installer
echo "Installing JTG Blueprint..."
bash install-blueprint.sh

# 6. Start PM2
echo "Starting panel on port 6767..."
npm install -g pm2 >/dev/null 2>&1
cd /opt/Jtg
pm2 delete jtg-panel 2>/dev/null || true
pm2 start server.ts --name jtg-panel --interpreter ./node_modules/.bin/tsx -- --port 6767
pm2 save

# 7. Final message
echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo "Panel URL: http://<YOUR_IP>:6767"
echo "Admin Settings → Blueprint Extensions"
echo "========================================"
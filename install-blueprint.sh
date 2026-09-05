#!/usr/bin/env bash
# ==============================================================================
# JTG Blueprint — Official One-Command Installer
# Repository: https://github.com/kiragamingofficial95-cmd/JTG-PANEL-UPGRADATION-CREDITS-TO-KIRA-GAMING
# ==============================================================================

set -e

# Color definitions
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${CYAN}${BOLD}"
echo "======================================================================"
echo "          __ _____ _____    ____  __   __  ______ _____  _____ _   _ _____ "
echo "         | |_   _/ ____|  |  _ \| |  | | |  ____|  __ \|_   _| \ | |_   _|"
echo "         | | | || |  __   | |_) | |  | | | |__  | |__) | | | |  \| | | |  "
echo "     _   | | | || | |_ |  |  _ <| |  | | |  __| |  ___/  | | | . \` | | |  "
echo "    | |__| |_| || |__| |  | |_) | |__| | | |____| |     _| |_| |\  |_| |_ "
echo "     \____/|_____\_____|  |____/ \____/  |______|_|    |_____|_| \_|_____|"
echo "======================================================================"
echo -e "${NC}"
echo -e "${CYAN}[*] Starting JTG Blueprint Ecosystem Installer...${NC}\n"

# 1. Detect JTG Panel Installation
PANEL_DIR="$(pwd)"
if [ ! -f "$PANEL_DIR/package.json" ] || [ ! -f "$PANEL_DIR/server.ts" ]; then
    echo -e "${RED}[X] Error: JTG Panel installation not found in the current directory: $PANEL_DIR${NC}"
    echo -e "${YELLOW}Please run this installer from your JTG Panel root folder.${NC}"
    exit 1
fi

echo -e "${GREEN}[✓] Detected JTG Panel root directory: $PANEL_DIR${NC}"

# 2. Verify Node.js and Environment
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[X] Node.js is required but not installed.${NC}"
    exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
    echo -e "${RED}[X] Node.js version 18+ required. Current version: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Node.js environment verified: $(node -v)${NC}"

# 3. Create Safe Backup
BACKUP_TIMESTAMP=$(date +%s)
BACKUP_DIR="$PANEL_DIR/.backup/blueprint-install-$BACKUP_TIMESTAMP"
mkdir -p "$BACKUP_DIR"

echo -e "${CYAN}[*] Creating pre-installation backup in: $BACKUP_DIR${NC}"
if [ -f "$PANEL_DIR/.data/blueprint.json" ]; then
    cp "$PANEL_DIR/.data/blueprint.json" "$BACKUP_DIR/"
fi
if [ -d "$PANEL_DIR/extensions" ]; then
    cp -r "$PANEL_DIR/extensions" "$BACKUP_DIR/"
fi
echo -e "${GREEN}[✓] Backup created successfully.${NC}"

# 4. Install / Verify Core Directories
echo -e "${CYAN}[*] Setting up Blueprint runtime directories...${NC}"
mkdir -p "$PANEL_DIR/.data/ext_data"
mkdir -p "$PANEL_DIR/.data/temp"
mkdir -p "$PANEL_DIR/extensions"

# 5. Initialize Blueprint State if not present
STATE_FILE="$PANEL_DIR/.data/blueprint.json"
if [ ! -f "$STATE_FILE" ]; then
    echo -e "${CYAN}[*] Initializing fresh .data/blueprint.json state...${NC}"
    cat <<EOF > "$STATE_FILE"
{
  "version": "1.0.0",
  "registryUrl": "https://blueprint.jtgpanel.com",
  "extensions": {},
  "configs": {},
  "migrations": {},
  "auditLog": [
    {
      "id": "audit_init_$BACKUP_TIMESTAMP",
      "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
      "action": "install",
      "extensionId": "jtg-blueprint-core",
      "user": "installer",
      "details": { "version": "1.0.0" }
    }
  ]
}
EOF
fi

# 6. Verify Dependencies
echo -e "${CYAN}[*] Verifying package dependencies...${NC}"
if [ ! -d "$PANEL_DIR/node_modules" ]; then
    echo -e "${YELLOW}[!] node_modules missing. Running npm install...${NC}"
    npm install
fi

# 7. Run Blueprint Doctor / Validation
echo -e "${CYAN}[*] Running JTG Blueprint Doctor self-test...${NC}"
if command -v npx >/dev/null 2>&1; then
    npx tsx scripts/jtg-blueprint.ts doctor || true
fi

echo -e "\n${GREEN}${BOLD}======================================================================${NC}"
echo -e "${GREEN}${BOLD}       JTG BLUEPRINT INSTALLED & INITIALIZED SUCCESSFULLY!           ${NC}"
echo -e "${GREEN}${BOLD}======================================================================${NC}"
echo -e "${CYAN}Next Steps:${NC}"
echo -e " 1. Access your Panel at your configured URL / port."
echo -e " 2. Navigate to: ${BOLD}Admin Settings → Blueprint Extensions${NC}"
echo -e " 3. Install extensions using Extension Keys or the CLI: ${BOLD}jtg-blueprint${NC}\n"

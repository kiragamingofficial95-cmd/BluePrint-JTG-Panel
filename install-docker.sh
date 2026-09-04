#!/usr/bin/env bash
set -e

# JTG Panel + Blueprint Docker Installer
# Usage: bash <(curl -s https://raw.githubusercontent.com/kiragamingofficial95-cmd/JTG-PANEL-UPGRADATION-CREDITS-TO-KIRA-GAMING/main/install-docker.sh)

echo "========================================"
echo "  JTG Panel + Blueprint (Docker)"
echo "========================================"

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
fi

if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# 2. Create project directory
mkdir -p /opt/Jtg && cd /opt/Jtg

# 3. Create docker-compose.yml with Blueprint pre-integrated
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  jtg-panel:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: jtg-panel
    restart: unless-stopped
    ports:
      - "6767:6767"
    environment:
      - PORT=6767
      - NODE_ENV=production
      - BLUEPRINT_REGISTRY_URL=https://blue-print-jtg-panel.vercel.app
      - JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 32)}
      - DEFAULT_RUNTIME=docker
    volumes:
      - jtg-data:/app/.data
      - jtg-backups:/app/backups
      - jtg-extensions:/app/extensions
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - jtg-network

  # Optional: Add a reverse proxy (nginx) if needed
  # nginx:
  #   image: nginx:alpine
  #   ports:
  #     - "80:80"
  #     - "443:443"
  #   volumes:
  #     - ./nginx.conf:/etc/nginx/nginx.conf:ro
  #   depends_on:
  #     - jtg-panel

volumes:
  jtg-data:
  jtg-backups:
  jtg-extensions:

networks:
  jtg-network:
    driver: bridge
EOF

# 4. Create Dockerfile with Blueprint pre-built
cat > Dockerfile << 'EOF'
FROM node:20-alpine AS builder

WORKDIR /app

# Install git for cloning
RUN apk add --no-cache git

# Clone and build
ARG REPO_URL=https://github.com/kiragamingofficial95-cmd/JTG-PANEL-UPGRADATION-CREDITS-TO-KIRA-GAMING.git
ARG REPO_BRANCH=main

RUN git clone --branch ${REPO_BRANCH} --depth 1 ${REPO_URL} /app

# Set build-time env vars
ENV BLUEPRINT_REGISTRY_URL=https://blue-print-jtg-panel.vercel.app
ENV PORT=6767
ENV NODE_ENV=production

# Install deps and build
RUN npm ci && npm run build

# Run blueprint installer
RUN chmod +x install-blueprint.sh && bash install-blueprint.sh

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.data ./data
COPY --from=builder /app/extensions ./extensions
COPY --from=builder /app/.env.example ./.env.example

# Install tsx for running
RUN npm install -g tsx

EXPOSE 6767

CMD ["tsx", "server.ts", "--port", "6767"]
EOF

# 5. Create .env template
cat > .env << 'EOF'
# JTG Panel Docker Environment
PORT=6767
NODE_ENV=production
BLUEPRINT_REGISTRY_URL=https://blue-print-jtg-panel.vercel.app
JWT_SECRET=changeme-$(openssl rand -base64 32 2>/dev/null || echo "dev-secret-change-in-production")
DEFAULT_RUNTIME=docker
EOF

# 6. Build and start
echo "Building Docker image..."
docker-compose build --no-cache

echo "Starting containers..."
docker-compose up -d

# 7. Show status
echo ""
echo "========================================"
echo "  JTG Panel + Blueprint (Docker) Ready!"
echo "========================================"
echo "Panel URL: http://<YOUR_IP>:6767"
echo "Logs: docker-compose logs -f jtg-panel"
echo "Stop: docker-compose down"
echo "========================================"
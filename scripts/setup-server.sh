#!/bin/bash
set -e

echo "🚀 Starting SYORITY Server Setup..."

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Create app directory
APP_DIR=${1:-"syority"}
mkdir -p ~/$APP_DIR
cd ~/$APP_DIR

# Create uploads and backup directories
mkdir -p uploads/logos uploads/covers uploads/workpacks backups
sudo chown -R 1001:1001 uploads

# Configure Firewall
echo "🛡️ Configuring Firewall (UFW)..."
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable

# Set up Backup Cron Job
echo "⏲️ Setting up Daily Backup Cron Job..."
chmod +x scripts/backup-db.sh scripts/deploy.sh
(crontab -l 2>/dev/null; echo "0 2 * * * ~/$APP_DIR/scripts/backup-db.sh >> ~/$APP_DIR/backups/backup.log 2>&1") | crontab -

echo "✅ Server setup complete! You can now run deploy.sh"

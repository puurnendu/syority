#!/bin/bash
# SYORITY Database Backup Script
set -e

# Configuration
BACKUP_DIR="/home/$USER/syority/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting database backup to $BACKUP_FILE..."

# Perform backup using docker-compose
docker-compose exec -T db pg_dump -U user -d syority | gzip > "$BACKUP_FILE"

# Delete backups older than RETENTION_DAYS
find "$BACKUP_DIR" -type f -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed successfully!"

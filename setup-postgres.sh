#!/bin/bash
# Set postgres password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"

# Backup pg_hba.conf
sudo cp /var/lib/pgsql/15/data/pg_hba.conf /var/lib/pgsql/15/data/pg_hba.conf.bak

# Update pg_hba.conf to use md5 for local connections
sudo sed -i 's/ident/md5/g' /var/lib/pgsql/15/data/pg_hba.conf
sudo sed -i 's/peer/md5/g' /var/lib/pgsql/15/data/pg_hba.conf

# Restart postgres
sudo systemctl restart postgresql-15

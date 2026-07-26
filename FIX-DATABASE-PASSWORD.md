# Fix Database Password Authentication Error

## Problem
**Error:** `password authentication failed for user "postgres"`

The connection to PostgreSQL is working (port 5432 is accessible), but the password in your `.env` file doesn't match your PostgreSQL password.

## Quick Fix Options

### Option 1: Update .env with Correct Password (Recommended)

1. Open `.env` file in the project root
2. Find the line: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"`
3. Replace `postgres` (the password part) with your actual PostgreSQL password:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_ACTUAL_PASSWORD@localhost:5432/postgres?schema=public"
   ```
4. Save the file
5. Restart the dev server: `npm run dev`
6. Refresh the browser

### Option 2: Reset PostgreSQL Password to "postgres"

If you want to use password "postgres", reset it:

**Windows (PowerShell as Administrator):**
```powershell
# Connect to PostgreSQL
psql -U postgres

# Reset password
ALTER USER postgres WITH PASSWORD 'postgres';

# Exit
\q
```

Then your current `.env` will work.

### Option 3: Find Your PostgreSQL Password

If you forgot your PostgreSQL password:

1. Check if you wrote it down during installation
2. Check PostgreSQL configuration files (usually in `C:\Program Files\PostgreSQL\XX\data\`)
3. Or reset it using Option 2 above

## After Fixing Password

Once the password is correct:

1. **Apply Prisma schema:**
   ```bash
   npx prisma db push
   ```

2. **Seed test data (optional):**
   ```bash
   npm run seed
   ```
   This creates:
   - Organization: `auriana-demo`
   - User: `admin@auriana.com` / `Admin123!`

3. **Restart server:**
   ```bash
   npm run dev
   ```

4. **Login at:** http://localhost:3001/login

## Test Connection

After updating `.env`, test the connection:

```bash
node test-db-connection.js
```

You should see: `✅ Connection successful!` and `✅ Found X organizations in database`

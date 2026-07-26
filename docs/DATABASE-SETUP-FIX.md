# Database Connection Fix Guide

**Issue:** Database connection failed - Authentication error

**What was fixed:**
- ✅ Port changed from 5435 → 5432 (PostgreSQL default port)

**What needs to be fixed:**

## Step 1: Verify PostgreSQL Credentials

Your `.env` file has `DATABASE_URL` but the password/credentials are incorrect.

**Check your `.env` file:**
```
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME"
```

## Step 2: Test PostgreSQL Connection

Open PowerShell and test the connection:

```powershell
# Option 1: Test with psql (if installed)
psql -U postgres -h localhost -p 5432

# Option 2: Test connection string directly
# Replace USERNAME, PASSWORD, DATABASE_NAME with your actual values
$env:DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME"
```

## Step 3: Create Database (if it doesn't exist)

If the database doesn't exist, create it:

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE your_database_name;

-- Exit
\q
```

## Step 4: Common PostgreSQL Setup

If you're using default PostgreSQL installation:

**Default superuser:** `postgres`  
**Default password:** (set during installation, or check pg_hba.conf)

**Update `.env` with correct credentials:**
```env
DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/aurianoa"
```

## Step 5: Apply Prisma Schema

After fixing credentials, run:

```bash
npx prisma db push
```

This will create all tables in your database.

## Step 6: Seed Test Data (Optional)

Create test organizations and users:

```bash
npm run seed
```

This creates:
- Organization: `aurianoa-demo`
- User: `admin@aurianoa.com` / `Admin123!`

## Step 7: Restart Server

After fixing `.env`, restart the dev server:

```bash
npm run dev
```

Then open: **http://localhost:3001/login**

---

## Quick Test Script

Create a file `test-db.js` to test your connection:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    const count = await prisma.organization.count();
    console.log(`Found ${count} organizations`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
```

Run: `node test-db.js`

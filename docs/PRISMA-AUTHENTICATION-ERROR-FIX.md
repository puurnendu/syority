# Prisma "Invalid Invocation" Error - Authentication Fix

## Understanding the Error

The error message you're seeing:
```
Invalid `prisma.organization.findMany()` invocation
```

This is **Prisma wrapping an underlying authentication error**. The real error is:
```
Authentication failed against the database server, the provided database credentials for `postgres` are not valid
```

## Root Cause

Your `.env` file has an incorrect PostgreSQL password. The connection pool connects successfully, but when Prisma tries to execute queries, PostgreSQL rejects the authentication.

## Solution

### Step 1: Update Password in .env

1. Open `.env` file in project root
2. Find: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"`
3. Replace `postgres` (the password) with your actual PostgreSQL password:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_ACTUAL_PASSWORD@localhost:5432/postgres?schema=public"
   ```
4. Save the file

### Step 2: Verify Connection

Run the test script:
```bash
node test-db-connection.js
```

Expected output:
```
✅ Connection successful!
✅ Found X organizations in database
```

If you still see authentication errors, the password is still incorrect.

### Step 3: Apply Schema & Restart

```bash
# Apply Prisma schema
npx prisma db push

# Restart dev server
npm run dev
```

### Step 4: Test Login Page

Navigate to: http://localhost:3001/login

You should see:
- Organizations listed (if any exist)
- Or "First-time setup" form (if no organizations)

## Why This Happens

1. **Prisma adapter is required** - Your schema uses `engine type "client"` which requires `@prisma/adapter-pg`
2. **Connection vs Query** - The pool connects, but PostgreSQL validates credentials on each query
3. **Error wrapping** - Prisma wraps authentication errors as "Invalid invocation" which can be confusing

## Alternative: Reset PostgreSQL Password

If you prefer to use password "postgres":

**Windows PowerShell (as Administrator):**
```powershell
psql -U postgres
ALTER USER postgres WITH PASSWORD 'postgres';
\q
```

Then your current `.env` will work.

## Technical Details

- **Adapter is correctly configured** - `src/lib/prisma.ts` uses `PrismaPg` adapter with connection pooling
- **Schema requires adapter** - Cannot use standard `PrismaClient` without adapter
- **Error occurs at query time** - Not at connection time, which is why it's confusing

## Still Having Issues?

1. Verify PostgreSQL is running: `Get-Service postgresql*` (Windows)
2. Check port: Ensure PostgreSQL is on port 5432 (or update `.env`)
3. Test direct connection: `psql -U postgres -h localhost -p 5432`
4. Check PostgreSQL logs for detailed authentication errors

# 🔴 URGENT: Fix Database Password

## The Problem

Your `.env` file has password `postgres`, but PostgreSQL is rejecting it. This is why you see "Database connection failed" on the login page.

## ✅ Quick Fix (Choose One)

### Option 1: Update .env Password (Recommended)

1. **Open `.env` file** in project root (`c:\Users\purne\.gemini\antigravity\scratch\STO\aurianoa-sto-v2\.env`)

2. **Find this line:**
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
   ```

3. **Replace `postgres` (the password) with your actual PostgreSQL password:**
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_REAL_PASSWORD@localhost:5432/postgres?schema=public"
   ```
   ⚠️ **Replace `YOUR_REAL_PASSWORD` with your actual password!**

4. **Save the file**

5. **Test it:**
   ```bash
   node test-db-connection.js
   ```
   You should see: `✅ Found X organizations in database`

6. **Restart dev server:**
   ```bash
   npm run dev
   ```

### Option 2: Reset PostgreSQL Password to "postgres"

**Windows PowerShell (Run as Administrator):**

```powershell
# Connect to PostgreSQL
psql -U postgres

# Reset password
ALTER USER postgres WITH PASSWORD 'postgres';

# Exit
\q
```

Then your current `.env` will work immediately.

## 🧪 How to Know It's Fixed

After updating the password, run:
```bash
node test-db-connection.js
```

**Success looks like:**
```
✅ Connection successful!
✅ Found X organizations in database
```

**Failure looks like:**
```
❌ Connection failed:
Authentication failed against the database server
```

## 📝 Current Status

- ✅ Prisma client: Correctly configured
- ✅ Database adapter: Working
- ✅ Connection pool: Connects successfully  
- ❌ **Password authentication: FAILING** ← Fix this!

## 🆘 Still Stuck?

1. **Find your PostgreSQL password:**
   - Check installation notes
   - Check if you wrote it down
   - Or just reset it using Option 2 above

2. **Verify PostgreSQL is running:**
   ```powershell
   Get-Service postgresql*
   ```

3. **Test direct connection:**
   ```powershell
   psql -U postgres -h localhost -p 5432
   ```
   If this asks for a password, use that password in `.env`!

---

**Once password is fixed, the login page will work!** 🎉

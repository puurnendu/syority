require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testConnection() {
    try {
        console.log('Testing database connection...');
        console.log('DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') : 'NOT SET');
        
        await prisma.$connect();
        console.log('✅ Connection successful!');
        
        // Try a simple query
        const count = await prisma.organization.count();
        console.log(`✅ Found ${count} organizations in database`);
        
    } catch (error) {
        console.error('❌ Connection failed:');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        if (error.meta) {
            console.error('Error meta:', JSON.stringify(error.meta, null, 2));
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();

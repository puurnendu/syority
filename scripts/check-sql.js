require("dotenv").config();
const { Pool } = require("pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log("Connecting to PG...");
    const res = await pool.query("SELECT COUNT(*) FROM \"Organization\"");
    console.log("ORGS count via SQL:", res.rows[0].count);
    
    const resSys = await pool.query("SELECT COUNT(*) FROM \"System\"");
    console.log("SYSTEMS count via SQL:", resSys.rows[0].count);

    const resWp = await pool.query("SELECT COUNT(*) FROM \"Workpack\"");
    console.log("WORKPACKS count via SQL:", resWp.rows[0].count);

  } catch (e) {
    console.error("PG ERROR:", e);
  } finally {
    await pool.end();
  }
}
run();

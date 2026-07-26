const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const logs = await prisma.aiLog.findMany({
            where: { job_type: 'workpack_generation', status: 'failed' },
            orderBy: { created_at: 'desc' },
            take: 2
        });
        
        console.log('Found', logs.length, 'failed logs');
        
        for (const log of logs) {
            console.log('\n--- LOG ID:', log.id, '---');
            console.log('TIMESTAMP:', log.created_at);
            console.log('ERROR:', log.error_message);
            console.log('STATUS:', log.status);
            
            const response = log.response || '';
            console.log('RAW RESPONSE (first 1000 chars):');
            console.log(response.substring(0, 1000));
            
            // Re-run the logic that AiWorkpackGenerator uses
            let raw = response.trim();
            raw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim();
            raw = raw.replace(/^```\w*\s*/, '').replace(/\s*```$/, '').trim();
            
            try {
                const parsed = JSON.parse(raw);
                console.log('PARSED TYPE (before unwrap):', Array.isArray(parsed) ? 'array' : typeof parsed);
                if (Array.isArray(parsed)) {
                    console.log('ARRAY LENGTH:', parsed.length);
                    console.log('FIRST ELEMENT TYPE:', typeof parsed[0]);
                }
            } catch (pErr) {
                console.log('INITIAL JSON PARSE FAILED:', pErr.message);
                
                // Try the extraction logic from VisionAiService (simplified)
                const firstBrace = raw.indexOf('{');
                const lastBrace = raw.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    const sliced = raw.slice(firstBrace, lastBrace + 1);
                    try {
                        const parsedSliced = JSON.parse(sliced);
                        console.log('SLICED BRACE PARSE SUCCESS. TYPE:', typeof parsedSliced);
                    } catch (sErr) {
                        console.log('SLICED BRACE PARSE FAILED:', sErr.message);
                    }
                }
            }
        }
    } catch (err) {
        console.error('SCRIPT ERROR:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();

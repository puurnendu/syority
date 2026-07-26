import { generateWorkpack } from './src/services/ai/AiWorkpackGenerator';
import { prisma } from './src/lib/prisma';

async function main() {
    const org = await prisma.organization.findFirst();
    if (!org) {
        console.error('No organization found');
        return;
    }

    try {
        console.log('Generating workpack...');
        const result = await generateWorkpack({
            organization_id: org.id,
            title: 'Heat Exchanger E-435 Maintenance',
            scope_of_work: 'Perform shutdown maintenance on E-435',
            work_type: 'Shutdown',
            operational_context: 'Refinery context'
        });
        console.log('SUCCESS:', JSON.stringify(result, null, 2));
    } catch (err: any) {
        console.error('FAILED:', err.message);
        if (err.code) console.error('CODE:', err.code);
    } finally {
        await prisma.$disconnect();
    }
}

main();

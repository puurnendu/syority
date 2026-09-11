import { NextRequest, NextResponse } from 'next/server';
import { WorkflowService } from '@/modules/Workpack/Services/WorkflowService';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { assertTenantAccess } from '@/lib/tenantGuard';

const VALID_ACTIONS = ['submit', 'approve', 'reject', 'issue', 'start_execution', 'complete', 'close', 'cancel', 'reopen'];

export const POST = withTenantGuard(async (req, { params }, session) => {
    try {
        const { id } = await params;
        const orgId = session.user.organization_id;
        await assertTenantAccess('workpack', id, orgId);
        
        const userId = session.user.id;
        const body = await req.json();
        const { action, comment } = body;

        if (!VALID_ACTIONS.includes(action)) {
            return NextResponse.json({ error: `Invalid action '${action}'` }, { status: 400 });
        }

        switch (action) {
            case 'submit':
                await WorkflowService.submit(id, userId, orgId);
                break;
            case 'approve':
                await WorkflowService.approve(id, userId, orgId, comment);
                break;
            case 'reject':
                await WorkflowService.reject(id, userId, orgId, comment ?? '');
                break;
            case 'issue':
                await WorkflowService.issue(id, userId, orgId);
                break;
            case 'start_execution':
                await WorkflowService.startExecution(id, userId, orgId);
                break;
            case 'complete':
                await WorkflowService.complete(id, userId, orgId);
                break;
            case 'close':
                await WorkflowService.close(id, userId, orgId);
                break;
            case 'cancel':
                await WorkflowService.cancel(id, userId, orgId, comment);
                break;
            case 'reopen':
                await WorkflowService.reopen(id, userId, orgId);
                break;
            default:
                return NextResponse.json({ error: `Action '${action}' not implemented yet` }, { status: 400 });
        }

        const history = await WorkflowService.getTransitionHistory(id, orgId);
        return NextResponse.json({ success: true, data: history });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 400 });
    }
});

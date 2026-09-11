import { EventEmitter } from 'events';

/**
 * EventBus — Typed cross-module communication system.
 * 
 * Modules communicate ONLY through this EventBus — never direct imports.
 * This enables clean module boundaries and future microservice migration.
 * 
 * Usage:
 *   // Emit event
 *   eventBus.emit('workpack.approved', { workpackId, approvedBy })
 * 
 *   // Listen to event (in another module)
 *   eventBus.on('workpack.approved', (data) => { ... })
 */
export interface WorkpackEvents {
    'WorkpackCreated': { workpack_id: string; organization_id: string; created_by: string };
    'WorkpackSubmitted': { workpack_id: string; submitted_by: string };
    'WorkpackApproved': { workpack_id: string; approved_by: string };
    'WorkpackRejected': { workpack_id: string; rejected_by: string; comment: string };
    'WorkpackIssued': { workpack_id: string; issued_by: string };
    'WorkpackClosed': { workpack_id: string; closed_by: string };
}

export interface ActivityEvents {
    'ActivityProgressUpdated': { activity_id: string; workpack_id: string; progress_percent: number };
    'ActivityApprovedForScheduling': { activity_id: string; workpack_id: string };
    // M12-R0.1: Execution lifecycle events
    'ActivityReleased': { activity_id: string; workpack_id: string; user_id: string };
    'ActivityStarted': { activity_id: string; workpack_id: string; user_id: string };
    'ActivityHeld': { activity_id: string; workpack_id: string; user_id: string; progress_percent: number };
    'ActivityResumed': { activity_id: string; workpack_id: string; user_id: string; progress_percent: number };
    'ActivityCompleted': { activity_id: string; workpack_id: string; user_id: string };
    'ActivityVerified': { activity_id: string; workpack_id: string; user_id: string };
    'ActivityClosed': { activity_id: string; workpack_id: string; user_id: string };
    'ExecutionDelayReported': { workpack_id: string; category: string; severity: string };
}

export interface WorkflowEvents {
    'WorkflowTransitioned': {
        workpack_id: string;
        from_status: string | null;
        to_status: string;
        action: string;
        performed_by: string;
    };
}

export interface FormEvents {
    'form.submitted': { form_instance_id: string; organization_id: string; submitted_by: string };
    'form.approved': { form_instance_id: string; approved_by: string };
    'form.rejected': { form_instance_id: string; rejected_by: string; reason: string };
}

export type AurianaEventMap = WorkpackEvents & ActivityEvents & WorkflowEvents & FormEvents;

/**
 * Typed EventEmitter for Auriana OS events.
 * Extends Node.js EventEmitter with TypeScript type safety.
 */
class TypedEventEmitter extends EventEmitter {
    emit<K extends keyof AurianaEventMap>(event: K, data: AurianaEventMap[K]): boolean {
        return super.emit(event as string, data);
    }

    on<K extends keyof AurianaEventMap>(event: K, listener: (data: AurianaEventMap[K]) => void): this {
        return super.on(event as string, listener);
    }

    once<K extends keyof AurianaEventMap>(event: K, listener: (data: AurianaEventMap[K]) => void): this {
        return super.once(event as string, listener);
    }

    off<K extends keyof AurianaEventMap>(event: K, listener: (data: AurianaEventMap[K]) => void): this {
        return super.off(event as string, listener);
    }
}

// Singleton instance — shared across all modules
export const eventBus = new TypedEventEmitter();

// Set max listeners to prevent memory leaks (default is 10)
eventBus.setMaxListeners(100);

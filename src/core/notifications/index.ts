/**
 * M7.6 — Notification & Communication Platform
 *
 * Barrel export for all notification services.
 */

export { NotificationProviderService } from './NotificationProviderService';
export { NotificationTemplateService, renderTemplate, getBaseEmailWrapper, TEMPLATE_CATEGORIES } from './NotificationTemplateService';
export { processEvent, NotificationRuleService } from './NotificationRuleEngine';
export type { EventContext } from './NotificationRuleEngine';
export { processQueue, cancelQueueItem, retryQueueItem, getQueueStats, listQueueItems, getDashboardStats, listDeliveryLogs } from './NotificationQueueProcessor';
export { deliverEmail, testProviderConnection, sendTestEmail } from './NotificationDeliveryService';
export { NotificationRecipientGroupService } from './NotificationRecipientGroupService';

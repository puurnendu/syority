/**
 * Canonical platform feature-flag registry.
 * Prevents orphan flags: only registered keys may be created via Platform UI/API.
 */

export type FeatureFlagDefinition = {
    key: string;
    name: string;
    description: string;
    /** Product modules affected when this flag is toggled */
    modules: string[];
};

export const FEATURE_FLAG_REGISTRY: FeatureFlagDefinition[] = [
    {
        key: 'WHATSAPP_REVIEWS',
        name: 'WhatsApp Reviews',
        description: 'Enable WhatsApp-based progress reviews',
        modules: ['Reviews', 'WhatsApp', 'Notifications'],
    },
    {
        key: 'ASSET_REGISTER',
        name: 'Asset Register',
        description: 'Enable the core Asset Register module',
        modules: ['Asset Register', 'Hierarchy', 'Equipment'],
    },
    {
        key: 'SAFETY_MODULE',
        name: 'Safety Management',
        description: 'Enable JSA, Permits, and Safety tools',
        modules: ['Safety', 'Permits', 'JSA'],
    },
    {
        key: 'DOCUMENT_MANAGEMENT',
        name: 'Document Hub',
        description: 'Enable central document management',
        modules: ['Documents', 'Attachments', 'Print'],
    },
];

export const FEATURE_FLAG_KEYS = new Set(FEATURE_FLAG_REGISTRY.map((f) => f.key));

export function getFeatureFlagDefinition(key: string): FeatureFlagDefinition | undefined {
    return FEATURE_FLAG_REGISTRY.find((f) => f.key === key.toUpperCase());
}

export function isRegisteredFeatureFlag(key: string): boolean {
    return FEATURE_FLAG_KEYS.has(key.toUpperCase());
}

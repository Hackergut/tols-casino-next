// Platform types for settings page
export type PlatformType = 'telegram' | 'whatsapp' | 'email' | 'sms' | 'webhook';

export interface PlatformConnection {
  id: string;
  type: PlatformType;
  label: string;
  enabled: boolean;
  config: Record<string, string>;
}

export const PLATFORM_TYPES: PlatformType[] = [
  'telegram',
  'whatsapp',
  'email',
  'sms',
  'webhook',
];

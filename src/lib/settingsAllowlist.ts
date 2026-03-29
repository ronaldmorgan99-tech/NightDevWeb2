export const PUBLIC_SETTINGS_ALLOWLIST = ['site_name', 'theme_colors', 'feature_flags'] as const;

export const isPublicSetting = (key: string): key is typeof PUBLIC_SETTINGS_ALLOWLIST[number] =>
  (PUBLIC_SETTINGS_ALLOWLIST as readonly string[]).includes(key);

export const ADMIN_SAFE_SETTINGS = ['site_name', 'theme_colors', 'feature_flags', 'discord_webhook_url', 'steam_api_key', 'twitch_client_id', 'network_servers', 'site_description', 'x_account_url'] as const;

export type PublicSettingKey = typeof PUBLIC_SETTINGS_ALLOWLIST[number];
export type AdminSettingKey = typeof ADMIN_SAFE_SETTINGS[number];

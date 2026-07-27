import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicSetting } from '../src/lib/settingsAllowlist.ts';

test('anonymous users can load intended public theme settings only', () => {
  const storedSettings = {
    site_name: 'NightDev',
    primary_accent_color: '#ff00aa',
    theme_colors: '{"accent":"#ff00aa"}',
    custom_css: 'body { display: none; }',
    discord_webhook_url: 'https://discord.invalid/webhook',
  };

  const anonymousSettings = Object.fromEntries(
    Object.entries(storedSettings).filter(([key]) => isPublicSetting(key))
  );

  assert.equal(anonymousSettings.primary_accent_color, '#ff00aa');
  assert.equal(anonymousSettings.theme_colors, '{"accent":"#ff00aa"}');
  assert.equal(anonymousSettings.site_name, 'NightDev');
  assert.equal('custom_css' in anonymousSettings, false);
  assert.equal('discord_webhook_url' in anonymousSettings, false);
});

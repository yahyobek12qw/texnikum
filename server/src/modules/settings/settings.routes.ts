import { Router } from 'express';
import { settingsPatchSchema } from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { parse } from '../../lib/http.js';
import { assertCan, can } from '../../middleware/auth.js';
import { assertMediaOfKind } from '../media/media.service.js';
import { getAdminSettings, patchSettings } from './settings.service.js';

export function adminSettingsRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    if (!can(req, 'settings.manage')) assertCan(req, 'modules.manage');
    res.json(await getAdminSettings());
  });

  router.patch('/', async (req, res) => {
    const input = parse(settingsPatchSchema, req.body);
    if (Object.keys(input).length === 0) throw badRequest('Yangilanadigan sozlama ko‘rsatilmagan', 'EMPTY_PATCH');
    if (input.modules !== undefined) assertCan(req, 'modules.manage');
    if (Object.keys(input).some((k) => k !== 'modules')) assertCan(req, 'settings.manage');

    await assertMediaOfKind(input.general?.logoMediaId, 'IMAGE');
    await assertMediaOfKind(input.seo?.ogImageMediaId, 'IMAGE');
    for (const b of input.banners ?? []) await assertMediaOfKind(b.imageMediaId, 'IMAGE');

    const result = await patchSettings(input);
    await audit(req, {
      action: 'UPDATE',
      entity: 'settings',
      summary: `Sayt sozlamalari yangilandi: ${Object.keys(input).join(', ')}`,
      meta: { groups: Object.keys(input) },
    });
    res.json(result);
  });

  return router;
}

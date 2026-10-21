import { Router } from 'express';
import { navigationUpdateSchema } from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import { parse } from '../../lib/http.js';
import { getAdminNavigation, replaceNavigation } from './navigation.service.js';

export function adminNavigationRouter() {
  const router = Router();

  router.get('/', async (_req, res) => res.json(await getAdminNavigation()));

  router.put('/', async (req, res) => {
    const input = parse(navigationUpdateSchema, req.body);
    await replaceNavigation(input.menus);
    await audit(req, {
      action: 'UPDATE',
      entity: 'navigation',
      summary: `Menyu yangilandi: ${input.menus.map((m) => m.key).join(', ')}`,
    });
    res.json(await getAdminNavigation());
  });

  return router;
}

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { z } from 'zod';

export const load: PageServerLoad = async ({ params }) => {
  const params_schema = z.object({
    chapter_num: z.coerce.number().int().min(1).max(18).optional()
  });
  const params_data = params_schema.safeParse(params);
  if (!params_data.success) {
    error(404, {
      message: `Chapter '${params.chapter}' not found`
    });
  }
};

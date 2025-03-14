import { t, publicProcedure, protectedProcedure, protectedAdminProcedure } from '~/api/trpc_init';
import { db } from '~/db/db';
import { translations } from '~/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { fetch_post } from '~/tools/fetch';
import { env } from '$env/dynamic/private';
import { delay } from '~/tools/delay';
import { get_user_project_info } from '~/lib/auth-info';

const get_translations_per_sarga_route = publicProcedure
  .input(
    z.object({
      lang_id: z.number().int(),
      chapter_num: z.number().int().min(1).max(18)
    })
  )
  .query(async ({ input: { lang_id, chapter_num } }) => {
    const data = await db.query.translations.findMany({
      columns: {
        text: true,
        index: true
      },
      where: (struct, { eq, and }) =>
        and(eq(struct.lang_id, lang_id), eq(struct.chapter_num, chapter_num))
    });
    const data_map = new Map<number, string>();
    for (let i = 0; i < data.length; i++) data_map.set(data[i].index, data[i].text);
    return data_map;
  });

const get_all_langs_translations_per_sarga_route = publicProcedure
  .input(
    z.object({
      chapter_num: z.number().int().min(1).max(18)
    })
  )
  .query(async ({ input: { chapter_num } }) => {
    const data = await db.query.translations.findMany({
      columns: {
        lang_id: true,
        text: true,
        index: true
      },
      where: (struct, { eq }) => eq(struct.chapter_num, chapter_num)
    });
    const data_map = new Map<number, Map<number, string>>();
    for (let i = 0; i < data.length; i++) {
      if (!data_map.has(data[i].lang_id)) data_map.set(data[i].lang_id, new Map());
      data_map.get(data[i].lang_id)!.set(data[i].index, data[i].text);
    }
    return data_map;
  });

const edit_translation_route = protectedProcedure
  .input(
    z.object({
      lang_id: z.number().int(),
      chapter_num: z.number().int().min(1).max(18),
      data: z.object({
        to_add_indexed: z.number().int().array(),
        to_edit_indexed: z.number().int().array(),
        add_data: z.string().array(),
        edit_data: z.string().array()
      })
    })
  )
  .mutation(
    async ({
      ctx: { user, cookie },
      input: {
        lang_id,
        chapter_num,
        data: { add_data, edit_data, to_add_indexed, to_edit_indexed }
      }
    }) => {
      // authorization check to edit or add lang records
      if (user.role !== 'admin') {
        const data = await get_user_project_info(user.id, cookie);
        if (!user.is_approved) return { success: false };
        const allowed_langs = data.langugaes.map((lang) => lang.lang_id);
        if (!allowed_langs || !allowed_langs.includes(lang_id)) return { success: false };
      }

      // add new records
      if (to_add_indexed.length > 0) {
        const data_to_add = to_add_indexed.map((index, i) => ({
          lang_id: lang_id,
          chapter_num,
          index: index,
          text: add_data[i]
        }));
        await db.insert(translations).values(data_to_add);
      }

      // update existing records
      const update_promises: Promise<any>[] = [];
      for (let i = 0; i < to_edit_indexed.length; i++) {
        const index = to_edit_indexed[i];
        const text = edit_data[i];
        update_promises.push(
          db
            .update(translations)
            .set({ text })
            .where(
              and(
                eq(translations.lang_id, lang_id),
                eq(translations.chapter_num, chapter_num),
                eq(translations.index, index)
              )
            )
        );
      }
      // reolving update promises
      await Promise.all(update_promises);

      return {
        success: true
      };
    }
  );

const trigger_translations_update_route = protectedAdminProcedure.mutation(async () => {
  const owner = 'shubhattin';
  const repo = 'valmiki_ramayanam';
  const workflow_id = 'commit_trans.yml';
  const req = await fetch_post(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_API_KEY}`
      },
      json: {
        ref: 'main'
      }
    }
  );
  return req.ok;
});

export async function get_sarga_data(chapter_num: number) {
  // ^ This is to prevent this to be bundled in edge functions as it a limit of 1mb(gzip)
  const glob_path = `/data/gita/data/*.json` as const;
  const all_sargas = import.meta.glob('/data/gita/data/*.json');
  const data = ((await all_sargas[glob_path.replace('*', `${chapter_num}`)]()) as any).default as {
    text: string;
    index: number;
    shloka_num: number | null;
  }[];
  await delay(350);
  return data;
}

const get_sarga_data_route = publicProcedure
  .input(
    z.object({
      chapter_num: z.number().int().min(1).max(18)
    })
  )
  .query(async ({ input: { chapter_num } }) => {
    return await get_sarga_data(chapter_num);
  });

export const translations_router = t.router({
  get_translations_per_sarga: get_translations_per_sarga_route,
  edit_translation: edit_translation_route,
  get_all_langs_translations_per_sarga: get_all_langs_translations_per_sarga_route,
  trigger_translations_update: trigger_translations_update_route,
  get_sarga_data: get_sarga_data_route
});

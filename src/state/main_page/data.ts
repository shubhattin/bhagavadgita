import { browser } from '$app/environment';
import { createQuery } from '@tanstack/svelte-query';
import { delay } from '~/tools/delay';
import { get_derived_query } from '~/tools/query';
import { queryClient } from '~/state/query';
import { derived, writable } from 'svelte/store';
import { client } from '~/api/client';
import gita_map from '@data/gita/gita_map.json';
import { lipi_parivartak } from '~/tools/converter';

import {
  BASE_SCRIPT,
  editing_status_on,
  chapter_selected,
  trans_lang,
  view_translation_status
} from './main_state';

export { gita_map };
export const QUERY_KEYS = {
  trans_lang_data: (lang_id: number, chapter_num: number) => [
    'sarga',
    'trans',
    lang_id,
    chapter_num
  ],
  sarga_data: (chapter_num: number) => ['sarga', 'main_dev_text', chapter_num]
};

// NAMES

export const get_chapter_names = async (lang: string) => {
  const data = gita_map.map((info) => info.name_devanagari);
  if (!browser) return data;
  return lipi_parivartak(data, BASE_SCRIPT, lang);
};

// SARGA_DATA
export const sarga_data = get_derived_query([chapter_selected], ([$chapter_selected]) =>
  createQuery(
    {
      queryKey: QUERY_KEYS.sarga_data($chapter_selected),
      enabled: browser && $chapter_selected !== 0,
      placeholderData: [],
      queryFn: async () => {
        if (!browser) return [];
        return await client.translations.get_sarga_data.query({
          chapter_num: $chapter_selected
        });
      }
    },
    queryClient
  )
);

// Translations
export const trans_en_data = get_derived_query(
  [chapter_selected, view_translation_status, editing_status_on],
  ([$chapter_selected, $view_translation_status, $editing_status_on]) =>
    createQuery(
      {
        queryKey: QUERY_KEYS.trans_lang_data(1, $chapter_selected),
        // by also adding the kanda and sarga they are auto invalidated
        // so we dont have to manually invalidate it if were only sarga,trans,English
        enabled: browser && $view_translation_status && $chapter_selected !== 0,
        ...($editing_status_on
          ? {
              staleTime: Infinity
              // while editing the data should not go stale, else it would refetch lead to data loss
            }
          : {}),
        queryFn: () => get_translations($chapter_selected, 1) // 1 -> English
      },
      queryClient
    )
);

export const trans_lang_data_query_key = derived(
  [trans_lang, chapter_selected],
  ([$trans_lang, $chapter_selected], set: (value: (string | number)[]) => void) => {
    set(QUERY_KEYS.trans_lang_data($trans_lang, $chapter_selected));
  }
);
export const trans_lang_data = get_derived_query(
  [trans_lang_data_query_key, trans_lang, chapter_selected, editing_status_on],
  ([$trans_lang_data_query_key, $trans_lang, $chapter_selected, $editing_status_on]) =>
    createQuery(
      {
        queryKey: $trans_lang_data_query_key,
        enabled: browser && $trans_lang !== 0 && $chapter_selected !== 0,
        ...($editing_status_on
          ? {
              staleTime: Infinity
              // while editing the data should not go stale, else it would refetch lead to data loss
            }
          : {}),
        queryFn: () => get_translations($chapter_selected, $trans_lang)
      },
      queryClient
    )
);
export async function get_translations(chapter: number, lang_id: number) {
  await delay(400);

  const data_map = await client.translations.get_translations_per_sarga.query({
    lang_id: lang_id,
    chapter_num: chapter
  });
  return data_map;
}

export let english_edit_status = writable(false);

export let bulk_text_edit_status = writable(false);
export let bulk_text_data = writable('');

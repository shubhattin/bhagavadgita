import { get, writable } from 'svelte/store';
import type * as fabric from 'fabric';
import { get_derived_query } from '~/tools/query';
import { browser } from '$app/environment';
import { get_translations, QUERY_KEYS } from '~/state/main_page/data';
import { createQuery } from '@tanstack/svelte-query';
import { queryClient } from '~/state/query';
import background_image_url from './img/background_vr.png';
import background_image_template_url from './img/background_vr_template.jpg';
import {
  LANG_LIST,
  lang_list_obj,
  SCRIPT_LIST,
  type lang_list_type,
  type script_list_type
} from '~/tools/lang_list';
import { copy_plain_object } from '~/tools/kry';
import { get_image_font_info } from './settings';
import { client } from '~/api/client';
import { chapter_selected } from '~/state/main_page/main_state';

export let canvas = writable<fabric.Canvas>();
export let background_image = writable<fabric.FabricImage>();
export let shaded_background_image_status = writable(import.meta.env.DEV);
export let scaling_factor = writable<number>(0); // Scale factor for the background image

export const IMAGE_DIMENSIONS = [1920, 1080];
export const get_units = (value: number) => {
  return value * get(scaling_factor);
};
export async function set_background_image_type(shaded_image: boolean) {
  const $background_image = get(background_image);
  if (!$background_image) return;
  await $background_image.setSrc(
    shaded_image ? background_image_template_url : background_image_url
  );
  background_image.set($background_image);
  const $canvas = get(canvas);
  $canvas.requestRenderAll();
  canvas.set($canvas);
}

export let image_script = writable<script_list_type>();
export let image_lang = writable<number>(lang_list_obj.English);
export let image_chapter = writable<number>(0);
// ^ chapter will be inherited from the main during mount
export let image_shloka = writable<number>(1);
export let image_rendering_state = writable<boolean>(false);

export let zip_download_state = writable<[number, number] | null>(null);

export const image_sarga_data = get_derived_query([image_chapter], ([$image_chapter]) => {
  return createQuery(
    {
      queryKey: QUERY_KEYS.sarga_data($image_chapter),
      enabled: browser && $image_chapter !== 0,
      placeholderData: [],
      queryFn: async () => {
        return await client.translations.get_chapter_data.query({
          chapter_num: $image_chapter
        });
      }
    },
    queryClient
  );
});
export const image_trans_data = get_derived_query(
  [image_chapter, image_lang],
  ([$image_chapter, $image_lang]) => {
    return createQuery(
      {
        queryKey: QUERY_KEYS.trans_lang_data($image_lang, $image_chapter),
        enabled: browser && $image_chapter !== 0,
        queryFn: () => get_translations($image_chapter, $image_lang)
      },
      queryClient
    );
  }
);

// Language and Script Specific Settings

type image_font_config_type<T extends string> = Record<T, ReturnType<typeof get_image_font_info>>;
export const DEFAULT_MAIN_TEXT_FONT_CONFIGS = (() => {
  const res: any = {};
  SCRIPT_LIST.filter((src) => !['Normal'].includes(src)).forEach(
    (script) =>
      (res[script as script_list_type] = get_image_font_info(script as script_list_type, 'shloka'))
  );
  return res as image_font_config_type<script_list_type>;
})();
export let main_text_font_configs = writable(copy_plain_object(DEFAULT_MAIN_TEXT_FONT_CONFIGS));
export let normal_text_font_config = writable(
  copy_plain_object(get_image_font_info('Normal', 'shloka'))
);
export const DEFAULT_TRANS_TEXT_FONT_CONFIGS = (() => {
  const res: any = {};
  LANG_LIST.forEach(
    (lang) => (res[lang as script_list_type] = get_image_font_info(lang as lang_list_type, 'trans'))
  );
  return res as image_font_config_type<lang_list_type>;
})();
export let trans_text_font_configs = writable(copy_plain_object(DEFAULT_TRANS_TEXT_FONT_CONFIGS));

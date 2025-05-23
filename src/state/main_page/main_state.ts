import type { script_list_type } from '~/tools/lang_list';
import { writable } from 'svelte/store';

export let chapter_selected = writable(0);

export const BASE_SCRIPT = 'Devanagari';

export let viewing_script = writable<script_list_type>(BASE_SCRIPT);
export let trans_lang = writable<number>();
export let view_translation_status = writable(false);

// Edit
export let editing_status_on = writable(false);
export let sanskrit_mode = writable<number>();

export let added_translations_indexes = writable<number[]>([]);
export let edited_translations_indexes = writable<Set<number>>(new Set());
export let edit_language_typer_status = writable<boolean>(true);
export let typing_assistance_modal_opened = writable(false);

export let image_tool_opened = writable(false);
export let ai_tool_opened = writable(false);

// some values
export const TEXT_MODEL_LIST = {
  'gpt-4o': ['GPT-4o', '128K token context window\n$2.5/1M Input tokens & $10/1M Output tokens'],
  'o3-mini': [
    'O3 Mini',
    '200K token context window\n$1.10/1M Input tokens & $4.40/1M Output tokens'
  ],
  'claude-3.7-sonnet': [
    'Sonnet',
    '200K token context window\n$3/1M Input tokens & $15/1M Output tokens'
  ]
};

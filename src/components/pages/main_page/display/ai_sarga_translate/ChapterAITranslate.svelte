<script lang="ts">
  import { client } from '~/api/client';
  import {
    editing_status_on,
    chapter_selected,
    trans_lang,
    added_translations_indexes,
    TEXT_MODEL_LIST
  } from '~/state/main_page/main_state';
  import {
    QUERY_KEYS,
    gita_map,
    sarga_data,
    trans_en_data,
    trans_lang_data,
    trans_lang_data_query_key
  } from '~/state/main_page/data';
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { format_string_text } from '~/tools/kry';
  import trans_prompts from './translation_prompts.yaml';
  import { AIIcon } from '~/components/icons';
  import Icon from '~/tools/Icon.svelte';
  import { get_result_from_trigger_run_id } from '~/tools/trigger';
  import pretty_ms from 'pretty-ms';
  import { OiStopwatch16 } from 'svelte-icons-pack/oi';
  import { onDestroy } from 'svelte';
  import { LANG_LIST, LANG_LIST_IDS } from '~/tools/lang_list';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';

  const query_client = useQueryClient();

  let chapter_info = $derived(gita_map[$chapter_selected - 1]);
  let shloka_total = $derived(chapter_info.total);

  let show_time_status = $state(false);

  onDestroy(() => {
    show_time_status = false;
    // ^ may be not needed
  });

  $effect(() => {
    if (show_time_status) {
      const t_id = setTimeout(() => (show_time_status = false), 10 * 1000);
      return () => clearTimeout(t_id);
    }
  });

  let selected_model: keyof typeof TEXT_MODEL_LIST = $state('o3-mini');

  const translate_sarga_mut = createMutation({
    mutationFn: async (
      input: Parameters<typeof client.ai.trigger_funcs.translate_chapter.mutate>[0]
    ) => {
      show_time_status = false;
      const { run_id, output_type } = await client.ai.trigger_funcs.translate_chapter.mutate(input);

      return await get_result_from_trigger_run_id<typeof output_type>(run_id!);
    },
    async onSuccess(response) {
      response = response!;
      if (!response.success) return;
      const translations = response.translations;

      const new_data = new Map($trans_lang !== 0 ? $trans_lang_data.data : $trans_en_data.data);
      translations.forEach((translation) => {
        if (new_data.has(translation.index)) return;
        new_data.set(translation.index, translation.text);
        $added_translations_indexes.push(translation.index);
      });
      $added_translations_indexes = $added_translations_indexes;
      if ($trans_lang !== 0) await query_client.setQueryData($trans_lang_data_query_key, new_data);
      else
        await query_client.setQueryData(QUERY_KEYS.trans_lang_data(1, $chapter_selected), new_data);
      show_time_status = true;
    }
  });

  async function translate_sarga_func() {
    // Sanskrit Shlokas + Transliteration + English Translation
    const texts_obj_list = $sarga_data.data!.map((shloka_line, i) => {
      let text = shloka_line.text;
      let trans: string | null = null;
      if ($trans_lang !== 0) {
        const lang_data = $trans_en_data.data;
        if (lang_data && lang_data.has(i)) trans = lang_data.get(i)!;
      }
      return {
        text: text,
        index: shloka_line.index,
        ...(trans !== null && { translation: trans })
      };
    });
    await $translate_sarga_mut.mutateAsync({
      lang_id: $trans_lang,
      model: selected_model,
      messages: [
        {
          role: 'user',
          content: format_string_text(
            $trans_lang !== 0
              ? trans_prompts.prompts[0].content
              : trans_prompts.prompts_english[0].content,
            {
              text: JSON.stringify(texts_obj_list, null, 2),
              lang: $trans_lang !== 0 ? LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)] : 'English',
              chapter_name: chapter_info.name_normal,
              chapter_num: chapter_info.index
            }
          )
        }
      ]
    });
  }

  let other_lang_allow_translate = $derived(
    $trans_lang !== 0 &&
      ($trans_lang_data.data?.size ?? 0) < shloka_total && // atleast 1 untranslated shlokas should be there
      ($trans_en_data.data?.size ?? 0) >= shloka_total * 0.7 // atleast 70% of the translations should be there
  );
  let english_allow_translate = $derived(
    $trans_lang === 0 && ($trans_en_data.data?.size ?? 0) !== shloka_total
    // all english translations should not be there, anyway we wont be sending it as context to the API anyway
  );
</script>

{#if $editing_status_on && (other_lang_allow_translate || english_allow_translate)}
  <ConfirmModal
    popup_state={false}
    close_on_confirm={true}
    confirm_func={translate_sarga_func}
    title={'Are You Sure to translate the Chapter ?'}
    body_text={() => {
      return `This will translate the untranslated shlokas to ${$trans_lang !== 0 ? LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)] : 'English'} which you can edit and then save.`;
    }}
  >
    <!-- description={`This will translate the untranslated shlokas to ${$trans_lang !== 0 ? LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)] : 'English'} which you can edit and then save.`} -->
    <button
      disabled={$translate_sarga_mut.isPending}
      class="btn-hover ml-3 inline-block rounded-lg bg-surface-600 px-2 py-1 text-white dark:bg-surface-600"
    >
      <Icon src={AIIcon} class="-mt-1 mr-1 text-2xl" />
      Translate Chapter with AI
    </button>
  </ConfirmModal>
  <select
    class="select ml-3 inline-block w-20 px-1 py-1 text-xs outline-hidden"
    bind:value={selected_model}
    title={TEXT_MODEL_LIST[selected_model][1]}
  >
    {#each Object.entries(TEXT_MODEL_LIST) as [key, value]}
      <option value={key} title={value[1]}>{value[0]}</option>
    {/each}
  </select>
{:else if $editing_status_on && $translate_sarga_mut.isSuccess && show_time_status}
  <span class="ml-4 text-xs text-stone-500 select-none dark:text-stone-300">
    <Icon src={OiStopwatch16} class="text-base" />
    {pretty_ms($translate_sarga_mut.data.time_taken)}
  </span>
{/if}

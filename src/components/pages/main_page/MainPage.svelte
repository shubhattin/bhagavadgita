<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '~/tools/Icon.svelte';
  import { onMount } from 'svelte';
  import { delay } from '~/tools/delay';
  import { writable } from 'svelte/store';
  import { LANG_LIST, LANG_LIST_IDS, SCRIPT_LIST, type script_list_type } from '~/tools/lang_list';
  import { load_parivartak_lang_data, lipi_parivartak, get_sa_mode } from '~/tools/converter';
  import { LanguageIcon } from '~/components/icons';
  import { browser } from '$app/environment';
  import SargaDisplay from './display/SargaDisplay.svelte';
  import { BiEdit, BiHelpCircle } from 'svelte-icons-pack/bi';
  import { scale, slide } from 'svelte/transition';
  import { TiArrowBackOutline, TiArrowForwardOutline } from 'svelte-icons-pack/ti';
  import { goto } from '$app/navigation';
  import Select from '~/components/Select.svelte';
  import { z } from 'zod';
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import {
    chapter_selected,
    editing_status_on,
    BASE_SCRIPT,
    viewing_script,
    trans_lang,
    view_translation_status,
    edit_language_typer_status,
    sanskrit_mode,
    typing_assistance_modal_opened,
    image_tool_opened,
    ai_tool_opened
  } from '~/state/main_page/main_state';
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import { BsKeyboard } from 'svelte-icons-pack/bs';
  import User from './user/User.svelte';
  import { get_script_for_lang, get_text_font_class } from '~/tools/font_tools';
  import { gita_map, get_chapter_names, english_edit_status } from '~/state/main_page/data';
  import MetaTags from '~/components/tags/MetaTags.svelte';
  import { loadLocalConfig } from './load_local_config';
  import { useSession } from '~/lib/auth-client';
  import { get_user_verified_info } from '~/state/main_page/user.svelte';

  const user_verified_info = $derived.by(get_user_verified_info);
  const query_client = useQueryClient();

  const session = useSession();
  let user_info = $derived($session.data?.user);

  let mounted = $state(false);

  $effect(() => {
    $english_edit_status =
      $trans_lang === 0 &&
      (user_info?.role === 'admin' ||
        ($user_verified_info.isSuccess &&
          !!user_info?.is_approved! &&
          $user_verified_info.data.langugaes!.map((l) => l.lang_name).includes('English')));
  });

  onMount(async () => {
    if (import.meta.env.DEV) {
      (async () => {
        const conf = await loadLocalConfig();
        if (conf.view_translation_status) $view_translation_status = true;
        if (conf.trans_lang)
          $trans_lang_mut.mutateAsync(3).then(() => {
            // 3 -> Hindi
            editing_status_on.set(true);
          });
        if (conf.editing_status_on) $editing_status_on = true;
        if (conf.image_tool_opened) $image_tool_opened = true;
        if (conf.ai_tool_opened) {
          $ai_tool_opened = true;
          $view_translation_status = true;
        }
      })();
    }
    if (browser && import.meta.env.PROD) {
      window.addEventListener('beforeunload', function (e) {
        if ($editing_status_on) {
          e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
          e.returnValue = ''; // Chrome requires returnValue to be set
        }
      });
    }
    await load_parivartak_lang_data(BASE_SCRIPT);
    mounted = true;
  });
  const params_viewing_script_mut_schema = z.object({
    script: z.string(),
    update_viewing_script_selection: z.boolean().default(true)
  });
  let viewing_script_selection = writable(BASE_SCRIPT);
  let viewing_script_mut = createMutation({
    mutationKey: ['viewing_script'],
    mutationFn: async (params: z.infer<typeof params_viewing_script_mut_schema>) => {
      const args = params_viewing_script_mut_schema.parse(params);
      const script = args.script as script_list_type;
      if (!mounted) return script;
      await delay(500);
      await load_parivartak_lang_data(script);
      return script;
    },
    onSuccess(script, { update_viewing_script_selection }) {
      $viewing_script = script;
      if (update_viewing_script_selection) $viewing_script_selection = script;
    }
  });
  $effect(() => {
    const _viewing_script_mut = untrack(() => $viewing_script_mut);
    _viewing_script_mut.mutate({
      script: $viewing_script_selection,
      update_viewing_script_selection: false
    });
  });

  let trans_lang_selection = writable(0);
  $trans_lang = $trans_lang_selection;
  const trans_lang_mut = createMutation({
    mutationKey: ['trans_lang'],
    mutationFn: async (lang_id: number) => {
      if (!mounted || !browser || lang_id === 0) return lang_id;
      // loading trnaslation lang data for typing support
      await delay(300);
      let script = get_script_for_lang(lang_id);
      await Promise.all([
        $viewing_script_mut.mutateAsync({ script, update_viewing_script_selection: true })
      ]);
      return lang_id;
    },
    onSuccess(lang_id) {
      $trans_lang_selection = lang_id;
      $trans_lang = lang_id;
      query_client.invalidateQueries({ queryKey: ['sanskrit_mode_texts'] });
    }
  });
  $effect(() => {
    if ($editing_status_on && $trans_lang !== 0)
      load_parivartak_lang_data(LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)], 'src', true);
  });
  $effect(() => {
    const _trans_lang_mut = untrack(() => $trans_lang_mut);
    _trans_lang_mut.mutate($trans_lang_selection);
  });
  // the trans_lang_mut is used to get the translation language
  // this could be removed in future in favour of a simple query

  const get_gita_page_link = (chapter: number | null = null) => {
    return `/${!chapter || chapter === 0 ? '' : `${chapter}`}`;
  };

  let chapter_names = $state(gita_map.map((info) => info.name_devanagari));
  $effect(() => {
    get_chapter_names($viewing_script).then((names) => (chapter_names = names));
  });

  $effect(() => {
    if (!browser) return;
    // only sarga_selected should be subscribed
    $chapter_selected;
    if ($chapter_selected === 0) {
      goto('/');
      return;
    }
    if (browser && untrack(() => mounted)) {
      goto(get_gita_page_link($chapter_selected));
    }
  });

  // Language Typing for Schwa Deletion
  let sanskrit_mode_texts = $derived(
    createQuery({
      queryKey: ['sanskrit_mode_texts'],
      enabled: browser && $editing_status_on && $trans_lang !== 0,
      queryFn: () =>
        lipi_parivartak(
          ['राम्', 'राम'],
          BASE_SCRIPT,
          LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)]
        ),
      placeholderData: ['राम्', 'राम']
    })
  );
  $effect(() => {
    (async () => {
      if (!$editing_status_on || $sanskrit_mode_texts.isFetching || !$sanskrit_mode_texts.isSuccess)
        return;
      if ($trans_lang === 0) return;
      $sanskrit_mode = await get_sa_mode(
        untrack(() => LANG_LIST[LANG_LIST_IDS.indexOf($trans_lang)])
      );
    })();
  });

  const get_page_info = () => {
    let title = 'श्रीमद्भगवद्गीता';
    let description = 'श्रीमद्भगवद्गीतायाः पठनम्';
    if ($chapter_selected !== 0) {
      const chapter = gita_map[$chapter_selected - 1];
      title = `${chapter.name_devanagari} (${chapter.index}) | श्रीमद्रामायणम्`;
      description =
        `श्रीमद्रामायणस्य ${chapter.name_devanagari} पठनम् | ` +
        `Read ${chapter.name_normal} of Shri Ramayanam. ${chapter.index}`;
    }
    return {
      title,
      description
    };
  };
  let PAGE_INFO = $state(get_page_info());
  $effect(() => {
    $chapter_selected;
    PAGE_INFO = get_page_info();
  });
</script>

<MetaTags title={PAGE_INFO.title} description={PAGE_INFO.description} />
<div class="mt-2 space-y-2.5 sm:mt-4 sm:space-y-4">
  <div class="mb-0 flex items-start justify-between sm:mb-2.5">
    <label class="space-x-2 text-sm sm:space-x-2 sm:text-base">
      Script
      <Icon src={LanguageIcon} class="text-2xl sm:text-4xl" />
      <select
        class="select inline-block h-10 w-32 px-2 py-1 text-sm sm:h-12 sm:w-40 sm:py-0 sm:text-base"
        disabled={$viewing_script_mut.isPending}
        bind:value={$viewing_script_selection}
      >
        {#each SCRIPT_LIST as lang (lang)}
          <option value={lang}>{lang}</option>
        {/each}
      </select>
    </label>
    <div>
      <User />
    </div>
  </div>
  <div class="space-x-6 sm:space-x-8">
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label class="inline-block space-x-2 sm:space-x-4">
      <span class="text-sm font-bold sm:text-base">Select Chapter</span>
      <Select
        class={`select h-10 w-44 px-2 py-1 sm:h-12 sm:w-52`}
        zodType={z.coerce.number().int()}
        bind:value={$chapter_selected}
        options={[{ value: 0, text: 'Select' }].concat(
          chapter_names.map((name, index) => ({
            value: index + 1,
            text: `${index + 1} ${name}`
          }))
        )}
        disabled={$editing_status_on}
      />
    </label>
    {#if $chapter_selected !== 0}
      {#await import('./display/SargaUtility.svelte') then SargaUtility}
        <SargaUtility.default />
      {/await}
    {/if}
  </div>
  {#if $chapter_selected !== 0}
    <div class="space-x-1 sm:space-x-3">
      {#if $chapter_selected !== 1}
        <button
          onclick={() => ($chapter_selected -= 1)}
          in:scale
          out:slide
          disabled={$editing_status_on}
          class={'btn-hover rounded-lg bg-tertiary-800 px-1 py-1 pt-1.5 text-sm font-bold text-white sm:px-2 sm:py-1 sm:text-sm'}
        >
          <Icon class="-mt-1 text-xl" src={TiArrowBackOutline} />
          Previous
        </button>
      {/if}
      {#if $chapter_selected !== gita_map.length}
        <button
          onclick={() => ($chapter_selected += 1)}
          in:scale
          out:slide
          disabled={$editing_status_on}
          class={'btn-hover rounded-lg bg-tertiary-800 px-1 py-1 pt-1.5 text-sm font-bold text-white sm:px-2 sm:py-1 sm:text-sm'}
        >
          Next
          <Icon class="-mt-1 text-xl" src={TiArrowForwardOutline} />
        </button>
      {/if}
      {#if !($ai_tool_opened && user_info && user_info.role === 'admin')}
        {#if !$view_translation_status}
          <button
            onclick={() => {
              $view_translation_status = true;
            }}
            class="btn-hover rounded-lg bg-primary-800 px-2 py-1 text-sm font-bold text-white sm:text-sm dark:bg-primary-700"
            >View Translations</button
          >
        {:else}
          <div class="mt-2 block space-x-1.5 sm:mt-0 sm:inline-block sm:space-x-0">
            <label class="mr-1 inline-block space-x-1.5 text-sm sm:mr-3 sm:space-x-4 sm:text-base">
              Translation
              <Icon src={LanguageIcon} class="text-xl sm:text-2xl" />
              <select
                disabled={$editing_status_on ||
                  $trans_lang_mut.isPending ||
                  $viewing_script_mut.isPending}
                class="select inline-block w-24 px-1 py-1 text-sm sm:w-32 sm:px-2 sm:text-base"
                bind:value={$trans_lang_selection}
              >
                <option value={0}>English</option>
                {#each LANG_LIST as lang, i (lang)}
                  {#if lang !== 'English'}
                    <option value={LANG_LIST_IDS[i]}>{lang}</option>
                  {/if}
                {/each}
              </select>
            </label>
            {#if !$editing_status_on && user_info && user_info.is_approved}
              {@const languages =
                user_info.role !== 'admin' && $user_verified_info.isSuccess
                  ? $user_verified_info.data.langugaes!.map((l) => l.lang_id)
                  : []}
              {#if $trans_lang !== 0 && (user_info.role === 'admin' || languages.indexOf($trans_lang) !== -1)}
                <button
                  onclick={() => ($editing_status_on = true)}
                  class="btn-hover my-1 inline-block rounded-lg bg-secondary-700 px-1 py-1 text-sm font-bold text-white sm:px-2 sm:text-sm dark:bg-secondary-800"
                >
                  <Icon src={BiEdit} class="text-xl sm:text-2xl" />
                  Edit
                </button>
              {:else if $trans_lang === 0 && (user_info.role === 'admin' || languages.indexOf(1) !== -1)}
                <!-- 1 -> English -->
                <button
                  onclick={() => ($editing_status_on = true)}
                  class="btn-hover my-1 inline-block rounded-lg bg-secondary-700 px-1 py-1 text-sm font-bold text-white sm:px-2 sm:text-sm dark:bg-secondary-800"
                >
                  <Icon src={BiEdit} class="text-xl sm:text-2xl" />
                  Edit English
                </button>
              {/if}
            {/if}
          </div>
        {/if}
      {/if}
    </div>
    <!-- !== --, as we dont need it for english -->
    {#if $trans_lang !== 0 && $editing_status_on && !($ai_tool_opened && user_info && user_info.role === 'admin')}
      <div class="flex space-x-2.5 sm:space-x-4">
        <Switch
          name="edit_lang"
          checked={$edit_language_typer_status}
          stateFocused="outline-hidden select-none"
          onCheckedChange={(e) => ($edit_language_typer_status = e.checked)}
        >
          <Icon src={BsKeyboard} class="text-4xl" />
        </Switch>
        {#if $sanskrit_mode_texts.isSuccess && !$sanskrit_mode_texts.isFetching}
          <select
            disabled={!$edit_language_typer_status}
            bind:value={$sanskrit_mode}
            class="select w-28 px-1 py-1 text-sm text-clip"
          >
            <option value={1}>rAm ➔ {$sanskrit_mode_texts.data[0]}</option>
            <option value={0}>rAm ➔ {$sanskrit_mode_texts.data[1]}</option>
          </select>
        {/if}
        <button
          class="btn rounded-md p-0 text-sm outline-hidden"
          title={'Language Typing Assistance'}
          onclick={() => ($typing_assistance_modal_opened = true)}
        >
          <Icon src={BiHelpCircle} class="mt-1 text-3xl text-sky-500 dark:text-sky-400" />
        </button>
        <span
          class="mt-2 hidden text-center text-sm text-stone-500 sm:inline-block dark:text-stone-400"
          >Use <span class="font-semibold">Alt+x</span> to toggle</span
        >
      </div>
    {/if}
    {#if !$ai_tool_opened}
      <SargaDisplay />
    {:else if user_info && user_info.role === 'admin'}
      {#await import('./ai_image_tool/AIImageGenerator.svelte') then AIImageGenerator}
        <AIImageGenerator.default />
      {/await}
    {/if}
  {/if}
</div>

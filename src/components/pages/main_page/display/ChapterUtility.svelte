<script lang="ts">
  import { browser } from '$app/environment';
  import { sarga_data, gita_map } from '~/state/main_page/data';
  import {
    chapter_selected,
    BASE_SCRIPT,
    image_tool_opened,
    viewing_script,
    ai_tool_opened,
    view_translation_status
  } from '~/state/main_page/main_state';
  import { createMutation } from '@tanstack/svelte-query';
  import { RiDocumentFileExcel2Line } from 'svelte-icons-pack/ri';
  import { transliterate_xlxs_file } from '~/tools/excel/transliterate_xlsx_file';
  import { client } from '~/api/client';
  import Icon from '~/tools/Icon.svelte';
  import { BiImage } from 'svelte-icons-pack/bi';
  import type { Workbook } from 'exceljs';
  import { TrOutlineFileTypeTxt } from 'svelte-icons-pack/tr';
  import { download_file_in_browser } from '~/tools/download_file_browser';
  import { lipi_parivartak } from '~/tools/converter';
  import { RiUserFacesRobot2Line } from 'svelte-icons-pack/ri';
  import { useSession } from '~/lib/auth-client';
  import { Modal, Popover } from '@skeletonlabs/skeleton-svelte';
  import { cl_join } from '~/tools/cl_join';
  import { BsThreeDots } from 'svelte-icons-pack/bs';
  import { fade } from 'svelte/transition';
  import { AiOutlineClose } from 'svelte-icons-pack/ai';

  const session = useSession();
  let user_info = $derived($session.data?.user);

  let current_workbook = $state<Workbook>(null!);
  let current_file_name = $state<string>(null!);
  let current_dowbload_link = $state<string>(null!);
  let excel_preview_opened = $state(false);

  const download_excel_file = createMutation({
    mutationKey: ['chapter', 'download_excel_data'],
    mutationFn: async () => {
      if (!browser) return;
      // the method used below creates a url for both dev and prod
      const ExcelJS = (await import('exceljs')).default;
      const url = new URL('/data/gita/template/excel_file_template.xlsx', import.meta.url).href;
      const req = await fetch(url);
      const file_blob = await req.blob();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file_blob.arrayBuffer());
      const worksheet = workbook.getWorksheet(1)!;
      const COLUMN_FOR_DEV = 2;
      const TEXT_START_ROW = 2;
      const translation_texts =
        await client.translations.get_all_langs_translations_per_chapter.query({
          chapter_num: $chapter_selected
        });
      const shloka_count = gita_map[$chapter_selected - 1].total;
      for (let i = 0; i < $sarga_data.data!.length; i++) {
        worksheet.getCell(i + COLUMN_FOR_DEV, TEXT_START_ROW).value = $sarga_data.data![i].text;
        worksheet.getCell(i + COLUMN_FOR_DEV, 1).value = i === shloka_count + 1 ? -1 : i;
      }
      await transliterate_xlxs_file(
        workbook,
        'all',
        1,
        COLUMN_FOR_DEV,
        TEXT_START_ROW,
        BASE_SCRIPT,
        null,
        translation_texts,
        shloka_count
      );

      // saving file to output path
      let sarga_name = gita_map[$chapter_selected - 1].name_normal.split('\n')[0];
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      current_dowbload_link = URL.createObjectURL(blob);
      current_file_name = `${$chapter_selected}. ${sarga_name}.xlsx`;
      current_workbook = workbook;
      excel_preview_opened = true;
    }
  });

  const download_text_file = createMutation({
    mutationKey: ['chapter', 'download_text_data'],
    mutationFn: async () => {
      if (!browser) return;
      const text = (
        await Promise.all(
          $sarga_data.data!.map((shloka_lines) =>
            lipi_parivartak(shloka_lines.text, BASE_SCRIPT, $viewing_script)
          )
        )
      ).join('\n\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const sarga_name_normal = gita_map[$chapter_selected - 1].name_normal.split('\n')[0];
      const sarga_name_script = await lipi_parivartak(
        gita_map[$chapter_selected - 1].name_devanagari.split('\n')[0],
        BASE_SCRIPT,
        $viewing_script
      );
      const is_not_brahmic_script = ['Normal', 'Romanized'].includes($viewing_script);
      download_file_in_browser(
        url,
        `${$chapter_selected} ${sarga_name_script}${is_not_brahmic_script ? '' : ` (${sarga_name_normal})`}.txt`
      );
    }
  });

  let file_preview_opened = $state(false);
</script>

<Popover
  open={file_preview_opened}
  onOpenChange={(e) => (file_preview_opened = e.open)}
  positioning={{ placement: 'bottom' }}
  arrow={false}
  contentBase={cl_join(
    'card z-70 space-y-1 p-1 rounded-lg shadow-xl dark:bg-surface-900 bg-slate-200 text-sm'
  )}
  triggerBase="outline-hidden select-none"
>
  {#snippet trigger()}
    <span class="btn-hover" title="Extra Options" transition:fade>
      <Icon class="mx-[0.17rem] text-lg sm:mx-0 sm:text-2xl" src={BsThreeDots} />
    </span>
  {/snippet}
  {#snippet content()}
    <button
      onclick={() => {
        $download_excel_file.mutate();
        file_preview_opened = false;
      }}
      class="btn block w-full rounded-md px-2 py-1 pt-0 hover:bg-gray-200 dark:hover:bg-gray-700"
    >
      <Icon
        class="-mt-1 mr-1 text-2xl text-green-600 dark:text-green-400"
        src={RiDocumentFileExcel2Line}
      />
      Download Excel File
    </button>
    <button
      onclick={() => {
        file_preview_opened = false;
        image_tool_opened.set(true);
      }}
      class="btn block w-full rounded-md px-2 py-1 pt-0 text-start hover:bg-gray-200 dark:hover:bg-gray-700"
    >
      <Icon src={BiImage} class="-mt-1 fill-sky-500 text-2xl dark:fill-sky-400" />
      Image Tool
    </button>
    {#if user_info && user_info.role === 'admin'}
      <button
        onclick={() => {
          file_preview_opened = false;
          $ai_tool_opened = true;
          $view_translation_status = true;
        }}
        class="btn block w-full rounded-md px-2 py-1 pt-0 text-start hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <Icon
          src={RiUserFacesRobot2Line}
          class="-mt-1 mr-1 fill-blue-500 text-2xl dark:fill-blue-400"
        />
        AI Image Generator
      </button>
    {/if}
    <button
      class="btn block w-full rounded-md px-2 py-1 pt-0 text-start hover:bg-gray-200 dark:hover:bg-gray-700"
      onclick={() => {
        file_preview_opened = false;
        $download_text_file.mutate();
      }}
    >
      <Icon src={TrOutlineFileTypeTxt} class=" mr-1 text-2xl" />
      Download Text File
    </button>
  {/snippet}
</Popover>
<Modal
  open={$image_tool_opened}
  onOpenChange={(e) => ($image_tool_opened = e.open)}
  closeOnInteractOutside={true}
  contentBase="z-10 mx-3 max-h-[97%] max-w-[97%] overflow-scroll rounded-md p-2 card rounded-lg bg-slate-100 p-1 shadow-2xl dark:bg-surface-900"
  backdropBackground="backdrop-blur-xs"
>
  {#snippet content()}
    {#await import('../image_tool/ImageTool.svelte') then ImageTool}
      <div class="flex w-[98%] justify-end">
        <button
          aria-label="Close"
          class="absolute cursor-pointer text-gray-500 hover:text-gray-700"
          onclick={() => ($image_tool_opened = false)}><Icon src={AiOutlineClose} /></button
        >
      </div>
      <ImageTool.default />
    {/await}
  {/snippet}
</Modal>
{#if excel_preview_opened}
  {#await import('~/components/PreviewExcel.svelte') then PreviewExcel}
    <PreviewExcel.default
      file_link={current_dowbload_link}
      file_name={current_file_name}
      bind:file_preview_opened={excel_preview_opened}
      workbook={current_workbook}
    />
  {/await}
{/if}

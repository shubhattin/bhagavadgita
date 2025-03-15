<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { z } from 'zod';
  import MainPage from '~/components/pages/main_page/MainPage.svelte';
  import { chapter_selected } from '~/state/main_page/main_state';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const params_schema = z.object({
    chapter: z.coerce.number().int().optional().default(0)
  });

  const params = $derived(params_schema.parse(page.params));
  function set_chapter() {
    $chapter_selected = params.chapter;
  }
  set_chapter();
  $effect(() => {
    if (browser) set_chapter();
  });
</script>

<MainPage />

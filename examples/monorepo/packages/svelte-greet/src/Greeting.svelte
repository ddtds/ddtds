<script lang="ts">
  import { greet } from "@ddtds/greet";

  let { name }: { name: string } = $props();
</script>

<p>{greet(name)}</p>

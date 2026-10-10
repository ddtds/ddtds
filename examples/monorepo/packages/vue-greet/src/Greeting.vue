<script setup lang="ts">
import { greet } from "@ddtds/greet";

defineProps<{ name: string }>();
</script>

<template>
  <p>{{ greet(name) }}</p>
</template>

<template>
  <div class="w-full flex flex-col items-center">
    <div class="max-w-lg bg-white shadow-md rounded-lg overflow-hidden mx-auto mt-32 max-w-md mb-4">
      <slot />
    </div>
  </div>
</template>
<script>
export default {
  name: 'Card'
};
</script>

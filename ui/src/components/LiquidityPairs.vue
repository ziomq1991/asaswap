<template>
  <div class="w-full flex flex-col items-center mt-32">
    <div class="w-full text-left">
      <h1>Your liquidity:</h1>
    </div>

    <div class="max-w-lg bg-white shadow-md rounded-lg overflow-hidden mx-auto max-w-md mb-4 w-full">
      <slot />
    </div>
  </div>
</template>
<script>
export default {
  name: 'Card'
};
</script>

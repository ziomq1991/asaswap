<template>
  <div>
    <div
      class="p-2 bg-indigo-800 items-center text-indigo-100 leading-none flex w-screen"
      role="alert"
    >
      <span
        class="flex rounded-full bg-red-500 uppercase px-2 py-1 text-xs font-bold mr-3"
      >WARNING</span>
      <span
        class="font-semibold mr-2 text-left flex-auto"
      >You need to withdraw your funds before performing any other
        operation</span>
    </div>
  </div>
</template>
<script>
export default {
  name: 'WithdrawalAlert'
};
</script>

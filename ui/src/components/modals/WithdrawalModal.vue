<template>
  <div class="fixed z-10 inset-0 overflow-y-auto">
    <div
      class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
    >
      <div
        class="fixed inset-0 transition-opacity"
        aria-hidden="true"
      >
        <div class="absolute inset-0 bg-gray-500 opacity-75" />
      </div>

      <!-- This element is to trick the browser into centering the modal contents. -->
      <span
        class="hidden sm:inline-block sm:align-middle sm:h-screen"
        aria-hidden="true"
      >&#8203;</span>
      <div
        class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
      >
        <div class="bg-white px-16 pt-20 pb-16 sm:p-6 sm:pb-4 text-center">
          <div>
            Before proceeding you need to withdraw your tokens.
          </div>
          <div class="flex mt-4 justify-center">
            <t-button @click="withdraw">
              Withdraw your tokens
            </t-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
export default {
  name: 'WithdrawalModal',
  methods: {
    withdraw() {
      this.$store.dispatch('algorand/WITHDRAW');
    }
  }
};
</script>

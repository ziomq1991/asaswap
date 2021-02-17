<template>
  <div class="fixed z-10 inset-0 overflow-y-auto">
    <div
      class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
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
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="w-full">
              <h3
                id="modal-headline"
                class="text-lg leading-6 font-medium text-gray-900"
              >
                Account
              </h3>
              <div class="mt-4 flex flex flex-row w-full flex-wrap">
                <div>User Liquidity Tokens:</div>
                <div class="text-right font-bold flex-grow break-all truncate">
                  {{ liquidityTokens }}
                </div>
              </div>
              <div class="mt-2 flex flex flex-row w-full flex-wrap">
                <div>Algos Balance:</div>
                <div class="text-right font-bold flex-grow break-all truncate">
                  {{ algosBalance }}
                </div>
              </div>
              <div class="mt-2 flex flex flex-row w-full flex-wrap">
                <div>{{ assetName }} Balance:</div>
                <div class="text-right font-bold flex-grow break-all truncate">
                  {{ assetBalance }}
                </div>
              </div>
              <h3
                id="modal-headline"
                class="text-lg leading-6 font-medium text-gray-900 mt-4"
              >
                Global Balances
              </h3>
              <div class="mt-4 flex flex flex-row w-full flex-wrap">
                <div>Liquidity Tokens:</div>
                <div class="text-right font-bold flex-grow break-all truncate">
                  {{ globalState.LIQ_TOKENS }}
                </div>
              </div>
              <div class="mt-2 flex flex flex-row w-full flex-wrap">
                <div>Algos Balance:</div>
                <div class="text-right font-bold flex-grow break-all truncate">
                  {{ globalAlgosBalance }}
                </div>
              </div>
              <div class="mt-2 flex flex flex-row w-full flex-wrap">
                <div>{{ assetName }} Balance:</div>
                <div class="text-right font-bold flex-grow break-all truncate">
                  {{ globalAssetBalance }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse justify-center"
        >
          <button
            type="button"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            @click="onClose"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import eventBus from '@/utils/eventBus';
import { getAlgos, getAssetDisplayAmount } from '@/utils/conversion';
import { ASSET_NAME } from '@/config';
import { mapGetters } from 'vuex';

export default {
  name: 'SelectAccountModal',
  data() {
    return {
      selectedAccount: null,
      assetName: ASSET_NAME,
    };
  },
  computed: {
    ...mapGetters({
      algorand: 'algorand/algorand',
      userState: 'algorand/userState',
      globalState: 'algorand/globalState'
    }),
    globalAlgosBalance() {
      return getAlgos(this.globalState.ALGOS_BAL);
    },
    globalAssetBalance() {
      return getAssetDisplayAmount(this.globalState.ASA_BAL);
    },
    algosBalance() {
      if (isNaN(this.userState.USR_ALGOS)) {
        return 'N/A';
      }
      return getAlgos(this.userState.USR_ALGOS);
    },
    assetBalance() {
      if (isNaN(this.userState.USR_ASA)) {
        return 'N/A';
      }
      return getAssetDisplayAmount(this.userState.USR_ASA);
    },
    liquidityTokens() {
      if (isNaN(this.userState.USR_LIQ)) {
        return 'N/A';
      }
      return this.userState.USR_LIQ;
    },
  },
  mounted() {
    if (this.accounts) {
      this.selectedAccount = this.accounts[0];
    }
  },
  methods: {
    onClose() {
      eventBus.$emit('close-modals');
    },
    onSelect() {
      if (this.selectedAccount) {
        this.$store.dispatch('algorand/SELECT_ACCOUNT', {
          accountAddress: this.selectedAccount,
        });
      }
      eventBus.$emit('close-modals');
    },
  },
};
</script>

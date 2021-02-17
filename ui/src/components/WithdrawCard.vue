<template>
  <div>
    <div class="w-full flex flex-col justify-center items-center">
      <div class="max-w-lg bg-white shadow-md rounded-lg overflow-hidden mx-auto mt-32 max-w-md mb-4">
        <div class="py-4 px-8 mt-3">
          <div class="flex flex-col mb-8">
            <h2 class="text-gray-700 font-semibold text-2xl tracking-wide mb-2">
              Withdraw
            </h2>
            <p class="text-gray-500 text-base">
              The following amounts are available to withdraw.
            </p>
            <p class="text-gray-500 text-base">
              You need to withdraw them in full before performing any other operation.
            </p>
          </div>
          <div v-if="!!(userState.USR_ALGOS || userState.USR_ASA)">
            <div>
              <NumberInput
                :value="assetToDisplay"
                :label="assetLabel"
                disabled
              />
            </div>
            <div class="mt-4">
              <NumberInput
                label="Algos"
                :value="algosDisplay"
                disabled
              />
            </div>
            <div class="py-4">
              <ActionButton
                label="Withdraw"
                :enable="!!(userState.USR_ALGOS || userState.USR_ASA)"
                :execute="onWithdraw"
              />
            </div>
          </div>
          <div v-else>
            <div class="bg-indigo-500 rounded-lg px-4 py-4 text-center mb-4 text-white">
              There is nothing to withdraw
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { mapGetters } from 'vuex';
import NumberInput from './NumberInput';
import { getAlgos, getAssetDisplayAmount } from '@/utils/conversion';
import ActionButton from './ActionButton';
import { ASSET_NAME, ASSET_INDEX } from '@/config/config';

export default {
  name: 'WithdrawCard',
  components: {
    NumberInput,
    ActionButton
  },
  computed: {
    ...mapGetters({
      algorand: 'algorand/algorand',
      userState: 'algorand/userState',
      userAssets: 'algorand/userAssets'
    }),
    algosDisplay() {
      return Number(getAlgos(this.userState.USR_ALGOS || 0));
    },
    assetToDisplay() {
      return Number(getAssetDisplayAmount(this.userState.USR_ASA || 0));
    },
    assetLabel() {
      return ASSET_NAME;
    }
  },
  methods: {
    async onWithdraw() {
      const accountAddress = this.algorand.account;
      if (this.userAssets.indexOf(ASSET_INDEX) === -1) {
        await this.waitForAction(() => this.algorand.serviceInstance.optInAsset(accountAddress), 'Opting-In to Asset...');
      }
      await this.waitForAction(() => this.algorand.serviceInstance.withdraw(accountAddress, this.userState.USR_ASA, this.userState.USR_ALGOS));
    }
  }
};
</script>

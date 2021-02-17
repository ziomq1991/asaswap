<template>
  <div>
    <div class="w-full flex flex-col justify-center items-center">
      <div
        class="max-w-lg bg-white shadow-md rounded-lg overflow-hidden mx-auto mt-32 max-w-md mb-4"
      >
        <div class="py-4 px-8 mt-3">
          <div class="flex flex-col mb-8">
            <h2 class="text-gray-700 font-semibold text-2xl tracking-wide mb-2">
              Remove Liquidity
            </h2>
            <p class="text-base text-gray-500">
              Enter the amount of liquidity that you would like to remove.
            </p>
            <p
              v-if="maximumValueDisplay"
              class="text-base text-gray-500"
            >
              You have <b>{{ maximumValueDisplay }}</b> liquidity tokens that
              you can remove.
            </p>
            <p
              v-else
              class="text-base text-gray-500"
            >
              You have not provided liquidity to the pool yet.
            </p>
          </div>

          <div>
            <NumberInput
              v-model="liquidityTokens"
              label="Liquidity Tokens"
              :max="userState.USR_LIQ"
              placeholder="0"
              :allow-decimals="false"
              @change="validate"
            />
          </div>
          <div class="py-4">
            <ActionButton
              label="Remove Liquidity"
              :execute="onAddLiquidity"
              :validate="validate"
              :error="error"
            />
          </div>
        </div>
        <div
          v-if="isReady"
          class="bg-gray-100 rounded-lg"
        >
          <div class="py-4 px-4">
            Corresponding amounts to remove from the pool:
            <div class="flex flex-col">
              <div class="flex flex-row">
                <div>Algos:</div>
                <div class="text-right flex-grow font-bold">
                  {{ amountOfAlgosDisplay }}
                </div>
              </div>
              <div class="flex flex-row">
                <div>{{ assetName }}:</div>
                <div class="text-right flex-grow font-bold">
                  {{ amountOfAssetDisplay }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { mapGetters } from 'vuex';
import { getAlgos, getAssetDisplayAmount } from '@/utils/conversion';
import { ASSET_NAME } from '@/config/config';
import NumberInput from './NumberInput';
import ActionButton from './ActionButton';

export default {
  name: 'RemoveLiquidityCard',
  components: {
    NumberInput,
    ActionButton,
  },
  data() {
    return {
      liquidityTokens: null,
      error: null,
    };
  },
  computed: {
    ...mapGetters({
      algorand: 'algorand/algorand',
      isReady: 'algorand/isReady',
      userState: 'algorand/userState',
      globalState: 'algorand/globalState',
    }),
    maximumValueDisplay() {
      return this.userState.USR_LIQ;
    },
    assetName() {
      return ASSET_NAME;
    },
    amountOfAlgos() {
      if (this.globalState.LIQ_TOKENS === 0) {
        return;
      }
      const value =
        (this.globalState.ALGOS_BAL * this.liquidityTokens) /
          this.globalState.LIQ_TOKENS -
        2000;
      if (typeof value !== 'number' || isNaN(value)) {
        return;
      }
      if (value < 0) {
        return 0;
      }
      return getAlgos(value);
    },
    amountOfAsset() {
      if (this.globalState.LIQ_TOKENS === 0) {
        return;
      }
      const value =
        (this.globalState.ASA_BAL * this.liquidityTokens) /
        this.globalState.LIQ_TOKENS;
      if (typeof value !== 'number' || isNaN(value)) {
        return;
      }
      return getAssetDisplayAmount(value);
    },
    amountOfAlgosDisplay() {
      if (typeof this.amountOfAlgos !== 'number') {
        return 'N/A';
      }
      return this.amountOfAlgos;
    },
    amountOfAssetDisplay() {
      if (typeof this.amountOfAsset !== 'number') {
        return 'N/A';
      }
      return this.amountOfAsset;
    },
  },
  methods: {
    validate() {
      if (Number(this.liquidityTokens) <= 0) {
        this.error = 'Enter a valid amount';
      } else if (Number(this.liquidityTokens) > this.userState.USR_LIQ) {
        this.error = 'Enter a valid amount';
      } else if (!Number.isInteger(Number(this.liquidityTokens))) {
        this.error = 'Must be an integer';
      } else if (!(this.amountOfAlgos > 0 || this.amountOfAsset > 0)) {
        this.error = 'Enter a valid amount';
      } else {
        this.error = null;
      }
      return !this.error;
    },
    resetError() {
      this.error = null;
    },
    async onAddLiquidity() {
      const accountAddress = this.algorand.account;
      await this.waitForChanges(() =>
        this.algorand.serviceInstance.removeLiquidity(
          accountAddress,
          this.liquidityTokens
        )
      );
      this.liquidityTokens = 0;
    },
  },
};
</script>

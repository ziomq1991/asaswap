<template>
  <div>
    <Card>
      <div class="py-4 px-8 mt-3">
        <div class="flex flex-col mb-8">
          <h2 class="text-gray-700 font-semibold text-2xl tracking-wide mb-2">
            Add Liquidity
          </h2>
          <p class="text-gray-500 text-base">
            Enter the amount of liquidity that you would like to add.
          </p>
        </div>
        <div class="mt-4">
          <NumberInput
            v-model="assetAmount"
            :label="assetName"
            @change="onAssetInputChange(true)"
            @input.native="onAssetInputChange(false)"
          />
        </div>
        <div class="mt-4">
          <NumberInput
            v-model="algosAmount"
            label="Algos"
            @change="onAlgosInputChange(true)"
            @input.native="onAlgosInputChange(false)"
          />
        </div>
        <div class="py-4">
          <ActionButton
            label="Add Liquidity"
            :execute="onAddLiquidity"
            :validate="validate"
            :error="error"
          />
        </div>
      </div>
      <div
        v-if="globalState !== {}"
        class="bg-gray-100 rounded-lg"
      >
        <div class="py-4 px-4">
          <div class="flex flex-col">
            <div class="flex flex-row">
              <div>Exchange rate:</div>
              <div class="text-right flex-grow font-bold">
                {{ algosPerAsset }}
              </div>
            </div>
            <div class="flex flex-row">
              <div />
              <div class="text-right flex-grow font-bold">
                {{ assetPerAlgos }}
              </div>
            </div>
            <div class="flex flex-row">
              <div>Liquidity Tokens:</div>
              <div class="text-right flex-grow font-bold">
                {{ liquidityTokensDisplay }}
              </div>
            </div>
            <div class="flex flex-row">
              <div>Pool Share:</div>
              <div class="text-right flex-grow font-bold">
                {{ poolShareDisplay }}
              </div>
            </div>
          </div>
        </div>
        <p class="px-4 py-4">
          By adding liquidity you'll earn 0.3% of all trades on this pair
          proportional to your share of the pool. Fees are added to the pool,
          accrued in real-time, and can be claimed by withdrawing your
          liquidity.
        </p>
      </div>
    </Card>
  </div>
</template>
<script>
import { mapGetters } from 'vuex';
import NumberInput from '../NumberInput';
import {
  getAlgos,
  getMicroAlgos,
  getAssetDisplayAmount,
  getRawAssetAmount,
} from '@/utils/conversion';
import { getInputError } from '@/utils/validation';
import ActionButton from '../ActionButton';
import {
  ALGOS_DECIMAL_POINTS,
  ASSET_DECIMAL_POINTS,
  RATIO,
  ASSET_NAME,
} from '@/config';
import { ExchangeCalculator } from '@/utils/exchange';
import Card from '@/components/cards/Card';

export default {
  name: 'AddLiquidityCard',
  components: {
    NumberInput,
    ActionButton,
    Card
  },
  data() {
    return {
      assetAmount: null,
      algosAmount: null,
      errors: {},
      error: null,
      hasErrors: false,
    };
  },
  computed: {
    ...mapGetters({
      algorand: 'algorand/algorand',
      globalState: 'algorand/globalState',
    }),
    exchangeRate() {
      return Math.trunc(
        (getMicroAlgos(this.algosAmount) * RATIO) /
          getRawAssetAmount(this.assetAmount)
      );
    },
    globalExchangeRate() {
      const mappedGlobalState = this.globalState;
      let calculator = new ExchangeCalculator(
        mappedGlobalState['ALGOS_BAL'],
        mappedGlobalState['ASA_BAL']
      );
      return calculator.getGlobalExchangeRate();
    },
    reverseGlobalExchangeRate() {
      const mappedGlobalState = this.globalState;
      let calculator = new ExchangeCalculator(
        mappedGlobalState['ALGOS_BAL'],
        mappedGlobalState['ASA_BAL']
      );
      return calculator.getReverseGlobalExchangeRate();
    },
    algosPerAsset() {
      if (!this.globalExchangeRate || !isFinite(this.globalExchangeRate)) {
        return 'N/A';
      }
      const value = getAlgos(
        getRawAssetAmount(this.globalExchangeRate) / RATIO,
        true
      );
      return `${value} ALGOS PER ${ASSET_NAME.toUpperCase()}`;
    },
    assetPerAlgos() {
      if (!this.globalExchangeRate || !isFinite(this.globalExchangeRate)) {
        return 'N/A';
      }
      const value = getAssetDisplayAmount(
        getMicroAlgos(this.reverseGlobalExchangeRate) / RATIO,
        true
      );
      return `${value} ${ASSET_NAME.toUpperCase()} PER ALGOS`;
    },
    difference() {
      const difference =
        Math.trunc(
          (Math.abs(this.exchangeRate - this.globalExchangeRate) * RATIO) /
            this.globalExchangeRate
        ) / RATIO;
      return difference;
    },
    isDifferenceCorrect() {
      if (isNaN(this.difference)) {
        return false;
      }
      return this.difference < 0.01;
    },
    liquidityTokens() {
      if (!this.globalState) {
        return;
      }
      if (this.globalState.LIQ_TOKENS === 0) {
        return getMicroAlgos(this.algosAmount);
      }
      return Math.trunc(
        (getMicroAlgos(this.algosAmount) * this.globalState.LIQ_TOKENS) /
          this.globalState.ALGOS_BAL
      );
    },
    liquidityTokensDisplay() {
      if (!this.liquidityTokens) {
        return 'N/A';
      }
      return this.liquidityTokens;
    },
    assetName() {
      return ASSET_NAME;
    },
    poolShareDisplay() {
      if (this.liquidityTokens && this.globalState.LIQ_TOKENS === 0) {
        return '100%';
      } else if (!this.globalState.LIQ_TOKENS) {
        return '0%';
      }
      const value = (this.liquidityTokens * 100 / (this.globalState.LIQ_TOKENS + this.liquidityTokens)).toFixed(2);
      if (value >= 100) {
        return '99.99%';
      }
      return value + '%';
    }
  },
  methods: {
    onAlgosInputChange(recalculate) {
      if (this.algosAmount === null || this.algosAmount === '') {
        this.assetAmount = null;
        return;
      }
      this.assetAmount = getAssetDisplayAmount(
        Math.trunc(
          (getMicroAlgos(this.algosAmount) / this.globalExchangeRate) * RATIO
        )
      );
      if (!this.isDifferenceCorrect && recalculate) {
        this.algosAmount = getAlgos(
          Math.trunc(
            (this.globalExchangeRate * getRawAssetAmount(this.assetAmount)) /
              RATIO
          )
        );
      }
      this.validate();
    },
    onAssetInputChange(recalculate) {
      if (this.assetAmount === null || this.assetAmount === '') {
        this.algosAmount = null;
        return;
      }
      this.algosAmount = getAlgos(
        Math.trunc(
          (this.globalExchangeRate * getRawAssetAmount(this.assetAmount)) /
            RATIO
        )
      );
      if (!this.isDifferenceCorrect && recalculate) {
        this.assetAmount = getAssetDisplayAmount(
          Math.trunc(
            (getMicroAlgos(this.algosAmount) / this.globalExchangeRate) * RATIO
          )
        );
      }
      this.validate();
    },
    validate() {
      let error = null;
      error = getInputError(this.assetAmount, ASSET_DECIMAL_POINTS, ASSET_NAME);
      error =
        error ||
        getInputError(this.algosAmount, ALGOS_DECIMAL_POINTS, 'Algorand');
      if (
        !error &&
        !this.isDifferenceCorrect &&
        this.globalState.LIQ_TOKENS > 0
      ) {
        error = 'Invalid exchange rate';
      }
      this.error = error;
      this.$forceUpdate();
      return !error;
    },
    async onAddLiquidity() {
      const accountAddress = this.algorand.account;
      await this.waitForAction(() =>
        this.algorand.serviceInstance.addLiquidity(
          accountAddress,
          getRawAssetAmount(this.assetAmount),
          getMicroAlgos(this.algosAmount)
        )
      );
      this.algosAmount = null;
      this.assetAmount = null;
    },
  },
};
</script>

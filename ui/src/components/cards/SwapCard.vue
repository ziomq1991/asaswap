<template>
  <div>
    <Card>
      <div class="py-4 px-8 mt-3">
        <div class="flex flex-col mb-8">
          <h2 class="text-gray-700 font-semibold text-2xl tracking-wide mb-2">
            Swap
          </h2>
          <p class="text-gray-500 text-base">
            Enter the amount of currency that you would like to swap.
          </p>
        </div>
        <div class="bg-gray-100 rounded-lg mb-4">
          <div class="py-4 px-4">
            <div class="flex flex-row flex-wrap">
              <div class="flex flex-col flex-grow mr-4">
                <NumberInput
                  v-model="firstAmount"
                  :disabled="!algorand.applicationData"
                  @change="onFirstInputChange"
                  @input.native="onFirstInputChange"
                />
              </div>
              <div class="flex flex-col">
                <t-select
                  v-model="firstCurrency"
                  class="h-full"
                  :options="currencies"
                  :disabled="!algorand.applicationData"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-col justify-center items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="h-4"
          >
            <path
              fillRule="evenodd"
              d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div class="bg-gray-100 rounded-lg mt-4">
          <div class="py-4 px-4">
            <div class="flex flex-row flex-wrap">
              <div class="flex flex-col flex-grow mr-4">
                <NumberInput
                  v-model="secondAmount"
                  :disabled="!algorand.applicationData"
                  @change="onSecondInputChange(true)"
                  @input.native="onSecondInputChange(false)"
                />
              </div>
              <div class="flex flex-col">
                <t-select
                  v-model="secondCurrency"
                  class="h-full"
                  :options="currencies"
                  :disabled="!algorand.applicationData"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="py-4">
          <ActionButton
            label="Swap"
            :execute="onSwap"
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
                {{ exchangeRateDisplay }}
              </div>
            </div>
            <div class="flex flex-row">
              <div />
              <div class="text-right flex-grow font-bold">
                {{ reverseExchangeRateDisplay }}
              </div>
            </div>
            <div class="flex flex-row">
              <div>Price impact:</div>
              <div class="text-right flex-grow font-bold">
                {{ priceImpactDisplay }}
              </div>
            </div>
            <div class="flex flex-row">
              <div>Liquidity fee:</div>
              <div class="text-right flex-grow font-bold">
                {{ feeDisplay }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>
<script>
import { mapGetters } from 'vuex';
import {
  getAlgos,
  getMicroAlgos,
  getAssetDisplayAmount,
  getRawAssetAmount,

} from '@/utils/conversion';
import { getInputError } from '@/utils/validation';
import NumberInput from '../NumberInput.vue';
import ActionButton from '../ActionButton';
import {
  ALGOS_DECIMAL_POINTS,
  ASSET_DECIMAL_POINTS,
  ASSET_NAME,
  RATIO,
} from '@/config';
import { ExchangeCalculator } from '@/utils/exchange';
import Card from '@/components/cards/Card';

export default {
  name: 'SwapCard',
  components: {
    NumberInput,
    ActionButton,
    Card
  },
  data() {
    return {
      firstCurrency: 'ALGOS',
      secondCurrency: ASSET_NAME.toUpperCase(),
      firstAmount: null,
      secondAmount: null,
      currencies: ['ALGOS', ASSET_NAME.toUpperCase()],
      feePercentage: 3,
      error: null,
    };
  },
  computed: {
    ...mapGetters({
      algorand: 'algorand/algorand',
      globalState: 'algorand/globalState',
    }),
    globalExchangeRate() {
      const mappedGlobalState = this.globalState;
      let calculator = new ExchangeCalculator(
        mappedGlobalState['ALGOS_BAL'],
        mappedGlobalState['ASA_BAL']
      );
      return calculator.getGlobalExchangeRate();
    },
    exchangeRate() {
      const mappedGlobalState = this.globalState;
      const calculator = new ExchangeCalculator(
        mappedGlobalState['ALGOS_BAL'],
        mappedGlobalState['ASA_BAL']
      );
      if (this.firstCurrency == 'ALGOS') {
        return calculator.getSwapExchangeRate(
          getMicroAlgos(this.firstAmount),
          0
        );
      } else {
        return calculator.getSwapExchangeRate(
          0,
          getRawAssetAmount(this.firstAmount)
        );
      }
    },
    reverseExchangeRate() {
      const mappedGlobalState = this.globalState;
      const calculator = new ExchangeCalculator(
        mappedGlobalState['ALGOS_BAL'],
        mappedGlobalState['ASA_BAL']
      );
      if (this.firstCurrency == 'ALGOS') {
        return calculator.getReverseSwapExchangeRate(
          getMicroAlgos(this.firstAmount),
          0
        );
      } else {
        return calculator.getReverseSwapExchangeRate(
          0,
          getRawAssetAmount(this.firstAmount)
        );
      }
    },
    exchangeRateDisplay() {
      if (!this.exchangeRate || !isFinite(this.exchangeRate)) {
        return 'N/A';
      }
      const value = getAlgos(
        getRawAssetAmount(this.exchangeRate) / RATIO, true
      );
      return `${value} ALGOS PER ${ASSET_NAME.toUpperCase()}`;
    },
    reverseExchangeRateDisplay() {
      if (!this.reverseExchangeRate || !isFinite(this.reverseExchangeRate)) {
        return 'N/A';
      }
      const value = getAssetDisplayAmount(
        getMicroAlgos(this.reverseExchangeRate) / RATIO, true
      );
      return `${value} ${ASSET_NAME.toUpperCase()} PER ALGOS`;
    },
    priceImpact() {
      const difference =
        Math.trunc(
          (Math.abs(this.exchangeRate - this.globalExchangeRate) *
            RATIO) /
            this.globalExchangeRate
        ) / RATIO;
      return difference;
    },
    priceImpactDisplay() {
      if (!this.priceImpact || !this.firstAmount || !this.secondAmount) {
        return 'N/A';
      }
      return (this.priceImpact * 100).toFixed(2) + ' %';
    },
    fee() {
      const mappedGlobalState = this.globalState;
      const calculator = new ExchangeCalculator(
        mappedGlobalState['ALGOS_BAL'],
        mappedGlobalState['ASA_BAL']
      );
      if (this.firstCurrency == 'ALGOS') {
        return calculator.getAlgosToAssetFee(getMicroAlgos(this.firstAmount));
      } else {
        return calculator.getAssetToAlgosFee(
          getRawAssetAmount(this.firstAmount)
        );
      }
    },
    feeDisplay() {
      if (!this.fee) {
        return 'N/A';
      }
      let value;
      if (this.firstCurrency == 'ALGOS') {
        value = getAssetDisplayAmount(this.fee, true);
      } else {
        value = getAlgos(this.fee, true);
      }
      return `${value} ${this.secondCurrency.toUpperCase()}`;
    },
  },
  watch: {
    firstCurrency(value) {
      if (value === this.secondCurrency) {
        const currencies = [...this.currencies];
        const indexOfCurrency = currencies.indexOf(value);
        const otherCurrencies = currencies.splice(indexOfCurrency - 1, 1);
        this.secondCurrency = otherCurrencies[0];
      }
      this.onFirstInputChange();
    },
    secondCurrency(value) {
      if (value === this.firstCurrency) {
        const currencies = [...this.currencies];
        const indexOfCurrency = currencies.indexOf(value);
        const otherCurrencies = currencies.splice(indexOfCurrency - 1, 1);
        this.firstCurrency = otherCurrencies[0];
      }
      this.onFirstInputChange();
    },
  },
  methods: {
    getExchangeRate(assetAmount, algosAmount) {
      if (!this.globalState) {
        return null;
      }
      const mappedGlobalState = this.globalState;
      if (!mappedGlobalState) {
        return null;
      }
      const tokensBalance = mappedGlobalState['ASA_BAL'] + Number(assetAmount);
      const algosBalance =
        mappedGlobalState['ALGOS_BAL'] + getMicroAlgos(algosAmount);
      return Math.trunc(
        (algosBalance * this.ratioDecimalPoints) / tokensBalance
      );
    },
    onFirstInputChange() {
      this.validate();
      if (!this.globalState) {
        return null;
      }
      let calculator = new ExchangeCalculator(
        this.globalState['ALGOS_BAL'],
        this.globalState['ASA_BAL']
      );
      if (this.firstCurrency === ASSET_NAME.toUpperCase()) {
        const rawAsset = getRawAssetAmount(this.firstAmount);
        const rawAlgos = calculator.assetToAlgos(rawAsset);
        this.secondAmount = getAlgos(rawAlgos);
      } else if (this.firstCurrency === 'ALGOS') {
        const rawAlgos = getMicroAlgos(this.firstAmount);
        const rawAsset = calculator.algosToAsset(rawAlgos);
        this.secondAmount = getAssetDisplayAmount(rawAsset);
      }
    },
    onSecondInputChange(recalculate) {
      this.validate();
      if (!this.globalState) {
        return null;
      }
      let calculator = new ExchangeCalculator(
        this.globalState['ALGOS_BAL'],
        this.globalState['ASA_BAL']
      );
      if (this.firstCurrency === ASSET_NAME.toUpperCase()) {
        const rawAlgos = getMicroAlgos(this.secondAmount);
        const rawAsset = calculator.reverseAssetToAlgos(rawAlgos);
        this.firstAmount = getAssetDisplayAmount(rawAsset);
        const secondAmount = getAlgos(calculator.assetToAlgos(rawAsset));
        if (recalculate || secondAmount < this.secondAmount) {
          this.secondAmount = secondAmount;
        }
      } else if (this.firstCurrency === 'ALGOS') {
        const rawAsset = getRawAssetAmount(this.secondAmount);
        const rawAlgos = calculator.reverseAlgosToAsset(rawAsset);
        this.firstAmount = getAlgos(rawAlgos);
        const secondAmount = getAssetDisplayAmount(
          calculator.algosToAsset(rawAlgos)
        );
        if (recalculate || secondAmount < this.secondAmount) {
          this.secondAmount = secondAmount;
        }
      }
    },
    validate() {
      let error = null;
      if (this.firstCurrency === 'ALGOS') {
        error = getInputError(
          this.firstAmount,
          ALGOS_DECIMAL_POINTS,
          'Algorand'
        );
        error =
          error ||
          getInputError(this.secondAmount, ASSET_DECIMAL_POINTS, ASSET_NAME);
      } else {
        error = getInputError(
          this.firstAmount,
          ASSET_DECIMAL_POINTS,
          ASSET_NAME
        );
        error =
          error ||
          getInputError(this.secondAmount, ALGOS_DECIMAL_POINTS, 'Algorand');
      }
      this.error = error;
      this.$forceUpdate();
      return !error;
    },
    async onSwap() {
      const accountAddress = this.algorand.account;
      if (this.firstCurrency === ASSET_NAME.toUpperCase()) {
        await this.waitForAction(() =>
          this.algorand.serviceInstance.swapAsset(
            accountAddress,
            getRawAssetAmount(this.firstAmount)
          )
        );
      } else if (this.firstCurrency === 'ALGOS') {
        await this.waitForAction(() =>
          this.algorand.serviceInstance.swapAlgos(
            accountAddress,
            getMicroAlgos(this.firstAmount)
          )
        );
      }
      this.firstAmount = 0.0;
      this.secondAmount = 0.0;
    },
  },
};
</script>

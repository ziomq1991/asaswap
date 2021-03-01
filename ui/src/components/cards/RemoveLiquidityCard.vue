<template>
  <div>
    <WithdrawalModal v-if="hasToWithdrawLiquidity && !rawStore.pendingAction && !rawStore.pendingUpdate" />
    <Card>
      <div class="py-4 px-8 mt-3">
        <div class="flex flex-col mb-8">
          <h1 class="text-gray-700 font-semibold tracking-wide mb-2">
            Remove Liquidity
          </h1>
          <p class="text-base text-gray-500">
            Enter the amount of liquidity that you would like to remove.
          </p>
          <p
            v-if="maximumValue"
            class="text-base text-gray-500"
          >
            You have <b>{{ maximumValue }}</b> liquidity tokens that
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
          <label>Pair</label>
          <p>{{ currentPair.key }}</p>
        </div>
        <div class="mt-4">
          <NumberInput
            v-model="liquidityTokens"
            label="Liquidity Tokens"
            :max="maximumValue"
            placeholder="0"
            :allow-decimals="false"
            @input="validate"
          />
        </div>
        <div class="py-4">
          <ActionButton
            label="Remove Liquidity"
            :execute="onRemoveLiquidity"
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
            <div class="flex sm:flex-row flex-col mt-2 sm:mt-0">
              <div>{{ primaryAsset.assetName }}:</div>
              <div class="sm:text-right flex-grow font-bold">
                {{ amountOfPrimaryAssetDisplay }}
              </div>
            </div>
            <div class="flex sm:flex-row flex-col mt-2 sm:mt-0">
              <div>{{ secondaryAsset.assetName }}:</div>
              <div class="sm:text-right flex-grow font-bold">
                {{ amountOfSecondaryAssetDisplay }}
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
import NumberInput from '../NumberInput';
import ActionButton from '../ActionButton';
import Card from './Card';
import { GLOBAL_A_BAL, GLOBAL_B_BAL, GLOBAL_LIQ_TOKENS, USR_LIQ_TOKENS } from '@/utils/constants';
import { ASSET_PAIRS } from '@/utils/assetPairs';
import WithdrawalModal from '@/components/modals/WithdrawalModal';

export default {
  name: 'RemoveLiquidityCard',
  components: {
    NumberInput,
    ActionButton,
    Card,
    WithdrawalModal
  },
  data() {
    return {
      liquidityTokens: null,
      error: null,
    };
  },
  computed: {
    ...mapGetters({
      rawStore: 'algorand/rawStore',
      globalState: 'algorand/globalState',
      currentPair: 'algorand/currentPair',
      assetBalances: 'algorand/assetBalances',
      isReady: 'algorand/isReady',
      hasToWithdrawLiquidity: 'algorand/hasToWithdrawLiquidity'
    }),
    primaryAsset() {
      return this.currentPair.primaryAsset;
    },
    secondaryAsset() {
      return this.currentPair.secondaryAsset;
    },
    maximumValue() {
      const liquidityAssetIndex = this.currentPair.liquidityAsset.assetIndex;
      return this.assetBalances[liquidityAssetIndex] ? this.assetBalances[liquidityAssetIndex] : 0;
    },
    amountOfPrimaryAsset() {
      if (this.globalState[GLOBAL_LIQ_TOKENS] === 0) {
        return;
      }
      let value = Math.trunc(
        (this.globalState[GLOBAL_A_BAL] * this.liquidityTokens) /
          this.globalState[GLOBAL_LIQ_TOKENS]
      );
      if (typeof value !== 'number' || isNaN(value)) {
        return;
      }
      return this.primaryAsset.getAssetDisplayAmount(value);
    },
    amountOfSecondaryAsset() {
      if (this.globalState[GLOBAL_LIQ_TOKENS] === 0) {
        return;
      }
      const value = Math.trunc(
        (this.globalState[GLOBAL_B_BAL] * this.liquidityTokens) /
        this.globalState[GLOBAL_LIQ_TOKENS]
      );
      if (typeof value !== 'number' || isNaN(value)) {
        return value;
      }
      return this.secondaryAsset.getAssetDisplayAmount(value);
    },
    amountOfPrimaryAssetDisplay() {
      if (typeof this.amountOfPrimaryAsset !== 'number') {
        return 'N/A';
      }
      if (this.amountOfPrimaryAsset < 0) {
        return 0;
      }
      return this.amountOfPrimaryAsset;
    },
    amountOfSecondaryAssetDisplay() {
      if (typeof this.amountOfPrimaryAsset !== 'number') {
        return 'N/A';
      }
      return this.amountOfSecondaryAsset;
    },
  },
  watch: {
    userState() {
      this.validate();
    },
    currentPair() {
      this.liquidityTokens = null;
      this.validate();
    }
  },
  created() {
    const pairKey = this.decodePair(this.$route.params.pair);
    if (!ASSET_PAIRS[pairKey]) {
      this.$router.push('/pool');
    }
    this.$store.dispatch('algorand/SET_CURRENT_PAIR', { pairKey });
  },
  methods: {
    decodePair(pairName) {
      return decodeURIComponent(pairName).toUpperCase().replace('-', '/');
    },
    validate() {
      if (Number(this.liquidityTokens) <= 0) {
        this.error = 'Enter a valid amount';
      } else if (Number(this.liquidityTokens) > this.maximumValue) {
        this.error = 'Enter a valid amount';
      } else if (!Number.isInteger(Number(this.liquidityTokens))) {
        this.error = 'Must be an integer';
      } else if (!(this.amountOfPrimaryAsset > 0 || this.amountOfSecondaryAssetDisplay > 0)) {
        this.error = 'Enter a valid amount';
      } else {
        this.error = null;
      }
      return !this.error;
    },
    async onRemoveLiquidity() {
      const liquidity = this.liquidityTokens;
      const accountAddress = this.rawStore.account;
      await this.$store.dispatch('algorand/QUEUE_ASSET_OPT_IN', {
        assetIds: [this.primaryAsset.assetIndex, this.secondaryAsset.assetIndex]
      });
      await this.$store.dispatch('algorand/QUEUE_ACTION', {
        actionMethod: async () =>
          await this.rawStore.serviceInstance.depositLiquidity(
            accountAddress,
            liquidity
          ),
        actionMessage: 'Depositing liquidity tokens...',
        actionVerificationMethod: ({ newState }) => {
          return Number(newState[USR_LIQ_TOKENS]) >= Number(liquidity);
        }
      });
      await this.$store.dispatch('algorand/QUEUE_ACTION', {
        actionMethod: async () =>
          await this.rawStore.serviceInstance.removeLiquidity(
            accountAddress,
            liquidity
          ),
        actionMessage: 'Removing liquidity...',
        actionVerificationMethod: ({ prevState, newState }) => {
          return Number(prevState[USR_LIQ_TOKENS]) !== Number(newState[USR_LIQ_TOKENS]);
        }
      });
      const currentPairAppIndex = this.currentPair.applicationId;
      await this.$store.dispatch('algorand/QUEUE_ACTION', {
        actionMethod: async () => {
          await this.$store.dispatch('algorand/FETCH_APPLICATION_DATA', { appId: currentPairAppIndex });
        },
        backgroundAction: true
      });
      await this.$store.dispatch('algorand/QUEUE_ACTION', {
        actionMethod: async () => {
          await this.$store.dispatch('algorand/WITHDRAW');
        },
        actionMessage: 'Withdrawing...'
      });
      this.liquidityTokens = null;
    },
  },
};
</script>

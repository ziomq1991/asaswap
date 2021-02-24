<template>
  <div class="max-w-5xl mx-auto mt-32 px-6">
    <h1
      v-if="assetPairsWithBalance.length"
      class="mb-4"
    >
      Your liquidity pools:
    </h1>
    <div
      v-for="pair in assetPairsWithBalance"
      :key="pair.key"
    >
      <LiquidityPair :pair="pair" />
    </div>
    <hr
      v-if="assetPairsWithBalance.length && assetPairsWithoutBalance.length"
      class="mb-4 mt-8 border-gray-400"
    >
    <h1
      v-if="assetPairsWithoutBalance.length"
      class="mb-4"
    >
      All liquidity pools:
    </h1>
    <div
      v-for="pair in assetPairsWithoutBalance"
      :key="pair.key"
    >
      <LiquidityPair :pair="pair" />
    </div>
  </div>
</template>
<script>
import { SINGLE_PAIRS } from '@/utils/assetPairs';
import LiquidityPair from '@/components/LiquidityPair';
import { mapGetters } from 'vuex';

export default {
  name: 'Liquidity',
  components: {
    LiquidityPair
  },
  computed: {
    ...mapGetters({
      userAssets: 'algorand/userAssets'
    }),
    assetPairsWithBalance() {
      return this.assetPairs.filter((pair) => pair.balance > 0);
    },
    assetPairsWithoutBalance() {
      return this.assetPairs.filter((pair) => pair.balance <= 0);
    },
    assetPairs() {
      return Object.values(SINGLE_PAIRS).map((pair) => {
        return {
          ...pair,
          balance: this.userAssets[pair.liquidityAsset.assetIndex] ? this.userAssets[pair.liquidityAsset.assetIndex].amount : 0
        };
      });
    }
  }
};
</script>

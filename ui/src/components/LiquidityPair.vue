<template>
  <div class="bg-white shadow-md rounded-lg overflow-hidden mb-4 w-full">
    <div class="px-6 py-4 md:flex md:flex-row">
      <div class="whitespace-nowrap md:flex-1">
        <h1 class="text-gray-700 font-semibold tracking-wide mb-1">
          {{ pair.key }}
        </h1>
        <p>Balance: {{ pair.balance }} Liquidity Tokens</p>
        <p v-if="poolShare !== null">
          Pool Share: {{ poolShare }}%
        </p>
        <p v-else>
          Pool Share: <Spinner
            class="inline-block ml-1 spinner"
            size="tiny"
          />
        </p>
      </div>
      <div class="flex md:flex-col flex-row mt-2 md:mt-0">
        <t-button
          classes="block add-remove-button tracking-widest md:mb-2 mr-2 md:mr-0 w-full uppercase text-center shadow bg-indigo-600 hover:bg-indigo-700 focus:shadow-outline focus:outline-none text-white text-xs py-3 px-10 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          @click="onAdd"
        >
          Add
        </t-button>
        <t-button
          v-if="pair.balance"
          classes="block add-remove-button tracking-widest w-full uppercase text-center shadow bg-pink-600 hover:bg-pink-700 focus:shadow-outline focus:outline-none text-white text-xs py-3 px-10 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          @click="onRemove"
        >
          Remove
        </t-button>
      </div>
    </div>
  </div>
</template>
<script>
import { mapGetters } from 'vuex';
import { GLOBAL_LIQ_TOKENS } from '@/utils/constants';
import { getMappedGlobalState } from '@/store/algorand/utils/format';
import Spinner from 'vue-simple-spinner';

export default {
  name: 'LiquidityPair',
  components: {
    Spinner
  },
  props: {
    pair: {
      required: true,
      type: Object
    }
  },
  computed: {
    ...mapGetters({
      rawStore: 'algorand/rawStore'
    }),
    poolShare() {
      if (!this.globalState) {
        return null;
      }
      if (!this.globalState[GLOBAL_LIQ_TOKENS]) {
        return Number(0).toFixed(2);
      }
      return (this.pair.balance * 100 / this.globalState[GLOBAL_LIQ_TOKENS]).toFixed(2);
    },
    globalState() {
      const applicationData = this.rawStore.applicationDataCache[this.pair.applicationId];
      if (!applicationData) {
        return null;
      }
      return getMappedGlobalState(applicationData);
    }
  },
  mounted() {
    if (!this.globalState) {
      this.$store.dispatch('algorand/FETCH_APPLICATION_DATA', { appId: this.pair.applicationId });
    } else if (Date.now() - this.globalState.fetchDate > 600) {
      this.$store.dispatch('algorand/FETCH_APPLICATION_DATA', { appId: this.pair.applicationId });
    }
  },
  methods: {
    encodePair(pairName) {
      return encodeURIComponent(
        pairName.toLowerCase().replace('/', '-')
      );
    },
    onAdd() {
      this.$router.push(`/add-liquidity/${this.encodePair(this.pair.key)}`);
    },
    onRemove() {
      this.$router.push(`remove-liquidity/${this.encodePair(this.pair.key)}`);
    }
  }
};
</script>
<style>
.spinner {
  position: relative;
  top: 1px;
}

.add-remove-button {
  min-width: 150px;
}
</style>

<template>
  <div />
</template>
<script>
import { mapGetters } from 'vuex';

export default {
  name: 'UpdateScheduler',
  data() {
    return {
      interval: null,
    };
  },
  computed: {
    ...mapGetters({
      algorand: 'algorand/algorand',
    }),
  },
  created() {
    this.interval = setInterval(this.updateState, 6000);
  },
  destroy() {
    clearInterval(this.interval);
  },
  methods: {
    updateState() {
      if (this.algorand.pendingAction) {
        return;
      }
      if (this.algorand.connected) {
        this.$store.dispatch('algorand/FETCH_ACCOUNT_DATA');
      }
      this.$store.dispatch('algorand/FETCH_APPLICATION_DATA');
      this.$store.dispatch('algorand/FETCH_ACCOUNTS');
    }
  }
};
</script>

export default {
  methods: {
    waitForAction: async function ({ func, actionMessage=null, verificationFunc=null }) {
      await this.$store.dispatch('algorand/QUEUE_ACTION', { func, actionMessage, verificationFunc });
    }
  }
};

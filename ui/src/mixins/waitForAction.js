export default {
  methods: {
    waitForAction: async function (func, actionMessage=null) {
      try {
        await this.$store.commit('algorand/SET_PENDING_ACTION', true);
        await this.$store.commit('algorand/SET_PENDING_ACTION_MESSAGE', actionMessage);
        const result = await func();
        await this.$store.commit('algorand/SET_PENDING_UPDATE', true);
        await this.$store.commit('algorand/SET_PENDING_ACTION', false);
        this.$store.dispatch('algorand/FETCH_ACCOUNT_DATA');
        this.$store.dispatch('algorand/FETCH_APPLICATION_DATA');
        return result;
      } catch (e) {
        this.$store.commit('algorand/SET_PENDING_UPDATE', false);
        this.$store.commit('algorand/SET_PENDING_ACTION', false);
        this.$store.commit('algorand/SET_PENDING_ACTION_MESSAGE', null);
        throw e;
      } finally {
        this.$store.commit('algorand/SET_PENDING_ACTION', false);
        this.$store.commit('algorand/SET_PENDING_ACTION_MESSAGE', null);
      }
    }
  }
};

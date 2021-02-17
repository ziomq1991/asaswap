import Vue from 'vue';
import Vuex from 'vuex';

import algorand from './algorand';

Vue.use(Vuex);

const store = new Vuex.Store({
  modules: {
    algorand
  },

  // enable strict mode (adds overhead!)
  // for dev mode only
  strict: process.env.DEV
});

export default store;

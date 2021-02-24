import Vue from 'vue';
import App from './App.vue';

import '@/assets/css/tailwind.css';
import '@/assets/css/custom.css';
import store from './store';

import VueTailwind from 'vue-tailwind';

import { TButton, TInput, TSelect } from 'vue-tailwind/dist/components';

import router from './router';

const settings = {
  't-button': {
    component: TButton,
  },
  't-input': {
    component: TInput,
    props: {
      fixedClasses: 'block w-full px-3 py-2 transition duration-100 ease-in-out border rounded shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed',
      classes: 'text-black placeholder-gray-400 bg-white border-gray-300 focus:border-blue-500 ',
      variants: {
        danger: 'border-red-300 bg-red-50 placeholder-red-200 text-red-900',
        success: 'border-green-300 bg-green-50 placeholder-gray-400 text-green-900'
      }
    }
  },
  't-select': {
    component: TSelect
  }
};

Vue.use(VueTailwind, settings);

Vue.config.productionTip = false;

new Vue({
  store,
  router,
  render: h => h(App)
}).$mount('#app');

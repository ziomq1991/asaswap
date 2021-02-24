import Vue from 'vue';
import VueRouter from 'vue-router';
import Swap from '@/views/Swap.vue';
import AddLiquidity from '@/views/AddLiquidity.vue';
import RemoveLiquidity from '@/views/RemoveLiquidity.vue';
import Liquidity from '@/views/Liquidity.vue';


Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'Swap',
    component: Swap
  },
  {
    path: '/add-liquidity/:pair',
    name: 'Add Liquidity',
    component: AddLiquidity
  },
  {
    path: '/remove-liquidity/:pair',
    name: 'Remove Liquidity',
    component: RemoveLiquidity
  },
  {
    path: '/pool',
    name: 'Pool',
    component: Liquidity
  }
];

const router = new VueRouter({
  routes
});

export default router;

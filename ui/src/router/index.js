import Vue from 'vue';
import VueRouter from 'vue-router';
import Swap from '../views/Swap.vue';
import AddLiquidity from '../views/AddLiquidity.vue';
import Withdraw from '../views/Withdraw.vue';
import RemoveLiquidity from '../views/RemoveLiquidity.vue';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'Swap',
    component: Swap
  },
  {
    path: '/add-liquidity',
    name: 'Add Liquidity',
    component: AddLiquidity
  },
  {
    path: '/withdraw',
    name: 'Withdraw',
    component: Withdraw
  },
  {
    path: '/remove-liquidity',
    name: 'Remove Liquidity',
    component: RemoveLiquidity
  }
];

const router = new VueRouter({
  routes
});

export default router;

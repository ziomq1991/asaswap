/* global AlgoSigner:readonly */

import AlgorandService from '@/services/algorandService';
import { ALGORAND_LEDGER } from '@/config/config';
import { isEqual } from 'lodash';

export async function GET_SERVICE_INSTANCE({ commit, state, dispatch }) {
  if (typeof AlgoSigner !== 'undefined') {
    await commit('SET_SERVICE_INSTANCE', new AlgorandService(AlgoSigner, ALGORAND_LEDGER));
    if (state.account) {
      await dispatch('CONNECT');
    }
  } else {
    window.setTimeout(() => dispatch('GET_SERVICE_INSTANCE'), 500);
  }
}

export async function CONNECT({ commit, state, dispatch }) {
  if (state.serviceInstance) {
    const signer = state.serviceInstance;
    await signer.connect();
    await commit('SET_CONNECTED', true);
    dispatch('FETCH_APPLICATION_DATA');
    dispatch('FETCH_ACCOUNTS');
    dispatch('FETCH_ACCOUNT_DATA');
  } else {
    commit('SET_SERVICE_INSTANCE', null);
    commit('SET_CONNECTED', false);
  }
}

export async function SELECT_ACCOUNT({ commit, state, dispatch }, { accountAddress }) {
  const accountIds = state.accounts.map(value => value.address);
  if (accountIds.indexOf(accountAddress) === -1) {
    return;
  }
  await commit('SET_ACCOUNT', accountAddress);
  await dispatch('FETCH_ACCOUNT_DATA', { accountAddress });
}

export async function FETCH_ACCOUNTS({ commit, state, dispatch }) {
  if (!state.connected) {
    return;
  }
  const accounts = await state.serviceInstance.getAccounts();
  await commit('SET_ACCOUNTS', accounts);
  if (!state.account && accounts.length > 0) {
    dispatch('SELECT_ACCOUNT', { accountAddress: accounts[0].address });
  }
}

export async function FETCH_ACCOUNT_DATA({ commit, state, getters, dispatch }) {
  const accountAddress = state.account;
  if (!accountAddress) {
    return;
  }
  const prevState = Object.assign({}, getters.userState);
  const prevAssets = Object.assign({}, getters.userAssets);
  let accountData;
  try {
    accountData = await state.serviceInstance.getAccountData(accountAddress);
  } catch (e) {
    console.log(e);
    dispatch('FETCH_ACCOUNTS');
    return;
  }
  await commit('SET_ACCOUNT_DATA', accountData);
  if (state.pendingUpdate) {
    if (!isEqual(prevState, getters.userState)) {
      await commit('SET_PENDING_UPDATE', false);
    } else if (!isEqual(prevAssets, getters.userAssets))  {
      await commit('SET_PENDING_UPDATE', false);
    }
  }

}

export async function FETCH_APPLICATION_DATA({ commit }) {
  const applicationData = await AlgorandService.getApplicationData(ALGORAND_LEDGER);
  commit('SET_APPLICATION_DATA', applicationData);
}

export async function OPT_IN({ state }) {
  const accountAddress = state.account;
  await state.serviceInstance.optInApp(accountAddress);
}

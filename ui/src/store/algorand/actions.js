/* global AlgoSigner:readonly */

import AlgorandService from '@/services/algorandService';
import { ALGORAND_LEDGER } from '@/config';
import { isEqual } from 'lodash';
import { ASSET_PAIRS, Asset } from '@/utils/assetPairs';
import { USR_A_BAL, USR_B_BAL, USR_LIQ_TOKENS } from '@/utils/constants';

export async function GET_SERVICE_INSTANCE({ commit, state, dispatch }) {
  if (typeof AlgoSigner !== 'undefined') {
    await commit('SET_SERVICE_INSTANCE', new AlgorandService(AlgoSigner, ALGORAND_LEDGER, ASSET_PAIRS[state.currentPair]));
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
    dispatch('FETCH_APPLICATION_DATA', {});
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

  const accountIds = state.accounts.map(value => value.address);
  if (!state.account && accounts.length > 0) {
    await dispatch('SELECT_ACCOUNT', { accountAddress: accounts[0].address });
  } else if (state.account && accountIds.indexOf(state.account) === -1) {
    await commit('SET_ACCOUNT', null);
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
  const newState = getters.userState;
  const newAssets = getters.userAssets;
  if (state.pendingUpdate && state.pendingVerificationFunc) {
    const verified = await state.pendingVerificationFunc({
      prevState,
      prevAssets,
      newState,
      newAssets,
      getters
    });
    if (verified) {
      commit('SET_PENDING_UPDATE', false);
      if (state.actionQueue.length > 0) {
        dispatch('EXECUTE_PENDING_ACTION');
      }
    }
  }
}

export async function FETCH_APPLICATION_DATA({ state, commit }, { appId = null }) {
  const applicationData = await AlgorandService.getApplicationData(ALGORAND_LEDGER, appId ? appId : ASSET_PAIRS[state.currentPair].applicationId);
  if (!appId || appId === state.currentPair.applicationId) {
    commit('SET_APPLICATION_DATA', applicationData);
    commit('CACHE_APPLICATION_DATA', {
      applicationIndex: state.currentPair.applicationId,
      applicationData: {
        ...applicationData,
        fetchDate: new Date()
      }
    });
  } else {
    commit('CACHE_APPLICATION_DATA', {
      applicationIndex: appId,
      applicationData: {
        ...applicationData,
        fetchDate: new Date()
      }
    });
  }
}

export async function OPT_IN({ state }) {
  const accountAddress = state.account;
  await state.serviceInstance.optInApp(accountAddress);
}

export async function SET_CURRENT_PAIR({ commit, dispatch, state }, { pairKey }) {
  if (state.changingPair) {
    return;
  }
  try {
    await commit('SET_CHANGING_PAIR', true);
    const pair = ASSET_PAIRS[pairKey];
    if (!pair) {
      await commit('SET_CHANGING_PAIR', false);
      return;
    }
    if (state.serviceInstance) {
      state.serviceInstance.setAssetPair(pair);
    }
    const splittedKey = pairKey.split('/');
    const reversedSplittedKey = [splittedKey[1], splittedKey[0]];
    const splittedOldKey = state.currentPair.split('/');
    await commit('SET_CURRENT_PAIR', pairKey);
    if (!isEqual(reversedSplittedKey, splittedOldKey)) {
      await commit('SET_APPLICATION_DATA', state.applicationDataCache[pair.applicationId] ? state.applicationDataCache[pair.applicationId] : null);
      dispatch('FETCH_APPLICATION_DATA', {});
    }
  } finally {
    await commit('SET_CHANGING_PAIR', false);
  }
}

function defaultVerificationFunc({ prevState, newState, prevAssets, newAssets }) {
  if (!isEqual(prevState, newState)) {
    return true;
  } else if (!isEqual(prevAssets, newAssets)) {
    return true;
  }
  return false;
}

export async function QUEUE_ACTION({ commit, dispatch, state }, {
  actionMethod,
  actionMessage = null,
  actionVerificationMethod = null,
  backgroundAction = false
}) {
  let queue = Object.assign([], state.actionQueue);
  queue.push({ actionMethod, actionMessage, actionVerificationMethod, backgroundAction });
  await commit('SET_ACTION_QUEUE', queue);
  if (state.actionQueue.length === 1) {
    dispatch('EXECUTE_PENDING_ACTION');
  }
}

export async function EXECUTE_PENDING_ACTION({ state, dispatch, commit }) {
  if (state.actionQueue.length === 0 || state.pendingAction || state.pendingUpdate) {
    return;
  }
  let queue = Object.assign([], state.actionQueue);
  const { actionMethod, actionVerificationMethod, actionMessage, backgroundAction } = queue.shift();
  await commit('SET_ACTION_QUEUE', queue);
  if (backgroundAction) {
    actionMethod();
    dispatch('EXECUTE_PENDING_ACTION');
    return;
  }
  try {
    if (actionVerificationMethod) {
      await commit('SET_PENDING_VERIFICATION_FUNC', actionVerificationMethod);
    } else {
      await commit('SET_PENDING_VERIFICATION_FUNC', defaultVerificationFunc);
    }
    await commit('SET_PENDING_ACTION', true);
    await commit('SET_PENDING_ACTION_MESSAGE', actionMessage);
    const result = await actionMethod();
    await commit('SET_PENDING_UPDATE', true);
    await commit('SET_PENDING_ACTION', false);
    dispatch('FETCH_ACCOUNT_DATA');
    dispatch('FETCH_APPLICATION_DATA', {});
    return result;
  } catch (e) {
    commit('SET_PENDING_UPDATE', false);
    commit('SET_PENDING_ACTION', false);
    commit('SET_PENDING_ACTION_MESSAGE', null);
    commit('SET_ACTION_QUEUE', []);
    throw e;
  } finally {
    commit('SET_PENDING_ACTION', false);
    commit('SET_PENDING_ACTION_MESSAGE', null);
  }
}

function NothingToWithdraw() {
  return new Error('NothingToWithdraw');
}

NothingToWithdraw.prototype = Object.create(Error.prototype);

export async function WITHDRAW({ state, getters }) {
  let withdrawing = false;
  if (getters.userState[USR_A_BAL] > 0 || getters.userState[USR_B_BAL] > 0) {
    withdrawing = true;
    await state.serviceInstance.withdraw(state.account, getters.userState[USR_A_BAL], getters.userState[USR_B_BAL]);
  }
  if (getters.userState[USR_LIQ_TOKENS] > 0) {
    withdrawing = true;
    await state.serviceInstance.withdrawLiquidity(state.account, getters.userState[USR_LIQ_TOKENS]);
  }
  if (!withdrawing) {
    throw new NothingToWithdraw();
  }
}

export async function QUEUE_ASSET_OPT_IN({ dispatch, state, getters }, { assetIds }) {
  for (const assetIndex of assetIds) {
    if (getters.userAssets[assetIndex]) {
      continue;
    }
    if (!assetIndex) {
      continue;
    }
    await dispatch('QUEUE_ACTION', {
      actionMethod: async () => await state.serviceInstance.optInAsset(new Asset({
        assetIndex: assetIndex
      }), state.account),
      actionMessage: 'Opting-In to Assets...',
      actionVerificationMethod: ({ newAssets }) => {
        return !!newAssets[assetIndex];
      }
    });
  }
}

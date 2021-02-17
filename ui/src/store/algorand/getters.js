import { getMappedUserState, getMappedGlobalState, getMappedUserAssets } from './utils/format';
import { APPLICATION_ID } from '@/config/config';

export function algorand(state) {
  return {
    serviceInstance: state.serviceInstance,
    connected: state.connected,
    accounts: state.accounts,
    account: state.account,
    accountData: state.accountData,
    applicationData: state.applicationData,
    pendingAction: state.pendingAction,
    pendingActionMessage: state.pendingActionMessage,
    pendingUpdate: state.pendingUpdate,
    fetchedAccounts: state.fetchedAccounts
  };
}

export function userState(state) {
  if (!state.accountData) {
    return {};
  }
  return getMappedUserState(state.accountData);
}

export function userAssets(state) {
  if (!state.accountData) {
    return [];
  }
  return getMappedUserAssets(state.accountData);
}

export function globalState(state) {
  if (!state.applicationData) {
    return {};
  }
  return getMappedGlobalState(state.applicationData);
}

export function accounts(state) {
  if (!state.accounts) {
    return [];
  }
  return state.accounts.map((value) => {
    return value.address;
  });
}

export function isReady(state) {
  return state.account && state.accountData && state.applicationData;
}

export function isReadyToTransact(state) {
  return state.account && state.accountData && state.applicationData && !state.pendingUpdate;
}

export function isOptedIn(state) {
  if (!state.accountData) {
    return false;
  }
  const accountData = state.accountData;
  const appStates = accountData['apps-local-state'];
  const appIds = appStates.map(value => value.id);
  if (appIds.indexOf(APPLICATION_ID) !== -1) {
    return true;
  }
  return false;
}

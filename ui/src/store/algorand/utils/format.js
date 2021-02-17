import { APPLICATION_ID } from '@/config/config';

export function getMappedUserAssets(accountData) {
  const assets = accountData['assets'];
  return assets.map((value) => {
    return value['asset-id'];
  });
}

export function getMappedUserState(accountData) {
  const appStates = accountData['apps-local-state'];
  const statesPerApp = Object.assign({}, ...appStates.map(value => {
    return {
      [value.id]: value
    };
  }));
  const ourAppState = statesPerApp[APPLICATION_ID];
  if (!ourAppState) {
    return {};
  }
  const keyValues = ourAppState['key-value'];
  const valuesPerKey = Object.assign({}, ...keyValues.map(rawValue => {
    const key = atob(rawValue.key);
    let value;
    if (rawValue.value.type == 1) {
      value = rawValue.value.bytes;
    } else if (rawValue.value.type == 2) {
      value = Number(rawValue.value.uint);
    }
    return {
      [key]: value
    };
  }));
  return valuesPerKey;
}

export function getMappedGlobalState(applicationData) {
  const keyValues = applicationData['params']['global-state'];
  const valuesPerKey = Object.assign({}, ...keyValues.map(rawValue => {
    const key = atob(rawValue.key);
    let value;
    if (rawValue.value.type == 1) {
      value = rawValue.value.bytes;
    } else if (rawValue.value.type == 2) {
      value = Number(rawValue.value.uint);
    }
    return {
      [key]: value
    };
  }));
  return valuesPerKey;
}

import { Buffer } from 'buffer';
import { APPLICATION_ID, ASSET_INDEX, COMPILED_ESCROW } from '@/config';
import algosdk from 'algosdk';


export function encodeArrayForSDK(decodedArray) {
  const encoder = new TextEncoder('ascii');
  return decodedArray.map((value) => {
    return encoder.encode(value);
  });
}

export function uint64ToBigEndian(x) {
  const buff = Buffer.alloc(8);
  buff.writeUIntBE(x, 0, 8);
  return buff;
}

function encodeArrayForSigner(decodedArray) {
  return decodedArray.map((value) => {
    if (typeof value === 'number') {
      return btoa(String.fromCharCode.apply(null, uint64ToBigEndian(value)));
    }
    return btoa(value);
  });
}

export function makeOptInTx(accountAddress, suggestedParams) {
  return {
    from: accountAddress,
    type: 'appl',
    fee: suggestedParams['min-fee'],
    firstRound: suggestedParams['last-round'],
    lastRound: suggestedParams['last-round'] + 1000,
    genesisID: suggestedParams['genesis-id'],
    genesisHash: suggestedParams['genesis-hash'],
    flatFee: true,
    appIndex: APPLICATION_ID,
    appOnComplete: 1 // OptInOC
  };
}

export function makeCallTx(accountAddress, appArgs, suggestedParams) {
  return {
    from: accountAddress,
    type: 'appl',
    fee: suggestedParams['min-fee'],
    firstRound: suggestedParams['last-round'],
    lastRound: suggestedParams['last-round'] + 1000,
    genesisID: suggestedParams['genesis-id'],
    genesisHash: suggestedParams['genesis-hash'],
    flatFee: true,
    appIndex: APPLICATION_ID,
    appArgs: encodeArrayForSigner(appArgs)
  };
}

export function makeAlgoPaymentTx(accountAddress, toAddress, amount, suggestedParams) {
  return {
    type: 'pay',
    from: accountAddress,
    to: toAddress,
    fee: suggestedParams['min-fee'],
    firstRound: suggestedParams['last-round'],
    lastRound: suggestedParams['last-round'] + 1000,
    genesisID: suggestedParams['genesis-id'],
    genesisHash: suggestedParams['genesis-hash'],
    flatFee: true,
    amount: Number(amount)
  };
}

export function makeAssetOptInTx(accountAddress, suggestedParams) {
  return makeAssetPaymentTx(accountAddress, accountAddress, 0, suggestedParams);
}

export function makeAssetPaymentTx(accountAddress, toAddress, amount, suggestedParams) {
  return {
    type: 'axfer',
    from: accountAddress,
    to: toAddress,
    fee: suggestedParams['min-fee'],
    firstRound: suggestedParams['last-round'],
    lastRound: suggestedParams['last-round'] + 1000,
    genesisID: suggestedParams['genesis-id'],
    genesisHash: suggestedParams['genesis-hash'],
    flatFee: true,
    amount: Number(amount),
    assetIndex: ASSET_INDEX
  };
}

export function convertParamsToSDKFormat(suggestedParams) {
  return {
    consensusVersion: suggestedParams['consensus-version'],
    fee: suggestedParams['fee'],
    genesisHash: suggestedParams['genesis-hash'],
    genesisID: suggestedParams['genesis-id'],
    firstRound: suggestedParams['last-round'],
    lastRound: suggestedParams['last-round'] + 1000,
    flatFee: true,
    minFee: suggestedParams['min-fee']
  };
}

export function logicSign(tx) {
  const program = new Uint8Array(Buffer.from(COMPILED_ESCROW, 'base64'));
  const lSig = algosdk.makeLogicSig(program);
  return algosdk.signLogicSigTransactionObject(tx, lSig);
}

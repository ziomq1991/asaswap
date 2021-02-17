import algosdk from 'algosdk';
import { Buffer } from 'buffer';
import eventBus from '@/events/eventBus';
import { APPLICATION_ID, ASSET_INDEX, COMPILED_ESCROW, ESCROW_ADDRESS } from '@/config/config';

function encodeArrayForSDK(decodedArray) {
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

function makeOptInTx(accountAddress, suggestedParams) {
  return {
    from: accountAddress,
    type: 'appl',
    fee: suggestedParams['min-fee'],
    firstRound: suggestedParams['last-round'],
    lastRound: suggestedParams['last-round'] + 1000,
    genesisID: suggestedParams['genesis-id'],
    genesisHash: suggestedParams['genesis-hash'],
    appIndex: APPLICATION_ID,
    appOnComplete: 1 // OptInOC
  };
}

function makeCallTx(accountAddress, appArgs, suggestedParams) {
  return {
    from: accountAddress,
    type: 'appl',
    fee: suggestedParams['min-fee'],
    firstRound: suggestedParams['last-round'],
    lastRound: suggestedParams['last-round'] + 1000,
    genesisID: suggestedParams['genesis-id'],
    genesisHash: suggestedParams['genesis-hash'],
    appIndex: APPLICATION_ID,
    appArgs: encodeArrayForSigner(appArgs)
  };
}

function makeAlgoPaymentTx(accountAddress, toAddress, amount, suggestedParams) {
  return {
    type: 'pay',
    from: accountAddress,
    to: toAddress,
    fee: suggestedParams['min-fee'],
    firstRound: suggestedParams['last-round'],
    lastRound: suggestedParams['last-round'] + 1000,
    genesisID: suggestedParams['genesis-id'],
    genesisHash: suggestedParams['genesis-hash'],
    amount: Number(amount)
  };
}

function makeAssetOptInTx(accountAddress, suggestedParams) {
  return makeAssetPaymentTx(accountAddress, accountAddress, 0, suggestedParams);
}

function makeAssetPaymentTx(accountAddress, toAddress, amount, suggestedParams) {
  return {
    type: 'axfer',
    from: accountAddress,
    to: toAddress,
    fee: suggestedParams['min-fee'],
    firstRound: suggestedParams['last-round'],
    lastRound: suggestedParams['last-round'] + 1000,
    genesisID: suggestedParams['genesis-id'],
    genesisHash: suggestedParams['genesis-hash'],
    amount: Number(amount),
    assetIndex: ASSET_INDEX
  };
}

function convertParamsToSDKFormat(suggestedParams) {
  return {
    consensusVersion: suggestedParams['consensus-version'],
    fee: suggestedParams['fee'],
    genesisHash: suggestedParams['genesis-hash'],
    genesisID: suggestedParams['genesis-id'],
    firstRound: suggestedParams['last-round'],
    lastRound: suggestedParams['last-round'] + 1000,
    minFee: suggestedParams['min-fee']
  };
}

function logicSign(tx) {
  const program = new Uint8Array(Buffer.from(COMPILED_ESCROW, 'base64'));
  const lSig = algosdk.makeLogicSig(program);
  return algosdk.signLogicSigTransactionObject(tx, lSig);
}

function emitError(message) {
  eventBus.$emit('open-alert', {
    type: 'error',
    message: message
  });
}

class SignerWrapper {
  constructor(signer) {
    this.signer = signer;
  }

  async blockingCall(func, retry=true) {
    // Ugly but works
    while (this.promise) {
      await this.promise;
    }
    try {
      this.promise = func();
      try {
        return await this.promise;
      } catch (e) {
        if (e.message === 'Another query processing' && retry) {
          return new Promise(resolve => {
            window.setTimeout(
              async () => {
                resolve(await this.blockingCall(func, false));
              }, 500
            );
          });
        } else {
          throw e;
        }
      }
    } finally {
      this.promise = null;
    }
  }

  async connect() {
    try {
      return await this.signer.connect();
    } catch (e) {
      emitError('Could not connect to AlgoSigner');
      throw e;
    }
  }

  async sign(tx) {
    try {
      return await this.blockingCall(() => this.signer.sign(tx));
    } catch (e) {
      emitError('Transaction could not be signed');
      throw e;
    }
  }

  async accounts(params) {
    try {
      return await this.blockingCall(() => this.signer.accounts(params));
    } catch (e) {
      emitError('Could not fetch information about accounts');
      throw e;
    }
  }

  async algod(params) {
    try {
      return await this.blockingCall(() => this.signer.algod(params));
    } catch (e) {
      emitError('Could not fetch information from the Algorand blockchain');
      throw e;
    }
  }

  async send(params, showSucess=true) {
    try {
      eventBus.$emit('set-action-message', 'Sending...');
      const tx = await this.blockingCall(() => this.signer.send(params));
      if (showSucess) {
        eventBus.$emit('transaction-success', tx.txId);
      }
      return tx;
    } catch (e) {
      const insufficientFundsError = /TransactionPool\.Remember: transaction [A-Z0-9]+: underflow on subtracting \d+ from sender amount \d+/g;
      if (e.message.match(insufficientFundsError)) {
        emitError('Insufficient funds');
        throw e;
      }
      emitError('Unexpected error occured while sending transaction');
      throw e;
    }
  }
}

class AlgoExplorerAPI {
  constructor(ledger) {
    if (ledger.toUpperCase() == 'TESTNET') {
      this.url = 'https://api.testnet.algoexplorer.io';
    } else {
      this.url = 'https://api.algoexplorer.io';
    }
  }

  async fetch(path) {
    try {
      const response = await fetch(`${this.url}${path}`);
      const data = await response.json();
      return data;
    } catch (e) {
      emitError('Could not fetch information from the Algorand blockchain');
      throw e;
    }
  }
}

export default class AlgorandService {
  constructor(signer, ledger) {
    this.signer = new SignerWrapper(signer);
    this.ledger = ledger;
  }

  connect() {
    return this.signer.connect();
  }

  getAccounts() {
    return this.signer.accounts({
      ledger: this.ledger
    });
  }

  getAccountData(accountAddress) {
    return this.signer.algod({
      ledger: this.ledger,
      path: `/v2/accounts/${accountAddress}`
    });
  }

  static async getApplicationData(ledger) {
    const explorer = new AlgoExplorerAPI(ledger);
    return explorer.fetch(`/v2/applications/${APPLICATION_ID}`);
  }

  getSuggestedParams() {
    return this.signer.algod({
      ledger: this.ledger,
      path: '/v2/transactions/params'
    });
  }

  async optInApp(accountAddress) {
    const suggestedParams = await this.getSuggestedParams();
    const optInTxn = makeOptInTx(accountAddress, suggestedParams);
    eventBus.$emit('set-action-message', 'Signing...');
    const signedTx = await this.signer.sign(optInTxn);
    return await this.signer.send({
      ledger: this.ledger,
      tx: signedTx.blob
    }, false);
  }

  async optInAsset(accountAddress) {
    const suggestedParams = await this.getSuggestedParams();
    const optInTxn = makeAssetOptInTx(accountAddress, suggestedParams);
    eventBus.$emit('set-action-message', 'Signing...');
    const signedTx = await this.signer.sign(optInTxn);
    return await this.signer.send({
      ledger: this.ledger,
      tx: signedTx.blob
    }, false);
  }

  async addLiquidity(accountAddress, assetAmount, algosAmount) {
    const suggestedParams = await this.getSuggestedParams();
    const tx1 = makeCallTx(accountAddress, ['ADD_LIQUIDITY'], suggestedParams);
    const tx2 = makeAssetPaymentTx(accountAddress, ESCROW_ADDRESS, assetAmount, suggestedParams);
    const tx3 = makeAlgoPaymentTx(accountAddress, ESCROW_ADDRESS, algosAmount, suggestedParams);
    const txnGroup = await algosdk.assignGroupID([
      {
        ...tx1,
        appArgs: encodeArrayForSDK(['ADD_LIQUIDITY'])
      },
      Object.assign({}, tx2),
      Object.assign({}, tx3)
    ]);
    tx1.group = txnGroup[0].group.toString('base64');
    tx2.group = txnGroup[1].group.toString('base64');
    tx3.group = txnGroup[2].group.toString('base64');
    eventBus.$emit('set-action-message', 'Signing 1 of 3 transactions...');
    const signedTx1 = await this.signer.sign(tx1);
    eventBus.$emit('set-action-message', 'Signing 2 of 3 transactions...');
    const signedTx2 = await this.signer.sign(tx2);
    eventBus.$emit('set-action-message', 'Signing 3 of 3 transactions...');
    const signedTx3 = await this.signer.sign(tx3);
    eventBus.$emit('set-action-message', 'Sending transactions...');
    const decodedTx1 = new Uint8Array(atob(signedTx1.blob).split('').map(x => x.charCodeAt(0)));
    const decodedTx2 = new Uint8Array(atob(signedTx2.blob).split('').map(x => x.charCodeAt(0)));
    const decodedTx3 = new Uint8Array(atob(signedTx3.blob).split('').map(x => x.charCodeAt(0)));
    const combinedDecodedTxs = new Uint8Array(decodedTx1.byteLength + decodedTx2.byteLength + decodedTx3.byteLength);
    combinedDecodedTxs.set(new Uint8Array(decodedTx1), 0);
    combinedDecodedTxs.set(new Uint8Array(decodedTx2), decodedTx1.byteLength);
    combinedDecodedTxs.set(new Uint8Array(decodedTx3), decodedTx2.byteLength + decodedTx1.byteLength);
    const combinedTxs = btoa(String.fromCharCode.apply(null, combinedDecodedTxs));
    return await this.signer.send({
      ledger: this.ledger,
      tx: combinedTxs
    });
  }

  async removeLiquidity(accountAddress, liquidityTokens) {
    const suggestedParams = await this.getSuggestedParams();
    const tx = makeCallTx(accountAddress, ['REMOVE_LIQUIDITY', Number(liquidityTokens)], suggestedParams);
    eventBus.$emit('set-action-message', 'Signing...');
    const signedTx = await this.signer.sign(tx);
    return await this.signer.send({
      ledger: this.ledger,
      tx: signedTx.blob
    });
  }

  async swapAsset(accountAddress, assetAmount) {
    const suggestedParams = await this.getSuggestedParams();
    const tx1 = makeCallTx(accountAddress, ['SWAP'], suggestedParams);
    const tx2 = makeAssetPaymentTx(accountAddress, ESCROW_ADDRESS, assetAmount, suggestedParams);
    const txnGroup = await algosdk.assignGroupID([
      {
        ...tx1,
        appArgs: encodeArrayForSDK(['SWAP'])
      },
      Object.assign({}, tx2),
    ]);
    tx1.group = txnGroup[0].group.toString('base64');
    tx2.group = txnGroup[1].group.toString('base64');
    eventBus.$emit('set-action-message', 'Signing 1 of 2 transactions...');
    const signedTx1 = await this.signer.sign(tx1);
    eventBus.$emit('set-action-message', 'Signing 2 of 2 transactions...');
    const signedTx2 = await this.signer.sign(tx2);
    const decodedTx1 = new Uint8Array(atob(signedTx1.blob).split('').map(x => x.charCodeAt(0)));
    const decodedTx2 = new Uint8Array(atob(signedTx2.blob).split('').map(x => x.charCodeAt(0)));
    const combinedDecodedTxs = new Uint8Array(decodedTx1.byteLength + decodedTx2.byteLength);
    combinedDecodedTxs.set(new Uint8Array(decodedTx1), 0);
    combinedDecodedTxs.set(new Uint8Array(decodedTx2), decodedTx1.byteLength);
    const combinedTxs = btoa(String.fromCharCode.apply(null, combinedDecodedTxs));
    return await this.signer.send({
      ledger: this.ledger,
      tx: combinedTxs
    });
  }

  async swapAlgos(accountAddress, algosAmount) {
    const suggestedParams = await this.getSuggestedParams();
    const tx1 = makeCallTx(accountAddress, ['SWAP'], suggestedParams);
    const tx2 = makeAlgoPaymentTx(accountAddress, ESCROW_ADDRESS, algosAmount, suggestedParams);
    const txnGroup = await algosdk.assignGroupID([
      {
        ...tx1,
        appArgs: encodeArrayForSDK(['SWAP'])
      },
      Object.assign({}, tx2),
    ]);
    tx1.group = txnGroup[0].group.toString('base64');
    tx2.group = txnGroup[1].group.toString('base64');
    eventBus.$emit('set-action-message', 'Signing 1 of 2 transactions...');
    const signedTx1 = await this.signer.sign(tx1);
    eventBus.$emit('set-action-message', 'Signing 2 of 2 transactions...');
    const signedTx2 = await this.signer.sign(tx2);
    const decodedTx1 = new Uint8Array(atob(signedTx1.blob).split('').map(x => x.charCodeAt(0)));
    const decodedTx2 = new Uint8Array(atob(signedTx2.blob).split('').map(x => x.charCodeAt(0)));
    const combinedDecodedTxs = new Uint8Array(decodedTx1.byteLength + decodedTx2.byteLength);
    combinedDecodedTxs.set(new Uint8Array(decodedTx1), 0);
    combinedDecodedTxs.set(new Uint8Array(decodedTx2), decodedTx1.byteLength);
    const combinedTxs = btoa(String.fromCharCode.apply(null, combinedDecodedTxs));
    return await this.signer.send({
      ledger: this.ledger,
      tx: combinedTxs
    });
  }

  async withdraw(accountAddress, assetAmount, algosAmount) {
    const suggestedParams = await this.getSuggestedParams();
    const suggestedParamsForSDK = convertParamsToSDKFormat(suggestedParams);
    const tx1 = makeCallTx(accountAddress, ['WITHDRAW'], suggestedParams);
    const tx2 = algosdk.makeAssetTransferTxnWithSuggestedParams(ESCROW_ADDRESS, accountAddress, undefined, undefined, assetAmount, undefined, ASSET_INDEX, suggestedParamsForSDK);
    const tx3 = algosdk.makePaymentTxnWithSuggestedParams(ESCROW_ADDRESS, accountAddress, algosAmount, undefined, undefined, suggestedParamsForSDK);
    const txnGroup = await algosdk.assignGroupID([
      {
        ...tx1,
        appArgs: encodeArrayForSDK(['WITHDRAW'])
      },
      tx2,
      tx3
    ]);
    tx1.group = txnGroup[0].group.toString('base64');
    eventBus.$emit('set-action-message', 'Signing...');
    const signedTx1 = await this.signer.sign(tx1);
    const signedTx2 = logicSign(txnGroup[1]);
    const signedTx3 = logicSign(txnGroup[2]);
    const decodedTx1 = new Uint8Array(atob(signedTx1.blob).split('').map(x => x.charCodeAt(0)));
    const decodedTx2 = signedTx2.blob;
    const decodedTx3 = signedTx3.blob;
    const combinedDecodedTxs = new Uint8Array(decodedTx1.byteLength + decodedTx2.byteLength + decodedTx3.byteLength);
    combinedDecodedTxs.set(new Uint8Array(decodedTx1), 0);
    combinedDecodedTxs.set(new Uint8Array(decodedTx2), decodedTx1.byteLength);
    combinedDecodedTxs.set(new Uint8Array(decodedTx3), decodedTx2.byteLength + decodedTx1.byteLength);
    const combinedTxs = btoa(String.fromCharCode.apply(null, combinedDecodedTxs));
    return await this.signer.send({
      ledger: this.ledger,
      tx: combinedTxs
    });
  }
}

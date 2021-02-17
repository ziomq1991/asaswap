import algosdk from 'algosdk';
import eventBus from '@/utils/eventBus';
import { APPLICATION_ID, ESCROW_ADDRESS, ASSET_INDEX } from '@/config';
import { validateIfAccountCanAffordTxs } from '@/utils/validation';
import {
  convertParamsToSDKFormat,
  encodeArrayForSDK,
  logicSign,
  makeAlgoPaymentTx,
  makeAssetOptInTx,
  makeAssetPaymentTx,
  makeCallTx,
  makeOptInTx
} from '@/utils/transactions';
import { AlgoExplorer } from '@/services/algoExplorer';
import { AlgoSigner } from '@/services/algoSigner';

export default class AlgorandService {
  constructor(signer, ledger) {
    this.signer = new AlgoSigner(signer);
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
    const explorer = new AlgoExplorer(ledger);
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
    await validateIfAccountCanAffordTxs([optInTxn]);
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
    await validateIfAccountCanAffordTxs([optInTxn]);
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
    await validateIfAccountCanAffordTxs([tx1, tx2, tx3]);
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
    await validateIfAccountCanAffordTxs([tx]);
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
    await validateIfAccountCanAffordTxs([tx1, tx2]);
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
    await validateIfAccountCanAffordTxs([tx1, tx2]);
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
    await validateIfAccountCanAffordTxs([tx1, tx2, tx3]);
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

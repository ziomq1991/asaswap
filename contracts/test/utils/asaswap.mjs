import { getProgram, stringToBytes } from '@algorand-builder/algob';
import { SignType, TransactionType } from '@algorand-builder/runtime/build/types.js';
import constants, { SETUP_ESCROW } from '../../common/constants.js';

const {
  ADD_LIQUIDITY,
  DEPOSIT_LIQUIDITY,
  REMOVE_LIQUIDITY,
  SWAP,
  UPDATE,
  WITHDRAW,
  WITHDRAW_LIQUIDITY
} = constants;

export const ALGOS_TO_ASA = 'ALGOS_TO_ASA';
export const ASA_TO_ASA = 'ASA_TO_ASA';

export class AsaswapManager {
  constructor(runtime, creator, assets, type = ALGOS_TO_ASA) {
    if (type === ALGOS_TO_ASA) {
      this.manager = new AlgosAsaManager(runtime, creator, assets);
    } else {
      this.manager = new AsaToAsaManager(runtime, creator, assets);
    }
  }

  setupApplication() {
    return this.manager.setupApplication();
  }

  setupEscrow() {
    return this.manager.setupEscrow();
  }

  addFundsToEscrow() {
    return this.manager.addFundsToEscrow();
  }

  deployEscrow() {
    return this.manager.deployEscrow();
  }

  escrowSetupAssets() {
    return this.manager.escrowSetupAssets();
  }

  getEscrowAddress() {
    return this.manager.getEscrowAddress();
  }

  getApplicationId() {
    return this.manager.getApplicationId();
  }

  getValidatorId() {
    return this.manager.getValidatorId();
  }

  setupApplicationWithEscrow() {
    return this.manager.setupApplicationWithEscrow();
  }

  configureContract(escrowAddress, validatorId) {
    return this.manager.configureContract(escrowAddress, validatorId);
  }

  optIn(address) {
    return this.manager.optIn(address);
  }

  addLiquidity(fromAccount, escrowAddress, primaryAssetAmount, secondaryAssetAmount, params = {}) {
    return this.manager.addLiquidity(fromAccount, escrowAddress, primaryAssetAmount, secondaryAssetAmount, params);
  }

  removeLiquidity(fromAccount, amount) {
    return this.manager.removeLiquidity(fromAccount, amount);
  }

  withdrawLiquidity(sender, amount, params={}) {
    return this.manager.withdrawLiquidity(sender, amount, params);
  }

  depositLiquidity(fromAccount, amount, params={}) {
    return this.manager.depositLiquidity(fromAccount, amount, params);
  }

  secondaryAssetSwap(fromAccount, escrowAddress, assetAmount, params={}) {
    return this.manager.secondaryAssetSwap(fromAccount, escrowAddress, assetAmount, params);
  }

  primaryAssetSwap(fromAccount, escrowAddress, assetAmount, params={}) {
    return this.manager.primaryAssetSwap(fromAccount, escrowAddress, assetAmount, params);
  }

  withdraw(sender, primaryAssetAmount, secondaryAssetAmount, params={}) {
    return this.manager.withdraw(sender, primaryAssetAmount, secondaryAssetAmount, params);
  }
}

class AlgosAsaManager {
  constructor(runtime, creator, assets) {
    this.creator = creator;
    this.runtime = runtime;
    this.secondaryAssetId = assets['secondaryAssetId'];
    this.liquidityAssetId = assets['liquidityAssetId'];

    this.creationArgs = [
      `int:${this.secondaryAssetId}`,
      `int:${this.liquidityAssetId}`
    ];
    this.flags = {
      sender: creator.account,
      localInts: 3,
      localBytes: 0,
      globalInts: 6,
      globalBytes: 2
    };
    this.validatorFlags = {
      sender: creator.account,
      localInts: 0,
      localBytes: 0,
      globalInts: 0,
      globalBytes: 0
    };
    this.escrow = null;
    this.applicationId = null;
    this.validatorId = null;
    this.lSig = null;
  }

  getProgram() {
    return getProgram('state.py', { type: ALGOS_TO_ASA });
  }

  getValidatorProgram(appId) {
    return getProgram('validator.py', { type: ALGOS_TO_ASA, app_id: appId });
  }

  setupApplication() {
    this.applicationId = this.runtime.addApp({ ...this.flags, appArgs: this.creationArgs }, {}, this.getProgram());
    this.validatorId = this.runtime.addApp({ ...this.validatorFlags }, {}, this.getValidatorProgram(this.applicationId));
  }

  execute(txGroup) {
    this.runtime.executeTx(txGroup);
  }

  executeWithValidator(txGroup) {
    let newTxGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: txGroup[0].fromAccount,
        appId: this.validatorId,
        foreignApps: [this.applicationId],
        payFlags: { totalFee: 1001 },
      },
      ...txGroup
    ];
    this.execute(newTxGroup);
  }

  setupEscrow() {
    this.deployEscrow();
    this.addFundsToEscrow();
    this.escrowSetupAssets();
  }

  addFundsToEscrow() {
    let txGroup = [
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        toAccountAddr: this.escrow.address,
        amountMicroAlgos: this.escrow.minBalance + 302000,
        payFlags: {
          totalFee: 1000,
        }
      }
    ];
    this.execute(txGroup);
  }

  deployEscrow() {
    const escrowProg = getProgram('escrow.py', { app_id: this.applicationId });
    this.lSig = this.runtime.getLogicSig(escrowProg, []);
    const escrowAddress = this.lSig.address();
    this.escrow = this.runtime.getAccount(escrowAddress);
  }

  escrowSetupAssets() {
    this.escrowOptInToSecondaryAsset();
    this.escrowOptInToLiquidityToken();
    this.configureLiquidityToken();
  }

  escrowOptInToSecondaryAsset() {
    this.runtime.optIntoASA(this.secondaryAssetId, this.escrow.address, {}); // opt-in tx doesn't work
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        appId: this.applicationId,
        appArgs: [stringToBytes(SETUP_ESCROW)],
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAsset,
        assetID: this.secondaryAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: this.escrow.address,
        amount: 0,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.execute(txGroup);
  }

  escrowOptInToLiquidityToken() {
    this.runtime.optIntoASA(this.liquidityAssetId, this.escrow.address, {}); // opt-in tx doesn't work
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        appId: this.applicationId,
        appArgs: [stringToBytes(SETUP_ESCROW)],
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAsset,
        assetID: this.liquidityAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: this.escrow.address,
        amount: 0,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.execute(txGroup);
  }

  configureLiquidityToken() {
    const assetDef = this.runtime.getAssetDef(this.liquidityAssetId);
    let tx = [
      {
        type: TransactionType.ModifyAsset,
        assetID: this.liquidityAssetId,
        sign: SignType.SecretKey,
        fromAccount: this.runtime.getAccount(assetDef.creator).account,
        fields: {
          manager: this.escrow.address,
          reserve: this.escrow.address,
          freeze: this.escrow.address,
          clawback: this.escrow.address
        },
        payFlags: {
          totalFee: 1000
        }
      }
    ];
    this.runtime.executeTx(tx);
    tx = [
      {
        type: TransactionType.TransferAsset,
        assetID: this.liquidityAssetId,
        sign: SignType.SecretKey,
        fromAccount: this.runtime.getAccount(assetDef.creator).account,
        toAccountAddr: this.escrow.address,
        amount: 10000000000,
        payFlags: {
          totalFee: 1000
        }
      }
    ];
    this.runtime.executeTx(tx);
  }

  getEscrowAddress() {
    return this.escrow.address;
  }

  getApplicationId() {
    return this.applicationId;
  }

  getValidatorId() {
    return this.validatorId;
  }

  setupApplicationWithEscrow() {
    this.setupApplication();
    this.setupEscrow();
    this.configureContract(this.escrow.address, this.validatorId);
  }

  configureContract(escrowAddress, validatorAppId) {
    let appArgs = [stringToBytes(UPDATE), `int:${validatorAppId}`];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        appId: this.applicationId,
        appArgs: appArgs,
        accounts: [escrowAddress],
        payFlags: { totalFee: 1000 },
      }
    ];
    this.execute(txGroup);
  }

  optIn(address) {
    this.runtime.optInToApp(address, this.validatorId, {}, {}, this.getValidatorProgram(this.applicationId));
    this.runtime.optInToApp(address, this.applicationId, {}, {}, this.getProgram());
  }

  addLiquidity(fromAccount, escrowAddress, primaryAssetAmount, secondaryAssetAmount, params = {}) {
    let appArgs = [stringToBytes(ADD_LIQUIDITY)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['secondaryAssetId'] ? params['secondaryAssetId'] : this.secondaryAssetId,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: escrowAddress,
        amount: secondaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: escrowAddress,
        amountMicroAlgos: primaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.executeWithValidator(txGroup);
  }

  removeLiquidity(fromAccount, amount) {
    let appArgs = [stringToBytes(REMOVE_LIQUIDITY), `int:${amount}`];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      }
    ];
    this.executeWithValidator(txGroup);
  }

  withdrawLiquidity(sender, liquidityAmount, params={}) {
    let appArgs = [stringToBytes(WITHDRAW_LIQUIDITY)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['assetId'] ? params['assetId'] : this.liquidityAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: sender.address,
        amount: liquidityAmount,
        payFlags: {
          totalFee: params['assetFee'] ? params['assetFee'] : 1000,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        toAccountAddr: params['feeTo'] ? params['feeTo'] : this.escrow.address,
        amountMicroAlgos: 2000,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.executeWithValidator(txGroup);
  }

  depositLiquidity(fromAccount, liquidityAmount, params={}) {
    let appArgs = [stringToBytes(DEPOSIT_LIQUIDITY)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['assetId'] ? params['assetId'] : this.liquidityAssetId,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: this.escrow.address,
        amount: liquidityAmount,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.executeWithValidator(txGroup);
  }

  secondaryAssetSwap(fromAccount, escrowAddress, assetAmount, params={}) {
    let appArgs = [stringToBytes(SWAP)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['assetId'] ? params['assetId'] : this.secondaryAssetId,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: escrowAddress,
        amount: assetAmount,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.executeWithValidator(txGroup);
  }

  // eslint-disable-next-line no-unused-vars
  primaryAssetSwap(fromAccount, escrowAddress, primaryAssetAmount, params={}) {
    let appArgs = [stringToBytes(SWAP)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: escrowAddress,
        amountMicroAlgos: primaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.executeWithValidator(txGroup);
  }

  withdraw(sender, primaryAssetAmount, secondaryAssetAmount, params={}) {
    let appArgs = [stringToBytes(WITHDRAW)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: 123,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: sender.address,
        amount: secondaryAssetAmount,
        payFlags: {
          totalFee: params['primaryAssetFee'] ? params['primaryAssetFee'] : 1000,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: sender.address,
        amountMicroAlgos: primaryAssetAmount,
        payFlags: {
          totalFee: params['secondaryAssetFee'] ? params['secondaryAssetFee'] : 1000,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        toAccountAddr: params['feeTo'] ? params['feeTo'] : this.escrow.address,
        amountMicroAlgos: 2000,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.executeWithValidator(txGroup);
  }
}

class AsaToAsaManager extends AlgosAsaManager {
  constructor(runtime, creator, assets) {
    super(runtime, creator, assets);
    this.flags = {
      sender: creator.account,
      localInts: 3,
      localBytes: 0,
      globalInts: 7,
      globalBytes: 2
    };
    this.primaryAssetId = assets['primaryAssetId'];
    this.creationArgs = [
      `int:${this.secondaryAssetId}`,
      `int:${this.primaryAssetId}`,
      `int:${this.liquidityAssetId}`
    ];
  }

  getProgram() {
    return getProgram('state.py', { type: ASA_TO_ASA });
  }

  getValidatorProgram(appId) {
    return getProgram('validator.py', { type: ASA_TO_ASA, app_id: appId });
  }

  addLiquidity(fromAccount, escrowAddress, primaryAssetAmount, secondaryAssetAmount, params = {}) {
    let appArgs = [stringToBytes(ADD_LIQUIDITY)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['secondaryAssetId'] ? params['secondaryAssetId'] : this.secondaryAssetId,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: escrowAddress,
        amount: secondaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['primaryAssetId'] ? params['primaryAssetId'] : this.primaryAssetId,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: escrowAddress,
        amount: primaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.executeWithValidator(txGroup);
  }

  escrowSetupAssets() {
    super.escrowSetupAssets();
    this.escrowOptInToPrimaryAsset();
  }

  escrowOptInToPrimaryAsset() {
    this.runtime.optIntoASA(this.primaryAssetId, this.escrow.address, {}); // opt-in tx doesn't work
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        appId: this.applicationId,
        appArgs: [stringToBytes(SETUP_ESCROW)],
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAsset,
        assetID: this.primaryAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: this.escrow.address,
        amount: 0,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.execute(txGroup);
  }

  withdraw(sender, primaryAssetAmount, secondaryAssetAmount, params={}) {
    let appArgs = [stringToBytes(WITHDRAW)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: this.secondaryAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: sender.address,
        amount: secondaryAssetAmount,
        payFlags: {
          totalFee: params['secondaryAssetFee'] ? params['secondaryAssetFee'] : 1000,
        },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: this.primaryAssetId,
        sign: SignType.LogicSignature,
        lsig: this.lSig,
        fromAccount: this.escrow.account,
        toAccountAddr: sender.address,
        amount: primaryAssetAmount,
        payFlags: {
          totalFee: params['primaryAssetFee'] ? params['primaryAssetFee'] : 1000,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        toAccountAddr: params['feeTo'] ? params['feeTo'] : this.escrow.address,
        amountMicroAlgos: 2000,
        payFlags: {
          totalFee: 1000,
        },
      }
    ];
    this.executeWithValidator(txGroup);
  }

  addFundsToEscrow() {
    let txGroup = [
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: this.creator.account,
        toAccountAddr: this.escrow.address,
        amountMicroAlgos: this.escrow.minBalance + 405000,
        payFlags: {
          totalFee: 1000,
        }
      }
    ];
    this.execute(txGroup);
  }

  primaryAssetSwap(fromAccount, escrowAddress, primaryAssetAmount, params={}) {
    let appArgs = [stringToBytes(SWAP)];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        appId: this.applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: params['assetId'] ? params['assetId'] : this.primaryAssetId,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: escrowAddress,
        amount: primaryAssetAmount,
        payFlags: {
          totalFee: 1000,
        },
      },
    ];
    this.executeWithValidator(txGroup);
  }
}

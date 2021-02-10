/* globals describe, it */

import {
  addressToPk,
  getProgram,
  stringToBytes,
} from '@algorand-builder/algob';
import { Runtime, StoreAccount } from '@algorand-builder/runtime';
import { TransactionType, SignType } from '@algorand-builder/runtime/build/types.js';
import { ERRORS } from '@algorand-builder/runtime/build/errors/errors-list.js';
import chai from 'chai';
const { assert } = chai;

import { expectTealError } from './utils/errors.mjs';

const minBalance = 10e6; // 10 ALGO's

describe('Asaswap Tests', function () {
  let master;
  let creator;
  let escrow;
  let swapper;
  const program = getProgram('state.py');

  let runtime;
  let flags;
  let applicationId;
  let lsig;

  const getGlobal = (key) => runtime.getGlobalState(applicationId, key);
  const getLocal = (accountAddr, key) => runtime.getLocalState(applicationId, accountAddr, key);
  const setupApplication = () => {
    const creationFlags = Object.assign({}, flags);
    applicationId = runtime.addApp({ ...creationFlags, appArgs: creationArgs }, {}, program);
    runtime.store.assetDefs.set(123, master.address);
  };
  const setupEscrow = () => {
    deployEscrow();
    addFundsToEscrow();
    escrowOptInToAsset();
  };
  const deployEscrow = () => {
    const escrowProg = getProgram('escrow.py', { app_id: applicationId });
    lsig = runtime.getLogicSig(escrowProg, []);
    const escrowAddress = lsig.address();
    escrow = runtime.getAccount(escrowAddress);
  };
  const addFundsToEscrow = () => {
    let txGroup = [
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: master.account,
        toAccountAddr: escrow.address,
        amountMicroAlgos: escrow.minBalance + 101000,
        payFlags: { 
          totalFee: 1000,
        }
      }
    ];
    runtime.executeTx(txGroup, {}, []);
  };
  const escrowOptInToAsset = (assetID=123) => {
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId,
        appArgs: [stringToBytes('SETUP_ESCROW')],
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAsset,
        assetID: assetID,
        sign: SignType.LogicSignature,
        lsig: lsig,
        fromAccount: escrow.account,
        toAccountAddr: escrow.address,
        amount: 0,
        payFlags: { 
          totalFee: 1000,
        },
      },
    ];
    runtime.executeTx(txGroup, program, []);
  };
  const setEscrow = (address) => {
    let appArgs = [stringToBytes('UPDATE')];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId,
        appArgs: appArgs,
        accounts: [creator.address, address], // sender must be first
        payFlags: { totalFee: 1000 },
      }
    ];
    runtime.executeTx(txGroup, program, []);
  };
  const optIn = (address) => {
    runtime.optInToApp(address, applicationId, {}, {}, program);
  };
  const addLiquidity = (fromAccount, escrowAddress, assetAmount, microAlgosAmount, assetId=123) => {
    let appArgs = [stringToBytes('ADD_LIQUIDITY')];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        appId: applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: assetId,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: escrowAddress,
        amount: assetAmount,
        payFlags: { 
          totalFee: 1000,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: escrowAddress,
        amountMicroAlgos: microAlgosAmount,
        payFlags: { 
          totalFee: 1000,
        },
      }
    ];
    runtime.executeTx(txGroup, program, []);
  };
  const removeLiquidity = (fromAccount, amount) => {
    let appArgs = [stringToBytes('REMOVE_LIQUIDITY'), `int:${amount}`];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        appId: applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      }
    ];
    runtime.executeTx(txGroup, program, []);
  };
  const setupApplicationWithEscrow = () => {
    setupApplication();
    setupEscrow();
    setEscrow(escrow.address);
  };
  const assetSwap = (fromAccount, escrowAddress, assetAmount, assetId=123) => {
    let appArgs = [stringToBytes('SWAP')];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        appId: applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: assetId,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: escrowAddress,
        amount: assetAmount,
        payFlags: { 
          totalFee: 1000,
        },
      },
    ];
    runtime.executeTx(txGroup, program, []);
  };
  const algoSwap = (fromAccount, escrowAddress, microAlgosAmount) => {
    let appArgs = [stringToBytes('SWAP')];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        appId: applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.SecretKey,
        fromAccount: fromAccount,
        toAccountAddr: escrowAddress,
        amountMicroAlgos: microAlgosAmount,
        payFlags: { 
          totalFee: 1000,
        },
      },
    ];
    runtime.executeTx(txGroup, program, []);
  };
  const withdraw = (sender, assetAmount, microAlgosAmount, assetFee=1000, algoFee=1000) => {
    let appArgs = [stringToBytes('WITHDRAW')];
    let txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: sender.account,
        appId: applicationId,
        appArgs: appArgs,
        payFlags: { totalFee: 1000 },
      },
      {
        type: TransactionType.TransferAsset,
        assetID: 123,
        sign: SignType.LogicSignature,
        lsig: lsig,
        fromAccount: escrow.account,
        toAccountAddr: sender.address,
        amount: assetAmount,
        payFlags: { 
          totalFee: assetFee,
        },
      },
      {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        lsig: lsig,
        fromAccount: escrow.account,
        toAccountAddr: sender.address,
        amountMicroAlgos: microAlgosAmount,
        payFlags: { 
          totalFee: algoFee,
        },
      },
    ];
    runtime.executeTx(txGroup, program, []);
  };

  this.beforeEach(() => {
    master = new StoreAccount(1000e6);
    creator = new StoreAccount(minBalance);
    escrow = new StoreAccount(minBalance);
    swapper = new StoreAccount(minBalance);
    master.createdAssets[1] = {
      creator: 'addr-1',
      total: 10000,
      decimals: 10,
      'default-frozen': 'false',
      'unit-name': 'AD',
      name: 'ASSETAD',
      url: 'assetUrl',
      'metadata-hash': 'hash',
      manager: 'addr-1',
      reserve: 'addr-2',
      freeze: 'addr-3',
      clawback: 'addr-4'
    };
    runtime = new Runtime([master, creator, escrow, swapper]);

    flags = {
      sender: creator.account,
      localInts: 3,
      localBytes: 0,
      globalInts: 4,
      globalBytes: 2
    };
  });

  const creationArgs = [
    'int:123',
  ];

  it('throws errors after trying to opt-in escrow after finishing setup', () => {
    setupApplication();
    deployEscrow();
    addFundsToEscrow();
    setEscrow(escrow.address);

    expectTealError(
      () => escrowOptInToAsset(),
      ERRORS.TEAL.INVALID_TYPE
    );
  });

  it('throws errors after trying to remove liquidity bigger than the balance', () => {
    setupApplicationWithEscrow();
    optIn(master.address);

    expectTealError(
      () => removeLiquidity(master.account, 8000000),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
    addLiquidity(master.account, escrow.address, 10, 7000000);
    expectTealError(
      () => removeLiquidity(master.account, 8000000),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
  });

  it('throws errors after trying to make empty withdrawal', () => {
    setupApplicationWithEscrow();
    optIn(master.address);

    expectTealError(
      () => withdraw(master, 0, 0),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
  });

  it('throws errors after trying to withdraw amount bigger than the balance', () => {
    setupApplicationWithEscrow();
    optIn(master.address);

    expectTealError(
      () => withdraw(master, 121, 0),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
    expectTealError(
      () => withdraw(master, 0, 121),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
    expectTealError(
      () => withdraw(master, 121, 121),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
  });

  it('throws errors after trying to withdraw amount different than the balance', () => {
    setupApplicationWithEscrow();
    optIn(master.address);

    addLiquidity(master.account, escrow.address, 6000000, 7000000);
    removeLiquidity(master.account, 7000000);

    assert.equal(getLocal(master.address, 'USR_ALGOS'), 6998000);
    assert.equal(getLocal(master.address, 'USR_ASA'), 6000000);
    assert.equal(getLocal(master.address, 'USR_LIQ'), 0);

    expectTealError(
      () => withdraw(master, 121, 121),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
    expectTealError(
      () => withdraw(master, 6000000, 0),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
    expectTealError(
      () => withdraw(master, 0, 6998000),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
  });

  it('throws errors after altering the transaction fee', () => {
    setupApplicationWithEscrow();
    optIn(master.address);

    addLiquidity(master.account, escrow.address, 6000000, 7000000);
    removeLiquidity(master.account, 6000000);

    assert.equal(getLocal(master.address, 'USR_ALGOS'), 5998000);
    assert.equal(getLocal(master.address, 'USR_ASA'), 5142857);
    assert.equal(getLocal(master.address, 'USR_LIQ'), 1000000);

    expectTealError(
      () => withdraw(master, 5142857, 5998000, 10000, 1000),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
    expectTealError(
      () => withdraw(master, 5142857, 5998000, 10000, 10000),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
    expectTealError(
      () => withdraw(master, 5142857, 5998000, 1000, 10000),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
  });

  it('throws error when deposit is made to invalid account', () => {
    setupApplicationWithEscrow();
    optIn(master.address);
    expectTealError(
      () => addLiquidity(master.account, swapper.address, 6000000, 7000000),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
  });

  it('throws error when deposit is made with invalid asset', () => {
    setupApplicationWithEscrow();
    optIn(master.address);
    expectTealError(
      () => addLiquidity(master.account, escrow.address, 6000000, 7000000, 111),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
  });

  it('throws error when swap is made with invalid asset', () => {
    setupApplicationWithEscrow();
    optIn(master.address);
    optIn(swapper.address);
    addLiquidity(master.account, escrow.address, 6000000, 7000000);
    expectTealError(
      () => assetSwap(swapper.account, escrow.address, 100, 111),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
  });

  it('throws error when swap is made with invalid account', () => {
    setupApplicationWithEscrow();
    optIn(master.address);
    optIn(swapper.address);
    addLiquidity(master.account, escrow.address, 6000000, 7000000);
    expectTealError(
      () => assetSwap(swapper.account, master.address, 100, 111),
      ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
    );
  });

  it('successfully swaps and withdraws', () => {
    const creatorPk = addressToPk(creator.address);

    // setup application
    setupApplication();

    assert.isDefined(applicationId);
    assert.equal(getGlobal('ASSET_IDX'), 123);
    assert.equal(getGlobal('LIQ_TOKENS'), 0);
    assert.equal(getGlobal('ALGOS_BAL'), 0);
    assert.equal(getGlobal('ASA_BAL'), 0);
    assert.equal(getGlobal('ESCROW_ADDR'), undefined);
    assert.deepEqual(getGlobal('CREATOR_ADDR'), creatorPk);

    // setup escrow account
    setupEscrow();
  
    // update application with correct escrow account address
    setEscrow(escrow.address);

    // verify escrow storage
    assert.deepEqual(getGlobal('ESCROW_ADDR'), addressToPk(escrow.address));
    assert.equal(getGlobal('ASSET_IDX'), 123);

    // opt-in and add liquidity
    optIn(master.address);
    addLiquidity(master.account, escrow.address, 6000000, 7000000);

    assert.equal(getGlobal('LIQ_TOKENS'), 7000000);
    assert.equal(getGlobal('ALGOS_BAL'), 7000000);
    assert.equal(getGlobal('ASA_BAL'), 6000000);
    assert.equal(getLocal(master.address, 'USR_ALGOS'), 0);
    assert.equal(getLocal(master.address, 'USR_ASA'), 0);
    assert.equal(getLocal(master.address, 'USR_LIQ'), 7000000);

    // make an algo swap
    optIn(swapper.address);
    algoSwap(swapper.account, escrow.address, 1000000);

    assert.equal(getGlobal('LIQ_TOKENS'), 7000000);
    assert.equal(getGlobal('ALGOS_BAL'), 8000000);
    assert.equal(getGlobal('ASA_BAL'), 5272500);
    assert.equal(getLocal(master.address, 'USR_ALGOS'), 0);
    assert.equal(getLocal(master.address, 'USR_ASA'), 0);
    assert.equal(getLocal(master.address, 'USR_LIQ'), 7000000);
    assert.equal(getLocal(swapper.address, 'USR_ALGOS'), 0);
    assert.equal(getLocal(swapper.address, 'USR_ASA'), 727500);
    assert.equal(getLocal(swapper.address, 'USR_LIQ'), 0);

    // withdraw tokens
    withdraw(swapper, 727500, 0);
    assert.equal(getGlobal('LIQ_TOKENS'), 7000000);
    assert.equal(getGlobal('ALGOS_BAL'), 8000000);
    assert.equal(getGlobal('ASA_BAL'), 5272500);
    assert.equal(getLocal(swapper.address, 'USR_ALGOS'), 0);
    assert.equal(getLocal(swapper.address, 'USR_ASA'), 0);
    assert.equal(getLocal(swapper.address, 'USR_LIQ'), 0);

    // make an asset swap
    assetSwap(master.account, escrow.address, 1000000);

    assert.equal(getGlobal('LIQ_TOKENS'), 7000000);
    assert.equal(getGlobal('ALGOS_BAL'), 6762855);
    assert.equal(getGlobal('ASA_BAL'), 6272500);
    assert.equal(getLocal(master.address, 'USR_ALGOS'), 1237145);
    assert.equal(getLocal(master.address, 'USR_ASA'), 0);
    assert.equal(getLocal(master.address, 'USR_LIQ'), 7000000);
    assert.equal(getLocal(swapper.address, 'USR_ALGOS'), 0);
    assert.equal(getLocal(swapper.address, 'USR_ASA'), 0);
    assert.equal(getLocal(swapper.address, 'USR_LIQ'), 0);
  
    // withdraw algos
    withdraw(master, 0, 1237145);
  });
});

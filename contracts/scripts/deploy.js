// Original file: https://github.com/scale-it/algorand-builder/blob/master/examples/crowdfunding/scripts/createApp.js
/* globals module, require */

const { SETUP_ESCROW, UPDATE } = require('../common/constants.js');

const { stringToBytes, updateSSC } = require('@algorand-builder/algob');
const { executeTransaction } = require('@algorand-builder/algob');
const { TransactionType, SignType } = require('@algorand-builder/runtime/build/types.js');

const ALGOS_TO_ASA = 'ALGOS_TO_ASA';
const ASA_TO_ASA = 'ASA_TO_ASA';

const SECONDARY_ASSET_INDEX = 14075549;
const PRIMARY_ASSET_INDEX = 14098899;
const CONTRACT_TYPE = ALGOS_TO_ASA;
const PAIR = ['ALGOS', 'USDTG'];
const LIQUIDITY_TOKEN_NOTE = `Asaswap Liquidity Token for ${PAIR.join('/')}. Make sure to verify its authenticity`;
const LIQUIDITY_TOKEN_NAME = `${PAIR[0][0]}${PAIR[1][0]}_LIQ`;

// updateSSC doesn't support template parameters, edit them manually in state.py

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master');

  // At this moment asa.yaml needs to be edited manually
  const liquidityTokenInfo = await deployer.deployASA('liquidity_token', {
    creator: masterAccount,
    manager: masterAccount,
    reserve: masterAccount,
    freeze: masterAccount,
    clawback: masterAccount,
    note: LIQUIDITY_TOKEN_NOTE,
    unitName: LIQUIDITY_TOKEN_NAME
  });
  await deployer.optInToASA('liquidity_token', 'master', {});
  console.log('Deployed Liquidity Token: ', liquidityTokenInfo);

  // Initialize app arguments
  let appArgs;
  if (CONTRACT_TYPE === ALGOS_TO_ASA) {
    appArgs = [
      `int:${SECONDARY_ASSET_INDEX}`,
      `int:${liquidityTokenInfo.assetIndex}`
    ];
  } else {
    appArgs = [
      `int:${SECONDARY_ASSET_INDEX}`,
      `int:${PRIMARY_ASSET_INDEX}`,
      `int:${liquidityTokenInfo.assetIndex}`
    ];
  }

  // Create Application
  // Note: An Account can have maximum of 10 Applications.
  await deployer.ensureCompiled('state.py', true, {
    type: CONTRACT_TYPE
  });
  const res = await deployer.deploySSC(
    'state.py', // approval program
    'clear.py', // clear program
    {
      sender: masterAccount,
      localInts: 3,
      localBytes: 0,
      globalInts: CONTRACT_TYPE === ALGOS_TO_ASA ? 5 : 6,
      globalBytes: 2,
      appArgs: appArgs
    },
    {},
    {
      type: CONTRACT_TYPE
    }
  );
  const applicationID = res.appID;

  // Get escrow account address
  const escrowAccount = await deployer.loadLogic('escrow.py', [], { app_id: applicationID });
  console.log('Escrow Account Address:', escrowAccount.address());

  // Send funds for minimum escrow balance
  const algoTxnParams = {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: escrowAccount.address(),
    amountMicroAlgos: CONTRACT_TYPE === ALGOS_TO_ASA ? 302000 : 405000,
    payFlags: {}
  };
  await executeTransaction(deployer, algoTxnParams);

  console.log('Opting-In For Escrow');
  let txnParams = [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: masterAccount,
      appId: applicationID,
      appArgs: [stringToBytes(SETUP_ESCROW)],
      payFlags: { totalFee: 1000 }
    },
    {
      type: TransactionType.TransferAsset,
      sign: SignType.LogicSignature,
      fromAccount: { addr: escrowAccount.address() },
      toAccountAddr: escrowAccount.address(),
      lsig: escrowAccount,
      amount: 0,
      assetID: SECONDARY_ASSET_INDEX,
      payFlags: { totalFee: 1000 }
    }
  ];
  await executeTransaction(deployer, txnParams);
  if (CONTRACT_TYPE === ASA_TO_ASA) {
    txnParams = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: masterAccount,
        appId: applicationID,
        appArgs: [stringToBytes(SETUP_ESCROW)],
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.TransferAsset,
        sign: SignType.LogicSignature,
        fromAccount: { addr: escrowAccount.address() },
        toAccountAddr: escrowAccount.address(),
        lsig: escrowAccount,
        amount: 0,
        assetID: PRIMARY_ASSET_INDEX,
        payFlags: { totalFee: 1000 }
      }
    ];
    await executeTransaction(deployer, txnParams);
  }
  txnParams = [
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: masterAccount,
      appId: applicationID,
      appArgs: [stringToBytes(SETUP_ESCROW)],
      payFlags: { totalFee: 1000 }
    },
    {
      type: TransactionType.TransferAsset,
      sign: SignType.LogicSignature,
      fromAccount: { addr: escrowAccount.address() },
      toAccountAddr: escrowAccount.address(),
      lsig: escrowAccount,
      amount: 0,
      assetID: liquidityTokenInfo.assetIndex,
      payFlags: { totalFee: 1000 }
    }
  ];
  await executeTransaction(deployer, txnParams);

  // Send all liquidity tokens to escrow
  txnParams = [
    {
      type: TransactionType.TransferAsset,
      sign: SignType.SecretKey,
      fromAccount: masterAccount,
      toAccountAddr: escrowAccount.address(),
      amount: 9007199254740991,
      assetID: liquidityTokenInfo.assetIndex,
      payFlags: { totalFee: 1000 }
    }
  ];
  await executeTransaction(deployer, txnParams);

  // Update liquidity token
  const assetModFields = {
    manager: escrowAccount.address(),
    reserve: escrowAccount.address(),
    freeze: escrowAccount.address(),
    clawback: escrowAccount.address()
  };
  const assetConfigParams = {
    type: TransactionType.ModifyAsset,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    assetID: liquidityTokenInfo.assetIndex,
    fields: assetModFields,
    payFlags: { totalFee: 1000 }
  };
  await executeTransaction(deployer, assetConfigParams);
  console.log('Updated Liquidity Token: ', assetModFields);


  // Update application with escrow account
  // Note: that the code for the contract will not change.
  // The update operation links the two contracts.
  appArgs = [stringToBytes(UPDATE)];
  let updatedRes = await updateSSC(
    deployer,
    masterAccount,
    {}, // pay flags
    applicationID,
    'state.py',
    'clear.py',
    {
      appArgs: appArgs,
      accounts: [escrowAccount.address()],
    }
  );

  console.log('Application Updated: ', updatedRes);
}

module.exports = { default: run };

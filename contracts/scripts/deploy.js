// Original file: https://github.com/scale-it/algorand-builder/blob/master/examples/crowdfunding/scripts/createApp.js
/* globals module, require */

const { SETUP_ESCROW, UPDATE } = require('../common/constants.js');

const { stringToBytes, updateSSC } = require('@algo-builder/algob');
const { executeTransaction } = require('@algo-builder/algob');
const { TransactionType, SignType } = require('@algo-builder/runtime/build/types.js');

const ALGOS_TO_ASA = 'ALGOS_TO_ASA';
const ASA_TO_ASA = 'ASA_TO_ASA';

const SECONDARY_ASSET_INDEX = 63139660;
const PRIMARY_ASSET_INDEX = 14098899;
const CONTRACT_TYPE = ALGOS_TO_ASA;
const PAIR = ['ALGOS', 'USDTG'];
const LIQUIDITY_TOKEN_NOTE = `Asaswap Liquidity Token for ${PAIR.join('/')}. Make sure to verify its authenticity`;
const LIQUIDITY_TOKEN_NAME = `${PAIR[0][0]}${PAIR[1][0]}_LIQ`;

// updateSSC doesn't support template parameters, edit them manually in state.py

async function run (runtimeEnv, deployer) {
  let specifications = runtimeEnv.config.contract_specs;
  const masterAccount = deployer.accountsByName.get('master');

  // At this moment asa.yaml needs to be edited manually
  const liquidityTokenInfo = await deployer.deployASA('liquidity_token', {
    creator: masterAccount,
    manager: masterAccount,
    reserve: masterAccount,
    freeze: masterAccount,
    clawback: masterAccount,
    note: LIQUIDITY_TOKEN_NOTE,
    unitName: LIQUIDITY_TOKEN_NAME,
    totalFee: 1000
  });
  console.log('Deployed Liquidity Token: ', liquidityTokenInfo);

  // Create MulDiv64 contract
  await deployer.ensureCompiled('muldiv64.py', true, {});
  const md64res = await deployer.deploySSC(
    'muldiv64.py',
    'empty_clear.py',
    {
      sender: masterAccount,
      localInts: 0,
      localBytes: 0,
      globalInts: 2,
      globalBytes: 0,
      appArgs: []
    },
    {
      totalFee: 1000
    },
    {}
  )
  console.log(`Created Main contract with ID: ${md64res.appID}`)

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
    {
      totalFee: 1000,
    },
    {
      type: CONTRACT_TYPE,
      muldiv_app_id: md64res.appID
    }
  );
  const applicationID = res.appID;
  console.log(`Created MulDiv64 contract with ID: ${applicationID}`)

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
    payFlags: { totalFee: 1000 }
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
  console.log('- Opting-in to secondary asset');
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
    console.log('- Opting-in to primary asset');
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
  console.log('- Opting-in to liquidity token');
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

  // The update operation links main contract with escrow
  let updatedRes = await executeTransaction(
    deployer,
    {
      type: TransactionType.CallNoOpSSC,
      sign: SignType.SecretKey,
      fromAccount: masterAccount,
      appId: applicationID,
      appArgs: [stringToBytes(UPDATE), stringToBytes(escrowAccount.address())],
      payFlags: { totalFee: 1000 }
    }
  )

  console.log('Application Updated: ', updatedRes);
}

module.exports = { default: run };

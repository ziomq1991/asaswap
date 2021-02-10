// Original file: https://github.com/scale-it/algorand-builder/blob/master/examples/crowdfunding/scripts/createApp.js
/* globals module, require */
const { stringToBytes, update } = require('@algorand-builder/algob');
const { executeTransaction } = require('@algorand-builder/algob');
const { TransactionType, SignType } = require('@algorand-builder/runtime/build/types.js');


async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master');

  // initialize app arguments
  let appArgs = [
    'int:123', // asset index
  ];

  // Create Application
  // Note: An Account can have maximum of 10 Applications.
  const res = await deployer.deploySSC(
    'state.py', // approval program
    'clear.py', // clear program
    {
      sender: masterAccount,
      localInts: 3,
      localBytes: 0,
      globalInts: 4,
      globalBytes: 2,
      appArgs: appArgs
    }, 
    {}
  );

  console.log(res);

  // Get Escrow Account Address
  const escrowAccount = await deployer.loadLogic('escrow.py', [], { app_id: res.appID });
  console.log('Escrow Account Address:', escrowAccount.address());

  // Send Funds For Minimum Escrow Balance
  const algoTxnParams = {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: escrowAccount.address(),
    amountMicroAlgos: 201000,
    payFlags: {}
  };
  await executeTransaction(deployer, algoTxnParams);

  // Update application with escrow account
  // Note: that the code for the contract will not change.
  // The update operation links the two contracts.
  const applicationID = res.appID;

  appArgs = [stringToBytes('UPDATE')];
  const updatedRes = await update(
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
  console.log('Opting-In for Creator and Escrow');
  try {
    const lsig = await deployer.loadLogic('escrow.py', [], { app_id: res.appID });
    await deployer.optInToSSC(masterAccount, applicationID, {}, {});
    const txnParam = {
      type: TransactionType.TransferAsset,
      sign: SignType.LogicSignature,
      fromAccount: { addr: escrowAccount.address() },
      toAccountAddr: escrowAccount.address(),
      lsig: escrowAccount,
      assetAmount: 0,
      assetID: 14001707,
      payFlags: { totalFee: 1000 }
    };
    await executeTransaction(deployer, txnParam);  
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
  console.log('Opt-In successful.');
}

module.exports = { default: run };

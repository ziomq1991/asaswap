// Original file: https://github.com/scale-it/algorand-builder/blob/master/examples/crowdfunding/scripts/createApp.js
/* globals module, require */
const { stringToBytes, update } = require('@algorand-builder/algob');

 

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
  const escrowAccount = await deployer.loadLogic('escrow.py', [], { APP_ID: res.appID });
  console.log('Escrow Account Address:', escrowAccount.address());

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

  console.log('Opting-In for Creator and Donor.');
  try {
    await deployer.optInToSSC(masterAccount, applicationID, {}, {});
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
  console.log('Opt-In successful.');
}

module.exports = { default: run };

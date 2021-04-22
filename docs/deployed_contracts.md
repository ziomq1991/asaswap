# Deployed Contracts
Deployed contracts can be found in `contracts/artifacts/deployed`.
The structure of the .json files is defined in `contracts/scripts/deploy.js`.
As of now the .json files are structured as follows (example is a testnet USDH/USDG pair):
```javascript
{
    pair: "USDH/USDG",
    type: "ASA_TO_ASA",
    feeBPS: 2,
    secondaryAssetID: 2,
    primaryAssetID: 3
    muldivAppID: 54,
    mainAppID: 53,
    liquidityTokenID: 50,
    escrowLogic: [2,32,7,2,4,3,6,55,0, ... ]
  }
```

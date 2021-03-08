# ASAswap

ASAswap is a Constant Product Market Maker DEX contract for Algorand blockchain. Works between Algorand and specified ASA coin or between two specified ASA coins.

The interface for end-user has just 3 operations:
1. Adding liquidity to the pool
2. Removing liquidity from the pool
3. Swap

Liquidity providers get 3% on any swap and they could collect that automatically when removing liquidity.

## Compiling and deploying the contract

Before deploying or compiling the contract you'll need to configure the deployment script. 
Inside `algob.config.js` you'll need to configure your connection to Algorand Node and enter credentials for the address that will perform the deployment. 
Due to the current limitations of `algorand-builder` you'll also need to configure some other files. 
Please follow the step-by-step instruction below.

To compile and deploy the `asaswap` contract:

* First you need to set the configuration in `algob.config.js` file:

  - Specify account address and mnemonic for the account you want to use. You can get a mnemonic for your address using `goal account export` command.
  - Specify your Node's IP address, port, and authentication token. Authentication can be found in the Algorand node's data folder.
  - If you are using TestNet, use https://bank.testnet.algorand.network/ to fund the address.
  - If you are using Private Network, use `goal clerk send`
  (https://developer.algorand.org/docs/reference/cli/goal/clerk/send/) to fund address.

* Configure contract type inside `assets/state.py`. There are two contract types:
    - `ALGOS_TO_ASA`
    - `ASA_TO_ASA`
    
* Configure Asset IDs and contract type inside scripts/deploy.js. 
    - If the contract type is `ALGOS_TO_ASA` then the primary asset ID can be set to null.
* Your address and liquidity token name in `assets/asa.yaml`.

* To compile and deploy your ASA and Smart Contracts:
  -  `poetry shell`
  -  `yarn run algob compile`
  -  `yarn run algob deploy`

* All scripts run with deploy command will store a checkpoint in the artifacts directory. If a script has already a checkpoint it won’t be run again unless `--force | -f` flag is provided to the deployment command or `cache/scripts` folder is deleted.

  - `yarn run algob deploy -f`

## UI configuration

While deploying the contract using `yarn run algob deploy` command you will need to keep track of the following information, which can be found in the console log:
- Application ID
- Escrow Address
- Liquidity token ID
You'll also need to look for a compiled escrow contract in the folder `artifacts/cache`. It will be needed to prepare a logical signature of the escrow transactions. All of this information needs to be filled out in the config.js file of our user interface, which has a pretty straightforward format.

## Dependencies

* You'll need to download the [algorand-builder](https://github.com/scale-it/algorand-builder) repository and link the `algob` and `runtime` packages. The latest tested commit for `algorand-builder` is `606efcfe998f497bccd5b9e92f214664096ad50d`.
    - To link the `algorand-builder` you need to build it using `yarn build`
    - Issue `yarn link` command in those folders: `packages/algob, packages/runtime`
    - Run `yarn link "@algorand-builder/algob"` and `yarn link "@algorand-builder/runtime"` in the contract directory
* To install the rest of the dependencies run:
  -  `poetry install`
  -  `yarn install`

## Testing

* Command to run the tests: `yarn test` (inside the poetry shell)

## Debugging

Algorand has a debugging tool called `tealdbg` which allows real-time debugging of the contract execution. 
To debug a transaction you need to supply a teal file with the contract and a dry-run of the transaction:
- `tealdbg debug state.teal --dryrun-req tx.dr`
`tealdbg` will provide you with an address that you can enter in your browser to run the debugger.

### Obtaining dry-run
Dry-run can be obtained with the goal command-line tool when issuing a transaction: 
- `goal app call --app-id {appid} --from {ACCOUNT} --out=dumptx.dr --dryrun-dump`

Dry-run can be also extracted from the user interface:
- First, you need to extract the tx which is sent using AlgoSigner's send method
- Then you need to convert it from base64 to binary form and save it to a file.
  - You can use `base64 -d` to convert the base64 text to a binary form in the *nix command-line.
- At last, you need to convert the binary form to dry-run using `goal clerk dryrun -t tx.bin --dryrun-dump -o tx.dr`.

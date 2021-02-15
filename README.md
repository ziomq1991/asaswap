# ASAswap

Constant Product Market Maker DEX for Algorand blockchain. 
Works between Algorand and specified during deployment ASA coin. 

The interface for end user has just 4 operations:
1. add liquidity to the pool
1. remove liquidity from the pool
1. do swap between two assets 
1. withdraw funds (after swap or removing liquidity)

Liquidity providers gets 0.3% on any swap and they could collect that automatically when removing liquidity.

## Compiling and deploying

To compile and deploy the `asaswap`:

* First you need to set the configuration in `algob.config.js` file:

  - Specify accounts you want to use.
  - If you are using TestNet, use https://bank.testnet.algorand.network/ to fund address.
  - If you are using Private Network, use `goal clerk send`
  (https://developer.algorand.org/docs/reference/cli/goal/clerk/send/) to fund address.

* To compile and deploy your ASA and Smart Contracts:
  -  `poetry shell`
  -  `yarn run algob compile`
  -  `yarn run algob deploy`

* All scripts run with deploy command will store a checkpoint in the artifacts directory. If a script has already a checkpoint it won’t be run again unless `--force | -f` flag is provided to deploy command.

  - `yarn run algob deploy -f` 

## Dependencies

* You'll need to download to download the [algorand-builder](https://github.com/scale-it/algorand-builder) repository and link the `algob` and `runtime` packages.
* To install the rest of the dependencies run:
  -  `poetry install`
  -  `yarn install`

## Testing

* Command to run the tests: `yarn test` (inside the poetry shell)

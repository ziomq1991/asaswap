/* globals describe, it */

import { addressToPk } from '@algorand-builder/algob';
import { Runtime, StoreAccount } from '@algorand-builder/runtime';
import { RUNTIME_ERRORS } from '@algorand-builder/runtime/build/errors/errors-list.js';
import chai from 'chai';
import { expectTealError } from './utils/errors.mjs';
import { AsaswapManager, ASA_TO_ASA, ALGOS_TO_ASA } from './utils/asaswap.mjs';
import { setupAssets, fundAccounts } from './utils/assets.mjs';
import constants from '../common/constants.js';

const {
  GLOBAL_A_BAL,
  A_IDX, GLOBAL_B_BAL,
  B_IDX, CREATOR_ADDRESS, ESCROW_ADDRESS, LIQ_IDX,
  GLOB_LIQ_TOKENS,
  USR_LIQ_TOKENS,
  USR_A_BAL,
  USR_B_BAL
} = constants;
const { assert } = chai;

[ASA_TO_ASA, ALGOS_TO_ASA].forEach(function (contractType) {
  describe(`${contractType} Tests`, function () {
    const minBalance = 10e6;
    let master;
    let creator;
    let swapper;

    let runtime;
    let asaswap;
    let assetIds;

    const getGlobal = (key) => runtime.getGlobalState(asaswap.getApplicationId(), key);
    const getLocal = (accountAddr, key) => runtime.getLocalState(asaswap.getApplicationId(), accountAddr, key);

    this.beforeEach(() => {
      master = new StoreAccount(1000e6);
      creator = new StoreAccount(minBalance);
      swapper = new StoreAccount(minBalance);
      runtime = new Runtime([master, creator, swapper]);
      assetIds = setupAssets(runtime, master);
      fundAccounts(runtime, master, [master, creator, swapper], assetIds);
      asaswap = new AsaswapManager(runtime, creator, assetIds, contractType);
    });

    it('throws errors after trying to opt-in escrow after finishing setup', () => {
      asaswap.setupApplication(master);
      asaswap.deployEscrow();
      asaswap.addFundsToEscrow();
      asaswap.configureContract(asaswap.getEscrowAddress(), asaswap.getValidatorId());

      expectTealError(
        () => asaswap.escrowSetupAssets(),
        RUNTIME_ERRORS.TEAL.INVALID_TYPE
      );
    });

    it('throws errors after trying to remove liquidity bigger than the balance', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);

      expectTealError(
        () => asaswap.removeLiquidity(master.account, 8000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 10);
      expectTealError(
        () => asaswap.removeLiquidity(master.account, 8000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws errors after trying to make empty withdrawal', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);

      expectTealError(
        () => asaswap.withdraw(master, 0, 0),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws errors after trying to withdraw amount bigger than the balance', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);

      expectTealError(
        () => asaswap.withdraw(master, 121, 0),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => asaswap.withdraw(master, 0, 121),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => asaswap.withdraw(master, 121, 121),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws errors after trying to withdraw amount different than the balance', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);

      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 6000000);
      asaswap.removeLiquidity(master.account, 7000000);

      assert.equal(getLocal(master.address, USR_A_BAL), 7000000);
      assert.equal(getLocal(master.address, USR_B_BAL), 6000000);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 0);

      expectTealError(
        () => asaswap.withdraw(master, 121, 121),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => asaswap.withdraw(master, 0, 6000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => asaswap.withdraw(master, 7000000, 0),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws errors after altering the transaction fee', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);

      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 6000000);
      asaswap.removeLiquidity(master.account, 6000000);

      assert.equal(getLocal(master.address, USR_A_BAL), 6000000);
      assert.equal(getLocal(master.address, USR_B_BAL), 5142857);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 1000000);

      expectTealError(
        () => asaswap.withdraw(master, 6000000, 5142857, {
          primaryAssetFee: 10000,
          secondaryAssetFee: 1000,
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => asaswap.withdraw(master, 6000000, 5142857, {
          primaryAssetFee: 10000,
          secondaryAssetFee: 10000,
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => asaswap.withdraw(master, 6000000, 5142857, {
          primaryAssetFee: 1000,
          secondaryAssetFee: 10000,
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when deposit is made to invalid account', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      expectTealError(
        () => asaswap.addLiquidity(master.account, swapper.address, 7000000, 6000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when deposit is made with invalid asset', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      expectTealError(
        () => asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 6000000, {
          secondaryAssetId: assetIds['liquidityAssetId']
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      if (contractType === ASA_TO_ASA) {
        expectTealError(
          () => asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 6000000, {
            primaryAssetId: assetIds['secondaryAssetId']
          }),
          RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
        );
      }
    });

    it('throws error when swap is made with invalid asset', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      asaswap.optIn(swapper.address);
      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 6000000);
      expectTealError(
        () => asaswap.secondaryAssetSwap(swapper.account, asaswap.getEscrowAddress(), 100, {
          assetId: assetIds['invalidAssetId']
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      if (contractType === ASA_TO_ASA) {
        expectTealError(
          () => asaswap.primaryAssetSwap(swapper.account, asaswap.getEscrowAddress(), 100, {
            assetId: assetIds['invalidAssetId']
          }),
          RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
        );
      }
    });

    it('throws error when fee is paid to wrong account', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);

      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 6000000);
      asaswap.removeLiquidity(master.account, 7000000);

      assert.equal(getLocal(master.address, USR_A_BAL), 7000000);
      assert.equal(getLocal(master.address, USR_B_BAL), 6000000);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 0);

      expectTealError(
        () => asaswap.withdraw(master, 121, 121),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => asaswap.withdraw(master, 0, 6000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => asaswap.withdraw(master, 7000000, 6000000, {
          'feeTo': swapper.address
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when swap is made with invalid account', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      asaswap.optIn(swapper.address);
      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 6000000);
      expectTealError(
        () => asaswap.secondaryAssetSwap(swapper.account, master.address, 100),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('successfully withdraws liquidity', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 10);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 7000000);
      asaswap.withdrawLiquidity(master, 5000000);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 2000000);
    });

    it('successfully adds liquidity', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 700000, 10);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 700000);
      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 700000, 10);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 1400000);
    });

    it('throws error when trying to withdraw liquidity with altered fee', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 10);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 7000000);
      expectTealError(
        () => asaswap.withdrawLiquidity(master, 7000000, {
          assetFee: 10000,
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when trying to withdraw liquidity with fee being sent to wrong account', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 10);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 7000000);
      expectTealError(
        () => asaswap.withdrawLiquidity(master, 7000000, {
          feeTo: master.address
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when trying to withdraw liquidity with invalid asset', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 10);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 7000000);
      expectTealError(
        () => asaswap.withdrawLiquidity(master, 7000000, {
          assetId: assetIds['primaryAssetId']
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when trying to withdraw liquidity over balance', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 10);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 7000000);
      expectTealError(
        () => asaswap.withdrawLiquidity(master, 8000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('successfully deposits liquidity', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 0);
      asaswap.depositLiquidity(master.account, 5000000);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 5000000);
    });

    it('throws error when trying to deposit liquidity with invalid asset id', () => {
      asaswap.setupApplicationWithEscrow(master);
      asaswap.optIn(master.address);
      expectTealError(
        () => asaswap.depositLiquidity(master.account, 5000000, {
          assetId: assetIds['secondaryAssetId']
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('successfully swaps and withdraws', () => {
      const creatorPk = addressToPk(creator.address);

      // Setup application
      asaswap.setupApplication(master);

      assert.isDefined(asaswap.getApplicationId());
      if (contractType === ASA_TO_ASA) {
        assert.equal(getGlobal(A_IDX), assetIds['primaryAssetId']);
      }
      assert.equal(getGlobal(B_IDX), assetIds['secondaryAssetId']);
      assert.equal(getGlobal(GLOB_LIQ_TOKENS), 0);
      assert.equal(getGlobal(GLOBAL_A_BAL), 0);
      assert.equal(getGlobal(GLOBAL_B_BAL), 0);
      assert.equal(getGlobal(ESCROW_ADDRESS), undefined);
      assert.deepEqual(getGlobal(CREATOR_ADDRESS), creatorPk);

      // Setup escrow account
      asaswap.setupEscrow();

      // Update application with correct escrow account address
      asaswap.configureContract(asaswap.getEscrowAddress(), asaswap.getValidatorId());

      // Verify escrow storage
      assert.deepEqual(getGlobal(ESCROW_ADDRESS), addressToPk(asaswap.getEscrowAddress()));
      if (contractType === ASA_TO_ASA) {
        assert.equal(getGlobal(A_IDX), assetIds['primaryAssetId']);
      }
      assert.equal(getGlobal(B_IDX), assetIds['secondaryAssetId']);
      assert.equal(getGlobal(LIQ_IDX), assetIds['liquidityAssetId']);

      // Opt-in and add liquidity
      asaswap.optIn(master.address);
      asaswap.addLiquidity(master.account, asaswap.getEscrowAddress(), 7000000, 6000000);

      assert.equal(getGlobal(GLOB_LIQ_TOKENS), 7000000);
      assert.equal(getGlobal(GLOBAL_A_BAL), 7000000);
      assert.equal(getGlobal(GLOBAL_B_BAL), 6000000);
      assert.equal(getLocal(master.address, USR_A_BAL), 0);
      assert.equal(getLocal(master.address, USR_B_BAL), 0);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 7000000);

      // Make a primary asset swap
      asaswap.optIn(swapper.address);
      asaswap.primaryAssetSwap(swapper.account, asaswap.getEscrowAddress(), 1000000);

      assert.equal(getGlobal(GLOB_LIQ_TOKENS), 7000000);
      assert.equal(getGlobal(GLOBAL_A_BAL), 8000000);
      assert.equal(getGlobal(GLOBAL_B_BAL), 5272500);
      assert.equal(getLocal(master.address, USR_A_BAL), 0);
      assert.equal(getLocal(master.address, USR_B_BAL), 0);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 7000000);
      assert.equal(getLocal(swapper.address, USR_A_BAL), 0);
      assert.equal(getLocal(swapper.address, USR_B_BAL), 727500);
      assert.equal(getLocal(swapper.address, USR_LIQ_TOKENS), 0);

      // Withdraw tokens
      asaswap.withdraw(swapper, 0, 727500);
      assert.equal(getGlobal(GLOB_LIQ_TOKENS), 7000000);
      assert.equal(getGlobal(GLOBAL_A_BAL), 8000000);
      assert.equal(getGlobal(GLOBAL_B_BAL), 5272500);
      assert.equal(getLocal(swapper.address, USR_A_BAL), 0);
      assert.equal(getLocal(swapper.address, USR_B_BAL), 0);
      assert.equal(getLocal(swapper.address, USR_LIQ_TOKENS), 0);

      // Make a secondary asset swap
      asaswap.secondaryAssetSwap(master.account, asaswap.getEscrowAddress(), 1000000);

      assert.equal(getGlobal(GLOB_LIQ_TOKENS), 7000000);
      assert.equal(getGlobal(GLOBAL_A_BAL), 6762855);
      assert.equal(getGlobal(GLOBAL_B_BAL), 6272500);
      assert.equal(getLocal(master.address, USR_A_BAL), 1237145);
      assert.equal(getLocal(master.address, USR_B_BAL), 0);
      assert.equal(getLocal(master.address, USR_LIQ_TOKENS), 7000000);
      assert.equal(getLocal(swapper.address, USR_A_BAL), 0);
      assert.equal(getLocal(swapper.address, USR_B_BAL), 0);
      assert.equal(getLocal(swapper.address, USR_LIQ_TOKENS), 0);

      // Withdraw primary asset
      asaswap.withdraw(master, 1237145, 0);
    });
  });
});

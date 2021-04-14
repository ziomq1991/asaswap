/* globals describe, it */

import { addressToPk } from '@algo-builder/algob';
import chai from 'chai';
import { ALGOS_TO_ASA, ASA_TO_ASA } from './utils/asaswap.mjs';
import constants from '../common/constants.js';
import { configureTest } from './base.mjs';

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
  describe(`${contractType} E2E Tests`, function () {
    configureTest.call(this, contractType);

    it('successfully swaps and withdraws', () => {
      const creatorPk = addressToPk(this.creator.address);

      // Setup application
      this.asaswap.setupApplication(this.master);

      assert.isDefined(this.asaswap.getApplicationId());
      if (contractType === ASA_TO_ASA) {
        assert.equal(this.getGlobalNumber(A_IDX), this.assetIds['primaryAssetId']);
      }
      assert.equal(this.getGlobalNumber(B_IDX), this.assetIds['secondaryAssetId']);
      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 0);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 0);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 0);
      assert.equal(this.getGlobal(ESCROW_ADDRESS), undefined);
      assert.deepEqual(this.getGlobal(CREATOR_ADDRESS), creatorPk);

      // Setup escrow account
      this.asaswap.setupEscrow();

      // Update application with correct escrow account address
      this.asaswap.configureEscrowAddress(this.asaswap.getEscrowAddress());

      // Verify escrow storage
      assert.deepEqual(this.getGlobal(ESCROW_ADDRESS), addressToPk(this.asaswap.getEscrowAddress()));
      if (contractType === ASA_TO_ASA) {
        assert.equal(this.getGlobalNumber(A_IDX), this.assetIds['primaryAssetId']);
      }
      assert.equal(this.getGlobalNumber(B_IDX), this.assetIds['secondaryAssetId']);
      assert.equal(this.getGlobalNumber(LIQ_IDX), this.assetIds['liquidityAssetId']);

      // Opt-in and add liquidity
      this.asaswap.optIn(this.master.address);
      this.asaswap.optIn(this.swapper.address);
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 700000, 600000);
      this.asaswap.addLiquidity(this.swapper, this.asaswap.getEscrowAddress(), 700000, 600000);

      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 1400000);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 1400000);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 1200000);

      assert.equal(this.getLocalNumber(this.master.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.master.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 700000);

      assert.equal(this.getLocalNumber(this.swapper.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS), 700000);

      // Withdraw liquidity tokens
      this.asaswap.withdrawLiquidity(this.master, 700000);
      this.asaswap.withdrawLiquidity(this.swapper, 700000);

      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 1400000);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 1400000);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 1200000);

      assert.equal(this.getLocalNumber(this.master.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.master.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 0);

      assert.equal(this.getLocalNumber(this.swapper.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS), 0);

      // Make a primary asset swap
      this.asaswap.primaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), 100000);

      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 1400000);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 1500000);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 1122400);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_B_BAL), 77600);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS), 0);

      // Withdraw tokens
      this.asaswap.withdraw(this.swapper, 0, 77600);
      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 1400000);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 1500000);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 1122400);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS), 0);

      // Deposit liquidity tokens
      this.asaswap.depositLiquidity(this.master, 700000);
      this.asaswap.depositLiquidity(this.swapper, 700000);

      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 1400000);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 1500000);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 1122400);

      assert.equal(this.getLocalNumber(this.master.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.master.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 700000);

      assert.equal(this.getLocalNumber(this.swapper.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS), 700000);

      // Remove some liquidity
      this.asaswap.removeLiquidity(this.master, 100000);

      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 1300000);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 1392858);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 1042229);
      assert.equal(this.getLocalNumber(this.master.address, USR_A_BAL), 107142);
      assert.equal(this.getLocalNumber(this.master.address, USR_B_BAL), 80171);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 600000);

      this.asaswap.removeLiquidity(this.swapper, 300000);

      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 1000000);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 1071430);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 801715);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_A_BAL), 321428);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_B_BAL), 240514);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS), 400000);

      // Withdraw tokens
      this.asaswap.withdraw(this.master, 107142, 80171);
      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 1000000);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 1071430);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 801715);
      assert.equal(this.getLocalNumber(this.master.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.master.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 600000);

      this.asaswap.withdraw(this.swapper, 321428, 240514);

      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 1000000);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 1071430);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 801715);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS), 400000);

      // Make a secondary asset swap
      this.asaswap.secondaryAssetSwap(this.master, this.asaswap.getEscrowAddress(), 100000);

      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 1000000);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 956174);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 901715);
      assert.equal(this.getLocalNumber(this.master.address, USR_A_BAL), 115256);
      assert.equal(this.getLocalNumber(this.master.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 600000);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS), 400000);

      // Withdraw primary asset
      this.asaswap.withdraw(this.master, 115256, 0);

      assert.equal(this.getGlobalNumber(GLOB_LIQ_TOKENS), 1000000);
      assert.equal(this.getGlobalNumber(GLOBAL_A_BAL), 956174);
      assert.equal(this.getGlobalNumber(GLOBAL_B_BAL), 901715);
      assert.equal(this.getLocalNumber(this.master.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.master.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 600000);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_A_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_B_BAL), 0);
      assert.equal(this.getLocalNumber(this.swapper.address, USR_LIQ_TOKENS), 400000);
    });
  });
});

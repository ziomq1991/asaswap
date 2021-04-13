/* globals describe, it */

import { RUNTIME_ERRORS } from '@algo-builder/runtime/build/errors/errors-list.js';
import chai from 'chai';
import { expectTealError } from './utils/errors.mjs';
import { ALGOS_TO_ASA, ASA_TO_ASA } from './utils/asaswap.mjs';
import constants from '../common/constants.js';
import { configureTest } from './base.mjs';

const {
  USR_LIQ_TOKENS,
  USR_A_BAL,
  USR_B_BAL,
  GLOBAL_A_BAL,
  GLOBAL_B_BAL
} = constants;
const { assert } = chai;

[ASA_TO_ASA, ALGOS_TO_ASA].forEach(function (contractType) {
  describe(`${contractType} Functional Tests`, function () {
    configureTest.call(this, contractType);

    // Test excluded until algo-builder allows manual OPT-IN
    // it('throws errors after trying to opt-in escrow after finishing setup', () => {
    //   this.asaswap.setupApplication(this.master);
    //   this.asaswap.deployEscrow();
    //   this.asaswap.addFundsToEscrow();
    //   this.asaswap.configureEscrowAddress(this.asaswap.getEscrowAddress());
    //   expectTealError(
    //     () => this.asaswap.escrowSetupAssets(),
    //     RUNTIME_ERRORS.TEAL.INVALID_TYPE
    //   );
    // });

    it('throws errors after trying to remove liquidity bigger than the balance', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);

      expectTealError(
        () => this.asaswap.removeLiquidity(this.master, 8000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 10);
      expectTealError(
        () => this.asaswap.removeLiquidity(this.master, 8000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws errors after trying to make empty withdrawal', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);

      expectTealError(
        () => this.asaswap.withdraw(this.master, 0, 0),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws errors after trying to withdraw amount bigger than the balance', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);

      expectTealError(
        () => this.asaswap.withdraw(this.master, 121, 0),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => this.asaswap.withdraw(this.master, 0, 121),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => this.asaswap.withdraw(this.master, 121, 121),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws errors after trying to withdraw amount different than the balance', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);

      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 6000000);
      this.asaswap.removeLiquidity(this.master, 7000000);

      assert.equal(this.getLocalNumber(this.master.address, USR_A_BAL), 7000000);
      assert.equal(this.getLocalNumber(this.master.address, USR_B_BAL), 6000000);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 0);

      expectTealError(
        () => this.asaswap.withdraw(this.master, 121, 121),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => this.asaswap.withdraw(this.master, 0, 6000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => this.asaswap.withdraw(this.master, 7000000, 0),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws errors after altering the transaction fee', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);

      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 6000000);
      this.asaswap.removeLiquidity(this.master, 6000000);

      assert.equal(this.getLocalNumber(this.master.address, USR_A_BAL), 6000000);
      assert.equal(this.getLocalNumber(this.master.address, USR_B_BAL), 5142857);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 1000000);

      expectTealError(
        () => this.asaswap.withdraw(this.master, 6000000, 5142857, {
          primaryAssetFee: 10000,
          secondaryAssetFee: 1000,
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => this.asaswap.withdraw(this.master, 6000000, 5142857, {
          primaryAssetFee: 10000,
          secondaryAssetFee: 10000,
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => this.asaswap.withdraw(this.master, 6000000, 5142857, {
          primaryAssetFee: 1000,
          secondaryAssetFee: 10000,
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when deposit is made to invalid account', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      expectTealError(
        () => this.asaswap.addLiquidity(this.master, this.swapper.address, 7000000, 6000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when deposit is made with invalid asset', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      expectTealError(
        () => this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 6000000, {
          secondaryAssetId: this.assetIds['primaryAssetId']
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      if (contractType === ASA_TO_ASA) {
        expectTealError(
          () => this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 6000000, {
            primaryAssetId: this.assetIds['secondaryAssetId']
          }),
          RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
        );
      }
    });

    it('throws error when swap is made with invalid asset', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      this.asaswap.optIn(this.swapper.address);
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 6000000);
      expectTealError(
        () => this.asaswap.secondaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), 100, {
          assetId: this.assetIds['invalidAssetId']
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      if (contractType === ASA_TO_ASA) {
        expectTealError(
          () => this.asaswap.primaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), 100, {
            assetId: this.assetIds['invalidAssetId']
          }),
          RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
        );
      }
    });

    it('throws error when fee is paid to wrong account', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);

      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 6000000);
      this.asaswap.removeLiquidity(this.master, 7000000);

      assert.equal(this.getLocalNumber(this.master.address, USR_A_BAL), 7000000);
      assert.equal(this.getLocalNumber(this.master.address, USR_B_BAL), 6000000);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 0);

      expectTealError(
        () => this.asaswap.withdraw(this.master, 121, 121),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => this.asaswap.withdraw(this.master, 0, 6000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
      expectTealError(
        () => this.asaswap.withdraw(this.master, 7000000, 6000000, {
          'feeTo': this.swapper.address
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when swap is made with invalid account', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      this.asaswap.optIn(this.swapper.address);
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 6000000);
      expectTealError(
        () => this.asaswap.secondaryAssetSwap(this.swapper, this.master.address, 100),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('successfully withdraws liquidity', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 10);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 7000000);
      this.asaswap.withdrawLiquidity(this.master, 5000000);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 2000000);
    });

    it('successfully adds liquidity', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 700000, 10);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 700000);
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 700000, 10);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 1400000);
    });

    it('throws error when trying to withdraw liquidity with altered fee', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 10);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 7000000);
      expectTealError(
        () => this.asaswap.withdrawLiquidity(this.master, 7000000, {
          assetFee: 10000,
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when trying to withdraw liquidity with fee being sent to wrong account', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 10);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 7000000);
      expectTealError(
        () => this.asaswap.withdrawLiquidity(this.master, 7000000, {
          feeTo: this.master.address
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when trying to withdraw liquidity with invalid asset', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 10);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 7000000);
      expectTealError(
        () => this.asaswap.withdrawLiquidity(this.master, 7000000, {
          assetId: this.assetIds['primaryAssetId']
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('throws error when trying to withdraw liquidity over balance', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 7000000, 10);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 7000000);
      expectTealError(
        () => this.asaswap.withdrawLiquidity(this.master, 8000000),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('successfully deposits liquidity', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 0);
      this.asaswap.depositLiquidity(this.master, 5000000);
      assert.equal(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 5000000);
    });

    it('throws error when trying to deposit liquidity with invalid asset id', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      expectTealError(
        () => this.asaswap.depositLiquidity(this.master, 5000000, {
          assetId: this.assetIds['primaryAssetId']
        }),
        RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR
      );
    });

    it('can add liquidity after some swap removes most of some token', () => {
      this.asaswap.setupApplicationWithEscrow();
      this.asaswap.optIn(this.master.address);
      this.asaswap.optIn(this.swapper.address);
      this.asaswap.addLiquidity(this.master, this.asaswap.getEscrowAddress(), 10, 10);
      if (contractType == ALGOS_TO_ASA) {
        this.asaswap.primaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), 1000);
      } else /* contractType == ASA_TO_ASA */ {
        this.asaswap.primaryAssetSwap(this.swapper, this.asaswap.getEscrowAddress(), 1000, { 'assetId': this.primaryAssetId });
      }
      this.asaswap.withdraw(this.swapper, 0, this.getLocalNumber(this.swapper.address, USR_B_BAL));

      this.asaswap.addLiquidity(
        this.master, 
        this.asaswap.getEscrowAddress(), 
        this.getGlobalNumber(GLOBAL_A_BAL), // make sure to match the exchange ratio
        this.getGlobalNumber(GLOBAL_B_BAL)
      );
      assert.notEqual(this.getLocalNumber(this.master.address, USR_LIQ_TOKENS), 0);
    });
  });
});

/* globals describe, it */

import chai from 'chai';
import { ALGOS_TO_ASA, ASA_TO_ASA, AsaswapManager } from './utils/asaswap.mjs';
import { configureTest } from './base.mjs';
import { fundAccounts, setupAssets, ASSET_TOTAL } from './utils/assets.mjs';
import { Runtime, StoreAccount } from '@algorand-builder/runtime';
import { USR_A_BAL, USR_B_BAL } from '../common/constants.js';

const { assert } = chai;

const INITIAL_ALGOS = 1e10; // initial amount of algos for swapper and master

[ASA_TO_ASA, ALGOS_TO_ASA].forEach(function (contractType) {
  describe(`${contractType} Precision Tests`, function () {
    configureTest.call(this, contractType);

    this.beforeEach(() => {
      this.master = new StoreAccount(INITIAL_ALGOS);
      this.creator = new StoreAccount(this.minBalance);
      this.swapper = new StoreAccount(INITIAL_ALGOS);
      this.runtime = new Runtime([this.master, this.creator, this.swapper]);
      this.assetIds = setupAssets(this.runtime, this.master);
      fundAccounts(
        this.runtime, 
        this.master, 
        [this.master, this.swapper], 
        [this.assetIds.primaryAssetId, this.assetIds.secondaryAssetId],
        ASSET_TOTAL/2n
      )
      this.asaswap = new AsaswapManager(this.runtime, this.creator, this.assetIds, contractType);
    });

    it('full precision when adding little liquidity', () => {
      this.asaswap.setupApplicationWithEscrow(this.master);
      this.asaswap.optIn(this.swapper.address);
      this.runtime.optIntoASA(this.assetIds.liquidityAssetId, this.swapper.address, {});

      const LIQ_AMT = 2**31; // liquidity to be provided to contract
      this.asaswap.addLiquidity(this.swapper.account, this.asaswap.getEscrowAddress(), LIQ_AMT, LIQ_AMT);

      const LIQ_AMT2 = LIQ_AMT - 1; // add more liquidity but don't exceed uint32 limit (2**32-1)
      this.asaswap.addLiquidity(this.swapper.account, this.asaswap.getEscrowAddress(), LIQ_AMT2, LIQ_AMT2);
      this.asaswap.withdrawLiquidity(this.swapper, LIQ_AMT + LIQ_AMT2);
      assert.equal(
        this.runtime.getAssetHolding(this.assetIds.liquidityAssetId, this.swapper.address).amount, 
        BigInt(LIQ_AMT + LIQ_AMT2)
      );
    });

    it('overflow in liquidity transactions', () => {
      this.asaswap.setupApplicationWithEscrow(this.master);
      this.asaswap.optIn(this.master.address);

      this.asaswap.addLiquidity(this.master.account, this.asaswap.getEscrowAddress(), MAX_INT, Math.floor(MAX_INT/2));
      this.asaswap.removeLiquidity(this.master.account, MAX_INT);
      this.asaswap.withdraw(this.master, this.getLocalNumber(this.master.address, USR_A_BAL), this.getLocalNumber(this.master.address, USR_B_BAL));

      this.asaswap.addLiquidity(this.master.account, this.asaswap.getEscrowAddress(), Math.floor(MAX_INT/2), MAX_INT);
      this.asaswap.removeLiquidity(this.master.account, Math.floor(MAX_INT/2));
      this.asaswap.withdraw(this.master, this.getLocalNumber(this.master.address, USR_A_BAL), this.getLocalNumber(this.master.address, USR_B_BAL));
    });

    it('overflow in primary swap transactions', () => {
      this.asaswap.setupApplicationWithEscrow(this.master);
      this.asaswap.optIn(this.master.address);
      this.asaswap.addLiquidity(this.master.account, this.asaswap.getEscrowAddress(), MAX_INT, Math.floor(MAX_INT/2));
      this.asaswap.primaryAssetSwap(this.master.account, this.asaswap.getEscrowAddress(), MAX_INT);
      this.asaswap.withdraw(this.master, this.getLocalNumber(this.master.address, USR_A_BAL), this.getLocalNumber(this.master.address, USR_B_BAL));
    });

    it('precision in primary swap transactions', () => {
      this.asaswap.setupApplicationWithEscrow(this.master);
      this.asaswap.optIn(this.master.address);
      this.asaswap.addLiquidity(this.master.account, this.asaswap.getEscrowAddress(), Math.floor(MAX_INT/10000), 3);
      this.asaswap.primaryAssetSwap(this.master.account, this.asaswap.getEscrowAddress(), Math.floor(MAX_INT/10000));
      assert.notEqual(this.getLocalNumber(this.master.address, USR_B_BAL), 0);
      this.asaswap.withdraw(this.master, this.getLocalNumber(this.master.address, USR_A_BAL), this.getLocalNumber(this.master.address, USR_B_BAL));
    });

    it('precision in secondary swap transactions', () => {
      this.asaswap.setupApplicationWithEscrow(this.master);
      this.asaswap.optIn(this.master.address);
      this.asaswap.addLiquidity(this.master.account, this.asaswap.getEscrowAddress(), 3, Math.floor(MAX_INT/10000));
      this.asaswap.secondaryAssetSwap(this.master.account, this.asaswap.getEscrowAddress(), Math.floor(MAX_INT/10000));
      assert.notEqual(this.getLocalNumber(this.master.address, USR_A_BAL), 0);
      this.asaswap.withdraw(this.master, this.getLocalNumber(this.master.address, USR_A_BAL), this.getLocalNumber(this.master.address, USR_B_BAL));
    });
  });
});

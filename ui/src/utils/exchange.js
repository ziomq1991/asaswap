import { FEE_PERCENTAGE, RATIO } from '@/config/config';

export class ExchangeCalculator {
  constructor(globalAlgosAmount, globalAssetAmount) {
    this.globalAlgosAmount = globalAlgosAmount;
    this.globalAssetAmount = globalAssetAmount;
  }

  getGlobalExchangeRate() {
    return ((this.globalAlgosAmount * RATIO) / this.globalAssetAmount);
  }

  getReverseGlobalExchangeRate() {
    return ((this.globalAssetAmount * RATIO) / this.globalAlgosAmount);
  }

  getSwapExchangeRate(addedAlgos, addedTokens) {
    return (((this.globalAlgosAmount + addedAlgos) * RATIO) / (this.globalAssetAmount + addedTokens));
  }

  getReverseSwapExchangeRate(addedAlgos, addedTokens) {
    return ((this.globalAssetAmount + addedTokens) * RATIO / (this.globalAlgosAmount + addedAlgos));
  }

  assetToAlgos(assetAmount) {
    const exchangeRate = this.getSwapExchangeRate(0, assetAmount);
    return Math.trunc((exchangeRate * assetAmount * (100 - FEE_PERCENTAGE)) / (RATIO * 100));
  }

  algosToAsset(algosAmount) {
    const exchangeRate = this.getSwapExchangeRate(algosAmount, 0);
    return Math.trunc((algosAmount * (100 - FEE_PERCENTAGE)) * RATIO / 100 / exchangeRate);
  }

  getAssetToAlgosFee(assetAmount) {
    const exchangeRate = this.getSwapExchangeRate(0, assetAmount);
    return (exchangeRate * assetAmount * FEE_PERCENTAGE) / (RATIO * 100);
  }

  getAlgosToAssetFee(algosAmount) {
    const exchangeRate = this.getSwapExchangeRate(algosAmount, 0);
    return (algosAmount * FEE_PERCENTAGE * RATIO) / 100 / exchangeRate;
  }

  reverseAssetToAlgos(algosAmount) {
    const value = Math.ceil(
      Math.trunc(-100 * algosAmount * this.globalAssetAmount * RATIO) /
      ((100 * algosAmount) + (this.globalAlgosAmount * (FEE_PERCENTAGE - 100))) /
      RATIO
    );
    if (value < 0) {
      return this.reverseAssetToAlgos(
        Math.ceil(
          Math.abs((this.globalAlgosAmount - 1) * (FEE_PERCENTAGE - 100)) / 100
        )
      );
    }
    return value;
  }

  reverseAlgosToAsset(assetAmount) {
    const value = Math.ceil(
      Math.trunc((-100 * assetAmount * this.globalAlgosAmount) * RATIO) /
      ((100 * assetAmount) + (this.globalAssetAmount * (FEE_PERCENTAGE - 100))) /
      RATIO
    );
    if (value < 0) {
      return this.reverseAlgosToAsset(
        Math.ceil(
          Math.abs((this.globalAssetAmount - 1) * (FEE_PERCENTAGE - 100)) / 100
        )
      );
    }
    return value;
  }
}

import {
  ALGOS_DECIMAL_POINTS,
  ALGOS_RATIO,
  ASSET_DECIMAL_POINTS,
  ASSET_RATIO,
  RATIO_DECIMAL_POINTS
} from '@/config';

function toFixed(num, fixed) {
  return Number((Math.floor(num * Math.pow(10, fixed)) / Math.pow(10, fixed)).toFixed(fixed));
}

export function getMicroAlgos(algos) {
  return Math.trunc(Number(algos) * ALGOS_RATIO);
}

export function getAlgos(microAlgos, ratioDecimals=false) {
  let decimals = ALGOS_DECIMAL_POINTS;
  if (ratioDecimals) {
    decimals = RATIO_DECIMAL_POINTS;
  }
  return toFixed((Number(microAlgos) / ALGOS_RATIO), decimals);
}

export function getRawAssetAmount(displayAmount) {
  return Math.trunc(Number(displayAmount) * ASSET_RATIO);
}

export function getAssetDisplayAmount(rawAmount, ratioDecimals=false) {
  let decimals = ASSET_DECIMAL_POINTS;
  if (ratioDecimals) {
    decimals = RATIO_DECIMAL_POINTS;
  }
  return toFixed((Number(rawAmount) / ASSET_RATIO), decimals);
}

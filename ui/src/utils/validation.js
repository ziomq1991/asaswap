export function getInputError(value, decimalPoints, assetName) {
  if (Number(value) <= 0) {
    return 'Enter a valid amount';
  }
  if (Number(value).toFixed(decimalPoints) != Number(value)) {
    if (decimalPoints) {
      return `${assetName} has ${decimalPoints} decimal points`;
    } else {
      return `${assetName} does not have decimal points`;
    }
  }
  return null;
}

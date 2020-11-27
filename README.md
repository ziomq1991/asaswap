# ASASwap

Smart Contract for creating decentralized exchange based on Constant Product Market Maker.
It is Algorand's equivalent to Ethereum's Uniswap protocol.

## Main functionalities

### Adding liquidity
When user wants to add liquidity he needs to perform 3 transactions group, including call to stateful
contract, sending ASA tokens and sending Algos. To avoid transactions getting rejected constantly when they
don't match current ratio, there is a 1% tolerance of ratio difference.

### Removing liquidity
On removing liquidity, user sends a call to stateful contract declaring he wants to burn x liquidity tokens and
gain calculated ASA tokens and Algos from them. The calculated amount of ASA tokens and Algos are saved in
users local data and can be withdrawn.

### Swap
Swapping is performed by calling stateful contract in group with payment transaction to escrow with
desired amount of ASA tokens/Algos. The amount of ASA tokens/Algos to withdraw is then calculated based on
simple calculation: `(amount sent - 3% fee) * current ratio`.

### Withdrawal
After swapping or removing liquidity in exchange for ASA tokens/Algos the money that user can withdraw is
saved in users local data. He can then perform a `WITHDRAW` call to app along with transaction that
sends the money from escrow to user.


## Instalation

Requires Python3 and Poetry.

```bash
poetry install
poetry shell
make contracts
```

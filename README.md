## Main functionalities

### Adding liquidity
When user wants to add liquidity he needs to perform 3 transactions group, including call to stateful
contract, sending tokens and sending algos. To avoid transactions getting rejected constantly when they
don't match current ratio, there is a 1% tolerance for ratio difference. 

### Removing liquidity
On removing liquidity, user sends a call to stateful contract declaring he wants to burn x tokens and 
gain calculated tokens and algos from them. The calculated amount of tokens and algos are saved in 
users local data and can be withdrawn.

### Swap
Swapping is performed by calling stateful contract in group with payment transaction to escrow with 
desired amount of tokens/algos. The amount of tokens/algos to withdraw is then calculated based on 
simple calculation: `(amount sent - 0.3% fee) * current ratio`.

### Withdrawal
After swapping or removing liquidity in exchange for tokens/algos the money that user can withdraw is 
saved in users local data. He can then perform a `WITHDRAW` call to app along with transaction that
sends the money from escrow to user. 

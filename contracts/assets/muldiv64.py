from pyteal import *
from helpers.state import GlobalState, GlobalStateEx

class MulDiv64:
    def __init__(self):
        # load globals from foreign app
        # id = 1 means the first foreign app
        self.total_liquidity_tokens = GlobalStateEx("L", 1)  # uint64
        self.a_balance = GlobalStateEx("A", 1)  # uint64
        self.b_balance = GlobalStateEx("B", 1)  # uint64
        self.multiplier1 = ScratchSlot()
        self.multiplier2 = ScratchSlot()
        self.divisor = ScratchSlot()
        self.result = GlobalState("R") # uint64

    def get_contract(self):
        return Seq([
            Cond([
                [Txn.application_args[0] == Bytes("L"), self.setup_liquidity_calculation()],
                [Txn.application_args[0] == Bytes("A"), self.setup_swap_a_calculation()]
            ]),
            self.result.put(self.calculate()),
        ])
    
    def calculate(self) -> Expr:
        """
        Precisely calculate multiplication and then division of three uint64 variables.
        Returns:
            PyTEAL Expr which calculates (multiplier1 * multiplier2) / divisor
        """
        return Err

    def setup_liquidity_calculation(self) -> Expr:
        """
        Store received amount of primary asset (a), total primary asset balance (A), and total pool token balance (PT).
        a, PT: multipliers
        A: divisor
        """
        return Seq([
            # store amount of transfered primary asset
            self.multiplier1.store(Gtxn[2].asset_amount()),
            self.multiplier2.store(self.total_liquidity_tokens.get()),
            self.divisor.store(self.a_balance.get()),
        ])

    def setup_swap_a_calculation(self) -> Expr:
        """
        Setup calculation for swapping primary asset to secondary asset. (B/A * a) 
        Store received amount of primary asset (a), total primary asset balance (A), and total secondary asset balance (B).
        a, B: multipliers
        A: divisor
        """
        return Seq([
            self.multiplier1.store(Gtxn[1].asset_amount),
            self.multiplier2.store(self.b_balance.get()),
            self.divisor.store(self.a_balance.get()),
        ])
# pylint: disable=unused-wildcard-import
from pyteal import *
# pylint: disable=import-error
from helpers.state import GlobalState


class Guard:
    """
    The Guard contract is intended to perform assertions about ongoing contract interactions.
    The intent is to provide other contracts (mainly muldiv64) with more space to perform their primary task.
    Muldiv64 only needs to assert that the first transaction in the group is an app call to the Guard contract
    """
    def __init__(self):
        self.creator_addr = GlobalState("C")
        self.escrow_addr = GlobalState("E")
        self.mul_div_app_ID = GlobalState("W")
        self.main_app_ID = GlobalState("M")

    def get_contract(self) -> Expr:
        return Cond(
            [
                Txn.application_id() == Int(0), 
                self.on_create()
            ],
        )

    def on_create(self) -> Seq:
        return Seq([
            self.creator_addr.put(Txn.sender()),
            Return(Int(1)),
        ])

if __name__ == "__main__":
    print(compileTeal(Guard().get_contract(), Mode.Application))

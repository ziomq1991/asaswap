from pyteal import *

from helpers.state import GlobalState, LocalState


def clear():
    GLOBAL_LIQ_TOKENS = GlobalState("LIQ")
    ALGOS_BALANCE = GlobalState("A")
    TOKENS_BALANCE = GlobalState("B")
    ALGOS_TO_WITHDRAW = LocalState("USR_A")
    TOKENS_TO_WITHDRAW = LocalState("USR_B")
    USR_LIQ_TOKENS = LocalState("USR_LIQ")

    return Seq(
        [
            GLOBAL_LIQ_TOKENS.put(GLOBAL_LIQ_TOKENS.get() - USR_LIQ_TOKENS.get()),
            ALGOS_BALANCE.put(ALGOS_BALANCE.get() + ALGOS_TO_WITHDRAW.get()),
            TOKENS_BALANCE.put(TOKENS_BALANCE.get() + TOKENS_TO_WITHDRAW.get()),
        ]
    )


if __name__ == "__main__":
    print(compileTeal(clear(), Mode.Application))

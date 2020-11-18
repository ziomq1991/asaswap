from pyteal import *
from state import GlobalState, LocalState


def state(ratio_decimal_points):
    # Exchange rate decimal points
    ratio_decimal_points = Int(ratio_decimal_points)

    # globals
    TOTAL_LIQUIDITY_TOKENS = GlobalState('TOTAL_LIQUIDITY_TOKENS')
    ALGOS_BALANCE = GlobalState('ALGOS_BALANCE')
    TOKENS_BALANCE = GlobalState('TOKENS_BALANCE')
    # exchange rate, always as ASA:ALGOS and in ratio_decimal_points precision
    EXCHANGE_RATE = GlobalState('EXCHANGE_RATE')
    ESCROW_ADDR = GlobalState('ESCROW_ADDR')
    CREATOR_ADDR = GlobalState('CREATOR_ADDR')
    # locals
    ALGOS_TO_WITHDRAW = LocalState('ALGOS_TO_WITHDRAW')
    TOKENS_TO_WITHDRAW = LocalState('TOKENS_TO_WITHDRAW')
    USER_LIQUIDITY_TOKENS = LocalState('USER_LIQUIDITY_TOKENS')

    is_creator = Txn.sender() == CREATOR_ADDR.get()

    tx_ratio = Gtxn[1].asset_amount() * ratio_decimal_points / Gtxn[2].amount()
    liquidity_calc = Gtxn[2].amount() * TOTAL_LIQUIDITY_TOKENS.get() / ALGOS_BALANCE.get()
    algos_calc = ALGOS_BALANCE.get() * USER_LIQUIDITY_TOKENS.get() / TOTAL_LIQUIDITY_TOKENS.get()
    token_calc = TOKENS_BALANCE.get() * USER_LIQUIDITY_TOKENS.get() / TOTAL_LIQUIDITY_TOKENS.get()

    on_create = Seq([
        TOKENS_BALANCE.put(Int(0)),
        ALGOS_BALANCE.put(Int(0)),
        TOTAL_LIQUIDITY_TOKENS.put(Int(0)),
        CREATOR_ADDR.put(Txn.sender()),
        Return(Int(1))
    ])

    on_update = Seq([
        # Update escrow address after creating it
        Assert(And(
            is_creator,
            Txn.application_args.length() == Int(2),
        )),
        ESCROW_ADDR.put(Txn.application_args[1]),
        Return(Int(1))
    ])

    on_register = Seq([
        # Set default values for user
        TOKENS_TO_WITHDRAW.put(Int(0)),
        ALGOS_TO_WITHDRAW.put(Int(0)),
        USER_LIQUIDITY_TOKENS.put(Int(0)),
        Return(Int(1))
    ])

    on_add_liquidity = Seq([
        Assert(And(
            Global.group_size() == Int(3),
            Gtxn[0].type_enum() == TxnType.ApplicationCall,
            Gtxn[1].type_enum() == TxnType.AssetTransfer,
            Gtxn[2].type_enum() == TxnType.Payment,
            Gtxn[1].asset_receiver() == ESCROW_ADDR.get(),
            Gtxn[2].receiver() == ESCROW_ADDR.get(),
        )),
        If(
            # Check if transactions exchange rate matches or is max 1% different from current
            EXCHANGE_RATE.get() > tx_ratio,
            Assert(EXCHANGE_RATE.get() - tx_ratio * ratio_decimal_points / EXCHANGE_RATE.get() < Int(10000)),
            Assert(tx_ratio - EXCHANGE_RATE.get() * ratio_decimal_points / EXCHANGE_RATE.get() < Int(10000))
        ),
        If(
            # If its first transaction then add tokens directly from txn amount, else based on calculations
            TOTAL_LIQUIDITY_TOKENS.get() == Int(0),
            Seq([
                USER_LIQUIDITY_TOKENS.put(Gtxn[2].amount()),
                TOTAL_LIQUIDITY_TOKENS.put(Gtxn[2].amount()),
            ]),
            Seq([
                USER_LIQUIDITY_TOKENS.put(USER_LIQUIDITY_TOKENS.get() + liquidity_calc),
                TOTAL_LIQUIDITY_TOKENS.put(TOTAL_LIQUIDITY_TOKENS.get() + liquidity_calc),
            ])
        ),
        TOKENS_BALANCE.put(TOKENS_BALANCE.get() + Gtxn[1].asset_amount()),
        ALGOS_BALANCE.put(ALGOS_BALANCE.get() + Gtxn[2].amount()),
        EXCHANGE_RATE.put(ALGOS_BALANCE.get() * ratio_decimal_points / TOKENS_BALANCE.get()),
        Return(Int(1))
    ])

    on_remove_liquidity = Seq([
        Assert(And(
            Global.group_size() == Int(1),
            Txn.application_args.length() == Int(2),
            USER_LIQUIDITY_TOKENS.get() >= Btoi(Txn.application_args[1]),
            ALGOS_BALANCE.get() > algos_calc,
            TOKENS_BALANCE.get() > token_calc,
        )),
        ALGOS_TO_WITHDRAW.put(algos_calc),
        TOKENS_TO_WITHDRAW.put(token_calc),
        ALGOS_BALANCE.put(ALGOS_BALANCE.get() - algos_calc),
        TOKENS_BALANCE.put(TOKENS_BALANCE.get() - token_calc),
        EXCHANGE_RATE.put(ALGOS_BALANCE.get() * ratio_decimal_points / TOKENS_BALANCE.get()),
        Return(Int(1))
    ])

    on_swap = Seq([
        Assert(And(
            Global.group_size() == Int(2),
            Gtxn[0].type_enum() == TxnType.ApplicationCall,
        )),
        Cond(
            [
                Gtxn[1].type_enum() == TxnType.AssetTransfer,
                Seq([
                    Assert(Gtxn[1].asset_receiver() == ESCROW_ADDR.get()),
                    TOKENS_BALANCE.put(TOKENS_BALANCE.get() + Gtxn[1].asset_amount()),
                    ALGOS_TO_WITHDRAW.put(
                        (EXCHANGE_RATE.get() * (Gtxn[1].asset_amount() * Int(100) / Int(103)))
                        / ratio_decimal_points
                    ),
                    ALGOS_BALANCE.put(ALGOS_BALANCE.get() - ALGOS_TO_WITHDRAW.get()),
                ])
            ],
            [
                Gtxn[1].type_enum() == TxnType.Payment,
                Seq([
                    Assert(Gtxn[1].receiver() == ESCROW_ADDR.get()),
                    ALGOS_BALANCE.put(ALGOS_BALANCE.get() + Gtxn[1].amount()),
                    TOKENS_TO_WITHDRAW.put(
                        (Gtxn[1].amount() * Int(100) / Int(103))
                        * ratio_decimal_points / EXCHANGE_RATE.get()
                    ),
                    TOKENS_BALANCE.put(TOKENS_BALANCE.get() - TOKENS_TO_WITHDRAW.get()),
                ])
            ]
        ),
        EXCHANGE_RATE.put(TOKENS_BALANCE.get() * ratio_decimal_points / ALGOS_BALANCE.get()),
        Return(Int(1))
    ])

    on_withdraw = Seq([
        Assert(Global.group_size() == Int(2)),
        Cond(
            [
                Gtxn[1].type_enum() == TxnType.AssetTransfer,
                Seq([
                    Assert(And(
                        Gtxn[1].asset_amount() == TOKENS_TO_WITHDRAW.get(),
                        Gtxn[1].asset_sender() == ESCROW_ADDR.get(),
                    )),
                    TOKENS_TO_WITHDRAW.put(Int(0)),
                ])
            ],
            [
                Gtxn[1].type_enum() == TxnType.Payment,
                Seq([
                    Assert(And(
                        Gtxn[1].amount() == ALGOS_TO_WITHDRAW.get(),
                        Gtxn[1].sender() == ESCROW_ADDR.get(),
                    )),
                    ALGOS_TO_WITHDRAW.put(Int(0)),
                ]),
            ]
        ),
        # Remove 1000 Algos that is taken as a fee
        ALGOS_BALANCE.put(ALGOS_BALANCE.get() - Int(1000)),
        EXCHANGE_RATE.put(TOKENS_BALANCE.get() * ratio_decimal_points / ALGOS_BALANCE.get()),
        Return(Int(1))
    ])

    return Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(is_creator)],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(is_creator)],
        [Txn.on_completion() == OnComplete.OptIn, on_register],
        [Txn.application_args[0] == Bytes('UPDATE'), on_update],
        [Txn.application_args[0] == Bytes('ADD_LIQUIDITY'), on_add_liquidity],
        [Txn.application_args[0] == Bytes('REMOVE_LIQUIDITY'), on_remove_liquidity],
        [Txn.application_args[0] == Bytes('SWAP'), on_swap],
        [Txn.application_args[0] == Bytes('WITHDRAW'), on_withdraw]
    )


def clear():
    ALGOS_TO_WITHDRAW = LocalState('ALGOS_TO_WITHDRAW')
    TOKENS_TO_WITHDRAW = LocalState('TOKENS_TO_WITHDRAW')
    USER_LIQUIDITY_TOKENS = LocalState('USER_LIQUIDITY_TOKENS')
    # Refuse to clear users state if he still has money to withdraw or liquidity tokens
    return And(
        TOKENS_TO_WITHDRAW.get() == Int(0),
        ALGOS_TO_WITHDRAW.get() == Int(0),
        USER_LIQUIDITY_TOKENS.get() == Int(0),
    )


def escrow(app_id):
    on_asset_opt_in = And(
        Global.group_size() == Int(1),
        Txn.type_enum() == TxnType.AssetTransfer,
        Txn.asset_amount() == Int(0)
    )

    on_withdraw = And(
        Global.group_size() == Int(2),
        Gtxn[0].application_id() == Int(app_id),
        Gtxn[0].type_enum() == TxnType.ApplicationCall,
        Or(
            Gtxn[1].type_enum() == TxnType.AssetTransfer,
            Gtxn[1].type_enum() == TxnType.Payment,
        )
    )

    return Or(
        on_asset_opt_in,
        on_withdraw
    )


with open('state.teal', 'w') as f:
    state_teal = compileTeal(state(1000000), Mode.Application)
    f.write(state_teal)

with open('clear.teal', 'w') as f:
    clear_teal = compileTeal(clear(), Mode.Application)
    f.write(clear_teal)

with open('escrow.teal', 'w') as f:
    escrow_teal = compileTeal(escrow(123), Mode.Signature)
    f.write(escrow_teal)

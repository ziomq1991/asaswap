from pyteal import *


def state(decimal_points):
    decimal_points = Int(decimal_points)

    is_creator = Txn.sender() == App.globalGet(Bytes('CREATOR'))

    on_create = Seq([
        App.globalPut(Bytes('USDC_LIQUIDITY'), Int(0)),
        App.globalPut(Bytes('ALGOS_LIQUIDITY'), Int(0)),
        App.globalPut(Bytes('TOTAL_LIQUIDITY_TOKENS'), Int(0)),
        App.globalPut(Bytes('CREATOR'), Txn.sender()),
        Return(Int(1))
    ])

    on_update = Seq([
        Assert(And(
            is_creator,
            Txn.application_args.length() == Int(1),
        )),
        App.globalPut(Bytes('ESCROW'), Txn.application_args[0]),
        Return(Int(1))
    ])

    on_register = Seq([
        App.localPut(Int(0), Bytes('USER_USDC_LIQUIDITY'), Int(0)),
        App.localPut(Int(0), Bytes('USER_ALGOS_LIQUIDITY'), Int(0)),
        App.localPut(Int(0), Bytes('USDC_TO_WITHDRAW'), Int(0)),
        App.localPut(Int(0), Bytes('ALGOS_TO_WITHDRAW'), Int(0)),
        Return(Int(1))
    ])

    on_add_liquidity = Seq([
        Assert(And(
            Global.group_size() == Int(3),
            Gtxn[0].type_enum() == TxnType.ApplicationCall,
            Gtxn[1].type_enum() == TxnType.AssetTransfer,
            Gtxn[2].type_enum() == TxnType.Payment,
            Gtxn[2].amount() * decimal_points / Gtxn[1].asset_amount() == App.globalGet(Bytes('EXCHANGE_RATE')),
        )),
        App.localPut(
            Int(0),
            Bytes('USER_USDC_LIQUIDITY'),
            App.localGet(Int(0), Bytes('USDC_LIQUIDITY')) + Gtxn[1].asset_amount()
        ),
        App.localPut(
            Int(0),
            Bytes('USER_ALGOS_LIQUIDITY'),
            App.localGet(Int(0), Bytes('ALGOS_LIQUIDITY')) + Gtxn[2].amount()
        ),
        App.globalPut(
            Bytes('USDC_LIQUIDITY'),
            App.globalGet(Bytes('USDC_LIQUIDITY')) + Gtxn[1].asset_amount()
        ),
        App.globalPut(
            Bytes('ALGOS_LIQUIDITY'),
            App.globalGet(Bytes('ALGOS_LIQUIDITY')) + Gtxn[2].amount()
        ),
        App.globalPut(
            Bytes('EXCHANGE_RATE'),
            App.globalGet(Bytes('ALGOS_LIQUIDITY')) * decimal_points / App.globalGet(Bytes('USDC_LIQUIDITY'))
        ),
        Return(Int(1))
    ])

    on_remove_liquidity = Seq([
        Assert(And(
            Global.group_size() == Int(3),
            Gtxn[0].type_enum() == TxnType.ApplicationCall,
            Gtxn[1].type_enum() == TxnType.AssetTransfer,
            Gtxn[2].type_enum() == TxnType.Payment,
            Gtxn[1].asset_amount() >= App.localGet(Int(0), Bytes('USER_USDC_LIQUIDITY')),
            Gtxn[2].amount() >= App.localGet(Int(0), Bytes('USER_ALGOS_LIQUIDITY')),
            Gtxn[2].amount() * decimal_points / Gtxn[1].asset_amount() == App.globalGet(Bytes('EXCHANGE_RATE')),
        )),
        App.localPut(
            Int(0),
            Bytes('USER_USDC_LIQUIDITY'),
            App.localGet(Int(0), Bytes('USER_USDC_LIQUIDITY')) - Gtxn[1].asset_amount()
        ),
        App.localPut(
            Int(0),
            Bytes('USER_ALGOS_LIQUIDITY'),
            App.localGet(Int(0), Bytes('USER_ALGOS_LIQUIDITY')) - Gtxn[2].amount()
        ),
        App.globalPut(
            Bytes('USDC_LIQUIDITY'),
            App.globalGet(Bytes('USDC_LIQUIDITY')) - Gtxn[1].asset_amount()
        ),
        App.globalPut(
            Bytes('ALGOS_LIQUIDITY'),
            App.globalGet(Bytes('ALGOS_LIQUIDITY')) - Gtxn[2].amount()
        ),
        App.globalPut(
            Bytes('EXCHANGE_RATE'),
            App.globalGet(Bytes('ALGOS_LIQUIDITY')) * decimal_points / App.globalGet(Bytes('USDC_LIQUIDITY'))
        ),
        Return(Int(1))
    ])

    on_swap = Seq([
        Assert(And(
            Global.group_size() == Int(2),
            Gtxn[0].type_enum() == TxnType.ApplicationCall,
            Or(
                Gtxn[1].asset_receiver() == App.globalGet(Bytes('ESCROW')),
                Gtxn[1].receiver() == App.globalGet(Bytes('ESCROW'))
            ),
        )),
        If(
            And(
                Gtxn[1].type_enum() == TxnType.AssetTransfer,
                Gtxn[1].asset_receiver() == App.globalGet(Bytes('ESCROW')),
            ),
            Seq([
                App.globalPut(
                    Bytes('USDC_LIQUIDITY'),
                    App.globalGet(Bytes('USDC_LIQUIDITY')) + Gtxn[1].asset_amount()
                ),
                App.localPut(
                    Int(0),
                    Bytes('ALGOS_TO_WITHDRAW'),
                    (App.globalGet(Bytes('EXCHANGE_RATE'))
                     * (Gtxn[1].asset_amount() * Int(100) / Int(103)))
                    / decimal_points
                ),
                App.globalPut(
                    Bytes('ALGOS_LIQUIDITY'),
                    App.globalGet(Bytes('ALGOS_LIQUIDITY')) - App.localGet(Int(0), Bytes('ALGOS_TO_WITHDRAW'))
                ),
            ]),
            If(
                And(
                    Gtxn[1].type_enum() == TxnType.Payment,
                    Gtxn[1].receiver() == App.globalGet(Bytes('ESCROW')),
                ),
                Seq([
                    App.globalPut(
                        Bytes('ALGOS_LIQUIDITY'),
                        App.globalGet(Bytes('ALGOS_LIQUIDITY')) + Gtxn[1].amount()
                    ),
                    App.localPut(
                        Int(0),
                        Bytes('USDC_TO_WITHDRAW'),
                        (Gtxn[1].amount() * Int(100) / Int(103)) * decimal_points / App.globalGet(
                            Bytes('EXCHANGE_RATE'))
                    ),
                    App.globalPut(
                        Bytes('USDC_LIQUIDITY'),
                        App.globalGet(Bytes('USDC_LIQUIDITY')) - App.localGet(Int(0), Bytes('USDC_TO_WITHDRAW'))
                    ),
                ]),
                Return(Int(0))
            )
        ),
        App.globalPut(
            Bytes('EXCHANGE_RATE'),
            (App.globalGet(Bytes('USDC_LIQUIDITY')) * decimal_points / App.globalGet(Bytes('ALGOS_LIQUIDITY')))
        ),
        Return(Int(1))
    ])

    on_withdraw = Seq([
        Assert(
            Global.group_size() == Int(2),
        ),
        If(
            Gtxn[1].type_enum() == TxnType.AssetTransfer,
            Seq([
                Assert(Gtxn[1].asset_amount() == App.localGet(Int(0), Bytes('USDC_TO_WITHDRAW'))),
                App.localPut(Int(0), Bytes('USDC_TO_WITHDRAW'), Int(0))
            ]),
            If(
                Gtxn[1].type_enum() == TxnType.Payment,
                Seq([
                    Assert(Gtxn[1].amount() == App.localGet(Int(0), Bytes('ALGOS_TO_WITHDRAW'))),
                    App.localPut(Int(0), Bytes('ALGOS_TO_WITHDRAW'), Int(0))
                ]),
                Return(Int(0))
            )
        ),
        Return(Int(1))
    ])

    return Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.UpdateApplication, on_update],
        [Txn.on_completion() == OnComplete.OptIn, on_register],
        [Txn.application_args[0] == Bytes('ADD_LIQUIDITY'), on_add_liquidity],
        [Txn.application_args[0] == Bytes('REMOVE_LIQUIDITY'), on_remove_liquidity],
        [Txn.application_args[0] == Bytes('SWAP'), on_swap],
        [Txn.application_args[0] == Bytes('WITHDRAW'), on_withdraw]
    )


def escrow(app_id):
    return If(
        And(
            Global.group_size() == Int(2),
            Gtxn[0].application_id() == app_id,
            Gtxn[0].type_enum() == TxnType.ApplicationCall,
            Or(
                Gtxn[1].type_enum() == TxnType.AssetTransfer,
                Gtxn[1].type_enum() == TxnType.Payment,
            )
        ),
        Return(Int(1))
    )


with open('state.teal', 'w') as f:
    compiled_gig = compileTeal(state(1000000), Mode.Application)
    f.write(compiled_gig)

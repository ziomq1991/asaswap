from pyteal import *


def state():

    is_creator = Txn.sender() == App.globalGet(Bytes('CREATOR'))

    on_create = Seq([
        App.globalPut(Bytes('USDC_LIQUIDITY'), Int(0)),
        App.globalPut(Bytes('ALGOS_LIQUIDITY'), Int(0)),
        App.globalPut(Bytes('CREATOR'), Txn.sender())
    ])

    on_update = Seq([
        Assert(And(
            is_creator,
            Txn.application_args.length() == Int(1),
        )),
        App.globalPut(Bytes('ESCROW'), Txn.application_args[0]),
    ])

    on_register = Seq([
        App.localPut(Int(0), Bytes('USER_USDC_LIQUIDITY'), Int(0)),
        App.localPut(Int(0), Bytes('USER_ALGOS_LIQUIDITY'), Int(0)),
    ])

    on_add_liquidity = Seq([
        Assert(And(
            Global.group_size() == Int(3),
            Gtxn[0].type_enum() == TxnType.ApplicationCall,
            Gtxn[1].type_enum() == TxnType.AssetTransfer,
            Gtxn[2].type_enum() == TxnType.Payment
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
            Bytes('CONSTANT_PRODUCT'),
            App.globalGet(Bytes('USDC_LIQUIDITY')) * App.globalGet(Bytes('ALGOS_LIQUIDITY'))
        ),
        App.globalPut(
            Bytes('EXCHANGE_RATE'),
            App.globalGet(Bytes('USDC_LIQUIDITY')) / App.globalGet(Bytes('ALGOS_LIQUIDITY'))
        )
    ])

    on_remove_liquidity = Seq([
        Assert(And(
            Global.group_size() == Int(3),
            Gtxn[0].type_enum() == TxnType.ApplicationCall,
            Gtxn[1].type_enum() == TxnType.AssetTransfer,
            Gtxn[2].type_enum() == TxnType.Payment,
            Gtxn[1].asset_amount() >= App.localGet(Int(0), Bytes('USER_USDC_LIQUIDITY')),
            Gtxn[2].amount() >= App.localGet(Int(0), Bytes('USER_ALGOS_LIQUIDITY')),
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
            Bytes('CONSTANT_PRODUCT'),
            App.globalGet(Bytes('USDC_LIQUIDITY')) * App.globalGet(Bytes('ALGOS_LIQUIDITY'))
        ),
        App.globalPut(
            Bytes('EXCHANGE_RATE'),
            App.globalGet(Bytes('USDC_LIQUIDITY')) / App.globalGet(Bytes('ALGOS_LIQUIDITY'))
        )
    ])

    on_swap = Seq([
        Assert(And(
            Global.group_size() == Int(3),
            Gtxn[0].type_enum() == TxnType.ApplicationCall,
            Gtxn[1].type_enum() == TxnType.AssetTransfer,
            Gtxn[2].type_enum() == TxnType.Payment,
            Or(
                Gtxn[1].asset_receiver() == App.globalGet(Bytes('ESCROW')),
                Gtxn[2].receiver() == App.globalGet(Bytes('ESCROW'))
            ),
            Gtxn[1].asset_amount() >= App.localGet(Int(0), Bytes('USER_USDC_LIQUIDITY')),
            Gtxn[2].amount() >= App.localGet(Int(0), Bytes('USER_ALGOS_LIQUIDITY')),
            Gtxn[1].asset_amount() / Gtxn[2].amount() == App.globalGet(Bytes('EXCHANGE_RATE'))
        )),
        If(
            Gtxn[1].asset_receiver() == App.globalGet(Bytes('ESCROW')),
            App.globalPut(
                Bytes('USDC_LIQUIDITY'),
                App.globalGet(Bytes('USDC_LIQUIDITY')) + Gtxn[1].asset_amount()
            ),
            App.globalPut(
                Bytes('USDC_LIQUIDITY'),
                App.globalGet(Bytes('USDC_LIQUIDITY')) - Gtxn[1].asset_amount()
            )
        ),
        If(
            Gtxn[2].receiver() == App.globalGet(Bytes('ESCROW')),
            App.globalPut(
                Bytes('ALGOS_LIQUIDITY'),
                App.globalGet(Bytes('ALGOS_LIQUIDITY')) + Gtxn[2].amount()
            ),
            App.globalPut(
                Bytes('ALGOS_LIQUIDITY'),
                App.globalGet(Bytes('ALGOS_LIQUIDITY')) - Gtxn[2].amount()
            )
        ),
        App.globalPut(
            Bytes('EXCHANGE_RATE'),
            App.globalGet(Bytes('USDC_LIQUIDITY')) / App.globalGet(Bytes('ALGOS_LIQUIDITY'))
        )
    ])

    return Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.UpdateApplication, on_update],
        [Txn.on_completion() == OnComplete.OptIn, on_register],
        [Txn.application_args[0] == Bytes('ADD_LIQUIDITY'), on_add_liquidity],
        [Txn.application_args[0] == Bytes('REMOVE_LIQUIDITY'), on_remove_liquidity],
        [Txn.application_args[0] == Bytes('SWAP'), on_swap],
    )


def escrow(app_id):
    return If(
        And(
            Global.group_size() == Int(3),
            Gtxn[0].application_id() == app_id,
            Gtxn[0].type_enum() == TxnType.ApplicationCall,
            Gtxn[1].type_enum() == TxnType.AssetTransfer,
            Gtxn[2].type_enum() == TxnType.Payment,
        ),
        Return(Int(1))
    )

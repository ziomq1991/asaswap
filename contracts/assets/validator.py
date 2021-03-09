import sys
from enum import Enum

from pyteal import *

from helpers.parse import parse_args


class ExchangeType:
    ALGOS_TO_ASA = "ALGOS_TO_ASA"
    ASA_TO_ASA = "ASA_TO_ASA"


class AlgosToAsaContract:
    def __init__(self, ratio_decimal_points: int, fee_pct: int):
        self.ratio_decimal_points = ratio_decimal_points
        self.fee_pct = fee_pct
        self.type = type
        self.sequence = []

    def setup_global_values(self):
        self.a_balance = App.globalGetEx(Int(1), Bytes("A"))
        self.b_balance = App.globalGetEx(Int(1), Bytes("B"))
        self.escrow_addr = App.globalGetEx(Int(1), Bytes("E"))
        self.b_idx = App.globalGetEx(Int(1), Bytes("Y"))
        self.liq_idx = App.globalGetEx(Int(1), Bytes("Z"))
        self.a_to_withdraw = App.localGetEx(Int(0), Int(1), Bytes("1"))
        self.b_to_withdraw = App.localGetEx(Int(0), Int(1), Bytes("2"))
        self.user_liquidity_tokens = App.localGetEx(Int(0), Int(1), Bytes("3"))
        return Seq(
            [
                self.app_id,
                self.a_balance,
                self.b_balance,
                self.escrow_addr,
                self.b_idx,
                self.liq_idx,
                self.a_to_withdraw,
                self.b_to_withdraw,
                self.user_liquidity_tokens,
            ]
        )

    def on_create(self):
        return Return(Int(1))

    def get_contract(self):
        return Seq(
            [
                Cond(
                    [Txn.application_id() == Int(0), self.on_create()],
                    [Txn.on_completion() == OnComplete.OptIn, Return(Int(1))],
                    [
                        Txn.on_completion()
                        == Or(
                            OnComplete.UpdateApplication, OnComplete.DeleteApplication
                        ),
                        Return(Int(0)),
                    ],
                    [
                        Global.group_size() >= Int(2),
                        Seq(
                            [
                                self.setup_global_values(),
                                Cond(
                                    [
                                        Gtxn[1].application_args[0] == Bytes("A"),
                                        self.on_add_liquidity(),
                                    ],
                                    [
                                        Gtxn[1].application_args[0] == Bytes("R"),
                                        self.on_remove_liquidity(),
                                    ],
                                    [
                                        Gtxn[1].application_args[0] == Bytes("S"),
                                        self.on_swap(),
                                    ],
                                    [
                                        Gtxn[1].application_args[0] == Bytes("W"),
                                        self.on_withdraw(),
                                    ],
                                    [
                                        Gtxn[1].application_args[0] == Bytes("X"),
                                        self.on_withdraw_liquidity(),
                                    ],
                                    [
                                        Gtxn[1].application_args[0] == Bytes("Y"),
                                        self.on_deposit_liquidity(),
                                    ],
                                ),
                            ]
                        ),
                    ],
                ),
            ]
        )

    def calculate_exchange_rate(self) -> Expr:
        self.exchange_rate = ScratchSlot()
        return self.exchange_rate.store(
            self.a_balance.value()
            * Int(self.ratio_decimal_points)
            / self.b_balance.value()
        )

    def get_exchange_rate(self, inline=False) -> Expr:
        if inline:
            return (
                self.a_balance.value()
                * Int(self.ratio_decimal_points)
                / self.b_balance.value()
            )
        return self.exchange_rate.load(TealType.uint64)

    def calculate_tx_ratio(self) -> Expr:
        self.tx_ratio = ScratchSlot()
        return self.tx_ratio.store(
            self.get_incoming_amount_for_primary_asset(Gtxn[3])
            * Int(self.ratio_decimal_points)
            / Gtxn[2].asset_amount()
        )

    def get_tx_ratio(self) -> Expr:
        return self.tx_ratio.load(TealType.uint64)

    def get_incoming_amount_for_primary_asset(self, tx) -> Expr:
        return tx.amount()

    def validate_incoming_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.Payment,
            tx.receiver() == self.escrow_addr.value(),
        )

    def on_closeout(self):
        return Assert(
            And(
                self.a_to_withdraw.value() == Int(0),
                self.b_to_withdraw.value() == Int(0),
                self.user_liquidity_tokens.value() == Int(0),
            )
        )

    def on_add_liquidity(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(4),
                        Gtxn[2].type_enum() == TxnType.AssetTransfer,
                        Gtxn[2].asset_receiver() == self.escrow_addr.value(),
                        Gtxn[2].xfer_asset() == self.b_idx.value(),
                        self.validate_incoming_tx_for_primary_asset(Gtxn[3]),
                    )
                ),
                If(
                    And(
                        self.b_balance.value() != Int(0),
                        self.a_balance.value() != Int(0),
                    ),
                    Seq(
                        [
                            self.calculate_exchange_rate(),
                            self.calculate_tx_ratio(),
                            If(
                                # Check if transactions exchange rate matches or is max 1% different from current
                                Ge(self.get_exchange_rate(), self.get_tx_ratio()),
                                Assert(
                                    (self.get_exchange_rate() - self.get_tx_ratio())
                                    * Int(self.ratio_decimal_points)
                                    / self.get_exchange_rate()
                                    < Int(int(0.01 * self.ratio_decimal_points))
                                ),
                                Assert(
                                    (self.get_tx_ratio() - self.get_exchange_rate())
                                    * Int(self.ratio_decimal_points)
                                    / self.get_exchange_rate()
                                    < Int(int(0.01 * self.ratio_decimal_points))
                                ),
                            ),
                        ]
                    ),
                ),
                Return(Int(1)),
            ]
        )

    def on_remove_liquidity(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(2),
                        self.user_liquidity_tokens.value()
                        >= Btoi(Gtxn[1].application_args[1]),
                        self.a_to_withdraw.value() == Int(0),
                        self.b_to_withdraw.value() == Int(0),
                    )
                ),
                Return(Int(1)),
            ]
        )

    def on_withdraw_liquidity(self):
        return Seq(
            [
                Assert(
                    And(
                        Gtxn[2].xfer_asset() == self.liq_idx.value(),
                        Gtxn[2].asset_amount() <= self.user_liquidity_tokens.value(),
                        Gtxn[2].sender() == self.escrow_addr.value(),
                        Gtxn[3].receiver() == self.escrow_addr.value(),
                    )
                ),
                Return(Int(1)),
            ]
        )

    def on_deposit_liquidity(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(3),
                        Gtxn[1].type_enum() == TxnType.ApplicationCall,
                        Gtxn[2].type_enum() == TxnType.AssetTransfer,
                        Gtxn[2].xfer_asset() == self.liq_idx.value(),
                        Gtxn[2].asset_receiver() == self.escrow_addr.value(),
                    )
                ),
                Return(Int(1)),
            ]
        )

    def on_swap(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(3),
                        Gtxn[1].type_enum() == TxnType.ApplicationCall,
                        self.a_to_withdraw.value() == Int(0),
                        self.b_to_withdraw.value() == Int(0),
                    )
                ),
                Return(Int(1)),
            ]
        )

    def on_withdraw(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(5),
                        Gtxn[2].asset_amount() == self.b_to_withdraw.value(),
                        Gtxn[2].sender() == self.escrow_addr.value(),
                        Gtxn[2].xfer_asset() == self.b_idx.value(),
                        self.verify_outgoing_tx_for_primary_asset(Gtxn[3]),
                        self.get_outgoing_amount_for_primary_asset(Gtxn[3])
                        == self.a_to_withdraw.value(),
                        Gtxn[4].receiver() == self.escrow_addr.value(),
                    )
                ),
                Return(Int(1)),
            ]
        )

    def verify_outgoing_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.Payment,
            tx.sender() == self.escrow_addr.value(),
        )

    def get_outgoing_amount_for_primary_asset(self, tx) -> Expr:
        return tx.amount()


class AsaToAsaContract(AlgosToAsaContract):
    def __init__(self, ratio_decimal_points: int, fee_pct: int):
        super().__init__(ratio_decimal_points, fee_pct)

    def get_incoming_amount_for_primary_asset(self, tx) -> Expr:
        return tx.asset_amount()

    def setup_global_values(self):
        self.a_balance = App.globalGetEx(Int(1), Bytes("A"))
        self.b_balance = App.globalGetEx(Int(1), Bytes("B"))
        self.escrow_addr = App.globalGetEx(Int(1), Bytes("E"))
        self.a_idx = App.globalGetEx(Int(1), Bytes("X"))
        self.b_idx = App.globalGetEx(Int(1), Bytes("Y"))
        self.liq_idx = App.globalGetEx(Int(1), Bytes("Z"))
        self.a_to_withdraw = App.localGetEx(Int(0), Int(1), Bytes("1"))
        self.b_to_withdraw = App.localGetEx(Int(0), Int(1), Bytes("2"))
        self.user_liquidity_tokens = App.localGetEx(Int(0), Int(1), Bytes("3"))
        return Seq(
            [
                self.a_balance,
                self.b_balance,
                self.escrow_addr,
                self.a_idx,
                self.b_idx,
                self.liq_idx,
                self.a_to_withdraw,
                self.b_to_withdraw,
                self.user_liquidity_tokens,
            ]
        )

    def validate_incoming_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.AssetTransfer,
            tx.xfer_asset() == self.a_idx.value(),
            tx.asset_receiver() == self.escrow_addr.value(),
        )

    def verify_outgoing_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.AssetTransfer,
            tx.xfer_asset() == self.a_idx.value(),
            tx.sender() == self.escrow_addr.value(),
        )

    def get_outgoing_amount_for_primary_asset(self, tx) -> Expr:
        return tx.asset_amount()


if __name__ == "__main__":
    params = {
        "ratio_decimal_points": 1000000,
        "fee_pct": 3,
        "type": ExchangeType.ALGOS_TO_ASA,
    }

    # Overwrite params if sys.argv[1] is passed
    if len(sys.argv) > 1:
        params = parse_args(sys.argv[1], params)

    if params["type"] == ExchangeType.ALGOS_TO_ASA:
        print(
            compileTeal(
                AlgosToAsaContract(
                    int(params["ratio_decimal_points"]),
                    int(params["fee_pct"]),
                ).get_contract(),
                Mode.Application,
            )
        )
    elif params["type"] == ExchangeType.ASA_TO_ASA:
        print(
            compileTeal(
                AsaToAsaContract(
                    int(params["ratio_decimal_points"]),
                    int(params["fee_pct"]),
                ).get_contract(),
                Mode.Application,
            )
        )

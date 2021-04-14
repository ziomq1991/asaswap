import sys
from enum import Enum

# pylint: disable=unused-wildcard-import
from pyteal import *

# pylint: disable=import-error
from helpers.state import GlobalState, LocalState, get_global_state_ex
from helpers.parse import parse_args


class ExchangeType:
    ALGOS_TO_ASA = "ALGOS_TO_ASA"
    ASA_TO_ASA = "ASA_TO_ASA"


class AlgosToAsaContract:
    def __init__(self, ratio_decimal_points: int, fee_pct: int, muldiv_app_id: int):
        self.ratio_decimal_points = ratio_decimal_points
        self.fee_pct = fee_pct
        self.type = type
        self.muldiv_app_id = muldiv_app_id
        self.setup_globals()
        self.setup_locals()
        self.setup_calculations()

    def setup_globals(self):
        self.total_liquidity_tokens = GlobalState("L")  # uint64
        self.a_balance = GlobalState("A")  # uint64
        self.b_balance = GlobalState("B")  # uint64
        self.escrow_addr = GlobalState("E")  # bytes
        self.creator_addr = GlobalState("C")  # bytes
        self.b_idx = GlobalState("Y")  # uint64
        self.liq_idx = GlobalState("Z")  # uint64
        # External globals
        self.muldiv_result_1 = get_global_state_ex(1, "1")
        self.muldiv_result_2 = get_global_state_ex(1, "2")

    def setup_locals(self):
        self.a_to_withdraw = LocalState("1")  # uint64
        self.b_to_withdraw = LocalState("2")  # uint64
        self.user_liquidity_tokens = LocalState("3")  # uint64

    def get_exchange_rate(self, inline=False) -> Expr:
        assert(inline)
        return (
            self.a_balance.get()
            * Int(self.ratio_decimal_points)
            / self.b_balance.get()
        )

    def calculate_tx_ratio(self) -> Expr:
        self.tx_ratio = ScratchSlot()
        return self.tx_ratio.store(
            self.get_incoming_amount_for_primary_asset(Gtxn[2])
            * Int(self.ratio_decimal_points)
            / Gtxn[1].asset_amount()
        )

    def get_tx_ratio(self) -> Expr:
        return self.tx_ratio.load(TealType.uint64)

    def setup_calculations(self):
        self.a_calc = (
            self.a_balance.get()
            * Btoi(Txn.application_args[1])
            / self.total_liquidity_tokens.get()
        )
        self.b_calc = (
            self.b_balance.get()
            * Btoi(Txn.application_args[1])
            / self.total_liquidity_tokens.get()
        )

    def get_contract(self):
        return Cond(
            [Txn.application_id() == Int(0), self.on_create()],
            [Txn.rekey_to() != Global.zero_address(), Err()],
            [Txn.on_completion() == OnComplete.OptIn, self.on_register()],
            [Txn.on_completion() == OnComplete.CloseOut, self.on_closeout()],
            [Txn.on_completion() != OnComplete.NoOp, Err()], # disallow any other on-complete options
            [Txn.application_args[0] == Bytes("U"), self.on_update()],
            [Txn.application_args[0] == Bytes("A"), self.on_add_liquidity()],
            [Txn.application_args[0] == Bytes("R"), self.on_remove_liquidity()],
            [Txn.application_args[0] == Bytes("S"), self.on_swap()],
            [Txn.application_args[0] == Bytes("W"), self.on_withdraw()],
            [Txn.application_args[0] == Bytes("E"), self.setup_escrow()],
            [Txn.application_args[0] == Bytes("X"), self.on_withdraw_liquidity()],
            [Txn.application_args[0] == Bytes("Y"), self.on_deposit_liquidity()],
        )

    def get_incoming_amount_for_primary_asset(self, tx) -> Expr:
        return tx.amount()

    def validate_incoming_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.Payment,
            tx.receiver() == self.escrow_addr.get(),
        )

    def on_create(self):
        return Seq(
            [
                self.b_idx.put(Btoi(Txn.application_args[0])),
                self.liq_idx.put(Btoi(Txn.application_args[1])),
                self.b_balance.put(Int(0)),
                self.a_balance.put(Int(0)),
                self.total_liquidity_tokens.put(Int(0)),
                self.creator_addr.put(Txn.sender()),
                Return(Int(1)),
            ]
        )

    def on_register(self):
        return Seq(
            [
                # Set default values for user
                self.b_to_withdraw.put(Int(0)),
                self.a_to_withdraw.put(Int(0)),
                self.user_liquidity_tokens.put(Int(0)),
                Return(Int(1)),
            ]
        )

    def on_closeout(self):
        return Seq([
            Assert(
                And(
                    self.b_to_withdraw.get() == Int(0),
                    self.a_to_withdraw.get() == Int(0),
                    self.user_liquidity_tokens.get() == Int(0),
                )
            ),
            Return(Int(1)),
        ])

    def on_update(self):
        return Seq(
            [
                # Update escrow address after creating it
                Assert(
                    And(
                        Txn.sender() == self.creator_addr.get(),
                        self.escrow_addr.get() == Int(0),
                    )
                ),
                self.escrow_addr.put(Txn.accounts[1]),
                Return(Int(1)),
            ]
        )

    def on_add_liquidity(self):
        calculated_lt = self.muldiv_result_1  # how many liquidity tokens user shall receive
        calculated_b = self.muldiv_result_2  # how many secondary tokens user must provide 
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(5),
                        # verify that muldiv contract was supplied as foreign app
                        # so foreign globals come from the right place
                        Txn.applications[1] == Int(self.muldiv_app_id),
                        # verify primary asset transfer
                        self.validate_incoming_tx_for_primary_asset(Gtxn[3]),
                        # verify secondary asset transfer
                        Gtxn[4].type_enum() == TxnType.AssetTransfer,
                        Gtxn[4].asset_receiver() == self.escrow_addr.get(),
                        Gtxn[4].xfer_asset() == self.b_idx.get(),
                        # validate muldiv operations
                        self.validate_muldiv_call(Gtxn[0], "L", "1"),
                        self.validate_muldiv_call(Gtxn[1], "M", "2"),
                    )
                ),
                If(
                    self.total_liquidity_tokens.get() == Int(0),
                    # Handle case when zero liquidity is in the pool
                    Seq([ 
                        self.a_balance.put(self.get_incoming_amount_for_primary_asset(Gtxn[3])),
                        self.b_balance.put(Gtxn[4].asset_amount()),
                        self.user_liquidity_tokens.put(
                            self.get_incoming_amount_for_primary_asset(Gtxn[2])
                        ),
                        self.total_liquidity_tokens.put(
                            self.get_incoming_amount_for_primary_asset(Gtxn[2])
                        ),
                    ]),
                    # Handle case when some liquidity is already present
                    Seq([
                        # eval foreign values
                        calculated_b, 
                        calculated_lt,
                        Assert(
                            And(
                                calculated_b.hasValue(),
                                calculated_lt.hasValue(),
                                # make sure that user provided enough secondary tokens, adequate to current exchange rate
                                calculated_b.value() <= Gtxn[4].asset_amount()
                            )
                        ),
                        self.a_balance.put(
                            self.a_balance.get()
                            + self.get_incoming_amount_for_primary_asset(Gtxn[3])
                        ),
                        self.b_balance.put(
                            self.b_balance.get()
                            + Gtxn[4].asset_amount()
                        ),
                        self.user_liquidity_tokens.put(
                            self.user_liquidity_tokens.get()
                            + calculated_lt.value()
                        ),
                        self.total_liquidity_tokens.put(
                            self.total_liquidity_tokens.get()
                            + calculated_lt.value()
                        ),
                        # if user provided too many secondary tokens, let them refund them
                        self.b_to_withdraw.put(
                            self.b_to_withdraw.get()
                            + (
                                Gtxn[4].asset_amount() 
                                - calculated_b.value()
                            )
                        )
                    ])
                ),
                Return(Int(1)),
            ]
        )

    def on_remove_liquidity(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(1),
                        self.user_liquidity_tokens.get()
                        >= Btoi(Txn.application_args[1]),
                        self.a_to_withdraw.get() == Int(0),
                        self.b_to_withdraw.get() == Int(0),
                    )
                ),
                self.a_to_withdraw.put(self.a_calc),
                self.b_to_withdraw.put(self.b_calc),
                self.user_liquidity_tokens.put(
                    self.user_liquidity_tokens.get() - Btoi(Txn.application_args[1])
                ),
                self.total_liquidity_tokens.put(
                    self.total_liquidity_tokens.get() - Btoi(Txn.application_args[1])
                ),
                self.a_balance.put(self.a_balance.get() - self.a_to_withdraw.get()),
                self.b_balance.put(self.b_balance.get() - self.b_to_withdraw.get()),
                Return(Int(1)),
            ]
        )

    def on_withdraw_liquidity(self):
        return Seq(
            [
                Assert(
                    And(
                        Gtxn[1].xfer_asset() == self.liq_idx.get(),
                        self.user_liquidity_tokens.get() >= Gtxn[1].asset_amount(),
                        Gtxn[1].sender() == self.escrow_addr.get(),
                        Gtxn[2].receiver() == self.escrow_addr.get(),
                    )
                ),
                self.user_liquidity_tokens.put(
                    self.user_liquidity_tokens.get() - Gtxn[1].asset_amount()
                ),
                Return(Int(1)),
            ]
        )

    def on_deposit_liquidity(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(2),
                        Gtxn[0].type_enum() == TxnType.ApplicationCall,
                        Gtxn[1].type_enum() == TxnType.AssetTransfer,
                        Gtxn[1].xfer_asset() == self.liq_idx.get(),
                        Gtxn[1].asset_receiver() == self.escrow_addr.get(),
                    )
                ),
                self.user_liquidity_tokens.put(
                    self.user_liquidity_tokens.get() + Gtxn[1].asset_amount()
                ),
                Return(Int(1)),
            ]
        )

    def on_swap(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(2),
                        Gtxn[0].type_enum() == TxnType.ApplicationCall,
                        self.a_to_withdraw.get() == Int(0),
                        self.b_to_withdraw.get() == Int(0),
                    )
                ),
                Cond(
                    [
                        And(
                            Gtxn[1].type_enum() == TxnType.AssetTransfer,
                            Gtxn[1].xfer_asset() == self.b_idx.get(),
                        ),
                        Seq(
                            [
                                Assert(
                                    Gtxn[1].asset_receiver() == self.escrow_addr.get(),
                                ),
                                self.b_balance.put(
                                    self.b_balance.get() + Gtxn[1].asset_amount()
                                ),
                                self.a_to_withdraw.put(
                                    # Same as (exchange_rate * asset_amount * ((100 - fee_pct)/100)) / ratio_decimal_points
                                    (
                                        self.get_exchange_rate(inline=True)
                                        * Gtxn[1].asset_amount()
                                        * Int(100 - self.fee_pct)
                                    )
                                    / Int(self.ratio_decimal_points)
                                    / Int(100)
                                ),
                                self.a_balance.put(
                                    self.a_balance.get() - self.a_to_withdraw.get()
                                ),
                            ]
                        ),
                    ],
                    [
                        self.validate_incoming_tx_for_primary_asset(Gtxn[1]),
                        Seq(
                            [
                                self.a_balance.put(
                                    self.a_balance.get()
                                    + self.get_incoming_amount_for_primary_asset(
                                        Gtxn[1]
                                    )
                                ),
                                self.b_to_withdraw.put(
                                    (
                                        self.get_incoming_amount_for_primary_asset(
                                            Gtxn[1]
                                        )
                                        * Int(100 - self.fee_pct)
                                    )
                                    * Int(self.ratio_decimal_points)
                                    / Int(100)
                                    / self.get_exchange_rate(inline=True)
                                ),
                                self.b_balance.put(
                                    self.b_balance.get() - self.b_to_withdraw.get()
                                ),
                            ]
                        ),
                    ],
                ),
                Return(Int(1)),
            ]
        )

    def on_withdraw(self):
        return Seq(
            [
                Assert(
                    And(
                        Global.group_size() == Int(4),
                        Gtxn[1].asset_amount() == self.b_to_withdraw.get(),
                        Gtxn[1].sender() == self.escrow_addr.get(),
                        Gtxn[1].xfer_asset() == self.b_idx.get(),
                        self.verify_outgoing_tx_for_primary_asset(Gtxn[2]),
                        self.get_outgoing_amount_for_primary_asset(Gtxn[2])
                        == self.a_to_withdraw.get(),
                        Gtxn[3].receiver() == self.escrow_addr.get(),
                    )
                ),
                self.b_to_withdraw.put(Int(0)),
                self.a_to_withdraw.put(Int(0)),
                Return(Int(1)),
            ]
        )

    def verify_outgoing_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.Payment,
            tx.sender() == self.escrow_addr.get(),
        )

    def validate_muldiv_call(self, tx: TxnObject, expected_mode: str, expected_dest: str) -> Expr:
        return And(
            # check if correct parameters were passed to muldiv
            tx.application_args[0] == Bytes(expected_mode),
            tx.application_args[1] == Bytes(expected_dest),
            # check if the muldiv contract was actually called
            tx.application_id() == Int(self.muldiv_app_id),
            # make sure that this application is provided as a foreign app to muldiv
            tx.applications[1] == Global.current_application_id(),
        )

    def get_outgoing_amount_for_primary_asset(self, tx) -> Expr:
        return tx.amount()

    def setup_escrow(self):
        return Seq(
            [
                Assert(
                    And(
                        Gtxn[0].sender() == self.creator_addr.get(),
                        self.escrow_addr.get() == Int(0),
                    )
                ),
                Return(Int(1)),
            ]
        )


class AsaToAsaContract(AlgosToAsaContract):
    def __init__(self, ratio_decimal_points: int, fee_pct: int, muldiv_app_id: int):
        super().__init__(ratio_decimal_points, fee_pct, muldiv_app_id)
        self.a_idx = GlobalState("X")  # uint64

    def get_incoming_amount_for_primary_asset(self, tx) -> Expr:
        return tx.asset_amount()

    def validate_incoming_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.AssetTransfer,
            tx.xfer_asset() == self.a_idx.get(),
            tx.asset_receiver() == self.escrow_addr.get(),
        )

    def verify_outgoing_tx_for_primary_asset(self, tx):
        return And(
            tx.type_enum() == TxnType.AssetTransfer,
            tx.xfer_asset() == self.a_idx.get(),
            tx.sender() == self.escrow_addr.get(),
        )

    def get_outgoing_amount_for_primary_asset(self, tx) -> Expr:
        return tx.asset_amount()

    def on_create(self):
        return Seq(
            [
                self.b_idx.put(Btoi(Txn.application_args[0])),
                self.a_idx.put(Btoi(Txn.application_args[1])),
                self.liq_idx.put(Btoi(Txn.application_args[2])),
                self.b_balance.put(Int(0)),
                self.a_balance.put(Int(0)),
                self.total_liquidity_tokens.put(Int(0)),
                self.creator_addr.put(Txn.sender()),
                Return(Int(1)),
            ]
        )


if __name__ == "__main__":
    params = {
        "ratio_decimal_points": 1000000,
        "fee_pct": 3,
        "type": ExchangeType.ALGOS_TO_ASA,
        "muldiv_app_id": 10
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
                    int(params["muldiv_app_id"]),
                ).get_contract(),
                Mode.Application,
                version=3,
            )
        )
    elif params["type"] == ExchangeType.ASA_TO_ASA:
        print(
            compileTeal(
                AsaToAsaContract(
                    int(params["ratio_decimal_points"]),
                    int(params["fee_pct"]),
                    int(params["muldiv_app_id"]),
                ).get_contract(),
                Mode.Application,
                version=3,
            )
        )

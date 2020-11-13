from pyteal import *
from algosdk.future import transaction
from algosdk.account import generate_account

from asaswap import escrow
from utils import client, compile_program, wait_for_confirmation, suggested_params

priv_key, sender = generate_account()
priv_key2, sender2 = generate_account()
asset_index = 'idx'

# Create App
create_app = transaction.ApplicationCreateTxn(
    sender,
    suggested_params,
    transaction.OnComplete.NoOpOC.real,
    compile_program(client, open('state.teal', 'rb').read()),
    compile_program(client, open('clear.teal', 'rb').read()),
    transaction.StateSchema(num_byte_slices=2, num_uints=4),
    transaction.StateSchema(num_byte_slices=0, num_uints=3),
)

signed_txn = create_app.sign(priv_key)
tx_id = signed_txn.transaction.get_txid()

client.send_transactions([signed_txn])

wait_for_confirmation(client, tx_id)

transaction_response = client.pending_transaction_info(tx_id)
app_id = transaction_response['application-index']

# Create Escrow
with open('escrow.teal', 'w') as f:
    compiled_gig = compileTeal(escrow(app_id), Mode.Signature)
    f.write(compiled_gig)

compile_response = client.compile(open('escrow.teal', 'rb').read().decode('utf-8'))
escrow_addr = compile_response['hash']

# Update App with Escrow Adrress
update_app = transaction.ApplicationUpdateTxn(
    sender,
    suggested_params,
    app_id,
    compile_program(client, open('state.teal', 'rb').read()),
    compile_program(client, open('clear.teal', 'rb').read()),
    [escrow_addr.encode('utf-8')]
)
update_signed_txn = update_app.sign(priv_key)
client.send_transactions([update_signed_txn])

# OptIn to use app
opt_in_app = transaction.ApplicationOptInTxn(
    sender2,  # different user that wants to use our swap
    suggested_params,
    app_id,
)
opt_in_app_signed = opt_in_app.sign(priv_key2)
client.send_transactions([opt_in_app_signed])

# Do a swap USDC to ALGOS
amount = 100

app_swap_call = transaction.ApplicationCallTxn(
    sender2,  # different user that wants to do a swap
    suggested_params,
    app_id,
    transaction.OnComplete.NoOpOC.real,
    app_args=['SWAP'.encode('utf-8')]
)

asset_swap = transaction.AssetTransferTxn(
    sender2,
    suggested_params,
    escrow_addr,
    amount,
    asset_index,
)

gid = transaction.calculate_group_id([app_swap_call, asset_swap])
app_swap_call.group = gid
asset_swap.group = gid

signed_app_swap_call = app_swap_call.sign(priv_key2)
signed_asset_swap = asset_swap.sign(priv_key2)
swap_id = client.send_transactions([signed_app_swap_call, signed_asset_swap])
wait_for_confirmation(client, swap_id)

withdraw_call = transaction.ApplicationCallTxn(
    sender,  # different user that wants to do a swap
    suggested_params,
    app_id,
    transaction.OnComplete.NoOpOC.real,
    app_args=['WITHDRAW'.encode('utf-8')]
)

withdraw_amount = 4000
withdraw_algos = transaction.PaymentTxn(
    escrow_addr,  # escrow address as sender because we are withdrawing
    suggested_params,
    sender2,
    withdraw_amount,
)

gid = transaction.calculate_group_id([withdraw_call, withdraw_algos])
withdraw_call.group = gid
withdraw_algos.group = gid

signed_withdraw_call = withdraw_call.sign(priv_key2)
client.send_transactions([signed_withdraw_call, withdraw_algos])

# Add Liquidity
liquidity_add_call = transaction.ApplicationCallTxn(
    sender2,
    suggested_params,
    app_id,
    transaction.OnComplete.NoOpOC.real,
    app_args=['ADD_LIQUIDITY'.encode('utf-8')]
)

asset_add = transaction.AssetTransferTxn(
    sender2,
    suggested_params,
    escrow_addr,
    1000,
    asset_index,
)

algos_add = transaction.PaymentTxn(
    sender2,
    suggested_params,
    escrow_addr,
    4000,
)

gid = transaction.calculate_group_id([liquidity_add_call, asset_add, algos_add])
liquidity_add_call.group = gid
asset_add.group = gid
algos_add.group = gid

signed_liquidity_add_call = liquidity_add_call.sign(priv_key2)
signed_asset_add = asset_add.sign(priv_key2)
signed_algos_add = algos_add.sign(priv_key2)

client.send_transactions([
    signed_liquidity_add_call,
    signed_asset_add,
    signed_algos_add,
])

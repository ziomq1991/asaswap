from pyteal import *
from algosdk.future import transaction

from contracts.asaswap import escrow
from transactions.utils import compile_program, int_to_bytes


def create_app(
    client,
    creator,
    creator_priv_key,
    suggested_params,
    asset_index,
):
    txn = transaction.ApplicationCreateTxn(
        creator,
        suggested_params,
        transaction.OnComplete.NoOpOC.real,
        compile_program(client, open('./contracts/state_test.teal', 'rb').read()),
        compile_program(client, open('./contracts/clear.teal', 'rb').read()),
        transaction.StateSchema(num_byte_slices=2, num_uints=4),
        transaction.StateSchema(num_byte_slices=0, num_uints=3),
        app_args=[int_to_bytes(asset_index)]
    )

    signed_txn = txn.sign(creator_priv_key)
    tx_id = client.send_transactions([signed_txn])

    return tx_id


def create_escrow(
    client,
    app_id,
):
    with open('./contracts/escrow.teal', 'w') as f:
        escrow_teal = compileTeal(escrow(app_id), Mode.Signature)
        f.write(escrow_teal)

    compile_response = client.compile(open('./contracts/escrow.teal', 'rb').read().decode('utf-8'))
    escrow_addr = compile_response['hash']
    return escrow_addr


def create_asset(
    client,
    sender,
    sender_priv_key,
    suggested_params,
    total,
    decimals,
):
    txn = transaction.AssetConfigTxn(
        sender,
        sp=suggested_params,
        total=total,
        default_frozen=False,
        unit_name='TESTASA',
        asset_name='testasa',
        manager=sender,
        reserve=sender,
        freeze=sender,
        clawback=sender,
        url='',
        decimals=decimals,
    )
    signed_txn = txn.sign(sender_priv_key)
    tx_id = client.send_transactions([signed_txn])
    return tx_id


def fund_account(
    client,
    sender,
    sender_priv_key,
    suggested_params,
    account,
    amount
):
    txn = transaction.PaymentTxn(
        sender,
        suggested_params,
        account,
        amount,
    )
    signed_txn = txn.sign(sender_priv_key)
    tx_id = client.send_transactions([signed_txn])
    return tx_id


def escrow_opt_in_to_asset(
    client,
    suggested_params,
    address,
    asset_index,
):
    lsig = transaction.LogicSig(compile_program(client, open('./contracts/escrow.teal', 'rb').read()))
    asset_opt_in = transaction.AssetTransferTxn(
        address,
        suggested_params,
        address,
        0,
        asset_index
    )
    signed_asset_opt_in = transaction.LogicSigTransaction(asset_opt_in, lsig)
    tx_id = client.send_transactions([signed_asset_opt_in])
    return tx_id


def delete_app(
    client,
    creator,
    creator_priv_key,
    suggested_params,
    app_id,
):
    txn = transaction.ApplicationDeleteTxn(
        creator,
        suggested_params,
        app_id
    )
    signed_txn = txn.sign(creator_priv_key)
    tx_id = client.send_transactions([signed_txn])
    return tx_id


def close_out(
    client,
    user,
    user_priv_key,
    suggested_params,
    app_id,
):
    txn = transaction.ApplicationCloseOutTxn(
        user,
        suggested_params,
        app_id
    )
    signed_txn = txn.sign(user_priv_key)
    tx_id = client.send_transactions([signed_txn])
    return tx_id


def add_escrow(
    client,
    creator,
    creator_priv_key,
    suggested_params,
    app_id,
    escrow_addr,
):
    txn = transaction.ApplicationCallTxn(
        creator,
        suggested_params,
        app_id,
        transaction.OnComplete.NoOpOC.real,
        app_args=['UPDATE'.encode('utf-8')],
        accounts=[escrow_addr],
    )
    signed_txn = txn.sign(creator_priv_key)
    tx_id = client.send_transactions([signed_txn])
    return tx_id


def opt_in_to_app(
    client,
    user,
    user_priv_key,
    suggested_params,
    app_id,
):
    txn = transaction.ApplicationOptInTxn(
        user,
        suggested_params,
        app_id,
    )
    signed_txn = txn.sign(user_priv_key)
    tx_id = client.send_transactions([signed_txn])
    return tx_id


def swap_call(
    client,
    user,
    user_priv_key,
    suggested_params,
    app_id,
    amount,
    escrow_addr,
    asset_index=None
):
    app_txn = transaction.ApplicationCallTxn(
        user,
        suggested_params,
        app_id,
        transaction.OnComplete.NoOpOC.real,
        app_args=['SWAP'.encode('utf-8')]
    )

    if asset_index:
        swap_txn = transaction.AssetTransferTxn(
            user,
            suggested_params,
            escrow_addr,
            amount,
            asset_index,
        )
    else:
        swap_txn = transaction.PaymentTxn(
            user,
            suggested_params,
            escrow_addr,
            amount,
        )

    gid = transaction.calculate_group_id([app_txn, swap_txn])
    app_txn.group = gid
    swap_txn.group = gid

    signed_app_txn = app_txn.sign(user_priv_key)
    signed_swap_txn = swap_txn.sign(user_priv_key)
    tx_id = client.send_transactions([signed_app_txn, signed_swap_txn])
    return tx_id


def withdraw_call(
    client,
    user,
    user_priv_key,
    suggested_params,
    app_id,
    escrow_addr,
    asset_index,
    algos_amount=0,
    asset_amount=0,
):
    app_txn = transaction.ApplicationCallTxn(
        user,
        suggested_params,
        app_id,
        transaction.OnComplete.NoOpOC.real,
        app_args=['WITHDRAW'.encode('utf-8')]
    )

    asset_withdraw_txn = transaction.AssetTransferTxn(
        escrow_addr,
        suggested_params,
        user,
        asset_amount,
        asset_index,
    )
    algos_withdraw_txn = transaction.PaymentTxn(
        escrow_addr,
        suggested_params,
        user,
        algos_amount,
    )

    gid = transaction.calculate_group_id([app_txn, asset_withdraw_txn, algos_withdraw_txn])
    app_txn.group = gid
    asset_withdraw_txn.group = gid
    algos_withdraw_txn.group = gid

    lsig = transaction.LogicSig(compile_program(client, open('./contracts/escrow.teal', 'rb').read()))
    signed_asset_withdraw_txn = transaction.LogicSigTransaction(asset_withdraw_txn, lsig)
    signed_algos_withdraw_txn = transaction.LogicSigTransaction(algos_withdraw_txn, lsig)
    signed_app_txn = app_txn.sign(user_priv_key)
    tx_id = client.send_transactions([signed_app_txn, signed_asset_withdraw_txn, signed_algos_withdraw_txn])
    return tx_id


def add_liquidity_call(
    client,
    user,
    user_priv_key,
    suggested_params,
    app_id,
    escrow_addr,
    asset_amount,
    algos_amount,
    asset_index,
):
    app_txn = transaction.ApplicationCallTxn(
        user,
        suggested_params,
        app_id,
        transaction.OnComplete.NoOpOC.real,
        app_args=['ADD_LIQUIDITY'.encode('utf-8')]
    )

    asset_add_txn = transaction.AssetTransferTxn(
        user,
        suggested_params,
        escrow_addr,
        asset_amount,
        asset_index,
    )

    algos_add_txn = transaction.PaymentTxn(
        user,
        suggested_params,
        escrow_addr,
        algos_amount,
    )

    gid = transaction.calculate_group_id([app_txn, asset_add_txn, algos_add_txn])
    app_txn.group = gid
    asset_add_txn.group = gid
    algos_add_txn.group = gid

    signed_app_txn = app_txn.sign(user_priv_key)
    signed_asset_add_txn = asset_add_txn.sign(user_priv_key)
    signed_algos_add_txn = algos_add_txn.sign(user_priv_key)

    tx_id = client.send_transactions([
        signed_app_txn,
        signed_asset_add_txn,
        signed_algos_add_txn,
    ])

    return tx_id


def remove_liquidity_call(
    client,
    user,
    user_priv_key,
    suggested_params,
    app_id,
    amount
):
    txn = transaction.ApplicationCallTxn(
        user,
        suggested_params,
        app_id,
        transaction.OnComplete.NoOpOC.real,
        app_args=['REMOVE_LIQUIDITY'.encode('utf-8'), int_to_bytes(amount)]
    )

    signed_txn = txn.sign(user_priv_key)
    tx_id = client.send_transactions([signed_txn])
    return tx_id

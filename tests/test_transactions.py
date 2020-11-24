from algosdk.account import generate_account

from transactions.utils import wait_for_confirmation, suggested_params, client
from transactions.main import (
    create_app,
    add_escrow,
    delete_app,
    swap_call,
    withdraw_call,
    add_liquidity_call,
    remove_liquidity_call,
    create_escrow,
    fund_account,
    escrow_opt_in_to_asset,
    opt_in_to_app,
    close_out,
    create_asset,
)


def test_transactions(dispenser):
    user_priv_key, user = generate_account()

    tx_id = fund_account(
        client,
        dispenser['address'],
        dispenser['priv_key'],
        suggested_params,
        user,
        3000000,
    )
    wait_for_confirmation(client, tx_id)

    tx_id = create_asset(
        client,
        user,
        user_priv_key,
        suggested_params,
        1000000000,
        6
    )
    wait_for_confirmation(client, tx_id)
    ptx = client.pending_transaction_info(tx_id)
    asset_index = ptx["asset-index"]

    tx_id = create_app(
        client,
        user,
        user_priv_key,
        suggested_params,
        asset_index,
    )
    wait_for_confirmation(client, tx_id)
    transaction_response = client.pending_transaction_info(tx_id)
    app_id = transaction_response['application-index']

    escrow_addr = create_escrow(client, app_id)

    tx_id = fund_account(
        client,
        dispenser['address'],
        dispenser['priv_key'],
        suggested_params,
        escrow_addr,
        2000000,
    )
    wait_for_confirmation(client, tx_id)

    tx_id = escrow_opt_in_to_asset(
        client,
        suggested_params,
        escrow_addr,
        asset_index
    )
    wait_for_confirmation(client, tx_id)

    tx_id = add_escrow(
        client,
        user,
        user_priv_key,
        suggested_params,
        app_id,
        escrow_addr,
    )
    wait_for_confirmation(client, tx_id)

    tx_id = opt_in_to_app(
        client,
        user,
        user_priv_key,
        suggested_params,
        app_id
    )
    wait_for_confirmation(client, tx_id)

    tx_id = add_liquidity_call(
        client,
        user,
        user_priv_key,
        suggested_params,
        app_id,
        escrow_addr,
        400,
        100,
        asset_index
    )
    wait_for_confirmation(client, tx_id)

    # to have money for fee
    tx_id = add_liquidity_call(
        client,
        user,
        user_priv_key,
        suggested_params,
        app_id,
        escrow_addr,
        4000,
        1000,
        asset_index
    )
    wait_for_confirmation(client, tx_id)

    tx_id = remove_liquidity_call(
        client,
        user,
        user_priv_key,
        suggested_params,
        app_id,
        10,
    )
    wait_for_confirmation(client, tx_id)

    tx_id = withdraw_call(
        client,
        user,
        user_priv_key,
        suggested_params,
        app_id,
        escrow_addr,
        asset_index,
        algos_amount=10,
        asset_amount=40,
    )
    wait_for_confirmation(client, tx_id)

    tx_id = swap_call(
        client,
        user,
        user_priv_key,
        suggested_params,
        app_id,
        100,
        escrow_addr,
    )
    wait_for_confirmation(client, tx_id)

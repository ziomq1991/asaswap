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
    fund_escrow,
    escrow_opt_in_to_asset,
    opt_in_to_app,
)


def test_transactions(creator, user, dispenser, asset_index):

    tx_id = create_app(
        client,
        creator['address'],
        creator['priv_key'],
        suggested_params,
        13168645,
    )
    wait_for_confirmation(client, tx_id)
    transaction_response = client.pending_transaction_info(tx_id)
    app_id = transaction_response['application-index']

    escrow_addr = create_escrow(client, app_id)

    tx_id = fund_escrow(
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
        creator['address'],
        creator['priv_key'],
        suggested_params,
        app_id,
        escrow_addr,
    )
    wait_for_confirmation(client, tx_id)

    tx_id = opt_in_to_app(
        client,
        user['address'],
        user['priv_key'],
        suggested_params,
        app_id
    )
    wait_for_confirmation(client, tx_id)

    tx_id = add_liquidity_call(
        client,
        user['address'],
        user['priv_key'],
        suggested_params,
        app_id,
        escrow_addr,
        400,
        100,
        asset_index
    )
    wait_for_confirmation(client, tx_id)

    tx_id = remove_liquidity_call(
        client,
        user['address'],
        user['priv_key'],
        suggested_params,
        app_id,
        100,
    )
    wait_for_confirmation(client, tx_id)

    tx_id = withdraw_call(
        client,
        user['address'],
        user['priv_key'],
        suggested_params,
        app_id,
        escrow_addr,
        asset_index,
        algos_amount=100,
        asset_amount=400,
    )
    wait_for_confirmation(client, tx_id)

    tx_id = add_liquidity_call(
        client,
        user['address'],
        user['priv_key'],
        suggested_params,
        app_id,
        escrow_addr,
        400,
        100,
        asset_index
    )
    wait_for_confirmation(client, tx_id)

    tx_id = swap_call(
        client,
        user['address'],
        user['priv_key'],
        suggested_params,
        app_id,
        100,
        escrow_addr,
    )
    wait_for_confirmation(client, tx_id)

    tx_id = delete_app(
        client,
        creator['address'],
        creator['priv_key'],
        suggested_params,
        app_id,
    )
    wait_for_confirmation(client, tx_id)

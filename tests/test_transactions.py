from algosdk.account import generate_account

from transactions.utils import wait_for_confirmation, suggested_params, client
from transactions.main import (
    create_app,
    add_escrow,
    swap_call,
    withdraw_call,
    add_liquidity_call,
    remove_liquidity_call,
    create_escrow,
    fund_account,
    escrow_opt_in_to_asset,
    opt_in_to_app,
    create_asset,
    read_global_state,
    read_local_state
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
        4000000,
        1000000,
        asset_index
    )
    wait_for_confirmation(client, tx_id)

    global_state = read_global_state(client, user, app_id)
    assert global_state['TOKENS_BALANCE'] == 4000000
    assert global_state['ALGOS_BALANCE'] == 1000000
    assert global_state['TOTAL_LIQUIDITY_TOKENS'] == 1000000

    local_state = read_local_state(client, user, app_id)
    assert local_state['USER_LIQUIDITY_TOKENS'] == 1000000
    assert local_state['ALGOS_TO_WITHDRAW'] == 0
    assert local_state['TOKENS_TO_WITHDRAW'] == 0

    tx_id = remove_liquidity_call(
        client,
        user,
        user_priv_key,
        suggested_params,
        app_id,
        1000,
    )
    wait_for_confirmation(client, tx_id)

    global_state = read_global_state(client, user, app_id)
    assert global_state['TOKENS_BALANCE'] == 3996000
    assert global_state['ALGOS_BALANCE'] == 999000
    assert global_state['TOTAL_LIQUIDITY_TOKENS'] == 999000

    local_state = read_local_state(client, user, app_id)
    assert local_state['USER_LIQUIDITY_TOKENS'] == 999000
    assert local_state['ALGOS_TO_WITHDRAW'] == 1000
    assert local_state['TOKENS_TO_WITHDRAW'] == 4000

    tx_id = withdraw_call(
        client,
        user,
        user_priv_key,
        suggested_params,
        app_id,
        escrow_addr,
        asset_index,
        algos_amount=1000,
        asset_amount=4000,
    )
    wait_for_confirmation(client, tx_id)

    global_state = read_global_state(client, user, app_id)
    assert global_state['TOKENS_BALANCE'] == 3996000
    assert global_state['ALGOS_BALANCE'] == 998000
    assert global_state['TOTAL_LIQUIDITY_TOKENS'] == 999000

    local_state = read_local_state(client, user, app_id)
    assert local_state['USER_LIQUIDITY_TOKENS'] == 999000
    assert local_state['ALGOS_TO_WITHDRAW'] == 0
    assert local_state['TOKENS_TO_WITHDRAW'] == 0

    tx_id = swap_call(
        client,
        user,
        user_priv_key,
        suggested_params,
        app_id,
        1000,
        escrow_addr,
    )
    wait_for_confirmation(client, tx_id)

    global_state = read_global_state(client, user, app_id)
    assert global_state['TOKENS_BALANCE'] == 3992120
    assert global_state['ALGOS_BALANCE'] == 999000
    assert global_state['TOTAL_LIQUIDITY_TOKENS'] == 999000

    local_state = read_local_state(client, user, app_id)
    assert local_state['USER_LIQUIDITY_TOKENS'] == 999000
    assert local_state['ALGOS_TO_WITHDRAW'] == 0
    assert local_state['TOKENS_TO_WITHDRAW'] == 3880

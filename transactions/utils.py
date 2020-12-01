import os
import base64

from algosdk.v2client import algod

network = os.environ.get('NETWORK', 'localhost')
algod_port = os.environ.get('ALGOD_PORT', 4001)


def compile_program(client, source_code):
    compile_response = client.compile(source_code.decode('utf-8'))
    return base64.b64decode(compile_response['result'])


def wait_for_confirmation(client, txid):
    last_round = client.status().get('last-round')
    tx_info = client.pending_transaction_info(txid)
    while not (tx_info.get('confirmed-round') and tx_info.get('confirmed-round') > 0):
        last_round += 1
        client.status_after_block(last_round)
        tx_info = client.pending_transaction_info(txid)
    return tx_info


def int_to_bytes(i):
    lower8 = (1 << 8) - 1
    char_list = [
        (i >> (8*7)) & lower8,
        (i >> (8*6)) & lower8,
        (i >> (8*5)) & lower8,
        (i >> (8*4)) & lower8,
        (i >> (8*3)) & lower8,
        (i >> (8*2)) & lower8,
        (i >> (8*1)) & lower8,
        i & lower8
    ]
    string = ''.join(chr(c) for c in char_list)
    return string.encode('latin1')


client = algod.AlgodClient(
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    f'http://{network}:{algod_port}'
)

suggested_params = client.suggested_params()


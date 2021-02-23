from pyteal import *


def liquidity_token(owner=tmpl_sen):
	common_fields = And(
		Txn.type_enum() == Int(4),
		Txn.rekey_to() == Global.zero_address(),
		Txn.close_remainder_to() == Global.zero_address(),
	)

	asa_opt_in = And(
		Global.group_size() == Int(1),
		Txn.group_index() == Int(0),
		Txn.asset_amount() == Int(0)
	)

	pay_liquidity = And(
		Txn.type_enum() == Int(4),
		Txn.sender() == tmpl_sen,
		Txn.asset_amount() <= asset_amt 
	)

	combine = And(Or(asa_opt_in, pay_liquidity), common_fields)

	return combine

if __name__ == "__main__":
    params = {
        "owner": Addr("EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY")
    }

    # Overwrite params if sys.argv[1] is passed
    if len(sys.argv) > 1:
        params = parse_args(sys.argv[1], params)

    print(
        compileTeal(
            liquidity_token(
                int(params["owner"]),
            ),
            Mode.Signature,
        )
    )

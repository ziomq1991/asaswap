import pytest


@pytest.fixture
def creator():
    creator_priv_key = '93fraGKY3OXTRidzTmXolc6Tjg/Qj9yND36zNNcm64PPoWwitEArFbcysOUQuaYq1W7n7v16fAuEPfhWNCkRkQ=='
    creator = 'Z6QWYIVUIAVRLNZSWDSRBONGFLKW5Z7O7V5HYC4EHX4FMNBJCGIZN4QVNE'
    return {'priv_key': creator_priv_key, 'address': creator}


@pytest.fixture
def user():
    user_priv_key = '92k0x1hpY4hzMN7Fn7LBYGMmOcHqD8PWoOm+Q4WY6LshXUX0TVNC2RJBUbwxn2Or9QAVYOW5ieSiggOu2vPklA=='
    user = 'EFOUL5CNKNBNSESBKG6DDH3DVP2QAFLA4W4YTZFCQIB25WXT4SKAUKM7GI'
    return {'priv_key': user_priv_key, 'address': user}


@pytest.fixture
def dispenser():
    dispenser_priv_key = 'eITGjcku6NHv/b+uPBrBu4R81TbS4wTrrPcATL6wVuh4TYtEwXeE0EdPLjEsF1MaB9QRhnZbU3Geeo0juIeJmA=='
    dispenser = 'PBGYWRGBO6CNAR2PFYYSYF2TDID5IEMGOZNVG4M6PKGSHOEHRGMIWR5J2I'
    return {'priv_key': dispenser_priv_key, 'address': dispenser}


@pytest.fixture
def asset_index():
    return 13168645

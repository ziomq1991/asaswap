import pytest


@pytest.fixture
def dispenser():
    dispenser_priv_key = 'eITGjcku6NHv/b+uPBrBu4R81TbS4wTrrPcATL6wVuh4TYtEwXeE0EdPLjEsF1MaB9QRhnZbU3Geeo0juIeJmA=='
    dispenser = 'PBGYWRGBO6CNAR2PFYYSYF2TDID5IEMGOZNVG4M6PKGSHOEHRGMIWR5J2I'
    return {'priv_key': dispenser_priv_key, 'address': dispenser}

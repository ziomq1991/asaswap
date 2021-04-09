from pyteal import *


class State:
    """
    Wrapper around state vars.
    """

    def __init__(self, name: str):
        self._name = name

    def put(self, value) -> App:
        raise NotImplementedError

    def get(self) -> App:
        raise NotImplementedError


class LocalState(State):
    def put(self, value) -> App:
        return App.localPut(Int(0), Bytes(self._name), value)

    def get(self) -> App:
        return App.localGet(Int(0), Bytes(self._name))


class GlobalState(State):
    def put(self, value) -> App:
        return App.globalPut(Bytes(self._name), value)

    def get(self) -> App:
        return App.globalGet(Bytes(self._name))
        

class GlobalStateEx(State):
    """
    Global state of a foreign stateful contract
    External state variables need to be evaluated before use.

    https://pyteal.readthedocs.io/en/stable/state.html#external-global
    """
    def __init__(self, foreign_id: int, name: str):
        super().__init__(name)
        self._foreign_id = foreign_id  # Position in Txn.ForeignApps

    def getEx(self) -> MaybeValue:
        return App.globalGetEx(Int(self._foreign_id), Bytes(self._name))

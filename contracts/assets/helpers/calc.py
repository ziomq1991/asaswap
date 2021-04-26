from pyteal import *

def make_step(op, *args):
    if op == Op.store:
        return args[0].store().__teal__()
    elif op == Op.load:
        return args[0].load().__teal__()
    else:
        return TealBlock.FromOp(TealOp(op), *args)

def make_teal(make_steps):
    cmds = make_steps()
    steps = map(lambda args: make_step(*args), cmds)
    start, end = next(steps)
    for step in steps:
        end.setNextBlock(step[0])
        end = step[1]
    return start, end

class mulw_divw4(Expr):
    def __init__(self, a, PT, A, iters):
        self.outputType = TealType.uint64
        self.a = a
        self.PT = PT
        self.A = A
        self.iters = iters
    def __teal__(self):
        def steps():
            A = ScratchSlot()
            MF = ScratchSlot()
            M = ScratchSlot()

            for iter in range(self.iters):
                if iter:
                    yield Op.mulw,
                else:
                    yield Op.mulw, self.a, self.PT

                yield Op.dup2,
                yield Op.pop,
                yield Op.addw,
                yield Op.dup2,
                yield Op.pop,
                yield Op.add,

                if iter:
                    yield Op.load, M
                    yield Op.addw,
                    yield Op.dup2,
                    yield Op.pop,
                    yield Op.add,

                    if iter == self.iters - 1:
                        yield Op.load, A
                        yield Op.div,

                    yield Op.store, M
                    yield Op.add,
                else:
                    yield Op.store, M

                yield Op.add,
                if iter != self.iters - 1:
                    yield Op.dup,

                if iter:
                    if iter != self.iters - 1:
                        yield Op.load, MF
                else:
                    yield Op.bitwise_not, Int(0)
                    yield Op.dup, self.A
                    yield Op.store, A
                    yield Op.mod,
                    yield Op.dup,
                    yield Op.store, MF
            
            for iter in range(1, self.iters):
                yield Op.add,
            yield Op.bitwise_not, Int(0)
            yield Op.load, A
            yield Op.div,
            yield Op.mul,
            yield Op.load, M
            yield Op.add,

        return make_teal(steps)

    def __str__(self):
        return "(mulw_divw {} {} {})".format(self.a, self.PT, self.A)

    def type_of(self):
        return self.outputType


def mulw_divw(a, PT, A):
    return mulw_divw4(a, PT, A, 30)
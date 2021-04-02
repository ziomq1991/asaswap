from pyteal import *

def mulw_divw2(a, PT, A):
    return a * PT / A

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

def make_append_to(x):
    yield Op.load, x
    yield Op.add,
    yield Op.store, x

class mulw_divw3(Expr):
    def __init__(self, a, PT, A, iters):
        self.outputType = TealType.uint64
        self.a = a
        self.PT = PT
        self.A = A
        self.iters = iters

    def __teal__(self):        
        def steps():            
            A = ScratchSlot()
            div_factor = ScratchSlot()
            mod_factor = ScratchSlot()
            temp = result = ScratchSlot()            
            scaler = ScratchSlot()            

            max_int = 2**60

            yield Op.mulw, self.a, self.PT
            yield Op.dup2,
            yield Op.pop,
            yield Op.div, Int(max_int)
            yield Op.dup,
            yield Op.logic_not,
            yield Op.add,
            yield Op.store, scaler            

            yield Op.div, self.A, scaler.load()            
            yield Op.dup,
            yield Op.store, A
            yield Op.dup,
            yield Op.bitwise_xor,
            yield Op.bitwise_not,
            yield Op.load, A
            yield Op.dup2,
            yield Op.div,
            yield Op.store, div_factor
            yield Op.mod,
            yield Op.store, mod_factor
            
            yield Op.load, scaler
            yield Op.div,
            yield Op.store, temp
            yield Op.load, scaler
            yield Op.div,
            yield Op.load, temp      

            yield Op.dup2,
            yield Op.load, A
            yield Op.div, 
            yield Op.dup2,
            yield Op.pop,
            yield Op.load, div_factor
            yield Op.mul,
            yield Op.add,
            yield Op.store, result 
            yield Op.pop,         
            yield Op.load, A            
            yield Op.mod,
            yield Op.dup2,
            yield Op.pop,                  
            yield Op.load, mod_factor
            
            for _ in range(1, self.iters):
                yield Op.mulw, 
                yield Op.dup2,
                yield Op.load, A
                yield Op.div,
                yield Op.dup2,
                yield Op.pop,                                
                yield Op.load, div_factor
                yield Op.mul,
                yield Op.add,
                yield Op.load, result
                yield Op.add,
                yield Op.store, result
                yield Op.pop,
                yield Op.load, A            
                yield Op.mod,
                yield Op.dup2,
                yield Op.pop,                  
                yield Op.load, mod_factor
            
            yield Op.mul,            
            for _ in range(self.iters * 2):
                yield Op.add,
            yield Op.load, A
            yield Op.div,
            yield Op.load, result
            yield Op.add,

        return make_teal(steps)

    def __str__(self):
        return "(mulw_divw3 {} {} {})".format(self.a, self.PT, self.A)
    
    def type_of(self):
        return self.outputType

class mulw_divw(Expr):
    def __init__(self, a, PT, A):
        self.outputType = TealType.uint64
        self.a = a
        self.PT = PT
        self.A = A

    def __teal__(self):
        start, mulw = TealBlock.FromOp(TealOp(Op.mulw), self.a, self.PT)
        
        dup2, dup2End = TealBlock.FromOp(TealOp(Op.dup2))
        mulw.setNextBlock(dup2)

        sumMods, sumModsEnd = TealBlock.FromOp(TealOp(Op.add))
        dup2End.setNextBlock(sumMods)

        mods = ScratchSlot()
        storeMods, storeModsEnd = mods.store().__teal__()
        sumModsEnd.setNextBlock(storeMods)

        aPTLpop, aPTLpopEnd = TealBlock.FromOp(TealOp(Op.pop))
        storeModsEnd.setNextBlock(aPTLpop)

        aPTHdup, APTHdupEnd = TealBlock.FromOp(TealOp(Op.dup))
        aPTLpopEnd.setNextBlock(aPTHdup)

        xADup, xADupEnd = TealBlock.FromOp(TealOp(Op.dup2), Int(2**64-1), self.A)
        APTHdupEnd.setNextBlock(xADup)

        xAm, xAmEnd = TealBlock.FromOp(TealOp(Op.mod))
        xADupEnd.setNextBlock(xAm)

        xmods = ScratchSlot()
        storexMods, storexModsEnd = xmods.store().__teal__()
        xAmEnd.setNextBlock(storexMods)

        xAd, xAdEnd = TealBlock.FromOp(TealOp(Op.div))
        storexModsEnd.setNextBlock(xAd)

        aPTHxad, aPTHxadEnd = TealBlock.FromOp(TealOp(Op.mul))
        xAdEnd.setNextBlock(aPTHxad)

        result = ScratchSlot()
        storeResult, storeResultEnd = result.store().__teal__()
        aPTHxadEnd.setNextBlock(storeResult)

        loadXMods, loadXModsEnd = xmods.load().__teal__()
        storeResultEnd.setNextBlock(loadXMods)

        mulXMods, mulXModsEnd = TealBlock.FromOp(TealOp(Op.mul))
        loadXModsEnd.setNextBlock(mulXMods)

        loadMods, loadModsEnd = mods.load().__teal__()
        mulXModsEnd.setNextBlock(loadMods)

        sumAllMods, sumAllModsEnd = TealBlock.FromOp(TealOp(Op.add))
        loadModsEnd.setNextBlock(sumAllMods)

        resultFromMods, resultFromModsEnd = TealBlock.FromOp(TealOp(Op.div), self.A)
        sumAllModsEnd.setNextBlock(resultFromMods)

        loadResult, loadResultEnd = result.load().__teal__()
        resultFromModsEnd.setNextBlock(loadResult)

        finalSum, finalSumEnd = TealBlock.FromOp(TealOp(Op.add))
        loadResultEnd.setNextBlock(finalSum)            

        return start, finalSumEnd
        
    
    def __str__(self):
        return "(mulw_divw {} {} {})".format(self.a, self.PT, self.A)
    
    def type_of(self):
        return self.outputType
from pyteal import *

def pt2(a, PT, A):
    return a *PT / A

class pt(Expr):
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
        return "(pt{} {} {})".format(self.a, self.PT, self.A)
    
    def type_of(self):
        return self.outputType
from pyteal import compileTeal, Int, Mode

if __name__ == "__main__":
    print(compileTeal(Int(1), Mode.Application))

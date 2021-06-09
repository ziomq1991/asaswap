from . import calc
from pyteal import *
from random import randint
import pytest
from hypothesis import assume, given, settings, example
from hypothesis.strategies import integers
import sys

class Panic(Exception):
    pass

def eval_teal(code):
    stack = []
    slots = [0 for _ in range(256)]
    max_int = 2**64

    lines = code.splitlines()
    for nr, line in enumerate(lines):
        if line.startswith('#'):
            continue

        if line == 'dup':
            x = stack[-1]
            stack.append(stack[-1])
        elif line == 'dup2':
            x = stack[-2], stack[-1]
            stack.extend(x)
        elif line == 'pop':
            stack.pop()
        elif line == 'mulw':
            b = stack.pop()
            a = stack.pop()
            ab = a * b
            x = ab // max_int, ab % max_int
            stack.extend(x)
        elif line == 'addw':
            b = stack.pop()
            a = stack.pop()
            ab = a + b
            x = ab // max_int, ab % max_int
            stack.extend(x)
        elif line == '/':
            b = stack.pop()
            a = stack.pop()
            if not b:
                raise Panic
            x = a // b
            stack.append(x)
        elif line == '%':
            b = stack.pop()
            a = stack.pop()
            if not b:
                raise Panic
            x = a % b
            stack.append(x)
        elif line == '!':
            a = stack.pop()
            x = int(not a)
            stack.append(x)
        elif line == '~':
            a = stack.pop()
            x = (max_int - 1) ^ a
            stack.append(x)
        elif line == '+':
            b = stack.pop()
            a = stack.pop()
            if a + b >= max_int:
                raise Panic
            x = a + b
            stack.append(x)
        elif line == '*':
            b = stack.pop()
            a = stack.pop()
            if a * b >= max_int:
                raise Panic
            x = a * b
            stack.append(x)
        elif ' ' in line:
            op, arg = line.split(' ')
            if op == 'int':
                x = int(arg)
                stack.append(x)
            else:
                if op == 'store':
                    i = int(arg)
                    x = stack.pop()
                    slots[i] = x
                elif op == 'load':
                    i = int(arg)
                    x = slots[i]
                    stack.append(x)
                else:
                    raise Exception("Operation is not supported by the simulator")
        else:
            raise Exception("Operation is not supported by the simulator")

    return stack, slots

def check_mulw_divw(m1, m2, d, iters):
    expr = calc.mulw_divw4(Int(m1), Int(m2), Int(d), iters)
    code = compileTeal(expr, Mode.Application, version=3)
    stack, _ = eval_teal(code)
    assert len(stack) == 1
    actual = stack[0]
    expected = m1 * m2 // d
    assert actual == expected

@pytest.mark.slow
@settings(max_examples=1000000)
@given(
    m1=integers(min_value=0,max_value=2**64-1),
    m2=integers(min_value=0,max_value=2**64-1),
    d=integers(min_value=1,max_value=2**64-1)
)
@example(m1=845440975373315, m2=7362476843216198217, d=6559227162326473294)
def test_mulw_divw_extra(m1, m2, d):
    assume(m1*m2//d < 2**64)
    # run with the same number of iterations (29) as production code
    try:
        check_mulw_divw(m1, m2, d, 29)
    except Panic:
        # With only 29 iterations we expect the division to succeed if the product of arguments is less than 2**186
        # Therefore, we accept failures, should this limit be exceeded
        if m1 * m2 * d < 2**186:
            raise Exception("Runtime raised an exception despite arguments having product less than 2**186")

def test_mulw_divw_2():
    check_mulw_divw(2973999501496, 7565846369408, 13248381314791, 2)

def test_mulw_divw_3():
    check_mulw_divw(504612630011227, 456502535376996, 456848904306832, 3)

def test_mulw_divw_4():
    check_mulw_divw(1047785349130731, 1155732536582130, 3805015213959775, 4)

def test_mulw_divw_5():
    check_mulw_divw(6156320184133297, 10276024192164900, 31525564414595985, 5)

def test_mulw_divw_6():
    check_mulw_divw(8650396694956317, 50344043826024717, 55806651999405176, 6)

def test_mulw_divw_7():
    check_mulw_divw(134337476550988434, 186657417494672954, 875603382994563126, 7)

def test_mulw_divw_8():
    check_mulw_divw(25539752467046173, 50066738202697470, 81684744308301579, 8)

def test_mulw_divw_9():
    check_mulw_divw(174023187848018721, 73358331448704009, 99864535303496223, 9)

def test_mulw_divw_10():
    check_mulw_divw(173421505027289839, 65010427550271025, 445898498532456751, 10)

def test_mulw_divw_11():
    check_mulw_divw(2938427177263941039, 1001074210745622430, 1144862575509227684, 11)

def test_mulw_divw_12():
    check_mulw_divw(9803881832683200037, 1249015226101540157, 9127503045377531079, 12)

def test_mulw_divw_13():
    check_mulw_divw(1043045914346626229, 1512097117379861813, 951311367692072248, 13)

def test_mulw_divw_14():
    check_mulw_divw(550282892036284668, 757458074168882783, 216084785787322515, 14)

def test_mulw_divw_15():
    check_mulw_divw(1838083602572145061, 5940149362034033034, 1225708283692370009, 15)

def test_mulw_divw_16():
    check_mulw_divw(6060348855452751330, 6533115704363266984, 8898092692120611280, 16)

def test_mulw_divw_17():
    check_mulw_divw(1131290691954950571, 3916411249215893288, 1016110309558672578, 17)

def test_mulw_divw_18():
    check_mulw_divw(4466515474260802122, 1153318795973524262, 18193954913946470969, 18)

def test_mulw_divw_19():
    check_mulw_divw(1861760924356142773, 84206733951842100, 983291647851488239, 19)

def test_mulw_divw_20():
    check_mulw_divw(8287289676806704632, 3695160077622498376, 3566547837276388364, 20)

def test_mulw_divw_21():
    check_mulw_divw(3270893040618726147, 3770062359645108887, 3268588120108130072, 21)

def test_mulw_divw_22():
    check_mulw_divw(9841025605269311662, 2894248802487736966, 4440652615633953563, 22)

def test_mulw_divw_23():
    check_mulw_divw(15004466722411265609, 1510419696782666616, 16675116669653024243, 23)

def test_mulw_divw_24():
    check_mulw_divw(3109902310200474250, 7043102079621611994, 8200767394420108127, 24)

def test_mulw_divw_25():
    check_mulw_divw(6160023253093451012, 5066092024395632121, 8998764259433604476, 25)

def test_mulw_divw_26():
    check_mulw_divw(2520778508546452537, 3871701513724163405, 2161425363048182752, 26)

def test_mulw_divw_27():
    check_mulw_divw(7106085521542592961, 5136437739721790844, 5589482744570005230, 27)

def test_mulw_divw_28():
    check_mulw_divw(5596962224907662880, 16057542396872935029, 17180501446612746601, 28)

def test_mulw_divw_29():
    check_mulw_divw(9053881976817524473, 7406027610584116209, 15172604547329922178, 29)

def test_mulw_divw_30():
    check_mulw_divw(15021176693101561960, 16893999308059787356, 17379749495309464077, 30)

def test_mulw_divw_31():
    check_mulw_divw(9156121735441635427, 12214031225650480644, 8868771992979929612, 31)

def test_mulw_divw_32():
    check_mulw_divw(15969784904644200875, 13640922565667615505, 15245079224516462508, 32)

def test_mulw_divw_33():
    check_mulw_divw(4433508470526009217, 3986822603770055060, 5027941621437732124, 33)

def test_mulw_divw_34():
    check_mulw_divw(9498403006808533114, 8458466659348487952, 16096801602589653961, 34)

def test_mulw_divw_35():
    check_mulw_divw(4265019110968528768, 17873447453393957827, 13216399468813391580, 35)

def test_mulw_divw_36():
    check_mulw_divw(1534996399970574195, 6076067921801593936, 5972067442504555525, 36)

def test_mulw_divw_37():
    check_mulw_divw(14083717237392549259, 7611676827938162099, 14635923498845850188, 37)

def test_mulw_divw_38():
    check_mulw_divw(13257352430483012706, 7051607805588101247, 15408330470431537074, 38)

def test_mulw_divw_39():
    check_mulw_divw(17996104569607297897, 11932399811744956484, 14170158360300231375, 39)

def test_mulw_divw_40():
    check_mulw_divw(4538953283212756422, 8104277830740490532, 6654768002477390146, 40)

def test_mulw_divw_41():
    check_mulw_divw(4172138923852485853, 8912229114293020195, 3086222005191567859, 41)

def test_mulw_divw_42():
    check_mulw_divw(8356339597069798474, 2096918544067940391, 7413290528419539671, 42)

def test_mulw_divw_43():
    check_mulw_divw(615038673209145649, 981065722844800633, 15415486806519204834, 43)

def test_mulw_divw_44():
    check_mulw_divw(17465466521165250370, 17422333656133402325, 16801804751795879535, 44)

def test_mulw_divw_45():
    check_mulw_divw(13436783003806659510, 7577699358523965431, 17845424344444247315, 45)

def test_mulw_divw_46():
    check_mulw_divw(12468744365695125272, 5541520960699749045, 7849619450208216179, 46)

def test_mulw_divw_47():
    check_mulw_divw(6016894876310150656, 6339701158618493834, 2546575015533607658, 47)

def test_mulw_divw_2_should_fail_for_big_numbers():
    with pytest.raises(Panic):
        check_mulw_divw(6016894876310150656, 6339701158618493834, 2546575015533607658, 2)

sys.setrecursionlimit(1500)

if __name__ == "__main__":
    for iters in range(2, 48):
        p = 64
        while True:
            top = 2**p-1
            top0 = top // 2**5
            m1 = randint(top0, top)
            m2 = randint(top0, top)
            dmin = m1 * m2 // top
            d = randint(dmin, top)
            try:
                check_mulw_divw(m1, m2, d, iters)
                print(f'def test_mulw_divw_{iters}():\n    check_mulw_divw({m1}, {m2}, {d}, {iters})\n')
                break
            except:
                p = p-1

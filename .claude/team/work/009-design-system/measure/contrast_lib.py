# WCAG 2.x relative luminance helpers used by contrast_pairs.py (designer, 009).
import sys
def hx(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def lin(c):
    c=c/255
    return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
def L(rgb): r,g,b=[lin(x) for x in rgb]; return 0.2126*r+0.7152*g+0.0722*b
def over(fg,a,bg):
    return tuple(fg[i]*a+bg[i]*(1-a) for i in range(3))
def ratio(a,b):
    la,lb=L(a),L(b)
    if la<lb: la,lb=lb,la
    return (la+0.05)/(lb+0.05)
C=dict(
 app=hx('0b1018'), panel=hx('121a26'), raised=hx('182233'), control=hx('1f2b3f'), ctrlhover=hx('25344c'),
 plot=hx('0e1520'), border=hx('26344a'), hoverborder=hx('3a4d6b'),
 primary=hx('dbe4f0'), secondary=hx('8a9ab1'), axis=hx('8ea0b8'), readout=hx('e6edf6'),
 teal=hx('3ee0b5'), tealhover=hx('2bc79e'), inkteal=hx('062018'), warn=hx('ffb547'),
 danger=hx('ff6b6b'), dangerhover=hx('f04848'), info=hx('5aa9ff'), violet=hx('a47cff'), violethover=hx('9166f5'),
 inkdark=hx('120a24'), orange=hx('ff9f43'), magenta=hx('ff6bcb'), yellow=hx('ffd166'), white=hx('ffffff'),
 slate=hx('7a8799'), slate4=hx('8a9ab1'),
)
def show(name,a,b):
    print(f"{name:70s} {ratio(a,b):5.2f}")

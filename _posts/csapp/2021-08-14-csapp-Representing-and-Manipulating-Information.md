---
title: CS:APP - Representing and Manipulating Information
date: 2021-08-14
categories: [csapp]
tags: [operating system, c]
math: true
---

# Information Storage
相較於直接操作 bits，使用 bytes(8 bits) 會顯得方便得多。以 machine-level 來看待記憶體就會是一連串的 byte 陣列，每個 bytes 都有一個獨立的 id(address)，對於所有可能的 address 稱之為 virtual address space\
所有關於 compiler, run-time system 如何分配記憶體，都是基於 `virtual address space`，諸如: 指標操作、結構操作等等。\
C 語言擁有所謂 `type` 的資訊，以用於區分各種形態大小(指標要加多少 offset 才能正確取值)，不過在 machine-level 自然是沒有這種資訊的，對於機器而言，這就是一堆的 byte

pointer 大小一般為 word size, 而 virtual address 是以 word 做編碼的，若一機器為 `w-bit word size`，則最多可以定址 $2^w$ bytes

```shell
linux> gcc -m32 prog.c
linux> gcc -m64 prog.c
```

`-m32` 編譯出來的程式可以跑在 `32-bit` 以及 `64-bit` 電腦上
`-m64` 只能跑在 `64-bit` 電腦上

對於不同機器，資料格式大小也會不同，比如說: `int` 可以為 2, 4 或 8 bytes\
為了避免不同機器上有不同的大小，[ISO C99](http://www.open-std.org/jtc1/sc22/wg14/www/docs/n1124.pdf) 制定了一個規則，提供了 `int32_t` 保證大小為 4 bytes, `int64_t` 為 8 bytes

儘管大多數變數型態都有 `signed` 或 `unsigned`，那 `char` 也是嗎?\
在 [C 語言規格書 p.35 §6.2.5](http://www.open-std.org/JTC1/SC22/WG14/www/docs/n1256.pdf#page=47)中，

> The three types char, signed char, and unsigned char are collectively called the character types. The implementation shall define char to have the same range, representation, and behavior as either signed char or unsigned char. 35)

並沒有指定 `char` 要 signed 還是 unsigned，一切由 compiler 的實作而定，像是 gcc default 使用 unsigned char，並擁有如 `-funsigned-char`, `-fsigned-char` 的 compile flag

此外 C 語言也對於關鍵字的排列提供不同的方式，以下四種效果皆相同

```c
unsigned long
unsigned long int
long unsigned
long unsigned int
```

開發者需要自行解決在不同平台的不同變數大小的問題，在 [C 語言規格書 p.33 §6.2.5](http://www.open-std.org/JTC1/SC22/WG14/www/docs/n1256.pdf#page=47) 僅有規定大小的下界(lower-bound) 並沒有指定上界(upper-bound)

> An object declared as type \_Bool is large enough to store the values 0 and 1.
>
> A ‘‘plain’’ int object has the natural size suggested by the architecture of the execution environment (large enough to contain any value in the range INT_MIN to INT_MAX as defined in the header <limits.h>).

程式是由很多個 bytes 組成，我們必須考量兩個點

- 在某個地址上的 object 是甚麼
- 要怎麼在記憶體中排列 bytes

有些機器對於如何排列 bytes 有不同的意見，以下為兩種不同排列方式\
假設 0x0 上有資料 $x_0x_1x_2x_3$

|little endian|$x_3$|$x_2$|$x_1$|$x_0$|
|:--:|:--:|:--:|:--:|:--:|
|big endian|$x_0$|$x_1$|$x_2$|$x_3$|

有些 IBM, Oracle 機器採用 big endian, 有些則採用 littel endian\
對於哪種比較好，其實沒有一定，只要約定好就好\
常見需要注意的場合有

- 網路通訊
- 查看 data sequences

![](https://i.imgur.com/AEkrAKJ.png)\
注意到 `int` 與 `float` 的輸出結果不一致，這是因為他們使用了不同的編碼系統

binary values 是為組成編碼、操作訊息的重要理論基礎\
boolean algebra 是由 {0, 1} 組成，並有 $\neg , \lor , \land$ 等操作\
C 語言也提供 bitwise 操作，需要注意 logical operator 與 bit operator 的差異，以下以 not 作為舉例

- ~ 是將所有 bit 反轉
- ! 是將數值取 negative(boolean)

同時還提供 shift operation，也就是將 bit 往左或右推

- 往左: 0b1010 :arrow_right: 0b0100
- 往右:
  - 邏輯右移: 0b0101
  - 算術右移: 0b1101

# Integer Representations
C 語言可以表示多種的整數，包含: char, short 以及 long。C 語言僅規定各個型態最少需要表達多少範圍，並無界定上界，需要注意的是上界與下界的範圍並不一致

```
int : -32,767 ~ 32,767
long: -2,147,483,647 ~ 2,147,483,647
```

事實上，int 的數值範圍僅需 `2 byte` 即可表示，這就要追朔到 16-bit 機器，如今 int 大小，以 gcc 實作來說會是 4 byte

考慮用 bits 表示 int，以 unsigned 來說，最小值會是 0b0000...0000，最大值會是 0b1111...1111\
unsigned 二進位表示法有一個很重要的特性，所有 int 數值在 binary 表示法中，都會有 唯一 的表示\
如果是 signed int 呢，二補數(Two's Complement) 就是用來表示負數的。具體的做法就是將 MSB(Most Significant Bit) 賦予負數權重\
![](https://i.imgur.com/eu1EwVu.png)\
C 語言提供不同符號的數值切換，經由 casting 可以達成，但會不會有甚麼錯誤呢? 考慮以下例子

```c
short int v = -12345;
unsigned short uv = (unsigned short)v;
printf("v = %d, uv = %u\n", v, uv);
```

結果

```
v  = -12345
uv = 53191
```

需要注意的是，bit 的數值並沒有任何改變，變的是解讀 bit 的方法。\
多數 C 語言都是透過這樣子的機制去處理 signed 與 unsigned 之間的轉換

- 定義 B2U: Bytes to unsigned
- 定義 B2T: Bytes to 2's complement
- 定義 T2U: 2's complement to unsigned
- 定義 T2B: 2's complement to bytes

$$
T2U =
    \begin{cases}
      x + 2^w, & x < 0 \\
      0, & x \geq 0
    \end{cases}  \\
U2T =
    \begin{cases}
        u, & u \leq TMax_w \\
        u - 2^w, & u > TMax_w
    \end{cases}
\\
$$

輸出如下所示

$$
T2U(-12345) = 53191 \\
U2T(53191) = -12345 \\
T2U(-1) = 4294967295 \\
U2T(4294967295) = -1
$$

![](https://i.imgur.com/ajbgcnJ.png)\
![](https://i.imgur.com/3EcEgJw.png)

因為 unsigned 的部分不包含 $\leq 0$，2 補數的部分則是橫跨正數與負數\
觀察以上圖示可以得到以下結論

$$
B2U(T2B(x)) = T2U(x) = B2T + x_{w - 1}2^w \\
U2T(x) = -x_{w - 1}2^w + x
$$

儘管 C 語言沒有指定如何表示 signed numbers，大多數系統都採用二補數的方式進行，其中也提供 `casting` 機制作為 signed/unsigned 轉換，而方式分為

- 顯式轉換
  ```c
  int tx, ty;
  unsigned ux, uy;

  tx = (unsigned)ux;
  uy = (int)ty;
  ```
- 隱式轉換
  ```c
  int tx, ty;
  unsigned ux, uy;
  tx = ux;
  uy = ty;
  ```

關於 C 語言這種隱式轉換，常常會帶來一些非預期的結果，比如說

```c
-1 < 0u
```

因為是 int 與 unsigned 的比較，所以他會把第一個 -1 轉換成 unsigned，因此其實是

```c
4294967295u < 0u
```

因此答案是 `false`，神奇吧

而在 printf 方面，可以使用 `%d`, `%u`, `%x` 等表示不同型態數值，不過 printf 不會用 type 相關資訊，因此我們可以用 `int` 搭配 `%u`，考慮以下

```c
int x = -1;
unsigned u = 2147483648;

printf("x = %u = %d\n", x, x);
printf("u = %u = %d\n", u, u);
```

```
x = 4294967295 = -1
u = 2147483648 = -2147483648
```

casting 不僅可以用在同大小，也可以用在不同大小上。轉換到 larger data type 的時候要注意位移，前面提到會有 `邏輯位移` 以及 `算術位移`。考慮以下程式碼

```c
short sx = -12345;
unsigned short usx = sx;
int x = sx;
unsigned ux = usx;

printf("sx  = %d:\t", sx);
show_bytes((byte_pointer)&sx, sizeof(short));
printf("usx = %u:\t", usx);
show_bytes((byte_pointer)&usx, sizeof(unsigned short));
printf("x   = %d:\t", x);
show_bytes((byte_pointer)&x, sizeof(int));
printf("ux  = %u:\t", ux);
show_bytes((byte_pointer)&ux, sizeof(unsigned));
```

```
sx  = -12345: cf c7
usx = 53191:  cf c7
x   = -1234:  ff ff cf c7
ux  = 53191:  00 00 cf c7
```

其中算術位移是為了保證讓負數不會因為右移而導致變成正數\
上述例子 x 與 ux 個別展示了算術位移以及邏輯位移

擴增變數大小的方法，綜上所述就是算術以及邏輯位移，不過如果我們想要縮減 number of bits 那會有怎麼樣的結果?\
給定 $\overrightarrow{x} = [x_{w-1}, x_{w-2}, ..., x_0]$ 縮減到 k bits，實作上將會丟棄最高位元的 `w-k bits`，當然其中有可能會出問題，舉例來說，unsigned :arrow_right: signed 就有可能會發生 overflow 的情況\
由於 binary 的特性，我們可以得出以下算式

$$
B2U_w([x_{w-1}, x_{w-2}, ..., x_0])\ mod\ 2^k = \sum_{i=0}^{k-1}x_i2^i \\
c.f.\ 2^i\ mod\ 2^k = 0, for\ i \geq k
$$

對於二補數的轉換也是同樣道理，只不過有東西需要做改變

$$
\overrightarrow{x} = [x_{w-1}, x_{w-2}, ..., x_0] \\
\overrightarrow{x}' = [x_{k-1}, x_{k-2}, ..., x_0]\ \text{縮減後的 bit vector}\\
x' = U2T_k(x\ mod\ 2^k)
$$

$x\ mod\ 2^k$ 的原因是，二補數最高位元是代表正負號的，如果也將其轉換數值會導致結果錯誤。

> weight 會從 $2^{k-1}$ 變成 $-2^{k-1}$

總之，對於二進位的轉換我們可以歸納出以下

$$
B2U_k([x_{k-1}, x_{k-2}, ..., x_0]) = B2U_w([w_{k-1}, x_{w-2}, ..., x_0])\ mod 2^k\ \\
B2T_k([x_{k-1}, x_{k-2}, ..., x_0]) = U2T_k(B2U_w([w_{k-1}, x_{w-2}, ..., x_0])\ mod 2^k)
$$

由於隱式轉換可能會隱藏錯誤，程式設計師若沒有充分了解數值系統將會導致錯誤。考慮以下例子

```c
float sum_elements(float a[], unsigned length) {
    int i;
    float result = 0;

    for (i = 0; i <= length - 1; i++) {
        result += sum[i];
    }
    return result;
}
```

假設 length = 0, `i <= length - 1` 會發生甚麼事情呢?\
可以知道，這是 `int` 與 `unsigned` 的比較\
根據 [C 語言規格書 §6.2.5 第 9 項](http://www.open-std.org/JTC1/SC22/WG14/www/docs/n1256.pdf#page=46)

> The range of nonnegative values of a signed integer type is a subrange of the corresponding unsigned integer type, and the representation of the same value in each type is the same.31) A computation involving unsigned operands can never overflow, because a result that cannot be represented by the resulting unsigned integer type is reduced modulo the number that is one greater than the largest value that can be represented by the resulting type.

所以可以得知，0-1 的真實結果會是 `-1 % UINT_MAX+1`\
上述式子會變成 `0(int) <= UINT_MAX(unsigned)`

根據 [C 語言規格書 §6.3.1.1](http://www.open-std.org/JTC1/SC22/WG14/www/docs/n1256.pdf#page=54)

> The rank of any unsigned integer type shall equal the rank of the corresponding signed integer type, if any.

根據 [C 語言規格書 §6.3.1.8](http://www.open-std.org/JTC1/SC22/WG14/www/docs/n1256.pdf#page=57)

> Otherwise, if the operand that has unsigned integer type has rank greater or equal to the rank of the type of the other operand, then the operand with signed integer type is converted to the type of the operand with unsigned integer type

綜上所述，int 型態由於跟 unsigned 的 rank 是相同的，又因為 rank 相同所以將 int 轉型為 unsigned\
所以最終比較式子會是 `0(unsigned) <= UINT_MAX(unsigned)` 條件成立直到 `i = UINT_MAX`

再考慮以下例子

```c
// prototype of strlen
size_t strlen(const char *s);

int strlonger(char *s, char *t) {
    returen strlen(s) - strlen(t) > 0;
}
```

在某些情況下，上述程式碼會出現不可預期的結果\
因為 `strlen` 的實作是定義成 size_t，而 size_t 是根據 `typedef` 而來的，原型定義在 [C 語言規格書 §7.17](http://www.open-std.org/JTC1/SC22/WG14/www/docs/n1256.pdf#page=266)

> The types are
> ptrdiff_t
> which is the signed integer type of the result of subtracting two pointers;
> size_t
> which is the unsigned integer type of the result of the sizeof operator; and wchar_t

因此 `strlen(s)` 與 `strlen(t)` 的結果都是 unsigned\
若 `strlen(s)` 的結果比較小，得出來就會是負數\
又因為 unsinged 所以結果會是一個很大的數字\
`很大的數字 > 0` 其結果為 true\
進而導致錯誤

解決的方式是

```c
return strlen(s) > strlen(t);
```

講到 integer arithmetic\
假設 x,y 為 postive number，有可能會遇到 `x<y` 與 `x-y<0` 結果不一樣的時候\
假設 x,y 的數字區間範圍為 $2^w$，那麼其結果範圍可能是 $0 \leq x+y \leq 2^{w+1}$\
為了要表示這個結果需要 `w+1` bits

定義一個符號 $+^u_w$，$0 \leq x, y \leq 2^w$ 而其結果也落在 `w bits` 之間\
假設使用 4 bit 表示法，x=9, y=12\
x+y=21(0b10101) 很明顯超過 4 bit 表示範圍，如果我們捨棄高位元的數值就能得到 9(0b0101)，其值剛好是 `21 mod 16`\
因此代表我們可以做 `mod 運算`

$$
x +^u_w y = \begin{cases}
      x + y, & x+y<2^w & Normal \\
      x + y - 2^w, & 2^w \leq x + y \lt 2^{w+1} & Overflow
    \end{cases}
$$

在 C 語言裡面，overflow 並不被視為錯誤的一種，甚至有時候我們會希望藉由此種機制用以檢測是否有 overflow 這種情況發生

那麼要如何檢測 overflow 呢? 給定 $s = x +^u_w y$\
僅需考慮 $x + y \geq x$ 或 $x + y \geq y$ 與否即可\
回顧上述例子， $9 +^u_w 12 = 5$ :arrow_right: $5 < 9$

- 如果沒有 overflow :arrow_right: $s \geq x$
- 如果有 overflow :arrow_right: $s = x + y - 2^w$

```c
// return 1: overflow
// return 0: no overflow
int uadd_ok(unsigned x, unsigned y) {
    return (x + y) >= x;
}
```

因為 two's complment 的加法與 unsigned 的加法邏輯一樣，因此我們可以改寫成 $x +^t_w y = U2T_w(T2U_w(x) +^u_w T2U_w(y))$\
先使用 unsigned 加法做完之後再轉換到 two's complement 即可

$$
\begin{align}
x +^t_w y &= U2T_w(T2U_w(x) +^u_w T2U_w(y)) \\
          &= U2T_w[(x_{w-1}2^w + x + y_{w-1}2^w + y mod\ 2^w] \\
          &= U2T_w[(x + y)\ mod\ 2^w]
\end{align}
$$

T2U 可以改寫成 $x_{w-1}2^w + x$ 是因為只要讓最高位元採計並加上原本後面的資料就可以轉成 unsigned 了\
考慮以下測驗題

```cpp
int tadd_ok(int x, int y) {
    int sum = x + y;
    return (sum - x)  y && (sum - y)  x;
}
```

這個 overflow 檢查的實作是錯的，原因是 two's complment addition 是一個 [abliean group](https://en.wikipedia.org/wiki/Abelian_group) 所以 `(sum - x)` 其實跟 `(x + y -x)` 一樣，也就是說不管有沒有 overflow ，上述的結果都會是 y

> [Check of overflow in signed addition and abelian groups](https://stackoverflow.com/questions/25963827/check-of-overflow-in-signed-addition-and-abelian-groups)

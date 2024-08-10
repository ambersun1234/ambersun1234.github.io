---
title: Linux Kernel - Address Space Layout Randomization
date: 2024-08-11
categories: [linux-kernel]
tags: [linux, aslr, prng, pie]
description: 本篇文章將會介紹 ASLR 以及 PIE 的概念，並且透過程式碼實作以及實驗來驗證 ASLR 的 entropy
math: true
---

> 本篇文章是備份自我之前上 Jserv 老師的課程作業內容\
> 並加以修改排版內容\
> 完整內容在 [2021q1 Homework1 (quiz1)](https://hackmd.io/zIn3YASZRouorDd-7Bi-wg?view)

# Introduction to ASLR
[ASLR](https://en.wikipedia.org/wiki/Address_space_layout_randomization) 是一種電腦資訊安全的技巧，避免 [memory corruption](https://en.wikipedia.org/wiki/Memory_corruption) 等各種資安問題。ASLR 機制隨機分配 process 的地址(stack, heap, libraries)，使得地址變得難以預測
> 要注意 ASLR 僅是一種針對攻擊的 mitigation，並不能避免資安問題
> comment by `HexRabbit`

舉例來說 [return-to-libc attacks](https://en.wikipedia.org/wiki/Return-to-libc_attack) 一般應用於 buffer overflow attack 中; 攻擊手法為將 stack 中的返回地址替換為其他地址。使用 ASLR 可以讓 stack 的地址變得不可預測，使得攻擊變得更加困難

> ASLR 0: 關閉\
> ASLR 1: Conservative Randomization\
> ASLR 2: Full Randomization

## PIE
[Position-independent executable(PIE)](https://zh.wikipedia.org/wiki/%E5%9C%B0%E5%9D%80%E6%97%A0%E5%85%B3%E4%BB%A3%E7%A0%81) 又稱作 PIC，通常搭配 ASLR 使用，達到 [address space layout randomization](https://en.wikipedia.org/wiki/Address_space_layout_randomization)

### Experiment
考慮以下實驗結果
```shell
$ gcc -no-pie a.c
$ ./a.out &
$ cat /proc/PID/maps
```

```
ASLR 1, no PIE

00400000-00401000 r--p 00000000 08:10 40308                              /home/ambersun/ASLR/a.out
00401000-00402000 r-xp 00001000 08:10 40308                              /home/ambersun/ASLR/a.out
00402000-00403000 r--p 00002000 08:10 40308                              /home/ambersun/ASLR/a.out
00403000-00404000 r--p 00002000 08:10 40308                              /home/ambersun/ASLR/a.out
00404000-00405000 rw-p 00003000 08:10 40308                              /home/ambersun/ASLR/a.out
00405000-00426000 rw-p 00000000 00:00 0                                  [heap]
7f425fac9000-7f425faee000 r--p 00000000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f425faee000-7f425fc66000 r-xp 00025000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f425fc66000-7f425fcb0000 r--p 0019d000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f425fcb0000-7f425fcb1000 ---p 001e7000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f425fcb1000-7f425fcb4000 r--p 001e7000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f425fcb4000-7f425fcb7000 rw-p 001ea000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f425fcb7000-7f425fcbd000 rw-p 00000000 00:00 0 
7f425fcc5000-7f425fcc6000 r--p 00000000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f425fcc6000-7f425fce9000 r-xp 00001000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f425fce9000-7f425fcf1000 r--p 00024000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f425fcf2000-7f425fcf3000 r--p 0002c000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f425fcf3000-7f425fcf4000 rw-p 0002d000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f425fcf4000-7f425fcf5000 rw-p 00000000 00:00 0 
7ffe726da000-7ffe726fb000 rw-p 00000000 00:00 0                          [stack]
7ffe7271c000-7ffe7271f000 r--p 00000000 00:00 0                          [vvar]
7ffe7271f000-7ffe72721000 r-xp 00000000 00:00 0                          [vdso]
```

```
ASLR 1, no PIE
00400000-00401000 r--p 00000000 08:10 40308                              /home/ambersun/ASLR/a.out
00401000-00402000 r-xp 00001000 08:10 40308                              /home/ambersun/ASLR/a.out
00402000-00403000 r--p 00002000 08:10 40308                              /home/ambersun/ASLR/a.out
00403000-00404000 r--p 00002000 08:10 40308                              /home/ambersun/ASLR/a.out
00404000-00405000 rw-p 00003000 08:10 40308                              /home/ambersun/ASLR/a.out
00405000-00426000 rw-p 00000000 00:00 0                                  [heap]
7f0600b54000-7f0600b79000 r--p 00000000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f0600b79000-7f0600cf1000 r-xp 00025000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f0600cf1000-7f0600d3b000 r--p 0019d000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f0600d3b000-7f0600d3c000 ---p 001e7000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f0600d3c000-7f0600d3f000 r--p 001e7000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f0600d3f000-7f0600d42000 rw-p 001ea000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f0600d42000-7f0600d48000 rw-p 00000000 00:00 0 
7f0600d50000-7f0600d51000 r--p 00000000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f0600d51000-7f0600d74000 r-xp 00001000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f0600d74000-7f0600d7c000 r--p 00024000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f0600d7d000-7f0600d7e000 r--p 0002c000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f0600d7e000-7f0600d7f000 rw-p 0002d000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f0600d7f000-7f0600d80000 rw-p 00000000 00:00 0 
7ffff7f2b000-7ffff7f4c000 rw-p 00000000 00:00 0                          [stack]
7ffff7f93000-7ffff7f96000 r--p 00000000 00:00 0                          [vvar]
7ffff7f96000-7ffff7f98000 r-xp 00000000 00:00 0                          [vdso]
```

可以看到 heap 的位置，兩者是一樣的
`00405000-00426000`
> c.f 64 位元下，no PIE 起點為 `0x00400000`
> c.f 32 位元下，no PIE 起點為 `0x08048000`

gcc 預設 PIE 是開啟的，需使用 `-no-pie` 關閉，參見 [gcc/defaults.h](https://github.com/gcc-mirror/gcc/blob/16e2427f50c208dfe07d07f18009969502c25dc8/gcc/defaults.h#L1233)

> [关于 Linux 下 ASLR 与 PIE 的一些理解](https://www.cnblogs.com/rec0rd/p/7646857.html)

## ASLR Entropy
參考 [Performance and Entropy of Various ASLR Implementations](http://pages.cs.wisc.edu/~riccardo/736finalpaper.pdf)，分析 ASLR 的 entropy，考慮 stack pointer 的位置
考慮以下程式碼
```cpp
static volatile void* getsp(void)
{
    volatile void *sp;
    __asm__ __volatile__ ("movq %%rsp,%0" : "=r" (sp) : /* No input */);
    return sp;
}

int main(int argc, const char *argv[]) {
	printf("sp: %p\n", getsp());
	while (1);

	return 0;
}
```

得到以下執行結果
```
sp: 0x7ffeb6b5bd10
```

對照 `/proc/PID/maps`
```
00400000-00401000 r--p 00000000 08:10 40306                              /home/ambersun/ASLR/a.out
00401000-00402000 r-xp 00001000 08:10 40306                              /home/ambersun/ASLR/a.out
00402000-00403000 r--p 00002000 08:10 40306                              /home/ambersun/ASLR/a.out
00403000-00404000 r--p 00002000 08:10 40306                              /home/ambersun/ASLR/a.out
00404000-00405000 rw-p 00003000 08:10 40306                              /home/ambersun/ASLR/a.out
00405000-00426000 rw-p 00000000 00:00 0                                  [heap]
7f14bdaaf000-7f14bdad4000 r--p 00000000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f14bdad4000-7f14bdc4c000 r-xp 00025000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f14bdc4c000-7f14bdc96000 r--p 0019d000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f14bdc96000-7f14bdc97000 ---p 001e7000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f14bdc97000-7f14bdc9a000 r--p 001e7000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f14bdc9a000-7f14bdc9d000 rw-p 001ea000 08:10 37132                      /usr/lib/x86_64-linux-gnu/libc-2.31.so
7f14bdc9d000-7f14bdca3000 rw-p 00000000 00:00 0 
7f14bdcab000-7f14bdcac000 r--p 00000000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f14bdcac000-7f14bdccf000 r-xp 00001000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f14bdccf000-7f14bdcd7000 r--p 00024000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f14bdcd8000-7f14bdcd9000 r--p 0002c000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f14bdcd9000-7f14bdcda000 rw-p 0002d000 08:10 36843                      /usr/lib/x86_64-linux-gnu/ld-2.31.so
7f14bdcda000-7f14bdcdb000 rw-p 00000000 00:00 0 
7ffeb6b3c000-7ffeb6b5d000 rw-p 00000000 00:00 0                          [stack]
7ffeb6bd4000-7ffeb6bd7000 r--p 00000000 00:00 0                          [vvar]
7ffeb6bd7000-7ffeb6bd9000 r-xp 00000000 00:00 0                          [vdso]
```

不難發現 sp 的位置有一點誤差，我想這也是可接受的範圍內(`0x7ffeb6b5d000`, `0x7ffeb6b5bd10`)
值得注意的是，上述 16 進位輸出共有 `48` 位元，而不是 64 位元
可參考 [why virtual address are 48 bits not 64 bits? [duplicate]
](https://stackoverflow.com/questions/63975447/why-virtual-address-are-48-bits-not-64-bits)

多次實驗觀察 stack pointer 可得以下結果
```
sp: 0x7fff296fa310
sp: 0x7fffd5825950
sp: 0x7ffc725181d0
sp: 0x7ffe6da0dfc0
sp: 0x7ffcd8fc69d0
...
```

可以發現到這些 virtual address 的 MSB 部分都是相同，而最後 4 bits 都是 0。這也就是為甚麼論文中實驗並不採用全部位元的原因
> For Debian, we observed 30 bits of entropy in the stack. \
> This was bits 4 to 34 (least significant to most significant)

> 有興趣的話也可以觀察看看 libc 或相關 library 的地址在開啟 ASLR 下有多少 bits 的 entropy\
> comment by `HexRabbit`

### Experiment
考慮以下測試程式碼
- [ ] main.c
```cpp
int main(int argc, const char *argv[]) {
    if (fork() == 0) {
        char *str[] = {"./test", NULL, NULL};
        char *envp[] = {0};
        if (execve("./test", str, envp) < 0) {
            perror("error");
            exit(0);
        }
    }
    return 0;
}
```

- [ ] test.c
```cpp
int main(int argc, const char *argv[]) {
    register void *p asm("sp");
    printf("%p\n", p);

    return 0;
}
```

為了驗證 ASLR 的 entropy，我參照論文設計了一個簡單的實驗，內容是取得 stack pointer 的位置去分析(搭配 execve 以及 fork)
根據 [man execve](https://man7.org/linux/man-pages/man2/execve.2.html)
> execve() executes the program referred to by pathname.  This causes the program that is currently being run by the calling process to be replaced with a new program, with newly initialized stack, heap, and (initialized and uninitialized) data segments.

execve 會重新 new stack, heap 以及 data 區塊，藉由分析 stack pointer 我們可以知道 ASLR 的 entropy。這次實驗總共測試 1000000(一百萬) 次，分別在 32 位元(`raspberry pi zero wh(rapbian)`)，以及 64 位元(`ubuntu 20.04 LTS`) 下測試
完整程式碼可參考 [linux2021q1_quiz1/ASLR](https://github.com/ambersun1234/linuxkernel_internals/tree/master/2021q1_quiz1/ASLR)

#### 64 位元
```
地址: 重複次數
...
0x7ffeb9c5d880: 2
0x7fff0baab970: 2
0x7ffeada07720: 2
0x7ffdcce3da80: 2
0x7ffe8c644020: 2
0x7ffec6822460: 2
0x7ffe54d41c80: 2
0x7fffe12b40a0: 2
0x7ffda39f9960: 2
0x7fff7dabd5a0: 2
0x7ffcdb205a70: 3
```
總共統計結果
```
重複次數: 有多少地址重複n次
1: 999083
2: 457
3: 1
```
在1百萬重複次數中，僅有 917(457\*2+1\*3) 個地址重複到

#### 32 位元
```
地址: 重複次數
...
0xbea55dd8: 544
0xbec38dd8: 545
0xbeb92dd8: 545
0xbeb4fdd8: 545
0xbeb1ddd8: 545
0xbea92dd8: 547
0xbee5cdd8: 549
0xbeaf1dd8: 551
0xbe9dedd8: 553
0xbe931dd8: 556
0xbeec9dd8: 559
0xbe927dd8: 566
0xbeb1fdd8: 570
0xbe992dd8: 572
```
可以看到在 32 位元架構下，重複機率很高，意味著攻擊者相較於 64 位元架構中，更容易猜到地址。

更改過的程式碼如下:
```cpp
int main(int argc, char **argv) {
    int *tmp = (int *)malloc(sizeof(int));
    int a = (intptr_t)tmp;
    srand(a);
    free(tmp);

    size_t count = 20;

    node_t *list = NULL;
    while (count--) {
        list = list_make_node_t(list, random() % 1024);
    }
```

首先 malloc 一個空間出來，將其地址轉為儲存起來，使用 `intptr_t` 強制轉型(將 pointer 轉型為 integer)，並且使用其作為亂數種子，使用完之後當然要把他 free 掉避免 memory leak。

> TODO: 回顧 [「Linux 核心設計」 課程說明 (2021年春季)](https://docs.google.com/presentation/d/1bJFwpg20GCJmOcdOt6NRYGU3HKVX-Dt0fsuohqTY8x4/edit?usp=sharing) 第 19 頁，嘗試學習早期 mimalloc 運用 ASLR 的手法。\
> comment by `jserv`

考慮 ASLR 以及 PIE 可以將程式改寫如下，參考 [mimalloc/random.c](https://github.com/microsoft/mimalloc/blob/92ead2d88061dde1264800b389b744ac1b79cf39/src/random.c#L255)
```cpp
int main(int argc, char **argv) {
    srand((uintptr_t)&main);
    size_t count = 20;
    node_t *list = NULL;
    while (count--) {list = list_make_node_t(list, random() % 1024);
}
```

執行結果如下
```
$ ./a.out
568087200
NOT IN ORDER : 537 827 166 485 66 417 108 305 462 893 98 688 814 861 422 513 477 327 237 170 
    IN ORDER : 66 98 108 166 170 237 305 327 417 422 462 477 485 513 537 688 814 827 861 893
$ ./a.out
-1303850336
NOT IN ORDER : 111 782 625 900 491 356 273 901 803 125 278 511 612 108 51 450 278 473 436 495 
    IN ORDER : 51 108 111 125 273 278 278 356 436 450 473 491 495 511 612 625 782 803 900 901
```

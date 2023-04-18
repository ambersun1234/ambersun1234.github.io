---
title: Linux Kernel - Clock
date: 2021-09-20
categories: [linux kernel]
tags: [clock]
math: true
---

# Hardware and System Clock
Linux 的世界裡，有兩種時鐘，他們分別為

- Hardware Clock
  - 硬體時鐘，即擁有 `獨立的供電系統以及電容等等的` 硬體時鐘，以電腦來說就是 [cmos clock](https://wiki.osdev.org/CMOS#The_Real-Time_Clock)(或稱為 [RTC](https://en.wikipedia.org/wiki/Real-time_clock), [BIOS clock](https://en.wikipedia.org/wiki/BIOS))
  - 硬體時鐘必須要是常駐於系統當中，即使作業系統關機之後也必須存在
- System Clock
  - system clock 僅存於系統運行時期，當系統關機後，system clock 將不復存在
  - 當 system clock 不處於運行時，hardware clock 就發揮了它的用處。當系統開機時，kernel 會透過 system call 去取得 hardware time 並初始化 system clock
  - driven by `timer interrupt`

# Linux Kernel's Clock
為了針對各種不同使用情境，測量各種不同的時間，kernel 提供了一系列的 clock\
在此僅列出幾種常用的，完整支援列表可以參考 [clock_gettime](https://man7.org/linux/man-pages/man2/clock_gettime.2.html)

- `CLOCK_REALTIME`
  - 真實世界的時間，比如現在是幾點幾分之類的( 可以被 [adjtime(3)](https://man7.org/linux/man-pages/man3/adjtime.3.html) 以及 NTP 所更改)
  - 也被稱為 `wall-clock` :arrow_right: 意即掛在牆壁上的時鐘
  - settable
- `CLOCK_MONOTONIC`
  - 這個時間是紀錄了自系統開機以來經過的時間(不包含系統休眠時間)，該數值是使用 `jiffies` 作為紀錄，並且此數值為單調遞增(透過 `timer interrupt`)
  - 會受到 [adjtime(3)](https://man7.org/linux/man-pages/man3/adjtime.3.html) 以及 NTP 的影響
  - nonsettable
- `CLOCK_BOOTTIME`
  - 類似於 CLOCK_MONOTONIC，只不過它記錄了系統休眠時間
  - nonsettable

# Network Time Protocal(NTP)
前面提到，硬體時鐘是透過電腦本身內部的 [原子鐘](https://en.wikipedia.org/wiki/Atomic_clock) 去紀錄當前間的，不過由於每家硬體廠使用的硬體設備不同，進而導致時間上可能會有一點誤差\
比如像是，跨時區，日光節約時間等等的\
這時候正確的時間顯得相當的重要了, 因此，[Network Time Protocal](http://www.ntp.org/) 誕生了。你可以使用 [ntp daemon](https://en.wikipedia.org/wiki/Ntpd) 或者是 [ntpdate](https://linux.die.net/man/8/ntpdate) 用以進行網路校時

> 詳細內容可以參考 [鳥哥的 Linux 私房菜 - 第十五章、時間伺服器： NTP 伺服器](http://linux.vbird.org/linux_server/0440ntp.php)

# 11 minute mode
Kernel 提供了另外的一個功能: `11 minute mode`\
開啟這項功能等於說讓 kernel 每 11 分鐘自動更新 hardware clock(用以與 system clock 同步)

為甚麼要更新 hardware clock?\
因為事實上，hardware clock 在某種程度上來說是不精準的，但是這個誤差值是可預測的!(每天慢個 10 second 之類的) :arrow_right: [systematic drift](https://en.wikipedia.org/wiki/Observational_error)\
假設 `11 minute mode` 是開啟的狀態，然後你用 `$ hwclock --adjust` 去調整 hardware clock，可能過 11 分鐘之後時間又會跑掉了\
所以 man page 裡面是建議，`11 minute mode` 與 `$ hwclock --adjust` 不要一起用會比較好

# time_namespaces
在 linux kernel 5.6 釋出之後，time 也可以 virtualization 了!\
但是，這個功能僅針對 `CLOCK_MONOTONIC` 以及 `CLOCK_BOOTTIME`\
為甚麼 namespaces 不支援 CLOCK_REALTIME? 讓我們來看看 kernel 開發者的討論吧

> [[Y2038][time namespaces] Question regarding CLOCK_REALTIME support plans in Linux time namespaces](https://lore.kernel.org/lkml/20201114102503.GB1000@bug/T/)

```
I hope you are aware that the time namespace offsets have to be set
_before_ the process starts and can't be changed afterwards,
i.e. settime() is not an option.

That might limit the usability for your use case and this can't be
changed at all because there might be armed timers and other time
related things which would start to go into full confusion mode.

The supported use case is container life migration and that _is_ very
careful about restoring time and armed timers and if their user space
tools screw it up then they can keep the bits and pieces.

So in order to utilize that you'd have to checkpoint the container,
manipulate the offsets and restore it.

The point is that on changing the time offset after the fact the kernel
would have to chase _all_ armed timers which belong to that namespace
and are related to the affected clock and readjust them to the new
distortion of namespace time. Otherwise they might expire way too late
(which is kinda ok from a correctness POV, but not what you expect) or
too early, which is clearly a NONO. Finding them is not trivial because
some of them are part of a syscall and on stack.

...

Aside of this, there are other things, e.g. file times, packet
timestamps etc. which are based on CLOCK_REALTIME. What to do about
them? Translate these to/from name space time or not? There is a long
list of other horrors which are related to that.
```

mailing list 的內容實屬過於龐大了，有興趣的可以翻一下\
大意是說，假設更改了 host 的系統時間，則 kernel 必須走訪每個 namespaces ，根據 offset 更改 namespace 裡面的時間。\
先不說過多的 overhead，每次更改都需要花時間，那更改的過程中所產生的些微時間差要不要再更新一遍?

```c
+static inline void timens_add_monotonic(struct timespec64 *ts)
+{
+	struct timens_offsets *ns_offsets = &current->nsproxy->time_ns->offsets;
+
+	*ts = timespec64_add(*ts, ns_offsets->monotonic);
+}
+
+static inline void timens_add_boottime(struct timespec64 *ts)
+{
+	struct timens_offsets *ns_offsets = &current->nsproxy->time_ns->offsets;
+
+	*ts = timespec64_add(*ts, ns_offsets->boottime);
+}
```

> git commit: [cad1bae](https://lore.kernel.org/lkml/157894257123.19145.5195489599326442618.tip-bot2@tip-bot2/)

再者，因為 `CLOCK_REALTIME` 在很多地方被使用到，比如像是檔案的時間戳記，到底是要使用 host 的還是 namespace 的時間?\
種種的原因致使 `CLOCK_REALTIME` 並未被納入 namespace 裡面

<hr>

至於為甚麼要加入 time namespaces，由 man page 可以得知是為了要做 container migration checkpoint/restore 等工作

```
The motivation for adding time namespaces was to allow the
monotonic and boot-time clocks to maintain consistent values
during container migration and checkpoint/restore.
```

關於 container checkpoint/restore，可以參考這篇文章 [CRIU 介绍](https://blog.csdn.net/weixin_38669561/article/details/98183545)

# Measure Time With Clock
前面提到的 clock 種類，是不是每一種都適合用於測量時間呢?\
不是的，比如說相比 CLOCK_REALTIME, CLOCK_MONOTONIC 更適合用於測量時間，因為 CLOCK_REALTIME 會受到校時的影響(手動或自動)，可能快一點或慢一點，對於要精準測量時間差的 prgram 來說可能不是那麼的適合

```c
struct timespec start, end;

clock_gettime(CLOCK_MONOTONIC, &start);
clock_gettime(CLOCK_MONOTONIC, &end);
```

struct timespec 定義於 `time.h` 裡面(參見 [21.2 Time Types](https://www.gnu.org/software/libc/manual/html_node/Time-Types.html))，如下所示

```c
struct timespec {
    time_t tv_sec;
    long int tv_nsec;
}
```

考慮以下測量時間程式碼

> to be continued

# Reference
- [[Timer 学习]wall time 和 monotonic time](https://blog.csdn.net/peterlin666/article/details/32344355)
- [What is the use of CLOCK_REALTIME?](https://stackoverflow.com/a/41895737)

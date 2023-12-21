---
title: Linux Kernel - namespaces
date: 2021-09-20
categories: [linux-kernel]
tags: [namespaces]
math: true
---

# Introduce to namespaces
[namespaces](https://man7.org/linux/man-pages/man7/namespaces.7.html) 是 linux kernel 的一種資源隔離機制，用以防止不同 process 看到不同資源

> A namespace wraps a global system resource in an abstraction that
> makes it appear to the processes within the namespace that they
> have their own isolated instance of the global resource. Changes
> to the global resource are visible to other processes that are
> members of the namespace, but are invisible to other processes.
> One use of namespaces is to implement containers.

作為隔離機制，只有存在於 namespace 中的 process 可以互相看到彼此的資源，若不存在於 namespace 之中的 process 則無法看到其內容。而這正適合用來實作 container

# Understanding namespaces
具體的來說 namespaces 隔離了以下資源

| Namespace |      Flag       |               Isolates                |
| :-------: | :-------------: | :-----------------------------------: |
|  Cgroup   | CLONE_NEWCGROUP |         cgroup root directory         |
|    IPC    |  CLONE_NEWIPC   |  system v IPC, POSIX message queues   |
|  Network  |  CLONE_NEWNET   | network devices, stack, port ... etc. |
|   Mount   |   CLONE_NEWNS   |             mount points              |
|    PID    |  CLONE_NEWPID   |              process ids              |
|   Time    |  CLONE_NEWTIME  |       boot and monotonic clocks       |
|   User    |  CLONE_NEWUSER  |          user and group ids           |
|    UTS    |  CLONE_NEWUTS   |     hostname and NIS domain name      |

注意到 Time 是自從 `linux kernel 5.6` 起正式併入主線(詳見: [The Time Namespace Appears To Finally Be On-Deck For The Mainline Linux Kernel](https://www.phoronix.com/scan.php?page=news_item&px=Linux-Time-Namespace-Coming))

其他資源有隔離的需求很合理，但是 Time 也需要隔離...?\
在 [30b67b1d9a2c50d5581cd3bdacf5f312ca4dfbaa](https://git.kernel.org/pub/scm/linux/kernel/git/tip/tip.git/commit/?h=timers/core&id=769071ac9f20b6a447410c7eaa55d1a5233ef40c) 這筆 commit 中我們可以窺探其中的奧秘

> For many users, the time namespace means the ability to changes date and
> time in a container (CLOCK_REALTIME). Providing per namespace notions of
> CLOCK_REALTIME would be complex with a massive overhead, but has a dubious
> value.
>
> But in the context of checkpoint/restore functionality, monotonic and
> boottime clocks become interesting. Both clocks are monotonic with
> unspecified starting points. These clocks are widely used to measure time
> slices and set timers. After restoring or migrating processes, it has to be
> guaranteed that they never go backward. In an ideal case, the behavior of
> these clocks should be the same as for a case when a whole system is
> suspended. All this means that it is required to set CLOCK_MONOTONIC and
> CLOCK_BOOTTIME clocks, which can be achieved by adding per-namespace
> offsets for clocks.

在 container 裡面，使用者可能會想要出於某種原因，進而更改時間，這肯定是沒問題的\
那當使用者退出 container 回到 host machine 時，問題就出現了\
由於 `CLOCK_MONOTONIC` 以及 `CLOCK_BOOTTIME` 都是單調時間(亦即遞增的)，如果說這兩個時間倒退了，那顯然不合理對吧?\
於是乎 time namespace 就被提出，針對以上兩種時間進行隔離，具體的做法是增加 offset 欄位\
根據 [man time_namespaces](https://man7.org/linux/man-pages/man7/time_namespaces.7.html)

> /proc/PID/timens_offsets
> Associated with each time namespace are offsets, expressed with
> respect to the initial time namespace, that define the values of
> the monotonic and boot-time clocks in that namespace. These
> offsets are exposed via the file /proc/PID/timens_offsets.
> Within this file, the offsets are expressed as lines consisting
> of three space-delimited fields:
>
> &lt;clock-id&gt; &lt;offset-secs&gt; &lt;offset-nanosecs&gt;

你說為甚麼不把 `CLOCK_REALTIME` 也一起加到 namespace 裡面? 因為加上去他的 overhead 會過多，詳細說明可以參考 [Linux Kernel - Clock]()

# Namespace life cycle
namespace 的作用域普遍的來說在 `最後一個` process 離開 namespace 之後就會自動回收，不過仍有一些例外\
概括地來說，就是當 namespace 有被直接或間接的使用的情況下，namespace 會持續存在

- file 或 mount 存在於 `/proc/[pid]/ns/*` 下
- hierarchical namespace(亦即有 child namespace)
- PID/time namespace 存在 symbolic link
- PID/time namespace 存在 mount filesystem

# Reference
- [namespaces](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [time_namespaces](https://man7.org/linux/man-pages/man7/time_namespaces.7.html)

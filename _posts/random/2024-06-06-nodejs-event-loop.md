---
title: 理解 Node.js 中非同步處理與 Event Loop 的關係
date: 2024-06-06
description: 在 Node.js 中，非同步處理是由 Event Loop 來處理的，理解 Event Loop 有助於你寫出高效能的 Node.js Application。本文將會從頭介紹 Event Loop 的概念，並配合上一些例子讓你實際了解非同步處理的概念
categories: [random]
tags: [nodejs, javascript, event, queue, event loop, first class function, closure, callback, microtask queue, macrotask queue, libuv, libeio, lexical scoping]
math: true
---

# Preface
```js
(() => {
  setTimeout(() => {
    console.log(1)
  })
  Promise.resolve().then(() => {
    console.log(2)
  })
  console.log(3)
})()
console.log(4)
```

工程師的面試，常常會遇到這種要求給出執行順序的考題\
你能正確的判斷出他的順序嗎？

# What is Event and Event Handler in JavaScript
JavaScript 最早是用於網頁當中的腳本語言\
它主要是為了處理 user 的 action, 像是 `onClick`, `onChange` 等等的事件\
而這些事件，都需要特定的處理程式來進行處理\
就是 Event Handler

![](https://miro.medium.com/v2/resize:fit:640/format:webp/1*KGBiAxjeD9JT2j6KDo0zUg.png)
> ref: [How JavaScript works: Event loop and the rise of Async programming + 5 ways to better coding with async/await](https://medium.com/sessionstack-blog/how-javascript-works-event-loop-and-the-rise-of-async-programming-5-ways-to-better-coding-with-2f077c4438b5)

即使你定義了 Event Handler，因為你無法預測使用者何時為動作\
所以你實際上是定義了一個 callback function\
當 **事件** 發生的時候，這個 callback 會負責處理所有相對應的動作

## First Class Function
JavaScript 的 callback 其實是 first class function\
簡單來說，first class function 就是 function 擁有跟 variable 一樣的地位\
比如說

1. Function 可以被當作參數丟來丟去
2. Function 可以被當成 variable 被 assign
3. 符合 [Closure](#closure)

## Closure
### Lexical Scoping
我們都知道！ local variable 是有特定的 scope 才能存取的\
在 function 裡的 variable 也是有自己的 scope

```js
function createGreeter(greeting) {
  return function(name) {
    return `${greeting}, ${name}!`;
  }
}

const morningGreeter = createGreeter("Good Morning");
const eveningGreeter = createGreeter("Good Evening");

console.log(morningGreeter("Alice")); // Outputs "Good Morning, Alice!"
console.log(eveningGreeter("Bob"));  // Outputs "Good Morning, Bob!"
```

可以看到 `createGreeter` 裡面回傳了一個 function\
但它會 access 外部的 variable `greeting`\
這個特性稱為 **Lexical Scoping**

<hr>

Closure 的特性是結合了 function 以及 [Lexical Scoping](#lexical-scoping)\
上述的例子，`createGreeter` 形成了一個 Closure\
而任何 in-scope 的變數們都會存在於 Closure 之中(i.e. Lexical Scoping)\
所以這就是為什麼當呼叫的時候，仍然可以存取 `greeting` 變數

# Node.js Architecture
JavaScript 最初是用於網頁的腳本語言\
由於他是 single thread 的，他要怎麼處理 user 的相關 event 呢？\
單一執行緒，勢必會 block 住整個網頁，整體的使用者體驗是不好的\
瀏覽器有提供非同步的執行環境，所以不會被 block 住

但 callback 其實是會造成所謂的波動拳\
所以 Promise(ES6) 以及 Async/Await(ES2017) 被引入

![](https://pbs.twimg.com/media/DYsBhtdVwAA1Fak?format=jpg&name=900x900)

## Libuv
![](https://docs.libuv.org/en/v1.x/_images/architecture.png)
> ref: [Design overview](https://docs.libuv.org/en/v1.x/design.html#design-overview)

要把 JavaScript 搬到 server 上執行，對應的非同步 I/O 也需要一個環境\
Node.js 為此也提供了一個由 [libuv](https://github.com/libuv/libuv) 實現的 non-blocking I/O 的環境\
它本身是屬於 event driven 的架構

早期，在 node 0.4 的時候是透過 [libev](https://github.com/enki/libev) 以及 [libeio](http://software.schmorp.de/pkg/libeio.html) 實現的\
但現在改為 [libuv](https://github.com/libuv/libuv)\
主要原因是因為

1. libev 內部是使用 [select](https://man7.org/linux/man-pages/man2/select.2.html) 系統呼叫，而開發團隊對於 select 的效能表現不滿意
2. libev 在當時對於 windows 的兼容性並不佳

[libuv](https://github.com/libuv/libuv) 本身抽象化了不同系統平台的非同步操作，並提供統一界面\
比如說 Linux 是用 [epoll](https://man7.org/linux/man-pages/man7/epoll.7.html), Mac 是用 [kqueue](https://man.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2)\
在每個平台上使用各自最優秀的 polling mechanism 來達到最好的效果

### Handles and Requests
libuv 的兩個核心概念是 handle 和 request

基本上使用者可以透過這兩個概念來操作非同步 I/O\
handles 是一個 long-lived 的物件\
透過它去下 requests

requests 就是你想要做的事情\
比如說開啟一個檔案之類的

之後就交給 libuv 去監控管理那些 file descriptor\
當完成之後，callback 就會被呼叫

## Event Loop
![](https://javascript.info/article/event-loop/eventLoop.svg)
> ref: [Event loop: microtasks and macrotasks](https://javascript.info/event-loop)

JavaScript 的 code 是跑在 Event Loop 上的\
Event Loop 本質上會先註冊 event 的 callback(同步或者是非同步)\
然後會依序執行 event queue 當中的 callback\
並適時註冊新的 event callback

除此之外，所有的 non-blocking asynchronous 操作都是在 Event Loop 上執行

它真的只是一個無窮迴圈，根據 [libuv/src/unix/core.c](https://github.com/libuv/libuv/blob/v1.x/src/unix/core.c#L415)
```c
int uv_run(uv_loop_t* loop, uv_run_mode mode) {
  int timeout;
  int r;
  int can_sleep;

  r = uv__loop_alive(loop);
  if (!r)
    uv__update_time(loop);

  /* Maintain backwards compatibility by processing timers before entering the
   * while loop for UV_RUN_DEFAULT. Otherwise timers only need to be executed
   * once, which should be done after polling in order to maintain proper
   * execution order of the conceptual event loop. */
  if (mode == UV_RUN_DEFAULT && r != 0 && loop->stop_flag == 0) {
    uv__update_time(loop);
    uv__run_timers(loop);
  }

  while (r != 0 && loop->stop_flag == 0) {
    can_sleep =
        uv__queue_empty(&loop->pending_queue) &&
        uv__queue_empty(&loop->idle_handles);

    uv__run_pending(loop);
    uv__run_idle(loop);
    uv__run_prepare(loop);

    timeout = 0;
    if ((mode == UV_RUN_ONCE && can_sleep) || mode == UV_RUN_DEFAULT)
      timeout = uv__backend_timeout(loop);

    uv__metrics_inc_loop_count(loop);

    uv__io_poll(loop, timeout);

    /* Process immediate callbacks (e.g. write_cb) a small fixed number of
     * times to avoid loop starvation.*/
    for (r = 0; r < 8 && !uv__queue_empty(&loop->pending_queue); r++)
      uv__run_pending(loop);

    /* Run one final update on the provider_idle_time in case uv__io_poll
     * returned because the timeout expired, but no events were received. This
     * call will be ignored if the provider_entry_time was either never set (if
     * the timeout == 0) or was already updated b/c an event was received.
     */
    uv__metrics_update_idle_time(loop);

    uv__run_check(loop);
    uv__run_closing_handles(loop);

    uv__update_time(loop);
    uv__run_timers(loop);

    r = uv__loop_alive(loop);
    if (mode == UV_RUN_ONCE || mode == UV_RUN_NOWAIT)
      break;
  }

  /* The if statement lets gcc compile it to a conditional store. Avoids
   * dirtying a cache line.
   */
  if (loop->stop_flag != 0)
    loop->stop_flag = 0;

  return r;
}
```

### Event Loop Phase
上述程式碼實作，它執行了滿多東西的，但重點在所謂的 `phase`\
Event Loop 總共有 6 個 phase

1. timers(`uv__run_timers`)
2. pending(`uv__run_pending`)
3. idle, prepare(`uv__run_idle` and `uv__run_prepare`)
4. poll(`uv__io_poll`)
5. check(`uv__run_check`)
6. closing(`uv__run_closing_handles`)

Event Loop 初始化的時候它會註冊所有 event 與其相對應的 callback\
這些 callback 會放在各個 phase 自己獨立的 **FIFO** queue 當中\
當執行到對應的 phase 的時候，Event Loop 會讀取 queue 中的 event 並執行相對應的 callback 直到
+ 沒有任何的 callback 需要執行
+ callback 執行數量已經達到上限
+ timeout(preemption)

注意到 Event Loop 是從 Poll phase 開始
1. 讀取新的 I/O event, 並執行相對應的 callback(幾乎是全部的 callback, 但有例外)
2. 執行 `setImmediate` 的 callback
3. 執行 close callback
4. 執行 `setTimeout` 以及 `setInterval` 的 callback
5. pending, idle, prepare

> `setTimeout` 與 `setImmediate` 如果都在 main module 裡面執行\
> 他們的執行順序是未知的，可以確定的是他們都是執行在下一個 tick

> 一個完整的 Event Loop 稱為一個 tick

## Event Loop Tasks
因為 main thread 的職責是執行 JavaScript\
當它遇到
1. 同步的 task(作業系統底層沒有提供非同步版本)
    + 舉例來說 [DNS](https://nodejs.org/api/dns.html) 或是 [File System](https://nodejs.org/api/fs.html#fs_threadpool_usage)
2. CPU-intensive 的 task
    + [Crypto](https://nodejs.org/api/crypto.html)

的時候，就會將其交由其他人([Worker Pool(Thread Pool)](#worker-poolthread-pool) or [Task Offloading](#task-offloading))來執行

Event Loop 的重點在於執行 JavaScript 的程式碼，如果遇到會卡住的 task\
不論是需要等待抑或著是需要執行一段時間的程式碼，這些 task 都應該交由他人執行\
不要去嘗試以任何方式卡住 Event Loop\
當 Event Loop 執行順利的情況下 Node.js 就可以很好的 scale

> callback 也要盡量的小，Event Loop 才能公平的 schedule callback

## Worker Pool(Thread Pool)
worker pool 顧名思義就是他有很多個 worker 等著執行工作\
每一個 worker 都是一條 thread\
你會問，可是 JavaScript 不是 single thread 的嗎？\
對，但是 worker pool 這邊是 multi thread 的\
只有執行 JavaScript(或者說執行 Event Loop) 的 main thread 是 single thread

> 為什麼不使用 child process?\
> 因為光是維護那些 child process 的工作量就可能導致你沒時間去管理 worker pool\
> 最終導致 [fork bomb](https://en.wikipedia.org/wiki/Fork_bomb)

CPU 吃重的任務會交給 worker pool 執行(比如說數學計算)\
它會透過內建的 C++ API 來做\
這在某種程度上會增加 overhead(因為要從 JS 轉到 C++)\
比如說 binding 的 overhead 以及溝通的成本(serialize 以及 deserialize)

> 針對內建沒有提供的 addon, 你也可以自己撰寫 C++ addons 來做

### Task Offloading
檔案的操作通常我們可以讓作業系統幫我們監控\
比如說當檔案開啟完成的時候通知我

>透過比如說 Linux 的 [epoll](https://man7.org/linux/man-pages/man7/epoll.7.html), macOS 的 [kqueue](https://man.freebsd.org/cgi/man.cgi?query=kqueue&sektion=2)

當事情完成的時候，通知回 [Event Loop](#event-loop) 並執行其對應的 callback

> Event Loop 儲存的實際上是 file descriptor 而不是 events\
> 所以才收的到 完成的訊號

## Task Queue
Event Loop 除了各自 phase 擁有自己的 callback queue 之外\
還有另外三種 "task queue"，分別是 `nextTick Queue`, `microtask Queue` 和 `macrotask Queue`

我們在看 libuv 的程式碼的時候並沒有分的那麼細，甚至都沒看到他們在哪裡\
libuv 本質上在處理的都是 macrotask(像是 I/O)\
你在網路上看到在說 microtask queue 這種東西\
在 Node.js 當中是他是由 V8 處理的(並不屬於 libuv)，所以當然在 libuv 裡面看不到

> > So, only libuv provides the eventloop features in nodejs?
> 
> Yes, the only exception being the microtask queue, i.e. what Promises, which is provided by V8, \
> but I think it would be odd to consider that an event loop or part of an event loop (in particular, \
> because it doesn’t actually involve events of any kind, it’s just a queue of code that should be run in the future).

> ref: [event loop: which eventloop is used by nodejs? eventloop of v8 or eventloop of libuv?](https://github.com/nodejs/help/issues/3124#issuecomment-744065582)

<hr>

回到當初破題的問題，執行順序究竟為何
```js
(() => {
  setTimeout(() => {
    console.log(1)
  })
  Promise.resolve().then(() => {
    console.log(2)
  })
  console.log(3)
})()
console.log(4)
```

根據 [Understanding setImmediate()](https://nodejs.org/en/learn/asynchronous-work/understanding-setimmediate#understanding-setimmediate)\
Event Loop 執行的順序為 `nextTick queue` :arrow_right: `microtask queue` :arrow_right: `macrotask queue`

+ `nextTick queue`
    + 包含 `process.nextTick`
+ `microtask queue`
    + 包含 `promise`
+ `macrotask queue`
    + 包含 `setTimeout`, `setInterval`, `setImmediate`

所以我們可以知道答案是 `3421`

首先，任何同步的 code 一定是優先執行的\
因為第一行的 anonymous function 在它被定義的時候就被呼叫了(第九行)\
然後最外層的同步 code 也會被執行\
所以我們可以得出 `34` 這個部份答案

再來就是裡面的 promise 以及 setTimeout\
我們知道 microtask queue 一定會先被執行，所以 `2` 緊隨其後\
最後才是 `setTimeout` 的 `1`

> `setTimeout` 會在 Event Loop 的最後一個階段才被執行

# References
+ [JavaScript Asynchronous Programming and Callbacks](https://nodejs.org/en/learn/asynchronous-work/javascript-asynchronous-programming-and-callbacks)
+ [Why are functions not considered first class citizens in C](https://stackoverflow.com/questions/48092176/why-are-functions-not-considered-first-class-citizens-in-c)
+ [First-class Function](https://developer.mozilla.org/en-US/docs/Glossary/First-class_Function)
+ [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)
+ [LXJS 2012 - Bert Belder - libuv](https://www.youtube.com/watch?v=nGn60vDSxQ4)
+ [Design overview](https://docs.libuv.org/en/v1.x/design.html#design-overview)
+ [The Node.js Event Loop: Not So Single Threaded](https://www.youtube.com/watch?v=zphcsoSJMvM)
+ [Overview of Blocking vs Non-Blocking](https://nodejs.org/en/learn/asynchronous-work/overview-of-blocking-vs-non-blocking)
+ [【python】asyncio的理解与入门，搞不明白协程？看这个视频就够了。](https://www.youtube.com/watch?v=brYsDi-JajI)
+ [【python】await机制详解。再来个硬核内容，把并行和依赖背后的原理全给你讲明白](https://www.youtube.com/watch?v=K0BjgYZbgfE)
+ [do promises get resolved between the end of eventloop phase and before the start Phase of the eventloop?](https://github.com/nodejs/help/issues/3126)
+ [event loop: which eventloop is used by nodejs? eventloop of v8 or eventloop of libuv?](https://github.com/nodejs/help/issues/3124)
---
title: 一文看懂 RxJS！
date: 2023-09-19
categories: [rxjs]
tags: [rxjs, typescript, functional programming, side effect, observable]
math: true
---

# Functional programming
在開始介紹 RxJS 之前，了解 functional programming(FP) 是必要的

functional programming 是一種程式設計的方法，有別於傳統 [imperative programming](#imperative-programming) 的方式\
functional programming 更像是 [declarative programming](#declarative-programming)

## Example
直接上 code 比較好了解

```javascript
const arr = [1, 3, 5, 7, 9];
arr.map(item => item * 2);

// [2, 6, 10, 14, 18]
```
TODO

## How does FP works
TODO

## What if I want to Add Debug Message during Processing
從上述的流程你可以很清楚的看到，下一層的輸入為上一層的輸出，一層一層算下來最終得到你要的結果\
而實務上如果你想要在 operator 中間 debug(以最笨的除錯方式 `console.log` 來說)，你要怎麼做？

一般來說你可以寫在 operator 裡面的 function 裡面，operator 裡面都是擺 [arrow function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions), 其實你也可以用傳統的方式定義 JS function 如下
```javascript
map(user => {
    console.log(user)
    return user;
})
```

通常來說是不會建議像上面這樣寫啦，因為這算是誤用了 map 這個 operator\
那還有沒有別種方法可以作到類似的事情，有沒有一種 operator 是不會影響到輸入以及輸出的？ 也就是不會影響到當前狀態的

在 Function Programming 有一個概念叫做 ***side effect(副作用)***\
對於 `會破壞自身以外的事物或狀態的行為` 就叫做副作用

# Side Effect
前面提到，破壞自身以外的事物的狀態或行為，就代表它擁有副作用\
side effect 的差別，使得 function 可以進一步劃分為以下兩類

## Non-Pure Function
以上面 map 為例，它本身是屬於 `non-pure function`\
因為除了進行輸入輸出的操作之外，它改變了自身以外的事物以及狀態

你說，單純的 console.log 也算副作用嗎？\
很明顯的是，它改變了 console 的輸出，即自身以外的狀態\
以這個例子，它破壞了 global state

## Pure Function
相對的，`pure function` 的定義就很簡單\
給定特定輸入，一定會得到相對應的輸出, 並且不會改變其他事物以及狀態\
在 Functional Programming 的定義上來說，side effect 的出現是不允許被出現的\
因為 side effect 往往是出現 bug 的主要因素

所以，為了避免在 pure function 裡面有 side effect 的出現，RxJS 有一個 operator 叫做 [tap](https://rxjs.dev/api/operators/tap)\
其設計目的就是為了要進行 side effect 的操作(e.g. `console.log`)

# Imperative vs. Declarative Programming
## Imperative Programming
更注重在 `描述` 程式該如何運行\
也就是 **手把手告訴電腦每個執行步驟**

## Declarative Programming
著重在 `定義運算的邏輯`，數學式思考\
也就是 **我告訴你我要哪些資料，怎麼拿到怎麼計算我不知道**

像是 [SQL](https://en.wikipedia.org/wiki/SQL) 也是屬於這種的

<hr>

具體來說他的差別是長這樣
![](https://media.licdn.com/dms/image/C4E12AQECZ9__XT2RkA/article-inline_image-shrink_1000_1488/0/1639321694917?e=1700697600&v=beta&t=y9X9PixOdwCnnugSdPP6bSzXEeOyrycumtwVegEasFk)
> ref: [Imperative vs Declarative Programming in JavaScript](https://www.linkedin.com/pulse/imperative-vs-declarative-programming-javascript-yehuda-margolis/)

不是阿，看起來你在 declarative programming 裡面不也詳細的寫了演算法的細節嗎\
注意到差別在於我沒有仔細的跟你說要如何 iterate 整個 array\
也就是在某種程度下，我抽象化了這部份

這也就是它跟手把手的差別

# Observer Pattern
觀察者模式是另一個了解 RxJS 的前備知識

與其使用類似 [Polling](https://en.wikipedia.org/wiki/Polling_(computer_science)) 定期查詢狀態更新\
Observer Pattern 則是採用 **主動通知** 的作法，當有任何更新的時候主動通知訂閱者(透過將訂閱者的資料儲存在本地)\
這種作法很大程度解決了 Polling 浪費的 CPU 資源\
也能夠降低耦合性

詳細的討論可以參考 [設計模式 101 - Observer Pattern \| Shawn Hsu](../../design-pattern/design-pattern-observer)

# Introduction to RxJS
TODO

# Reference
+ [彻底理解 RxJS 里面的 Observable 、Observer 、Subject](https://juejin.cn/post/6844904165181751304)
+ [Introduction](https://rxjs.dev/guide/overview)
+ [希望是最淺顯易懂的 RxJS 教學](https://blog.techbridge.cc/2017/12/08/rxjs/)
+ [RxJS Marbles](https://rxmarbles.com/)
+ [What's the difference between pure and non-pure functions in programming?](https://www.quora.com/Whats-the-difference-between-pure-and-non-pure-functions-in-programming)
+ [副作用 (電腦科學)](https://zh.wikipedia.org/wiki/%E5%89%AF%E4%BD%9C%E7%94%A8_(%E8%AE%A1%E7%AE%97%E6%9C%BA%E7%A7%91%E5%AD%A6))
+ [What are "side-effects" in the context of functional programming?](https://www.quora.com/What-are-side-effects-in-the-context-of-functional-programming)

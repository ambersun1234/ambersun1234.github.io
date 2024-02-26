---
title: 神奇的演算法 - Greedy Algorithm
date: 2024-02-18
description: 貪婪演算法，顧名思義，這種演算法的概念是以 "貪婪" 為優先選擇，不考慮後果只注重當下的最佳選擇，就是貪婪演算法的核心概念
categories: [algorithm]
tags: [greedy]
math: true
---

# Preface
還記得之前上演算法的時候，最看不懂的東西就是貪婪法了\
不過其實他的核心概念很簡單，寫起來也簡單\
趁著還記得細節的時候，把它紀錄起來

# Introduction to Greedy Algorithm
貪婪演算法，顧名思義，這種演算法的概念是以 "貪婪" 為優先選擇\
什麼意思呢

貪婪的表現是 `不會考慮後果的`\
不考慮後果只注重當下的最佳選擇，就是貪婪演算法的核心概念\
也因此，貪婪法 **並不會都給出最佳解**

> 只考慮當下最優解\
> 換句話說就是，它不會折返重新計算有沒有更好的方法

但是找零錢的問題，是個典型貪婪法能夠提供最佳解的題目\
通常來說，找錢一定從大面額到小面額\
比如說，`125` 可以拆成 `100 * 1 + 10 * 2 + 5 * 1`\
這個例子，你貪婪的對象就是 **面額的大小**\
因此在這個狀況下，貪婪法可以給出最佳解

> 可參考 [LeetCode 322. Coin Exchange](https://leetcode.com/problems/coin-change/description/)

不過如果題目稍微變形一下，就不一定了\
比方說題目要求，回傳的硬幣數量要是最小的，那貪婪法就不一定有用了\
假設你擁有 `1`, `5`, `10`, `20` 以及 `25` 的硬幣，那麼 41 塊可以有兩種找錢的方式
1. `(25 * 1) + (10 * 1) + (5 * 1) + (1 * 1)` :arrow_right: 4 枚硬幣
2. `(20 * 2) + (1 * 1)` :arrow_right: 3 枚硬幣

可以看到，貪婪法失效了

# Is Greedy Algorithm Useless?
既然貪婪法不一定能給出全局最佳解\
那它實際上的用處在哪呢？ 是不是就沒有用了

其實不然，雖然不一定能給出全域最佳解\
但由於貪婪法他的實作容易而且執行速度較快\
它能夠一定程度給你解法，即使它不是最好的答案

最後就是針對一些 real time 的 application 它可能需要邊執行邊做決定的那種\
貪婪法可以給到 `當下最優解`

# When to Use Greedy Algorithm
其實這個相比其他題目，貪婪法好像沒有一個準確的準則說這題一定可以用\
但一個比較好的 guideline 是你不需要找到全域最佳解，一個足夠好的答案如果也可以接受的話，也可以使用\
另一個通則則是區域最佳解對之後的選擇影響不大

# [LeetCode 55. Jump Game](https://leetcode.com/problems/jump-game/description/)
這題其實還滿好玩的，如果能夠不看答案寫出來我相信你就理解貪婪法了

題目是這樣子的\
給你一個 array, 每個 array[i] 都代表著能夠跳躍的最大距離\
請你求出，你能不能從 起點 跳到 終點?

他的第一個範例是這樣的
> Input: nums = `[2,3,1,1,4]`\
> Output: true\
> Explanation: Jump 1 step from index 0 to 1, then 3 steps to the last index.

我當初看到這個範例覺的它怪怪的\
我們已經知道他是貪婪法了，可是為什麼他的執行過程看起來一點都不貪婪？\
在第 0 個位置的時候，你明明可以跳兩步，但為什麼你只跳一步呢？

如果你嘗試用貪婪法下去模擬，你會發現你可以這樣走\
index 0(2) :arrow_right: index 2(1) :arrow_right: index 3(1) :arrow_right: index 4(4)\
這樣走也會到終點

<hr>

所以這題要怎麼解\
目標是走到終點，要思考的點是我們怎麼樣會走不到終點？\
如果跳躍距離為 0，是不是就沒辦法往前走了？\
所以我們要貪婪的對象，是目標的數值不能為 0\
所以他的貪婪核心算法理論上應該長這樣

```go
counter := nums[i]

for counter > 0 {
    if i + counter >= len(nums) - 1 {
        return true
    }
    if nums[i + counter] != 0 {
        i += counter
        break
    }
    counter -= 1
}
```

滿簡單的對吧\
基本上就是看落點有沒有可能是 0(亦即我們走不到終點)\
如果它不是 0 我們就拿到下一個落點位置 `counter` 了\
之後就把當前位置加上 counter offset 一直走就知道結果了

當你寫完的時候，你可能會發現有問題\
`[3,0,8,2,0,0,1]` 這個測資居然是錯的\
實際走一次看看問題在哪

我們的貪婪法實際執行過程如下\
index 0(3) :arrow_right: index 3(2) :arrow_right: index 5(0)\
是 false 他到不了

但你如果手動走走看你會發現你是這樣走的\
index 0(3) :arrow_right: index 2(8) :arrow_right: :crown:\
他是可以到終點的

<hr>

很明顯我們的算法有問題\
只考慮非 0 的落點很顯然不夠貪婪\
你要找的當前落點必須是你能夠達到的最遠距離\
所以提早 break 是不行的

```go
counter := nums[i]

maxJump := 0
maxJumpV := 0
for counter > 0 {
    if i + counter >= len(nums) - 1 {
        return true
    }
    if nums[i + counter] != 0 {
        if nums[i + counter] > maxJumpV {
            maxJumpV = nums[i + counter]
            maxJump = counter
        }
    }
    counter -= 1
}
```

但這樣仍然不夠貪婪！\
沒錯，上面的解法仍然會錯\
`[4,2,0,0,1,1,4,4,4,0,4,0]` 這個測資即使你選了當前能夠跳躍最遠距離的仍然會錯\
為什麼?

因為我們少考慮了原本跳躍的距離\
在 index 0 的時候我們最大跳躍距離是 4, 在 index 1 到 index 4 之中\
他們的跳躍距離分別是 [2, 0, 0, 1]，很明顯之中的最大距離是 2

但如果我們選擇 index 1, 總共能跳躍的距離是 `1 + 2`\
你要先從 index 0 到 index 1, index 1 才能最多往後跳 2\
但如果你選擇 index 4, 總共能跳躍的距離是 `4 + 1`\
從 index 0 到 index 4, index 4 在往後跳 1

很明顯的，我們要考慮的當前最佳解是 **當前跳躍距離 + 落點能提供的跳躍距離**\
回到它給的範例，其實他的算法是貪婪的，不過它貪婪的對象 `不僅限於當前跳躍距離` 而已\
所以完整的算法應該是這個樣子的

```go
counter := nums[i]

maxJV := 0
maxJ := 0
for counter > 0 {
    if i >= size - 1 || i + counter >= size - 1 {
        return true
    }

    if nums[i + counter] != 0 && 
        counter + nums[i + counter] > maxJV {
        maxJV = counter + nums[i + counter]
        maxJ = counter
    }
    counter -= 1
}
```

當前跳躍距離(counter) + 落點能提供的跳躍距離(nums[i + counter]) 才是最貪婪的當前最佳解\
因此只要找到最大的數值，我們就能夠知道你該跳多少了(maxJ)

# See Also
+ [LeetCode 122. Best Time to Buy and Sell Stock II](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-ii/description/)

# References
+ [貪婪演算法](https://zh.wikipedia.org/zh-tw/%E8%B4%AA%E5%BF%83%E7%AE%97%E6%B3%95)

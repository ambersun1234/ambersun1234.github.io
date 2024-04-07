---
title: 神奇的演算法 - 動態規劃 Dynamic Programming
date: 2024-03-13
description: 
categories: [algorithm]
tags: [dynamic programming, dp]
math: true
---

# Preface
動態規劃一直是我覺的不容易掌握的演算法技巧，它不像其他演算法技巧有一個固定的模式，而是一種思維方式\
題目的靈活性高，不太容易掌握

# Starting From Fibonacci Sequence
費氏數列是資工系學生一開始接觸到的題目\
費氏數列的定義是 $F(n) = F(n-1) + F(n-2)$，而 $F(0) = 0, F(1) = 1$\
所以寫起來基本上長這樣

```go
func fibonacci(n int) int {
    if n == 0 {
        return 0
    }
    if n == 1 {
        return 1
    }
    return fibonacci(n-1) + fibonacci(n-2)
}
```

你可能有聽過，這個版本的實作效率非常差\
這是因為這個版本的實作會重複計算很多次相同的值\
所以他的 time complexity 是 $O(2^n)$(i.e. `exponential`)

所以更好的解法之一是使用動態規劃\
基本上我們知道 fib(n) 等於前一項加上前兩項\
所以你可以用一個 for loop 過去就解決了

```go
func fibonacci(n int) int {
    dp := make([]int, n+1)
    dp[0] = 0
    dp[1] = 1
    for i := 2; i <= n; i++ {
        dp[i] = dp[i-1] + dp[i-2]
    }
    return dp[n]
}
```

我們是逐步的建構出 fib(n) 的值，並且搭配上記憶化搜索，所以 time complexity 是 $O(n)$

# Introduction to Dynamic Programming
DP 的心法是將一個大問題拆解成許多小問題，並且將小問題的解答記錄下來(記憶)\
在解決小問題的時候，記憶化搜索可以幫助我們避免重複計算\
當你解決完所有的小問題後，你就可以得到大問題的解答，答案就出來了

只不過要如何找到解決小問題的公式，老實說這有點難\
看幾個例子或許你會有所感覺

# [LeetCode 120. Triangle](https://leetcode.com/problems/triangle/description/)
題目的要求是說，給定一個三角形，找出從頂點到底邊的最小路徑和

這個題目的解法有點像是走迷宮\
我們可以很輕易的得出他的公式，也就是最小和等於當前的值加上下一層的最小值\
你會想，這還不簡單，用個遞迴從上到下窮舉出所有可能性就可以了

```go
func traverse(x, y int) int {
    return triangle[x][y] + min(
        traverse(triangle, x + 1, y), 
        traverse(triangle, x + 1, y + 1),
    )

}
```

有沒有發現，這個解法你好像在哪裡看過\
它跟我們上面說的 fibonacci 一樣，都是屬於 `exponential` 的解法

為什麼？\
第一層 call，會往下算完全部的可能性；第二層 call，也會往下算完全部的可能性\
它會重複計算很多次\
改進的方法也是一樣的，我們可以用一個 dp 陣列記錄下來(記憶化搜索)

```go
var nnum = int(-1 * 1e5)

func traverse(triangle [][]int, x, y int, dp [][]int) int {
    size := len(triangle)
    if x >= size || y >= size {
        return 0
    }

    if dp[x][y] != nnum {
        return dp[x][y]
    }

    dp[x][y] = triangle[x][y] + min(
        traverse(triangle, x + 1, y, dp), 
        traverse(triangle, x + 1, y + 1, dp),
    )

    return dp[x][y]
}
```

我們可以透過 dp array 進行記憶化搜索，避免重複計算\
當遇到重複計算的時候，我們就可以直接返回答案

# [LeetCode 322. Coin Change](https://leetcode.com/problems/coin-change/description/)
給定一個金額，以及一個硬幣面額的陣列，問你需要多少硬幣可以湊出這個金額，且硬幣數量要是最少的

這題用貪婪法是沒辦法解的，因為多了一個限制，硬幣數量要是最少的\
用遞迴可以窮舉出所有可能性，不過會出現重複的組合需要過濾\
既然在學習 DP，我們就用 DP 來解決這個問題

找零錢一般來說都是從大到小，但硬幣數量不一定會是最少的\
要怎麼知道 `n` 金額的最少硬幣數量呢？\
很明顯我們沒辦法第一時間想出來，因為這個問題太複雜了\
一種方式是我們可以先從小金額開始，一步一步的推導出大金額的最少硬幣數量\
這樣時間複雜度也僅僅只有 $O(n)$

```go
func coin(coins []int, amount int) int {
    dp := make([]int, amount + 1)
    dp[0] = 0

    for i := 1; i <= amount; i++ {
        result := int(1e9)
        for _, coin := range coins {
            if i - coin >= 0 {
                result = min(result, dp[i - coin] + 1)
            }
        }

        dp[i] = result
    }

    if dp[amount] == 1e9 {
        return -1
    }
    return dp[amount]
}
```

重點在 `result = min(result, dp[i - coin] + 1)`\
0 元的時候，有 0 種方法可以湊出，所以 `dp[0] = 0`\
但是為什麼公式的部份需要 `+1` 呢？

上述 iterate 全部的硬幣面額，然後我們要找出最小硬幣數量所以用 min\
`dp[i - coin]` 表示的是 **當前金額扣掉硬幣面額後的金額，所需的最小硬幣數量**\
換句話說，如果我們要湊出當前金額，我們需要湊出 `i - coin` 的金額，而 `i - coin` 的金額正好是目前考慮的硬幣面額\
所以我們需要 `+1`，表示我們使用了一個硬幣

因為 dp[i] 裡面儲存的都是最小硬幣數量，所以可以保證 dp[i + 1] 經由我們的計算肯定也是最小硬幣數量

# Multi-stage Decision Problem
我們剛剛看到的題目都是屬於單一階段決策問題\
也就是他的變因只有一個，需要考慮的事情相對單純(i.e. 最小值)

不過 DP 難的地方，我覺的在於多階段決策問題\
他的變因超過一個以上，整個狀態的轉移變得非常複雜

# See Also
+ [LeetCode 198. House Robber](https://leetcode.com/problems/house-robber/description/)
+ [LeetCode 213. House Robber II](https://leetcode.com/problems/house-robber-ii/description/)

# References
+ 程式設計與演算法競賽入門經典(ISBN: 978-986-347-311-4)

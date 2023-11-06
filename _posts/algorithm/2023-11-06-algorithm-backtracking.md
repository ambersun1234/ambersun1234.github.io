---
title: 神奇的演算法 - Backtracking 與 Divide and Conquer
date: 2023-11-06
categories: [algorithm]
tags: [backtracking, divide-and-conquer, recursion]
math: true
---

# Algorithm Brainstorming
直接看題目比較快，LeetCode 93. [Restore IP Addresses](https://leetcode.com/problems/restore-ip-addresses/description/)\
根據題目要求，給定一個只有數字的字串，找出所有合法的 ip address 的組合

> Input: s = "25525511135"\
> Output: ["255.255.11.135","255.255.111.35"]

我們先列一下他的基本條件
1. 字串的每個字元都是 0 ~ 9 的數字
2. ip 的每個數字，都是 0 ~ 255，而且開頭不能為 0(0 本身除外)

隱藏條件呢？
1. 字串會被分割成 `4 個部份`，不能多也不能少

看到 "所有的組合"，最直覺的想法就是暴力解\
是不是只要窮舉出所有可能的 ip 組合，再找到相符的條件即可\
問題是要怎麼窮舉？

# Divide and Conquer
舉個例子說明會比較簡單\
相信從小到大大家都可能直接或間接的參與過運動相關賽事\
那你一定看過這張圖

![](/assets/img/posts/tournament.jpg)

這張圖是 "賽程表"，表示了目前賽事的進程，以及隊伍的晉級情況\
在比賽還沒開始之前，我們不知道第一名是誰對吧\
但是是不是可以推敲出大概會是誰？

第一名只有兩個選擇，要馬 `B`, 要馬 `C`對吧？\
`B` 是不是只會從 `D`, `E` 之間挑選？\
`C` 是不是只會從 `F`, `G` 之間挑選？\
以此類推, 是不是會得到一個公式呢?

```
因為 first place = winner(B, C)
又因為 B = winner(D, E), C = winner(F, G)

所以 first place = winner(winner(D, E), winner(F, G))
```
而此概念這正是 `Divide and Conquer`

<hr>

Divide and Conquer 的概念是\
將大的東西，切割成小部份\
當我們將小的部份計算完成之後，大的部份也就很容易得出\
就像上面提到的那樣, 我最終可以透過計算每場比賽的情況(winner(D, E), winner(F, G))，進而得出第一名是誰

# Backtracking
窮舉的方法有了\
那 backtracking 又是啥

說到暴力法最為人詬病的事情不外乎是 "較差的執行效率"\
backtracking 的方法可以 **提早停止無效的計算**\
啥意思呢？ 暴力法當中有很多的計算是沒有用的\
[Restore IP Addresses](https://leetcode.com/problems/restore-ip-addresses/description/) 這題我們剛剛有提到一個隱藏條件\
複習一下叫做 `字串會被分割成 4 個部份，不能多也不能少`

這看似是一個廢話，但卻是有用的廢話\
如果我的字串已經被分割成 **5 個部份**，請問它還有符合題目的要求，是一個 ip address 的樣子了嗎？\
想必 **6, 7, 8 個部份** 都是非法的對吧，那往下算就不對了嘛\
這個就是 backtracking 想要避免的東西

這張 gif 很好的展示了 backtracking 的實際流程\
你可以看到他的答案會一直往回走，那就是代表 **那條答案是錯誤的**\
Backtracking 提早終止的那些錯誤的計算\
![](https://upload.wikimedia.org/wikipedia/commons/8/8c/Sudoku_solved_by_bactracking.gif)
> [A Sudoku solved by backtracking.](https://en.wikipedia.org/wiki/Backtracking)

## Time Complexity
也因此，Backtracking 的執行效率一般來說會比純暴力解還要快\
但需要注意的是，最差的情況下，依然跟暴力解一樣

# Solution
```go
import (
    "strconv"
)

func restoreIpAddresses(s string) []string {
    return traverse(s, make([]string, 0), make([]string, 0))
}

func traverse(ip string, split []string, result []string) []string {
    if len(split) == 3 {
        split = append(split, ip)
        for _, v := range split {
            ipValue, _ := strconv.Atoi(v)
            if ipValue < 0 || ipValue > 255 {
                return result
            }
            if string(v[0]) == "0" && len(v) > 1 {
                return result
            }
        }
        return append(result, strings.Join(split, "."))
    }

    for i := 1; i < len(ip); i++ {
        result = traverse(ip[i:], append(split, ip[:i]), result)
    }

    return result
}
```

思路就是結合了上面我們提到的各種方法論\
一個 for loop 窮舉所有的分割方法，從第一個字元開始(不然左邊會是 "" 空字串)

值得注意的是中止條件 `len(split)` 需要等於 3 並不是 4\
目前被分割出來的有 3 個部份，還需要加上還沒加到 `split` array 裡面的第四份，所以是 3\
裡面的判斷基本上就是有沒有符合 ip address 的條件這樣\
符合的就把它加到 result(因為題目說答案可以是任意順序，這裡就不用特別處理)

# References
+ [Backtracking](https://en.wikipedia.org/wiki/Backtracking)

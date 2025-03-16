---
title: 神奇的演算法 - Binary Search 到底怎麼寫才會對？
date: 2025-03-16
categories: [algorithm]
tags: [binary search, lower bound, upper bound, sorted array, leetcode, leetcode-704, leetcode-2560, leetcode-2529]
description: 二元搜尋是一個非常有趣的演算法，他可以在 $O(\log n)$ 的時間複雜度下找到特定的數值，這篇文章將會介紹二元搜尋的基本概念，以及如何實作 lower bound 以及 upper bound
math: true
---

# Introduction to Binary Search
如果說，要在一串排序過後的陣列中，找尋特定的數值，二元搜尋絕對是最快的存在\
憑藉著一次可以排除一半的可能性，使得二元搜尋的複雜度為 `O(log n)`

線性搜尋在一般情況下不算太差，但是當數量級上升的時候，二元搜尋的優勢就會顯現出來\
只不過 binary search 擁有一大前提，那就是陣列內的資料必須是排序過後的(才可以一次過濾掉一半嘛)

寫起來也挺簡單的，可參考 [LeetCode 704. Binary Search](https://leetcode.com/problems/binary-search/description)
```go
func search(nums []int, target int) int {
    size := len(nums)

    left := 0
    right := size - 1

    for left <= right {
        mid := left + (right - left) / 2
        
        if nums[mid] == target {
            return mid
        }

        if nums[mid] > target {
            right = mid - 1
        } else {
            left = mid + 1
        }
    }

    return -1
}
```

> 注意到 `mid := left + (right - left) / 2`，這是為了避免 overflow

## Lower and Upper Bound
二元搜尋的應用不僅僅只是找尋特定的數值，還可以找尋數值的上下界\
比方說，給定一個排序過後的陣列 `[1,2,3,4,4,4,4,5,6,7,8,9]`，我們要找尋數值 4 的上下界\
你可以改寫 binary search 的實作

```go
func lowerBound(nums []int, target int) int {
    size := len(nums)

    left := 0
    right := size - 1

    for left < right {
        mid := left + (right - left) / 2
        
        if nums[mid] >= target {
            right = mid
        } else {
            left = mid + 1
        }
    }

    if left > 0 && nums[left - 1] == target {
        return left - 1
    }

    return -1
}
```

陣列內，數字 4 的下界是 index 3\
我們一樣先從中間一步一步過濾，注意到這裡 `if nums[mid] >= target`\
如果發現中間的數值是大於等於 target，那我們就要更新 **上界**\
注意到為什麼這裡是 `right = mid`，因為 mid 有可能就是 target，所以 ***要保留 mid***

如此這般，你就會找到數值 4 的下界\
當然你會需要檢查一下 left 到底對不對，upperBound 的實作也是類似的

> 注意到這裡是 `for left < right`，要避免無限迴圈

# Correct Way to Implement Binary Search
每次在寫二元搜尋的時候我頭都很痛，因為我總是會忘記一些細節\
比如說我有看過 `right = mid - 1` 以及 `right = mid`，也有看過 `left < right` 以及 `left <= right`\
那到底哪個才是對的？

先說 `for loop` 的條件\
其實重點在於，當 `left == right` 的時候，我們還要不要繼續搜尋\
換言之，他是開區間還是閉區間？\
舉例來說，`[10]`，搜尋 10 的時候顯然答案是存在的，因此你的 for-loop 條件應該是 `left <= right`

至於說是 `mid` 還是 `mid - 1`，取決於 `你需不需要考慮 mid 這個數值`\
如果你不需要考慮 mid 這個數值，那就是 `mid - 1`，反之則是 `mid`

# [LeetCode 2560. House Robber IV](https://leetcode.com/problems/house-robber-iv/description)
本題依舊延續著 House Robber 的傳統，Robber 不會連續搶劫相鄰的房子\
給定一排房子，每個房子都有一定數量的金錢可以竊取，由於上述條件的限制，Robber 會有 N 種不同的搶劫方式

每一種搶劫方式得到的金額，都是從不同的房子取出的金額加總，其中，房屋最大金額稱為 `capability`\
舉例來說 `[2,3,5,9]` 的其中一種方式為 `[2,9]`, 那他的 `capability` 就是 `9`(單次搶劫中房屋價值最高的金額)\
題目要求為，給定 **至少行竊 k 間房屋**，在眾多不同的方式中，找到 **最小的** `capability`

並且附帶上一條至關重要的提示，`It's always possible to steal at least k houses.`

## Process
題目的複雜度稍微高一點，可能需要花點時間理解\
乍看之下，這似乎是一個 DP 題目，因為我們需要嘗試所有可能的組合，找到最小的 `capability`\
動態規劃，我們知道，重點在於一步一步的建構答案，但是這題會需要嘗試所有可能嗎？

> 有關動態規劃可以參考 [神奇的演算法 - 動態規劃 Dynamic Programming \| Shawn Hsu](../../algorithm/algorithm-dynamic-programming/)

與其 1.) 先計算搶劫 k 間房屋，得到 capability 2.) 再計算全局最小 capability\
不如直接 1.) 拿一個 guess capability 2.) 驗證其 capability 是否可以搶劫 k 間房屋

這樣的思考方式就有優化的空間了，為什麼？\
如果 guess capability 無法滿足 k 間房屋，那比該數值大的 capability 也不會滿足\
你是不是能夠直接篩選掉一半的可能性？\
然後這是不是很熟悉？ 就是二元搜尋法

## Implementation
但是二元搜尋仰賴的是一個排序好的數列，這樣才能夠進行二元搜尋\
本題顯然不滿足該特性

所以前面我們才說，我們需要先猜測一個 capability，然後驗證其是否可以滿足 k 間房屋\
這個 guess capability 必須要是一個範圍內的數值，本例來說就是 array 的最大最小值之間

```go
func minCapability(nums []int, k int) int {
    size := len(nums)

    minReward := 1
    maxReward := 1

    for _, num := range nums {
        maxReward = max(maxReward, num)
    }

    for minReward < maxReward {
        midReward := minReward + (maxReward - minReward) / 2

        count := 0
        for i := 0; i < size; i++ {
            if nums[i] <= midReward {
                count += 1
                i++
            }
        }

        if count >= k {
            maxReward = midReward
        } else {
            minReward = midReward + 1
        }
    }

    return minReward
}

func max(a, b int) int {
    if a > b {
        return a
    }
    return b
}
```

當你 apply 二元搜尋下去之後，第二步驟就是驗證該 guess capability 是否可以滿足 k 間房屋\
這裡的驗證方式是採用 `貪婪法`，當房屋價值小於等於 guess capability 時，就可以搶劫\
為什麼？ 因為單次搶劫中房屋最高價值為 capability，換言之，單次搶劫內的房子價值永遠都會小於等於 capability

> 有關貪婪法可以參考 [神奇的演算法 - Greedy Algorithm \| Shawn Hsu](../../algorithm/algorithm-greedy/)

二來是為什麼貪婪法會動？\
我們知道貪婪法的特性是，可以保證區域最佳解，但全域最佳解則不一定\
在這個例子當中，我們只 care ***房屋的數量***，房屋可以被偷的價值不在考慮範圍內\
當遇到符合條件的房屋，一定要選，這樣可以增加勝率(因為我們只考慮房屋數量)

```go
if count >= k {
    maxReward = midReward
} else {
    minReward = midReward + 1
}
```
最後當 count >= k 的時候，為什麼是調整上界？\
因為我們要求的是，全域最小的 capability，所以當 count >= k 的時候，我們要繼續往下找

那為什麼 return value 是 `minReward` 呢？\
你應該有發現，我們在做 binary search 的時候，`mid` 是有可能不存在於 array 中的\
既然這樣為什麼這樣寫還會動？\
因為 `It's always possible to steal at least k houses.`，最小值一定存在於 array 中

# [LeetCode 2529. Maximum Count of Positive Integer and Negative Integer](https://leetcode.com/problems/maximum-count-of-positive-integer-and-negative-integer/description/)
題目的要求是，分別要求計算正數的數量以及負數的數量，求兩者的最大值\
這題雖然是 easy, 但是他的 follow up 要求整體的 runtime 要 $O(\log n)$\
你當然可以線性掃過去逐一檢查，但是仔細看題目，`nums is sorted in non-decreasing order`\
所以 binary search 派上用場了

已經排序過的數列，要怎麼用 binary search？\
因為我們只想知道正數以及負數，0 不在考慮範圍內，因此可以將 0 當成是搜尋的目標\
但是要注意到，數列中的數值並不保證 unique，所以這個問題會演變成 [Lower and Upper Bound](#lower-and-upper-bound)

```go
func maximumCount(nums []int) int {
    size := len(nums)

    var (
        left, right int
        lower = size
        upper = size
    )

    left = 0
    right = size - 1
    for left < right {
        mid := left + int((right - left) / 2)

        if nums[mid] < 0 {
            left = mid + 1
        } else if nums[mid] >= 0 {
            right = mid
            lower = mid
        }
    }

    left = 0
    right = size - 1
    for left < right {
        mid := left + int((right - left) / 2)

        if nums[mid] <= 0 {
            left = mid + 1
        } else if nums[mid] > 0 {
            right = mid
            upper = mid
        }
    }

    return max(lower, size - upper)
}

func max(a, b int) int {
    if a > b {
        return a
    }
    return b
}
```
---
title: 神奇的演算法 - Subarray Sum
date: 2023-02-19
description: 本篇文章將詳細的分解 subarray sum 的問題，並且從累計相對次數獲得啟發，進而優化時間複雜度
categories: [algorithm]
tags: [algorithm]
math: true
---

# Preface
這篇文章主要會以 subarray sum 為主探討一些常見的題目

> subarray 為一個 array 的連續子集合，subarray 不可為空，subarray sum 則為這個子陣列的和

# [LeetCode 560. Subarray Sum Equals K](https://leetcode.com/problems/subarray-sum-equals-k/)
## Brute Force Approach
最直觀的作法當然是每個 subarray 都檢查一遍，確認該 subarray 的總和是否為 k 即可\
pseudo code 為以下
```pseudo
for i from 0 to length(array)
    for j from i + 1 to length(array)
        if sum(array[i] to array[j]) equals k
            answer += 1
```
這樣的作法是使用 2 層 for-loop 下去針對每一個可能的 subarray 進行檢查\
雖然非常的直覺，但他的時間複雜度可以看到是屬於 $O(n^2)$\
對於非常大的陣列來說，它很容易就會 `TLE(Time Limit Exceeded)`\
所以很明顯的，這個作法有待改進

## Cumulative Table
![](https://img.yamol.tw/item/1632087-0-5eba9f06e87c8.png#s-404,324)

上圖為身高的累進圖表，可以看到分別紀錄了各個身高所對應的 **累進比例**\
比方說，從 140 cm 到 160 cm 的人數佔了所有人的 62.5 %

### Cumulative Sum of Array
同樣的概念可以套用到 array 上面\
假設有一個 array [5, 4, -1, 7, 8]\
那麼他的 cumulative sum of array 就會是


|index|0|1|2|3|4|
|:--|:--:|:--:|:--:|:--:|:--:|
|array|5|4|-1|7|8|
|cumulative|5|9|8|15|23|

累進的規則是
```
cumulative[0] = array[0]
cumulative[1] = array[0] + array[1]
cumulative[2] = array[0] + array[1] + array[2]
cumulative[3] = array[0] + array[1] + array[2] + array[3]
```

依此類推

### How to Get Subarray Sum from Cumulative Sum Array
假設我要找的 subarray sum 是 `8`\
以肉眼觀察可以找到 2 組解答，分別為 `[5, 4, -1]` 以及 `[8]`\
那要怎麼利用 cumulative sum array 來快速的找到呢？

根據上述的簡單累進推導規則，我們可以簡單的發現以下規則
```
array[1]                       = cumulative[1] - cumulative[0]
array[1] + array[2]            = cumulative[2] - cumulative[0]
array[1] + array[2] + array[3] = cumulative[3] - cumulative[0]
```

也就是說，要取得 array[i] ~ array[j] 的總和\
$array[i] + array[i + 1] + ... + array[j] = cumulative[j] - cumulative[i - 1]$

回到原本的例子

|index|0|1|2|3|4|
|:--|:--:|:--:|:--:|:--:|:--:|
|array|5|4|-1|7|8|
|cumulative|5|9|8|15|23|

`[5, 4, -1]` 的 sum 用 cumulative 寫出來就會是 `cumulative[2] - cumulative[-1]`

> 我的習慣會是建立 cumulative sum array 的時候在前面多塞一個數值為 0 的(上面的 cumulative[-1] 就會等於 0)

### How Cumulative Sum Array Helps Speedup?
看到這你不難發現，使用 cumulative sum array 可以取得 **任意區間** 的 subarray sum(透過兩個 cumulative 的數值相減即可得到區間和)\
亦即只要把 cumulative sum array 建立起來，你就不需要用 2 層 for-loop 暴力的窮舉出所有可能了

## Cumulative Sum Approach

|index|-1|0|1|2|3|4|
|:--|:--:|:--:|:--:|:--:|:--:|:--:|
|array|0|5|4|-1|7|8|
|cumulative|0|5|9|8|15|23|

你可能會想，即使建立完 cumulative sum array，我不還是得用 2 層 for-loop 慢慢看區間和是否等於 `k` 嗎？\
其實我們可以一邊建立一邊檢查區間和是否等於 k

前面提到，要取得 `array[i] + ... + array[j]` 可以使用 `cumulative[j] - cumulative[i - 1]` 取得\
題目的要求是，區間和要等於 k\
透過簡單的算式
```
因為
array[i] + ... + array[j] = k
array[i] + ... + array[j] = cumulative[j] - cumulative[i - 1]
所以
cumulative[j] - cumulative[i - 1] = k
```
可以得知，目標為 `cumulative[j] - cumulative[i - 1] = k, where i < j`

<hr>

假設你建立 cumulative sum array 到一半，它應該會長成這樣

|index|-1|0|1|2|x|x|
|:--|:--:|:--:|:--:|:--:|:--:|:--:|
|array|0|5|4|-1|x|x|
|cumulative|0|5|9|8|x|x|

有了這個半完成的 cumulative sum array\
你有辦法算出所有區間內的和，包含 [0], [1], [2], [0,1], [0,1,2], [1,2] 每個的區間和

既然我們的目標是區間和要等於 `k`\
把目標稍微改寫能得到 `cumulative[j] - k = cumulative[i - 1]`\
`k` 已經有了，題目給的\
在建立 `cumulative[j]` 的時候，`cumulative[i - 1]` 已經有了(因為 i < j)\
所以！ 我只要往前看，找看看有沒有誰的區間和等於 `cumulative[j] - k` 就可以了！

依照現在這個例子，cumulative sum array 建立到 index 2\
我的目標 `k` 是 8，我只要找有 **哪個先前 cumulative 的數值等於 `cumulative[2] - k`(也就是 `8 - 8`)**， 就代表該區間的和等於 `k`\
為了使得尋找 `cumulative[2] - k` 有沒有存在於先前的區間和裡面，使用 hashmap 加速是一個可靠的選擇

<hr>

講了那麼多，直接上 code
```go
func subarraySum(nums []int, k int) int {
    prefixSum := make([]int, 0)
    prefixMap := make(map[int]int, 0)
    prefixMap[0] = 1
    previousPrefixSum := 0
    answer := 0

    for i, num := range nums {
        prefixSum = append(prefixSum, previousPrefixSum + num)
        if _, exists := prefixMap[prefixSum[i] - k]; exists {
            answer += prefixMap[prefixSum[i] - k]
        }
        previousPrefixSum = prefixSum[i]

        value, exists := prefixMap[prefixSum[i]]
        if !exists {
            prefixMap[prefixSum[i]] = 1
        } else {
            prefixMap[prefixSum[i]] = value + 1
        }
    }

    return answer
}
```

### Why do we Need to Store Occurrence of cumulative[i] in Map
前面提到，為了加速尋找 `cumulative[j] - k` 能夠跑得更快，因此實作當中使用了 map 的結構\
但是為什麼要紀錄 `cumulative[j] - k` 出現了幾次呢？\
只要紀錄他有出現過不就好了嗎？

再看另一個例子

|index|-1|0|1|2|3|4|5|6|7|8|
|:--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
|array|0|3|4|7|2|-3|1|4|2|1|
|cumulative|0|3|7|14|16|13|14|18|20|21|

你可以看到 cumulative 陣列裡面出現了 2 次 14\
假設你的條件剛好是 `cumulative[j] - k = 14`\
如果你沒有紀錄出現的次數，在之後的答案當中你會少算了 1 次(以這個例子來說)

### Do we Need to Consider -k Situation
我在嘗試理解這個算法的時候，一個問題油然而生\
我到底需不需要考慮 `-k` 的情況？

還記得我們運算的陣列是 **累進(累加)** 的嗎？\
意思就是說，如果考慮到 `-k` 的情況，你對回去原本的陣列看，他的 subarray sum 也會是 `-k`\
所以只需要考慮 `k` 的情況就好了

# [LeetCode 53. Maximum Subarray](https://leetcode.com/problems/maximum-subarray)
subarray 是由一個以上的**連續元素**所組成的，而 subarray sum 就是所有區間數值加總起來\
要找到 maximum subarray sum 最直覺的方法就是窮舉出所有區間組合\
但是這樣太複雜了，我們可以試著簡化問題

看一個實際例子比較快\
如果之前的區間最大和(0 ~ n-1)是 `10`
1. `num[n] = 2`, 因為 `10 + 2 > 10`, 所以目前 maximum subarray sum 就是 `10 + 2`(num[0 ~ n])
2. `num[n] = -1`, 因為 `10 + (-1) < 10`，所以目前 maximum subarray sum 就是 `10 + (-1)`(num[0 ~ n])
2. `num[n] = 20`, 因為 `20 > 10`, 所以目前 maximum subarray sum 就是 `20`(num[n])

> 注意第二點，為什麼最大區間和不是 10 而是 9?\
> 因為我們要考慮 "**連續**的情況"\
> 如果你把它寫成 10, 那麼最大區間和中間就會有空格，就不符合 subarray 的定義了

我們可以把上述的情況匯總成以下規則
1. 如果 `num[n]` 小於 `num[0 ~ n]`, 那 maximum subarray sum 就是 `num[0 ~ n]`
2. 如果 `num[n]` 大於 `num[0 ~ n]`, 那 maximum subarray sum 就是 `num[n]`

所以目前最大區間和，取決於 `之前的最大區間和`\
這就是動態規劃(dynamic programming)\
因為要我算出最大區間和實在是太困難了，當我知道之前的最大區間和(n-1)，在加上目前的數字，我可以很輕易的判斷現在的區間最大和為多少(n)

所以實作就很簡單了
```go
func maxSubArray(nums []int) int {
    size := len(nums)
    dp := make([]int, size)
    maxSubSum := nums[0]
    dp[0] = nums[0]


    for i := 1; i < size; i++ {
        dp[i] = max(nums[i], nums[i] + dp[i - 1])
        maxSubSum = max(maxSubSum, dp[i])
    }

    return maxSubSum
}

func max(a, b int) int {
    if a > b {
        return a
    }
    return b
}
```

<hr>

另一種寫法一樣是使用累進的概念\
定義一個 cumulative array\
它負責的就是紀錄累進數字

區間和的寫法可以寫成 cumulative[j] - cumulative[i - 1]\
所以換句話說，當前累進 - 最小的累進就是最大的區間和\
只不過你還要跟 nums[i] 比較，因為有可能 nums[i] 比之前的區間和還大

```go
func maxSubArray(nums []int) int {
    size := len(nums)
    cumulative := make([]int, size + 1)
    cumulative[0] = 0

    result := nums[0]
    cumulativeMin := cumulative[0]
    for i := 1; i <= size; i++ {
        cumulative[i] = cumulative[i - 1] + nums[i - 1]
        result = max(nums[i - 1], max(result, cumulative[i] - cumulativeMin))
        cumulativeMin = min(cumulativeMin, cumulative[i])
    }

    return result
}

func min(a, b int) int {
    if a < b {
        return a
    }
    return b
}

func max(a, b int) int {
    if a > b {
        return a
    }
    return b
}
```

# See Also
+ [LeetCode 1171. Remove Zero Sum Consecutive Nodes from Linked List](https://leetcode.com/problems/remove-zero-sum-consecutive-nodes-from-linked-list/)

# References
+ [C++\| Full explained every step w/ Dry run \| O(n^2) -> O(n) \| Two approaches](https://leetcode.com/problems/subarray-sum-equals-k/solutions/1759909/c-full-explained-every-step-w-dry-run-o-n-2-o-n-two-approaches/?orderBy=most_votes)

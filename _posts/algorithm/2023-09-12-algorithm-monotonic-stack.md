---
title: 神奇的演算法 - Monotonic Stack
date: 2023-09-12
description: Monotonic stack 是一個用來解決 Next Greater Element 的演算法，本篇文章會介紹它的概念以及如何實作
categories: [algorithm]
tags: [array, stack, monotonic]
math: true
---

# Preface
千言萬語都比不上一個真實的範例

考慮以下 array `[1,2,3,2,4,3]`\
求 Next Greater Element(i.e. 該位置下一個比我大的數值為何)\
以上述的例子來看，答案會是 `[2, 3, 4, 4, -1, -1]`

當我看到這個題目的第一眼，直覺會是紀錄最大值(4)就好了\
並且 *由後往前看*\
在還沒有遇到 4 之前，答案是 -1

但如果事情真如我所想的，那麼第一格的答案應該要是 4 才對，怎麼會是 2 呢？\
原因在於我們並不是要找尋最大值，而是 **下一個比我大的值**\
也因為這樣，光是紀錄最大值顯然是不足的\
正確的作法是要紀錄 **歷史比我大的值**

# Monotonic
紀錄這種歷史紀錄，他的其中一個特性是必須是 **單調的**\
維基百科的定義是這樣子的

```
在數學中，給定函數定義域，
當定義域中較小的自變量值小於較大的自變量值時，
較小的自變量值對應的因變量值總是小於較大的自變量值對應的因變量值，
那麼這個函數就是單調增加函數
```

我的理解是當前數字都比我小/大 就是 單調遞增/遞減函數

![](https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Monotonicity_example1.png/330px-Monotonicity_example1.png)
> ref: [單調函數](https://zh.wikipedia.org/zh-tw/%E5%8D%95%E8%B0%83%E5%87%BD%E6%95%B0)

<hr>

上述的例子，比 2 大的數字有 3, 4\
這個歷史紀錄是不是屬於單調遞增呢？

# Introduction to Monotonic Stack
紀錄這些 history 可以用一個 stack 完成，並且 stack 裡的數字均為單調的(不論遞增或遞減)\
聽起來不難，但怎麼建構一個 monotonic stack?

回到最初的例子 `[1,2,3,2,4,3]`，他的歷史數值應該會長這樣
```
     |  0  |  1  |  2  |  3  |  4  |  5  |     index
-----|-----|-----|-----|-----|-----|-----|
     |  1  |  2  |  3  |  2  |  4  |  3  |     origin input
-----|-----|-----|-----|-----|-----|-----|
     |  2  |     |     |     |     |     |     history
     |  3  |  3  |     |     |     |     |
     |  4  |  4  |  4  |  4  |     |     |
```

history 為下一個比自己大的數值(從上而下)\
可以看到它都是呈現單調的排列\
值得注意的是在 index 為 2 的時候，他的歷史只有 `[4]` 並沒有包含 2(index 3 的數值)\
原因是我們要找的是 *比自己大的數值*，因為 2 < 3(自己)，所以它沒有包含進歷史當中

從上面的圖表你能推敲出第一件事情\
就是必須從 **右到左** 建構\
第二件事情是，歷史數值一定都比當前的數字都還要大，換言之，如果當前數字比歷史還要小，我就沒必要寫進歷史

所以，你要做的事情是，**跟 monotonic stack 裡面的數字比大小，如果 stack 的數字比我還要小，就把 stack 的數字丟掉**\
重複一直做，你就會找到比自己大的數值了(or 沒找到)

## Implementation
```go
func nextGreaterValue(nums []int) []int {
    monotonic := make([]int, 0)
    nextGreater := make([]int, len(nums))

    for i := len(nums) - 1; i >= 0; i-- {
        for {
            if empty(monotonic) {
                break
            }

            if peek(monotonic) > nums[i] {
                break
            }
            monotonic = pop(monotonic)            // 比當前數字小，丟掉最新一筆歷史紀錄
        }

        nextGreater[i] = peek(monotonic)
        monotonic = push(monotonic, nums[i])      // 寫入歷史紀錄，要不要保留由 inner loop 決定
    }

    return nextGreater
}

func empty(stack []int) bool {
    return len(stack) == 0
}

func push(stack []int, input int) []int {
    return append(stack, input)
}

func peek(stack []int) int {
    if empty(stack) {
        return -1
    }
    return stack[len(stack) - 1]
}

func pop(stack []int) []int {
    if empty(stack) {
        return stack
    }
    return stack[:len(stack) - 1]
}
```

注意到你不能直接使用 monotonic stack 這個 array 當作結果\
因為它只代表當前的歷史紀錄，因此你必須要使用額外的陣列儲存，以這個例子來說是 `nextGreater`

## Time Complexity
兩層迴圈就是 $O(n^2)$ 嗎\
顯然不是的

第一層迴圈顯然是 $O(n)$\
然後 inner loop 是逐一檢查 stack 的內容\
你說這樣還不是會跑完一次

換個角度思考，stack 裡面的資料進出幾次？\
答案是 2 次，哪 2 次？\
每個元素只會被寫入一次，在 outer loop 的時候做的，而 inner loop 只負責 pop(已經被移出 stack 的元素不可能再寫回去)\
所以整體的複雜度為 $O(2n)$

# Examples

|Level|Link|
|:--|:--|
|Easy|[1475. Final Prices With a Special Discount in a Shop](https://leetcode.com/problems/final-prices-with-a-special-discount-in-a-shop/)|
|Easy|[496. Next Greater Element I](https://leetcode.com/problems/next-greater-element-i/)|
|Medium|[503. Next Greater Element II](https://leetcode.com/problems/next-greater-element-ii/)|

# References
+ [Time complexity of Monotonic stack question](https://stackoverflow.com/questions/69494043/time-complexity-of-monotonic-stack-question)

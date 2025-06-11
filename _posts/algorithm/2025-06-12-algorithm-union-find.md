---
title: 神奇的演算法 - 分組的好朋友 Union Find
date: 2025-06-12
categories: [algorithm]
tags: [union find, disjoint set, tree compression, leetcode-1061, leetcode-1584]
description: 考慮到分組的問題，如果需要複雜的操作，Hash Map 可能會有點麻煩，因此我們需要一個更有效率的方式來管理分組，Union Find 就是一個很好的選擇。本篇將介紹 Union Find 的原理與實作，並且透過實際的題目來加深理解。
math: true
---

# Introduction to Union Find
`Disjoint Set` 是一種資料結構，用來管理一組互不相交的集合（disjoint sets）。每個集合中的元素都是唯一的，且不同集合之間沒有共同的元素。

而 `Union Find` 是 `Disjoint Set` 的另一個名稱，因為這個資料結構主要支援兩種操作：
1. `Find`: 查詢某個元素屬於哪個集合
2. `Union`: 將兩個集合合併成一個新的集合

## Grouping with Hash Map
而如果只是單純分組，是不是能透過 hash map 達成就行了？\
是沒錯，但是單純的 hash map 在處理不同組別合併的時候就會很麻煩

比如說 `group 1` 要跟 `group 2` 合併\
你需要找出所有 `group 2` 的人，然後一一更改至 `group 1`\
這部分是需要找尋所有的 element 然後更新分組號碼

每一次都需要 $O(n)$，這個效能並不好\
並且多個群組的合併也需要更小心的操作\
比如說 (`group 0`, `group 1`) 要跟 (`group 2`, `group 3`) 合併\
這就會需要手動處理更多 corner case

## How Disjoint Set Works
Disjoint Set 採取了不同的做法\
既然是分組嘛，所以核心的思想是，**相同組別的人，其編號必定相同**\
一開始每個元素都是自己一組的，每一組都有編號(可以假設 element `n` 是 group `n`)

那要怎麼合併呢？\
前面提到相同組別一定擁有相同的編號\
考慮以下例子，`element 1` 與 `element 2` 合併就會是
```
element 1: group 1
element 2: group 2

to

element 1: group 1
element 2: group 1
```

我們是不是可以把這個看做是 `Tree` 呢？\
每一個組別都是一個巨大的樹狀結構，而編號就是 **根節點**\
也就是說，合併的過程其實就只是將 node 新增到該樹而已

不過要注意的是，要相連的是 ***兩元素的根節點***\
並不是單純的兩元素的 group number\
原因在於 group number 有可能只是 `child node` :heavy_check_mark:

針對多個群組合併
```
element 1: group 1
element 2: group 1

element 3: group 3
element 4: group 3
```

假設 `element 2` 跟 `element 3` 合併\
也就是會變成全部的元素都在同一組別底下
```
element 1: group 1
element 2: group 1
element 3: group 1
element 4: group 3 <-- child node
```

但是你可以發現 `element 4` 的組別還沒更新\
這個就呼應到說 group number 有可能只是 `child node` 的 case 了\
所以在查詢 `element 4` 的組別的時候依然要查詢 **根節點**\
這部分偏向 lazy loading 啦，有用到的才更新

> 那如果是更新 `element 4` 呢？ `element 3` 的組別號碼是不是也會出問題？\
> 搭配 [Tree Compression](#tree-compression) 會是正確的

## Tree Compression
雖然說組別內部可能會存在 child node\
他最終都會指向 **根節點** 沒錯，但如果子節點過多會導致查詢效率低落\
因此我們需要對他做一定的優化

這個方法稱為 `路徑壓縮`\
因為我們其實不太在乎 **根節點以外的節點**\
我只想知道組別號碼是多少而已

```go
func set(m []int, root int) ([]int, int) {
    if m[root] == root {
        return m, root
    }

    var parent int
    m, parent = set(m, m[root])
    m[root] = parent
    return m, parent
}
```

透過遞迴的方式逐一尋找根節點的數值，然後一一更新回去所有路徑上的子節點\
這樣可以保證說查詢的時候只需要 look up 一次就可以得到正確答案

## [LeetCode 1061. Lexicographically Smallest Equivalent String](https://leetcode.com/problems/lexicographically-smallest-equivalent-string/description/)
這題給定你兩個字串陣列，`s1` 與 `s2` 是可以互相置換的，也就是說 `s1[i] == s2[i]`\
然後在給定你一個字串 `baseStr`，要求你使用上述置換陣列轉換 `baseStr` 使其結果為字典序最小

因為這個置換陣列是有可能存在 chaining 的關係的\
比如說 `'e' == 'o'` 然後 `'a' == 'e'`，可以得到 `'a' == 'o'`\
也因此你可以將置換陣列的內容分組，以上述來說 `'a', 'e' 以及 'o'` 為同一組\
然後答案要是字典序最小的，那也很容易，分組編號設定為字典序最小的即可

```go
func smallestEquivalentString(s1 string, s2 string, base string) string {
    m := make([]int, 26)
    for i := 0; i < 26; i++ {
        m[i] = i
    }

    for i := 0; i < len(s1); i++ {
        c1 := int(s1[i] - 'a')
        c2 := int(s2[i] - 'a')

        rootC1 := get(m, c1)
        rootC2 := get(m, c2)
        
        if rootC1 < rootC2 {
            m[rootC2] = rootC1
            m, _ = set(m, rootC2)
        } else {
            m[rootC1] = rootC2
            m, _ = set(m, rootC1)
        }
    }

    result := make([]string, 0)
    for i := 0; i < len(base); i++ {
        result = append(result, string(get(m, int(base[i] - 'a')) + 'a'))
    }

    return strings.Join(result, "")
}

func get(m []int, root int) int {
    if m[root] == root {
        return root
    }
    return get(m, m[root])
}

func set(m []int, root int) ([]int, int) {
    if m[root] == root {
        return m, root
    }

    var parent int
    m, parent = set(m, m[root])
    m[root] = parent
    return m, parent
}
```

你可以看到說，為了找到組別內字典序最小的字母，因此在合併的時候其實是有多了一個判斷的
```go
if rootC1 < rootC2 {
    m[rootC2] = rootC1
    m, _ = set(m, rootC2)
} else {
    m[rootC1] = rootC2
    m, _ = set(m, rootC1)
}
```

如果今天沒有這個限制，隨便指派一個並不會出問題\
也就是針對一般的 Union Find 來說，你只需要 `m[rootC1] = rootC2` 即可\
因為是更改最上層的組別編號，所以在查詢的時候依然可以得到正確答案

# References
+ [Disjoint-set data structure](https://en.wikipedia.org/wiki/Disjoint-set_data_structure)
+ [Minimum spanning tree](https://en.wikipedia.org/wiki/Minimum_spanning_tree)
